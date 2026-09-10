import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, Calculator, Edit, X, User, Droplets, TrendingUp, Trash2, Printer, Volume2, VolumeX, Search, Check as CheckIcon } from 'lucide-react';
import Loader from '../components/Loader';
import { useAlert } from '../hooks/useAlert';
import { useLocation } from 'react-router-dom';
import { speakCollectionSummary, isVoiceAlertEnabled, setVoiceAlertEnabled } from '../utils/voiceAlert';


import {
    getFarmers,
    getCollections,
    getRateForCollection,
    addCollection,
    updateCollection,
    deleteCollection,
    getLastFarmerEntry,
    getEmployeePermissions,
    DEFAULT_EMPLOYEE_PERMISSIONS
} from '../lib/api';
import { loadRatesFromCSV, lookupRateFromCache } from '../services/ratesCache';


// Custom Searchable Combobox Component
const SearchableCombobox = ({ options, value, onChange, placeholder, onEnterPressed, autoFocusRef }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const wrapperRef = useRef(null);
    const inputRef = useRef(null);

    // autoFocusRef is synced via the callback ref on <input> below (see callbackRef).
    // This ensures the parent always has a fresh DOM reference even after the input
    // conditionally unmounts/remounts (e.g. when farmer is selected → div shown).

    // When parent clears the value (e.g. after Save Entry), reset search + close dropdown
    useEffect(() => {
        if (!value) {
            setSearch('');
            setIsOpen(false);
        }
    }, [value]);

    const isNumericSearch = search.trim() !== '' && /^\d+$/.test(search.trim());
    const filteredOptions = options.filter(opt => {
        if (isNumericSearch) {
            // Exact match on farmer code when typing digits
            return opt.searchKey && opt.searchKey === search.trim();
        }
        // Partial match on label (name) for text searches
        return opt.label.toLowerCase().includes(search.toLowerCase());
    }).sort((a, b) => {
        // Sort numerically by farmer code (ascending)
        const codeA = parseInt(a.searchKey, 10);
        const codeB = parseInt(b.searchKey, 10);
        if (!isNaN(codeA) && !isNaN(codeB)) return codeA - codeB;
        return (a.searchKey || '').localeCompare(b.searchKey || '');
    }).slice(0, 50); // limit to 50 for performance

    const selectedOption = options.find(opt => opt.value === value);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (val) => {
        onChange(val);
        setSearch('');
        setIsOpen(false);
        if (onEnterPressed) {
            onEnterPressed(); // move to next field
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (isOpen && filteredOptions.length > 0) {
                // Select first matching option if hitting enter while searching
                handleSelect(filteredOptions[0].value);
            } else if (value && onEnterPressed) {
                // If already selected, just move to next field
                onEnterPressed();
            }
        }
    };

    return (
        <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: isOpen ? '2px solid #667eea' : '2px solid #e5e7eb',
                    background: 'white',
                    cursor: 'text',
                    transition: 'all 0.2s',
                    boxShadow: isOpen ? '0 0 0 3px rgba(102, 126, 234, 0.1)' : 'none'
                }}
                onClick={() => setIsOpen(true)}
            >
                <Search size={18} color="#9ca3af" style={{ marginRight: '8px' }} />
                {!isOpen && selectedOption ? (
                    <div
                        style={{ flex: 1, fontSize: '15px', color: '#111827', cursor: 'text' }}
                        onClick={() => {
                            setIsOpen(true);
                            setSearch(selectedOption.label);
                            setTimeout(() => inputRef.current?.focus(), 10);
                        }}
                    >
                        {selectedOption.label}
                    </div>
                ) : (
                    <input
                        ref={(el) => {
                            inputRef.current = el;
                            // Keep parent's autoFocusRef in sync every time this input mounts/remounts
                            if (autoFocusRef) autoFocusRef.current = el;
                        }}
                        type="text"
                        value={search}
                        placeholder={selectedOption ? selectedOption.label : placeholder}
                        onChange={(e) => setSearch(e.target.value)}
                        onFocus={() => setIsOpen(true)}
                        onKeyDown={handleKeyDown}
                        autoComplete="off"
                        style={{
                            border: 'none',
                            outline: 'none',
                            width: '100%',
                            fontSize: '15px',
                            background: 'transparent',
                            color: '#111827'
                        }}
                    />
                )}
                {selectedOption && !isOpen && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onChange(''); setSearch(''); inputRef.current?.focus(); setIsOpen(true); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex' }}
                    >
                        <X size={16} color="#9ca3af" />
                    </button>
                )}
            </div>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '4px',
                    background: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    maxHeight: '260px',
                    overflowY: 'auto',
                    zIndex: 50
                }}>
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map((opt) => (
                            <div
                                key={opt.value}
                                onClick={() => handleSelect(opt.value)}
                                style={{
                                    padding: '12px 16px',
                                    cursor: 'pointer',
                                    fontSize: '15px',
                                    color: '#374151',
                                    borderBottom: '1px solid #f3f4f6',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    background: opt.value === value ? '#f0fdf4' : 'white',
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                                onMouseLeave={(e) => e.currentTarget.style.background = opt.value === value ? '#f0fdf4' : 'white'}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontWeight: '600', color: '#111827', minWidth: '40px' }}>{opt.searchKey}</span>
                                    <span>-</span>
                                    <span>{opt.label.split('-')[1]?.trim() || opt.label}</span>
                                </div>
                                {opt.value === value && <CheckIcon size={16} color="#16a34a" />}
                            </div>
                        ))
                    ) : (
                        <div style={{ padding: '16px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>
                            No farmers found
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

function Collection({ user }) {
    const location = useLocation();
    const { t, i18n } = useTranslation();
    const { showAlert, showConfirm, showToast, AlertComponent } = useAlert();
    const formRef = useRef(null);
    const isClearingRef = useRef(false);
    
    // ── Anomaly detection: phone/PC-only localStorage cache (NEVER touches online data) ──
    // Stores exactly ONE quantity per farmer+shift. Auto-pruned after 2 days.
    const FARMER_HISTORY_KEY = 'milkEntry_farmerHistory';
    const farmerHistoryRef = useRef({});

    // ── Permission helper ─────────────────────────────────────────────────
    // Employees: use granular permissions loaded from DB. Admins always have full access.
    const isEmployee = user?.role !== 'admin' && user?.role !== 'super_admin';
    const todayStr = new Date().toISOString().split('T')[0];

    // Granular permission flags (only relevant for employees)
    const [permissions, setPermissions] = useState({ ...DEFAULT_EMPLOYEE_PERMISSIONS });
    const [permsLoaded, setPermsLoaded] = useState(!isEmployee); // admins skip load

    useEffect(() => {
        if (!isEmployee || !user?.id || !user?.dairy_id) {
            setPermsLoaded(true);
            return;
        }
        getEmployeePermissions(user.id, user.dairy_id)
            .then(row => {
                if (row && Object.keys(row).length > 0) {
                    setPermissions({ ...DEFAULT_EMPLOYEE_PERMISSIONS, ...row });
                }
            })
            .catch(err => console.warn('[Permissions] Failed to load:', err))
            .finally(() => setPermsLoaded(true));
    }, [user?.id, user?.dairy_id, isEmployee]);

    const [farmers, setFarmers] = useState([]);
    const [recentCollections, setRecentCollections] = useState([]);
    const [listLoading, setListLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        farmer_id: '',
        date: new Date().toISOString().split('T')[0],
        shift: new Date().getHours() < 15 ? 'Morning' : 'Evening',
        milk_type: 'Buffalo',
        fat: '',
        snf: '',
        quantity: '',
        rate: '',
        amount: ''
    });
    const [rateError, setRateError] = useState('');
    const [isFetchingRate, setIsFetchingRate] = useState(false); // loading spinner for rate fetch
    // Local CSV rate cache — loaded once on mount for fast fat/snf → rate lookup
    const [ratesCache, setRatesCache] = useState([]);
    // Farmer → rate_type map from local JSON (written by rates:full-rebuild in main process)
    const [farmerRateTypesMap, setFarmerRateTypesMap] = useState({});
    const [isPrintEnabled, setIsPrintEnabled] = useState(true);
    // Thev accounts cache — loaded on mount, refreshed after each save.
    // Kept in state so printReceipt() can look up balances SYNCHRONOUSLY
    // (avoids breaking Electron's user-gesture chain which would block the print dialog).
    const [thevAccountsCache, setThevAccountsCache] = useState([]);
    const [isVoiceEnabled, setIsVoiceEnabled] = useState(() => isVoiceAlertEnabled());
    // Extra fat machine readings (not saved to DB, only shown in summary)
    const [fatMachineExtra, setFatMachineExtra] = useState(null);
    // Track machine connection state for smart form clearing after save
    const [isFatMachineConnected, setIsFatMachineConnected] = useState(false);
    const [isWeightMachineConnected, setIsWeightMachineConnected] = useState(false);
    // FAT & SNF calibration caps (min/max per milk type)
    const [minFatCow, setMinFatCow] = useState('');
    const [minFatBuffalo, setMinFatBuffalo] = useState('');
    const [maxFatCow, setMaxFatCow] = useState('');
    const [maxFatBuffalo, setMaxFatBuffalo] = useState('');
    const [minSnfCow, setMinSnfCow] = useState('');
    const [minSnfBuffalo, setMinSnfBuffalo] = useState('');
    const [maxSnfCow, setMaxSnfCow] = useState('');
    const [maxSnfBuffalo, setMaxSnfBuffalo] = useState('');

    // Derived permission booleans (always true for admins) — declared AFTER formData
    const canViewPastData      = !isEmployee || permissions.can_view_past_data;
    const canSavePastEntry     = !isEmployee || permissions.can_save_past_entry;
    const canEditSavedEntry    = !isEmployee || permissions.can_edit_saved_entry;
    const canDeleteEntry       = !isEmployee || permissions.can_delete_entry;
    const isPastDate           = formData.date !== todayStr;

    // Refs for keyboard navigation
    const farmerInputRef = useRef(null);
    const fatInputRef = useRef(null);
    const snfInputRef = useRef(null);
    const voiceFallbackShownRef = useRef(false); // show install hint only once per session
    const quantityInputRef = useRef(null);
    const submitBtnRef = useRef(null);

    // Focus Farmer input on load
    useEffect(() => {
        if (farmerInputRef.current) {
            setTimeout(() => {
                farmerInputRef.current.focus();
            }, 500); // slight delay to allow rendering
        }
    }, []);

    // Generic keyboard navigation handler
    const handleEnterPress = (e, nextFieldRef) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (nextFieldRef && nextFieldRef.current) {
                nextFieldRef.current.focus();
            }
        }
    };

    // Helper to refresh the Thev accounts cache (called on mount + after each save)
    const refreshThevCache = () => {
        if (!user?.dairy_id) return;
        window.api.getFarmerThevAccounts(user.dairy_id)
            .then(accounts => setThevAccountsCache(accounts || []))
            .catch(err => console.warn('[ThevCache] Failed to load:', err));
    };

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            await loadFarmers();
            loadFarmerHistory(); // load & prune local quantity cache
            refreshThevCache();  // pre-load Thev accounts for print receipts
            // loadRecentCollections will be triggered by the date effect below
            setLoading(false);
        };
        init();

        // Load FAT & SNF calibration caps from localStorage
        const capKeys = ['minFatCow','minFatBuffalo','maxFatCow','maxFatBuffalo','minSnfCow','minSnfBuffalo','maxSnfCow','maxSnfBuffalo'];
        const capSetters = [setMinFatCow,setMinFatBuffalo,setMaxFatCow,setMaxFatBuffalo,setMinSnfCow,setMinSnfBuffalo,setMaxSnfCow,setMaxSnfBuffalo];
        capKeys.forEach((k, i) => { const v = localStorage.getItem(k); if (v !== null) capSetters[i](v); });
    }, []);

    // Load local CSV rate cache + farmer rate_type map once on mount
    useEffect(() => {
        if (!user?.dairy_id) return;
        const dairyId = user.dairy_id;

        loadRatesFromCSV(dairyId)
            .then(cache => {
                if (cache && cache.length > 0) {
                    setRatesCache(cache);
                    console.log('[RatesCache] Loaded', cache.length, 'rates from local CSV');
                }
            })
            .catch(err => console.warn('[RatesCache] Load failed (non-fatal):', err));

        if (window.electron) {
            window.electron.invoke('rates:get-all-farmer-rate-types', { dairyId })
                .then(res => {
                    if (res?.success && res.map && Object.keys(res.map).length > 0) {
                        setFarmerRateTypesMap(res.map);
                        console.log('[RatesCache] Farmer rate-type map loaded:', Object.keys(res.map).length, 'farmers');
                    }
                })
                .catch(err => console.warn('[RatesCache] Farmer map load failed (non-fatal):', err));
        }
    }, [user?.dairy_id]);

    // BUG 2+3 FIX: Listen for rates:cache-updated from main process
    // Fires after rates:full-rebuild completes (post login/rates-save/farmer-save)
    // Reloads both ratesCache + farmerRateTypesMap so new rates/farmer types are
    // immediately available without navigating away and back.
    useEffect(() => {
        if (!user?.dairy_id || !window.electron) return;
        const dairyId = user.dairy_id;

        const reloadCache = (data) => {
            // Only reload if the event is for this dairy
            if (data?.dairyId && String(data.dairyId) !== String(dairyId)) return;
            console.log('[RatesCache] cache-updated event received — reloading...');

            loadRatesFromCSV(dairyId)
                .then(cache => {
                    if (cache && cache.length > 0) {
                        setRatesCache(cache);
                        console.log('[RatesCache] Hot-reloaded', cache.length, 'rates');
                    }
                })
                .catch(() => {});

            window.electron.invoke('rates:get-all-farmer-rate-types', { dairyId })
                .then(res => {
                    if (res?.success && res.map) {
                        setFarmerRateTypesMap(res.map);
                        console.log('[RatesCache] Hot-reloaded farmer map:', Object.keys(res.map).length, 'farmers');
                    }
                })
                .catch(() => {});
        };

        const unsub = window.electron.receive('rates:cache-updated', reloadCache);
        return () => { if (typeof unsub === 'function') unsub(); };
    }, [user?.dairy_id]);


    // Auto-connect machines on mount.
    // Reads fixed ports from localStorage (set by App.jsx on login: COM2=Fat, COM3=Weight).
    // Checks get_status first to avoid disconnecting a machine that is already active.
    useEffect(() => {
        if (!window.electron) return;

        const savedFatPort  = localStorage.getItem('fat_machine_port');   // 'COM2' (set by App.jsx)
        const savedFatBaud  = localStorage.getItem('fat_machine_baud');
        const savedWeightPort = localStorage.getItem('weight_machine_port'); // 'COM3'
        const savedWeightBaud = localStorage.getItem('weight_machine_baud');

        let weightRetryCount = 0;
        const MAX_WEIGHT_RETRIES = 3;
        const WEIGHT_RETRY_DELAY = 3000;
        let weightRetryTimer = null;
        let weightConnected = false;
        let cancelled = false;

        const attemptWeightConnect = () => {
            if (cancelled || weightConnected || !savedWeightPort) return;
            window.electron.invoke('weight-machine-command', {
                action: 'connect',
                port: savedWeightPort,
                baud: savedWeightBaud ? parseInt(savedWeightBaud) : 9600
            });
        };

        const removeWeightConnectionListener = window.electron.receive('weight-machine-connection', (data) => {
            if (data.connected) {
                weightConnected = true;
                weightRetryCount = 0;
                if (weightRetryTimer) { clearTimeout(weightRetryTimer); weightRetryTimer = null; }
                setIsWeightMachineConnected(true);
            } else {
                setIsWeightMachineConnected(false);
                if (!weightConnected && weightRetryCount < MAX_WEIGHT_RETRIES && !cancelled) {
                    weightRetryCount++;
                    weightRetryTimer = setTimeout(attemptWeightConnect, WEIGHT_RETRY_DELAY);
                }
            }
            // No alert — silent failure; user can go to Settings to reconnect manually
        });

        // Check get_status first — only connect if not already connected (avoids disrupting active session)
        (async () => {
            try {
                if (savedFatPort) {
                    const fatStatus = await window.electron.invoke('fat-machine-command', { action: 'get_status' });
                    if (!cancelled && !fatStatus?.connected) {
                        window.electron.invoke('fat-machine-command', {
                            action: 'connect',
                            port: savedFatPort,
                            baud: savedFatBaud ? parseInt(savedFatBaud) : 2400
                        });
                    }
                }
            } catch (e) { /* ignore */ }

            try {
                if (savedWeightPort) {
                    const wStatus = await window.electron.invoke('weight-machine-command', { action: 'get_status' });
                    if (!cancelled) {
                        if (wStatus?.connected) {
                            weightConnected = true;
                            setIsWeightMachineConnected(true);
                        } else {
                            weightRetryTimer = setTimeout(attemptWeightConnect, 1500);
                        }
                    }
                }
            } catch (e) { /* ignore */ }
        })();

        return () => {
            cancelled = true;
            if (weightRetryTimer) clearTimeout(weightRetryTimer);
            if (typeof removeWeightConnectionListener === 'function') removeWeightConnectionListener();
        };
    }, []);


    // Fat Machine Listener
    useEffect(() => {
        if (window.electron) {
            const removeListener = window.electron.receive('fat-machine-data', (data) => {
                if (data && (typeof data.fat !== 'undefined') && (typeof data.snf !== 'undefined')) {
                    // Data arriving means machine is connected
                    setIsFatMachineConnected(true);
                    // Format to 1 decimal place (e.g. 7.6, 8.2 not 8.05)
                    const fatVal = parseFloat(data.fat).toFixed(1);
                    const snfVal = parseFloat(data.snf).toFixed(1);
                    setFormData(prev => {
                        // When a default SNF is configured, skip overwriting snf from machine
                        const currentMilkType = prev.milk_type || 'Buffalo';
                        const defaultSnfKey = currentMilkType === 'Cow' ? 'defaultSnfCow' : 'defaultSnfBuffalo';
                        const hasDefaultSnf = !!localStorage.getItem(defaultSnfKey);

                        return {
                            ...prev,
                            fat: fatVal,
                            ...(hasDefaultSnf ? {} : { snf: snfVal }),
                            quantity: data.quantity ? data.quantity.toString() : prev.quantity,
                        };
                    });
                    // Save extra readings for display in summary panel
                    setFatMachineExtra({
                        added_water: typeof data.added_water !== 'undefined' ? parseFloat(data.added_water).toFixed(2) : null,
                        protein: typeof data.protein !== 'undefined' ? parseFloat(data.protein).toFixed(2) : null,
                        density: typeof data.density !== 'undefined' ? parseFloat(data.density).toFixed(2) : null,
                        temperature: typeof data.temperature !== 'undefined' ? parseFloat(data.temperature).toFixed(1) : null,
                    });
                }
            });
            return () => {
                if (typeof removeListener === 'function') {
                    removeListener();
                }
            };
        }
    }, []);

    // Fat Machine Connection Status Listener
    useEffect(() => {
        if (window.electron) {
            const removeListener = window.electron.receive('fat-machine-connection', (data) => {
                setIsFatMachineConnected(!!data?.connected);
            });
            return () => { if (typeof removeListener === 'function') removeListener(); };
        }
    }, []);

    // Weight Machine Listener
    useEffect(() => {
        if (window.electron) {
            const removeListener = window.electron.receive('weight-machine-data', (data) => {
                if (data && typeof data.quantity !== 'undefined') {
                    // Data arriving means machine is connected
                    setIsWeightMachineConnected(true);
                    setFormData(prev => ({
                        ...prev,
                        quantity: data.quantity.toString(),
                    }));
                }
            });
            return () => {
                if (typeof removeListener === 'function') {
                    removeListener();
                }
            };
        }
    }, []);

    useEffect(() => {
        if (location.state?.editCollection) {
            const collection = location.state.editCollection;
            handleEdit(collection);
            window.history.replaceState({}, document.title);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location]);

    const loadFarmers = async () => {
        try {
            const data = await getFarmers(user?.dairy_id);
            setFarmers((data || []).filter(f => !f.is_deleted));
        } catch (error) {
            console.error("Error loading farmers:", error);
        }
    };

    // ── localStorage cache helpers (NEVER modifies online/Supabase data) ──────
    const loadFarmerHistory = () => {
        try {
            const raw = localStorage.getItem(FARMER_HISTORY_KEY);
            let history = {};
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    if (parsed && typeof parsed === 'object') {
                        history = parsed;
                    }
                } catch (jsonErr) {
                    console.warn('[FarmerHistory] Failed to parse JSON cache:', jsonErr);
                }
            }
            // Prune: keep only entries from the last 2 days
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 2);
            const cutoffStr = cutoff.toISOString().split('T')[0];
            const pruned = {};
            for (const key of Object.keys(history)) {
                if (history[key]?.date >= cutoffStr) {
                    pruned[key] = history[key];
                }
            }
            farmerHistoryRef.current = pruned;
            localStorage.setItem(FARMER_HISTORY_KEY, JSON.stringify(pruned));
        } catch (e) {
            console.warn('[FarmerHistory] Failed to load cache:', e);
            farmerHistoryRef.current = {};
        }
    };

    // Write exactly ONE entry per farmer+shift (overwrites previous value)
    const updateFarmerHistoryEntry = (fId, sh, qty, entryDate) => {
        try {
            const key = `${fId}_${sh}`;
            const updated = { ...farmerHistoryRef.current, [key]: { qty, date: entryDate } };
            farmerHistoryRef.current = updated;
            localStorage.setItem(FARMER_HISTORY_KEY, JSON.stringify(updated));
        } catch (e) {
            console.warn('[FarmerHistory] Failed to update cache:', e);
        }
    };

    // Remove a single farmer+shift entry from local cache (on delete)
    const clearFarmerHistoryEntry = (fId, sh) => {
        try {
            const key = `${fId}_${sh}`;
            const updated = { ...farmerHistoryRef.current };
            delete updated[key];
            farmerHistoryRef.current = updated;
            localStorage.setItem(FARMER_HISTORY_KEY, JSON.stringify(updated));
        } catch (e) {
            console.warn('[FarmerHistory] Failed to clear cache entry:', e);
        }
    };
    // ────────────────────────────────────────────────────────────────────

    const loadRecentCollections = async (dateStr = formData.date) => {
        setListLoading(true);
        try {
            // Pass date to API for server-side filtering (more efficient)
            const collections = await getCollections(user?.dairy_id, dateStr);
            setRecentCollections(collections);
        } catch (error) {
            console.error("Error loading collections:", error);
        } finally {
            setListLoading(false);
        }
    };

    // Reload collections when date changes
    useEffect(() => {
        if (user?.dairy_id && formData.date) {
            loadRecentCollections(formData.date);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData.date, user?.dairy_id]);



    const handleEdit = (collection) => {
        setFormData({
            farmer_id: collection.farmer_id.toString(),
            date: collection.date,
            shift: collection.shift,
            milk_type: collection.milk_type || 'Buffalo',
            fat: collection.fat.toString(),
            snf: collection.snf.toString(),
            quantity: collection.quantity.toString(),
            rate: collection.rate.toString(),
            amount: collection.amount.toString()
        });
        setEditId(collection.id);
        setIsEditing(true);

        // Scroll to top to show the form
        // Scroll to top of the main content area
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            // Fallback
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handleInputChange = async (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const updated = { ...prev, [name]: value };
            return updated;
        });

        if (name === 'milk_type') {
            const defaultSnfKey = value === 'Cow' ? 'defaultSnfCow' : 'defaultSnfBuffalo';
            const defaultSnf = localStorage.getItem(defaultSnfKey);
            if (defaultSnf) {
                setFormData(prev => ({ ...prev, snf: defaultSnf }));
            } else {
                setFormData(prev => ({ ...prev, snf: '' }));
            }
        }

        if (name === 'farmer_id' && value) {
            let nextMilkType = 'Buffalo'; // Fallback
            try {
                // Find the selected farmer to see their default_milk_type
                const selectedFarmer = farmers.find(f => f.id.toString() === value.toString());
                if (selectedFarmer && selectedFarmer.default_milk_type) {
                    nextMilkType = selectedFarmer.default_milk_type;
                } else {
                    // Fallback to last entry if no default is set
                    const lastEntry = await getLastFarmerEntry(value, user?.dairy_id);
                    if (lastEntry && lastEntry.milk_type) {
                        nextMilkType = lastEntry.milk_type;
                    } else {
                        // keep current state
                        setFormData(prev => { nextMilkType = prev.milk_type; return prev; });
                    }
                }

                setFormData(prev => ({ ...prev, milk_type: nextMilkType }));
            } catch (error) {
                console.error("Error fetching last entry or default milk type:", error);
                setFormData(prev => { nextMilkType = prev.milk_type; return prev; });
            }

            // Apply default SNF based on determined milk_type
            const defaultSnfKey = nextMilkType === 'Cow' ? 'defaultSnfCow' : 'defaultSnfBuffalo';
            const defaultSnf = localStorage.getItem(defaultSnfKey);
            if (defaultSnf) {
                setFormData(prev => {
                    if (!prev.snf) { // Only override if empty when selecting farmer
                        return { ...prev, snf: defaultSnf };
                    }
                    return prev;
                });
            }
        }
    };

    useEffect(() => {
        const fetchRate = async () => {
            if (isClearingRef.current) return; // Skip if clearing form

            const fatRaw = parseFloat(formData.fat);
            const snfRaw = parseFloat(formData.snf);
            const milkType = formData.milk_type;
            const date = formData.date;

            const fat = Math.round(fatRaw * 10) / 10;
            const snf = Math.round(snfRaw * 10) / 10;

            if (!isNaN(fat) && !isNaN(snf) && milkType && date) {
                try {
                    const selectedFarmer = farmers.find(f => f.id.toString() === formData.farmer_id.toString());

                    // rate_type priority:
                    //   1. Fresh farmer object from DB (loaded on mount — always up to date)
                    //   2. Local JSON map (fallback if farmer not in loaded list)
                    //   3. Default 'sangh'
                    const rateType  = selectedFarmer?.rate_type
                                   || farmerRateTypesMap[String(formData.farmer_id)]
                                   || 'sangh';
                    const dairyIdStr = String(user?.dairy_id ?? '');

                    // 1. Try local CSV cache (instant, no network)
                    const cachedRate = lookupRateFromCache(ratesCache, {
                        milk_type: milkType, fat, snf, date, rate_type: rateType, dairy_id: dairyIdStr,
                    });
                    if (cachedRate !== null && cachedRate > 0) {
                        setFormData(prev => ({ ...prev, rate: cachedRate.toString() }));
                        setRateError('');
                        return;
                    }

                    // 2. Fallback: Supabase API
                    const result = await getRateForCollection({
                        milk_type: milkType, fat, snf, date, dairy_id: user?.dairy_id, rate_type: rateType
                    });

                    if (result && result.rate && result.rate > 0) {
                        setFormData(prev => ({ ...prev, rate: result.rate.toString() }));
                        setRateError('');
                    } else {
                        setFormData(prev => ({ ...prev, rate: '' }));
                        setRateError(t('collection.rateNotAvailableDate'));
                    }
                } catch (error) {
                    console.error("Error fetching rate:", error);
                    setRateError(t('collection.rateFetchError'));
                }
            } else {
                setRateError('');
            }
        };

        const fatRaw = parseFloat(formData.fat);
        const snfRaw = parseFloat(formData.snf);

        // Clear rate/amount when fat or snf is empty / 0 / invalid
        if (!formData.fat || !formData.snf || isNaN(fatRaw) || isNaN(snfRaw) || fatRaw <= 0 || snfRaw <= 0) {
            setFormData(prev => ({ ...prev, rate: '', amount: '' }));
            setRateError('');
            setIsFetchingRate(false);
            return;
        }

        setIsFetchingRate(true);
        const timer = setTimeout(() => { fetchRate().finally(() => setIsFetchingRate(false)); }, 400);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData.fat, formData.snf, formData.milk_type, formData.date, formData.farmer_id, ratesCache]);



    useEffect(() => {
        const calculate = async () => {
            if (isClearingRef.current) return; // Skip if clearing form

            const quantity = parseFloat(formData.quantity) || 0;
            const rate = parseFloat(formData.rate) || 0;
            let amount = 0;

            if (rate > 0 && quantity > 0) {
                amount = (quantity * rate);
            }

            setFormData(prev => ({
                ...prev,
                amount: amount > 0 ? amount.toFixed(2) : (prev.amount || '0.00')
            }));
        };

        const timer = setTimeout(calculate, 500);
        return () => clearTimeout(timer);
    }, [formData.rate, formData.quantity]);

    const handleCancelEdit = () => {
        setIsEditing(false);
        setEditId(null);
        setFormData({
            farmer_id: '',
            date: new Date().toISOString().split('T')[0],
            shift: 'Morning',
            milk_type: 'Buffalo',
            fat: '',
            snf: '',
            quantity: '',
            rate: '',
            amount: ''
        });
    };





    /**
     * Applies FAT & SNF calibration caps (min + max) for the given milk type.
     * Returns { fat, snf, messages, wasCapped }
     */
    const applyCalibrationCap = (rawFat, rawSnf, milkType) => {
        const isBuffalo = milkType === 'Buffalo';
        const minFat = parseFloat(isBuffalo ? minFatBuffalo : minFatCow);
        const maxFat = parseFloat(isBuffalo ? maxFatBuffalo : maxFatCow);
        const minSnf = parseFloat(isBuffalo ? minSnfBuffalo : minSnfCow);
        const maxSnf = parseFloat(isBuffalo ? maxSnfBuffalo : maxSnfCow);

        const parsedFat = parseFloat(rawFat);
        const parsedSnf = parseFloat(rawSnf);

        const messages = [];
        let finalFat = parsedFat;
        let finalSnf = parsedSnf;

        if (!isNaN(maxFat) && maxFat > 0 && parsedFat > maxFat) {
            messages.push(`FAT: ${parsedFat.toFixed(1)} → ${maxFat.toFixed(1)}% (exceeded max)`);
            finalFat = maxFat;
        } else if (!isNaN(minFat) && minFat > 0 && parsedFat < minFat) {
            messages.push(`FAT: ${parsedFat.toFixed(1)} → ${minFat.toFixed(1)}% (below min)`);
            finalFat = minFat;
        }

        if (!isNaN(maxSnf) && maxSnf > 0 && parsedSnf > maxSnf) {
            messages.push(`SNF: ${parsedSnf.toFixed(1)} → ${maxSnf.toFixed(1)}% (exceeded max)`);
            finalSnf = maxSnf;
        } else if (!isNaN(minSnf) && minSnf > 0 && parsedSnf < minSnf) {
            messages.push(`SNF: ${parsedSnf.toFixed(1)} → ${minSnf.toFixed(1)}% (below min)`);
            finalSnf = minSnf;
        }

        return { fat: finalFat, snf: finalSnf, messages, wasCapped: messages.length > 0 };
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.farmer_id) {
            showAlert(t('collection.selectFarmerReq'), t('collection.titleNew'), 'warning');
            return;
        }

        const rate = parseFloat(formData.rate);
        const quantity = parseFloat(formData.quantity);

        if (!rate || rate <= 0) {
            setRateError(t('collection.rateNotAvailable'));
            return;
        }

        const calculatedAmount = (quantity * rate).toFixed(2);



        try {
            const submissionData = {
                ...formData,
                amount: parseFloat(calculatedAmount)
            };

            setLoading(true); // Start loading

            // ── Employee: block saving to past dates ─────────────────────────
            // Allow if: editing with canEditSavedEntry, OR new entry with canSavePastEntry
            if (isEmployee && isPastDate) {
                const allowedToEdit   = isEditing && canEditSavedEntry;
                const allowedToSave   = !isEditing && canSavePastEntry;
                if (!allowedToEdit && !allowedToSave) {
                    setLoading(false);
                    showAlert(
                        isEditing
                            ? t('collection.employeeEditPastBlocked', { defaultValue: 'You do not have permission to edit past entries. Contact your admin.' })
                            : t('collection.employeePastDateBlocked', { defaultValue: 'You can only save entries for today. Contact admin to add past entries.' }),
                        t('common.accessDenied', { defaultValue: 'Access Denied' }),
                        'warning'
                    );
                    return;
                }
            }

            // Check for duplicates
            const isDuplicate = recentCollections.some(c =>
                c.farmer_id.toString() === formData.farmer_id.toString() &&
                c.shift === formData.shift &&
                c.milk_type === formData.milk_type &&
                (!isEditing || c.id !== editId)
            );

            if (isDuplicate) {
                setLoading(false);
                if (isEmployee && !canEditSavedEntry) {
                    // Hard block for employees without edit permission — no override allowed
                    showAlert(
                        t('collection.duplicateBlockedEmployee', { defaultValue: 'Duplicate entry! This farmer already has an entry for this shift and milk type. Contact admin to modify.' }),
                        t('common.accessDenied', { defaultValue: 'Access Denied' }),
                        'error'
                    );
                    return;
                }
                // Admin: show confirm dialog
                const confirmed = await showConfirm(
                    t('collection.duplicateConfirm'),
                    t('common.warning', { defaultValue: "Warning" })
                );
                if (!confirmed) {
                    setLoading(false);
                    return;
                }
                setLoading(true); // Resume loading if confirmed
            }



            // ── Anomaly detection: compare against locally-cached last quantity ────
            // Only for new entries. Editing is always allowed without this check.
            if (!isEditing) {
                const cacheKey = `${formData.farmer_id}_${formData.shift}`;
                const cached = farmerHistoryRef.current[cacheKey];
                if (cached && cached.qty > 0) {
                    const lastQty = cached.qty;
                    // Warn if entered qty is more than 2x the last qty AND diff >= 2L
                    const isAnomalous = quantity > lastQty * 2 && (quantity - lastQty) >= 2;
                    if (isAnomalous) {
                        setLoading(false);
                        const msg = t('collection.unusualQtyMsg', {
                            shift: formData.shift,
                        lastQty: lastQty.toFixed(3),
                            qty: quantity.toFixed(3)
                        }).replace('{shift}', formData.shift)
                          .replace('{lastQty}', lastQty.toFixed(3))
                          .replace('{qty}', quantity.toFixed(3));
                        const confirmed = await showConfirm(
                            msg,
                            t('collection.unusualQtyTitle'),
                            t('collection.yesSave'),
                            t('collection.cancel')
                        );
                        if (!confirmed) { setLoading(false); return; }
                        setLoading(true);
                    }
                } else if (!cached && quantity > 50) {
                    // No history at all: warn if absolute value is suspiciously large
                    setLoading(false);
                    const msg = t('collection.unusualQtyFallback', { qty: quantity.toFixed(3) })
                        .replace('{qty}', quantity.toFixed(3));
                    const confirmed = await showConfirm(
                        msg,
                        t('collection.unusualQtyTitle'),
                        t('collection.yesSave'),
                        t('collection.cancel')
                    );
                    if (!confirmed) { setLoading(false); return; }
                    setLoading(true);
                }
            }
            // ────────────────────────────────────────────────────────────────────

            // ── FAT/SNF Calibration Cap ──────────────────────────────────────────
            const capResult = applyCalibrationCap(formData.fat, formData.snf, formData.milk_type);
            if (capResult.wasCapped) {
                setLoading(false);
                const msgBody = capResult.messages.join('\n');
                const alertBody = t('settings.calibration.alertBody', { details: msgBody })
                    .replace('{details}', msgBody);
                const confirmed = await showConfirm(
                    alertBody,
                    t('settings.calibration.alertTitle'),
                    t('settings.calibration.okSave'),
                    t('settings.calibration.cancel')
                );
                if (!confirmed) { setLoading(false); return; }
                // Apply the capped values to formData before saving
                setFormData(prev => ({ ...prev, fat: String(capResult.fat), snf: String(capResult.snf) }));
                setLoading(true);
                // Re-build submissionData with capped values
                submissionData.fat = capResult.fat;
                submissionData.snf = capResult.snf;

                // Re-fetch the rate for the capped fat/snf values
                try {
                    const selectedFarmer = farmers.find(f => f.id.toString() === formData.farmer_id.toString());
                    const rateType = selectedFarmer?.rate_type || 'sangh';
                    const rateResult = await getRateForCollection({
                        milk_type: formData.milk_type,
                        fat: capResult.fat,
                        snf: capResult.snf,
                        date: formData.date,
                        dairy_id: user?.dairy_id,
                        rate_type: rateType
                    });
                    if (rateResult && rateResult.rate && rateResult.rate > 0) {
                        submissionData.rate = rateResult.rate;
                        submissionData.amount = (parseFloat(formData.quantity) * rateResult.rate).toFixed(2);
                    } else {
                        // Rate not found for capped values, fallback to current rate
                        submissionData.amount = (parseFloat(formData.quantity) * parseFloat(formData.rate)).toFixed(2);
                    }
                } catch (rateErr) {
                    console.warn('Rate re-fetch after cap failed:', rateErr);
                    submissionData.amount = (parseFloat(formData.quantity) * parseFloat(formData.rate)).toFixed(2);
                }
            }
            // ────────────────────────────────────────────────────────────────────

            let savedCollectionId = null;
            let newCollection = null;

            // ── Snapshot state before any React setIsEditing/setFormData calls ──
            // The Thev IIFE runs asynchronously — by the time it reads React state,
            // setIsEditing(false) and setFormData({farmer_id: ''}) have already fired.
            // Capturing here guarantees correct values for both new-entry and edit paths.
            const wasEditing = isEditing;
            const capturedFarmerId = formData.farmer_id;
            // ─────────────────────────────────────────────────────────────────────

            if (isEditing) {
                await updateCollection({ ...submissionData, id: editId, dairy_id: user?.dairy_id }, user?.dairy_id);
                // Update local cache with the corrected quantity from the edit
                updateFarmerHistoryEntry(formData.farmer_id, formData.shift, quantity, formData.date);
                setIsEditing(false);
                setEditId(null);
                savedCollectionId = editId;

                // Reload list to show updated entry
                await loadRecentCollections(formData.date);

                // Clear form but keep date/shift (Smart Clearing)
                // If machine is connected, set to '0' so operator can see machine is ready for next reading
                isClearingRef.current = true;
                setFormData(prev => ({
                    ...prev,
                    farmer_id: '',
                    fat: isFatMachineConnected ? '0' : '',
                    snf: isFatMachineConnected ? '0' : '',
                    quantity: isWeightMachineConnected ? '0' : '',
                    rate: '',
                    amount: ''
                }));

                // ── AUTO ZERO: send tare/zero to weight machine after every save ──
                if (isWeightMachineConnected && window.electron) {
                    window.electron.invoke('weight-machine-command', { action: 'send_zero' })
                        .catch(err => console.warn('[AutoZero] Zero command failed (non-fatal):', err));
                }
                // ─────────────────────────────────────────────────────────────────

                // Auto-focus back to farmer field after edit
                setTimeout(() => {
                    isClearingRef.current = false;
                    setTimeout(() => {
                        if (farmerInputRef.current) farmerInputRef.current.focus();
                    }, 0); // nested tick ensures React has committed the re-render
                }, 600);


                setLoading(false); // Stop loading before alert

                // Voice alert for update
                if (isVoiceEnabled) {
                    try {
                        const farmer = farmers.find(f => f.id.toString() === submissionData.farmer_id.toString());
                        const lang = i18n.language || 'en';
                        const isEnglish = lang.startsWith('en');
                        const farmerName = isEnglish
                            ? (farmer?.name || farmer?.name_local || 'Unknown')
                            : (farmer?.name_local || farmer?.name || 'Unknown');
                        const result = await speakCollectionSummary({
                            farmerName,
                            quantity: submissionData.quantity,
                            fat: submissionData.fat,
                            snf: submissionData.snf,
                            rate: submissionData.rate,
                            amount: submissionData.amount,
                            milkType: submissionData.milk_type,
                            shift: submissionData.shift
                        }, lang);
                        // Show one-time hint if Marathi/Hindi voice is not installed
                        if (result?.usingFallback && !voiceFallbackShownRef.current && !lang.startsWith('en')) {
                            voiceFallbackShownRef.current = true;
                            setTimeout(() => {
                                const langName = lang === 'mr' ? 'Marathi' : 'Hindi';
                                showToast(
                                    `💡 For pure ${langName} voice: Windows Settings → Time & Language → Speech → Add voices → ${langName}`,
                                    'info',
                                    8000
                                );
                            }, 1200);
                        }
                    } catch (voiceErr) {
                        console.warn('[Voice] Alert error (update):', voiceErr);
                    }
                }

                setTimeout(() => {
                    showToast(t('collection.updateSuccess'), 'success');
                }, 100);
            } else {
                if (!user?.dairy_id) {
                    showAlert("System Error: Dairy ID missing.", "Error", 'error');
                    return;
                }
                newCollection = await addCollection({ ...submissionData, dairy_id: user.dairy_id });
                savedCollectionId = newCollection?.id;
                // Cache this as the new "last entry" for this farmer+shift
                // (local cache only, NEVER deletes or modifies any online/Supabase data)
                updateFarmerHistoryEntry(formData.farmer_id, formData.shift, quantity, formData.date);
            }
            

            if (!wasEditing && isPrintEnabled) {
                setTimeout(() => {
                    printReceipt(submissionData).then(result => {
                        // If print was silently skipped (e.g. previous job still locking)
                        if (result && result.success === false) {
                            showToast('⚠️ Printer busy — please use the print button on the entry below', 'warning', 4000);
                        }
                    }).catch(err => {
                        console.error('Background print failed:', err);
                    });
                }, 100);
            }

            // If machine is connected, set to '0' so operator can see machine is ready for next reading
            isClearingRef.current = true;
            setFormData(prev => ({
                    ...prev,
                    farmer_id: '',
                    fat: isFatMachineConnected ? '0' : '',
                    snf: isFatMachineConnected ? '0' : '',
                    quantity: isWeightMachineConnected ? '0' : '',
                    rate: '',
                    amount: ''
                }));

            // ── AUTO ZERO: send tare/zero to weight machine after every save ──
            // Fire-and-forget — never blocks the save flow, never shows an alert.
            // Sends all 7 zero formats (T\r\n, Z\r\n, @\r\n, ENQ, +00000.000 Lt, etc.)
            // so the scale resets to +00000.000 Lt ready for the next farmer.
            if (isWeightMachineConnected && window.electron) {
                window.electron.invoke('weight-machine-command', { action: 'send_zero' })
                    .catch(err => console.warn('[AutoZero] Zero command failed (non-fatal):', err));
            }
            // ─────────────────────────────────────────────────────────────────

                // Auto-focus back to farmer field after new save
                setTimeout(() => {
                    isClearingRef.current = false;
                    setTimeout(() => {
                        if (farmerInputRef.current) farmerInputRef.current.focus();
                    }, 0); // nested tick ensures React has committed the re-render
                }, 600);

                // Wait for the list to reload BEFORE showing success to prevent re-render jumps
                await loadRecentCollections(formData.date);
                setLoading(false); // Stop loading before alert

                // Voice alert for new save
                if (isVoiceEnabled) {
                    try {
                        const farmer = farmers.find(f => f.id.toString() === submissionData.farmer_id.toString());
                        const lang = i18n.language || 'en';
                        const isEnglish = lang.startsWith('en');
                        const farmerName = isEnglish
                            ? (farmer?.name || farmer?.name_local || 'Unknown')
                            : (farmer?.name_local || farmer?.name || 'Unknown');
                        const result = await speakCollectionSummary({
                            farmerName,
                            quantity: submissionData.quantity,
                            fat: submissionData.fat,
                            snf: submissionData.snf,
                            rate: submissionData.rate,
                            amount: submissionData.amount,
                            milkType: submissionData.milk_type,
                            shift: submissionData.shift
                        }, lang);
                        // Show one-time hint if Marathi/Hindi voice is not installed
                        if (result?.usingFallback && !voiceFallbackShownRef.current && !lang.startsWith('en')) {
                            voiceFallbackShownRef.current = true;
                            setTimeout(() => {
                                const langName = lang === 'mr' ? 'Marathi' : 'Hindi';
                                showToast(
                                    `💡 For pure ${langName} voice: Windows Settings → Time & Language → Speech → Add voices → ${langName}`,
                                    'info',
                                    8000
                                );
                            }, 1200);
                        }
                    } catch (voiceErr) {
                        console.warn('[Voice] Alert error (save):', voiceErr);
                    }
                }

                // Refresh Thev cache so next print receipt shows the updated balance
                refreshThevCache();

                // Small delay to ensure loading overlay is gone before alert pops
                setTimeout(() => {
                    showToast(t('collection.saveSuccess'), 'success');
                }, 100);
        } catch (error) {
            setLoading(false);
            console.error("Error saving collection:", error);
            showAlert(t('collection.saveError') + ": " + error.message, t('collection.titleNew'), 'error');
        } finally {
            // Safety net: ensure loading is never permanently stuck
            // (handles unexpected throws or missed return paths)
            setLoading(false);
        }
    };


    const handleDelete = async (id) => {
        if (!canDeleteEntry) {
            showAlert(
                t('employeePermissions.accessDeniedMsg', { defaultValue: 'You do not have permission to delete entries. Contact your admin.' }),
                t('employeePermissions.accessDeniedTitle', { defaultValue: 'Access Denied' }),
                'warning'
            );
            return;
        }
        const confirmed = await showConfirm(t('collection.deleteConfirm'), t('collection.titleNew'), t('common.delete', { defaultValue: 'Delete' }), t('common.cancel', { defaultValue: 'Cancel' }));
        if (!confirmed) return;

        try {
            // Find the collection before deleting to clear its local cache
            const toDelete = recentCollections.find(c => c.id === id);
            await deleteCollection(id, user?.dairy_id);
            // Clear local cache for this farmer+shift (DOES NOT touch online data)
            if (toDelete?.farmer_id && toDelete?.shift) {
                clearFarmerHistoryEntry(toDelete.farmer_id.toString(), toDelete.shift);
            }
            loadRecentCollections(formData.date);
        } catch (error) {
            console.error("Error deleting collection:", error);
            showAlert(t('collection.deleteError'), t('collection.titleNew'), 'error');
        }
    };

    const printReceipt = async (data) => {
        const farmer = farmers.find(f => f.id.toString() === data.farmer_id.toString());
        const farmerName = farmer ? farmer.name : 'Unknown';
        const farmerCode = farmer ? farmer.code : '---';

        if (!window.electron || !window.electron.printReceipt) {
            console.error('ERROR: window.electron.printReceipt is missing!');
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

            // SYNCHRONOUS Thev balance lookup from cached state.
            // CRITICAL: Must NOT do any async DB call here — async breaks Electron's
            // user-gesture trust chain and causes the print dialog to be silently blocked.
            let thevSchemeName = null;
            let thevBalance = null;
            const activeAcc = thevAccountsCache.find(
                a => String(a.farmer_id) === String(data.farmer_id) && a.status === 'active'
            );
            if (activeAcc) {
                thevSchemeName = activeAcc.thev_name;
                thevBalance = parseFloat(activeAcc.current_balance) || 0;
            }

            const result = await window.electron.printReceipt({
                ...data,
                farmerName,
                farmerCode,
                dairyName: user?.dairy_name,
                thevSchemeName,
                thevBalance,
                addedWater: (() => {
                    // Only pass a value when showWater is ON in print settings.
                    // Fallback to 0 (no water detected) when machine hasn't sent data yet.
                    const settings = JSON.parse(localStorage.getItem('entryPrintSettings') || '{}');
                    if (!settings.showWater) return null; // toggle OFF → always hide
                    return fatMachineExtra?.added_water ?? 0;
                })(),
                amount: parseFloat(data.amount) || 0,
                rate: parseFloat(data.rate) || 0,
                quantity: parseFloat(data.quantity) || 0
            }, i18n.language, printSettings);
            console.log('Print command sent successfully');
            return result;
        } catch (error) {
            console.error('Print error:', error);
            throw error;
        }
    };

    return (
        <div style={{
            padding: '16px 32px',
            maxWidth: '1600px',
            margin: '0 auto',
            background: 'transparent',
            minHeight: '100%',
            position: 'relative'
        }}>
            {/* Spin keyframe for rate-fetch loading spinner */}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            {loading && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(255, 255, 255, 0.4)',
                    zIndex: 50,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(1px)'
                }}>
                    <Loader text={t('common.loading') || "Loading..."} />
                </div>
            )}

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
                        <Droplets size={28} />
                        {isEditing ? t('collection.titleEdit') : t('collection.titleNew')}
                    </h1>
                    <p style={{ fontSize: '15px', color: '#6b7280', margin: 0 }}>
                        {t('collection.subtitle')}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    {/* Voice Alert Toggle Button */}
                    <button
                        type="button"
                        onClick={() => {
                            const newVal = !isVoiceEnabled;
                            setIsVoiceEnabled(newVal);
                            setVoiceAlertEnabled(newVal);
                        }}
                        style={{
                            padding: '10px 20px',
                            background: isVoiceEnabled ? 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' : '#e5e7eb',
                            color: isVoiceEnabled ? 'white' : '#6b7280',
                            border: 'none',
                            borderRadius: '10px',
                            fontSize: '15px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.3s',
                            boxShadow: isVoiceEnabled ? '0 4px 12px rgba(139, 92, 246, 0.3)' : 'none'
                        }}
                        title={isVoiceEnabled ? t('collection.voiceOn') : t('collection.voiceOff')}
                    >
                        {isVoiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                        {isVoiceEnabled ? t('collection.voiceOn') : t('collection.voiceOff')}
                    </button>

                    {/* Printer Toggle Button */}
                    <button
                        type="button"
                        onClick={() => setIsPrintEnabled(!isPrintEnabled)}
                        style={{
                            padding: '10px 20px',
                            background: isPrintEnabled ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#e5e7eb',
                            color: isPrintEnabled ? 'white' : '#6b7280',
                            border: 'none',
                            borderRadius: '10px',
                            fontSize: '15px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.3s',
                            boxShadow: isPrintEnabled ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none'
                        }}
                        title={isPrintEnabled ? 'Auto-print enabled' : 'Auto-print disabled'}
                    >
                        <Printer size={18} />
                        {isPrintEnabled ? 'Printer ON' : 'Printer OFF'}
                    </button>

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
                            {t('collection.cancel')}
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1fr',
                gap: '24px',
                marginBottom: '32px'
            }}>
                {/* Collection Form */}
                <div
                    ref={formRef}
                    style={{

                        background: 'white',
                        borderRadius: '20px',
                        padding: '32px',
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        position: 'relative'
                    }}>
                    {/* ── Employee past-date view-only banner ──────────────────── */}
                    {isEmployee && isPastDate && !canSavePastEntry && !(isEditing && canEditSavedEntry) && (
                        <div style={{
                            marginBottom: '16px',
                            padding: '12px 16px',
                            background: '#fffbeb',
                            border: '1.5px solid #f59e0b',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            fontSize: '14px',
                            color: '#92400e',
                            fontWeight: '600'
                        }}>
                            👁️ {t('collection.employeeViewOnly', { defaultValue: 'View Only — Browsing past date. You cannot save, edit, or delete entries here.' })}
                        </div>
                    )}
                    <form onSubmit={handleSubmit}>
                        {/* Two Column Grid for Form Fields */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                            {/* Date */}
                            <div>
                                <label style={{
                                    display: 'block',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: '#374151',
                                    marginBottom: '8px'
                                }}>
                                    {t('collection.date')}
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={formData.date || ''}
                                    onChange={handleInputChange}
                                    name="date"
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        borderRadius: '12px',
                                        border: (isEmployee && formData.date !== todayStr)
                                            ? '2px solid #f59e0b'
                                            : '2px solid #e5e7eb',
                                        fontSize: '15px',
                                        outline: 'none',
                                        transition: 'all 0.2s'
                                    }}
                                />
                            </div>

                            {/* Shift */}
                            <div>
                                <label style={{
                                    display: 'block',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: '#374151',
                                    marginBottom: '8px'
                                }}>
                                    {t('collection.shift')}
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
                                    <option value="Morning">{t('collection.morning')}</option>
                                    <option value="Evening">{t('collection.evening')}</option>
                                </select>
                            </div>
                        </div>

                        {/* Farmer Selection */}
                        <div style={{ marginBottom: '24px' }}>
                            <label style={{
                                display: 'block',
                                fontSize: '14px',
                                fontWeight: '600',
                                color: '#374151',
                                marginBottom: '8px'
                            }}>
                                {t('collection.selectFarmer')}
                            </label>
                            <SearchableCombobox
                                autoFocusRef={farmerInputRef}
                                options={farmers.map(f => ({
                                    value: f.id ? f.id.toString() : '',
                                    label: `${f.code || ''} - ${f.name || ''}`,
                                    searchKey: f.code ? f.code.toString() : ''
                                }))}
                                value={formData.farmer_id}
                                onChange={(val) => handleInputChange({ target: { name: 'farmer_id', value: val } })}
                                placeholder={t('collection.selectFarmer')}
                                onEnterPressed={() => {
                                    if (fatInputRef.current) fatInputRef.current.focus();
                                }}
                            />
                        </div>

                        {/* Milk Type */}
                        <div style={{ marginBottom: '24px' }}>
                            <label style={{
                                display: 'block',
                                fontSize: '14px',
                                fontWeight: '600',
                                color: '#374151',
                                marginBottom: '8px'
                            }}>
                                {t('collection.milkType')}
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
                                <option value="Buffalo">🐃 {t('collection.buffalo')}</option>
                                <option value="Cow">🐄 {t('collection.cow')}</option>
                            </select>
                        </div>

                        {/* Three Column Grid for Measurements — Order: Liter → Fat → SNF */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                            {/* Quantity (Liter) — FIRST */}
                            <div>
                                <label style={{
                                    display: 'block',
                                    fontSize: '14px',
                                    fontWeight: '700',
                                    color: '#667eea',
                                    marginBottom: '8px'
                                }}>
                                    {t('collection.quantity')} (L)
                                </label>
                                <input
                                    ref={quantityInputRef}
                                    type="text"
                                    inputMode="decimal"
                                    name="quantity"
                                    value={formData.quantity || ''}
                                    onChange={handleInputChange}
                                    onKeyDown={(e) => handleEnterPress(e, fatInputRef)}
                                    placeholder="0.0"
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        borderRadius: '12px',
                                        border: '2px solid #667eea',
                                        fontSize: '15px',
                                        fontWeight: '700',
                                        color: '#667eea',
                                        outline: 'none'
                                    }}
                                />
                            </div>

                            {/* Fat — SECOND */}
                            <div>
                                <label style={{
                                    display: 'block',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: '#374151',
                                    marginBottom: '8px'
                                }}>
                                    {t('collection.fat')}
                                </label>
                                <input
                                    ref={fatInputRef}
                                    type="text"
                                    inputMode="decimal"
                                    name="fat"
                                    value={formData.fat || ''}
                                    onChange={handleInputChange}
                                    onKeyDown={(e) => handleEnterPress(e, snfInputRef)}
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

                            {/* SNF — THIRD */}
                            <div>
                                <label style={{
                                    display: 'block',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: '#374151',
                                    marginBottom: '8px'
                                }}>
                                    {t('collection.snf')}
                                </label>
                                <input
                                    ref={snfInputRef}
                                    type="text"
                                    inputMode="decimal"
                                    name="snf"
                                    value={formData.snf || ''}
                                    onChange={handleInputChange}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            if (submitBtnRef.current) submitBtnRef.current.click();
                                        }
                                    }}
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

                        {/* Submit Button */}
                        {/* Show lock ONLY if employee is on a past date AND has no permission to act */}
                        {isEmployee && formData.date !== todayStr && !(isEditing && canEditSavedEntry) && !canSavePastEntry ? (
                            <div style={{
                                width: '100%',
                                padding: '14px 24px',
                                background: '#f3f4f6',
                                color: '#9ca3af',
                                border: '2px solid #e5e7eb',
                                borderRadius: '12px',
                                fontSize: '16px',
                                fontWeight: '600',
                                cursor: 'not-allowed',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px',
                                userSelect: 'none'
                            }}>
                                🔒 {t('collection.viewOnlyMode', { defaultValue: 'View Only – Cannot save past entries' })}
                            </div>
                        ) : (
                            <button
                                ref={submitBtnRef}
                                type="submit"
                                disabled={loading}
                                style={{
                                    width: '100%',
                                    padding: '14px 24px',
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '12px',
                                    fontSize: '16px',
                                    fontWeight: '600',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '10px',
                                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.35)',
                                    transition: 'all 0.3s',
                                    opacity: loading ? 0.7 : 1
                                }}
                            >
                                <Save size={20} strokeWidth={2.5} />
                                {isEditing ? t('collection.update') : t('collection.save')}
                            </button>
                        )}
                    </form>

                    {rateError && (
                        <div style={{
                            marginTop: '16px',
                            padding: '12px',
                            background: '#fee2e2',
                            border: '1px solid #fca5a5',
                            borderRadius: '12px',
                            color: '#b91c1c',
                            fontSize: '14px',
                            fontWeight: '500',
                            textAlign: 'center'
                        }}>
                            {rateError}
                        </div>
                    )}
                </div>

                {/* Summary Card */}
                <div>
                    <div style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        borderRadius: '20px',
                        padding: '28px',
                        color: 'white',
                        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.25)'
                    }}>
                        <h3 style={{
                            fontSize: '18px',
                            fontWeight: '700',
                            marginBottom: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px'
                        }}>
                            <Calculator size={22} />
                            {t('collection.summary')}
                        </h3>

                        {/* Rate Display */}
                        <div style={{
                            background: 'rgba(255,255,255,0.15)',
                            borderRadius: '14px',
                            padding: '20px',
                            marginBottom: '16px',
                            transition: 'all 0.3s'
                        }}>
                            <p style={{
                                fontSize: '13px',
                                opacity: 0.9,
                                margin: '0 0 8px 0',
                                fontWeight: '500',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                {t('collection.rate')}
                                {isFetchingRate && (
                                    <span style={{
                                        display: 'inline-block',
                                        width: '14px',
                                        height: '14px',
                                        border: '2px solid rgba(255,255,255,0.4)',
                                        borderTopColor: 'white',
                                        borderRadius: '50%',
                                        animation: 'spin 0.7s linear infinite'
                                    }} />
                                )}
                            </p>
                            <p style={{
                                fontSize: '32px',
                                fontWeight: '700',
                                margin: 0,
                                lineHeight: 1,
                                opacity: isFetchingRate ? 0.4 : 1,
                                transition: 'opacity 0.3s'
                            }}>
                                {isFetchingRate ? '...' : (formData.rate ? `₹${formData.rate}` : '—')}
                            </p>
                        </div>

                        {/* Amount Display */}
                        <div style={{
                            background: 'rgba(255,255,255,0.15)',
                            borderRadius: '14px',
                            padding: '20px',
                            marginBottom: '16px',
                            transition: 'all 0.3s'
                        }}>
                            <p style={{
                                fontSize: '13px',
                                opacity: 0.9,
                                margin: '0 0 8px 0',
                                fontWeight: '500'
                            }}>
                                {t('collection.totalAmount')}
                            </p>
                            <p style={{
                                fontSize: '32px',
                                fontWeight: '700',
                                margin: 0,
                                lineHeight: 1,
                                opacity: isFetchingRate ? 0.4 : 1,
                                transition: 'opacity 0.3s'
                            }}>
                                {isFetchingRate ? '...' : (formData.amount ? `₹${formData.amount}` : '—')}
                            </p>
                        </div>

                        {/* ── Fat Machine Extra Readings — always visible ── */}
                        <div style={{
                            background: 'rgba(255,255,255,0.12)',
                            borderRadius: '14px',
                            padding: '16px 20px',
                            marginBottom: '16px',
                            border: '1px solid rgba(255,255,255,0.25)'
                        }}>
                            <p style={{
                                fontSize: '12px',
                                opacity: 0.85,
                                margin: '0 0 12px 0',
                                fontWeight: '700',
                                letterSpacing: '0.5px',
                                textTransform: 'uppercase',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}>
                                🧪 फॅट मशीन माहिती
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                {/* Added Water */}
                                <div style={{
                                    background: fatMachineExtra && parseFloat(fatMachineExtra.added_water) > 0.5
                                        ? 'rgba(239,68,68,0.25)'
                                        : 'rgba(255,255,255,0.1)',
                                    borderRadius: '10px',
                                    padding: '10px 12px',
                                    border: fatMachineExtra && parseFloat(fatMachineExtra.added_water) > 0.5
                                        ? '1px solid rgba(239,68,68,0.5)'
                                        : '1px solid rgba(255,255,255,0.15)'
                                }}>
                                    <div style={{ fontSize: '11px', opacity: 0.8, marginBottom: '3px' }}>💧 मिलावट पाणी</div>
                                    <div style={{
                                        fontSize: '18px',
                                        fontWeight: '700',
                                        color: fatMachineExtra && parseFloat(fatMachineExtra.added_water) > 0.5 ? '#fca5a5' : 'white'
                                    }}>
                                        {fatMachineExtra?.added_water != null ? `${fatMachineExtra.added_water}%` : '—'}
                                    </div>
                                    {fatMachineExtra && parseFloat(fatMachineExtra.added_water) > 0.5 && (
                                        <div style={{ fontSize: '10px', color: '#fca5a5', marginTop: '2px' }}>⚠️ मिलावट आढळली!</div>
                                    )}
                                </div>
                                {/* Protein */}
                                <div style={{
                                    background: 'rgba(255,255,255,0.1)',
                                    borderRadius: '10px',
                                    padding: '10px 12px',
                                    border: '1px solid rgba(255,255,255,0.15)'
                                }}>
                                    <div style={{ fontSize: '11px', opacity: 0.8, marginBottom: '3px' }}>🥛 प्रथिने</div>
                                    <div style={{ fontSize: '18px', fontWeight: '700' }}>
                                        {fatMachineExtra?.protein != null ? `${fatMachineExtra.protein}%` : '—'}
                                    </div>
                                </div>
                                {/* Density */}
                                <div style={{
                                    background: 'rgba(255,255,255,0.1)',
                                    borderRadius: '10px',
                                    padding: '10px 12px',
                                    border: '1px solid rgba(255,255,255,0.15)'
                                }}>
                                    <div style={{ fontSize: '11px', opacity: 0.8, marginBottom: '3px' }}>⚖️ घनता</div>
                                    <div style={{ fontSize: '18px', fontWeight: '700' }}>
                                        {fatMachineExtra?.density != null ? fatMachineExtra.density : '—'}
                                    </div>
                                </div>
                                {/* Temperature */}
                                <div style={{
                                    background: 'rgba(255,255,255,0.1)',
                                    borderRadius: '10px',
                                    padding: '10px 12px',
                                    border: '1px solid rgba(255,255,255,0.15)'
                                }}>
                                    <div style={{ fontSize: '11px', opacity: 0.8, marginBottom: '3px' }}>🌡️ तापमान</div>
                                    <div style={{ fontSize: '18px', fontWeight: '700' }}>
                                        {fatMachineExtra?.temperature != null ? `${fatMachineExtra.temperature}°C` : '—'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{
                            marginTop: '4px',
                            padding: '16px',
                            background: 'rgba(255,255,255,0.1)',
                            borderRadius: '12px',
                            fontSize: '13px',
                            lineHeight: '1.5'
                        }}>
                            💡 <strong>{t('collection.tip')}:</strong> {t('collection.tipContent')}
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Collections — header + skeleton/empty state */}
            <div>
                <h2 style={{
                    fontSize: '24px',
                    fontWeight: '700',
                    marginBottom: '20px',
                    color: '#111827'
                }}>
                    {t('collection.todaysCollections')}
                </h2>

                {/* Skeleton shimmer while loading */}
                {listLoading && (
                    <div style={{
                        background: 'white',
                        borderRadius: '20px',
                        overflow: 'hidden',
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        padding: '16px 24px'
                    }}>
                        <style>{`
                            @keyframes shimmer {
                                0%   { background-position: -600px 0; }
                                100% { background-position:  600px 0; }
                            }
                            .skeleton-row {
                                height: 52px;
                                border-radius: 10px;
                                margin-bottom: 10px;
                                background: linear-gradient(90deg, #f3f4f6 25%, #e9eaf0 50%, #f3f4f6 75%);
                                background-size: 600px 100%;
                                animation: shimmer 1.4s infinite linear;
                            }
                        `}</style>
                        {[1, 2, 3, 4, 5].map(n => (
                            <div key={n} className="skeleton-row" style={{ opacity: 1 - n * 0.12 }} />
                        ))}
                    </div>
                )}

                {/* Empty state */}
                {!listLoading && recentCollections.length === 0 && (
                    <div style={{
                        background: 'white',
                        borderRadius: '20px',
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        textAlign: 'center',
                        padding: '60px 20px',
                        color: '#9ca3af'
                    }}>
                        <Calculator size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                        <p style={{ fontSize: '15px', fontWeight: '500', margin: '0 0 4px 0' }}>
                            {t('collection.noCollections')}
                        </p>
                        <p style={{ fontSize: '13px', margin: 0 }}>
                            {t('collection.collectionsAppear')}
                        </p>
                    </div>
                )}
            </div>

            {/* ══════════════════════════════════════════════════════════
                COLLECTION TABLES
                Vertical  = Shifts  (selected shift on top)
                Horizontal = Milk types (🐃 Buffalo left | 🐄 Cow right)
            ════════════════════════════════════════════════════════════ */}
            {!listLoading && recentCollections.length > 0 && (() => {

                /* ── theme definitions ── */
                const themes = {
                    buffalo: {
                        icon: '🐃', key: 'Buffalo',
                        iconBg: 'linear-gradient(135deg,#dbeafe,#bfdbfe)',
                        iconShadow: '0 2px 8px rgba(59,130,246,0.25)',
                        title: t('collection.buffaloEntries'),
                        titleColor: '#1e3a8a', subtitleColor: '#1d4ed8',
                        border: '#bfdbfe', shadow: '0 2px 12px rgba(59,130,246,0.14)',
                        headBg: 'linear-gradient(135deg,#eff6ff,#dbeafe)',
                        headColor: '#1e40af', qtyColor: '#1d4ed8',
                        rowBorder: '#dbeafe', altRow: '#eff6ff',
                    },
                    cow: {
                        icon: '🐄', key: 'Cow',
                        iconBg: 'linear-gradient(135deg,#fef3c7,#fde68a)',
                        iconShadow: '0 2px 8px rgba(251,191,36,0.30)',
                        title: t('collection.cowEntries'),
                        titleColor: '#92400e', subtitleColor: '#b45309',
                        border: '#fde68a', shadow: '0 2px 12px rgba(251,191,36,0.18)',
                        headBg: 'linear-gradient(135deg,#fffbeb,#fef3c7)',
                        headColor: '#92400e', qtyColor: '#b45309',
                        rowBorder: '#fef3c7', altRow: '#fffbeb',
                    },
                };

                /* ── render one animal-type table ── */
                const renderAnimalTable = (entries, theme) => (
                    <div style={{ flex: '1 1 0', minWidth: 0, overflow: 'hidden' }}>
                        {/* mini header */}
                        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
                            <div style={{
                                width:'36px', height:'36px', borderRadius:'10px',
                                background: theme.iconBg, display:'flex',
                                alignItems:'center', justifyContent:'center',
                                fontSize:'20px', boxShadow: theme.iconShadow, flexShrink: 0
                            }}>{theme.icon}</div>
                            <div style={{ minWidth:0 }}>
                                <div style={{ fontSize:'15px', fontWeight:'700', color: theme.titleColor }}>{theme.title}</div>
                                <div style={{ fontSize:'12px', color: theme.subtitleColor }}>
                                    {entries.length} {t('collection.records')}
                                    &nbsp;·&nbsp;
                                    <strong>{entries.reduce((s,c)=>s+parseFloat(c.quantity||0),0).toFixed(1)}L</strong>
                                    &nbsp;·&nbsp;
                                    <strong>₹{entries.reduce((s,c)=>s+parseFloat(c.amount||0),0).toFixed(2)}</strong>
                                </div>
                            </div>
                        </div>

                        {entries.length === 0 ? (
                            <div style={{
                                background:'white', borderRadius:'14px',
                                border:`2px dashed ${theme.border}`,
                                textAlign:'center', padding:'24px 12px', color:'#9ca3af'
                            }}>
                                <div style={{ fontSize:'26px' }}>{theme.icon}</div>
                                <div style={{ fontSize:'13px', marginTop:'6px' }}>{t('collection.noCollections')}</div>
                            </div>
                        ) : (
                            <div style={{
                                background:'white', borderRadius:'14px',
                                border:`2px solid ${theme.border}`,
                                boxShadow: theme.shadow,
                                overflowX: 'auto'
                            }}>
                                <table style={{ width:'100%', borderCollapse:'collapse', tableLayout:'fixed' }}>
                                    <colgroup>
                                        <col style={{ width:'130px' }}/>  {/* Farmer */}
                                        <col style={{ width:'70px' }}/>   {/* Qty */}
                                        <col style={{ width:'58px' }}/>   {/* Fat */}
                                        <col style={{ width:'58px' }}/>   {/* SNF */}
                                        <col style={{ width:'80px' }}/>   {/* Amount */}
                                        <col style={{ width:'110px' }}/>  {/* Actions */}
                                    </colgroup>
                                    <thead>
                                        <tr style={{ background: theme.headBg }}>
                                            {[
                                                { label: t('collection.table.farmer'), color: theme.headColor },
                                                { label: `${t('collection.table.quantity')} (L)`, color: theme.qtyColor },
                                                { label: t('collection.fat'), color: theme.headColor },
                                                { label: t('collection.snf'), color: theme.headColor },
                                                { label: t('collection.table.amount'), color: theme.headColor },
                                                { label: t('collection.table.action'), color: theme.headColor, center: true },
                                            ].map((col, i) => (
                                                <th key={i} style={{
                                                    padding: '10px 10px',
                                                    textAlign: col.center ? 'center' : 'left',
                                                    fontSize: '11px', fontWeight: '700',
                                                    color: col.color, letterSpacing: '0.4px',
                                                    textTransform: 'uppercase',
                                                    whiteSpace: 'nowrap', overflow: 'hidden'
                                                }}>{col.label}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {entries.map((c, index) => (
                                            <tr key={c.id} style={{
                                                borderBottom: `1px solid ${theme.rowBorder}`,
                                                background: index % 2 === 0 ? 'white' : theme.altRow,
                                            }}>
                                                <td style={{ padding:'11px 10px', fontSize:'13px', fontWeight:'600', color:'#111827', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                                    {c.farmer_name}
                                                </td>
                                                <td style={{ padding:'11px 10px', fontSize:'14px', fontWeight:'700', color: theme.qtyColor }}>
                                                    {c.quantity}L
                                                </td>
                                                <td style={{ padding:'11px 10px', fontSize:'13px', fontWeight:'600', color:'#4b5563' }}>
                                                    {c.fat}
                                                </td>
                                                <td style={{ padding:'11px 10px', fontSize:'13px', fontWeight:'600', color:'#4b5563' }}>
                                                    {c.snf}
                                                </td>
                                                <td style={{ padding:'11px 10px', fontSize:'14px', fontWeight:'700', color:'#059669' }}>
                                                    ₹{c.amount}
                                                </td>
                                                <td style={{ padding:'8px 8px', textAlign:'center' }}>
                                                    <div style={{ display:'flex', gap:'5px', justifyContent:'center', flexWrap:'nowrap' }}>
                                                        <button
                                                            onClick={() => { printReceipt(c).catch(err => console.error('Print failed:', err)); }}
                                                            title="Print"
                                                            style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:'30px', height:'30px', background:'#e0e7ff', border:'none', borderRadius:'7px', cursor:'pointer', color:'#4338ca', flexShrink:0 }}
                                                        ><Printer size={14}/></button>
                                                        {canEditSavedEntry && (
                                                            <button
                                                                onClick={() => handleEdit(c)}
                                                                title={t('collection.editTooltip')}
                                                                style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:'30px', height:'30px', background:'#f3f4f6', border:'none', borderRadius:'7px', cursor:'pointer', color:'#374151', flexShrink:0 }}
                                                            ><Edit size={14}/></button>
                                                        )}
                                                        {canDeleteEntry && (
                                                            <button
                                                                onClick={() => handleDelete(c.id)}
                                                                title={t('collection.deleteTooltip')}
                                                                style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:'30px', height:'30px', background:'#fee2e2', border:'none', borderRadius:'7px', cursor:'pointer', color:'#b91c1c', flexShrink:0 }}
                                                            ><Trash2 size={14}/></button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                );

                /* ── render one full shift block (Buffalo | Cow side-by-side) ── */
                const renderShiftBlock = (shiftLabel, shiftEntries, isSelected) => {
                    if (shiftEntries.length === 0) return null;
                    const buffalo = shiftEntries.filter(c => c.milk_type === 'Buffalo');
                    const cow     = shiftEntries.filter(c => c.milk_type === 'Cow');
                    const isMorning = shiftLabel === 'Morning';

                    return (
                        <div key={shiftLabel} style={{ marginTop:'24px' }}>
                            {/* Shift banner */}
                            <div style={{
                                display:'inline-flex', alignItems:'center', gap:'8px',
                                background: isMorning
                                    ? 'linear-gradient(135deg,#fef9c3,#fde047)'
                                    : 'linear-gradient(135deg,#e0e7ff,#818cf8)',
                                borderRadius:'12px', padding:'6px 18px',
                                marginBottom:'14px',
                                boxShadow: isMorning ? '0 2px 8px rgba(253,224,71,0.4)' : '0 2px 8px rgba(129,140,248,0.35)'
                            }}>
                                <span style={{ fontSize:'18px' }}>{isMorning ? '☀️' : '🌙'}</span>
                                <span style={{
                                    fontSize:'15px', fontWeight:'800',
                                    color: isMorning ? '#713f12' : '#3730a3',
                                    letterSpacing:'0.3px'
                                }}>
                                    {isMorning
                                        ? t('collection.morningShift')
                                        : t('collection.eveningShift')}
                                </span>
                                {isSelected && (
                                    <span style={{
                                        background:'white', color: isMorning ? '#713f12':'#3730a3',
                                        fontSize:'10px', fontWeight:'700', borderRadius:'6px',
                                        padding:'2px 8px', letterSpacing:'0.3px'
                                    }}>{t('collection.activeShift', { defaultValue: 'ACTIVE' })}</span>
                                )}
                                <span style={{ fontSize:'12px', color: isMorning ? '#92400e':'#4338ca', fontWeight:'600' }}>
                                    {shiftEntries.length} {t('collection.records')}
                                    &nbsp;·&nbsp;
                                    {shiftEntries.reduce((s,c)=>s+parseFloat(c.quantity||0),0).toFixed(1)}L
                                    &nbsp;·&nbsp;
                                    ₹{shiftEntries.reduce((s,c)=>s+parseFloat(c.amount||0),0).toFixed(2)}
                                </span>
                            </div>

                            {/* Buffalo (left) | Cow (right) */}
                            <div style={{ display:'flex', gap:'16px', alignItems:'flex-start' }}>
                                {renderAnimalTable(buffalo, themes.buffalo)}
                                {renderAnimalTable(cow,     themes.cow)}
                            </div>
                        </div>
                    );
                };

                /* ── order shifts: selected shift first ── */
                const selectedShift = formData.shift; // 'Morning' or 'Evening'
                const otherShift    = selectedShift === 'Morning' ? 'Evening' : 'Morning';

                const morningEntries = recentCollections.filter(c => c.shift === 'Morning');
                const eveningEntries = recentCollections.filter(c => c.shift === 'Evening');

                const firstShift  = selectedShift === 'Morning' ? morningEntries : eveningEntries;
                const secondShift = selectedShift === 'Morning' ? eveningEntries : morningEntries;

                return (
                    <>
                        {renderShiftBlock(selectedShift, firstShift,  true)}
                        {renderShiftBlock(otherShift,    secondShift, false)}
                    </>
                );
            })()}

            <AlertComponent />
        </div >
    );
}


export default Collection;

