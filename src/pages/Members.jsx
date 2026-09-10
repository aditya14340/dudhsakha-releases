import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Search, FileText, Download, X, Calendar, TrendingUp, IndianRupee, Droplets } from 'lucide-react';
import Loader from '../components/Loader';
import { useAlert } from '../hooks/useAlert';
import { getFarmers, getMemberStats } from '../lib/api';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import autoTable from 'jspdf-autotable';

function Members({ user }) {
    const { t } = useTranslation();
    const { showAlert, AlertComponent } = useAlert();
    const [members, setMembers] = useState([]);
    const reportRef = useRef();
    const listReportRef = useRef();
    const [isDownloading, setIsDownloading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'member', 'non_member'

    // Stats Modal
    const [selectedMember, setSelectedMember] = useState(null);
    const [memberStats, setMemberStats] = useState(null);
    const [loadingStats, setLoadingStats] = useState(false);
    const [showStatsModal, setShowStatsModal] = useState(false);

    useEffect(() => {
        if (user?.dairy_id) {
            loadMembers();
        }
    }, [user?.dairy_id]);

    const loadMembers = async () => {
        try {
            setLoading(true);
            const allFarmers = await getFarmers(user?.dairy_id);
            const activeFarmers = allFarmers.filter(f => !f.is_deleted);
            setMembers(activeFarmers);
        } catch (error) {
            console.error("Error loading members:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleViewStats = async (member) => {
        setSelectedMember(member);
        setShowStatsModal(true);
        setLoadingStats(true);
        setMemberStats(null);
        try {
            const stats = await getMemberStats(member.id, user?.dairy_id);
            setMemberStats(stats);
        } catch (error) {
            console.error("Error loading stats:", error);
        } finally {
            setLoadingStats(false);
        }
    };

    const filteredMembers = members.filter(m => {
        const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.code.toString().includes(searchTerm) ||
            (m.phone && m.phone.includes(searchTerm));

        const isMember = m.is_member !== false; // true or undefined/null derived from DB default

        let matchesFilter = true;
        if (filterStatus === 'member') matchesFilter = isMember;
        if (filterStatus === 'non_member') matchesFilter = !isMember;

        return matchesSearch && matchesFilter;
    });

    const downloadPdf = async () => {
        if (!selectedMember || !memberStats || !reportRef.current) return;

        try {
            const canvas = await html2canvas(reportRef.current, {
                scale: 2,
                backgroundColor: '#ffffff'
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = pdfWidth;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            pdf.save(`Member_Report_${selectedMember.code}.pdf`);
        } catch (error) {
            console.error("Error generating PDF:", error);
        }
    };

    const downloadMembersList = async () => {
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
            const pdfWidth = 210; // A4 Width
            const margin = 5;
            const contentWidth = pdfWidth - (2 * margin); // 200mm
            const imgHeight = (canvas.height * contentWidth) / canvas.width;

            const pdf = new jsPDF('p', 'mm', [pdfWidth, Math.max(imgHeight + (2 * margin), 297)]);
            pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, imgHeight);
            pdf.save(`Members_List_${new Date().toISOString().split('T')[0]}.pdf`);

        } catch (error) {
            console.error("Error generating PDF:", error);
            showAlert("Error generating PDF. Please try again.", 'Print Error', 'error');
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div style={{ padding: '16px 32px', maxWidth: '1600px', margin: '0 auto', background: 'transparent', minHeight: '100%' }}>

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
                        color: '#111827',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        margin: '0 0 8px 0'
                    }}>
                        <Users size={28} />
                        {t('members.title')}
                    </h1>
                    <p style={{ fontSize: '15px', color: '#6b7280', margin: 0 }}>
                        {t('members.subtitle')}
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                <button
                    onClick={() => setFilterStatus('all')}
                    style={{
                        padding: '10px 20px',
                        borderRadius: '12px',
                        border: filterStatus === 'all' ? 'none' : '1px solid #e5e7eb',
                        background: filterStatus === 'all' ? '#111827' : 'white',
                        color: filterStatus === 'all' ? 'white' : '#6b7280',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    All Farmers
                </button>
                <button
                    onClick={() => setFilterStatus('member')}
                    style={{
                        padding: '10px 20px',
                        borderRadius: '12px',
                        border: filterStatus === 'member' ? 'none' : '1px solid #e5e7eb',
                        background: filterStatus === 'member' ? '#2563eb' : 'white',
                        color: filterStatus === 'member' ? 'white' : '#6b7280',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    Members
                </button>
                <button
                    onClick={() => setFilterStatus('non_member')}
                    style={{
                        padding: '10px 20px',
                        borderRadius: '12px',
                        border: filterStatus === 'non_member' ? 'none' : '1px solid #e5e7eb',
                        background: filterStatus === 'non_member' ? '#d97706' : 'white',
                        color: filterStatus === 'non_member' ? 'white' : '#6b7280',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    Non-Members
                </button>
                <div style={{ flex: 1 }}></div>
                <button
                    onClick={downloadMembersList}
                    disabled={isDownloading}
                    style={{
                        padding: '10px 20px',
                        borderRadius: '12px',
                        background: '#10b981',
                        color: 'white',
                        border: 'none',
                        fontWeight: '600',
                        cursor: isDownloading ? 'wait' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                >
                    <Download size={18} />
                    {isDownloading ? 'Downloading...' : 'Download List'}
                </button>
            </div>

            {/* Search */}
            <div style={{ background: 'white', borderRadius: '16px', padding: '16px 20px', marginBottom: '24px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <Search size={20} color="#6b7280" />
                <input
                    type="text"
                    placeholder={t('members.searchPlaceholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ flex: 1, border: 'none', outline: 'none', fontSize: '15px', background: 'transparent' }}
                />
            </div>

            {/* Table */}
            <div style={{ background: 'white', borderRadius: '20px', overflow: 'hidden', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}><Loader /></div>
                ) : filteredMembers.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>
                        <p>No members found.</p>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#fafafa', borderBottom: '1px solid #e5e7eb' }}>
                                <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase' }}>{t('members.table.code')}</th>
                                <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase' }}>{t('members.table.name')}</th>
                                <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase' }}>{t('members.table.phone')}</th>
                                <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase' }}>Joining Date</th>
                                <th style={{ padding: '16px 24px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase' }}>{t('members.table.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredMembers.map((member, index) => (
                                <tr key={member.id} style={{ borderBottom: '1px solid #f3f4f6', background: index % 2 === 0 ? 'white' : '#fafafa' }}>
                                    <td style={{ padding: '16px 24px', fontWeight: '600', color: '#667eea' }}>#{member.code}</td>
                                    <td style={{ padding: '16px 24px', fontWeight: '600', color: '#111827' }}>{member.name}</td>
                                    <td style={{ padding: '16px 24px', color: '#6b7280' }}>{member.phone || '-'}</td>
                                    <td style={{ padding: '16px 24px', color: '#6b7280' }}>
                                        {member.joining_date
                                            ? new Date(member.joining_date).toLocaleDateString()
                                            : (member.created_at ? new Date(member.created_at).toLocaleDateString() : '-')}
                                    </td>
                                    <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                                        <button
                                            onClick={() => handleViewStats(member)}
                                            style={{ padding: '8px 16px', background: '#eef2ff', color: '#4f46e5', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                        >
                                            <TrendingUp size={16} /> View Profile
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Profile Modal */}
            {showStatsModal && selectedMember && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: 'white', borderRadius: '24px', width: '90%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
                        <div style={{ padding: '24px 32px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' }}>
                            <div>
                                <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: 0 }}>{selectedMember.name}</h2>
                                <p style={{ margin: '4px 0 0 0', color: '#6b7280' }}>Member Code: #{selectedMember.code}</p>
                            </div>
                            <button onClick={() => setShowStatsModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={28} /></button>
                        </div>

                        <div style={{ padding: '32px' }}>
                            {loadingStats || !memberStats ? (
                                <div style={{ padding: '60px', display: 'flex', justifyContent: 'center' }}><Loader /></div>
                            ) : (
                                <>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', marginBottom: '32px' }}>
                                        <StatCard title={t('members.profile.stats.last10Days')} data={memberStats.last10Days} icon={Calendar} color="#10b981" />
                                        <StatCard title={t('members.profile.stats.lastMonth')} data={memberStats.lastMonth} icon={TrendingUp} color="#6366f1" />
                                        <StatCard title="Last 3 Months" data={memberStats.last3Months} icon={TrendingUp} color="#8b5cf6" />
                                        <StatCard title={t('members.profile.stats.lastYear')} data={memberStats.lastYear} icon={FileText} color="#f59e0b" />
                                        <StatCard title={t('members.profile.stats.lifetime')} data={memberStats.lifetime} icon={Users} color="#ec4899" />
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                        <button
                                            onClick={downloadPdf}
                                            style={{ padding: '12px 24px', background: '#1f2937', color: 'white', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                        >
                                            <Download size={20} />
                                            {t('members.profile.downloadPdf')}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden Report for PDF Generation */}
            {selectedMember && memberStats && (
                <div style={{ position: 'fixed', top: 0, left: '-9999px', width: '800px', background: 'white', zIndex: -1 }}>
                    <div ref={reportRef} style={{ padding: '40px', fontFamily: "'Inter', sans-serif", color: '#111827' }}>
                        {/* Header */}
                        <div style={{ textAlign: 'center', marginBottom: '40px', borderBottom: '2px solid #3b82f6', paddingBottom: '20px' }}>
                            <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#2563eb', margin: '0 0 8px 0' }}>{user?.dairy_name || 'Dairy Report'}</h1>
                            <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#6b7280', margin: 0 }}>{t('members.profile.title')}</h2>
                            <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '8px' }}>Generated: {new Date().toLocaleString()}</p>
                        </div>

                        {/* Member Details */}
                        <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '12px', marginBottom: '32px', border: '1px solid #e2e8f0' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#475569', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>{t('members.profile.personalInfo')}</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 4px 0' }}>{t('members.table.name')}</p>
                                    <p style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', margin: 0 }}>{selectedMember.name}</p>
                                </div>
                                <div>
                                    <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 4px 0' }}>{t('members.table.code')}</p>
                                    <p style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', margin: 0 }}>#{selectedMember.code}</p>
                                </div>
                                <div>
                                    <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 4px 0' }}>{t('members.table.phone')}</p>
                                    <p style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', margin: 0 }}>{selectedMember.phone || 'N/A'}</p>
                                </div>
                                <div>
                                    <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 4px 0' }}>Status</p>
                                    <p style={{ fontSize: '16px', fontWeight: '600', color: selectedMember.is_member !== false ? '#10b981' : '#f59e0b', margin: 0 }}>
                                        {selectedMember.is_member !== false ? 'Member' : 'Non-Member'}
                                    </p>
                                </div>
                                <div>
                                    <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 4px 0' }}>Registration Date</p>
                                    <p style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', margin: 0 }}>
                                        {selectedMember.joining_date
                                            ? new Date(selectedMember.joining_date).toLocaleDateString()
                                            : (selectedMember.created_at || selectedMember.inserted_at)
                                                ? new Date(selectedMember.created_at || selectedMember.inserted_at).toLocaleDateString()
                                                : 'N/A'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Stats Table */}
                        <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#475569', marginBottom: '16px' }}>{t('members.profile.collections')}</h3>
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '40px' }}>
                            <thead>
                                <tr style={{ background: '#3b82f6', color: 'white' }}>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', borderRadius: '8px 0 0 8px', fontSize: '14px' }}>Time Period</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '14px' }}>Quantity (L)</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'right', borderRadius: '0 8px 8px 0', fontSize: '14px' }}>Amount (₹)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    { label: t('members.profile.stats.last10Days'), data: memberStats.last10Days },
                                    { label: t('members.profile.stats.lastMonth'), data: memberStats.lastMonth },
                                    { label: "Last 3 Months", data: memberStats.last3Months },
                                    { label: t('members.profile.stats.lastYear'), data: memberStats.lastYear },
                                    { label: t('members.profile.stats.lifetime'), data: memberStats.lifetime, isLast: true }
                                ].map((row, idx) => (
                                    <tr key={idx} style={{ borderBottom: row.isLast ? 'none' : '1px solid #e2e8f0' }}>
                                        <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: '600', color: '#334155' }}>{row.label}</td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '14px', color: '#0f172a' }}>{row.data.quantity.toFixed(2)}</td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>{Math.round(row.data.amount).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Footer */}
                        <div style={{ textAlign: 'center', marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
                            <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Thank you for using DudhSakha!</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden List Report Template */}
            <div style={{ position: 'fixed', top: 0, left: '-9999px', width: '750px', background: 'white', zIndex: -1 }}>
                <div ref={listReportRef} style={{ padding: '20px', fontFamily: "'Inter', sans-serif", color: '#111827' }}>
                    <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #3b82f6', paddingBottom: '15px' }}>
                        <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#2563eb', margin: '0 0 8px 0' }}>{user?.dairy_name || 'Dairy Report'}</h1>
                        <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#4b5563', margin: 0 }}>Members List</h2>
                        <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '6px' }}>Generated: {new Date().toLocaleString()}</p>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', tableLayout: 'fixed' }}>
                        <thead>
                            <tr style={{ background: '#3b82f6', color: 'white' }}>
                                <th style={{ padding: '8px', textAlign: 'left', borderRadius: '6px 0 0 6px', width: '15%' }}>{t('members.table.code')}</th>
                                <th style={{ padding: '8px', textAlign: 'left', width: '25%' }}>{t('members.table.name')}</th>
                                <th style={{ padding: '8px', textAlign: 'left', width: '20%' }}>{t('members.table.phone')}</th>
                                <th style={{ padding: '8px', textAlign: 'left', width: '20%' }}>Status</th>
                                <th style={{ padding: '8px', textAlign: 'left', borderRadius: '0 6px 6px 0', width: '20%' }}>Join Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredMembers.map((member, index) => (
                                <tr key={member.id} style={{ borderBottom: '1px solid #e2e8f0', background: index % 2 === 0 ? 'white' : '#f8fafc' }}>
                                    <td style={{ padding: '8px', fontWeight: 'bold', color: '#3b82f6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.code}</td>
                                    <td style={{ padding: '8px', fontWeight: '600', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.name}</td>
                                    <td style={{ padding: '8px', color: '#64748b' }}>{member.phone || '-'}</td>
                                    <td style={{ padding: '8px', color: member.is_member !== false ? '#10b981' : '#f59e0b', fontWeight: '600' }}>
                                        {member.is_member !== false ? 'Member' : 'Non-Member'}
                                    </td>
                                    <td style={{ padding: '8px', color: '#64748b' }}>
                                        {member.joining_date ? new Date(member.joining_date).toLocaleDateString() : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '9px', color: '#cbd5e1' }}>
                        Total Members: {filteredMembers.length}
                    </div>
                </div>
            </div>
            <AlertComponent />
        </div>
    );
}

const StatCard = ({ title, data, icon: Icon, color }) => (
    <div style={{ padding: '24px', borderRadius: '16px', border: '1px solid #f3f4f6', background: 'white', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ padding: '10px', borderRadius: '12px', background: `${color}15`, color: color }}>
                <Icon size={24} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#4b5563', margin: 0 }}>{title}</h3>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
                <p style={{ fontSize: '13px', color: '#9ca3af', margin: '0 0 4px 0', fontWeight: '500' }}>QUANTITY</p>
                <p style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: 0 }}>{data.quantity.toFixed(1)} L</p>
            </div>
            <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '13px', color: '#9ca3af', margin: '0 0 4px 0', fontWeight: '500' }}>AMOUNT</p>
                <p style={{ fontSize: '24px', fontWeight: '700', color: color, margin: 0 }}>₹{Math.round(data.amount).toLocaleString()}</p>
            </div>
        </div>
    </div>
);

export default Members;
