import React, { useState, useEffect } from 'react';
import { X, Shield, Loader2, RotateCcw, Save, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getEmployeePermissions, saveEmployeePermissions, DEFAULT_EMPLOYEE_PERMISSIONS } from '../lib/api';

// ─── Permission groups ────────────────────────────────────────────────────────
const MODULE_PERMISSIONS = [
    { key: 'collection',          icon: '🥛' },
    { key: 'milk_sale',           icon: '🛒' },
    { key: 'milk_sale_billing',   icon: '🧾' },
    { key: 'billing',             icon: '📋' },
    { key: 'rates',               icon: '💰' },
    { key: 'deductions',          icon: '💸' },
    { key: 'farmers',             icon: '👨‍🌾' },
    { key: 'members',             icon: '👥' },
    { key: 'reports',             icon: '📊' },
    { key: 'advanced_reports',    icon: '📈' },
    { key: 'federation_receipt',  icon: '🏢' },
    { key: 'inventory',           icon: '📦' },
    { key: 'manage_customers',    icon: '👤' },
];

const DATA_PERMISSIONS = [
    { key: 'can_view_past_data',    icon: '📅' },
    { key: 'can_save_past_entry',   icon: '💾' },
    { key: 'can_edit_saved_entry',  icon: '✏️' },
    { key: 'can_delete_entry',      icon: '🗑️' },
];

// ─── Toggle Switch Component ──────────────────────────────────────────────────
function ToggleSwitch({ checked, onChange, disabled }) {
    return (
        <button
            type="button"
            onClick={() => !disabled && onChange(!checked)}
            disabled={disabled}
            style={{
                position: 'relative',
                display: 'inline-flex',
                width: '48px',
                height: '26px',
                borderRadius: '13px',
                border: 'none',
                cursor: disabled ? 'not-allowed' : 'pointer',
                background: checked
                    ? 'linear-gradient(135deg, #10b981, #059669)'
                    : 'rgba(255,255,255,0.15)',
                transition: 'all 0.25s ease',
                flexShrink: 0,
                outline: 'none',
                boxShadow: checked
                    ? '0 0 0 2px rgba(16,185,129,0.3), inset 0 1px 2px rgba(0,0,0,0.2)'
                    : 'inset 0 1px 3px rgba(0,0,0,0.3)',
                opacity: disabled ? 0.5 : 1,
            }}
            aria-checked={checked}
            role="switch"
        >
            <span
                style={{
                    position: 'absolute',
                    top: '3px',
                    left: checked ? '25px' : '3px',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: 'white',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    transition: 'left 0.25s cubic-bezier(0.34,1.56,0.64,1)',
                }}
            />
        </button>
    );
}

