import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { IndianRupee, Save, Calendar, PlusCircle, Upload, Download, RefreshCw, Building2 } from 'lucide-react';
import Loader from '../components/Loader';
import { useAlert } from '../hooks/useAlert';

// ── Constants ────────────────────────────────────────────────────────────────
const FEDERATION_RATE_TYPE = 'federation_dar';

const MILK_RANGES = {
    Buffalo: { fatMin: 5.5, fatMax: 15.9, snfMin: 8.7, snfMax: 10.0 },
    Cow:     { fatMin: 3.0, fatMax: 5.0,  snfMin: 8.2, snfMax: 9.0  },
};

const generateRange = (start, end) => {
    const arr = [];
    for (let i = start; i <= end + 0.001; i += 0.1) {
        arr.push(parseFloat(i.toFixed(1)));
    }
    return arr;
};

const isCellSelected = (fat, snf, selection) => {
    if (!selection?.start || !selection?.end) return false;
    const minFat = Math.min(selection.start.fat, selection.end.fat);
    const maxFat = Math.max(selection.start.fat, selection.end.fat);
    const minSnf = Math.min(selection.start.snf, selection.end.snf);
    const maxSnf = Math.max(selection.start.snf, selection.end.snf);
    return fat >= minFat - 0.01 && fat <= maxFat + 0.01 &&
           snf >= minSnf - 0.01 && snf <= maxSnf + 0.01;
};

