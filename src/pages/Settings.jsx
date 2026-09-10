import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Settings as SettingsIcon, Globe, Save, Trash2, RotateCcw, TriangleAlert, X, IndianRupee, Cable, RefreshCw, Power, Terminal, Droplets, Printer, CalendarDays, ChevronRight } from 'lucide-react';
import Loader from '../components/Loader';
import { useAlert } from '../hooks/useAlert';


function Settings({ user }) {
    const { t, i18n } = useTranslation();
    const { showAlert, AlertComponent } = useAlert();
    const navigate = useNavigate();
    const [deletedFarmers, setDeletedFarmers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [farmerToDelete, setFarmerToDelete] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const [sellingRates, setSellingRates] = useState({ Cow: '', Buffalo: '' });
    const [isSavingRates, setIsSavingRates] = useState(false);
    const [defaultSnfCow, setDefaultSnfCow] = useState('');
    const [defaultSnfBuffalo, setDefaultSnfBuffalo] = useState('');
    // FAT & SNF Calibration caps
    const [minFatCow, setMinFatCow] = useState('');
    const [minFatBuffalo, setMinFatBuffalo] = useState('');
    const [maxFatCow, setMaxFatCow] = useState('');
    const [maxFatBuffalo, setMaxFatBuffalo] = useState('');
    const [minSnfCow, setMinSnfCow] = useState('');
    const [minSnfBuffalo, setMinSnfBuffalo] = useState('');
    const [maxSnfCow, setMaxSnfCow] = useState('');
    const [maxSnfBuffalo, setMaxSnfBuffalo] = useState('');
    const [activeTab, setActiveTab] = useState('general');

    // Subscription State
    const [subscriptionData, setSubscriptionData] = useState([]);
    const [isLoadingSubscription, setIsLoadingSubscription] = useState(false);

    useEffect(() => {
        if (activeTab === 'subscription' && user?.dairy_id) {
            loadSubscriptionData();
        }
        // Auto-load saved baud config when switching to machine tab
        if (activeTab === 'machine') {
            refreshSavedConfig();
        }
    }, [activeTab, user]);


    const loadSubscriptionData = async () => {
        setIsLoadingSubscription(true);
        try {
            const data = await window.api.getDairySubscriptions(user.dairy_id);
            setSubscriptionData(data || []);
        } catch (error) {
            console.error("Error loading subscription data:", error);
        } finally {
            setIsLoadingSubscription(false);
        }
    };

    // Print Settings State
    const [printSettings, setPrintSettings] = useState({
        entryReceipt: {
            showFat: true,
            showSnf: true,
            showRate: true,
            showAmount: true,
            showShift: true,
            showWater: false,
            paperSize: '58mm', // '58mm' | '76mm' | '80mm' | 'A4'
            qtyLabel: { en: '', mr: '', hi: '' },
            fatLabel: { en: '', mr: '', hi: '' },
            snfLabel: { en: '', mr: '', hi: '' }
        },
        billing: {
            showFat: true,
            showSnf: true,
            showDecimals: true,
            printMode: 'normal', // 'normal' or 'thermal'
            billNumberLanguage: 'same' // 'same' = follow app language, 'en' = always English digits
        }
    });

    // Fat Machine State — COM1 is fixed, only baud rate is user-selectable
    const FAT_FIXED_PORT = 'COM2';
    const [baudRate, setBaudRate] = useState(9600);
    const [isConnected, setIsConnected] = useState(false);
    const [terminalOutput, setTerminalOutput] = useState([]);
    const [machineStatus, setMachineStatus] = useState('Disconnected');

    // Weight Machine State — COM2 is fixed, only baud rate is user-selectable
    const WEIGHT_FIXED_PORT = 'COM3';
    const [weightBaudRate, setWeightBaudRate] = useState(9600);
    const [weightIsConnected, setWeightIsConnected] = useState(false);
    const [weightTerminalOutput, setWeightTerminalOutput] = useState([]);
    const [weightMachineStatus, setWeightMachineStatus] = useState('Disconnected');
    const [weightIsZeroing, setWeightIsZeroing] = useState(false);

    // Saved config info panel state
    const [savedDeviceConfig, setSavedDeviceConfig] = useState(null);
    const [startupLog, setStartupLog] = useState([]);

    const refreshSavedConfig = async () => {
        if (window.electron) {
            const result = await window.electron.invoke('load-device-settings');
            setSavedDeviceConfig(result?.settings || {});
        }
        try {
            const log = JSON.parse(localStorage.getItem('autoConnectLog') || '[]');
            setStartupLog(log);
        } catch (_) { setStartupLog([]); }
    };

    const handleSavePrintSettings = () => {
        localStorage.setItem('entryPrintSettings', JSON.stringify(printSettings.entryReceipt));
        localStorage.setItem('billingPrintSettings', JSON.stringify(printSettings.billing));
        showAlert(t('settings.saved', { defaultValue: 'Settings saved successfully!' }), 'Success', 'success');
    };

    const handleResetPrintSettings = () => {
        const defaultSettings = {
            entryReceipt: {
                showFat: true,
                showSnf: true,
                showRate: true,
                showAmount: true,
                showShift: true,
                showWater: false,
                paperSize: '58mm',
                qtyLabel: { en: '', mr: '', hi: '' },
                fatLabel: { en: '', mr: '', hi: '' },
                snfLabel: { en: '', mr: '', hi: '' }
            },
            billing: {
                showFat: true,
                showSnf: true,
                showDecimals: true,
                printMode: 'normal',
                billNumberLanguage: 'same'
            }
        };
        setPrintSettings(defaultSettings);
        localStorage.setItem('entryPrintSettings', JSON.stringify(defaultSettings.entryReceipt));
        localStorage.setItem('billingPrintSettings', JSON.stringify(defaultSettings.billing));
        showAlert(t('settings.saved', { defaultValue: 'Settings reset successfully!' }), 'Success', 'success');
    };

    const changeLanguage = (lng) => {
        i18n.changeLanguage(lng);
        localStorage.setItem('app_language', lng); // Explicit save — LanguageDetector alone is unreliable in packaged Electron
    };

    const loadDeletedFarmers = async () => {
        setIsLoading(true);
        try {
            const data = await window.api.getDeletedFarmers(user?.dairy_id);
            setDeletedFarmers(data || []);
        } catch (error) {
            // Graceful offline degradation — show empty list, not error
            console.warn('[Settings] loadDeletedFarmers failed (possibly offline):', error.message);
            setDeletedFarmers([]);
        } finally {
            setIsLoading(false);
        }
    };

    const loadSellingRates = async () => {
        try {
            const data = await window.api.getSellingRates(user?.dairy_id);
            const ratesMap = { Cow: '', Buffalo: '' };
            if (data) {
                data.forEach(r => {
                    ratesMap[r.milk_type] = r.rate;
                });
            }
            setSellingRates(ratesMap);

            const savedCow = localStorage.getItem('defaultSnfCow');
            const savedBuffalo = localStorage.getItem('defaultSnfBuffalo');
            if (savedCow) setDefaultSnfCow(savedCow);
            if (savedBuffalo) setDefaultSnfBuffalo(savedBuffalo);

            // Load FAT & SNF calibration caps
            const capKeys = ['minFatCow','minFatBuffalo','maxFatCow','maxFatBuffalo','minSnfCow','minSnfBuffalo','maxSnfCow','maxSnfBuffalo'];
            const capSetters = [setMinFatCow,setMinFatBuffalo,setMaxFatCow,setMaxFatBuffalo,setMinSnfCow,setMinSnfBuffalo,setMaxSnfCow,setMaxSnfBuffalo];
            capKeys.forEach((k, i) => { const v = localStorage.getItem(k); if (v !== null) capSetters[i](v); });

            // Load Print Settings
            const savedEntryPrintProps = localStorage.getItem('entryPrintSettings');
            const savedBillingPrintProps = localStorage.getItem('billingPrintSettings');

            setPrintSettings(prev => ({
                entryReceipt: savedEntryPrintProps ? { ...prev.entryReceipt, ...JSON.parse(savedEntryPrintProps) } : prev.entryReceipt,
                billing: savedBillingPrintProps ? { ...prev.billing, ...JSON.parse(savedBillingPrintProps) } : prev.billing,
            }));

        } catch (error) {
            // Graceful offline degradation
            // localStorage settings (machine, print, calibration) still load fine below
            console.warn('[Settings] loadSellingRates failed (possibly offline):', error.message);

            // Still load local-only settings even if Supabase call failed
            const savedCow = localStorage.getItem('defaultSnfCow');
            const savedBuffalo = localStorage.getItem('defaultSnfBuffalo');
            if (savedCow) setDefaultSnfCow(savedCow);
            if (savedBuffalo) setDefaultSnfBuffalo(savedBuffalo);

            const capKeys = ['minFatCow','minFatBuffalo','maxFatCow','maxFatBuffalo','minSnfCow','minSnfBuffalo','maxSnfCow','maxSnfBuffalo'];
            const capSetters = [setMinFatCow,setMinFatBuffalo,setMaxFatCow,setMaxFatBuffalo,setMinSnfCow,setMinSnfBuffalo,setMaxSnfCow,setMaxSnfBuffalo];
            capKeys.forEach((k, i) => { const v = localStorage.getItem(k); if (v !== null) capSetters[i](v); });

            const savedEntryPrintProps = localStorage.getItem('entryPrintSettings');
            const savedBillingPrintProps = localStorage.getItem('billingPrintSettings');
            setPrintSettings(prev => ({
                entryReceipt: savedEntryPrintProps ? { ...prev.entryReceipt, ...JSON.parse(savedEntryPrintProps) } : prev.entryReceipt,
                billing: savedBillingPrintProps ? { ...prev.billing, ...JSON.parse(savedBillingPrintProps) } : prev.billing,
            }));
        }
    };

    useEffect(() => {
        if (user?.dairy_id) {
            loadDeletedFarmers();
            loadSellingRates();
        }
    }, [user?.dairy_id]);

    // Fat Machine Initialization — port is fixed to COM1, load saved baud rate
    useEffect(() => {
        if (window.electron) {
            const initFat = async () => {
                // Load saved baud rate from persistent file, fallback to localStorage
                const result = await window.electron.invoke('load-device-settings');
                const fileSettings = result?.settings || {};
                const savedFatBaud = fileSettings.fat_machine_baud || localStorage.getItem('fat_machine_baud');
                if (savedFatBaud) setBaudRate(parseInt(savedFatBaud));

                // Query current connection state — if already connected (e.g. auto-connect on login), show that.
                // If NOT connected, auto-trigger a reconnect so user doesn't need to click Connect manually.
                const status = await window.electron.invoke('fat-machine-command', { action: 'get_status' });
                if (status?.connected) {
                    setIsConnected(true);
                    setMachineStatus('Connected');
                } else {
                    // Auto-reconnect: trigger connect immediately so machine reconnects on page open
                    setMachineStatus('Auto-connecting...');
                    window.electron.invoke('fat-machine-command', {
                        action: 'connect',
                        port: FAT_FIXED_PORT,
                        baud: savedFatBaud ? parseInt(savedFatBaud) : 2400
                    });
                }
            };
            initFat();

            const removeConnectionListener = window.electron.receive('fat-machine-connection', (data) => {
                setIsConnected(data.connected);
                setMachineStatus(data.message);
                showAlert(data.message, data.connected ? 'Connected' : 'Disconnected', data.connected ? 'success' : 'info');
            });

            const removeStatusListener = window.electron.receive('fat-machine-status', (msg) => {
                if (msg && msg.connected !== undefined) {
                    setIsConnected(msg.connected);
                }
            });

            const removeDataListener = window.electron.receive('fat-machine-data', (data) => {
                setIsConnected(true);
                setMachineStatus('Connected');
                const line = JSON.stringify(data);
                setTerminalOutput(prev => [...prev.slice(-19), line]);
            });

            return () => {
                if (removeConnectionListener) removeConnectionListener();
                if (removeDataListener) removeDataListener();
                if (removeStatusListener) removeStatusListener();
            };
        }
    }, []);

    // Weight Machine Initialization — port is fixed to COM2, load saved baud rate
    useEffect(() => {
        if (window.electron) {
            const initWeight = async () => {
                // Load saved baud rate from persistent file, fallback to localStorage
                const result = await window.electron.invoke('load-device-settings');
                const fileSettings = result?.settings || {};
                const savedWeightBaud = fileSettings.weight_machine_baud || localStorage.getItem('weight_machine_baud');
                if (savedWeightBaud) setWeightBaudRate(parseInt(savedWeightBaud));

                // Query current connection state — if already connected show that.
                // If NOT connected, auto-trigger a reconnect so user doesn't need to click Connect manually.
                const status = await window.electron.invoke('weight-machine-command', { action: 'get_status' });
                if (status?.connected) {
                    setWeightIsConnected(true);
                    setWeightMachineStatus('Connected');
                } else {
                    // Auto-reconnect: trigger connect immediately so machine reconnects on page open
                    setWeightMachineStatus('Auto-connecting...');
                    window.electron.invoke('weight-machine-command', {
                        action: 'connect',
                        port: WEIGHT_FIXED_PORT,
                        baud: savedWeightBaud ? parseInt(savedWeightBaud) : 9600
                    });
                }
            };
            initWeight();

            const removeConnectionListener = window.electron.receive('weight-machine-connection', (data) => {
                setWeightIsConnected(data.connected);
                setWeightMachineStatus(data.message);
            });

            const removeDataListener = window.electron.receive('weight-machine-data', (data) => {
                setWeightIsConnected(true);
                setWeightMachineStatus('Connected');
                const line = data.quantity ? `Weight: ${data.quantity} L` : JSON.stringify(data);
                setWeightTerminalOutput(prev => [...prev.slice(-19), line]);
            });

            const removeStatusListener = window.electron.receive('weight-machine-status', (msg) => {
                if (msg && msg.connected !== undefined) {
                    setWeightIsConnected(msg.connected);
                }
            });

            const removeZeroListener = window.electron.receive('weight-machine-zero-result', (data) => {
                setWeightIsZeroing(false);
                if (data.success) {
                    showAlert('✅ Auto Zero sent! Machine will reset to +00000.000 Lt', 'Auto Zero', 'success');
                    setWeightTerminalOutput(prev => [...prev.slice(-19), `[ZERO] ${data.message}`]);
                } else {
                    showAlert(`❌ Zero failed: ${data.message}`, 'Auto Zero Failed', 'error');
                }
            });

            return () => {
                if (removeConnectionListener) removeConnectionListener();
                if (removeDataListener) removeDataListener();
                if (removeStatusListener) removeStatusListener();
                if (removeZeroListener) removeZeroListener();
            };
        }
    }, []);

    // toggleConnection — port is always COM1 (fixed); only baud rate is variable.
    // Baud rate is saved to BOTH localStorage AND the persistent device-settings file
    // immediately when changed (via onChange), so it always persists across restarts and builds.
    const toggleConnection = async () => {
        if (window.electron) {
            if (isConnected) {
                // Just disconnect — baud rate stays saved for next time
                await window.electron.invoke('fat-machine-command', { action: 'disconnect' });
            } else {
                await window.electron.invoke('fat-machine-command', {
                    action: 'connect',
                    port: FAT_FIXED_PORT,   // always COM1
                    baud: parseInt(baudRate)
                });
            }
        }
    };

    // Save fat machine baud rate immediately whenever the user changes it
    const handleFatBaudChange = async (e) => {
        const newBaud = e.target.value;
        setBaudRate(newBaud);
        localStorage.setItem('fat_machine_baud', newBaud);
        if (window.electron) {
            const current = await window.electron.invoke('load-device-settings');
            const s = current?.settings || {};
            s.fat_machine_baud = newBaud;
            await window.electron.invoke('save-device-settings', s);
        }
    };

    // toggleWeightConnection — port is always COM2 (fixed); only baud rate is variable.
    const toggleWeightConnection = async () => {
        if (window.electron) {
            if (weightIsConnected) {
                // Just disconnect — baud rate stays saved for next time
                await window.electron.invoke('weight-machine-command', { action: 'disconnect' });
            } else {
                await window.electron.invoke('weight-machine-command', {
                    action: 'connect',
                    port: WEIGHT_FIXED_PORT,  // always COM2
                    baud: parseInt(weightBaudRate)
                });
            }
        }
    };

    // handleAutoZero — sends zero/tare command to the weight machine in all known formats.
    // The Python bridge broadcasts T\r\n, Z\r\n, @\r\n, ENQ, and formatted zero strings
    // so it works across all weight machine brands (Essae, CAS, A&D, Ohaus, Soham etc.)
    const handleAutoZero = async () => {
        if (!weightIsConnected || !window.electron) return;
        setWeightIsZeroing(true);
        try {
            await window.electron.invoke('weight-machine-command', { action: 'send_zero' });
            // Result comes back via weight-machine-zero-result IPC event (handled in useEffect listener)
        } catch (e) {
            setWeightIsZeroing(false);
            showAlert(`Zero command error: ${e.message}`, 'Error', 'error');
        }
    };

    // Save weight machine baud rate immediately whenever the user changes it
    const handleWeightBaudChange = async (e) => {
        const newBaud = parseInt(e.target.value);
        setWeightBaudRate(newBaud);
        localStorage.setItem('weight_machine_baud', newBaud.toString());
        if (window.electron) {
            const current = await window.electron.invoke('load-device-settings');
            const s = current?.settings || {};
            s.weight_machine_baud = newBaud.toString();
            await window.electron.invoke('save-device-settings', s);
        }
    };

    const handleSaveSellingRates = async () => {
        if (!user?.dairy_id) return;
        setIsSavingRates(true);
        try {
            const updates = [];
            if (sellingRates.Cow !== '') {
                updates.push({ dairy_id: user.dairy_id, milk_type: 'Cow', rate: parseFloat(sellingRates.Cow) });
            }
            if (sellingRates.Buffalo !== '') {
                updates.push({ dairy_id: user.dairy_id, milk_type: 'Buffalo', rate: parseFloat(sellingRates.Buffalo) });
            }

            if (updates.length > 0) {
                await window.api.saveSellingRates(updates);
            }
            showAlert(t('settings.saved'), 'Success', 'success');
        } catch (error) {
            console.error("Error saving selling rates:", error);
            showAlert(t('settings.rates.error') + " " + error.message, 'Error', 'error');
        } finally {
            setIsSavingRates(false);
        }
    };

    const handleRestore = async (farmer) => {
        setIsProcessing(true);
        try {
            await window.api.restoreFarmer(farmer.id, user?.dairy_id);
            loadDeletedFarmers();
        } catch (error) {
            console.error("Error restoring farmer:", error);
            showAlert(t('settings.recycleBin.alerts.restoreError'), 'Error', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handlePermanentDeleteClick = (farmer) => {
        setFarmerToDelete(farmer);
        setShowConfirmModal(true);
    };

    const handlePermanentDelete = async () => {
        if (!farmerToDelete) return;
        setIsProcessing(true);
        try {
            await window.api.permanentDeleteFarmer(farmerToDelete.id, user?.dairy_id);

            setShowConfirmModal(false);
            setFarmerToDelete(null);
            loadDeletedFarmers();
        } catch (error) {
            console.error("Error permanently deleting farmer:", error);
            showAlert(t('settings.recycleBin.alerts.deleteError'), 'Error', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '—';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div style={{
            padding: '8px 24px',
            maxWidth: '1400px',
            margin: '0 auto',
            background: 'transparent',
            minHeight: '100%'
        }}>
            {/* Header */}
            <div style={{ marginBottom: '24px' }}>
                <h1 style={{ fontSize: '28px', fontWeight: '700', margin: '0 0 8px 0', color: '#111827', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <SettingsIcon size={28} />
                    {t('settings.title')}
                </h1>
                <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                    {t('settings.subtitle')}
                </p>
            </div>

            <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start' }}>
                {/* Sidebar Navigation */}
                <div style={{ width: '250px', flexShrink: 0, position: 'sticky', top: '24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {[
                            { id: 'general', label: t('settings.tabs.general', 'General'), icon: <SettingsIcon size={18} /> },
                            { id: 'subscription', label: t('settings.tabs.subscription', 'Subscription'), icon: <CalendarDays size={18} /> },
                            { id: 'collection', label: t('settings.tabs.collection', 'Collection Defaults'), icon: <Droplets size={18} /> },
                            { id: 'print', label: t('settings.tabs.print', 'Print Configs'), icon: <Printer size={18} /> },
                            { id: 'machine', label: t('settings.tabs.machine', 'Machine Integrations'), icon: <Cable size={18} /> },
                            { id: 'recycle', label: t('settings.tabs.recycle', 'Recycle Bin'), icon: <Trash2 size={18} /> }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
                                    borderRadius: '12px', border: 'none', background: activeTab === tab.id ? '#e0e7ff' : 'transparent',
                                    color: activeTab === tab.id ? '#4338ca' : '#4b5563', fontWeight: activeTab === tab.id ? '600' : '500',
                                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', width: '100%'
                                }}
                            >
                                {tab.icon}
                                <span style={{ flex: 1 }}>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Settings Content */}
                <div style={{ flex: 1, minWidth: 0 }}>

                    {/* ===== SUBSCRIPTION TAB ===== */}
                    {activeTab === 'subscription' && (
                        <div style={{
                            background: 'white',
                            borderRadius: '20px',
                            overflow: 'hidden',
                            border: '1px solid #e5e7eb',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        }}>
                            <div style={{
                                padding: '20px 24px',
                                borderBottom: '1px solid #e5e7eb',
                                background: '#fafafa',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px'
                            }}>
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '10px',
                                    background: '#f3e8ff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#9333ea'
                                }}>
                                    <CalendarDays size={20} />
                                </div>
                                <div>
                                    <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', margin: 0 }}>
                                        {t('settings.subscription.title', 'Subscription Details')}
                                    </h2>
                                    <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                                        {t('settings.subscription.subtitle', 'Manage and view your current dairy subscription')}
                                    </p>
                                </div>
                            </div>
                            
                            <div style={{ padding: '24px' }}>
                                {isLoadingSubscription ? (
                                    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                                        <Loader />
                                    </div>
                                ) : subscriptionData.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        {subscriptionData.map(sub => {
                                            const isExpired = new Date(sub.end_date) < new Date();
                                            return (
                                                <div key={sub.id} style={{
                                                    padding: '24px',
                                                    borderRadius: '12px',
                                                    border: `1px solid ${isExpired ? '#fca5a5' : '#86efac'}`,
                                                    background: isExpired ? '#fef2f2' : '#f0fdf4',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '12px'
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#111827' }}>
                                                            {sub.plan_name || 'Standard Plan'}
                                                        </h3>
                                                        <span style={{
                                                            padding: '4px 12px',
                                                            borderRadius: '99px',
                                                            fontSize: '12px',
                                                            fontWeight: 'bold',
                                                            background: isExpired ? '#fee2e2' : '#dcfce7',
                                                            color: isExpired ? '#dc2626' : '#16a34a'
                                                        }}>
                                                            {isExpired ? 'Expired' : sub.status.toUpperCase()}
                                                        </span>
                                                    </div>
                                                    
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '8px' }}>
                                                        <div>
                                                            <p style={{ margin: 0, fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>START DATE</p>
                                                            <p style={{ margin: '4px 0 0 0', fontSize: '16px', color: '#374151' }}>
                                                                {new Date(sub.start_date).toLocaleDateString()}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p style={{ margin: 0, fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>END DATE</p>
                                                            <p style={{ margin: '4px 0 0 0', fontSize: '16px', color: '#374151' }}>
                                                                {new Date(sub.end_date).toLocaleDateString()}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '40px', background: '#f9fafb', borderRadius: '12px' }}>
                                        <p style={{ color: '#6b7280', margin: 0 }}>No subscription records found for this dairy.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ===== GENERAL TAB ===== */}
                    {activeTab === 'general' && (
                        <>
                            {/* Language Settings Section */}
                            <div style={{
                                background: 'white',
                                borderRadius: '20px',
                                overflow: 'hidden',
                                border: '1px solid #e5e7eb',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                marginBottom: '24px'
                            }}>
                                <div style={{
                                    padding: '20px 24px',
                                    borderBottom: '1px solid #e5e7eb',
                                    background: '#fafafa',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px'
                                }}>
                                    <div style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '10px',
                                        background: '#dbeafe',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#1d4ed8'
                                    }}>
                                        <Globe size={22} />
                                    </div>
                                    <div>
                                        <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: '#111827' }}>
                                            {t('settings.language')}
                                        </h2>
                                        <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                                            {t('settings.selectLanguage')}
                                        </p>
                                    </div>
                                </div>
                                <div style={{ padding: '24px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
                                        <button
                                            onClick={() => changeLanguage('en')}
                                            style={{
                                                padding: '16px',
                                                borderRadius: '12px',
                                                border: i18n.language === 'en' ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                                                background: i18n.language === 'en' ? '#eff6ff' : 'white',
                                                cursor: 'pointer',
                                                textAlign: 'center',
                                                fontWeight: i18n.language === 'en' ? '600' : '500',
                                                color: i18n.language === 'en' ? '#1e40af' : '#4b5563',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            English
                                        </button>
                                        <button
                                            onClick={() => changeLanguage('hi')}
                                            style={{
                                                padding: '16px',
                                                borderRadius: '12px',
                                                border: i18n.language === 'hi' ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                                                background: i18n.language === 'hi' ? '#eff6ff' : 'white',
                                                cursor: 'pointer',
                                                textAlign: 'center',
                                                fontWeight: i18n.language === 'hi' ? '600' : '500',
                                                color: i18n.language === 'hi' ? '#1e40af' : '#4b5563',
                                                fontSize: '18px',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            हिंदी
                                        </button>
                                        <button
                                            onClick={() => changeLanguage('mr')}
                                            style={{
                                                padding: '16px',
                                                borderRadius: '12px',
                                                border: i18n.language === 'mr' ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                                                background: i18n.language === 'mr' ? '#eff6ff' : 'white',
                                                cursor: 'pointer',
                                                textAlign: 'center',
                                                fontWeight: i18n.language === 'mr' ? '600' : '500',
                                                color: i18n.language === 'mr' ? '#1e40af' : '#4b5563',
                                                fontSize: '18px',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            मराठी
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* App Version Info Section */}
                            <div style={{
                                background: 'white',
                                borderRadius: '20px',
                                overflow: 'hidden',
                                border: '1px solid #e5e7eb',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                marginBottom: '24px',
                                padding: '16px 24px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <span style={{ fontSize: '14px', color: '#4b5563', fontWeight: '500' }}>
                                    App Version
                                </span>
                                <span style={{ fontSize: '14px', color: '#111827', fontWeight: '700', background: '#f3f4f6', padding: '4px 10px', borderRadius: '6px' }}>
                                    v6.0.4
                                </span>
                            </div>

                        </>
                    )}

                    {/* ===== COLLECTION TAB ===== */}
                    {activeTab === 'collection' && (
                        <>
                            {/* Collection Defaults Section */}
                            <div style={{
                                background: 'white',
                                borderRadius: '20px',
                                overflow: 'hidden',
                                border: '1px solid #e5e7eb',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                marginBottom: '24px'
                            }}>
                                <div style={{
                                    padding: '20px 24px',
                                    borderBottom: '1px solid #e5e7eb',
                                    background: '#fafafa',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px'
                                }}>
                                    <div style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '10px',
                                        background: '#e0e7ff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#4338ca'
                                    }}>
                                        <SettingsIcon size={22} />
                                    </div>
                                    <div>
                                        <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: '#111827' }}>
                                            {t('settings.collectionDefaults', { defaultValue: 'Collection Defaults' })}
                                        </h2>
                                        <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                                            {t('settings.collectionDefaultsSubtitle', { defaultValue: 'Set default values for milk collection' })}
                                        </p>
                                    </div>
                                </div>

                                <div style={{ padding: '24px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                                                {t('settings.defaultSnfCow', { defaultValue: 'Default SNF (Cow)' })}
                                            </label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={defaultSnfCow}
                                                onChange={(e) => setDefaultSnfCow(e.target.value)}
                                                placeholder="e.g., 8.5"
                                                style={{
                                                    width: '100%',
                                                    padding: '12px 16px',
                                                    borderRadius: '12px',
                                                    border: '2px solid #e5e7eb',
                                                    fontSize: '16px',
                                                    fontWeight: '600',
                                                    outline: 'none',
                                                    transition: 'border-color 0.2s'
                                                }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                                                {t('settings.defaultSnfBuffalo', { defaultValue: 'Default SNF (Buffalo)' })}
                                            </label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={defaultSnfBuffalo}
                                                onChange={(e) => setDefaultSnfBuffalo(e.target.value)}
                                                placeholder="e.g., 9.0"
                                                style={{
                                                    width: '100%',
                                                    padding: '12px 16px',
                                                    borderRadius: '12px',
                                                    border: '2px solid #e5e7eb',
                                                    fontSize: '16px',
                                                    fontWeight: '600',
                                                    outline: 'none',
                                                    transition: 'border-color 0.2s'
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            localStorage.setItem('defaultSnfCow', defaultSnfCow);
                                            localStorage.setItem('defaultSnfBuffalo', defaultSnfBuffalo);
                                            showAlert(t('settings.saved', { defaultValue: 'Saved successfully' }), 'Success', 'success');
                                        }}
                                        style={{
                                            padding: '12px 24px',
                                            background: '#4338ca',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '12px',
                                            fontSize: '15px',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <Save size={18} />
                                        {t('settings.rates.save', { defaultValue: 'Save' })}
                                    </button>
                                </div>
                            </div>

                            {/* FAT & SNF Calibration Card */}
                            <div style={{
                                background: 'white',
                                borderRadius: '20px',
                                overflow: 'hidden',
                                border: '2px solid #fde68a',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                marginBottom: '24px'
                            }}>
                                <div style={{
                                    padding: '20px 24px',
                                    borderBottom: '1px solid #fde68a',
                                    background: '#fffbeb',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px'
                                }}>
                                    <div style={{
                                        width: '40px', height: '40px', borderRadius: '10px',
                                        background: '#fef3c7', display: 'flex', alignItems: 'center',
                                        justifyContent: 'center', fontSize: '22px'
                                    }}>⚖️</div>
                                    <div>
                                        <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: '#92400e' }}>
                                            {t('settings.calibration.title')}
                                        </h2>
                                        <p style={{ fontSize: '13px', color: '#b45309', margin: 0 }}>
                                            {t('settings.calibration.subtitle')}
                                        </p>
                                    </div>
                                </div>
                                <div style={{ padding: '24px' }}>
                                    {[{ label: 'FAT', minCow: minFatCow, setMinCow: setMinFatCow, maxCow: maxFatCow, setMaxCow: setMaxFatCow, minBuf: minFatBuffalo, setMinBuf: setMinFatBuffalo, maxBuf: maxFatBuffalo, setMaxBuf: setMaxFatBuffalo },
                                      { label: 'SNF', minCow: minSnfCow, setMinCow: setMinSnfCow, maxCow: maxSnfCow, setMaxCow: setMaxSnfCow, minBuf: minSnfBuffalo, setMinBuf: setMinSnfBuffalo, maxBuf: maxSnfBuffalo, setMaxBuf: setMaxSnfBuffalo }
                                    ].map(({ label, minCow, setMinCow, maxCow, setMaxCow, minBuf, setMinBuf, maxBuf, setMaxBuf }) => (
                                        <div key={label} style={{ marginBottom: '20px' }}>
                                            <p style={{ fontWeight: '700', color: '#92400e', marginBottom: '12px', fontSize: '14px' }}>
                                                {label === 'FAT' ? t('settings.calibration.fatLimits') : t('settings.calibration.snfLimits')}
                                            </p>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                                                {[{ lbl: `Min ${label} (Cow)`, val: minCow, set: setMinCow, ph: label === 'FAT' ? '3.5' : '7.0' },
                                                  { lbl: `Max ${label} (Cow)`, val: maxCow, set: setMaxCow, ph: label === 'FAT' ? '8.0' : '9.0' },
                                                  { lbl: `Min ${label} (Buf)`, val: minBuf, set: setMinBuf, ph: label === 'FAT' ? '4.0' : '8.0' },
                                                  { lbl: `Max ${label} (Buf)`, val: maxBuf, set: setMaxBuf, ph: label === 'FAT' ? '10.0' : '9.5' },
                                                ].map(({ lbl, val, set, ph }) => (
                                                    <div key={lbl}>
                                                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>{lbl}</label>
                                                        <input
                                                            type="number" step="0.1"
                                                            value={val}
                                                            onChange={(e) => set(e.target.value)}
                                                            placeholder={ph}
                                                            style={{
                                                                width: '100%', padding: '10px 14px',
                                                                borderRadius: '10px', border: '2px solid #fde68a',
                                                                fontSize: '15px', fontWeight: '600',
                                                                outline: 'none', background: '#fffbeb'
                                                            }}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => {
                                            ['minFatCow','minFatBuffalo','maxFatCow','maxFatBuffalo','minSnfCow','minSnfBuffalo','maxSnfCow','maxSnfBuffalo']
                                                .forEach((k, i) => localStorage.setItem(k, [minFatCow,minFatBuffalo,maxFatCow,maxFatBuffalo,minSnfCow,minSnfBuffalo,maxSnfCow,maxSnfBuffalo][i]));
                                            showAlert(t('settings.calibration.saved'), 'Success', 'success');
                                        }}
                                        style={{
                                            padding: '12px 24px', background: '#d97706',
                                            color: 'white', border: 'none', borderRadius: '12px',
                                            fontSize: '15px', fontWeight: '600', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '8px'
                                        }}
                                    >
                                        <Save size={18} />
                                        {t('settings.calibration.saveBtn')}
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ===== GENERAL TAB (cont) ===== */}
                    {activeTab === 'general' && (
                        <>
                            {/* Local Sale Rates Section */}
                            {(user?.role === 'admin' || user?.role === 'super_admin') && (
                                <div style={{
                                    background: 'white',
                                    borderRadius: '20px',
                                    overflow: 'hidden',
                                    border: '1px solid #e5e7eb',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                    marginBottom: '24px'
                                }}>
                                    {/* Section Header */}
                                    <div style={{
                                        padding: '20px 24px',
                                        borderBottom: '1px solid #e5e7eb',
                                        background: '#fafafa',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px'
                                    }}>
                                        <div style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '10px',
                                            background: '#d1fae5',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#059669'
                                        }}>
                                            <IndianRupee size={22} />
                                        </div>
                                        <div>
                                            <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: '#111827' }}>
                                                {t('settings.rates.title')}
                                            </h2>
                                            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                                                {t('settings.rates.subtitle')}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div style={{ padding: '24px' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                                            {/* Cow Rate */}
                                            <div>
                                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                                                    {t('settings.rates.cow')}
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.5"
                                                    value={sellingRates.Cow}
                                                    onChange={(e) => setSellingRates(prev => ({ ...prev, Cow: e.target.value }))}
                                                    placeholder="e.g., 60"
                                                    style={{
                                                        width: '100%',
                                                        padding: '12px 16px',
                                                        borderRadius: '12px',
                                                        border: '2px solid #e5e7eb',
                                                        fontSize: '16px',
                                                        fontWeight: '600',
                                                        outline: 'none',
                                                        transition: 'border-color 0.2s'
                                                    }}
                                                />
                                            </div>

                                            {/* Buffalo Rate */}
                                            <div>
                                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                                                    {t('settings.rates.buffalo')}
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.5"
                                                    value={sellingRates.Buffalo}
                                                    onChange={(e) => setSellingRates(prev => ({ ...prev, Buffalo: e.target.value }))}
                                                    placeholder="e.g., 70"
                                                    style={{
                                                        width: '100%',
                                                        padding: '12px 16px',
                                                        borderRadius: '12px',
                                                        border: '2px solid #e5e7eb',
                                                        fontSize: '16px',
                                                        fontWeight: '600',
                                                        outline: 'none',
                                                        transition: 'border-color 0.2s'
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleSaveSellingRates}
                                            disabled={isSavingRates}
                                            style={{
                                                padding: '12px 24px',
                                                background: '#059669',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '12px',
                                                fontSize: '15px',
                                                fontWeight: '600',
                                                cursor: isSavingRates ? 'not-allowed' : 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                opacity: isSavingRates ? 0.7 : 1,
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <Save size={18} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* ===== PRINT TAB ===== */}
                    {activeTab === 'print' && (
                        <>
                            {/* Print Settings Section */}
                            <div style={{
                                background: 'white',
                                borderRadius: '20px',
                                overflow: 'hidden',
                                border: '1px solid #e5e7eb',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                marginBottom: '24px'
                            }}>
                                <div style={{
                                    padding: '20px 24px',
                                    borderBottom: '1px solid #e5e7eb',
                                    background: '#fafafa',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '10px',
                                            background: '#fef3c7',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#d97706'
                                        }}>
                                            <SettingsIcon size={22} />
                                        </div>
                                        <div>
                                            <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: '#111827' }}>
                                                {t('settings.printSettings.title', 'Print Settings')}
                                            </h2>
                                            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                                                {t('settings.printSettings.subtitle', 'Customize entry receipt and billing prints')}
                                            </p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button
                                            onClick={handleResetPrintSettings}
                                            style={{
                                                padding: '8px 16px',
                                                background: '#fff',
                                                color: '#ef4444',
                                                border: '1px solid #fca5a5',
                                                borderRadius: '8px',
                                                fontSize: '14px',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <RotateCcw size={16} />
                                            {t('settings.printSettings.reset', 'Reset to Default')}
                                        </button>
                                        <button
                                            onClick={handleSavePrintSettings}
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
                                                gap: '6px',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <Save size={16} />
                                            {t('settings.rates.save', 'Save')}
                                        </button>
                                    </div>
                                </div>

                                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

                                    {/* ── PAPER SIZE SELECTOR ── */}
                                    <div>
                                        <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '4px', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' }}>
                                            🖨️ {t('settings.printSettings.paperSize.title', 'Thermal Paper Size')}
                                        </h3>
                                        <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 14px 0' }}>
                                            {t('settings.printSettings.paperSize.hint', 'Choose the roll width of your thermal printer. Applies to all receipts.')}
                                        </p>
                                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                            {[
                                                { value: '58mm',  label: '58 mm',  sub: '2-inch' },
                                                { value: '76mm',  label: '76 mm',  sub: '3-inch' },
                                                { value: '80mm',  label: '80 mm',  sub: '3.15-inch (popular)' },
                                                { value: 'A4',    label: 'A4',     sub: 'Plain paper' },
                                            ].map(opt => {
                                                const selected = (printSettings.entryReceipt.paperSize || '58mm') === opt.value;
                                                return (
                                                    <button
                                                        key={opt.value}
                                                        onClick={() => setPrintSettings(prev => ({
                                                            ...prev,
                                                            entryReceipt: { ...prev.entryReceipt, paperSize: opt.value }
                                                        }))}
                                                        style={{
                                                            padding: '12px 20px',
                                                            borderRadius: '12px',
                                                            border: selected ? '2px solid #4f46e5' : '2px solid #e5e7eb',
                                                            background: selected ? '#eef2ff' : 'white',
                                                            color: selected ? '#3730a3' : '#374151',
                                                            cursor: 'pointer',
                                                            fontWeight: selected ? '700' : '500',
                                                            fontSize: '14px',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            alignItems: 'center',
                                                            gap: '2px',
                                                            minWidth: '90px',
                                                            transition: 'all 0.15s',
                                                            boxShadow: selected ? '0 0 0 3px rgba(79,70,229,0.15)' : 'none',
                                                        }}
                                                    >
                                                        <span style={{ fontSize: '16px', fontWeight: '700' }}>{opt.label}</span>
                                                        <span style={{ fontSize: '11px', color: selected ? '#6366f1' : '#9ca3af', fontWeight: '400' }}>{opt.sub}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Entry Receipt Settings */}
                                    <div>
                                        <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' }}>
                                            {t('settings.printSettings.entryReceipt.title', 'Entry Receipt Customize')}
                                        </h3>

                                        {/* Toggles */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                                            {['showFat', 'showSnf', 'showRate', 'showAmount', 'showShift', 'showWater'].map(field => (
                                                <label key={field} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={printSettings.entryReceipt[field]}
                                                        onChange={(e) => setPrintSettings(prev => ({
                                                            ...prev,
                                                            entryReceipt: { ...prev.entryReceipt, [field]: e.target.checked }
                                                        }))}
                                                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                                    />
                                                    <span style={{ fontSize: '14px', color: '#4b5563', fontWeight: '500' }}>
                                                        {t(`settings.printSettings.entryReceipt.${field}`, `Show ${field.replace('show', '')}`)}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>

                                        {/* Custom Labels */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                                            {['qtyLabel', 'fatLabel', 'snfLabel'].map(labelKey => (
                                                <div key={labelKey}>
                                                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                                                        {t(`settings.printSettings.entryReceipt.${labelKey}`, `${labelKey.replace('Label', '')} Label Override`)}
                                                    </label>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        {['en', 'hi', 'mr'].map(lang => (
                                                            <input
                                                                key={lang}
                                                                type="text"
                                                                value={printSettings.entryReceipt[labelKey][lang]}
                                                                onChange={(e) => setPrintSettings(prev => ({
                                                                    ...prev,
                                                                    entryReceipt: {
                                                                        ...prev.entryReceipt,
                                                                        [labelKey]: {
                                                                            ...prev.entryReceipt[labelKey],
                                                                            [lang]: e.target.value
                                                                        }
                                                                    }
                                                                }))}
                                                                placeholder={lang.toUpperCase()}
                                                                title={`Custom ${lang.toUpperCase()} Label`}
                                                                style={{
                                                                    width: '100%',
                                                                    padding: '10px 12px',
                                                                    borderRadius: '8px',
                                                                    border: '1px solid #d1d5db',
                                                                    fontSize: '14px',
                                                                    outline: 'none',
                                                                    transition: 'border-color 0.2s',
                                                                }}
                                                            />
                                                        ))}
                                                    </div>
                                                    <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', margin: 0 }}>
                                                        Left to Right: English, Hindi, Marathi. Leave blank for default.
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Billing Settings */}
                                    <div>
                                        <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' }}>
                                            {t('settings.printSettings.billing.title', 'Billing Print Customize')}
                                        </h3>
                                        
                                        <div style={{ marginBottom: '20px' }}>
                                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                                                {t('settings.billFormat.title', 'Bill Format')}
                                            </label>
                                            {/* Current format display */}
                                            <div style={{
                                                background: '#f8fafc', border: '1px solid #e2e8f0',
                                                borderRadius: '12px', padding: '12px 16px',
                                                marginBottom: '12px', fontSize: '13px', color: '#64748b'
                                            }}>
                                                {(() => {
                                                    const fmt = (() => { try { return localStorage.getItem('billFormat') || 'format1'; } catch { return 'format1'; } })();
                                                    const names = { format1: t('settings.billFormat.format1Name', 'Thermal Receipt'), format2: t('settings.billFormat.format2Name', 'Standard A4 Format'), format3: t('settings.billFormat.format3Name', 'Marathi Grid Format') };
                                                    return <><span style={{ fontWeight: '600', color: '#374151' }}>{t('settings.billFormat.currentFormat', 'Current')}: </span><span style={{ color: '#4338ca', fontWeight: '700' }}>{names[fmt]}</span></>;
                                                })()}
                                            </div>
                                            <button
                                                onClick={() => navigate('/settings/bill-format')}
                                                style={{
                                                    width: '100%', padding: '14px 20px',
                                                    background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)',
                                                    color: 'white', border: 'none', borderRadius: '12px',
                                                    fontSize: '15px', fontWeight: '700', cursor: 'pointer',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                    boxShadow: '0 4px 15px rgba(99,102,241,0.3)', transition: 'all 0.2s'
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <Printer size={18} />
                                                    {t('settings.billFormat.chooseFormat', 'Choose Bill Format')}
                                                </div>
                                                <ChevronRight size={18} />
                                            </button>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                                            {['showFat', 'showSnf', 'showDecimals'].map(field => (
                                                <label key={`billing-${field}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={printSettings.billing[field]}
                                                        onChange={(e) => setPrintSettings(prev => ({
                                                            ...prev,
                                                            billing: { ...prev.billing, [field]: e.target.checked }
                                                        }))}
                                                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                                    />
                                                    <span style={{ fontSize: '14px', color: '#4b5563', fontWeight: '500' }}>
                                                        {t(`settings.printSettings.billing.${field}`, `Show ${field.replace('show', '')}`)}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>

                                        {/* Bill Number Language */}
                                        <div style={{ marginTop: '20px' }}>
                                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                                                {t('settings.printSettings.billing.billNumberLanguage', 'Bill Number Language')}
                                            </label>
                                            <select
                                                value={printSettings.billing.billNumberLanguage || 'same'}
                                                onChange={(e) => setPrintSettings(prev => ({
                                                    ...prev,
                                                    billing: { ...prev.billing, billNumberLanguage: e.target.value }
                                                }))}
                                                style={{
                                                    width: '100%',
                                                    maxWidth: '320px',
                                                    padding: '10px 14px',
                                                    borderRadius: '10px',
                                                    border: '1.5px solid #d1d5db',
                                                    fontSize: '14px',
                                                    fontWeight: '500',
                                                    color: '#374151',
                                                    background: 'white',
                                                    cursor: 'pointer',
                                                    outline: 'none',
                                                    transition: 'border-color 0.2s',
                                                }}
                                            >
                                                <option value="same">{t('settings.printSettings.billing.billNumberLangMarathi', 'Marathi (१२३)')}</option>
                                                <option value="en">{t('settings.printSettings.billing.billNumberLangEnglish', 'English (123)')}</option>
                                            </select>
                                            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
                                                {t('settings.printSettings.billing.billNumberLangHint', 'Choose which digits to use for numbers on printed bills.')}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </>
                    )}

                    {/* ===== MACHINE TAB ===== */}
                    {activeTab === 'machine' && (
                        <>
                            {/* Fat Machine Settings Section */}
                            {(user?.role === 'admin' || user?.role === 'super_admin') && (
                                <div style={{
                                    background: 'white',
                                    borderRadius: '20px',
                                    overflow: 'hidden',
                                    border: '1px solid #e5e7eb',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                    marginBottom: '24px'
                                }}>
                                    <div style={{
                                        padding: '20px 24px',
                                        borderBottom: '1px solid #e5e7eb',
                                        background: '#fafafa',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px'
                                    }}>
                                        <div style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '10px',
                                            background: '#eceff1',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#455a64'
                                        }}>
                                            <Cable size={22} />
                                        </div>
                                        <div>
                                            <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: '#111827' }}>
                                                Fat Machine Integration
                                            </h2>
                                            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                                                Configure Serial Port Connection
                                            </p>
                                        </div>
                                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{
                                                fontSize: '12px',
                                                fontWeight: 'bold',
                                                padding: '4px 8px',
                                                borderRadius: '6px',
                                                background: isConnected ? '#dcfce7' : '#fee2e2',
                                                color: isConnected ? '#166534' : '#991b1b'
                                            }}>
                                                {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
                                            </span>
                                        </div>
                                    </div>

                                    <div style={{ padding: '24px' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                                            {/* Fixed Port Display — COM1 */}
                                            <div>
                                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                                                    COM Port
                                                </label>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '10px',
                                                    padding: '12px 16px',
                                                    borderRadius: '12px',
                                                    border: '2px solid #d1fae5',
                                                    background: '#f0fdf4',
                                                    fontSize: '15px',
                                                    fontWeight: '700',
                                                    color: '#065f46'
                                                }}>
                                                    <span style={{ fontSize: '18px' }}>🔌</span>
                                                    COM2
                                                    <span style={{
                                                        marginLeft: 'auto',
                                                        fontSize: '11px',
                                                        fontWeight: '600',
                                                        color: '#059669',
                                                        background: '#d1fae5',
                                                        padding: '2px 8px',
                                                        borderRadius: '99px'
                                                    }}>FIXED</span>
                                                </div>
                                            </div>

                                            {/* Baud Rate — saved immediately on change */}
                                            <div>
                                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                                                    Baud Rate
                                                </label>
                                                <select
                                                    value={baudRate}
                                                    onChange={handleFatBaudChange}
                                                    style={{
                                                        width: '100%',
                                                        padding: '12px 16px',
                                                        borderRadius: '12px',
                                                        border: '2px solid #e5e7eb',
                                                        fontSize: '15px',
                                                        outline: 'none'
                                                    }}
                                                >
                                                    <option value="1200">1200</option>
                                                    <option value="2400">2400</option>
                                                    <option value="4800">4800</option>
                                                    <option value="9600">9600</option>
                                                    <option value="19200">19200</option>
                                                    <option value="115200">115200</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '24px' }}>
                                            <button
                                                onClick={toggleConnection}
                                                style={{
                                                    padding: '12px 24px',
                                                    background: isConnected ? '#ef4444' : '#059669',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '12px',
                                                    fontSize: '15px',
                                                    fontWeight: '600',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    opacity: 1,
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <Power size={18} />
                                                {isConnected ? 'Disconnect' : 'Connect'}
                                            </button>
                                            <span style={{ fontSize: '14px', color: '#6b7280' }}>
                                                Status: <b>{machineStatus}</b>
                                            </span>
                                        </div>

                                        {/* Terminal Output */}
                                        <div style={{
                                            background: '#1e1e1e',
                                            color: '#00ff00',
                                            fontFamily: 'monospace',
                                            fontSize: '12px',
                                            padding: '16px',
                                            borderRadius: '12px',
                                            height: '150px',
                                            overflowY: 'auto',
                                            display: 'flex',
                                            flexDirection: 'column-reverse'
                                        }}>
                                            {terminalOutput.length === 0 && <span style={{ color: '#666' }}> Waiting for data...</span>}
                                            {terminalOutput.map((line, i) => (
                                                <div key={i}>{line}</div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Weight Machine Settings Section */}
                            {(user?.role === 'admin' || user?.role === 'super_admin') && (
                                <div style={{
                                    background: 'white',
                                    borderRadius: '20px',
                                    overflow: 'hidden',
                                    border: '1px solid #e5e7eb',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                    marginBottom: '24px'
                                }}>
                                    <div style={{
                                        padding: '20px 24px',
                                        borderBottom: '1px solid #e5e7eb',
                                        background: '#fafafa',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px'
                                    }}>
                                        <div style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '10px',
                                            background: '#e0f2fe',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#0284c7'
                                        }}>
                                            <Cable size={22} />
                                        </div>
                                        <div>
                                            <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: '#111827' }}>
                                                Weight Machine Integration
                                            </h2>
                                            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                                                Configure Weight Machine Serial Port
                                            </p>
                                        </div>
                                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{
                                                fontSize: '12px',
                                                fontWeight: 'bold',
                                                padding: '4px 8px',
                                                borderRadius: '6px',
                                                background: weightIsConnected ? '#dcfce7' : '#fee2e2',
                                                color: weightIsConnected ? '#166534' : '#991b1b'
                                            }}>
                                                {weightIsConnected ? 'CONNECTED' : 'DISCONNECTED'}
                                            </span>
                                        </div>
                                    </div>

                                    <div style={{ padding: '24px' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                                            {/* Fixed Port Display — COM2 */}
                                            <div>
                                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                                                    COM Port
                                                </label>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '10px',
                                                    padding: '12px 16px',
                                                    borderRadius: '12px',
                                                    border: '2px solid #bfdbfe',
                                                    background: '#eff6ff',
                                                    fontSize: '15px',
                                                    fontWeight: '700',
                                                    color: '#1e3a5f'
                                                }}>
                                                    <span style={{ fontSize: '18px' }}>🔌</span>
                                                    COM3
                                                    <span style={{
                                                        marginLeft: 'auto',
                                                        fontSize: '11px',
                                                        fontWeight: '600',
                                                        color: '#1d4ed8',
                                                        background: '#bfdbfe',
                                                        padding: '2px 8px',
                                                        borderRadius: '99px'
                                                    }}>FIXED</span>
                                                </div>
                                            </div>

                                            {/* Baud Rate (Selectable) — saved immediately on change */}
                                            <div>
                                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                                                    Baud Rate
                                                </label>
                                                <select
                                                    value={weightBaudRate}
                                                    onChange={handleWeightBaudChange}
                                                    disabled={weightIsConnected}
                                                    style={{
                                                        width: '100%',
                                                        padding: '12px 16px',
                                                        borderRadius: '12px',
                                                        border: '2px solid #e5e7eb',
                                                        fontSize: '15px',
                                                        outline: 'none',
                                                        background: weightIsConnected ? '#f9fafb' : '#ffffff',
                                                        color: weightIsConnected ? '#6b7280' : '#111827',
                                                        cursor: weightIsConnected ? 'not-allowed' : 'pointer'
                                                    }}
                                                >
                                                    <option value={1200}>1200</option>
                                                    <option value={2400}>2400</option>
                                                    <option value={4800}>4800</option>
                                                    <option value={9600}>9600</option>
                                                    <option value={19200}>19200</option>
                                                    <option value={38400}>38400</option>
                                                    <option value={57600}>57600</option>
                                                    <option value={115200}>115200</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap' }}>
                                            <button
                                                onClick={toggleWeightConnection}
                                                style={{
                                                    padding: '12px 24px',
                                                    background: weightIsConnected ? '#ef4444' : '#0284c7',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '12px',
                                                    fontSize: '15px',
                                                    fontWeight: '600',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    opacity: 1,
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <Power size={18} />
                                                {weightIsConnected ? 'Disconnect' : 'Connect'}
                                            </button>

                                            {/* ─── AUTO ZERO BUTTON ─── */}
                                            <button
                                                id="weight-auto-zero-btn"
                                                onClick={handleAutoZero}
                                                disabled={!weightIsConnected || weightIsZeroing}
                                                title="Send zero/tare command to weight machine (all formats: T, Z, @, ENQ, +00000.000 Lt)"
                                                style={{
                                                    padding: '12px 24px',
                                                    background: !weightIsConnected
                                                        ? '#e5e7eb'
                                                        : weightIsZeroing
                                                            ? '#d97706'
                                                            : 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
                                                    color: !weightIsConnected ? '#9ca3af' : 'white',
                                                    border: 'none',
                                                    borderRadius: '12px',
                                                    fontSize: '15px',
                                                    fontWeight: '700',
                                                    cursor: !weightIsConnected || weightIsZeroing ? 'not-allowed' : 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    transition: 'all 0.2s',
                                                    boxShadow: weightIsConnected && !weightIsZeroing
                                                        ? '0 4px 14px rgba(124,58,237,0.35)'
                                                        : 'none',
                                                    letterSpacing: '0.02em'
                                                }}
                                            >
                                                {weightIsZeroing ? (
                                                    <>
                                                        <span style={{
                                                            display: 'inline-block',
                                                            width: '16px',
                                                            height: '16px',
                                                            border: '2px solid rgba(255,255,255,0.4)',
                                                            borderTopColor: 'white',
                                                            borderRadius: '50%',
                                                            animation: 'spin 0.7s linear infinite'
                                                        }} />
                                                        Zeroing...
                                                    </>
                                                ) : (
                                                    <>⬤ Auto Zero</>
                                                )}
                                            </button>

                                            <span style={{ fontSize: '14px', color: '#6b7280' }}>
                                                Status: <b>{weightMachineStatus}</b>
                                            </span>
                                        </div>

                                        {/* Auto Zero info label */}
                                        {weightIsConnected && (
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                padding: '10px 14px',
                                                background: '#f5f3ff',
                                                border: '1px solid #ddd6fe',
                                                borderRadius: '10px',
                                                marginBottom: '16px',
                                                fontSize: '12px',
                                                color: '#6d28d9'
                                            }}>
                                                <span style={{ fontSize: '16px' }}>⚡</span>
                                                <span>
                                                    <b>Auto Zero</b> sends tare/zero commands in all formats:&nbsp;
                                                    <code style={{ background: '#ede9fe', padding: '1px 5px', borderRadius: '4px' }}>T\r\n</code>&nbsp;
                                                    <code style={{ background: '#ede9fe', padding: '1px 5px', borderRadius: '4px' }}>Z\r\n</code>&nbsp;
                                                    <code style={{ background: '#ede9fe', padding: '1px 5px', borderRadius: '4px' }}>@\r\n</code>&nbsp;
                                                    <code style={{ background: '#ede9fe', padding: '1px 5px', borderRadius: '4px' }}>+00000.000 Lt</code>
                                                    &nbsp;→ machine resets to zero.
                                                </span>
                                            </div>
                                        )}


                                        {/* Terminal Output */}
                                        <div style={{
                                            background: '#1e1e1e',
                                            color: '#38bdf8',
                                            fontFamily: 'monospace',
                                            fontSize: '12px',
                                            padding: '16px',
                                            borderRadius: '12px',
                                            height: '150px',
                                            overflowY: 'auto',
                                            display: 'flex',
                                            flexDirection: 'column-reverse'
                                        }}>
                                            {weightTerminalOutput.length === 0 && <span style={{ color: '#666' }}> Waiting for weight data...</span>}
                                            {weightTerminalOutput.map((line, i) => (
                                                <div key={i}>{line}</div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        {/* ===== BAUD RATE SAVED CONFIG PANEL ===== */}
                        <div style={{
                            background: 'white',
                            borderRadius: '20px',
                            border: '1px solid #e5e7eb',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                            marginTop: '24px',
                            overflow: 'hidden'
                        }}>
                            {/* Header */}
                            <div style={{
                                padding: '18px 24px',
                                borderBottom: '1px solid #e5e7eb',
                                background: '#fafafa',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Terminal size={20} color="#6366f1" />
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#111827' }}>Saved Baud Rate Settings</h3>
                                        <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>View, update or delete the baud rate saved for each machine</p>
                                    </div>
                                </div>
                                <button
                                    onClick={refreshSavedConfig}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        padding: '7px 14px', background: '#f3f4f6',
                                        border: '1px solid #e5e7eb', borderRadius: '8px',
                                        fontSize: '13px', fontWeight: '500', cursor: 'pointer', color: '#374151'
                                    }}
                                >
                                    <RefreshCw size={14} /> Refresh
                                </button>
                            </div>

                            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                                {/* Fat Machine Baud Row */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '16px',
                                    padding: '16px 20px',
                                    borderRadius: '14px',
                                    border: '1.5px solid #d1fae5',
                                    background: '#f0fdf4'
                                }}>
                                    <span style={{ fontSize: '22px' }}>🔌</span>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#065f46' }}>Fat Machine — COM2</p>
                                        <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#6b7280' }}>Saved baud rate used on every auto-connect</p>
                                    </div>
                                    {/* Current saved value */}
                                    <div style={{
                                        padding: '6px 14px',
                                        background: savedDeviceConfig?.fat_machine_baud ? '#d1fae5' : '#fee2e2',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        fontWeight: '700',
                                        color: savedDeviceConfig?.fat_machine_baud ? '#065f46' : '#991b1b',
                                        minWidth: '80px',
                                        textAlign: 'center'
                                    }}>
                                        {savedDeviceConfig === null
                                            ? '—'
                                            : savedDeviceConfig?.fat_machine_baud
                                                ? `${savedDeviceConfig.fat_machine_baud} baud`
                                                : 'Not set'}
                                    </div>
                                    {/* Update — change dropdown */}
                                    <select
                                        value={baudRate}
                                        onChange={handleFatBaudChange}
                                        style={{
                                            padding: '8px 12px',
                                            borderRadius: '8px',
                                            border: '1.5px solid #6ee7b7',
                                            fontSize: '14px',
                                            fontWeight: '600',
                                            background: 'white',
                                            cursor: 'pointer',
                                            color: '#065f46'
                                        }}
                                    >
                                        <option value="1200">1200</option>
                                        <option value="2400">2400</option>
                                        <option value="4800">4800</option>
                                        <option value="9600">9600</option>
                                        <option value="19200">19200</option>
                                        <option value="115200">115200</option>
                                    </select>
                                    {/* Delete saved baud */}
                                    <button
                                        title="Delete saved baud rate (will use default 2400 on next connect)"
                                        onClick={async () => {
                                            localStorage.removeItem('fat_machine_baud');
                                            if (window.electron) {
                                                const current = await window.electron.invoke('load-device-settings');
                                                const s = current?.settings || {};
                                                delete s.fat_machine_baud;
                                                await window.electron.invoke('save-device-settings', s);
                                            }
                                            setBaudRate(9600);
                                            refreshSavedConfig();
                                            showAlert('Fat machine baud rate cleared. Default (2400) will be used on next connect.', 'Cleared', 'info');
                                        }}
                                        style={{
                                            padding: '8px 12px',
                                            background: '#fee2e2',
                                            border: '1px solid #fca5a5',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            fontSize: '13px',
                                            fontWeight: '600',
                                            color: '#991b1b'
                                        }}
                                    >
                                        <Trash2 size={14} /> Reset
                                    </button>
                                </div>

                                {/* Weight Machine Baud Row */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '16px',
                                    padding: '16px 20px',
                                    borderRadius: '14px',
                                    border: '1.5px solid #bfdbfe',
                                    background: '#eff6ff'
                                }}>
                                    <span style={{ fontSize: '22px' }}>🔌</span>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#1e3a5f' }}>Weight Machine — COM3</p>
                                        <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#6b7280' }}>Saved baud rate used on every auto-connect</p>
                                    </div>
                                    {/* Current saved value */}
                                    <div style={{
                                        padding: '6px 14px',
                                        background: savedDeviceConfig?.weight_machine_baud ? '#bfdbfe' : '#fee2e2',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        fontWeight: '700',
                                        color: savedDeviceConfig?.weight_machine_baud ? '#1e3a5f' : '#991b1b',
                                        minWidth: '80px',
                                        textAlign: 'center'
                                    }}>
                                        {savedDeviceConfig === null
                                            ? '—'
                                            : savedDeviceConfig?.weight_machine_baud
                                                ? `${savedDeviceConfig.weight_machine_baud} baud`
                                                : 'Not set'}
                                    </div>
                                    {/* Update — change dropdown */}
                                    <select
                                        value={weightBaudRate}
                                        onChange={handleWeightBaudChange}
                                        style={{
                                            padding: '8px 12px',
                                            borderRadius: '8px',
                                            border: '1.5px solid #93c5fd',
                                            fontSize: '14px',
                                            fontWeight: '600',
                                            background: 'white',
                                            cursor: 'pointer',
                                            color: '#1e40af'
                                        }}
                                    >
                                        <option value={1200}>1200</option>
                                        <option value={2400}>2400</option>
                                        <option value={4800}>4800</option>
                                        <option value={9600}>9600</option>
                                        <option value={19200}>19200</option>
                                        <option value={38400}>38400</option>
                                        <option value={57600}>57600</option>
                                        <option value={115200}>115200</option>
                                    </select>
                                    {/* Delete saved baud */}
                                    <button
                                        title="Delete saved baud rate (will use default 9600 on next connect)"
                                        onClick={async () => {
                                            localStorage.removeItem('weight_machine_baud');
                                            if (window.electron) {
                                                const current = await window.electron.invoke('load-device-settings');
                                                const s = current?.settings || {};
                                                delete s.weight_machine_baud;
                                                await window.electron.invoke('save-device-settings', s);
                                            }
                                            setWeightBaudRate(9600);
                                            refreshSavedConfig();
                                            showAlert('Weight machine baud rate cleared. Default (9600) will be used on next connect.', 'Cleared', 'info');
                                        }}
                                        style={{
                                            padding: '8px 12px',
                                            background: '#fee2e2',
                                            border: '1px solid #fca5a5',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            fontSize: '13px',
                                            fontWeight: '600',
                                            color: '#991b1b'
                                        }}
                                    >
                                        <Trash2 size={14} /> Reset
                                    </button>
                                </div>

                                {/* Startup Log */}
                                <div>
                                    <p style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🚀 Last Startup Auto-Connect Log</p>
                                    <div style={{
                                        background: '#0f172a', borderRadius: '10px',
                                        padding: '14px 16px', fontFamily: 'monospace',
                                        fontSize: '12px', color: '#94a3b8',
                                        overflowY: 'auto', maxHeight: '180px'
                                    }}>
                                        {startupLog.length === 0 ? (
                                            <span style={{ color: '#64748b' }}>Click Refresh to load startup log...</span>
                                        ) : (
                                            startupLog.map((line, i) => (
                                                <div key={i} style={{
                                                    marginBottom: '3px',
                                                    color: line.includes('✓') ? '#86efac'
                                                         : line.includes('✗') ? '#f87171'
                                                         : line.includes('NONE') ? '#fbbf24'
                                                         : '#94a3b8'
                                                }}>{line}</div>
                                            ))
                                        )}
                                    </div>
                                </div>

                            </div>
                        </div>

                    </>
                    )}

                    {/* ===== RECYCLE BIN TAB ===== */}
                    {activeTab === 'recycle' && (
                        <>
                            {/* Recycle Bin Section */}
                            <div style={{
                                background: 'white',
                                borderRadius: '20px',
                                overflow: 'hidden',
                                border: '1px solid #e5e7eb',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                            }}>
                                {/* Section Header */}
                                <div style={{
                                    padding: '20px 24px',
                                    borderBottom: '1px solid #e5e7eb',
                                    background: '#fafafa',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px'
                                }}>
                                    <Trash2 size={24} color="#dc2626" />
                                    <div>
                                        <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: '#111827' }}>
                                            {t('settings.recycleBin.title')}
                                        </h2>
                                        <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                                            {t('settings.recycleBin.subtitle')}
                                        </p>
                                    </div>
                                </div>

                                {/* Content */}
                                {isLoading ? (
                                    <div style={{ padding: '60px' }}><Loader text={t('settings.recycleBin.loading')} /></div>
                                ) : deletedFarmers.length === 0 ? (
                                    <div style={{
                                        textAlign: 'center',
                                        padding: '60px 20px',
                                        color: '#9ca3af'
                                    }}>
                                        <Trash2 size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                                        <p style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 4px 0', color: '#6b7280' }}>
                                            {t('settings.recycleBin.empty')}
                                        </p>
                                        <p style={{ fontSize: '14px', margin: 0 }}>
                                            {t('settings.recycleBin.emptyHint')}
                                        </p>
                                    </div>
                                ) : (
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ background: '#fafafa' }}>
                                                <th style={{
                                                    padding: '14px 24px',
                                                    textAlign: 'left',
                                                    fontSize: '12px',
                                                    fontWeight: '700',
                                                    color: '#6b7280',
                                                    letterSpacing: '0.5px',
                                                    textTransform: 'uppercase'
                                                }}>{t('settings.recycleBin.table.code')}</th>
                                                <th style={{
                                                    padding: '14px 24px',
                                                    textAlign: 'left',
                                                    fontSize: '12px',
                                                    fontWeight: '700',
                                                    color: '#6b7280',
                                                    letterSpacing: '0.5px',
                                                    textTransform: 'uppercase'
                                                }}>{t('settings.recycleBin.table.name')}</th>
                                                <th style={{
                                                    padding: '14px 24px',
                                                    textAlign: 'left',
                                                    fontSize: '12px',
                                                    fontWeight: '700',
                                                    color: '#6b7280',
                                                    letterSpacing: '0.5px',
                                                    textTransform: 'uppercase'
                                                }}>{t('settings.recycleBin.table.deletedOn')}</th>
                                                <th style={{
                                                    padding: '14px 24px',
                                                    textAlign: 'center',
                                                    fontSize: '12px',
                                                    fontWeight: '700',
                                                    color: '#6b7280',
                                                    letterSpacing: '0.5px',
                                                    textTransform: 'uppercase'
                                                }}>{t('settings.recycleBin.table.actions')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {deletedFarmers.map((farmer, index) => (
                                                <tr key={farmer.id} style={{
                                                    borderBottom: '1px solid #f3f4f6',
                                                    background: index % 2 === 0 ? 'white' : '#fafafa'
                                                }}>
                                                    <td style={{ padding: '16px 24px' }}>
                                                        <span style={{
                                                            fontSize: '14px',
                                                            fontWeight: '700',
                                                            color: '#667eea',
                                                            background: '#eef2ff',
                                                            padding: '4px 10px',
                                                            borderRadius: '6px'
                                                        }}>
                                                            {farmer.code}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '16px 24px', fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                                                        {farmer.name}
                                                    </td>
                                                    <td style={{ padding: '16px 24px', fontSize: '13px', color: '#6b7280' }}>
                                                        {formatDate(farmer.deleted_at)}
                                                    </td>
                                                    <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                            <button
                                                                onClick={() => handleRestore(farmer)}
                                                                disabled={isProcessing}
                                                                title="Restore Farmer"
                                                                style={{
                                                                    padding: '6px 14px',
                                                                    background: '#ecfdf5',
                                                                    border: '1px solid #10b981',
                                                                    borderRadius: '6px',
                                                                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                                                                    color: '#059669',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '6px',
                                                                    fontSize: '13px',
                                                                    fontWeight: '500',
                                                                    opacity: isProcessing ? 0.6 : 1
                                                                }}
                                                            >
                                                                <RotateCcw size={14} />
                                                                {t('settings.recycleBin.restore')}
                                                            </button>
                                                            <button
                                                                onClick={() => handlePermanentDeleteClick(farmer)}
                                                                disabled={isProcessing}
                                                                title="Delete Permanently"
                                                                style={{
                                                                    padding: '6px 14px',
                                                                    background: '#fef2f2',
                                                                    border: '1px solid #dc2626',
                                                                    borderRadius: '6px',
                                                                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                                                                    color: '#dc2626',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '6px',
                                                                    fontSize: '13px',
                                                                    fontWeight: '500',
                                                                    opacity: isProcessing ? 0.6 : 1
                                                                }}
                                                            >
                                                                <Trash2 size={14} />
                                                                {t('settings.recycleBin.deleteForever')}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            {/* Permanent Delete Confirmation Modal */}
                            {showConfirmModal && farmerToDelete && (
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
                                        maxWidth: '420px',
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
                                                fontSize: '18px',
                                                fontWeight: '700',
                                                margin: 0,
                                                color: '#dc2626',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px'
                                            }}>
                                                <TriangleAlert size={22} />
                                                {t('settings.recycleBin.permanentDeleteTitle')}
                                            </h2>
                                            <button
                                                onClick={() => { setShowConfirmModal(false); setFarmerToDelete(null); }}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: '#6b7280',
                                                    padding: '4px'
                                                }}
                                            >
                                                <X size={22} />
                                            </button>
                                        </div>

                                        {/* Modal Body */}
                                        <div style={{ padding: '24px' }}>
                                            <p style={{ fontSize: '15px', color: '#4b5563', marginBottom: '8px' }}>
                                                {t('settings.recycleBin.confirmDelete')}
                                            </p>
                                            <p style={{ fontSize: '16px', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>
                                                {farmerToDelete.name} ({farmerToDelete.code})
                                            </p>
                                            <p style={{
                                                fontSize: '13px',
                                                color: '#dc2626',
                                                background: '#fef2f2',
                                                padding: '12px',
                                                borderRadius: '8px',
                                                marginBottom: '20px'
                                            }}>
                                                {t('settings.recycleBin.warning')}
                                            </p>

                                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                                <button
                                                    onClick={() => { setShowConfirmModal(false); setFarmerToDelete(null); }}
                                                    disabled={isProcessing}
                                                    style={{
                                                        padding: '10px 20px',
                                                        background: '#f3f4f6',
                                                        color: '#374151',
                                                        border: 'none',
                                                        borderRadius: '8px',
                                                        fontSize: '14px',
                                                        fontWeight: '600',
                                                        cursor: isProcessing ? 'not-allowed' : 'pointer'
                                                    }}
                                                >
                                                    {t('settings.recycleBin.cancel')}
                                                </button>
                                                <button
                                                    onClick={handlePermanentDelete}
                                                    disabled={isProcessing}
                                                    style={{
                                                        padding: '10px 20px',
                                                        background: '#dc2626',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '8px',
                                                        fontSize: '14px',
                                                        fontWeight: '600',
                                                        cursor: isProcessing ? 'not-allowed' : 'pointer',
                                                        opacity: isProcessing ? 0.6 : 1
                                                    }}
                                                >
                                                    {isProcessing ? t('settings.recycleBin.deleting') : t('settings.recycleBin.deletePermanently')}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                    <AlertComponent />
                </div>
            </div>
        </div>
    );
};

export default Settings;
