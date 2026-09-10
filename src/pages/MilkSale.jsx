import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { ShoppingCart, Save, RefreshCw, Package, Edit, X, Trash2, Search, User, Download, Calendar, FileText, Printer } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Loader from '../components/Loader';
import { useAlert } from '../hooks/useAlert';
import { supabase } from '../lib/supabase';
import {
    getMilkSales,
    addMilkSale,
    updateMilkSale,
    deleteMilkSale,
    getSellingRates,
    getLastLocalSale
} from '../lib/api';

function MilkSale({ user }) {
    const { t } = useTranslation();
    const { showAlert, showConfirm, AlertComponent } = useAlert();
    const language = i18n.language;
    const [sales, setSales] = useState([]);
    const [customers, setCustomers] = useState([]); // Registered customers
    const [filteredCustomers, setFilteredCustomers] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const searchRef = useRef(null);

    const [sellingRates, setSellingRates] = useState({ Cow: 0, Buffalo: 0 });
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        sale_date: new Date().toISOString().split('T')[0],
        customer_name: '',
        customer_id: null,
        milk_type: 'Buffalo',
        shift: new Date().getHours() < 12 ? 'Morning' : 'Evening',
        quantity: '',
        rate: 0,
        amount: 0,
        payment_method: 'Cash',
        received_amount: '',
        remaining_amount: '0.00'
    });

    const [showEditModal, setShowEditModal] = useState(false);
    const [editData, setEditData] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // Customer Bill Print States
    const [selectedCustomerBill, setSelectedCustomerBill] = useState(null);
    const [showBillModal, setShowBillModal] = useState(false);
    const [customerBillSales, setCustomerBillSales] = useState([]);
    const [billPdfLoading, setBillPdfLoading] = useState(false);
    const billPrintRef = useRef(null);

    // Report section state
    const [reportStartDate, setReportStartDate] = useState(() => {
        const d = new Date();
        d.setDate(1);
        return d.toISOString().split('T')[0];
    });
    const [reportEndDate, setReportEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [reportData, setReportData] = useState(null);
    const [reportLoading, setReportLoading] = useState(false);
    const [reportPdfLoading, setReportPdfLoading] = useState(false);
    const reportRef = useRef(null);

    useEffect(() => {
        if (user?.dairy_id) {
            loadSellingRates();
            loadSales();
            loadCustomers();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.dairy_id]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const loadCustomers = async () => {
        try {
            const { data, error } = await supabase
                .from('local_sale_customers')
                .select('id, name, mobile, billing_cycle')
                .eq('dairy_id', user?.dairy_id)
                .eq('is_active', true);

            if (!error && data) setCustomers(data);
        } catch (err) {
            console.error("Error loading customers", err);
        }
    };

    const handleCustomerSearch = (e) => {
        const value = e.target.value;
        setFormData(prev => ({ ...prev, customer_name: value, customer_id: null })); // Reset ID on type

        if (value.trim()) {
            const lower = value.toLowerCase();
            const matches = customers.filter(c =>
                c.name.toLowerCase().includes(lower) ||
                c.id.toString() === value ||
                (c.mobile && c.mobile.includes(value))
            );
            setFilteredCustomers(matches);
            setShowSuggestions(true);
        } else {
            setShowSuggestions(false);
        }
    };

    const selectCustomer = async (customer) => {
        setFormData(prev => ({
            ...prev,
            customer_name: customer.name,
            customer_id: customer.id
        }));
        setShowSuggestions(false);

        // Auto-fetch last sale
        try {
            const lastSale = await getLastLocalSale(customer.id, user?.dairy_id);
            if (lastSale) {
                const milkType = lastSale.milk_type || 'Buffalo';
                const qty = lastSale.quantity || '';

                // Keep the fetched qty, calculate the rate
                setFormData(prev => {
                    const newRate = sellingRates[milkType] || 0;
                    const amount = qty ? (parseFloat(qty) * newRate).toFixed(2) : 0;
                    const isCreditCycle = customer.billing_cycle === '10_days' || customer.billing_cycle === '30_days';
                    const method = isCreditCycle ? 'Udhari' : 'Cash';
                    let rec = '';
                    let rem = '0.00';
                    if (method === 'Cash') {
                        rec = amount;
                        rem = '0.00';
                    } else if (method === 'Udhari') {
                        rec = '0.00';
                        rem = amount;
                    }
                    return {
                        ...prev,
                        milk_type: milkType,
                        quantity: qty,
                        rate: newRate,
                        amount,
                        payment_method: method,
                        received_amount: rec,
                        remaining_amount: rem
                    };
                });
            } else {
                setFormData(prev => {
                    const isCreditCycle = customer.billing_cycle === '10_days' || customer.billing_cycle === '30_days';
                    const method = isCreditCycle ? 'Udhari' : 'Cash';
                    let rec = '';
                    let rem = '0.00';
                    if (method === 'Cash') {
                        rec = prev.amount;
                        rem = '0.00';
                    } else if (method === 'Udhari') {
                        rec = '0.00';
                        rem = prev.amount;
                    }
                    return {
                        ...prev,
                        payment_method: method,
                        received_amount: rec,
                        remaining_amount: rem
                    };
                });
            }
        } catch (error) {
            console.error("Error fetching last local sale:", error);
        }
    };

    const loadSellingRates = async () => {
        try {
            const data = await getSellingRates(user?.dairy_id);

            const ratesMap = { Cow: 0, Buffalo: 0 };
            if (data) {
                data.forEach(r => {
                    ratesMap[r.milk_type] = r.rate;
                });
            }
            setSellingRates(ratesMap);

            setFormData(prev => ({
                ...prev,
                rate: ratesMap[prev.milk_type] || 0,
                amount: ((parseFloat(prev.quantity) || 0) * (ratesMap[prev.milk_type] || 0)).toFixed(2)
            }));
        } catch (error) {
            console.error("Error loading selling rates:", error);
        }
    };

    const loadSales = async () => {
        setLoading(true);
        try {
            const data = await getMilkSales(user?.dairy_id);
            setSales(data || []);
        } catch (error) {
            console.error("Error loading sales:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleMilkTypeChange = (newType) => {
        const newRate = sellingRates[newType] || 0;
        const quantity = parseFloat(formData.quantity) || 0;
        const amount = (quantity * newRate).toFixed(2);
        setFormData(prev => {
            const method = prev.payment_method || 'Cash';
            let rec = prev.received_amount;
            let rem = '0.00';
            if (method === 'Cash') {
                rec = amount;
                rem = '0.00';
            } else if (method === 'Udhari') {
                rec = '0.00';
                rem = amount;
            } else if (method === 'Partial') {
                rec = prev.received_amount || '';
                const recVal = parseFloat(rec || 0);
                rem = Math.max(0, parseFloat(amount) - recVal).toFixed(2);
            }
            return {
                ...prev,
                milk_type: newType,
                rate: newRate,
                amount,
                received_amount: rec,
                remaining_amount: rem
            };
        });
    };

    const handleQuantityChange = (e) => {
        const value = e.target.value;
        const quantity = parseFloat(value) || 0;
        const rate = formData.rate || 0;
        const amount = (quantity * rate).toFixed(2);
        setFormData(prev => {
            const method = prev.payment_method || 'Cash';
            let rec = prev.received_amount;
            let rem = '0.00';
            if (method === 'Cash') {
                rec = amount;
                rem = '0.00';
            } else if (method === 'Udhari') {
                rec = '0.00';
                rem = amount;
            } else if (method === 'Partial') {
                rec = prev.received_amount || '';
                const recVal = parseFloat(rec || 0);
                rem = Math.max(0, parseFloat(amount) - recVal).toFixed(2);
            }
            return {
                ...prev,
                quantity: value,
                amount,
                received_amount: rec,
                remaining_amount: rem
            };
        });
    };

    const handlePaymentMethodChange = (method) => {
        setFormData(prev => {
            const total = parseFloat(prev.amount || 0);
            let rec = prev.received_amount;
            let rem = '0.00';
            if (method === 'Cash') {
                rec = prev.amount;
                rem = '0.00';
            } else if (method === 'Udhari') {
                rec = '0.00';
                rem = prev.amount;
            } else if (method === 'Partial') {
                rec = '';
                rem = prev.amount;
            }
            return {
                ...prev,
                payment_method: method,
                received_amount: rec,
                remaining_amount: rem
            };
        });
    };

    const handleReceivedAmountChange = (e) => {
        const value = e.target.value;
        setFormData(prev => {
            const total = parseFloat(prev.amount || 0);
            const recVal = parseFloat(value) || 0;
            const rem = Math.max(0, total - recVal).toFixed(2);
            return {
                ...prev,
                received_amount: value,
                remaining_amount: rem
            };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.customer_name || !formData.quantity) {
            showAlert(t('milkSale.fillRequired'), t('milkSale.error'), 'warning');
            return;
        }

        if (!user?.dairy_id) {
            showAlert('System Error: User session invalid', 'Error', 'error');
            return;
        }

        // Validate customer if they searched by ID or name
        if (formData.customer_name && !formData.customer_id) {
            // Check if it's a valid customer by searching
            const searchValue = formData.customer_name.toLowerCase();
            const foundCustomer = customers.find(c =>
                c.name.toLowerCase() === searchValue ||
                c.id.toString() === formData.customer_name
            );

            if (foundCustomer) {
                // Auto-select the customer
                setFormData(prev => ({
                    ...prev,
                    customer_id: foundCustomer.id
                }));
            } else {
                // Check if user entered a number (ID)
                if (!isNaN(formData.customer_name)) {
                    showAlert(language === 'mr'
                        ? 'ग्राहक आढळला नाही! कृपया वैध ग्राहक निवडा किंवा नवीन ग्राहक नाव प्रविष्ट करा.'
                        : language === 'hi'
                            ? 'ग्राहक नहीं मिला! कृपया मान्य ग्राहक चुनें या नया ग्राहक नाम दर्ज करें.'
                            : 'Customer not found! Please select a valid customer or enter new customer name.',
                        'Customer Not Found',
                        'warning'
                    );
                    setFormData(prev => ({ ...prev, customer_name: '' }));
                    return;
                }
                // If it's text and not found, allow it as ad-hoc customer name
            }
        }

        try {
            const saleData = {
                dairy_id: user.dairy_id,
                sale_date: formData.sale_date,
                customer_name: formData.customer_name,
                customer_id: formData.customer_id,
                milk_type: formData.milk_type,
                quantity: parseFloat(formData.quantity),
                rate: parseFloat(formData.rate),
                amount: parseFloat(formData.amount),
                shift: formData.shift,
                payment_method: formData.payment_method || 'Cash',
                received_amount: formData.received_amount !== '' ? parseFloat(formData.received_amount) : parseFloat(formData.amount),
                remaining_amount: parseFloat(formData.remaining_amount || 0)
            };

            await addMilkSale(saleData);

            showAlert(t('milkSale.success'), t('milkSale.title'), 'success');

            // Print receipt for milk sale
            printMilkSaleReceipt(saleData).catch(err => {
                console.error('Print error:', err);
                showAlert('Failed to print receipt: ' + err.message, 'Print Error', 'error');
            });

            setFormData(prev => ({
                ...prev,
                customer_name: '',
                customer_id: null,
                quantity: '',
                amount: 0,
                payment_method: 'Cash',
                shift: new Date().getHours() < 12 ? 'Morning' : 'Evening',
                received_amount: '',
                remaining_amount: '0.00'
            }));

            loadSales();
        } catch (error) {
            console.error("Error saving sale:", error);
            showAlert(t('milkSale.error') + " " + error.message, 'Error', 'error');
        }
    };

    const printMilkSaleReceipt = async (saleData) => {
        if (!window.electron || !window.electron.printReceipt) {
            console.error('Print system not available');
            throw new Error('Print system not available');
        }

        try {
            // Read custom print settings
            const savedSettings = localStorage.getItem('entryPrintSettings');
            let printSettings = null;
            if (savedSettings) {
                try {
                    printSettings = JSON.parse(savedSettings);
                } catch (e) {
                    console.error('Failed to parse print settings', e);
                }
            }

            // Format data for MILK SALE receipt (simpler than farmer collection)
            const receiptData = {
                // Mark this as a sale, not collection
                isMilkSale: true,
                receiptTitle: 'MILK SALE',
                dairyName: user?.dairy_name, // Pass dairy name for receipt title

                // Customer details
                farmer_id: saleData.customer_id || 0,
                farmerName: saleData.customer_name,
                farmerCode: saleData.customer_id ? saleData.customer_id.toString() : '', // Pass ID to show "ID - Name"

                // Sale details
                milk_type: saleData.milk_type,
                quantity: saleData.quantity,
                rate: saleData.rate,
                amount: saleData.amount,
                sale_date: saleData.sale_date,

                // Shift/time info  
                shift: saleData.shift === 'Morning' ? '10:00:00 AM' : '06:00:00 PM',
                
                // Payment details
                payment_method: saleData.payment_method || 'Cash',
                received_amount: saleData.received_amount !== undefined && saleData.received_amount !== null ? saleData.received_amount : saleData.amount,
                remaining_amount: saleData.remaining_amount || 0,
                // NOTE: NO fat/snf properties - completely excluded for milk sale
            };

            const result = await window.electron.printReceipt(receiptData, i18n.language, printSettings);
            console.log('Milk sale receipt printed successfully');
            return result;
        } catch (error) {
            console.error('Print error:', error);
            throw error;
        }
    };

    const handleEditClick = (sale) => {
        setEditData({
            id: sale.id,
            sale_date: sale.sale_date,
            customer_name: sale.customer_name,
            milk_type: sale.milk_type,
            quantity: sale.quantity.toString(),
            rate: sale.rate,
            amount: sale.amount,
            payment_method: sale.payment_method || 'Cash',
            received_amount: sale.received_amount != null ? sale.received_amount.toString() : '',
            remaining_amount: sale.remaining_amount != null ? sale.remaining_amount.toString() : '0.00'
        });
        setShowEditModal(true);
    };

    const handleEditMilkTypeChange = (newType) => {
        const newRate = sellingRates[newType] || editData.rate;
        const quantity = parseFloat(editData.quantity) || 0;
        const totalAmount = (quantity * newRate).toFixed(2);
        setEditData(prev => {
            const method = prev.payment_method || 'Cash';
            let rec = prev.received_amount;
            let rem = '0.00';
            if (method === 'Cash') {
                rec = totalAmount;
                rem = '0.00';
            } else if (method === 'Udhari') {
                rec = '0.00';
                rem = totalAmount;
            } else if (method === 'Partial') {
                rec = prev.received_amount || '';
                const recVal = parseFloat(rec || 0);
                rem = Math.max(0, parseFloat(totalAmount) - recVal).toFixed(2);
            }
            return {
                ...prev,
                milk_type: newType,
                rate: newRate,
                amount: totalAmount,
                received_amount: rec,
                remaining_amount: rem
            };
        });
    };

    const handleEditQuantityChange = (e) => {
        const value = e.target.value;
        const quantity = parseFloat(value) || 0;
        const rate = editData.rate || 0;
        const totalAmount = (quantity * rate).toFixed(2);
        setEditData(prev => {
            const method = prev.payment_method || 'Cash';
            let rec = prev.received_amount;
            let rem = '0.00';
            if (method === 'Cash') {
                rec = totalAmount;
                rem = '0.00';
            } else if (method === 'Udhari') {
                rec = '0.00';
                rem = totalAmount;
            } else if (method === 'Partial') {
                rec = prev.received_amount || '';
                const recVal = parseFloat(rec || 0);
                rem = Math.max(0, parseFloat(totalAmount) - recVal).toFixed(2);
            }
            return {
                ...prev,
                quantity: value,
                amount: totalAmount,
                received_amount: rec,
                remaining_amount: rem
            };
        });
    };

    const handleEditPaymentMethodChange = (method) => {
        setEditData(prev => {
            const total = parseFloat(prev.amount || 0);
            let rec = prev.received_amount;
            let rem = '0.00';
            if (method === 'Cash') {
                rec = prev.amount;
                rem = '0.00';
            } else if (method === 'Udhari') {
                rec = '0.00';
                rem = prev.amount;
            } else if (method === 'Partial') {
                rec = '';
                rem = prev.amount;
            }
            return {
                ...prev,
                payment_method: method,
                received_amount: rec,
                remaining_amount: rem
            };
        });
    };

    const handleEditReceivedAmountChange = (e) => {
        const value = e.target.value;
        setEditData(prev => {
            const total = parseFloat(prev.amount || 0);
            const recVal = parseFloat(value) || 0;
            const rem = Math.max(0, total - recVal).toFixed(2);
            return {
                ...prev,
                received_amount: value,
                remaining_amount: rem
            };
        });
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        if (!editData.customer_name || !editData.quantity) {
            showAlert(t('milkSale.fillRequired'), t('milkSale.error'), 'warning');
            return;
        }

        setIsSaving(true);
        try {
            await updateMilkSale({
                id: editData.id,
                sale_date: editData.sale_date,
                customer_name: editData.customer_name,
                milk_type: editData.milk_type,
                shift: editData.shift,
                quantity: parseFloat(editData.quantity),
                rate: parseFloat(editData.rate),
                amount: parseFloat(editData.amount),
                payment_method: editData.payment_method || 'Cash',
                received_amount: editData.received_amount !== '' ? parseFloat(editData.received_amount) : parseFloat(editData.amount),
                remaining_amount: parseFloat(editData.remaining_amount || 0),
                dairy_id: user?.dairy_id
            }, user?.dairy_id);

            setShowEditModal(false);
            setEditData(null);
            loadSales();
        } catch (error) {
            console.error("Error updating sale:", error);
            showAlert(t('milkSale.updateError'), 'Error', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteSale = async (sale) => {
        const confirmed = await showConfirm(
            t('milkSale.deleteConfirm', { name: sale.customer_name, qty: sale.quantity }),
            t('milkSale.title'),
            t('common.delete', { defaultValue: 'Delete' }),
            t('common.cancel', { defaultValue: 'Cancel' })
        );

        if (confirmed) {
            try {
                await deleteMilkSale(sale.id, user?.dairy_id);
                loadSales();
            } catch (error) {
                console.error("Error deleting sale:", error);
                showAlert(t('milkSale.deleteError'), 'Error', 'error');
            }
        }
    };

    const handleMarkAsPaid = async (sale) => {
        const confirmed = await showConfirm(
            (language === 'mr' 
                ? `आपण नक्की या बिलाला पूर्णपणे जमा/पेड करू इच्छिता? "${sale.customer_name}"` 
                : language === 'hi' 
                    ? `क्या आप वाकई इस बिल को पूरी तरह से भुगतान (पेड) करना चाहते हैं? "${sale.customer_name}"` 
                    : `Are you sure you want to mark this bill as fully paid for "${sale.customer_name}"?`),
            t('milkSale.markAsPaid') || 'Mark as Paid',
            t('common.ok') || 'OK'
        );

        if (confirmed) {
            setLoading(true);
            try {
                const updated = await updateMilkSale({
                    id: sale.id,
                    payment_method: 'Cash',
                    received_amount: parseFloat(sale.amount),
                    remaining_amount: 0,
                    dairy_id: user?.dairy_id
                }, user?.dairy_id);

                showAlert(t('milkSale.success'), t('milkSale.title'), 'success');

                // Print receipt for paid bill
                printMilkSaleReceipt(updated).catch(err => {
                    console.error('Print error:', err);
                });

                loadSales();
            } catch (err) {
                console.error("Error updating payment:", err);
                showAlert('Failed to update payment status', 'Error', 'error');
            } finally {
                setLoading(false);
            }
        }
    };

    // --- Report Section Functions ---
    const loadReportData = async () => {
        if (!user?.dairy_id || !reportStartDate || !reportEndDate) return;
        setReportLoading(true);
        try {
            // Load customers to map billing cycle
            const { data: custData, error: custErr } = await supabase
                .from('local_sale_customers')
                .select('name, billing_cycle')
                .eq('dairy_id', user.dairy_id);

            const cycleMap = {};
            if (!custErr && custData) {
                custData.forEach(c => {
                    cycleMap[c.name.toLowerCase().trim()] = c.billing_cycle || 'immediate';
                });
            }

            const { data, error } = await supabase
                .from('milk_sales')
                .select('*')
                .eq('dairy_id', user.dairy_id)
                .gte('sale_date', reportStartDate)
                .lte('sale_date', reportEndDate)
                .order('sale_date', { ascending: true });

            if (error) throw error;

            // Aggregate by customer and milk type
            const customerMap = {};
            let totalQty = 0, totalAmt = 0, totalReceived = 0, totalRemaining = 0;

            (data || []).forEach(sale => {
                const key = `${sale.customer_name}-${sale.milk_type}`;
                if (!customerMap[key]) {
                    customerMap[key] = {
                        customer_name: sale.customer_name,
                        milk_type: sale.milk_type,
                        total_qty: 0,
                        total_amount: 0,
                        received_amount: 0,
                        remaining_amount: 0,
                        entries: 0,
                        billing_cycle: 'immediate',
                        customer_id: sale.customer_id
                    };
                }
                const qty = parseFloat(sale.quantity || 0);
                const amt = parseFloat(sale.amount || 0);
                const rec = parseFloat(sale.received_amount !== null && sale.received_amount !== undefined ? sale.received_amount : sale.amount);
                const rem = parseFloat(sale.remaining_amount || 0);

                customerMap[key].total_qty += qty;
                customerMap[key].total_amount += amt;
                customerMap[key].received_amount += rec;
                customerMap[key].remaining_amount += rem;
                customerMap[key].entries++;
                totalQty += qty;
                totalAmt += amt;
                totalReceived += rec;
                totalRemaining += rem;

                const cNameLower = (sale.customer_name || '').toLowerCase().trim();
                if (cycleMap[cNameLower]) {
                    customerMap[key].billing_cycle = cycleMap[cNameLower];
                }
            });

            const rows = Object.values(customerMap).sort((a, b) => a.customer_name.localeCompare(b.customer_name));

            // Calculate billing days
            const start = new Date(reportStartDate);
            const end = new Date(reportEndDate);
            const billingDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

            setReportData({
                rows,
                totalQty: totalQty.toFixed(1),
                totalAmount: totalAmt.toFixed(2),
                totalReceived: totalReceived.toFixed(2),
                totalRemaining: totalRemaining.toFixed(2),
                totalEntries: (data || []).length,
                billingDays
            });
        } catch (err) {
            console.error('Error loading report:', err);
            showAlert(t('milkSale.error'), 'Error', 'error');
        } finally {
            setReportLoading(false);
        }
    };

    const handleDownloadReport = async () => {
        if (!reportRef.current || !reportData) return;
        setReportPdfLoading(true);
        try {
            const canvas = await html2canvas(reportRef.current, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`MilkSale_Report_${reportStartDate}_to_${reportEndDate}.pdf`);
        } catch (err) {
            console.error('Error generating PDF:', err);
        } finally {
            setReportPdfLoading(false);
        }
    };

    const handlePrintCustomerBill = async (row) => {
        const format = localStorage.getItem('billFormat') || 'format2';
        
        if (format === 'format1') {
            // Thermal printer format
            if (!window.electron || !window.electron.printReceipt) {
                showAlert('Print system not available', 'Error', 'error');
                return;
            }
            setReportLoading(true);
            try {
                // Get all individual milk sales for this customer within the date range for the receipt
                const { data, error } = await supabase
                    .from('milk_sales')
                    .select('*')
                    .eq('dairy_id', user.dairy_id)
                    .eq('customer_name', row.customer_name)
                    .gte('sale_date', reportStartDate)
                    .lte('sale_date', reportEndDate)
                    .order('sale_date', { ascending: true });

                if (error) throw error;

                // Call Electron Print Receipt with isLocalSaleBill: true
                const receiptData = {
                    isLocalSaleBill: true,
                    dairyName: user?.dairy_name,
                    customerName: row.customer_name,
                    billingCycle: row.billing_cycle,
                    startDate: reportStartDate,
                    endDate: reportEndDate,
                    rows: data || [],
                    totalQty: row.total_qty,
                    totalAmount: row.total_amount,
                    receivedAmount: row.received_amount,
                    remainingAmount: row.remaining_amount,
                };
                
                await window.electron.printReceipt(receiptData, language);
                showAlert('Receipt sent to printer', 'Success', 'success');
            } catch (err) {
                console.error("Error printing thermal local bill:", err);
                showAlert('Failed to print receipt: ' + err.message, 'Print Error', 'error');
            } finally {
                setReportLoading(false);
            }
        } else {
            // A4 Formats (format2 or format3)
            // Fetch detailed list of transactions for this customer
            setReportLoading(true);
            try {
                const { data, error } = await supabase
                    .from('milk_sales')
                    .select('*')
                    .eq('dairy_id', user.dairy_id)
                    .eq('customer_name', row.customer_name)
                    .gte('sale_date', reportStartDate)
                    .lte('sale_date', reportEndDate)
                    .order('sale_date', { ascending: true });

                if (error) throw error;

                setCustomerBillSales(data || []);
                setSelectedCustomerBill(row);
                setShowBillModal(true);
            } catch (err) {
                console.error("Error loading customer sales:", err);
                showAlert('Failed to load transaction details', 'Error', 'error');
            } finally {
                setReportLoading(false);
            }
        }
    };

    const handleDownloadCustomerBillPdf = async () => {
        if (!billPrintRef.current || !selectedCustomerBill) return;
        setBillPdfLoading(true);
        try {
            const canvas = await html2canvas(billPrintRef.current, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Bill_${selectedCustomerBill.customer_name}_${reportStartDate}_to_${reportEndDate}.pdf`);
        } catch (err) {
            console.error('Error generating Customer Bill PDF:', err);
            showAlert('Failed to generate PDF', 'Error', 'error');
        } finally {
            setBillPdfLoading(false);
        }
    };

    return (
        <div style={{
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
                        margin: '0 0 8px 0',
                        color: '#111827',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                    }}>
                        <ShoppingCart size={28} />
                        {t('milkSale.title')}
                    </h1>
                    <p style={{ fontSize: '15px', color: '#6b7280', margin: 0 }}>
                        {t('milkSale.subtitle')}
                    </p>
                </div>
            </div>

            {/* Main Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1.5fr',
                gap: '24px',
                marginBottom: '32px'
            }}>
                {/* Sale Form */}
                <div style={{
                    background: 'white',
                    borderRadius: '20px',
                    padding: '32px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                    <h2 style={{
                        fontSize: '20px',
                        fontWeight: '700',
                        marginBottom: '24px',
                        color: '#111827',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                    }}>
                        <Package size={22} />
                        {t('milkSale.newSale')}
                    </h2>

                    <form onSubmit={handleSubmit}>
                        {/* Date */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{
                                display: 'block',
                                fontSize: '14px',
                                fontWeight: '600',
                                color: '#374151',
                                marginBottom: '8px'
                            }}>
                                {t('milkSale.saleDate')}
                            </label>
                            <input
                                type="date"
                                value={formData.sale_date}
                                onChange={(e) => setFormData(prev => ({ ...prev, sale_date: e.target.value }))}
                                style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    borderRadius: '12px',
                                    border: '2px solid #e5e7eb',
                                    fontSize: '15px',
                                    outline: 'none',
                                    transition: 'all 0.2s'
                                }}
                            />
                        </div>

                        {/* Customer Search / Name */}
                        <div style={{ marginBottom: '20px', position: 'relative' }} ref={searchRef}>
                            <label style={{
                                display: 'block',
                                fontSize: '14px',
                                fontWeight: '600',
                                color: '#374151',
                                marginBottom: '8px'
                            }}>
                                {t('milkSale.customerName')} / ID
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    placeholder="Search Name or Enter ID..."
                                    value={formData.customer_name}
                                    onChange={handleCustomerSearch}
                                    onFocus={() => {
                                        if (formData.customer_name) {
                                            handleCustomerSearch({ target: { value: formData.customer_name } });
                                        }
                                    }}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        paddingRight: '40px',
                                        borderRadius: '12px',
                                        border: '2px solid #e5e7eb',
                                        fontSize: '15px',
                                        outline: 'none',
                                        transition: 'all 0.2s'
                                    }}
                                />
                                <Search size={18} style={{
                                    position: 'absolute',
                                    right: '12px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: '#9ca3af'
                                }} />
                            </div>

                            {/* Suggestions Dropdown */}
                            {showSuggestions && filteredCustomers.length > 0 && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    zIndex: 10,
                                    background: 'white',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '12px',
                                    marginTop: '4px',
                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                    maxHeight: '200px',
                                    overflowY: 'auto'
                                }}>
                                    {filteredCustomers.map(customer => (
                                        <div
                                            key={customer.id}
                                            onClick={() => selectCustomer(customer)}
                                            style={{
                                                padding: '10px 16px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                borderBottom: '1px solid #f3f4f6'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                                        >
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontWeight: '500', color: '#1f2937' }}>{customer.name}</span>
                                                <span style={{ fontSize: '12px', color: '#6b7280' }}>ID: {customer.id}</span>
                                            </div>
                                            <span style={{ padding: '2px 6px', background: '#eff6ff', color: '#2563eb', borderRadius: '4px', fontSize: '11px' }}>
                                                Select
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Milk Type - Segmented Control */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{
                                display: 'block',
                                fontSize: '14px',
                                fontWeight: '600',
                                color: '#374151',
                                marginBottom: '8px'
                            }}>
                                {t('milkSale.milkType')}
                            </label>
                            <div style={{
                                display: 'flex',
                                background: '#f3f4f6',
                                borderRadius: '12px',
                                padding: '4px',
                                gap: '4px'
                            }}>
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, shift: 'Morning' }))}
                                    style={{
                                        flex: 1,
                                        padding: '10px 16px',
                                        background: formData.shift === 'Morning'
                                            ? 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)'
                                            : 'transparent',
                                        color: formData.shift === 'Morning' ? 'white' : '#6b7280',
                                        border: 'none',
                                        borderRadius: '10px',
                                        fontSize: '15px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        boxShadow: formData.shift === 'Morning'
                                            ? '0 2px 8px rgba(14, 165, 233, 0.35)'
                                            : 'none'
                                    }}
                                >
                                    ⛅ {t('dashboard.morning', { defaultValue: 'Morning' })}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, shift: 'Evening' }))}
                                    style={{
                                        flex: 1,
                                        padding: '10px 16px',
                                        background: formData.shift === 'Evening'
                                            ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)'
                                            : 'transparent',
                                        color: formData.shift === 'Evening' ? 'white' : '#6b7280',
                                        border: 'none',
                                        borderRadius: '10px',
                                        fontSize: '15px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        boxShadow: formData.shift === 'Evening'
                                            ? '0 2px 8px rgba(124, 58, 237, 0.35)'
                                            : 'none'
                                    }}
                                >
                                    🌙 {t('dashboard.evening', { defaultValue: 'Evening' })}
                                </button>
                            </div>
                        </div>

                        {/* Milk Type - Segmented Control */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{
                                display: 'block',
                                fontSize: '14px',
                                fontWeight: '600',
                                color: '#374151',
                                marginBottom: '8px'
                            }}>
                                {t('milkSale.milkType')}
                            </label>
                            <div style={{
                                display: 'flex',
                                background: '#f3f4f6',
                                borderRadius: '12px',
                                padding: '4px',
                                gap: '4px'
                            }}>
                                <button
                                    type="button"
                                    onClick={() => handleMilkTypeChange('Buffalo')}
                                    style={{
                                        flex: 1,
                                        padding: '10px 16px',
                                        background: formData.milk_type === 'Buffalo'
                                            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                            : 'transparent',
                                        color: formData.milk_type === 'Buffalo' ? 'white' : '#6b7280',
                                        border: 'none',
                                        borderRadius: '10px',
                                        fontSize: '15px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        boxShadow: formData.milk_type === 'Buffalo'
                                            ? '0 2px 8px rgba(102, 126, 234, 0.35)'
                                            : 'none'
                                    }}
                                >
                                    🐃 {t('milkSale.buffalo')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleMilkTypeChange('Cow')}
                                    style={{
                                        flex: 1,
                                        padding: '10px 16px',
                                        background: formData.milk_type === 'Cow'
                                            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                            : 'transparent',
                                        color: formData.milk_type === 'Cow' ? 'white' : '#6b7280',
                                        border: 'none',
                                        borderRadius: '10px',
                                        fontSize: '15px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        boxShadow: formData.milk_type === 'Cow'
                                            ? '0 2px 8px rgba(102, 126, 234, 0.35)'
                                            : 'none'
                                    }}
                                >
                                    🐄 {t('milkSale.cow')}
                                </button>
                            </div>
                        </div>

                        {/* Quantity */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{
                                display: 'block',
                                fontSize: '14px',
                                fontWeight: '600',
                                color: '#374151',
                                marginBottom: '8px'
                            }}>
                                {t('milkSale.quantity')}
                            </label>
                            <input
                                type="number"
                                step="0.5"
                                placeholder="0.0"
                                value={formData.quantity}
                                onChange={handleQuantityChange}
                                onWheel={(e) => e.target.blur()}
                                required
                                style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    borderRadius: '12px',
                                    border: '2px solid #e5e7eb',
                                    fontSize: '15px',
                                    fontWeight: '700',
                                    color: '#667eea',
                                    outline: 'none',
                                    transition: 'all 0.2s'
                                }}
                            />
                        </div>

                        {/* Payment Method Selector */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{
                                display: 'block',
                                fontSize: '14px',
                                fontWeight: '600',
                                color: '#374151',
                                marginBottom: '8px'
                            }}>
                                {t('milkSale.paymentMethod')}
                            </label>
                            <div style={{
                                display: 'flex',
                                background: '#f3f4f6',
                                borderRadius: '12px',
                                padding: '4px',
                                gap: '4px',
                                marginBottom: '12px'
                            }}>
                                <button
                                    type="button"
                                    onClick={() => handlePaymentMethodChange('Cash')}
                                    style={{
                                        flex: 1,
                                        padding: '8px 12px',
                                        background: formData.payment_method === 'Cash' ? '#1f2937' : 'transparent',
                                        color: formData.payment_method === 'Cash' ? 'white' : '#6b7280',
                                        border: 'none',
                                        borderRadius: '10px',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    💵 {t('milkSale.cash')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handlePaymentMethodChange('Udhari')}
                                    style={{
                                        flex: 1,
                                        padding: '8px 12px',
                                        background: formData.payment_method === 'Udhari' ? '#1f2937' : 'transparent',
                                        color: formData.payment_method === 'Udhari' ? 'white' : '#6b7280',
                                        border: 'none',
                                        borderRadius: '10px',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    📖 {t('milkSale.udhari')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handlePaymentMethodChange('Partial')}
                                    style={{
                                        flex: 1,
                                        padding: '8px 12px',
                                        background: formData.payment_method === 'Partial' ? '#1f2937' : 'transparent',
                                        color: formData.payment_method === 'Partial' ? 'white' : '#6b7280',
                                        border: 'none',
                                        borderRadius: '10px',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    ✂️ {t('milkSale.partial')}
                                </button>
                            </div>

                            {formData.payment_method === 'Partial' && (
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: '12px',
                                    marginTop: '12px',
                                    padding: '12px',
                                    background: '#f8fafc',
                                    borderRadius: '12px',
                                    border: '1px solid #e2e8f0'
                                }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#4b5563', marginBottom: '4px' }}>
                                            {t('milkSale.amountReceived')}
                                        </label>
                                        <input
                                            type="number"
                                            placeholder="0.00"
                                            value={formData.received_amount}
                                            onChange={handleReceivedAmountChange}
                                            style={{
                                                width: '100%',
                                                padding: '8px 12px',
                                                borderRadius: '8px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '14px',
                                                outline: 'none'
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#4b5563', marginBottom: '4px' }}>
                                            {t('milkSale.amountRemaining')}
                                        </label>
                                        <div style={{
                                            padding: '8px 12px',
                                            borderRadius: '8px',
                                            border: '1px solid #cbd5e1',
                                            background: '#f1f5f9',
                                            fontSize: '14px',
                                            fontWeight: '700',
                                            color: '#ef4444'
                                        }}>
                                            ₹ {formData.remaining_amount}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {formData.payment_method === 'Udhari' && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '10px 12px',
                                    background: '#fffbeb',
                                    border: '1px solid #fde68a',
                                    borderRadius: '10px',
                                    fontSize: '13px',
                                    color: '#b45309',
                                    fontWeight: '500'
                                }}>
                                    ⚠️ {t('milkSale.amountRemaining')}: ₹ {formData.amount}
                                </div>
                            )}
                        </div>

                        {/* Computed Amount Card */}
                        <div style={{
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            borderRadius: '16px',
                            padding: '24px',
                            marginBottom: '24px',
                            color: 'white'
                        }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <p style={{
                                        fontSize: '13px',
                                        opacity: 0.9,
                                        margin: '0 0 6px 0',
                                        fontWeight: '500'
                                    }}>
                                        {t('milkSale.ratePerL')}
                                    </p>
                                    <p style={{
                                        fontSize: '24px',
                                        fontWeight: '700',
                                        margin: 0,
                                        lineHeight: 1
                                    }}>
                                        ₹{formData.rate ? formData.rate.toFixed(2) : '0.00'}
                                    </p>
                                </div>
                                <div>
                                    <p style={{
                                        fontSize: '13px',
                                        opacity: 0.9,
                                        margin: '0 0 6px 0',
                                        fontWeight: '500'
                                    }}>
                                        {t('milkSale.totalAmount')}
                                    </p>
                                    <p style={{
                                        fontSize: '24px',
                                        fontWeight: '700',
                                        margin: 0,
                                        lineHeight: 1
                                    }}>
                                        ₹{formData.amount}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            style={{
                                width: '100%',
                                padding: '14px 24px',
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '12px',
                                fontSize: '16px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px',
                                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.35)',
                                transition: 'all 0.3s'
                            }}
                        >
                            <Save size={20} strokeWidth={2.5} />
                            {t('milkSale.recordSale')}
                        </button>
                    </form>
                </div>

                {/* Recent Sales */}
                <div style={{
                    background: 'white',
                    borderRadius: '20px',
                    overflow: 'hidden',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                    <div style={{
                        padding: '24px 24px 20px 24px',
                        borderBottom: '1px solid #f3f4f6',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <div>
                            <h2 style={{
                                fontSize: '20px',
                                fontWeight: '700',
                                margin: '0 0 4px 0',
                                color: '#111827'
                            }}>
                                {t('milkSale.recentSales')}
                            </h2>
                            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                                {formData.sale_date}
                            </p>
                        </div>
                        <button
                            onClick={loadSales}
                            style={{
                                padding: '8px 16px',
                                background: '#f3f4f6',
                                color: '#374151',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: '500',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <RefreshCw size={16} />
                            {t('milkSale.refresh')}
                        </button>
                    </div>

                    <div style={{ maxHeight: '600px', overflowY: 'auto', minHeight: '300px' }}>
                        {loading ? (
                            <div style={{ padding: '60px' }}><Loader /></div>
                        ) : sales.filter(s => s.sale_date === formData.sale_date).length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '60px 20px',
                                color: '#9ca3af'
                            }}>
                                <ShoppingCart size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                                <p style={{ fontSize: '15px', fontWeight: '500', margin: '0 0 4px 0' }}>
                                    {t('milkSale.noSales')}
                                </p>
                                <p style={{ fontSize: '13px', margin: 0 }}>
                                    {t('milkSale.recordSaleToSee')}
                                </p>
                            </div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#fafafa' }}>
                                        <th style={{
                                            padding: '14px 20px',
                                            textAlign: 'left',
                                            fontSize: '12px',
                                            fontWeight: '700',
                                            color: '#6b7280',
                                            letterSpacing: '0.5px',
                                            textTransform: 'uppercase'
                                        }}>{t('milkSale.table.date')}</th>
                                        <th style={{
                                            padding: '14px 20px',
                                            textAlign: 'left',
                                            fontSize: '12px',
                                            fontWeight: '700',
                                            color: '#6b7280',
                                            letterSpacing: '0.5px',
                                            textTransform: 'uppercase'
                                        }}>{t('milkSale.table.customer')}</th>
                                        <th style={{
                                            padding: '14px 20px',
                                            textAlign: 'left',
                                            fontSize: '12px',
                                            fontWeight: '700',
                                            color: '#6b7280',
                                            letterSpacing: '0.5px',
                                            textTransform: 'uppercase'
                                        }}>{t('milkSale.table.type')}</th>
                                        <th style={{
                                            padding: '14px 20px',
                                            textAlign: 'right',
                                            fontSize: '12px',
                                            fontWeight: '700',
                                            color: '#6b7280',
                                            letterSpacing: '0.5px',
                                            textTransform: 'uppercase'
                                        }}>{t('milkSale.table.qty')}</th>
                                        <th style={{
                                            padding: '14px 20px',
                                            textAlign: 'right',
                                            fontSize: '12px',
                                            fontWeight: '700',
                                            color: '#6b7280',
                                            letterSpacing: '0.5px',
                                            textTransform: 'uppercase'
                                        }}>{t('milkSale.table.amount')}</th>
                                        <th style={{
                                            padding: '14px 20px',
                                            textAlign: 'left',
                                            fontSize: '12px',
                                            fontWeight: '700',
                                            color: '#6b7280',
                                            letterSpacing: '0.5px',
                                            textTransform: 'uppercase'
                                        }}>{t('dashboard.shift', { defaultValue: 'Shift' })}</th>
                                        <th style={{
                                            padding: '14px 20px',
                                            textAlign: 'left',
                                            fontSize: '12px',
                                            fontWeight: '700',
                                            color: '#6b7280',
                                            letterSpacing: '0.5px',
                                            textTransform: 'uppercase'
                                        }}>{t('milkSale.paymentMethod')}</th>
                                        <th style={{
                                            padding: '14px 20px',
                                            textAlign: 'center',
                                            fontSize: '12px',
                                            fontWeight: '700',
                                            color: '#6b7280',
                                            letterSpacing: '0.5px',
                                            textTransform: 'uppercase'
                                        }}>{t('milkSale.table.action')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sales.filter(s => s.sale_date === formData.sale_date).map((sale, index) => (
                                        <tr key={sale.id} style={{
                                            borderBottom: '1px solid #f3f4f6',
                                            background: index % 2 === 0 ? 'white' : '#fafafa'
                                        }}>
                                            <td style={{ padding: '14px 20px', fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                                                {sale.sale_date}
                                            </td>
                                            <td style={{ padding: '14px 20px', fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                                                {sale.customer_name}
                                            </td>
                                            <td style={{ padding: '14px 20px' }}>
                                                <span style={{
                                                    padding: '4px 10px',
                                                    background: sale.milk_type === 'Cow' ? '#fed7aa' : '#dbeafe',
                                                    color: sale.milk_type === 'Cow' ? '#9a3412' : '#1e40af',
                                                    borderRadius: '10px',
                                                    fontSize: '12px',
                                                    fontWeight: '600'
                                                }}>
                                                    {sale.milk_type}
                                                </span>
                                            </td>
                                            <td style={{ padding: '14px 20px', fontSize: '14px', fontWeight: '700', color: '#667eea', textAlign: 'right' }}>
                                                {sale.quantity}L
                                            </td>
                                            <td style={{ padding: '14px 20px', fontSize: '15px', fontWeight: '700', color: '#059669', textAlign: 'right' }}>
                                                ₹{parseFloat(sale.amount).toFixed(2)}
                                            </td>
                                            <td style={{ padding: '14px 20px', fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                                                {(String(sale.shift || '').toUpperCase().includes('PM') || String(sale.shift || '').toUpperCase() === 'EVENING') ? t('dashboard.evening', { defaultValue: 'Evening' }) : t('dashboard.morning', { defaultValue: 'Morning' })}
                                            </td>
                                            <td style={{ padding: '14px 20px', fontSize: '14px' }}>
                                                {sale.payment_method ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                        <span style={{
                                                            padding: '2px 8px',
                                                            background: sale.remaining_amount > 0 ? '#fef3c7' : '#dcfce7',
                                                            color: sale.remaining_amount > 0 ? '#b45309' : '#15803d',
                                                            borderRadius: '6px',
                                                            fontSize: '11px',
                                                            fontWeight: '700',
                                                            alignSelf: 'flex-start'
                                                        }}>
                                                            {sale.remaining_amount > 0 
                                                                ? (sale.payment_method === 'Partial' ? `${t('milkSale.partial')}` : `${t('milkSale.udhari')}`)
                                                                : `${t('milkSale.paid')}`}
                                                        </span>
                                                        {sale.remaining_amount > 0 && (
                                                            <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: '600' }}>
                                                                {t('milkSale.amountRemaining')}: ₹{parseFloat(sale.remaining_amount).toFixed(2)}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span style={{ color: '#9ca3af', fontSize: '12px' }}>—</span>
                                                )}
                                            </td>
                                            <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                                                    {sale.remaining_amount > 0 && (
                                                        <button
                                                            onClick={() => handleMarkAsPaid(sale)}
                                                            title={t('milkSale.markAsPaid')}
                                                            style={{
                                                                padding: '6px 10px',
                                                                background: '#dcfce7',
                                                                border: 'none',
                                                                borderRadius: '6px',
                                                                cursor: 'pointer',
                                                                color: '#15803d',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '4px',
                                                                fontSize: '13px',
                                                                fontWeight: '600'
                                                            }}
                                                        >
                                                            ✓ {t('milkSale.paid')}
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleEditClick(sale)}
                                                        title={t('milkSale.editSale')}
                                                        style={{
                                                            padding: '6px 10px',
                                                            background: '#f3f4f6',
                                                            border: 'none',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            color: '#374151',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            fontSize: '13px',
                                                            fontWeight: '500'
                                                        }}
                                                    >
                                                        <Edit size={14} />
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteSale(sale)}
                                                        title={t('milkSale.deleteSale')}
                                                        style={{
                                                            padding: '6px 10px',
                                                            background: '#fee2e2',
                                                            border: 'none',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            color: '#dc2626',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            fontSize: '13px',
                                                            fontWeight: '500'
                                                        }}
                                                    >
                                                        <Trash2 size={14} />
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {/* ========== REPORT SECTION ========== */}
            <div style={{
                background: 'white',
                borderRadius: '20px',
                padding: '24px 32px',
                border: '1px solid #e5e7eb',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                marginBottom: '24px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{
                        fontSize: '20px',
                        fontWeight: '700',
                        color: '#111827',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        margin: 0
                    }}>
                        <FileText size={22} />
                        {t('billing.billSummary.title')}
                    </h2>
                </div>

                {/* Date Range Filters */}
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '20px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                            <Calendar size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                            {t('billing.startDate')}
                        </label>
                        <input
                            type="date"
                            value={reportStartDate}
                            onChange={(e) => setReportStartDate(e.target.value)}
                            style={{
                                padding: '10px 14px',
                                borderRadius: '10px',
                                border: '2px solid #e5e7eb',
                                fontSize: '14px',
                                outline: 'none'
                            }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                            <Calendar size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                            {t('billing.endDate')}
                        </label>
                        <input
                            type="date"
                            value={reportEndDate}
                            onChange={(e) => setReportEndDate(e.target.value)}
                            style={{
                                padding: '10px 14px',
                                borderRadius: '10px',
                                border: '2px solid #e5e7eb',
                                fontSize: '14px',
                                outline: 'none'
                            }}
                        />
                    </div>
                    <button
                        onClick={loadReportData}
                        disabled={reportLoading}
                        style={{
                            padding: '10px 20px',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '10px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: reportLoading ? 'not-allowed' : 'pointer',
                            opacity: reportLoading ? 0.6 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <RefreshCw size={16} className={reportLoading ? 'spin' : ''} />
                        {reportLoading ? t('billing.loading') : t('billing.billSummary.title')}
                    </button>
                    {reportData && (
                        <button
                            onClick={handleDownloadReport}
                            disabled={reportPdfLoading}
                            style={{
                                padding: '10px 20px',
                                background: '#059669',
                                color: 'white',
                                border: 'none',
                                borderRadius: '10px',
                                fontSize: '14px',
                                fontWeight: '600',
                                cursor: reportPdfLoading ? 'not-allowed' : 'pointer',
                                opacity: reportPdfLoading ? 0.6 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            <Download size={16} />
                            {reportPdfLoading ? '...' : 'PDF'}
                        </button>
                    )}
                </div>

                {/* Report Table (On-Screen) */}
                {reportLoading ? (
                    <div style={{ padding: '40px' }}><Loader /></div>
                ) : reportData ? (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                            <thead>
                                <tr style={{ background: '#f9fafb' }}>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '700', color: '#374151', borderBottom: '2px solid #e5e7eb' }}>#</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '700', color: '#374151', borderBottom: '2px solid #e5e7eb' }}>{t('billing.billSummary.name')}</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '700', color: '#374151', borderBottom: '2px solid #e5e7eb' }}>{t('billing.details.type')}</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', color: '#374151', borderBottom: '2px solid #e5e7eb' }}>{t('billing.billSummary.liters')}</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', color: '#374151', borderBottom: '2px solid #e5e7eb' }}>{t('billing.billSummary.rate')}</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', color: '#374151', borderBottom: '2px solid #e5e7eb' }}>{t('billing.billSummary.amount')}</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', color: '#374151', borderBottom: '2px solid #e5e7eb' }}>{t('milkSale.amountReceived')}</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', color: '#374151', borderBottom: '2px solid #e5e7eb' }}>{t('milkSale.amountRemaining')}</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '700', color: '#374151', borderBottom: '2px solid #e5e7eb' }}>{t('milkSale.table.action')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportData.rows.map((row, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6', background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                                        <td style={{ padding: '10px 16px', color: '#6b7280' }}>{idx + 1}</td>
                                        <td style={{ padding: '10px 16px', fontWeight: '600', color: '#111827' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <span>{row.customer_name}</span>
                                                <span style={{
                                                    fontSize: '11px',
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    fontWeight: '700',
                                                    alignSelf: 'flex-start',
                                                    background: row.billing_cycle === '10_days' ? '#fef3c7' : row.billing_cycle === '30_days' ? '#e0e7ff' : '#dcfce7',
                                                    color: row.billing_cycle === '10_days' ? '#d97706' : row.billing_cycle === '30_days' ? '#4f46e5' : '#15803d',
                                                }}>
                                                    {row.billing_cycle === '10_days' ? t('billingCycle.10days') : row.billing_cycle === '30_days' ? t('billingCycle.30days') : t('billingCycle.immediate')}
                                                </span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                                            <span style={{
                                                padding: '3px 8px',
                                                background: row.milk_type === 'Cow' ? '#fed7aa' : '#dbeafe',
                                                color: row.milk_type === 'Cow' ? '#9a3412' : '#1e40af',
                                                borderRadius: '8px',
                                                fontSize: '12px',
                                                fontWeight: '600'
                                            }}>
                                                {row.milk_type === 'Cow' ? t('collection.cow') : t('collection.buffalo')}
                                            </span>
                                        </td>
                                        <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '500' }}>{row.total_qty.toFixed(1)}</td>
                                        <td style={{ padding: '10px 16px', textAlign: 'right', color: '#6b7280' }}>
                                            ₹{row.total_qty > 0 ? (row.total_amount / row.total_qty).toFixed(2) : '0.00'}
                                        </td>
                                        <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '700', color: '#059669' }}>₹{row.total_amount.toFixed(2)}</td>
                                        <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '700', color: '#10b981' }}>₹{row.received_amount.toFixed(2)}</td>
                                        <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '700', color: row.remaining_amount > 0 ? '#ef4444' : '#6b7280' }}>₹{row.remaining_amount.toFixed(2)}</td>
                                        <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                                            <button
                                                onClick={() => handlePrintCustomerBill(row)}
                                                style={{
                                                    padding: '6px 12px',
                                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    fontSize: '13px',
                                                    fontWeight: '600',
                                                    boxShadow: '0 2px 4px rgba(102,126,234,0.2)'
                                                }}
                                            >
                                                <Printer size={14} />
                                                {language === 'mr' ? 'बिल प्रिंट' : language === 'hi' ? 'बिल प्रिंट' : 'Print Bill'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr style={{ background: '#f0f9ff', fontWeight: '700' }}>
                                    <td colSpan="3" style={{ padding: '12px 16px', textAlign: 'right', borderTop: '2px solid #e5e7eb' }}>{t('billing.billSummary.total')}</td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right', borderTop: '2px solid #e5e7eb' }}>{reportData.totalQty} L</td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right', borderTop: '2px solid #e5e7eb' }}></td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right', borderTop: '2px solid #e5e7eb', color: '#059669' }}>₹{reportData.totalAmount}</td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right', borderTop: '2px solid #e5e7eb', color: '#10b981' }}>₹{reportData.totalReceived}</td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right', borderTop: '2px solid #e5e7eb', color: '#ef4444' }}>₹{reportData.totalRemaining}</td>
                                    <td style={{ padding: '12px 16px', borderTop: '2px solid #e5e7eb' }}></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                        <FileText size={40} style={{ opacity: 0.4, margin: '0 auto 12px' }} />
                        <p style={{ margin: 0, fontSize: '14px' }}>{t('billing.noData')}</p>
                    </div>
                )}
            </div>

            {/* Hidden PDF Render Target for Report */}
            {reportData && (
                <div style={{ position: 'fixed', left: '-9999px', top: 0 }}>
                    <div ref={reportRef} style={{
                        width: '794px',
                        background: 'white',
                        color: 'black',
                        fontFamily: '"Noto Sans", sans-serif',
                        padding: '10mm',
                        boxSizing: 'border-box'
                    }}>
                        {/* PDF Header */}
                        <div style={{ textAlign: 'center', borderBottom: '2px solid black', paddingBottom: '8px', marginBottom: '12px' }}>
                            <h1 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 'bold' }}>{user?.dairy_name || ''}</h1>
                            <p style={{ margin: 0, fontSize: '12px', fontWeight: 'bold' }}>
                                {t('billing.billSummary.daysBillSummary', { days: reportData.billingDays })}
                            </p>
                            <p style={{ margin: '4px 0 0 0', fontSize: '11px' }}>
                                {t('billing.billPrint.period')}: {new Date(reportStartDate).toLocaleDateString('en-GB')} {t('billing.billPrint.to')} {new Date(reportEndDate).toLocaleDateString('en-GB')}
                            </p>
                        </div>

                        {/* PDF Table */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', fontSize: '10px' }}>
                            <thead>
                                <tr style={{ background: '#f0f0f0', fontWeight: 'bold', textAlign: 'center' }}>
                                    <th style={{ border: '1px solid black', padding: '4px' }}>#</th>
                                    <th style={{ border: '1px solid black', padding: '4px' }}>{t('billing.billSummary.name')}</th>
                                    <th style={{ border: '1px solid black', padding: '4px' }}>{t('billing.details.type')}</th>
                                    <th style={{ border: '1px solid black', padding: '4px' }}>{t('billing.billSummary.liters')}</th>
                                    <th style={{ border: '1px solid black', padding: '4px' }}>{t('billing.billSummary.rate')}</th>
                                    <th style={{ border: '1px solid black', padding: '4px' }}>{t('billing.billSummary.amount')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportData.rows.map((row, idx) => (
                                    <tr key={idx} style={{ textAlign: 'right' }}>
                                        <td style={{ border: '1px solid black', padding: '3px', textAlign: 'center' }}>{idx + 1}</td>
                                        <td style={{ border: '1px solid black', padding: '3px', textAlign: 'left', fontWeight: 'bold' }}>{row.customer_name}</td>
                                        <td style={{ border: '1px solid black', padding: '3px', textAlign: 'center' }}>
                                            {row.milk_type === 'Cow' ? t('collection.cow') : t('collection.buffalo')}
                                        </td>
                                        <td style={{ border: '1px solid black', padding: '3px' }}>{row.total_qty.toFixed(1)}</td>
                                        <td style={{ border: '1px solid black', padding: '3px' }}>
                                            ₹{row.total_qty > 0 ? (row.total_amount / row.total_qty).toFixed(2) : '0.00'}
                                        </td>
                                        <td style={{ border: '1px solid black', padding: '3px', fontWeight: 'bold' }}>₹{row.total_amount.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr style={{ fontWeight: 'bold', background: '#e5e7eb' }}>
                                    <td colSpan="3" style={{ border: '1px solid black', padding: '4px', textAlign: 'right', fontSize: '11px' }}>
                                        {t('billing.billSummary.total')}
                                    </td>
                                    <td style={{ border: '1px solid black', padding: '4px', textAlign: 'right', fontSize: '11px' }}>
                                        {reportData.totalQty} L
                                    </td>
                                    <td style={{ border: '1px solid black', padding: '4px' }}></td>
                                    <td style={{ border: '1px solid black', padding: '4px', textAlign: 'right', fontSize: '11px' }}>
                                        ₹{reportData.totalAmount}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>

                        {/* PDF Footer */}
                        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                            <div style={{ color: '#666' }}>
                                <p style={{ margin: 0 }}>Powered by DudhSakha | ☎ 8999112047</p>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ borderTop: '1px solid black', width: '100px', marginBottom: '4px' }}></div>
                                <span style={{ fontWeight: 'bold' }}>{t('billing.billPrint.signature')}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && editData && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: 'white',
                        borderRadius: '20px',
                        width: '90%',
                        maxWidth: '480px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
                    }}>
                        {/* Modal Header */}
                        <div style={{
                            padding: '24px',
                            borderBottom: '1px solid #e5e7eb',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <h2 style={{
                                fontSize: '20px',
                                fontWeight: '700',
                                margin: 0,
                                color: '#111827',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px'
                            }}>
                                <Edit size={22} />
                                {t('milkSale.editSale')}
                            </h2>
                            <button
                                onClick={() => { setShowEditModal(false); setEditData(null); }}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#6b7280',
                                    padding: '4px'
                                }}
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleEditSubmit} style={{ padding: '24px' }}>
                            {/* Date */}
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: '#374151',
                                    marginBottom: '6px'
                                }}>
                                    {t('milkSale.saleDate')}
                                </label>
                                <input
                                    type="date"
                                    value={editData.sale_date}
                                    onChange={(e) => setEditData(prev => ({ ...prev, sale_date: e.target.value }))}
                                    style={{
                                        width: '100%',
                                        padding: '10px 14px',
                                        borderRadius: '10px',
                                        border: '2px solid #e5e7eb',
                                        fontSize: '14px',
                                        outline: 'none'
                                    }}
                                />
                            </div>

                            {/* Customer Name */}
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: '#374151',
                                    marginBottom: '6px'
                                }}>
                                    {t('milkSale.customerName')}
                                </label>
                                <input
                                    type="text"
                                    value={editData.customer_name}
                                    onChange={(e) => setEditData(prev => ({ ...prev, customer_name: e.target.value }))}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '10px 14px',
                                        borderRadius: '10px',
                                        border: '2px solid #e5e7eb',
                                        fontSize: '14px',
                                        outline: 'none'
                                    }}
                                />
                            </div>

                            {/* Shift - Edit Modal */}
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    color: '#4b5563',
                                    marginBottom: '6px'
                                }}>
                                    {t('dashboard.shift', { defaultValue: 'Shift' })}
                                </label>
                                <div style={{
                                    display: 'flex',
                                    background: '#f3f4f6',
                                    borderRadius: '10px',
                                    padding: '3px',
                                    gap: '3px'
                                }}>
                                    <button
                                        type="button"
                                        onClick={() => setEditData(prev => ({ ...prev, shift: 'Morning' }))}
                                        style={{
                                            flex: 1,
                                            padding: '8px',
                                            background: editData.shift === 'Morning'
                                                ? 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)'
                                                : 'transparent',
                                            color: editData.shift === 'Morning' ? 'white' : '#6b7280',
                                            border: 'none',
                                            borderRadius: '8px',
                                            fontSize: '14px',
                                            fontWeight: '600',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        ⛅ {t('dashboard.morning', { defaultValue: 'Morning' })}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEditData(prev => ({ ...prev, shift: 'Evening' }))}
                                        style={{
                                            flex: 1,
                                            padding: '8px',
                                            background: editData.shift === 'Evening'
                                                ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)'
                                                : 'transparent',
                                            color: editData.shift === 'Evening' ? 'white' : '#6b7280',
                                            border: 'none',
                                            borderRadius: '8px',
                                            fontSize: '14px',
                                            fontWeight: '600',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        🌙 {t('dashboard.evening', { defaultValue: 'Evening' })}
                                    </button>
                                </div>
                            </div>

                            {/* Milk Type */}
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: '#374151',
                                    marginBottom: '6px'
                                }}>
                                    {t('milkSale.milkType')}
                                </label>
                                <div style={{
                                    display: 'flex',
                                    background: '#f3f4f6',
                                    borderRadius: '10px',
                                    padding: '3px',
                                    gap: '3px'
                                }}>
                                    <button
                                        type="button"
                                        onClick={() => handleEditMilkTypeChange('Buffalo')}
                                        style={{
                                            flex: 1,
                                            padding: '8px',
                                            background: editData.milk_type === 'Buffalo'
                                                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                                : 'transparent',
                                            color: editData.milk_type === 'Buffalo' ? 'white' : '#6b7280',
                                            border: 'none',
                                            borderRadius: '8px',
                                            fontSize: '14px',
                                            fontWeight: '600',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        🐃 {t('milkSale.buffalo')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleEditMilkTypeChange('Cow')}
                                        style={{
                                            flex: 1,
                                            padding: '8px',
                                            background: editData.milk_type === 'Cow'
                                                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                                : 'transparent',
                                            color: editData.milk_type === 'Cow' ? 'white' : '#6b7280',
                                            border: 'none',
                                            borderRadius: '8px',
                                            fontSize: '14px',
                                            fontWeight: '600',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        🐄 {t('milkSale.cow')}
                                    </button>
                                </div>
                            </div>

                            {/* Quantity */}
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: '#374151',
                                    marginBottom: '6px'
                                }}>
                                    {t('milkSale.quantity')}
                                </label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={editData.quantity}
                                    onChange={handleEditQuantityChange}
                                    onWheel={(e) => e.target.blur()}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '10px 14px',
                                        borderRadius: '10px',
                                        border: '2px solid #e5e7eb',
                                        fontSize: '14px',
                                        fontWeight: '700',
                                        color: '#667eea',
                                        outline: 'none'
                                    }}
                                />
                            </div>

                            {/* Amount Display */}
                            <div style={{
                                background: '#f3f4f6',
                                borderRadius: '12px',
                                padding: '16px',
                                marginBottom: '20px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div>
                                    <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>{t('milkSale.ratePerL')}: ₹{parseFloat(editData.rate).toFixed(2)}/L</p>
                                </div>
                                <div>
                                    <p style={{ fontSize: '18px', fontWeight: '700', color: '#059669', margin: 0 }}>
                                        {t('milkSale.totalAmount')}: ₹{parseFloat(editData.amount).toFixed(2)}
                                    </p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    onClick={() => { setShowEditModal(false); setEditData(null); }}
                                    disabled={isSaving}
                                    style={{
                                        padding: '10px 20px',
                                        background: '#f3f4f6',
                                        color: '#374151',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        cursor: isSaving ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    style={{
                                        padding: '10px 20px',
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        cursor: isSaving ? 'not-allowed' : 'pointer',
                                        opacity: isSaving ? 0.6 : 1
                                    }}
                                >
                                    {isSaving ? 'Saving...' : t('milkSale.editSale')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Customer Bill Modal */}
            {showBillModal && selectedCustomerBill && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '20px'
                }}>
                    <div style={{
                        background: 'white',
                        borderRadius: '20px',
                        width: '90%',
                        maxWidth: '850px',
                        maxHeight: '90vh',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
                        overflow: 'hidden'
                    }}>
                        {/* Modal Header */}
                        <div style={{
                            padding: '16px 24px',
                            borderBottom: '1px solid #e5e7eb',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: '#f8fafc'
                        }}>
                            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1f2937', margin: 0 }}>
                                {language === 'mr' ? 'ग्राहक बिल खतावणी' : language === 'hi' ? 'ग्राहक बिल खाता' : 'Customer Bill Ledger'}
                            </h2>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <button
                                    onClick={handleDownloadCustomerBillPdf}
                                    disabled={billPdfLoading}
                                    style={{
                                        padding: '8px 16px',
                                        background: '#059669',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    <Download size={16} />
                                    {billPdfLoading ? '...' : 'PDF'}
                                </button>
                                <button
                                    onClick={() => { setShowBillModal(false); setSelectedCustomerBill(null); setCustomerBillSales([]); }}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: '#6b7280',
                                        padding: '4px'
                                    }}
                                >
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body (Scrollable preview) */}
                        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, background: '#f1f5f9' }}>
                            {/* A4 Sheet Print Target */}
                            <div ref={billPrintRef} style={{
                                width: '794px', // A4 width
                                minHeight: '500px',
                                background: 'white',
                                color: 'black',
                                fontFamily: '"Noto Sans", sans-serif',
                                padding: '15mm 10mm',
                                boxSizing: 'border-box',
                                margin: '0 auto',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
                            }}>
                                {/* Dairy Header */}
                                <div style={{ textAlign: 'center', borderBottom: '2px solid black', paddingBottom: '12px', marginBottom: '16px' }}>
                                    <h1 style={{ margin: '0 0 6px 0', fontSize: '22px', fontWeight: 'bold' }}>{user?.dairy_name || ''}</h1>
                                    <p style={{ margin: '0 0 6px 0', fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                        {language === 'mr' ? 'ग्राहक बिल खतावणी स्टेटमेंट' : language === 'hi' ? 'ग्राहक बिल खाता स्टेटमेंट' : 'Local Sale Customer Statement'}
                                    </p>
                                    <p style={{ margin: 0, fontSize: '12px' }}>
                                        {t('billing.billPrint.period')}: {new Date(reportStartDate).toLocaleDateString('en-GB')} {t('billing.billPrint.to')} {new Date(reportEndDate).toLocaleDateString('en-GB')}
                                    </p>
                                </div>

                                {/* Customer Info Grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px', fontSize: '12px' }}>
                                    <div>
                                        <p style={{ margin: '0 0 4px 0' }}><strong>{t('billing.billSummary.name')}:</strong> {selectedCustomerBill.customer_name}</p>
                                        <p style={{ margin: 0 }}><strong>{t('billingCycle.label')}:</strong> {selectedCustomerBill.billing_cycle === '10_days' ? t('billingCycle.10days') : selectedCustomerBill.billing_cycle === '30_days' ? t('billingCycle.30days') : t('billingCycle.immediate')}</p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <p style={{ margin: '0 0 4px 0' }}><strong>Date:</strong> {new Date().toLocaleDateString('en-GB')}</p>
                                        <p style={{ margin: 0 }}>&nbsp;</p>
                                    </div>
                                </div>

                                {/* Detailed Ledger Table */}
                                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', fontSize: '11px' }}>
                                    <thead>
                                        <tr style={{ background: '#f1f5f9', fontWeight: 'bold', textAlign: 'center' }}>
                                            <th style={{ border: '1px solid black', padding: '6px' }}>#</th>
                                            <th style={{ border: '1px solid black', padding: '6px' }}>{t('milkSale.table.date')}</th>
                                            <th style={{ border: '1px solid black', padding: '6px' }}>{t('dashboard.shift', { defaultValue: 'Shift' })}</th>
                                            <th style={{ border: '1px solid black', padding: '6px' }}>{t('milkSale.milkType')}</th>
                                            <th style={{ border: '1px solid black', padding: '6px', textAlign: 'right' }}>{t('milkSale.quantity')}</th>
                                            <th style={{ border: '1px solid black', padding: '6px', textAlign: 'right' }}>{t('milkSale.ratePerL')}</th>
                                            <th style={{ border: '1px solid black', padding: '6px', textAlign: 'right' }}>{t('milkSale.totalAmount')}</th>
                                            <th style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>{t('milkSale.paymentMethod')}</th>
                                            <th style={{ border: '1px solid black', padding: '6px', textAlign: 'right' }}>{t('milkSale.amountReceived')}</th>
                                            <th style={{ border: '1px solid black', padding: '6px', textAlign: 'right' }}>{t('milkSale.amountRemaining')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {customerBillSales.map((sale, idx) => (
                                            <tr key={sale.id} style={{ textAlign: 'center' }}>
                                                <td style={{ border: '1px solid black', padding: '5px' }}>{idx + 1}</td>
                                                <td style={{ border: '1px solid black', padding: '5px' }}>{new Date(sale.sale_date).toLocaleDateString('en-GB')}</td>
                                                <td style={{ border: '1px solid black', padding: '5px' }}>{(String(sale.shift || '').toUpperCase().includes('PM') || String(sale.shift || '').toUpperCase() === 'EVENING') ? t('dashboard.evening', { defaultValue: 'Eve' }) : t('dashboard.morning', { defaultValue: 'Morn' })}</td>
                                                <td style={{ border: '1px solid black', padding: '5px' }}>{sale.milk_type === 'Cow' ? t('collection.cow') : t('collection.buffalo')}</td>
                                                <td style={{ border: '1px solid black', padding: '5px', textAlign: 'right' }}>{parseFloat(sale.quantity || 0).toFixed(1)} L</td>
                                                <td style={{ border: '1px solid black', padding: '5px', textAlign: 'right' }}>₹{parseFloat(sale.rate || 0).toFixed(2)}</td>
                                                <td style={{ border: '1px solid black', padding: '5px', textAlign: 'right', fontWeight: '600' }}>₹{parseFloat(sale.amount || 0).toFixed(2)}</td>
                                                <td style={{ border: '1px solid black', padding: '5px' }}>
                                                    {sale.payment_method === 'Cash' ? t('milkSale.cash') : sale.payment_method === 'Udhari' ? t('milkSale.udhari') : t('milkSale.partial')}
                                                </td>
                                                <td style={{ border: '1px solid black', padding: '5px', textAlign: 'right' }}>₹{parseFloat(sale.received_amount !== null && sale.received_amount !== undefined ? sale.received_amount : sale.amount).toFixed(2)}</td>
                                                <td style={{ border: '1px solid black', padding: '5px', textAlign: 'right', color: sale.remaining_amount > 0 ? '#dc2626' : 'black' }}>₹{parseFloat(sale.remaining_amount || 0).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ fontWeight: 'bold', background: '#e2e8f0' }}>
                                            <td colSpan="3" style={{ border: '1px solid black', padding: '6px', textAlign: 'right' }}>{t('billing.billSummary.total')}</td>
                                            <td style={{ border: '1px solid black', padding: '6px', textAlign: 'right' }}>{selectedCustomerBill.total_qty.toFixed(1)} L</td>
                                            <td style={{ border: '1px solid black', padding: '6px' }}></td>
                                            <td style={{ border: '1px solid black', padding: '6px', textAlign: 'right' }}>₹{selectedCustomerBill.total_amount.toFixed(2)}</td>
                                            <td style={{ border: '1px solid black', padding: '6px' }}></td>
                                            <td style={{ border: '1px solid black', padding: '6px', textAlign: 'right' }}>₹{selectedCustomerBill.received_amount.toFixed(2)}</td>
                                            <td style={{ border: '1px solid black', padding: '6px', textAlign: 'right', color: selectedCustomerBill.remaining_amount > 0 ? '#dc2626' : 'black' }}>₹{selectedCustomerBill.remaining_amount.toFixed(2)}</td>
                                        </tr>
                                    </tfoot>
                                </table>

                                {/* PDF Footer Signature */}
                                <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                    <div style={{ color: '#666' }}>
                                        <p style={{ margin: 0 }}>Powered by DudhSakha | ☎ 8999112047</p>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ borderTop: '1px solid black', width: '120px', marginBottom: '4px' }}></div>
                                        <span style={{ fontWeight: 'bold' }}>{t('billing.billPrint.signature')}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <AlertComponent />
        </div>
    );
}

export default MilkSale;

