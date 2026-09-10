import React, { useState, useEffect, useRef, useCallback } from 'react';
import { HashRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { LayoutDashboard, Users, Droplets, IndianRupee, Settings as SettingsIcon, Wallet, FileText, Building2, LogOut, UserCog, Loader2, Download, RefreshCw, X, Package, PiggyBank } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAlert } from './hooks/useAlert';
import { getEmployeePermissions, DEFAULT_EMPLOYEE_PERMISSIONS } from './lib/api';

import Dashboard from './pages/Dashboard';
import Farmers from './pages/Farmers';
import Collection from './pages/Collection';

import Settings from './pages/Settings';
import Deductions from './pages/Deductions';
import Billing from './pages/Billing';
import Rates from './pages/Rates';
import Reports from './pages/Reports';
import MilkSale from './pages/MilkSale';
import FederationReceipt from './pages/FederationReceipt';
import FederationRates from './pages/FederationRates';
import BillFormatSelector from './pages/BillFormatSelector';

import Employees from './pages/Employees';
import Inventory from './pages/Inventory';
import ManageCustomers from './pages/ManageCustomers';
import Members from './pages/Members';
import Login from './pages/Login';
import ThevManagement from './pages/ThevManagement';


function Layout({ children, user, onLogout }) {
  const { t } = useTranslation();
  const isEmployee = user?.role !== 'admin' && user?.role !== 'super_admin';

  // Load granular permissions for sidebar visibility (employees only)
  const [perms, setPerms] = useState({ ...DEFAULT_EMPLOYEE_PERMISSIONS });
  useEffect(() => {
    if (!isEmployee || !user?.id || !user?.dairy_id) return;
    getEmployeePermissions(user.id, user.dairy_id)
      .then(row => {
        if (row && Object.keys(row).length > 0) {
          setPerms(prev => ({ ...prev, ...row }));
        }
      })
      .catch(err => console.warn('[Sidebar][Permissions] Failed to load:', err));
  }, [user?.id, user?.dairy_id, isEmployee]);

  const isAdmin = !isEmployee;

  return (
    <div className="app-container">
      <aside className="sidebar-container">
        <div className="sidebar-header">
          <h1 className="sidebar-logo">DudhSakha</h1>
          <div className="sidebar-subtitle">Milk Management</div>
          <div className="user-badge" style={{ marginTop: '10px', fontSize: '0.8rem', opacity: 0.8, background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '4px' }}>
            {user?.username || user?.email} ({user?.role})
          </div>
        </div>

        <nav className="sidebar-nav">
          {/* Dashboard — admin only */}
          {isAdmin && (
            <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <LayoutDashboard size={20} />
              <span>{t('sidebar.dashboard')}</span>
            </NavLink>
          )}

          {/* Collection — all non-super_admin; employees if permitted */}
          {user?.role !== 'super_admin' && (isAdmin || perms.collection) && (
            <NavLink to="/collection" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Droplets size={20} />
              <span>{t('sidebar.collection')}</span>
            </NavLink>
          )}

          {/* Rates — admin or employee with rates permission */}
          {(isAdmin || perms.rates) && user?.role !== 'super_admin' && (
            <NavLink to="/rates" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <IndianRupee size={20} />
              <span>{t('sidebar.rates')}</span>
            </NavLink>
          )}

          {/* Deductions — admin or employee with deductions permission */}
          {(isAdmin || perms.deductions) && user?.role !== 'super_admin' && (
            <NavLink to="/deductions" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Wallet size={20} />
              <span>{t('sidebar.deductions')}</span>
            </NavLink>
          )}

          {/* Thev Management — admin only */}
          {isAdmin && user?.role !== 'super_admin' && (
            <NavLink to="/thev" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <PiggyBank size={20} />
              <span>{t('sidebar.thevManagement')}</span>
            </NavLink>
          )}

          {/* Billing — admin or employee with billing permission */}
          {(isAdmin || perms.billing) && user?.role !== 'super_admin' && (
            <NavLink to="/billing" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <FileText size={20} />
              <span>{t('sidebar.billing')}</span>
            </NavLink>
          )}

          {/* Farmers — admin or employee with farmers permission */}
          {(isAdmin || perms.farmers) && user?.role !== 'super_admin' && (
            <NavLink to="/farmers" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Users size={20} />
              <span>{t('sidebar.farmers')}</span>
            </NavLink>
          )}

          {/* Members — admin or employee with members permission */}
          {(isAdmin || perms.members) && user?.role !== 'super_admin' && (
            <NavLink to="/members" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Users size={20} />
              <span>{t('sidebar.members')}</span>
            </NavLink>
          )}

          {/* Federation Receipt — admin or employee with federation_receipt permission */}
          {(isAdmin || perms.federation_receipt) && user?.role !== 'super_admin' && (
            <NavLink to="/federation-receipt" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Building2 size={20} />
              <span>{t('sidebar.corporateReceipt')}</span>
            </NavLink>
          )}

          {/* Federation Rate Chart — admin only */}
          {isAdmin && user?.role !== 'super_admin' && (
            <NavLink to="/federation-rates" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <IndianRupee size={20} />
              <span>संघ दर</span>
            </NavLink>
          )}

          {/* Employees — admin only (never visible to employees) */}
          {isAdmin && (
            <NavLink to="/employees" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <UserCog size={20} />
              <span>{t('sidebar.userManagement')}</span>
            </NavLink>
          )}

          {/* Inventory — admin or employee with inventory permission */}
          {(isAdmin || perms.inventory) && user?.role !== 'super_admin' && (
            <NavLink to="/inventory" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Package size={20} />
              <span>{t('sidebar.inventory')}</span>
            </NavLink>
          )}

          {/* Manage Customers — admin or employee with manage_customers permission */}
          {(isAdmin || perms.manage_customers) && user?.role !== 'super_admin' && (
            <NavLink to="/manage-customers" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Users size={20} />
              <span>{t('sidebar.manageCustomers')}</span>
            </NavLink>
          )}

          {/* Milk Sale — admin or employee with milk_sale permission */}
          {user?.role !== 'super_admin' && (isAdmin || perms.milk_sale) && (
            <NavLink to="/milk-sale" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <IndianRupee size={20} />
              <span>{t('sidebar.milkSale')}</span>
            </NavLink>
          )}

          {/* Reports — admin or employee with reports permission */}
          {user?.role !== 'super_admin' && (isAdmin || perms.reports) && (
            <NavLink to="/reports" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <FileText size={20} />
              <span>{t('sidebar.reports')}</span>
            </NavLink>
          )}

          {/* Settings — only visible to admin */}
          {user?.role !== 'super_admin' && isAdmin && (
            <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <SettingsIcon size={20} />
              <span>{t('sidebar.settings')}</span>
            </NavLink>
          )}
        </nav>

        <div className="sidebar-footer">
          {/* Offline sync status pill */}
          <div style={{ padding: '0 8px 8px', display: 'flex', justifyContent: 'center' }}>
            
          </div>
          <button onClick={onLogout} className="nav-item" style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 'inherit' }}>
            <LogOut size={20} />
            <span>{t('sidebar.logout')}</span>
          </button>
        </div>
      </aside>

      <div className="main-content-wrapper">
        <main className="main-content">
          {children}
        </main>
      </div>
      <Toaster position="top-center" />
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(true);
  const [checkingSub, setCheckingSub] = useState(false);
  const { t } = useTranslation();
  const { showAlert, showConfirm, AlertComponent } = useAlert();

  // --- AUTO-UPDATE STATE (only active inside Electron desktop app) ---
  const [updateDownloading, setUpdateDownloading] = useState(false);  // new version is downloading
  const [updateReady, setUpdateReady] = useState(false);              // download complete, ready to install
  const [updateVersion, setUpdateVersion] = useState('');             // e.g. "5.2.0"
  const [updateBannerDismissed, setUpdateBannerDismissed] = useState(false);

  // --- GLOBAL DEVICE AUTO-CONNECT ---
  // Loads device settings from persistent file (survives localStorage clears).
  // Log is written silently to localStorage so Settings page can display it.
  const addLog = (msg) => {
    const ts = new Date().toLocaleTimeString();
    console.log('[AutoConnect]', msg);
    try {
      const prev = JSON.parse(localStorage.getItem('autoConnectLog') || '[]');
      const next = [...prev.slice(-19), `${ts}  ${msg}`];
      localStorage.setItem('autoConnectLog', JSON.stringify(next));
    } catch (_) {}
  };

  useEffect(() => {
    if (!user || !window.electron) return;

    // Clear old log on fresh login
    localStorage.setItem('autoConnectLog', JSON.stringify([]));

    let cancelled = false;
    let retryTimer = null;
    let removeListener = null;

    const run = async () => {
      // Load baud rates from persistent file first, fallback to localStorage.
      // Ports are FIXED: Fat Machine = COM1, Weight Machine = COM2.
      const result = await window.electron.invoke('load-device-settings');
      const fileSettings = result?.settings || {};

      const FAT_PORT    = 'COM2';
      const WEIGHT_PORT = 'COM3';
      // Save fixed ports to localStorage so Collection.jsx auto-connect can find them
      localStorage.setItem('fat_machine_port', FAT_PORT);
      localStorage.setItem('weight_machine_port', WEIGHT_PORT);

      const fatBaud    = fileSettings.fat_machine_baud    || localStorage.getItem('fat_machine_baud');
      const weightBaud = fileSettings.weight_machine_baud || localStorage.getItem('weight_machine_baud');

      addLog(`Fat    → Port: ${FAT_PORT} (fixed)  Baud: ${fatBaud || '2400 (default)'}`);
      addLog(`Weight → Port: ${WEIGHT_PORT} (fixed)  Baud: ${weightBaud || '9600 (default)'}`);

      // Auto-connect FAT machine on COM1 (with retry logic)
      {
        let fatRetries = 0;
        const FAT_MAX_RETRIES = 3;
        let fatRetryTimer = null;
        let fatConnected = false;

        const tryConnectFat = () => {
          if (fatConnected || cancelled) return;
          addLog(`FAT: Connecting to ${FAT_PORT} @ ${fatBaud || 2400} baud... (attempt ${fatRetries + 1})`);
          window.electron.invoke('fat-machine-command', {
            action: 'connect',
            port: FAT_PORT,
            baud: fatBaud ? parseInt(fatBaud) : 2400
          });
        };

        const removeFatListener = window.electron.receive('fat-machine-connection', (data) => {
          if (data.connected) {
            fatConnected = true;
            if (fatRetryTimer) clearTimeout(fatRetryTimer);
            addLog(`FAT: ✓ Connected successfully on ${FAT_PORT}`);
          } else if (!fatConnected && fatRetries < FAT_MAX_RETRIES) {
            fatRetries++;
            addLog(`FAT: ✗ ${data.message} — retrying (${fatRetries}/${FAT_MAX_RETRIES})...`);
            fatRetryTimer = setTimeout(tryConnectFat, 3000);
          } else if (!fatConnected) {
            addLog(`FAT: ✗ Failed after all retries — ${data.message}`);
          }
        });

        // FAT machine starts after 1s (weight starts at 2s to avoid port conflicts)
        fatRetryTimer = setTimeout(tryConnectFat, 1000);

        // Merge cleanup into the return
        const originalReturn = { fatRetryTimer, removeFatListener };
        run._fatCleanup = () => {
          if (originalReturn.fatRetryTimer) clearTimeout(originalReturn.fatRetryTimer);
          if (typeof originalReturn.removeFatListener === 'function') originalReturn.removeFatListener();
        };
      }

      // Auto-connect Weight machine on COM2 (with retry logic)
      {
        let retries = 0;
        const MAX_RETRIES = 3;
        let connected = false;

        const tryConnect = () => {
          if (connected || cancelled) return;
          addLog(`Weight: Connecting to ${WEIGHT_PORT} @ ${weightBaud || 9600} baud... (attempt ${retries + 1})`);
          window.electron.invoke('weight-machine-command', {
            action: 'connect',
            port: WEIGHT_PORT,
            baud: weightBaud ? parseInt(weightBaud) : 9600
          });
        };

        removeListener = window.electron.receive('weight-machine-connection', (data) => {
          if (data.connected) {
            connected = true;
            if (retryTimer) clearTimeout(retryTimer);
            addLog(`Weight: ✓ Connected successfully on ${WEIGHT_PORT}`);
          } else if (!connected && retries < MAX_RETRIES) {
            retries++;
            addLog(`Weight: ✗ ${data.message} — retrying (${retries}/${MAX_RETRIES})...`);
            retryTimer = setTimeout(tryConnect, 3000);
          } else if (!connected) {
            addLog(`Weight: ✗ Failed after all retries — ${data.message}`);
          }
        });

        retryTimer = setTimeout(tryConnect, 2000);
      }
    };


    run();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (typeof removeListener === 'function') removeListener();
      if (typeof run._fatCleanup === 'function') run._fatCleanup();
    };
  }, [user]);

  useEffect(() => {
    // Only run inside Electron desktop app
    if (!window.electron || !window.electron.receive) return;

    // Listen for "update found and downloading" from main process
    const removeAvailable = window.electron.receive('update-available', (version) => {
      console.log('[App] Update available:', version);
      setUpdateVersion(version);
      setUpdateDownloading(true);
      setUpdateBannerDismissed(false);
    });

    // Listen for "download finished, ready to install"
    const removeDownloaded = window.electron.receive('update-downloaded', (version) => {
      console.log('[App] Update downloaded:', version);
      setUpdateVersion(version || updateVersion);
      setUpdateDownloading(false);
      setUpdateReady(true);
      setUpdateBannerDismissed(false);
    });

    return () => {
      removeAvailable && removeAvailable();
      removeDownloaded && removeDownloaded();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRestartForUpdate = () => {
    if (window.electron && window.electron.invoke) {
      window.electron.invoke('restart-app-for-update');
    }
  };

  useEffect(() => {
    if (user?.dairy_id && user?.role !== 'super_admin') {
      setCheckingSub(true);
      if (window.api && window.api.checkSubscription) {
        window.api.checkSubscription(user.dairy_id).then(status => {
          setIsSubscribed(status);
          setCheckingSub(false);
        });
      } else {
        // Fallback if api not loaded somehow
        setIsSubscribed(true);
        setCheckingSub(false);
      }
    } else {
      setIsSubscribed(true);
    }
  }, [user]);

  useEffect(() => {
    const APP_VERSION = '6.0.3';
    const savedVersion = localStorage.getItem('app_version');

    if (savedVersion !== APP_VERSION) {
      console.log('App version updated, preserving user settings and clearing session...');

      // --- Snapshot ALL user-configured settings before clearing ---
      // These keys represent the user's preferences and hardware config.
      // They must survive version updates so users don't lose their setup.
      const KEYS_TO_PRESERVE = [
        // Machine connection
        'fat_machine_port', 'fat_machine_baud',
        'weight_machine_port', 'weight_machine_baud',
        // Language
        'app_language', 'i18nextLng',
        // Print settings
        'entryPrintSettings', 'billingPrintSettings', 'billFormat',
        // Milk calibration defaults
        'defaultSnfCow', 'defaultSnfBuffalo',
        // FAT calibration caps
        'minFatCow', 'minFatBuffalo', 'maxFatCow', 'maxFatBuffalo',
        // SNF calibration caps
        'minSnfCow', 'minSnfBuffalo', 'maxSnfCow', 'maxSnfBuffalo',
        // Voice alert
        'voiceAlertEnabled',
      ];
      const preserved = {};
      KEYS_TO_PRESERVE.forEach(key => {
        const val = localStorage.getItem(key);
        if (val !== null) preserved[key] = val;
      });

      // Clear session state (forces fresh login, removes stale data)
      localStorage.clear();
      sessionStorage.clear();

      // Write new version marker
      localStorage.setItem('app_version', APP_VERSION);

      // Restore all preserved user settings
      Object.entries(preserved).forEach(([key, val]) => localStorage.setItem(key, val));

      setLoading(false);
      return;
    }

    const isRefresh = sessionStorage.getItem('app_session_active') === 'true';

    if (isRefresh) {
      // Page refresh — restore saved session, don't force login
      const savedUser = localStorage.getItem('dudhsakha_user');
      if (savedUser) {
        try {
          const restoredUser = JSON.parse(savedUser);
          setUser(restoredUser);
          // Background rebuild on reload (3s delay so UI settles first)
          if (restoredUser?.dairy_id && restoredUser?.role !== 'super_admin' && window.electron) {
            setTimeout(async () => {
              try {
                const { supabase } = await import('./lib/supabase');
                const { data: { session } } = await supabase.auth.getSession();
                window.electron.invoke('rates:full-rebuild', {
                  dairyId:   restoredUser.dairy_id,
                  authToken: session?.access_token || null,
                }).then(r => console.log('[RatesCache] Reload rebuild:', r))
                  .catch(err => console.warn('[RatesCache] Reload rebuild failed:', err));
              } catch(e) { console.warn('[RatesCache] reload rebuild setup failed:', e); }
            }, 3000);
          }
        } catch (_) {
          localStorage.removeItem('dudhsakha_user');
        }
      }
    } else {
      // Fresh app launch — require login
      console.log('Fresh app launch — clearing previous session to require login...');
      localStorage.removeItem('dudhsakha_user');
      sessionStorage.setItem('app_session_active', 'true');
    }

    setLoading(false);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('dudhsakha_user', JSON.stringify(userData));
    sessionStorage.setItem('app_session_active', 'true');

    // Background rebuild on login (2s delay — non-blocking)
    if (userData?.dairy_id && userData?.role !== 'super_admin' && window.electron) {
      setTimeout(async () => {
        try {
          const { supabase } = await import('./lib/supabase');
          const { data: { session } } = await supabase.auth.getSession();
          window.electron.invoke('rates:full-rebuild', {
            dairyId:   userData.dairy_id,
            authToken: session?.access_token || null,
          }).then(r => console.log('[RatesCache] Login rebuild:', r))
            .catch(err => console.warn('[RatesCache] Login rebuild failed:', err));
        } catch(e) { console.warn('[RatesCache] login rebuild setup failed:', e); }
      }, 2000);
    }
  };


  const handleLogout = async () => {
    const confirmed = await showConfirm(t('sidebar.logoutConfirm'), t('sidebar.logout'), t('sidebar.logout'), t('common.cancel', { defaultValue: 'Cancel' }));
    if (confirmed) {
      try {
        localStorage.removeItem('dudhsakha_user');
        sessionStorage.removeItem('dudhsakha_user');
        setUser(null);
      } catch (e) {
        console.error("Logout error:", e);
      } finally {
        window.location.reload();
      }
    }
  };


  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="spin" size={40} color="#4f46e5" />
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Login onLogin={handleLogin} />

        {/* Update downloading — shown on Login screen */}
        {updateDownloading && !updateBannerDismissed && (
          <div style={{
            position: 'fixed', bottom: '20px', right: '20px',
            background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
            color: 'white', padding: '14px 18px', borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(59,130,246,0.4)',
            zIndex: 9999, display: 'flex', alignItems: 'center', gap: '12px',
            maxWidth: '340px', animation: 'slideUp 0.4s ease-out'
          }}>
            <Download size={20} style={{ flexShrink: 0, animation: 'pulse 1.5s ease-in-out infinite' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '700', fontSize: '14px' }}>नवीन अपडेट मिळाला! {updateVersion && `(v${updateVersion})`}</div>
              <div style={{ fontSize: '12px', opacity: 0.85, marginTop: '2px' }}>Background मध्ये download होत आहे...</div>
            </div>
            <button onClick={() => setUpdateBannerDismissed(true)}
              style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '2px', opacity: 0.7, flexShrink: 0 }}>
              <X size={16} />
            </button>
          </div>
        )}

        {/* Update ready — shown on Login screen */}
        {updateReady && !updateBannerDismissed && (
          <div style={{
            position: 'fixed', bottom: '20px', right: '20px',
            background: 'linear-gradient(135deg, #065f46, #10b981)',
            color: 'white', padding: '16px 18px', borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(16,185,129,0.4)',
            zIndex: 9999, display: 'flex', alignItems: 'center', gap: '12px',
            maxWidth: '360px', animation: 'slideUp 0.4s ease-out'
          }}>
            <RefreshCw size={20} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '700', fontSize: '14px' }}>अपडेट तयार आहे! {updateVersion && `(v${updateVersion})`}</div>
              <div style={{ fontSize: '12px', opacity: 0.85, marginTop: '2px' }}>App restart करा आणि नवीन version install होईल.</div>
              <button onClick={handleRestartForUpdate} style={{
                marginTop: '10px', background: 'white', color: '#065f46',
                border: 'none', borderRadius: '8px', padding: '6px 14px',
                fontWeight: '700', fontSize: '13px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}>
                <RefreshCw size={14} /> आत्ता Restart करा
              </button>
            </div>
            <button onClick={() => setUpdateBannerDismissed(true)}
              style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '2px', opacity: 0.7, flexShrink: 0, alignSelf: 'flex-start' }}>
              <X size={16} />
            </button>
          </div>
        )}
      </>
    );
  }

  if (checkingSub) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="spin" size={40} color="#4f46e5" />
        <p style={{ marginTop: '16px', color: '#666' }}>Verifying subscription...</p>
      </div>
    );
  }

  if (!isSubscribed) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb', padding: '20px' }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', textAlign: 'center', maxWidth: '400px' }}>
          <h2 style={{ color: '#dc2626', marginBottom: '16px', fontSize: '24px', fontWeight: 'bold' }}>Subscription Inactive</h2>
          <p style={{ color: '#4b5563', marginBottom: '24px', lineHeight: '1.5' }}>Your dairy's subscription is currently inactive or has expired. Please contact the administrator to renew your access.</p>
          <button onClick={handleLogout} style={{ padding: '10px 24px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}>
            Go Back
          </button>
        </div>
      </div>
    );
  }


  const isAdmin = user.role === 'admin';

  return (
    <Router>
      <Layout
        user={user}
        onLogout={handleLogout}
        
        
        
        
      >
        <Routes>
          {/* Default entry point */}
          <Route path="/" element={isAdmin ? <Dashboard user={user} /> : <Navigate to="/collection" replace />} />

          <Route path="/collection" element={<Collection user={user} />} />
          <Route path="/milk-sale" element={<MilkSale user={user} />} />
          <Route path="/reports" element={<Reports user={user} />} />

          {/* Pages available to admins AND employees with matching permissions */}
          <Route path="/rates" element={<Rates user={user} />} />
          <Route path="/billing" element={<Billing user={user} />} />
          <Route path="/deductions" element={<Deductions user={user} />} />
          <Route path="/thev" element={<ThevManagement user={user} />} />
          <Route path="/farmers" element={<Farmers user={user} />} />
          <Route path="/members" element={<Members user={user} />} />
          <Route path="/federation-receipt" element={<FederationReceipt user={user} />} />
          <Route path="/manage-customers" element={<ManageCustomers user={user} />} />
          <Route path="/inventory" element={<Inventory user={user} />} />

          {/* Admin-only pages */}
          {isAdmin && (
            <>
              <Route path="/federation-rates" element={<FederationRates user={user} />} />
              <Route path="/employees" element={<Employees user={user} />} />
              <Route path="/settings" element={<Settings user={user} />} />
              <Route path="/settings/bill-format" element={<BillFormatSelector user={user} />} />
            </>
          )}

          {/* Fallback */}
          <Route path="*" element={<Navigate to={isAdmin ? "/" : "/collection"} replace />} />
        </Routes>
      </Layout>

      <AlertComponent />

      {/* ---- AUTO-UPDATE BANNERS (desktop Electron only) ---- */}

      {/* Banner 1: Update is downloading in background */}
      {updateDownloading && !updateBannerDismissed && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
          color: 'white',
          padding: '14px 18px',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(59,130,246,0.4)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          maxWidth: '340px',
          animation: 'slideUp 0.4s ease-out'
        }}>
          <Download size={20} style={{ flexShrink: 0, animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '700', fontSize: '14px' }}>
              नवीन अपडेट मिळाला! {updateVersion && `(v${updateVersion})`}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.85, marginTop: '2px' }}>
              Background मध्ये download होत आहे...
            </div>
          </div>
          <button
            onClick={() => setUpdateBannerDismissed(true)}
            style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '2px', opacity: 0.7, flexShrink: 0 }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Banner 2: Update downloaded and ready to install */}
      {updateReady && !updateBannerDismissed && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          background: 'linear-gradient(135deg, #065f46, #10b981)',
          color: 'white',
          padding: '16px 18px',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(16,185,129,0.4)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          maxWidth: '360px',
          animation: 'slideUp 0.4s ease-out'
        }}>
          <RefreshCw size={20} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '700', fontSize: '14px' }}>
              अपडेट तयार आहे! {updateVersion && `(v${updateVersion})`}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.85, marginTop: '2px' }}>
              App restart करा आणि नवीन version install होईल.
            </div>
            <button
              onClick={handleRestartForUpdate}
              style={{
                marginTop: '10px',
                background: 'white',
                color: '#065f46',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 14px',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              <RefreshCw size={14} /> आत्ता Restart करा
            </button>
          </div>
          <button
            onClick={() => setUpdateBannerDismissed(true)}
            style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '2px', opacity: 0.7, flexShrink: 0, alignSelf: 'flex-start' }}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </Router>

  );
}

export default App;
