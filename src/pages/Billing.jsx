import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, FileText, Download, IndianRupee, Users, Droplets, ChevronDown, ChevronRight, CheckCircle, Loader2, Filter, Eye, X, Printer, Search, ToggleLeft, ToggleRight, Edit3, XCircle } from 'lucide-react';
import Loader from '../components/Loader';
import { useAlert } from '../hooks/useAlert';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

import {
    getFarmers,
    getCollections,
    getFarmerDeductions,
    getBillPayments,
    processBillPayment,
    revertBillPayment,
    getFarmerThevAccounts
} from '../lib/api';

import dayjs from 'dayjs';
import 'dayjs/locale/hi';
import 'dayjs/locale/mr';

function Billing({ user }) {
    const { t, i18n } = useTranslation();
    const { showAlert, showConfirm, AlertComponent } = useAlert();
    const [dateRangeType, setDateRangeType] = useState(() => {
        const today = new Date().getDate();
        if (today <= 10) return '1-10';
        if (today <= 20) return '11-20';
        return '21-30';
    });
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    const [printBillData, setPrintBillData] = useState(null); // Keep for single bill logic if needed, or integrate?
    /* Removed: bulkBillData, htmlReportData */
    const [showPdfModal, setShowPdfModal] = useState(false);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
    const [previewFileName, setPreviewFileName] = useState('');
    const [viewBillData, setViewBillData] = useState(null);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [pdfPreview, setPdfPreview] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showThermalModal, setShowThermalModal] = useState(false);
    const [thermalData, setThermalData] = useState(null);

    // === NEW: Bill Detail Modal & Deduction Override States ===
    const [showBillModal, setShowBillModal] = useState(false);
    const [selectedBill, setSelectedBill] = useState(null);
    const [deductionOverrides, setDeductionOverrides] = useState({}); // { [deductionId]: { enabled: true/false, customAmount: null|number } }
    const [payLoading, setPayLoading] = useState(false); // Loading state for mark paid/unpaid
    const [payLoadingMsg, setPayLoadingMsg] = useState('');
    const [editingDeduction, setEditingDeduction] = useState(null);
    const [tempAmount, setTempAmount] = useState('');
    const [paidFilter, setPaidFilter] = useState('all'); // 'all' | 'paid' | 'unpaid'
    const [milkTypeFilter, setMilkTypeFilter] = useState('all'); // 'all' | 'cow' | 'buffalo'
    const [thevAccounts, setThevAccounts] = useState([]); // Farmer Thev accounts for deduction integration
    const [thevTxnMap, setThevTxnMap] = useState({}); // { [farmer_id]: { [account_id]: totalDeposited } } for billing period

    // New Sequential PDF State
    const [pdfJob, setPdfJob] = useState(null);
    const pdfRef = React.useRef(null);
    const isProcessingRef = React.useRef(false);

    const toSafeNumber = (value) => {
        const num = Number(value);
        return Number.isFinite(num) ? num : 0;
    };

    const formatMoney = (value, decimals = 2, options = {}) => {
        const { truncate = false } = options;
        const num = toSafeNumber(value);
        const factor = 10 ** decimals;
        const normalized = truncate
            ? (num >= 0 ? Math.floor(num * factor) : Math.ceil(num * factor)) / factor
            : Math.round((num + Number.EPSILON) * factor) / factor;
        return normalized.toFixed(decimals);
    };

    const formatWhole = (value) => String(Math.trunc(toSafeNumber(value)));
    const formatLocaleNum = (numStr) => {
        if (numStr === undefined || numStr === null) return numStr;
        // Check if user has opted for English (123) digits on bills
        try {
            const billSettings = JSON.parse(localStorage.getItem('billingPrintSettings') || '{}');
            if (billSettings.billNumberLanguage === 'en') return numStr;
        } catch (e) { /* ignore parse errors, fall through to default */ }
        if (i18n.language !== 'mr') return numStr;
        const marathiDigits = {
            '0': '०', '1': '१', '2': '२', '3': '३', '4': '४',
            '5': '५', '6': '६', '7': '७', '8': '८', '9': '९'
        };
        return String(numStr).replace(/[0-9]/g, match => marathiDigits[match]);
    };

    const formatByPrintSetting = (value, settings, options = {}) => {
        const showDecimals = settings?.showDecimals !== false;
        const decimals = options.decimals ?? 2;
        const formatted = showDecimals
            ? formatMoney(value, decimals, options)
            : formatWhole(value);
        return formatLocaleNum(formatted);
    };

    const isTargetDeduction = (d) => d?.total_amount !== null && d?.total_amount !== undefined;

    const sortDeductionsForApply = (list = []) => {
        return [...list].sort((a, b) => {
            const aTarget = isTargetDeduction(a);
            const bTarget = isTargetDeduction(b);
            // Apply regular/fixed deductions first, then target-balance deductions.
            if (aTarget !== bTarget) return aTarget ? 1 : -1;

            const aStart = String(a?.start_date || '');
            const bStart = String(b?.start_date || '');
            if (aStart !== bStart) return aStart.localeCompare(bStart);

            return (Number(a?.id) || 0) - (Number(b?.id) || 0);
        });
    };

    const getDateRange = () => {
        const year = parseInt(selectedMonth.split('-')[0]);
        const month = parseInt(selectedMonth.split('-')[1]);

        if (dateRangeType === 'custom') {
            return {
                startDate: customStartDate,
                endDate: customEndDate
            };
        }

        let startDay, endDay;
        switch (dateRangeType) {
            case '1-10':
                startDay = 1;
                endDay = 10;
                break;
            case '11-20':
                startDay = 11;
                endDay = 20;
                break;
            case '21-30':
                startDay = 21;
                endDay = new Date(year, month, 0).getDate();
                break;
            default:
                startDay = 1;
                endDay = 10;
        }

        const startDate = `${year}-${String(month).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

        return { startDate, endDate };
    };


    // Unified Sequential PDF Generation Effect
    useEffect(() => {
        if (!pdfJob || isProcessingRef.current) return;

        const processPage = async () => {
            if (isProcessingRef.current) return;
            isProcessingRef.current = true;
            try {
                // 1. Check if job is done
                if (pdfJob.currentChunk >= pdfJob.chunks.length) {
                    if (pdfJob.viewMode) {
                        setPdfPreview({
                            images: pdfJob.previews || [],
                            fileName: pdfJob.fileName || 'Report.pdf',
                            pdfRef: pdfRef.current
                        });
                    } else {
                        pdfRef.current.save(pdfJob.fileName || 'Report.pdf');
                        showAlert(t('billing.messages.downloadSuccess', { defaultValue: 'Download Started' }), 'Success', 'success');
                    }
                    setPdfJob(null);
                    setPdfLoading(false);
                    return;
                }

                // 2. Wait for Render
                await new Promise(resolve => setTimeout(resolve, 800));

                // 3. Find Render Target
                const element = document.getElementById('pdf-render-target');
                if (!element) throw new Error(`Page ${pdfJob.currentChunk} not found`);

                // 4. Capture
                const orientation = pdfJob.orientation || 'portrait';
                const canvas = await html2canvas(element, {
                    scale: 4,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff',
                    width: orientation === 'landscape' ? 1123 : 794,
                    // For landscape: fix to exact A4 height so page is fully filled with no blank space
                    // For portrait: omit height so variable-height bills render without distortion
                    ...(orientation === 'landscape' ? { height: 794 } : {}),
                });

                const imgData = canvas.toDataURL('image/jpeg', 0.98);
                const pdf = pdfRef.current;
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();

                if (pdfJob.currentChunk > 0) pdf.addPage();
                if (orientation === 'landscape') {
                    // Canvas is exactly A4 landscape — fill the full page with no blank space
                    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
                } else {
                    // Portrait: preserve actual content aspect ratio to avoid stretching
                    const imgRatio = canvas.width / canvas.height;
                    let addHeight = pdfWidth / imgRatio;
                    let addWidth = pdfWidth;
                    let xOffset = 0;

                    // If it exceeds the page height, scale it down to fit on one page
                    if (addHeight > pdfHeight) {
                        addHeight = pdfHeight;
                        addWidth = pdfHeight * imgRatio;
                        xOffset = (pdfWidth - addWidth) / 2;
                    }

                    pdf.addImage(imgData, 'JPEG', xOffset, 0, addWidth, addHeight, undefined, 'FAST');
                }

                // 5. Move to Next Page
                setPdfJob(prev => {
                    if (!prev) return null;
                    const nextJob = { ...prev, currentChunk: prev.currentChunk + 1 };
                    // Only store previews if actually in view mode to save massive memory/state updates
                    if (prev.viewMode) {
                        nextJob.previews = [...(prev.previews || []), imgData];
                    }
                    return nextJob;
                });

            } catch (error) {
                console.error("PDF Gen Error:", error);
                showAlert(t('billing.messages.errorPdf'), 'Error', 'error');
                setPdfLoading(false);
                setPdfJob(null);
            } finally {
                isProcessingRef.current = false;
            }
        };

        processPage();
    }, [pdfJob, showAlert, t]);

    // Handle Export (Register) - Triggers PDF Job
    const handleExport = (viewMode = false) => {
        console.log("handleExport called - Starting Register PDF generation", { viewMode });
        try {
            if (billData.length === 0) {
                showAlert(t('billing.messages.noDataExport'), 'Export', 'warning');
                return;
            }

            // --- Apply Billing Print Settings ---
            const defaultSettings = {
                showFatColumn: true,
                showSnfColumn: true,
                showRateColumn: true,
                showAmountColumn: true,
                showTypeColumn: true,
                showDecimals: true
            };

            let printSettings = { ...defaultSettings };
            try {
                const storedSettings = localStorage.getItem('billingPrintSettings');
                if (storedSettings) {
                    printSettings = { ...defaultSettings, ...JSON.parse(storedSettings) };
                }
            } catch (e) {
                console.error("Error parsing billing print settings:", e);
            }

            // 1. Extract Unique Deduction Names
            const uniqueDeductions = new Set();
            billData.forEach(bill => {
                if (bill.deduction_details) {
                    bill.deduction_details.forEach(d => {
                        const name = d.deduction_name || d.name || '';
                        if (name) uniqueDeductions.add(name);
                    });
                }
            });
            const deductionColumns = Array.from(uniqueDeductions).sort();

            // 2. Prepare Payment Register Data (per-bill amounts unchanged; section = majority milk qty)
            const classifyBillMilkType = (bill) => {
                let buffaloQty = 0;
                let cowQty = 0;
                (bill.collections || []).forEach((col) => {
                    const q = parseFloat(col.quantity || 0);
                    const mt = String(col.milk_type || '').toLowerCase();
                    if (mt === 'buffalo') buffaloQty += q;
                    else cowQty += q;
                });
                if (buffaloQty === 0 && cowQty === 0) return 'Cow';
                return buffaloQty >= cowQty ? 'Buffalo' : 'Cow';
            };

            const compareFarmerCodeAsc = (a, b) => {
                const ca = String(a.farmerCode ?? '').trim();
                const cb = String(b.farmerCode ?? '').trim();
                return ca.localeCompare(cb, undefined, { numeric: true, sensitivity: 'base' });
            };

            const paymentRegisterData = billData.map((bill) => {
                let mQty = 0, mAmt = 0;
                let eQty = 0, eAmt = 0;

                bill.collections.forEach(col => {
                    if (col.shift === 'Morning') {
                        mQty += parseFloat(col.quantity || 0);
                        mAmt += parseFloat(col.amount || 0);
                    } else {
                        eQty += parseFloat(col.quantity || 0);
                        eAmt += parseFloat(col.amount || 0);
                    }
                });

                // Compute total deduction (sum all deductions for this bill)
                // deduction_details items use 'd.deducted' for the amount actually deducted
                let totalDeduction = 0;
                const deductionBreakdown = (bill.deduction_details || [])
                    .map(d => ({
                        name: d.name || d.deduction_name || '',
                        amount: parseFloat(d.deducted || d.amount || 0)
                    }))
                    .filter(d => d.name && d.amount > 0);

                deductionBreakdown.forEach(d => { totalDeduction += d.amount; });

                // Also use the pre-computed total_deduction field as a reliable fallback
                if (totalDeduction === 0 && parseFloat(bill.total_deduction || 0) > 0) {
                    totalDeduction = parseFloat(bill.total_deduction || 0);
                }

                const totalAmt = parseFloat(bill.total_amount || 0);
                const netAmt = parseFloat(bill.net_amount || 0);

                return {
                    farmerCode: bill.farmer_code != null ? String(bill.farmer_code) : '',
                    milkType: classifyBillMilkType(bill),
                    name: bill.farmer_name,
                    morning: { qty: mQty.toFixed(3), amt: mAmt },
                    evening: { qty: eQty.toFixed(3), amt: eAmt },
                    total: { qty: parseFloat(bill.total_quantity || 0).toFixed(3), amt: totalAmt },
                    deductionBreakdown: deductionBreakdown,
                    totalDeduction: totalDeduction,
                    net: formatByPrintSetting(netAmt, printSettings, { truncate: true })
                };
            });

            console.log(`Prepared ${paymentRegisterData.length} rows for register with columns:`, deductionColumns);

            setPdfLoading(true);
            const { startDate, endDate } = getDateRange();
            const periodStr = `${new Date(startDate).toLocaleDateString('en-GB')} to ${new Date(endDate).toLocaleDateString('en-GB')}`;

            const buffaloRows = paymentRegisterData
                .filter((r) => r.milkType === 'Buffalo')
                .sort(compareFarmerCodeAsc);
            const cowRows = paymentRegisterData
                .filter((r) => r.milkType === 'Cow')
                .sort(compareFarmerCodeAsc);

            const chunkSize = 20;
            const chunks = [];
            const pushSectionChunks = (sectionTitle, rows) => {
                if (!rows.length) return;
                for (let i = 0; i < rows.length; i += chunkSize) {
                    chunks.push({
                        sectionTitle: i === 0 ? sectionTitle : null,
                        rows: rows.slice(i, i + chunkSize)
                    });
                }
            };
            pushSectionChunks(t('register.sectionBuffalo'), buffaloRows);
            pushSectionChunks(t('register.sectionCow'), cowRows);

            const sumRegisterRows = (rows) => rows.reduce((acc, row) => {
                const next = { ...acc };
                next.morningQty += parseFloat(row.morning.qty);
                next.morningAmt += toSafeNumber(row.morning.amt);
                next.eveningQty += parseFloat(row.evening.qty);
                next.eveningAmt += toSafeNumber(row.evening.amt);
                next.totalQty += parseFloat(row.total.qty);
                next.totalAmt += toSafeNumber(row.total.amt);
                next.totalDeduction += parseFloat(row.totalDeduction || 0);
                next.net += toSafeNumber(row.net);
                return next;
            }, {
                morningQty: 0, morningAmt: 0,
                eveningQty: 0, eveningAmt: 0,
                totalQty: 0, totalAmt: 0,
                totalDeduction: 0,
                net: 0
            });

            // Calculate Grand Totals (all farmers)
            const grandTotals = sumRegisterRows(paymentRegisterData);
            const buffaloTotals = sumRegisterRows(buffaloRows);
            const cowTotals = sumRegisterRows(cowRows);

            // Initialize PDF Job
            pdfRef.current = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4',
                compress: true
            });

            setPdfJob({
                type: 'register',
                chunks: chunks,
                currentChunk: 0,
                previews: [],
                orientation: 'landscape',
                viewMode: viewMode,
                meta: {
                    dairyName: user?.dairy_name || "DudhSakha",
                    title: t('register.title'),
                    subtitle: `${t('billing.period')}: ${periodStr}`,
                    date: new Date().toLocaleDateString('en-GB')
                },
                fileName: `Payment_Register_${startDate}_to_${endDate}`,
                grandTotals: grandTotals,
                registerSectionTotals: { buffalo: buffaloTotals, cow: cowTotals },
                deductionColumns: deductionColumns,
                printSettings: printSettings // Pass settings to the job
            });
        } catch (err) {
            console.error("Error in handleExport:", err);
            showAlert("Error preparing register: " + err.message, 'Error', 'error');
            setPdfLoading(false);
        }
    };

    // Handle Bulk Bills - Triggers PDF Job
    const handleViewAllBills = (viewMode = false) => {
        console.log("handleViewAllBills called - Starting Bulk Bill generation", { viewMode });
        try {
            if (billData.length === 0) {
                showAlert(t('billing.messages.noDataExport'), 'Export', 'warning');
                return;
            }

            setPdfLoading(true);
            // Sort ascending by farmer code (numeric) before bulk download
            const sortedBillsForDownload = [...billData].sort((a, b) => {
                const aNum = parseInt(a.farmer_code, 10);
                const bNum = parseInt(b.farmer_code, 10);
                if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
                return String(a.farmer_code).localeCompare(String(b.farmer_code));
            });
            const preparedBills = sortedBillsForDownload.map(bill => prepareBillData(bill));
            let billFormat = 'format2';
            try {
                billFormat = localStorage.getItem('billFormat') || 'format2';
            } catch { /* ignore */ }

            // --- Apply Billing Print Settings ---
            const defaultSettings = {
                showFatColumn: true,
                showSnfColumn: true,
                showRateColumn: true,
                showAmountColumn: true,
                showTypeColumn: true,
                showDecimals: true
            };

            let printSettings = { ...defaultSettings };
            try {
                const storedSettings = localStorage.getItem('billingPrintSettings');
                if (storedSettings) {
                    printSettings = { ...defaultSettings, ...JSON.parse(storedSettings) };
                }
            } catch (e) {
                console.error("Error parsing billing print settings:", e);
            }

            // Chunk (e.g., 2 bills per page)
            const chunks = [];
            const chunkSize = 2; // Adjust if bills are long
            for (let i = 0; i < preparedBills.length; i += chunkSize) {
                chunks.push(preparedBills.slice(i, i + chunkSize));
            }

            const { startDate, endDate } = getDateRange();

            // Initialize PDF Job
            pdfRef.current = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4',
                compress: true
            });

            setPdfJob({
                type: 'bulk',
                chunks: chunks,
                currentChunk: 0,
                previews: [],
                orientation: 'portrait',
                viewMode: viewMode,
                fileName: `All_Bills_${startDate}_to_${endDate}`,
                printSettings: printSettings,
                billFormat: billFormat
            });
        } catch (err) {
            console.error("Error in handleViewAllBills:", err);
            showAlert("Error preparing bills: " + err.message, 'Error', 'error');
            setPdfLoading(false);
        }
    };



    const handleViewRegister = () => {
        handleExport(); // This function (defined above) sets htmlReportData for the Register
    };




    // ... existing handleExport ...


    const [farmers, setFarmers] = useState([]);
    const [collections, setCollections] = useState([]);

    const [deductions, setDeductions] = useState([]);
    const [billData, setBillData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [expandedRows, setExpandedRows] = useState([]);

    const [billPayments, setBillPayments] = useState([]);
    const [allBillPayments, setAllBillPayments] = useState([]);

    useEffect(() => {
        loadInitialData();
        fetchAllBillPayments();
    }, []); // Empty dependency array for initial load

    useEffect(() => {
        if (farmers.length > 0) {
            generateBills();
        }
        fetchBillPayments();

    }, [dateRangeType, selectedMonth, customStartDate, customEndDate, farmers, collections, deductions, allBillPayments, user?.dairy_id, thevAccounts]);

    const fetchBillPayments = async () => {
        const { startDate, endDate } = getDateRange();
        if (startDate && endDate) {
            try {
                const data = await getBillPayments({ startDate, endDate, dairy_id: user?.dairy_id });

                const parsedData = (data || []).map(p => {
                    try {
                        const parsed = typeof p.deductions_summary === 'string'
                            ? JSON.parse(p.deductions_summary)
                            : (p.deductions_summary || []);
                        // Handle both formats:
                        // New format: deductions_summary is a direct array [{id, name, amount, ...}]
                        // Old format: deductions_summary is an object {deductions_list: [...], new_balance, ...}
                        let deductionsArray;
                        if (Array.isArray(parsed)) {
                            deductionsArray = parsed;
                        } else if (parsed && Array.isArray(parsed.deductions_list)) {
                            deductionsArray = parsed.deductions_list;
                        } else {
                            deductionsArray = [];
                        }
                        return { ...p, deductions: deductionsArray };
                    } catch (e) {
                        console.error("Error parsing deductions summary", e);
                        return { ...p, deductions: [] };
                    }
                });
                setBillPayments(parsedData);
            } catch (error) {
                console.error('Error fetching bill payments:', error);
            }
        }
    };

    // Fetch ALL bill payments across all periods for cascading balance
    const fetchAllBillPayments = async () => {
        try {
            const data = await getBillPayments({ dairy_id: user?.dairy_id });
            const parsedData = (data || []).map(p => {
                try {
                    const parsed = typeof p.deductions_summary === 'string'
                        ? JSON.parse(p.deductions_summary)
                        : (p.deductions_summary || []);
                    // Handle both formats:
                    // New format: deductions_summary is a direct array [{id, name, amount, ...}]
                    // Old format: deductions_summary is an object {deductions_list: [...], new_balance, ...}
                    let deductionsArray;
                    if (Array.isArray(parsed)) {
                        deductionsArray = parsed;
                    } else if (parsed && Array.isArray(parsed.deductions_list)) {
                        deductionsArray = parsed.deductions_list;
                    } else {
                        deductionsArray = [];
                    }
                    return { ...p, deductions: deductionsArray };
                } catch (e) {
                    return { ...p, deductions: [] };
                }
            });
            setAllBillPayments(parsedData);
        } catch (error) {
            console.error('Error fetching all bill payments:', error);
        }
    };

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const [
                farmerList,
                collectionList,
                deductionList,
                thevList
            ] = await Promise.all([
                getFarmers(user?.dairy_id),
                getCollections(user?.dairy_id),
                getFarmerDeductions(user?.dairy_id),
                getFarmerThevAccounts(user?.dairy_id).catch(() => [])
            ]);

            const activeFarmers = (farmerList || []).filter(f => !f.is_deleted);
            setFarmers(activeFarmers);
            setCollections(collectionList || []);
            setThevAccounts(thevList || []);


            const formattedDeductions = (deductionList || []).map(d => ({
                ...d,

                deduction_type: d.deduction_type || d.deduction_masters?.type,
                deduction_name: d.deduction_name || d.deduction_masters?.name
            }));

            setDeductions(formattedDeductions);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };



    const calculateBillForFarmer = (farmer, startDate, endDate, txnMap = {}, historicalThevBalances = {}) => {
        const farmerCollections = collections.filter(c =>
            c.farmer_id === farmer.id &&
            c.date >= startDate &&
            c.date <= endDate
        );

        if (farmerCollections.length === 0) {
            return null;
        }

        let totalAmount = 0;
        let totalQuantity = 0;
        let totalDeduction = 0;

        farmerCollections.forEach(collection => {
            totalAmount += parseFloat(collection.amount || 0);
            totalQuantity += parseFloat(collection.quantity || 0);
        });
        // Round to 3 decimal places to match displayed bill precision and avoid float accumulation errors
        totalQuantity = Math.round(totalQuantity * 1000) / 1000;
        totalAmount = Math.round(totalAmount * 100) / 100;

        const farmerDeductions = deductions.filter(d => {
            if (d.farmer_id !== farmer.id) return false;
            const status = String(d.status || 'active').toLowerCase();
            const isActiveStatus = status === 'active' || status === '';
            const isEnabled = d.is_enabled !== false;
            const isAlwaysWaived = String(d.waive_mode || '').toLowerCase() === 'always';
            const startsInRange = !d.start_date || d.start_date <= endDate;
            const endsInRange = !d.end_date || d.end_date >= startDate;

            return isActiveStatus && isEnabled && !isAlwaysWaived && startsInRange && endsInRange;
        });

        const deductionDetails = [];

        // --- HISTORICAL DEDUCTION OVERRIDE (CHECK FIRST!) ---
        // If this bill has already been paid, use the exact deductions saved at payment time.
        // This MUST happen BEFORE the dynamic calculation, because collected_amount in the
        // deductions table reflects ALL payments (not just this bill's), which would produce
        // wrong prevBalance/remaining values for historically paid bills.
        const existingPayment = allBillPayments.find(p => p.farmer_id === farmer.id && p.start_date === startDate && p.end_date === endDate);

        if (existingPayment) {  // FIX: Always use stored snapshot for paid bills, even if deductions=[]
            // Use the historically saved snapshot — do NOT run dynamic calculation
            (existingPayment.deductions || []).forEach(d => {
                const amt = parseFloat(d.amount) || 0;
                totalDeduction += amt;
                deductionDetails.push({
                    id: d.id,
                    name: d.name,
                    type: '',
                    rate: '',
                    prevBalance: d.previous_balance || d.prevBalance || '',
                    currentAddition: '',
                    deducted: formatMoney(amt),
                    remaining: (d.remaining_balance ?? d.remaining ?? '') !== ''
                        ? formatMoney(d.remaining_balance ?? d.remaining, 2, { truncate: true })
                        : ''
                });
            });
        } else {
            // --- DYNAMIC CALCULATION (for unpaid bills only) ---
            // ✅ ORDER: Thev has priority — processed first, then regular deductions below.

            // ── THEV DEDUCTION INTEGRATION ─────────────────────────────────────
            // ✅ PRIORITY: Process thev FIRST before regular deductions.
            // Thev deposits are already recorded in passbook during collection entry,
            // so they must always appear as a deduction regardless of other deductions.
            const farmerThevAccts = thevAccounts.filter(a =>
                String(a.farmer_id) === String(farmer.id) &&
                a.status === 'active' &&
                (!a.start_date || a.start_date <= endDate)
            );
            const farmerTxns = txnMap[String(farmer.id)] || {};
            farmerThevAccts.forEach(thev => {
                const thevRate = parseFloat(thev.rate) || 0;
                const thevType = thev.thev_type || 'per_liter';
                const accountId = String(thev.id);

                // Always calculate per_liter as (rate × totalQty) rounded ONCE to 3 decimal places.
                // e.g. 41.700L × ₹0.05 = ₹2.085 exactly — no per-collection rounding accumulation.
                let thevAmt = 0;
                if (thevType === 'per_liter') {
                    thevAmt = Math.round(thevRate * totalQuantity * 1000) / 1000;
                } else if (thevType === 'fixed_amount') {
                    thevAmt = Math.round(thevRate * 1000) / 1000;
                } else if (thevType === 'percentage') {
                    thevAmt = Math.round((thevRate / 100) * totalAmount * 1000) / 1000;
                } else if (farmerTxns[accountId] !== undefined) {
                    thevAmt = Math.round(farmerTxns[accountId] * 1000) / 1000;
                }

                if (thevAmt > 0) {
                    // Thev has priority — deduct from full amount before other deductions.
                    totalDeduction += thevAmt;
                    deductionDetails.push({
                        id: `thev_${thev.id}`,
                        name: `एकुण (${thev.thev_name || 'ठेव'})`,
                        type: 'thev',
                        rate: thevRate,
                        prevBalance: '',
                        currentAddition: '',
                        deducted: formatMoney(thevAmt, 3),
                        remaining: ''
                    });
                }
            });
            // ── END THEV (priority block) ───────────────────────────────────────

            // --- REGULAR DEDUCTIONS (after thev, so thev always has priority) ---
            const orderedDeductions = sortDeductionsForApply(farmerDeductions);
            orderedDeductions.forEach(deduction => {

                if (deduction.total_amount !== null && deduction.total_amount !== undefined) {
                    const remaining = parseFloat(deduction.total_amount) - parseFloat(deduction.collected_amount || 0);
                    if (remaining <= 0) {

                        return;
                    }
                }

                let amount = 0;

                if (deduction.deduction_type === 'fixed' || deduction.deduction_type === 'inventory') {
                    amount = parseFloat(deduction.amount || 0);
                } else if (deduction.deduction_type === 'percentage') {
                    amount = (totalAmount * parseFloat(deduction.amount || 0)) / 100;
                } else if (deduction.deduction_type === 'per_liter' || deduction.deduction_type === 'mpc') {
                    amount = totalQuantity * parseFloat(deduction.amount || 0);
                } else if (deduction.deduction_type === 'manual') {
                    amount = parseFloat(deduction.amount || 0);
                }

                amount = Math.round(amount * 100) / 100;

                if (deduction.total_amount !== null && deduction.total_amount !== undefined) {
                    const remainingTarget = parseFloat(deduction.total_amount) - parseFloat(deduction.collected_amount || 0);
                    amount = Math.min(amount, Math.max(0, remainingTarget));
                }

                const effectiveAmount = Math.min(amount, Math.max(0, totalAmount - totalDeduction));

                if (effectiveAmount > 0) {
                    totalDeduction += effectiveAmount;
                }

                const deductionName =
                    deduction.deduction_name ||
                    deduction.deduction_masters?.name ||
                    deduction.type_name ||
                    deduction.name ||
                    'Deduction';
                const hasTarget = deduction.total_amount !== null && deduction.total_amount !== undefined;

                let prevBalance = hasTarget
                    ? Math.max(0, parseFloat(deduction.total_amount) - parseFloat(deduction.collected_amount || 0))
                    : null;

                // === SAME-MONTH CASCADING ===
                if (hasTarget && allBillPayments.length > 0) {
                    const sameMonthPaidBills = allBillPayments
                        .filter(p =>
                            p.farmer_id === farmer.id &&
                            p.end_date < startDate &&
                            p.start_date >= startDate.substring(0, 7) + '-01'
                        )
                        .sort((a, b) => b.end_date.localeCompare(a.end_date));

                    if (sameMonthPaidBills.length > 0) {
                        const latestPaidBill = sameMonthPaidBills[0];
                        const paidDeductions = latestPaidBill.deductions || [];

                        // Step 1: Exact ID match — always reliable
                        let paidDed = paidDeductions.find(d => d.id != null && d.id === deduction.id);

                        // Step 2: Name fallback ONLY if no ID match found AND the matched
                        // entry has remaining_balance > 0. A name match with remaining=0.00
                        // means it's a DIFFERENT fully-completed deduction sharing the same
                        // name — using it would wrongly set prevBalance to 0.
                        if (!paidDed) {
                            const nameFallback = paidDeductions.find(
                                d => d.name === (deduction.deduction_name || deduction.name)
                            );
                            const nameFallbackRem = parseFloat(nameFallback?.remaining_balance ?? nameFallback?.remaining ?? -1);
                            if (nameFallback && nameFallbackRem > 0) {
                                paidDed = nameFallback;
                            }
                            // If nameFallbackRem === 0 → different completed deduction → skip cascade,
                            // prevBalance will use DB default (total_amount - collected_amount)
                        }

                        if (paidDed) {
                            const rem = parseFloat(paidDed.remaining_balance ?? paidDed.remaining ?? paidDed.remainingBalance ?? -1);
                            if (rem >= 0) {
                                prevBalance = rem;
                            }
                        }
                    }
                }

                const remainingAfter = hasTarget
                    ? Math.max(0, (prevBalance || 0) - effectiveAmount)
                    : null;

                // Keep all active deductions visible in billing (even if capped to 0 this period),
                // matching analyzer behavior and preventing "only one deduction" display issues.
                if (amount > 0 || hasTarget) {
                    deductionDetails.push({
                        id: deduction.id,
                        name: deductionName,
                        type: deduction.deduction_type,
                        rate: deduction.amount,
                        prevBalance: hasTarget && prevBalance !== null ? prevBalance.toFixed(2) : '',
                        currentAddition: '',
                        deducted: formatMoney(effectiveAmount),
                        remaining: hasTarget && remainingAfter !== null
                            ? formatMoney(remainingAfter, 2, { truncate: true })
                            : ''
                    });
                }
            });
        } // end else (dynamic calculation)

        const netAmount = totalAmount - totalDeduction;

        // ── BUILD THEV ENTRIES ARRAY (supports multiple Thev schemes per farmer) ────────────
        // Each active Thev account gets its own entry: { schemeName, balance, periodDeduction }
        const farmerThevAccts2 = thevAccounts.filter(a =>
            String(a.farmer_id) === String(farmer.id) &&
            a.status === 'active' &&
            (!a.start_date || a.start_date <= endDate)
        );
        const farmerTxns2 = txnMap[String(farmer.id)] || {};

        // Read localStorage show_balance_in_bill prefs once for this dairy
        let thevShowBalPrefs = {};
        try {
            thevShowBalPrefs = JSON.parse(localStorage.getItem(`thev_show_bal_${user?.dairy_id}`) || '{}');
        } catch(e) { /* ignore */ }

        const thevEntries = farmerThevAccts2.map(thev => {
            const accountId = String(thev.id);
            const thevRate2 = parseFloat(thev.rate) || 0;
            const thevType2 = thev.thev_type || 'per_liter';
            // historicalBal = deposits_up_to_endDate − all_refunds_ever (from fixed API).
            // This gives per-period balance: June bill < July bill (different per period) ✅
            // and correctly reflects that any refunds have been given back ✅.
            const historicalBal = (historicalThevBalances[String(farmer.id)] || {})[accountId];
            const bal = historicalBal !== undefined
                ? historicalBal
                : Math.max(0, parseFloat(thev.current_balance || 0));
            // periodDed: use rate × totalQty rounded to 3 decimal places (single multiply)
            const periodDed = thevType2 === 'per_liter'
                ? Math.round(thevRate2 * totalQuantity * 1000) / 1000
                : parseFloat(farmerTxns2[accountId] || 0);
            // Correct the cumulative balance: subtract DB period deposits (per-collection
            // rounded) and add the correctly-computed period total (rate × totalQty).
            const dbPeriodAmt = parseFloat(farmerTxns2[accountId] || 0);
            const correctedBal = thevType2 === 'per_liter'
                ? Math.max(0, Math.round((bal - dbPeriodAmt + periodDed) * 1000) / 1000)
                : Math.max(0, bal);
            // deductionDetails entry for this account (has the actual effectiveThev amount)
            const dedEntry = deductionDetails.find(d => d.id === `thev_${thev.id}`);
            const effectiveDed = dedEntry ? parseFloat(dedEntry.deducted || 0) : periodDed;

            // Check localStorage pref: if show_balance_in_bill is false, mark hidden
            const masterId = String(thev.thev_master_id || '');
            const showInBill = masterId in thevShowBalPrefs ? thevShowBalPrefs[masterId] : true;

            return {
                schemeName: dedEntry?.name || `एकुण (${thev.thev_name || 'ठेव'})`,
                balance: correctedBal.toFixed(3),
                periodDeduction: effectiveDed.toFixed(3),
                show_in_bill: showInBill
            };
        }).filter(e => (parseFloat(e.balance) > 0 || parseFloat(e.periodDeduction) > 0) && e.show_in_bill !== false);

        // Backward-compat totals (used by older render paths)
        const farmerThevBalance = thevEntries.reduce((s, e) => s + parseFloat(e.balance), 0);
        const thevPeriodDeduction = thevEntries.reduce((s, e) => s + parseFloat(e.periodDeduction), 0);
        const thevSchemeName = thevEntries.length === 1 ? thevEntries[0].schemeName : 'ठेव';
        // ─────────────────────────────────────────────────────────────────────────────────────

        // Classify dominant milk type (Buffalo if buffaloQty >= cowQty, else Cow)
        let _buffaloQty = 0, _cowQty = 0;
        farmerCollections.forEach(col => {
            const q = parseFloat(col.quantity || 0);
            const mt = String(col.milk_type || '').toLowerCase();
            if (mt === 'buffalo') _buffaloQty += q;
            else _cowQty += q;
        });
        const milkType = (_buffaloQty === 0 && _cowQty === 0) ? 'Cow'
            : (_buffaloQty >= _cowQty ? 'Buffalo' : 'Cow');

        return {
            farmer_id: farmer.id,
            farmer_code: farmer.code,
            farmer_name: farmer.name,
            phone: farmer.phone,
            milkType: milkType,
            total_quantity: totalQuantity.toFixed(3),
            total_amount: totalAmount.toFixed(2),
            total_deduction: totalDeduction.toFixed(2),
            net_amount: netAmount.toFixed(2),
            thev_total_balance: farmerThevBalance.toFixed(2),
            thev_period_deduction: thevPeriodDeduction.toFixed(2),
            thev_scheme_name: thevSchemeName,
            thev_entries: thevEntries,          // ← NEW: array for multi-Thev support
            collection_count: farmerCollections.length,
            collections: farmerCollections.sort((a, b) => a.date.localeCompare(b.date)),
            deduction_details: deductionDetails
        };
    };

    const filteredBillData = billData.filter(bill => {
        const term = searchTerm.toLowerCase();
        const matchesSearch = (
            bill.farmer_name.toLowerCase().includes(term) ||
            bill.farmer_code.toString().includes(term)
        );
        if (!matchesSearch) return false;

        // Paid/Unpaid filter
        if (paidFilter === 'paid') {
            if (!billPayments.some(p => p.farmer_id === bill.farmer_id)) return false;
        }
        if (paidFilter === 'unpaid') {
            if (billPayments.some(p => p.farmer_id === bill.farmer_id)) return false;
        }

        // Milk type filter
        if (milkTypeFilter === 'cow') {
            if (bill.milkType !== 'Cow') return false;
        }
        if (milkTypeFilter === 'buffalo') {
            if (bill.milkType !== 'Buffalo') return false;
        }

        return true;
    });

    // === NEW: Deduction Override Helpers (mirroring mobile app) ===
    const getEffectiveDeductions = (bill, overrides = {}) => {
        if (!bill || !bill.deduction_details) return { deductions: [], totalDeduction: 0, netAmount: parseFloat(bill?.total_amount || 0) };
        const grossAmount = parseFloat(bill.total_amount || 0);
        let runningDeduction = 0;
        const effective = [];

        const orderedDetails = [...(bill.deduction_details || [])].sort((a, b) => {
            // ठेव entries ला नेहमी प्रथम priority — पशुखाद्य/इतर कपातांपूर्वी
            const aThev = a?.type === 'thev';
            const bThev = b?.type === 'thev';
            if (aThev !== bThev) return aThev ? -1 : 1;

            // Target-balance deductions (मागील बाकी असलेले) शेवटी
            const aTarget = !!(a?.prevBalance && parseFloat(a.prevBalance) > 0);
            const bTarget = !!(b?.prevBalance && parseFloat(b.prevBalance) > 0);
            if (aTarget !== bTarget) return aTarget ? 1 : -1;
            return (Number(a?.id) || 0) - (Number(b?.id) || 0);
        });

        orderedDetails.forEach(d => {
            const override = overrides[d.id] || {};
            const isEnabled = override.enabled !== undefined ? override.enabled : true;
            if (!isEnabled) {
                effective.push({ ...d, effectiveAmount: 0, isEnabled: false, isCustom: false });
                return;
            }

            let amount = override.customAmount !== null && override.customAmount !== undefined
                ? parseFloat(override.customAmount)
                : parseFloat(d.deducted || 0);

            // Cap at remaining bill balance
            const availableBalance = Math.max(0, grossAmount - runningDeduction);
            amount = Math.min(amount, availableBalance);
            amount = d?.type === 'thev'
                ? Math.round(amount * 1000) / 1000
                : Math.round(amount * 100) / 100;

            runningDeduction += amount;
            effective.push({
                ...d,
                effectiveAmount: amount,
                isEnabled: true,
                isCustom: override.customAmount !== null && override.customAmount !== undefined
            });
        });

        return {
            deductions: effective,
            totalDeduction: runningDeduction,
            netAmount: Math.round((grossAmount - runningDeduction) * 100) / 100
        };
    };

    const openBillModal = (bill) => {
        setSelectedBill(bill);
        // Initialize overrides: all enabled, no custom amounts
        const initialOverrides = {};
        (bill.deduction_details || []).forEach(d => {
            initialOverrides[d.id] = { enabled: true, customAmount: null };
        });
        setDeductionOverrides(initialOverrides);
        setEditingDeduction(null);
        setTempAmount('');
        setShowBillModal(true);
    };

    const toggleDeductionEnabled = (deductionId) => {
        setDeductionOverrides(prev => ({
            ...prev,
            [deductionId]: {
                ...prev[deductionId],
                enabled: !(prev[deductionId]?.enabled !== false)
            }
        }));
    };

    const applyCustomAmount = (deductionId) => {
        const val = parseFloat(tempAmount);
        if (isNaN(val) || val < 0) {
            setEditingDeduction(null);
            return;
        }
        setDeductionOverrides(prev => ({
            ...prev,
            [deductionId]: {
                ...prev[deductionId],
                customAmount: val
            }
        }));
        setEditingDeduction(null);
        setTempAmount('');
    };

    const resetCustomAmount = (deductionId) => {
        setDeductionOverrides(prev => ({
            ...prev,
            [deductionId]: {
                ...prev[deductionId],
                customAmount: null
            }
        }));
    };

    // Build a modified bill object with effective deductions applied (for PDF/export)
    const getBillWithOverrides = (bill) => {
        if (!bill) return bill;
        const { deductions: effDeds, totalDeduction, netAmount } = getEffectiveDeductions(bill, deductionOverrides);
        // Only include enabled deductions with amount > 0
        const newDetails = effDeds
            .filter(d => d.isEnabled && d.effectiveAmount > 0)
            .map(d => ({
                ...d,
                deducted: d.type === 'thev'
                    ? formatMoney(d.effectiveAmount, 3)
                    : formatMoney(d.effectiveAmount),
                remaining: d.prevBalance
                    ? formatMoney(Math.max(0, parseFloat(d.prevBalance) - d.effectiveAmount), 2, { truncate: true })
                    : ''
            }));
        return {
            ...bill,
            deduction_details: newDetails,
            total_deduction: totalDeduction.toFixed(2),
            net_amount: netAmount.toFixed(2)
        };
    };

    const generateBills = async () => {
        const { startDate, endDate } = getDateRange();

        if (!startDate || !endDate) {
            setBillData([]);
            return;
        }

        // Load actual Thev transactions for this billing period
        // This ensures rate changes mid-period are reflected correctly
        let txnMap = {};
        try {
            txnMap = await window.api.getThevTransactionsForBilling(user?.dairy_id, startDate, endDate);
            setThevTxnMap(txnMap);
        } catch (e) {
            console.warn('[Billing] Could not load Thev transactions, falling back to rate calc:', e);
        }

        // Load historical thev balances as-of endDate so that old bills show
        // the correct balance at that point in time, not today's live balance.
        let historicalThevBalances = {};
        try {
            historicalThevBalances = await window.api.getThevBalancesUpToDate(user?.dairy_id, endDate);
        } catch (e) {
            console.warn('[Billing] Could not load historical Thev balances, falling back to current_balance:', e);
        }

        const bills = farmers
            .map(farmer => calculateBillForFarmer(farmer, startDate, endDate, txnMap, historicalThevBalances))
            .filter(bill => bill !== null)
            .sort((a, b) => {
                // Numeric sort: 1, 2, 9, 10, 11 ... not lexicographic (1, 10, 11, 2, 9)
                const aNum = parseInt(a.farmer_code, 10);
                const bNum = parseInt(b.farmer_code, 10);
                if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
                return String(a.farmer_code).localeCompare(String(b.farmer_code));
            });

        setBillData(bills);
    };

    const getTotalSummary = () => {
        return filteredBillData.reduce(
            (acc, bill) => ({
                total_quantity: acc.total_quantity + parseFloat(bill.total_quantity || 0),
                total_amount: acc.total_amount + parseFloat(bill.total_amount || 0),
                total_deduction: acc.total_deduction + parseFloat(bill.total_deduction || 0),
                net_amount: acc.net_amount + parseFloat(bill.net_amount || 0)
            }),
            { total_quantity: 0, total_amount: 0, total_deduction: 0, net_amount: 0 }
        );
    };

    const toggleRowExpansion = (farmerId) => {
        setExpandedRows(prev =>
            prev.includes(farmerId)
                ? prev.filter(id => id !== farmerId)
                : [...prev, farmerId]
        );
    };

    const handleMarkPaid = async (bill, overrides = null) => {
        const activeOverrides = overrides || deductionOverrides;
        const { deductions: effectiveDeds, totalDeduction: effTotal, netAmount: effNet } = getEffectiveDeductions(bill, activeOverrides);

        if (effectiveDeds.filter(d => d.isEnabled).length === 0 && (bill.deduction_details || []).length > 0) {
            const confirmed = await showConfirm(
                t('billing.messages.noDeductionsConfirm'),
                t('billing.title'),
                t('common.yes', { defaultValue: 'Yes' }),
                t('common.no', { defaultValue: 'No' })
            );
            if (!confirmed) return;
        }

        const confirmedPaid = await showConfirm(
            t('billing.messages.paidConfirm'),
            t('billing.title'),
            t('billing.buttons.markPaid', { defaultValue: 'Mark as Paid' }),
            t('common.cancel', { defaultValue: 'Cancel' })
        );

        if (confirmedPaid) {
            setPayLoading(true);
            setPayLoadingMsg(`${bill.farmer_name || ''} करिता पेमेंट सेव्ह होत आहे...`);
            try {
                const { startDate, endDate } = getDateRange();

                // Build deduction list using effective (overridden) amounts
                const enabledDeds = effectiveDeds.filter(d => d.isEnabled && d.effectiveAmount > 0);

                // Thev entries have id="thev_123" (string) — they are NOT rows in farmer_deductions
                // and must be excluded from deductionList (which the RPC expects as bigint IDs).
                const isThevEntry = (d) => typeof d.id === 'string' && d.id.startsWith('thev_');

                const deductionList = enabledDeds
                    .filter(d => !isThevEntry(d))
                    .map(d => ({
                        id: d.id,
                        deducted: parseFloat(d.effectiveAmount)
                    }));

                // Clean deductions summary — only flat primitive fields for jsonb_to_recordset
                const deductionsSummary = enabledDeds.map(d => ({
                    id: isThevEntry(d) ? null : d.id,  // null for thev entries (no farmer_deductions row)
                    name: String(d.name || ''),
                    amount: parseFloat(d.effectiveAmount),
                    previous_balance: d.prevBalance ? String(d.prevBalance) : null,
                    remaining_balance: d.prevBalance ? formatMoney(parseFloat(d.prevBalance) - d.effectiveAmount, 2, { truncate: true }) : null
                }));

                await processBillPayment({
                    farmerId: bill.farmer_id,
                    startDate,
                    endDate,
                    amount: effNet,
                    deductions: deductionsSummary,
                    deductionList,
                    dairy_id: user?.dairy_id
                });

                showAlert(t('billing.messages.paidSuccess'), 'Success', 'success');
                setShowBillModal(false);
                setSelectedBill(null);
                fetchBillPayments();
                fetchAllBillPayments();
                loadInitialData();
            } catch (error) {
                console.error('Error processing bill payment:', error);
                showAlert(t('billing.messages.errorPayment') + " " + error.message, 'Error', 'error');
            } finally {
                setPayLoading(false);
                setPayLoadingMsg('');
            }
        }
    };

    const handleMarkUnpaid = async (bill) => {
        const confirmed = await showConfirm(
            t('billing.messages.unpaidConfirm'),
            t('billing.title'),
            t('billing.buttons.markUnpaid', { defaultValue: 'Mark as Unpaid' }),
            t('common.cancel', { defaultValue: 'Cancel' })
        );

        if (confirmed) {
            setPayLoading(true);
            setPayLoadingMsg(`${bill.farmer_name || ''} करिता रिवर्त होत आहे...`);
            try {
                const payment = billPayments.find(p => p.farmer_id === bill.farmer_id);
                if (!payment) {
                    showAlert('Payment record not found to revert.', 'Error', 'error');
                    return;
                }

                await revertBillPayment({
                    id: payment.id,
                    farmerId: bill.farmer_id,
                    startDate: payment.start_date,
                    endDate: payment.end_date,
                    deductions: payment.deductions,
                    dairy_id: user?.dairy_id
                });

                showAlert(t('billing.messages.unpaidSuccess'), 'Success', 'success');

                fetchBillPayments();
                fetchAllBillPayments();
                loadInitialData();
            } catch (error) {
                console.error('Error reverting bill payment:', error);
                showAlert(t('billing.messages.errorRevert') + " " + error.message, 'Error', 'error');
            } finally {
                setPayLoading(false);
                setPayLoadingMsg('');
            }
        }
    };



    const prepareBillData = (bill) => {
        const { startDate, endDate } = getDateRange();

        // Calculate billing days
        const start = new Date(startDate);
        const end = new Date(endDate);
        const billingDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

        // Process collections into a date-wise map
        const collectionsByDate = {};
        bill.collections.forEach(col => {
            const dateStr = col.date;
            if (!collectionsByDate[dateStr]) {
                collectionsByDate[dateStr] = { date: dateStr, morning: null, evening: null };
            }
            const shift = col.shift?.toLowerCase();
            if (shift === 'morning') {
                collectionsByDate[dateStr].morning = col;
            } else if (shift === 'evening') {
                collectionsByDate[dateStr].evening = col;
            }
        });

        // Convert map to sorted array
        const rows = Object.values(collectionsByDate).sort((a, b) => a.date.localeCompare(b.date));

        // Prepare Deductions (spread them across rows if needed, or just list them)
        const rowsWithDeductions = rows.map((row, index) => {
            if (bill.deduction_details && index < bill.deduction_details.length) {
                return { ...row, deduction: bill.deduction_details[index] };
            }
            return { ...row, deduction: null };
        });

        if (bill.deduction_details && bill.deduction_details.length > rows.length) {
            for (let i = rows.length; i < bill.deduction_details.length; i++) {
                rowsWithDeductions.push({
                    date: '',
                    morning: null,
                    evening: null,
                    deduction: bill.deduction_details[i]
                });
            }
        }

        // Calculate per-milk-type summaries
        let buffaloLiters = 0, buffaloFatSum = 0, buffaloSnfSum = 0, buffaloAmount = 0, buffaloCount = 0;
        let cowLiters = 0, cowFatSum = 0, cowSnfSum = 0, cowAmount = 0, cowCount = 0;
        let totalMorningLiters = 0, totalMorningAmount = 0;
        let totalEveningLiters = 0, totalEveningAmount = 0;

        bill.collections.forEach(col => {
            const qty = parseFloat(col.quantity || 0);
            const fat = parseFloat(col.fat || 0);
            const snf = parseFloat(col.snf || 0);
            const amt = parseFloat(col.amount || 0);

            if (col.milk_type === 'Buffalo') {
                buffaloLiters += qty;
                buffaloFatSum += fat * qty;
                buffaloSnfSum += snf * qty;
                buffaloAmount += amt;
                buffaloCount++;
            } else {
                cowLiters += qty;
                cowFatSum += fat * qty;
                cowSnfSum += snf * qty;
                cowAmount += amt;
                cowCount++;
            }

            if (col.shift === 'Morning') {
                totalMorningLiters += qty;
                totalMorningAmount += amt;
            } else {
                totalEveningLiters += qty;
                totalEveningAmount += amt;
            }
        });

        const milkTypeSummary = [];
        if (buffaloCount > 0) {
            milkTypeSummary.push({
                type: 'Buffalo',
                liters: buffaloLiters.toFixed(3),
                avgFat: (Math.floor(buffaloFatSum / buffaloLiters * 10) / 10).toFixed(1),
                avgSnf: (Math.floor(buffaloSnfSum / buffaloLiters * 10) / 10).toFixed(1),
                amount: buffaloAmount
            });
        }
        if (cowCount > 0) {
            milkTypeSummary.push({
                type: 'Cow',
                liters: cowLiters.toFixed(3),
                avgFat: (Math.floor(cowFatSum / cowLiters * 10) / 10).toFixed(1),
                avgSnf: (Math.floor(cowSnfSum / cowLiters * 10) / 10).toFixed(1),
                amount: cowAmount
            });
        }

        return {
            dairyName: user?.dairy_name || "",
            farmerCode: bill.farmer_code,
            farmerName: bill.farmer_name,
            billPeriod: `${new Date(startDate).toLocaleDateString('en-GB')} ${t('billing.billPrint.to')} ${new Date(endDate).toLocaleDateString('en-GB')}`,
            billDate: new Date().toLocaleDateString('en-GB'),
            billingDays: billingDays,
            rows: rowsWithDeductions,
            summary: {
                totalQty: bill.total_quantity,
                totalAmount: bill.total_amount,
                totalDeduction: bill.total_deduction,
                netAmount: bill.net_amount,
                morningLiters: totalMorningLiters.toFixed(3),
                morningAmount: totalMorningAmount.toFixed(2),
                eveningLiters: totalEveningLiters.toFixed(3),
                eveningAmount: totalEveningAmount.toFixed(2),
                // Deduction totals for the totals row
                deductionTotalPrev: (bill.deduction_details || []).reduce((sum, d) => sum + (parseFloat(d.prevBalance) || 0), 0).toFixed(2),
                deductionTotalDeducted: bill.total_deduction,
                deductionTotalRemaining: (bill.deduction_details || []).reduce((sum, d) => sum + (parseFloat(d.remaining) || 0), 0).toFixed(2),
                thevTotalBalance: bill.thev_total_balance || '0.00',
                thevPeriodDeduction: bill.thev_period_deduction || '0.00', // Thev deducted THIS period
                thevSchemeName: bill.thev_scheme_name || 'ठेव',
                thevEntries: bill.thev_entries || []   // ← per-scheme entries for multi-Thev
            },
            milkTypeSummary: milkTypeSummary,
            endDate: new Date(endDate).toLocaleDateString('en-GB'),
            fileName: `Bill_${bill.farmer_code}_${startDate}_to_${endDate}`,
            title: t('billing.billPrint.title'),
            originalBill: bill
        };
    };



    const exportIndividualBill = (bill, viewMode = false) => {
        console.log("exportIndividualBill called", { viewMode });
        try {
            const prepared = prepareBillData(bill);

            const defaultSettings = {
                showFatColumn: true,
                showSnfColumn: true,
                showRateColumn: true,
                showAmountColumn: true,
                showTypeColumn: true,
                showDecimals: true
            };

            let printSettings = { ...defaultSettings };
            let printMode = 'normal';
            let billFormat = 'format2';
            try {
                const storedSettings = localStorage.getItem('billingPrintSettings');
                if (storedSettings) {
                    const parsed = JSON.parse(storedSettings);
                    printSettings = { ...defaultSettings, ...parsed };
                    printMode = parsed.printMode || 'normal';
                }
                const storedFormat = localStorage.getItem('billFormat');
                if (storedFormat) billFormat = storedFormat;
            } catch (e) {
                console.error("Error checking print mode / billing print settings:", e);
            }

            // format1 = thermal, format2 = A4 standard, format3 = Marathi
            if (billFormat === 'format1' || printMode === 'thermal') {
                setThermalData({ ...prepared, printSettings });
                setShowThermalModal(true);
                return;
            }

            const chunks = [[prepared]]; // Single page, single bill

            setPdfLoading(true);
            pdfRef.current = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4',
                compress: true
            });

            setPdfJob({
                type: 'bulk',
                chunks: chunks,
                currentChunk: 0,
                previews: [],
                orientation: 'portrait',
                viewMode: viewMode,
                fileName: `Bill_${prepared.farmerCode}`,
                printSettings: printSettings,
                billFormat: billFormat
            });
        } catch (err) {
            console.error("Error in exportIndividualBill:", err);
            showAlert("Error preparing bill: " + err.message, 'Error', 'error');
            setPdfLoading(false);
        }
    };

    const handleViewBill = (bill) => {
        openBillModal(bill);
    };



    const { startDate, endDate } = getDateRange();
    const summary = getTotalSummary();

    return (
        <div style={{ color: 'black',  padding: '16px 32px', maxWidth: '1600px', margin: '0 auto', background: 'transparent', minHeight: '100%'  }}>
            {/* Header */}
            <div style={{ color: 'black', 
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
                        color: '#1e293b',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                    }}>
                        <FileText size={28} />
                        {t('billing.title')}
                    </h1>
                    <p style={{ fontSize: '15px', color: '#64748b', margin: 0 }}>{t('billing.subtitle')}</p>
                </div>
            </div>

            {/* Controls Card */}
            <div style={{ color: 'black', 
                background: 'white',
                borderRadius: '20px',
                padding: '28px',
                marginBottom: '28px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.05)'
             }}>
                <div style={{ color: 'black',  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px', alignItems: 'end'  }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>{t('farmers.searchPlaceholder', { defaultValue: 'Search Farmer' })}</label>
                        <div style={{ color: 'black',  position: 'relative'  }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                            <input
                                type="text"
                                placeholder={t('farmers.searchPlaceholder', { defaultValue: 'Search by name or code' })}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '12px 16px 12px 40px',
                                    borderRadius: '12px',
                                    border: '2px solid #e5e7eb',
                                    fontSize: '15px',
                                    transition: 'all 0.2s',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>{t('billing.selectMonth')}</label>
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                borderRadius: '12px',
                                border: '2px solid #e5e7eb',
                                fontSize: '15px',
                                transition: 'all 0.2s',
                                outline: 'none'
                            }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>{t('billing.dateRange')}</label>
                        <select
                            value={dateRangeType}
                            onChange={(e) => setDateRangeType(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                borderRadius: '12px',
                                border: '2px solid #e5e7eb',
                                fontSize: '15px',
                                transition: 'all 0.2s',
                                outline: 'none'
                            }}
                        >
                            <option value="1-10">{t('billing.ranges.first')}</option>
                            <option value="11-20">{t('billing.ranges.second')}</option>
                            <option value="21-30">{t('billing.ranges.third')}</option>
                            <option value="custom">{t('billing.ranges.custom')}</option>
                        </select>
                    </div>

                    {dateRangeType === 'custom' && (
                        <>
                            <div>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>{t('billing.startDate')}</label>
                                <input
                                    type="date"
                                    value={customStartDate}
                                    onChange={(e) => setCustomStartDate(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        borderRadius: '12px',
                                        border: '2px solid #e5e7eb',
                                        fontSize: '15px',
                                        transition: 'all 0.2s',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>{t('billing.endDate')}</label>
                                <input
                                    type="date"
                                    value={customEndDate}
                                    onChange={(e) => setCustomEndDate(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        borderRadius: '12px',
                                        border: '2px solid #e5e7eb',
                                        fontSize: '15px',
                                        transition: 'all 0.2s',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                        </>
                    )}

                    <div style={{ color: 'black',  display: 'flex', gap: '12px', alignItems: 'center'  }}>
                        <div style={{ color: 'black',  display: 'flex', gap: '1px', background: '#e2e8f0', padding: '2px', borderRadius: '14px', border: '1px solid #e2e8f0'  }}>
                            <button
                                onClick={() => handleExport(false)}
                                disabled={loading || pdfLoading}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    padding: '10px 24px', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                    color: 'white', border: 'none', borderRadius: '12px 4px 4px 12px',
                                    cursor: (loading || pdfLoading) ? 'not-allowed' : 'pointer',
                                    fontSize: '14px', fontWeight: '700',
                                    opacity: (loading || pdfLoading) ? 0.7 : 1, transition: 'all 0.2s',
                                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)'
                                }}
                            >
                                <Download size={18} />
                                {pdfLoading ? t('common.loading') : t('billing.buttons.downloadRegister')}
                            </button>
                            <button
                                onClick={() => handleExport(true)}
                                disabled={loading || pdfLoading}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    padding: '10px 16px', background: 'white', color: '#4f46e5',
                                    border: 'none', borderRadius: '4px 12px 12px 4px',
                                    cursor: (loading || pdfLoading) ? 'not-allowed' : 'pointer',
                                    fontSize: '14px', fontWeight: '600', transition: 'all 0.2s'
                                }}
                            >
                                <Eye size={18} />
                            </button>
                        </div>

                        <button
                            onClick={() => handleViewAllBills(false)}
                            disabled={loading || pdfLoading}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                padding: '11px 24px', background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '14px',
                                cursor: (loading || pdfLoading) ? 'not-allowed' : 'pointer',
                                fontSize: '14px', fontWeight: '600',
                                opacity: (loading || pdfLoading) ? 0.7 : 1, transition: 'all 0.2s',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                            }}
                        >
                            <FileText size={18} />
                            {t('billing.buttons.downloadAllBills')}
                        </button>
                    </div>


                </div>

                {
                    startDate && endDate && (
                        <div style={{
                            marginTop: '20px',
                            padding: '12px 16px',
                            background: '#f3f4f6',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            color: 'black',
                            fontSize: '14px',
                            fontWeight: '500'
                        }}>
                            <Calendar size={16} />
                            <span>{t('billing.period')}: {new Date(startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} - {new Date(endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                    )
                }
            </div >

            {/* Metric Cards */}
            < div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px', marginBottom: '32px' }
            }>
                {/* Total Farmers */}
                < div style={{
                    background: 'white',
                    borderRadius: '16px',
                    padding: '24px',
                    border: '1px solid black',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                    <div style={{ color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px'  }}>
                        <div style={{ 
                            width: '56px',
                            height: '56px',
                            borderRadius: '14px',
                            background: '#c7d2fe',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#4338ca'
                         }}>
                            <Users size={28} />
                        </div>
                    </div>
                    <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 8px 0', fontWeight: '500' }}>{t('billing.metrics.totalFarmers')}</p>
                    <p style={{ fontSize: '36px', fontWeight: '700', color: '#111827', margin: '0 0 4px 0' }}>{billData.length}</p>
                    <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>{t('billing.metrics.inPeriod')}</p>
                </div >

                {/* Total Quantity */}
                < div style={{
                    background: 'white',
                    borderRadius: '16px',
                    padding: '24px',
                    border: '1px solid black',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                    <div style={{ color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px'  }}>
                        <div style={{ 
                            width: '56px',
                            height: '56px',
                            borderRadius: '14px',
                            background: '#fce7f3',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#be185d'
                         }}>
                            <Droplets size={28} />
                        </div>
                    </div>
                    <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 8px 0', fontWeight: '500' }}>{t('billing.metrics.quantity')}</p>
                    <p style={{ fontSize: '36px', fontWeight: '700', color: '#111827', margin: '0 0 4px 0' }}>{summary.total_quantity.toFixed(3)} L</p>
                    <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>{t('billing.metrics.collected')}</p>
                </div >

                {/* Gross Amount */}
                < div style={{
                    background: 'white',
                    borderRadius: '16px',
                    padding: '24px',
                    border: '1px solid black',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                    <div style={{ color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px'  }}>
                        <div style={{ 
                            width: '56px',
                            height: '56px',
                            borderRadius: '14px',
                            background: '#fed7aa',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#c2410c'
                         }}>
                            <IndianRupee size={28} />
                        </div>
                    </div>
                    <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 8px 0', fontWeight: '500' }}>{t('billing.metrics.grossAmount')}</p>
                    <p style={{ fontSize: '36px', fontWeight: '700', color: '#111827', margin: '0 0 4px 0' }}>₹{summary.total_amount.toFixed(2)}</p>
                    <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>{t('billing.metrics.beforeDeductions')}</p>
                </div >

                {/* Net Payable */}
                < div style={{
                    background: 'white',
                    borderRadius: '16px',
                    padding: '24px',
                    border: '1px solid black',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                    <div style={{ color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px'  }}>
                        <div style={{ 
                            width: '56px',
                            height: '56px',
                            borderRadius: '14px',
                            background: '#d1fae5',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#047857'
                         }}>
                            <IndianRupee size={28} />
                        </div>
                    </div>
                    <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 8px 0', fontWeight: '500' }}>{t('billing.metrics.netPayable')}</p>
                    <p style={{ fontSize: '36px', fontWeight: '700', color: '#059669', margin: '0 0 4px 0' }}>₹{summary.net_amount.toFixed(2)}</p>
                    <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>{t('billing.metrics.afterDeductions')}</p>
                </div >
            </div >

            {/* Filter Tabs — Payment Status + Milk Type */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>

                {/* ── Payment Status ── */}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {['all', 'unpaid', 'paid'].map(filter => (
                        <button
                            key={filter}
                            onClick={() => setPaidFilter(filter)}
                            style={{
                                padding: '8px 18px',
                                borderRadius: '12px',
                                border: paidFilter === filter ? 'none' : '1px solid #e2e8f0',
                                background: paidFilter === filter
                                    ? (filter === 'paid' ? 'linear-gradient(135deg, #10b981, #059669)' :
                                       filter === 'unpaid' ? 'linear-gradient(135deg, #f59e0b, #d97706)' :
                                       'linear-gradient(135deg, #667eea, #764ba2)')
                                    : 'white',
                                color: paidFilter === filter ? 'white' : '#6b7280',
                                fontSize: '14px', fontWeight: '600', cursor: 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: paidFilter === filter ? '0 2px 8px rgba(0,0,0,0.15)' : 'none'
                            }}
                        >
                            {filter === 'all' ? t('billing.filter.all') :
                             filter === 'paid' ? `✓ ${t('billing.filter.paid')}` :
                             `○ ${t('billing.filter.unpaid')}`}
                            {filter === 'all' && ` (${billData.length})`}
                            {filter === 'paid' && ` (${billData.filter(b => billPayments.some(p => p.farmer_id === b.farmer_id)).length})`}
                            {filter === 'unpaid' && ` (${billData.filter(b => !billPayments.some(p => p.farmer_id === b.farmer_id)).length})`}
                        </button>
                    ))}
                </div>

                {/* divider */}
                <div style={{ width: '1px', height: '32px', background: '#e2e8f0', margin: '0 4px' }} />

                {/* ── Milk Type ── */}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {[
                        { key: 'all',     label: t('billing.filter.allMilk'),     emoji: '🥛', grad: 'linear-gradient(135deg,#667eea,#764ba2)' },
                        { key: 'buffalo', label: t('billing.filter.buffalo'),     emoji: '🐃', grad: 'linear-gradient(135deg,#3b82f6,#1d4ed8)' },
                        { key: 'cow',     label: t('billing.filter.cow'),         emoji: '🐄', grad: 'linear-gradient(135deg,#f59e0b,#d97706)' },
                    ].map(({ key, label, emoji, grad }) => {
                        const count = key === 'all'
                            ? billData.length
                            : billData.filter(b => b.milkType === (key === 'cow' ? 'Cow' : 'Buffalo')).length;
                        const active = milkTypeFilter === key;
                        return (
                            <button
                                key={key}
                                onClick={() => setMilkTypeFilter(key)}
                                style={{
                                    padding: '8px 14px',
                                    borderRadius: '12px',
                                    border: active ? 'none' : '1px solid #e2e8f0',
                                    background: active ? grad : 'white',
                                    color: active ? 'white' : '#6b7280',
                                    fontSize: '14px', fontWeight: '600', cursor: 'pointer',
                                    transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '5px',
                                    boxShadow: active ? '0 2px 8px rgba(0,0,0,0.15)' : 'none'
                                }}
                            >
                                <span>{emoji}</span>
                                {label} ({count})
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Data Table */}
            < div style={{
                background: 'white',
                borderRadius: '20px',
                padding: '0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.05)',
                overflow: 'hidden'
            }}>
                {
                    loading ? (
                        <div style={{ color: 'black',  padding: '60px'  }} > <Loader /></div >
                    ) : filteredBillData.length === 0 ? (
                        <div style={{ color: 'black',  padding: '60px', textAlign: 'center'  }}>
                            <FileText size={48} style={{ margin: '0 auto 16px', opacity: 0.2, color: '#9ca3af' }} />
                            <p style={{ color: '#9ca3af', fontSize: '15px' }}>{t('billing.noData')}</p>
                        </div>
                    ) : (
                        <div style={{ color: 'black',  overflowX: 'auto'  }}>
                            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                                <thead>
                                    <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
                                        <th style={{ color: '#1e293b', padding: '18px 24px', textAlign: 'left', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{t('billing.table.code')}</th>
                                        <th style={{ color: '#1e293b', padding: '18px 24px', textAlign: 'left', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{t('billing.table.name')}</th>
                                        <th style={{ color: '#1e293b', padding: '18px 24px', textAlign: 'left', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{t('billing.table.phone')}</th>
                                        <th style={{ color: '#1e293b', padding: '18px 24px', textAlign: 'left', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{t('billing.table.qty')}</th>
                                        <th style={{ color: '#1e293b', padding: '18px 24px', textAlign: 'center', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{t('billing.table.collections')}</th>
                                        <th style={{ color: '#1e293b', padding: '18px 24px', textAlign: 'right', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{t('billing.table.gross')}</th>
                                        <th style={{ color: '#1e293b', padding: '18px 24px', textAlign: 'right', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{t('billing.table.deductions')}</th>
                                        <th style={{ color: '#1e293b', padding: '18px 24px', textAlign: 'right', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{t('billing.table.net')}</th>
                                        <th style={{ color: '#1e293b', padding: '18px 24px', textAlign: 'center', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{t('billing.table.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredBillData.map((bill, index) => (
                                        <React.Fragment key={bill.farmer_id}>
                                            <tr style={{
                                                borderBottom: '1px solid #f3f4f6',
                                                transition: 'background 0.2s',
                                                background: index % 2 === 0 ? 'white' : '#fafafa'
                                            }}>
                                                <td style={{ padding: '20px 24px' }}>
                                                    <div style={{ color: '#6b7280', display: 'flex', alignItems: 'center', gap: '12px'  }}>
                                                        <button
                                                            onClick={() => toggleRowExpansion(bill.farmer_id)}
                                                            style={{
                                                                background: 'none',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                padding: '4px',
                                                                color: '#6b7280', display: 'flex', alignItems: 'center'
                                                            }}
                                                        >
                                                            {expandedRows.includes(bill.farmer_id) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                                        </button>
                                                        <span style={{ fontWeight: '700', color: '#111827', fontSize: '15px'  }}>{formatLocaleNum(bill.farmer_code)}</span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '20px 24px', fontSize: '15px', fontWeight: '600', color: '#111827' }}>{bill.farmer_name}</td>
                                                <td style={{ padding: '20px 24px', fontSize: '14px', color: '#6b7280' }}>{formatLocaleNum(bill.phone)}</td>
                                                <td style={{ padding: '20px 24px', fontSize: '15px', fontWeight: '600', color: '#111827' }}>{formatLocaleNum(bill.total_quantity)} L</td>
                                                <td style={{ color: 'black',  padding: '20px 24px', textAlign: 'center'  }}>
                                                    <span style={{ padding: '6px 14px', background: '#ede9fe', color: '#5b21b6',
                                                        borderRadius: '12px',
                                                        fontSize: '14px',
                                                        fontWeight: '600'
                                                     }}>{formatLocaleNum(bill.collection_count)}</span>
                                                </td>
                                                <td style={{ padding: '20px 24px', fontSize: '16px', fontWeight: '700', color: '#111827', textAlign: 'right' }}>₹{formatLocaleNum(bill.total_amount)}</td>
                                                <td style={{ padding: '20px 24px', fontSize: '15px', fontWeight: '700', color: '#dc2626', textAlign: 'right'  }}>
                                                    {bill.total_deduction > 0 ? `₹${formatLocaleNum(bill.total_deduction)}` : '-'}
                                                </td>
                                                <td style={{ padding: '20px 24px', fontSize: '17px', fontWeight: '700', color: '#059669', textAlign: 'right'  }}>₹{formatLocaleNum(bill.net_amount)}</td>
                                                <td style={{ padding: '20px 24px' }}>
                                                    <div style={{ color: 'black',  display: 'flex', gap: '8px', justifyContent: 'center'  }}>
                                                        <button
                                                            onClick={() => handleViewBill(bill)}
                                                            style={{
                                                                padding: '10px',
                                                                background: '#f3f4f6',
                                                                border: 'none',
                                                                borderRadius: '10px',
                                                                cursor: 'pointer',
                                                                color: '#4f46e5',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                transition: 'all 0.2s'
                                                            }}
                                                            title={t('billing.tooltips.view', { defaultValue: 'View Bill' })}
                                                        >
                                                            <Eye size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => exportIndividualBill(bill)}
                                                            style={{
                                                                padding: '10px',
                                                                background: '#f3f4f6',
                                                                border: 'none',
                                                                borderRadius: '10px',
                                                                cursor: 'pointer',
                                                                color: '#6b7280', display: 'flex', alignItems: 'center',
                                                                transition: 'all 0.2s'
                                                            }}
                                                            title={t('billing.tooltips.export')}
                                                        >
                                                            <Download size={18} />
                                                        </button>
                                                        {billPayments.some(p => p.farmer_id === bill.farmer_id) ? (
                                                            <button
                                                                onClick={() => handleMarkUnpaid(bill)}
                                                                style={{
                                                                    padding: '10px',
                                                                    background: '#10b981',
                                                                    border: 'none',
                                                                    borderRadius: '10px',
                                                                    cursor: 'pointer',
                                                                    color: 'white',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    transition: 'all 0.2s'
                                                                }}
                                                                title={t('billing.tooltips.markUnpaid')}
                                                            >
                                                                <CheckCircle size={18} />
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleMarkPaid(bill)}
                                                                style={{
                                                                    padding: '10px',
                                                                    background: '#f3f4f6',
                                                                    border: '2px solid #10b981',
                                                                    borderRadius: '10px',
                                                                    cursor: 'pointer',
                                                                    color: '#10b981',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    transition: 'all 0.2s'
                                                                }}
                                                                title={t('billing.tooltips.markPaid')}
                                                            >
                                                                <CheckCircle size={18} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                            {
                                                expandedRows.includes(bill.farmer_id) && (
                                                    <tr style={{ background: '#f9fafb' }}>
                                                        <td colSpan="9" style={{ color: 'black',  padding: '24px'  }}>
                                                            <h4 style={{ fontSize: '16px', fontWeight: '700', color: 'black', marginBottom: '16px' }}>{t('billing.details.title')}</h4>
                                                            <div style={{ color: 'black',  overflowX: 'auto'  }}>
                                                                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, background: 'white', borderRadius: '12px', overflow: 'hidden' }}>
                                                                    <thead>
                                                                        <tr style={{ background: '#f3f4f6' }}>
                                                                            <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'black' }}>{t('billing.details.date')}</th>
                                                                            <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'black' }}>{t('billing.details.shift')}</th>
                                                                            <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'black' }}>{t('billing.details.type')}</th>
                                                                            <th style={{ padding: '14px 16px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: 'black' }}>{t('billing.details.qty')}</th>
                                                                            <th style={{ padding: '14px 16px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: 'black' }}>{t('billing.details.fat')}</th>
                                                                            <th style={{ padding: '14px 16px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: 'black' }}>{t('billing.details.snf')}</th>
                                                                            <th style={{ padding: '14px 16px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: 'black' }}>{t('billing.details.rate')}</th>
                                                                            <th style={{ padding: '14px 16px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: 'black' }}>{t('billing.details.amount')}</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {bill.collections.map((col, idx) => (
                                                                            <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                                                <td style={{ padding: '14px 16px', fontSize: '14px', color: 'black' }}>{new Date(col.date).toLocaleDateString('en-IN')}</td>
                                                                                <td style={{ color: 'black',  padding: '14px 16px'  }}>
                                                                                    <span style={{ 
                                                                                        padding: '4px 10px',
                                                                                        background: col.shift === 'Morning' ? '#fef3c7' : '#dbeafe',
                                                                                        color: col.shift === 'Morning' ? '#92400e' : '#1e40af',
                                                                                        borderRadius: '8px',
                                                                                        fontSize: '13px',
                                                                                        fontWeight: '500'
                                                                                     }}>{col.shift}</span>
                                                                                </td>
                                                                                <td style={{ padding: '14px 16px', fontSize: '14px', color: 'black' }}>{col.milk_type}</td>
                                                                                <td style={{ padding: '14px 16px', fontSize: '14px', color: 'black', textAlign: 'right', fontWeight: '600' }}>{formatLocaleNum(col.quantity)}</td>
                                                                                <td style={{ padding: '14px 16px', fontSize: '14px', color: 'black', textAlign: 'right' }}>{formatLocaleNum(col.fat)}</td>
                                                                                <td style={{ padding: '14px 16px', fontSize: '14px', color: 'black', textAlign: 'right' }}>{formatLocaleNum(col.snf)}</td>
                                                                                <td style={{ padding: '14px 16px', fontSize: '14px', color: 'black', textAlign: 'right' }}>₹{formatLocaleNum(col.rate)}</td>
                                                                                <td style={{ padding: '14px 16px', fontSize: '15px', color: 'black', textAlign: 'right', fontWeight: '700' }}>₹{formatLocaleNum(col.amount)}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )
                                            }
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
            </div >
            {/* New Bill Print Template */}
            {
                printBillData && (
                    <div id="billing-report-template" style={{
                        position: 'absolute', top: '-9999px', left: '-9999px',
                        width: '297mm',
                        minHeight: '210mm',
                        background: 'white',
                        color: 'black',
                        fontFamily: '"Noto Sans", sans-serif',
                        padding: '20px',
                        fontSize: '12px'
                    }}>
                        {/* Bill Header */}
                        <div style={{ color: 'black',  textAlign: 'center', marginBottom: '10px', borderBottom: '1px solid black', paddingBottom: '5px'  }}>
                            <h1 style={{ margin: '0', fontSize: '20px', fontWeight: 'bold' }}>{printBillData.dairyName}</h1>
                            <div style={{ color: 'black',  display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '14px', fontWeight: 'bold'  }}>
                                <span>{t('farmers.table.code')}: {printBillData.farmerCode} &nbsp;&nbsp; {printBillData.farmerName}</span>
                                <span>{t('billing.billPrint.title')} &nbsp;&nbsp; {printBillData.billPeriod}</span>
                                <span>{t('billing.billPrint.date')}: {printBillData.billDate}</span>
                            </div>
                        </div>

                        {/* Bill Table */}
                        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, borderTop: '1px solid black', borderLeft: '1px solid black', fontSize: '11px', tableLayout: 'fixed' }}>
                            <colgroup>
                                <col style={{ width: '44px' }} />  {/* Date */}
                                <col style={{ width: '38px' }} />  {/* M Type */}
                                <col style={{ width: '32px' }} />  {/* M Fat */}
                                <col style={{ width: '32px' }} />  {/* M SNF */}
                                <col style={{ width: '34px' }} />  {/* M Rate */}
                                <col style={{ width: '50px' }} />  {/* M Amount */}
                                <col style={{ width: '38px' }} />  {/* E Type */}
                                <col style={{ width: '32px' }} />  {/* E Fat */}
                                <col style={{ width: '32px' }} />  {/* E SNF */}
                                <col style={{ width: '34px' }} />  {/* E Rate */}
                                <col style={{ width: '50px' }} />  {/* E Amount */}
                                <col style={{ width: '90px' }} />  {/* Ded Name */}
                                <col style={{ width: '48px' }} />  {/* Initial */}
                                <col style={{ width: '48px' }} />  {/* Amount */}
                                <col style={{ width: '48px' }} />  {/* Payable */}
                            </colgroup>
                            <thead>
                                <tr style={{ borderBottom: '1px solid black' }}>
                                    <th rowSpan="2" style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px 2px', verticalAlign: 'top', lineHeight: '1.2', textAlign: 'center', wordBreak: 'break-word', overflow: 'hidden'  }}>{t('billing.billPrint.date')}</th>
                                    <th colSpan="5" style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px', textAlign: 'center'  }}>{t('billing.billPrint.morning')}</th>
                                    <th colSpan="5" style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px', textAlign: 'center'  }}>{t('billing.billPrint.evening')}</th>
                                    <th colSpan="4" style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px', textAlign: 'center'  }}>{t('billing.billPrint.deduction')}</th>
                                </tr>
                                <tr style={{ borderBottom: '1px solid black', fontSize: '10px' }}>
                                    {/* Morning Cols */}
                                    <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '2px', wordBreak: 'break-word', overflow: 'hidden'  }}>{t('billing.billPrint.type')}</th>
                                    <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '2px', wordBreak: 'break-word', overflow: 'hidden'  }}>{t('billing.billPrint.fat')}</th>
                                    <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '2px', wordBreak: 'break-word', overflow: 'hidden'  }}>{t('billing.billPrint.snf')}</th>
                                    <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '2px', wordBreak: 'break-word', overflow: 'hidden'  }}>{t('billing.billPrint.rate')}</th>
                                    <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '2px', wordBreak: 'break-word', overflow: 'hidden'  }}>{t('billing.billPrint.amount')}</th>
                                    {/* Evening Cols */}
                                    <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '2px', wordBreak: 'break-word', overflow: 'hidden'  }}>{t('billing.billPrint.type')}</th>
                                    <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '2px', wordBreak: 'break-word', overflow: 'hidden'  }}>{t('billing.billPrint.fat')}</th>
                                    <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '2px', wordBreak: 'break-word', overflow: 'hidden'  }}>{t('billing.billPrint.snf')}</th>
                                    <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '2px', wordBreak: 'break-word', overflow: 'hidden'  }}>{t('billing.billPrint.rate')}</th>
                                    <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '2px', wordBreak: 'break-word', overflow: 'hidden'  }}>{t('billing.billPrint.amount')}</th>
                                    {/* Deduction Cols */}
                                    <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '2px', wordBreak: 'break-word', overflow: 'hidden'  }}>{t('billing.billPrint.deductionName')}</th>
                                    <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '2px', wordBreak: 'break-word', overflow: 'hidden'  }}>{t('billing.billPrint.initial')}</th>
                                    <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '2px', wordBreak: 'break-word', overflow: 'hidden'  }}>{t('billing.billPrint.amount')}</th>
                                    <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '2px', wordBreak: 'break-word', overflow: 'hidden'  }}>{t('billing.billPrint.payable')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {printBillData.rows.map((row, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid black' }}>
                                        <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px', textAlign: 'center'  }}>
                                            {row.date ? new Date(row.date).toLocaleDateString('en-GB').slice(0, 5) : ''}
                                        </td>

                                        {/* Morning Data */}
                                        <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '2px', textAlign: 'center'  }}>
                                            {row.morning?.milk_type === 'Cow' ? (i18n.language === 'mr' ? 'गाय' : (i18n.language === 'hi' ? 'गाय' : 'Cow')) :
                                                (row.morning?.milk_type === 'Buffalo' ? (i18n.language === 'mr' ? 'म्हैस' : (i18n.language === 'hi' ? 'भैंस' : 'Buffalo')) : '')}
                                        </td>
                                        <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '2px', textAlign: 'center'  }}>{row.morning?.fat}</td>
                                        <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '2px', textAlign: 'center'  }}>{row.morning?.snf}</td>
                                        <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '2px', textAlign: 'center'  }}>{row.morning?.rate}</td>
                                        <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '2px', textAlign: 'right'  }}>{row.morning?.amount}</td>

                                        {/* Evening Data */}
                                        <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '2px', textAlign: 'center'  }}>
                                            {row.evening?.milk_type === 'Cow' ? (i18n.language === 'mr' ? 'गाय' : (i18n.language === 'hi' ? 'गाय' : 'Cow')) :
                                                (row.evening?.milk_type === 'Buffalo' ? (i18n.language === 'mr' ? 'म्हैस' : (i18n.language === 'hi' ? 'भैंस' : 'Buffalo')) : '')}
                                        </td>
                                        <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '2px', textAlign: 'center'  }}>{row.evening?.fat}</td>
                                        <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '2px', textAlign: 'center'  }}>{row.evening?.snf}</td>
                                        <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '2px', textAlign: 'center'  }}>{row.evening?.rate}</td>
                                        <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '2px', textAlign: 'right'  }}>{row.evening?.amount}</td>

                                        {/* Deduction Data */}
                                        <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '2px', fontSize: '10px'  }}>{row.deduction?.name}</td>
                                        <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '2px', textAlign: 'right'  }}>{row.deduction?.total_target || '-'}</td>
                                        <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '2px', textAlign: 'right'  }}>{row.deduction?.amount}</td>
                                        <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '2px', textAlign: 'right'  }}>{row.deduction?.remaining ? formatLocaleNum(formatMoney(row.deduction.remaining, 2, { truncate: true })) : '-'}</td>
                                    </tr>
                                ))}
                                {/* Filler rows if needed to fill page or fixed height */}
                            </tbody>
                            <tfoot>
                                <tr style={{ fontWeight: 'bold', background: '#f0f0f0' }}>
                                    <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px'  }}>{t('billing.billPrint.total')}</td>

                                    {/* Morning Totals */}
                                    <td colSpan="4" style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black'  }}></td>
                                    <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '2px', textAlign: 'right'  }}></td>

                                    {/* Evening Totals */}
                                    <td colSpan="4" style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black'  }}></td>
                                    <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '2px', textAlign: 'right'  }}></td>

                                    <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px', textAlign: 'right'  }}>{t('billing.table.gross')}: {printBillData.summary.totalAmount}</td>
                                    <td colSpan="2" style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px', textAlign: 'right'  }}>{t('billing.billPrint.deduction')}: {printBillData.summary.totalDeduction}</td>
                                    {(printBillData.summary.thevEntries || []).length > 0
                                        ? (printBillData.summary.thevEntries).map((te, tIdx) => (
                                            <td key={tIdx} style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px', textAlign: 'right', fontSize: '11px' }}>
                                                {te.schemeName} ({parseFloat(te.balance) > 0 ? t('billing.billPrint.thevSavingsBalance', { defaultValue: 'ठेव शिल्लक' }) : t('billing.billPrint.thevSavingsDeposited', { defaultValue: 'ठेव जमा' })}): ₹{parseFloat(te.balance) > 0 ? te.balance : te.periodDeduction}
                                            </td>
                                        ))
                                        : (parseFloat(printBillData.summary.thevTotalBalance || 0) > 0 || parseFloat(printBillData.summary.thevPeriodDeduction || 0) > 0) && (
                                            <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px', textAlign: 'right', fontSize: '11px' }}>
                                                {printBillData.summary.thevSchemeName} ({parseFloat(printBillData.summary.thevTotalBalance || 0) > 0 ? t('billing.billPrint.thevSavingsBalance', { defaultValue: 'ठेव शिल्लक' }) : t('billing.billPrint.thevSavingsDeposited', { defaultValue: 'ठेव जमा' })}): ₹{parseFloat(printBillData.summary.thevTotalBalance || 0) > 0 ? printBillData.summary.thevTotalBalance : printBillData.summary.thevPeriodDeduction}
                                            </td>
                                        )
                                    }
                                    <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px', textAlign: 'right'  }}>{printBillData.summary.netAmount}</td>
                                </tr>
                            </tfoot>
                        </table>

                        {/* Footer / Bank Slip */}
                        <div style={{ color: 'black',  marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'  }}>
                            <div style={{ color: 'black',  textAlign: 'center'  }}>
                                <p style={{ marginTop: '40px', borderTop: '1px solid black', width: '150px' }}>{t('billing.billPrint.signature')}</p>
                            </div>

                            <div style={{ color: 'black',  textAlign: 'right'  }}>
                                <p style={{ fontSize: '16px', fontWeight: 'bold' }}>{t('billing.billPrint.grandTotal')}: ₹{printBillData.summary.netAmount}</p>
                            </div>
                        </div>
                        <div style={{ marginTop: '10px', textAlign: 'center', fontSize: '10px', color: 'black' }}>
                            <p>Powered by DudhSakha Milk Management System. Software Contact: 8999112047</p>
                        </div>
                    </div>
                )
            }
            {/* Hidden PDF Render Target (Unified) */}
            {
                pdfJob && pdfJob.chunks && pdfJob.chunks[pdfJob.currentChunk] && (
                    <div style={{ color: 'black', 
                        position: 'fixed', left: '-14000px', top: 0,
                        width: pdfJob.type === 'register' ? '1123px' : '794px',
                        pointerEvents: 'none', zIndex: -1000, opacity: 0, overflow: 'visible'
                     }}>
                        {pdfJob.type === 'register' ? (
                            <div id="pdf-render-target" className="report-page" style={{
                                width: '1123px',
                                background: 'white',
                                color: 'black',
                                fontFamily: '"Noto Sans", sans-serif',
                                padding: '8px 10px',
                                boxSizing: 'border-box'
                            }}>
                                {/* Register Header */}
                                <div style={{ background: 'white', color: 'black', paddingBottom: '5px', marginBottom: '5px', borderBottom: '2px solid black' }}>
                                    <h1 style={{ margin: '0 0 2px 0', fontSize: '22px', textAlign: 'center', fontWeight: 'bold', textTransform: 'uppercase' }}>{pdfJob.meta.dairyName}</h1>
                                    <h2 style={{ margin: '0 0 4px 0', fontSize: '16px', textAlign: 'center', fontWeight: 'normal', textDecoration: 'underline' }}>{pdfJob.meta.title}</h2>

                                    <div style={{ color: 'black',  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '13px', fontWeight: 'bold'  }}>
                                        <span>{pdfJob.meta.subtitle}</span>
                                        <div style={{ color: 'black',  textAlign: 'right'  }}>
                                            {pdfJob.meta.date} <br />
                                            {t('billing.page', { defaultValue: 'Page' })} {pdfJob.currentChunk + 1} / {pdfJob.chunks.length}
                                        </div>
                                    </div>
                                </div>

                                {pdfJob.chunks[pdfJob.currentChunk].sectionTitle && (
                                    <div
                                        style={{ color: 'black', 
                                            border: '1px solid black',
                                            borderRadius: '4px',
                                            padding: '6px 10px',
                                            background: 'transparent',
                                            fontWeight: 'bold',
                                            fontSize: '14px',
                                            textAlign: 'center',
                                            marginBottom: '6px'
                                         }}
                                    >
                                        {pdfJob.chunks[pdfJob.currentChunk].sectionTitle}
                                    </div>
                                )}

                                {/* Register Table — height grows with rows (no blank last page) */}
                                <div style={{ color: 'black',  width: '100%'  }}>
                                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '12px', borderTop: '1px solid black', borderLeft: '1px solid black', tableLayout: 'fixed' }}>
                                        <colgroup>
                                            <col style={{ width: '4%' }} />{/* Farmer code */}
                                            <col style={{ width: '13%' }} />{/* Name */}
                                            <col style={{ width: '4.5%' }} /><col style={{ width: '6%' }} />{/* Morning */}
                                            <col style={{ width: '4.5%' }} /><col style={{ width: '6%' }} />{/* Evening */}
                                            <col style={{ width: '4.5%' }} /><col style={{ width: '6.5%' }} />{/* Total */}
                                            <col style={{ width: '16%' }} />{/* Ded Details */}
                                            <col style={{ width: '7%' }} />{/* Ded Total */}
                                            <col style={{ width: '9%' }} />{/* Nivval Ada */}
                                            <col style={{ width: '6%' }} />{/* Sahi — total ≈ 97%; remaining fills */}
                                        </colgroup>
                                        <thead>
                                            <tr style={{ background: 'transparent', textAlign: 'center', fontWeight: 'bold', fontSize: '13px' }}>
                                                <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px 2px', verticalAlign: 'middle', overflow: 'hidden'  }}>{t('register.farmerCode')}</th>
                                                <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px', verticalAlign: 'middle', textAlign: 'left', overflow: 'hidden'  }}>{t('register.name')}</th>
                                                <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px 2px', verticalAlign: 'middle', overflow: 'hidden'  }}>सका. लि.</th>
                                                <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px 2px', verticalAlign: 'middle', overflow: 'hidden'  }}>सका. रक्कम</th>
                                                <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px 2px', verticalAlign: 'middle', overflow: 'hidden'  }}>सायं. लि.</th>
                                                <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px 2px', verticalAlign: 'middle', overflow: 'hidden'  }}>सायं. रक्कम</th>
                                                <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px 2px', verticalAlign: 'middle', fontWeight: 'bold', overflow: 'hidden'  }}>एकूण लि.</th>
                                                <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px 2px', verticalAlign: 'middle', fontWeight: 'bold', overflow: 'hidden'  }}>एकूण रक्कम</th>
                                                <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px 2px', verticalAlign: 'middle', overflow: 'hidden'  }}>कपात तपशील</th>
                                                <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px 2px', verticalAlign: 'middle', overflow: 'hidden'  }}>एकूण कपात</th>
                                                <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px 2px', verticalAlign: 'middle', overflow: 'hidden'  }}>निव्वळ अदा</th>
                                                <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px 2px', verticalAlign: 'middle', overflow: 'hidden'  }}>सही</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pdfJob.chunks[pdfJob.currentChunk].rows.map((row, i) => (
                                                <tr key={i} style={{ textAlign: 'right', verticalAlign: 'middle', fontSize: '12px' }}>
                                                    <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '3px', textAlign: 'center', overflow: 'hidden'  }}>{row.farmerCode}</td>
                                                    <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '3px 6px', textAlign: 'left', fontWeight: 'bold', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis'  }}>{row.name}</td>
                                                    <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '3px', whiteSpace: 'nowrap', overflow: 'hidden'  }}>{row.morning.qty}</td>
                                                    <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '3px', whiteSpace: 'nowrap', overflow: 'hidden'  }}>{formatLocaleNum(formatMoney(row.morning.amt))}</td>
                                                    <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '3px', whiteSpace: 'nowrap', overflow: 'hidden'  }}>{row.evening.qty}</td>
                                                    <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '3px', whiteSpace: 'nowrap', overflow: 'hidden'  }}>{formatLocaleNum(formatMoney(row.evening.amt))}</td>
                                                    <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '3px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden'  }}>{row.total.qty}</td>
                                                    <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '3px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden'  }}>{formatByPrintSetting(row.total.amt, pdfJob.printSettings)}</td>
                                                    {/* कपात तपशील */}
                                                    <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '3px 5px', textAlign: 'left', fontSize: '11px', verticalAlign: 'middle', overflow: 'hidden'  }}>
                                                        {row.deductionBreakdown && row.deductionBreakdown.length > 0 ? (
                                                            row.deductionBreakdown.map((d, di) => (
                                                                <div key={di} style={{ color: 'black',  display: 'flex', justifyContent: 'space-between', gap: '4px', lineHeight: '1.4', whiteSpace: 'nowrap'  }}>
                                                                    <span style={{ color: 'black',  fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px'  }}>{d.name}:</span>
                                                                    <span style={{ color: 'black',  flexShrink: 0  }}>-{formatByPrintSetting(d.amount, pdfJob.printSettings)}</span>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <span>-</span>
                                                        )}
                                                    </td>
                                                    {/* एकूण कपात */}
                                                    <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '3px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden'  }}>
                                                        {row.totalDeduction > 0 ? `-${formatByPrintSetting(row.totalDeduction, pdfJob.printSettings)}` : '-'}
                                                    </td>
                                                    {/* निव्वळ अदा */}
                                                    <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '3px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden'  }}>
                                                        {row.net}
                                                    </td>
                                                    <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '3px', overflow: 'hidden'  }}></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {pdfJob.currentChunk === pdfJob.chunks.length - 1 && pdfJob.registerSectionTotals && (
                                    <div style={{ color: 'black',  marginTop: '14px', width: '100%'  }}>
                                        <div style={{ color: 'black', 
                                            textAlign: 'center',
                                            fontWeight: 'bold',
                                            fontSize: '14px',
                                            marginBottom: '8px',
                                            padding: '6px',
                                            background: 'transparent',
                                            border: '1px solid black',
                                            borderRadius: '4px'
                                         }}>
                                            {t('register.summaryBlockTitle')}
                                        </div>
                                        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '11px', borderTop: '1px solid black', borderLeft: '1px solid black', tableLayout: 'fixed' }}>
                                            <thead>
                                                <tr style={{ background: 'transparent', textAlign: 'center', fontWeight: 'bold' }}>
                                                    <th colSpan={2} style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px', textAlign: 'left'  }}>{t('register.name')}</th>
                                                    <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px'  }}>सका. लि.</th>
                                                    <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px'  }}>सका. रक्कम</th>
                                                    <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px'  }}>सायं. लि.</th>
                                                    <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px'  }}>सायं. रक्कम</th>
                                                    <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px'  }}>एकूण लि.</th>
                                                    <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px'  }}>एकूण रक्कम</th>
                                                    <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px'  }}>एकूण कपात</th>
                                                    <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px'  }}>निव्वळ अदा</th>
                                                    <th colSpan={2} style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px'  }} />
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(['buffalo', 'cow', 'all']).map((key) => {
                                                    const totals = key === 'all' ? pdfJob.grandTotals : pdfJob.registerSectionTotals[key];
                                                    const label = key === 'all'
                                                        ? t('register.summaryAllRow')
                                                        : key === 'buffalo'
                                                            ? t('register.summaryBuffaloRow')
                                                            : t('register.summaryCowRow');
                                                    return (
                                                        <tr key={key} style={{
                                                            background: key === 'all' ? '#ecfdf5' : '#ffffff',
                                                            textAlign: 'right',
                                                            fontWeight: key === 'all' ? 'bold' : '600',
                                                            fontSize: key === 'all' ? '12px' : '11px'
                                                        }}>
                                                            <td colSpan={2} style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '5px 8px', textAlign: 'left', fontSize: '12px'  }}>{label}</td>
                                                            <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px'  }}>{totals.morningQty.toFixed(3)}</td>
                                                            <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px'  }}>{formatLocaleNum(formatMoney(totals.morningAmt))}</td>
                                                            <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px'  }}>{totals.eveningQty.toFixed(3)}</td>
                                                            <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px'  }}>{formatLocaleNum(formatMoney(totals.eveningAmt))}</td>
                                                            <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px'  }}>{totals.totalQty.toFixed(3)}</td>
                                                            <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px'  }}>{formatByPrintSetting(totals.totalAmt, pdfJob.printSettings)}</td>
                                                            <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px'  }}>
                                                                {totals.totalDeduction > 0 ? `-${formatByPrintSetting(totals.totalDeduction, pdfJob.printSettings)}` : '0'}
                                                            </td>
                                                            <td style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px', color: key === 'all' ? '#1b5e20' : '#111827', fontWeight: key === 'all' ? 'bold' : '600'  }}>
                                                                {formatByPrintSetting(totals.net, pdfJob.printSettings, { truncate: true })}
                                                            </td>
                                                            <td colSpan={2} style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px'  }} />
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                <div style={{ color: 'black',  marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '8px'  }}>
                                    <div style={{ fontSize: '10px', color: 'black' }}>Powered by DudhSakha Milk Management System | Software Contact: 8999112047</div>
                                    <div style={{ color: 'black',  textAlign: 'center', paddingRight: '40px'  }}>
                                        <div style={{ color: 'black',  borderTop: '1px solid black', width: '120px', margin: '0 auto'  }}></div>
                                        <p style={{ marginTop: '5px', fontSize: '12px', fontWeight: 'bold' }}>{t('register.dairySign')}</p>
                                    </div>
                                </div>
                            </div>
                        ) : pdfJob.billFormat === 'format3' ? (
                            /* ── FORMAT 3: Marathi Grid Bill – exactly matching reference photo ── */
                            <div id="pdf-render-target" style={{
                                width: '794px',
                                background: 'white', color: 'black',
                                fontFamily: '"Noto Sans", sans-serif',
                                padding: '4mm 3mm', boxSizing: 'border-box'
                            }}>
                                {pdfJob.chunks[pdfJob.currentChunk].map((bill, billIdx) => {
                                    const milkTypeLabel = bill.milkTypeSummary?.[0]?.type === 'Buffalo'
                                        ? (i18n.language === 'mr' ? 'म्हैस' : i18n.language === 'hi' ? 'भैंस' : 'Buffalo')
                                        : (i18n.language === 'mr' ? 'गाय' : i18n.language === 'hi' ? 'गाय' : 'Cow');
                                    const totalMorningQty = parseFloat(bill.summary.morningLiters || 0).toFixed(3);
                                    const totalEveningQty = parseFloat(bill.summary.eveningLiters || 0).toFixed(3);
                                    const totalQty = (parseFloat(totalMorningQty) + parseFloat(totalEveningQty)).toFixed(3);

                                    return (
                                        <div key={billIdx} style={{ color: 'black',  marginBottom: '8mm', borderBottom: '2px solid black', paddingBottom: '6mm'  }}>

                                            {/* ── TOP HEADER: Dairy Name centered ── */}
                                            <div style={{ color: 'black',  textAlign: 'center', marginBottom: '6px'  }}>
                                                <div style={{ color: 'black',  fontSize: '20px', fontWeight: 'bold'  }}>{bill.dairyName}</div>
                                            </div>

                                            {/* ── SUB-HEADER ROW 1: विभाग / दूध प्रकार / नंबर / दिनांक ── */}
                                            <div style={{ color: 'black',  display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px', alignItems: 'center', flexWrap: 'wrap'  }}>
                                                <span>{i18n.language === 'mr' ? 'विभाग :' : 'Branch:'} {t('billing.billPrint.mainBranch', 'Main Branch')}</span>
                                                <span>{i18n.language === 'mr' ? 'दुध प्रकार :' : 'Milk Type:'} {milkTypeLabel}</span>
                                                <span>{i18n.language === 'mr' ? 'नंबर :' : 'No:'} {formatLocaleNum(bill.farmerCode)}</span>
                                                <span>{i18n.language === 'mr' ? 'दिनांक' : 'Date'} {formatLocaleNum(bill.billDate)}</span>
                                            </div>

                                            {/* ── SUB-HEADER ROW 2: नांव on left | बील दिनांक right ── */}
                                            <div style={{ color: 'black',  display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', alignItems: 'center'  }}>
                                                <div style={{ color: 'black',  whiteSpace: 'nowrap'  }}>{i18n.language === 'mr' ? 'नांव' : 'Name'} &nbsp; {bill.farmerName}</div>
                                                <div style={{ color: 'black',  whiteSpace: 'nowrap'  }}>{i18n.language === 'mr' ? 'बील दिनांक' : 'Bill Period'} {formatLocaleNum(bill.billPeriod)}</div>
                                            </div>

                                            {/* ── MAIN TABLE with fixed layout and explicit column widths ── */}
                                            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, borderTop: '1px solid black', borderLeft: '1px solid black', fontSize: '11px', tableLayout: 'fixed' }}>
                                                <colgroup>
                                                    <col style={{ width: '64px' }} />   {/* दिनांक */}
                                                    <col style={{ width: '48px' }} />   {/* सकाळ दूध */}
                                                    <col style={{ width: '36px' }} />   {/* सकाळ फॅट */}
                                                    <col style={{ width: '36px' }} />   {/* सकाळ दर */}
                                                    <col style={{ width: '70px' }} />   {/* सकाळ रक्कम */}
                                                    <col style={{ width: '48px' }} />   {/* संध्या दूध */}
                                                    <col style={{ width: '36px' }} />   {/* संध्या फॅट */}
                                                    <col style={{ width: '36px' }} />   {/* संध्या दर */}
                                                    <col style={{ width: '70px' }} />   {/* संध्या रक्कम */}
                                                    <col style={{ width: '62px' }} />   {/* कपात नाव */}
                                                    <col style={{ width: '72px' }} />   {/* कपात रक्कम */}
                                                    <col style={{ width: '72px' }} />   {/* येणे बाकी */}
                                                </colgroup>
                                                <thead>
                                                    <tr style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '13px' }}>
                                                        <th rowSpan="2" style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px', verticalAlign: 'middle', textAlign: 'center'  }}>{i18n.language === 'mr' ? 'दिनांक' : 'Date'}</th>
                                                        <th colSpan="4" style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px', textAlign: 'center'  }}>{i18n.language === 'mr' ? 'सकाळ' : 'Morning'}</th>
                                                        <th colSpan="4" style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px', textAlign: 'center'  }}>{i18n.language === 'mr' ? 'संध्याकाळ' : 'Evening'}</th>
                                                        <th rowSpan="2" style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px', verticalAlign: 'middle', textAlign: 'center'  }}>{i18n.language === 'mr' ? 'कपात' : 'Ded.'}</th>
                                                        <th rowSpan="2" style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px', verticalAlign: 'middle', textAlign: 'center'  }}>{i18n.language === 'mr' ? 'रक्कम' : 'Amt'}</th>
                                                        <th rowSpan="2" style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px', verticalAlign: 'middle', textAlign: 'center'  }}>{i18n.language === 'mr' ? 'येणे बाकी' : 'Bal.'}</th>
                                                    </tr>
                                                    <tr style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '12px' }}>
                                                        <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '3px', textAlign: 'center'  }}>{i18n.language === 'mr' ? 'दुध' : 'Qty'}</th>
                                                        <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '3px', textAlign: 'center'  }}>{i18n.language === 'mr' ? 'फॅट' : 'Fat'}</th>
                                                        <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '3px', textAlign: 'center'  }}>{i18n.language === 'mr' ? 'दर' : 'Rate'}</th>
                                                        <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '3px', textAlign: 'center'  }}>{i18n.language === 'mr' ? 'रक्कम' : 'Amt'}</th>
                                                        <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '3px', textAlign: 'center'  }}>{i18n.language === 'mr' ? 'दुध' : 'Qty'}</th>
                                                        <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '3px', textAlign: 'center'  }}>{i18n.language === 'mr' ? 'फॅट' : 'Fat'}</th>
                                                        <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '3px', textAlign: 'center'  }}>{i18n.language === 'mr' ? 'दर' : 'Rate'}</th>
                                                        <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '3px', textAlign: 'center'  }}>{i18n.language === 'mr' ? 'रक्कम' : 'Amt'}</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {bill.rows.map((row, rIdx) => {
                                                        const ded = row.deduction;
                                                        return (
                                                            <tr key={rIdx} style={{ textAlign: 'center', fontSize: '12px' }}>
                                                                <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: '3px 2px', textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                                                    {row.date ? formatLocaleNum(new Date(row.date).toLocaleDateString('en-GB')) : ''}
                                                                </td>
                                                                <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: '3px', overflow: 'hidden' }}>{row.morning?.quantity ? formatLocaleNum(row.morning.quantity) : ''}</td>
                                                                <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: '3px', overflow: 'hidden' }}>{row.morning?.fat ? formatLocaleNum(row.morning.fat) : ''}</td>
                                                                <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: '3px', overflow: 'hidden' }}>{row.morning?.rate ? formatLocaleNum(row.morning.rate) : ''}</td>
                                                                <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: '3px', overflow: 'hidden' }}>{row.morning?.amount ? formatByPrintSetting(row.morning.amount, pdfJob.printSettings) : ''}</td>
                                                                <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: '3px', overflow: 'hidden' }}>{row.evening?.quantity ? formatLocaleNum(row.evening.quantity) : ''}</td>
                                                                <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: '3px', overflow: 'hidden' }}>{row.evening?.fat ? formatLocaleNum(row.evening.fat) : ''}</td>
                                                                <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: '3px', overflow: 'hidden' }}>{row.evening?.rate ? formatLocaleNum(row.evening.rate) : ''}</td>
                                                                <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: '3px', overflow: 'hidden' }}>{row.evening?.amount ? formatByPrintSetting(row.evening.amount, pdfJob.printSettings) : ''}</td>
                                                                <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: '3px', textAlign: 'left', fontSize: '11px', overflow: 'hidden' }}>{ded?.name || ''}</td>
                                                                <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: '3px', overflow: 'hidden' }}>{ded?.deducted ? formatByPrintSetting(ded.deducted, pdfJob.printSettings) : ''}</td>
                                                                <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: '3px', overflow: 'hidden' }}>{ded?.remaining ? formatByPrintSetting(ded.remaining, pdfJob.printSettings, { truncate: true }) : ''}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                    {/* ── TOTALS ROW ── */}
                                                    <tr style={{ fontWeight: 'bold', textAlign: 'center', fontSize: '12px' }}>
                                                        <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px', textAlign: 'center'  }}>{i18n.language === 'mr' ? 'एकुण' : 'Total'}</td>
                                                        <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '3px'  }}>{formatLocaleNum(totalMorningQty)}</td>
                                                        <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black'  }}></td>
                                                        <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black'  }}></td>
                                                        <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '3px'  }}>{formatByPrintSetting(bill.summary.morningAmount, pdfJob.printSettings)}</td>
                                                        <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '3px'  }}>{formatLocaleNum(totalEveningQty)}</td>
                                                        <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black'  }}></td>
                                                        <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black'  }}></td>
                                                        <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '3px'  }}>{formatByPrintSetting(bill.summary.eveningAmount, pdfJob.printSettings)}</td>
                                                        <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '3px', textAlign: 'left', fontSize: '12px'  }}>{i18n.language === 'mr' ? 'एकुण कपात' : 'Total Ded.'}</td>
                                                        <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '3px'  }}>{toSafeNumber(bill.summary.deductionTotalDeducted) > 0 ? formatByPrintSetting(bill.summary.deductionTotalDeducted, pdfJob.printSettings) : ''}</td>
                                                        <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black'  }}></td>
                                                    </tr>
                                                </tbody>
                                            </table>

                                            {/* ── FOOTER SUMMARY ── */}
                                            <div style={{ color: 'black',  border: '1px solid black', borderTop: 'none', padding: '4px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: 'bold'  }}>
                                                <span>{i18n.language === 'mr' ? 'एकुण दुध' : 'Total Milk'} {formatLocaleNum(totalQty)}</span>
                                                <span>{i18n.language === 'mr' ? 'एकुण रक्कम' : 'Total Amount'} {formatByPrintSetting(bill.summary.totalAmount, pdfJob.printSettings)}</span>
                                                {(bill.summary.thevEntries || []).length > 0
                                                    ? (bill.summary.thevEntries).map((te, tIdx) => (
                                                        <span key={tIdx} style={{ color: 'black', fontSize: '12px' }}>
                                                            {tIdx > 0 && ' | '}{te.schemeName} ({parseFloat(te.balance) > 0 ? t('billing.billPrint.thevSavingsBalance', { defaultValue: 'ठेव शिल्लक' }) : t('billing.billPrint.thevSavingsDeposited', { defaultValue: 'ठेव जमा' })}): ₹{formatLocaleNum(parseFloat(te.balance) > 0 ? te.balance : te.periodDeduction)}
                                                        </span>
                                                    ))
                                                    : (parseFloat(bill.summary.thevTotalBalance || 0) > 0 || parseFloat(bill.summary.thevPeriodDeduction || 0) > 0) && (
                                                        <span style={{ color: 'black', fontSize: '12px' }}>
                                                            {bill.summary.thevSchemeName} ({parseFloat(bill.summary.thevTotalBalance || 0) > 0 ? t('billing.billPrint.thevSavingsBalance', { defaultValue: 'ठेव शिल्लक' }) : t('billing.billPrint.thevSavingsDeposited', { defaultValue: 'ठेव जमा' })}): ₹{formatLocaleNum(parseFloat(bill.summary.thevTotalBalance || 0) > 0 ? bill.summary.thevTotalBalance : bill.summary.thevPeriodDeduction)}
                                                        </span>
                                                    )
                                                }
                                                <span style={{ color: 'black',  fontSize: '14px'  }}>{i18n.language === 'mr' ? 'निव्वळ अदा' : 'Net Payable'} {formatByPrintSetting(bill.summary.netAmount, pdfJob.printSettings, { truncate: true })}</span>
                                            </div>

                                            {/* Signature: सही */}
                                            <div style={{ color: 'black',  display: 'flex', justifyContent: 'flex-end', marginTop: '15px'  }}>
                                                <div style={{ color: 'black',  textAlign: 'center', minWidth: '100px'  }}>
                                                    <div style={{ color: 'black',  borderTop: '1px solid black', marginBottom: '4px'  }}></div>
                                                    <span style={{ color: 'black',  fontWeight: 'bold', fontSize: '13px'  }}>{i18n.language === 'mr' ? 'सही' : 'Signature'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            /* ── FORMAT 2: Standard A4 Multi-Column (default) ── */
                            <div id="pdf-render-target" style={{
                                width: '794px',
                                background: 'white',
                                color: 'black',
                                fontFamily: '"Noto Sans", sans-serif',
                                padding: '4mm',
                                boxSizing: 'border-box'
                            }}>
                                {pdfJob.chunks[pdfJob.currentChunk].map((bill, billIdx) => (
                                    <div key={billIdx} style={{ color: 'black',  marginBottom: '6mm', borderBottom: '1px solid #ccc', paddingBottom: '6mm'  }}>
                                        
                                        {/* Farmer ID Box (Top Right) */}
                                        <div style={{ color: 'black',  display: 'flex', justifyContent: 'flex-end', marginBottom: '4px'  }}>
                                            <div style={{  
                                                backgroundColor: 'black', 
                                                color: 'white', 
                                                padding: '4px 15px', 
                                                fontWeight: 'bold', 
                                                fontSize: '16px',
                                                borderRadius: '2px'
                                             }}>
                                                {formatLocaleNum(bill.farmerCode)}
                                            </div>
                                        </div>

                                        {/* Row 1: Period - Dairy - Branch */}
                                        <div style={{ color: 'black',  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '6px', fontSize: '13px', fontWeight: 'bold'  }}>
                                            <div style={{ color: 'black',  width: '30%'  }}>
                                                {t('billing.billPrint.period')} : {formatLocaleNum(bill.billPeriod)}
                                            </div>
                                            <div style={{ color: 'black',  width: '40%', fontSize: '20px', textAlign: 'center'  }}>
                                                {bill.dairyName}
                                            </div>
                                            <div style={{ color: 'black',  width: '30%', textAlign: 'right'  }}>
                                                {t('billing.billPrint.branch')} - {t('billing.billPrint.mainBranch')}
                                            </div>
                                        </div>

                                        {/* Row 2: Bank - Days Bill - Name */}
                                        <div style={{ color: 'black',  display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', fontWeight: 'bold'  }}>
                                            <div style={{ color: 'black',  width: '30%'  }}>
                                                {t('billing.billPrint.bank')} : -
                                            </div>
                                            <div style={{ color: 'black',  width: '40%', textAlign: 'center'  }}>
                                                {t('billing.billPrint.daysBill', { days: formatLocaleNum(bill.billingDays) })}
                                            </div>
                                            <div style={{ color: 'black',  width: '30%', textAlign: 'right'  }}>
                                                {t('billing.billPrint.farmerName')} : {formatLocaleNum(bill.farmerCode)} - {bill.farmerName}
                                            </div>
                                        </div>

                                        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, borderTop: '1px solid black', borderLeft: '1px solid black', fontSize: i18n.language === 'mr' ? '10px' : '10px', tableLayout: 'fixed' }}>
                                            <colgroup>
                                                <col style={{ width: '42px' }} />  {/* Date */}
                                                <col style={{ width: '50px' }} />  {/* M Liters */}
                                                <col style={{ width: '34px' }} />  {/* M Fat */}
                                                <col style={{ width: '32px' }} />  {/* M SNF */}
                                                <col style={{ width: '34px' }} />  {/* M Rate */}
                                                <col style={{ width: '65px' }} />  {/* M Amount */}
                                                <col style={{ width: '50px' }} />  {/* E Liters */}
                                                <col style={{ width: '34px' }} />  {/* E Fat */}
                                                <col style={{ width: '32px' }} />  {/* E SNF */}
                                                <col style={{ width: '34px' }} />  {/* E Rate */}
                                                <col style={{ width: '65px' }} />  {/* E Amount */}
                                                <col style={{ width: '72px' }} />  {/* Deduction Name */}
                                                <col style={{ width: '62px' }} />  {/* Prev Balance */}
                                                <col style={{ width: '38px' }} />  {/* Current */}
                                                <col style={{ width: '46px' }} />  {/* Deducted */}
                                                <col style={{ width: '66px' }} />  {/* Remaining */}
                                            </colgroup>
                                            <thead>
                                                <tr style={{ textAlign: 'center', fontWeight: 'bold', fontSize: i18n.language === 'mr' ? '11px' : '11px' }}>
                                                    <th rowSpan="2" style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', verticalAlign: 'middle', padding: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textAlign: 'center' }}>
                                                        <div style={{ color: 'black', fontSize: i18n.language === 'mr' ? '10px' : '8px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                                                            {bill.milkTypeSummary?.[0]?.type === 'Buffalo'
                                                                ? (i18n.language === 'mr' ? t('billing.billPrint.buffaloMilk') : 'Buf.')
                                                                : (i18n.language === 'mr' ? t('billing.billPrint.cowMilk') : 'Cow')}
                                                        </div>
                                                        {t('billing.billPrint.date')}
                                                    </th>
                                                    <th colSpan="5" style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '3px' : '5px 3px' }}>{t('billing.billPrint.morning')}</th>
                                                    <th colSpan="5" style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '3px' : '5px 3px' }}>{t('billing.billPrint.evening')}</th>
                                                    <th colSpan="5" style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '3px' : '5px 3px' }}>{t('billing.billPrint.deduction')}</th>
                                                </tr>
                                                <tr style={{ textAlign: 'center', fontWeight: 'bold', fontSize: i18n.language === 'mr' ? '10px' : '8px' }}>
                                                    {/* Morning */}
                                                    <th style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '2px' : '4px 1px', whiteSpace: 'nowrap', overflow: 'hidden' }}>{t('billing.billPrint.liters')}</th>
                                                    <th style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '2px' : '4px 1px', whiteSpace: 'nowrap', overflow: 'hidden' }}>{t('billing.billPrint.fat')}</th>
                                                    <th style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '2px' : '4px 1px', whiteSpace: 'nowrap', overflow: 'hidden' }}>{t('billing.billPrint.snf')}</th>
                                                    <th style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '2px' : '4px 1px', whiteSpace: 'nowrap', overflow: 'hidden' }}>{t('billing.billPrint.rate')}</th>
                                                    <th style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '2px' : '4px 1px', whiteSpace: 'nowrap', overflow: 'hidden' }}>{t('billing.billPrint.amount')}</th>
                                                    {/* Evening */}
                                                    <th style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '2px' : '4px 1px', whiteSpace: 'nowrap', overflow: 'hidden' }}>{t('billing.billPrint.liters')}</th>
                                                    <th style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '2px' : '4px 1px', whiteSpace: 'nowrap', overflow: 'hidden' }}>{t('billing.billPrint.fat')}</th>
                                                    <th style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '2px' : '4px 1px', whiteSpace: 'nowrap', overflow: 'hidden' }}>{t('billing.billPrint.snf')}</th>
                                                    <th style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '2px' : '4px 1px', whiteSpace: 'nowrap', overflow: 'hidden' }}>{t('billing.billPrint.rate')}</th>
                                                    <th style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '2px' : '4px 1px', whiteSpace: 'nowrap', overflow: 'hidden' }}>{t('billing.billPrint.amount')}</th>
                                                    {/* Deduction */}
                                                    <th style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '2px' : '4px 1px', whiteSpace: 'nowrap', overflow: 'hidden' }}>{t('billing.billPrint.deductionName')}</th>
                                                    <th style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '2px' : '4px 1px', whiteSpace: 'nowrap', overflow: 'hidden' }}>{t('billing.billPrint.previousBalance')}</th>
                                                    <th style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '2px' : '4px 1px', whiteSpace: 'nowrap', overflow: 'hidden' }}>{t('billing.billPrint.currentDeduction')}</th>
                                                    <th style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '2px' : '4px 1px', whiteSpace: 'nowrap', overflow: 'hidden' }}>{i18n.language === 'mr' ? t('billing.billPrint.deduction') : 'Ded.'}</th>
                                                    <th style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '2px' : '4px 1px', whiteSpace: 'nowrap', overflow: 'hidden' }}>{t('billing.billPrint.remainingBalance')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {bill.rows.map((row, rIdx) => (
                                                    <tr key={rIdx} style={{ textAlign: 'right', fontSize: i18n.language === 'mr' ? '10px' : '10px' }}>
                                                        <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '2px 1px' : '4px 1px', textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap' }}>{row.date ? formatLocaleNum(row.date.slice(8)) : ''}</td>
                                                        <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '2px 1px' : '4px 1px', overflow: 'hidden', whiteSpace: 'nowrap' }}>{row.morning?.quantity ? formatLocaleNum(row.morning.quantity) : ''}</td>
                                                        <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '2px 1px' : '4px 1px', overflow: 'hidden', whiteSpace: 'nowrap' }}>{row.morning?.fat ? formatLocaleNum(row.morning.fat) : ''}</td>
                                                        <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '2px 1px' : '4px 1px', overflow: 'hidden', whiteSpace: 'nowrap' }}>{row.morning?.snf ? formatLocaleNum(row.morning.snf) : ''}</td>
                                                        <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '2px 1px' : '4px 1px', overflow: 'hidden', whiteSpace: 'nowrap' }}>{row.morning?.rate ? formatLocaleNum(row.morning.rate) : ''}</td>
                                                        <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '2px 1px' : '4px 1px', overflow: 'hidden', whiteSpace: 'nowrap' }}>{row.morning?.amount ? formatByPrintSetting(row.morning.amount, pdfJob.printSettings) : ''}</td>
                                                        <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '2px 1px' : '4px 1px', overflow: 'hidden', whiteSpace: 'nowrap' }}>{row.evening?.quantity ? formatLocaleNum(row.evening.quantity) : ''}</td>
                                                        <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '2px 1px' : '4px 1px', overflow: 'hidden', whiteSpace: 'nowrap' }}>{row.evening?.fat ? formatLocaleNum(row.evening.fat) : ''}</td>
                                                        <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '2px 1px' : '4px 1px', overflow: 'hidden', whiteSpace: 'nowrap' }}>{row.evening?.snf ? formatLocaleNum(row.evening.snf) : ''}</td>
                                                        <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '2px 1px' : '4px 1px', overflow: 'hidden', whiteSpace: 'nowrap' }}>{row.evening?.rate ? formatLocaleNum(row.evening.rate) : ''}</td>
                                                        <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '2px 1px' : '4px 1px', overflow: 'hidden', whiteSpace: 'nowrap' }}>{row.evening?.amount ? formatByPrintSetting(row.evening.amount, pdfJob.printSettings) : ''}</td>
                                                        <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '2px 1px' : '4px 1px', textAlign: 'left', fontSize: i18n.language === 'mr' ? '9px' : '9px', overflow: 'hidden', whiteSpace: 'nowrap' }}>{row.deduction?.name || ''}</td>
                                                        <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '2px 1px' : '4px 1px', overflow: 'hidden', whiteSpace: 'nowrap' }}>{row.deduction?.prevBalance ? formatByPrintSetting(row.deduction.prevBalance, pdfJob.printSettings, { truncate: true }) : ''}</td>
                                                        <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '2px 1px' : '4px 1px', overflow: 'hidden', whiteSpace: 'nowrap' }}>{row.deduction?.currentAddition ? formatLocaleNum(row.deduction.currentAddition) : ''}</td>
                                                        <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '2px 1px' : '4px 1px', overflow: 'hidden', whiteSpace: 'nowrap' }}>{row.deduction?.deducted ? formatByPrintSetting(row.deduction.deducted, pdfJob.printSettings) : ''}</td>
                                                        <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '2px 1px' : '4px 1px', overflow: 'hidden', whiteSpace: 'nowrap' }}>{row.deduction?.remaining ? formatByPrintSetting(row.deduction.remaining, pdfJob.printSettings, { truncate: true }) : ''}</td>
                                                    </tr>
                                                ))}
                                                {/* Totals Row inside Table */}
                                                <tr style={{ fontWeight: 'bold', textAlign: 'right', fontSize: i18n.language === 'mr' ? '10px' : '10px', background: '#f5f5f5' }}>
                                                    <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black' }}></td>
                                                    <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '2px 1px' : '4px 1px', overflow: 'hidden', whiteSpace: 'nowrap' }}>{formatLocaleNum(bill.summary.morningLiters)}</td>
                                                    <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black' }}></td>
                                                    <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black' }}></td>
                                                    <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black' }}></td>
                                                    <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '2px 1px' : '4px 1px', overflow: 'hidden', whiteSpace: 'nowrap' }}>{formatByPrintSetting(bill.summary.morningAmount, pdfJob.printSettings)}</td>
                                                    <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '2px 1px' : '4px 1px', overflow: 'hidden', whiteSpace: 'nowrap' }}>{formatLocaleNum(bill.summary.eveningLiters)}</td>
                                                    <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black' }}></td>
                                                    <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black' }}></td>
                                                    <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black' }}></td>
                                                    <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '2px 1px' : '4px 1px', overflow: 'hidden', whiteSpace: 'nowrap' }}>{formatByPrintSetting(bill.summary.eveningAmount, pdfJob.printSettings)}</td>
                                                    <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black' }}></td>
                                                    <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '2px 1px' : '4px 1px', overflow: 'hidden', whiteSpace: 'nowrap' }}>{bill.summary.deductionTotalPrev !== '0.00' ? formatByPrintSetting(bill.summary.deductionTotalPrev, pdfJob.printSettings, { truncate: true }) : ''}</td>
                                                    <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '2px 1px' : '4px 1px' }}></td>
                                                    <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '2px 1px' : '4px 1px', overflow: 'hidden', whiteSpace: 'nowrap' }}>{formatByPrintSetting(bill.summary.deductionTotalDeducted, pdfJob.printSettings)}</td>
                                                    <td style={{ color: 'black', borderBottom: '1px solid black', borderRight: '1px solid black', padding: i18n.language === 'mr' ? '2px 1px' : '4px 1px', overflow: 'hidden', whiteSpace: 'nowrap' }}>{bill.summary.deductionTotalRemaining !== '0.00' ? formatByPrintSetting(bill.summary.deductionTotalRemaining, pdfJob.printSettings, { truncate: true }) : ''}</td>
                                                </tr>
                                            </tbody>
                                        </table>

                                        {/* Refined Summary Block Below Table */}
                                        <div style={{ color: 'black',  marginTop: '0px', border: '1px solid black', borderTop: 'none', padding: '4px 8px'  }}>
                                            {/* Row 1 Summary - Per Milk Type */}
                                            {bill.milkTypeSummary.map((ms, msIdx) => (
                                                <div key={msIdx} style={{ color: 'black',  display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold', borderBottom: '1px solid #eee', paddingBottom: '2px', marginBottom: '2px'  }}>
                                                    <div style={{ color: 'black',  flex: 1  }}>{t('billing.billPrint.totalLiters')} : {formatLocaleNum(ms.liters)}</div>
                                                    <div style={{ color: 'black',  flex: 1  }}>{t('billing.billPrint.fat')} : {formatLocaleNum(ms.avgFat)}</div>
                                                    <div style={{ color: 'black',  flex: 1  }}>{t('billing.billPrint.snf')} : {formatLocaleNum(ms.avgSnf)}</div>
                                                    <div style={{ color: 'black',  flex: 2  }}>{ms.type === 'Buffalo' ? t('billing.billPrint.buffaloMilk') : t('billing.billPrint.cowMilk')} {t('billing.billPrint.milkBill')} : {formatByPrintSetting(ms.amount, pdfJob.printSettings)}</div>
                                                    {msIdx === 0 && <div style={{ color: 'black',  flex: 2, textAlign: 'right'  }}>{t('billing.billPrint.errorCorrection')}</div>}
                                                    {msIdx !== 0 && <div style={{ color: 'black',  flex: 2  }}></div>}
                                                </div>
                                            ))}
                                            {/* Row 2 Summary - with Thev inline */}
                                            <div style={{ color: 'black',  display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold', paddingTop: '4px'  }}>
                                                <div style={{ color: 'black',  flex: 1  }}>{t('billing.billPrint.totalMilkBill')} : {formatByPrintSetting(bill.summary.totalAmount, pdfJob.printSettings)}</div>
                                                <div style={{ color: 'black',  flex: 1  }}>{t('billing.billPrint.totalDeductions')} : {formatByPrintSetting(bill.summary.totalDeduction, pdfJob.printSettings)}</div>
                                                <div style={{ color: 'black',  flex: 2  }}>{t('billing.billPrint.deductionAsOf', { date: formatLocaleNum(bill.endDate || '') })}</div>
                                                {(bill.summary.thevEntries || []).length > 0
                                                    ? (bill.summary.thevEntries).map((te, tIdx) => (
                                                        <div key={tIdx} style={{ color: 'black', flex: 2, fontSize: '12px', paddingLeft: tIdx === 0 ? '12px' : '4px' }}>
                                                            {te.schemeName} ({parseFloat(te.balance) > 0 ? t('billing.billPrint.thevSavingsBalance', { defaultValue: 'ठेव शिल्लक' }) : t('billing.billPrint.thevSavingsDeposited', { defaultValue: 'ठेव जमा' })}) : ₹{formatLocaleNum(parseFloat(te.balance) > 0 ? te.balance : te.periodDeduction)}
                                                        </div>
                                                    ))
                                                    : (parseFloat(bill.summary.thevTotalBalance || 0) > 0 || parseFloat(bill.summary.thevPeriodDeduction || 0) > 0) && (
                                                        <div style={{ color: 'black', flex: 2, fontSize: '12px', paddingLeft: '12px' }}>
                                                            {bill.summary.thevSchemeName} ({parseFloat(bill.summary.thevTotalBalance || 0) > 0 ? t('billing.billPrint.thevSavingsBalance', { defaultValue: 'ठेव शिल्लक' }) : t('billing.billPrint.thevSavingsDeposited', { defaultValue: 'ठेव जमा' })}) : ₹{formatLocaleNum(parseFloat(bill.summary.thevTotalBalance || 0) > 0 ? bill.summary.thevTotalBalance : bill.summary.thevPeriodDeduction)}
                                                        </div>
                                                    )
                                                }
                                                <div style={{ color: 'black',  flex: 2, textAlign: 'right', fontSize: '13px'  }}>
                                                    {t('billing.billPrint.netPayable')} : <span style={{ color: 'black',  fontSize: '15px'  }}>{formatByPrintSetting(bill.summary.netAmount, pdfJob.printSettings, { truncate: true })}</span>
                                                </div>
                                            </div>

                                        </div>

                                        {/* Footer / Signature */}
                                        <div style={{ color: 'black',  display: 'flex', justifyContent: 'flex-end', marginTop: '15px'  }}>
                                            <div style={{ color: 'black',  textAlign: 'center', minWidth: '150px'  }}>
                                                <div style={{ color: 'black',  borderTop: '1px solid black', marginBottom: '4px'  }}></div>
                                                <span style={{ color: 'black',  fontWeight: 'bold', fontSize: '11px'  }}>{t('billing.billPrint.signature')}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )
            }

            {/* Loading Overlay */}
            {
                (pdfLoading) && (
                    <div style={{ color: 'black', 
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        zIndex: 9999, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', gap: '16px',
                        backdropFilter: 'blur(4px)'
                     }}>
                        <Loader2 className="animate-spin" size={48} color="#4f46e5" />
                        <span style={{ fontSize: '18px', fontWeight: '600', color: 'black' }}>
                            {t('reports.backup.generating') || "Generating PDF..."}
                        </span>
                    </div>
                )
            }
            {/* Premium Glassy PDF Preview Modal (Unified for Reports & Bills) */}


            {/* Premium Glassy PDF Preview Modal */}
            {pdfPreview && (
                <div style={{ color: 'black', 
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    height: '100vh',
                    backgroundColor: 'rgba(241, 245, 249, 0.95)', zIndex: 10000,
                    display: 'flex', flexDirection: 'column',
                    backdropFilter: 'blur(8px)',
                    overflow: 'hidden'
                 }}>
                    {/* Glassy Toolbar */}
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.85)', color: 'black', padding: '16px 36px',
                        display: 'flex', alignItems: 'center', gap: '28px', flexShrink: 0,
                        borderBottom: '1px solid #e2e8f0',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
                    }}>
                        <div style={{ color: '#6b7280', display: 'flex', alignItems: 'center', gap: '14px', flex: 1  }}>
                            <div style={{ color: 'black', 
                                width: '44px', height: '44px', borderRadius: '14px',
                                background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
                             }}>
                                <FileText color="white" size={22} />
                            </div>
                            <div>
                                <h1 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: 'black', letterSpacing: '-0.3px' }}>
                                    {pdfPreview.fileName}
                                </h1>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'black', fontSize: '12px', fontWeight: '500' }}>
                                    <CheckCircle size={12} color="#10b981" />
                                    <span>{t('common.readyToDownload', { defaultValue: 'Ready for Review' })}</span>
                                </div>
                            </div>
                        </div>

                        <div style={{ color: 'black',  display: 'flex', gap: '12px'  }}>
                            <button
                                onClick={() => {
                                    if (pdfPreview.pdfRef) {
                                        const blob = pdfPreview.pdfRef.output('bloburl');
                                        const win = window.open(blob, '_blank');
                                        if (win) {
                                            win.focus();
                                            // Some browsers require a small timeout before printing
                                            setTimeout(() => {
                                                win.print();
                                            }, 500);
                                        }
                                    }
                                }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '10px 18px', borderRadius: '12px',
                                    background: '#ffffff', color: '#4f46e5',
                                    border: '1px solid #4f46e5', fontWeight: '600', fontSize: '14px',
                                    cursor: 'pointer', transition: 'all 0.2s',
                                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.1)'
                                }}
                            >
                                <Printer size={18} /> {t('common.print', { defaultValue: 'Print' })}
                            </button>
                            <button
                                onClick={() => {
                                    if (pdfPreview.pdfRef) {
                                        pdfPreview.pdfRef.save(pdfPreview.fileName);
                                    }
                                }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '10px 22px', borderRadius: '12px',
                                    background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                                    color: 'white', border: 'none', fontWeight: '600', fontSize: '14px',
                                    cursor: 'pointer', transition: 'all 0.2s',
                                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)'
                                }}
                            >
                                <Download size={18} /> {t('common.download', { defaultValue: 'Download PDF' })}
                            </button>
                            <button
                                onClick={() => {
                                    setPdfPreview(null);
                                }}
                                style={{
                                    width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    borderRadius: '12px', background: '#ffffff', color: 'black', border: '1px solid #e2e8f0',
                                    cursor: 'pointer', transition: 'all 0.2s'
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Preview: fit full bill in viewport; scroll for multi-page */}
                    <div style={{ color: 'black', 
                        flex: 1,
                        minHeight: 0,
                        padding: '16px 20px 24px',
                        overflowY: 'auto',
                        overflowX: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        background: '#f1f5f9',
                        gap: '20px'
                     }}>
                        {pdfPreview.images.map((img, index) => (
                            <div
                                key={index}
                                style={{ color: 'black', 
                                    width: '100%',
                                    maxWidth: 'min(1200px, 100%)',
                                    background: 'white',
                                    borderRadius: '6px',
                                    boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
                                    overflow: 'hidden',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'flex-start'
                                 }}
                            >
                                <img
                                    src={img}
                                    alt={`Page ${index + 1}`}
                                    style={{
                                        maxWidth: '100%',
                                        width: 'auto',
                                        height: 'auto',
                                        maxHeight: 'min(92vh, calc(100vh - 120px))',
                                        objectFit: 'contain',
                                        display: 'block',
                                        imageRendering: 'auto'
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {/* Thermal Receipt Preview Modal */}
            {showThermalModal && thermalData && (
                <div className="modal-overlay no-print" style={{ color: 'black', 
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', zIndex: 3000
                 }}>
                    <div className="modal" style={{ color: 'black', 
                        background: 'white', borderRadius: '20px', width: '400px',
                        maxHeight: '90vh', display: 'flex', flexDirection: 'column'
                     }}>
                        <div className="modal-header" style={{ color: 'black', 
                            padding: '16px 24px', borderBottom: '1px solid black',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            background: 'transparent', borderTopLeftRadius: '20px', borderTopRightRadius: '20px'
                         }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'black' }}>
                                {t('billing.thermal.preview', 'Thermal Receipt Preview')}
                            </h3>
                            <div style={{ color: 'black',  display: 'flex', gap: '8px'  }}>
                                <button onClick={() => setShowThermalModal(false)} style={{ 
                                    background: 'none', border: 'none', cursor: 'pointer', color: 'black',
                                    padding: '4px', borderRadius: '8px', display: 'flex'
                                }}>
                                    <X size={22} />
                                </button>
                            </div>
                        </div>
                        
                        <div className="modal-body" style={{ color: 'black',  
                            padding: '24px 0', overflowY: 'auto', background: 'transparent',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '500px'
                         }}>
                            {/* The Actual Receipt Content */}
                            <div id="thermal-receipt-printable" className="thermal-receipt" style={{
                                width: '58mm', background: 'white', padding: '8px',
                                boxShadow: '0 8px 20px rgba(0,0,0,0.06)', color: 'black', 
                                fontFamily: '"Courier New", Courier, monospace',
                                borderRadius: '2px', lineShadow: '0 0 10px rgba(0,0,0,0.1)'
                            }}>
                                {/* Header Section */}
                                <div className="thermal-header" style={{ color: 'black',  textAlign: 'center', borderBottom: '1.5px solid #000', paddingBottom: '6px', marginBottom: '8px'  }}>
                                    <h4 style={{ margin: '0 0 2px 0', fontSize: '12pt', fontWeight: 'bold', lineHeight: '1.1' }}>{thermalData.dairyName}</h4>
                                    <p style={{ margin: '0 0 4px 0', fontSize: '9pt', fontWeight: 'bold' }}>{t('billing.billPrint.title')}</p>
                                    <div style={{ color: 'black',  fontSize: '8pt', textAlign: 'left', marginTop: '4px'  }}>
                                        <div style={{ color: 'black',  display: 'flex', justifyContent: 'space-between'  }}>
                                            <span>{t('billing.table.code')}: <strong>{thermalData.farmerCode}</strong></span>
                                            <span>{thermalData.billDate}</span>
                                        </div>
                                        <div style={{ color: 'black',  fontWeight: 'bold', fontSize: '10pt', marginTop: '2px', borderBottom: '0.5pt solid #eee', paddingBottom: '2px'  }}>{thermalData.farmerName}</div>
                                        <div style={{ color: 'black',  fontSize: '7.5pt', marginTop: '2px'  }}>{t('billing.period')}: {thermalData.billPeriod}</div>
                                    </div>
                                </div>

                                {/* Shift-based Collections */}
                                {[
                                    { title: t('billing.billPrint.morning'), shift: 'Morning' },
                                    { title: t('billing.billPrint.evening'), shift: 'Evening' }
                                ].map((group) => {
                                    const cols = thermalData.originalBill.collections.filter(c => c.shift === group.shift);
                                    if (cols.length === 0) return null;
                                    return (
                                        <div key={group.shift} style={{ color: 'black',  marginBottom: '8px'  }}>
                                            <div style={{ color: 'black',  
                                                fontSize: '8pt', fontWeight: 'bold', borderBottom: '1px solid #000', 
                                                marginBottom: '3px', display: 'flex', justifyContent: 'space-between' 
                                             }}>
                                                <span>{group.title}</span>
                                                <span style={{ color: 'black',  fontSize: '7pt'  }}>({cols.length} {t('billing.billPrint.entries')})</span>
                                            </div>
                                            {/* Simplified Data Row Layout */}
                                            <div style={{ color: 'black',  fontSize: '7.5pt', borderBottom: '0.5pt solid #000', marginBottom: '2px', display: 'flex', fontWeight: 'bold'  }}>
                                                <div style={{ color: 'black',  flex: 1.5  }}>{t('billing.billPrint.date')}</div>
                                                <div style={{ color: 'black',  flex: 1, textAlign: 'center'  }}>F</div>
                                                <div style={{ color: 'black',  flex: 1, textAlign: 'center'  }}>S</div>
                                                <div style={{ color: 'black',  flex: 1, textAlign: 'right'  }}>Q</div>
                                                <div style={{ color: 'black',  flex: 1, textAlign: 'right'  }}>R</div>
                                                <div style={{ color: 'black',  flex: 1.2, textAlign: 'right'  }}>A</div>
                                            </div>
                                            {cols.map((col, idx) => (
                                                <div key={idx} style={{ color: 'black',  
                                                    display: 'flex', fontSize: '7.5pt', padding: '1px 0',
                                                    borderBottom: idx === cols.length - 1 ? 'none' : '0.1pt solid #ddd'
                                                 }}>
                                                    <div style={{ color: 'black',  flex: 1.5  }}>{new Date(col.date).getDate()}/{new Date(col.date).getMonth() + 1}</div>
                                                    <div style={{ color: 'black',  flex: 1, textAlign: 'center'  }}>{parseFloat(col.fat).toFixed(1)}</div>
                                                    <div style={{ color: 'black',  flex: 1, textAlign: 'center'  }}>{parseFloat(col.snf).toFixed(1)}</div>
                                                    <div style={{ color: 'black',  flex: 1, textAlign: 'right'  }}>{parseFloat(col.quantity).toFixed(3)}</div>
                                                    <div style={{ color: 'black',  flex: 1, textAlign: 'right'  }}>{parseFloat(col.rate).toFixed(1)}</div>
                                                    <div style={{ color: 'black',  flex: 1.2, textAlign: 'right'  }}>{formatByPrintSetting(col.amount, thermalData.printSettings || { showDecimals: true })}</div>
                                                </div>
                                            ))}
                                            <div style={{ color: 'black',  
                                                fontWeight: 'bold', borderTop: '0.5pt solid #000', marginTop: '2px',
                                                display: 'flex', justifyContent: 'flex-end', fontSize: '8pt' 
                                             }}>
                                                <span style={{ color: 'black',  marginRight: '10px'  }}>{t('billing.billPrint.total')}:</span>
                                                <span style={{ color: 'black',  width: '40px', textAlign: 'right'  }}>{cols.reduce((s, c) => s + parseFloat(c.quantity), 0).toFixed(3)}</span>
                                                <span style={{ color: 'black',  width: '45px', textAlign: 'right'  }}>{formatByPrintSetting(cols.reduce((s, c) => s + parseFloat(c.amount), 0), thermalData.printSettings || { showDecimals: true })}</span>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Deductions Section */}
                                {thermalData.originalBill.deduction_details && thermalData.originalBill.deduction_details.length > 0 && (
                                    <div style={{ color: 'black',  marginBottom: '8px'  }}>
                                        <div style={{ color: 'black',  fontSize: '8pt', fontWeight: 'bold', borderBottom: '1px solid #000', marginBottom: '3px'  }}>
                                            {t('billing.billPrint.deduction')}
                                        </div>
                                        <div style={{ color: 'black',  fontSize: '7.5pt', borderBottom: '0.5pt solid #000', marginBottom: '2px', display: 'flex', fontWeight: 'bold'  }}>
                                            <div style={{ color: 'black',  flex: 1.5  }}>{t('billing.billPrint.deduction')}</div>
                                            <div style={{ color: 'black',  flex: 0.8, textAlign: 'right'  }}>{t('billing.billPrint.initial').slice(0, 4)}</div>
                                            <div style={{ color: 'black',  flex: 0.8, textAlign: 'right'  }}>{t('billing.billPrint.balance').slice(0, 4)}</div>
                                            <div style={{ color: 'black',  flex: 0.8, textAlign: 'right'  }}>{t('billing.billPrint.payable').slice(0, 4)}</div>
                                        </div>
                                        {thermalData.originalBill.deduction_details.map((d, idx) => (
                                            <div key={idx} style={{ color: 'black',  
                                                display: 'flex', fontSize: '7.5pt', padding: '1px 0',
                                                borderBottom: idx === thermalData.originalBill.deduction_details.length - 1 ? 'none' : '0.1pt solid #ddd'
                                             }}>
                                                <div style={{ color: 'black',  flex: 1.5  }}>{d.name || d.deduction_name || 'Deduction'}</div>
                                                <div style={{ color: 'black',  flex: 0.8, textAlign: 'right'  }}>{d.prevBalance ? formatByPrintSetting(d.prevBalance, thermalData.printSettings || { showDecimals: true }) : '—'}</div>
                                                <div style={{ color: 'black',  flex: 0.8, textAlign: 'right', fontWeight: 'bold'  }}>{formatByPrintSetting(d.deducted || d.amount || 0, thermalData.printSettings || { showDecimals: true }, d?.type === 'thev' ? { decimals: 3 } : {})}</div>
                                                <div style={{ color: 'black',  flex: 0.8, textAlign: 'right'  }}>{d.remaining ? formatByPrintSetting(d.remaining, thermalData.printSettings || { showDecimals: true }) : '—'}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Summary Parity Section */}
                                <div style={{ color: 'black',  borderTop: '1.5px solid #000', paddingTop: '6px', fontSize: '8pt'  }}>
                                    <div style={{ color: 'black',  display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '4px'  }}>
                                        {thermalData.milkTypeSummary.map((m, idx) => (
                                            <div key={idx} style={{ color: 'black',  
                                                flex: '1 1 45%', border: '0.5pt solid #eee', padding: '2px', 
                                                fontSize: '7.5pt', borderRadius: '1px' 
                                             }}>
                                                <strong>{t(`common.${m.type.toLowerCase()}`)}:</strong> {m.liters}L<br/>
                                                F:{m.avgFat} S:{m.avgSnf}
                                            </div>
                                        ))}
                                    </div>
                                    
                                    <div style={{ color: 'black',  display: 'flex', justifyContent: 'space-between', marginBottom: '2px'  }}>
                                        <span>{t('billing.billPrint.grandTotal')}:</span>
                                        <span style={{ color: 'black',  fontWeight: 'bold'  }}>{thermalData.summary.totalQty} L</span>
                                    </div>
                                    <div style={{ color: 'black',  display: 'flex', justifyContent: 'space-between', marginBottom: '2px'  }}>
                                        <span>{t('billing.billPrint.totalMilkBill')}:</span>
                                        <span>₹{formatByPrintSetting(thermalData.summary.totalAmount, thermalData.printSettings || { showDecimals: true })}</span>
                                    </div>
                                    <div style={{ color: 'black',  display: 'flex', justifyContent: 'space-between', marginBottom: '2px'  }}>
                                        <span>{t('billing.billPrint.totalDeductions')}:</span>
                                        <span style={{  color: 'black'  }}>-₹{formatByPrintSetting(thermalData.summary.totalDeduction, thermalData.printSettings || { showDecimals: true })}</span>
                                    </div>
                                    {/* Thev Savings — shown inline (one row per scheme) */}
                                    {(thermalData.summary.thevEntries || []).length > 0
                                        ? (thermalData.summary.thevEntries).map((te, tIdx) => (
                                            <div key={tIdx} style={{ color: 'black', display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontSize: '8pt' }}>
                                                <span>{te.schemeName} ({parseFloat(te.balance) > 0 ? t('billing.billPrint.thevSavingsBalance', { defaultValue: 'ठेव शिल्लक' }) : t('billing.billPrint.thevSavingsDeposited', { defaultValue: 'ठेव जमा' })}):</span>
                                                <span>₹{parseFloat(te.balance) > 0 ? te.balance : te.periodDeduction}</span>
                                            </div>
                                        ))
                                        : (parseFloat(thermalData.summary.thevTotalBalance || 0) > 0 || parseFloat(thermalData.summary.thevPeriodDeduction || 0) > 0) && (
                                            <div style={{ color: 'black', display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontSize: '8pt' }}>
                                                <span>{thermalData.summary.thevSchemeName} ({parseFloat(thermalData.summary.thevTotalBalance || 0) > 0 ? t('billing.billPrint.thevSavingsBalance', { defaultValue: 'ठेव शिल्लक' }) : t('billing.billPrint.thevSavingsDeposited', { defaultValue: 'ठेव जमा' })}):</span>
                                                <span>₹{parseFloat(thermalData.summary.thevTotalBalance || 0) > 0 ? thermalData.summary.thevTotalBalance : thermalData.summary.thevPeriodDeduction}</span>
                                            </div>
                                        )
                                    }
                                    
                                    <div style={{ color: 'black',  
                                        display: 'flex', justifyContent: 'space-between', 
                                        marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #000',
                                        fontSize: '10pt', fontWeight: 'bold' 
                                     }}>
                                        <span>{t('billing.billPrint.netPayable')}:</span>
                                        <span>₹{formatByPrintSetting(thermalData.summary.netAmount, thermalData.printSettings || { showDecimals: true }, { truncate: true })}</span>
                                    </div>
                                </div>

                                <div style={{ color: 'black',  
                                    marginTop: '12px', textAlign: 'center', fontSize: '7.5pt', 
                                    borderTop: '1px dashed #444', paddingTop: '6px' 
                                 }}>
                                    <p style={{ margin: '0 0 2px 0' }}>{t('billing.billPrint.errorCorrection')}</p>
                                    <p style={{ margin: '0 0 8px 0', fontSize: '7pt' }}>{t('billing.billPrint.deductionAsOf', { date: thermalData.endDate })}</p>
                                    <div style={{ color: 'black',  marginTop: '12px', borderTop: '0.5pt solid #aaa', width: '60%', margin: '15px auto 5px'  }}></div>
                                    <p style={{ margin: 0 }}>{t('billing.billPrint.signature')}</p>
                                    <p style={{ margin: '8px 0 0 0', fontSize: '6.5pt', color: 'black' }}>Powered by DudhSakha</p>
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer" style={{ color: 'black', 
                            padding: '16px 24px', borderTop: '1px solid #e5e7eb',
                            display: 'flex', gap: '12px', background: 'transparent',
                            borderBottomLeftRadius: '20px', borderBottomRightRadius: '20px'
                         }}>
                            <button
                                onClick={() => setShowThermalModal(false)}
                                style={{
                                    flex: 1, padding: '12px', borderRadius: '12px',
                                    border: '1px solid #e2e8f0', background: 'white',
                                    color: 'black', fontWeight: '600', cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {t('billing.thermal.close', 'Close')}
                            </button>
                            <button
                                onClick={() => {
                                    document.body.classList.add('printing-receipt');
                                    window.print();
                                    setTimeout(() => {
                                        document.body.classList.remove('printing-receipt');
                                    }, 500);
                                }}
                                style={{
                                    flex: 1, padding: '12px', borderRadius: '12px',
                                    border: 'none', background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                                    color: 'white', fontWeight: '700', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <Printer size={18} />
                                {t('billing.thermal.billPrint', 'Print Receipt')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* === NEW: Bill Detail Modal with Deduction Overrides === */}
            {showBillModal && selectedBill && (() => {
                const isPaid = billPayments.some(p => p.farmer_id === selectedBill.farmer_id);
                const { deductions: effDeds, totalDeduction: effTotal, netAmount: effNet } = getEffectiveDeductions(selectedBill, deductionOverrides);
                return (
                    <div style={{ color: 'black', 
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.5)', zIndex: 9999,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backdropFilter: 'blur(4px)'
                     }} onClick={() => setShowBillModal(false)}>
                        <div style={{ color: 'black', 
                            background: 'white', borderRadius: '24px', width: '95%', maxWidth: '640px',
                            maxHeight: '90vh', overflow: 'auto',
                            boxShadow: '0 25px 50px rgba(0,0,0,0.25)'
                         }} onClick={e => e.stopPropagation()}>
                            {/* Modal Header */}
                            <div style={{ color: 'black', 
                                padding: '24px 28px 16px', borderBottom: '1px solid #f1f5f9',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                             }}>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: 'black' }}>
                                        {selectedBill.farmer_name}
                                    </h2>
                                    <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'black' }}>
                                        #{selectedBill.farmer_code} • {selectedBill.collection_count} {t('billing.table.collections', { defaultValue: 'collections' })}
                                    </p>
                                </div>
                                <button onClick={() => setShowBillModal(false)} style={{
                                    background: '#f1f5f9', border: 'none', borderRadius: '12px',
                                    padding: '8px', cursor: 'pointer', color: 'black'
                                }}>
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Gross Amount Card */}
                            <div style={{ color: 'black',  padding: '16px 28px'  }}>
                                <div style={{ color: 'black', 
                                    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px'
                                 }}>
                                    <div style={{ color: 'black', 
                                        background: 'transparent', borderRadius: '14px', padding: '14px',
                                        border: '1px solid #e2e8f0'
                                     }}>
                                        <p style={{ margin: 0, fontSize: '12px', color: 'black', fontWeight: '600' }}>
                                            {t('billing.metrics.quantity', { defaultValue: 'Quantity' })}
                                        </p>
                                        <p style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: '800', color: 'black' }}>
                                            {selectedBill.total_quantity} L
                                        </p>
                                    </div>
                                    <div style={{ color: 'black', 
                                        background: '#fef3c7', borderRadius: '14px', padding: '14px',
                                        border: '1px solid #fde68a'
                                     }}>
                                        <p style={{ margin: 0, fontSize: '12px', color: '#92400e', fontWeight: '600' }}>
                                            {t('billing.metrics.grossAmount', { defaultValue: 'Gross' })}
                                        </p>
                                        <p style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: '800', color: '#92400e' }}>
                                            ₹{selectedBill.total_amount}
                                        </p>
                                    </div>
                                    <div style={{ color: 'black', 
                                        background: '#dcfce7', borderRadius: '14px', padding: '14px',
                                        border: '1px solid #bbf7d0'
                                     }}>
                                        <p style={{ margin: 0, fontSize: '12px', color: '#15803d', fontWeight: '600' }}>
                                            {t('billing.metrics.netPayable', { defaultValue: 'Net Payable' })}
                                        </p>
                                        <p style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: '800', color: '#059669' }}>
                                            ₹{effNet.toFixed(2)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Thev Balance Card(s) — one per Thev scheme */}
                            {(selectedBill.thev_entries && selectedBill.thev_entries.length > 0
                                ? selectedBill.thev_entries
                                : (parseFloat(selectedBill.thev_total_balance || 0) > 0 || parseFloat(selectedBill.thev_period_deduction || 0) > 0)
                                    ? [{ schemeName: selectedBill.thev_scheme_name || 'ठेव', balance: selectedBill.thev_total_balance, periodDeduction: selectedBill.thev_period_deduction }]
                                    : []
                            ).map((te, tIdx) => (
                                <div key={tIdx} style={{ padding: tIdx === 0 ? '0 28px 8px' : '0 28px 6px' }}>
                                    <div style={{
                                        background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)',
                                        borderRadius: '14px', padding: '12px 18px',
                                        border: '1px solid #c4b5fd',
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ fontSize: '20px' }}>🐷</span>
                                            <div>
                                                <div style={{ fontSize: '12px', color: '#6d28d9', fontWeight: '700' }}>{te.schemeName}</div>
                                                <div style={{ fontSize: '10px', color: '#7c3aed', marginTop: '1px' }}>
                                                    {parseFloat(te.balance || 0) > 0 ? 'एकूण ठेव शिल्लक' : 'या बिलातील ठेव जमा'}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '20px', fontWeight: '800', color: '#5b21b6' }}>
                                            ₹{parseFloat(te.balance || 0) > 0 ? te.balance : te.periodDeduction}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Deductions Section */}
                            {effDeds.length > 0 && (
                                <div style={{ color: 'black',  padding: '0 28px 16px'  }}>
                                    <h3 style={{
                                        fontSize: '15px', fontWeight: '700', color: 'black',
                                        margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px'
                                    }}>
                                        <IndianRupee size={16} />
                                        {t('billing.billPrint.deduction', { defaultValue: 'Deductions' })}
                                        <span style={{ 
                                            fontSize: '12px', color: 'black', fontWeight: '800',
                                            marginLeft: 'auto'
                                         }}>
                                            -{`₹${effTotal.toFixed(2)}`}
                                        </span>
                                    </h3>
                                    <div style={{ color: 'black',  display: 'flex', flexDirection: 'column', gap: '8px'  }}>
                                        {effDeds.map((d, idx) => {
                                            const isEnabled = d.isEnabled;
                                            const isEditing = editingDeduction === d.id;
                                            return (
                                                <div key={d.id || idx} style={{ color: 'black', 
                                                    display: 'flex', flexDirection: 'column', gap: '0',
                                                    padding: '12px 16px',
                                                    background: isEnabled ? '#ffffff' : '#f9fafb',
                                                    borderRadius: '14px',
                                                    border: isEnabled ? '1px solid #e2e8f0' : '1px solid #f1f5f9',
                                                    opacity: isEnabled ? 1 : 0.6,
                                                    transition: 'all 0.2s'
                                                 }}>
                                                    {/* Top row: toggle + name + amount */}
                                                    <div style={{ color: '#6b7280', display: 'flex', alignItems: 'center', gap: '12px'  }}>
                                                    {/* Toggle Switch */}
                                                    {!isPaid && (
                                                        <button
                                                            onClick={() => toggleDeductionEnabled(d.id)}
                                                            style={{
                                                                background: 'none', border: 'none', cursor: 'pointer',
                                                                padding: '2px', display: 'flex', alignItems: 'center',
                                                                color: isEnabled ? '#10b981' : '#d1d5db'
                                                            }}
                                                            title={isEnabled ? 'Disable deduction' : 'Enable deduction'}
                                                        >
                                                            {isEnabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                                                        </button>
                                                    )}

                                                    {/* Deduction Info */}
                                                    <div style={{ color: 'black',  flex: 1  }}>
                                                        <div style={{
                                                            fontSize: '14px', fontWeight: '700', color: 'black',
                                                            textDecoration: isEnabled ? 'none' : 'line-through'
                                                        }}>
                                                            {d.name}
                                                        </div>
                                                        {d.type && <div style={{ fontSize: '11px', color: 'black', marginTop: '1px', textTransform: 'capitalize' }}>{d.type}</div>}
                                                    </div>

                                                    {/* Amount / Edit */}
                                                    {isEditing ? (
                                                        <div style={{ color: '#6b7280', display: 'flex', alignItems: 'center', gap: '6px'  }}>
                                                            <input
                                                                type="text"
                                                                inputMode="decimal"
                                                                pattern="[0-9]*\.?[0-9]*"
                                                                value={tempAmount}
                                                                onChange={e => {
                                                                    const val = e.target.value;
                                                                    if (/^[0-9]*\.?[0-9]*$/.test(val)) {
                                                                        setTempAmount(val);
                                                                    }
                                                                }}
                                                                onKeyDown={e => { if (e.key === 'Enter') applyCustomAmount(d.id); if (e.key === 'Escape') setEditingDeduction(null); }}
                                                                autoFocus
                                                                style={{
                                                                    width: '90px', padding: '6px 10px',
                                                                    border: '2px solid #6366f1', borderRadius: '8px',
                                                                    fontSize: '14px', fontWeight: '700',
                                                                    textAlign: 'right', outline: 'none',
                                                                    appearance: 'none', MozAppearance: 'textfield',
                                                                    WebkitAppearance: 'none'
                                                                }}
                                                            />
                                                            <button onClick={() => applyCustomAmount(d.id)} style={{
                                                                background: '#10b981', color: 'white', border: 'none',
                                                                borderRadius: '8px', padding: '6px 10px',
                                                                cursor: 'pointer', fontWeight: '700', fontSize: '13px'
                                                            }}>✓</button>
                                                            <button onClick={() => setEditingDeduction(null)} style={{
                                                                background: '#f1f5f9', color: 'black', border: 'none',
                                                                borderRadius: '8px', padding: '6px 10px',
                                                                cursor: 'pointer', fontSize: '13px'
                                                            }}>✕</button>
                                                        </div>
                                                    ) : (
                                                        <div style={{ color: '#6b7280', display: 'flex', alignItems: 'center', gap: '8px'  }}>
                                                            <span style={{ 
                                                                fontSize: '16px', fontWeight: '800',
                                                                color: isEnabled ? '#ef4444' : '#94a3b8'
                                                             }}>
                                                                {isEnabled ? `-₹${formatMoney(d.effectiveAmount)}` : '₹0'}
                                                            </span>
                                                            {d.isCustom && (
                                                                <button onClick={() => resetCustomAmount(d.id)} style={{
                                                                    background: '#fef3c7', border: 'none', borderRadius: '6px',
                                                                    padding: '2px 6px', cursor: 'pointer', color: '#92400e',
                                                                    fontSize: '11px', fontWeight: '700'
                                                                }}>Reset</button>
                                                            )}
                                                            {!isPaid && isEnabled && (
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingDeduction(d.id);
                                                                        setTempAmount(d.effectiveAmount.toString());
                                                                    }}
                                                                    style={{
                                                                        background: '#f1f5f9', border: 'none',
                                                                        borderRadius: '8px', padding: '5px',
                                                                        cursor: 'pointer', color: '#6366f1',
                                                                        display: 'flex', alignItems: 'center'
                                                                    }}
                                                                    title="Edit amount"
                                                                >
                                                                        <Edit3 size={14} />
                                                                    </button>
                                                            )}
                                                        </div>
                                                    )}
                                                    </div>

                                                    {/* Row 2: मागील बाकी / चालू कपात / येणे बाकी */}
                                                    {(d.prevBalance || d.remaining) && isEnabled && (
                                                        <div style={{ color: 'black', 
                                                            display: 'flex', width: '100%',
                                                            marginTop: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '10px',
                                                            borderRadius: '10px', overflow: 'hidden',
                                                            background: 'transparent', border: '1px solid #e2e8f0'
                                                         }}>
                                                            <div style={{ color: 'black',  flex: 1, textAlign: 'center', padding: '6px 4px'  }}>
                                                                <div style={{ fontSize: '10px', color: 'black', fontWeight: '600', letterSpacing: '0.3px' }}>
                                                                    {t('billing.billPrint.previousBalance', { defaultValue: 'मागील बाकी' })}
                                                                </div>
                                                                <div style={{  fontSize: '14px', fontWeight: '800', color: 'black', marginTop: '3px'  }}>
                                                                    {d.prevBalance ? `₹${formatMoney(d.prevBalance, 2, { truncate: true })}` : '—'}
                                                                </div>
                                                            </div>
                                                            <div style={{ color: 'black',  width: '1px', background: '#e2e8f0', margin: '6px 0'  }} />
                                                            <div style={{ color: 'black',  flex: 1, textAlign: 'center', padding: '6px 4px'  }}>
                                                                <div style={{ fontSize: '10px', color: 'black', fontWeight: '600', letterSpacing: '0.3px' }}>
                                                                    {t('billing.billPrint.currentDeduction', { defaultValue: 'चालू कपात' })}
                                                                </div>
                                                                <div style={{  fontSize: '14px', fontWeight: '800', color: 'black', marginTop: '3px'  }}>
                                                                    {`-₹${formatMoney(d.effectiveAmount)}`}
                                                                </div>
                                                            </div>
                                                            <div style={{ color: 'black',  width: '1px', background: '#e2e8f0', margin: '6px 0'  }} />
                                                            <div style={{ color: 'black',  flex: 1, textAlign: 'center', padding: '6px 4px'  }}>
                                                                <div style={{ fontSize: '10px', color: 'black', fontWeight: '600', letterSpacing: '0.3px' }}>
                                                                    {t('billing.billPrint.remainingBalance', { defaultValue: 'येणे बाकी' })}
                                                                </div>
                                                                <div style={{  fontSize: '14px', fontWeight: '800', color: 'black', marginTop: '3px'  }}>
                                                                    {d.remaining ? `₹${formatMoney(d.remaining, 2, { truncate: true })}` : '—'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Modal Footer / Actions */}
                            <div style={{ color: 'black', 
                                padding: '16px 28px 24px',
                                borderTop: '1px solid #f1f5f9',
                                display: 'flex', gap: '10px'
                             }}>
                                <button
                                    onClick={() => exportIndividualBill(getBillWithOverrides(selectedBill), true)}
                                    style={{
                                        flex: 1, padding: '12px', borderRadius: '14px',
                                        border: '1px solid #e2e8f0', background: 'white',
                                        color: 'black', fontWeight: '600', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                        fontSize: '14px', transition: 'all 0.2s'
                                    }}
                                >
                                    <Eye size={18} />
                                    {t('billing.tooltips.view', { defaultValue: 'View Bill' })}
                                </button>
                                <button
                                    onClick={() => exportIndividualBill(getBillWithOverrides(selectedBill))}
                                    style={{
                                        flex: 1, padding: '12px', borderRadius: '14px',
                                        border: '1px solid #e2e8f0', background: 'white',
                                        color: 'black', fontWeight: '600', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                        fontSize: '14px', transition: 'all 0.2s'
                                    }}
                                >
                                    <Download size={18} />
                                    {t('billing.tooltips.export', { defaultValue: 'Download' })}
                                </button>
                                {isPaid ? (
                                    <button
                                        onClick={() => { setShowBillModal(false); handleMarkUnpaid(selectedBill); }}
                                        style={{
                                            flex: 1, padding: '12px', borderRadius: '14px',
                                            border: 'none',
                                            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                            color: 'white', fontWeight: '700', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                            fontSize: '14px',
                                            boxShadow: '0 4px 12px rgba(239,68,68,0.3)',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <XCircle size={18} />
                                        {t('billing.buttons.markUnpaid', { defaultValue: 'Revert' })}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleMarkPaid(selectedBill, deductionOverrides)}
                                        style={{
                                            flex: 1, padding: '12px', borderRadius: '14px',
                                            border: 'none',
                                            background: 'linear-gradient(135deg, #10b981, #059669)',
                                            color: 'white', fontWeight: '700', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                            fontSize: '14px',
                                            boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <CheckCircle size={18} />
                                        {t('billing.buttons.markPaid', { defaultValue: 'Mark as Paid' })}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}

            <AlertComponent />

            {/* ── Pay Loading Overlay ── */}
            {payLoading && (
                <div style={{ color: 'black', 
                    position: 'fixed', inset: 0, zIndex: 99999,
                    background: 'rgba(0,0,0,0.55)',
                    backdropFilter: 'blur(6px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'column', gap: '20px'
                 }}>
                    {/* Card */}
                    <div style={{ color: 'black', 
                        background: 'white', borderRadius: '24px',
                        padding: '40px 56px', boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px',
                        minWidth: '300px', textAlign: 'center'
                     }}>
                        {/* Animated spinner ring */}
                        <div style={{ color: 'black',  position: 'relative', width: '72px', height: '72px'  }}>
                            <svg viewBox="0 0 72 72" style={{
                                width: '72px', height: '72px',
                                animation: 'billingSpinAnim 1s linear infinite',
                                position: 'absolute', inset: 0
                            }}>
                                <circle cx="36" cy="36" r="30"
                                    fill="none" stroke="#e5e7eb" strokeWidth="5" />
                                <circle cx="36" cy="36" r="30"
                                    fill="none" stroke="#10b981" strokeWidth="5"
                                    strokeDasharray="60 130"
                                    strokeLinecap="round"
                                    strokeDashoffset="0" />
                            </svg>
                            {/* Center icon */}
                            <div style={{ color: 'black', 
                                position: 'absolute', inset: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                             }}>
                                <CheckCircle size={28} style={{ color: '#10b981' }} />
                            </div>
                        </div>

                        <div>
                            <p style={{
                                margin: '0 0 6px 0', fontSize: '18px', fontWeight: '700',
                                color: 'black'
                            }}>प्रक्रिया सुरू आहे...</p>
                            <p style={{
                                margin: 0, fontSize: '13px', color: 'black',
                                maxWidth: '260px', lineHeight: '1.5'
                            }}>{payLoadingMsg || 'कृपया थांबा...'}</p>
                        </div>

                        {/* Progress dots */}
                        <div style={{ color: 'black',  display: 'flex', gap: '6px'  }}>
                            {[0, 1, 2].map(i => (
                                <div key={i} style={{
                                    width: '8px', height: '8px', borderRadius: '50%',
                                    background: '#10b981',
                                    animation: `billingDotAnim 1.2s ease-in-out ${i * 0.2}s infinite`
                                }} />
                            ))}
                        </div>
                    </div>

                    {/* Inline keyframes */}
                    <style>{`
                        @keyframes billingSpinAnim {
                            from { transform: rotate(0deg); }
                            to { transform: rotate(360deg); }
                        }
                        @keyframes billingDotAnim {
                            0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
                            40% { opacity: 1; transform: scale(1.2); }
                        }
                    `}</style>
                </div>
            )}
        </div >
    );
}

export default Billing;
