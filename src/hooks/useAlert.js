import React, { useState, useCallback } from 'react';
import AlertDialog from '../components/AlertDialog';

export const useAlert = () => {
    const [dialogState, setDialogState] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: 'info',
        onConfirm: null,
        confirmText: 'OK',
        cancelText: 'Cancel',
        showCancel: false
    });

    const showAlert = useCallback((message, title = '', type = 'info') => {
        setDialogState({
            isOpen: true,
            title,
            message,
            type,
            onConfirm: null,
            confirmText: 'OK',
            cancelText: 'Cancel',
            showCancel: false
        });
    }, []);

    const showConfirm = useCallback((message, title = '', confirmText = 'OK', cancelText = 'Cancel') => {
        return new Promise((resolve) => {
            setDialogState({
                isOpen: true,
                title,
                message,
                type: 'confirm',
                onConfirm: resolve,
                confirmText,
                cancelText,
                showCancel: true
            });
        });
    }, []);

    const showToast = useCallback((message, type = 'success', duration = 2000) => {
        setDialogState({
            isOpen: true,
            message,
            type,
            mode: 'toast', // Use non-blocking toast style
            showButtons: false,
            showCancel: false
        });
        // Auto-close after duration so it doesn't block the print dialog
        setTimeout(() => {
            setDialogState(prev => ({ ...prev, isOpen: false }));
        }, duration);
    }, []);

    const closeDialog = useCallback(() => {
        setDialogState(prev => ({ ...prev, isOpen: false }));
    }, []);

    const AlertComponent = useCallback(() => {
        const { isOpen, title, message, type, onConfirm, confirmText, cancelText, showCancel, mode, showButtons } = dialogState;

        if (!isOpen) return null;

        return React.createElement(AlertDialog, {
            isOpen,
            onClose: closeDialog,
            title,
            message,
            type,
            onConfirm,
            confirmText,
            cancelText,
            showCancel,
            mode: mode || 'modal',
            showButtons: showButtons !== undefined ? showButtons : true // Default to true
        });
    }, [dialogState, closeDialog]);

    return { showAlert, showConfirm, showToast, AlertComponent };
};
