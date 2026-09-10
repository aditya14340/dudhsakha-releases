import React from 'react';
import { AlertCircle, CheckCircle, XCircle, X, AlertTriangle } from 'lucide-react';

/**
 * Custom AlertDialog Component
 * Replaces native alert() and confirm() to prevent input freezing
 */
const AlertDialog = ({
    isOpen,
    onClose,
    title,
    message,
    type = 'info', // 'info', 'success', 'error', 'warning', 'confirm'
    onConfirm,
    confirmText = 'OK',
    cancelText = 'Cancel',
    showCancel = false,
    mode = 'modal' // 'modal' or 'toast'
}) => {
    if (!isOpen) return null;

    const icons = {
        info: <AlertCircle size={48} color="#3b82f6" />,
        success: <CheckCircle size={48} color="#10b981" />,
        error: <XCircle size={48} color="#ef4444" />,
        warning: <AlertTriangle size={48} color="#f59e0b" />,
        confirm: <AlertTriangle size={48} color="#f59e0b" />
    };

    const colors = {
        info: '#3b82f6',
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        confirm: '#3b82f6'
    };

    // TOAST MODE
    if (mode === 'toast') {
        return (
            <div
                style={{
                    position: 'fixed',
                    top: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: 'white',
                    borderRadius: '50px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 24px',
                    zIndex: 9999,
                    animation: 'toastSlideDown 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
                    gap: '12px',
                    border: `1px solid ${colors[type]}20`,
                    minWidth: '300px'
                }}
            >
                {/* Smaller Icon for Toast */}
                {React.cloneElement(icons[type], { size: 24 })}

                <p style={{
                    fontSize: '15px',
                    fontWeight: '600',
                    color: '#374151',
                    margin: 0
                }}>
                    {message}
                </p>

                <style>{`
                    @keyframes toastSlideDown {
                        from { transform: translate(-50%, -100%); opacity: 0; }
                        to { transform: translate(-50%, 0); opacity: 1; }
                    }
                `}</style>
            </div>
        );
    }

    // MODAL MODE (Original)
    const handleConfirm = () => {
        if (onConfirm) onConfirm(true);
        onClose();
    };

    const handleCancel = () => {
        if (onConfirm) onConfirm(false);
        onClose();
    };

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                zIndex: 9999
            }}
            onClick={handleCancel}
        >
            <div
                style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    width: '100%',
                    maxWidth: '480px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                    overflow: 'hidden',
                    animation: 'slideIn 0.2s ease-out'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header with close button */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '20px 24px',
                    borderBottom: '1px solid #e5e7eb'
                }}>
                    <h2 style={{
                        fontSize: '20px',
                        fontWeight: '700',
                        margin: 0,
                        color: '#111827'
                    }}>
                        {title || 'Notification'}
                    </h2>
                    {!showCancel && (
                        <button
                            onClick={handleCancel}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                color: '#6b7280'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>

                {/* Body */}
                <div style={{
                    padding: '32px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '20px'
                }}>
                    {icons[type]}
                    <p style={{
                        fontSize: '15px',
                        color: '#374151',
                        textAlign: 'center',
                        margin: 0,
                        lineHeight: '1.6',
                        whiteSpace: 'pre-line'
                    }}>
                        {message}
                    </p>
                </div>

                {/*Footer with buttons */}
                <div style={{
                    display: 'flex',
                    gap: '12px',
                    padding: '20px 24px',
                    borderTop: '1px solid #e5e7eb',
                    backgroundColor: '#f9fafb'
                }}>
                    {showCancel && (
                        <button
                            onClick={handleCancel}
                            style={{
                                flex: 1,
                                padding: '12px 24px',
                                backgroundColor: 'white',
                                color: '#374151',
                                border: '2px solid #d1d5db',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                fontSize: '15px',
                                fontWeight: '600',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#f3f4f6';
                                e.currentTarget.style.borderColor = '#9ca3af';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'white';
                                e.currentTarget.style.borderColor = '#d1d5db';
                            }}
                        >
                            {cancelText}
                        </button>
                    )}
                    <button
                        onClick={handleConfirm}
                        autoFocus
                        style={{
                            flex: 1,
                            padding: '12px 24px',
                            background: colors[type],
                            color: 'white',
                            border: 'none',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            fontSize: '15px',
                            fontWeight: '600',
                            boxShadow: `0 4px 12px ${colors[type]}40`,
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = `0 6px 16px ${colors[type]}50`;
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = `0 4px 12px ${colors[type]}40`;
                        }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateY(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>
        </div>
    );
};

export default AlertDialog;
