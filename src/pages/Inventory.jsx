import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Package, Plus, Search, Edit, Trash2, X, ShoppingCart,
    ArrowUpCircle, ArrowDownCircle, BarChart3,
    Users, AlertCircle, CheckCircle2, Loader2
} from 'lucide-react';
import Loader from '../components/Loader';
import { useAlert } from '../hooks/useAlert';

const PAY_CASH = 'cash';
const PAY_DEDUCTION = 'deduction';
const PAY_SPLIT = 'split';

function Inventory({ user }) {
    const { t } = useTranslation();
    const { showAlert, showConfirm, AlertComponent } = useAlert();

    // Remove outer padding so the page fills the screen without scrolling
    useEffect(() => {
        const el = document.querySelector('.main-content');
        if (el) {
            el._origPadding  = el.style.padding;
            el._origOverflow = el.style.overflowY;
            el.style.padding   = '0';
            el.style.overflowY = 'hidden';
        }
        return () => {
            if (el) {
                el.style.padding   = el._origPadding  || '';
                el.style.overflowY = el._origOverflow || '';
            }
        };
    }, []);

    const [activeTab, setActiveTab] = useState('items');
    const [loading,   setLoading]   = useState(false);
    const [saving,    setSaving]    = useState(false);

    const [items,            setItems]            = useState([]);
    const [transactions,     setTransactions]     = useState([]);
    const [farmers,          setFarmers]          = useState([]);
    const [deductionMasters, setDeductionMasters] = useState([]);
    const [searchTerm,       setSearchTerm]       = useState('');

    const [showItemModal, setShowItemModal] = useState(false);
    const [editingItem,   setEditingItem]   = useState(null);
    const [itemForm,      setItemForm]      = useState({ name: '', unit: 'kg', description: '' });

    const [stockInForm, setStockInForm] = useState({
        item_id: '', quantity: '', rate_per_unit: '',
        transaction_date: new Date().toISOString().split('T')[0], notes: ''
    });

    const [sellForm, setSellForm] = useState({
        item_id: '', farmer_id: '', quantity: '', rate_per_unit: '',
        transaction_date: new Date().toISOString().split('T')[0],
        payment_mode: PAY_CASH, deduction_master_id: '', cash_amount: '', notes: ''
    });
    const [farmerSearch,       setFarmerSearch]       = useState('');
    const [showFarmerDropdown, setShowFarmerDropdown] = useState(false);

    // ── Data loading (unchanged) ───────────────────────────────────────────────
    const loadData = useCallback(async () => {
        if (!user?.dairy_id) return;
        setLoading(true);
        try {
            const [itemsData, txData, farmersData, mastersData] = await Promise.all([
                window.api.getInventoryItems(user.dairy_id),
                window.api.getInventoryTransactions(user.dairy_id),
                window.api.getFarmers(user.dairy_id),
                window.api.getDeductionMasters(user.dairy_id)
            ]);
            setItems(itemsData || []);
            setTransactions(txData || []);
            setFarmers(farmersData || []);
            setDeductionMasters(mastersData || []);
        } catch (e) {
            showAlert(t('inventory.modal.saveError') + ' ' + e.message, 'Error', 'error');
        } finally {
            setLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.dairy_id]);

    useEffect(() => { loadData(); }, [loadData]);

    // ── Calculations (all unchanged) ──────────────────────────────────────────
    const getStockForItem = (itemId) =>
        transactions
            .filter(tx => String(tx.item_id) === String(itemId))
            .reduce((sum, tx) => {
                if (tx.type === 'stock_in') return sum + parseFloat(tx.quantity || 0);
                if (tx.type === 'sell')     return sum - parseFloat(tx.quantity || 0);
                return sum;
            }, 0);

    const openAddItem  = () => { setItemForm({ name: '', unit: 'kg', description: '' }); setEditingItem(null); setShowItemModal(true); };
    const openEditItem = (item) => { setItemForm({ name: item.name, unit: item.unit, description: item.description || '' }); setEditingItem(item); setShowItemModal(true); };

    const handleItemSave = async (e) => {
        e.preventDefault();
        if (!itemForm.name.trim()) return;
        setSaving(true);
        try {
            if (editingItem) {
                await window.api.updateInventoryItem({ ...editingItem, ...itemForm, dairy_id: user.dairy_id });
            } else {
                await window.api.addInventoryItem({ ...itemForm, dairy_id: user.dairy_id, current_stock: 0 });
                const alreadyExists = deductionMasters.some(
                    dm => dm.name.trim().toLowerCase() === itemForm.name.trim().toLowerCase()
                );
                if (!alreadyExists) {
                    try { await window.api.addDeductionMaster({ dairy_id: user.dairy_id, name: itemForm.name.trim(), type: 'fixed' }); } catch (_) {}
                }
            }
            setShowItemModal(false);
            loadData();
        } catch (e) {
            showAlert(t('inventory.modal.saveError') + ' ' + e.message, 'Error', 'error');
        } finally { setSaving(false); }
    };

    const handleItemDelete = async (item) => {
        const stock = getStockForItem(item.id);
        const msg = stock > 0
            ? t('inventory.modal.deleteConfirm', { stock: stock.toFixed(2), unit: item.unit, name: item.name })
            : t('inventory.modal.deleteConfirmNoStock', { name: item.name });
        const ok = await showConfirm(msg, t('inventory.modal.deleteItem'), t('inventory.modal.deleteItem'), t('inventory.modal.cancel'));
        if (!ok) return;
        try { await window.api.deleteInventoryItem(item.id, user.dairy_id); loadData(); }
        catch (e) { showAlert(t('inventory.modal.deleteError') + ' ' + e.message, 'Error', 'error'); }
    };

    const handleStockIn = async (e) => {
        e.preventDefault();
        const { item_id, quantity, rate_per_unit, transaction_date } = stockInForm;
        if (!item_id || !quantity || !rate_per_unit) {
            showAlert(t('inventory.stockIn.errors.fillRequired'), 'Validation', 'error'); return;
        }
        const qty  = parseFloat(quantity);
        const rate = parseFloat(rate_per_unit);
        setSaving(true);
        try {
            await window.api.addInventoryTransaction({
                dairy_id: user.dairy_id, item_id: parseInt(item_id),
                type: 'stock_in', quantity: qty, rate_per_unit: rate,
                total_amount: qty * rate, transaction_date,
                notes: stockInForm.notes || null, farmer_id: null,
                payment_mode: null, deduction_master_id: null
            });
            setStockInForm({ item_id: '', quantity: '', rate_per_unit: '', transaction_date: new Date().toISOString().split('T')[0], notes: '' });
            loadData();
            showAlert(t('inventory.stockIn.success'), 'Success', 'success');
        } catch (e) {
            showAlert(t('inventory.stockIn.errors.addError') + ' ' + e.message, 'Error', 'error');
        } finally { setSaving(false); }
    };

    const sellTotal           = parseFloat(sellForm.quantity || 0) * parseFloat(sellForm.rate_per_unit || 0);
    const splitDeductionAmount = sellForm.payment_mode === PAY_SPLIT
        ? Math.max(0, sellTotal - parseFloat(sellForm.cash_amount || 0)) : 0;

    const handleSell = async (e) => {
        e.preventDefault();
        const { item_id, farmer_id, quantity, rate_per_unit, transaction_date, payment_mode, deduction_master_id, cash_amount } = sellForm;
        if (!item_id || !farmer_id || !quantity || !rate_per_unit) {
            showAlert(t('inventory.sell.errors.fillRequired'), 'Validation', 'error'); return;
        }
        const availableStock = getStockForItem(item_id);
        const qty = parseFloat(quantity);
        if (qty > availableStock) {
            showAlert(t('inventory.sell.insufficientStock', { stock: availableStock.toFixed(2) }), 'Stock Error', 'error'); return;
        }
        if ((payment_mode === PAY_DEDUCTION || payment_mode === PAY_SPLIT) && !deduction_master_id) {
            showAlert(t('inventory.sell.errors.selectDeduction'), 'Validation', 'error'); return;
        }
        const total        = qty * parseFloat(rate_per_unit);
        const deductionAmt = payment_mode === PAY_CASH ? 0
            : payment_mode === PAY_DEDUCTION ? total
            : Math.max(0, total - parseFloat(cash_amount || 0));
        setSaving(true);
        try {
            await window.api.addInventoryTransaction({
                dairy_id: user.dairy_id, item_id: parseInt(item_id),
                type: 'sell', quantity: qty, rate_per_unit: parseFloat(rate_per_unit),
                total_amount: total, transaction_date, farmer_id: parseInt(farmer_id),
                payment_mode, deduction_master_id: deductionAmt > 0 ? parseInt(deduction_master_id) : null,
                notes: sellForm.notes || null
            });
            if (deductionAmt > 0 && deduction_master_id) {
                await window.api.assignDeduction({
                    dairy_id: user.dairy_id, farmer_id: parseInt(farmer_id),
                    deduction_master_id: parseInt(deduction_master_id),
                    amount: deductionAmt, total_amount: deductionAmt,
                    start_date: transaction_date
                });
            }
            setSellForm({ item_id: '', farmer_id: '', quantity: '', rate_per_unit: '', transaction_date: new Date().toISOString().split('T')[0], payment_mode: PAY_CASH, deduction_master_id: '', cash_amount: '', notes: '' });
            setFarmerSearch('');
            loadData();
            showAlert(t('inventory.sell.success'), 'Success', 'success');
        } catch (err) {
            showAlert(t('inventory.sell.errors.recordError') + ' ' + err.message, 'Error', 'error');
        } finally { setSaving(false); }
    };

    const handleDeleteTx = async (tx) => {
        const ok = await showConfirm(
            `Delete this ${tx.type === 'stock_in' ? 'stock-in' : 'sale'} of ${tx.quantity} ${tx.item_unit || ''}?`,
            'Delete Transaction', 'Delete', 'Cancel'
        );
        if (!ok) return;
        try { await window.api.deleteInventoryTransaction(tx.id, user.dairy_id); loadData(); }
        catch (e) { showAlert(t('inventory.transactions.deleteError') + ' ' + e.message, 'Error', 'error'); }
    };

    const filteredFarmers = farmers.filter(f => {
        const q = farmerSearch.toLowerCase();
        return (f.name || '').toLowerCase().includes(q) || String(f.code || '').includes(q);
    });
    const selectedFarmer = farmers.find(f => String(f.id) === String(sellForm.farmer_id));
    const filteredTx     = transactions.filter(tx => {
        const q = searchTerm.toLowerCase();
        if (!q) return true;
        return (tx.item_name || '').toLowerCase().includes(q) || (tx.farmer_name || '').toLowerCase().includes(q) || (tx.type || '').includes(q);
    });
    const filteredItems = items.filter(i => (i.name || '').toLowerCase().includes(searchTerm.toLowerCase()));

    // ── Style tokens ──────────────────────────────────────────────────────────
    const inp = {
        width: '100%', padding: '13px 16px', borderRadius: '10px',
        border: '1.5px solid #e2e8f0', fontSize: '15px', outline: 'none',
        background: 'white', boxSizing: 'border-box', color: '#1e293b',
        transition: 'border-color 0.2s, box-shadow 0.2s', fontFamily: 'inherit'
    };
    const lbl = {
        display: 'block', fontSize: '13px', fontWeight: '700', color: '#475569',
        marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px'
    };
    const row = { display: 'grid', gap: '16px' };
    const fieldGap = { display: 'flex', flexDirection: 'column', gap: '20px' };

    const tabColors = { items: '#10b981', stockin: '#2563eb', sell: '#7c3aed', transactions: '#db2777' };
    const tabBtn = (tab) => ({
        padding: '8px 16px',
        background: activeTab === tab ? `linear-gradient(135deg,${tabColors[tab]},${tabColors[tab]}cc)` : 'transparent',
        color: activeTab === tab ? 'white' : '#6b7280',
        border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: '600',
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
        transition: 'all 0.2s', whiteSpace: 'nowrap',
        boxShadow: activeTab === tab ? `0 2px 8px ${tabColors[tab]}44` : 'none'
    });

    const btnGreen = {
        width: '100%', padding: '15px', background: 'linear-gradient(135deg,#10b981,#059669)',
        color: 'white', border: 'none', borderRadius: '11px', fontSize: '15px', fontWeight: '700',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '8px', boxShadow: '0 3px 10px rgba(16,185,129,0.35)', transition: 'all 0.2s'
    };
    const btnPurple = {
        width: '100%', padding: '15px', background: 'linear-gradient(135deg,#7c3aed,#5b21b6)',
        color: 'white', border: 'none', borderRadius: '11px', fontSize: '15px', fontWeight: '700',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '8px', boxShadow: '0 3px 10px rgba(124,58,237,0.35)', transition: 'all 0.2s'
    };
    const badge = (color, bg) => ({
        padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700',
        background: bg, color, display: 'inline-flex', alignItems: 'center', gap: '3px'
    });

    // ── Payment mode options ───────────────────────────────────────────────────
    const payModes = [
        { mode: PAY_CASH,      label: t('inventory.sell.paymentModes.cash'),      icon: '💵', color: '#059669', activeBg: 'linear-gradient(135deg,#10b981,#059669)', shadow: 'rgba(16,185,129,0.4)' },
        { mode: PAY_DEDUCTION, label: t('inventory.sell.paymentModes.deduction'), icon: '📋', color: '#7c3aed', activeBg: 'linear-gradient(135deg,#7c3aed,#5b21b6)', shadow: 'rgba(124,58,237,0.4)' },
        { mode: PAY_SPLIT,     label: t('inventory.sell.paymentModes.split'),     icon: '✂️', color: '#2563eb', activeBg: 'linear-gradient(135deg,#3b82f6,#2563eb)', shadow: 'rgba(37,99,235,0.4)' },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '12px 20px', boxSizing: 'border-box', overflow: 'hidden', fontFamily: "'Inter',sans-serif" }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
                .iv-inp:focus { border-color: #10b981 !important; box-shadow: 0 0 0 3px rgba(16,185,129,0.12) !important; }
                .iv-row:hover td { background: #f8fafc !important; }
                .iv-scroll::-webkit-scrollbar { width: 5px; }
                .iv-scroll::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
                .spin { animation: _sp 1s linear infinite; }
                @keyframes _sp { to { transform: rotate(360deg); } }
                .iv-btn:hover { opacity: 0.88; transform: translateY(-1px); }
            `}</style>
            <AlertComponent />

            {/* ── HEADER (title + tabs, no metric cards) ──────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px', flexShrink: 0 }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg,#10b981,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Package size={18} color="white" />
                </div>
                <div style={{ flex: 1 }}>
                    <h1 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>{t('inventory.title')}</h1>
                    <p  style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>{t('inventory.subtitle')}</p>
                </div>
            </div>

            {/* ── TABS ────────────────────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '11px', marginBottom: '12px', width: 'fit-content', flexShrink: 0 }}>
                {[
                    { key: 'items',        label: t('inventory.tabs.items'),        icon: <Package size={14}/> },
                    { key: 'stockin',      label: t('inventory.tabs.stockin'),      icon: <ArrowUpCircle size={14}/> },
                    { key: 'sell',         label: t('inventory.tabs.sell'),         icon: <ShoppingCart size={14}/> },
                    { key: 'transactions', label: t('inventory.tabs.transactions'), icon: <BarChart3 size={14}/> },
                ].map(tab => (
                    <button key={tab.key} style={tabBtn(tab.key)} onClick={() => { setActiveTab(tab.key); setSearchTerm(''); }}>
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* ── CONTENT AREA ────────────────────────────────────────────── */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

                {/* ══ ITEMS TAB ═════════════════════════════════════════════ */}
                {activeTab === 'items' && (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '8px' }}>
                        {/* toolbar */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', background: 'white', borderRadius: '12px', padding: '10px 14px', border: '1px solid #f1f5f9', flexShrink: 0 }}>
                            <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
                                <Search size={14} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                <input className="iv-inp" type="text" placeholder={t('inventory.items.searchPlaceholder')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ ...inp, paddingLeft: '32px' }} />
                            </div>
                            <button className="iv-btn" style={{ ...btnGreen, width: 'auto', padding: '9px 16px' }} onClick={openAddItem}>
                                <Plus size={15} strokeWidth={2.5}/> {t('inventory.items.addItem')}
                            </button>
                        </div>
                        {/* table */}
                        <div className="iv-scroll" style={{ flex: 1, background: 'white', borderRadius: '12px', overflow: 'auto', border: '1px solid #f1f5f9', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                            {loading ? <div style={{ padding: '40px', textAlign: 'center' }}><Loader /></div> : (
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                        <tr style={{ background: 'linear-gradient(135deg,#10b981,#059669)', color: 'white' }}>
                                            {[t('inventory.items.headers.itemName'), t('inventory.items.headers.unit'), t('inventory.items.headers.currentStock'), t('inventory.items.headers.actions')].map((h, i) => (
                                                <th key={h} style={{ padding: '11px 16px', textAlign: i===2?'right':i===3?'center':'left', fontSize:'11px', fontWeight:'700', letterSpacing:'0.6px' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredItems.map(item => {
                                            const stock = getStockForItem(item.id);
                                            const isLow = stock < 10;
                                            return (
                                                <tr key={item.id} className="iv-row" style={{ borderBottom: '1px solid #f8fafc' }}>
                                                    <td style={{ padding: '12px 16px' }}>
                                                        <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '13px' }}>{item.name}</div>
                                                        {item.description && <div style={{ fontSize: '11px', color: '#94a3b8' }}>{item.description}</div>}
                                                    </td>
                                                    <td style={{ padding: '12px 16px' }}>
                                                        <span style={{ padding: '3px 8px', background: '#f1f5f9', borderRadius: '6px', fontSize: '12px', fontWeight: '700', color: '#475569' }}>{item.unit}</span>
                                                    </td>
                                                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                                        <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:'5px' }}>
                                                            {isLow && <AlertCircle size={13} color="#ef4444"/>}
                                                            <span style={{ fontSize:'14px', fontWeight:'800', color: isLow?'#ef4444':'#10b981' }}>{stock.toFixed(2)} {item.unit}</span>
                                                            {isLow && <span style={{ padding:'2px 6px', borderRadius:'20px', fontSize:'10px', fontWeight:'700', background:'#fef2f2', color:'#dc2626' }}>{t('inventory.items.lowStock')}</span>}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                                        <div style={{ display:'flex', gap:'6px', justifyContent:'center' }}>
                                                            <button onClick={() => openEditItem(item)} style={{ width:'30px', height:'30px', background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:'8px', cursor:'pointer', color:'#0284c7', display:'flex', alignItems:'center', justifyContent:'center' }}><Edit size={14}/></button>
                                                            <button onClick={() => handleItemDelete(item)} style={{ width:'30px', height:'30px', background:'#fef2f2', border:'1px solid #fee2e2', borderRadius:'8px', cursor:'pointer', color:'#dc2626', display:'flex', alignItems:'center', justifyContent:'center' }}><Trash2 size={14}/></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {filteredItems.length === 0 && (
                                            <tr><td colSpan="4" style={{ padding:'40px', textAlign:'center', color:'#cbd5e1', fontSize:'13px' }}>{t('inventory.items.noItems')}</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                )}

                {/* ══ STOCK IN TAB ══════════════════════════════════════════ */}
                {activeTab === 'stockin' && (
                    <div className="iv-scroll" style={{ flex: 1, overflowY: 'auto' }}>
                        <div style={{ background: 'white', borderRadius: '14px', padding: '20px 24px', border: '1px solid #f1f5f9', boxShadow: '0 1px 6px rgba(0,0,0,0.04)', maxWidth: '780px' }}>
                            {/* section title */}
                            <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'18px', paddingBottom:'14px', borderBottom:'1px solid #f1f5f9' }}>
                                <div style={{ width:'34px', height:'34px', borderRadius:'10px', background:'#dbeafe', display:'flex', alignItems:'center', justifyContent:'center', color:'#2563eb', flexShrink:0 }}>
                                    <ArrowUpCircle size={17}/>
                                </div>
                                <div>
                                    <h2 style={{ margin:0, fontSize:'17px', fontWeight:'800', color:'#0f172a' }}>{t('inventory.stockIn.title')}</h2>
                                    <p  style={{ margin:0, fontSize:'13px', color:'#94a3b8' }}>{t('inventory.stockIn.subtitle')}</p>
                                </div>
                            </div>

                            <form onSubmit={handleStockIn} style={fieldGap}>
                                {/* Item */}
                                <div>
                                    <label style={lbl}>{t('inventory.stockIn.item')} *</label>
                                    <select className="iv-inp" value={stockInForm.item_id} onChange={e => setStockInForm(p=>({...p,item_id:e.target.value}))} style={inp} required>
                                        <option value="">{t('inventory.stockIn.selectItem')}</option>
                                        {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit}) — {getStockForItem(i.id).toFixed(2)} available</option>)}
                                    </select>
                                </div>

                                {/* Qty + Rate on one line */}
                                <div style={{ ...row, gridTemplateColumns:'1fr 1fr' }}>
                                    <div>
                                        <label style={lbl}>{t('inventory.stockIn.quantity')} *</label>
                                        <input className="iv-inp" type="number" step="0.01" min="0.01" placeholder="0.00" value={stockInForm.quantity} onChange={e=>setStockInForm(p=>({...p,quantity:e.target.value}))} style={inp} required/>
                                    </div>
                                    <div>
                                        <label style={lbl}>{t('inventory.stockIn.ratePerUnit')} *</label>
                                        <input className="iv-inp" type="number" step="0.01" min="0" placeholder="0.00" value={stockInForm.rate_per_unit} onChange={e=>setStockInForm(p=>({...p,rate_per_unit:e.target.value}))} style={inp} required/>
                                    </div>
                                </div>

                                {/* Total value pill — shown inline when qty & rate filled */}
                                {stockInForm.quantity && stockInForm.rate_per_unit && (
                                    <div style={{ display:'flex', alignItems:'center', gap:'10px', background:'#ecfdf5', borderRadius:'10px', padding:'10px 14px', border:'1px solid #a7f3d0' }}>
                                        <span style={{ fontSize:'12px', color:'#059669', fontWeight:'700' }}>{t('inventory.stockIn.totalValue')}:</span>
                                        <span style={{ fontSize:'20px', fontWeight:'900', color:'#064e3b' }}>
                                            ₹{(parseFloat(stockInForm.quantity)*parseFloat(stockInForm.rate_per_unit)).toLocaleString('en-IN',{minimumFractionDigits:2})}
                                        </span>
                                    </div>
                                )}

                                {/* Date + Notes on one line */}
                                <div style={{ ...row, gridTemplateColumns:'1fr 1fr' }}>
                                    <div>
                                        <label style={lbl}>{t('inventory.stockIn.date')} *</label>
                                        <input className="iv-inp" type="date" value={stockInForm.transaction_date} onChange={e=>setStockInForm(p=>({...p,transaction_date:e.target.value}))} style={inp} required/>
                                    </div>
                                    <div>
                                        <label style={lbl}>{t('inventory.stockIn.notes')}</label>
                                        <input className="iv-inp" type="text" placeholder={t('inventory.stockIn.notesPlaceholder')} value={stockInForm.notes} onChange={e=>setStockInForm(p=>({...p,notes:e.target.value}))} style={inp}/>
                                    </div>
                                </div>

                                <button type="submit" className="iv-btn" style={btnGreen} disabled={saving}>
                                    {saving ? <Loader2 size={16} className="spin"/> : <ArrowUpCircle size={16}/>}
                                    {saving ? t('inventory.stockIn.saving') : t('inventory.stockIn.addStock')}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* ══ SELL TAB ══════════════════════════════════════════════ */}
                {activeTab === 'sell' && (
                    <div className="iv-scroll" style={{ flex: 1, overflowY: 'auto' }}>
                        <div style={{ background: 'white', borderRadius: '14px', padding: '20px 24px', border: '1px solid #f1f5f9', boxShadow: '0 1px 6px rgba(0,0,0,0.04)', maxWidth: '780px' }}>
                            {/* section title */}
                            <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'18px', paddingBottom:'14px', borderBottom:'1px solid #f1f5f9' }}>
                                <div style={{ width:'34px', height:'34px', borderRadius:'10px', background:'#ede9fe', display:'flex', alignItems:'center', justifyContent:'center', color:'#7c3aed', flexShrink:0 }}>
                                    <ShoppingCart size={17}/>
                                </div>
                                <div>
                                    <h2 style={{ margin:0, fontSize:'17px', fontWeight:'800', color:'#0f172a' }}>{t('inventory.sell.title')}</h2>
                                    <p  style={{ margin:0, fontSize:'13px', color:'#94a3b8' }}>{t('inventory.sell.subtitle')}</p>
                                </div>
                            </div>

                            <form onSubmit={handleSell} style={fieldGap}>
                                {/* Item */}
                                <div>
                                    <label style={lbl}>{t('inventory.sell.item')} *</label>
                                    <select className="iv-inp" value={sellForm.item_id} onChange={e => {
                                        const id  = e.target.value;
                                        const it  = items.find(i => String(i.id) === String(id));
                                        const dm  = it ? deductionMasters.find(d => d.name.trim().toLowerCase() === it.name.trim().toLowerCase()) : null;
                                        setSellForm(p => ({ ...p, item_id: id, ...(dm ? { deduction_master_id: String(dm.id), payment_mode: PAY_DEDUCTION } : {}) }));
                                    }} style={inp} required>
                                        <option value="">{t('inventory.sell.selectItem')}</option>
                                        {items.map(i => {
                                            const stock = getStockForItem(i.id);
                                            return <option key={i.id} value={i.id}>{i.name} — {stock.toFixed(2)} {i.unit} available</option>;
                                        })}
                                    </select>
                                    {/* Inline available stock badge */}
                                    {sellForm.item_id && (() => {
                                        const it    = items.find(i => String(i.id) === String(sellForm.item_id));
                                        const stock = getStockForItem(sellForm.item_id);
                                        const isLow = stock < 10;
                                        return it ? (
                                            <div style={{ marginTop:'6px', display:'flex', alignItems:'center', gap:'6px' }}>
                                                <span style={{ fontSize:'12px', color:'#64748b' }}>{t('inventory.sell.availableStock')}:</span>
                                                <span style={{ fontSize:'14px', fontWeight:'800', color: isLow?'#ef4444':'#10b981' }}>{stock.toFixed(2)} {it.unit}</span>
                                                {isLow && <span style={{ fontSize:'11px', color:'#dc2626', fontWeight:'700' }}>⚠️ {t('inventory.items.lowStockAlert')}</span>}
                                            </div>
                                        ) : null;
                                    })()}
                                </div>

                                {/* Farmer */}
                                <div style={{ position: 'relative' }}>
                                    <label style={lbl}>{t('inventory.sell.farmer')} *</label>
                                    {selectedFarmer ? (
                                        <div style={{ display:'flex', alignItems:'center', gap:'10px', background:'#ecfdf5', padding:'9px 12px', borderRadius:'10px', border:'1.5px solid #6ee7b7' }}>
                                            <div style={{ width:'32px', height:'32px', borderRadius:'8px', background:'#10b981', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'800', fontSize:'13px', flexShrink:0 }}>
                                                {selectedFarmer.name?.[0]?.toUpperCase()}
                                            </div>
                                            <div style={{ flex:1, minWidth:0 }}>
                                                <div style={{ fontWeight:'700', color:'#065f46', fontSize:'13px' }}>{selectedFarmer.name}</div>
                                                <div style={{ fontSize:'11px', color:'#059669' }}>Code: #{selectedFarmer.code}</div>
                                            </div>
                                            <button type="button" onClick={() => { setSellForm(p=>({...p,farmer_id:''})); setFarmerSearch(''); }} style={{ background:'none', border:'none', cursor:'pointer', color:'#6b7280', padding:0 }}>
                                                <X size={16}/>
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div style={{ position:'relative' }}>
                                                <Users size={14} style={{ position:'absolute', left:'11px', top:'50%', transform:'translateY(-50%)', color:'#94a3b8' }}/>
                                                <input className="iv-inp" type="text" placeholder={t('inventory.sell.searchFarmer')} value={farmerSearch}
                                                    onChange={e=>{ setFarmerSearch(e.target.value); setShowFarmerDropdown(true); }}
                                                    onFocus={()=>setShowFarmerDropdown(true)}
                                                    style={{ ...inp, paddingLeft:'34px' }}/>
                                            </div>
                                            {showFarmerDropdown && farmerSearch && (
                                                <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'white', border:'1.5px solid #e2e8f0', borderRadius:'10px', zIndex:100, maxHeight:'180px', overflowY:'auto', boxShadow:'0 8px 24px rgba(0,0,0,0.1)', marginTop:'3px' }}>
                                                    {filteredFarmers.slice(0,10).map(f => (
                                                        <div key={f.id}
                                                            onClick={()=>{ setSellForm(p=>({...p,farmer_id:f.id})); setFarmerSearch(''); setShowFarmerDropdown(false); }}
                                                            style={{ padding:'10px 14px', cursor:'pointer', borderBottom:'1px solid #f8fafc', display:'flex', alignItems:'center', gap:'10px' }}
                                                            onMouseEnter={e=>e.currentTarget.style.background='#f0fdf4'}
                                                            onMouseLeave={e=>e.currentTarget.style.background='white'}>
                                                            <div style={{ width:'28px', height:'28px', borderRadius:'7px', background:'#d1fae5', display:'flex', alignItems:'center', justifyContent:'center', color:'#059669', fontWeight:'800', fontSize:'12px' }}>
                                                                {f.name?.[0]?.toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <div style={{ fontWeight:'600', color:'#1e293b', fontSize:'13px' }}>{f.name}</div>
                                                                <div style={{ fontSize:'11px', color:'#059669' }}>#{f.code}</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {filteredFarmers.length===0 && <div style={{ padding:'14px', color:'#94a3b8', textAlign:'center', fontSize:'12px' }}>{t('inventory.sell.noFarmersFound')}</div>}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>

                                {/* Qty + Rate on one line */}
                                <div style={{ ...row, gridTemplateColumns:'1fr 1fr' }}>
                                    <div>
                                        <label style={lbl}>{t('inventory.sell.quantity')} *</label>
                                        <input className="iv-inp" type="number" step="0.01" min="0.01" placeholder="0.00" value={sellForm.quantity} onChange={e=>setSellForm(p=>({...p,quantity:e.target.value}))} style={inp} required/>
                                    </div>
                                    <div>
                                        <label style={lbl}>{t('inventory.sell.ratePerUnit')} *</label>
                                        <input className="iv-inp" type="number" step="0.01" min="0" placeholder="0.00" value={sellForm.rate_per_unit} onChange={e=>setSellForm(p=>({...p,rate_per_unit:e.target.value}))} style={inp} required/>
                                    </div>
                                </div>

                                {/* Sale total pill — inline, shown only when filled */}
                                {sellTotal > 0 && (
                                    <div style={{ display:'flex', alignItems:'center', gap:'10px', background:'#faf5ff', borderRadius:'10px', padding:'10px 14px', border:'1px solid #ddd6fe' }}>
                                        <span style={{ fontSize:'12px', color:'#7c3aed', fontWeight:'700' }}>{t('inventory.sell.saleTotal')}:</span>
                                        <span style={{ fontSize:'20px', fontWeight:'900', color:'#4c1d95' }}>₹{sellTotal.toLocaleString('en-IN',{minimumFractionDigits:2})}</span>
                                        <span style={{ fontSize:'12px', color:'#8b5cf6', marginLeft:'auto' }}>{sellForm.quantity} × ₹{sellForm.rate_per_unit}</span>
                                    </div>
                                )}

                                {/* Date */}
                                <div>
                                    <label style={lbl}>{t('inventory.sell.date')} *</label>
                                    <input className="iv-inp" type="date" value={sellForm.transaction_date} onChange={e=>setSellForm(p=>({...p,transaction_date:e.target.value}))} style={inp} required/>
                                </div>

                                {/* Payment mode */}
                                <div>
                                    <label style={lbl}>{t('inventory.sell.paymentMode')} *</label>
                                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px' }}>
                                        {payModes.map(({ mode, label, icon, color, activeBg, shadow }) => {
                                            const active = sellForm.payment_mode === mode;
                                            return (
                                                <button key={mode} type="button"
                                                    onClick={()=>setSellForm(p=>({...p,payment_mode:mode,cash_amount:''}))}
                                                    style={{ padding:'11px 6px', background: active ? activeBg : 'white', color: active ? 'white' : '#475569', border:`1.5px solid ${active?color:'#e2e8f0'}`, borderRadius:'10px', fontWeight:'700', fontSize:'13px', cursor:'pointer', boxShadow: active?`0 3px 10px ${shadow}`:'none', display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', transition:'all 0.2s' }}>
                                                    <span style={{ fontSize:'18px' }}>{icon}</span>
                                                    {label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Conditional: Split cash */}
                                {sellForm.payment_mode === PAY_SPLIT && (
                                    <div style={{ background:'#eff6ff', borderRadius:'10px', padding:'12px 14px', border:'1px solid #bfdbfe' }}>
                                        <label style={{ ...lbl, color:'#1d4ed8' }}>{t('inventory.sell.cashAmount')} *</label>
                                        <input className="iv-inp" type="number" step="0.01" min="0" max={sellTotal}
                                            placeholder={t('inventory.sell.cashMax',{max:sellTotal.toFixed(2)})}
                                            value={sellForm.cash_amount}
                                            onChange={e=>setSellForm(p=>({...p,cash_amount:e.target.value}))}
                                            style={{ ...inp }} required/>
                                        {sellForm.cash_amount && (
                                            <div style={{ marginTop:'7px', display:'flex', justifyContent:'space-between' }}>
                                                <span style={{ fontSize:'12px', color:'#2563eb', fontWeight:'700' }}>{t('inventory.sell.cashLabel')} ₹{parseFloat(sellForm.cash_amount||0).toFixed(2)}</span>
                                                <span style={{ fontSize:'12px', color:'#7c3aed', fontWeight:'700' }}>{t('inventory.sell.deductionLabel')} ₹{splitDeductionAmount.toFixed(2)}</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Conditional: Deduction type */}
                                {(sellForm.payment_mode === PAY_DEDUCTION || sellForm.payment_mode === PAY_SPLIT) && (
                                    <div style={{ background:'#faf5ff', borderRadius:'10px', padding:'12px 14px', border:'1px solid #ddd6fe' }}>
                                        <label style={{ ...lbl, color:'#7c3aed' }}>{t('inventory.sell.deductionType')} *</label>
                                        <select className="iv-inp" value={sellForm.deduction_master_id} onChange={e=>setSellForm(p=>({...p,deduction_master_id:e.target.value}))} style={inp} required>
                                            <option value="">{t('inventory.sell.selectDeductionType')}</option>
                                            {deductionMasters.map(dm=><option key={dm.id} value={dm.id}>{dm.name}</option>)}
                                        </select>
                                        <p style={{ margin:'6px 0 0', fontSize:'11px', color:'#8b5cf6' }}>{t('inventory.sell.deductionHint')}</p>
                                    </div>
                                )}

                                {/* Notes */}
                                <div>
                                    <label style={lbl}>{t('inventory.sell.notes')}</label>
                                    <input className="iv-inp" type="text" placeholder={t('inventory.sell.notesPlaceholder')} value={sellForm.notes} onChange={e=>setSellForm(p=>({...p,notes:e.target.value}))} style={inp}/>
                                </div>

                                <button type="submit" className="iv-btn" style={btnPurple} disabled={saving}>
                                    {saving ? <Loader2 size={16} className="spin"/> : <ShoppingCart size={16}/>}
                                    {saving ? t('inventory.sell.recordingNotSale') : t('inventory.sell.recordSale')}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* ══ TRANSACTIONS TAB ══════════════════════════════════════ */}
                {activeTab === 'transactions' && (
                    <div style={{ display:'flex', flexDirection:'column', height:'100%', gap:'8px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'12px', background:'white', borderRadius:'12px', padding:'10px 14px', border:'1px solid #f1f5f9', flexShrink:0 }}>
                            <div style={{ position:'relative', flex:1, maxWidth:'320px' }}>
                                <Search size={14} style={{ position:'absolute', left:'11px', top:'50%', transform:'translateY(-50%)', color:'#94a3b8' }}/>
                                <input className="iv-inp" type="text" placeholder={t('inventory.transactions.searchPlaceholder')} value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} style={{ ...inp, paddingLeft:'32px' }}/>
                            </div>
                            <div style={{ fontSize:'12px', color:'#94a3b8', fontWeight:'600' }}>{filteredTx.length} {t('inventory.transactions.records')}</div>
                        </div>
                        <div className="iv-scroll" style={{ flex:1, background:'white', borderRadius:'12px', overflow:'auto', border:'1px solid #f1f5f9' }}>
                            {loading ? <div style={{ padding:'40px', textAlign:'center' }}><Loader/></div> : (
                                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                                    <thead style={{ position:'sticky', top:0, zIndex:1 }}>
                                        <tr style={{ background:'linear-gradient(135deg,#db2777,#be185d)', color:'white' }}>
                                            {[t('inventory.transactions.headers.date'),t('inventory.transactions.headers.item'),t('inventory.transactions.headers.type'),t('inventory.transactions.headers.farmer'),t('inventory.transactions.headers.qty'),t('inventory.transactions.headers.rate'),t('inventory.transactions.headers.total'),t('inventory.transactions.headers.payment'),''].map((h,i)=>(
                                                <th key={i} style={{ padding:'11px 14px', textAlign:i>=4&&i<=6?'right':i===8?'center':'left', fontSize:'10px', fontWeight:'700', letterSpacing:'0.6px' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredTx.map(tx => {
                                            const farmerObj = farmers.find(f=>String(f.id)===String(tx.farmer_id));
                                            const isIn = tx.type === 'stock_in';
                                            return (
                                                <tr key={tx.id} className="iv-row" style={{ borderBottom:'1px solid #f8fafc' }}>
                                                    <td style={{ padding:'11px 14px', fontSize:'12px', color:'#475569', whiteSpace:'nowrap' }}>
                                                        {new Date(tx.transaction_date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}
                                                    </td>
                                                    <td style={{ padding:'11px 14px' }}>
                                                        <div style={{ fontWeight:'700', color:'#1e293b', fontSize:'13px' }}>{tx.item_name}</div>
                                                        <div style={{ fontSize:'10px', color:'#94a3b8' }}>{tx.item_unit}</div>
                                                    </td>
                                                    <td style={{ padding:'11px 14px' }}>
                                                        <span style={badge(isIn?'#1d4ed8':'#7c3aed', isIn?'#dbeafe':'#ede9fe')}>
                                                            {isIn?<ArrowUpCircle size={11}/>:<ArrowDownCircle size={11}/>}
                                                            {isIn?t('inventory.transactions.types.stockIn'):t('inventory.transactions.types.sale')}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding:'11px 14px', fontSize:'12px' }}>
                                                        {farmerObj ? <div>
                                                            <div style={{ fontWeight:'600', color:'#1e293b', fontSize:'13px' }}>{farmerObj.name}</div>
                                                            <div style={{ fontSize:'10px', color:'#10b981' }}>#{farmerObj.code}</div>
                                                        </div> : '—'}
                                                    </td>
                                                    <td style={{ padding:'11px 14px', textAlign:'right', fontWeight:'700', color:'#1e293b', fontSize:'13px' }}>{parseFloat(tx.quantity).toFixed(2)}</td>
                                                    <td style={{ padding:'11px 14px', textAlign:'right', fontSize:'12px', color:'#475569' }}>₹{parseFloat(tx.rate_per_unit||0).toFixed(2)}</td>
                                                    <td style={{ padding:'11px 14px', textAlign:'right', fontWeight:'800', color:isIn?'#2563eb':'#7c3aed', fontSize:'13px' }}>
                                                        ₹{parseFloat(tx.total_amount||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}
                                                    </td>
                                                    <td style={{ padding:'11px 14px' }}>
                                                        {tx.payment_mode ? (
                                                            <span style={badge(
                                                                tx.payment_mode==='cash'?'#059669':tx.payment_mode==='deduction'?'#7c3aed':'#2563eb',
                                                                tx.payment_mode==='cash'?'#d1fae5':tx.payment_mode==='deduction'?'#ede9fe':'#dbeafe'
                                                            )}>
                                                                {tx.payment_mode==='cash'?t('inventory.transactions.payment.cash'):tx.payment_mode==='deduction'?t('inventory.transactions.payment.deduction'):t('inventory.transactions.payment.split')}
                                                            </span>
                                                        ) : '—'}
                                                    </td>
                                                    <td style={{ padding:'11px 14px', textAlign:'center' }}>
                                                        <button onClick={()=>handleDeleteTx(tx)} style={{ width:'28px', height:'28px', background:'#fef2f2', border:'1px solid #fee2e2', borderRadius:'7px', cursor:'pointer', color:'#dc2626', display:'flex', alignItems:'center', justifyContent:'center' }}>
                                                            <Trash2 size={13}/>
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {filteredTx.length===0 && (
                                            <tr><td colSpan="9" style={{ padding:'40px', textAlign:'center', color:'#cbd5e1', fontSize:'13px' }}>{t('inventory.transactions.noTransactions')}</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ══ ITEM MODAL ════════════════════════════════════════════════ */}
            {showItemModal && (
                <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.5)', backdropFilter:'blur(5px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'20px' }}>
                    <div style={{ background:'white', borderRadius:'18px', width:'400px', boxShadow:'0 20px 50px rgba(0,0,0,0.2)', overflow:'hidden' }}>
                        <div style={{ padding:'16px 20px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                                <div style={{ width:'32px', height:'32px', borderRadius:'9px', background:'#d1fae5', display:'flex', alignItems:'center', justifyContent:'center', color:'#059669' }}>
                                    <Package size={16}/>
                                </div>
                                <h3 style={{ margin:0, fontSize:'15px', fontWeight:'800', color:'#0f172a' }}>{editingItem?t('inventory.modal.editItem'):t('inventory.modal.addItem')}</h3>
                            </div>
                            <button onClick={()=>setShowItemModal(false)} style={{ width:'28px', height:'28px', background:'#f1f5f9', border:'none', borderRadius:'8px', cursor:'pointer', color:'#64748b', display:'flex', alignItems:'center', justifyContent:'center' }}>
                                <X size={14}/>
                            </button>
                        </div>
                        <form onSubmit={handleItemSave} style={{ padding:'18px 20px', display:'flex', flexDirection:'column', gap:'14px' }}>
                            <div>
                                <label style={lbl}>{t('inventory.modal.itemName')} *</label>
                                <input className="iv-inp" type="text" placeholder={t('inventory.modal.itemNamePlaceholder')} value={itemForm.name} onChange={e=>setItemForm(p=>({...p,name:e.target.value}))} style={inp} required autoFocus/>
                            </div>
                            <div style={{ ...row, gridTemplateColumns:'1fr 1fr' }}>
                                <div>
                                    <label style={lbl}>{t('inventory.modal.unit')} *</label>
                                    <select className="iv-inp" value={itemForm.unit} onChange={e=>setItemForm(p=>({...p,unit:e.target.value}))} style={inp}>
                                        {['kg','g','litre','ml','piece','bag','box','bottle','packet','quintal'].map(u=><option key={u} value={u}>{u}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={lbl}>{t('inventory.modal.description')}</label>
                                    <input className="iv-inp" type="text" placeholder={t('inventory.modal.descriptionPlaceholder')} value={itemForm.description} onChange={e=>setItemForm(p=>({...p,description:e.target.value}))} style={inp}/>
                                </div>
                            </div>
                            <div style={{ display:'flex', gap:'10px' }}>
                                <button type="button" onClick={()=>setShowItemModal(false)} style={{ flex:1, padding:'10px', background:'#f8fafc', border:'1.5px solid #e2e8f0', borderRadius:'9px', fontWeight:'700', cursor:'pointer', color:'#475569', fontSize:'13px' }}>
                                    {t('inventory.modal.cancel')}
                                </button>
                                <button type="submit" className="iv-btn" style={{ ...btnGreen, flex:1.5, padding:'10px' }} disabled={saving}>
                                    {saving?<Loader2 size={14} className="spin"/>:<CheckCircle2 size={14}/>}
                                    {saving?t('inventory.modal.saving'):editingItem?t('inventory.modal.updateItemBtn'):t('inventory.modal.addItemBtn')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Inventory;