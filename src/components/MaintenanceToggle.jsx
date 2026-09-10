import React, { useState, useEffect } from 'react';
import { ShieldAlert, Power } from 'lucide-react';
import { useAlert } from '../hooks/useAlert';

const MaintenanceToggle = () => {
    const { showAlert, showConfirm, AlertComponent } = useAlert();
    const [isEnabled, setIsEnabled] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStatus();
    }, []);

    const fetchStatus = async () => {
        try {
            const settings = await window.api.getSettings();
            setIsEnabled(!!settings.maintenance_mode);
        } catch (error) {
            console.error("Failed to fetch maintenance status", error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async () => {
        const newState = !isEnabled;
        const confirmMsg = newState
            ? "ACTIVATE Maintenance Mode? \n\nOnly Super Admins will be able to log in. All other users will be locked out."
            : "DISABLE Maintenance Mode? \n\nAll users will be allowed to log in again.";

        if (!await showConfirm(confirmMsg, 'Maintenance Mode', isEnabled ? 'Disable' : 'Activate', 'Cancel')) return;

        setLoading(true);
        try {
            await window.api.toggleMaintenanceMode(newState);
            setIsEnabled(newState);
            showAlert(newState ? "Maintenance Mode Activated" : "Maintenance Mode Disabled", 'Success', 'success');
        } catch (error) {
            showAlert("Error: " + error.message, 'Error', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return null;

    return (
        <div style={{
            background: isEnabled ? '#fff1f2' : 'white',
            border: isEnabled ? '1px solid #fecaca' : '1px solid #e2e8f0',
            padding: '24px',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '32px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                    padding: '12px',
                    borderRadius: '12px',
                    background: isEnabled ? '#fee2e2' : '#f1f5f9',
                    color: isEnabled ? '#dc2626' : '#64748b'
                }}>
                    <ShieldAlert size={28} />
                </div>
                <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', color: isEnabled ? '#991b1b' : '#1e293b' }}>
                        Maintenance Mode {isEnabled && '(ACTIVE)'}
                    </h3>
                    <p style={{ margin: 0, color: isEnabled ? '#b91c1c' : '#64748b', fontSize: '14px' }}>
                        {isEnabled
                            ? "System is locked. Only Super Admin access allowed."
                            : "System is running normally. All users can log in."}
                    </p>
                </div>
            </div>

            <button
                onClick={handleToggle}
                style={{
                    padding: '12px 24px',
                    borderRadius: '12px',
                    border: 'none',
                    background: isEnabled ? '#dc2626' : '#1e293b',
                    color: 'white',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: isEnabled ? '0 4px 12px rgba(220, 38, 38, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.1)'
                }}
            >
                <Power size={18} />
                {isEnabled ? 'Disable Maintenance' : 'Enable Maintenance'}
            </button>
            <AlertComponent />
        </div>
    );
};

export default MaintenanceToggle;
