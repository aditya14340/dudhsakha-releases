
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Plus, Search, UserPlus, Edit, Trash2, X, TriangleAlert, Download, Key, Unlock } from 'lucide-react';
import Loader from '../components/Loader';
import { useAlert } from '../hooks/useAlert';
import { getFarmers, addFarmer, updateFarmer, softDeleteFarmer, updateFarmerPassword, resetFarmerDevice } from '../lib/api';
import { supabase } from '../lib/supabase';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

function Farmers({ user }) {
    const { t } = useTranslation();
    const { showAlert, showConfirm, AlertComponent } = useAlert();
    const [farmers, setFarmers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const itemsPerPage = 10;
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        name_local: '',
        phone: '',
        email: '',
        address: '',
        bank_account: '',
        aadhar: '',
        is_member: true,
        joining_date: new Date().toISOString().split('T')[0],
        farmer_password: '',
        default_milk_type: 'Buffalo', // Defaulting to Buffalo as requested previously or standard
        rate_type: 'sangh'
    });

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [farmerToDelete, setFarmerToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const listReportRef = React.useRef();
    const [isDownloading, setIsDownloading] = useState(false);
    const [availableCharts, setAvailableCharts] = useState([{ name: 'sangh' }]); // rate chart names

    const loadFarmers = async () => {
        try {
            setLoading(true);
            const data = await getFarmers(user?.dairy_id);

            const activeFarmers = (data || []).filter(f => !f.is_deleted);

            activeFarmers.sort((a, b) => parseInt(a.code) - parseInt(b.code));

            setFarmers(activeFarmers);
        } catch (error) {
            console.error("Error loading farmers:", error);
        } finally {
            setLoading(false);
        }
    };

    // Fetch distinct rate chart names from the rates table
    const loadAvailableCharts = async () => {
        try {
            const { data } = await supabase
                .from('rates')
                .select('rate_type')
                .eq('dairy_id', user?.dairy_id);
            const types = [...new Set((data || []).map(r => r.rate_type || 'sangh'))]
                .filter(t => t !== 'federation_dar'); // Cannot assign federation rate to individual farmers
            if (!types.includes('sangh')) types.unshift('sangh');
            setAvailableCharts(types.map(name => ({ name })));
        } catch (err) {
            console.error('Error loading rate chart types:', err);
        }
    };

    useEffect(() => {
        if (user?.dairy_id) {
            loadFarmers();
            loadAvailableCharts();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.dairy_id]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleEdit = (farmer) => {
        setFormData({
            code: farmer.code,
            name: farmer.name,
            name_local: farmer.name_local || '',
            phone: farmer.phone || '',
            email: farmer.email || '',
            address: farmer.address || '',
            bank_account: farmer.bank_account || '',
            aadhar: farmer.aadhar || '',
            is_member: farmer.is_member !== false,
            joining_date: farmer.joining_date || new Date().toISOString().split('T')[0],
            farmer_password: '',
            default_milk_type: farmer.default_milk_type || 'Buffalo',
            rate_type: farmer.rate_type || 'sangh'
        });
        setEditId(farmer.id);
        setIsEditing(true);
        setShowModal(true);
    };

    const handleAdd = async () => {
        setFormData({
            code: '',
            name: '',
            name_local: '',
            phone: '',
            email: '',
            address: '',
            bank_account: '',
            aadhar: '',
            is_member: true,
            joining_date: new Date().toISOString().split('T')[0],
            farmer_password: '',
            default_milk_type: 'Buffalo',
            rate_type: 'sangh'
        });
        setIsEditing(false);
        setEditId(null);
        setShowModal(true);

        try {

            const data = await getFarmers(user?.dairy_id);

            let maxCode = 0;
            if (data) {
                data.forEach(f => {
                    const c = parseInt(f.code);
                    if (!isNaN(c) && c > maxCode) maxCode = c;
                });
            }
            setFormData(prev => ({ ...prev, code: String(maxCode + 1) }));
        } catch (error) {
            console.error("Error fetching next farmer code:", error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (saving) return; // Prevent double submit

        // --- VALIDATION ---

        // 1. Phone: must be exactly 10 digits (if provided)
        if (formData.phone) {
            const phoneClean = formData.phone.trim();
            if (!/^\d{10}$/.test(phoneClean)) {
                showAlert('मोबाईल नंबर 10 अंकी असणे आवश्यक आहे. (Mobile number must be exactly 10 digits)', 'Validation Error', 'warning');
                return;
            }
        }

        // 3. Duplicate code check
        if (formData.code) {
            const codeClean = formData.code.trim();
            const existingByCode = farmers.find(f => f.code === codeClean && f.id !== editId);
            if (existingByCode) {
                showAlert(`हा शेतकरी कोड (${codeClean}) आधीच "${existingByCode.name}" (मोबाईल: ${existingByCode.phone || 'N/A'}) यांना दिलेला आहे.\n\nThis code is already assigned to "${existingByCode.name}" (Mobile: ${existingByCode.phone || 'N/A'}).`, 'Duplicate Code', 'error');
                return;
            }
        }

        // 4. Duplicate email check
        if (formData.email && formData.email.trim() !== '') {
            const emailClean = formData.email.trim().toLowerCase();
            const existingByEmail = farmers.find(f => f.email && f.email.toLowerCase() === emailClean && f.id !== editId);
            if (existingByEmail) {
                showAlert(`हा ईमेल (${emailClean}) आधीच "${existingByEmail.name}" (कोड: ${existingByEmail.code}) या शेतकऱ्यासाठी नोंदणीकृत आहे.\n\nThis email is already registered to "${existingByEmail.name}" (Code: ${existingByEmail.code}).`, 'Duplicate Email', 'error');
                return;
            }
        }

        // --- SAVE ---
        setSaving(true);
        try {
            if (isEditing) {
                const { farmer_password: pwd, ...farmerData } = formData;
                await updateFarmer({ ...farmerData, id: editId, dairy_id: user?.dairy_id }, user?.dairy_id);
                // If admin provided a new password, update it via Edge Function
                let passwordUpdated = false;
                let passwordError = null;
                if (formData.farmer_password && formData.farmer_password.length >= 6) {
                    try {
                        await updateFarmerPassword(editId, formData.phone, formData.farmer_password, user?.dairy_id);
                        passwordUpdated = true;
                    } catch (pwdErr) {
                        console.error("Password update failed:", pwdErr);
                        passwordError = pwdErr;
                    }
                }
                setShowModal(false);
                if (passwordUpdated) {
                    showAlert(
                        `शेतकरी "${formData.name}" अपडेट झाला आणि पासवर्ड बदलला!\n\n` +
                        `Farmer "${formData.name}" updated & password changed successfully.`,
                        'Updated ✅', 'success'
                    );
                } else if (passwordError) {
                    showAlert(
                        `शेतकरी "${formData.name}" माहिती अपडेट झाली, पण पासवर्ड बदलता आला नाही.\n\n` +
                        `Farmer "${formData.name}" info updated, but password change failed. Please try again.`,
                        'Partial Update ⚠️', 'warning'
                    );
                } else {
                    showAlert(
                        `शेतकरी "${formData.name}" यशस्वीरित्या अपडेट झाला!\n\n` +
                        `Farmer "${formData.name}" updated successfully.`,
                        'Updated ✅', 'success'
                    );
                }
            } else {
                // Validate password is provided
                if (!formData.farmer_password || formData.farmer_password.length < 6) {
                    showAlert('पासवर्ड किमान 6 अक्षरांचा असणे आवश्यक आहे.\n\nPassword must be at least 6 characters.', 'Validation Error', 'warning');
                    return;
                }

                // addFarmer now auto-creates auth account with the custom password
                const result = await addFarmer({ ...formData, dairy_id: user?.dairy_id });

                setShowModal(false);
                showAlert(
                    `शेतकरी "${formData.name}" यशस्वीरित्या जोडला!\n\n` +
                    `📱 ॲप लॉगिन माहिती:\n` +
                    `फोन नंबर: ${formData.phone}\n` +
                    `पासवर्ड: फॉर्ममध्ये सेट केल्याप्रमाणे.\n\n` +
                    `Farmer "${formData.name}" added!\n` +
                    `App Login → Phone: ${formData.phone} | Password: as set in the form.`,
                    'Farmer Created ✅', 'success'
                );
            }
            setFormData({ code: '', name: '', name_local: '', phone: '', email: '', address: '', bank_account: '', aadhar: '', is_member: true, joining_date: new Date().toISOString().split('T')[0], farmer_password: '' });
            setIsEditing(false);
            setEditId(null);
            loadFarmers();

            // Rebuild local cache so Collection page picks up the new rate_type instantly
            if (user?.dairy_id && window.electron) {
                import('../lib/supabase').then(({ supabase }) => {
                    supabase.auth.getSession().then(({ data: { session } }) => {
                        window.electron.invoke('rates:full-rebuild', {
                            dairyId:   user.dairy_id,
                            authToken: session?.access_token || null,
                        }).then(r => console.log('[RatesCache] Farmer save rebuild:', r))
                          .catch(err => console.warn('[RatesCache] Farmer save rebuild failed:', err));
                    });
                }).catch(() => {});
            }
        } catch (error) {
            console.error("Error saving farmer:", error);
            showAlert(t('farmers.delete.errors.save') + " " + error.message, 'Error', 'error');
        } finally {
            setSaving(false);
        }
    };


    const handleDeleteClick = (farmer) => {
        setFarmerToDelete(farmer);
        setShowDeleteModal(true);
    };

    const handleDeleteFarmerOnly = async () => {
        if (!farmerToDelete) return;
        setIsDeleting(true);
        try {

            await softDeleteFarmer(farmerToDelete.id, user?.dairy_id);

            setShowDeleteModal(false);
            setFarmerToDelete(null);
            loadFarmers();
        } catch (error) {
            console.error("Error deleting farmer:", error);
            showAlert(t('farmers.delete.errors.delete'), 'Error', 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDeleteFarmerWithData = async () => {
        if (!farmerToDelete) return;
        setIsDeleting(true);
        try {







            await window.api.deleteFarmerWithData(farmerToDelete.id, user?.dairy_id);

            setShowDeleteModal(false);
            setFarmerToDelete(null);
            loadFarmers();
        } catch (error) {
            console.error("Error deleting farmer with data:", error);
            showAlert(t('farmers.delete.errors.deleteData') + " " + error.message, 'Error', 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleResetDevice = async (farmer) => {
        const confirmed = await showConfirm(
            `Are you sure you want to reset the device binding for ${farmer.name}? They will be able to log in on a new device.`,
            'Reset Device Binding',
            'Yes, Reset',
            'Cancel'
        );
        if (!confirmed) return;
        
        try {
            setLoading(true);
            await resetFarmerDevice(farmer.id, user?.dairy_id);
            showAlert(`Device unbound for ${farmer.name}. They can now log in on a new phone.`, 'Device Reset ✅', 'success');
            loadFarmers();
        } catch (error) {
            console.error("Error resetting device:", error);
            showAlert("Failed to reset device binding.", 'Error', 'error');
        } finally {
            setLoading(false);
        }
    };

    const filteredFarmers = farmers.filter(f => {
        if (!searchTerm) return true;
        return (
            (f.name && f.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (f.code && f.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (f.phone && f.phone.includes(searchTerm))
        );
    });

    const downloadFarmersList = async () => {
        if (!listReportRef.current) return;
        try {
            setIsDownloading(true);

            // Wait for render
            await new Promise(resolve => setTimeout(resolve, 500));

            const canvas = await html2canvas(listReportRef.current, {
                scale: 2,
                backgroundColor: '#ffffff',
                useCORS: true
            });

            const imgData = canvas.toDataURL('image/png');
            const imgWidth = 210; // A4 width in mm
            const pageHeight = 297; // A4 height in mm
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            // For list, we'll use a dynamic single page height if it fits reasonably, 
            // or just standard logic. The user wants "Support Multilanguage".
            // A long canvas is best saved as a long PDF page to avoid cutting text.

            const pdf = new jsPDF('p', 'mm', [imgWidth, imgHeight + 20]); // Add some padding
            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            pdf.save(`Farmers_List_${new Date().toISOString().split('T')[0]}.pdf`);

        } catch (error) {
            console.error("Error generating PDF:", error);
            showAlert("Error generating PDF. Please try again.", 'Print Error', 'error');
        } finally {
            setIsDownloading(false);
        }
    };

    const totalPages = Math.ceil(filteredFarmers.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentFarmers = filteredFarmers.slice(startIndex, endIndex);

    useEffect(() => {
        setCurrentPage(1); // Reset to first page when search changes
    }, [searchTerm]);

    return (
        <div style={{
            padding: '16px 32px',
            maxWidth: '1600px',
            margin: '0 auto',
            background: 'transparent',
            minHeight: '100%',
            position: 'relative'
        }}>
            {loading && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(255, 255, 255, 0.8)',
                    zIndex: 50,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(2px)'
                }}>
                    <Loader text={t('common.loading') || "Loading Farmers..."} />
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
                        <Users size={28} />
                        {t('farmers.title')}
                    </h1>
                    <p style={{ fontSize: '15px', color: '#6b7280', margin: 0 }}>
                        {t('farmers.subtitle')}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        onClick={handleAdd}
                        style={{
                            padding: '12px 24px',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '15px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.35)',
                            transition: 'all 0.3s'
                        }}
                    >
                        <Plus size={20} strokeWidth={2.5} />
                        {t('farmers.addFarmer')}
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <div style={{
                background: 'white',
                borderRadius: '16px',
                padding: '16px 20px',
                marginBottom: '24px',
                border: '1px solid #e5e7eb',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
            }}>
                <Search size={20} color="#6b7280" />
                <input
                    type="text"
                    placeholder={t('farmers.searchPlaceholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                        flex: 1,
                        border: 'none',
                        outline: 'none',
                        fontSize: '15px',
                        background: 'transparent'
                    }}
                />
            </div>

            {/* Farmers Table */}
            <div style={{
                background: 'white',
                borderRadius: '20px',
                overflow: 'hidden',
                border: '1px solid #e5e7eb',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
                {filteredFarmers.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '80px 20px',
                        color: '#9ca3af'
                    }}>
                        <UserPlus size={56} style={{ margin: '0 auto 20px', opacity: 0.4 }} />
                        <p style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 8px 0', color: '#6b7280' }}>
                            {searchTerm ? t('farmers.noResults') : t('farmers.noFarmers')}
                        </p>
                        <p style={{ fontSize: '14px', margin: 0 }}>
                            {searchTerm ? t('farmers.tryDifferent') : t('farmers.noFarmersStart')}
                        </p>
                    </div>
                ) : (
                    <>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#fafafa' }}>
                                    <th style={{
                                        padding: '16px 24px',
                                        textAlign: 'left',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        color: '#6b7280',
                                        letterSpacing: '0.5px',
                                        textTransform: 'uppercase',
                                        width: '10%'
                                    }}>{t('farmers.table.code')}</th>
                                    <th style={{
                                        padding: '16px 24px',
                                        textAlign: 'left',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        color: '#6b7280',
                                        letterSpacing: '0.5px',
                                        textTransform: 'uppercase',
                                        width: '25%'
                                    }}>{t('farmers.table.name')}</th>
                                    <th style={{
                                        padding: '16px 24px',
                                        textAlign: 'left',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        color: '#6b7280',
                                        letterSpacing: '0.5px',
                                        textTransform: 'uppercase',
                                        width: '15%'
                                    }}>{t('farmers.table.mobile')}</th>
                                    <th style={{
                                        padding: '16px 24px',
                                        textAlign: 'left',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        color: '#6b7280',
                                        letterSpacing: '0.5px',
                                        textTransform: 'uppercase',
                                        width: '12%'
                                    }}>📊 {t('farmers.table.rateChart')}</th>
                                    <th style={{
                                        padding: '16px 24px',
                                        textAlign: 'left',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        color: '#6b7280',
                                        letterSpacing: '0.5px',
                                        textTransform: 'uppercase',
                                        width: '30%'
                                    }}>{t('farmers.table.address')}</th>
                                    <th style={{
                                        padding: '16px 24px',
                                        textAlign: 'left',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        color: '#6b7280',
                                        letterSpacing: '0.5px',
                                        textTransform: 'uppercase',
                                        width: '15%'
                                    }}>{t('farmers.table.joinDate')}</th>
                                    <th style={{
                                        padding: '16px 24px',
                                        textAlign: 'center',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        color: '#6b7280',
                                        letterSpacing: '0.5px',
                                        textTransform: 'uppercase',
                                        width: '20%'
                                    }}>{t('farmers.table.actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentFarmers.map((farmer, index) => (
                                    <tr key={farmer.id} style={{
                                        borderBottom: '1px solid #f3f4f6',
                                        background: index % 2 === 0 ? 'white' : '#fafafa'
                                    }}>
                                        <td style={{ padding: '20px 24px' }}>
                                            <span style={{
                                                fontSize: '15px',
                                                fontWeight: '700',
                                                color: '#667eea',
                                                background: '#eef2ff',
                                                padding: '6px 12px',
                                                borderRadius: '8px'
                                            }}>
                                                {farmer.code}
                                            </span>
                                        </td>
                                        <td style={{ padding: '20px 24px', fontSize: '15px', fontWeight: '600', color: '#111827' }}>
                                            {farmer.name}
                                        </td>
                                        <td style={{ padding: '20px 24px', fontSize: '15px', color: '#6b7280' }}>
                                            {farmer.phone || '—'}
                                        </td>
                                        <td style={{ padding: '20px 24px' }}>
                                            <span style={{
                                                display: 'inline-block',
                                                fontSize: '12px',
                                                fontWeight: '700',
                                                padding: '4px 10px',
                                                borderRadius: '20px',
                                                background: (!farmer.rate_type || farmer.rate_type === 'sangh') ? '#eef2ff' : '#fffbeb',
                                                color: (!farmer.rate_type || farmer.rate_type === 'sangh') ? '#4f46e5' : '#d97706',
                                                border: (!farmer.rate_type || farmer.rate_type === 'sangh') ? '1px solid #c7d2fe' : '1px solid #fde68a',
                                                textTransform: 'capitalize'
                                            }}>
                                                {farmer.rate_type || 'sangh'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '20px 24px', fontSize: '14px', color: '#6b7280' }}>
                                            {farmer.address || '—'}
                                        </td>
                                        <td style={{ padding: '20px 24px', fontSize: '15px', color: '#6b7280' }}>
                                            {farmer.joining_date
                                                ? new Date(farmer.joining_date).toLocaleDateString()
                                                : (farmer.created_at ? new Date(farmer.created_at).toLocaleDateString() : '-')}
                                        </td>
                                        <td style={{ padding: '20px 24px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                <button
                                                    onClick={() => handleEdit(farmer)}
                                                    title={t('farmers.actions.edit')}
                                                    style={{
                                                        padding: '8px 16px',
                                                        background: '#f3f4f6',
                                                        border: 'none',
                                                        borderRadius: '8px',
                                                        cursor: 'pointer',
                                                        color: '#374151',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        fontSize: '14px',
                                                        fontWeight: '500',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    <Edit size={16} />
                                                    {t('farmers.actions.edit')}
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteClick(farmer)}
                                                    title={t('farmers.actions.delete')}
                                                    style={{
                                                        padding: '8px 16px',
                                                        background: '#fef2f2',
                                                        border: 'none',
                                                        borderRadius: '8px',
                                                        cursor: 'pointer',
                                                        color: '#dc2626',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        fontSize: '14px',
                                                        fontWeight: '500',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    <Trash2 size={16} />
                                                    {t('farmers.actions.delete')}
                                                </button>
                                                {farmer.device_id && (
                                                    <button
                                                        onClick={() => handleResetDevice(farmer)}
                                                        title="Unlock Device"
                                                        style={{
                                                            padding: '8px 16px',
                                                            background: '#eff6ff',
                                                            border: 'none',
                                                            borderRadius: '8px',
                                                            cursor: 'pointer',
                                                            color: '#2563eb',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '6px',
                                                            fontSize: '14px',
                                                            fontWeight: '500',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        <Unlock size={16} />
                                                        Unlock Device
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div style={{
                                padding: '20px 24px',
                                borderTop: '1px solid #f3f4f6',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: '#fafafa'
                            }}>
                                <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                                    {t('farmers.pagination.showing', { start: startIndex + 1, end: Math.min(endIndex, filteredFarmers.length), total: filteredFarmers.length })}
                                </p>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        disabled={currentPage === 1}
                                        style={{
                                            padding: '8px 16px',
                                            background: currentPage === 1 ? '#f3f4f6' : 'white',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '8px',
                                            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                            fontSize: '14px',
                                            fontWeight: '500',
                                            color: currentPage === 1 ? '#9ca3af' : '#374151'
                                        }}
                                    >
                                        {t('farmers.pagination.previous')}
                                    </button>
                                    {[...Array(totalPages)].map((_, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setCurrentPage(i + 1)}
                                            style={{
                                                padding: '8px 12px',
                                                background: currentPage === i + 1
                                                    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                                    : 'white',
                                                border: '1px solid #e5e7eb',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                fontSize: '14px',
                                                fontWeight: '600',
                                                color: currentPage === i + 1 ? 'white' : '#374151',
                                                minWidth: '36px'
                                            }}
                                        >
                                            {i + 1}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                        disabled={currentPage === totalPages}
                                        style={{
                                            padding: '8px 16px',
                                            background: currentPage === totalPages ? '#f3f4f6' : 'white',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '8px',
                                            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                            fontSize: '14px',
                                            fontWeight: '500',
                                            color: currentPage === totalPages ? '#9ca3af' : '#374151'
                                        }}
                                    >
                                        {t('farmers.pagination.next')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )
                }
            </div >

            {/* Add/Edit Modal */}
            {
                showModal && (
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
                        zIndex: 1000,
                        padding: '20px'
                    }}>
                        <div style={{
                            background: 'white',
                            borderRadius: '24px',
                            width: '100%',
                            maxWidth: '1000px',
                            maxHeight: '90vh',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                            overflow: 'hidden'
                        }}>
                            {/* Modal Header */}
                            <div style={{
                                padding: '24px 32px',
                                borderBottom: '1px solid #f3f4f6',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: 'linear-gradient(to right, #ffffff, #f9fafb)'
                            }}>
                                <div>
                                    <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#111827', margin: 0 }}>
                                        {isEditing ? t('farmers.modal.titleEdit') : t('farmers.modal.titleAdd')}
                                    </h2>
                                    <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
                                        {t('farmers.subtitle')}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowModal(false)}
                                    style={{
                                        background: '#f3f4f6',
                                        border: 'none',
                                        borderRadius: '12px',
                                        padding: '8px',
                                        cursor: 'pointer',
                                        color: '#6b7280',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                    onMouseOver={(e) => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#ef4444'; }}
                                    onMouseOut={(e) => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#6b7280'; }}
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Modal Body - Scrollable Area */}
                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                                <div style={{
                                    padding: '32px',
                                    overflowY: 'auto',
                                    flex: 1
                                }}>
                                    {/* Professional 3-Column Grid Layout */}
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(3, 1fr)',
                                        gap: '24px',
                                        alignItems: 'start'
                                    }}>
                                        {/* Column 1: Core Identity */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#4b5563', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                                                    {t('farmers.modal.labels.code')}
                                                </label>
                                                <input
                                                    type="text"
                                                    disabled
                                                    value={formData.code}
                                                    placeholder={t('farmers.modal.placeholders.auto')}
                                                    style={{
                                                        width: '100%',
                                                        padding: '12px 16px',
                                                        borderRadius: '12px',
                                                        border: '2px solid #f3f4f6',
                                                        background: '#f9fafb',
                                                        fontSize: '15px',
                                                        color: '#6b7280',
                                                        fontWeight: '600',
                                                        cursor: 'not-allowed'
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#4b5563', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                                                    {t('farmers.modal.labels.name')} <span style={{ color: '#ef4444' }}>*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    name="name"
                                                    required
                                                    value={formData.name}
                                                    onChange={handleInputChange}
                                                    placeholder={t('farmers.modal.placeholders.name')}
                                                    style={{
                                                        width: '100%',
                                                        padding: '12px 16px',
                                                        borderRadius: '12px',
                                                        border: '2px solid #e5e7eb',
                                                        fontSize: '15px',
                                                        transition: 'border-color 0.2s',
                                                        outline: 'none'
                                                    }}
                                                    onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                                                    onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#4b5563', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                                                    {t('farmers.modal.labels.nameLocal')}
                                                </label>
                                                <input
                                                    type="text"
                                                    name="name_local"
                                                    value={formData.name_local}
                                                    onChange={handleInputChange}
                                                    placeholder={t('farmers.modal.placeholders.nameLocal')}
                                                    style={{
                                                        width: '100%',
                                                        padding: '12px 16px',
                                                        borderRadius: '12px',
                                                        border: '2px solid #e5e7eb',
                                                        fontSize: '15px',
                                                        outline: 'none'
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        {/* Column 2: Contact & Status */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#4b5563', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                                                    {t('farmers.modal.labels.mobile')} <span style={{ color: '#ef4444' }}>*</span>
                                                </label>
                                                <input
                                                    type="tel"
                                                    name="phone"
                                                    required
                                                    maxLength="10"
                                                    value={formData.phone}
                                                    onChange={handleInputChange}
                                                    placeholder={t('farmers.modal.placeholders.mobile')}
                                                    style={{
                                                        width: '100%',
                                                        padding: '12px 16px',
                                                        borderRadius: '12px',
                                                        border: '2px solid #e5e7eb',
                                                        fontSize: '15px',
                                                        outline: 'none'
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#4b5563', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                                                    {t('farmers.modal.labels.memberStatus')}
                                                </label>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData(prev => ({ ...prev, is_member: true }))}
                                                        style={{
                                                            flex: 1,
                                                            padding: '12px',
                                                            borderRadius: '12px',
                                                            border: formData.is_member ? '2px solid #6366f1' : '2px solid #f3f4f6',
                                                            background: formData.is_member ? '#eef2ff' : 'white',
                                                            color: formData.is_member ? '#4f46e5' : '#6b7280',
                                                            fontWeight: '700',
                                                            fontSize: '14px',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        {t('farmers.modal.options.member')}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData(prev => ({ ...prev, is_member: false }))}
                                                        style={{
                                                            flex: 1,
                                                            padding: '12px',
                                                            borderRadius: '12px',
                                                            border: !formData.is_member ? '2px solid #ef4444' : '2px solid #f3f4f6',
                                                            background: !formData.is_member ? '#fef2f2' : 'white',
                                                            color: !formData.is_member ? '#dc2626' : '#6b7280',
                                                            fontWeight: '700',
                                                            fontSize: '14px',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        {t('farmers.modal.options.nonMember')}
                                                    </button>
                                                </div>
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#4b5563', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                                                    {t('farmers.modal.labels.joiningDate')}
                                                </label>
                                                <input
                                                    type="date"
                                                    name="joining_date"
                                                    value={formData.joining_date || ''}
                                                    onChange={handleInputChange}
                                                    style={{
                                                        width: '100%',
                                                        padding: '12px 16px',
                                                        borderRadius: '12px',
                                                        border: '2px solid #e5e7eb',
                                                        fontSize: '15px',
                                                        outline: 'none',
                                                        background: 'white'
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        {/* Column 3: Preferences & Details */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#4b5563', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                                                    {t('farmers.modal.labels.defaultMilkType')}
                                                </label>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData(prev => ({ ...prev, default_milk_type: 'Buffalo' }))}
                                                        style={{
                                                            flex: 1,
                                                            padding: '12px',
                                                            borderRadius: '12px',
                                                            border: formData.default_milk_type === 'Buffalo' ? '2px solid #6366f1' : '2px solid #f3f4f6',
                                                            background: formData.default_milk_type === 'Buffalo' ? '#eef2ff' : 'white',
                                                            color: formData.default_milk_type === 'Buffalo' ? '#4f46e5' : '#6b7280',
                                                            fontWeight: '700',
                                                            fontSize: '14px',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        {t('farmers.modal.options.buffalo')}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData(prev => ({ ...prev, default_milk_type: 'Cow' }))}
                                                        style={{
                                                            flex: 1,
                                                            padding: '12px',
                                                            borderRadius: '12px',
                                                            border: formData.default_milk_type === 'Cow' ? '2px solid #6366f1' : '2px solid #f3f4f6',
                                                            background: formData.default_milk_type === 'Cow' ? '#eef2ff' : 'white',
                                                            color: formData.default_milk_type === 'Cow' ? '#4f46e5' : '#6b7280',
                                                            fontWeight: '700',
                                                            fontSize: '14px',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        {t('farmers.modal.options.cow')}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Rate Chart Selector */}
                                            <div>
                                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#4b5563', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                                                    📊 {t('farmers.modal.labels.rateChart')}
                                                </label>
                                                <select
                                                    value={formData.rate_type || 'sangh'}
                                                    onChange={e => setFormData(prev => ({ ...prev, rate_type: e.target.value }))}
                                                    style={{
                                                        width: '100%', padding: '12px 16px',
                                                        borderRadius: '12px', border: '2px solid #e5e7eb',
                                                        fontSize: '15px', outline: 'none',
                                                        background: 'white', cursor: 'pointer',
                                                        color: '#111827', fontWeight: '600'
                                                    }}
                                                >
                                                    {availableCharts.map(chart => (
                                                        <option key={chart.name} value={chart.name}>
                                                            {chart.name === 'sangh' ? `🏛️ ${t('rates.chartPicker.sanghDefault')}` : `⭐ ${chart.name}`}
                                                        </option>
                                                    ))}
                                                </select>
                                                <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#9ca3af' }}>
                                                    {t('farmers.modal.labels.rateChartHint', 'Rate chart used when recording milk collections for this farmer.')}
                                                </p>
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#4b5563', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                                                    {t('farmers.modal.labels.bank')}
                                                </label>
                                                <input
                                                    type="text"
                                                    name="bank_account"
                                                    value={formData.bank_account}
                                                    onChange={handleInputChange}
                                                    placeholder={t('farmers.modal.placeholders.bank')}
                                                    style={{
                                                        width: '100%',
                                                        padding: '12px 16px',
                                                        borderRadius: '12px',
                                                        border: '2px solid #e5e7eb',
                                                        fontSize: '15px',
                                                        outline: 'none'
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#4b5563', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                                                    {t('farmers.modal.labels.aadhar')}
                                                </label>
                                                <input
                                                    type="text"
                                                    name="aadhar"
                                                    value={formData.aadhar}
                                                    onChange={handleInputChange}
                                                    placeholder={t('farmers.modal.placeholders.aadhar')}
                                                    maxLength="12"
                                                    style={{
                                                        width: '100%',
                                                        padding: '12px 16px',
                                                        borderRadius: '12px',
                                                        border: '2px solid #e5e7eb',
                                                        fontSize: '15px',
                                                        outline: 'none'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bottom row: Address, Email, Password */}
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 1fr',
                                        gap: '24px',
                                        marginTop: '24px'
                                    }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#4b5563', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                                                {t('farmers.modal.labels.address')}
                                            </label>
                                            <textarea
                                                name="address"
                                                value={formData.address}
                                                onChange={handleInputChange}
                                                placeholder={t('farmers.modal.placeholders.address')}
                                                rows="3"
                                                style={{
                                                    width: '100%',
                                                    padding: '12px 16px',
                                                    borderRadius: '12px',
                                                    border: '2px solid #e5e7eb',
                                                    fontSize: '15px',
                                                    outline: 'none',
                                                    resize: 'none',
                                                    fontFamily: 'inherit'
                                                }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#4b5563', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                                                    {t('farmers.modal.labels.email')}
                                                </label>
                                                <input
                                                    type="email"
                                                    name="email"
                                                    value={formData.email}
                                                    onChange={handleInputChange}
                                                    placeholder={t('farmers.modal.placeholders.email')}
                                                    style={{
                                                        width: '100%',
                                                        padding: '12px 16px',
                                                        borderRadius: '12px',
                                                        border: '2px solid #e5e7eb',
                                                        fontSize: '15px',
                                                        outline: 'none'
                                                    }}
                                                />
                                            </div>
                                            {/* Security Box */}
                                            <div style={{
                                                background: '#f8faff',
                                                border: '2px dashed #e0e7ff',
                                                borderRadius: '12px',
                                                padding: '12px 16px'
                                            }}>
                                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '800', color: '#4338ca', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                                                    🔑 {isEditing ? t('farmers.modal.labels.changePassword') : t('farmers.modal.labels.setPassword')}
                                                </label>
                                                <input
                                                    type="password"
                                                    name="farmer_password"
                                                    required={!isEditing}
                                                    value={formData.farmer_password}
                                                    onChange={handleInputChange}
                                                    placeholder={isEditing ? t('farmers.modal.placeholders.leaveBlank') : t('farmers.modal.placeholders.minChars')}
                                                    style={{
                                                        width: '100%',
                                                        padding: '10px 14px',
                                                        borderRadius: '8px',
                                                        border: '2px solid #c7d2fe',
                                                        fontSize: '14px',
                                                        outline: 'none',
                                                        background: 'white'
                                                    }}
                                                />
                                                <p style={{ fontSize: '12px', color: '#6366f1', marginTop: '6px', fontWeight: '500', margin: '6px 0 0 0' }}>
                                                    {isEditing ? t('farmers.modal.hints.editPassword') : t('farmers.modal.hints.newPassword')}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Modal Footer - Always Visible / Sticky */}
                                <div style={{
                                    padding: '24px 32px',
                                    borderTop: '1px solid #f3f4f6',
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                    gap: '16px',
                                    background: 'white',
                                    boxShadow: '0 -10px 15px -3px rgba(0, 0, 0, 0.05)'
                                }}>
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        style={{
                                            padding: '12px 32px',
                                            borderRadius: '14px',
                                            border: '2px solid #e5e7eb',
                                            background: 'white',
                                            color: '#4b5563',
                                            fontSize: '15px',
                                            fontWeight: '700',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseOver={(e) => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.borderColor = '#d1d5db'; }}
                                        onMouseOut={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
                                    >
                                        {t('farmers.modal.buttons.cancel')}
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        style={{
                                            padding: '12px 48px',
                                            borderRadius: '14px',
                                            border: 'none',
                                            background: saving ? '#a5b4fc' : 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
                                            color: 'white',
                                            fontSize: '15px',
                                            fontWeight: '700',
                                            cursor: saving ? 'wait' : 'pointer',
                                            boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.3)',
                                            transition: 'transform 0.2s, box-shadow 0.2s',
                                            display: 'flex', alignItems: 'center', gap: '8px',
                                            opacity: saving ? 0.8 : 1
                                        }}
                                        onMouseOver={(e) => { if (!saving) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 15px 20px -5px rgba(99, 102, 241, 0.4)'; } }}
                                        onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(99, 102, 241, 0.3)'; }}
                                    >
                                        {saving && <span className="spin" style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%' }}></span>}
                                        {saving ? (isEditing ? 'Updating...' : 'Saving...') : (isEditing ? t('farmers.modal.buttons.update') : t('farmers.modal.buttons.save'))}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

            {/* Delete Confirmation Modal */}
            {
                showDeleteModal && farmerToDelete && (
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
                            maxWidth: '480px',
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
                                    fontSize: '20px',
                                    fontWeight: '700',
                                    margin: 0,
                                    color: '#dc2626',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px'
                                }}>
                                    <TriangleAlert size={24} />
                                    {t('farmers.delete.title')}
                                </h2>
                                <button
                                    onClick={() => { setShowDeleteModal(false); setFarmerToDelete(null); }}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: '#6b7280',
                                        padding: '4px'
                                    }}
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div style={{ padding: '24px' }}>
                                <p style={{ fontSize: '15px', color: '#4b5563', marginBottom: '20px' }}>
                                    {t('farmers.delete.confirm', { name: farmerToDelete.name, code: farmerToDelete.code })}
                                </p>
                                <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '24px' }}>
                                    {t('farmers.delete.choose')}
                                </p>

                                {/* Delete Options */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <button
                                        onClick={handleDeleteFarmerOnly}
                                        disabled={isDeleting}
                                        style={{
                                            padding: '16px 20px',
                                            background: '#fef3c7',
                                            border: '2px solid #f59e0b',
                                            borderRadius: '12px',
                                            cursor: isDeleting ? 'not-allowed' : 'pointer',
                                            textAlign: 'left',
                                            opacity: isDeleting ? 0.6 : 1
                                        }}
                                    >
                                        <div style={{ fontWeight: '600', color: '#92400e', marginBottom: '4px' }}>
                                            {t('farmers.delete.option1.title')}
                                        </div>
                                        <div style={{ fontSize: '13px', color: '#a16207' }}>
                                            {t('farmers.delete.option1.desc')}
                                        </div>
                                    </button>

                                    <button
                                        onClick={handleDeleteFarmerWithData}
                                        disabled={isDeleting}
                                        style={{
                                            padding: '16px 20px',
                                            background: '#fef2f2',
                                            border: '2px solid #dc2626',
                                            borderRadius: '12px',
                                            cursor: isDeleting ? 'not-allowed' : 'pointer',
                                            textAlign: 'left',
                                            opacity: isDeleting ? 0.6 : 1
                                        }}
                                    >
                                        <div style={{ fontWeight: '600', color: '#b91c1c', marginBottom: '4px' }}>
                                            {t('farmers.delete.option2.title')}
                                        </div>
                                        <div style={{ fontSize: '13px', color: '#dc2626' }}>
                                            {t('farmers.delete.option2.desc')}
                                        </div>
                                    </button>
                                </div>

                                {/* Cancel Button */}
                                <div style={{ marginTop: '20px', textAlign: 'right' }}>
                                    <button
                                        onClick={() => { setShowDeleteModal(false); setFarmerToDelete(null); }}
                                        disabled={isDeleting}
                                        style={{
                                            padding: '10px 20px',
                                            background: '#f3f4f6',
                                            color: '#374151',
                                            border: 'none',
                                            borderRadius: '8px',
                                            fontSize: '14px',
                                            fontWeight: '600',
                                            cursor: isDeleting ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        {t('farmers.modal.buttons.cancel')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Hidden Report Template */}
            <div style={{ position: 'fixed', top: 0, left: '-9999px', width: '750px', background: 'white', zIndex: -1 }}>
                <div ref={listReportRef} style={{ padding: '20px', fontFamily: "'Inter', sans-serif", color: '#111827' }}>
                    <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #3b82f6', paddingBottom: '15px' }}>
                        <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#2563eb', margin: '0 0 8px 0' }}>{user?.dairy_name || 'Dairy Report'}</h1>
                        <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#4b5563', margin: 0 }}>{t('farmers.title')} - List</h2>
                        <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '6px' }}>Generated: {new Date().toLocaleString()}</p>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', tableLayout: 'fixed' }}>
                        <thead>
                            <tr style={{ background: '#3b82f6', color: 'white' }}>
                                <th style={{ padding: '8px', textAlign: 'left', borderRadius: '6px 0 0 6px', width: '10%' }}>{t('farmers.table.code')}</th>
                                <th style={{ padding: '8px', textAlign: 'left', width: '20%' }}>{t('farmers.table.name')}</th>
                                <th style={{ padding: '8px', textAlign: 'left', width: '15%' }}>{t('farmers.table.mobile')}</th>
                                <th style={{ padding: '8px', textAlign: 'left', width: '20%' }}>{t('farmers.table.address')}</th>
                                <th style={{ padding: '8px', textAlign: 'left', width: '15%' }}>Membership</th>
                                <th style={{ padding: '8px', textAlign: 'left', borderRadius: '0 6px 6px 0', width: '20%' }}>Join Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredFarmers.map((farmer, index) => (
                                <tr key={farmer.id} style={{ borderBottom: '1px solid #e2e8f0', background: index % 2 === 0 ? 'white' : '#f8fafc' }}>
                                    <td style={{ padding: '8px', fontWeight: 'bold', color: '#3b82f6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{farmer.code}</td>
                                    <td style={{ padding: '8px', fontWeight: '600', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{farmer.name}</td>
                                    <td style={{ padding: '8px', color: '#64748b' }}>{farmer.phone || '-'}</td>
                                    <td style={{ padding: '8px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{farmer.address || '-'}</td>
                                    <td style={{ padding: '8px', color: farmer.is_member !== false ? '#10b981' : '#f59e0b', fontWeight: '600' }}>
                                        {farmer.is_member !== false ? 'Member' : 'Non-Member'}
                                    </td>
                                    <td style={{ padding: '8px', color: '#64748b' }}>
                                        {farmer.joining_date ? new Date(farmer.joining_date).toLocaleDateString() : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '10px', color: '#cbd5e1' }}>
                        Total Farmers: {filteredFarmers.length}
                    </div>
                </div>
            </div>
            <style>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { 100% { transform: rotate(360deg); } }
            `}</style>
            <AlertComponent />
        </div>
    );
}

export default Farmers;
