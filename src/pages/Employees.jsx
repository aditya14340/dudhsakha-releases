import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Key, Users, X, Check, Search, UserCog, TriangleAlert, Shield, User, Eye, EyeOff, Calendar, Clock, TrendingUp, Activity, Unlock } from 'lucide-react';
import Loader from '../components/Loader';
import { useTranslation } from 'react-i18next';
import { getUsers, getSettings, getDairies, addUser, updateUser, deleteUser, resetOperatorDevice } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useAlert } from '../hooks/useAlert';

export default function Employees({ user }) {
    const { t } = useTranslation();
    const { showAlert, showConfirm, AlertComponent } = useAlert();
    const [users, setUsers] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [dairyCode, setDairyCode] = useState(null);
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        role: 'employee',
        password: '',
        device_limit: 1
    });
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [showPassword, setShowPassword] = useState(false);



    useEffect(() => {
        fetchUsers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    const fetchUsers = async () => {
        setIsFetching(true);
        try {
            const data = await getUsers(user?.dairy_id);

            const filteredData = (data || []).filter(u => u.role !== 'super_admin');
            setUsers(filteredData);

            try {
                const settings = await getSettings();
                if (settings && settings.dairy_code) {
                    setDairyCode(settings.dairy_code);
                } else {

                    const dairies = await getDairies();
                    const currentDairy = dairies?.find(d => d.id === user?.dairy_id);
                    setDairyCode(currentDairy?.code || "Not Set");
                }
            } catch (err) {
                console.error("Error fetching settings for dairy code:", err);
                setDairyCode("Not Set");
            }
        } catch (err) {
            setError(t('userManagement.messages.fetchError') || 'Failed to fetch users');
            console.error(err);
        } finally {
            setIsFetching(false);
        }
    };

    const resetForm = () => {
        setFormData({ username: '', email: '', role: 'employee', password: '', device_limit: 1 });
        setEditingUser(null);
        setError('');
        setSuccess('');
        setIsModalOpen(false);
        setShowPassword(false);
    };

    const handleOpenModal = (userToEdit = null) => {
        if (userToEdit) {
            setEditingUser(userToEdit);
            setFormData({
                username: userToEdit.username,
                email: userToEdit.email || '',
                role: userToEdit.role,
                password: '',
                device_limit: userToEdit.device_limit != null ? Number(userToEdit.device_limit) : (userToEdit.role === 'admin' ? 2 : 1)
            });
        } else {
            setEditingUser(null);
            setFormData({ username: '', email: '', role: 'employee', password: '', device_limit: 1 });
        }
        setIsModalOpen(true);
        setShowPassword(false);
        setError('');
        setSuccess('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setSuccess('');

        try {
            if (editingUser) {
                await updateUser({
                    id: editingUser.id,
                    role: formData.role,
                    username: formData.username,
                    device_limit: formData.device_limit != null ? Number(formData.device_limit) : 1
                }, user?.dairy_id);

                // If admin provided a new password, update it via RPC
                if (formData.password && formData.password.length >= 6) {
                    await supabase.rpc('set_employee_password', {
                        p_user_id: editingUser.id,
                        p_password: formData.password
                    });
                    setSuccess(`User "${formData.username}" updated & password changed successfully.`);
                } else {
                    setSuccess(t('userManagement.messages.updateSuccess') || 'User updated successfully');
                }
            } else {
                if (!formData.username) {
                    setError(t('userManagement.messages.requiredFields') || 'Username is required');
                    setIsLoading(false);
                    return;
                }
                if (!formData.password || formData.password.length < 6) {
                    setError('Password is required (min 6 characters)');
                    setIsLoading(false);
                    return;
                }

                const result = await addUser({
                    username: formData.username,
                    role: formData.role,
                    dairy_id: user?.dairy_id || 1,
                    device_limit: formData.device_limit != null ? Number(formData.device_limit) : 1
                });

                // Set the password via RPC
                if (result?.id) {
                    await supabase.rpc('set_employee_password', {
                        p_user_id: result.id,
                        p_password: formData.password
                    });
                }

                setSuccess(`User "${formData.username}" added! They can now log in with their username and the password you set.`);
            }

            fetchUsers();
            setTimeout(() => {
                resetForm();
            }, 1000);
        } catch (err) {
            console.error(err);
            setError(err.message || t('userManagement.messages.operationFailed') || 'Operation failed');
        } finally {
            setIsLoading(false);
        }
    };


    const handleDeleteClick = (userToDelete) => {
        setUserToDelete(userToDelete);
        setShowDeleteModal(true);
    };

    const handleDelete = async () => {
        if (!userToDelete) return;
        setIsDeleting(true);
        try {
            await deleteUser(userToDelete.id, user?.dairy_id);
            setShowDeleteModal(false);
            setUserToDelete(null);
            await fetchUsers();
        } catch (err) {
            console.error(err);
            setError(err.message || t('userManagement.messages.deleteError') || 'Failed to delete user');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleResetDevice = async (employee) => {
        const deviceCount = employee.device_id ? employee.device_id.split(',').filter(Boolean).length : 0;
        const isAdmin = employee.role === 'admin' || employee.role === 'super_admin';
        const confirmMsg = isAdmin
            ? `This will unbind ALL ${deviceCount} computer(s) from "${employee.username}". They can re-bind up to 2 new PCs on next login.`
            : `Are you sure you want to reset the device binding for "${employee.username}"? They will be able to log in on a new computer.`;

        const confirmed = await showConfirm(
            confirmMsg,
            'Reset Device Binding',
            'Yes, Reset All',
            'Cancel'
        );
        if (!confirmed) return;
        
        try {
            setIsLoading(true);
            await resetOperatorDevice(employee.id, user?.dairy_id);
            setSuccess(`All devices unbound for ${employee.username}. They can now log in on a new computer.`);
            fetchUsers();
        } catch (error) {
            console.error("Error resetting device:", error);
            setError("Failed to reset device binding.");
        } finally {
            setIsLoading(false);
        }
    };

    const stats = {
        total: users.length,
        admins: users.filter(u => u.role === 'admin').length,
        employees: users.filter(u => u.role === 'employee').length
    };

    const filteredUsers = users.filter(userItem => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        return (
            (userItem.username && userItem.username.toLowerCase().includes(searchLower)) ||
            (userItem.role && userItem.role.toLowerCase().includes(searchLower)) ||
            (userItem.dairy_name && userItem.dairy_name.toLowerCase().includes(searchLower))
        );
    });

    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentUsers = filteredUsers.slice(startIndex, endIndex);

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
            display: 'flex',
            flexDirection: 'column'
        }}>
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
                        color: '#0f172a',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        letterSpacing: '-0.5px'
                    }}>
                        <UserCog size={28} color="#4f46e5" />
                        {t('userManagement.title') || 'User Management'}
                    </h1>
                    <p style={{ fontSize: '16px', color: '#64748b', margin: 0, fontWeight: '500' }}>
                        {t('userManagement.subtitle') || 'Manage employees and admin users for your dairy'}
                    </p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    style={{
                        padding: '14px 28px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '14px',
                        fontSize: '16px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        boxShadow: '0 4px 14px rgba(102, 126, 234, 0.4)',
                        transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 14px rgba(102, 126, 234, 0.4)';
                    }}
                >
                    <Plus size={22} strokeWidth={2.5} />
                    {t('userManagement.buttons.addUser') || 'Add User'}
                </button>
            </div>

            {/* Statistics Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '20px',
                marginBottom: '32px'
            }}>
                <div style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    borderRadius: '16px',
                    padding: '24px',
                    color: 'white',
                    boxShadow: '0 4px 14px rgba(102, 126, 234, 0.3)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '14px', opacity: 0.9, fontWeight: '500' }}>Total Users</span>
                        <Users size={24} opacity={0.8} />
                    </div>
                    <div style={{ fontSize: '32px', fontWeight: '800', lineHeight: '1' }}>{stats.total}</div>
                </div>
                <div style={{
                    background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                    borderRadius: '16px',
                    padding: '24px',
                    color: 'white',
                    boxShadow: '0 4px 14px rgba(124, 58, 237, 0.3)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '14px', opacity: 0.9, fontWeight: '500' }}>Admins</span>
                        <Shield size={24} opacity={0.8} />
                    </div>
                    <div style={{ fontSize: '32px', fontWeight: '800', lineHeight: '1' }}>{stats.admins}</div>
                </div>
                <div style={{
                    background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                    borderRadius: '16px',
                    padding: '24px',
                    color: 'white',
                    boxShadow: '0 4px 14px rgba(5, 150, 105, 0.3)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '14px', opacity: 0.9, fontWeight: '500' }}>Employees</span>
                        <User size={24} opacity={0.8} />
                    </div>
                    <div style={{ fontSize: '32px', fontWeight: '800', lineHeight: '1' }}>{stats.employees}</div>
                </div>
            </div>

            {/* Dairy Code Banner */}
            {dairyCode && (
                <div style={{
                    background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                    border: '2px solid #fcd34d',
                    borderRadius: '16px',
                    padding: '20px 24px',
                    marginBottom: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        borderRadius: '12px',
                        padding: '14px',
                        color: 'white',
                        boxShadow: '0 2px 8px rgba(245, 158, 11, 0.4)'
                    }}>
                        <Key size={28} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', color: '#92400e', fontWeight: '700' }}>
                            Dairy Code: <span style={{ fontSize: '28px', marginLeft: '8px', letterSpacing: '2px' }}>{dairyCode}</span>
                        </h3>
                        <p style={{ margin: 0, color: '#b45309', fontSize: '14px', fontWeight: '500' }}>
                            Users will need this code along with their username to log in
                        </p>
                    </div>
                </div>
            )}

            {/* Search Bar */}
            <div style={{
                background: 'white',
                borderRadius: '16px',
                padding: '16px 20px',
                marginBottom: '24px',
                border: '2px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
            }}>
                <Search size={22} color="#64748b" />
                <input
                    type="text"
                    placeholder={t('userManagement.form.placeholder.search') || 'Search users by username or role...'}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                        flex: 1,
                        border: 'none',
                        outline: 'none',
                        fontSize: '16px',
                        background: 'transparent',
                        fontWeight: '500'
                    }}
                />
                {searchTerm && (
                    <button
                        onClick={() => setSearchTerm('')}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px',
                            color: '#64748b'
                        }}
                    >
                        <X size={18} />
                    </button>
                )}
            </div>

            {/* Users Table */}
            <div style={{
                background: 'white',
                borderRadius: '20px',
                overflow: 'hidden',
                border: '2px solid #e2e8f0',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}>
                {isFetching ? (
                    <div style={{ padding: '60px' }}><Loader /></div>
                ) : filteredUsers.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '80px 20px',
                        color: '#9ca3af'
                    }}>
                        <Users size={64} style={{ margin: '0 auto 24px', opacity: 0.3 }} />
                        <p style={{ fontSize: '20px', fontWeight: '600', margin: '0 0 8px 0', color: '#64748b' }}>
                            {searchTerm ? (t('userManagement.table.empty') || 'No users found') : (t('userManagement.table.emptyInit') || 'No users yet')}
                        </p>
                        <p style={{ fontSize: '15px', margin: 0, color: '#94a3b8' }}>
                            {searchTerm ? (t('userManagement.table.emptySearchHint') || 'Try adjusting your search') : (t('userManagement.table.emptyInitHint') || 'Click "Add User" to create your first user')}
                        </p>
                    </div>
                ) : (
                    <>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}>
                                    <th style={{
                                        padding: '18px 24px',
                                        textAlign: 'left',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        color: '#475569',
                                        letterSpacing: '0.5px',
                                        textTransform: 'uppercase',
                                        width: '30%'
                                    }}>{t('userManagement.table.username') || 'Username'}</th>
                                    <th style={{
                                        padding: '18px 24px',
                                        textAlign: 'left',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        color: '#475569',
                                        letterSpacing: '0.5px',
                                        textTransform: 'uppercase',
                                        width: '20%'
                                    }}>{t('userManagement.table.role') || 'Role'}</th>
                                    <th style={{
                                        padding: '18px 24px',
                                        textAlign: 'left',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        color: '#475569',
                                        letterSpacing: '0.5px',
                                        textTransform: 'uppercase',
                                        width: '25%'
                                    }}>Status & Devices</th>
                                    <th style={{
                                        padding: '18px 24px',
                                        textAlign: 'center',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        color: '#475569',
                                        letterSpacing: '0.5px',
                                        textTransform: 'uppercase',
                                        width: '25%'
                                    }}>{t('userManagement.table.actions') || 'Actions'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentUsers.map((userItem, index) => (
                                    <tr key={userItem.id} style={{
                                        borderBottom: '1px solid #f1f5f9',
                                        background: index % 2 === 0 ? 'white' : '#fafbfc',
                                        transition: 'background 0.2s'
                                    }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = '#f8fafc';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = index % 2 === 0 ? 'white' : '#fafbfc';
                                        }}>
                                        <td style={{ padding: '20px 24px', fontSize: '16px', fontWeight: '600', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '14px' }}>
                                            <div style={{
                                                width: '48px',
                                                height: '48px',
                                                borderRadius: '12px',
                                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                color: 'white',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '16px',
                                                fontWeight: '700',
                                                textTransform: 'uppercase',
                                                boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
                                            }}>
                                                {userItem.username.substring(0, 2)}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: '600', color: '#0f172a' }}>{userItem.username}</div>
                                                {userItem.dairy_name && (
                                                    <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>{userItem.dairy_name}</div>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ padding: '20px 24px' }}>
                                            <span style={{
                                                padding: '8px 16px',
                                                borderRadius: '20px',
                                                fontSize: '13px',
                                                fontWeight: '600',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                ...(userItem.role === 'admin' || userItem.role === 'super_admin'
                                                    ? {
                                                        background: 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)',
                                                        color: '#7c3aed',
                                                        border: '2px solid #e9d5ff',
                                                        boxShadow: '0 2px 4px rgba(124, 58, 237, 0.1)'
                                                    }
                                                    : {
                                                        background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
                                                        color: '#059669',
                                                        border: '2px solid #a7f3d0',
                                                        boxShadow: '0 2px 4px rgba(5, 150, 105, 0.1)'
                                                    })
                                            }}>
                                                {userItem.role === 'admin' ? <Shield size={16} /> : <User size={16} />}
                                                {userItem.role === 'admin' ? (t('userManagement.form.admin') || 'Admin') : (t('userManagement.form.employee') || 'Employee')}
                                            </span>
                                        </td>
                                        <td style={{ padding: '20px 24px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <span style={{
                                                    padding: '4px 8px',
                                                    borderRadius: '8px',
                                                    fontSize: '12px',
                                                    fontWeight: '600',
                                                    background: '#dcfce7',
                                                    color: '#166534',
                                                    border: '1px solid #bbf7d0',
                                                    alignSelf: 'flex-start'
                                                }}>
                                                    <Activity size={10} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                                                    Active
                                                </span>
                                                <div style={{ fontSize: '13px', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <span style={{ fontWeight: '600' }}>Devices:</span>
                                                    <span>
                                                        {userItem.device_id ? userItem.device_id.split(',').filter(Boolean).length : 0} / {userItem.device_limit != null ? userItem.device_limit : (userItem.role === 'admin' || userItem.role === 'super_admin' ? 2 : 1)}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '20px 24px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                                                <button
                                                    onClick={() => handleOpenModal(userItem)}
                                                    title={t('userManagement.buttons.edit') || 'Edit User'}
                                                    style={{
                                                        padding: '10px 18px',
                                                        background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                                                        border: 'none',
                                                        borderRadius: '10px',
                                                        cursor: 'pointer',
                                                        color: '#475569',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        fontSize: '14px',
                                                        fontWeight: '600',
                                                        transition: 'all 0.2s',
                                                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.background = 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)';
                                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.background = 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)';
                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                    }}
                                                >
                                                    <Edit size={16} />
                                                    {t('userManagement.buttons.edit') || 'Edit'}
                                                </button>
                                                {userItem.role !== 'admin' && userItem.role !== 'super_admin' && (
                                                    <>
                                                        {/* Delete Button */}
                                                        <button
                                                            onClick={() => handleDeleteClick(userItem)}
                                                            title={t('userManagement.buttons.delete') || 'Delete User'}
                                                            style={{
                                                                padding: '10px 18px',
                                                                background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                                                                border: 'none',
                                                                borderRadius: '10px',
                                                                cursor: 'pointer',
                                                                color: '#dc2626',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '8px',
                                                                fontSize: '14px',
                                                                fontWeight: '600',
                                                                transition: 'all 0.2s',
                                                                boxShadow: '0 1px 3px rgba(220, 38, 38, 0.2)'
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                e.currentTarget.style.background = 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)';
                                                                e.currentTarget.style.transform = 'translateY(-1px)';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.currentTarget.style.background = 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)';
                                                                e.currentTarget.style.transform = 'translateY(0)';
                                                            }}
                                                        >
                                                            <Trash2 size={16} />
                                                            {t('userManagement.buttons.delete') || 'Delete'}
                                                        </button>
                                                    </>
                                                )}
                                                {userItem.device_id && userItem.role !== 'super_admin' && (
                                                    <button
                                                        onClick={() => handleResetDevice(userItem)}
                                                        title="Unlock Device(s)"
                                                        style={{
                                                            padding: '10px 18px',
                                                            background: '#eff6ff',
                                                            border: 'none',
                                                            borderRadius: '10px',
                                                            cursor: 'pointer',
                                                            color: '#2563eb',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '8px',
                                                            fontSize: '14px',
                                                            fontWeight: '600',
                                                            transition: 'all 0.2s',
                                                            boxShadow: '0 1px 3px rgba(37, 99, 235, 0.2)'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.background = '#dbeafe';
                                                            e.currentTarget.style.transform = 'translateY(-1px)';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.background = '#eff6ff';
                                                            e.currentTarget.style.transform = 'translateY(0)';
                                                        }}
                                                    >
                                                        <Unlock size={16} />
                                                        Unlock {userItem.device_id.split(',').filter(Boolean).length > 1
                                                            ? `${userItem.device_id.split(',').filter(Boolean).length} Devices`
                                                            : 'Device'}
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
                                padding: '24px',
                                borderTop: '2px solid #f1f5f9',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: 'linear-gradient(135deg, #fafbfc 0%, #f8fafc 100%)'
                            }}>
                                <p style={{ fontSize: '15px', color: '#64748b', margin: 0, fontWeight: '500' }}>
                                    Showing {startIndex + 1} - {Math.min(endIndex, filteredUsers.length)} of {filteredUsers.length} users
                                </p>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        disabled={currentPage === 1}
                                        style={{
                                            padding: '10px 18px',
                                            background: currentPage === 1 ? '#f1f5f9' : 'white',
                                            border: '2px solid #e2e8f0',
                                            borderRadius: '10px',
                                            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                            fontSize: '14px',
                                            fontWeight: '600',
                                            color: currentPage === 1 ? '#94a3b8' : '#475569',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        Previous
                                    </button>
                                    {[...Array(totalPages)].map((_, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setCurrentPage(i + 1)}
                                            style={{
                                                padding: '10px 16px',
                                                background: currentPage === i + 1
                                                    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                                    : 'white',
                                                border: currentPage === i + 1 ? 'none' : '2px solid #e2e8f0',
                                                borderRadius: '10px',
                                                cursor: 'pointer',
                                                fontSize: '14px',
                                                fontWeight: '600',
                                                color: currentPage === i + 1 ? 'white' : '#475569',
                                                minWidth: '44px',
                                                transition: 'all 0.2s',
                                                boxShadow: currentPage === i + 1 ? '0 2px 8px rgba(102, 126, 234, 0.3)' : 'none'
                                            }}
                                        >
                                            {i + 1}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                        disabled={currentPage === totalPages}
                                        style={{
                                            padding: '10px 18px',
                                            background: currentPage === totalPages ? '#f1f5f9' : 'white',
                                            border: '2px solid #e2e8f0',
                                            borderRadius: '10px',
                                            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                            fontSize: '14px',
                                            fontWeight: '600',
                                            color: currentPage === totalPages ? '#94a3b8' : '#475569',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(6px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: 'white',
                        borderRadius: '24px',
                        width: '90%',
                        maxWidth: '560px',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        animation: 'slideUp 0.3s ease-out'
                    }}>
                        <style>{`
                            @keyframes slideUp {
                                from {
                                    opacity: 0;
                                    transform: translateY(20px);
                                }
                                to {
                                    opacity: 1;
                                    transform: translateY(0);
                                }
                            }
                        `}</style>
                        {/* Modal Header */}
                        <div style={{
                            padding: '28px',
                            borderBottom: '2px solid #f1f5f9',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'linear-gradient(135deg, #fafbfc 0%, #ffffff 100%)'
                        }}>
                            <h2 style={{
                                fontSize: '24px',
                                fontWeight: '700',
                                margin: 0,
                                color: '#0f172a',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px'
                            }}>
                                <UserCog size={28} color="#667eea" />
                                {editingUser ? (t('userManagement.form.editUser') || 'Edit User') : (t('userManagement.form.addNewUser') || 'Add New User')}
                            </h2>
                            <button
                                onClick={resetForm}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#64748b',
                                    padding: '6px',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#f1f5f9';
                                    e.currentTarget.style.color = '#475569';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'none';
                                    e.currentTarget.style.color = '#64748b';
                                }}
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSubmit} style={{ padding: '28px' }}>
                            {error && (
                                <div style={{
                                    marginBottom: '20px',
                                    padding: '14px 18px',
                                    background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                                    color: '#dc2626',
                                    borderRadius: '12px',
                                    fontSize: '14px',
                                    border: '2px solid #fecaca',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    fontWeight: '500'
                                }}>
                                    <TriangleAlert size={20} />
                                    {error}
                                </div>
                            )}

                            {success && (
                                <div style={{
                                    marginBottom: '20px',
                                    padding: '14px 18px',
                                    background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
                                    color: '#166534',
                                    borderRadius: '12px',
                                    fontSize: '14px',
                                    border: '2px solid #86efac',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    fontWeight: '500'
                                }}>
                                    <Check size={20} />
                                    {success}
                                </div>
                            )}

                            <div style={{ marginBottom: '24px' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '15px',
                                    fontWeight: '600',
                                    color: '#0f172a',
                                    marginBottom: '10px'
                                }}>
                                    {t('userManagement.form.username') || 'Username'} *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '14px 18px',
                                        borderRadius: '12px',
                                        border: '2px solid #e2e8f0',
                                        fontSize: '16px',
                                        outline: 'none',
                                        transition: 'all 0.2s',
                                        fontWeight: '500'
                                    }}
                                    onFocus={(e) => {
                                        e.currentTarget.style.borderColor = '#667eea';
                                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                                    }}
                                    onBlur={(e) => {
                                        e.currentTarget.style.borderColor = '#e2e8f0';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                    placeholder={t('userManagement.form.placeholder.username') || 'Enter username'}
                                />
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '15px',
                                    fontWeight: '600',
                                    color: '#0f172a',
                                    marginBottom: '10px'
                                }}>
                                    Email Address (Optional)
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '14px 18px',
                                        borderRadius: '12px',
                                        border: '2px solid #e2e8f0',
                                        fontSize: '16px',
                                        outline: 'none',
                                        transition: 'all 0.2s',
                                        fontWeight: '500'
                                    }}
                                    onFocus={(e) => {
                                        e.currentTarget.style.borderColor = '#667eea';
                                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                                    }}
                                    onBlur={(e) => {
                                        e.currentTarget.style.borderColor = '#e2e8f0';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                    placeholder="Enter registered email address"
                                />
                            </div>

                            {/* Password Field */}
                            <div style={{ marginBottom: '24px' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '15px',
                                    fontWeight: '600',
                                    color: '#0f172a',
                                    marginBottom: '10px'
                                }}>
                                    🔑 {editingUser ? 'पासवर्ड बदला (Change Password)' : 'पासवर्ड सेट करा (Set Password) *'}
                                </label>
                                <input
                                    type="text"
                                    required={!editingUser}
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    placeholder={editingUser ? 'रिक्त ठेवा म्हणजे बदल नाही (Leave blank to keep current)' : 'किमान 6 अक्षरे (Min 6 characters)'}
                                    minLength={formData.password ? 6 : undefined}
                                    style={{
                                        width: '100%',
                                        padding: '14px 18px',
                                        borderRadius: '12px',
                                        border: editingUser ? '2px solid #e2e8f0' : '2px solid #667eea',
                                        fontSize: '16px',
                                        outline: 'none',
                                        transition: 'all 0.2s',
                                        fontWeight: '500',
                                        background: editingUser ? 'white' : '#f0f4ff'
                                    }}
                                    onFocus={(e) => {
                                        e.currentTarget.style.borderColor = '#667eea';
                                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                                    }}
                                    onBlur={(e) => {
                                        e.currentTarget.style.borderColor = editingUser ? '#e2e8f0' : '#667eea';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                />
                                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                                    {editingUser
                                        ? '📝 नवीन पासवर्ड टाका किंवा रिक्त ठेवा. (Enter new password or leave blank.)'
                                        : '📱 या पासवर्डने वापरकर्ता लॉगिन करेल. (User will login with this password.)'
                                    }
                                </p>
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '15px',
                                    fontWeight: '600',
                                    color: '#0f172a',
                                    marginBottom: '10px'
                                }}>
                                    💻 Device Limit (कम्प्युटर मर्यादा) *
                                </label>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    max="10"
                                    value={formData.device_limit || 1}
                                    onChange={(e) => setFormData({ ...formData, device_limit: Math.max(1, parseInt(e.target.value) || 1) })}
                                    style={{
                                        width: '100%',
                                        padding: '14px 18px',
                                        borderRadius: '12px',
                                        border: '2px solid #e2e8f0',
                                        fontSize: '16px',
                                        outline: 'none',
                                        transition: 'all 0.2s',
                                        fontWeight: '500'
                                    }}
                                    onFocus={(e) => {
                                        e.currentTarget.style.borderColor = '#667eea';
                                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                                    }}
                                    onBlur={(e) => {
                                        e.currentTarget.style.borderColor = '#e2e8f0';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                    placeholder="Enter device limit"
                                />
                                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                                    📱 या वापरकर्त्यासाठी जास्तीत जास्त किती उपकरणांवरून लॉगिन करण्याची परवानगी आहे ते सेट करा. (Set the maximum number of devices this user can log in from.)
                                </p>
                            </div>

                            <div style={{ marginBottom: '28px' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '15px',
                                    fontWeight: '600',
                                    color: '#0f172a',
                                    marginBottom: '14px'
                                }}>
                                    {t('userManagement.form.role') || 'Role'} *
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                                    <button
                                        type="button"
                                        disabled={(!editingUser && users.some(u => u.role === 'admin')) || (editingUser && editingUser.role !== 'admin' && users.some(u => u.role === 'admin'))}
                                        onClick={() => setFormData({ ...formData, role: 'admin', device_limit: formData.device_limit === 1 ? 2 : formData.device_limit })}
                                        style={{
                                            padding: '20px',
                                            borderRadius: '14px',
                                            border: formData.role === 'admin' ? '3px solid #7c3aed' : '2px solid #e2e8f0',
                                            background: formData.role === 'admin' ? 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)' : (((!editingUser && users.some(u => u.role === 'admin')) || (editingUser && editingUser.role !== 'admin' && users.some(u => u.role === 'admin'))) ? '#f8fafc' : 'white'),
                                            cursor: ((!editingUser && users.some(u => u.role === 'admin')) || (editingUser && editingUser.role !== 'admin' && users.some(u => u.role === 'admin'))) ? 'not-allowed' : 'pointer',
                                            opacity: ((!editingUser && users.some(u => u.role === 'admin')) || (editingUser && editingUser.role !== 'admin' && users.some(u => u.role === 'admin'))) ? 0.6 : 1,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '10px',
                                            transition: 'all 0.2s',
                                            ...(formData.role === 'admin' && {
                                                boxShadow: '0 4px 14px rgba(124, 58, 237, 0.2)'
                                            })
                                        }}
                                    >
                                        <Shield size={28} color={formData.role === 'admin' ? '#7c3aed' : '#94a3b8'} />
                                        <span style={{
                                            fontSize: '16px',
                                            fontWeight: '600',
                                            color: formData.role === 'admin' ? '#7c3aed' : '#64748b'
                                        }}>
                                            {t('userManagement.form.admin') || 'Admin'}
                                        </span>
                                        {formData.role === 'admin' && (
                                            <Check size={20} color="#7c3aed" />
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        disabled={editingUser && editingUser.role === 'admin'}
                                        onClick={() => setFormData({ ...formData, role: 'employee', device_limit: formData.device_limit === 2 ? 1 : formData.device_limit })}
                                        style={{
                                            padding: '20px',
                                            borderRadius: '14px',
                                            border: formData.role === 'employee' ? '3px solid #059669' : '2px solid #e2e8f0',
                                            background: formData.role === 'employee' ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)' : ((editingUser && editingUser.role === 'admin') ? '#f8fafc' : 'white'),
                                            cursor: (editingUser && editingUser.role === 'admin') ? 'not-allowed' : 'pointer',
                                            opacity: (editingUser && editingUser.role === 'admin') ? 0.6 : 1,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '10px',
                                            transition: 'all 0.2s',
                                            ...(formData.role === 'employee' && {
                                                boxShadow: '0 4px 14px rgba(5, 150, 105, 0.2)'
                                            })
                                        }}
                                    >
                                        <User size={28} color={formData.role === 'employee' ? '#059669' : '#94a3b8'} />
                                        <span style={{
                                            fontSize: '16px',
                                            fontWeight: '600',
                                            color: formData.role === 'employee' ? '#059669' : '#64748b'
                                        }}>
                                            {t('userManagement.form.employee') || 'Employee'}
                                        </span>
                                        {formData.role === 'employee' && (
                                            <Check size={20} color="#059669" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Form Actions */}
                            <div style={{ display: 'flex', gap: '14px', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    style={{
                                        padding: '14px 28px',
                                        background: '#f1f5f9',
                                        color: '#475569',
                                        border: 'none',
                                        borderRadius: '12px',
                                        fontSize: '15px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = '#e2e8f0';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = '#f1f5f9';
                                    }}
                                >
                                    {t('userManagement.buttons.cancel') || 'Cancel'}
                                </button>
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    style={{
                                        padding: '14px 28px',
                                        background: isLoading ? '#94a3b8' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '12px',
                                        fontSize: '15px',
                                        fontWeight: '600',
                                        cursor: isLoading ? 'not-allowed' : 'pointer',
                                        boxShadow: isLoading ? 'none' : '0 4px 14px rgba(102, 126, 234, 0.4)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {isLoading ? (t('userManagement.buttons.saving') || 'Saving...') : (editingUser ? (t('userManagement.buttons.update') || 'Update User') : (t('userManagement.buttons.create') || 'Create User'))}
                                    {!isLoading && <Check size={18} />}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && userToDelete && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(6px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: 'white',
                        borderRadius: '24px',
                        width: '90%',
                        maxWidth: '480px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                    }}>
                        {/* Modal Header */}
                        <div style={{
                            padding: '24px',
                            borderBottom: '2px solid #f1f5f9',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <h2 style={{
                                fontSize: '22px',
                                fontWeight: '700',
                                margin: 0,
                                color: '#dc2626',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px'
                            }}>
                                <TriangleAlert size={26} />
                                {t('userManagement.deleteModal.title') || 'Delete User'}
                            </h2>
                            <button
                                onClick={() => { setShowDeleteModal(false); setUserToDelete(null); }}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#64748b',
                                    padding: '6px',
                                    borderRadius: '8px'
                                }}
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div style={{ padding: '24px' }}>
                            <p style={{ fontSize: '16px', color: '#475569', marginBottom: '16px', lineHeight: '1.6', fontWeight: '500' }}>
                                {t('userManagement.deleteModal.confirm') || 'Are you sure you want to delete'} <strong style={{ color: '#0f172a' }}>{userToDelete.username}</strong>?
                            </p>
                            <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '24px', lineHeight: '1.6' }}>
                                {t('userManagement.deleteModal.warning') || 'This action cannot be undone. The user will lose access immediately.'}
                            </p>

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => { setShowDeleteModal(false); setUserToDelete(null); }}
                                    disabled={isDeleting}
                                    style={{
                                        padding: '12px 24px',
                                        background: '#f1f5f9',
                                        color: '#475569',
                                        border: 'none',
                                        borderRadius: '10px',
                                        fontSize: '15px',
                                        fontWeight: '600',
                                        cursor: isDeleting ? 'not-allowed' : 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {t('userManagement.buttons.cancel') || 'Cancel'}
                                </button>
                                <button
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                    style={{
                                        padding: '12px 24px',
                                        background: isDeleting ? '#94a3b8' : '#dc2626',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '10px',
                                        fontSize: '15px',
                                        fontWeight: '600',
                                        cursor: isDeleting ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        transition: 'all 0.2s',
                                        boxShadow: isDeleting ? 'none' : '0 4px 14px rgba(220, 38, 38, 0.3)'
                                    }}
                                >
                                    {isDeleting ? (t('userManagement.buttons.deleting') || 'Deleting...') : (t('userManagement.buttons.deleteUser') || 'Delete User')}
                                    {!isDeleting && <Trash2 size={18} />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <AlertComponent />

        </div>
    );
}
