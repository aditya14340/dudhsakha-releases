import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { IndianRupee, Save, Calendar, Clock, PlusCircle, Upload, Download, RefreshCw } from 'lucide-react';
import Loader from '../components/Loader';
import { useAlert } from '../hooks/useAlert';

const MILK_RANGES = {
    Buffalo: { fatMin: 5.5, fatMax: 15.9, snfMin: 8.7, snfMax: 10.0 },
    Cow: { fatMin: 3.0, fatMax: 5.0, snfMin: 8.2, snfMax: 9.0 }
};

const generateRange = (start, end) => {
    const arr = [];
    for (let i = start; i <= end + 0.001; i += 0.1) {
        arr.push(parseFloat(i.toFixed(1)));
    }
    return arr;
};

const SPLIT_POINT = 11.0;

// Helper to check if a cell is within the selected range
const isCellSelected = (fat, snf, selection) => {
    if (!selection || !selection.start || !selection.end) return false;
    const minFat = Math.min(selection.start.fat, selection.end.fat);
    const maxFat = Math.max(selection.start.fat, selection.end.fat);
    const minSnf = Math.min(selection.start.snf, selection.end.snf);
    const maxSnf = Math.max(selection.start.snf, selection.end.snf);

    // Using slightly loose comparison for floats
    return fat >= minFat - 0.01 && fat <= maxFat + 0.01 &&
        snf >= minSnf - 0.01 && snf <= maxSnf + 0.01;
};

const RangeInputModal = ({ isOpen, onClose, onApply, matrixType }) => {
    const { t } = useTranslation();
    const range = MILK_RANGES[matrixType] || MILK_RANGES.Buffalo;
    const [settings, setSettings] = useState({
        fatMin: range.fatMin,
        fatMax: range.fatMax,
        snfMin: range.snfMin,
        snfMax: range.snfMax
    });

    useEffect(() => {
        if (isOpen) {
            setSettings({
                fatMin: range.fatMin,
                fatMax: range.fatMax,
                snfMin: range.snfMin,
                snfMax: range.snfMax
            });
        }
    }, [isOpen, range, matrixType]);

    if (!isOpen) return null;

    const handleChange = (field, val) => {
        setSettings(prev => ({ ...prev, [field]: parseFloat(val) || 0 }));
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)', zIndex: 1100,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                background: 'white', padding: '24px', borderRadius: '16px',
                width: '90%', maxWidth: '450px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
            }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    📏 {t('rates.setRangeTitle')}
                </h3>

                <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '20px' }}>
                    {t('rates.rangeDesc')}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>{t('rates.fatMin')}</label>
                        <input
                            type="number"
                            step="0.1"
                            value={settings.fatMin}
                            onChange={e => handleChange('fatMin', e.target.value)}
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>{t('rates.fatMax')}</label>
                        <input
                            type="number"
                            step="0.1"
                            value={settings.fatMax}
                            onChange={e => handleChange('fatMax', e.target.value)}
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>{t('rates.snfMin')}</label>
                        <input
                            type="number"
                            step="0.1"
                            value={settings.snfMin}
                            onChange={e => handleChange('snfMin', e.target.value)}
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>{t('rates.snfMax')}</label>
                        <input
                            type="number"
                            step="0.1"
                            value={settings.snfMax}
                            onChange={e => handleChange('snfMax', e.target.value)}
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontWeight: '600' }}>
                        {t('rates.buttons.cancel')}
                    </button>
                    <button
                        onClick={() => onApply(settings)}
                        style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        {t('rates.buttons.proceed')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const RateUpdateModal = ({ isOpen, onClose, onApply, selectionStats, initialValue }) => {
    const { t } = useTranslation();
    const [action, setAction] = useState('set'); // set, increase, decrease, multiply
    const [value, setValue] = useState('');
    const [scope, setScope] = useState('selection'); // selection, row, column, all

    useEffect(() => {
        if (isOpen) setValue('');
    }, [isOpen]);

    if (!isOpen) return null;

    const handleApply = () => {
        const numVal = parseFloat(value);
        if (isNaN(numVal)) {
            alert(t('rates.bulkUpdate.invalidNumber'));
            return;
        }
        onApply(action, numVal, scope);
        onClose();
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                background: 'white', padding: '24px', borderRadius: '16px',
                width: '90%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
            }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 'bold' }}>
                    {t('rates.bulkUpdate.title')}
                </h3>

                <div style={{ marginBottom: '16px', background: '#f3f4f6', padding: '12px', borderRadius: '8px', fontSize: '14px' }}>
                    {t('rates.bulkUpdate.selectedCount', { count: selectionStats.count })} <br />
                    {t('rates.bulkUpdate.range', { fatRange: selectionStats.fatRange, snfRange: selectionStats.snfRange })}
                </div>

                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>{t('rates.bulkUpdate.action')}</label>
                    <select
                        value={action}
                        onChange={e => setAction(e.target.value)}
                        style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                    >
                        <option value="set">{t('rates.bulkUpdate.setValue')}</option>
                        <option value="increase">{t('rates.bulkUpdate.increaseBy')}</option>
                        <option value="decrease">{t('rates.bulkUpdate.decreaseBy')}</option>
                        <option value="multiply">{t('rates.bulkUpdate.multiplyBy')}</option>
                    </select>
                </div>

                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>{t('rates.bulkUpdate.value')}</label>
                    <input
                        type="number"
                        value={value}
                        onChange={e => setValue(e.target.value)}
                        placeholder={t('rates.bulkUpdate.enterValue')}
                        autoFocus
                        style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                    />
                </div>

                <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>{t('rates.bulkUpdate.applyTo')}</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                            <input type="radio" name="scope" value="selection" checked={scope === 'selection'} onChange={() => setScope('selection')} />
                            {t('rates.bulkUpdate.selectedCells')}
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                            <input type="radio" name="scope" value="all" checked={scope === 'all'} onChange={() => setScope('all')} />
                            {t('rates.bulkUpdate.entireTable')}
                        </label>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}>
                        {t('rates.buttons.cancel')}
                    </button>
                    <button onClick={handleApply} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>
                        {t('rates.bulkUpdate.applyParameters')}
                    </button>
                </div>
            </div>
        </div>
    );
};


