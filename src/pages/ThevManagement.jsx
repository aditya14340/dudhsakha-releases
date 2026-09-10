import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    PiggyBank, Plus, Search, Edit, Trash2, X, Eye, RefreshCw,
    IndianRupee, Users, FileText, CheckCircle2, Printer,
    ArrowUpCircle, Calendar, History, Wrench, Download, AlignJustify
} from 'lucide-react';
import { useAlert } from '../hooks/useAlert';
import Loader from '../components/Loader';

const fmt = (n) => parseFloat(n || 0).toFixed(2);
const todayStr = () => new Date().toISOString().split('T')[0];
const firstOfYearStr = () => `${new Date().getFullYear()}-01-01`;

// ── Rate history stored in localStorage (no DB schema change needed) ──
const RATE_HIST_KEY = (dairyId, masterId) => `thev_rate_hist_${dairyId}_${masterId}`;
const appendRateHistory = (dairyId, masterId, entry) => {
    try {
        const key = RATE_HIST_KEY(dairyId, masterId);
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        existing.unshift({ ...entry, changedAt: new Date().toISOString() }); // newest first
        localStorage.setItem(key, JSON.stringify(existing.slice(0, 50))); // keep last 50
    } catch(e) { console.warn('rate history save failed', e); }
};
const readRateHistory = (dairyId, masterId) => {
    try { return JSON.parse(localStorage.getItem(RATE_HIST_KEY(dairyId, masterId)) || '[]'); }
    catch(e) { return []; }
};

// ── show_balance_in_bill preference stored in localStorage ──
// Key: thev_show_bal_{dairyId}  →  { [masterId]: boolean }
const SHOW_BAL_KEY = (dairyId) => `thev_show_bal_${dairyId}`;
const getShowBalPrefs = (dairyId) => {
    try { return JSON.parse(localStorage.getItem(SHOW_BAL_KEY(dairyId)) || '{}'); }
    catch(e) { return {}; }
};
const setShowBalPref = (dairyId, masterId, value) => {
    try {
        const prefs = getShowBalPrefs(dairyId);
        prefs[String(masterId)] = value;
        localStorage.setItem(SHOW_BAL_KEY(dairyId), JSON.stringify(prefs));
    } catch(e) { console.warn('show_balance pref save failed', e); }
};
// Merge localStorage show_balance prefs onto a masters array from DB
const applyShowBalPrefs = (masters, dairyId) => {
    const prefs = getShowBalPrefs(dairyId);
    return masters.map(m => ({
        ...m,
        // If a localStorage pref exists use it, otherwise default to true (show)
        show_balance_in_bill: String(m.id) in prefs ? prefs[String(m.id)] : (m.show_balance_in_bill !== false)
    }));
};

