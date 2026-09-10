import React, { useState, useEffect } from 'react';
import { DatePicker, Radio, Card, Space, Modal, Button } from 'antd';
const { RangePicker } = DatePicker;
import { useTranslation } from 'react-i18next';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas'; // For complex script rendering
import {
    FileText, Download, Loader2, CheckCircle, AlertCircle, X,
    FileSpreadsheet, File, Calendar, Users, TrendingUp,
    TriangleAlert, DollarSign, Activity, Package, Layers,
    Receipt, Landmark, PiggyBank, Filter, ChevronRight, Database,
    Calculator, FileBarChart, History, Printer
} from 'lucide-react';
import Loader from '../components/Loader';
import DifferenceBillModal from '../components/DifferenceBillModal';
import MilkCollectionReportModal from '../components/MilkCollectionReportModal';
import MemberStatementModal from '../components/MemberStatementModal';

import {
    getFarmers,
    getCollections,
    getRates,
    getMilkSales,
    getFederationReceipts,
    getFarmerDeductions,
    getBillPayments,
    getDeductionMasters,
    addDeductionMaster,
    assignDeduction
} from '../lib/api';

import dayjs from 'dayjs';
import 'dayjs/locale/hi';
import 'dayjs/locale/mr';

const Reports = ({ user }) => {
    const { t, i18n } = useTranslation();
    const [loading, setLoading] = useState(null); // 'pdf' | 'csv' | 'preset_id' | null
    const [status, setStatus] = useState(null); // { type: 'success' | 'error', message: '' }
    const [htmlReportData, setHtmlReportData] = useState(null); // Data for hidden HTML template

    const [dateMode, setDateMode] = useState('today'); // 'today' | 'single' | 'month' | 'range'
    const [selectedDate, setSelectedDate] = useState(dayjs());
    const [dateRange, setDateRange] = useState([dayjs().startOf('month'), dayjs().endOf('month')]);

    const [selectedPreset, setSelectedPreset] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDiffBillModalOpen, setIsDiffBillModalOpen] = useState(false);
    const [isMilkReportModalOpen, setIsMilkReportModalOpen] = useState(false);
    const [isMemberStatementModalOpen, setIsMemberStatementModalOpen] = useState(false);
    const [pdfPreview, setPdfPreview] = useState(null); // { url, title, fileName }
    const [farmerMilkFilter, setFarmerMilkFilter] = useState('All'); // 'All' | 'Buffalo' | 'Cow'
    const [dailyAnimalFilter, setDailyAnimalFilter] = useState('both'); // 'both' | 'cow' | 'buffalo'
    const [dailyDateMode, setDailyDateMode] = useState('single'); // 'single' | 'range'

    const formatCurrency = (amount) => {
        return 'Rs. ' + new Intl.NumberFormat('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount || 0);
    };

    useEffect(() => {
        if (htmlReportData && htmlReportData.fileName) {
            const generateHtmlPdf = async () => {
                // Increased delay to 1500ms for more stable rendering of complex/Devanagari tables
                await new Promise(resolve => setTimeout(resolve, 1500));
                try {
                    const element = document.getElementById('report-template');
                    if (!element) throw new Error("Template not found");

                    const canvas = await html2canvas(element, {
                        scale: 2, // Good quality without excessive size
                        backgroundColor: '#ffffff',
                        logging: false,
                        useCORS: true,
                        imageTimeout: 0
                    });

                    const pdf = new jsPDF('p', 'mm', 'a4');
                    const pdfWidth = pdf.internal.pageSize.getWidth();
                    const pageHeight = pdf.internal.pageSize.getHeight();

                    // Calculate how many canvas pixels = one PDF page
                    const canvasWidthPx = canvas.width;
                    const canvasHeightPx = canvas.height;
                    const scaledHeight = (canvasHeightPx * pdfWidth) / canvasWidthPx;
                    const pxPerPage = Math.floor(canvasHeightPx * (pageHeight / scaledHeight));

                    // Improved pagination: Detect manual page breaks (marker class)
                    const breakElements = element.querySelectorAll('.page-break-before');
                    const manualBreaks = Array.from(breakElements).map(el => {
                        // Calculate offset relative to the template container (element)
                        let offset = 0;
                        let curr = el;
                        while (curr && curr !== element) {
                            offset += curr.offsetTop;
                            curr = curr.offsetParent;
                        }
                        return offset * 2; // scale = 2
                    }).sort((a, b) => a - b);

                    let currentY = 0;
                    let pageIndex = 0;

                    while (currentY < canvasHeightPx) {
                        let sliceHeight = Math.min(pxPerPage, canvasHeightPx - currentY);

                        // If there's a manual break coming up before the natural page end, cut early
                        const nextBreak = manualBreaks.find(b => b > currentY && b < currentY + sliceHeight);
                        if (nextBreak) {
                            sliceHeight = nextBreak - currentY;
                        }

                        const pageCanvas = document.createElement('canvas');
                        pageCanvas.width = canvasWidthPx;
                        pageCanvas.height = sliceHeight;
                        const ctx = pageCanvas.getContext('2d');
                        ctx.drawImage(canvas, 0, currentY, canvasWidthPx, sliceHeight, 0, 0, canvasWidthPx, sliceHeight);

                        const pageImg = pageCanvas.toDataURL('image/jpeg', 0.85);
                        const imgH = (sliceHeight * pdfWidth) / canvasWidthPx;

                        if (pageIndex > 0) pdf.addPage();
                        pdf.addImage(pageImg, 'JPEG', 0, 0, pdfWidth, imgH);

                        currentY += sliceHeight;
                        pageIndex++;
                    }

                    // ✅ Show image preview (works perfectly in Electron - no PDF iframe issues)
                    const previewImg = canvas.toDataURL('image/jpeg', 0.5); // Lower quality OK for preview
                    const savePdf = () => pdf.save(`${htmlReportData.fileName}.pdf`);
                    const printPdf = async () => {
                        try {
                            // Use Electron native print dialog via IPC
                            if (window.electron && window.electron.invoke) {
                                const pdfBase64 = pdf.output('datauristring').split(',')[1];
                                await window.electron.invoke('print-pdf', pdfBase64);
                            } else {
                                // Fallback for non-Electron (browser dev mode)
                                window.print();
                            }
                        } catch (e) {
                            console.error('Print failed:', e);
                        }
                    };
                    setPdfPreview({ imgData: previewImg, title: htmlReportData.title, fileName: htmlReportData.fileName, savePdf, printPdf });


                    if (htmlReportData.postToDeductions) {
                        htmlReportData.postToDeductions();
                    }

                    setStatus({ type: 'success', message: t('reports.messages.success', { title: htmlReportData.title }) });
                    setHtmlReportData(null); // Clear
                } catch (err) {
                    console.error("HTML PDF Error", err);
                    setStatus({ type: 'error', message: "HTML Rendering Failed" });
                } finally {
                    setLoading(null);
                }
            };
            generateHtmlPdf();
        }
    }, [htmlReportData, t]);

    const addPdfHeader = (doc, title, subtitle = '') => {
        const pageWidth = doc.internal.pageSize.width;
        doc.setFillColor(79, 70, 229); // Indigo 600
        doc.rect(0, 0, pageWidth, 40, 'F');

        doc.setFontSize(22);
        doc.setTextColor(255, 255, 255);
        doc.text("DudhSakha", 14, 18);
        doc.setFontSize(16);
        doc.text(title, 14, 28);

        if (subtitle) {
            doc.setFontSize(10);
            doc.setTextColor(200, 200, 200);
            doc.text(subtitle, 14, 35);
        }

        doc.setFontSize(10);
        doc.setTextColor(200, 200, 200);
        doc.text(`${t('reports.generated')}: ${dayjs().format('DD MMM YYYY, HH:mm')}`, pageWidth - 14, 18, { align: 'right' });
        doc.text(t('reports.dairySystem'), pageWidth - 14, 28, { align: 'right' });

        return 45; // Return start Y for content
    };

    const generateReport = async (preset) => {
        setLoading(preset.id);
        setStatus({ type: 'info', message: t('reports.buttons.exporting') });
        try {
            const doc = new jsPDF();
            let fileName = `Report_${preset.id}_${dayjs().format('YYYY-MM-DD')}`;
            let startY = 45;

            let data = {};

            const promises = [];

            if (preset.id === 'difference_bill' || preset.id === 'milk_collection' || preset.id === 'member_statement') {
                promises.push(
                    getFarmers(user?.dairy_id).then(d => { data.farmers = d || []; })
                );
                promises.push(
                    getCollections(user?.dairy_id).then(d => { data.collections = d || []; })
                );
            }

            if (['farmers', 'backup', 'top_producers', 'payments', 'deductions'].includes(preset.id)) {
                promises.push(
                    getFarmers(user?.dairy_id).then(d => { data.farmers = d || []; })
                );
            }
            if (['daily', 'monthly', 'shift', 'low_quality', 'top_producers', 'backup', 'profit'].includes(preset.id)) {
                promises.push(
                    getCollections(user?.dairy_id).then(d => {

                        data.collections = d || [];
                    })
                );
            }
            if (['rates', 'backup'].includes(preset.id)) {
                promises.push(
                    getRates(user?.dairy_id).then(d => { data.rates = d || []; })
                );
            }
            if (['sales', 'backup'].includes(preset.id)) {
                promises.push(
                    getMilkSales(user?.dairy_id).then(d => { data.sales = d || []; })
                );
            }
            if (['deductions', 'backup'].includes(preset.id)) {
                promises.push(
                    getFarmerDeductions(user?.dairy_id).then(d => {
                        data.deductions = d || [];
                    })
                );
            }
            if (['federation', 'profit', 'backup'].includes(preset.id)) {
                promises.push(
                    getFederationReceipts(user?.dairy_id).then(d => { data.federation = d || []; })
                );
            }
            if (['payments', 'backup'].includes(preset.id)) {
                promises.push(
                    getBillPayments({ dairy_id: user?.dairy_id }).then(d => { data.payments = d || []; })
                );
            }

            await Promise.all(promises);

            if (data.payments && data.farmers) {
                data.payments = data.payments.map(p => {
                    const farmer = data.farmers.find(f => f.id === p.farmer_id);
                    return {
                        ...p,
                        farmer_name: farmer?.name,
                        farmer_code: farmer?.code
                    };
                });
            }

            const isIndic = i18n.language === 'hi' || i18n.language === 'mr';
            if (isIndic) {
                try {
                    const { loadDevanagariFont } = await import('../utils/pdfFonts');
                    await loadDevanagariFont(doc);
                } catch (e) {
                    console.error("Failed to load Indic font", e);
                }
            }



            startY = addPdfHeader(doc, preset.title, preset.description);
            doc.setTextColor(0, 0, 0); // Reset text color to black for content



            let start = dayjs();
            let end = dayjs();
            let dateTitle = dayjs().format('DD/MM/YYYY');

            // For custom-modal reports, date range comes from customValues
            if (['difference_bill', 'milk_collection', 'member_statement'].includes(preset.id) && preset.customValues?.dateRange) {
                start = dayjs(preset.customValues.dateRange[0]);
                end = dayjs(preset.customValues.dateRange[1]);
                dateTitle = `${start.format('DD/MM/YYYY')} - ${end.format('DD/MM/YYYY')}`;
            } else if (dateMode === 'single') {
                start = selectedDate;
                end = selectedDate;
                dateTitle = selectedDate.format('DD/MM/YYYY');
            } else if (dateMode === 'month') {
                start = selectedDate.startOf('month');
                end = selectedDate.endOf('month');
                dateTitle = selectedDate.format('MMMM YYYY');
            } else if (dateMode === 'range' && dateRange) {
                start = dateRange[0];
                end = dateRange[1];
                dateTitle = `${start.format('DD/MM/YYYY')} - ${end.format('DD/MM/YYYY')}`;
            }

            {

                let filteredCollections = data.collections || [];
                let filteredSales = data.sales || [];
                let filteredFederation = data.federation || [];
                let filteredPayments = data.payments || [];





                const sStr = start.format('YYYY-MM-DD');
                const eStr = end.format('YYYY-MM-DD');

                let filteredDeductions = data.deductions || [];

                if (['daily', 'monthly', 'profit', 'low_quality', 'sales', 'federation', 'payments', 'shift', 'top_producers', 'deductions', 'difference_bill', 'milk_collection', 'member_statement'].includes(preset.id)) {
                    filteredCollections = (data.collections || []).filter(c => c.date >= sStr && c.date <= eStr);
                    filteredSales = (data.sales || []).filter(s => s.sale_date >= sStr && s.sale_date <= eStr);
                    filteredFederation = (data.federation || []).filter(r => r.receipt_date >= sStr && r.receipt_date <= eStr);
                    filteredPayments = (data.payments || []).filter(p => p.payment_date >= sStr && p.payment_date <= eStr);
                    filteredDeductions = (data.deductions || []).filter(d => d.date >= sStr && d.date <= eStr);
                }

                if (preset.id === 'difference_bill') {
                    const fromCode = parseInt(preset.customValues?.fromCode || 0, 10);
                    const toCode = parseInt(preset.customValues?.toCode || 999999, 10);
                    const farmersInRange = (data.farmers || [])
                        .filter(f => parseInt(f.code) >= fromCode && parseInt(f.code) <= toCode)
                        .sort((a, b) => parseInt(a.code) - parseInt(b.code));

                    const tableRows = [];
                    const postingData = [];
                    let totalLitersSum = 0;
                    let totalAmountSum = 0;
                    let totalBillAmountSum = 0;

                    farmersInRange.forEach(farmer => {
                        const farmerCollections = filteredCollections.filter(c => c.farmer_id === farmer.id);
                        if (farmerCollections.length === 0) return;

                        const totalLiters = farmerCollections.reduce((sum, c) => sum + (parseFloat(c.quantity) || 0), 0);
                        const totalAmount = farmerCollections.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);

                        let billAmount = 0;
                        if (preset.customValues?.calcType === 'amount') {
                            const pct = parseFloat(preset.customValues?.percentage || 0);
                            billAmount = totalAmount * (pct / 100);
                        } else {
                            const rate = parseFloat(preset.customValues?.fixedAmount || 0);
                            billAmount = totalLiters * rate;
                        }

                        totalLitersSum += totalLiters;
                        totalAmountSum += totalAmount;
                        totalBillAmountSum += billAmount;
                        tableRows.push({ code: farmer.code, name: farmer.name, liters: totalLiters.toFixed(3), amount: formatCurrency(totalAmount), bill: formatCurrency(billAmount) });
                        if (billAmount > 0) postingData.push({ farmer_id: farmer.id, amount: billAmount });
                    });

                    if (tableRows.length === 0) {
                        setStatus({ type: 'error', message: 'No data found. Please check the date range and farmer code range.' });
                        setLoading(null);
                        return;
                    }

                    const modeStr = preset.customValues?.mode === 'posting' ? (isIndic ? 'पोस्टिंग' : 'POSTING') : (isIndic ? 'ट्रायल' : 'TRIAL');
                    const calcStr = preset.customValues?.calcType === 'amount'
                        ? `${isIndic ? 'रकमेवर' : 'Amount'} @ ${preset.customValues?.percentage}%`
                        : `${isIndic ? 'प्रति लिटर' : 'Per Litre'} @ Rs.${preset.customValues?.fixedAmount}`;

                    const farmerSlips = farmersInRange.map(farmer => {
                        const farmerCollections = filteredCollections.filter(c => c.farmer_id === farmer.id);
                        if (farmerCollections.length === 0) return null;

                        const totalLiters = farmerCollections.reduce((sum, c) => sum + (parseFloat(c.quantity) || 0), 0);
                        const totalAmount = farmerCollections.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);

                        let billAmount = 0;
                        if (preset.customValues?.calcType === 'amount') {
                            const pct = parseFloat(preset.customValues?.percentage || 0);
                            billAmount = totalAmount * (pct / 100);
                        } else {
                            const rate = parseFloat(preset.customValues?.fixedAmount || 0);
                            billAmount = totalLiters * rate;
                        }

                        return {
                            code: farmer.code,
                            name: farmer.name,
                            liters: totalLiters.toFixed(3),
                            amount: totalAmount,
                            billAmount: billAmount,
                            dateTitle: dateTitle,
                            calcStr: calcStr
                        };
                    }).filter(Boolean);

                    setHtmlReportData({
                        fileName,
                        title: isIndic ? 'फरक बिल' : 'Difference Bill',
                        subtitle: `${dateTitle} | ${calcStr} | ${isIndic ? 'स्थिती' : 'Mode'}: ${modeStr}`,
                        color: '#1e293b',
                        date: dateTitle,
                        summary: [
                            { label: isIndic ? 'एकूण लिटर' : 'Total Liters', value: `${totalLitersSum.toFixed(3)} L` },
                            { label: isIndic ? 'एकूण रक्कम' : 'Total Amount', value: formatCurrency(totalAmountSum) },
                            { label: isIndic ? 'फरक बिल' : 'Diff Bill', value: formatCurrency(totalBillAmountSum) },
                            { label: isIndic ? 'उत्पादक' : 'Farmers', value: tableRows.length },
                        ],
                        headers: isIndic ? ['कोड', 'उत्पादकाचे नाव', 'एकूण लिटर', 'एकूण रक्कम', 'बिल रक्कम'] : ['Code', 'Farmer Name', 'Total Liters', 'Total Amount', 'Bill Amount'],
                        rows: [
                            ...tableRows.map(r => [r.code, r.name, r.liters, r.amount, r.bill]),
                            ['', isIndic ? 'एकूण' : 'TOTAL', totalLitersSum.toFixed(3), formatCurrency(totalAmountSum), formatCurrency(totalBillAmountSum)]
                        ],
                        farmerSlips: farmerSlips
                    });
                    return;
                }

                if (preset.id === 'milk_collection') {
                    const shiftFilter = preset.customValues?.time || 'both';
                    const animalFilter = preset.customValues?.animal || 'both';

                    let filtered = [...filteredCollections].sort((a, b) => a.date.localeCompare(b.date) || (a.shift || '').localeCompare(b.shift || ''));
                    if (shiftFilter !== 'both') filtered = filtered.filter(c => (c.shift || '').toLowerCase() === shiftFilter.toLowerCase());
                    if (animalFilter !== 'both') filtered = filtered.filter(c => (c.milk_type || '').toLowerCase() === animalFilter.toLowerCase());

                    if (filtered.length === 0) {
                        setStatus({ type: 'error', message: 'No milk collection records found for the selected filters.' });
                        setLoading(null);
                        return;
                    }

                    const totalQty = filtered.reduce((s, c) => s + (parseFloat(c.quantity) || 0), 0);
                    const totalAmt = filtered.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);
                    const shiftLabel = isIndic
                        ? (shiftFilter === 'both' ? 'सकाळ व संध्याकाळ' : shiftFilter === 'morning' ? 'सकाळ' : 'संध्याकाळ')
                        : (shiftFilter === 'both' ? 'Morning & Evening' : shiftFilter === 'morning' ? 'Morning' : 'Evening');
                    const animalLabel = isIndic
                        ? (animalFilter === 'both' ? 'गाय व म्हैस' : animalFilter === 'cow' ? 'गाय' : 'म्हैस')
                        : (animalFilter === 'both' ? 'Cow & Buffalo' : animalFilter === 'cow' ? 'Cow' : 'Buffalo');

                    const milkRows = filtered.map(c => [
                        dayjs(c.date).format('DD/MM/YY'),
                        isIndic ? (c.shift === 'Morning' ? 'सकाळ' : 'संध्याकाळ') : (c.shift === 'Morning' ? 'Morn' : 'Even'),
                        c.farmer_code || '-',
                        c.farmer_name || '-',
                        isIndic ? (c.milk_type === 'Cow' ? 'गाय' : 'म्हैस') : (c.milk_type === 'Cow' ? 'Cow' : 'Buf'),
                        Number(c.quantity || 0).toFixed(3),
                        Number(c.fat || 0).toFixed(1),
                        Number(c.snf || 0).toFixed(1),
                        Number(c.rate || 0).toFixed(2),
                        formatCurrency(c.amount)
                    ]);

                    setHtmlReportData({
                        fileName,
                        title: isIndic ? 'दुध खरेदी नोंदणी' : 'Milk Collection Report',
                        subtitle: `${dateTitle} | ${shiftLabel} | ${animalLabel}`,
                        color: '#1e293b',
                        date: dateTitle,
                        summary: [
                            { label: isIndic ? 'नोंदी' : 'Records', value: filtered.length },
                            { label: isIndic ? 'एकूण लिटर' : 'Total Liters', value: `${totalQty.toFixed(3)} L` },
                            { label: isIndic ? 'एकूण रक्कम' : 'Total Amount', value: formatCurrency(totalAmt) },
                        ],
                        headers: isIndic
                            ? ['दिनांक', 'वेळ', 'कोड', 'उत्पादक', 'प्रकार', 'लिटर', 'फॅट', 'SNF', 'दर', 'रक्कम']
                            : ['Date', 'Shift', 'Code', 'Farmer', 'Animal', 'Liters', 'Fat', 'SNF', 'Rate', 'Amount'],
                        rows: [
                            ...milkRows,
                            ['', '', '', '', isIndic ? 'एकूण' : 'TOTAL', totalQty.toFixed(3), '', '', '', formatCurrency(totalAmt)]
                        ],
                    });
                    return;
                }

                if (preset.id === 'member_statement') {
                    const code = String(preset.customValues?.farmerCode || '').trim();
                    const farmer = (data.farmers || []).find(f => String(f.code).trim() === code);

                    if (!farmer) {
                        setStatus({ type: 'error', message: `Farmer with code "${code}" not found.` });
                        setLoading(null);
                        return;
                    }

                    const farmerCollections = filteredCollections.filter(c => c.farmer_id === farmer.id);
                    const animalFilter = preset.customValues?.animal || 'both';
                    const reportType = preset.customValues?.reportType || 'detailed';

                    let filtered = [...farmerCollections].sort((a, b) => a.date.localeCompare(b.date));
                    if (animalFilter !== 'both') filtered = filtered.filter(c => (c.milk_type || '').toLowerCase() === animalFilter.toLowerCase());

                    if (filtered.length === 0) {
                        setStatus({ type: 'error', message: `No collection records found for farmer ${code} in this date range.` });
                        setLoading(null);
                        return;
                    }

                    // Fetch Bills for history section
                    const startD = dateRange[0].format('YYYY-MM-DD');
                    const endD = dateRange[1].format('YYYY-MM-DD');
                    const bills = await getBillPayments({ dairy_id: user.dairy_id, farmerId: farmer.id, startDate: startD, endDate: endD });

                    const totalQty = filtered.reduce((s, c) => s + (parseFloat(c.quantity) || 0), 0);
                    const totalAmt = filtered.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);
                    // Weighted average by liters, truncated (not rounded) so 3.98 → 3.9
                    const avgFat = totalQty > 0 ? Math.floor(filtered.reduce((s, c) => s + (parseFloat(c.fat) || 0) * (parseFloat(c.quantity) || 0), 0) / totalQty * 10) / 10 : 0;
                    const avgSnf = totalQty > 0 ? Math.floor(filtered.reduce((s, c) => s + (parseFloat(c.snf) || 0) * (parseFloat(c.quantity) || 0), 0) / totalQty * 10) / 10 : 0;
                    const rtLabel = reportType === 'monthly' ? (isIndic ? 'मासिक' : 'Monthly') : reportType === 'summary' ? (isIndic ? 'बिलाप्रमाणे' : 'Bill-wise') : (isIndic ? 'सविस्तर' : 'Detailed');

                    let tableHeaders, tableRows, sections = null;

                    if (reportType === 'detailed') {
                        tableHeaders = isIndic
                            ? ['दिनांक', 'वेळ', 'प्रकार', 'लिटर', 'फॅट', 'SNF', 'दर', 'रक्कम']
                            : ['Date', 'Shift', 'Animal', 'Liters', 'Fat', 'SNF', 'Rate', 'Amount'];
                        tableRows = [
                            ...filtered.map(c => [
                                dayjs(c.date).format('DD/MM/YY'),
                                isIndic ? (c.shift === 'Morning' ? 'सकाळ' : 'सं.') : (c.shift === 'Morning' ? 'Morn' : 'Even'),
                                isIndic ? (c.milk_type === 'Cow' ? 'गाय' : 'म्हैस') : (c.milk_type === 'Cow' ? 'Cow' : 'Buf'),
                                Number(c.quantity || 0).toFixed(3),
                                Number(c.fat || 0).toFixed(1),
                                Number(c.snf || 0).toFixed(1),
                                Number(c.rate || 0).toFixed(2),
                                formatCurrency(c.amount)
                            ]),
                            ['', '', isIndic ? 'एकूण' : 'TOTAL', totalQty.toFixed(3), avgFat.toFixed(1), avgSnf.toFixed(1), '', formatCurrency(totalAmt)]
                        ];
                    } else if (reportType === 'summary') {
                        // "Summary" is "Bill-wise" - user wants multi-section here
                        // byDate: accumulate qty-weighted fat/snf sums for correct daily averages
                        const byDate = {};
                        filtered.forEach(c => {
                            const d = c.date;
                            if (!byDate[d]) byDate[d] = { mQty: 0, mAmt: 0, eQty: 0, eAmt: 0, qty: 0, amt: 0, fatQtySum: 0, snfQtySum: 0 };
                            const qty = parseFloat(c.quantity) || 0; const amt = parseFloat(c.amount) || 0;
                            byDate[d].qty += qty; byDate[d].amt += amt;
                            byDate[d].fatQtySum += (parseFloat(c.fat) || 0) * qty;
                            byDate[d].snfQtySum += (parseFloat(c.snf) || 0) * qty;
                            if ((c.shift || '').toLowerCase() === 'morning') { byDate[d].mQty += qty; byDate[d].mAmt += amt; }
                            else { byDate[d].eQty += qty; byDate[d].eAmt += amt; }
                        });

                        const dailyRows = Object.entries(byDate).sort().map(([d, v]) => [
                            dayjs(d).format('DD/MM/YY'),
                            v.mQty > 0 ? v.mQty.toFixed(3) : '-', v.mQty > 0 ? formatCurrency(v.mAmt) : '-',
                            v.eQty > 0 ? v.eQty.toFixed(3) : '-', v.eQty > 0 ? formatCurrency(v.eAmt) : '-',
                            v.qty.toFixed(3),
                            v.qty > 0 ? (Math.floor(v.fatQtySum / v.qty * 10) / 10).toFixed(1) : '0.0',
                            v.qty > 0 ? (Math.floor(v.snfQtySum / v.qty * 10) / 10).toFixed(1) : '0.0',
                            formatCurrency(v.amt)
                        ]);

                        // byMonth: accumulate qty-weighted fat/snf sums for correct monthly averages
                        const byMonth = {};
                        filtered.forEach(c => {
                            const key = dayjs(c.date).format('YYYY-MM');
                            if (!byMonth[key]) byMonth[key] = { entries: 0, qty: 0, amt: 0, fatQtySum: 0, snfQtySum: 0 };
                            byMonth[key].entries++;
                            const qty = parseFloat(c.quantity) || 0;
                            byMonth[key].qty += qty;
                            byMonth[key].amt += parseFloat(c.amount) || 0;
                            byMonth[key].fatQtySum += (parseFloat(c.fat) || 0) * qty;
                            byMonth[key].snfQtySum += (parseFloat(c.snf) || 0) * qty;
                        });

                        const monthlyRows = Object.entries(byMonth).sort().map(([k, m]) => [
                            dayjs(k + '-01').format('MMM YYYY'), m.entries, m.qty.toFixed(3),
                            m.qty > 0 ? (Math.floor(m.fatQtySum / m.qty * 10) / 10).toFixed(1) : '0.0',
                            m.qty > 0 ? (Math.floor(m.snfQtySum / m.qty * 10) / 10).toFixed(1) : '0.0',
                            formatCurrency(m.amt)
                        ]);

                        const billRows = (bills || []).map(b => [
                            dayjs(b.payment_date).format('DD/MM/YY'),
                            `${dayjs(b.start_date).format('DD/MM')} - ${dayjs(b.end_date).format('DD/MM')}`,
                            formatCurrency(b.amount),
                            formatCurrency(JSON.parse(b.deductions_summary || '[]').reduce((s, d) => s + (parseFloat(d.amount) || 0), 0)),
                            formatCurrency(b.amount - JSON.parse(b.deductions_summary || '[]').reduce((s, d) => s + (parseFloat(d.amount) || 0), 0))
                        ]);

                        sections = [
                            {
                                title: isIndic ? 'प्रतिदिन संकलन तपशील' : 'Daily Collection Details',
                                headers: isIndic ? ['दिनांक', 'स. लिटर', 'स. रक्कम', 'सं. लिटर', 'सं. रक्कम', 'ए. लि.', 'फॅट', 'SNF', 'रक्कम'] : ['Date', 'Morn L', 'Morn Rs', 'Even L', 'Even Rs', 'Tot L', 'Fat', 'SNF', 'Rs'],
                                rows: [...dailyRows, [isIndic ? 'एकूण' : 'TOTAL', '', '', '', '', totalQty.toFixed(3), avgFat.toFixed(1), avgSnf.toFixed(1), formatCurrency(totalAmt)]]
                            },
                            {
                                title: isIndic ? 'मासिक अहवाल' : 'Monthly Summary',
                                headers: isIndic ? ['महिना', 'नोंदी', 'एकूण लिटर', 'सर. फॅट', 'सर. SNF', 'एकूण रक्कम'] : ['Month', 'Entries', 'Total Liters', 'Avg Fat', 'Avg SNF', 'Total Amount'],
                                rows: [...monthlyRows, [isIndic ? 'एकूण' : 'TOTAL', filtered.length, totalQty.toFixed(3), avgFat.toFixed(1), avgSnf.toFixed(1), formatCurrency(totalAmt)]]
                            },
                            {
                                title: isIndic ? 'बिल तपशील' : 'Bill History',
                                headers: isIndic ? ['पेमेंट दिनांक', 'कालावधी', 'मोठ रक्कम', 'कपात', 'निव्वळ रक्कम'] : ['Payment Date', 'Period', 'Gross Amt', 'Deduction', 'Net Amount'],
                                rows: billRows.length > 0 ? billRows : [[isIndic ? 'नोंद नाही' : 'No records found', '', '', '', '']]
                            }
                        ];
                    } else { // monthly type
                        tableHeaders = isIndic
                            ? ['महिना', 'नोंदी', 'एकूण लिटर', 'सर. फॅट', 'सर. SNF', 'एकूण रक्कम']
                            : ['Month', 'Entries', 'Total Liters', 'Avg Fat', 'Avg SNF', 'Total Amount'];
                        // byMonth (monthly report): qty-weighted fat/snf averages
                        const byMonth = {};
                        filtered.forEach(c => {
                            const key = dayjs(c.date).format('YYYY-MM');
                            if (!byMonth[key]) byMonth[key] = { entries: 0, qty: 0, amt: 0, fatQtySum: 0, snfQtySum: 0 };
                            byMonth[key].entries++;
                            const qty = parseFloat(c.quantity) || 0;
                            byMonth[key].qty += qty;
                            byMonth[key].amt += parseFloat(c.amount) || 0;
                            byMonth[key].fatQtySum += (parseFloat(c.fat) || 0) * qty;
                            byMonth[key].snfQtySum += (parseFloat(c.snf) || 0) * qty;
                        });
                        tableRows = [
                            ...Object.entries(byMonth).sort().map(([k, m]) => [
                                dayjs(k + '-01').format('MMM YYYY'), m.entries, m.qty.toFixed(3),
                                m.qty > 0 ? (Math.floor(m.fatQtySum / m.qty * 10) / 10).toFixed(1) : '0.0',
                                m.qty > 0 ? (Math.floor(m.snfQtySum / m.qty * 10) / 10).toFixed(1) : '0.0',
                                formatCurrency(m.amt)
                            ]),
                            [isIndic ? 'एकूण' : 'TOTAL', filtered.length, totalQty.toFixed(3), avgFat.toFixed(1), avgSnf.toFixed(1), formatCurrency(totalAmt)]
                        ];
                    }

                    setHtmlReportData({
                        fileName,
                        title: isIndic ? 'वैयक्तिक खतावणी' : 'Member Statement',
                        subtitle: `${isIndic ? 'कालावधी' : 'Period'}: ${dateTitle} | ${isIndic ? 'रिपोर्ट' : 'Type'}: ${rtLabel}`,
                        color: '#1e293b',
                        date: dateTitle,
                        summary: [
                            { label: isIndic ? 'उत्पादक' : 'Farmer', value: `${farmer.name} (${farmer.code})` },
                            { label: isIndic ? 'नोंदी' : 'Entries', value: filtered.length },
                            { label: isIndic ? 'एकूण लिटर' : 'Total Liters', value: `${totalQty.toFixed(3)} L` },
                            { label: isIndic ? 'एकूण रक्कम' : 'Total Amount', value: formatCurrency(totalAmt) },
                            { label: isIndic ? 'सर. फॅट' : 'Avg Fat', value: avgFat.toFixed(1) },
                            { label: isIndic ? 'सर. SNF' : 'Avg SNF', value: avgSnf.toFixed(1) },
                        ],
                        headers: tableHeaders,
                        rows: tableRows,
                        sections: sections,
                        bgColor: '#f8fafc'
                    });
                    return;
                }



                if (preset.id === 'daily') {
                    // Apply animal filter
                    const dailyAnimalFilter = preset.dailyAnimalFilter || 'both';
                    let dailyData = filteredCollections;
                    if (dailyAnimalFilter === 'cow') {
                        dailyData = dailyData.filter(c => (c.milk_type || '').toLowerCase() === 'cow');
                    } else if (dailyAnimalFilter === 'buffalo') {
                        dailyData = dailyData.filter(c => (c.milk_type || '').toLowerCase() === 'buffalo');
                    }

                    if (dailyData.length === 0 && dateMode === 'today') dailyData = data.collections.slice(0, 50);

                    // Sort: Morning first, then Evening; within each shift sort by farmer code ascending
                    const shiftOrder = { 'Morning': 0, 'Evening': 1 };
                    dailyData = [...dailyData].sort((a, b) => {
                        const sA = shiftOrder[a.shift] ?? 2;
                        const sB = shiftOrder[b.shift] ?? 2;
                        if (sA !== sB) return sA - sB;
                        const cA = parseInt(a.farmer_code, 10);
                        const cB = parseInt(b.farmer_code, 10);
                        if (!isNaN(cA) && !isNaN(cB)) return cA - cB;
                        return String(a.farmer_code || '').localeCompare(String(b.farmer_code || ''));
                    });

                    const animalFilterLabel = dailyAnimalFilter === 'cow'
                        ? (isIndic ? (i18n.language === 'mr' ? 'गाय' : 'गाय') : 'Cow')
                        : dailyAnimalFilter === 'buffalo'
                        ? (isIndic ? (i18n.language === 'mr' ? 'म्हैस' : 'भैंस') : 'Buffalo')
                        : (isIndic ? (i18n.language === 'mr' ? 'गाय व म्हैस' : 'गाय और भैंस') : 'Cow & Buffalo');

                    const totalQty = dailyData.reduce((sum, c) => sum + (parseFloat(c.quantity) || 0), 0);
                    const totalAmt = dailyData.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
                    const cowData = dailyData.filter(c => (c.milk_type || '').toLowerCase() === 'cow');
                    const bufData = dailyData.filter(c => (c.milk_type || '').toLowerCase() === 'buffalo');
                    const morningData = dailyData.filter(c => c.shift === 'Morning');
                    const eveningData = dailyData.filter(c => c.shift === 'Evening');
                    const cowQty = cowData.reduce((s, c) => s + (parseFloat(c.quantity) || 0), 0);
                    const bufQty = bufData.reduce((s, c) => s + (parseFloat(c.quantity) || 0), 0);
                    const morQty = morningData.reduce((s, c) => s + (parseFloat(c.quantity) || 0), 0);
                    const eveQty = eveningData.reduce((s, c) => s + (parseFloat(c.quantity) || 0), 0);
                    const morAmt = morningData.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);
                    const eveAmt = eveningData.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);

                    const shiftLabel = (shift) => shift === 'Morning'
                        ? t('collection.morning')
                        : shift === 'Evening' ? t('collection.evening') : shift;
                    const typeLabel = (mt) => mt === 'Cow'
                        ? t('collection.cow')
                        : mt === 'Buffalo' ? t('collection.buffalo') : mt;
                    const toRow = (c) => [
                        shiftLabel(c.shift),
                        c.farmer_code || '-',
                        c.farmer_name || '-',
                        typeLabel(c.milk_type),
                        Number(c.fat || 0).toFixed(1),
                        Number(c.snf || 0).toFixed(1),
                        Number(c.quantity || 0).toFixed(3),
                        formatCurrency(c.rate),
                        formatCurrency(c.amount)
                    ];

                    const tableHeaders = [
                        t('reports.pdf.headers.shift'),
                        t('reports.pdf.headers.code'),
                        t('reports.pdf.headers.farmer'),
                        t('reports.pdf.headers.type'),
                        t('reports.pdf.headers.fat'),
                        t('reports.pdf.headers.snf'),
                        t('reports.pdf.headers.qty'),
                        t('reports.pdf.headers.rate'),
                        t('reports.pdf.headers.amount')
                    ];

                    const totalLabel = isIndic ? (i18n.language === 'mr' ? 'एकूण' : 'कुल') : 'TOTAL';
                    const morLabel = isIndic ? (i18n.language === 'mr' ? 'सकाळ एकूण' : 'सुबह कुल') : 'Morning Total';
                    const eveLabel = isIndic ? (i18n.language === 'mr' ? 'संध्याकाळ एकूण' : 'शाम कुल') : 'Evening Total';

                    const summaryItems = [
                        { label: t('reports.pdf.summary.totalQty'), value: `${totalQty.toFixed(3)} L` },
                        { label: t('reports.pdf.summary.totalAmount'), value: formatCurrency(totalAmt) },
                        {
                            label: isIndic ? (i18n.language === 'mr' ? '☀️ सकाळ' : '☀️ सुबह') : '☀️ Morning',
                            value: `${morQty.toFixed(3)} L`
                        },
                        {
                            label: isIndic ? (i18n.language === 'mr' ? '🌙 संध्याकाळ' : '🌙 शाम') : '🌙 Evening',
                            value: `${eveQty.toFixed(3)} L`
                        },
                    ];
                    if (dailyAnimalFilter === 'both') {
                        summaryItems.push({ label: isIndic ? (i18n.language === 'mr' ? '🐄 गाय' : '🐄 गाय') : '🐄 Cow', value: `${cowQty.toFixed(3)} L` });
                        summaryItems.push({ label: isIndic ? (i18n.language === 'mr' ? '🐃 म्हैस' : '🐃 भैंस') : '🐃 Buffalo', value: `${bufQty.toFixed(3)} L` });
                    }

                    // When "Both" — show as sections (Morning / Evening) for clear shift-wise view
                    if (dailyAnimalFilter === 'both') {
                        const makeSectionRows = (rows) => [
                            ...rows.map(toRow),
                            ['', '', totalLabel, '', '', '',
                                rows.reduce((s, c) => s + (parseFloat(c.quantity) || 0), 0).toFixed(3),
                                '',
                                formatCurrency(rows.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0))
                            ]
                        ];

                        const sections = [];
                        if (morningData.length > 0) {
                            sections.push({
                                title: isIndic
                                    ? (i18n.language === 'mr' ? `☀️ सकाळ — ${morQty.toFixed(3)} L | ${formatCurrency(morAmt)}` : `☀️ सुबह — ${morQty.toFixed(3)} L | ${formatCurrency(morAmt)}`)
                                    : `☀️ Morning Shift — ${morQty.toFixed(3)} L | ${formatCurrency(morAmt)}`,
                                headers: tableHeaders,
                                rows: makeSectionRows(morningData)
                            });
                        }
                        if (eveningData.length > 0) {
                            sections.push({
                                title: isIndic
                                    ? (i18n.language === 'mr' ? `🌙 संध्याकाळ — ${eveQty.toFixed(3)} L | ${formatCurrency(eveAmt)}` : `🌙 शाम — ${eveQty.toFixed(3)} L | ${formatCurrency(eveAmt)}`)
                                    : `🌙 Evening Shift — ${eveQty.toFixed(3)} L | ${formatCurrency(eveAmt)}`,
                                headers: tableHeaders,
                                rows: makeSectionRows(eveningData)
                            });
                        }
                        // Grand total section row
                        sections.push({
                            title: isIndic ? (i18n.language === 'mr' ? '📊 एकूण सारांश' : '📊 कुल सारांश') : '📊 Grand Total',
                            headers: [
                                isIndic ? (i18n.language === 'mr' ? 'वेळ' : 'शिफ्ट') : 'Shift',
                                isIndic ? (i18n.language === 'mr' ? 'नोंदी' : 'प्रविष्टियां') : 'Entries',
                                isIndic ? (i18n.language === 'mr' ? 'एकूण लिटर' : 'कुल लीटर') : 'Total Liters',
                                isIndic ? (i18n.language === 'mr' ? 'एकूण रक्कम' : 'कुल राशि') : 'Total Amount'
                            ],
                            rows: [
                                [
                                    isIndic ? (i18n.language === 'mr' ? '☀️ सकाळ' : '☀️ सुबह') : '☀️ Morning',
                                    morningData.length,
                                    `${morQty.toFixed(3)} L`,
                                    formatCurrency(morAmt)
                                ],
                                [
                                    isIndic ? (i18n.language === 'mr' ? '🌙 संध्याकाळ' : '🌙 शाम') : '🌙 Evening',
                                    eveningData.length,
                                    `${eveQty.toFixed(3)} L`,
                                    formatCurrency(eveAmt)
                                ],
                                [
                                    isIndic ? (i18n.language === 'mr' ? '🐄 गाय' : '🐄 गाय') : '🐄 Cow',
                                    cowData.length,
                                    `${cowQty.toFixed(3)} L`,
                                    '-'
                                ],
                                [
                                    isIndic ? (i18n.language === 'mr' ? '🐃 म्हैस' : '🐃 भैंस') : '🐃 Buffalo',
                                    bufData.length,
                                    `${bufQty.toFixed(3)} L`,
                                    '-'
                                ],
                                [
                                    totalLabel,
                                    dailyData.length,
                                    `${totalQty.toFixed(3)} L`,
                                    formatCurrency(totalAmt)
                                ]
                            ]
                        });

                        setHtmlReportData({
                            title: `${t('reports.presets.daily.title')} (${dateTitle})`,
                            subtitle: `${t('reports.presets.daily.description')} | ${animalFilterLabel}`,
                            date: dateTitle,
                            color: '#10b981',
                            summary: summaryItems,
                            sections,
                            fileName: fileName
                        });
                    } else {
                        // Cow-only or Buffalo-only — single sorted table
                        setHtmlReportData({
                            title: `${t('reports.presets.daily.title')} (${dateTitle})`,
                            subtitle: `${t('reports.presets.daily.description')} | ${animalFilterLabel}`,
                            date: dateTitle,
                            color: dailyAnimalFilter === 'cow' ? '#16a34a' : '#7c3aed',
                            summary: summaryItems.slice(0, 4),
                            headers: tableHeaders,
                            rows: [
                                ...dailyData.map(toRow),
                                ['', '', totalLabel, '', '', '', totalQty.toFixed(3), '', formatCurrency(totalAmt)]
                            ],
                            fileName: fileName
                        });
                    }

                    return;
                }


                if (preset.id === 'backup') {
                    fileName = `Complete_Backup_${dayjs().format('YYYY-MM-DD')}`;

                    if (isIndic) {
                        const backupSections = [
                            {
                                title: t('reports.pdf.sections.farmers'),
                                headers: [t('reports.pdf.headers.code'), t('reports.pdf.headers.name'), t('reports.pdf.headers.phone'), t('reports.pdf.headers.village'), t('reports.pdf.headers.bank'), t('reports.pdf.headers.ifsc')],
                                rows: data.farmers.map(f => [
                                    f.code, f.name, f.phone, f.village || '-', f.bank_account || '-', f.ifsc_code || '-'
                                ])
                            },
                            {
                                title: t('reports.pdf.sections.collections'),
                                headers: [t('reports.pdf.headers.date'), t('reports.pdf.headers.farmer'), t('reports.pdf.headers.type'), t('reports.pdf.headers.fat'), t('reports.pdf.headers.snf'), t('reports.pdf.headers.qty'), t('reports.pdf.headers.rate'), t('reports.pdf.headers.amt')],
                                rows: data.collections.slice(0, 500).map(c => [
                                    dayjs(c.date).format('DD/MM/YY'), c.farmer_name,
                                    c.milk_type === 'Cow' ? t('collection.cow') : c.milk_type === 'Buffalo' ? t('collection.buffalo') : c.milk_type,
                                    c.fat, c.snf, c.quantity, formatCurrency(c.rate), formatCurrency(c.amount)
                                ])
                            },
                            {
                                title: t('reports.pdf.sections.sales'),
                                headers: [t('reports.pdf.headers.date'), t('reports.pdf.headers.customer'), t('reports.pdf.headers.type'), t('reports.pdf.headers.qty'), t('reports.pdf.headers.rate'), t('reports.pdf.headers.amt')],
                                rows: data.sales.map(s => [
                                    dayjs(s.sale_date).format('DD/MM/YY'), s.customer_name,
                                    s.milk_type === 'Cow' ? t('collection.cow') : s.milk_type === 'Buffalo' ? t('collection.buffalo') : s.milk_type,
                                    s.quantity, formatCurrency(s.rate), formatCurrency(s.amount)
                                ])
                            },
                            {
                                title: t('reports.pdf.sections.federation'),
                                headers: [t('reports.pdf.headers.date'), t('reports.pdf.headers.shift'), t('reports.pdf.headers.type'), t('reports.pdf.headers.qty'), t('reports.pdf.headers.fat'), t('reports.pdf.headers.snf'), t('reports.pdf.headers.amt')],
                                rows: data.federation.map(r => [
                                    dayjs(r.receipt_date).format('DD/MM/YY'),
                                    r.shift === 'Morning' ? t('collection.morning') : r.shift === 'Evening' ? t('collection.evening') : r.shift,
                                    r.milk_type === 'Cow' ? t('collection.cow') : r.milk_type === 'Buffalo' ? t('collection.buffalo') : r.milk_type,
                                    r.quantity, r.fat, r.snf, formatCurrency(r.rate), formatCurrency(r.amount)
                                ])
                            },
                            {
                                title: t('reports.pdf.sections.payments'),
                                headers: [t('reports.pdf.headers.date'), t('reports.pdf.headers.farmer'), t('reports.pdf.headers.period'), t('reports.pdf.headers.amount')],
                                rows: data.payments.map(p => {
                                    const farmer = data.farmers.find(f => f.id === p.farmer_id);
                                    return [
                                        dayjs(p.payment_date).format('DD/MM/YY'),
                                        farmer ? farmer.name : `ID: ${p.farmer_id}`,
                                        `${dayjs(p.start_date).format('DD/MM')} - ${dayjs(p.end_date).format('DD/MM')}`,
                                        formatCurrency(p.amount)
                                    ];
                                })
                            },
                            {
                                title: t('reports.pdf.sections.deductions'),
                                headers: [t('reports.pdf.headers.farmer'), t('reports.pdf.headers.type'), t('reports.pdf.headers.status'), t('reports.pdf.headers.totalFixed'), t('reports.pdf.headers.collected')],
                                rows: data.deductions.map(d => [
                                    d.farmer_name, d.deduction_name, d.status,
                                    d.total_amount ? formatCurrency(d.total_amount) : formatCurrency(d.amount) + '/bill',
                                    formatCurrency(d.collected_amount)
                                ])
                            },
                            {
                                title: t('reports.pdf.sections.rates'),
                                headers: [t('reports.pdf.headers.type'), t('reports.pdf.headers.fat'), t('reports.pdf.headers.snf'), t('reports.pdf.headers.rate'), t('reports.pdf.headers.type')],
                                rows: data.rates.map(r => [
                                    r.milk_type, r.fat.toFixed(1), r.snf.toFixed(1), formatCurrency(r.rate), r.rate_type
                                ])
                            }
                        ];

                        setHtmlReportData({
                            title: `${t('settings.backup.title')} - ${dayjs().format('DD/MM/YYYY')}`,
                            subtitle: `${t('dashboard.totalFarmers')}: ${data.farmers.length} | ${t('dashboard.collections')}: ${data.collections.length}`,
                            date: dayjs().format('DD/MM/YYYY'),
                            color: '#64748b',
                            summary: [],
                            sections: backupSections,
                            fileName: fileName
                        });
                        return;
                    }

                    doc.setFontSize(14); doc.setTextColor(0); doc.text(t('reports.pdf.sections.farmers'), 14, startY);
                    autoTable(doc, {
                        startY: startY + 5,
                        head: [[t('reports.pdf.headers.code'), t('reports.pdf.headers.name'), t('reports.pdf.headers.phone'), t('reports.pdf.headers.village'), t('reports.pdf.headers.bank'), t('reports.pdf.headers.ifsc')]],
                        body: data.farmers.map(f => [f.code, f.name, f.phone, f.village || '-', f.bank_account, f.ifsc_code]),
                        theme: 'grid', headStyles: { fillColor: [63, 81, 181] }
                    });
                    startY = doc.lastAutoTable.finalY + 10;

                    if (startY > 250) { doc.addPage(); startY = 20; }
                    doc.text(t('reports.pdf.sections.collections'), 14, startY);
                    autoTable(doc, {
                        startY: startY + 5,
                        head: [[t('reports.pdf.headers.date'), t('reports.pdf.headers.farmer'), t('reports.pdf.headers.type'), t('reports.pdf.headers.fat'), t('reports.pdf.headers.snf'), t('reports.pdf.headers.qty'), t('reports.pdf.headers.rate'), t('reports.pdf.headers.amt')]],
                        body: data.collections.slice(0, 500).map(c => [
                            dayjs(c.date).format('DD/MM/YY'), c.farmer_name, c.milk_type, c.fat, c.snf, c.quantity, formatCurrency(c.rate), formatCurrency(c.amount)
                        ]),
                        theme: 'grid', headStyles: { fillColor: [0, 150, 136] }
                    });
                    startY = doc.lastAutoTable.finalY + 10;

                    if (startY > 250) { doc.addPage(); startY = 20; }
                    doc.text(t('reports.pdf.sections.sales'), 14, startY);
                    autoTable(doc, {
                        startY: startY + 5,
                        head: [[t('reports.pdf.headers.date'), t('reports.pdf.headers.customer'), t('reports.pdf.headers.type'), t('reports.pdf.headers.qty'), t('reports.pdf.headers.rate'), t('reports.pdf.headers.amt')]],
                        body: data.sales.map(s => [
                            dayjs(s.sale_date).format('DD/MM/YY'), s.customer_name, s.milk_type, s.quantity, formatCurrency(s.rate), formatCurrency(s.amount)
                        ]),
                        theme: 'grid', headStyles: { fillColor: [255, 152, 0] }
                    });
                    startY = doc.lastAutoTable.finalY + 10;

                    if (startY > 250) { doc.addPage(); startY = 20; }
                    doc.text(t('reports.pdf.sections.federation'), 14, startY);
                    autoTable(doc, {
                        startY: startY + 5,
                        head: [[t('reports.pdf.headers.date'), t('reports.pdf.headers.shift'), t('reports.pdf.headers.type'), t('reports.pdf.headers.qty'), t('reports.pdf.headers.fat'), t('reports.pdf.headers.snf'), t('reports.pdf.headers.amt')]],
                        body: data.federation.map(r => [
                            dayjs(r.receipt_date).format('DD/MM/YY'), r.shift, r.milk_type, r.quantity, r.fat, r.snf, formatCurrency(r.amount)
                        ]),
                        theme: 'grid', headStyles: { fillColor: [156, 39, 176] }
                    });
                    startY = doc.lastAutoTable.finalY + 10;

                    if (startY > 250) { doc.addPage(); startY = 20; }
                    doc.text(t('reports.pdf.sections.payments'), 14, startY);
                    autoTable(doc, {
                        startY: startY + 5,
                        head: [[t('reports.pdf.headers.date'), t('reports.pdf.headers.farmer'), t('reports.pdf.headers.period'), t('reports.pdf.headers.amount')]],
                        body: data.payments.map(p => {
                            const farmer = data.farmers.find(f => f.id === p.farmer_id);
                            return [
                                dayjs(p.payment_date).format('DD/MM/YY'),
                                farmer ? farmer.name : `ID: ${p.farmer_id}`,
                                `${dayjs(p.start_date).format('DD/MM')} - ${dayjs(p.end_date).format('DD/MM')}`,
                                formatCurrency(p.amount)
                            ];
                        }),
                        theme: 'grid', headStyles: { fillColor: [233, 30, 99] }
                    });
                    startY = doc.lastAutoTable.finalY + 10;

                    if (startY > 250) { doc.addPage(); startY = 20; }
                    doc.text(t('reports.pdf.sections.deductions'), 14, startY);
                    autoTable(doc, {
                        startY: startY + 5,
                        head: [[t('reports.pdf.headers.farmer'), t('reports.pdf.headers.type'), t('reports.pdf.headers.status'), t('reports.pdf.headers.totalFixed'), t('reports.pdf.headers.collected')]],
                        body: data.deductions.map(d => [
                            d.farmer_name, d.deduction_name, d.status,
                            d.total_amount ? formatCurrency(d.total_amount) : formatCurrency(d.amount) + '/bill',
                            formatCurrency(d.collected_amount)
                        ]),
                        theme: 'grid', headStyles: { fillColor: [220, 38, 38] }
                    });
                    startY = doc.lastAutoTable.finalY + 10;

                    if (startY > 250) { doc.addPage(); startY = 20; }
                    doc.text(t('reports.pdf.sections.rates'), 14, startY);
                    autoTable(doc, {
                        startY: startY + 5,
                        head: [[t('reports.pdf.headers.type'), t('reports.pdf.headers.fat'), t('reports.pdf.headers.snf'), t('reports.pdf.headers.rate'), t('reports.pdf.headers.type')]],
                        body: data.rates.map(r => [
                            r.milk_type, r.fat.toFixed(1), r.snf.toFixed(1), formatCurrency(r.rate), r.rate_type
                        ]),
                        theme: 'grid', headStyles: { fillColor: [236, 72, 153] }
                    });
                }

                else if (preset.id === 'daily') {

                    let dailyData = filteredCollections;
                    let title = dateMode === 'range' ? `${t('reports.pdf.headers.date')}: ${dateTitle}` : `Date: ${start.format('DD MMMM YYYY')}`;

                    if (dailyData.length === 0) {
                        dailyData = data.collections.slice(0, 50);
                        title = t('reports.pdf.summary.noDataToday');
                        doc.setTextColor(220, 38, 38);
                        doc.text(t('reports.pdf.summary.noDataToday'), 14, startY + 5);
                        startY += 8;
                        doc.setTextColor(0);
                    }

                    const totalQty = dailyData.reduce((sum, c) => sum + (parseFloat(c.quantity) || 0), 0);
                    const totalAmt = dailyData.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);


                    doc.setFontSize(12);
                    doc.text(title, 14, startY);
                    doc.text(`${t('reports.pdf.summary.totalQty')}: ${totalQty.toFixed(3)} L`, 80, startY);
                    doc.text(`${t('reports.pdf.summary.totalAmount')}: ${formatCurrency(totalAmt)}`, 150, startY);

                    autoTable(doc, {
                        startY: startY + 10,
                        head: [[t('reports.pdf.headers.shift'), t('reports.pdf.headers.farmer'), t('reports.pdf.headers.type'), t('reports.pdf.headers.fat'), t('reports.pdf.headers.snf'), t('reports.pdf.headers.qty'), t('reports.pdf.headers.rate'), t('reports.pdf.headers.amount')]],
                        body: dailyData.map(c => [
                            c.shift, c.farmer_name, c.milk_type, c.fat, c.snf, c.quantity, formatCurrency(c.rate), formatCurrency(c.amount)
                        ]),
                        theme: 'striped',
                        headStyles: { fillColor: [16, 185, 129], font: isIndic ? 'NotoSansDevanagari' : 'helvetica' },
                        styles: { font: isIndic ? 'NotoSansDevanagari' : 'helvetica', fontSize: 10 }
                    });
                }

                else if (preset.id === 'monthly' || preset.id === 'profit') {

                    const monthlyData = filteredCollections;

                    if (isIndic) {
                        const dailySummary = {};
                        monthlyData.forEach(c => {
                            if (!dailySummary[c.date]) dailySummary[c.date] = { qty: 0, amt: 0, count: 0 };
                            dailySummary[c.date].qty += (parseFloat(c.quantity) || 0);
                            dailySummary[c.date].amt += (parseFloat(c.amount) || 0);
                            dailySummary[c.date].count++;
                        });

                        if (preset.id === 'profit') {
                            const monthlyFed = filteredFederation;
                            const totalCollectionAmt = monthlyData.reduce((s, c) => s + (c.amount || 0), 0);
                            const totalFedAmt = monthlyFed.reduce((s, r) => s + (r.amount || 0), 0);
                            const profit = totalFedAmt - totalCollectionAmt;

                            setHtmlReportData({
                                title: `Profit Report: ${dateTitle}`,
                                subtitle: t('reports.presets.profit.description'),
                                date: dateTitle,
                                color: '#16a34a',
                                summary: [
                                    { label: t('reports.pdf.summary.totalPaid'), value: formatCurrency(totalCollectionAmt) },
                                    { label: t('reports.pdf.summary.totalReceived'), value: formatCurrency(totalFedAmt) },
                                    { label: t('reports.pdf.summary.grossProfit'), value: formatCurrency(profit) }
                                ],
                                headers: [t('reports.pdf.headers.date'), t('reports.pdf.headers.entries'), t('reports.pdf.headers.totalQty'), t('reports.pdf.summary.totalAmount')],
                                rows: Object.entries(dailySummary).sort().map(([date, val]) => [
                                    dayjs(date).format('DD/MM/YYYY'), val.count, val.qty.toFixed(3), formatCurrency(val.amt)
                                ]),
                                fileName: fileName
                            });
                        } else {
                            const totalQty = monthlyData.reduce((s, c) => s + (parseFloat(c.quantity) || 0), 0);
                            const totalAmt = monthlyData.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);

                            setHtmlReportData({
                                title: `${t('reports.presets.monthly.title')}: ${dateTitle}`,
                                subtitle: t('reports.presets.monthly.description'),
                                date: dateTitle,
                                color: '#f59e0b',
                                summary: [
                                    { label: t('reports.pdf.summary.totalQty'), value: `${totalQty.toFixed(3)} L` },
                                    { label: t('reports.pdf.summary.totalAmount'), value: formatCurrency(totalAmt) }
                                ],
                                headers: [t('reports.pdf.headers.date'), t('reports.pdf.headers.entries'), t('reports.pdf.headers.totalQty'), t('reports.pdf.summary.totalAmount')],
                                rows: Object.entries(dailySummary).sort().map(([date, val]) => [
                                    dayjs(date).format('DD/MM/YYYY'), val.count, val.qty.toFixed(3), formatCurrency(val.amt)
                                ]),
                                fileName: fileName
                            });
                        }
                        return;
                    }

                    if (preset.id === 'profit') {

                        const monthlyFed = filteredFederation;

                        const totalCollectionAmt = monthlyData.reduce((s, c) => s + (c.amount || 0), 0);
                        const totalFedAmt = monthlyFed.reduce((s, r) => s + (r.amount || 0), 0);
                        const profit = totalFedAmt - totalCollectionAmt;

                        doc.text(`Profit Report: ${dayjs().format('MMMM YYYY')}`, 14, startY);

                        doc.setFillColor(240, 253, 244);
                        doc.rect(14, startY + 5, 180, 30, 'F');
                        doc.setFontSize(14);
                        doc.text(`${t('reports.pdf.summary.totalPaid')}: ${formatCurrency(totalCollectionAmt)}`, 20, startY + 15);
                        doc.text(`${t('reports.pdf.summary.totalReceived')}: ${formatCurrency(totalFedAmt)}`, 20, startY + 25);

                        doc.setFontSize(16);
                        doc.setTextColor(profit >= 0 ? 22 : 220, profit >= 0 ? 101 : 38, profit >= 0 ? 52 : 38);
                        doc.text(`${t('reports.pdf.summary.grossProfit')}: ${formatCurrency(profit)}`, 120, startY + 20);

                        startY += 45;
                    } else {
                        doc.text(`${t('reports.pdf.sections.monthlySummary')}: ${dayjs().format('MMMM YYYY')}`, 14, startY);
                    }

                    const dailySummary = {};
                    monthlyData.forEach(c => {
                        if (!dailySummary[c.date]) dailySummary[c.date] = { qty: 0, amt: 0, count: 0 };
                        dailySummary[c.date].qty += (parseFloat(c.quantity) || 0);
                        dailySummary[c.date].amt += (parseFloat(c.amount) || 0);
                        dailySummary[c.date].count++;
                    });

                    doc.setTextColor(0);
                    doc.setFontSize(12);
                    autoTable(doc, {
                        startY: startY + 5,
                        head: [[t('reports.pdf.headers.date'), t('reports.pdf.headers.entries'), t('reports.pdf.headers.totalQty'), t('reports.pdf.headers.totalAmount')]],
                        body: Object.entries(dailySummary).sort().map(([date, val]) => [
                            dayjs(date).format('DD MMM'), val.count, val.qty.toFixed(3), formatCurrency(val.amt)
                        ]),
                        theme: 'striped', headStyles: { fillColor: [245, 158, 11] }
                    });
                }

                else if (preset.id === 'payments') {
                    if (isIndic) {
                        const totalAmt = filteredPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
                        setHtmlReportData({
                            title: t('reports.presets.payments.title'),
                            subtitle: t('reports.presets.payments.description'),
                            date: dayjs().format('DD/MM/YYYY'),
                            color: '#4f46e5',
                            summary: [{ label: t('reports.pdf.summary.totalPaid'), value: formatCurrency(totalAmt) }],
                            headers: [t('reports.pdf.headers.date'), t('reports.pdf.headers.farmer'), t('reports.pdf.headers.period'), t('reports.pdf.headers.amount')],
                            rows: filteredPayments.map(p => {
                                const farmer = data.farmers.find(f => f.id === p.farmer_id);
                                return [
                                    dayjs(p.payment_date).format('DD/MM/YY HH:mm'),
                                    farmer ? `${farmer.name}` : `ID: ${p.farmer_id}`,
                                    `${dayjs(p.start_date).format('DD/MM')} - ${dayjs(p.end_date).format('DD/MM')}`,
                                    formatCurrency(p.amount)
                                ];
                            }),
                            fileName: fileName
                        });
                        return;
                    }
                    doc.text(t('reports.pdf.sections.payments'), 14, startY);
                    autoTable(doc, {
                        startY: startY + 10,
                        head: [[t('reports.pdf.headers.date'), t('reports.pdf.headers.farmer'), t('reports.pdf.headers.period'), t('reports.pdf.headers.amount')]],
                        body: filteredPayments.map(p => {
                            const farmer = data.farmers.find(f => f.id === p.farmer_id);
                            return [
                                dayjs(p.payment_date).format('DD/MM/YY HH:mm'),
                                farmer ? `${farmer.name} (${farmer.code})` : `ID: ${p.farmer_id}`,
                                `${dayjs(p.start_date).format('DD/MM')} - ${dayjs(p.end_date).format('DD/MM')}`,
                                formatCurrency(p.amount)
                            ];
                        }),
                        theme: 'striped', headStyles: { fillColor: [79, 70, 229] }
                    });
                }

                else if (preset.id === 'federation') {
                    if (isIndic) {
                        const totalQty = filteredFederation.reduce((s, r) => s + (parseFloat(r.quantity) || 0), 0);
                        const totalAmt = filteredFederation.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
                        setHtmlReportData({
                            title: t('reports.presets.federation.title'),
                            subtitle: t('reports.presets.federation.description'),
                            date: dayjs().format('DD/MM/YYYY'),
                            color: '#9333ea',
                            summary: [
                                { label: t('reports.pdf.summary.totalQty'), value: `${totalQty.toFixed(3)} L` },
                                { label: t('reports.pdf.summary.totalAmount'), value: formatCurrency(totalAmt) }
                            ],
                            headers: [t('reports.pdf.headers.date'), t('reports.pdf.headers.shift'), t('reports.pdf.headers.type'), t('reports.pdf.headers.qty'), t('reports.pdf.headers.fat'), t('reports.pdf.headers.snf'), t('reports.pdf.headers.rate'), t('reports.pdf.headers.amount')],
                            rows: filteredFederation.map(r => [
                                dayjs(r.receipt_date).format('DD/MM/YY'),
                                r.shift === 'Morning' ? t('collection.morning') : r.shift === 'Evening' ? t('collection.evening') : r.shift,
                                r.milk_type === 'Cow' ? t('collection.cow') : r.milk_type === 'Buffalo' ? t('collection.buffalo') : r.milk_type,
                                r.fat, r.snf, r.quantity, formatCurrency(r.rate), formatCurrency(r.amount)
                            ]),
                            fileName: fileName
                        });
                        return;
                    }
                    doc.text(t('reports.pdf.sections.federation'), 14, startY);
                    autoTable(doc, {
                        startY: startY + 10,
                        head: [[t('reports.pdf.headers.date'), t('reports.pdf.headers.shift'), t('reports.pdf.headers.type'), t('reports.pdf.headers.qty'), t('reports.pdf.headers.fat'), t('reports.pdf.headers.snf'), t('reports.pdf.headers.rate'), t('reports.pdf.headers.amount')]],
                        body: filteredFederation.map(r => [
                            dayjs(r.receipt_date).format('DD/MM/YY'), r.shift, r.milk_type, r.fat, r.snf, r.quantity, formatCurrency(r.rate), formatCurrency(r.amount)
                        ]),
                        theme: 'striped', headStyles: { fillColor: [147, 51, 234] }
                    });
                }

                else if (preset.id === 'shift') {
                    const morning = filteredCollections.filter(c => c.shift === 'Morning');
                    const evening = filteredCollections.filter(c => c.shift === 'Evening');

                    const stats = (arr) => ({
                        qty: arr.reduce((s, c) => s + c.quantity, 0).toFixed(3),
                        amt: formatCurrency(arr.reduce((s, c) => s + c.amount, 0)),
                        avgFat: (arr.reduce((s, c) => s + c.fat, 0) / (arr.length || 1)).toFixed(2)
                    });

                    const mStats = stats(morning);
                    const eStats = stats(evening);

                    if (isIndic) {
                        setHtmlReportData({
                            title: `${t('reports.pdf.sections.shiftComparison')} (${dayjs().format('MMM YYYY')})`,
                            subtitle: t('reports.presets.shift.description'),
                            date: dayjs().format('DD/MM/YYYY'),
                            color: '#8b5cf6',
                            summary: [],
                            headers: [t('reports.pdf.headers.metric'), t('reports.pdf.headers.morning'), t('reports.pdf.headers.evening')],
                            rows: [
                                [t('reports.pdf.metrics.totalCollections'), morning.length, evening.length],
                                [t('reports.pdf.summary.totalQty'), `${mStats.qty} L`, `${eStats.qty} L`],
                                [t('reports.pdf.summary.totalAmount'), mStats.amt, eStats.amt],
                                [t('reports.pdf.metrics.avgFat'), mStats.avgFat, eStats.avgFat]
                            ],
                            fileName: fileName
                        });
                        return;
                    }

                    doc.text(`${t('reports.pdf.sections.shiftComparison')} (${dayjs().format('MMMM YYYY')})`, 14, startY);

                    autoTable(doc, {
                        startY: startY + 10,
                        head: [[t('reports.pdf.headers.metric'), t('reports.pdf.headers.morning'), t('reports.pdf.headers.evening')]],
                        body: [
                            [t('reports.pdf.metrics.totalCollections'), morning.length, evening.length],
                            [t('reports.pdf.summary.totalQty'), `${mStats.qty} L`, `${eStats.qty} L`],
                            [t('reports.pdf.summary.totalAmount'), mStats.amt, eStats.amt],
                            [t('reports.pdf.metrics.avgFat'), mStats.avgFat, eStats.avgFat]
                        ],
                        theme: 'grid', headStyles: { fillColor: [124, 58, 237] }
                    });
                }

                else if (preset.id === 'farmers') {
                    // Filter by milk type if selected
                    const milkFilter = preset.farmerMilkFilter || 'All';
                    let filteredFarmers = (data.farmers || []);
                    if (milkFilter === 'Buffalo') {
                        filteredFarmers = filteredFarmers.filter(f => (f.default_milk_type || 'Buffalo') === 'Buffalo');
                    } else if (milkFilter === 'Cow') {
                        filteredFarmers = filteredFarmers.filter(f => f.default_milk_type === 'Cow');
                    }
                    // Sort numerically by farmer code
                    filteredFarmers = filteredFarmers.slice().sort((a, b) => {
                        const ca = parseInt(a.code, 10);
                        const cb = parseInt(b.code, 10);
                        if (!isNaN(ca) && !isNaN(cb)) return ca - cb;
                        return String(a.code || '').localeCompare(String(b.code || ''));
                    });
                    // Subtitle reflects filter
                    const filterLabel = milkFilter === 'All'
                        ? t('reports.farmerRegister.all', 'All Farmers')
                        : milkFilter === 'Cow'
                            ? t('collection.cow', 'Cow')
                            : t('collection.buffalo', 'Buffalo');
                    // Always use HTML canvas to support multilingual database content
                    setHtmlReportData({
                        title: t('reports.presets.farmers.title'),
                        subtitle: `${t('reports.presets.farmers.description')} — ${filterLabel}`,
                        date: dayjs().format('DD/MM/YYYY'),
                        color: '#6366f1',
                        summary: [{ label: t('dashboard.totalFarmers'), value: filteredFarmers.length }],
                        headers: [
                            t('reports.pdf.headers.code'),
                            t('reports.pdf.headers.name'),
                            t('collection.milkType', 'Milk Type')
                        ],
                        rows: filteredFarmers.map(f => [
                            f.code,
                            f.name,
                            f.default_milk_type === 'Cow'
                                ? t('collection.cow', 'Cow')
                                : t('collection.buffalo', 'Buffalo')
                        ]),
                        fileName: fileName
                    });
                    return;
                }

                else if (preset.id === 'rates') {
                    if (isIndic) {
                        setHtmlReportData({
                            title: t('reports.presets.rates.title'),
                            subtitle: t('reports.presets.rates.description'),
                            date: dayjs().format('DD/MM/YYYY'),
                            color: '#db2777',
                            summary: [],
                            headers: [t('reports.pdf.headers.type'), t('reports.pdf.headers.fat'), t('reports.pdf.headers.snf'), t('reports.pdf.headers.rate'), t('reports.pdf.headers.type')],
                            rows: data.rates.map(r => [
                                r.milk_type === 'Cow' ? t('collection.cow') : r.milk_type === 'Buffalo' ? t('collection.buffalo') : r.milk_type,
                                r.fat.toFixed(1), r.snf.toFixed(1), formatCurrency(r.rate), r.rate_type
                            ]),
                            fileName: fileName
                        });
                        return;
                    }
                    doc.text(t('reports.pdf.sections.rates'), 14, startY);
                    autoTable(doc, {
                        startY: startY + 10,
                        head: [[t('reports.pdf.headers.type'), t('reports.pdf.headers.fat'), t('reports.pdf.headers.snf'), t('reports.pdf.headers.rate'), t('reports.pdf.headers.type')]],
                        body: data.rates.map(r => [
                            r.milk_type, r.fat.toFixed(1), r.snf.toFixed(1), formatCurrency(r.rate), r.rate_type
                        ]),
                        theme: 'striped', headStyles: { fillColor: [236, 72, 153] }
                    });
                }

                else if (preset.id === 'deductions') {
                    // Always use HTML canvas to support multilingual database content
                    const totalDed = filteredDeductions.reduce((s, d) => s + (d.collected_amount || 0), 0);
                    setHtmlReportData({
                        title: t('reports.presets.deductions.title'),
                        subtitle: t('reports.presets.deductions.description'),
                        date: dayjs().format('DD/MM/YYYY'),
                        color: '#ef4444',
                        summary: [{ label: t('reports.pdf.summary.totalAmount'), value: formatCurrency(totalDed) }],
                        headers: [t('reports.pdf.headers.farmer'), t('reports.pdf.headers.type'), t('reports.pdf.headers.status'), t('reports.pdf.headers.totalFixed'), t('reports.pdf.headers.collected')],
                        rows: filteredDeductions.map(d => [
                            d.farmer_name, d.deduction_name, d.status.toUpperCase(),
                            d.total_amount ? formatCurrency(d.total_amount) : formatCurrency(d.amount) + '/bill',
                            formatCurrency(d.collected_amount)
                        ]),
                        fileName: fileName
                    });
                    return;
                }

                else if (preset.id === 'sales') {
                    // Always use HTML canvas to support multilingual database content
                    const totalSales = filteredSales.reduce((sum, s) => sum + (s.amount || 0), 0);
                    setHtmlReportData({
                        title: t('reports.presets.sales.title'),
                        subtitle: t('reports.presets.sales.description'),
                        date: dayjs().format('DD/MM/YYYY'),
                        color: '#0ea5e9',
                        summary: [{ label: t('reports.pdf.summary.totalAmount'), value: formatCurrency(totalSales) }],
                        headers: [t('reports.pdf.headers.date'), t('reports.pdf.headers.customer'), t('reports.pdf.headers.type'), t('reports.pdf.headers.qty'), t('reports.pdf.headers.rate'), t('reports.pdf.headers.amt')],
                        rows: filteredSales.map(s => [
                            dayjs(s.sale_date).format('DD/MM/YY'), s.customer_name,
                            s.milk_type === 'Cow' ? t('collection.cow') : s.milk_type === 'Buffalo' ? t('collection.buffalo') : s.milk_type,
                            s.quantity, formatCurrency(s.rate), formatCurrency(s.amount)
                        ]),
                        fileName: fileName
                    });
                    return;
                }

                else if (preset.id === 'top_producers') {
                    const farmerStats = {};
                    filteredCollections.forEach(c => {
                        if (!farmerStats[c.farmer_id]) farmerStats[c.farmer_id] = { name: c.farmer_name, qty: 0, amt: 0 };
                        farmerStats[c.farmer_id].qty += parseFloat(c.quantity || 0);
                        farmerStats[c.farmer_id].amt += parseFloat(c.amount || 0);
                    });

                    const sorted = Object.values(farmerStats).sort((a, b) => b.qty - a.qty).slice(0, 50);

                    // Always use HTML canvas to support multilingual database content
                    setHtmlReportData({
                        title: t('reports.presets.top_producers.title'),
                        subtitle: t('reports.presets.top_producers.description'),
                        date: dayjs().format('DD/MM/YYYY'),
                        color: '#eab308',
                        summary: [],
                        headers: [t('reports.pdf.headers.rank'), t('reports.pdf.headers.name'), t('reports.pdf.headers.totalQty'), t('reports.pdf.headers.totalEarnings')],
                        rows: sorted.map((s, i) => [
                            i + 1, s.name, s.qty.toFixed(3), formatCurrency(s.amt)
                        ]),
                        fileName: fileName
                    });
                    return;
                }

                else if (preset.id === 'low_quality') {
                    const lowQuality = filteredCollections.filter(c =>
                        (c.milk_type === 'Buffalo' && c.fat < 5.0) ||
                        (c.milk_type === 'Cow' && c.fat < 3.0) ||
                        (c.snf < 8.0)
                    );

                    // Always use HTML canvas to support multilingual database content
                    setHtmlReportData({
                        title: t('reports.presets.low_quality.title'),
                        subtitle: t('reports.presets.low_quality.description'),
                        date: dayjs().format('DD/MM/YYYY'),
                        color: '#f97316',
                        summary: [{ label: 'Count', value: lowQuality.length }],
                        headers: [t('reports.pdf.headers.date'), t('reports.pdf.headers.farmer'), t('reports.pdf.headers.type'), t('reports.pdf.headers.fat'), t('reports.pdf.headers.snf'), t('reports.pdf.headers.qty')],
                        rows: lowQuality.map(c => [
                            dayjs(c.date).format('DD/MM/YY'), c.farmer_name,
                            c.milk_type === 'Cow' ? t('collection.cow') : c.milk_type === 'Buffalo' ? t('collection.buffalo') : c.milk_type,
                            c.fat, c.snf, c.quantity
                        ]),
                        fileName: fileName
                    });
                    return;
                }

                doc.save(`${fileName}.pdf`);

                const count = filteredCollections.length + filteredSales.length + filteredFederation.length + filteredPayments.length + filteredDeductions.length;
                setStatus({ type: 'success', message: `${t('reports.messages.success', { title: preset.title })} (${count} records)` });
            }

        } catch (error) {
            console.error(error);
            setStatus({ type: 'error', message: t('reports.messages.error', { error: error.message }) });
        } finally {
            setLoading(null);
        }
    };

    const allPresets = [
        {
            id: 'daily', title: t('reports.presets.daily.title'),
            description: t('reports.presets.daily.description'),
            icon: <Calendar size={24} color="#6366f1" />, color: '#f5f3ff', btnColor: '#4f46e5'
        },
        {
            id: 'monthly', title: t('reports.presets.monthly.title'),
            description: t('reports.presets.monthly.description'),
            icon: <FileText size={24} color="#6366f1" />, color: '#f5f3ff', btnColor: '#4f46e5'
        },
        {
            id: 'profit', title: t('reports.presets.profit.title'),
            description: t('reports.presets.profit.description'),
            icon: <PiggyBank size={24} color="#10b981" />, color: '#ecfdf5', btnColor: '#059669'
        },
        {
            id: 'payments', title: t('reports.presets.payments.title'),
            description: t('reports.presets.payments.description'),
            icon: <Receipt size={24} color="#6366f1" />, color: '#f5f3ff', btnColor: '#4f46e5'
        },
        {
            id: 'difference_bill', title: t('reports.presets.difference_bill.title', 'फरक बिल'),
            description: t('reports.presets.difference_bill.description', 'Generate and post Difference Bill (Bonus).'),
            icon: <Calculator size={24} color="#d946ef" />, color: '#fdf4ff', btnColor: '#c026d3'
        },
        {
            id: 'milk_collection', title: t('reports.presets.milk_collection.title', 'दुध खरेदी रिपोर्ट'),
            description: t('reports.presets.milk_collection.description', 'Detailed milk collection report with filters.'),
            icon: <FileBarChart size={24} color="#6366f1" />, color: '#f5f3ff', btnColor: '#4f46e5'
        },
        {
            id: 'member_statement', title: t('reports.presets.member_statement.title', 'वैयक्तिक खतावणी'),
            description: t('reports.presets.member_statement.description', 'Member-wise detailed ledger & statement.'),
            icon: <History size={24} color="#4f46e5" />, color: '#eef2ff', btnColor: '#4338ca'
        },
        {
            id: 'farmers', title: t('reports.presets.farmers.title'),
            description: t('reports.presets.farmers.description'),
            icon: <Users size={24} color="#475569" />, color: '#f8fafc', btnColor: '#334155'
        },
        {
            id: 'sales', title: t('reports.presets.sales.title'),
            description: t('reports.presets.sales.description'),
            icon: <DollarSign size={24} color="#10b981" />, color: '#ecfdf5', btnColor: '#059669'
        },
        {
            id: 'federation', title: t('reports.presets.federation.title'),
            description: t('reports.presets.federation.description'),
            icon: <Landmark size={24} color="#4f46e5" />, color: '#f5f3ff', btnColor: '#4338ca'
        },
        {
            id: 'deductions', title: t('reports.presets.deductions.title'),
            description: t('reports.presets.deductions.description'),
            icon: <Activity size={24} color="#ef4444" />, color: '#fef2f2', btnColor: '#dc2626'
        },
        {
            id: 'rates', title: t('reports.presets.rates.title'),
            description: t('reports.presets.rates.description'),
            icon: <TrendingUp size={24} color="#475569" />, color: '#f8fafc', btnColor: '#334155'
        },
        {
            id: 'top_producers', title: t('reports.presets.top_producers.title'),
            description: t('reports.presets.top_producers.description'),
            icon: <TrendingUp size={24} color="#f59e0b" />, color: '#fffbeb', btnColor: '#d97706'
        },
        {
            id: 'low_quality', title: t('reports.presets.low_quality.title'),
            description: t('reports.presets.low_quality.description'),
            icon: <TriangleAlert size={24} color="#f97316" />, color: '#fff7ed', btnColor: '#ea580c'
        },
        {
            id: 'shift', title: t('reports.presets.shift.title'),
            description: t('reports.presets.shift.description'),
            icon: <Layers size={24} color="#4f46e5" />, color: '#f5f3ff', btnColor: '#4338ca'
        },
    ];

    const presets = ['admin', 'super_admin'].includes(user?.role)
        ? allPresets
        : allPresets.filter(p => ['daily', 'sales'].includes(p.id));

    const handlePresetClick = (preset) => {
        setSelectedPreset(preset);

        if (preset.id === 'difference_bill') {
            setIsDiffBillModalOpen(true);
            return;
        } else if (preset.id === 'milk_collection') {
            setIsMilkReportModalOpen(true);
            return;
        } else if (preset.id === 'member_statement') {
            setIsMemberStatementModalOpen(true);
            return;
        }

        if (preset.id === 'daily') {
            setDateMode('single');
            setSelectedDate(dayjs());
            setDailyAnimalFilter('both'); // reset animal filter
            setDailyDateMode('single'); // reset date mode
        } else if (['monthly', 'profit', 'shift'].includes(preset.id)) {
            setDateMode('month');
            setSelectedDate(dayjs());
        } else if (['farmers', 'rates'].includes(preset.id)) {
            setDateMode('today');
            if (preset.id === 'farmers') setFarmerMilkFilter('All'); // reset filter
        } else {
            setDateMode('range');
            setDateRange([dayjs().startOf('month'), dayjs()]);
        }

        setIsModalOpen(true);
    };

    const handleGenerateClick = () => {
        setIsModalOpen(false);
        if (selectedPreset) {
            // For daily report, sync the dateMode from dailyDateMode choice
            if (selectedPreset.id === 'daily') {
                setDateMode(dailyDateMode);
            }
            generateReport({ ...selectedPreset, farmerMilkFilter, dailyAnimalFilter });
        }
    };

    return (
        <div className="reports-page" style={{
            padding: '16px 32px',
            maxWidth: '1600px',
            margin: '0 auto',
            background: 'transparent',
            minHeight: '100%'
        }}>
            {/* Header */}
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
                        color: '#1e293b',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        margin: '0 0 8px 0'
                    }}>
                        <FileText size={28} /> {t('reports.title')}
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '15px', margin: 0 }}>
                        {t('reports.subtitle')}
                    </p>
                </div>
            </div>

            {/* Status Feedback */
            }
            {status && status.type !== 'info' && (
                <div style={{
                    marginBottom: '24px', padding: '16px', borderRadius: '12px',
                    display: 'flex', alignItems: 'center', gap: '12px',
                    background: status.type === 'success' ? '#dcfce7' : status.type === 'info' ? '#dbeafe' : '#fee2e2',
                    color: status.type === 'success' ? '#166534' : status.type === 'info' ? '#1e40af' : '#991b1b',
                    border: `1px solid ${status.type === 'success' ? '#bbf7d0' : status.type === 'info' ? '#bfdbfe' : '#fecaca'}`
                }}>
                    {status.type === 'success' ? <CheckCircle size={20} /> : status.type === 'info' ? <Loader2 className="spin" size={20} /> : <AlertCircle size={20} />}
                    <span style={{ fontWeight: '500' }}>{status.message}</span>
                </div>
            )}

            {/* Date Filter Configuration */}


            {/* Main Content Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '24px' }}>

                {/* Large Backup Card */}
                {['admin', 'super_admin'].includes(user?.role) && (
                    <div style={{
                        gridColumn: 'span 12',
                        backgroundImage: 'linear-gradient(135deg, #4f46e5 0%, #312e81 100%)',
                        borderRadius: '20px', padding: '32px', color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        boxShadow: '0 10px 25px -5px rgba(79, 70, 229, 0.4)'
                    }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
                                <div style={{ background: 'rgba(255,255,255,0.2)', padding: '10px', borderRadius: '12px' }}>
                                    <Package size={32} color="white" />
                                </div>
                                <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{t('reports.backup.title')}</h2>
                            </div>
                            <p style={{ margin: 0, opacity: 0.9, maxWidth: '600px', lineHeight: '1.5' }}>
                                {t('reports.backup.description')}
                            </p>
                        </div>
                        <button
                            onClick={() => handlePresetClick({ id: 'backup', title: t('reports.backup.title'), description: 'Full data export.' })}
                            disabled={loading === 'backup'}
                            style={{
                                background: 'white', color: '#4338ca', border: 'none',
                                padding: '16px 32px', borderRadius: '12px', fontWeight: '700', fontSize: '16px',
                                cursor: loading === 'backup' ? 'wait' : 'pointer',
                                display: 'flex', alignItems: 'center', gap: '10px',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                            }}
                        >
                            {loading === 'backup' ? <Loader2 className="spin" size={20} /> : <Download size={20} />}
                            {loading === 'backup' ? t('reports.backup.generating') : t('reports.backup.button')}
                        </button>
                    </div>
                )}

                {/* Presets Grid */}
                {presets.map(preset => (
                    <div key={preset.id} className="preset-card" style={{
                        gridColumn: 'span 4', background: 'white', borderRadius: '16px',
                        padding: '24px', border: '1px solid #e2e8f0',
                        display: 'flex', flexDirection: 'column', gap: '16px',
                        transition: 'all 0.2s', height: '100%'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                            <div style={{
                                background: preset.color, padding: '12px', borderRadius: '12px',
                                display: 'grid', placeItems: 'center'
                            }}>
                                {preset.icon}
                            </div>
                        </div>

                        <div style={{ flex: 1 }}>
                            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b', margin: '0 0 6px 0' }}>
                                {preset.title}
                            </h3>
                            <p style={{ fontSize: '14px', color: '#64748b', margin: 0, lineHeight: '1.5' }}>
                                {preset.description}
                            </p>
                        </div>

                        <button
                            onClick={() => handlePresetClick(preset)}
                            disabled={loading === preset.id}
                            style={{
                                width: '100%', padding: '12px', borderRadius: '10px',
                                border: `1px solid ${preset.color}`, background: 'white',
                                color: preset.btnColor, fontWeight: '600', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = preset.color}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                        >
                            {loading === preset.id ? <Loader2 size={18} className="spin" /> : <Download size={18} />}
                            {loading === preset.id ? t('reports.buttons.exporting') : t('reports.buttons.exportPdf')}
                        </button>
                    </div>
                ))}
            </div>

            <style>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { 100% { transform: rotate(360deg); } }
                @media (max-width: 1200px) { .preset-card { grid-column: span 6 !important; } }
                @media (max-width: 768px) { .preset-card { grid-column: span 12 !important; } .reports-page { padding: 16px !important; } }
            `}</style>

            {/* Hidden HTML Report Template - Premium Design */}
            {htmlReportData && (
                <div id="report-template" style={{
                    position: 'fixed', top: 0, left: '-9999px', width: '794px',
                    pointerEvents: 'none', zIndex: -1000, overflow: 'visible',
                    background: htmlReportData.bgColor || '#ffffff', color: '#111827',
                    fontFamily: '"Noto Sans", "Noto Sans Devanagari", sans-serif',
                    padding: '0'
                }}>
                    {/* Top Header Card */}
                    <div style={{
                        background: `linear-gradient(135deg, ${htmlReportData.color || '#4f46e5'} 0%, ${htmlReportData.color || '#6366f1'} 100%)`,
                        color: 'white',
                        padding: '40px 48px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                <div style={{ background: 'white', borderRadius: '8px', padding: '6px' }}>
                                    <FileText size={24} color={htmlReportData.color || '#4f46e5'} />
                                </div>
                                <span style={{ fontSize: '14px', fontWeight: '800', letterSpacing: '2px', textTransform: 'uppercase' }}>DudhSakha</span>
                            </div>
                            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '800' }}>{htmlReportData.title}</h1>
                            <p style={{ margin: '8px 0 0 0', fontSize: '14px', opacity: 0.9 }}>{htmlReportData.subtitle}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>{t('common.date', 'Date')}</div>
                            <div style={{ fontSize: '16px', fontWeight: '600' }}>{htmlReportData.date}</div>
                        </div>
                    </div>

                    <div style={{ padding: '0 48px 48px 48px' }}>
                        {/* Summary Section - Modern Grid */}
                        {htmlReportData.summary && htmlReportData.summary.length > 0 && (
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(4, 1fr)',
                                gap: '16px',
                                marginTop: '-24px',
                                marginBottom: '32px'
                            }}>
                                {htmlReportData.summary.map((item, idx) => (
                                    <div key={idx} style={{
                                        background: 'white',
                                        padding: '16px',
                                        borderRadius: '16px',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                                        border: '1px solid #f1f5f9'
                                    }}>
                                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{item.label}</div>
                                        <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>{item.value}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Content Sections */}
                        {htmlReportData.sections ? (
                            htmlReportData.sections.map((section, idx) => (
                                <div key={idx} style={{ marginBottom: idx < htmlReportData.sections.length - 1 ? '40px' : '0' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                        <div style={{ height: '24px', width: '4px', background: htmlReportData.color || '#1e3a8a', borderRadius: '2px' }}></div>
                                        <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', margin: 0 }}>{section.title}</h3>
                                    </div>
                                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0', fontSize: '12px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                                        <thead>
                                            <tr style={{ background: '#f8fafc' }}>
                                                {section.headers.map((h, i) => (
                                                    <th key={i} style={{
                                                        padding: '14px 16px',
                                                        color: '#64748b',
                                                        textAlign: 'left',
                                                        fontWeight: '700',
                                                        borderBottom: '1px solid #e2e8f0',
                                                        textTransform: 'uppercase',
                                                        fontSize: '11px',
                                                        letterSpacing: '0.5px'
                                                    }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {section.rows.map((row, i) => (
                                                <tr key={i}>
                                                    {row.map((cell, j) => (
                                                        <td key={j} style={{
                                                            padding: '14px 16px',
                                                            color: '#334155',
                                                            borderBottom: i === section.rows.length - 1 ? 'none' : '1px solid #f1f5f9',
                                                        }}>{cell}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ))
                        ) : (
                            <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                    <thead>
                                        <tr style={{ background: '#f8fafc' }}>
                                            {htmlReportData.headers.map((h, i) => (
                                                <th key={i} style={{
                                                    padding: '16px',
                                                    color: '#64748b',
                                                    textAlign: 'left',
                                                    fontWeight: '700',
                                                    borderBottom: '1px solid #e2e8f0',
                                                    textTransform: 'uppercase',
                                                    fontSize: '11px',
                                                    letterSpacing: '0.5px'
                                                }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {htmlReportData.rows.map((row, i) => {
                                            const isTotal = i === htmlReportData.rows.length - 1;
                                            return (
                                                <tr key={i} style={{ background: isTotal ? '#f1f5f9' : 'transparent' }}>
                                                    {row.map((cell, j) => (
                                                        <td key={j} style={{
                                                            padding: '14px 16px',
                                                            color: isTotal ? '#0f172a' : '#334155',
                                                            fontWeight: isTotal ? '700' : '400',
                                                            borderBottom: isTotal ? 'none' : '1px solid #f1f5f9',
                                                        }}>{cell}</td>
                                                    ))}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Individual Farmer Slips (For Pharak Bill) */}
                        {htmlReportData.farmerSlips && htmlReportData.farmerSlips.length > 0 && (
                            <div className="page-break-before" id="farmer-slips-section" style={{
                                marginTop: '10px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px'
                            }}>
                                {htmlReportData.farmerSlips.map((slip, idx) => (
                                    <div key={idx} 
                                        className={idx > 0 && idx % 5 === 0 ? "page-break-before" : ""}
                                        style={{
                                            border: '1.5px solid #000',
                                            padding: '10px 14px',
                                            background: 'white',
                                            width: '100%',
                                            maxWidth: '700px',
                                            margin: '0 auto',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            position: 'relative',
                                            minHeight: '170px',
                                            boxSizing: 'border-box'
                                        }}
                                    >
                                        {/* Slip Header - Dairy Name */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', alignItems: 'center' }}>
                                            <div style={{ fontSize: '15px', fontWeight: '900', color: '#000', textTransform: 'uppercase' }}>
                                                {user?.dairy_name || (i18n.language === 'mr' ? 'फरक बिल' : 'Pharak Bill')}
                                            </div>
                                            <div style={{ fontSize: '11px', fontWeight: '800', fontStyle: 'italic', color: '#b91c1c' }}>
                                                दिवाळीच्या हार्दिक शुभेच्छा
                                            </div>
                                        </div>

                                        {/* Info & Farmer Row Combined */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>
                                            <div style={{ fontSize: '12px' }}>
                                                <span style={{ fontWeight: '800' }}>{i18n.language === 'mr' ? 'कोड: ' : 'Code: '}</span> {slip.code}
                                            </div>
                                            <div style={{ fontSize: '16px', fontWeight: '900', flex: 1, textAlign: 'center' }}>
                                                {slip.name}
                                            </div>
                                            <div style={{ fontSize: '10px', textAlign: 'right' }}>
                                                {slip.dateTitle}
                                            </div>
                                        </div>

                                        {/* Main Table */}
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', border: '1.5px solid #000' }}>
                                            <thead>
                                                <tr style={{ background: '#f8fafc', color: '#000' }}>
                                                    <th style={{ padding: '4px 6px', border: '1px solid #000' }}>{i18n.language === 'mr' ? 'एकूण लिटर' : 'Liters'}</th>
                                                    <th style={{ padding: '4px 6px', border: '1px solid #000' }}>{i18n.language === 'mr' ? 'एकूण रक्कम' : 'Amount'}</th>
                                                    <th style={{ padding: '4px 6px', border: '1px solid #000', fontWeight: '900' }}>{i18n.language === 'mr' ? 'फरक बिल' : 'Bonus'}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr style={{ textAlign: 'center', fontWeight: '800' }}>
                                                    <td style={{ border: '1px solid #000', padding: '6px', fontSize: '14px' }}>{slip.liters}</td>
                                                    <td style={{ border: '1px solid #000', padding: '6px', fontSize: '14px' }}>{formatCurrency(slip.amount)}</td>
                                                    <td style={{ border: '1px solid #000', padding: '6px', fontSize: '20px', background: '#fafafa' }}>{formatCurrency(slip.billAmount)}</td>
                                                </tr>
                                            </tbody>
                                        </table>

                                        <div style={{ marginTop: '2px', display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#999' }}>
                                            <span>Amt @ {slip.calcStr}</span>
                                            <span>Generated: {dayjs().format('DD/MM/YYYY HH:mm')}</span>
                                        </div>

                                        {/* Cut Line */}
                                        <div style={{ position: 'absolute', bottom: '-4px', left: 0, right: 0, height: '1px', borderBottom: '1px dashed #666' }}></div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer / Signature Area */}
                    <div style={{ marginTop: 'auto', padding: '32px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid #f1f5f9' }}>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                            <p style={{ margin: 0 }}>© {new Date().getFullYear()} DudhSakha Dairy Management System</p>
                            <p style={{ margin: 0 }}>This is an automated report.</p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ width: '120px', height: '1px', background: '#e2e8f0', marginBottom: '8px' }}></div>
                            <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>Authorized Signature</div>
                        </div>
                    </div>
                </div>
            )}


            {/* PDF Preview Modal - Elegant Design */}
            {pdfPreview && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(241, 245, 249, 0.95)', zIndex: 10000,
                    display: 'flex', flexDirection: 'column',
                    backdropFilter: 'blur(8px)'
                }}>
                    {/* Glassy Toolbar */}
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.85)', color: '#1e293b', padding: '16px 36px',
                        display: 'flex', alignItems: 'center', gap: '28px', flexShrink: 0,
                        borderBottom: '1px solid #e2e8f0',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                            <div style={{ background: '#4f46e5', borderRadius: '12px', padding: '10px', boxShadow: '0 4px 15px rgba(79, 70, 229, 0.2)' }}>
                                <FileText size={24} color="white" />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '19px', fontWeight: '800', letterSpacing: '0.3px', color: '#1e293b' }}>{pdfPreview.title}</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', opacity: 0.6 }}>
                                    <span style={{ color: '#64748b' }}>{pdfPreview.fileName}.pdf</span>
                                    <span style={{ width: '3px', height: '3px', background: '#94a3b8', borderRadius: '50%' }}></span>
                                    <span style={{ color: '#64748b' }}>{dayjs().format('DD MMM YYYY')}</span>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '16px' }}>
                            <button
                                onClick={() => pdfPreview.printPdf && pdfPreview.printPdf()}
                                style={{
                                    background: '#ffffff', color: '#4f46e5', border: '1px solid #4f46e5',
                                    borderRadius: '14px', padding: '12px 24px', cursor: 'pointer',
                                    fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px',
                                    transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.1)'
                                }}
                            >
                                <Printer size={20} />
                                {i18n.language === 'mr' || i18n.language === 'hi' ? 'प्रिंट करा' : 'Print'}
                            </button>
                            <button
                                onClick={() => pdfPreview.savePdf()}
                                style={{
                                    background: '#10b981', color: 'white', border: 'none',
                                    borderRadius: '14px', padding: '12px 28px', cursor: 'pointer',
                                    fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px',
                                    boxShadow: '0 8px 16px rgba(16, 185, 129, 0.2)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <CheckCircle size={20} />
                                {i18n.language === 'mr' || i18n.language === 'hi' ? 'PDF जतन करा' : 'Save PDF'}
                            </button>
                            <button
                                onClick={() => setPdfPreview(null)}
                                style={{
                                    background: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca',
                                    borderRadius: '14px', padding: '12px', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <X size={22} />
                            </button>
                        </div>
                    </div>

                    {/* Preview Area */}
                    <div style={{
                        flex: 1, overflow: 'auto', display: 'flex',
                        justifyContent: 'center', padding: '60px 20px',
                        background: '#f1f5f9',
                        scrollbarWidth: 'thin',
                        scrollbarColor: '#cbd5e1 #f1f5f9'
                    }}>
                        <div style={{ position: 'relative' }}>
                            <img
                                src={pdfPreview.imgData}
                                alt={pdfPreview.title}
                                style={{
                                    maxWidth: '100%',
                                    width: '1500px', // Increased width for maximum visibility
                                    boxShadow: '0 20px 50px rgba(0,0,0,0.08), 0 0 1px rgba(0,0,0,0.1)',
                                    borderRadius: '4px',
                                    background: 'white',
                                    display: 'block',
                                    imageRendering: 'crisp-edges' // General sharpening
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Premium Loading Overlay */}
            {status?.type === 'info' && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(255, 255, 255, 0.7)',
                    zIndex: 9999, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: '20px',
                    backdropFilter: 'blur(8px)'
                }}>
                    <div style={{
                        background: 'white', padding: '40px', borderRadius: '24px',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.1)', border: '1px solid #f1f5f9',
                        display: 'flex', flexDirection: 'column', alignItems: 'center'
                    }}>
                        <Loader text={status.message} />
                        <div style={{ marginTop: '16px', color: '#64748b', fontSize: '14px', fontWeight: '500' }}>
                            {t('reports.messages.preparing')}
                        </div>
                    </div>
                </div>
            )}

            {/* Filter Modal */}
            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Filter size={20} />
                        <span>{t('reports.filter.title')} <span style={{ color: '#64748b', fontWeight: 'normal' }}>- {selectedPreset ? selectedPreset.title : ''}</span></span>
                    </div>
                }
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                onOk={handleGenerateClick}
                okText={t('reports.buttons.download', 'Download')}
                cancelText={t('reports.buttons.cancel', 'Cancel')}
                centered
                styles={{ body: { padding: '20px 0' } }}
            >
                {selectedPreset && (
                    <Space direction="vertical" size={16} style={{ width: '100%' }}>

                        {/* Daily Report Filter */}
                        {selectedPreset.id === 'daily' && (
                            <>
                                {/* Date Mode Toggle */}
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                    {[
                                        {
                                            key: 'single',
                                            icon: '📅',
                                            label: i18n.language === 'mr' ? 'एक दिवस' : i18n.language === 'hi' ? 'एक दिन' : 'Single Day'
                                        },
                                        {
                                            key: 'range',
                                            icon: '📆',
                                            label: i18n.language === 'mr' ? 'तारीख श्रेणी' : i18n.language === 'hi' ? 'तारीख सीमा' : 'Date Range'
                                        }
                                    ].map(opt => (
                                        <button
                                            key={opt.key}
                                            onClick={() => {
                                                setDailyDateMode(opt.key);
                                                setDateMode(opt.key);
                                                if (opt.key === 'range') {
                                                    setDateRange([dayjs().subtract(7, 'day'), dayjs()]);
                                                } else {
                                                    setSelectedDate(dayjs());
                                                }
                                            }}
                                            style={{
                                                flex: 1, padding: '10px 16px',
                                                borderRadius: '10px',
                                                border: dailyDateMode === opt.key ? '2px solid #4f46e5' : '2px solid #e5e7eb',
                                                background: dailyDateMode === opt.key ? '#eef2ff' : 'white',
                                                color: dailyDateMode === opt.key ? '#4338ca' : '#6b7280',
                                                fontWeight: dailyDateMode === opt.key ? '700' : '500',
                                                cursor: 'pointer', fontSize: '14px',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                                transition: 'all 0.15s'
                                            }}
                                        >
                                            <span>{opt.icon}</span>
                                            <span>{opt.label}</span>
                                        </button>
                                    ))}
                                </div>

                                {/* Date Picker — Single or Range */}
                                {dailyDateMode === 'single' ? (
                                    <DatePicker
                                        value={selectedDate}
                                        onChange={setSelectedDate}
                                        format="DD/MM/YYYY"
                                        allowClear={false}
                                        style={{ width: '100%' }}
                                    />
                                ) : (
                                    <RangePicker
                                        value={dateRange}
                                        onChange={setDateRange}
                                        format="DD/MM/YYYY"
                                        allowClear={false}
                                        style={{ width: '100%' }}
                                    />
                                )}

                                {/* Animal Type Filter */}
                                <div style={{ padding: '16px', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0', marginTop: '4px' }}>
                                    <p style={{ fontWeight: 600, margin: '0 0 12px 0', color: '#166534', fontSize: '14px' }}>
                                        {i18n.language === 'mr' ? 'प्रकारानुसार फिल्टर करा' : i18n.language === 'hi' ? 'प्रकार के अनुसार फ़िल्टर करें' : 'Filter by Animal Type'}
                                    </p>
                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                        {[
                                            {
                                                key: 'both',
                                                icon: '🐄🐃',
                                                label: i18n.language === 'mr' ? 'गाय व म्हैस' : i18n.language === 'hi' ? 'गाय और भैंस' : 'Both'
                                            },
                                            {
                                                key: 'cow',
                                                icon: '🐄',
                                                label: i18n.language === 'mr' ? 'गाय' : i18n.language === 'hi' ? 'गाय' : 'Cow'
                                            },
                                            {
                                                key: 'buffalo',
                                                icon: '🐃',
                                                label: i18n.language === 'mr' ? 'म्हैस' : i18n.language === 'hi' ? 'भैंस' : 'Buffalo'
                                            },
                                        ].map(opt => (
                                            <button
                                                key={opt.key}
                                                onClick={() => setDailyAnimalFilter(opt.key)}
                                                style={{
                                                    flex: 1, minWidth: '90px',
                                                    padding: '10px 14px',
                                                    borderRadius: '10px',
                                                    border: dailyAnimalFilter === opt.key ? '2px solid #16a34a' : '2px solid #e5e7eb',
                                                    background: dailyAnimalFilter === opt.key ? '#dcfce7' : 'white',
                                                    color: dailyAnimalFilter === opt.key ? '#15803d' : '#374151',
                                                    fontWeight: dailyAnimalFilter === opt.key ? '700' : '500',
                                                    cursor: 'pointer',
                                                    fontSize: '14px',
                                                    transition: 'all 0.15s',
                                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px'
                                                }}
                                            >
                                                <span style={{ fontSize: '22px' }}>{opt.icon}</span>
                                                <span>{opt.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Monthly/Profit/Shift Filter */}
                        {['monthly', 'profit', 'shift'].includes(selectedPreset.id) && (
                            <>
                                <p style={{ fontWeight: 500, margin: '0 0 8px 0' }}>{t('reports.filter.month')}</p>
                                <DatePicker
                                    picker="month"
                                    value={selectedDate}
                                    onChange={setSelectedDate}
                                    format="MMMM YYYY"
                                    allowClear={false}
                                    style={{ width: '100%' }}
                                />
                            </>
                        )}

                        {/* Range Based Reports */}
                        {['sales', 'federation', 'payments', 'deductions', 'backup', 'top_producers', 'low_quality'].includes(selectedPreset.id) && (
                            <>
                                <p style={{ fontWeight: 500, margin: '0 0 8px 0' }}>{t('reports.filter.range')}</p>
                                <RangePicker
                                    value={dateRange}
                                    onChange={setDateRange}
                                    format="DD/MM/YYYY"
                                    allowClear={false}
                                    style={{ width: '100%' }}
                                />
                            </>
                        )}

                        {/* Farmer Register — Milk Type Filter */}
                        {selectedPreset.id === 'farmers' && (
                            <div style={{ padding: '16px', background: '#f8faff', borderRadius: '12px', border: '1px solid #e0e7ff' }}>
                                <p style={{ fontWeight: 600, margin: '0 0 12px 0', color: '#3730a3', fontSize: '14px' }}>
                                    {t('reports.farmerRegister.filterLabel', 'Filter by Milk Type')}
                                </p>
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                    {[
                                        { key: 'All', icon: '🐄🐃', label: t('reports.farmerRegister.all', 'All Farmers') },
                                        { key: 'Cow', icon: '🐄', label: t('collection.cow', 'Cow') },
                                        { key: 'Buffalo', icon: '🐃', label: t('collection.buffalo', 'Buffalo') },
                                    ].map(opt => (
                                        <button
                                            key={opt.key}
                                            onClick={() => setFarmerMilkFilter(opt.key)}
                                            style={{
                                                flex: 1, minWidth: '90px',
                                                padding: '10px 14px',
                                                borderRadius: '10px',
                                                border: farmerMilkFilter === opt.key ? '2px solid #6366f1' : '2px solid #e5e7eb',
                                                background: farmerMilkFilter === opt.key ? '#eef2ff' : 'white',
                                                color: farmerMilkFilter === opt.key ? '#4f46e5' : '#374151',
                                                fontWeight: farmerMilkFilter === opt.key ? '700' : '500',
                                                cursor: 'pointer',
                                                fontSize: '14px',
                                                transition: 'all 0.15s',
                                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px'
                                            }}
                                        >
                                            <span style={{ fontSize: '22px' }}>{opt.icon}</span>
                                            <span>{opt.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* No Filter Reports (rates only now) */}
                        {selectedPreset.id === 'rates' && (
                            <div style={{ padding: '12px', background: '#f1f5f9', borderRadius: '8px', textAlign: 'center', color: '#64748b' }}>
                                {t('reports.messages.noFilterRequired')}
                            </div>
                        )}

                    </Space>
                )}
            </Modal>

            {/* Custom Modals */}
            <DifferenceBillModal
                isOpen={isDiffBillModalOpen}
                onClose={() => setIsDiffBillModalOpen(false)}
                onGenerate={(values) => {
                    setIsDiffBillModalOpen(false);
                    generateReport({ ...selectedPreset, customValues: values });
                }}
            />

            <MilkCollectionReportModal
                isOpen={isMilkReportModalOpen}
                onClose={() => setIsMilkReportModalOpen(false)}
                onGenerate={(values) => {
                    setIsMilkReportModalOpen(false);
                    generateReport({ ...selectedPreset, customValues: values });
                }}
            />

            <MemberStatementModal
                isOpen={isMemberStatementModalOpen}
                onClose={() => setIsMemberStatementModalOpen(false)}
                onGenerate={(values) => {
                    setIsMemberStatementModalOpen(false);
                    generateReport({ ...selectedPreset, customValues: values });
                }}
            />
        </div >
    );
};

export default Reports;