function Rates({ user }) {
    const { t } = useTranslation();
    const { showAlert, showConfirm, AlertComponent } = useAlert();
    const [allRates, setAllRates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [matrixType, setMatrixType] = useState('Buffalo'); // For matrix view

    const [availableDates, setAvailableDates] = useState([]);
    const [selectedDate, setSelectedDate] = useState('');
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [newEffectiveDate, setNewEffectiveDate] = useState(new Date().toISOString().split('T')[0]);

    const [matrixData, setMatrixData] = useState({}); // { `fat-snf`: rate }
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    const [showCsvModal, setShowCsvModal] = useState(false);
    const [csvUploadDate, setCsvUploadDate] = useState(new Date().toISOString().split('T')[0]);

    const [showNewRateModal, setShowNewRateModal] = useState(false);
    const [csvDataLoaded, setCsvDataLoaded] = useState(false); // Track if CSV data is loaded

    // Selection State
    const [selection, setSelection] = useState({ start: null, end: null, isSelecting: false });
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const [showRangeModal, setShowRangeModal] = useState(false);
    const [rangeSettings, setRangeSettings] = useState({ ...MILK_RANGES.Buffalo });

    // ── Rate Chart Picker (new) ──────────────────────────────────────────────
    const [showChartPicker, setShowChartPicker] = useState(true);  // opens every visit
    const [activeRateType, setActiveRateType] = useState(null);    // e.g. 'sangh', 'Vibhag A'
    const [availableCharts, setAvailableCharts] = useState([]);    // [{name, dateCount}]
    const [chartsLoading, setChartsLoading] = useState(false);     // skeleton while fetching
    const [showCreateChart, setShowCreateChart] = useState(false);
    const [newChartName, setNewChartName] = useState('');

    // ── Permission helper ────────────────────────────────────────────────────
    const isEmployee = user?.role !== 'admin' && user?.role !== 'super_admin';

    // Quick calculations for modal
    const selectionStats = React.useMemo(() => {
        if (!selection.start || !selection.end) return { count: 0, fatRange: '', snfRange: '' };
        const minFat = Math.min(selection.start.fat, selection.end.fat);
        const maxFat = Math.max(selection.start.fat, selection.end.fat);
        const minSnf = Math.min(selection.start.snf, selection.end.snf);
        const maxSnf = Math.max(selection.start.snf, selection.end.snf);

        // Approximate count based on step 0.1
        const fatSteps = Math.round((maxFat - minFat) * 10) + 1;
        const snfSteps = Math.round((maxSnf - minSnf) * 10) + 1;

        return {
            count: fatSteps * snfSteps,
            fatRange: `${minFat.toFixed(1)} - ${maxFat.toFixed(1)}`,
            snfRange: `${minSnf.toFixed(1)} - ${maxSnf.toFixed(1)}`
        };
    }, [selection]);

    const skipFetchRef = useRef(false);

    const isSavingRef = useRef(false);
    const loadingSafetyTimerRef = useRef(null);

    useEffect(() => {
        if (saving) return;
        if (!loading) {
            if (loadingSafetyTimerRef.current) {
                clearTimeout(loadingSafetyTimerRef.current);
                loadingSafetyTimerRef.current = null;
            }
            return;
        }

        // Safety net: prevent permanent loading lock when a fetch sequence hangs.
        loadingSafetyTimerRef.current = setTimeout(() => {
            setLoading(false);
            console.warn('Rates loading auto-cleared by safety timeout');
        }, 12000);

        return () => {
            if (loadingSafetyTimerRef.current) {
                clearTimeout(loadingSafetyTimerRef.current);
                loadingSafetyTimerRef.current = null;
            }
        };
    }, [loading, saving]);

    // Load all distinct rate chart names for this dairy
    const loadAvailableCharts = async () => {
        setChartsLoading(true);
        try {
            const { supabase } = await import('../lib/supabase');
            const { data, error } = await supabase
                .from('rates')
                .select('rate_type, effective_date')
                .eq('dairy_id', user?.dairy_id);

            if (error) throw error;

            // Group by rate_type and count distinct dates
            const chartMap = {};
            (data || []).forEach(r => {
                const name = r.rate_type || 'sangh';
                if (name === 'federation_dar') return; // Federation Rate has its own dedicated page — never show here
                if (!chartMap[name]) chartMap[name] = new Set();
                chartMap[name].add(r.effective_date);
            });

            // Always ensure 'sangh' appears even if empty
            if (!chartMap['sangh']) chartMap['sangh'] = new Set();

            const charts = Object.entries(chartMap).map(([name, dates]) => ({
                name,
                dateCount: dates.size
            }));

            // Sort: sangh first, then alphabetical
            charts.sort((a, b) => {
                if (a.name === 'sangh') return -1;
                if (b.name === 'sangh') return 1;
                return a.name.localeCompare(b.name);
            });

            setAvailableCharts(charts);
        } catch (err) {
            console.error('Error loading chart types:', err);
            setAvailableCharts([{ name: 'sangh', dateCount: 0 }]);
        } finally {
            setChartsLoading(false);
        }
    };

    const loadDates = async (rateType) => {
        const chartType = rateType || activeRateType || 'sangh';
        setLoading(true);
        try {
            const { supabase } = await import('../lib/supabase');

            let query = supabase
                .from('rates')
                .select('effective_date')
                .eq('dairy_id', user?.dairy_id)
                .order('effective_date', { ascending: false })
                .limit(5000);

            if (chartType === 'sangh') {
                query = query.or('rate_type.eq.sangh,rate_type.is.null');
            } else {
                query = query.eq('rate_type', chartType);
            }

            const { data: fallbackData, error: fallbackError } = await query;

            const dates = [...new Set((fallbackData || []).map(r => r.effective_date))].sort().reverse();
            setAvailableDates(dates);

            if (dates.length > 0) {
                setSelectedDate(dates[0]);
            } else {
                setSelectedDate(new Date().toISOString().split('T')[0]);
                setAllRates([]);
            }
        } catch (error) {
            console.error("Error loading dates:", error);
            setAllRates([]);
        } finally {
            setLoading(false);
        }
    };

    const loadRatesForDate = async (date, rateType) => {
        if (!date) return;
        const chartType = rateType || activeRateType || 'sangh';
        setLoading(true);
        try {
            const { supabase } = await import('../lib/supabase');
            let query = supabase
                .from('rates')
                .select('*')
                .eq('dairy_id', user?.dairy_id)
                .eq('effective_date', date)
                .limit(10000);

            if (chartType === 'sangh') {
                query = query.or('rate_type.eq.sangh,rate_type.is.null');
            } else {
                query = query.eq('rate_type', chartType);
            }

            const { data, error } = await query;

            if (error) throw error;
            setAllRates(data || []);
        } catch (error) {
            console.error("Error loading rates for date:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.dairy_id) {
            loadAvailableCharts();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.dairy_id]);

    useEffect(() => {
        if (activeRateType && user?.dairy_id) {
            setSelectedDate('');
            loadDates(activeRateType);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeRateType, user?.dairy_id]);

    useEffect(() => {
        if (selectedDate && user?.dairy_id && activeRateType) {
            if (skipFetchRef.current) {
                console.log("Skipping fetch due to recent save (Optimistic UI)");
                skipFetchRef.current = false;
                return;
            }
            loadRatesForDate(selectedDate, activeRateType);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDate, user?.dairy_id, activeRateType]);

    useEffect(() => {
        if (!activeRateType) return;

        if (csvDataLoaded) {
            return;
        }

        if (isSavingRef.current) {



            isSavingRef.current = false;
            return;
        }

        const lookup = {};


        const sourceDate = isCreatingNew ? newEffectiveDate : selectedDate;

        allRates.forEach(r => {
            if ((r.milk_type || '').toLowerCase() === matrixType.toLowerCase() && (r.effective_date || '1970-01-01') === sourceDate) {
                const f = parseFloat(r.fat);
                const s = parseFloat(r.snf);
                if (!isNaN(f) && !isNaN(s)) {
                    lookup[`${f.toFixed(1)}-${s.toFixed(1)}`] = r.rate;
                }
            }
        });
        setMatrixData(lookup);
        setHasUnsavedChanges(isCreatingNew); // If creating new, effectively "unsaved" until saved
    }, [allRates, matrixType, selectedDate, isCreatingNew, newEffectiveDate, csvDataLoaded, activeRateType]);

    const handleMatrixCellChange = (fat, snf, value) => {
        const key = `${fat.toFixed(1)}-${snf.toFixed(1)}`;
        setMatrixData(prev => ({
            ...prev,
            [key]: value
        }));
        setHasUnsavedChanges(true);
    };

    // --- Selection Handlers ---
    const handleMouseDown = (fat, snf, e) => {
        // Only left click triggers selection start, right click handled by ContextMenu (future) or simple modal
        if (e.button !== 0) return;
        setSelection({ start: { fat, snf }, end: { fat, snf }, isSelecting: true });
    };

    const handleMouseEnter = (fat, snf) => {
        if (selection.isSelecting) {
            setSelection(prev => ({ ...prev, end: { fat, snf } }));
        }
    };

    const handleMouseUp = () => {
        setSelection(prev => ({ ...prev, isSelecting: false }));
    };

    const handleDoubleClick = (fat, snf) => {
        // If double clicked cell is NOT in current selection, select it first
        if (!isCellSelected(fat, snf, selection)) {
            setSelection({ start: { fat, snf }, end: { fat, snf }, isSelecting: false });
        }
        setShowUpdateModal(true);
    };

    const handleBulkUpdate = (action, value, scope) => {
        const newMatrix = { ...matrixData };
        let updatedCount = 0;

        // Determine range to iterate
        let minFat, maxFat, minSnf, maxSnf;

        if (scope === 'all') {
            const range = isCreatingNew ? rangeSettings : MILK_RANGES[matrixType];
            minFat = range.fatMin; maxFat = range.fatMax;
            minSnf = range.snfMin; maxSnf = range.snfMax;
        } else {
            // Selection scope
            if (!selection.start || !selection.end) return;
            minFat = Math.min(selection.start.fat, selection.end.fat);
            maxFat = Math.max(selection.start.fat, selection.end.fat);
            minSnf = Math.min(selection.start.snf, selection.end.snf);
            maxSnf = Math.max(selection.start.snf, selection.end.snf);
        }

        // Iterate through all cells in range
        // We use the same generation logic or just loop mathematically
        for (let f = minFat; f <= maxFat + 0.001; f += 0.1) {
            for (let s = minSnf; s <= maxSnf + 0.001; s += 0.1) {
                const key = `${f.toFixed(1)}-${s.toFixed(1)}`;
                const currentVal = parseFloat(newMatrix[key]);

                let newVal = currentVal;

                if (action === 'set') {
                    newVal = value;
                } else if (!isNaN(currentVal)) {
                    // Only do math if cell has a value
                    if (action === 'increase') newVal = currentVal + value;
                    if (action === 'decrease') newVal = currentVal - value;
                    if (action === 'multiply') newVal = currentVal * value;
                }

                if (newVal !== undefined && !isNaN(newVal)) {
                    newMatrix[key] = parseFloat(newVal.toFixed(2)).toString(); // Keep 2 decimal string
                    updatedCount++;
                }
            }
        }

        if (updatedCount > 0) {
            setMatrixData(newMatrix);
            setHasUnsavedChanges(true);
            showAlert(t('rates.bulkUpdate.successMessage', { count: updatedCount }), t('rates.bulkUpdate.title'), 'success');
        }
    };

    const handleSaveMatrix = async () => {
        const dateToSave = isCreatingNew ? newEffectiveDate : selectedDate;

        if (!dateToSave) {
            showAlert(t('rates.alerts.selectDate'), t('rates.title'), 'warning');
            return;
        }

        const confirmed = await showConfirm(
            t('rates.alerts.saveConfirm', { type: t(`rates.buttons.${matrixType.toLowerCase()}`), date: dateToSave }),
            t('rates.title'),
            t('rates.buttons.saveChanges'),
            t('rates.buttons.cancel')
        );

        if (!confirmed) return;

        setSaving(true);
        try {
            console.log(`🔍 Preparing to save ${matrixType} rates for ${dateToSave}`);
            console.log(`📊 Matrix data has ${Object.keys(matrixData).length} total cells`);

            const updates = [];

            Object.entries(matrixData).forEach(([key, rateVal]) => {
                if (!rateVal || rateVal === '') return;

                const [fatStr, snfStr] = key.split('-');
                const fat = parseFloat(fatStr);
                const snf = parseFloat(snfStr);
                const parsedRate = parseFloat(rateVal);

                if (!isNaN(fat) && !isNaN(snf) && !isNaN(parsedRate) && parsedRate > 0) {
                    updates.push({
                        milk_type: matrixType,
                        fat: fat,
                        snf: snf,
                        rate: parsedRate,
                        rate_type: activeRateType || 'sangh'
                    });
                }
            });

            console.log(`✏️ Prepared ${updates.length} valid rates from ${Object.keys(matrixData).length} matrix cells`);

            const emptyCount = Object.values(matrixData).filter(v => !v || v === '').length;
            const filledCount = Object.keys(matrixData).length - emptyCount;
            console.log(`📈 Stats: ${filledCount} filled, ${emptyCount} empty, ${Object.keys(matrixData).length - updates.length} filtered out`);

            if (!user?.dairy_id) throw new Error('User session invalid');

            const rateUpdates = updates.map(u => ({
                ...u,
                dairy_id: user.dairy_id,
                effective_date: dateToSave
            }));

            const { supabase } = await import('../lib/supabase');

            let deleteQuery = supabase
                .from('rates')
                .delete()
                .eq('dairy_id', user.dairy_id)
                .eq('milk_type', matrixType)
                .eq('effective_date', dateToSave);

            const typeToSave = activeRateType || 'sangh';
            if (typeToSave === 'sangh') {
                deleteQuery = deleteQuery.or('rate_type.eq.sangh,rate_type.is.null');
            } else {
                deleteQuery = deleteQuery.eq('rate_type', typeToSave);
            }

            const { error: deleteError } = await deleteQuery;

            if (rateUpdates.length > 0) {
                console.log(`💾 Preparing to save ${rateUpdates.length} rates for ${matrixType} on ${dateToSave}`);

                // Reduced batch size for better reliability
                const BATCH_SIZE = 50;
                let totalInserted = 0;

                for (let i = 0; i < rateUpdates.length; i += BATCH_SIZE) {
                    const batch = rateUpdates.slice(i, i + BATCH_SIZE);
                    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
                    const totalBatches = Math.ceil(rateUpdates.length / BATCH_SIZE);

                    console.log(`📦 Saving batch ${batchNum}/${totalBatches} (${batch.length} rates)...`);

                    // Add retry logic for reliability
                    let retries = 3;
                    while (retries > 0) {
                        try {
                            const { data, error: insertError } = await supabase
                                .from('rates')
                                .insert(batch)
                                .select(); // Verify what was actually inserted

                            if (insertError) throw insertError;

                            const insertedCount = data?.length || 0;
                            totalInserted += insertedCount;

                            if (insertedCount !== batch.length) {
                                console.error(`⚠️ Batch ${batchNum}: Expected ${batch.length} rows but only inserted ${insertedCount}`);
                                throw new Error(`Partial insert detected in batch ${batchNum}`);
                            }

                            console.log(`✓ Batch ${batchNum} saved: ${insertedCount} rates`);
                            break; // Success
                        } catch (err) {
                            retries--;
                            console.warn(`❌ Batch ${batchNum} insert failed, retrying... (${retries} left)`, err);
                            if (retries === 0) {
                                throw new Error(`Failed to save batch ${batchNum} after retries: ${err.message || err}`);
                            }
                            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
                        }
                    }
                    // Longer delay for larger datasets to prevent database overload
                    if (i + BATCH_SIZE < rateUpdates.length) {
                        const delay = rateUpdates.length > 500 ? 200 : 150;
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }

                console.log(`✅ Save complete! Total rates saved: ${totalInserted}/${rateUpdates.length}`);

                // Verify we didn't lose any data
                if (totalInserted !== rateUpdates.length) {
                    throw new Error(`Data loss detected! Expected ${rateUpdates.length} but only saved ${totalInserted}`);
                }
            }

            await new Promise(resolve => setTimeout(resolve, 1000));


            const preservedRates = allRates.filter(r => {
                return !(r.milk_type === matrixType && r.effective_date === dateToSave && (r.rate_type || 'sangh') === (activeRateType || 'sangh'));
            });

            const newAllRates = [...preservedRates, ...rateUpdates];

            isSavingRef.current = true;

            setAllRates(newAllRates);


            await loadDates();



            setCsvDataLoaded(false);
            if (isCreatingNew) {

                skipFetchRef.current = true;
                setIsCreatingNew(false);
                setSelectedDate(dateToSave);
            } else {



                skipFetchRef.current = true;

            }

            showAlert(t('rates.alerts.saveSuccess'), t('rates.title'), 'success');
            setHasUnsavedChanges(false);

            // Background rebuild after save (non-blocking)
            if (user?.dairy_id && window.electron) {
                import('../lib/supabase').then(({ supabase }) => {
                    supabase.auth.getSession().then(({ data: { session } }) => {
                        window.electron.invoke('rates:full-rebuild', {
                            dairyId:   user.dairy_id,
                            authToken: session?.access_token || null,
                        }).then(r => console.log('[RatesCache] Post-save rebuild:', r))
                          .catch(err => console.warn('[RatesCache] Post-save rebuild failed:', err));
                    });
                }).catch(() => {});
            }
        } catch (error) {
            console.error("Error saving matrix:", error);
            showAlert(t('rates.alerts.saveError') + ": " + (error.message || error), t('rates.title'), 'error');
        } finally {
            setSaving(false);
            setLoading(false);
        }
    };

    const fileInputRef = useRef(null);

    const handleCSVUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target.result;
                const result = parseCSV(text);

                if (result.errors.length > 0) {
                    showAlert('CSV Errors:\n' + result.errors.slice(0, 5).join('\n'), 'CSV Upload', 'error');
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

                if (matchCount === 0) {
                    showAlert(`⚠️ No matching rates found for ${matrixType}.`, 'CSV Upload', 'warning');
                    return;
                }

                setMatrixData(prev => ({ ...prev, ...newMatrixData }));
                setHasUnsavedChanges(true);
                setCsvDataLoaded(true);

                if (csvUploadDate !== selectedDate) {
                    setIsCreatingNew(true);
                    setNewEffectiveDate(csvUploadDate);
                } else {
                    setNewEffectiveDate(csvUploadDate);
                }

                showAlert(`✅ Imported ${matchCount} rates.`, 'CSV Upload', 'success');

            } catch (error) {
                console.error('CSV error:', error);
                showAlert('Error: ' + error.message, 'CSV Upload', 'error');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    const parseCSV = (text) => {
        const lines = text.trim().split('\n');
        const errors = [];

        if (lines.length < 2) {
            errors.push('❌ CSV file must have at least a header row and one data row');
            return { data: [], errors };
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/^\uFEFF/, '').toLowerCase());

        const milkTypeIdx = headers.findIndex(h => h.includes('milk') || h.includes('type'));
        const fatIdx = headers.findIndex(h => h.includes('fat'));
        const snfIdx = headers.findIndex(h => h.includes('snf'));
        const rateIdx = headers.findIndex(h => h.includes('rate') || h.includes('price'));

        if (fatIdx === -1) {
            errors.push('❌ Missing required column: "fat"');
        }
        if (snfIdx === -1) {
            errors.push('❌ Missing required column: "snf"');
        }
        if (rateIdx === -1) {
            errors.push('❌ Missing required column: "rate" or "price"');
        }

        if (errors.length > 0) {
            errors.push('\n📋 Required CSV format:\nmilk_type,fat,snf,rate\nBuffalo,5.5,8.7,35.50');
            return { data: [], errors };
        }

        const data = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const values = line.split(',').map(v => v.trim());

            const rawFat = values[fatIdx];
            const rawSnf = values[snfIdx];
            const rawRate = values[rateIdx];

            if ((!rawFat || rawFat === '') && (!rawSnf || rawSnf === '') && (!rawRate || rawRate === '')) {
                continue;
            }

            const fat = parseFloat(rawFat);
            const snf = parseFloat(rawSnf);
            const rate = parseFloat(rawRate);
            const milkType = milkTypeIdx !== -1 ? values[milkTypeIdx] : matrixType;

            if (isNaN(fat)) {
                errors.push(`❌ Row ${i}: Invalid fat value "${values[fatIdx]}"`);
            }
            if (isNaN(snf)) {
                errors.push(`❌ Row ${i}: Invalid snf value "${values[snfIdx]}"`);
            }
            if (isNaN(rate)) {
                errors.push(`❌ Row ${i}: Invalid rate value "${values[rateIdx]}"`);
            }
            if (!isNaN(rate) && rate <= 0) {
                errors.push(`❌ Row ${i}: Rate must be greater than 0 (got ${rate})`);
            }

            if (!isNaN(fat) && !isNaN(snf) && !isNaN(rate) && rate > 0) {
                data.push({
                    milk_type: milkType,
                    fat: fat,
                    snf: snf,
                    rate: rate
                });
            }
        }

        return { data, errors };
    };

    const handleDownloadCSV = () => {
        if (Object.keys(matrixData).length === 0) {
            showAlert(t('rates.alerts.noDataToExport'), t('rates.title'), 'warning');
            return;
        }

        const defaultRange = isCreatingNew ? rangeSettings : (MILK_RANGES[matrixType] || MILK_RANGES.Buffalo);
        let minFat = defaultRange.fatMin;
        let maxFat = defaultRange.fatMax;
        let minSnf = defaultRange.snfMin;
        let maxSnf = defaultRange.snfMax;

        Object.keys(matrixData).forEach(key => {
            const [fStr, sStr] = key.split('-');
            const f = parseFloat(fStr);
            const s = parseFloat(sStr);
            if (!isNaN(f)) {
                if (f < minFat) minFat = f;
                if (f > maxFat) maxFat = f;
            }
            if (!isNaN(s)) {
                if (s < minSnf) minSnf = s;
                if (s > maxSnf) maxSnf = s;
            }
        });

        const fats = generateRange(minFat, maxFat);
        const snfs = generateRange(minSnf, maxSnf);

        let csvContent = "milk_type,fat,snf,rate\n";

        fats.forEach(fat => {
            snfs.forEach(snf => {
                const key = `${fat.toFixed(1)}-${snf.toFixed(1)}`;
                const rateVal = matrixData[key];
                if (rateVal && rateVal !== '') {
                    csvContent += `${matrixType},${fat.toFixed(1)},${snf.toFixed(1)},${rateVal}\n`;
                }
            });
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${matrixType}_rates_${selectedDate || 'new'}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const renderMatrix = () => {
        const defaultRange = isCreatingNew ? rangeSettings : (MILK_RANGES[matrixType] || MILK_RANGES.Buffalo);

        let minFat = defaultRange.fatMin;
        let maxFat = defaultRange.fatMax;
        let minSnf = defaultRange.snfMin;
        let maxSnf = defaultRange.snfMax;

        // Also expand range if data exists outside the default/set range
        Object.keys(matrixData).forEach(key => {
            const [fStr, sStr] = key.split('-');
            const f = parseFloat(fStr);
            const s = parseFloat(sStr);
            if (!isNaN(f)) {
                if (f < minFat) minFat = f;
                if (f > maxFat) maxFat = f;
            }
            if (!isNaN(s)) {
                if (s < minSnf) minSnf = s;
                if (s > maxSnf) maxSnf = s;
            }
        });



        const fats = generateRange(minFat, maxFat);
        const snfs = generateRange(minSnf, maxSnf);

        return (
            <div style={{ overflowX: 'auto', background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', border: '1px solid #e5e7eb', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', left: 0 }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        {['Buffalo', 'Cow'].map(type => (
                            <button
                                key={type}
                                onClick={async () => {
                                    if (hasUnsavedChanges) {
                                        const discard = await showConfirm(t('rates.alerts.discardConfirm'), t('rates.title'), t('common.discard', { defaultValue: 'Discard' }), t('rates.buttons.cancel'));
                                        if (!discard) return;
                                    }
                                    setMatrixType(type);
                                }}
                                style={{
                                    padding: '8px 16px', borderRadius: '8px', border: 'none',
                                    fontWeight: '600', cursor: 'pointer',
                                    background: matrixType === type ? '#3b82f6' : '#f3f4f6',
                                    color: matrixType === type ? 'white' : '#4b5563'
                                }}
                            >
                                {t(`rates.buttons.${type.toLowerCase()}`)}
                            </button>
                        ))}
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            onClick={() => {
                                setCsvUploadDate(selectedDate || new Date().toISOString().split('T')[0]);
                                setShowCsvModal(true);
                            }}
                            style={{
                                padding: '8px 20px', borderRadius: '8px', border: '1px solid #d1d5db',
                                background: 'white', color: '#6b7280', fontWeight: '600',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
                            }}
                            title={t('rates.tooltips.importCsv')}
                        >
                            <Upload size={18} />
                            {t('collection.newRateModal.uploadOption').split(' ')[1]}
                        </button>

                        <button
                            onClick={handleDownloadCSV}
                            style={{
                                padding: '8px 20px', borderRadius: '8px', border: '1px solid #d1d5db',
                                background: 'white', color: '#6b7280', fontWeight: '600',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
                            }}
                            title={t('rates.tooltips.exportCsv')}
                        >
                            <Download size={18} />
                            {t('rates.buttons.export')}
                        </button>

                        <button
                            onClick={handleSaveMatrix}
                            disabled={!hasUnsavedChanges || loading}
                            style={{
                                padding: '8px 20px', borderRadius: '8px', border: 'none',
                                background: hasUnsavedChanges ? '#10b981' : '#e5e7eb',
                                color: hasUnsavedChanges ? 'white' : '#9ca3af',
                                fontWeight: '600', cursor: hasUnsavedChanges ? 'pointer' : 'not-allowed',
                                display: 'flex', alignItems: 'center', gap: '8px'
                            }}
                        >
                            <Save size={18} />
                            {isCreatingNew ? `${t('rates.buttons.saveNewRate')} (${newEffectiveDate})` : t('rates.buttons.saveChanges')}
                        </button>
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>


                    <table style={{ borderCollapse: 'separate', borderSpacing: 0, userSelect: 'none' }} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 20 }}>
                            <tr>
                                <th style={{
                                    padding: '12px', background: '#f9fafb', borderBottom: '1px solid #d1d5db', borderRight: '1px solid #d1d5db',
                                    position: 'sticky', left: 0, zIndex: 21, minWidth: '80px',
                                    fontSize: '13px', color: '#6b7280', fontWeight: '600'
                                }}>
                                    {t('rates.fatSnf')}
                                </th>
                                {snfs.map(snf => (
                                    <th key={snf} style={{
                                        padding: '8px', background: '#f9fafb', borderBottom: '1px solid #d1d5db', borderRight: '1px solid #e5e7eb',
                                        fontSize: '13px', minWidth: '60px', textAlign: 'center', color: '#6b7280', fontWeight: '600',
                                        cursor: 'pointer'
                                    }}
                                        onClick={() => {
                                            // Select entire column
                                            const range = isCreatingNew ? rangeSettings : MILK_RANGES[matrixType];
                                            setSelection({
                                                start: { fat: range.fatMin, snf: snf },
                                                end: { fat: range.fatMax, snf: snf },
                                                isSelecting: false
                                            });
                                        }}
                                    >
                                        {snf.toFixed(1)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {fats.map(fat => (
                                <tr key={fat}>
                                    <th style={{
                                        padding: '8px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #d1d5db',
                                        position: 'sticky', left: 0, zIndex: 10, fontSize: '13px', color: '#6b7280', fontWeight: '600',
                                        cursor: 'pointer'
                                    }}
                                        onClick={() => {
                                            // Select entire row
                                            const range = isCreatingNew ? rangeSettings : MILK_RANGES[matrixType];
                                            setSelection({
                                                start: { fat: fat, snf: range.snfMin },
                                                end: { fat: fat, snf: range.snfMax },
                                                isSelecting: false
                                            });
                                        }}
                                    >
                                        {fat.toFixed(1)}
                                    </th>
                                    {snfs.map(snf => {
                                        const key = `${fat.toFixed(1)}-${snf.toFixed(1)}`;
                                        const isSelected = isCellSelected(fat, snf, selection);
                                        return (
                                            <td key={snf}
                                                style={{
                                                    borderBottom: '1px solid #f3f4f6',
                                                    borderRight: '1px solid #f3f4f6',
                                                    padding: 0,
                                                    background: isSelected ? '#dbeafe' : 'transparent', // Light blue selection
                                                    border: isSelected ? '1px solid #3b82f6' : '1px solid #f3f4f6',
                                                    position: 'relative'
                                                }}
                                                onMouseDown={(e) => handleMouseDown(fat, snf, e)}
                                                onMouseEnter={() => handleMouseEnter(fat, snf)}
                                                onDoubleClick={() => handleDoubleClick(fat, snf)}
                                                onContextMenu={(e) => {
                                                    e.preventDefault();
                                                    handleDoubleClick(fat, snf);
                                                }}
                                            >
                                                {(loading && !saving) ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', height: '100%', minHeight: '34px' }}>
                                                        <div className="rate-skeleton-cell"></div>
                                                    </div>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={matrixData[key] || ''}
                                                        onChange={isEmployee ? undefined : (e) => handleMatrixCellChange(fat, snf, e.target.value)}
                                                        readOnly={isEmployee}
                                                        placeholder="-"
                                                        style={{
                                                            width: '100%', height: '100%', padding: '8px 4px', border: 'none',
                                                            textAlign: 'center', background: 'transparent', outline: 'none',
                                                            fontSize: '13px', minWidth: '60px',
                                                            cursor: isEmployee ? 'default' : 'cell',
                                                            color: isEmployee ? '#6b7280' : 'inherit'
                                                        }}
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
            </div >
        );
    };

    // ── Handle create new chart ─────────────────────────────────────────────
    const handleCreateChart = () => {
        const trimmed = newChartName.trim();
        if (!trimmed) {
            showAlert(t('rates.chartPicker.enterName'), t('rates.chartPicker.title'), 'warning');
            return;
        }
        const exists = availableCharts.some(c => c.name.toLowerCase() === trimmed.toLowerCase());
        if (exists) {
            showAlert(t('rates.chartPicker.alreadyExists'), t('rates.chartPicker.title'), 'warning');
            return;
        }
        // Add to local list and open it
        setAvailableCharts(prev => [...prev, { name: trimmed, dateCount: 0 }]);
        setActiveRateType(trimmed);
        setShowCreateChart(false);
        setShowChartPicker(false);
        setNewChartName('');
        setIsCreatingNew(true);
        setNewEffectiveDate(new Date().toISOString().split('T')[0]);
        setMatrixData({});
        setHasUnsavedChanges(false);
    };

    return (
        <div style={{ padding: '16px 32px', maxWidth: '1600px', margin: '0 auto', minHeight: '100%', display: 'flex', flexDirection: 'column', background: 'transparent' }}>

            {/* ── Rate Chart Picker Modal (opens every visit) ── */}
            {showChartPicker && (
                <div
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(6px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000
                    }}
                    onClick={(e) => { if (e.target === e.currentTarget && activeRateType) setShowChartPicker(false); }}
                >
                    <div style={{
                        background: 'white', borderRadius: '24px', padding: '36px',
                        maxWidth: '680px', width: '92%', boxShadow: '0 25px 60px rgba(0,0,0,0.35)',
                        position: 'relative'
                    }}>
                        {/* ✕ Close button — only shown if a chart is already active */}
                        {activeRateType && (
                            <button
                                onClick={() => setShowChartPicker(false)}
                                style={{
                                    position: 'absolute', top: '16px', right: '16px',
                                    width: '36px', height: '36px', borderRadius: '50%',
                                    border: '2px solid #e5e7eb', background: '#f9fafb',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', fontSize: '18px', color: '#6b7280',
                                    fontWeight: '700', lineHeight: 1,
                                    transition: 'all 0.15s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#6b7280'; }}
                                title="Close"
                            >
                                ×
                            </button>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <IndianRupee size={28} color="#3b82f6" />
                            <h2 style={{ margin: 0, fontSize: '26px', fontWeight: '800', color: '#111827' }}>
                                {t('rates.chartPicker.title')}
                            </h2>
                        </div>
                        <p style={{ margin: '0 0 28px 0', color: '#6b7280', fontSize: '15px' }}>
                            {t('rates.chartPicker.subtitle')}
                        </p>

                        {/* Skeleton loader while charts are fetching */}
                        {chartsLoading ? (
                            <>
                                <style>{`
                                    @keyframes chartShimmer {
                                        0%   { background-position: -400px 0; }
                                        100% { background-position:  400px 0; }
                                    }
                                    .chart-skeleton {
                                        height: 110px;
                                        border-radius: 16px;
                                        background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
                                        background-size: 400px 100%;
                                        animation: chartShimmer 1.3s infinite linear;
                                    }
                                `}</style>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                                    {[1, 2, 3].map(n => (
                                        <div key={n} className="chart-skeleton" style={{ opacity: 1 - n * 0.15 }} />
                                    ))}
                                </div>
                            </>
                        ) : (
                        <>
                        {/* Existing charts grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                            {availableCharts.map(chart => (
                                <button
                                    key={chart.name}
                                    onClick={() => {
                                        const isSameChart = activeRateType !== null && activeRateType === chart.name;
                                        if (isSameChart) {
                                            setShowChartPicker(false);
                                            setShowCreateChart(false);
                                            return;
                                        }
                                        setActiveRateType(chart.name);
                                        setShowChartPicker(false);
                                        setShowCreateChart(false);
                                        setMatrixData({});
                                        setSelection({ start: null, end: null, isSelecting: false });
                                    }}
                                    style={{
                                        padding: '20px 16px', borderRadius: '16px',
                                        border: activeRateType === chart.name ? '2px solid #3b82f6' : '2px solid #e5e7eb',
                                        background: activeRateType === chart.name ? '#eff6ff' : '#f9fafb',
                                        cursor: 'pointer', textAlign: 'center',
                                        transition: 'all 0.15s',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'
                                    }}
                                    onMouseOver={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.background = '#eff6ff'; }}
                                    onMouseOut={e => {
                                        e.currentTarget.style.borderColor = activeRateType === chart.name ? '#3b82f6' : '#e5e7eb';
                                        e.currentTarget.style.background = activeRateType === chart.name ? '#eff6ff' : '#f9fafb';
                                    }}
                                >
                                    <span style={{ fontSize: '30px' }}>{chart.name === 'sangh' ? '🏛️' : '⭐'}</span>
                                    <span style={{ fontSize: '15px', fontWeight: '700', color: '#111827' }}>
                                        {chart.name === 'sangh' ? t('rates.chartPicker.sanghDefault') : chart.name}
                                    </span>
                                    <span style={{ fontSize: '12px', color: '#6b7280' }}>
                                        {t('rates.chartPicker.dates', { count: chart.dateCount })}
                                    </span>
                                </button>
                            ))}

                            {/* Create new chart button */}
                            {!showCreateChart && (
                                <button
                                    onClick={() => setShowCreateChart(true)}
                                    style={{
                                        padding: '20px 16px', borderRadius: '16px',
                                        border: '2px dashed #d1d5db', background: 'white',
                                        cursor: 'pointer', textAlign: 'center',
                                        transition: 'all 0.15s',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'
                                    }}
                                    onMouseOver={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.background = '#eff6ff'; }}
                                    onMouseOut={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.background = 'white'; }}
                                >
                                    <PlusCircle size={32} color="#6b7280" />
                                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>{t('rates.chartPicker.createNew')}</span>
                                </button>
                            )}
                        </div>

                        {/* Inline create chart form */}
                        {showCreateChart && (
                            <div style={{ background: '#f0fdf4', border: '2px solid #10b981', borderRadius: '14px', padding: '20px', marginBottom: '16px' }}>
                                <p style={{ margin: '0 0 12px 0', fontWeight: '600', color: '#065f46', fontSize: '15px' }}>
                                    {t('rates.chartPicker.newNameLabel')}
                                </p>
                                <input
                                    type="text"
                                    placeholder={t('rates.chartPicker.namePlaceholder')}
                                    value={newChartName}
                                    onChange={e => setNewChartName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleCreateChart()}
                                    autoFocus
                                    style={{
                                        width: '100%', padding: '10px 14px', borderRadius: '10px',
                                        border: '1px solid #6ee7b7', fontSize: '15px', outline: 'none',
                                        boxSizing: 'border-box', marginBottom: '12px'
                                    }}
                                />
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        onClick={handleCreateChart}
                                        style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: '#10b981', color: 'white', fontWeight: '700', cursor: 'pointer' }}
                                    >
                                        {t('rates.chartPicker.createOpen')}
                                    </button>
                                    <button
                                        onClick={() => { setShowCreateChart(false); setNewChartName(''); }}
                                        style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', color: '#6b7280' }}
                                    >
                                        {t('rates.chartPicker.cancel')}
                                    </button>
                                </div>
                            </div>
                        )}
                        </>  )}
                    </div>
                </div>
            )}
            {saving && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998
                }}>
                    <Loader text={t('rates.alerts.saving', { defaultValue: 'Saving rates...' })} />
                </div>
            )}
            <style>
                {`
                @keyframes rateShimmerPulse {
                    0% { background-position: -200px 0; }
                    100% { background-position: calc(200px + 100%) 0; }
                }
                .rate-skeleton-cell {
                    animation: rateShimmerPulse 1.5s infinite linear;
                    background: linear-gradient(to right, #f3f4f6 4%, #e5e7eb 25%, #f3f4f6 36%);
                    background-size: 1000px 100%;
                    border-radius: 4px;
                    height: 16px;
                    width: 70%;
                    margin: 0 auto;
                }
                `}
            </style>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                flexShrink: 0,
                gap: '24px',
                paddingBottom: '12px',
                borderBottom: '1px solid #f1f5f9'
            }}>
                <div>
                    <h1 style={{
                        fontSize: '28px',
                        fontWeight: '800',
                        color: '#111827',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        margin: '0 0 8px 0'
                    }}>
                        <IndianRupee size={28} />
                        {t('rates.title')}
                        {activeRateType && (
                            <span style={{ fontSize: '14px', fontWeight: '600', background: '#dbeafe', color: '#1d4ed8', padding: '4px 12px', borderRadius: '20px', cursor: 'pointer' }}
                                onClick={() => setShowChartPicker(true)}
                            >
                                {activeRateType === 'sangh' ? `🏛️ ${t('rates.chartPicker.sanghDefault')}` : `⭐ ${activeRateType}`}
                                &nbsp;↗
                            </span>
                        )}
                    </h1>
                    <p style={{ color: '#6b7280', fontSize: '15px', margin: 0 }}>{t('rates.subtitle')}</p>
                </div>

                {/* Effective Date Selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'white', padding: '10px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    {isCreatingNew ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>{t('rates.newRateEffectiveFrom')}:</span>
                            <input
                                type="date"
                                value={newEffectiveDate}
                                onChange={(e) => setNewEffectiveDate(e.target.value)}
                                style={{
                                    padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db',
                                    fontSize: '14px', outline: 'none'
                                }}
                            />
                            <button
                                onClick={() => setIsCreatingNew(false)}
                                style={{
                                    padding: '8px', borderRadius: '8px', border: 'none', background: '#f3f4f6', cursor: 'pointer', color: '#6b7280'
                                }}
                                title="Cancel"
                            >
                                <span style={{ fontSize: '12px' }}>{t('rates.buttons.cancel')}</span>
                            </button>
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Calendar size={18} color="#6b7280" />
                                <span style={{ fontSize: '14px', color: '#6b7280' }}>{t('rates.viewing')}:</span>
                                <select
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    style={{
                                        padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db',
                                        fontSize: '14px', outline: 'none', cursor: 'pointer', background: '#f9fafb'
                                    }}
                                >
                                    {availableDates.map(date => (
                                        <option key={date} value={date}>
                                            {date} {date === new Date().toISOString().split('T')[0] ? '(Today)' : ''}
                                        </option>
                                    ))}
                                    {availableDates.length === 0 && <option value="">{t('rates.noRatesFound')}</option>}
                                </select>
                                <button
                                    onClick={async () => {
                                        await loadDates();
                                        if (selectedDate) await loadRatesForDate(selectedDate);
                                    }}
                                    title="Refresh Data"
                                    style={{
                                        padding: '8px', borderRadius: '8px', border: '1px solid #d1d5db',
                                        background: 'white', cursor: 'pointer', color: '#6b7280'
                                    }}
                                >
                                    <RefreshCw size={16} />
                                </button>
                            </div>
                            <button
                                onClick={() => setShowNewRateModal(true)}
                                style={{
                                    padding: '8px 16px', borderRadius: '8px', border: 'none',
                                    background: '#3b82f6', color: 'white', fontWeight: '500',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                                }}
                            >
                                <PlusCircle size={16} />
                                {t('rates.buttons.newRate')}
                            </button>
                        </>
                    )}
                </div>



                {/* Hidden file input - always rendered so ref works */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleCSVUpload}
                    style={{ display: 'none' }}
                />
            </div>

            {/* Matrix View */}
            {renderMatrix()}

            <RateUpdateModal
                isOpen={showUpdateModal}
                onClose={() => setShowUpdateModal(false)}
                onApply={handleBulkUpdate}
                selectionStats={selectionStats}
            />

            {/* New Rate Options Modal */}
            {showNewRateModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: 'white', borderRadius: '16px', padding: '32px',
                        maxWidth: '500px', width: '90%',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
                    }}>
                        <h2 style={{ margin: '0 0 16px 0', fontSize: '24px', color: '#111827' }}>
                            ➕ {t('collection.newRateModal.title')}
                        </h2>
                        <p style={{ margin: '0 0 24px 0', color: '#6b7280', fontSize: '15px' }}>
                            {t('collection.newRateModal.subtitle')}
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {/* Upload CSV Option */}
                            <button
                                onClick={() => {
                                    setShowNewRateModal(false);
                                    setShowCsvModal(true);
                                }}
                                style={{
                                    padding: '20px', borderRadius: '12px', border: '2px solid #3b82f6',
                                    background: '#eff6ff', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '16px',
                                    transition: 'all 0.2s'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.background = '#dbeafe'}
                                onMouseOut={(e) => e.currentTarget.style.background = '#eff6ff'}
                            >
                                <Upload size={32} color="#3b82f6" />
                                <div style={{ textAlign: 'left', flex: 1 }}>
                                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>
                                        📊 {t('collection.newRateModal.uploadOption')}
                                    </div>
                                    <div style={{ fontSize: '13px', color: '#6b7280' }}>
                                        {t('collection.newRateModal.uploadDesc')}
                                    </div>
                                </div>
                            </button>

                            {/* Manual Entry Option */}
                            <button
                                onClick={() => {
                                    setShowNewRateModal(false);
                                    setShowRangeModal(true);
                                }}
                                style={{
                                    padding: '20px', borderRadius: '12px', border: '2px solid #d1d5db',
                                    background: 'white', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '16px',
                                    transition: 'all 0.2s'
                                }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.background = '#f9fafb';
                                    e.currentTarget.style.borderColor = '#9ca3af';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.background = 'white';
                                    e.currentTarget.style.borderColor = '#d1d5db';
                                }}
                            >
                                <PlusCircle size={32} color="#6b7280" />
                                <div style={{ textAlign: 'left', flex: 1 }}>
                                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>
                                        ✍️ {t('collection.newRateModal.manualOption')}
                                    </div>
                                    <div style={{ fontSize: '13px', color: '#6b7280' }}>
                                        {t('collection.newRateModal.manualDesc')}
                                    </div>
                                </div>
                            </button>
                        </div>

                        <button
                            onClick={() => setShowNewRateModal(false)}
                            style={{
                                width: '100%', marginTop: '16px', padding: '10px',
                                borderRadius: '8px', border: '1px solid #d1d5db',
                                background: 'white', color: '#6b7280', fontWeight: '600',
                                cursor: 'pointer'
                            }}
                        >
                            {t('collection.newRateModal.cancel')}
                        </button>
                    </div>
                </div>
            )}

            {/* CSV Template Modal */}
            {showCsvModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: 'white', borderRadius: '16px', padding: '32px',
                        maxWidth: '700px', width: '90%', maxHeight: '90vh', overflowY: 'auto',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
                    }}>
                        <h2 style={{ margin: '0 0 20px 0', fontSize: '24px', color: '#111827' }}>
                            📊 {t('collection.csvUpload.modalTitle')}
                        </h2>

                        {/* Date Input Section */}
                        <div style={{ background: '#eff6ff', padding: '16px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #3b82f6' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                                📅 {t('collection.csvUpload.dateLabel')}
                            </label>
                            <input
                                type="date"
                                value={csvUploadDate}
                                onChange={(e) => setCsvUploadDate(e.target.value)}
                                style={{
                                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                                    border: '2px solid #3b82f6', fontSize: '15px', outline: 'none',
                                    fontWeight: '600'
                                }}
                            />
                            <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#6b7280' }}>
                                {t('collection.csvUpload.dateHelper')}
                            </p>
                        </div>

                        <div style={{ background: '#f3f4f6', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                            <p style={{ margin: '0 0 12px 0', fontWeight: '600', color: '#374151' }}>
                                {t('collection.csvUpload.formatTitle')}
                            </p>
                            <pre style={{
                                background: '#1f2937', color: '#10b981', padding: '16px',
                                borderRadius: '8px', overflow: 'auto', fontSize: '13px',
                                fontFamily: 'Courier New, monospace', margin: 0
                            }}>
                                {`milk_type,fat,snf,rate
Buffalo,5.5,8.7,35.50
Buffalo,5.6,8.7,36.00
Buffalo,6.0,8.8,38.50
Cow,3.0,8.2,28.00
Cow,4.0,8.3,32.50`}
                            </pre>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '16px', margin: '0 0 12px 0', color: '#374151' }}>
                                ✅ {t('collection.csvUpload.requirementsTitle')}
                            </h3>
                            <ul style={{ margin: 0, paddingLeft: '20px', color: '#6b7280', lineHeight: '1.8' }}>
                                <li>{t('collection.csvUpload.reqColumns')}</li>
                                <li>{t('collection.csvUpload.optColumn')}</li>
                                <li>{t('collection.csvUpload.colNames')}</li>
                                <li>{t('collection.csvUpload.values')}</li>
                                <li>{t('collection.csvUpload.ratePositive')}</li>
                            </ul>
                        </div>

                        <div style={{ background: '#fef3c7', padding: '12px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #fbbf24' }}>
                            <p style={{ margin: 0, fontSize: '14px', color: '#92400e' }}>
                                ⚠️ <strong>{t('collection.csvUpload.importantTitle')}</strong> {t('collection.csvUpload.importantText')}
                            </p>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '16px', margin: '0 0 12px 0', color: '#374151' }}>
                                📋 {t('collection.csvUpload.stepsTitle')}
                            </h3>
                            <ol style={{ margin: 0, paddingLeft: '20px', color: '#6b7280', lineHeight: '1.8' }}>
                                <li>{t('collection.csvUpload.step1')}</li>
                                <li>{t('collection.csvUpload.step2')}</li>
                                <li>{t('collection.csvUpload.step3')}</li>
                                <li>{t('collection.csvUpload.step4')}</li>
                                <li>{t('collection.csvUpload.step5')}</li>
                            </ol>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => {
                                    setShowCsvModal(false);
                                    setCsvUploadDate(new Date().toISOString().split('T')[0]); // Reset date
                                }}
                                style={{
                                    padding: '10px 20px', borderRadius: '8px', border: '1px solid #d1d5db',
                                    background: 'white', color: '#6b7280', fontWeight: '600',
                                    cursor: 'pointer'
                                }}
                            >
                                {t('collection.csvUpload.cancel')}
                            </button>
                            <button
                                onClick={() => {
                                    setShowCsvModal(false);

                                    if (csvUploadDate !== selectedDate) {
                                        setIsCreatingNew(true);
                                        setNewEffectiveDate(csvUploadDate);
                                    } else {

                                        setNewEffectiveDate(csvUploadDate); // Ensure consistency
                                    }

                                    setTimeout(() => fileInputRef.current?.click(), 100);
                                }}
                                style={{
                                    padding: '10px 20px', borderRadius: '8px', border: 'none',
                                    background: '#3b82f6', color: 'white', fontWeight: '600',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
                                }}
                            >
                                <Upload size={18} />
                                {t('collection.csvUpload.proceed')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <RangeInputModal
                isOpen={showRangeModal}
                onClose={() => setShowRangeModal(false)}
                matrixType={matrixType}
                onApply={(settings) => {
                    setShowRangeModal(false);
                    setRangeSettings(settings);
                    setIsCreatingNew(true);
                    setNewEffectiveDate(new Date().toISOString().split('T')[0]);
                }}
            />

            <AlertComponent />
        </div>
    );
}

export default Rates;
