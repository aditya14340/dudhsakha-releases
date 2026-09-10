import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Edit, Trash2, X, Wallet, Users, Clock, ChevronDown, ChevronUp, IndianRupee, Activity, CheckCircle2, AlertCircle } from 'lucide-react';
import Loader from '../components/Loader';
import { useAlert } from '../hooks/useAlert';
import FarmerDeductionStatement from '../components/FarmerDeductionStatement';

function Deductions({ user }) {
    const { t } = useTranslation();
    const { showAlert, showConfirm, AlertComponent } = useAlert();
    const [activeTab, setActiveTab] = useState('masters');
    const [deductions, setDeductions] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [farmers, setFarmers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [historyData, setHistoryData] = useState([]);
    const [expandedHistory, setExpandedHistory] = useState([]);

    const [showMasterModal, setShowMasterModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [farmerSearch, setFarmerSearch] = useState('');
    const [showFarmerDropdown, setShowFarmerDropdown] = useState(false);
    const [selectedStatementFarmer, setSelectedStatementFarmer] = useState(null);

    const [masterForm, setMasterForm] = useState({
        name: '',
        type: 'manual',
        default_amount: 0
    });

    const [assignForm, setAssignForm] = useState({
        farmer_id: '',
        deduction_master_id: '',
        amount: 0,
        total_amount: '',
        start_date: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        if (user?.dairy_id) {
            loadData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.dairy_id]);

    const loadData = async () => {
        setLoading(true);
        try {

            const masters = await window.api.getDeductionMasters(user?.dairy_id);
            setDeductions(masters || []);

            const farmerList = await window.api.getFarmers(user?.dairy_id);
            setFarmers(farmerList || []);


            const assigned = await window.api.getFarmerDeductions(user?.dairy_id);
            setAssignments(assigned || []);

            // Load deduction history from bill_payments (pass fresh farmers list)
            await loadHistory(farmerList || []);

        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setLoading(false);
        }
    };

    const loadHistory = async (farmerList) => {
        try {
            const fList = farmerList || farmers;
            const payments = await window.api.getBillPayments({ dairy_id: user?.dairy_id });
            
            // Get current assignments to show what's currently active but not yet paid
            const currentAssignments = await window.api.getFarmerDeductions(user?.dairy_id);
            
            const history = [];

            // 1. Add Paid Deductions from payments
            (payments || []).forEach(p => {
                let deductions = [];
                try {
                    deductions = typeof p.deductions_summary === 'string' 
                        ? JSON.parse(p.deductions_summary) 
                        : (p.deductions_summary || []);
                } catch (e) {
                    deductions = [];
                }
                const farmer = fList.find(f => String(f.id) === String(p.farmer_id));
                
                history.push({
                    id: `paid-${p.id}`,
                    paymentId: p.id,
                    paymentDate: p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-GB') : '-',
                    startDate: p.start_date,
                    endDate: p.end_date,
                    farmerId: p.farmer_id,
                    farmerName: farmer?.name || `Farmer ${p.farmer_id}`,
                    farmerCode: farmer?.code || '',
                    billAmount: parseFloat(p.amount || 0).toFixed(2),
                    deductions: deductions,
                    status: 'paid'
                });
            });

            // 2. Add Active Assignments that aren't necessarily in a payment yet
            // This ensures "History" shows what is CURRENTLY assigned even if history is empty
            (currentAssignments || []).forEach(a => {
                const farmer = fList.find(f => String(f.id) === String(a.farmer_id));
                history.push({
                    id: `active-${a.id}`,
                    paymentId: null,
                    paymentDate: 'Active Mapping',
                    startDate: a.start_date || '',
                    endDate: '',
                    farmerId: a.farmer_id,
                    farmerName: farmer?.name || a.farmer_name || 'Farmer',
                    farmerCode: farmer?.code || a.farmer_code || '',
                    billAmount: 'Pending Bill',
                    deductions: [{
                        id: a.id,
                        name: a.deduction_name,
                        amount: a.amount,
                        type: a.deduction_type
                    }],
                    status: 'active'
                });
            });

            // Sort: Paid first (by date desc), then Active
            history.sort((a, b) => {
                if (a.status === 'paid' && b.status === 'paid') {
                    return (b.startDate || '').localeCompare(a.startDate || '');
                }
                if (a.status === 'active' && b.status === 'active') return 0;
                return a.status === 'active' ? -1 : 1; // Active at top or bottom? User said "history not shows", maybe show active at top to be sure they see it.
            });

            setHistoryData(history);
        } catch (error) {
            console.error('Error loading deduction history:', error);
        }
    };

    const toggleHistoryExpand = (paymentId) => {
        setExpandedHistory(prev =>
            prev.includes(paymentId)
                ? prev.filter(id => id !== paymentId)
                : [...prev, paymentId]
        );
    };

    const normalizedCodeQuery = (raw) => {
        const q = (raw || '').trim().toLowerCase();
        if (!q) return { q, codeQ: '' };
        return { q, codeQ: q.startsWith('#') ? q.slice(1) : q };
    };

    const farmerMatchesSearch = (f, raw) => {
        const { q, codeQ } = normalizedCodeQuery(raw);
        if (!q) return true;
        const name = (f.name || '').toLowerCase();
        const code = String(f.code ?? '').toLowerCase();
        return name.includes(q) || (code && codeQ.length > 0 && code.includes(codeQ));
    };

    const filteredHistory = historyData.filter(h => {
        const { q, codeQ } = normalizedCodeQuery(searchTerm);
        if (!q) return true;
        const nameMatch = (h.farmerName || '').toLowerCase().includes(q);
        const codeStr = String(h.farmerCode ?? '').toLowerCase();
        const codeMatch = codeStr && codeQ.length > 0 && codeStr.includes(codeQ);
        return nameMatch || codeMatch;
    });

    const handleMasterSubmit = async (e) => {
        e.preventDefault();
        if (!user?.dairy_id) {
            showAlert('System Error: User session invalid', 'Error', 'error');
            return;
        }

        try {
            if (isEditing) {
                await window.api.updateDeductionMaster({ ...masterForm, id: editId, dairy_id: user.dairy_id });
            } else {
                await window.api.addDeductionMaster({ ...masterForm, dairy_id: user.dairy_id });


            }
            setShowMasterModal(false);
            resetMasterForm();
            loadData();
        } catch (error) {
            console.error("Error saving deduction:", error);
            showAlert(t('deductions.form.alerts.saveError') + " " + error.message, 'Error', 'error');
        }
    };

    const handleMasterDelete = async (id) => {
        const confirmed = await showConfirm(
            t('deductions.form.alerts.deleteMasterConfirm'),
            t('deductions.title'),
            t('common.delete', { defaultValue: 'Delete' }),
            t('common.cancel', { defaultValue: 'Cancel' })
        );

        if (confirmed) {
            try {
                await window.api.deleteDeductionMaster(id, user?.dairy_id);
                loadData();
            } catch (error) {
                console.error("Error deleting master:", error);
            }
        }
    };

    const openMasterEdit = (deduction) => {
        setMasterForm({
            name: deduction.name,
            type: deduction.type,
            default_amount: deduction.default_amount
        });
        setEditId(deduction.id);
        setIsEditing(true);
        setShowMasterModal(true);
    };

    const resetMasterForm = () => {
        setMasterForm({ name: '', type: 'manual', default_amount: 0 });
        setIsEditing(false);
        setEditId(null);
    };

    const handleAssignSubmit = async (e) => {
        e.preventDefault();
        if (!user?.dairy_id) return;

        try {
            const payload = {
                ...assignForm,
                total_amount: assignForm.total_amount === '' ? null : assignForm.total_amount,
                dairy_id: user.dairy_id
            };
            // Remove any extra fields the DB doesn't have
            delete payload.deduction_type;

            await window.api.assignDeduction(payload);

            setShowAssignModal(false);
            resetAssignForm();
            loadData();
            setActiveTab('assignments');
        } catch (error) {
            console.error("Error assigning deduction:", error);
            showAlert(t('deductions.form.alerts.assignError') + " " + error.message, 'Error', 'error');
        }
    };

    const handleAssignDelete = async (id) => {
        const confirmed = await showConfirm(
            t('deductions.form.alerts.deleteAssignConfirm'),
            t('deductions.title'),
            t('common.delete', { defaultValue: 'Delete' }),
            t('common.cancel', { defaultValue: 'Cancel' })
        );

        if (confirmed) {
            try {
                // Remove deduction entries from bill_payments history
                await window.api.removeDeductionFromHistory(id, user?.dairy_id);
                // Delete the farmer deduction assignment
                await window.api.deleteFarmerDeduction(id, user?.dairy_id);
                loadData();
            } catch (error) {
                console.error("Error deleting assignment:", error);
            }
        }
    };

    const resetAssignForm = () => {
        setAssignForm({
            farmer_id: '',
            deduction_master_id: '',
            amount: 0,
            total_amount: '',
            start_date: new Date().toISOString().split('T')[0]
        });
        setFarmerSearch('');
        setShowFarmerDropdown(false);
    };

    const handleDeductionChange = (e) => {
        const deductionId = e.target.value;
        const deduction = deductions.find(d => d.id == deductionId);

        setAssignForm(prev => ({
            ...prev,
            deduction_master_id: deductionId,
            amount: deduction ? deduction.default_amount : 0
        }));
    };

    const filteredMasters = deductions.filter(d =>
        d.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredAssignments = assignments.filter(a => {
        const { q, codeQ } = normalizedCodeQuery(searchTerm);
        if (!q) return true;
        const nameMatch = (a.farmer_name || '').toLowerCase().includes(q);
        const dedMatch = (a.deduction_name || '').toLowerCase().includes(q);
        const codeStr = String(a.farmer_code ?? '').toLowerCase();
        const codeMatch = codeStr && codeQ.length > 0 && codeStr.includes(codeQ);
        return nameMatch || dedMatch || codeMatch;
    });

    return (
        <div style={{ padding: '16px 32px', maxWidth: '1600px', margin: '0 auto', background: 'transparent', minHeight: '100%' }}>
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
                        <Wallet size={28} />
                        {t('deductions.title')}
                    </h1>
                    <p style={{ fontSize: '15px', color: '#6b7280', margin: 0 }}>{t('deductions.subtitle')}</p>
                </div>
            </div>

            {/* Tab Navigation */}

            {/* Metric Cards Section */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '24px',
                marginBottom: '32px'
            }}>
                {/* Total Active Assignments */}
                <div style={{
                    background: 'white',
                    borderRadius: '20px',
                    padding: '24px',
                    border: '1px solid #f1f5f9',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '20px'
                }}>
                    <div style={{
                        width: '56px', height: '56px', borderRadius: '16px',
                        background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4338ca'
                    }}>
                        <Users size={28} />
                    </div>
                    <div>
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#64748b' }}>{t('deductions.metrics.activeAssignments', { defaultValue: 'Active Assignments' })}</p>
                        <h3 style={{ margin: '4px 0 0 0', fontSize: '24px', fontWeight: '800', color: '#111827' }}>
                            {assignments.filter(a => a.status === 'active').length}
                        </h3>
                    </div>
                </div>

                {/* Active Masters */}
                <div style={{
                    background: 'white',
                    borderRadius: '20px',
                    padding: '24px',
                    border: '1px solid #f1f5f9',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '20px'
                }}>
                    <div style={{
                        width: '56px', height: '56px', borderRadius: '16px',
                        background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b45309'
                    }}>
                        <Activity size={28} />
                    </div>
                    <div>
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#64748b' }}>{t('deductions.metrics.deductionMasters', { defaultValue: 'Deduction Types' })}</p>
                        <h3 style={{ margin: '4px 0 0 0', fontSize: '24px', fontWeight: '800', color: '#111827' }}>
                            {deductions.length}
                        </h3>
                    </div>
                </div>

                {/* Total Collected */}
                <div style={{
                    background: 'white',
                    borderRadius: '20px',
                    padding: '24px',
                    border: '1px solid #f1f5f9',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '20px'
                }}>
                    <div style={{
                        width: '56px', height: '56px', borderRadius: '16px',
                        background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#15803d'
                    }}>
                        <CheckCircle2 size={28} />
                    </div>
                    <div>
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#64748b' }}>{t('deductions.metrics.totalCollected', { defaultValue: 'Total Collected' })}</p>
                        <h3 style={{ margin: '4px 0 0 0', fontSize: '24px', fontWeight: '800', color: '#15803d' }}>
                            ₹{assignments.reduce((sum, a) => sum + parseFloat(a.collected_amount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </h3>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div style={{
                display: 'flex',
                gap: '8px',
                background: '#f1f5f9',
                padding: '6px',
                borderRadius: '16px',
                marginBottom: '32px',
                width: 'fit-content'
            }}>
                <button
                    onClick={() => setActiveTab('masters')}
                    style={{
                        padding: '12px 24px',
                        background: activeTab === 'masters' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
                        color: activeTab === 'masters' ? 'white' : '#6b7280',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '15px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s',
                        boxShadow: activeTab === 'masters' ? '0 2px 8px rgba(102, 126, 234, 0.3)' : 'none'
                    }}
                >
                    <Wallet size={18} />
                    {t('deductions.form.buttons.masters')}
                </button>
                <button
                    onClick={() => setActiveTab('assignments')}
                    style={{
                        padding: '12px 24px',
                        background: activeTab === 'assignments' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
                        color: activeTab === 'assignments' ? 'white' : '#6b7280',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '15px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s',
                        boxShadow: activeTab === 'assignments' ? '0 2px 8px rgba(102, 126, 234, 0.3)' : 'none'
                    }}
                >
                    <Users size={18} />
                    {t('deductions.form.buttons.assignments')}
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    style={{
                        padding: '12px 24px',
                        background: activeTab === 'history' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
                        color: activeTab === 'history' ? 'white' : '#6b7280',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '15px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s',
                        boxShadow: activeTab === 'history' ? '0 2px 8px rgba(102, 126, 234, 0.3)' : 'none'
                    }}
                >
                    <Clock size={18} />
                    {t('deductions.form.buttons.history')}
                </button>
            </div>

            {/* Search & Actions Bar */}
            <div style={{
                background: 'white',
                borderRadius: '16px',
                padding: '20px 24px',
                marginBottom: '24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
                <div style={{ position: 'relative', flex: '1', maxWidth: '400px' }}>
                    <Search size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input
                        type="text"
                        placeholder={activeTab === 'masters' ? t('deductions.form.placeholders.searchMasters') : activeTab === 'history' ? t('deductions.form.placeholders.searchAssignments') : t('deductions.form.placeholders.searchAssignments')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '12px 16px 12px 48px',
                            borderRadius: '12px',
                            border: '2px solid #e5e7eb',
                            fontSize: '15px',
                            outline: 'none',
                            transition: 'all 0.2s'
                        }}
                    />
                </div>
                {activeTab !== 'history' && (
                <button
                    onClick={() => activeTab === 'masters' ? (resetMasterForm(), setShowMasterModal(true)) : (resetAssignForm(), setShowAssignModal(true))}
                    style={{
                        padding: '12px 24px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '15px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.35)',
                        whiteSpace: 'nowrap'
                    }}
                >
                    <Plus size={20} strokeWidth={2.5} />
                    {activeTab === 'masters' ? t('deductions.form.buttons.addNew') : t('deductions.form.buttons.assignNew')}
                </button>
                )}
            </div>

            {/* Data Table */}
            <div style={{
                background: 'white',
                borderRadius: '20px',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
                {loading ? (
                    <div style={{ padding: '60px' }}><Loader /></div>
                ) : activeTab === 'history' ? (
                    /* History Tab */                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                                <th style={{ padding: '18px 24px', textAlign: 'left', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px', width: '30px' }}></th>
                                <th style={{ padding: '18px 24px', textAlign: 'left', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px' }}>{t('deductions.table.historyHeaders.paymentDate')}</th>
                                <th style={{ padding: '18px 24px', textAlign: 'left', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px' }}>{t('deductions.table.historyHeaders.billPeriod')}</th>
                                <th style={{ padding: '18px 24px', textAlign: 'left', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px' }}>{t('deductions.table.historyHeaders.farmer')}</th>
                                <th style={{ padding: '18px 24px', textAlign: 'center', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px' }}>{t('deductions.table.headers.status', {defaultValue: 'Status'})}</th>
                                <th style={{ padding: '18px 24px', textAlign: 'right', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px' }}>{t('deductions.table.historyHeaders.amount')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredHistory.map((h, index) => {
                                const parseDeductions = (ds) => {
                                    if (!ds) return [];
                                    if (typeof ds === 'string') {
                                        try { return JSON.parse(ds); } catch { return []; }
                                    }
                                    return Array.isArray(ds) ? ds : Object.values(ds);
                                };
                                const safeDeductions = parseDeductions(h.deductions);
                                const isExpanded = expandedHistory.includes(h.id);
                                const totalDeducted = safeDeductions.reduce((sum, d) => sum + parseFloat(d.amount || d.deducted || 0), 0);
                                return (
                                    <React.Fragment key={h.id}>
                                        <tr
                                            onClick={() => toggleHistoryExpand(h.id)}
                                            style={{
                                                borderBottom: isExpanded ? 'none' : '1px solid #f1f5f9',
                                                background: index % 2 === 0 ? 'white' : '#fcfcfd',
                                                cursor: 'pointer',
                                                transition: 'background 0.2s'
                                            }}
                                        >
                                            <td style={{ padding: '16px 12px 16px 24px' }}>
                                                <div style={{
                                                    width: '28px', height: '28px', borderRadius: '8px', background: isExpanded ? '#e0e7ff' : '#f1f5f9',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: isExpanded ? '#4338ca' : '#64748b'
                                                }}>
                                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                </div>
                                            </td>
                                            <td style={{ padding: '20px 24px' }}>
                                                <div style={{ fontWeight: '700', color: h.status === 'active' ? '#4338ca' : '#1e293b', fontSize: '14px' }}>{h.paymentDate}</div>
                                                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{h.paymentDate === 'Active Mapping' ? 'Assignment' : 'Payment'}</div>
                                            </td>
                                            <td style={{ padding: '20px 24px', fontSize: '14px', color: '#444' }}>
                                                {h.startDate ? `${new Date(h.startDate).toLocaleDateString('en-GB')} - ${h.endDate ? new Date(h.endDate).toLocaleDateString('en-GB') : '...'}` : '-'}
                                            </td>
                                            <td 
                                                style={{ padding: '20px 24px', cursor: 'pointer' }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const f = farmers.find(f => String(f.id) === String(h.farmerId));
                                                    if (f) setSelectedStatementFarmer(f);
                                                }}
                                                title="View Farmer Statement"
                                            >
                                                <div style={{ fontWeight: '700', color: '#2563eb', fontSize: '15px', textDecoration: 'underline' }}>{h.farmerName}</div>
                                                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>#{h.farmerCode}</div>
                                            </td>
                                            <td style={{ padding: '20px 24px', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                                <span style={{
                                                    padding: '4px 10px',
                                                    background: h.status === 'active' ? '#eff6ff' : '#ecfdf5',
                                                    color: h.status === 'active' ? '#2563eb' : '#059669',
                                                    borderRadius: '8px',
                                                    fontSize: '11px',
                                                    fontWeight: '800',
                                                    textTransform: 'uppercase',
                                                    border: h.status === 'active' ? '1px solid #dbeafe' : '1px solid #d1fae5'
                                                }}>
                                                    {h.status}
                                                </span>
                                                <span style={{ fontSize: '11px', color: '#6366f1', fontWeight: '700', background: '#e0e7ff', padding: '1px 6px', borderRadius: '4px' }}>
                                                    {safeDeductions.length} {t('deductions.title', {defaultValue: 'Deductions'})}
                                                </span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                                                <div style={{ fontSize: '16px', fontWeight: '800', color: h.status === 'active' ? '#64748b' : '#1e293b' }}>
                                                    {h.status === 'active' ? 'PENDING' : `₹${parseFloat(h.billAmount).toLocaleString('en-IN')}`}
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#059669', fontWeight: '700', marginTop: '2px' }}>
                                                    - ₹{totalDeducted.toFixed(2)}
                                                </div>
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr>
                                                <td colSpan="6" style={{ padding: '0 24px 24px 72px', background: index % 2 === 0 ? 'white' : '#fcfcfd' }}>
                                                    <div style={{
                                                        background: '#f8fafc',
                                                        borderRadius: '16px',
                                                        padding: '20px',
                                                        border: '1px solid #e2e8f0',
                                                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                                                    }}>
                                                        <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                            {t('deductions.table.historyHeaders.deductionDetails')}
                                                        </h4>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                                                            {safeDeductions.map((d, i) => {
                                                                const assignment = assignments.find(a => String(a.id) === String(d.id));
                                                                const dedName = d.name || assignment?.deduction_name || `Deduction`;
                                                                return (
                                                                    <div key={i} style={{
                                                                        background: 'white',
                                                                        padding: '12px 18px',
                                                                        borderRadius: '12px',
                                                                        border: '1px solid #e2e8f0',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '12px',
                                                                        minWidth: '200px'
                                                                    }}>
                                                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1' }}></div>
                                                                        <div style={{ flex: 1 }}>
                                                                            <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>{dedName}</div>
                                                                            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'capitalize' }}>{d.type || 'Fixed'}</div>
                                                                        </div>
                                                                        <div style={{ textAlign: 'right' }}>
                                                                            <div style={{ fontSize: '14px', fontWeight: '800', color: '#ef4444' }}>-₹{parseFloat(d.amount || d.deducted || 0).toFixed(2)}</div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                            {filteredHistory.length === 0 && (
                                <tr>
                                    <td colSpan="5" style={{ padding: '60px', textAlign: 'center', color: '#9ca3af', fontSize: '15px' }}>
                                        {t('deductions.table.noHistory')}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                ) : activeTab === 'masters' ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                                <th style={{ padding: '18px 24px', textAlign: 'left', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px' }}>{t('deductions.table.headers.name')}</th>
                                <th style={{ padding: '18px 24px', textAlign: 'left', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px' }}>{t('deductions.table.headers.type')}</th>
                                <th style={{ padding: '18px 24px', textAlign: 'left', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px' }}>{t('deductions.table.headers.defaultAmount')}</th>
                                <th style={{ padding: '18px 24px', textAlign: 'center', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px' }}>{t('deductions.table.headers.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredMasters.map((deduction, index) => (
                                <tr key={deduction.id} style={{
                                    borderBottom: '1px solid #f1f5f9',
                                    background: index % 2 === 0 ? 'white' : '#fcfcfd',
                                    transition: 'background 0.2s',
                                    cursor: 'default'
                                }}>
                                    <td style={{ padding: '20px 24px', fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>{deduction.name}</td>
                                    <td style={{ padding: '20px 24px' }}>
                                        <span style={{
                                            padding: '6px 14px',
                                            background: deduction.type === 'fixed' ? '#e0f2fe' : deduction.type === 'percentage' ? '#f5f3ff' : '#f1f5f9',
                                            color: deduction.type === 'fixed' ? '#0369a1' : deduction.type === 'percentage' ? '#6d28d9' : '#475569',
                                            borderRadius: '12px',
                                            fontSize: '13px',
                                            fontWeight: '700',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px'
                                        }}>
                                            {['fixed', 'manual', 'percentage', 'per_liter', 'mpc'].includes(deduction.type)
                                                ? t(`deductions.form.types.${deduction.type}`)
                                                : (deduction.type || 'Fixed').charAt(0).toUpperCase() + (deduction.type || 'fixed').slice(1)}
                                        </span>
                                    </td>
                                    <td style={{ padding: '20px 24px', fontSize: '15px', fontWeight: '800', color: '#1e293b' }}>
                                        {deduction.type === 'fixed' || deduction.type === 'per_liter' || deduction.type === 'mpc' ? `₹${parseFloat(deduction.default_amount || 0).toFixed(2)}` :
                                            deduction.type === 'percentage' ? `${parseFloat(deduction.default_amount || 0).toFixed(2)}%` : '-'}
                                    </td>
                                    <td style={{ padding: '20px 24px' }}>
                                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                                            <button
                                                onClick={() => openMasterEdit(deduction)}
                                                style={{
                                                    width: '36px', height: '36px',
                                                    background: '#f1f5f9',
                                                    border: '1px solid #e2e8f0',
                                                    borderRadius: '10px',
                                                    cursor: 'pointer',
                                                    color: '#475569',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    transition: 'all 0.2s'
                                                }}
                                                title="Edit"
                                            >
                                                <Edit size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleMasterDelete(deduction.id)}
                                                style={{
                                                    width: '36px', height: '36px',
                                                    background: '#fef2f2',
                                                    border: '1px solid #fee2e2',
                                                    borderRadius: '10px',
                                                    cursor: 'pointer',
                                                    color: '#dc2626',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    transition: 'all 0.2s'
                                                }}
                                                title="Delete"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredMasters.length === 0 && (
                                <tr>
                                    <td colSpan="4" style={{ padding: '60px', textAlign: 'center', color: '#9ca3af', fontSize: '15px' }}>
                                        {t('deductions.table.noMasters')}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                                <th style={{ padding: '18px 24px', textAlign: 'left', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px' }}>{t('deductions.table.headers.date')}</th>
                                <th style={{ padding: '18px 24px', textAlign: 'left', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px' }}>{t('deductions.table.headers.farmer')}</th>
                                <th style={{ padding: '18px 24px', textAlign: 'left', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px' }}>{t('deductions.table.headers.deduction')}</th>
                                <th style={{ padding: '18px 24px', textAlign: 'right', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px' }}>{t('deductions.table.headers.amountBill')}</th>
                                <th style={{ padding: '18px 24px', textAlign: 'right', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px' }}>{t('deductions.table.headers.target')}</th>
                                <th style={{ padding: '18px 24px', textAlign: 'right', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px' }}>{t('deductions.table.headers.collected')}</th>
                                <th style={{ padding: '18px 24px', textAlign: 'center', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px' }}>{t('deductions.table.headers.status')}</th>
                                <th style={{ padding: '18px 24px', textAlign: 'center', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px' }}>{t('deductions.table.headers.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAssignments.map((assign, index) => (
                                <tr key={assign.id} style={{
                                    borderBottom: '1px solid #f1f5f9',
                                    background: index % 2 === 0 ? 'white' : '#fcfcfd',
                                    transition: 'background 0.2s',
                                    cursor: 'default'
                                }}>
                                    <td style={{ padding: '20px 24px', fontSize: '14px', color: '#64748b', fontWeight: '500' }}>{new Date(assign.start_date).toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'})}</td>
                                    <td 
                                        style={{ padding: '20px 24px', cursor: 'pointer' }}
                                        onClick={() => {
                                            const f = farmers.find(f => String(f.id) === String(assign.farmer_id));
                                            if (f) setSelectedStatementFarmer(f);
                                        }}
                                        title="View Farmer Statement"
                                    >
                                        <div style={{ fontWeight: '700', color: '#2563eb', fontSize: '15px', textDecoration: 'underline' }}>{assign.farmer_name}</div>
                                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', background: '#e0e7ff', width: 'fit-content', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>#{assign.farmer_code}</div>
                                    </td>
                                    <td style={{ padding: '20px 24px' }}>
                                        <div style={{ fontWeight: '700', color: '#4338ca', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4338ca' }}></div>
                                            {assign.deduction_name}
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', textTransform: 'capitalize' }}>{assign.deduction_type} Basis</div>
                                    </td>
                                    <td style={{ padding: '20px 24px', fontSize: '16px', fontWeight: '800', color: '#1e293b', textAlign: 'right' }}>
                                        {assign.deduction_type === 'percentage' ? `${parseFloat(assign.amount || 0).toFixed(2)}%` : `₹${parseFloat(assign.amount || 0).toFixed(2)}`}
                                    </td>
                                    <td style={{ padding: '20px 24px', fontSize: '15px', fontWeight: '600', color: '#64748b', textAlign: 'right' }}>
                                        {assign.total_amount ? `₹${parseFloat(assign.total_amount).toLocaleString('en-IN')}` : <span style={{fontSize: '20px'}}>∞</span>}
                                    </td>
                                    <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                                        <div style={{ fontSize: '16px', fontWeight: '800', color: '#059669' }}>₹{parseFloat(assign.collected_amount || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</div>
                                        {assign.total_amount && (
                                            <div style={{ width: '100px', height: '4px', background: '#e2e8f0', borderRadius: '2px', marginTop: '6px', marginLeft: 'auto', overflow: 'hidden' }}>
                                                <div style={{ 
                                                    width: `${Math.min(100, (parseFloat(assign.collected_amount || 0) / parseFloat(assign.total_amount)) * 100)}%`, 
                                                    height: '100%', 
                                                    background: '#10b981' 
                                                }}></div>
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ padding: '20px 24px', textAlign: 'center' }}>
                                        <span style={{
                                            padding: '6px 14px',
                                            background: assign.status === 'active' ? '#dcfce7' : '#f1f5f9',
                                            color: assign.status === 'active' ? '#15803d' : '#64748b',
                                            borderRadius: '12px',
                                            fontSize: '13px',
                                            fontWeight: '700',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            border: assign.status === 'active' ? '1px solid #bbf7d0' : '1px solid #e2e8f0'
                                        }}>
                                            {assign.status === 'active' && <div style={{width: '6px', height: '6px', borderRadius: '50%', background: '#10b981'}}></div>}
                                            {assign.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td style={{ padding: '20px 24px', textAlign: 'center' }}>
                                        <button
                                            onClick={() => handleAssignDelete(assign.id)}
                                            style={{
                                                width: '36px', height: '36px',
                                                background: '#fef2f2',
                                                border: '1px solid #fee2e2',
                                                borderRadius: '10px',
                                                cursor: 'pointer',
                                                color: '#dc2626',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transition: 'all 0.2s',
                                                boxShadow: '0 2px 4px rgba(220, 38, 38, 0.05)'
                                            }}
                                            onMouseEnter={(e) => { e.currentTarget.style.background = '#fee2e2'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
                                            title="Stop Deduction"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredAssignments.length === 0 && (
                                <tr>
                                    <td colSpan="8" style={{ padding: '60px', textAlign: 'center', color: '#9ca3af', fontSize: '15px' }}>
                                        {t('deductions.table.noAssignments')}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Master Modal */}
            {showMasterModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    backdropFilter: 'blur(4px)'
                }}>
                    <div style={{
                        background: 'white',
                        borderRadius: '20px',
                        width: '90%',
                        maxWidth: '500px',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            padding: '24px 28px',
                            borderBottom: '1px solid #f3f4f6',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#111827' }}>
                                {isEditing ? t('deductions.form.editTitle') : t('deductions.form.addTitle')}
                            </h2>
                            <button
                                onClick={() => setShowMasterModal(false)}
                                style={{
                                    background: '#f3f4f6',
                                    border: 'none',
                                    borderRadius: '10px',
                                    padding: '8px',
                                    cursor: 'pointer',
                                    color: '#6b7280',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleMasterSubmit}>
                            <div style={{ padding: '28px' }}>
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                                        {t('deductions.form.name')}
                                    </label>
                                    <input
                                        type="text"
                                        value={masterForm.name}
                                        onChange={e => setMasterForm({ ...masterForm, name: e.target.value })}
                                        required
                                        placeholder={t('deductions.form.placeholders.name')}
                                        style={{
                                            width: '100%',
                                            padding: '12px 16px',
                                            borderRadius: '12px',
                                            border: '2px solid #e5e7eb',
                                            fontSize: '15px',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                                        {t('deductions.form.type')}
                                    </label>
                                    <select
                                        value={masterForm.type}
                                        onChange={e => setMasterForm({ ...masterForm, type: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '12px 16px',
                                            borderRadius: '12px',
                                            border: '2px solid #e5e7eb',
                                            fontSize: '15px',
                                            outline: 'none'
                                        }}
                                    >
                                        <option value="manual">{t('deductions.form.types.manual')}</option>
                                        <option value="fixed">{t('deductions.form.types.fixed')}</option>
                                        <option value="percentage">{t('deductions.form.types.percentage')}</option>
                                        <option value="per_liter">{t('deductions.form.types.per_liter') || 'Per Liter'}</option>
                                        <option value="mpc">{t('deductions.form.types.mpc') || 'MPC'}</option>
                                    </select>
                                </div>
                                {masterForm.type !== 'manual' && (
                                    <div style={{ marginBottom: '20px' }}>
                                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                                            {masterForm.type === 'percentage' ? t('deductions.form.types.percentage') : t('deductions.form.amount')}
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={masterForm.default_amount}
                                            onChange={e => setMasterForm({ ...masterForm, default_amount: e.target.value })}
                                            required
                                            style={{
                                                width: '100%',
                                                padding: '12px 16px',
                                                borderRadius: '12px',
                                                border: '2px solid #e5e7eb',
                                                fontSize: '15px',
                                                outline: 'none'
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                            <div style={{
                                padding: '20px 28px',
                                borderTop: '1px solid #f3f4f6',
                                display: 'flex',
                                justifyContent: 'flex-end',
                                gap: '12px'
                            }}>
                                <button
                                    type="button"
                                    onClick={() => setShowMasterModal(false)}
                                    style={{
                                        padding: '10px 20px',
                                        background: '#f3f4f6',
                                        color: '#374151',
                                        border: 'none',
                                        borderRadius: '10px',
                                        fontSize: '15px',
                                        fontWeight: '600',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {t('deductions.form.buttons.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    style={{
                                        padding: '10px 20px',
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '10px',
                                        fontSize: '15px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
                                    }}
                                >
                                    {isEditing ? t('deductions.form.buttons.update') : t('deductions.form.buttons.save')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Assignment Modal */}
            {showAssignModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    backdropFilter: 'blur(4px)'
                }}>
                    <div style={{
                        background: 'white',
                        borderRadius: '20px',
                        width: '90%',
                        maxWidth: '600px',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            padding: '24px 28px',
                            borderBottom: '1px solid #f3f4f6',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#111827' }}>
                                {t('deductions.form.assignTitle')}
                            </h2>
                            <button
                                onClick={() => setShowAssignModal(false)}
                                style={{
                                    background: '#f3f4f6',
                                    border: 'none',
                                    borderRadius: '10px',
                                    padding: '8px',
                                    cursor: 'pointer',
                                    color: '#6b7280',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleAssignSubmit}>
                            <div style={{ padding: '28px' }}>
                                {/* Multi-step Form Layout: Farmer Selection */}
                                <div style={{ marginBottom: '24px' }}>
                                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
                                        {t('deductions.form.selectFarmer')}
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'relative' }}>
                                            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
                                            <input
                                                type="text"
                                                autoComplete="off"
                                                placeholder={t('deductions.form.placeholders.searchFarmers')}
                                                value={farmerSearch}
                                                onFocus={() => setShowFarmerDropdown(true)}
                                                onChange={(e) => {
                                                    setFarmerSearch(e.target.value);
                                                    setShowFarmerDropdown(true);
                                                }}
                                                style={{
                                                    width: '100%',
                                                    padding: '14px 16px 14px 44px',
                                                    borderRadius: '12px',
                                                    border: '2px solid #e2e8f0',
                                                    fontSize: '15px',
                                                    outline: 'none',
                                                    background: '#f8fafc',
                                                    transition: 'all 0.2s',
                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.02) inset'
                                                }}
                                            />
                                        </div>

                                        {showFarmerDropdown && (
                                            <div style={{
                                                position: 'absolute',
                                                top: '100%',
                                                left: 0,
                                                right: 0,
                                                background: 'white',
                                                borderRadius: '12px',
                                                border: '1px solid #e2e8f0',
                                                marginTop: '8px',
                                                maxHeight: '260px',
                                                overflowY: 'auto',
                                                zIndex: 1100,
                                                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                                                padding: '6px'
                                            }}>
                                                {(farmers || [])
                                                    .filter(f => farmerMatchesSearch(f, farmerSearch))
                                                    .map(f => (
                                                        <div
                                                            key={f.id}
                                                            onClick={() => {
                                                                setAssignForm({ ...assignForm, farmer_id: f.id });
                                                                setFarmerSearch(`${f.code} - ${f.name}`);
                                                                setShowFarmerDropdown(false);
                                                            }}
                                                            style={{
                                                                padding: '12px 14px',
                                                                cursor: 'pointer',
                                                                borderRadius: '8px',
                                                                background: assignForm.farmer_id == f.id ? '#eff6ff' : 'transparent',
                                                                transition: 'all 0.15s',
                                                                borderBottom: '1px solid #f1f5f9'
                                                            }}
                                                            onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                                                            onMouseLeave={(e) => e.currentTarget.style.background = assignForm.farmer_id == f.id ? '#eff6ff' : 'transparent'}
                                                        >
                                                            <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '14px' }}>{f.code} - {f.name}</div>
                                                            <div style={{ fontSize: '12px', color: '#64748b' }}>{f.mobile || 'No Mobile'}</div>
                                                        </div>
                                                    ))}
                                                {(farmers || []).filter(f => farmerMatchesSearch(f, farmerSearch)).length === 0 && (
                                                    <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>No farmers found</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {showFarmerDropdown && (
                                        <div
                                            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1050 }}
                                            onClick={() => setShowFarmerDropdown(false)}
                                        />
                                    )}
                                </div>

                                <div style={{ marginBottom: '24px' }}>
                                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
                                        {t('deductions.form.selectDeduction')}
                                    </label>
                                    <select
                                        value={assignForm.deduction_master_id}
                                        onChange={handleDeductionChange}
                                        required
                                        style={{
                                            width: '100%',
                                            padding: '14px 16px',
                                            borderRadius: '12px',
                                            border: '2px solid #e2e8f0',
                                            fontSize: '15px',
                                            outline: 'none',
                                            background: '#f8fafc',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <option value="">-- {t('deductions.form.selectDeduction')} --</option>
                                        {deductions.map(d => (
                                            <option key={d.id} value={d.id}>{d.name} ({t(`deductions.form.types.${d.type}`)})</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Summary Card (Contextual helper) */}
                                {(assignForm.farmer_id || assignForm.deduction_master_id) && (
                                    <div style={{
                                        background: 'linear-gradient(to right, #f8fafc, #f1f5f9)',
                                        borderRadius: '12px',
                                        padding: '16px',
                                        marginBottom: '24px',
                                        border: '1px dashed #cbd5e1',
                                        display: 'flex',
                                        gap: '12px',
                                        alignItems: 'center'
                                    }}>
                                        <div style={{ background: '#e2e8f0', padding: '10px', borderRadius: '10px' }}>
                                            <Wallet size={20} color="#64748b" />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                                                {assignForm.farmer_id ? (farmers.find(f => f.id == assignForm.farmer_id)?.name || "Selected Farmer") : "Select a farmer"}
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#64748b' }}>
                                                {assignForm.deduction_master_id ?
                                                    `${deductions.find(d => d.id == assignForm.deduction_master_id)?.name} - ${assignForm.amount}${deductions.find(d => d.id == assignForm.deduction_master_id)?.type === 'percentage' ? '%' : ' ₹'}`
                                                    : "Select a deduction template"}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
                                            {t('deductions.form.amount')}
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={assignForm.amount}
                                            onChange={e => setAssignForm({ ...assignForm, amount: e.target.value })}
                                            required
                                            style={{
                                                width: '100%',
                                                padding: '14px 16px',
                                                borderRadius: '12px',
                                                border: '2px solid #e2e8f0',
                                                fontSize: '15px',
                                                outline: 'none',
                                                background: '#f8fafc'
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
                                            {t('deductions.form.startDate')}
                                        </label>
                                        <input
                                            type="date"
                                            value={assignForm.start_date}
                                            onChange={e => setAssignForm({ ...assignForm, start_date: e.target.value })}
                                            required
                                            style={{
                                                width: '100%',
                                                padding: '14px 16px',
                                                borderRadius: '12px',
                                                border: '2px solid #e2e8f0',
                                                fontSize: '15px',
                                                outline: 'none',
                                                background: '#f8fafc'
                                            }}
                                        />
                                    </div>
                                </div>

                                <div style={{ marginBottom: '8px' }}>
                                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
                                        {t('deductions.form.totalTarget')} <span style={{ fontWeight: '400', color: '#64748b', fontSize: '12px' }}>(Optional)</span>
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', fontWeight: '600', color: '#64748b' }}>₹</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={assignForm.total_amount}
                                            onChange={e => setAssignForm({ ...assignForm, total_amount: e.target.value })}
                                            placeholder="Enter total target amount"
                                            style={{
                                                width: '100%',
                                                padding: '14px 16px 14px 34px',
                                                borderRadius: '12px',
                                                border: '2px solid #e2e8f0',
                                                fontSize: '15px',
                                                outline: 'none',
                                                background: '#f8fafc'
                                            }}
                                        />
                                    </div>
                                    <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                                        * The deduction will automatically stop once this total amount is collected.
                                    </p>
                                </div>
                            </div>
                            <div style={{
                                padding: '20px 28px',
                                borderTop: '1px solid #f3f4f6',
                                display: 'flex',
                                justifyContent: 'flex-end',
                                gap: '12px'
                            }}>
                                <button
                                    type="button"
                                    onClick={() => setShowAssignModal(false)}
                                    style={{
                                        padding: '10px 20px',
                                        background: '#f3f4f6',
                                        color: '#374151',
                                        border: 'none',
                                        borderRadius: '10px',
                                        fontSize: '15px',
                                        fontWeight: '600',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {t('deductions.form.buttons.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    style={{
                                        padding: '10px 20px',
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '10px',
                                        fontSize: '15px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
                                    }}
                                >
                                    {t('deductions.form.buttons.assign')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            {/* Farmer Statement Modal */}
            <FarmerDeductionStatement 
                show={selectedStatementFarmer !== null} 
                farmer={selectedStatementFarmer} 
                onClose={() => setSelectedStatementFarmer(null)} 
                user={user} 
            />

            <AlertComponent />
        </div>
    );
}

export default Deductions;
