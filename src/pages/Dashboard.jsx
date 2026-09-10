import React, { useState, useEffect } from 'react';
import { Users, Droplets, TrendingUp, Activity, Edit, IndianRupee, Truck, Store, RefreshCcw, Building2, Wallet, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Loader from '../components/Loader';


import {
    getFarmers,
    getCollections,
    getRates,
    getMilkSales,
    getFederationReceipts
} from '../lib/api';

function Dashboard({ user }) {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [stats, setStats] = useState({
        totalFarmers: 0,
        selectedDateCollection: 0,
        avgFat: 0,
        avgSnf: 0,
        avgCowFat: 0,
        avgCowSnf: 0,
        avgBufFat: 0,
        avgBufSnf: 0,
        selectedDateCow: 0,
        selectedDateBuffalo: 0,
        weeklyData: [],
        estimatedProfit: 0,
        sanghAmount: 0,
        producerAmount: 0,

        sentToSangh: 0,
        localSale: 0,
        localSaleAmount: 0,
        totalEntries: 0,
        totalRevenue: 0,
        sanghProfit: 0,
        localSaleProfit: 0,
        federationAmount: 0,
        gap: 0,
        hasReceipt: false,
        profitData: {
            corporate: { amount: 0, quantity: 0 },
            collection: { amount: 0, quantity: 0 },
            profit: 0
        },
        sanghNafaBreakdown: {
            morning: 0,
            evening: 0,
            cow: 0,
            buffalo: 0,
            federationAmount: 0,
            sanghProducerCost: 0
        },
        localSaleProfitData: {
            profit: 0,
            revenue: 0,
            cost: 0,
            cow: { profit: 0, revenue: 0, qty: 0 },
            buffalo: { profit: 0, revenue: 0, qty: 0 }
        }
    });

    const [profitFilters, setProfitFilters] = useState({
        milkType: 'All',
        shift: 'All'
    });
    const [recentCollections, setRecentCollections] = useState([]);

    const loadStats = async () => {
        try {
            if (!user?.dairy_id) {
                return;
            }
            setLoading(true);

            const dairyId = parseInt(user.dairy_id);


            const [
                farmers,
                collections,
                rates,
                milkSales,
                federationReceipts
            ] = await Promise.all([
                getFarmers(dairyId),
                getCollections(dairyId),
                getRates(dairyId),
                getMilkSales(dairyId, selectedDate),
                getFederationReceipts(dairyId)
            ]);



            const farmersCount = (farmers || []).filter(f => !f.is_deleted).length;


            // Filter week collections for potential future use
            // const weekCollections = (collections || []).filter(c => {
            //     const d = c.date;
            //     return d >= weekAgoStr && d <= today;
            // });

            const selectedDateEntries = (collections || []).filter(c => c.date === selectedDate);
            const selectedDateSales = (milkSales || []).filter(s => s.sale_date === selectedDate);
            const selectedDateFederation = (federationReceipts || []).filter(r => r.receipt_date === selectedDate);


            const totalQty = selectedDateEntries.reduce((sum, c) => sum + (parseFloat(c.quantity) || 0), 0);
            // Weighted fat/snf sums (for overall avg - weighted by liters)
            const totalFatQtySum = selectedDateEntries.reduce((sum, c) => sum + (parseFloat(c.fat) || 0) * (parseFloat(c.quantity) || 0), 0);
            const totalSnfQtySum = selectedDateEntries.reduce((sum, c) => sum + (parseFloat(c.snf) || 0) * (parseFloat(c.quantity) || 0), 0);
            // Keep simple sums for any legacy usage
            const totalFat = selectedDateEntries.reduce((sum, c) => sum + (parseFloat(c.fat) || 0), 0);
            const totalSnf = selectedDateEntries.reduce((sum, c) => sum + (parseFloat(c.snf) || 0), 0);

            const cowEntries = selectedDateEntries.filter(c => c.milk_type === 'Cow');
            const buffaloEntries = selectedDateEntries.filter(c => c.milk_type === 'Buffalo');

            const cowQty = cowEntries.reduce((sum, c) => sum + (parseFloat(c.quantity) || 0), 0);
            const buffaloQty = buffaloEntries.reduce((sum, c) => sum + (parseFloat(c.quantity) || 0), 0);

            const localSaleQty = selectedDateSales.reduce((sum, s) => sum + (parseFloat(s.quantity) || 0), 0);
            const mornLocalSaleQty = selectedDateSales.filter(s => s.shift && (String(s.shift).toUpperCase().includes('AM') || String(s.shift).toUpperCase() === 'MORNING')).reduce((sum, s) => sum + (parseFloat(s.quantity) || 0), 0);
            const eveLocalSaleQty = selectedDateSales.filter(s => s.shift && (String(s.shift).toUpperCase().includes('PM') || String(s.shift).toUpperCase() === 'EVENING')).reduce((sum, s) => sum + (parseFloat(s.quantity) || 0), 0);
            const localSaleAmount = selectedDateSales.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);

            const federationAmount = selectedDateFederation.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
            const federationQty = selectedDateFederation.reduce((sum, r) => sum + (parseFloat(r.quantity) || 0), 0);

            // Cow & Buffalo sangh qty from federation receipts
            const cowFederationQty = selectedDateFederation
                .filter(r => r.milk_type === 'Cow')
                .reduce((sum, r) => sum + (parseFloat(r.quantity) || 0), 0);
            const bufFederationQty = selectedDateFederation
                .filter(r => r.milk_type === 'Buffalo')
                .reduce((sum, r) => sum + (parseFloat(r.quantity) || 0), 0);
            // Fallback: if federation receipts have no milk_type, split by collection proportion
            const cowFedQtyFinal = cowFederationQty > 0 || bufFederationQty > 0
                ? cowFederationQty
                : (totalQty > 0 ? (federationQty * cowQty / totalQty) : 0);
            const bufFedQtyFinal = cowFederationQty > 0 || bufFederationQty > 0
                ? bufFederationQty
                : (totalQty > 0 ? (federationQty * buffaloQty / totalQty) : 0);


            const sanghSupply = federationQty > 0 ? federationQty : Math.max(0, totalQty - localSaleQty);


            let producerTotal = 0;
            const producerRates = {};
            const corporateRates = {};

            (rates || []).forEach(r => {
                const key = `${r.milk_type}-${r.fat}-${r.snf}`;
                if (r.rate_type === 'producer') {
                    producerRates[key] = r.rate;
                } else if (r.rate_type === 'corporate') {
                    corporateRates[key] = r.rate;
                }
            });

            selectedDateEntries.forEach(c => {
                const key = `${c.milk_type}-${c.fat}-${c.snf}`;
                const producerRate = producerRates[key] || parseFloat(c.rate) || 0;
                producerTotal += (producerRate * (parseFloat(c.quantity) || 0));
            });


            const actualSanghAmount = federationAmount > 0 ? federationAmount : selectedDateEntries.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);

            const totalRevenue = localSaleAmount; // placeholder — overwritten below after profit calcs

            // ─── Local Sale Profit Calculation ─────────────────────────────────────
            // Use avg fat/snf per milk type from today's collections to find producer rate,
            // then compute: local sale revenue − producer cost for that milk.

            // Avg fat & snf for Cow collections (weighted by liters, truncated not rounded)
            const cowTotalQty = cowEntries.reduce((sum, c) => sum + (parseFloat(c.quantity) || 0), 0);
            const avgCowFat = cowTotalQty > 0
                ? (Math.floor(cowEntries.reduce((sum, c) => sum + (parseFloat(c.fat) || 0) * (parseFloat(c.quantity) || 0), 0) / cowTotalQty * 10) / 10).toFixed(1)
                : '0.0';
            const avgCowSnf = cowTotalQty > 0
                ? (Math.floor(cowEntries.reduce((sum, c) => sum + (parseFloat(c.snf) || 0) * (parseFloat(c.quantity) || 0), 0) / cowTotalQty * 10) / 10).toFixed(1)
                : '0.0';

            // Avg fat & snf for Buffalo collections (weighted by liters, truncated not rounded)
            const bufTotalQty = buffaloEntries.reduce((sum, c) => sum + (parseFloat(c.quantity) || 0), 0);
            const avgBufFat = bufTotalQty > 0
                ? (Math.floor(buffaloEntries.reduce((sum, c) => sum + (parseFloat(c.fat) || 0) * (parseFloat(c.quantity) || 0), 0) / bufTotalQty * 10) / 10).toFixed(1)
                : '0.0';
            const avgBufSnf = bufTotalQty > 0
                ? (Math.floor(buffaloEntries.reduce((sum, c) => sum + (parseFloat(c.snf) || 0) * (parseFloat(c.quantity) || 0), 0) / bufTotalQty * 10) / 10).toFixed(1)
                : '0.0';

            // Shift-wise averages
            const mornCowEntries = cowEntries.filter(c => c.shift && (String(c.shift).toUpperCase().includes('AM') || String(c.shift).toUpperCase() === 'MORNING'));
            const eveCowEntries = cowEntries.filter(c => c.shift && (String(c.shift).toUpperCase().includes('PM') || String(c.shift).toUpperCase() === 'EVENING'));
            const mornBufEntries = buffaloEntries.filter(c => c.shift && (String(c.shift).toUpperCase().includes('AM') || String(c.shift).toUpperCase() === 'MORNING'));
            const eveBufEntries = buffaloEntries.filter(c => c.shift && (String(c.shift).toUpperCase().includes('PM') || String(c.shift).toUpperCase() === 'EVENING'));

            // Helper: quantity-weighted average for a set of entries
            // Uses floor/truncation (not rounding) so 3.98 shows as 3.9, not 4.0
            const wAvg = (arr, field) => {
                const qty = arr.reduce((s, c) => s + (parseFloat(c.quantity) || 0), 0);
                if (qty <= 0) return '0.0';
                const val = arr.reduce((s, c) => s + (parseFloat(c[field]) || 0) * (parseFloat(c.quantity) || 0), 0) / qty;
                return (Math.floor(val * 10) / 10).toFixed(1);
            };

            const avgCowFatMorn = wAvg(mornCowEntries, 'fat');
            const avgCowSnfMorn = wAvg(mornCowEntries, 'snf');
            const avgCowFatEve  = wAvg(eveCowEntries,  'fat');
            const avgCowSnfEve  = wAvg(eveCowEntries,  'snf');

            const avgBufFatMorn = wAvg(mornBufEntries, 'fat');
            const avgBufSnfMorn = wAvg(mornBufEntries, 'snf');
            const avgBufFatEve  = wAvg(eveBufEntries,  'fat');
            const avgBufSnfEve  = wAvg(eveBufEntries,  'snf');

            // Find the producer rate for these avg values (same key format as producerRates map)
            // Falls back to the closest key when an exact match doesn't exist
            const findClosestProducerRate = (milkType, avgFat, avgSnf) => {
                const exactKey = `${milkType}-${avgFat}-${avgSnf}`;
                if (producerRates[exactKey] !== undefined) return parseFloat(producerRates[exactKey]);
                
                // Fallback: look at all rates for this milk type
                const relevant = (rates || []).filter(r => r.milk_type === milkType);
                if (!relevant.length) return 0;
                
                // Check for exact fat/snf match first
                const exactMatches = relevant.filter(r => parseFloat(r.fat) === parseFloat(avgFat) && parseFloat(r.snf) === parseFloat(avgSnf));
                if (exactMatches.length > 0) {
                    const producerMatch = exactMatches.find(r => r.rate_type === 'producer');
                    if (producerMatch) return parseFloat(producerMatch.rate);
                    const sanghMatch = exactMatches.find(r => r.rate_type === 'sangh' || !r.rate_type);
                    if (sanghMatch) return parseFloat(sanghMatch.rate);
                    return parseFloat(exactMatches[0].rate) || 0;
                }

                // Find closest by combined fat+snf difference
                let closest = null;
                let minDiff = 9999;
                for (const r of relevant) {
                    const diff = Math.abs(parseFloat(r.fat) - parseFloat(avgFat)) +
                        Math.abs(parseFloat(r.snf) - parseFloat(avgSnf));
                    if (diff < minDiff) { 
                        minDiff = diff; 
                        closest = r; 
                    } else if (diff === minDiff && closest) {
                        // Tie breaker: prefer producer > sangh > other
                        const getPriority = (rt) => rt === 'producer' ? 3 : (rt === 'sangh' || !rt ? 2 : 1);
                        if (getPriority(r.rate_type) > getPriority(closest.rate_type)) {
                            closest = r;
                        }
                    }
                }
                return closest ? (parseFloat(closest.rate) || 0) : 0;
            };

            const cowProducerRate = findClosestProducerRate('Cow', avgCowFat, avgCowSnf);
            const bufProducerRate = findClosestProducerRate('Buffalo', avgBufFat, avgBufSnf);

            // Local sales split by milk type
            const cowLocalSales    = selectedDateSales.filter(s => s.milk_type === 'Cow');
            const buffaloLocalSales = selectedDateSales.filter(s => s.milk_type === 'Buffalo');
            const mixedLocalSales   = selectedDateSales.filter(s => s.milk_type !== 'Cow' && s.milk_type !== 'Buffalo');

            const cowLocalQty    = cowLocalSales.reduce((sum, s) => sum + (parseFloat(s.quantity) || 0), 0);
            const buffaloLocalQty = buffaloLocalSales.reduce((sum, s) => sum + (parseFloat(s.quantity) || 0), 0);
            const mixedLocalQty   = mixedLocalSales.reduce((sum, s) => sum + (parseFloat(s.quantity) || 0), 0);

            const cowLocalRev    = cowLocalSales.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
            const buffaloLocalRev = buffaloLocalSales.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
            const mixedLocalRev   = mixedLocalSales.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);

            // Producer cost for locally-sold milk (using avg fat/snf of the day)
            const cowLocalCost    = cowLocalQty * cowProducerRate;
            const buffaloLocalCost = buffaloLocalQty * bufProducerRate;
            // For mixed/unknown type, use whichever rate is available or average
            const mixedRate = bufProducerRate || cowProducerRate || 0;
            const mixedLocalCost = mixedLocalQty * mixedRate;

            const totalLocalCost    = cowLocalCost + buffaloLocalCost + mixedLocalCost;
            const totalLocalRevenue = cowLocalRev + buffaloLocalRev + mixedLocalRev; // same as localSaleAmount

            const cowLocalProfit    = cowLocalRev - cowLocalCost;
            const buffaloLocalProfit = buffaloLocalRev - buffaloLocalCost;
            const totalLocalProfit  = totalLocalRevenue - totalLocalCost;
            // ─────────────────────────────────────────────────────────────────────

            const weeklyData = [];
            const endDate = new Date(selectedDate);

            for (let i = 6; i >= 0; i--) {
                const d = new Date(endDate);
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];

                const dayEntries = (collections || []).filter(c => c.date === dateStr);
                const dayQty = dayEntries.reduce((sum, c) => sum + (parseFloat(c.quantity) || 0), 0);

                weeklyData.push({
                    name: new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' }),
                    quantity: dayQty,
                    date: dateStr
                });
            }



            let profitEntries = selectedDateEntries;
            let profitSales = selectedDateSales;
            let profitFederation = selectedDateFederation;

            if (profitFilters.milkType !== 'All') {
                profitEntries = profitEntries.filter(c => c.milk_type === profitFilters.milkType);
                profitSales = profitSales.filter(s => s.milk_type === profitFilters.milkType);
                profitFederation = profitFederation.filter(r => r.milk_type === profitFilters.milkType);
            }

            if (profitFilters.shift !== 'All') {
                profitEntries = profitEntries.filter(c => c.shift === profitFilters.shift);
                profitFederation = profitFederation.filter(r => r.shift === profitFilters.shift);
                profitSales = profitSales.filter(s => s.shift && (
                    profitFilters.shift === 'Morning'
                        ? (String(s.shift).toUpperCase().includes('AM') || String(s.shift).toUpperCase() === 'MORNING')
                        : (String(s.shift).toUpperCase().includes('PM') || String(s.shift).toUpperCase() === 'EVENING')
                ));
            }

            // ─── All collection producer cost ────────────────────────────────────
            let filteredProducerTotal = 0;
            profitEntries.forEach(c => {
                const key = `${c.milk_type}-${c.fat}-${c.snf}`;
                const producerRate = producerRates[key] || parseFloat(c.rate) || 0;
                filteredProducerTotal += (producerRate * (parseFloat(c.quantity) || 0));
            });

            const filteredLocalSaleQty = profitSales.reduce((sum, s) => sum + (parseFloat(s.quantity) || 0), 0);
            const filteredLocalSaleAmount = profitSales.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);

            const filteredFederationQty = profitFederation.reduce((sum, r) => sum + (parseFloat(r.quantity) || 0), 0);
            const filteredFederationAmount = profitFederation.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

            const filteredSanghSupply = filteredFederationQty > 0
                ? filteredFederationQty
                : Math.max(0, profitEntries.reduce((sum, c) => sum + (parseFloat(c.quantity) || 0), 0) - filteredLocalSaleQty);

            // ─── Local sale producer cost (to subtract from total) ────────────────
            // Calculate producer cost for local-sale milk using per-entry rates
            const localSaleMilkTypes = {};
            profitSales.forEach(s => {
                const mt = s.milk_type || 'Mixed';
                localSaleMilkTypes[mt] = (localSaleMilkTypes[mt] || 0) + (parseFloat(s.quantity) || 0);
            });
            let filteredLocalSaleProducerCost = 0;
            Object.entries(localSaleMilkTypes).forEach(([mt, qty]) => {
                const rate = mt === 'Cow' ? cowProducerRate
                    : mt === 'Buffalo' ? bufProducerRate
                    : (bufProducerRate || cowProducerRate || 0);
                filteredLocalSaleProducerCost += qty * rate;
            });

            // ─── Sangh-only producer cost = all cost − local sale cost ────────────
            // Ensure sangh producer cost cannot be negative (in case local sales > collections)
            const filteredSanghProducerCost = Math.max(0, filteredProducerTotal - filteredLocalSaleProducerCost);

            // ─── Sangh Nafa = Federation income − Sangh producer cost ─────────────
            const filteredEstimatedProfit = filteredFederationAmount - filteredSanghProducerCost;

            const filteredActualSanghAmount = filteredFederationAmount;

            let profitSummary = {
                corporate: { amount: filteredActualSanghAmount, quantity: filteredSanghSupply },
                collection: { amount: filteredSanghProducerCost, quantity: filteredLocalSaleQty },
                profit: filteredEstimatedProfit
            };


            // ─── Breakdown: Morning / Evening / Cow / Buffalo ─────────────────────
            // Helper: producer cost for a subset of entries
            const calcProducerCost = (entries) => {
                let cost = 0;
                entries.forEach(c => {
                    const key = `${c.milk_type}-${c.fat}-${c.snf}`;
                    const rate = producerRates[key] || parseFloat(c.rate) || 0;
                    cost += rate * (parseFloat(c.quantity) || 0);
                });
                return cost;
            };
            // Helper: local-sale producer cost for a subset of sales
            const calcLocalSalesCost = (sales) => {
                let cost = 0;
                sales.forEach(s => {
                    const qty = parseFloat(s.quantity) || 0;
                    const mt = s.milk_type || 'Mixed';
                    const rate = mt === 'Cow' ? cowProducerRate
                        : mt === 'Buffalo' ? bufProducerRate
                        : (bufProducerRate || cowProducerRate || 0);
                    cost += qty * rate;
                });
                return cost;
            };

            const isMorning = (shift) => shift && (String(shift).toUpperCase().includes('AM') || String(shift).toUpperCase() === 'MORNING');
            const isEvening = (shift) => shift && (String(shift).toUpperCase().includes('PM') || String(shift).toUpperCase() === 'EVENING');

            // ── Collection qty per shift / milk-type (used as weights for proportional split) ──
            const mornCollQty = profitEntries.filter(c => isMorning(c.shift)).reduce((s, c) => s + (parseFloat(c.quantity) || 0), 0);
            const eveCollQty  = profitEntries.filter(c => isEvening(c.shift)).reduce((s, c) => s + (parseFloat(c.quantity) || 0), 0);
            const totalCollQtyForSplit = mornCollQty + eveCollQty || 1;

            const cowCollQty = profitEntries.filter(c => c.milk_type === 'Cow').reduce((s, c) => s + (parseFloat(c.quantity) || 0), 0);
            const bufCollQty = profitEntries.filter(c => c.milk_type === 'Buffalo').reduce((s, c) => s + (parseFloat(c.quantity) || 0), 0);
            const totalCollQtyForMTSplit = cowCollQty + bufCollQty || 1;

            // Check if federation receipts have per-shift data
            const fedHasShiftData = profitFederation.some(r => isMorning(r.shift) || isEvening(r.shift));
            // Check if federation receipts have per-milktype data
            const fedHasMilkTypeData = profitFederation.some(r => r.milk_type === 'Cow' || r.milk_type === 'Buffalo');

            // Morning breakdown
            const mornEntries = profitEntries.filter(c => isMorning(c.shift));
            const mornSales = profitSales.filter(s => isMorning(s.shift));
            const mornFedAmt = fedHasShiftData
                ? profitFederation.filter(r => isMorning(r.shift)).reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)
                : filteredFederationAmount * (mornCollQty / totalCollQtyForSplit); // proportional fallback
            const mornSanghCost = Math.max(0, calcProducerCost(mornEntries) - calcLocalSalesCost(mornSales));
            const mornNafa = mornFedAmt - mornSanghCost;

            // Evening breakdown
            const eveEntries = profitEntries.filter(c => isEvening(c.shift));
            const eveSales = profitSales.filter(s => isEvening(s.shift));
            const eveFedAmt = fedHasShiftData
                ? profitFederation.filter(r => isEvening(r.shift)).reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)
                : filteredFederationAmount * (eveCollQty / totalCollQtyForSplit); // proportional fallback
            const eveSanghCost = Math.max(0, calcProducerCost(eveEntries) - calcLocalSalesCost(eveSales));
            const eveNafa = eveFedAmt - eveSanghCost;

            // ── Cow breakdown ──────────────────────────────────────────────────────
            // Key fix: only use cow collection entries from the SAME SHIFT as cow
            // federation receipt. E.g., if cow fed receipt = Morning, use only
            // morning cow entries as producer cost (not evening cow which didn't go to sangh).
            const cowFedHasMorn = fedHasMilkTypeData && profitFederation.some(r => r.milk_type === 'Cow' && isMorning(r.shift));
            const cowFedHasEve  = fedHasMilkTypeData && profitFederation.some(r => r.milk_type === 'Cow' && isEvening(r.shift));
            const cowProfitEntries = profitEntries.filter(c => c.milk_type === 'Cow');
            const cowProfitSales   = profitSales.filter(s => s.milk_type === 'Cow');
            const cowNafaEntries = (cowFedHasMorn || cowFedHasEve)
                ? cowProfitEntries.filter(c =>
                    (cowFedHasMorn && isMorning(c.shift)) ||
                    (cowFedHasEve  && isEvening(c.shift)))
                : cowProfitEntries; // fallback: all shifts
            const cowNafaSales = (cowFedHasMorn || cowFedHasEve)
                ? cowProfitSales.filter(s =>
                    (cowFedHasMorn && isMorning(s.shift)) ||
                    (cowFedHasEve  && isEvening(s.shift)))
                : cowProfitSales;
            const cowFedAmt = fedHasMilkTypeData
                ? profitFederation.filter(r => r.milk_type === 'Cow').reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)
                : filteredFederationAmount * (cowCollQty / totalCollQtyForMTSplit);
            const cowSanghCost = Math.max(0, calcProducerCost(cowNafaEntries) - calcLocalSalesCost(cowNafaSales));
            const cowNafa = cowFedAmt - cowSanghCost;

            // ── Buffalo breakdown ──────────────────────────────────────────────────
            const bufFedHasMorn = fedHasMilkTypeData && profitFederation.some(r => r.milk_type === 'Buffalo' && isMorning(r.shift));
            const bufFedHasEve  = fedHasMilkTypeData && profitFederation.some(r => r.milk_type === 'Buffalo' && isEvening(r.shift));
            const bufProfitEntries = profitEntries.filter(c => c.milk_type === 'Buffalo');
            const bufProfitSales   = profitSales.filter(s => s.milk_type === 'Buffalo');
            const bufNafaEntries = (bufFedHasMorn || bufFedHasEve)
                ? bufProfitEntries.filter(c =>
                    (bufFedHasMorn && isMorning(c.shift)) ||
                    (bufFedHasEve  && isEvening(c.shift)))
                : bufProfitEntries;
            const bufNafaSales = (bufFedHasMorn || bufFedHasEve)
                ? bufProfitSales.filter(s =>
                    (bufFedHasMorn && isMorning(s.shift)) ||
                    (bufFedHasEve  && isEvening(s.shift)))
                : bufProfitSales;
            const bufFedAmt = fedHasMilkTypeData
                ? profitFederation.filter(r => r.milk_type === 'Buffalo').reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)
                : filteredFederationAmount * (bufCollQty / totalCollQtyForMTSplit);
            const bufSanghCost = Math.max(0, calcProducerCost(bufNafaEntries) - calcLocalSalesCost(bufNafaSales));
            const bufNafa = bufFedAmt - bufSanghCost;
            // ─────────────────────────────────────────────────────────────────────


            const deliveredQty = Math.max(0, totalQty - localSaleQty);
            const gap = federationQty > 0 ? (deliveredQty - federationQty) : 0;

            setStats({
                totalFarmers: farmersCount || 0,
                selectedDateCollection: totalQty.toFixed(1),
                avgFat: totalQty > 0 ? (Math.floor(totalFatQtySum / totalQty * 10) / 10).toFixed(1) : '0.0',
                avgSnf: totalQty > 0 ? (Math.floor(totalSnfQtySum / totalQty * 10) / 10).toFixed(1) : '0.0',
                avgCowFat,
                avgCowSnf,
                avgBufFat,
                avgBufSnf,
                avgCowFatMorn,
                avgCowSnfMorn,
                avgCowFatEve,
                avgCowSnfEve,
                avgBufFatMorn,
                avgBufSnfMorn,
                avgBufFatEve,
                avgBufSnfEve,
                selectedDateCow: cowQty.toFixed(1),
                selectedDateBuffalo: buffaloQty.toFixed(1),
                gap: federationQty > 0 ? gap.toFixed(1) : 0,
                weeklyData,
                estimatedProfit: filteredEstimatedProfit.toFixed(2),
                sanghAmount: actualSanghAmount.toFixed(2),
                producerAmount: producerTotal.toFixed(2),

                sentToSangh: federationQty > 0 ? federationQty.toFixed(1) : '',
                sanghCowQty: federationQty > 0 ? cowFedQtyFinal.toFixed(1) : '',
                sanghBufQty: federationQty > 0 ? bufFedQtyFinal.toFixed(1) : '',
                localSale: localSaleQty.toFixed(1),
                mornLocalSale: mornLocalSaleQty.toFixed(1),
                eveLocalSale: eveLocalSaleQty.toFixed(1),
                localSaleAmount: localSaleAmount.toFixed(2),
                totalEntries: selectedDateEntries.length,
                // एकूण महसूल = संघाकडून आलेला नफा + स्थानिक विक्री नफा
                sanghProfit: filteredEstimatedProfit,
                localSaleProfit: totalLocalProfit,
                totalRevenue: (filteredEstimatedProfit + totalLocalProfit).toFixed(2),
                federationAmount: federationAmount.toFixed(2),
                hasReceipt: federationQty > 0,
                profitData: profitSummary,
                sanghNafaBreakdown: {
                    morning: mornNafa,
                    evening: eveNafa,
                    cow: cowNafa,
                    buffalo: bufNafa,
                    federationAmount: filteredFederationAmount,
                    sanghProducerCost: filteredSanghProducerCost
                },
                localSaleProfitData: {
                    profit: totalLocalProfit,
                    revenue: totalLocalRevenue,
                    cost: totalLocalCost,
                    cow: { profit: cowLocalProfit, revenue: cowLocalRev, qty: cowLocalQty },
                    buffalo: { profit: buffaloLocalProfit, revenue: buffaloLocalRev, qty: buffaloLocalQty }
                }
            });
            setRecentCollections(selectedDateEntries.sort((a, b) => b.id - a.id));

        } catch (error) {
            console.error("Error loading dashboard stats:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            if (user?.dairy_id || user?.role === 'super_admin') {
                loadStats();
            }
        }, 800);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDate, profitFilters, user?.dairy_id]);

    const handleEditCollection = (collection) => {
        navigate('/collection', { state: { editCollection: collection } });
    };

    const maxQuantity = Math.max(...stats.weeklyData.map(d => d.quantity), 1);
    const formattedDate = new Date(selectedDate).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' });

    if (loading) {
        return <Loader text={t('common.loading') || "Loading Dashboard..."} />;
    }

    return (
        <div style={{
            padding: '16px 32px',
            maxWidth: '1600px',
            margin: '0 auto',
            background: 'transparent',
            minHeight: '100%'
        }}>
            {/* Header with Date Picker */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                gap: '24px',
                paddingBottom: '12px',
                borderBottom: '1px solid #f1f5f9'
            }}>
                <div>
                    <h1 style={{
                        fontSize: '28px',
                        fontWeight: '800',
                        margin: '0 0 8px 0',
                        color: '#111827',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                    }}>
                        <Activity size={28} />
                        {t('dashboard.overview')}
                    </h1>
                    <p style={{
                        fontSize: '15px',
                        color: '#6b7280',
                        margin: 0
                    }}>
                        {t('dashboard.subtitle')} {formattedDate}
                    </p>
                </div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px'
                }}>
                    <button
                        onClick={loadStats}
                        disabled={loading}
                        style={{
                            padding: '12px',
                            borderRadius: '16px',
                            border: '2px solid #e5e7eb',
                            background: 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s',
                            color: '#6b7280'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#6366f1';
                            e.currentTarget.style.color = '#6366f1';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#e5e7eb';
                            e.currentTarget.style.color = '#6b7280';
                        }}
                    >
                        <RefreshCw size={24} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <div style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center'
                    }}>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            style={{
                                padding: '12px 20px',
                                borderRadius: '16px',
                                border: '2px solid #e5e7eb',
                                outline: 'none',
                                fontSize: '16px',
                                fontWeight: '700',
                                color: '#111827',
                                cursor: 'pointer',
                                background: 'white'
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '24px',
                marginBottom: '40px',
                alignItems: 'stretch'
            }}>
                {/* Collection Card */}
                <div style={{
                    background: 'white',
                    borderRadius: '24px',
                    padding: '24px',
                    border: '1px solid #f3f4f6',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.04), 0 4px 6px -4px rgb(0 0 0 / 0.04)',
                    minHeight: '160px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <p style={{ fontSize: '16px', color: '#6b7280', margin: '0 0 12px 0', fontWeight: '500' }}>
                                {t('dashboard.collection')} ({selectedDate === new Date().toISOString().split('T')[0] ? t('dashboard.today') : t('dashboard.selected')})
                            </p>
                            <p style={{ fontSize: '40px', fontWeight: '800', margin: '0', color: '#111827', lineHeight: 1 }}>
                                {stats.selectedDateCollection} <span style={{ fontSize: '20px', fontWeight: '600', color: '#6b7280' }}>L</span>
                            </p>
                        </div>
                        <div style={{
                            width: '56px',
                            height: '56px',
                            background: '#c7d2fe',
                            borderRadius: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#4338ca'
                        }}>
                            <Droplets size={28} strokeWidth={2.5} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '24px', flexWrap: 'wrap' }}>
                        <span style={{
                            padding: '10px 18px',
                            background: '#f8fafc',
                            borderRadius: '12px',
                            fontSize: '15px',
                            fontWeight: '700',
                            color: '#334155',
                            border: '1px solid #e2e8f0'
                        }}>
                            🐄 {t('dashboard.cow')}: {stats.selectedDateCow}L
                        </span>
                        <span style={{
                            padding: '10px 18px',
                            background: '#f8fafc',
                            borderRadius: '12px',
                            fontSize: '15px',
                            fontWeight: '700',
                            color: '#334155',
                            border: '1px solid #e2e8f0'
                        }}>
                            🐃 {t('dashboard.buffalo')}: {stats.selectedDateBuffalo}L
                        </span>
                        {stats.hasReceipt && (
                            <span style={{
                                padding: '10px 18px',
                                background: stats.gap > 0 ? '#fee2e2' : '#f8fafc',
                                borderRadius: '12px',
                                fontSize: '15px',
                                fontWeight: '800',
                                color: stats.gap > 0 ? '#dc2626' : '#64748b',
                                border: stats.gap > 0 ? '1px solid #fecaca' : '1px solid #e2e8f0'
                            }}>
                                📉 {t('dashboard.gap') || 'Gap'}: {stats.gap}L
                            </span>
                        )}
                    </div>
                </div>

                {/* Total Farmers Card */}
                <div style={{
                    background: 'white',
                    borderRadius: '24px',
                    padding: '24px',
                    border: '1px solid #f3f4f6',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.04), 0 4px 6px -4px rgb(0 0 0 / 0.04)',
                    minHeight: '160px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <p style={{ fontSize: '16px', color: '#6b7280', margin: '0 0 12px 0', fontWeight: '500' }}>
                                {t('dashboard.totalFarmers')}
                            </p>
                            <p style={{ fontSize: '40px', fontWeight: '800', margin: '0', color: '#111827', lineHeight: 1 }}>
                                {stats.totalFarmers}
                            </p>
                        </div>
                        <div style={{
                            width: '56px',
                            height: '56px',
                            background: '#d1fae5',
                            borderRadius: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#065f46'
                        }}>
                            <Users size={28} strokeWidth={2.5} />
                        </div>
                    </div>
                    <p style={{ fontSize: '15px', color: '#6b7280', margin: '12px 0 0 0', fontWeight: '500' }}>
                        {t('dashboard.activeFarmers')}
                    </p>
                </div>

                {/* Cow Averages Card */}
                <div style={{
                    background: 'white',
                    borderRadius: '24px',
                    padding: '24px',
                    border: '1px solid #f3f4f6',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.04), 0 4px 6px -4px rgb(0 0 0 / 0.04)',
                    minHeight: '160px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <p style={{ fontSize: '16px', color: '#6b7280', margin: '0 0 12px 0', fontWeight: '500' }}>
                                🐄 {t('dashboard.cow')} {t('dashboard.avgSubtitle') || 'Avg'}
                            </p>
                        </div>
                        <div style={{
                            width: '56px',
                            height: '56px',
                            background: '#fed7aa',
                            borderRadius: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#9a3412'
                        }}>
                            <Activity size={28} strokeWidth={2.5} />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                        <div>
                            <p style={{ color: '#6b7280', margin: '0 0 2px 0', fontSize: '13px', fontWeight: '500' }}>Fat</p>
                            <p style={{ fontSize: '32px', fontWeight: '800', margin: '0 0 6px 0', color: '#111827', lineHeight: 1 }}>
                                {stats.avgCowFat}<span style={{ fontSize: '18px', fontWeight: '600', color: '#6b7280' }}>%</span>
                            </p>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '11px', background: '#fffbeb', color: '#b45309', padding: '2px 6px', borderRadius: '6px', fontWeight: '700', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: '2px' }}>☀️ {stats.avgCowFatMorn}%</span>
                                <span style={{ fontSize: '11px', background: '#eef2ff', color: '#4338ca', padding: '2px 6px', borderRadius: '6px', fontWeight: '700', border: '1px solid #c7d2fe', display: 'flex', alignItems: 'center', gap: '2px' }}>🌙 {stats.avgCowFatEve}%</span>
                            </div>
                        </div>
                        <div>
                            <p style={{ color: '#6b7280', margin: '0 0 2px 0', fontSize: '13px', fontWeight: '500' }}>SNF</p>
                            <p style={{ fontSize: '32px', fontWeight: '800', margin: '0 0 6px 0', color: '#111827', lineHeight: 1 }}>
                                {stats.avgCowSnf}<span style={{ fontSize: '18px', fontWeight: '600', color: '#6b7280' }}>%</span>
                            </p>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '11px', background: '#fffbeb', color: '#b45309', padding: '2px 6px', borderRadius: '6px', fontWeight: '700', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: '2px' }}>☀️ {stats.avgCowSnfMorn}%</span>
                                <span style={{ fontSize: '11px', background: '#eef2ff', color: '#4338ca', padding: '2px 6px', borderRadius: '6px', fontWeight: '700', border: '1px solid #c7d2fe', display: 'flex', alignItems: 'center', gap: '2px' }}>🌙 {stats.avgCowSnfEve}%</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Buffalo Averages Card */}
                <div style={{
                    background: 'white',
                    borderRadius: '24px',
                    padding: '24px',
                    border: '1px solid #f3f4f6',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.04), 0 4px 6px -4px rgb(0 0 0 / 0.04)',
                    minHeight: '160px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <p style={{ fontSize: '16px', color: '#6b7280', margin: '0 0 12px 0', fontWeight: '500' }}>
                                🐃 {t('dashboard.buffalo')} {t('dashboard.avgSubtitle') || 'Avg'}
                            </p>
                        </div>
                        <div style={{
                            width: '56px',
                            height: '56px',
                            background: '#ede9fe',
                            borderRadius: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#6d28d9'
                        }}>
                            <Activity size={28} strokeWidth={2.5} />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                        <div>
                            <p style={{ color: '#6b7280', margin: '0 0 2px 0', fontSize: '13px', fontWeight: '500' }}>Fat</p>
                            <p style={{ fontSize: '32px', fontWeight: '800', margin: '0 0 6px 0', color: '#111827', lineHeight: 1 }}>
                                {stats.avgBufFat}<span style={{ fontSize: '18px', fontWeight: '600', color: '#6b7280' }}>%</span>
                            </p>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '11px', background: '#fffbeb', color: '#b45309', padding: '2px 6px', borderRadius: '6px', fontWeight: '700', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: '2px' }}>☀️ {stats.avgBufFatMorn}%</span>
                                <span style={{ fontSize: '11px', background: '#eef2ff', color: '#4338ca', padding: '2px 6px', borderRadius: '6px', fontWeight: '700', border: '1px solid #c7d2fe', display: 'flex', alignItems: 'center', gap: '2px' }}>🌙 {stats.avgBufFatEve}%</span>
                            </div>
                        </div>
                        <div>
                            <p style={{ color: '#6b7280', margin: '0 0 2px 0', fontSize: '13px', fontWeight: '500' }}>SNF</p>
                            <p style={{ fontSize: '32px', fontWeight: '800', margin: '0 0 6px 0', color: '#111827', lineHeight: 1 }}>
                                {stats.avgBufSnf}<span style={{ fontSize: '18px', fontWeight: '600', color: '#6b7280' }}>%</span>
                            </p>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '11px', background: '#fffbeb', color: '#b45309', padding: '2px 6px', borderRadius: '6px', fontWeight: '700', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: '2px' }}>☀️ {stats.avgBufSnfMorn}%</span>
                                <span style={{ fontSize: '11px', background: '#eef2ff', color: '#4338ca', padding: '2px 6px', borderRadius: '6px', fontWeight: '700', border: '1px solid #c7d2fe', display: 'flex', alignItems: 'center', gap: '2px' }}>🌙 {stats.avgBufSnfEve}%</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Profit Card */}
                <div style={{
                    background: 'white',
                    borderRadius: '24px',
                    padding: '24px',
                    border: '1px solid #f3f4f6',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.04), 0 4px 6px -4px rgb(0 0 0 / 0.04)',
                    minHeight: '160px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div>
                            <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 6px 0', fontWeight: '600' }}>
                                संघाकडून आलेला नफा
                            </p>
                            <p style={{
                                fontSize: '36px',
                                fontWeight: '800',
                                margin: '0',
                                color: stats.profitData && stats.profitData.profit >= 0 ? '#059669' : '#dc2626',
                                lineHeight: 1
                            }}>
                                ₹{stats.profitData && stats.profitData.profit != null ? stats.profitData.profit.toFixed(2) : '0.00'}
                            </p>
                            <p style={{ fontSize: '11px', color: '#9ca3af', margin: '4px 0 0 0' }}>
                                संघ: ₹{stats.sanghNafaBreakdown ? stats.sanghNafaBreakdown.federationAmount.toFixed(0) : '0'}
                                &nbsp;|&nbsp;
                                शे.खर्च: ₹{stats.sanghNafaBreakdown ? stats.sanghNafaBreakdown.sanghProducerCost.toFixed(0) : '0'}
                            </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <select
                                    value={profitFilters.milkType}
                                    onChange={(e) => setProfitFilters(prev => ({ ...prev, milkType: e.target.value }))}
                                    style={{ padding: '4px 8px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', outline: 'none', cursor: 'pointer', fontWeight: '600' }}
                                >
                                    <option value="All">All Type</option>
                                    <option value="Cow">{t('dashboard.cow')}</option>
                                    <option value="Buffalo">{t('dashboard.buffalo')}</option>
                                </select>
                                <select
                                    value={profitFilters.shift}
                                    onChange={(e) => setProfitFilters(prev => ({ ...prev, shift: e.target.value }))}
                                    style={{ padding: '4px 8px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', outline: 'none', cursor: 'pointer', fontWeight: '600' }}
                                >
                                    <option value="All">All Shift</option>
                                    <option value="Morning">Morning</option>
                                    <option value="Evening">Evening</option>
                                </select>
                            </div>
                            <div style={{
                                width: '56px',
                                height: '56px',
                                background: stats.profitData && stats.profitData.profit >= 0 ? '#d1fae5' : '#fee2e2',
                                borderRadius: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: stats.profitData && stats.profitData.profit >= 0 ? '#059669' : '#dc2626'
                            }}>
                                <IndianRupee size={28} strokeWidth={2.5} />
                            </div>
                        </div>
                    </div>

                    {/* Footer gap */}
                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '8px', marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', fontSize: '12px', color: '#9ca3af', fontWeight: '500' }}>
                        Gap: {stats.gap}L
                    </div>
                </div>

                {/* Sent to Sangh Card */}
                <div style={{
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                    borderRadius: '24px',
                    padding: '24px',
                    color: 'white',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
                    minHeight: '160px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                        <div>
                            <p style={{ fontSize: '16px', color: '#94a3b8', margin: '0 0 12px 0', fontWeight: '500' }}>
                                {t('dashboard.sentToSangh')}
                            </p>
                            <p style={{ fontSize: '40px', fontWeight: '800', margin: '0', color: 'white', lineHeight: 1 }}>
                                {stats.sentToSangh ? (
                                    <>
                                        {stats.sentToSangh} <span style={{ fontSize: '20px', fontWeight: '600', color: '#94a3b8' }}>L</span>
                                    </>
                                ) : (
                                    <span style={{ fontSize: '24px', color: '#64748b' }}>No Receipt</span>
                                )}
                            </p>
                        </div>
                        <div style={{
                            width: '56px',
                            height: '56px',
                            background: 'rgba(255,255,255,0.1)',
                            borderRadius: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backdropFilter: 'blur(4px)'
                        }}>
                            <Building2 size={28} strokeWidth={2} />
                        </div>
                    </div>
                    {/* Cow / Buffalo breakdown pills */}
                    {stats.sentToSangh ? (
                        <div style={{ display: 'flex', gap: '8px', marginTop: '14px', position: 'relative', zIndex: 1 }}>
                            <div style={{
                                flex: 1,
                                background: 'rgba(255,251,235,0.12)',
                                border: '1px solid rgba(251,191,36,0.3)',
                                borderRadius: '10px',
                                padding: '6px 10px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <span style={{ fontSize: '13px', color: '#fbbf24', fontWeight: '600' }}>🐄 गाय</span>
                                <span style={{ fontSize: '14px', color: 'white', fontWeight: '800' }}>
                                    {stats.sanghCowQty ? `${stats.sanghCowQty}L` : '0L'}
                                </span>
                            </div>
                            <div style={{
                                flex: 1,
                                background: 'rgba(239,246,255,0.12)',
                                border: '1px solid rgba(147,197,253,0.3)',
                                borderRadius: '10px',
                                padding: '6px 10px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <span style={{ fontSize: '13px', color: '#93c5fd', fontWeight: '600' }}>🐃 म्हैस</span>
                                <span style={{ fontSize: '14px', color: 'white', fontWeight: '800' }}>
                                    {stats.sanghBufQty ? `${stats.sanghBufQty}L` : '0L'}
                                </span>
                            </div>
                        </div>
                    ) : null}
                    <p style={{ fontSize: '13px', color: '#6b7280', margin: '10px 0 0 0', position: 'relative', zIndex: 1 }}>
                        {t('dashboard.milkSupplied')}
                    </p>
                </div>

                {/* Local Sale Card */}
                <div style={{
                    background: 'white',
                    borderRadius: '24px',
                    padding: '24px',
                    border: '1px solid #f3f4f6',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.04), 0 4px 6px -4px rgb(0 0 0 / 0.04)',
                    minHeight: '160px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <p style={{ fontSize: '16px', color: '#6b7280', margin: '0 0 12px 0', fontWeight: '500' }}>
                                {t('dashboard.localSale')}
                            </p>
                            <p style={{ fontSize: '40px', fontWeight: '800', margin: '0', color: '#111827', lineHeight: 1 }}>
                                {stats.localSale} <span style={{ fontSize: '20px', fontWeight: '600', color: '#6b7280' }}>L</span>
                            </p>
                        </div>
                        <div style={{
                            width: '56px',
                            height: '56px',
                            background: '#fef3c7',
                            borderRadius: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#92400e'
                        }}>
                            <Users size={28} strokeWidth={2.5} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                        <p style={{ fontSize: '13px', color: '#059669', fontWeight: '600', margin: '0' }}>
                            ₹{stats.localSaleAmount} {t('dashboard.earned')}
                        </p>
                        <p style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500', margin: '0' }}>
                            Cost: ₹{stats.localSaleProfitData ? stats.localSaleProfitData.cost.toFixed(2) : '0.00'}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        <span style={{
                            padding: '6px 10px',
                            background: '#f8fafc',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '600',
                            color: '#475569',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            border: '1px solid #e2e8f0',
                            flex: 1,
                            justifyContent: 'center'
                        }}>
                            ⛅ {t('dashboard.morning', { defaultValue: 'Morning' })}: {stats.mornLocalSale}L
                        </span>
                        <span style={{
                            padding: '6px 10px',
                            background: '#f8fafc',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '600',
                            color: '#475569',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            border: '1px solid #e2e8f0',
                            flex: 1,
                            justifyContent: 'center'
                        }}>
                            🌙 {t('dashboard.evening', { defaultValue: 'Evening' })}: {stats.eveLocalSale}L
                        </span>
                    </div>
                </div>

                {/* Local Sale Profit Card */}
                <div style={{
                    background: 'white',
                    borderRadius: '24px',
                    padding: '24px',
                    border: `1px solid ${stats.localSaleProfitData && stats.localSaleProfitData.profit >= 0 ? '#d1fae5' : '#fee2e2'}`,
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.04), 0 4px 6px -4px rgb(0 0 0 / 0.04)',
                    minHeight: '160px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <p style={{ fontSize: '16px', color: '#6b7280', margin: '0 0 12px 0', fontWeight: '500' }}>
                                {t('dashboard.localSaleProfit')}
                            </p>
                            <p style={{
                                fontSize: '40px',
                                fontWeight: '800',
                                margin: '0',
                                color: stats.localSaleProfitData && stats.localSaleProfitData.profit >= 0 ? '#059669' : '#dc2626',
                                lineHeight: 1
                            }}>
                                ₹{stats.localSaleProfitData ? stats.localSaleProfitData.profit.toFixed(2) : '0.00'}
                            </p>
                        </div>
                        <div style={{
                            width: '56px',
                            height: '56px',
                            background: stats.localSaleProfitData && stats.localSaleProfitData.profit >= 0 ? '#d1fae5' : '#fee2e2',
                            borderRadius: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: stats.localSaleProfitData && stats.localSaleProfitData.profit >= 0 ? '#059669' : '#dc2626'
                        }}>
                            <TrendingUp size={28} strokeWidth={2.5} />
                        </div>
                    </div>

                    {/* Cow / Buffalo breakdown sub-row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px', borderTop: '1px solid #f8fafc', paddingTop: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#6b7280', fontWeight: '500' }}>🐄 Rev:</span>
                            <span style={{ fontWeight: '700', color: '#111827' }}>₹{stats.localSaleProfitData ? stats.localSaleProfitData.cow.revenue.toFixed(0) : '0'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#6b7280', fontWeight: '500' }}>🐃 Rev:</span>
                            <span style={{ fontWeight: '700', color: '#111827' }}>₹{stats.localSaleProfitData ? stats.localSaleProfitData.buffalo.revenue.toFixed(0) : '0'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#6b7280', fontWeight: '500' }}>🐄 Nafa:</span>
                            <span style={{
                                fontWeight: '800',
                                color: stats.localSaleProfitData && stats.localSaleProfitData.cow.profit >= 0 ? '#059669' : '#dc2626'
                            }}>₹{stats.localSaleProfitData ? stats.localSaleProfitData.cow.profit.toFixed(0) : '0'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#6b7280', fontWeight: '500' }}>🐃 Nafa:</span>
                            <span style={{
                                fontWeight: '800',
                                color: stats.localSaleProfitData && stats.localSaleProfitData.buffalo.profit >= 0 ? '#059669' : '#dc2626'
                            }}>₹{stats.localSaleProfitData ? stats.localSaleProfitData.buffalo.profit.toFixed(0) : '0'}</span>
                        </div>
                        <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'space-between', color: '#9ca3af', fontSize: '12px', marginTop: '2px' }}>
                            <span>Cost: ₹{stats.localSaleProfitData ? stats.localSaleProfitData.cost.toFixed(2) : '0.00'}</span>
                            <span>Qty: {stats.localSale}L</span>
                        </div>
                    </div>
                </div>

                {/* Total Revenue Card */}
                <div style={{
                    background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                    borderRadius: '24px',
                    padding: '24px',
                    color: 'white',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
                    minHeight: '160px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                        <div>
                            <p style={{ fontSize: '16px', color: '#d1fae5', margin: '0 0 12px 0', fontWeight: '500' }}>
                                {t('dashboard.totalRevenue')}
                            </p>
                            <p style={{ fontSize: '40px', fontWeight: '800', margin: '0', color: 'white', lineHeight: 1 }}>
                                ₹{stats.totalRevenue.toLocaleString()}
                            </p>
                        </div>
                        <div style={{
                            width: '56px',
                            height: '56px',
                            background: 'rgba(255,255,255,0.2)',
                            borderRadius: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backdropFilter: 'blur(4px)'
                        }}>
                            <Wallet size={28} strokeWidth={2} />
                        </div>
                    </div>
                    {/* Revenue breakdown: संघ नफा + स्थानिक विक्री नफा */}
                    <div style={{ position: 'relative', zIndex: 1, marginTop: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{
                                padding: '3px 10px',
                                background: 'rgba(255,255,255,0.18)',
                                borderRadius: '8px',
                                fontSize: '13px',
                                fontWeight: '700',
                                color: 'white',
                                border: '1px solid rgba(255,255,255,0.25)'
                            }}>
                                संघ: ₹{parseFloat(stats.sanghProfit || 0).toFixed(2)}
                            </span>
                            <span style={{ color: '#a7f3d0', fontWeight: '800', fontSize: '15px' }}>+</span>
                            <span style={{
                                padding: '3px 10px',
                                background: 'rgba(255,255,255,0.18)',
                                borderRadius: '8px',
                                fontSize: '13px',
                                fontWeight: '700',
                                color: 'white',
                                border: '1px solid rgba(255,255,255,0.25)'
                            }}>
                                स्थानिक: ₹{parseFloat(stats.localSaleProfit || 0).toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                gap: '40px',
                marginBottom: '40px'
            }}>
                {/* Weekly Trend Chart */}
                <div style={{
                    background: 'white',
                    borderRadius: '24px',
                    padding: '32px',
                    border: '1px solid #f3f4f6',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                        <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#111827', margin: 0 }}>
                            {t('dashboard.weeklyTrend')}
                        </h2>
                        <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                            {t('dashboard.entriesFor')} {selectedDate}
                        </p>
                    </div>
                    <div style={{ marginTop: '20px' }}>
                        {stats.weeklyData.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {stats.weeklyData.map((day, index) => {
                                    const width = maxQuantity > 0 ? (day.quantity / maxQuantity) * 100 : 0;
                                    const date = new Date(day.date);
                                    const dayName = date.toLocaleDateString(i18n.language, { weekday: 'short' });
                                    const dayNumber = date.getDate();
                                    const monthName = date.toLocaleDateString(i18n.language, { month: 'short' });
                                    const isToday = day.date === selectedDate;

                                    return (
                                        <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                                            <div style={{
                                                width: '90px',
                                                fontSize: '15px',
                                                fontWeight: '700',
                                                color: '#64748b',
                                                textTransform: 'uppercase'
                                            }}>
                                                {day.date}
                                            </div>
                                            <div style={{ flex: 1, position: 'relative', height: '44px', background: '#f8fafc', borderRadius: '12px', overflow: 'hidden' }}>
                                                <div style={{
                                                    position: 'absolute',
                                                    left: 0,
                                                    top: 0,
                                                    bottom: 0,
                                                    width: `${(day.quantity / maxQuantity) * 100}%`,
                                                    background: 'linear-gradient(90deg, #6366f1, #818cf8)',
                                                    borderRadius: '12px',
                                                    transition: 'width 1s ease-out'
                                                }} />
                                                <div style={{
                                                    position: 'absolute',
                                                    left: '16px',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    fontSize: '15px',
                                                    fontWeight: '800',
                                                    color: day.quantity / maxQuantity > 0.3 ? 'white' : '#1e293b',
                                                    zIndex: 1
                                                }}>
                                                    {day.quantity.toFixed(1)}L
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div style={{
                                textAlign: 'center',
                                padding: '60px 20px',
                                color: '#9ca3af'
                            }}>
                                <p style={{ fontSize: '15px', margin: 0 }}>No data available</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Collections List */}
                <div style={{
                    background: 'white',
                    borderRadius: '24px',
                    padding: '32px',
                    border: '1px solid #f3f4f6',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                        <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#111827', margin: 0 }}>
                            {t('dashboard.collectionsList')}
                        </h2>
                        <div style={{ fontSize: '13px', color: '#6b7280' }}>
                            {t('dashboard.entriesFor')} {selectedDate}
                        </div>
                    </div>
                    <div style={{ maxHeight: '600px', overflowY: 'auto', overflowX: 'auto' }}>
                        {recentCollections.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '80px 20px',
                                color: '#9ca3af'
                            }}>
                                <Activity size={56} style={{ margin: '0 auto 20px', opacity: 0.5 }} />
                                <p style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 8px 0' }}>
                                    {t('dashboard.noCollections')}
                                </p>
                                <p style={{ fontSize: '15px', margin: 0 }}>
                                    {t('dashboard.selectAnother')}
                                </p>
                            </div>
                        ) : (
                            <table style={{
                                width: '100%',
                                borderCollapse: 'collapse'
                            }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                                        <th style={{ textAlign: 'left', padding: '16px 12px', color: '#6b7280', fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', width: '30%' }}>{t('dashboard.table.farmer')}</th>
                                        <th style={{ textAlign: 'center', padding: '16px 12px', color: '#6b7280', fontSize: '14px', fontWeight: '700', textTransform: 'uppercase' }}>{t('dashboard.table.shift')}</th>
                                        <th style={{ textAlign: 'right', padding: '16px 12px', color: '#6b7280', fontSize: '14px', fontWeight: '700', textTransform: 'uppercase' }}>{t('dashboard.table.qty')}</th>
                                        <th style={{ textAlign: 'right', padding: '16px 12px', color: '#6b7280', fontSize: '14px', fontWeight: '700', textTransform: 'uppercase' }}>{t('dashboard.table.amount')}</th>
                                        <th style={{ textAlign: 'center', padding: '16px 12px', color: '#6b7280', fontSize: '14px', fontWeight: '700', textTransform: 'uppercase' }}>{t('dashboard.table.action')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentCollections.map((c, index) => (
                                        <tr key={c.id} style={{
                                            borderBottom: '1px solid #f3f4f6',
                                            background: index % 2 === 0 ? 'white' : '#fafafa',
                                            transition: 'background 0.2s'
                                        }}>
                                            <td style={{ padding: '20px 12px' }}>
                                                <div style={{ fontWeight: '800', color: '#111827', fontSize: '16px' }}>{c.farmer_name}</div>
                                                <div style={{ fontSize: '14px', color: '#9ca3af', fontWeight: '500' }}>#{c.farmer_code || c.farmer_id}</div>
                                            </td>
                                            <td style={{ textAlign: 'center', padding: '20px 12px' }}>
                                                <span style={{
                                                    padding: '6px 12px',
                                                    background: c.shift === 'Morning' ? '#eff6ff' : '#f5f3ff',
                                                    color: c.shift === 'Morning' ? '#2563eb' : '#7c3aed',
                                                    borderRadius: '8px',
                                                    fontSize: '13px',
                                                    fontWeight: '700'
                                                }}>
                                                    {c.shift === 'Morning' ? 'AM' : 'PM'}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right', padding: '20px 12px', fontWeight: '800', color: '#111827', fontSize: '16px' }}>
                                                {c.quantity}L
                                            </td>
                                            <td style={{ textAlign: 'right', padding: '20px 12px' }}>
                                                <div style={{ fontSize: '16px', fontWeight: '900', color: '#059669' }}>₹{c.amount}</div>
                                                {c.deduction > 0 && (
                                                    <div style={{ fontSize: '12px', color: '#dc2626', fontWeight: '600' }}>-₹{c.deduction}</div>
                                                )}
                                            </td>
                                            <td style={{ textAlign: 'center', padding: '20px 12px' }}>
                                                <button
                                                    onClick={() => handleEditCollection(c)}
                                                    style={{
                                                        padding: '10px',
                                                        background: '#f8fafc',
                                                        border: '1px solid #e2e8f0',
                                                        borderRadius: '12px',
                                                        cursor: 'pointer',
                                                        color: '#64748b',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    <Edit size={20} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
