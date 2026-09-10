/**
 * ratesCache.js
 * -------------
 * Local CSV cache for milk rates.
 * Fixes rate fetch timing issues in Collection page by reading rates
 * from a local file instead of making live Supabase API calls.
 *
 * What is stored (ALL of the following per dairy):
 *   ✅ ALL milk types       — Buffalo, Cow, etc.
 *   ✅ ALL rate charts      — sangh, Vibhag A, custom names, etc.
 *   ✅ ALL effective dates  — full history
 *   ✅ Strictly isolated    — one CSV file per dairy_id, no cross-dairy bleed
 *
 * CSV format (per row):
 *   milk_type,fat,snf,rate,effective_date,rate_type,dairy_id
 *   (all string fields are double-quoted to handle commas/spaces safely)
 *
 * File location: Electron userData / rates_cache_{dairy_id}.csv
 */

// ─── CSV Helpers ────────────────────────────────────────────────────────────

/**
 * Parse a single CSV line respecting double-quoted fields.
 * Handles fields like "Vibhag, A" that contain commas.
 */
function parseQuotedCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"'; i++; // escaped inner quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current);
    return result;
}

/**
 * Parse CSV string → array of rate objects.
 * Returns [] if CSV is empty / malformed.
 *
 * @param {string} csvContent
 * @returns {Array}
 */
function csvToRates(csvContent) {
    if (!csvContent || typeof csvContent !== 'string') return [];
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) return [];

    const result = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = parseQuotedCSVLine(line);
        if (parts.length < 7) continue;

        const [milk_type, fatStr, snfStr, rateStr, effective_date, rate_type, dairy_id] = parts;

        const fat  = parseFloat(fatStr);
        const snf  = parseFloat(snfStr);
        const rate = parseFloat(rateStr);

        // Skip rows with invalid numbers
        if (isNaN(fat) || isNaN(snf) || isNaN(rate)) continue;

        result.push({
            milk_type:      milk_type.trim(),
            fat,
            snf,
            rate,
            effective_date: effective_date.trim(),
            rate_type:      rate_type.trim(),
            dairy_id:       String(dairy_id).trim(), // always string — prevents number/string mismatch
        });
    }
    return result;
}

// ─── IPC Helpers ─────────────────────────────────────────────────────────────

function isElectronAvailable() {
    return typeof window !== 'undefined' &&
           window.electron &&
           typeof window.electron.invoke === 'function';
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Load rates from local CSV cache file into memory.
 * Called once when Collection.jsx mounts.
 *
 * @param {string} dairyId
 * @returns {Promise<Array>} Parsed rate objects, or [] if cache missing/corrupt
 */
export async function loadRatesFromCSV(dairyId) {
    if (!isElectronAvailable()) return [];
    if (!dairyId) return [];
    try {
        const result = await window.electron.invoke('rates:read-csv', { dairyId });
        if (!result?.success || !result?.data) return [];
        const rates = csvToRates(result.data);
        console.log(`[RatesCache] Loaded ${rates.length} rates from CSV (dairy: ${dairyId})`);
        return rates;
    } catch (err) {
        console.warn('[RatesCache] loadRatesFromCSV failed (non-fatal):', err);
        return [];
    }
}

/**
 * Pure in-memory rate lookup — no network call, <1ms.
 * Mirrors the logic in api.js `getRateForCollection`.
 *
 * Handles correctly:
 *   ✅ Buffalo vs Cow        (milk_type case-insensitive match)
 *   ✅ Multiple rate charts  (sangh, Vibhag A, custom names...)
 *   ✅ Multiple dates        (picks most recent effective_date <= collection date)
 *   ✅ Dairy isolation       (dairy_id strict trimmed match)
 *   ✅ Fallback to sangh     (if farmer's chart has no data)
 *   ✅ Closest fat+snf       (when exact match not found)
 *   ✅ NaN guards            (safe even with bad input)
 *
 * @param {Array}  cache       - Array returned by loadRatesFromCSV()
 * @param {Object} params
 * @param {string} params.milk_type  - 'Buffalo' or 'Cow'
 * @param {number} params.fat
 * @param {number} params.snf
 * @param {string} params.date       - Collection date (YYYY-MM-DD)
 * @param {string} params.rate_type  - Farmer's assigned rate chart
 * @param {string} params.dairy_id
 * @returns {number|null} Rate, or null → caller falls back to Supabase API
 */
export function lookupRateFromCache(cache, { milk_type, fat, snf, date, rate_type = 'sangh', dairy_id }) {
    if (!cache || cache.length === 0) return null;

    const fatNum = parseFloat(fat);
    const snfNum = parseFloat(snf);
    if (isNaN(fatNum) || isNaN(snfNum)) return null;

    const fatRounded = fatNum.toFixed(1);
    const snfRounded = snfNum.toFixed(1);
    const milkLower  = (milk_type  || '').toLowerCase().trim();
    const dairyTrim  = (dairy_id   || '').trim();
    const chartName  = (rate_type  || 'sangh').trim();

    // Helper: row matches a given rate_type / chart name
    // 'sangh' also matches legacy rows where rate_type is null/empty
    const matchesType = (r, rType) => {
        const rt = (r.rate_type || '').trim();
        if (rType === 'sangh') return rt === 'sangh' || rt === '';
        return rt === rType;
    };

    // Filter rows for a given chart name
    const filterCandidates = (rType) => {
        let rows = cache.filter(r =>
            r.dairy_id.trim() === dairyTrim &&                      // dairy isolation
            (r.milk_type || '').toLowerCase().trim() === milkLower && // Buffalo / Cow
            matchesType(r, rType)                                   // rate chart
        );
        // Only include rates effective on or before the collection date
        if (date) rows = rows.filter(r => r.effective_date <= date);
        return rows;
    };

    // 1. Try farmer's assigned rate chart (e.g. "Vibhag A")
    let candidates = filterCandidates(chartName);

    // 2. Fallback: try 'sangh' if farmer's chart had no matching rows
    if (candidates.length === 0 && chartName !== 'sangh') {
        candidates = filterCandidates('sangh');
    }

    if (candidates.length === 0) return null;

    // 3. Use the most recent effective_date available
    const latestDate = candidates.reduce(
        (best, r) => (r.effective_date > best ? r.effective_date : best),
        candidates[0].effective_date
    );
    const latestRows = candidates.filter(r => r.effective_date === latestDate);

    // 4. Exact fat + snf match
    const exact = latestRows.find(r =>
        r.fat.toFixed(1) === fatRounded &&
        r.snf.toFixed(1) === snfRounded
    );
    if (exact && exact.rate > 0) return exact.rate;

    // 5. Closest fat + snf match (smallest sum of absolute differences)
    let closest = null;
    let minDiff  = Infinity;
    for (const r of latestRows) {
        const diff = Math.abs(r.fat - fatNum) + Math.abs(r.snf - snfNum);
        if (diff < minDiff) { minDiff = diff; closest = r; }
    }
    return (closest && closest.rate > 0) ? closest.rate : null;
}