// ── Range Settings Modal ─────────────────────────────────────────────────────
const RangeInputModal = ({ isOpen, onClose, onApply, matrixType }) => {
    const range = MILK_RANGES[matrixType] || MILK_RANGES.Buffalo;
    const [settings, setSettings] = useState({ ...range });

    useEffect(() => {
        if (isOpen) setSettings({ ...range });
    }, [isOpen, matrixType]);

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                background: 'white', padding: '24px', borderRadius: '16px',
                width: '90%', maxWidth: '450px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
            }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: 'bold' }}>
                    📏 FAT / SNF श्रेणी सेट करा
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                    {[
                        { label: 'FAT किमान', field: 'fatMin' },
                        { label: 'FAT जास्तीत जास्त', field: 'fatMax' },
                        { label: 'SNF किमान', field: 'snfMin' },
                        { label: 'SNF जास्तीत जास्त', field: 'snfMax' },
                    ].map(({ label, field }) => (
                        <div key={field}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>{label}</label>
                            <input
                                type="number" step="0.1" value={settings[field]}
                                onChange={e => setSettings(prev => ({ ...prev, [field]: parseFloat(e.target.value) || 0 }))}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                            />
                        </div>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontWeight: '600' }}>
                        रद्द करा
                    </button>
                    <button onClick={() => onApply(settings)} style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#7c3aed', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>
                        सुरू करा
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Bulk Update Modal ────────────────────────────────────────────────────────
const RateUpdateModal = ({ isOpen, onClose, onApply, selectionStats }) => {
    const [action, setAction] = useState('set');
    const [value, setValue] = useState('');
    const [scope, setScope] = useState('selection');

    useEffect(() => { if (isOpen) setValue(''); }, [isOpen]);

    if (!isOpen) return null;

    const handleApply = () => {
        const numVal = parseFloat(value);
        if (isNaN(numVal)) { alert('कृपया वैध संख्या टाका'); return; }
        onApply(action, numVal, scope);
        onClose();
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'white', padding: '24px', borderRadius: '16px', width: '90%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 'bold' }}>दर एकत्र अपडेट करा</h3>
                <div style={{ marginBottom: '16px', background: '#f3f4f6', padding: '12px', borderRadius: '8px', fontSize: '14px' }}>
                    निवडलेले: {selectionStats.count} सेल | FAT: {selectionStats.fatRange} | SNF: {selectionStats.snfRange}
                </div>
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>कृती</label>
                    <select value={action} onChange={e => setAction(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #d1d5db' }}>
                        <option value="set">दर सेट करा</option>
                        <option value="increase">वाढवा</option>
                        <option value="decrease">कमी करा</option>
                        <option value="multiply">गुणा करा</option>
                    </select>
                </div>
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>मूल्य</label>
                    <input type="number" value={value} onChange={e => setValue(e.target.value)} autoFocus
                        style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #d1d5db' }} />
                </div>
                <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>लागू करा</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                            <input type="radio" name="fedScope" value="selection" checked={scope === 'selection'} onChange={() => setScope('selection')} />
                            निवडलेल्या सेलवर
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                            <input type="radio" name="fedScope" value="all" checked={scope === 'all'} onChange={() => setScope('all')} />
                            संपूर्ण तक्त्यावर
                        </label>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}>रद्द करा</button>
                    <button onClick={handleApply} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#7c3aed', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>
                        लागू करा
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Main Component ───────────────────────────────────────────────────────────
function FederationRates({ user }) {
    const { showAlert, showConfirm, AlertComponent } = useAlert();

    const [allRates, setAllRates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [matrixType, setMatrixType] = useState('Buffalo');

    const [availableDates, setAvailableDates] = useState([]);
    const [selectedDate, setSelectedDate] = useState('');
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [newEffectiveDate, setNewEffectiveDate] = useState(new Date().toISOString().split('T')[0]);

    const [matrixData, setMatrixData] = useState({});
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    const [showCsvModal, setShowCsvModal] = useState(false);
    const [csvUploadDate, setCsvUploadDate] = useState(new Date().toISOString().split('T')[0]);
    const [showNewRateModal, setShowNewRateModal] = useState(false);
    const [csvDataLoaded, setCsvDataLoaded] = useState(false);

    const [selection, setSelection] = useState({ start: null, end: null, isSelecting: false });
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const [showRangeModal, setShowRangeModal] = useState(false);
    const [rangeSettings, setRangeSettings] = useState({ ...MILK_RANGES.Buffalo });

    const fileInputRef = useRef(null);
    const skipFetchRef = useRef(false);
    const isSavingRef = useRef(false);
    const loadingSafetyTimerRef = useRef(null);

    // Safety loading timeout
    useEffect(() => {
        if (saving) return;
        if (!loading) {
            if (loadingSafetyTimerRef.current) { clearTimeout(loadingSafetyTimerRef.current); loadingSafetyTimerRef.current = null; }
            return;
        }
        loadingSafetyTimerRef.current = setTimeout(() => { setLoading(false); }, 12000);
        return () => { if (loadingSafetyTimerRef.current) clearTimeout(loadingSafetyTimerRef.current); };
    }, [loading, saving]);

    const selectionStats = useMemo(() => {
        if (!selection.start || !selection.end) return { count: 0, fatRange: '', snfRange: '' };
        const minFat = Math.min(selection.start.fat, selection.end.fat);
        const maxFat = Math.max(selection.start.fat, selection.end.fat);
        const minSnf = Math.min(selection.start.snf, selection.end.snf);
        const maxSnf = Math.max(selection.start.snf, selection.end.snf);
        const fatSteps = Math.round((maxFat - minFat) * 10) + 1;
        const snfSteps = Math.round((maxSnf - minSnf) * 10) + 1;
        return { count: fatSteps * snfSteps, fatRange: `${minFat.toFixed(1)} - ${maxFat.toFixed(1)}`, snfRange: `${minSnf.toFixed(1)} - ${maxSnf.toFixed(1)}` };
    }, [selection]);

    // ── Load dates ──────────────────────────────────────────────────────────
    const loadDates = async () => {
        setLoading(true);
        try {
            const { supabase } = await import('../lib/supabase');
            const { data, error } = await supabase
                .from('rates')
                .select('effective_date')
                .eq('dairy_id', user?.dairy_id)
                .eq('rate_type', FEDERATION_RATE_TYPE)
                .order('effective_date', { ascending: false })
                .limit(5000);

            if (error) throw error;
            const dates = [...new Set((data || []).map(r => r.effective_date))].sort().reverse();
            setAvailableDates(dates);
            if (dates.length > 0) {
                setSelectedDate(dates[0]);
            } else {
                setSelectedDate(new Date().toISOString().split('T')[0]);
                setAllRates([]);
            }
        } catch (error) {
            console.error('Error loading federation rate dates:', error);
            setAllRates([]);
        } finally {
            setLoading(false);
        }
    };

    // ── Load rates for a date ────────────────────────────────────────────────
    const loadRatesForDate = async (date) => {
        if (!date) return;
        setLoading(true);
        try {
            const { supabase } = await import('../lib/supabase');
            const { data, error } = await supabase
                .from('rates')
                .select('*')
                .eq('dairy_id', user?.dairy_id)
                .eq('effective_date', date)
                .eq('rate_type', FEDERATION_RATE_TYPE)
                .limit(10000);

            if (error) throw error;
            setAllRates(data || []);
        } catch (error) {
            console.error('Error loading federation rates:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.dairy_id) loadDates();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.dairy_id]);

    useEffect(() => {
        if (selectedDate && user?.dairy_id) {
            if (skipFetchRef.current) { skipFetchRef.current = false; return; }
            loadRatesForDate(selectedDate);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDate, user?.dairy_id]);

    // Build matrix lookup from allRates
    useEffect(() => {
        if (csvDataLoaded) return;
        if (isSavingRef.current) { isSavingRef.current = false; return; }

        const sourceDate = isCreatingNew ? newEffectiveDate : selectedDate;
        const lookup = {};
        allRates.forEach(r => {
            if ((r.milk_type || '').toLowerCase() === matrixType.toLowerCase() && r.effective_date === sourceDate) {
                const f = parseFloat(r.fat);
                const s = parseFloat(r.snf);
                if (!isNaN(f) && !isNaN(s)) lookup[`${f.toFixed(1)}-${s.toFixed(1)}`] = r.rate;
            }
        });
        setMatrixData(lookup);
        setHasUnsavedChanges(isCreatingNew);
    }, [allRates, matrixType, selectedDate, isCreatingNew, newEffectiveDate, csvDataLoaded]);

    // ── Cell edit ────────────────────────────────────────────────────────────
    const handleMatrixCellChange = (fat, snf, value) => {
        const key = `${fat.toFixed(1)}-${snf.toFixed(1)}`;
        setMatrixData(prev => ({ ...prev, [key]: value }));
        setHasUnsavedChanges(true);
    };

    // ── Selection handlers ───────────────────────────────────────────────────
    const handleMouseDown = (fat, snf, e) => {
        if (e.button !== 0) return;
        setSelection({ start: { fat, snf }, end: { fat, snf }, isSelecting: true });
    };
    const handleMouseEnter = (fat, snf) => {
        if (selection.isSelecting) setSelection(prev => ({ ...prev, end: { fat, snf } }));
    };
    const handleMouseUp = () => setSelection(prev => ({ ...prev, isSelecting: false }));
    const handleDoubleClick = (fat, snf) => {
        if (!isCellSelected(fat, snf, selection)) setSelection({ start: { fat, snf }, end: { fat, snf }, isSelecting: false });
        setShowUpdateModal(true);
    };

    // ── Bulk update ──────────────────────────────────────────────────────────
    const handleBulkUpdate = (action, value, scope) => {
        const newMatrix = { ...matrixData };
        let updatedCount = 0;
        let minFat, maxFat, minSnf, maxSnf;

        if (scope === 'all') {
            const range = isCreatingNew ? rangeSettings : MILK_RANGES[matrixType];
            minFat = range.fatMin; maxFat = range.fatMax;
            minSnf = range.snfMin; maxSnf = range.snfMax;
        } else {
            if (!selection.start || !selection.end) return;
            minFat = Math.min(selection.start.fat, selection.end.fat);
            maxFat = Math.max(selection.start.fat, selection.end.fat);
            minSnf = Math.min(selection.start.snf, selection.end.snf);
            maxSnf = Math.max(selection.start.snf, selection.end.snf);
        }

        for (let f = minFat; f <= maxFat + 0.001; f += 0.1) {
            for (let s = minSnf; s <= maxSnf + 0.001; s += 0.1) {
                const key = `${f.toFixed(1)}-${s.toFixed(1)}`;
                const cur = parseFloat(newMatrix[key]);
                let nv = cur;
                if (action === 'set') nv = value;
                else if (!isNaN(cur)) {
                    if (action === 'increase') nv = cur + value;
                    if (action === 'decrease') nv = cur - value;
                    if (action === 'multiply') nv = cur * value;
                }
                if (nv !== undefined && !isNaN(nv)) { newMatrix[key] = parseFloat(nv.toFixed(2)).toString(); updatedCount++; }
            }
        }
        if (updatedCount > 0) { setMatrixData(newMatrix); setHasUnsavedChanges(true); showAlert(`✅ ${updatedCount} दर अपडेट झाले`, 'दर अपडेट', 'success'); }
    };

    // ── Save ────────────────────────────────────────────────────────────────
    const handleSaveMatrix = async () => {
        const dateToSave = isCreatingNew ? newEffectiveDate : selectedDate;
        if (!dateToSave) { showAlert('कृपया तारीख निवडा', 'संघ दर', 'warning'); return; }

        const confirmed = await showConfirm(
            `${matrixType} दर ${dateToSave} साठी जतन करायचे?`,
            'संघाचे दूध दर पत्रक', 'जतन करा', 'रद्द करा'
        );
        if (!confirmed) return;

        setSaving(true);
        try {
            const updates = [];
            Object.entries(matrixData).forEach(([key, rateVal]) => {
                if (!rateVal || rateVal === '') return;
                const [fatStr, snfStr] = key.split('-');
                const fat = parseFloat(fatStr);
                const snf = parseFloat(snfStr);
                const parsedRate = parseFloat(rateVal);
                if (!isNaN(fat) && !isNaN(snf) && !isNaN(parsedRate) && parsedRate > 0) {
                    updates.push({ milk_type: matrixType, fat, snf, rate: parsedRate, rate_type: FEDERATION_RATE_TYPE });
                }
            });

            if (!user?.dairy_id) throw new Error('User session invalid');

            const rateUpdates = updates.map(u => ({ ...u, dairy_id: user.dairy_id, effective_date: dateToSave }));
            const { supabase } = await import('../lib/supabase');

            // Delete existing for this date/type
            const { error: deleteError } = await supabase
                .from('rates')
                .delete()
                .eq('dairy_id', user.dairy_id)
                .eq('milk_type', matrixType)
                .eq('effective_date', dateToSave)
                .eq('rate_type', FEDERATION_RATE_TYPE);

            if (deleteError) console.warn('Delete warning:', deleteError);

            // Insert in batches
            if (rateUpdates.length > 0) {
                const BATCH_SIZE = 50;
                for (let i = 0; i < rateUpdates.length; i += BATCH_SIZE) {
                    const batch = rateUpdates.slice(i, i + BATCH_SIZE);
                    let retries = 3;
                    while (retries > 0) {
                        try {
                            const { error: insertError } = await supabase.from('rates').insert(batch);
                            if (insertError) throw insertError;
                            break;
                        } catch (err) {
                            retries--;
                            if (retries === 0) throw err;
                            await new Promise(r => setTimeout(r, 1000));
                        }
                    }
                    if (i + BATCH_SIZE < rateUpdates.length) await new Promise(r => setTimeout(r, 150));
                }
            }

            await loadDates();
            setCsvDataLoaded(false);
            isSavingRef.current = true;
            if (isCreatingNew) {
                skipFetchRef.current = true;
                setIsCreatingNew(false);
                setSelectedDate(dateToSave);
            } else {
                skipFetchRef.current = true;
            }

            showAlert(`✅ ${rateUpdates.length} दर जतन झाले`, 'संघाचे दूध दर पत्रक', 'success');
            setHasUnsavedChanges(false);
        } catch (error) {
            console.error('Error saving federation rates:', error);
            showAlert('जतन करताना त्रुटी: ' + (error.message || error), 'संघाचे दूध दर पत्रक', 'error');
        } finally {
            setSaving(false);
            setLoading(false);
        }
    };

    // ── CSV Upload ───────────────────────────────────────────────────────────
    const parseCSV = (text) => {
        const lines = text.trim().split('\n');
        const errors = [];
        if (lines.length < 2) { errors.push('❌ CSV फाईलमध्ये किमान एक हेडर आणि एक डेटा पंक्ती असणे आवश्यक आहे'); return { data: [], errors }; }
        const headers = lines[0].split(',').map(h => h.trim().replace(/^\uFEFF/, '').toLowerCase());
        const fatIdx = headers.findIndex(h => h.includes('fat'));
        const snfIdx = headers.findIndex(h => h.includes('snf'));
        const rateIdx = headers.findIndex(h => h.includes('rate') || h.includes('price'));
        const milkTypeIdx = headers.findIndex(h => h.includes('milk') || h.includes('type'));
        if (fatIdx === -1) errors.push('❌ "fat" स्तंभ आढळला नाही');
        if (snfIdx === -1) errors.push('❌ "snf" स्तंभ आढळला नाही');
        if (rateIdx === -1) errors.push('❌ "rate" किंवा "price" स्तंभ आढळला नाही');
        if (errors.length > 0) { errors.push('\n📋 आवश्यक CSV स्वरूप:\nmilk_type,fat,snf,rate\nBuffalo,5.5,8.7,35.50'); return { data: [], errors }; }

        const data = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const values = line.split(',').map(v => v.trim());
            const fat = parseFloat(values[fatIdx]);
            const snf = parseFloat(values[snfIdx]);
            const rate = parseFloat(values[rateIdx]);
            const milkType = milkTypeIdx !== -1 ? values[milkTypeIdx] : matrixType;
            if (!isNaN(fat) && !isNaN(snf) && !isNaN(rate) && rate > 0) {
                data.push({ milk_type: milkType, fat, snf, rate });
            } else {
                if (values.some(v => v !== '')) errors.push(`⚠️ पंक्ती ${i}: अवैध मूल्य वगळण्यात आली`);
            }
        }
        return { data, errors };
    };

    const handleCSVUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const result = parseCSV(e.target.result);
                if (result.errors.length > 0 && result.data.length === 0) {
                    showAlert('CSV त्रुटी:\n' + result.errors.slice(0, 5).join('\n'), 'CSV अपलोड', 'error');
                    return;
                }
                const newMatrixData = {};
                let matchCount = 0;
                const targetMilkType = matrixType.toLowerCase();
                result.data.forEach(row => {
                    if ((row.milk_type || '').toLowerCase() === targetMilkType) {
                        const key = `${parseFloat(row.fat).toFixed(1)}-${parseFloat(row.snf).toFixed(1)}`;
                        newMatrixData[key] = row.rate.toString();
                        matchCount++;
                    }
                });
                if (matchCount === 0) { showAlert(`⚠️ ${matrixType} साठी कोणताही दर आढळला नाही`, 'CSV अपलोड', 'warning'); return; }
                setMatrixData(prev => ({ ...prev, ...newMatrixData }));
                setHasUnsavedChanges(true);
                setCsvDataLoaded(true);
                if (csvUploadDate !== selectedDate) { setIsCreatingNew(true); setNewEffectiveDate(csvUploadDate); }
                else { setNewEffectiveDate(csvUploadDate); }
                showAlert(`✅ ${matchCount} दर आयात झाले`, 'CSV अपलोड', 'success');
            } catch (error) {
                showAlert('त्रुटी: ' + error.message, 'CSV अपलोड', 'error');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    const handleDownloadCSV = () => {
        if (Object.keys(matrixData).length === 0) { showAlert('निर्यात करण्यासाठी कोणताही डेटा नाही', 'संघाचे दूध दर पत्रक', 'warning'); return; }
        const defaultRange = isCreatingNew ? rangeSettings : (MILK_RANGES[matrixType] || MILK_RANGES.Buffalo);
        let minFat = defaultRange.fatMin, maxFat = defaultRange.fatMax;
        let minSnf = defaultRange.snfMin, maxSnf = defaultRange.snfMax;
        Object.keys(matrixData).forEach(key => {
            const [fStr, sStr] = key.split('-');
            const f = parseFloat(fStr), s = parseFloat(sStr);
            if (!isNaN(f)) { if (f < minFat) minFat = f; if (f > maxFat) maxFat = f; }
            if (!isNaN(s)) { if (s < minSnf) minSnf = s; if (s > maxSnf) maxSnf = s; }
        });
        const fats = generateRange(minFat, maxFat);
        const snfs = generateRange(minSnf, maxSnf);
        let csvContent = 'milk_type,fat,snf,rate\n';
        fats.forEach(fat => snfs.forEach(snf => {
            const key = `${fat.toFixed(1)}-${snf.toFixed(1)}`;
            const rateVal = matrixData[key];
            if (rateVal && rateVal !== '') csvContent += `${matrixType},${fat.toFixed(1)},${snf.toFixed(1)},${rateVal}\n`;
        }));
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `संघ_दर_${matrixType}_${selectedDate || 'new'}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // ── Render Matrix ────────────────────────────────────────────────────────
    const renderMatrix = () => {
        const defaultRange = isCreatingNew ? rangeSettings : (MILK_RANGES[matrixType] || MILK_RANGES.Buffalo);
        let minFat = defaultRange.fatMin, maxFat = defaultRange.fatMax;
        let minSnf = defaultRange.snfMin, maxSnf = defaultRange.snfMax;
        Object.keys(matrixData).forEach(key => {
            const [fStr, sStr] = key.split('-');
            const f = parseFloat(fStr), s = parseFloat(sStr);
            if (!isNaN(f)) { if (f < minFat) minFat = f; if (f > maxFat) maxFat = f; }
            if (!isNaN(s)) { if (s < minSnf) minSnf = s; if (s > maxSnf) maxSnf = s; }
        });
        const fats = generateRange(minFat, maxFat);
        const snfs = generateRange(minSnf, maxSnf);

        return (
            <div style={{ overflowX: 'auto', background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', border: '1px solid #e5e7eb', flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Matrix toolbar */}
                <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', left: 0 }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        {['Buffalo', 'Cow'].map(type => (
                            <button key={type} onClick={async () => {
                                if (hasUnsavedChanges) {
                                    const discard = await showConfirm('न जतन केलेले बदल गमवायचे?', 'संघाचे दूध दर पत्रक', 'टाका', 'रद्द करा');
                                    if (!discard) return;
                                }
                                setMatrixType(type);
                            }} style={{
                                padding: '8px 16px', borderRadius: '8px', border: 'none', fontWeight: '600', cursor: 'pointer',
                                background: matrixType === type ? '#7c3aed' : '#f3f4f6',
                                color: matrixType === type ? 'white' : '#4b5563'
                            }}>
                                {type === 'Buffalo' ? '🐃 म्हैस' : '🐄 गाय'}
                            </button>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={() => { setCsvUploadDate(selectedDate || new Date().toISOString().split('T')[0]); setShowCsvModal(true); }}
                            style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', color: '#6b7280', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Upload size={18} /> CSV अपलोड
                        </button>
                        <button onClick={handleDownloadCSV}
                            style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', color: '#6b7280', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Download size={18} /> निर्यात
                        </button>
                        <button onClick={handleSaveMatrix} disabled={!hasUnsavedChanges || loading}
                            style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px',
                                background: hasUnsavedChanges ? '#7c3aed' : '#e5e7eb',
                                color: hasUnsavedChanges ? 'white' : '#9ca3af',
                                cursor: hasUnsavedChanges ? 'pointer' : 'not-allowed'
                            }}>
                            <Save size={18} />
                            {isCreatingNew ? `नवीन दर जतन करा (${newEffectiveDate})` : 'बदल जतन करा'}
                        </button>
                    </div>
                </div>

                {/* Scrollable table */}
                <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
                    <table style={{ borderCollapse: 'separate', borderSpacing: 0, userSelect: 'none' }} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 20 }}>
                            <tr>
                                <th style={{ padding: '12px', background: '#f5f3ff', borderBottom: '1px solid #d1d5db', borderRight: '1px solid #d1d5db', position: 'sticky', left: 0, zIndex: 21, minWidth: '80px', fontSize: '13px', color: '#6b7280', fontWeight: '600' }}>
                                    FAT / SNF
                                </th>
                                {snfs.map(snf => (
                                    <th key={snf} style={{ padding: '8px', background: '#f5f3ff', borderBottom: '1px solid #d1d5db', borderRight: '1px solid #e5e7eb', fontSize: '13px', minWidth: '60px', textAlign: 'center', color: '#6b7280', fontWeight: '600', cursor: 'pointer' }}
                                        onClick={() => {
                                            const range = isCreatingNew ? rangeSettings : MILK_RANGES[matrixType];
                                            setSelection({ start: { fat: range.fatMin, snf }, end: { fat: range.fatMax, snf }, isSelecting: false });
                                        }}>
                                        {snf.toFixed(1)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {fats.map(fat => (
                                <tr key={fat}>
                                    <th style={{ padding: '8px', background: '#f5f3ff', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #d1d5db', position: 'sticky', left: 0, zIndex: 10, fontSize: '13px', color: '#6b7280', fontWeight: '600', cursor: 'pointer' }}
                                        onClick={() => {
                                            const range = isCreatingNew ? rangeSettings : MILK_RANGES[matrixType];
                                            setSelection({ start: { fat, snf: range.snfMin }, end: { fat, snf: range.snfMax }, isSelecting: false });
                                        }}>
                                        {fat.toFixed(1)}
                                    </th>
                                    {snfs.map(snf => {
                                        const key = `${fat.toFixed(1)}-${snf.toFixed(1)}`;
                                        const isSelected = isCellSelected(fat, snf, selection);
                                        return (
                                            <td key={snf} style={{
                                                borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6', padding: 0,
                                                background: isSelected ? '#ede9fe' : 'transparent',
                                                border: isSelected ? '1px solid #7c3aed' : '1px solid #f3f4f6'
                                            }}
                                                onMouseDown={e => handleMouseDown(fat, snf, e)}
                                                onMouseEnter={() => handleMouseEnter(fat, snf)}
                                                onDoubleClick={() => handleDoubleClick(fat, snf)}
                                                onContextMenu={e => { e.preventDefault(); handleDoubleClick(fat, snf); }}>
                                                {(loading && !saving) ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', height: '100%', minHeight: '34px' }}>
                                                        <div className="fed-rate-skeleton-cell" />
                                                    </div>
                                                ) : (
                                                    <input type="text" value={matrixData[key] || ''} placeholder="-"
                                                        onChange={e => handleMatrixCellChange(fat, snf, e.target.value)}
                                                        style={{ width: '100%', height: '100%', padding: '8px 4px', border: 'none', textAlign: 'center', background: 'transparent', outline: 'none', fontSize: '13px', minWidth: '60px', cursor: 'cell' }}
                                                    />
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div style={{ padding: '16px 32px', maxWidth: '1600px', margin: '0 auto', minHeight: '100%', display: 'flex', flexDirection: 'column', background: 'transparent' }}>
            <AlertComponent />

            {/* Saving overlay */}
            {saving && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998 }}>
                    <Loader text="दर जतन होत आहेत..." />
                </div>
            )}

            <style>{`
                @keyframes fedRateShimmer { 0% { background-position: -200px 0; } 100% { background-position: calc(200px + 100%) 0; } }
                .fed-rate-skeleton-cell { animation: fedRateShimmer 1.5s infinite linear; background: linear-gradient(to right, #ede9fe 4%, #ddd6fe 25%, #ede9fe 36%); background-size: 1000px 100%; border-radius: 4px; height: 16px; width: 70%; margin: 0 auto; }
            `}</style>

            {/* ── Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexShrink: 0, gap: '24px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
                <div>
                    <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#111827', display: 'flex', alignItems: 'center', gap: '12px', margin: '0 0 6px 0' }}>
                        <Building2 size={26} color="#7c3aed" />
                        संघाचे दूध संस्थेस द्यायचे दर पत्रक
                        <span style={{ fontSize: '12px', fontWeight: '600', background: '#ede9fe', color: '#6d28d9', padding: '3px 10px', borderRadius: '20px' }}>
                            Federation Rate Chart
                        </span>
                    </h1>
                    <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
                        संघाने संस्थेला देण्याचे दर — हे दर फक्त संघ पावतीसाठी वापरले जातात
                    </p>
                </div>

                {/* Date selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'white', padding: '10px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    {isCreatingNew ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>नवीन दर तारीख:</span>
                            <input type="date" value={newEffectiveDate} onChange={e => setNewEffectiveDate(e.target.value)}
                                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none' }} />
                            <button onClick={() => setIsCreatingNew(false)}
                                style={{ padding: '8px', borderRadius: '8px', border: 'none', background: '#f3f4f6', cursor: 'pointer', color: '#6b7280', fontSize: '12px' }}>
                                रद्द करा
                            </button>
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Calendar size={18} color="#6b7280" />
                                <span style={{ fontSize: '14px', color: '#6b7280' }}>तारीख:</span>
                                <select value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', cursor: 'pointer', background: '#f9fafb' }}>
                                    {availableDates.map(date => (
                                        <option key={date} value={date}>{date}{date === new Date().toISOString().split('T')[0] ? ' (आज)' : ''}</option>
                                    ))}
                                    {availableDates.length === 0 && <option value="">कोणताही दर सापडला नाही</option>}
                                </select>
                                <button onClick={async () => { await loadDates(); if (selectedDate) await loadRatesForDate(selectedDate); }}
                                    title="रिफ्रेश करा"
                                    style={{ padding: '8px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', color: '#6b7280' }}>
                                    <RefreshCw size={16} />
                                </button>
                            </div>
                            <button onClick={() => setShowNewRateModal(true)}
                                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#7c3aed', color: 'white', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <PlusCircle size={16} /> नवीन दर
                            </button>
                        </>
                    )}
                </div>

                <input ref={fileInputRef} type="file" accept=".csv" onChange={handleCSVUpload} style={{ display: 'none' }} />
            </div>

            {/* ── Matrix ── */}
            {renderMatrix()}

            {/* ── Modals ── */}
            <RateUpdateModal isOpen={showUpdateModal} onClose={() => setShowUpdateModal(false)} onApply={handleBulkUpdate} selectionStats={selectionStats} />

            <RangeInputModal
                isOpen={showRangeModal}
                matrixType={matrixType}
                onClose={() => setShowRangeModal(false)}
                onApply={(settings) => {
                    setRangeSettings(settings);
                    setShowRangeModal(false);
                    setIsCreatingNew(true);
                    setNewEffectiveDate(new Date().toISOString().split('T')[0]);
                    setMatrixData({});
                    setHasUnsavedChanges(false);
                }}
            />

            {/* New Rate Options Modal */}
            {showNewRateModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: 'white', borderRadius: '16px', padding: '32px', maxWidth: '500px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                        <h2 style={{ margin: '0 0 16px 0', fontSize: '24px', color: '#111827' }}>➕ नवीन संघ दर</h2>
                        <p style={{ margin: '0 0 24px 0', color: '#6b7280', fontSize: '15px' }}>संघाचे नवीन दर कसे जोडायचे?</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <button onClick={() => { setShowNewRateModal(false); setShowCsvModal(true); }}
                                style={{ padding: '20px', borderRadius: '12px', border: '2px solid #7c3aed', background: '#f5f3ff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '16px', transition: 'all 0.2s' }}
                                onMouseOver={e => e.currentTarget.style.background = '#ede9fe'}
                                onMouseOut={e => e.currentTarget.style.background = '#f5f3ff'}>
                                <Upload size={32} color="#7c3aed" />
                                <div style={{ textAlign: 'left', flex: 1 }}>
                                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>📊 CSV अपलोड करा</div>
                                    <div style={{ fontSize: '13px', color: '#6b7280' }}>CSV फाईलमधून दर आयात करा</div>
                                </div>
                            </button>
                            <button onClick={() => { setShowNewRateModal(false); setShowRangeModal(true); }}
                                style={{ padding: '20px', borderRadius: '12px', border: '2px solid #d1d5db', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '16px', transition: 'all 0.2s' }}
                                onMouseOver={e => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.borderColor = '#9ca3af'; }}
                                onMouseOut={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#d1d5db'; }}>
                                <PlusCircle size={32} color="#6b7280" />
                                <div style={{ textAlign: 'left', flex: 1 }}>
                                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>✍️ हाताने टाका</div>
                                    <div style={{ fontSize: '13px', color: '#6b7280' }}>तक्त्यात थेट दर टाका</div>
                                </div>
                            </button>
                        </div>
                        <button onClick={() => setShowNewRateModal(false)}
                            style={{ width: '100%', marginTop: '16px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', color: '#6b7280', fontWeight: '600', cursor: 'pointer' }}>
                            रद्द करा
                        </button>
                    </div>
                </div>
            )}

            {/* CSV Template Modal */}
            {showCsvModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: 'white', borderRadius: '16px', padding: '32px', maxWidth: '700px', width: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                        <h2 style={{ margin: '0 0 20px 0', fontSize: '24px', color: '#111827' }}>📊 CSV अपलोड — संघ दर</h2>
                        <div style={{ background: '#f5f3ff', padding: '16px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #7c3aed' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>📅 दर तारीख</label>
                            <input type="date" value={csvUploadDate} onChange={e => setCsvUploadDate(e.target.value)}
                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '2px solid #7c3aed', fontSize: '15px', outline: 'none', fontWeight: '600', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ background: '#f3f4f6', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                            <p style={{ margin: '0 0 12px 0', fontWeight: '600', color: '#374151' }}>CSV स्वरूप:</p>
                            <pre style={{ background: '#1f2937', color: '#10b981', padding: '16px', borderRadius: '8px', overflow: 'auto', fontSize: '13px', fontFamily: 'Courier New, monospace', margin: 0 }}>
{`milk_type,fat,snf,rate
Buffalo,5.5,8.7,35.50
Buffalo,5.6,8.7,36.00
Cow,3.0,8.2,28.00`}
                            </pre>
                        </div>
                        <div style={{ background: '#fef3c7', padding: '12px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #fbbf24' }}>
                            <p style={{ margin: 0, fontSize: '14px', color: '#92400e' }}>
                                ⚠️ <strong>महत्त्वाचे:</strong> CSV अपलोड केल्यावर त्याच तारखेचे जुने दर बदलले जातील
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button onClick={() => { setShowCsvModal(false); setCsvUploadDate(new Date().toISOString().split('T')[0]); }}
                                style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', color: '#6b7280', fontWeight: '600', cursor: 'pointer' }}>
                                रद्द करा
                            </button>
                            <button onClick={() => { setShowCsvModal(false); fileInputRef.current?.click(); }}
                                style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#7c3aed', color: 'white', fontWeight: '600', cursor: 'pointer' }}>
                                📂 फाईल निवडा
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default FederationRates;
