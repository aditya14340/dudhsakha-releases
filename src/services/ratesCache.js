/**
 * ratesCache.js  (v2 — HashMap, date-aware + closest-match)
 * -----------------------------------------------------------
 * Replaces the old CSV flat-row cache with a pre-indexed JSON HashMap.
 *
 * WHY THIS EXISTS:
 *   The old CSV + useState approach had a race condition:
 *   - rates:full-rebuild writes new CSV to disk, fires rates:cache-updated
 *   - Collection.jsx starts async IPC to read the new CSV → calls setRatesCache(newData)
 *   - But React setState is async-batched: the OLD array is still in state
 *   - If the user enters fat/snf RIGHT NOW, lookupRateFromCache hits the OLD cache
 *   - Returns a stale/wrong rate. Supabase fallback is skipped. Entry saved with wrong rate.
 *
 * HOW THIS FIXES IT:
 *   - HashMap is stored in useRef (not useState) → assignment is synchronous, instant
 *   - The rebuilt map is sent DIRECTLY in the rates:cache-updated event payload
 *   - No second IPC round-trip, no async gap, no stale window possible
 *   - Lookup uses a date-index for O(log k) date resolution, then O(1) rate access
 *
 * WHAT IS TRACKED (same as old CSV, same as Supabase query):
 *   ✅ dairy_id      — map is per-dairy file; isolated at load time
 *   ✅ milk_type     — 'buffalo' / 'cow' (case-insensitive, in key)
 *   ✅ rate_type     — all charts: sangh, Vibhag A, custom names (in key)
 *   ✅ effective_date — ALL dates stored; lookupRate picks latest <= collection date
 *   ✅ fat + snf     — exact match first; closest match fallback if no exact row
 *   ✅ sangh fallback — if farmer's chart has no data, falls back to 'sangh'
 *   ✅ Supabase fallback — returns null if nothing found → caller uses Supabase
 *
 * HashMap key formats (written by electron/main.js buildRatesHashMap):
 *   Rate rows:      "{milkType}|{fat}|{snf}|{rateType}|{date}"  → rate (number)
 *   Date index:     "__dates__{milkType}|{rateType}"             → ["2026-09-01", ...] (sorted ASC)
 *   Farmer map:     "farmer:{farmerId}"                          → rateType (string)
 *   Debug stamp:    "__builtAt"                                  → ISO timestamp
 *
 * File location: Electron userData / rates_hashmap_{dairy_id}.json
 */

// ─── IPC Helper ───────────────────────────────────────────────────────────────

