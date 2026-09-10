import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Plus, Search, Edit2, Trash2, UserPlus } from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useAlert } from "../hooks/useAlert";

const ManageCustomers = ({ user }) => {
    const { t } = useTranslation();
    const { showConfirm, AlertComponent } = useAlert();
    const dairyIdx = user?.dairy_id;
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);

    const [formData, setFormData] = useState({
        name: "",
        mobile: "",
        billing_cycle: "immediate",
    });

    useEffect(() => {
        if (dairyIdx) fetchCustomers();
    }, [dairyIdx]);

    const fetchCustomers = async () => {
        setLoading(true);
        try {
            let { data, error } = await supabase
                .from("local_sale_customers")
                .select("id, name, mobile, customer_number, billing_cycle")
                .eq("dairy_id", dairyIdx)
                .order("name", { ascending: true });

            if (error && error.code === 'PGRST204') {
                const fallback = await supabase
                    .from("local_sale_customers")
                    .select("id, name, mobile, billing_cycle")
                    .eq("dairy_id", dairyIdx)
                    .order("name", { ascending: true });
                data = fallback.data;
                error = fallback.error;
            }

            if (error) throw error;
            setCustomers(data || []);
        } catch (error) {
            console.error("Error fetching customers:", error);
            toast.error("Failed to fetch customers");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingCustomer) {
                const { error } = await supabase
                    .from("local_sale_customers")
                    .update({
                        name: formData.name,
                        mobile: formData.mobile,
                        billing_cycle: formData.billing_cycle
                    })
                    .eq("id", editingCustomer.id);
                if (error) throw error;
                toast.success(t('manageCustomers.messages.updateSuccess'));
            } else {
                // Fetch max customer_number for this dairy
                const { data: maxCust, error: maxCodeError } = await supabase
                    .from("local_sale_customers")
                    .select("customer_number")
                    .eq("dairy_id", dairyIdx)
                    .order("customer_number", { ascending: false })
                    .limit(1)
                    .maybeSingle();

                const isMissingColumn = maxCodeError && maxCodeError.code === 'PGRST204';

                let nextNum = 1;
                if (maxCust && maxCust.customer_number) {
                    nextNum = maxCust.customer_number + 1;
                }

                const insertData = {
                    dairy_id: dairyIdx,
                    name: formData.name,
                    mobile: formData.mobile,
                    billing_cycle: formData.billing_cycle,
                    is_active: true
                };

                if (!isMissingColumn) {
                    insertData.customer_number = nextNum;
                }

                const { error } = await supabase
                    .from("local_sale_customers")
                    .insert([insertData]);
                if (error) throw error;
                toast.success(t('manageCustomers.messages.saveSuccess'));
            }
            setIsModalOpen(false);
            resetForm();
            fetchCustomers();
        } catch (error) {
            console.error("Error saving customer:", error);
            toast.error(t('manageCustomers.messages.saveError') + ": " + (error.message || "Unknown error"));
        }
    };



    const handleDelete = async (id) => {
        const confirmed = await showConfirm(t('manageCustomers.messages.confirmDelete'), t('manageCustomers.title'), t('common.delete', { defaultValue: 'Delete' }), t('common.cancel', { defaultValue: 'Cancel' }));
        if (!confirmed) return;
        try {
            const { error } = await supabase
                .from("local_sale_customers")
                .delete()
                .eq("id", id);

            if (error) throw error;
            toast.success(t('manageCustomers.messages.deleteSuccess'));
            fetchCustomers();
        } catch (error) {
            console.error("Error deleting customer:", error);
            toast.error(t('manageCustomers.messages.deleteError'));
        }
    };

    const resetForm = () => {
        setFormData({ name: "", mobile: "", billing_cycle: "immediate" });
        setEditingCustomer(null);
    };

    const openEditModal = (customer) => {
        setEditingCustomer(customer);
        setFormData({ 
            name: customer.name, 
            mobile: customer.mobile || "", 
            billing_cycle: customer.billing_cycle || "immediate" 
        });
        setIsModalOpen(true);
    };

    const filteredCustomers = customers.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.mobile && c.mobile.includes(searchTerm)) ||
            String(c.customer_number || c.id).includes(searchTerm.trim()); // Search by customer_number or id
        return matchesSearch;
    });

    return (
        <div style={{ padding: '16px 32px', maxWidth: '1600px', margin: '0 auto', background: 'transparent', minHeight: '100%' }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                gap: '24px',
                paddingBottom: '12px',
                borderBottom: '1px solid #f1f5f9'
            }}>
                <h1 style={{
                    fontSize: '28px',
                    fontWeight: '800',
                    color: '#111827',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    margin: 0
                }}>
                    <UserPlus size={28} />
                    {t('manageCustomers.title')}
                </h1>
                {/* Search and Add Button Controls should probably be here or below */}
                <button
                    onClick={() => { resetForm(); setIsModalOpen(true); }}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        backgroundColor: '#4f46e5',
                        color: 'white',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '15px',
                        fontWeight: '600',
                        boxShadow: '0 2px 4px rgba(79, 70, 229, 0.2)',
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4338ca'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4f46e5'}
                >
                    <Plus size={20} />
                    <span>{t('manageCustomers.addCustomer')}</span>
                </button>
            </div>

            <div style={{ marginBottom: '24px', position: 'relative' }}>
                <div style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    color: '#9ca3af'
                }}>
                    <Search size={20} />
                </div>
                <input
                    type="text"
                    placeholder={t('manageCustomers.searchPlaceholder')}
                    style={{
                        width: '100%',
                        paddingLeft: '40px',
                        paddingRight: '16px',
                        paddingTop: '10px',
                        paddingBottom: '10px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        outline: 'none',
                        fontSize: '15px',
                        transition: 'all 0.2s',
                        backgroundColor: 'white'
                    }}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#4f46e5';
                        e.currentTarget.style.boxShadow = '0 0 0 3px #eef2ff';
                    }}
                    onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#d1d5db';
                        e.currentTarget.style.boxShadow = 'none';
                    }}
                />
            </div>

            {loading ? (
                <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    ID
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    {t('manageCustomers.table.name')}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    {t('manageCustomers.table.mobile')}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    {t('billingCycle.label', 'Billing Cycle')}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    {t('manageCustomers.table.actions')}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredCustomers.length > 0 ? (
                                filteredCustomers.map((customer) => (
                                    <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">#{customer.customer_number || customer.id}</td>
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{customer.name}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{customer.mobile || "-"}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {customer.billing_cycle === '10_days' ? t('billingCycle.10days', '10 Days') : 
                                             customer.billing_cycle === '30_days' ? t('billingCycle.30days', '30 Days') : 
                                             t('billingCycle.immediate', 'Immediate Cash')}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={() => openEditModal(customer)}
                                                    style={{
                                                        backgroundColor: '#dbeafe',
                                                        color: '#1e40af',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        padding: '6px 12px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        fontSize: '13px',
                                                        fontWeight: '500',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    title={t('manageCustomers.modal.editTitle')}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.backgroundColor = '#bfdbfe';
                                                        e.currentTarget.style.transform = 'scale(1.05)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.backgroundColor = '#dbeafe';
                                                        e.currentTarget.style.transform = 'scale(1)';
                                                    }}
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(customer.id)}
                                                    style={{
                                                        backgroundColor: '#fee2e2',
                                                        color: '#991b1b',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        padding: '6px 12px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        fontSize: '13px',
                                                        fontWeight: '500',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    title="Delete"
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.backgroundColor = '#fecaca';
                                                        e.currentTarget.style.transform = 'scale(1.05)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.backgroundColor = '#fee2e2';
                                                        e.currentTarget.style.transform = 'scale(1)';
                                                    }}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                            <div className="bg-gray-100 p-3 rounded-full">
                                                <Search size={24} className="text-gray-400" />
                                            </div>
                                            <div className="text-base font-medium text-gray-900">
                                                {t('manageCustomers.table.noCustomers')}
                                            </div>
                                            <p className="text-sm text-gray-500 max-w-xs mx-auto">
                                                {searchTerm ? t('manageCustomers.table.noSearchResults') : t('manageCustomers.table.emptyDescription')}
                                            </p>
                                            {!searchTerm && (
                                                <button
                                                    onClick={() => { resetForm(); setIsModalOpen(true); }}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        backgroundColor: '#4f46e5',
                                                        color: 'white',
                                                        padding: '10px 24px',
                                                        borderRadius: '8px',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        fontSize: '15px',
                                                        fontWeight: '600',
                                                        boxShadow: '0 2px 4px rgba(79, 70, 229, 0.2)',
                                                        transition: 'all 0.2s',
                                                        marginTop: '16px'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.backgroundColor = '#4338ca';
                                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.backgroundColor = '#4f46e5';
                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                    }}
                                                >
                                                    <Plus size={18} />
                                                    {t('manageCustomers.modal.addTitle')}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal - Enhanced Premium Design */}
            {isModalOpen && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px',
                    zIndex: 50
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '16px',
                        width: '100%',
                        maxWidth: '480px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        overflow: 'hidden'
                    }}>
                        {/* Modal Header with Gradient */}
                        <div style={{
                            background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                            padding: '24px',
                            color: 'white'
                        }}>
                            <h2 style={{
                                fontSize: '22px',
                                fontWeight: '700',
                                margin: 0,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px'
                            }}>
                                {editingCustomer ? <Edit2 size={24} /> : <Plus size={24} />}
                                {editingCustomer ? t('manageCustomers.modal.editTitle') : t('manageCustomers.modal.addTitle')}
                                {!editingCustomer && <span style={{ fontSize: '14px', opacity: 0.8, marginLeft: '8px', fontWeight: 'normal' }}>(ID Auto-Assigned)</span>}
                            </h2>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
                            {/* Name Field */}
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: '#374151',
                                    marginBottom: '8px'
                                }}>
                                    {t('manageCustomers.modal.labels.name')}
                                </label>
                                <input
                                    type="text"
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: '10px',
                                        outline: 'none',
                                        fontSize: '15px',
                                        transition: 'all 0.2s',
                                        backgroundColor: '#f9fafb'
                                    }}
                                    placeholder={t('manageCustomers.modal.placeholders.name')}
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    onFocus={(e) => {
                                        e.currentTarget.style.borderColor = '#4f46e5';
                                        e.currentTarget.style.backgroundColor = 'white';
                                        e.currentTarget.style.boxShadow = '0 0 0 3px #eef2ff';
                                    }}
                                    onBlur={(e) => {
                                        e.currentTarget.style.borderColor = '#e5e7eb';
                                        e.currentTarget.style.backgroundColor = '#f9fafb';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                />
                            </div>

                            {/* Mobile Field */}
                            <div style={{ marginBottom: '24px' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: '#374151',
                                    marginBottom: '8px'
                                }}>
                                    {t('manageCustomers.modal.labels.mobile')}
                                </label>
                                <input
                                    type="tel"
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: '10px',
                                        outline: 'none',
                                        fontSize: '15px',
                                        transition: 'all 0.2s',
                                        backgroundColor: '#f9fafb'
                                    }}
                                    placeholder={t('manageCustomers.modal.placeholders.mobile')}
                                    value={formData.mobile}
                                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                                    onFocus={(e) => {
                                        e.currentTarget.style.borderColor = '#4f46e5';
                                        e.currentTarget.style.backgroundColor = 'white';
                                        e.currentTarget.style.boxShadow = '0 0 0 3px #eef2ff';
                                    }}
                                    onBlur={(e) => {
                                        e.currentTarget.style.borderColor = '#e5e7eb';
                                        e.currentTarget.style.backgroundColor = '#f9fafb';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                />
                            </div>
 
                            {/* Billing Cycle Field */}
                            <div style={{ marginBottom: '24px' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: '#374151',
                                    marginBottom: '8px'
                                }}>
                                    {t('billingCycle.label', 'Billing Cycle')}
                                </label>
                                <select
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: '10px',
                                        outline: 'none',
                                        fontSize: '15px',
                                        transition: 'all 0.2s',
                                        backgroundColor: '#f9fafb'
                                    }}
                                    value={formData.billing_cycle}
                                    onChange={(e) => setFormData({ ...formData, billing_cycle: e.target.value })}
                                    onFocus={(e) => {
                                        e.currentTarget.style.borderColor = '#4f46e5';
                                        e.currentTarget.style.backgroundColor = 'white';
                                        e.currentTarget.style.boxShadow = '0 0 0 3px #eef2ff';
                                    }}
                                    onBlur={(e) => {
                                        e.currentTarget.style.borderColor = '#e5e7eb';
                                        e.currentTarget.style.backgroundColor = '#f9fafb';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                >
                                    <option value="immediate">{t('billingCycle.immediate', 'Immediate Cash')}</option>
                                    <option value="10_days">{t('billingCycle.10days', '10 Days')}</option>
                                    <option value="30_days">{t('billingCycle.30days', '30 Days')}</option>
                                </select>
                            </div>

                            {/* Action Buttons */}
                            <div style={{
                                display: 'flex',
                                gap: '12px',
                                marginTop: '24px'
                            }}>
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    style={{
                                        flex: 1,
                                        padding: '12px 24px',
                                        backgroundColor: '#f3f4f6',
                                        color: '#374151',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: '10px',
                                        cursor: 'pointer',
                                        fontSize: '15px',
                                        fontWeight: '600',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = '#e5e7eb';
                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = '#f3f4f6';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                    }}
                                >
                                    {t('manageCustomers.modal.buttons.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    style={{
                                        flex: 1,
                                        padding: '12px 24px',
                                        background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '10px',
                                        cursor: 'pointer',
                                        fontSize: '15px',
                                        fontWeight: '600',
                                        boxShadow: '0 4px 12px rgba(79, 70, 229, 0.4)',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(79, 70, 229, 0.5)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(79, 70, 229, 0.4)';
                                    }}
                                >
                                    {editingCustomer ? t('manageCustomers.modal.buttons.update') : t('manageCustomers.modal.buttons.save')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <AlertComponent />
        </div>
    );
};

export default ManageCustomers;