// ─── Single permission row ────────────────────────────────────────────────────
function PermissionRow({ permKey, icon, value, onChange, disabled, t }) {
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '10px',
                background: value ? 'rgba(16,185,129,0.07)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${value ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.06)'}`,
                transition: 'all 0.2s ease',
                marginBottom: '8px',
            }}
        >
            <span style={{ fontSize: '1.1rem', width: '24px', textAlign: 'center', flexShrink: 0 }}>
                {icon}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#e2e8f0', lineHeight: 1.2 }}>
                    {t(`employeePermissions.permissions.${permKey}`, permKey)}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(148,163,184,0.85)', marginTop: '2px', lineHeight: 1.4 }}>
                    {t(`employeePermissions.permissions.${permKey}Desc`, '')}
                </div>
            </div>
            <ToggleSwitch checked={!!value} onChange={onChange} disabled={disabled} />
        </div>
    );
}

// ─── Collapsible section ──────────────────────────────────────────────────────
function Section({ title, subtitle, children, defaultOpen = true }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div style={{ marginBottom: '20px' }}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '10px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    marginBottom: open ? '14px' : '0',
                }}
            >
                <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        {title}
                    </div>
                    {subtitle && (
                        <div style={{ fontSize: '0.72rem', color: 'rgba(148,163,184,0.6)', marginTop: '2px' }}>
                            {subtitle}
                        </div>
                    )}
                </div>
                {open
                    ? <ChevronUp size={16} color="rgba(148,163,184,0.7)" />
                    : <ChevronDown size={16} color="rgba(148,163,184,0.7)" />
                }
            </button>
            {open && <div>{children}</div>}
        </div>
    );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export default function EmployeePermissionsModal({ employee, dairyId, onClose, onSaved }) {
    const { t } = useTranslation();
    const [perms, setPerms] = useState({ ...DEFAULT_EMPLOYEE_PERMISSIONS });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    // Load existing permissions on mount
    useEffect(() => {
        if (!employee?.id || !dairyId) return;
        setLoading(true);
        getEmployeePermissions(employee.id, dairyId)
            .then(row => {
                if (row && Object.keys(row).length > 0) {
                    setPerms({ ...DEFAULT_EMPLOYEE_PERMISSIONS, ...row });
                } else {
                    // No row yet — use defaults
                    setPerms({ ...DEFAULT_EMPLOYEE_PERMISSIONS });
                }
            })
            .catch(() => setError(t('employeePermissions.loadError')))
            .finally(() => setLoading(false));
    }, [employee?.id, dairyId, t]);

    const toggle = (key) => setPerms(p => ({ ...p, [key]: !p[key] }));

    const handleSave = async () => {
        setSaving(true);
        setError('');
        try {
            await saveEmployeePermissions(employee.id, dairyId, perms);
            setSaved(true);
            setTimeout(() => {
                setSaved(false);
                onSaved && onSaved(employee.id, perms);
                onClose();
            }, 900);
        } catch {
            setError(t('employeePermissions.saveError'));
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        setPerms({ ...DEFAULT_EMPLOYEE_PERMISSIONS });
    };

    // Backdrop click closes
    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) onClose();
    };

    return (
        <div
            onClick={handleBackdropClick}
            style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(6px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '16px',
                animation: 'fadeIn 0.2s ease',
            }}
        >
            <div
                style={{
                    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                    borderRadius: '18px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
                    width: '100%',
                    maxWidth: '520px',
                    maxHeight: '90vh',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    animation: 'slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)',
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '22px 24px 16px',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', gap: '14px',
                    background: 'rgba(255,255,255,0.02)',
                }}>
                    <div style={{
                        width: '44px', height: '44px', borderRadius: '12px',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                    }}>
                        <Shield size={22} color="white" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '1rem', fontWeight: '700', color: '#f1f5f9' }}>
                            {t('employeePermissions.title')}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'rgba(148,163,184,0.8)', marginTop: '1px' }}>
                            {employee?.username || t('employeePermissions.subtitle')}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255,255,255,0.08)',
                            border: 'none', borderRadius: '8px',
                            width: '32px', height: '32px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: '#94a3b8',
                            transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '10px', color: '#64748b' }}>
                            <Loader2 size={22} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                            <span>{t('common.loading')}</span>
                        </div>
                    ) : (
                        <>
                            {error && (
                                <div style={{
                                    background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                                    borderRadius: '8px', padding: '10px 14px', marginBottom: '16px',
                                    color: '#fca5a5', fontSize: '0.82rem',
                                }}>
                                    {error}
                                </div>
                            )}

                            {/* Module Access */}
                            <Section
                                title={t('employeePermissions.sections.moduleAccess')}
                                subtitle={t('employeePermissions.sections.moduleAccessSubtitle')}
                                defaultOpen={true}
                            >
                                {MODULE_PERMISSIONS.map(({ key, icon }) => (
                                    <PermissionRow
                                        key={key}
                                        permKey={key}
                                        icon={icon}
                                        value={perms[key]}
                                        onChange={(v) => setPerms(p => ({ ...p, [key]: v }))}
                                        disabled={saving}
                                        t={t}
                                    />
                                ))}
                            </Section>

                            {/* Data Controls */}
                            <Section
                                title={t('employeePermissions.sections.dataControls')}
                                subtitle={t('employeePermissions.sections.dataControlsSubtitle')}
                                defaultOpen={true}
                            >
                                {DATA_PERMISSIONS.map(({ key, icon }) => (
                                    <PermissionRow
                                        key={key}
                                        permKey={key}
                                        icon={icon}
                                        value={perms[key]}
                                        onChange={(v) => {
                                            // If enabling can_save_past_entry, auto-enable can_view_past_data too
                                            if (key === 'can_save_past_entry' && v) {
                                                setPerms(p => ({ ...p, can_view_past_data: true, can_save_past_entry: true }));
                                            } else {
                                                setPerms(p => ({ ...p, [key]: v }));
                                            }
                                        }}
                                        disabled={saving || (key === 'can_save_past_entry' && !perms.can_view_past_data)}
                                        t={t}
                                    />
                                ))}
                                {/* Hint for dependency */}
                                {!perms.can_view_past_data && (
                                    <div style={{ fontSize: '0.72rem', color: 'rgba(148,163,184,0.6)', padding: '2px 8px 8px', marginTop: '-4px' }}>
                                        💡 Enable "View Previous Entries" to unlock saving on past dates.
                                    </div>
                                )}
                            </Section>
                        </>
                    )}
                </div>

                {/* Footer */}
                {!loading && (
                    <div style={{
                        padding: '16px 24px',
                        borderTop: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex', gap: '10px', justifyContent: 'space-between',
                        background: 'rgba(255,255,255,0.02)',
                    }}>
                        <button
                            type="button"
                            onClick={handleReset}
                            disabled={saving}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '7px',
                                padding: '9px 16px', borderRadius: '9px',
                                background: 'rgba(255,255,255,0.07)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: '#94a3b8', fontSize: '0.82rem', fontWeight: '600',
                                cursor: saving ? 'not-allowed' : 'pointer',
                                transition: 'all 0.15s',
                                opacity: saving ? 0.6 : 1,
                            }}
                            onMouseEnter={e => { if (!saving) e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
                        >
                            <RotateCcw size={14} />
                            {t('employeePermissions.resetToDefaults')}
                        </button>

                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving || saved}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '9px 22px', borderRadius: '9px',
                                background: saved
                                    ? 'linear-gradient(135deg, #10b981, #059669)'
                                    : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                border: 'none',
                                color: 'white', fontSize: '0.85rem', fontWeight: '700',
                                cursor: saving ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
                                opacity: saving ? 0.8 : 1,
                                minWidth: '140px', justifyContent: 'center',
                            }}
                        >
                            {saving
                                ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> {t('employeePermissions.saving')}</>
                                : saved
                                    ? <><Check size={15} /> Saved!</>
                                    : <><Save size={15} /> {t('employeePermissions.save')}</>
                            }
                        </button>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