function isElectronAvailable() {
    return typeof window !== 'undefined' &&
           window.electron &&
           typeof window.electron.invoke === 'function';
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Given a sorted-ASC array of effective dates and a target collection date,
 * return the latest date that is <= the collection date.
 * Returns null if no date qualifies.
 *
 * ISO date strings (YYYY-MM-DD) sort and compare correctly as plain strings.
 *
 * @param {string[]} sortedDates  - ["2026-09-01", "2026-10-01", ...]
 * @param {string}   targetDate   - Collection date "YYYY-MM-DD"
 * @returns {string|null}
 */
function findLatestEffectiveDateFor(sortedDates, targetDate) {
    if (!sortedDates || sortedDates.length === 0 || !targetDate) return null;
    // Walk backward (largest date first) — find first that is <= targetDate
    for (let i = sortedDates.length - 1; i >= 0; i--) {
        if (sortedDates[i] <= targetDate) return sortedDates[i];
    }
    return null; // all dates are in the future relative to targetDate
}

/**
 * Scan all rate rows for a given milkType+rateType+date in the map and return
 * the one with the smallest |fat - fatTarget| + |snf - snfTarget| distance.
 * Used as fallback when no exact fat+snf match exists.
 *
 * @param {Object} hashMap
 * @param {string} milkKey
 * @param {string} chartKey
 * @param {string} effDate
 * @param {number} fatTarget
 * @param {number} snfTarget
 * @returns {number|null}
 */
function findClosestRate(hashMap, milkKey, chartKey, effDate, fatTarget, snfTarget) {
    // Key prefix for rows belonging to this milkType+rateType+date
    const prefix = `${milkKey}|`;
    const suffix = `|${chartKey}|${effDate}`;

    let closestRate = null;
    let minDiff     = Infinity;

    for (const [key, val] of Object.entries(hashMap)) {
        // Only inspect rate rows (skip __dates__, farmer:, __builtAt)
        if (!key.startsWith(prefix) || !key.endsWith(suffix)) continue;
        // Key format: "{milkKey}|{fat}|{snf}|{chartKey}|{date}"
        const parts = key.split('|');
        if (parts.length < 5) continue;
        const rowFat = parseFloat(parts[1]);
        const rowSnf = parseFloat(parts[2]);
        if (isNaN(rowFat) || isNaN(rowSnf)) continue;

        const diff = Math.abs(rowFat - fatTarget) + Math.abs(rowSnf - snfTarget);
        if (diff < minDiff) {
            minDiff     = diff;
            closestRate = val;
        }
    }
    return (closestRate != null && closestRate > 0) ? closestRate : null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Load the pre-indexed HashMap from disk.
 * Called once on mount — single IPC call replaces old loadRatesFromCSV() +
 * rates:get-all-farmer-rate-types.
 * Returns a plain JS object safe to assign to useRef.current.
 *
 * @param {string} dairyId
 * @returns {Promise<Object>}  HashMap object, or {} if cache missing/corrupt
 */
export async function loadRatesHashMap(dairyId) {
    if (!isElectronAvailable() || !dairyId) return {};
    try {
        const result = await window.electron.invoke('rates:read-hashmap', { dairyId });
        if (!result?.success || !result?.hashMap) return {};
        const keyCount = Object.keys(result.hashMap).length;
        console.log(`[RatesHashMap] Loaded ${keyCount} keys from disk (dairy: ${dairyId})`);
        return result.hashMap;
    } catch (err) {
        console.warn('[RatesHashMap] Load failed (non-fatal):', err);
        return {};
    }
}

/**
 * Date-aware rate lookup from the HashMap.
 *
 * Fully mirrors the old CSV + Supabase logic:
 *
 *   Step 1 — Resolve effective date:
 *            Read the date-index for this milkType+rateType, find the latest
 *            effective_date that is <= the collection date.
 *
 *   Step 2 — Exact fat+snf match for that date.
 *
 *   Step 3 — Closest fat+snf match (fallback) for that date.
 *
 *   Step 4 — If farmer's rate_type has no data, repeat steps 1-3 for 'sangh'.
 *
 *   Step 5 — Return null → caller falls back to Supabase API.
 *
 * @param {Object} hashMap     - ratesMapRef.current
 * @param {Object} params
 * @param {string} params.milk_type   - 'Buffalo' or 'Cow'
 * @param {number} params.fat
 * @param {number} params.snf
 * @param {string} params.date        - Collection date 'YYYY-MM-DD'
 * @param {string} params.rate_type   - Farmer's assigned rate chart (e.g. 'sangh', 'Vibhag A')
 * @returns {number|null}
 */
export function lookupRate(hashMap, { milk_type, fat, snf, date, rate_type = 'sangh' }) {
    if (!hashMap || Object.keys(hashMap).length === 0) return null;

    const fatNum = parseFloat(fat);
    const snfNum = parseFloat(snf);
    if (isNaN(fatNum) || isNaN(snfNum)) return null;
    if (!date) return null;

    const milkKey  = (milk_type  || '').toLowerCase().trim();
    const chartKey = (rate_type  || 'sangh').trim();
    const fatKey   = fatNum.toFixed(1);
    const snfKey   = snfNum.toFixed(1);

    const tryChart = (chart) => {
        // 1. Resolve effective date: latest date <= collection date
        const dateIndex = hashMap[`__dates__${milkKey}|${chart}`];
        const effDate   = findLatestEffectiveDateFor(dateIndex, date);
        if (!effDate) return null;

        // 2. Exact fat+snf match
        const exactKey = `${milkKey}|${fatKey}|${snfKey}|${chart}|${effDate}`;
        if (hashMap[exactKey] != null && hashMap[exactKey] > 0) return hashMap[exactKey];

        // 3. Closest fat+snf match (fallback)
        return findClosestRate(hashMap, milkKey, chart, effDate, fatNum, snfNum);
    };

    // Try farmer's assigned chart first, then fall back to 'sangh'
    const primaryRate = tryChart(chartKey);
    if (primaryRate !== null) return primaryRate;

    if (chartKey !== 'sangh') {
        const sanghRate = tryChart('sangh');
        if (sanghRate !== null) return sanghRate;
    }

    return null;
}

/**
 * Get a farmer's assigned rate_type from the HashMap.
 * Replaces the old separate farmerRateTypesMap state.
 * Farmer entries are stored in the same hashmap with "farmer:{id}" prefix.
 *
 * @param {Object}        hashMap
 * @param {string|number} farmerId
 * @returns {string}  rate_type string, defaults to 'sangh'
 */
export function getFarmerRateType(hashMap, farmerId) {
    if (!hashMap || !farmerId) return 'sangh';
    return hashMap[`farmer:${farmerId}`] || 'sangh';
}
