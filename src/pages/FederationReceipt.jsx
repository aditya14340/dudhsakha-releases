import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Save, Edit, Trash2, X, Building2, Lock, Unlock } from 'lucide-react';
import Loader from '../components/Loader';
import { useAlert } from '../hooks/useAlert';
import {
    getFederationReceipts,
    addFederationReceipt,
    updateFederationReceipt,
    deleteFederationReceipt
} from '../lib/api';

function FederationReceipt({ user }) {
    const { t } = useTranslation();
    const { showAlert, showConfirm, AlertComponent } = useAlert();
    const [receipts, setReceipts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState({
        receipt_date: new Date().toISOString().split('T')[0],
        shift: 'Morning',
        milk_type: 'Buffalo',
        quantity: '',
        fat: '',
        snf: '',
        rate: '',
        amount: ''
    });
    const [rateFetched, setRateFetched] = useState(false);   // true = rate auto-fetched from federation_dar chart
    const [rateLocked, setRateLocked] = useState(false);     // true = user locked it for manual edit
    const [rateFetchStatus, setRateFetchStatus] = useState(null); // 'found' | 'not_found' | null

    // ── Auto-fetch rate from federation_dar chart ──────────────────────────
    useEffect(() => {
        const fetchFederationRate = async () => {
            const fat = parseFloat(formData.fat);
            const snf = parseFloat(formData.snf);
            if (!fat || !snf || !formData.milk_type || !user?.dairy_id || rateLocked) return;

            try {
                const { supabase } = await import('../lib/supabase');
                const receiptDate = formData.receipt_date || new Date().toISOString().split('T')[0];
                const fatR = Math.round(fat * 10) / 10;
                const snfR = Math.round(snf * 10) / 10;

                const { data } = await supabase
                    .from('rates')
                    .select('rate, effective_date')
                    .eq('dairy_id', user.dairy_id)
                    .eq('milk_type', formData.milk_type)
                    .eq('fat', fatR)
                    .eq('snf', snfR)
                    .eq('rate_type', 'federation_dar')
                    .lte('effective_date', receiptDate)
                    .order('effective_date', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (data?.rate != null) {
                    const qty = parseFloat(formData.quantity);
                    const fetchedRate = data.rate;
                    setFormData(prev => ({
                        ...prev,
                        rate: fetchedRate.toString(),
                        amount: !isNaN(qty) && qty > 0 ? (qty * fetchedRate).toFixed(2) : prev.amount
                    }));
                    setRateFetched(true);
                    setRateFetchStatus('found');
                } else {
                    setRateFetched(false);
                    setRateFetchStatus('not_found');
                }
            } catch (err) {
                console.error('Error fetching federation rate:', err);
                setRateFetchStatus(null);
            }
        };
        fetchFederationRate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData.fat, formData.snf, formData.milk_type, formData.receipt_date]);

    useEffect(() => {
        if (user?.dairy_id) {
            loadReceipts();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.dairy_id]);

    const loadReceipts = async () => {
        setLoading(true);
        try {
            const data = await getFederationReceipts(user?.dairy_id);
            setReceipts(data || []);
        } catch (error) {
            console.error("Error loading receipts:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleEdit = (receipt) => {
        setFormData({
            receipt_date: receipt.receipt_date,
            shift: receipt.shift,
            milk_type: receipt.milk_type,
            quantity: receipt.quantity.toString(),
            fat: receipt.fat.toString(),
            snf: receipt.snf.toString(),
            rate: receipt.rate ? receipt.rate.toString() : '',
            amount: receipt.amount.toString()
        });
        setEditId(receipt.id);
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setEditId(null);
        setFormData({
            receipt_date: new Date().toISOString().split('T')[0],
            shift: 'Morning',
            milk_type: 'Buffalo',
            quantity: '',
            fat: '',
            snf: '',
            rate: '',
            amount: ''
        });
    };

    const handleDelete = async (id) => {
        const confirmed = await showConfirm(
            t('federation.form.alerts.deleteConfirm'),
            t('federation.title'),
            t('common.delete', { defaultValue: 'Delete' }),
            t('common.cancel', { defaultValue: 'Cancel' })
        );
        if (confirmed) {
            try {
                await deleteFederationReceipt(id, user?.dairy_id);
                loadReceipts();
            } catch (error) {
                console.error("Error deleting receipt:", error);
                showAlert(t('federation.form.alerts.deleteError'), 'Error', 'error');
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.quantity || !formData.fat || !formData.snf || !formData.amount) {
            showAlert(t('federation.form.alerts.fillAll'), 'Validation Error', 'warning');
            return;
        }

        if (!user?.dairy_id) {
            showAlert('System Error: User session invalid', 'Error', 'error');
            return;
        }

        try {
            const data = {
                receipt_date: formData.receipt_date,
                shift: formData.shift,
                milk_type: formData.milk_type,
                quantity: parseFloat(formData.quantity),
                fat: parseFloat(formData.fat),
                snf: parseFloat(formData.snf),
                rate: parseFloat(formData.rate) || 0,
                amount: parseFloat(formData.amount),
                dairy_id: user.dairy_id
            };

            if (isEditing) {
                await updateFederationReceipt({ ...data, id: editId, dairy_id: user?.dairy_id }, user?.dairy_id);
                setIsEditing(false);
                setEditId(null);
            } else {
                await addFederationReceipt(data);
            }

            setFormData(prev => ({
                ...prev,
                quantity: '',
                fat: '',
                snf: '',
                rate: '',
                amount: ''
            }));
            loadReceipts();
        } catch (error) {
            console.error("Error saving receipt:", error);
            showAlert(t('federation.form.alerts.saveError') + " " + error.message, 'Error', 'error');
        }
    };

    const totalQty = receipts.reduce((sum, r) => sum + (r.quantity || 0), 0);
    const totalAmount = receipts.reduce((sum, r) => sum + (r.amount || 0), 0);

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
                        <Building2 size={28} />
                        {t('federation.title')}
                    </h1>
                    <p style={{ fontSize: '15px', color: '#6b7280', margin: 0 }}>
                        {t('federation.subtitle')}
                    </p>
                </div>
                {isEditing && (
                    <button
                        type="button"
                        onClick={handleCancelEdit}
                        style={{
                            padding: '10px 20px',
                            background: '#f3f4f6',
                            color: '#374151',
                            border: 'none',
                            borderRadius: '10px',
                            fontSize: '15px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <X size={18} />
                        {t('federation.form.buttons.cancel')}
                    </button>
                )}
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                <div style={{
                    background: 'white',
                    borderRadius: '16px',
                    padding: '24px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            background: '#dbeafe',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#1e40af'
                        }}>
                            <FileText size={24} />
                        </div>
                    </div>
                    <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 4px 0' }}>{t('federation.totalReceipts')}</p>
                    <p style={{ fontSize: '28px', fontWeight: '700', color: '#111827', margin: 0 }}>{receipts.length}</p>
                </div>

                <div style={{
                    background: 'white',
                    borderRadius: '16px',
                    padding: '24px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            background: '#fce7f3',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#be185d'
                        }}>
                            <Building2 size={24} />
                        </div>
                    </div>
                    <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 4px 0' }}>{t('federation.totalQuantity')}</p>
                    <p style={{ fontSize: '28px', fontWeight: '700', color: '#111827', margin: 0 }}>{totalQty.toFixed(1)} L</p>
                </div>

                <div style={{
                    background: 'white',
                    borderRadius: '16px',
                    padding: '24px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            background: '#d1fae5',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#059669'
                        }}>
                            ₹
                        </div>
                    </div>
                    <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 4px 0' }}>{t('federation.totalAmount')}</p>
                    <p style={{ fontSize: '28px', fontWeight: '700', color: '#059669', margin: 0 }}>₹{totalAmount.toFixed(2)}</p>
                </div>
            </div>

            {/* Main Content */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '24px' }}>
                {/* Form */}
                <div style={{
                    background: 'white',
                    borderRadius: '20px',
                    padding: '28px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    height: 'fit-content'
                }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '24px', color: '#111827' }}>
                        {isEditing ? t('federation.form.editTitle') : t('federation.form.addTitle')}
                    </h3>
                    <form onSubmit={handleSubmit}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                            {/* Date */}
                            <div>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                                    {t('federation.form.date')}
                                </label>
                                <input
                                    type="date"
                                    name="receipt_date"
                                    value={formData.receipt_date}
                                    onChange={handleInputChange}
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

                            {/* Shift */}
                            <div>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                                    {t('federation.form.shift')}
                                </label>
                                <select
                                    name="shift"
                                    value={formData.shift}
                                    onChange={handleInputChange}
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        borderRadius: '12px',
                                        border: '2px solid #e5e7eb',
                                        fontSize: '15px',
                                        outline: 'none',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <option value="Morning">Morning</option>
                                    <option value="Evening">Evening</option>
                                </select>
                            </div>
                        </div>

                        {/* Milk Type */}
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                                {t('federation.form.milkType')}
                            </label>
                            <select
                                name="milk_type"
                                value={formData.milk_type}
                                onChange={handleInputChange}
                                style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    borderRadius: '12px',
                                    border: '2px solid #e5e7eb',
                                    fontSize: '15px',
                                    outline: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="Buffalo">🐃 Buffalo</option>
                                <option value="Cow">🐄 Cow</option>
                            </select>
                        </div>

                        {/* Quantity */}
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                                {t('federation.form.quantity')}
                            </label>
                            <input
                                type="text"
                                inputMode="decimal"
                                name="quantity"
                                value={formData.quantity}
                                onChange={handleInputChange}
                                placeholder="0.0"
                                required
                                style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    borderRadius: '12px',
                                    border: '2px solid #e5e7eb',
                                    fontSize: '15px',
                                    fontWeight: '600',
                                    outline: 'none'
                                }}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                            {/* Fat */}
                            <div>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                                    {t('federation.form.fat')}
                                </label>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    name="fat"
                                    value={formData.fat}
                                    onChange={handleInputChange}
                                    placeholder="0.0"
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        borderRadius: '12px',
                                        border: '2px solid #e5e7eb',
                                        fontSize: '15px',
                                        fontWeight: '600',
                                        outline: 'none'
                                    }}
                                />
                            </div>

                            {/* SNF */}
                            <div>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                                    {t('federation.form.snf')}
                                </label>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    name="snf"
                                    value={formData.snf}
                                    onChange={handleInputChange}
                                    placeholder="0.0"
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        borderRadius: '12px',
                                        border: '2px solid #e5e7eb',
                                        fontSize: '15px',
                                        fontWeight: '600',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                            {/* Rate — auto-fetched from federation_dar rate chart */}
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <label style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                                        {t('federation.form.rate')}
                                    </label>
                                    {/* Fetch status badge */}
                                    {rateFetchStatus === 'found' && (
                                        <span style={{ fontSize: '11px', fontWeight: '600', background: '#d1fae5', color: '#065f46', padding: '2px 8px', borderRadius: '20px' }}>
                                            ✓ संघ दर मिळाला
                                        </span>
                                    )}
                                    {rateFetchStatus === 'not_found' && (
                                        <span style={{ fontSize: '11px', fontWeight: '600', background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '20px' }}>
                                            ⚠ दर सापडला नाही
                                        </span>
                                    )}
                                </div>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        name="rate"
                                        value={formData.rate}
                                        onChange={e => {
                                            setRateLocked(true);
                                            handleInputChange(e);
                                        }}
                                        readOnly={rateFetched && !rateLocked}
                                        placeholder={t('federation.form.placeholders.rate')}
                                        style={{
                                            width: '100%',
                                            padding: '12px 44px 12px 16px',
                                            borderRadius: '12px',
                                            border: rateFetched && !rateLocked ? '2px solid #10b981' : '2px solid #e5e7eb',
                                            fontSize: '15px',
                                            outline: 'none',
                                            background: rateFetched && !rateLocked ? '#f0fdf4' : 'white',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                    {/* Lock/Unlock toggle */}
                                    <button
                                        type="button"
                                        title={rateLocked ? 'Auto-fetch rate (unlock)' : 'Edit manually (lock)'}
                                        onClick={() => setRateLocked(prev => !prev)}
                                        style={{
                                            position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                                            border: 'none', background: 'transparent', cursor: 'pointer',
                                            color: rateLocked ? '#ef4444' : '#10b981', padding: '2px'
                                        }}>
                                        {rateLocked ? <Unlock size={16} /> : <Lock size={16} />}
                                    </button>
                                </div>
                            </div>

                            {/* Amount */}
                            <div>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                                    {t('federation.form.amount')}
                                </label>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    name="amount"
                                    value={formData.amount}
                                    onChange={handleInputChange}
                                    placeholder="0.00"
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        borderRadius: '12px',
                                        border: '2px solid #e5e7eb',
                                        fontSize: '15px',
                                        fontWeight: '700',
                                        color: '#059669',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                        </div>

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
                                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.35)'
                            }}
                        >
                            <Save size={20} />
                            {isEditing ? t('federation.form.buttons.update') : t('federation.form.buttons.save')}
                        </button>
                    </form>
                </div>

                {/* Table */}
                <div style={{
                    background: 'white',
                    borderRadius: '20px',
                    overflow: 'hidden',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                    <div style={{
                        padding: '20px 24px',
                        borderBottom: '1px solid #e5e7eb',
                        background: '#fafafa'
                    }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: '#111827' }}>
                            {t('federation.table.title')}
                        </h3>
                    </div>

                    {loading ? (
                        <div style={{ padding: '60px' }}><Loader /></div>
                    ) : receipts.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
                            <Building2 size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                            <p style={{ fontSize: '15px', fontWeight: '500', margin: '0 0 4px 0' }}>{t('federation.table.noReceipts')}</p>
                            <p style={{ fontSize: '13px', margin: 0 }}>{t('federation.table.noReceiptsSub')}</p>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#fafafa' }}>
                                        <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase' }}>{t('federation.table.headers.date')}</th>
                                        <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase' }}>{t('federation.table.headers.shift')}</th>
                                        <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase' }}>{t('federation.table.headers.type')}</th>
                                        <th style={{ padding: '14px 16px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase' }}>{t('federation.table.headers.qty')}</th>
                                        <th style={{ padding: '14px 16px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase' }}>{t('federation.table.headers.fat')}</th>
                                        <th style={{ padding: '14px 16px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase' }}>{t('federation.table.headers.snf')}</th>
                                        <th style={{ padding: '14px 16px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase' }}>{t('federation.table.headers.amount')}</th>
                                        <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase' }}>{t('federation.table.headers.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {receipts.map((receipt, index) => (
                                        <tr key={receipt.id} style={{ borderBottom: '1px solid #f3f4f6', background: index % 2 === 0 ? 'white' : '#fafafa' }}>
                                            <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                                                {new Date(receipt.receipt_date).toLocaleDateString('en-IN')}
                                            </td>
                                            <td style={{ padding: '14px 16px' }}>
                                                <span style={{
                                                    padding: '4px 10px',
                                                    background: receipt.shift === 'Morning' ? '#fef3c7' : '#dbeafe',
                                                    color: receipt.shift === 'Morning' ? '#92400e' : '#1e40af',
                                                    borderRadius: '8px',
                                                    fontSize: '13px',
                                                    fontWeight: '500'
                                                }}>{receipt.shift}</span>
                                            </td>
                                            <td style={{ padding: '14px 16px', fontSize: '14px', color: '#374151' }}>
                                                {receipt.milk_type === 'Buffalo' ? '🐃' : '🐄'} {receipt.milk_type}
                                            </td>
                                            <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: '600', color: '#111827', textAlign: 'right' }}>
                                                {receipt.quantity}
                                            </td>
                                            <td style={{ padding: '14px 16px', fontSize: '14px', color: '#374151', textAlign: 'right' }}>
                                                {receipt.fat}
                                            </td>
                                            <td style={{ padding: '14px 16px', fontSize: '14px', color: '#374151', textAlign: 'right' }}>
                                                {receipt.snf}
                                            </td>
                                            <td style={{ padding: '14px 16px', fontSize: '15px', fontWeight: '700', color: '#059669', textAlign: 'right' }}>
                                                ₹{receipt.amount}
                                            </td>
                                            <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                    <button
                                                        onClick={() => handleEdit(receipt)}
                                                        style={{
                                                            padding: '8px',
                                                            background: '#f3f4f6',
                                                            border: 'none',
                                                            borderRadius: '8px',
                                                            cursor: 'pointer',
                                                            color: '#374151'
                                                        }}
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(receipt.id)}
                                                        style={{
                                                            padding: '8px',
                                                            background: '#fee2e2',
                                                            border: 'none',
                                                            borderRadius: '8px',
                                                            cursor: 'pointer',
                                                            color: '#dc2626'
                                                        }}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
            <AlertComponent />
        </div>
    );
}

export default FederationReceipt;