// ── Rate History Modal ─────────────────────────────────────────────────
const RateHistoryModal = ({ master, dairyId, onClose }) => {
    const history = readRateHistory(dairyId, master.id);
    const typeLabel = { per_liter: '/लिटर', percentage: '%', fixed_amount: ' (निश्चित)' }[master.deduction_type] || '';
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff', borderRadius: 16, width: 560, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <History size={20} color='#4f46e5' />
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>दर बदल इतिहास</div>
                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{master.name} — चालू दर: ₹{master.default_rate}{typeLabel}</div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 6 }}><X size={18} /></button>
                </div>
                {/* Body */}
                <div style={{ overflowY: 'auto', padding: '16px 24px 24px' }}>
                    {history.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                            <History size={40} color='#cbd5e1' />
                            <div style={{ marginTop: 12 }}>अद्याप कोणताही दर बदल नोंदवला नाही.</div>
                            <div style={{ fontSize: '0.78rem', marginTop: 6, color: '#94a3b8' }}>पुढील वेळी दर बदलल्यावर इथे दिसेल.</div>
                        </div>
                    ) : (
                        <>
                            <div style={{ marginBottom: 14, fontSize: '0.82rem', color: '#64748b' }}>एकूण {history.length} वेळा दर बदलला</div>
                            <div style={{ position: 'relative' }}>
                                {/* Timeline line */}
                                <div style={{ position: 'absolute', left: 19, top: 0, bottom: 0, width: 2, background: '#e2e8f0' }} />
                                {history.map((h, idx) => (
                                    <div key={idx} style={{ display: 'flex', gap: 14, marginBottom: 18, position: 'relative' }}>
                                        {/* Dot */}
                                        <div style={{ width: 38, height: 38, borderRadius: '50%', background: idx === 0 ? '#4f46e5' : '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1, border: '3px solid #fff', boxShadow: '0 0 0 2px ' + (idx === 0 ? '#4f46e5' : '#cbd5e1') }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: idx === 0 ? '#fff' : '#64748b' }}>#{history.length - idx}</span>
                                        </div>
                                        {/* Content */}
                                        <div style={{ flex: 1, background: idx === 0 ? '#f5f3ff' : '#f8fafc', borderRadius: 10, padding: '12px 14px', border: `1px solid ${idx === 0 ? '#ddd6fe' : '#e2e8f0'}` }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 6 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                    <span style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 8, padding: '2px 8px', fontSize: '0.85rem', fontWeight: 700 }}>₹{h.oldRate}{typeLabel}</span>
                                                    <span style={{ color: '#94a3b8', fontSize: '1rem' }}>→</span>
                                                    <span style={{ background: '#dcfce7', color: '#16a34a', borderRadius: 8, padding: '2px 8px', fontSize: '0.85rem', fontWeight: 700 }}>₹{h.newRate}{typeLabel}</span>
                                                    {idx === 0 && <span style={{ background: '#4f46e5', color: '#fff', borderRadius: 8, padding: '2px 8px', fontSize: '0.72rem', fontWeight: 600 }}>नवीनतम</span>}
                                                </div>
                                            </div>
                                            <div style={{ marginTop: 8, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.8rem', color: '#64748b' }}>
                                                <span>📅 लागू तारीख: <b style={{ color: '#1e293b' }}>{h.appliedFrom}</b></span>
                                                <span>🕐 बदल केला: <b style={{ color: '#1e293b' }}>{new Date(h.changedAt).toLocaleString('mr-IN')}</b></span>
                                            </div>
                                            {h.affectedAccounts > 0 && (
                                                <div style={{ marginTop: 6, fontSize: '0.78rem', color: '#7c3aed' }}>👥 {h.affectedAccounts} खाती अपडेट झाली</div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const TYPE_LABELS = {
    per_liter: 'प्रति लिटर',
    fixed_amount: 'प्रति बिल निश्चित',
    percentage: 'टक्केवारी (%)',
};

const TXN_META = {
    deposit:  { bg: '#dcfce7', text: '#16a34a', label: 'जमा' },
    refund:   { bg: '#fef3c7', text: '#d97706', label: 'परतावा' },
    interest: { bg: '#ede9fe', text: '#7c3aed', label: 'व्याज' },
    opening:  { bg: '#dbeafe', text: '#2563eb', label: 'आरंभिक' },
};

// ─── RefundModal ──────────────────────────────────────────────────────────────
function RefundModal({ account, farmers, onClose, onSuccess, user, showAlert, showConfirm }) {
    const [fromDate, setFromDate]   = useState(firstOfYearStr());
    const [toDate, setToDate]       = useState(todayStr());
    const [depositedInRange, setDIR]= useState(null);
    const [refundAmount, setRA]     = useState('');
    const [interest, setInterest]   = useState('');
    const [remarks, setRemarks]     = useState('');
    const [loading, setLoading]     = useState(false);
    const [loadingRange, setLR]     = useState(false);
    const [done, setDone]           = useState(false);
    const [receiptData, setRD]      = useState(null);

    const currentBal  = parseFloat(account?.current_balance || 0);
    const farmer      = farmers.find(f => String(f.id) === String(account?.farmer_id));
    const refundAmt   = parseFloat(refundAmount) || 0;
    const interestAmt = parseFloat(interest) || 0;
    const totalPayout = refundAmt + interestAmt;
    const balAfter    = Math.max(0, currentBal - refundAmt);

    const fetchRange = useCallback(async () => {
        if (!fromDate || !toDate || !account?.id) return;
        setLR(true);
        try {
            const txns = await window.api.getFarmerThevLedger(
                account.farmer_id, user.dairy_id, fromDate, toDate
            );
            const total = txns
                .filter(tx => tx.transaction_type === 'deposit' && String(tx.thev_account_id) === String(account.id))
                .reduce((s, tx) => s + parseFloat(tx.amount || 0), 0);
            setDIR(total);
        } catch (e) { console.error(e); } finally { setLR(false); }
    }, [fromDate, toDate, account, user.dairy_id]);

    useEffect(() => { fetchRange(); }, [fetchRange]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (refundAmt <= 0) { showAlert('कृपया वैध परतावा रक्कम टाका.', 'त्रुटी', 'error'); return; }
        if (refundAmt > currentBal) {
            showAlert(`परतावा (₹${refundAmt}) चालू शिल्लक (₹${fmt(currentBal)}) पेक्षा जास्त असू शकत नाही.`, 'त्रुटी', 'error');
            return;
        }
        const confirmed = await showConfirm(
            `${farmer?.name || 'शेतकरी'} यांना ₹${fmt(totalPayout)} परत द्यायचे का?\nपरताव्यानंतर शिल्लक: ₹${fmt(balAfter)}`,
            'ठेव परतावा नक्की करा', 'होय, परत द्या', 'रद्द करा'
        );
        if (!confirmed) return;
        setLoading(true);
        try {
            const result = await window.api.processThevRefund({
                dairyId: user.dairy_id, farmerId: account.farmer_id, thevAccountId: account.id,
                refundAmount: refundAmt, interestAmount: interestAmt,
                startDate: fromDate, endDate: toDate,
                remarks: remarks || `ठेव परतावा (${fromDate} ते ${toDate})`,
            });
            setRD({ farmer, account, refundAmt, interestAmt, totalPayout, balAfter: result.newBalance, date: todayStr(), remarks });
            setDone(true);
            onSuccess();
        } catch (err) {
            showAlert('परतावा देताना त्रुटी: ' + err.message, 'त्रुटी', 'error');
        } finally { setLoading(false); }
    };

    const handlePrint = () => {
        if (!receiptData) return;
        const w = window.open('', '_blank');
        const html = `<html><head><title>ठेव परतावा पावती</title>
        <style>body{font-family:Arial,sans-serif;padding:30px}h1{color:#4f46e5;text-align:center}
        table{width:100%;border-collapse:collapse;margin-top:16px}td{padding:8px 12px;border-bottom:1px solid #eee}
        td:first-child{font-weight:600;color:#555;width:50%}.total{background:#f0fdf4;font-weight:700}
        .zero{background:#fef3c7;color:#d97706;font-weight:700;text-align:center;padding:10px;border-radius:8px;margin-top:12px}
        .footer{margin-top:30px;text-align:center;color:#888;font-size:.85em}</style></head><body>
        <h1>🏦 ठेव परतावा पावती</h1>
        <table>
        <tr><td>शेतकरी</td><td>${receiptData.farmer?.name || '-'} (कोड: ${receiptData.farmer?.code || '-'})</td></tr>
        <tr><td>परतावा तारीख</td><td>${receiptData.date}</td></tr>
        <tr><td>परतावा रक्कम</td><td>Rs.${fmt(receiptData.refundAmt)}</td></tr>
        <tr><td>व्याज / बोनस</td><td>Rs.${fmt(receiptData.interestAmt)}</td></tr>
        <tr class="total"><td>एकूण दिलेले</td><td>Rs.${fmt(receiptData.totalPayout)}</td></tr>
        <tr><td>परताव्यानंतर शिल्लक</td><td>Rs.${fmt(receiptData.balAfter)}</td></tr>
        ${receiptData.remarks ? `<tr><td>शेरा</td><td>${receiptData.remarks}</td></tr>` : ''}
        </table>
        ${parseFloat(receiptData.balAfter) === 0 ? '<p class="zero">&#x2705; संपूर्ण ठेव परत केली -- शिल्लक शून्य (Rs.0)</p>' : ''}
        <div class="footer">DudhSakha Dairy Management &bull; ${new Date().toLocaleDateString('mr-IN')}</div>
        <script>setTimeout(function(){window.print();},400);<\/script></body></html>`;
        w.document.write(html);
        w.document.close();
    };

    const S = STYLES;
    return (
        <div style={S.overlay}>
            <div style={{ ...S.modal, maxWidth: 520 }}>
                <div style={S.modalHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <ArrowUpCircle size={22} color="#d97706" />
                        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>ठेव परतावा द्या</h3>
                    </div>
                    <button onClick={onClose} style={S.closeBtn}><X size={18} /></button>
                </div>
                {done ? (
                    <div style={{ padding: 28, textAlign: 'center' }}>
                        <CheckCircle2 size={60} color="#10b981" style={{ marginBottom: 14 }} />
                        <h3 style={{ color: '#10b981', margin: '0 0 8px' }}>परतावा यशस्वीरित्या दिला!</h3>
                        <p style={{ color: '#64748b', marginBottom: 16 }}>
                            <strong>{receiptData?.farmer?.name}</strong> यांना{' '}
                            <strong>Rs.{fmt(receiptData?.totalPayout)}</strong> दिले.
                        </p>
                        {parseFloat(receiptData?.balAfter) === 0 && (
                            <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 16px', marginBottom: 16, color: '#92400e', fontWeight: 600 }}>
                                संपूर्ण ठेव परत केली — शिल्लक शून्य (Rs.0)
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                            <button onClick={handlePrint} style={{ ...S.btnPrimary, background: '#7c3aed' }}>
                                <Printer size={16} /> पावती छापा
                            </button>
                            <button onClick={onClose} style={S.btnSecondary}>बंद करा</button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} style={{ padding: 24 }}>
                        <div style={S.infoBox}>
                            <strong>{farmer?.name || '-'}</strong>&nbsp;|&nbsp;कोड: {farmer?.code || '-'}
                            <span style={{ float: 'right', color: '#10b981', fontWeight: 700 }}>
                                चालू शिल्लक: Rs.{fmt(currentBal)}
                            </span>
                        </div>
                        <label style={S.label}>तारीख कालावधी</label>
                        <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: 3 }}>पासून</div>
                                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={S.input} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: 3 }}>पर्यंत</div>
                                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={S.input} />
                            </div>
                        </div>
                        <div style={{ marginBottom: 16, padding: '8px 12px', background: '#eff6ff', borderRadius: 8, fontSize: '0.88rem', color: '#1d4ed8' }}>
                            {loadingRange ? 'मोजत आहे...' : depositedInRange !== null ? `निवडलेल्या कालावधीत जमा ठेव: Rs.${fmt(depositedInRange)}` : '—'}
                        </div>
                        <label style={S.label}>परतावा रक्कम (Rs.) *</label>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                            <input type="number" min="0" step="0.01" max={currentBal} value={refundAmount}
                                onChange={e => setRA(e.target.value)} placeholder="0.00"
                                style={{ ...S.input, flex: 1 }} required />
                            <button type="button" onClick={() => setRA(String(currentBal.toFixed(2)))}
                                style={{ ...S.btnSecondary, padding: '0 12px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                संपूर्ण Rs.{fmt(currentBal)}
                            </button>
                        </div>
                        <label style={S.label}>व्याज / बोनस (Rs.) [वैकल्पिक]</label>
                        <input type="number" min="0" step="0.01" value={interest}
                            onChange={e => setInterest(e.target.value)} placeholder="0.00"
                            style={{ ...S.input, marginBottom: 12 }} />
                        <label style={S.label}>शेरा [वैकल्पिक]</label>
                        <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)}
                            placeholder="उदा. दिवाळी ठेव परतावा" style={{ ...S.input, marginBottom: 16 }} />
                        {refundAmt > 0 && (
                            <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 16px', marginBottom: 16, border: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.88rem' }}>
                                    <span style={{ color: '#64748b' }}>परतावा रक्कम</span>
                                    <span>Rs.{fmt(refundAmt)}</span>
                                </div>
                                {interestAmt > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.88rem' }}>
                                        <span style={{ color: '#64748b' }}>व्याज / बोनस</span>
                                        <span style={{ color: '#7c3aed' }}>+ Rs.{fmt(interestAmt)}</span>
                                    </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid #e2e8f0', paddingTop: 8, marginTop: 4 }}>
                                    <span>एकूण देयरक्कम</span>
                                    <span style={{ color: '#10b981', fontSize: '1.05rem' }}>Rs.{fmt(totalPayout)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '0.88rem' }}>
                                    <span style={{ color: '#64748b' }}>परताव्यानंतर शिल्लक</span>
                                    <span style={{ color: balAfter === 0 ? '#d97706' : '#10b981', fontWeight: 600 }}>
                                        Rs.{fmt(balAfter)}{balAfter === 0 ? ' (शून्य)' : ''}
                                    </span>
                                </div>
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button type="submit" disabled={loading || refundAmt <= 0} style={S.btnPrimary}>
                                {loading ? 'प्रक्रिया सुरू...' : 'परतावा नक्की करा'}
                            </button>
                            <button type="button" onClick={onClose} style={S.btnSecondary}>रद्द करा</button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

// ─── PassbookModal ────────────────────────────────────────────────────────────
function PassbookModal({ account, farmers, user, onClose }) {
    const [txns, setTxns]         = useState([]);
    const [loading, setLoading]   = useState(true);
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate]     = useState('');
    const farmer = farmers.find(f => String(f.id) === String(account?.farmer_id));
    const { showConfirm, showAlert } = useAlert();

    const handleDeleteTransaction = async (id) => {
        const confirmed = await showConfirm('या व्यवहाराची नोंद कायमची काढायची का?', 'खात्री करा', 'काढून टाका');
        if (!confirmed) return;
        try {
            await window.api.deleteThevTransaction(id, user.dairy_id);
            showAlert('व्यवहार यशस्वीरित्या काढण्यात आला.', 'यशस्वी', 'success');
            load();
        } catch (err) {
            showAlert('व्यवहार काढताना त्रुटी आली.', 'त्रुटी', 'error');
        }
    };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await window.api.getFarmerThevLedger(
                account.farmer_id, user.dairy_id, fromDate || undefined, toDate || undefined
            );
            setTxns(data.filter(t => String(t.thev_account_id) === String(account.id)));
        } catch (e) { console.error(e); } finally { setLoading(false); }
    }, [account, user.dairy_id, fromDate, toDate]);

    useEffect(() => { load(); }, [load]);

    const handleRepairBalances = async () => {
        setLoading(true);
        try {
            // Reload the ledger — getFarmerThevLedger now computes balance_after
            // from collections, so just refreshing is sufficient.
            await load();
            alert('शिल्लक दुरुस्त झाली!');
        } catch(e) { alert('त्रुटी: ' + e.message); } finally { setLoading(false); }
    };

    const handlePrint = () => {
        const rows = txns.map(t => {
            const m = TXN_META[t.transaction_type] || TXN_META.deposit;
            const sign = t.transaction_type === 'refund' ? '-' : '+';
            const amtColor = t.transaction_type === 'refund' ? 'red' : 'green';
            return `<tr><td>${t.transaction_date}</td><td>${m.label}</td>
            <td style="color:${amtColor}">${sign}Rs.${fmt(t.amount)}</td>
            <td>${t.interest_amount > 0 ? 'Rs.' + fmt(t.interest_amount) : '-'}</td>
            <td>Rs.${fmt(t.balance_after)}</td><td>${t.remarks || ''}</td></tr>`;
        }).join('');
        const w = window.open('', '_blank');
        w.document.write(`<html><head><title>ठेव पासबुक</title>
        <style>body{font-family:Arial;padding:24px}table{width:100%;border-collapse:collapse;margin-top:16px}
        th,td{padding:8px;border:1px solid #ddd}th{background:#4f46e5;color:#fff}h1{color:#4f46e5}</style></head>
        <body><h1>ठेव पासबुक / खातेवही</h1>
        <p><strong>शेतकरी:</strong> ${farmer?.name} (${farmer?.code}) | <strong>चालू शिल्लक:</strong> Rs.${fmt(account.current_balance)}</p>
        <table><thead><tr><th>तारीख</th><th>प्रकार</th><th>रक्कम</th><th>व्याज</th><th>शिल्लक</th><th>शेरा</th></tr></thead>
        <tbody>${rows}</tbody></table>
        <script>setTimeout(function(){window.print();},400);<\/script></body></html>`);
        w.document.close();
    };

    const S = STYLES;
    return (
        <div style={S.overlay}>
            <div style={{ ...S.modal, maxWidth: 820 }}>
                <div style={S.modalHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <FileText size={22} color="#4f46e5" />
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.05rem' }}>ठेव पासबुक / खातेवही</h3>
                            <div style={{ fontSize: '0.82rem', color: '#64748b' }}>{farmer?.name} — {account.thev_name}</div>
                        </div>
                    </div>
                    <button onClick={onClose} style={S.closeBtn}><X size={18} /></button>
                </div>
                <div style={{ padding: '16px 24px 8px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
                        {[
                            { l: 'आरंभिक शिल्लक', v: account.opening_balance || 0, c: '#2563eb' },
                            { l: 'एकूण जमा',       v: account.total_deposited || 0, c: '#10b981' },
                            { l: 'एकूण परतावा',    v: account.total_refunded || 0,  c: '#d97706' },
                            { l: 'चालू शिल्लक',    v: account.current_balance || 0, c: parseFloat(account.current_balance) === 0 ? '#ef4444' : '#7c3aed' },
                        ].map(({ l, v, c }) => (
                            <div key={l} style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px', border: '1px solid #e2e8f0' }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{l}</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: c }}>Rs.{fmt(v)}</div>
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div>
                            <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: 3 }}>पासून</div>
                            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                                style={{ ...S.input, padding: '6px 10px', width: 160 }} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: 3 }}>पर्यंत</div>
                            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                                style={{ ...S.input, padding: '6px 10px', width: 160 }} />
                        </div>
                        <button onClick={handlePrint} style={{ ...S.btnSecondary, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Printer size={15} /> पासबुक छापा
                        </button>
                    </div>
                </div>
                <div style={{ padding: '0 24px 24px', overflowY: 'auto', maxHeight: 380 }}>
                    {loading ? <Loader /> : txns.length === 0 ? (
                        <div style={S.emptyState}>कोणतेही व्यवहार आढळले नाहीत.</div>
                    ) : (
                        <table style={S.table}>
                            <thead>
                                <tr>{['तारीख', 'प्रकार', 'रक्कम', 'व्याज', 'शिल्लक', 'शेरा', 'क्रिया'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
                            </thead>
                            <tbody>
                                {(() => {
                                    // Compute running balance in-place (fixes display when balance_after = 0)
                                    let runBal = 0;
                                    const sorted = [...txns].sort((a,b) =>
                                        a.transaction_date.localeCompare(b.transaction_date) ||
                                        String(a.id).localeCompare(String(b.id))
                                    );
                                    const balMap = {};
                                    sorted.forEach(t => {
                                        const amt = parseFloat(t.amount || 0);
                                        if (['deposit','opening','interest'].includes(t.transaction_type)) runBal += amt;
                                        else if (t.transaction_type === 'refund') runBal -= amt;
                                        runBal = Math.max(0, runBal);
                                        balMap[String(t.id)] = parseFloat(runBal.toFixed(2));
                                    });
                                    return txns.map(tx => {
                                        const m = TXN_META[tx.transaction_type] || TXN_META.deposit;
                                        const displayBal = parseFloat(tx.balance_after) > 0 ? tx.balance_after : (balMap[String(tx.id)] ?? 0);
                                        return (
                                            <tr key={tx.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={S.td}>{tx.transaction_date}</td>
                                                <td style={S.td}>
                                                    <span style={{ background: m.bg, color: m.text, padding: '3px 8px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 600 }}>
                                                        {m.label}
                                                    </span>
                                                </td>
                                                <td style={{ ...S.td, fontWeight: 600, color: tx.transaction_type === 'refund' ? '#ef4444' : '#10b981' }}>
                                                    {tx.transaction_type === 'refund' ? '-' : '+'}Rs.{fmt(tx.amount)}
                                                </td>
                                                <td style={S.td}>{tx.interest_amount > 0 ? `Rs.${fmt(tx.interest_amount)}` : '—'}</td>
                                                <td style={{ ...S.td, fontWeight: 600, color: displayBal === 0 ? '#ef4444' : '#1e293b' }}>Rs.{fmt(displayBal)}</td>
                                                <td style={{ ...S.td, color: '#64748b', fontSize: '0.85rem' }}>
                                                    {tx.remarks || '—'}
                                                    {tx.transaction_type === 'deposit' && (() => {
                                                        let displayRate = null;
                                                        // 1. Parse new-format remarks: "5 लिटर × ₹5/L = ₹25.00 ..."
                                                        const newFmt = tx.remarks && tx.remarks.match(/×\s*₹([\d.]+)\/L/);
                                                        if (newFmt) {
                                                            displayRate = `₹${parseFloat(newFmt[1])}/लिटर`;
                                                        } else if (account.thev_type === 'per_liter') {
                                                            // 2. Compute from amount ÷ quantity (old-format: "5 लिटर दुधावर ...")
                                                            const qtyMatch = tx.remarks && tx.remarks.match(/^([\d.]+)\s*लिटर/);
                                                            if (qtyMatch) {
                                                                const qty = parseFloat(qtyMatch[1]);
                                                                const amt = parseFloat(tx.amount);
                                                                if (qty > 0 && amt > 0) {
                                                                    const r = amt / qty;
                                                                    displayRate = `₹${Number.isInteger(r) ? r : r.toFixed(2)}/लिटर`;
                                                                }
                                                            }
                                                            // 3. Fallback to current account rate
                                                            if (!displayRate && account.rate) displayRate = `₹${account.rate}/लिटर`;
                                                        } else if (account.thev_type === 'percentage' && account.rate) {
                                                            displayRate = `${account.rate}%`;
                                                        } else if (account.rate) {
                                                            displayRate = `₹${account.rate} (निश्चित)`;
                                                        }
                                                        return displayRate ? (
                                                            <span style={{ marginLeft: 6, background: '#eff6ff', color: '#2563eb', borderRadius: 10, padding: '1px 7px', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                                {displayRate}
                                                            </span>
                                                        ) : null;
                                                    })()}
                                                </td>
                                                <td style={{ ...S.td, textAlign: 'center' }}>
                                                    {/* Hide delete for computed deposit rows — they're derived from collections, not stored in DB */}
                                                    {!tx._synthetic && (
                                                        <button onClick={() => handleDeleteTransaction(tx.id)} style={{ ...S.iconBtn, color: '#ef4444' }} title='काढून टाका'><Trash2 size={15} /></button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    });
                                })()}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ThevManagement({ user }) {
    const { showAlert, showConfirm, AlertComponent } = useAlert();
    const [activeTab, setActiveTab]     = useState('accounts');
    const [loading, setLoading]         = useState(false);
    const [masters, setMasters]         = useState([]);
    const [accounts, setAccounts]       = useState([]);
    const [farmers, setFarmers]         = useState([]);
    const [refundHistory, setRefHist]   = useState([]);
    const [selectedFarmer, setSelFarmer]= useState(null);
    const [farmerTxns, setFarmerTxns]   = useState([]);
    const [loadingTxns, setLoadingTxns] = useState(false);
    const [searchAccounts, setSA]       = useState('');
    const [histFromDate, setHFD]        = useState(`${new Date().getFullYear() - 2}-01-01`);
    const [histToDate, setHTD]          = useState(todayStr());
    const [loadingHistory, setLH]       = useState(false);
    const [showMasterModal, setSMM]     = useState(false);
    const [showRateHistory, setShowRH]  = useState(null); // master object
    const [showAssignModal, setSAM]     = useState(false);
    const [refundTarget, setRT]         = useState(null);
    const [passbookTarget, setPT]       = useState(null);
    const [editMaster, setEM]           = useState(null);
    const [farmerSearch, setFS]         = useState('');
    // ── Refund history enhancements ───────────────────────────
    const [histPeriodFilter, setHistPeriodFilter]     = useState(''); // selected period option key
    const [histThevNameFilter, setHistThevNameFilter] = useState(''); // filter by actual thev scheme name
    const [customGreeting, setCustomGreeting]         = useState(''); // greeting text for chits
    const [chitLoading, setChitLoading]               = useState(false);
    const [summaryLoading, setSummaryLoading]         = useState(false);
    // ── Transactions tab filters ──────────────────────────────
    const [selectedThevAccount, setSelThevAcc] = useState(null); // { id, thev_name, rate, thev_type, current_balance }
    const [txnFromDate, setTxnFrom]            = useState('');
    const [txnToDate, setTxnTo]                = useState('');

    const [masterForm, setMasterForm] = useState({
        name: '', deduction_type: 'per_liter', default_rate: '', is_active: true,
        rate_change_from_date: '' // optional: recalculate all Thev from this date with new rate
    });
    const [assignForm, setAssignForm] = useState({
        farmer_id: '', thev_master_id: '', rate: '',
        opening_balance: '0', start_date: todayStr(), status: 'active'
    });

    const loadAll = useCallback(async () => {
        if (!user?.dairy_id) return;
        setLoading(true);
        try {
            const [m, a, f] = await Promise.allSettled([
                window.api.getThevMasters(user.dairy_id),
                window.api.getFarmerThevAccounts(user.dairy_id),
                window.api.getFarmers(user.dairy_id),
            ]);
            if (m.status === 'fulfilled') {
                // Merge localStorage show_balance prefs (source of truth for this toggle)
                setMasters(applyShowBalPrefs(m.value, user.dairy_id));
            } else console.error('[Thev] getThevMasters error:', m.reason);
            if (a.status === 'fulfilled') setAccounts(a.value);
            else console.error('[Thev] getFarmerThevAccounts error:', a.reason);
            if (f.status === 'fulfilled') setFarmers(f.value);
            else console.error('[Thev] getFarmers error:', f.reason);
        } catch (e) { console.error('[Thev] loadAll error:', e); } finally { setLoading(false); }

        // ── Auto-repair stale balances in background ──────────────────────────
        // Runs after data is shown so it never blocks the UI.
        // If any account's current_balance was out of sync, reload the list.
        window.api.repairAllThevBalances(user.dairy_id)
            .then(result => {
                if (result.repaired > 0) {
                    console.log(`[Thev] Auto-repaired ${result.repaired} stale balance(s) — reloading accounts`);
                    // Reload just the accounts list (not the full page)
                    window.api.getFarmerThevAccounts(user.dairy_id)
                        .then(fresh => setAccounts(fresh || []))
                        .catch(() => {});
                }
            })
            .catch(e => console.warn('[Thev] Balance auto-repair skipped:', e));
        // ─────────────────────────────────────────────────────────────────────
    }, [user?.dairy_id]);

    // ── Mount effect: load all data + repair balances on open ──────────────
    // With compute-from-collections architecture, repairAllThevBalances derives
    // the correct balance directly from the collections table — always accurate,
    // no race conditions with background writes.
    useEffect(() => {
        if (!user?.dairy_id) return;
        loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.dairy_id]);
    // ───────────────────────────────────────────────────────────────────────────


    // ── Parse unique date-period options from refund remarks ───────────────────
    const computePeriodOptions = useCallback((history) => {
        const PATTERN = /\(([\d-]+) ते ([\d-]+)\)/;
        const seen = new Map();
        history.forEach(r => {
            const m = (r.remarks || '').match(PATTERN);
            if (m) {
                const key = `${m[1]}__${m[2]}`;
                if (!seen.has(key)) seen.set(key, { from: m[1], to: m[2], label: `ठेव परतावा (${m[1]} ते ${m[2]})` });
            }
        });
        // Sort by from-date descending (newest period first)
        return [...seen.values()].sort((a, b) => b.from.localeCompare(a.from));
    }, []);

    const periodOptions = computePeriodOptions(refundHistory);

    // ── Fetch milk litres for a set of farmerIds over a date range ─────────────
    const fetchMilkLitresMap = useCallback(async (farmerIds, fromDate, toDate) => {
        // Calls getFarmerThevLedger per farmer and sums milk quantity from collections.
        // IMPORTANT: Each collection creates one synthetic deposit row PER thev account.
        // We must deduplicate by reference_collection_id so litres are not counted multiple times.
        // Returns { [farmerId]: totalLitres }
        if (!farmerIds.length) return {};
        const map = {};
        await Promise.all(farmerIds.map(async (fid) => {
            try {
                const ledger = await window.api.getFarmerThevLedger(fid, user.dairy_id, fromDate, toDate);
                // Collect unique collections — keyed by reference_collection_id
                const seenCollections = new Map(); // collectionId → quantity
                ledger.forEach(tx => {
                    if (tx.transaction_type === 'deposit' && tx._synthetic) {
                        const colId = tx.reference_collection_id;
                        if (colId && !seenCollections.has(colId)) {
                            // Parse quantity from remarks: "X लिटर × ₹Y/L = ..."
                            const m = (tx.remarks || '').match(/^([\d.]+)\s*लिटर/);
                            if (m) seenCollections.set(colId, parseFloat(m[1]) || 0);
                        }
                    }
                });
                const litres = [...seenCollections.values()].reduce((s, v) => s + v, 0);
                map[String(fid)] = parseFloat(litres.toFixed(2));
            } catch (e) {
                map[String(fid)] = 0;
            }
        }));
        return map;
    }, [user?.dairy_id]);

    const loadRefundHistory = useCallback(async () => {
        if (!user?.dairy_id) return;
        setLH(true);
        try {
            const data = await window.api.getThevRefundHistory(user.dairy_id, histFromDate, histToDate, null);
            setRefHist(data);
            // NOTE: do NOT reset histPeriodFilter here — dropdown is a client-side filter
        } catch (e) { console.error(e); } finally { setLH(false); }
    }, [user?.dairy_id, histFromDate, histToDate]);

    useEffect(() => { if (activeTab === 'refund') loadRefundHistory(); }, [activeTab, loadRefundHistory]);

    const loadFarmerTxns = useCallback(async (farmerId) => {
        if (!farmerId || !user?.dairy_id) return;
        setLoadingTxns(true);
        try { setFarmerTxns(await window.api.getFarmerThevLedger(farmerId, user.dairy_id)); }
        catch (e) { console.error(e); } finally { setLoadingTxns(false); }
    }, [user?.dairy_id]);

    useEffect(() => {
        if (selectedFarmer) {
            loadFarmerTxns(selectedFarmer.id);
            // Reset account filter when farmer changes
            setSelThevAcc(null);
        }
    }, [selectedFarmer, loadFarmerTxns]);

    const totalBalance  = accounts.reduce((s, a) => s + parseFloat(a.current_balance || 0), 0);
    const totalRefunded = accounts.reduce((s, a) => s + parseFloat(a.total_refunded || 0), 0);

    // ── Enrich each record with thev_name / thev_type from local accounts state ────
    const enrichedRefundHistory = refundHistory.map(r => {
        const acc = accounts.find(a => String(a.id) === String(r.thev_account_id));
        return { ...r, thev_name: acc?.thev_name || '', thev_type: acc?.thev_type || '' };
    });

    // ── Apply period + thev-name filters ────────────────────────────────────────
    const filteredRefundHistory = enrichedRefundHistory.filter(r => {
        if (histPeriodFilter   && !(r.remarks || '').includes(histPeriodFilter)) return false;
        if (histThevNameFilter && r.thev_name !== histThevNameFilter)            return false;
        return true;
    });

    // ── Get period label for display / PDF header ────────────────────────────
    const selectedPeriodObj = histPeriodFilter
        ? periodOptions.find(p => (p.from + ' ते ' + p.to) === histPeriodFilter)
        : null;
    const selectedPeriodLabel = selectedPeriodObj
        ? selectedPeriodObj.label
        : `${histFromDate} ते ${histToDate}`;

    // ── Condense filtered refunds per farmer (for PDF summary) ───────────────
    const farmerRefundSummary = Object.values(
        filteredRefundHistory.reduce((acc, r) => {
            const fid = String(r.farmer_id);
            if (!acc[fid]) acc[fid] = {
                farmer_id: r.farmer_id,
                farmer_name: r.farmer_name,
                farmer_code: r.farmer_code,
                thev_name: r.thev_name,
                thev_type: r.thev_type,
                total_refund: 0,
                total_interest: 0,
                total_paid: 0,
                refund_date: r.transaction_date,
                remarks: r.remarks,
            };
            acc[fid].total_refund    += parseFloat(r.amount || 0);
            acc[fid].total_interest  += parseFloat(r.interest_amount || 0);
            acc[fid].total_paid      += parseFloat(r.amount || 0) + parseFloat(r.interest_amount || 0);
            if (r.transaction_date > acc[fid].refund_date) acc[fid].refund_date = r.transaction_date;
            if (r.thev_name) acc[fid].thev_name = r.thev_name; // keep latest non-empty
            return acc;
        }, {})
    ).sort((a, b) => a.farmer_name.localeCompare(b.farmer_name, 'mr'));

    const hasInterest = farmerRefundSummary.some(s => s.total_interest > 0);

    // ── Helper: print HTML via Electron IPC (full Unicode / Devanagari support) ──
    const printHtml = async (html) => {
        console.log('[printHtml] called, html length:', html?.length);
        try {
            if (window.electron && window.electron.invoke) {
                console.log('[printHtml] calling electron invoke print-html...');
                try {
                    const result = await window.electron.invoke('print-html', html);
                    console.log('[printHtml] result:', result);
                    if (result && result.success === false) throw new Error(result.error || 'Print failed');
                    return; // success via IPC
                } catch (ipcErr) {
                    console.warn('[printHtml] IPC failed, using blob fallback:', ipcErr.message);
                }
            }
            // Fallback: open Blob URL in new popup (auto-print via inline script in HTML)
            console.log('[printHtml] using blob/window.open fallback');
            const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
            const url  = URL.createObjectURL(blob);
            const w    = window.open(url, '_blank');
            if (w) {
                w.onload = () => URL.revokeObjectURL(url);
            } else {
                // Popup blocked — download as HTML file instead
                const a = document.createElement('a');
                a.href = url;
                a.download = 'thev_report.html';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 5000);
            }
        } catch (e) {
            console.error('[printHtml] failed:', e);
            alert('PDF print error: ' + e.message);
        }
    };

    // -- Print Admin Summary PDF --
    const printAdminSummaryPDF = async () => {
        console.log('[printAdminSummaryPDF] CLICKED! farmerRefundSummary:', farmerRefundSummary?.length);
        if (farmerRefundSummary.length === 0) return;
        setSummaryLoading(true);
        try {
        // ── Fetch milk litres (same as chits) ────────────────────────────────
        const farmerIds = farmerRefundSummary.map(s => s.farmer_id);
        const milkFrom  = selectedPeriodObj?.from || histFromDate;
        const milkTo    = selectedPeriodObj?.to   || histToDate;
        const milkMap   = await fetchMilkLitresMap(farmerIds, milkFrom, milkTo);

        const grandRefund   = farmerRefundSummary.reduce((s, r) => s + r.total_refund, 0);
        const grandInterest = farmerRefundSummary.reduce((s, r) => s + r.total_interest, 0);
        const grandPaid     = farmerRefundSummary.reduce((s, r) => s + r.total_paid, 0);
        const grandLitres   = Object.values(milkMap).reduce((s, v) => s + v, 0);

        const interestTh = hasInterest
            ? `<th style="padding:9px 12px;border:1px solid #e2e8f0;background:#ede9fe;color:#5b21b6">व्याज / बोनस</th>`
            : '';
        const interestGrandTd = hasInterest
            ? `<td style="padding:9px 12px;border:1px solid #e2e8f0;background:#f5f3ff;color:#5b21b6;font-weight:700">Rs.${fmt(grandInterest)}</td>`
            : '';

        const rows = farmerRefundSummary.map((s, idx) => {
            const litres = milkMap[String(s.farmer_id)] || 0;
            const interestTd = hasInterest
                ? `<td style="padding:9px 12px;border:1px solid #e2e8f0;color:#7c3aed">Rs.${fmt(s.total_interest)}</td>`
                : '';
            return `<tr style="background:${idx % 2 === 0 ? '#fff' : '#f8fafc'}">
                <td style="padding:9px 12px;border:1px solid #e2e8f0;text-align:center;color:#64748b">${idx + 1}</td>
                <td style="padding:9px 12px;border:1px solid #e2e8f0;font-weight:600">${s.farmer_name}</td>
                <td style="padding:9px 12px;border:1px solid #e2e8f0;color:#64748b">#${s.farmer_code}</td>
                <td style="padding:9px 12px;border:1px solid #e2e8f0;color:#4f46e5;font-weight:600">${s.thev_name || '—'}</td>
                <td style="padding:9px 12px;border:1px solid #e2e8f0;color:#0369a1;font-weight:600;text-align:right">${litres > 0 ? litres + ' L' : '—'}</td>
                <td style="padding:9px 12px;border:1px solid #e2e8f0;color:#d97706;font-weight:700">Rs.${fmt(s.total_refund)}</td>
                ${interestTd}
                <td style="padding:9px 12px;border:1px solid #e2e8f0;color:#15803d;font-weight:800;font-size:1.05em">Rs.${fmt(s.total_paid)}</td>
                <td style="padding:9px 12px;border:1px solid #e2e8f0;text-align:center">
                    <div style="width:110px;height:36px;border-bottom:1.5px solid #94a3b8;margin:0 auto"></div>
                </td>
            </tr>`;
        }).join('');

        const html = `<!DOCTYPE html><html lang="mr"><head>
        <meta charset="utf-8">
        <title>ठेव परतावा सारांश</title>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700;800&family=Noto+Sans+Devanagari:wght@400;600;700;800&display=swap" rel="stylesheet">
        <style>
            *{box-sizing:border-box;margin:0;padding:0}
            body{font-family:'Noto Sans Devanagari','Noto Sans',Arial,sans-serif;padding:24px 28px;color:#1e293b;font-size:13px}
            h1{text-align:center;color:#4f46e5;font-size:1.4rem;font-weight:800;margin-bottom:4px}
            .subtitle{text-align:center;color:#64748b;font-size:.85rem;margin-bottom:20px}
            table{width:100%;border-collapse:collapse;font-size:.88rem}
            th{padding:10px 12px;border:1px solid #e2e8f0;background:#4f46e5;color:#fff;font-weight:700;text-align:left}
            tfoot td{font-weight:700;font-size:.92rem}
            .footer{margin-top:28px;text-align:center;color:#94a3b8;font-size:.72rem;border-top:1px solid #f1f5f9;padding-top:10px}
            @media print{body{padding:12px}@page{size:A4 landscape;margin:12mm}}
        </style></head><body>
        <h1>ठेव परतावा सारांश / Thev Refund Summary</h1>
        <div class="subtitle">कालावधी: <b>${selectedPeriodLabel}</b> &nbsp;|&nbsp; एकूण शेतकरी: <b>${farmerRefundSummary.length}</b> &nbsp;|&nbsp; मुद्रण: ${new Date().toLocaleDateString('mr-IN')}</div>
        <table>
            <thead><tr>
                <th style="width:36px;text-align:center">#</th>
                <th>शेतकरी नाव</th>
                <th style="width:64px">कोड</th>
                <th>ठेव योजना</th>
                <th style="width:90px;text-align:right">एकूण दूध</th>
                <th style="width:110px">परतावा रक्कम</th>
                ${interestTh}
                <th style="width:110px">एकूण दिलेले</th>
                <th style="width:130px;text-align:center">शेतकरी सही</th>
            </tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr>
                <td colspan="4" style="padding:10px 12px;border:1px solid #e2e8f0;background:#f1f5f9;text-align:right">एकूण ▶</td>
                <td style="padding:10px 12px;border:1px solid #e2e8f0;background:#e0f2fe;color:#0369a1;text-align:right">${grandLitres > 0 ? grandLitres.toFixed(2) + ' L' : '—'}</td>
                <td style="padding:10px 12px;border:1px solid #e2e8f0;background:#fef3c7;color:#d97706">Rs.${fmt(grandRefund)}</td>
                ${interestGrandTd}
                <td style="padding:10px 12px;border:1px solid #e2e8f0;background:#dcfce7;color:#15803d">Rs.${fmt(grandPaid)}</td>
                <td style="padding:10px 12px;border:1px solid #e2e8f0;background:#f1f5f9"></td>
            </tr></tfoot>
        </table>
        <div class="footer">DudhSakha Dairy Management • ठेव परतावा नोंद</div>
        </body></html>`;

        await printHtml(html);
        } catch(e) {
            console.error('summary print error', e);
        } finally {
            setSummaryLoading(false);
        }
    };

    // -- Print Farmer Chits PDF --
    const printFarmerChitsPDF = async () => {
        console.log('[printFarmerChitsPDF] CLICKED! farmerRefundSummary:', farmerRefundSummary?.length);
        if (farmerRefundSummary.length === 0) return;
        setChitLoading(true);
        try {
            const farmerIds = farmerRefundSummary.map(s => s.farmer_id);
            const milkFrom = selectedPeriodObj?.from || histFromDate;
            const milkTo   = selectedPeriodObj?.to   || histToDate;
            const milkMap  = await fetchMilkLitresMap(farmerIds, milkFrom, milkTo);
            const greeting = customGreeting.trim();

            const chits = farmerRefundSummary.map((s) => {
                const litres = milkMap[String(s.farmer_id)] || 0;
                const interestRow = hasInterest
                    ? `<tr><td class="lbl">व्याज / बोनस</td><td class="val" style="color:#7c3aed">Rs.${fmt(s.total_interest)}</td></tr>`
                    : '';
                return `<div class="chit">
                    <div class="chit-hdr">
                        <span style="font-weight:800;font-size:.9rem">DudhSakha</span>
                        <span style="font-size:.72rem;opacity:.85">ठेव परतावा पावती</span>
                    </div>
                    ${greeting ? `<div class="greeting">${greeting}</div>` : ''}
                    <div class="farmer-row">
                        <span class="fname">${s.farmer_name}</span>
                        <span class="fcode">#${s.farmer_code}</span>
                    </div>
                    ${s.thev_name ? `<div class="thev-tag">📋 ${s.thev_name}</div>` : ''}
                    <div class="period">कालावधी: <b>${selectedPeriodLabel}</b></div>
                    <table class="dt">
                        <tr><td class="lbl">एकूण दूध</td><td class="val" style="color:#0369a1">${litres > 0 ? litres + ' लिटर' : '—'}</td></tr>
                        <tr><td class="lbl">परतावा रक्कम</td><td class="val" style="color:#d97706">Rs.${fmt(s.total_refund)}</td></tr>
                        ${interestRow}
                        <tr class="total-row"><td style="font-weight:700;padding:5px 4px">एकूण दिलेले</td><td style="font-weight:800;color:#15803d;padding:5px 4px;text-align:right">Rs.${fmt(s.total_paid)}</td></tr>
                    </table>
                    <div class="chit-date">तारीख: ${new Date().toLocaleDateString('mr-IN')}</div>
                </div>`;
            }).join('');

            const html = `<!DOCTYPE html><html lang="mr"><head>
            <meta charset="utf-8">
            <title>ठेव परतावा चिट्स</title>
            <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700;800&family=Noto+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
            <style>
                *{box-sizing:border-box;margin:0;padding:0}
                body{font-family:'Noto Sans Devanagari','Noto Sans',Arial,sans-serif;padding:10px;background:#fff}
                .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
                .chit{border:1.5px dashed #94a3b8;border-radius:10px;padding:0 0 8px;overflow:hidden;break-inside:avoid;page-break-inside:avoid}
                .chit-hdr{background:#4f46e5;color:#fff;display:flex;justify-content:space-between;align-items:center;padding:7px 12px;margin-bottom:8px}
                .greeting{background:linear-gradient(90deg,#fef3c7,#fde68a);color:#92400e;font-weight:700;font-size:.82rem;padding:4px 12px;margin:0 8px 8px;border-radius:5px;text-align:center}
                .farmer-row{display:flex;justify-content:space-between;align-items:baseline;padding:0 12px;margin-bottom:3px}
                .fname{font-weight:800;font-size:.92rem;color:#1e293b}
                .fcode{font-size:.73rem;color:#64748b;background:#f1f5f9;padding:1px 6px;border-radius:6px}
                .thev-tag{font-size:.68rem;color:#4f46e5;font-weight:600;padding:1px 12px 4px;opacity:.9}
                .period{font-size:.68rem;color:#64748b;padding:0 12px;margin-bottom:6px}
                .dt{width:calc(100% - 24px);margin:0 12px;border-collapse:collapse;font-size:.82rem}
                .lbl{padding:3px 4px;color:#64748b}
                .val{padding:3px 4px;text-align:right;font-weight:600}
                .total-row{border-top:1px solid #e2e8f0}
                .chit-date{font-size:.65rem;color:#94a3b8;text-align:right;padding:5px 12px 0}
                @page{size:A4 landscape;margin:10mm}
                @media print{body{padding:0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}}
            </style></head><body>
            <div class="grid">${chits}</div>
            </body></html>`;

            await printHtml(html);
        } catch(e) {
            console.error('chit print error', e);
        } finally {
            setChitLoading(false);
        }
    };

    const activeSchemes = masters.filter(m => m.is_active).length;


    const handleToggleShowBalance = (master) => {
        const newVal = master.show_balance_in_bill !== false ? false : true;
        // Save to localStorage — no DB call needed, this is a local display preference
        setShowBalPref(user.dairy_id, master.id, newVal);
        // Update UI state immediately
        setMasters(prev => prev.map(m => m.id === master.id ? { ...m, show_balance_in_bill: newVal } : m));
    };

    const handleMasterSave = async (e) => {
        e.preventDefault();
        try {
            const { rate_change_from_date, ...formDataToSave } = masterForm;
            const isEditing = !!editMaster?.id;
            const oldRate = editMaster?.default_rate;
            const newRate = parseFloat(masterForm.default_rate);
            const rateChanged = isEditing && parseFloat(oldRate) !== newRate;

            await window.api.saveThevMaster({ ...formDataToSave, id: editMaster?.id, dairy_id: user.dairy_id });

            // If rate changed AND user specified a from-date, recalculate all Thev deposits from that date
            if (isEditing && rateChanged && rate_change_from_date) {
                showAlert(
                    `दर ${oldRate} → ${newRate} बदलला. ${rate_change_from_date} पासूनच्या सर्व नोंदी पुन्हा मोजत आहे...`,
                    'माहिती', 'info'
                );
                const result = await window.api.recalcThevFromDate({
                    dairyId: user.dairy_id,
                    masterId: editMaster.id,
                    fromDate: rate_change_from_date,
                    newRate,
                    deductionType: masterForm.deduction_type
                });
                // Log this rate change to history
                appendRateHistory(user.dairy_id, editMaster.id, {
                    oldRate: parseFloat(oldRate),
                    newRate,
                    appliedFrom: rate_change_from_date,
                    affectedAccounts: result?.updated || 0,
                });
                showAlert(
                    `${rate_change_from_date} पासूनच्या सर्व ठेव नोंदी नव्या दराने (₹${newRate}) अपडेट झाल्या!`,
                    'यशस्वी', 'success'
                );
            }

            setSMM(false); setEM(null);
            setMasterForm({ name: '', deduction_type: 'per_liter', default_rate: '', is_active: true, rate_change_from_date: '' });
            loadAll();
        } catch (err) { showAlert('त्रुटी: ' + err.message, 'त्रुटी', 'error'); }
    };

    const handleDeleteTransaction = async (id) => {
        const confirmed = await showConfirm('या व्यवहाराची नोंद कायमची काढायची का?', 'खात्री करा', 'काढून टाका');
        if (!confirmed) return;
        try {
            await window.api.deleteThevTransaction(id, user.dairy_id);
            showAlert('व्यवहार यशस्वीरित्या काढण्यात आला.', 'यशस्वी', 'success');
            loadAll();
            if (selectedFarmer) {
                const updatedTxns = await window.api.getFarmerThevLedger(selectedFarmer.id, user.dairy_id);
                setFarmerTxns(updatedTxns);
            }
        } catch (err) {
            showAlert('व्यवहार काढताना त्रुटी आली.', 'त्रुटी', 'error');
        }
    };

    const handleMasterDelete = async (id) => {
        if (!await showConfirm('ही ठेव योजना हटवायची?', 'नक्की करा', 'होय', 'नाही')) return;
        try { await window.api.deleteThevMaster(id, user.dairy_id); loadAll(); }
        catch (err) { showAlert('त्रुटी: ' + err.message, 'त्रुटी', 'error'); }
    };

    const handleAssignSave = async (e) => {
        e.preventDefault();
        if (!assignForm.farmer_id || !assignForm.thev_master_id) {
            showAlert('शेतकरी आणि योजना निवडणे आवश्यक आहे.', 'त्रुटी', 'error'); return;
        }
        try {
            const master = masters.find(m => String(m.id) === String(assignForm.thev_master_id));
            const obAmt = parseFloat(assignForm.opening_balance) || 0;
            await window.api.assignFarmerThev({
                ...assignForm, dairy_id: user.dairy_id,
                rate: parseFloat(assignForm.rate) || parseFloat(master?.default_rate) || 0,
                deduction_type: master?.deduction_type || 'per_liter',
                opening_balance: obAmt, current_balance: obAmt, total_deposited: obAmt, total_refunded: 0,
            });
            setSAM(false);
            setAssignForm({ farmer_id: '', thev_master_id: '', rate: '', opening_balance: '0', start_date: todayStr(), status: 'active' });
            loadAll();
        } catch (err) { showAlert('त्रुटी: ' + err.message, 'त्रुटी', 'error'); }
    };


    const handleDeleteAccount = async (id) => {
        if (!await showConfirm('हे ठेव खाते हटवायचे?', 'नक्की करा', 'होय', 'रद्द करा')) return;
        try { await window.api.deleteFarmerThevAccount(id, user.dairy_id); loadAll(); }
        catch (err) { showAlert('त्रुटी: ' + err.message, 'त्रुटी', 'error'); }
    };

    const handleRebackfill = async (acc) => {
        const confirmed = await showConfirm(
            `"${acc.thev_name}" खात्यातील सर्व जुने व्यवहार हटवून संकलनाच्या आधारे पुन्हा तयार केले जातील.\n\nपुढे जायचे का?`,
            'व्यवहार दुरुस्त करा', 'होय, दुरुस्त करा', 'रद्द करा'
        );
        if (!confirmed) return;
        setLoading(true);
        try {
            const result = await window.api.rebackfillThevAccount({
                dairyId:       user.dairy_id,
                accountId:     acc.id,
                farmerId:      acc.farmer_id,
                rate:          acc.rate,
                deductionType: acc.thev_type,
                startDate:     acc.start_date,
            });
            showAlert(
                `व्यवहार दुरुस्त झाले! एकूण ${result.inserted} व्यवहार जोडले. नवीन शिल्लक: Rs.${parseFloat(result.currentBalance).toFixed(2)}`,
                'यशस्वी', 'success'
            );
            loadAll();
            // If this farmer is currently selected in transactions tab, refresh their txns
            if (selectedFarmer && String(selectedFarmer.id) === String(acc.farmer_id)) {
                const updatedTxns = await window.api.getFarmerThevLedger(selectedFarmer.id, user.dairy_id);
                setFarmerTxns(updatedTxns);
            }
        } catch (err) {
            showAlert('त्रुटी: ' + err.message, 'त्रुटी', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleStatus = async (acc) => {
        try {
            await window.api.updateFarmerThevAccount(acc.id, { status: acc.status === 'active' ? 'stopped' : 'active' }, user.dairy_id);
            loadAll();
        } catch (err) { showAlert('त्रुटी: ' + err.message, 'त्रुटी', 'error'); }
    };

    const filteredAccounts = accounts.filter(a => {
        const q = searchAccounts.toLowerCase();
        return !q || (a.farmer_name || '').toLowerCase().includes(q) || String(a.farmer_code || '').includes(q);
    });

    const S = STYLES;
    const TABS = [
        { key: 'accounts',     label: 'शेतकरी खाती व शिल्लक', icon: <Users size={15} /> },
        { key: 'masters',      label: 'ठेव योजना',             icon: <PiggyBank size={15} /> },
        { key: 'transactions', label: 'व्यवहार व खातेवही',     icon: <FileText size={15} /> },
        { key: 'refund',       label: 'परतावा व इतिहास',       icon: <ArrowUpCircle size={15} /> },
    ];

    if (loading) return <Loader />;

    return (
        <div style={S.page}>
            <AlertComponent />

            {/* Header */}
            <div style={S.pageHeader}>
                <div>
                    <h1 style={S.pageTitle}><PiggyBank size={26} /> ठेव व्यवस्थापन</h1>
                    <p style={S.pageSubtitle}>शेतकऱ्यांची बचत ठेव जमा करा, पाहा आणि परत द्या</p>
                </div>
                <button onClick={loadAll} style={S.btnRefresh}><RefreshCw size={16} /></button>
            </div>

            {/* Stats */}
            <div style={S.statsGrid}>
                {[
                    { label: 'एकूण खाती',         val: accounts.length,            color: '#4f46e5', icon: <Users size={20} /> },
                    { label: 'एकूण जमा शिल्लक',   val: `Rs.${fmt(totalBalance)}`,  color: '#10b981', icon: <IndianRupee size={20} /> },
                    { label: 'एकूण परतावा दिलेला', val: `Rs.${fmt(totalRefunded)}`, color: '#d97706', icon: <ArrowUpCircle size={20} /> },
                    { label: 'सक्रिय योजना',       val: activeSchemes,              color: '#7c3aed', icon: <PiggyBank size={20} /> },
                ].map(({ label, val, color, icon }) => (
                    <div key={label} style={{ ...S.statCard, borderTop: `3px solid ${color}` }}>
                        <div style={{ ...S.statIcon, color }}>{icon}</div>
                        <div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color }}>{val}</div>
                            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>{label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div style={S.tabBar}>
                {TABS.map(t => (
                    <button key={t.key} onClick={() => setActiveTab(t.key)}
                        style={{ ...S.tabBtn, ...(activeTab === t.key ? S.tabBtnActive : {}) }}>
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {/* ── Accounts Tab ── */}
            {activeTab === 'accounts' && (
                <div style={S.card}>
                    <div style={S.cardHeader}>
                        <h2 style={S.cardTitle}>शेतकरी ठेव खाती व शिल्लक</h2>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <div style={S.searchBox}>
                                <Search size={15} color="#94a3b8" />
                                <input placeholder="शेतकरी नाव किंवा कोड..." value={searchAccounts}
                                    onChange={e => setSA(e.target.value)} style={S.searchInput} />
                            </div>
                            <button onClick={() => setSAM(true)} style={S.btnPrimary}>
                                <Plus size={16} /> नवीन खाते
                            </button>
                        </div>
                    </div>
                    {filteredAccounts.length === 0 ? (
                        <div style={S.emptyState}>
                            <PiggyBank size={48} color="#cbd5e1" />
                            <div style={{ marginTop: 12, color: '#64748b' }}>कोणतेही खाते नाही. "नवीन खाते" वर क्लिक करा.</div>
                        </div>
                    ) : (
                        <table style={S.table}>
                            <thead>
                                <tr>{['शेतकरी', 'ठेव योजना', 'दर', 'सुरवातीची रक्कम', 'सुरुवात तारीख', 'चालू शिल्लक', 'एकूण जमा', 'एकूण परतावा', 'स्थिती', 'क्रिया'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
                            </thead>
                            <tbody>
                                {filteredAccounts.map(acc => (
                                    <tr key={acc.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={S.td}>
                                            <div style={{ fontWeight: 600 }}>{acc.farmer_name}</div>
                                            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>#{acc.farmer_code}</div>
                                        </td>
                                        <td style={S.td}>
                                            <div style={{ fontWeight: 600 }}>{acc.thev_name}</div>
                                            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{TYPE_LABELS[acc.thev_type] || acc.thev_type}</div>
                                        </td>
                                        <td style={S.td}>Rs.{fmt(acc.rate)}</td>
                                        <td style={S.td}>Rs.{fmt(acc.opening_balance)}</td>
                                        <td style={{ ...S.td, color: '#6366f1', fontSize: '0.85rem' }}>
                                            {acc.start_date ? new Date(acc.start_date).toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' }) : '—'}
                                        </td>
                                        <td style={{ ...S.td, fontWeight: 700, color: parseFloat(acc.current_balance) === 0 ? '#d97706' : '#10b981', fontSize: '1rem' }}>
                                            Rs.{fmt(acc.current_balance)}
                                            {parseFloat(acc.current_balance) === 0 && (
                                                <span style={{ fontSize: '0.7rem', marginLeft: 6, color: '#d97706' }}>(शून्य)</span>
                                            )}
                                        </td>
                                        <td style={S.td}>Rs.{fmt(acc.total_deposited)}</td>
                                        <td style={S.td}>Rs.{fmt(acc.total_refunded)}</td>
                                        <td style={S.td}>
                                            <button onClick={() => handleToggleStatus(acc)}
                                                style={{ background: acc.status === 'active' ? '#dcfce7' : '#fee2e2', color: acc.status === 'active' ? '#16a34a' : '#dc2626', border: 'none', borderRadius: 12, padding: '3px 10px', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}>
                                                {acc.status === 'active' ? 'सक्रिय' : 'थांबलेले'}
                                            </button>
                                        </td>
                                        <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                                            <button title="खातेवही पाहा" onClick={() => setPT(acc)} style={S.iconBtn}><Eye size={15} /></button>
                                            <button title="व्यवहार दुरुस्त करा" onClick={() => handleRebackfill(acc)} style={{ ...S.iconBtn, color: '#d97706' }} ><Wrench size={15} /></button>
                                            <button title="परतावा द्या" onClick={() => {
                                                if (parseFloat(acc.current_balance) <= 0) { showAlert('या शेतकऱ्याची शिल्लक शून्य आहे.', 'माहिती', 'info'); return; }
                                                setRT(acc);
                                            }} style={{ ...S.iconBtn, color: '#0369a1' }}><ArrowUpCircle size={15} /></button>
                                            <button title="खाते हटवा" onClick={() => handleDeleteAccount(acc.id)} style={{ ...S.iconBtn, color: '#ef4444' }}><Trash2 size={15} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* ── Masters Tab ── */}
            {activeTab === 'masters' && (
                <div style={S.card}>
                    <div style={S.cardHeader}>
                        <h2 style={S.cardTitle}>ठेव योजना व्यवस्थापन</h2>
                        <button onClick={() => { setEM(null); setMasterForm({ name: '', deduction_type: 'per_liter', default_rate: '', is_active: true, rate_change_from_date: '' }); setSMM(true); }} style={S.btnPrimary}>
                            <Plus size={16} /> नवीन योजना
                        </button>
                    </div>
                    {masters.length === 0 ? (
                        <div style={S.emptyState}><PiggyBank size={48} color="#cbd5e1" /><div style={{ marginTop: 12, color: '#64748b' }}>कोणतीही ठेव योजना नाही.</div></div>
                    ) : (
                        <table style={S.table}>
                            <thead><tr>{['योजना नाव', 'कपात प्रकार', 'डिफॉल्ट दर', 'ठेव शिल्लक बिलात दाखवा', 'स्थिती', 'क्रिया'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                            <tbody>
                                {masters.map(m => (
                                    <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ ...S.td, fontWeight: 600 }}>{m.name}</td>
                                        <td style={S.td}>{TYPE_LABELS[m.deduction_type] || m.deduction_type}</td>
                                        <td style={{ ...S.td, fontWeight: 600 }}>
                                            Rs.{fmt(m.default_rate)}{m.deduction_type === 'per_liter' ? ' /लिटर' : m.deduction_type === 'percentage' ? '%' : ' /बिल'}
                                        </td>
                                        <td style={S.td}>
                                            <div
                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleToggleShowBalance(m); }}
                                                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                                            >
                                                <div
                                                    style={{
                                                        width: 40, height: 22, borderRadius: 11,
                                                        background: m.show_balance_in_bill !== false ? '#4f46e5' : '#e2e8f0',
                                                        position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    <div style={{
                                                        position: 'absolute', top: 3, left: m.show_balance_in_bill !== false ? 21 : 3,
                                                        width: 16, height: 16, borderRadius: '50%',
                                                        background: '#fff', transition: 'left 0.2s',
                                                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                                    }} />
                                                </div>
                                                <span style={{ fontSize: '0.78rem', color: m.show_balance_in_bill !== false ? '#4f46e5' : '#94a3b8' }}>
                                                    {m.show_balance_in_bill !== false ? 'दाखवा' : 'लपवा'}
                                                </span>
                                            </div>
                                        </td>
                                        <td style={S.td}>
                                            <span style={{ background: m.is_active ? '#dcfce7' : '#f1f5f9', color: m.is_active ? '#16a34a' : '#64748b', padding: '3px 10px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 600 }}>
                                                {m.is_active ? 'सक्रिय' : 'बंद'}
                                            </span>
                                        </td>
                                        <td style={S.td}>
                                            <button onClick={() => { setEM(m); setMasterForm({ name: m.name, deduction_type: m.deduction_type, default_rate: m.default_rate, is_active: m.is_active, rate_change_from_date: '' }); setSMM(true); }} style={S.iconBtn} title='संपादित करा'><Edit size={15} /></button>
                                            <button onClick={() => setShowRH(m)} style={{ ...S.iconBtn, color: '#4f46e5' }} title='दर बदल इतिहास'><History size={15} /></button>
                                            <button onClick={() => handleMasterDelete(m.id)} style={{ ...S.iconBtn, color: '#ef4444' }} title='हटवा'><Trash2 size={15} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* ── Transactions Tab ── */}
            {activeTab === 'transactions' && (
                <div style={S.card}>
                    <div style={S.cardHeader}><h2 style={S.cardTitle}>व्यवहार व खातेवही (पासबुक)</h2></div>
                    <div style={{ padding: '0 24px 16px' }}>

                        {/* ── Filter Row ── */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 16, marginTop: 16, alignItems: 'end' }}>
                            {/* Farmer */}
                            <div>
                                <label style={S.label}>शेतकरी निवडा</label>
                                <select value={selectedFarmer?.id || ''} onChange={e => {
                                    const f = farmers.find(f => String(f.id) === e.target.value);
                                    setSelFarmer(f || null);
                                    setSelThevAcc(null);
                                    setTxnFrom('');
                                    setTxnTo('');
                                }} style={S.input}>
                                    <option value="">— शेतकरी निवडा —</option>
                                    {farmers.filter(f => accounts.some(a => String(a.farmer_id) === String(f.id))).map(f => (
                                        <option key={f.id} value={f.id}>{f.name} ({f.code})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Thev Account */}
                            <div>
                                <label style={S.label}>ठेव योजना निवडा</label>
                                <select
                                    value={selectedThevAccount?.id || ''}
                                    disabled={!selectedFarmer}
                                    onChange={e => {
                                        const acc = accounts.find(a => String(a.id) === e.target.value && String(a.farmer_id) === String(selectedFarmer?.id));
                                        setSelThevAcc(acc || null);
                                    }}
                                    style={{ ...S.input, opacity: !selectedFarmer ? 0.5 : 1 }}
                                >
                                    <option value="">— सर्व योजना —</option>
                                    {accounts
                                        .filter(a => String(a.farmer_id) === String(selectedFarmer?.id))
                                        .map(a => (
                                            <option key={a.id} value={a.id}>
                                                {a.thev_name} (Rs.{fmt(a.current_balance)})
                                            </option>
                                        ))
                                    }
                                </select>
                            </div>

                            {/* Date From */}
                            <div>
                                <label style={S.label}>तारखेपासून (From)</label>
                                <input
                                    type="date" value={txnFromDate}
                                    onChange={e => setTxnFrom(e.target.value)}
                                    style={S.input}
                                />
                            </div>

                            {/* Date To */}
                            <div>
                                <label style={S.label}>तारखेपर्यंत (To)</label>
                                <input
                                    type="date" value={txnToDate}
                                    onChange={e => setTxnTo(e.target.value)}
                                    style={S.input}
                                />
                            </div>
                        </div>

                        {/* ── Account Summary Card (shown when a specific account is selected) ── */}
                        {selectedFarmer && selectedThevAccount && (() => {
                            const typeLabel = { per_liter: 'प्रति लिटर', percentage: 'टक्केवारी (%)', fixed_amount: 'प्रति बिल' }[selectedThevAccount.thev_type] || '';
                            return (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16, padding: '14px 16px', background: '#f5f3ff', borderRadius: 12, border: '1px solid #ddd6fe' }}>
                                    {[
                                        { l: 'ठेव योजना',      v: selectedThevAccount.thev_name,                             c: '#4f46e5' },
                                        { l: 'दर',             v: `Rs.${fmt(selectedThevAccount.rate)} ${typeLabel}`,         c: '#0369a1' },
                                        { l: 'एकूण जमा',      v: `Rs.${fmt(selectedThevAccount.total_deposited)}`,           c: '#10b981' },
                                        { l: 'चालू शिल्लक',   v: `Rs.${fmt(selectedThevAccount.current_balance)}`,          c: parseFloat(selectedThevAccount.current_balance) === 0 ? '#ef4444' : '#7c3aed' },
                                    ].map(({ l, v, c }) => (
                                        <div key={l} style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.72rem', color: '#6d28d9', marginBottom: 3 }}>{l}</div>
                                            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: c }}>{v}</div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}

                        {!selectedFarmer ? (
                            <div style={S.emptyState}><FileText size={48} color="#cbd5e1" /><div style={{ marginTop: 12, color: '#64748b' }}>व्यवहार पाहण्यासाठी शेतकरी निवडा.</div></div>
                        ) : loadingTxns ? <Loader /> : (() => {
                            // Apply account + date filters
                            const filtered = farmerTxns.filter(tx => {
                                if (selectedThevAccount && String(tx.thev_account_id) !== String(selectedThevAccount.id)) return false;
                                if (txnFromDate && tx.transaction_date < txnFromDate) return false;
                                if (txnToDate   && tx.transaction_date > txnToDate)   return false;
                                return true;
                            });

                            // Count txns per account so we can show account badge in table when showing all
                            const accountMap = Object.fromEntries(accounts.map(a => [String(a.id), a]));

                            if (filtered.length === 0) return (
                                <div style={S.emptyState}>
                                    <FileText size={48} color="#cbd5e1" />
                                    <div style={{ marginTop: 12, color: '#64748b' }}>
                                        {farmerTxns.length === 0
                                            ? 'या शेतकऱ्यासाठी कोणतेही व्यवहार नाहीत.'
                                            : 'निवडलेल्या फिल्टरनुसार कोणतेही व्यवहार नाहीत.'}
                                    </div>
                                    {farmerTxns.length > 0 && (
                                        <button onClick={() => { setSelThevAcc(null); setTxnFrom(''); setTxnTo(''); }}
                                            style={{ ...S.btnSecondary, marginTop: 12 }}>फिल्टर काढा</button>
                                    )}
                                </div>
                            );

                            // Running balance per account for display
                            const runMap = {};
                            [...filtered].sort((a, b) =>
                                a.transaction_date.localeCompare(b.transaction_date) ||
                                String(a.id).localeCompare(String(b.id))
                            )
                                .forEach(t => {
                                    const aid = String(t.thev_account_id);
                                    if (!runMap[aid]) runMap[aid] = 0;
                                    const amt = parseFloat(t.amount || 0);
                                    if (['deposit','opening','interest'].includes(t.transaction_type)) runMap[aid] += amt;
                                    else if (t.transaction_type === 'refund') runMap[aid] -= amt;
                                    runMap[aid] = Math.max(0, runMap[aid]);
                                    t._displayBal = parseFloat(runMap[aid].toFixed(2));
                                });

                            return (
                                <>
                                    {/* Result summary strip */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, fontSize: '0.82rem', color: '#64748b' }}>
                                        <span>एकूण <b style={{ color: '#1e293b' }}>{filtered.length}</b> व्यवहार दिसत आहेत</span>
                                        {(selectedThevAccount || txnFromDate || txnToDate) && (
                                            <button onClick={() => { setSelThevAcc(null); setTxnFrom(''); setTxnTo(''); }}
                                                style={{ ...S.btnSecondary, padding: '4px 10px', fontSize: '0.78rem' }}>✕ फिल्टर काढा</button>
                                        )}
                                    </div>
                                    <table style={S.table}>
                                        <thead>
                                            <tr>
                                                {['तारीख', !selectedThevAccount && 'ठेव योजना', 'प्रकार', 'रक्कम', 'व्याज/बोनस', 'शिल्लक', 'शेरा', 'क्रिया']
                                                    .filter(Boolean)
                                                    .map(h => <th key={h} style={S.th}>{h}</th>)
                                                }
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filtered.map(tx => {
                                                const m = TXN_META[tx.transaction_type] || TXN_META.deposit;
                                                const dispBal = parseFloat(tx.balance_after) > 0 ? tx.balance_after : (tx._displayBal ?? 0);
                                                const accInfo = accountMap[String(tx.thev_account_id)];
                                                return (
                                                    <tr key={tx.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                        <td style={S.td}>{tx.transaction_date || '—'}</td>
                                                        {!selectedThevAccount && (
                                                            <td style={S.td}>
                                                                <span style={{ background: '#ede9fe', color: '#5b21b6', padding: '2px 8px', borderRadius: 10, fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                                    {accInfo?.thev_name || `#${tx.thev_account_id}`}
                                                                </span>
                                                            </td>
                                                        )}
                                                        <td style={S.td}>
                                                            <span style={{ background: m.bg, color: m.text, padding: '3px 8px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 600 }}>{m.label}</span>
                                                        </td>
                                                        <td style={{ ...S.td, fontWeight: 600, color: tx.transaction_type === 'refund' ? '#ef4444' : '#10b981' }}>
                                                            {tx.transaction_type === 'refund' ? '-' : '+'}Rs.{fmt(tx.amount)}
                                                        </td>
                                                        <td style={S.td}>{tx.interest_amount > 0 ? `Rs.${fmt(tx.interest_amount)}` : '—'}</td>
                                                        <td style={{ ...S.td, fontWeight: 600, color: dispBal === 0 ? '#ef4444' : '#1e293b' }}>Rs.{fmt(dispBal)}</td>
                                                        <td style={{ ...S.td, color: '#64748b', fontSize: '0.85rem' }}>{tx.remarks || '—'}</td>
                                                        <td style={{ ...S.td, textAlign: 'center' }}>
                                                            {/* Hide delete for computed deposit rows — derived from collections */}
                                                            {!tx._synthetic && (
                                                                <button onClick={() => handleDeleteTransaction(tx.id)} style={{ ...S.iconBtn, color: '#ef4444' }} title='काढून टाका'><Trash2 size={15} /></button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* ── Refund History Tab ── */}
            {activeTab === 'refund' && (
                <div style={S.card}>
                    <div style={S.cardHeader}>
                        <h2 style={S.cardTitle}>परतावा इतिहास</h2>
                        {/* PDF action buttons — only shown when data is loaded */}
                        {!loadingHistory && filteredRefundHistory.length > 0 && (
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={printAdminSummaryPDF} disabled={summaryLoading}
                                    style={{ ...S.btnSecondary, gap: 6, fontSize: '0.82rem', padding: '7px 14px', opacity: summaryLoading ? 0.6 : 1 }}
                                    title="प्रशासक सारांश PDF">
                                    <AlignJustify size={15} /> {summaryLoading ? 'लोड करत आहे...' : 'सारांश PDF'}
                                </button>
                                <button onClick={printFarmerChitsPDF} disabled={chitLoading}
                                    style={{ ...S.btnPrimary, gap: 6, fontSize: '0.82rem', padding: '7px 14px', background: '#7c3aed', opacity: chitLoading ? 0.6 : 1 }}
                                    title="शेतकरी चिट्स PDF">
                                    <Download size={15} /> {chitLoading ? 'लोड करत आहे...' : 'शेतकरी चिट्स'}
                                </button>
                            </div>
                        )}
                    </div>
                    <div style={{ padding: '0 24px 16px' }}>

                        {/* ── Filter Row ── */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginBottom: 14, marginTop: 16 }}>
                            {/* Period Dropdown */}
                            <div style={{ flex: '1 1 220px' }}>
                                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>📅 ठेव कालावधी निवडा</div>
                                <select
                                    value={histPeriodFilter}
                                    onChange={e => {
                                        const val = e.target.value;
                                        setHistPeriodFilter(val);
                                        // Period dropdown is a CLIENT-SIDE filter on remarks text.
                                        // Do NOT change histFromDate/histToDate — those control the API query by refund date.
                                        // Milk litres fetch will use the period's own from/to dates (via selectedPeriodObj).
                                    }}
                                    style={{ ...S.input }}
                                >
                                    <option value="">— सर्व परतावे (तारखेनुसार) —</option>
                                    {periodOptions.map(p => (
                                        <option key={p.label} value={p.from + ' ते ' + p.to}>
                                            {p.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Thev Name Dropdown — dynamic, from loaded accounts */}
                            <div style={{ flex: '1 1 180px' }}>
                                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>🏦 ठेव योजना निवडा</div>
                                <select
                                    value={histThevNameFilter}
                                    onChange={e => setHistThevNameFilter(e.target.value)}
                                    style={{ ...S.input }}
                                >
                                    <option value="">— सर्व योजना —</option>
                                    {[...new Set(accounts.map(a => a.thev_name).filter(Boolean))].sort().map(name => (
                                        <option key={name} value={name}>{name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Manual date range */}
                            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                <div>
                                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: 3 }}>पासून</div>
                                    <input type="date" value={histFromDate}
                                        onChange={e => { setHFD(e.target.value); setHistPeriodFilter(''); }}
                                        style={{ ...S.input, width: 148 }} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: 3 }}>पर्यंत</div>
                                    <input type="date" value={histToDate}
                                        onChange={e => { setHTD(e.target.value); setHistPeriodFilter(''); }}
                                        style={{ ...S.input, width: 148 }} />
                                </div>
                                <button onClick={loadRefundHistory} style={{ ...S.btnPrimary, padding: '9px 16px' }}>
                                    <Search size={15} /> शोधा
                                </button>
                            </div>
                        </div>

                        {/* ── Custom Greeting Input ── */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 9, padding: '10px 14px' }}>
                            <span style={{ fontSize: '1.1rem' }}>✍️</span>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#92400e', marginBottom: 3 }}>शेतकरी चिटवर संदेश (वैकल्पिक)</div>
                                <input
                                    type="text"
                                    value={customGreeting}
                                    onChange={e => setCustomGreeting(e.target.value)}
                                    placeholder="उदा. 🪔 दिवाळीच्या हार्दिक शुभेच्छा! किंवा Happy New Year 🎉"
                                    style={{ ...S.input, background: '#fff' }}
                                />
                            </div>
                        </div>

                        {loadingHistory ? <Loader /> : refundHistory.length === 0 ? (
                            <div style={S.emptyState}>
                                <ArrowUpCircle size={48} color="#cbd5e1" />
                                <div style={{ marginTop: 12, color: '#64748b' }}>निवडलेल्या कालावधीत कोणताही परतावा नाही.</div>
                            </div>
                        ) : (
                            <>
                                {/* Summary chips */}
                                <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                                    {histPeriodFilter && (
                                        <div style={{ background: '#eef2ff', color: '#4f46e5', borderRadius: 8, padding: '5px 12px', fontWeight: 600, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            📅 {selectedPeriodLabel}
                                            <button onClick={() => setHistPeriodFilter('')}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', fontWeight: 700, fontSize: '1rem', lineHeight: 1 }}>×</button>
                                        </div>
                                    )}
                                    {histThevNameFilter && (
                                        <div style={{ background: '#f0fdf4', color: '#15803d', borderRadius: 8, padding: '5px 12px', fontWeight: 600, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            🏦 {histThevNameFilter}
                                            <button onClick={() => setHistThevNameFilter('')}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#15803d', fontWeight: 700, fontSize: '1rem', lineHeight: 1 }}>×</button>
                                        </div>
                                    )}
                                    {[
                                        { l: 'एकूण परतावा', v: filteredRefundHistory.reduce((s, r) => s + parseFloat(r.amount || 0), 0), c: '#d97706', bg: '#fef3c7' },
                                        ...(hasInterest ? [{ l: 'एकूण व्याज', v: filteredRefundHistory.reduce((s, r) => s + parseFloat(r.interest_amount || 0), 0), c: '#5b21b6', bg: '#ede9fe' }] : []),
                                        { l: 'एकूण दिलेले', v: filteredRefundHistory.reduce((s, r) => s + parseFloat(r.amount || 0) + parseFloat(r.interest_amount || 0), 0), c: '#15803d', bg: '#dcfce7' },
                                    ].map(({ l, v, c, bg }) => (
                                        <div key={l} style={{ background: bg, borderRadius: 8, padding: '6px 14px', fontWeight: 700, color: c, fontSize: '0.88rem' }}>
                                            {l}: Rs.{fmt(v)}
                                        </div>
                                    ))}
                                    <div style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#94a3b8' }}>
                                        {filteredRefundHistory.length} व्यवहार, {farmerRefundSummary.length} शेतकरी
                                    </div>
                                </div>

                                {/* Refund table */}
                                <table style={S.table}>
                                    <thead><tr>
                                        {['शेतकरी', 'परतावा तारीख', 'दिलेली रक्कम',
                                          ...(hasInterest ? ['व्याज'] : []),
                                          'एकूण दिलेले', 'शेरा'
                                        ].map(h => <th key={h} style={S.th}>{h}</th>)}
                                    </tr></thead>
                                    <tbody>
                                        {filteredRefundHistory.map(r => (
                                            <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={S.td}>
                                                    <div style={{ fontWeight: 600 }}>{r.farmer_name}</div>
                                                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>#{r.farmer_code}</div>
                                                </td>
                                                <td style={S.td}>{r.transaction_date}</td>
                                                <td style={{ ...S.td, fontWeight: 700, color: '#d97706' }}>Rs.{fmt(r.amount)}</td>
                                                {hasInterest && (
                                                    <td style={{ ...S.td, color: '#7c3aed' }}>Rs.{fmt(r.interest_amount)}</td>
                                                )}
                                                <td style={{ ...S.td, fontWeight: 700, color: '#10b981', fontSize: '1rem' }}>
                                                    Rs.{fmt(parseFloat(r.amount) + parseFloat(r.interest_amount))}
                                                </td>
                                                <td style={{ ...S.td, color: '#64748b', fontSize: '0.85rem' }}>{r.remarks || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ── Rate History Modal ── */}
            {showRateHistory && (
                <RateHistoryModal
                    master={showRateHistory}
                    dairyId={user.dairy_id}
                    onClose={() => setShowRH(null)}
                />
            )}

            {/* ── Master Modal ── */}
            {showMasterModal && (
                <div style={S.overlay}>
                    <div style={{ ...S.modal, maxWidth: 460 }}>
                        <div style={S.modalHeader}>
                            <h3 style={{ margin: 0 }}>{editMaster ? 'ठेव योजना संपादित करा' : 'नवीन ठेव योजना जोडा'}</h3>
                            <button onClick={() => { setSMM(false); setEM(null); }} style={S.closeBtn}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleMasterSave} style={{ padding: 24 }}>
                            <label style={S.label}>योजनेचे नाव *</label>
                            <input required value={masterForm.name} onChange={e => setMasterForm(p => ({ ...p, name: e.target.value }))}
                                placeholder="उदा. दिवाळी बचत ठेव" style={{ ...S.input, marginBottom: 14 }} />
                            <label style={S.label}>कपातीचा प्रकार *</label>
                            <select value={masterForm.deduction_type} onChange={e => setMasterForm(p => ({ ...p, deduction_type: e.target.value }))} style={{ ...S.input, marginBottom: 14 }}>
                                <option value="per_liter">प्रति लिटर (उदा. Rs.1/लिटर)</option>
                                <option value="fixed_amount">प्रति बिल निश्चित रक्कम</option>
                                <option value="percentage">टक्केवारी (%) बिल रक्कमवर</option>
                            </select>
                            <label style={S.label}>डिफॉल्ट दर / रक्कम</label>
                            <input type="number" step="0.01" min="0" value={masterForm.default_rate}
                                onChange={e => setMasterForm(p => ({ ...p, default_rate: e.target.value }))}
                                placeholder="0.00" style={{ ...S.input, marginBottom: 14 }} />

                            {/* Rate change from date — only shown when editing an existing master */}
                            {editMaster && (
                                <>
                                    <label style={{ ...S.label, color: '#6366f1', fontWeight: 700 }}>
                                        📅 नवीन दर कधीपासून लागू करायचा?
                                        <span style={{ fontWeight: 400, color: '#64748b', fontSize: '0.78rem', display: 'block' }}>
                                            (ही तारीख दिली तर त्या तारखेपासूनच्या सर्व संकलनाच्या ठेव नोंदी नव्या दराने पुन्हा मोजल्या जातील)
                                        </span>
                                    </label>
                                    <input type="date" value={masterForm.rate_change_from_date}
                                        onChange={e => setMasterForm(p => ({ ...p, rate_change_from_date: e.target.value }))}
                                        style={{ ...S.input, marginBottom: 6, borderColor: masterForm.rate_change_from_date ? '#6366f1' : undefined }} />
                                    {masterForm.rate_change_from_date && (
                                        <div style={{ marginBottom: 14, padding: '8px 12px', background: '#eef2ff', borderRadius: 8, fontSize: '0.82rem', color: '#4338ca' }}>
                                            ⚠️ <b>{masterForm.rate_change_from_date}</b> पासून सर्व शेतकऱ्यांच्या (या योजनेतील) ठेव नोंदी नव्या दराने <b>₹{masterForm.default_rate}/लिटर</b> ने पुन्हा मोजल्या जातील.
                                        </div>
                                    )}
                                    {!masterForm.rate_change_from_date && (
                                        <div style={{ marginBottom: 14, fontSize: '0.8rem', color: '#94a3b8' }}>
                                            तारीख न दिल्यास फक्त डिफॉल्ट दर बदलेल — जुन्या नोंदी बदलणार नाहीत.
                                        </div>
                                    )}
                                </>
                            )}

                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, cursor: 'pointer', fontSize: '0.9rem' }}>
                                <input type="checkbox" checked={masterForm.is_active} onChange={e => setMasterForm(p => ({ ...p, is_active: e.target.checked }))} />
                                सक्रिय योजना
                            </label>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <button type="submit" style={S.btnPrimary}>{editMaster ? 'अपडेट करा' : 'जतन करा'}</button>
                                <button type="button" onClick={() => setSMM(false)} style={S.btnSecondary}>रद्द करा</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Assign Modal ── */}
            {showAssignModal && (
                <div style={S.overlay}>
                    <div style={{ ...S.modal, maxWidth: 500 }}>
                        <div style={S.modalHeader}>
                            <h3 style={{ margin: 0 }}>शेतकऱ्याला ठेव योजना जोडा</h3>
                            <button onClick={() => setSAM(false)} style={S.closeBtn}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleAssignSave} style={{ padding: 24 }}>
                            <label style={S.label}>शेतकरी शोधा</label>
                            <input placeholder="शेतकरी नाव किंवा कोड..." value={farmerSearch}
                                onChange={e => setFS(e.target.value)} style={{ ...S.input, marginBottom: 8 }} />
                            <label style={S.label}>शेतकरी निवडा *</label>
                            <select required value={assignForm.farmer_id} onChange={e => setAssignForm(p => ({ ...p, farmer_id: e.target.value }))} style={{ ...S.input, marginBottom: 14 }}>
                                <option value="">— शेतकरी निवडा —</option>
                                {farmers.filter(f => {
                                    const q = farmerSearch.toLowerCase();
                                    return !q || f.name.toLowerCase().includes(q) || String(f.code).includes(q);
                                }).map(f => (
                                    <option key={f.id} value={f.id}>{f.name} ({f.code})</option>
                                ))}
                            </select>
                            <label style={S.label}>ठेव योजना निवडा *</label>
                            <select required value={assignForm.thev_master_id}
                                onChange={e => {
                                    const m = masters.find(m => String(m.id) === e.target.value);
                                    setAssignForm(p => ({ ...p, thev_master_id: e.target.value, rate: m?.default_rate || '' }));
                                }}
                                style={{ ...S.input, marginBottom: 14 }}>
                                <option value="">— ठेव योजना निवडा —</option>
                                {masters.filter(m => m.is_active).map(m => (
                                    <option key={m.id} value={m.id}>{m.name} ({TYPE_LABELS[m.deduction_type]})</option>
                                ))}
                            </select>
                            <label style={S.label}>दर / रक्कम</label>
                            <input type="number" step="0.01" min="0" value={assignForm.rate}
                                onChange={e => setAssignForm(p => ({ ...p, rate: e.target.value }))}
                                placeholder="0.00" style={{ ...S.input, marginBottom: 14 }} />
                            <label style={S.label}>आरंभिक शिल्लक (जुनी जमा ठेव, असल्यास)</label>
                            <input type="number" step="0.01" min="0" value={assignForm.opening_balance}
                                onChange={e => setAssignForm(p => ({ ...p, opening_balance: e.target.value }))}
                                placeholder="0.00" style={{ ...S.input, marginBottom: 14 }} />
                            <label style={S.label}>सुरुवातीची तारीख</label>
                            <input type="date" value={assignForm.start_date}
                                onChange={e => setAssignForm(p => ({ ...p, start_date: e.target.value }))}
                                style={{ ...S.input, marginBottom: 18 }} />
                            <div style={{ display: 'flex', gap: 10 }}>
                                <button type="submit" style={S.btnPrimary}>खाते उघडा</button>
                                <button type="button" onClick={() => setSAM(false)} style={S.btnSecondary}>रद्द करा</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Refund Modal ── */}
            {refundTarget && (
                <RefundModal
                    account={refundTarget} farmers={farmers} user={user}
                    showAlert={showAlert} showConfirm={showConfirm}
                    onClose={() => setRT(null)}
                    onSuccess={() => { setRT(null); loadAll(); }}
                />
            )}

            {/* ── Passbook Modal ── */}
            {passbookTarget && (
                <PassbookModal account={passbookTarget} farmers={farmers} user={user} onClose={() => setPT(null)} />
            )}
        </div>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const STYLES = {
    page: { padding: 24, overflowY: 'auto', height: '100%' },
    pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
    pageTitle: { display: 'flex', alignItems: 'center', gap: 10, fontSize: '1.6rem', fontWeight: 800, color: '#1e293b', margin: 0 },
    pageSubtitle: { color: '#64748b', margin: '4px 0 0', fontSize: '0.9rem' },
    statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 },
    statCard: { background: '#fff', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 3px rgba(0,0,0,.07)' },
    statIcon: { background: '#f8fafc', borderRadius: 10, padding: 10 },
    tabBar: { display: 'flex', gap: 4, marginBottom: 16, background: '#f1f5f9', padding: 6, borderRadius: 12 },
    tabBtn: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 12px', border: 'none', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#64748b', transition: 'all .18s' },
    tabBtnActive: { background: '#fff', color: '#4f46e5', boxShadow: '0 2px 8px rgba(79,70,229,.12)' },
    card: { background: '#fff', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,.07)', overflow: 'hidden' },
    cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid #f1f5f9' },
    cardTitle: { margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1e293b' },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { padding: '11px 14px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, color: '#64748b', background: '#f8fafc', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' },
    td: { padding: '11px 14px', fontSize: '0.88rem', color: '#374151' },
    emptyState: { padding: '48px 24px', textAlign: 'center', color: '#94a3b8' },
    label: { display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: 5 },
    input: { width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.9rem', color: '#1e293b', outline: 'none', boxSizing: 'border-box' },
    btnPrimary: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer' },
    btnSecondary: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer' },
    btnRefresh: { padding: '8px 12px', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' },
    iconBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 6, color: '#64748b', display: 'inline-flex', alignItems: 'center' },
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    modal: { background: '#fff', borderRadius: 16, width: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)' },
    modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid #f1f5f9' },
    closeBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, color: '#64748b', display: 'flex' },
    searchBox: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 },
    searchInput: { border: 'none', background: 'none', outline: 'none', fontSize: '0.88rem', minWidth: 180 },
    infoBox: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.9rem' },
};

