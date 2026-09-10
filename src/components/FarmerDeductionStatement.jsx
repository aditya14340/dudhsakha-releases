import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Printer, Download, Calendar, Activity, CheckCircle2, AlertCircle } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { getFarmerPayments, getFarmerDeductions } from '../lib/api';
import Loader from './Loader';
import { useAlert } from '../hooks/useAlert';

const FarmerDeductionStatement = ({ show, onClose, farmer, user }) => {
    const { t } = useTranslation();
    const { showAlert } = useAlert();
    const [loading, setLoading] = useState(false);
    const [assignments, setAssignments] = useState([]);
    const [historicalBills, setHistoricalBills] = useState([]);
    const [isDownloading, setIsDownloading] = useState(false);
    const printRef = useRef();

    useEffect(() => {
        if (show && farmer && user?.dairy_id) {
            loadFarmerData();
        }
    }, [show, farmer]);

    const loadFarmerData = async () => {
        setLoading(true);
        try {
            // Fetch all global assignments and filter for this farmer
            const allAssignments = await getFarmerDeductions(user.dairy_id);
            const farmerAssignments = (allAssignments || []).filter(a => String(a.farmer_id) === String(farmer.id));
            setAssignments(farmerAssignments);

            // Fetch historical payments (which contain deduction_summary snapshots)
            const payments = await getFarmerPayments(farmer.id, user.dairy_id);
            setHistoricalBills(payments || []);
        } catch (error) {
            console.error("Error loading farmer deduction data:", error);
            showAlert("Error loading statement data", "Error", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPDF = async (action = 'download') => {
        if (!printRef.current) return;
        setIsDownloading(true);
        try {
            // Briefly show the print area to capture it
            printRef.current.style.display = 'block';
            
            // Wait for render
            await new Promise(resolve => setTimeout(resolve, 300));
            
            const canvas = await html2canvas(printRef.current, {
                scale: 2,
                backgroundColor: '#ffffff',
                useCORS: true
            });
            
            // Hide it again
            printRef.current.style.display = 'none';

            const imgData = canvas.toDataURL('image/png');
            const imgWidth = 210; // A4 width in mm
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            const pdf = new jsPDF('p', 'mm', [imgWidth, imgHeight > 297 ? imgHeight : 297]);
            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            
            if (action === 'print') {
                pdf.autoPrint();
                pdf.save(`Deduction_Statement_${farmer.name}_Print.pdf`);
            } else {
                pdf.save(`Deduction_Statement_${farmer.name}_${new Date().toISOString().split('T')[0]}.pdf`);
            }
        } catch (error) {
            console.error("PDF Gen Error:", error);
            showAlert("Failed to generate PDF.", "Error", "error");
        } finally {
            setIsDownloading(false);
            if (printRef.current) printRef.current.style.display = 'none';
        }
    };

    if (!show || !farmer) return null;

    // Process historical bills into a flat list of deduction logs with balances
    const allHistoricalDeductions = historicalBills.reduce((acc, bill) => {
        const summary = bill.deductions_summary || {};
        let dedList = [];
        
        // Handle different possible formats of deductions_summary
        if (Array.isArray(summary)) dedList = summary;
        else if (summary.deductions_list) dedList = summary.deductions_list;
        else if (summary.deductionsList) dedList = summary.deductionsList;

        if (dedList.length > 0) {
            dedList.forEach(d => {
                acc.push({
                    id: `${bill.id}-${d.id || d.name}`,
                    bill_period: `${new Date(bill.start_date).toLocaleDateString()} - ${new Date(bill.end_date).toLocaleDateString()}`,
                    payment_date: bill.payment_date,
                    name: d.name || d.deduction_name || 'Deduction',
                    amount: d.amount || d.deducted || d.effectiveAmt || 0,
                    prev_balance: d.prevBalance || d.previous_balance || d.prev_balance,
                    rem_balance: d.remaining || d.remaining_balance || d.rem_balance
                });
            });
        }
        return acc;
    }, []);

    // Sort by payment date descending
    const sortedHistory = allHistoricalDeductions.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '20px'
        }}>
            <div style={{
                background: 'white',
                borderRadius: '24px',
                width: '100%',
                maxWidth: '900px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    padding: '24px 32px',
                    borderBottom: '1px solid #f3f4f6',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'linear-gradient(to right, #ffffff, #f9fafb)'
                }}>
                    <div>
                        <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {farmer.name} <span style={{ fontSize: '16px', fontWeight: '600', color: '#6366f1', background: '#e0e7ff', padding: '4px 10px', borderRadius: '8px' }}>#{farmer.code}</span>
                        </h2>
                        <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
                            Deduction Statement & History
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            onClick={() => handleDownloadPDF('print')}
                            disabled={isDownloading || loading}
                            style={{
                                background: '#eff6ff', border: 'none', borderRadius: '12px', padding: '10px 16px',
                                cursor: 'pointer', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '8px',
                                fontWeight: '600', transition: 'all 0.2s', opacity: (isDownloading || loading) ? 0.7 : 1
                            }}
                        >
                            <Printer size={18} /> Print
                        </button>
                        <button
                            onClick={() => handleDownloadPDF('download')}
                            disabled={isDownloading || loading}
                            style={{
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none', borderRadius: '12px', padding: '10px 16px',
                                cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', gap: '8px',
                                fontWeight: '600', transition: 'all 0.2s', opacity: (isDownloading || loading) ? 0.7 : 1
                            }}
                        >
                            <Download size={18} /> Download
                        </button>
                        <button
                            onClick={onClose}
                            style={{
                                background: '#f3f4f6', border: 'none', borderRadius: '12px', padding: '10px',
                                cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div style={{ padding: '32px', overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Loader text="Loading records..." /></div>
                    ) : (
                        <>
                            {/* Active Assignments Overview */}
                            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Active Assignments
                            </h3>
                            {assignments.length > 0 ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                                    {assignments.map(a => {
                                        const progress = a.total_amount ? Math.min(100, (parseFloat(a.collected_amount || 0) / parseFloat(a.total_amount)) * 100) : 0;
                                        return (
                                            <div key={a.id} style={{ background: 'white', borderRadius: '16px', padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                                    <div>
                                                        <div style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>{a.deduction_name}</div>
                                                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <Calendar size={12} /> {new Date(a.start_date || a.created_at).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#2563eb', background: '#eff6ff', padding: '4px 8px', borderRadius: '6px' }}>ACTIVE</span>
                                                </div>
                                                
                                                {a.total_amount > 0 ? (
                                                    <>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                                                            <span style={{ color: '#64748b' }}>Collected: <b>₹{(parseFloat(a.collected_amount||0)).toFixed(2)}</b></span>
                                                            <span style={{ color: '#0f172a', fontWeight: '600' }}>₹{parseFloat(a.total_amount).toFixed(2)}</span>
                                                        </div>
                                                        <div style={{ width: '100%', height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                                                            <div style={{ width: `${progress}%`, height: '100%', background: '#10b981', borderRadius: '3px' }}></div>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div style={{ fontSize: '13px', color: '#64748b' }}>
                                                        Rate: <b>₹{parseFloat(a.amount).toFixed(2)}</b> ({a.deduction_type})<br/>
                                                        <i>Ongoing deduction (No target)</i>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div style={{ padding: '24px', background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', textAlign: 'center', color: '#94a3b8', marginBottom: '32px' }}>
                                    No active deduction assignments found.
                                </div>
                            )}

                            {/* Historical Payments */}
                            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Deduction History Logs
                            </h3>
                            {sortedHistory.length > 0 ? (
                                <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', color: '#64748b' }}>Date / Period</th>
                                                <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', color: '#64748b' }}>Deduction</th>
                                                <th style={{ padding: '12px 24px', textAlign: 'right', fontSize: '12px', color: '#64748b' }}>Prev. Balance</th>
                                                <th style={{ padding: '12px 24px', textAlign: 'right', fontSize: '12px', color: '#64748b' }}>Deducted</th>
                                                <th style={{ padding: '12px 24px', textAlign: 'right', fontSize: '12px', color: '#64748b' }}>Remaining</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortedHistory.map((log, idx) => (
                                                <tr key={log.id} style={{ borderBottom: idx < sortedHistory.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                                                    <td style={{ padding: '14px 24px' }}>
                                                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{new Date(log.payment_date).toLocaleDateString()}</div>
                                                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>{log.bill_period}</div>
                                                    </td>
                                                    <td style={{ padding: '14px 24px', fontSize: '14px', fontWeight: '600', color: '#475569' }}>{log.name}</td>
                                                    <td style={{ padding: '14px 24px', textAlign: 'right', fontSize: '14px', color: '#64748b' }}>₹{parseFloat(log.prev_balance || 0).toFixed(2)}</td>
                                                    <td style={{ padding: '14px 24px', textAlign: 'right', fontSize: '15px', fontWeight: '800', color: '#ef4444' }}>-₹{parseFloat(log.amount).toFixed(2)}</td>
                                                    <td style={{ padding: '14px 24px', textAlign: 'right', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>₹{parseFloat(log.rem_balance || 0).toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div style={{ padding: '40px', background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', textAlign: 'center', color: '#94a3b8' }}>
                                    No past deduction logs found for this farmer.
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Hidden PDF Printable Area */}
            <div ref={printRef} style={{ display: 'none', position: 'absolute', top: 0, left: 0, width: '800px', padding: '40px', background: 'white', color: 'black', fontFamily: 'sans-serif' }}>
                <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #e2e8f0', paddingBottom: '20px' }}>
                    <h1 style={{ margin: '0 0 10px 0', fontSize: '28px', color: '#1e293b' }}>Deduction Statement</h1>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                        <div style={{ textAlign: 'left' }}>
                            <p style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#64748b' }}>Farmer Name: <strong style={{color: '#0f172a'}}>{farmer.name}</strong></p>
                            <p style={{ margin: '0', fontSize: '14px', color: '#64748b' }}>Farmer Code: <strong style={{color: '#0f172a'}}>{farmer.code}</strong></p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#64748b' }}>Generated On: <strong style={{color: '#0f172a'}}>{new Date().toLocaleDateString()}</strong></p>
                        </div>
                    </div>
                </div>

                <div style={{ marginBottom: '30px' }}>
                    <h3 style={{ fontSize: '18px', color: '#1e293b', borderBottom: '1px solid #cbd5e1', paddingBottom: '8px', marginBottom: '16px' }}>Active Assignments</h3>
                    {assignments.length > 0 ? (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                            <thead>
                                <tr style={{ background: '#f1f5f9' }}>
                                    <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #e2e8f0' }}>Deduction Name</th>
                                    <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #e2e8f0' }}>Start Date</th>
                                    <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #e2e8f0' }}>Rate / Type</th>
                                    <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #e2e8f0' }}>Collected</th>
                                    <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #e2e8f0' }}>Target</th>
                                </tr>
                            </thead>
                            <tbody>
                                {assignments.map(a => (
                                    <tr key={a.id}>
                                        <td style={{ padding: '10px', border: '1px solid #e2e8f0', fontWeight: '600' }}>{a.deduction_name}</td>
                                        <td style={{ padding: '10px', border: '1px solid #e2e8f0' }}>{new Date(a.start_date || a.created_at).toLocaleDateString()}</td>
                                        <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #e2e8f0' }}>₹{parseFloat(a.amount).toFixed(2)} ({a.deduction_type})</td>
                                        <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #e2e8f0' }}>₹{parseFloat(a.collected_amount || 0).toFixed(2)}</td>
                                        <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #e2e8f0' }}>{a.total_amount ? `₹${parseFloat(a.total_amount).toFixed(2)}` : 'N/A'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p style={{ color: '#64748b', fontSize: '14px' }}>No active assignments.</p>
                    )}
                </div>

                <div>
                    <h3 style={{ fontSize: '18px', color: '#1e293b', borderBottom: '1px solid #cbd5e1', paddingBottom: '8px', marginBottom: '16px' }}>Past Deduction History</h3>
                    {sortedHistory.length > 0 ? (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                            <thead>
                                <tr style={{ background: '#f1f5f9' }}>
                                    <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #e2e8f0' }}>Date / Period</th>
                                    <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #e2e8f0' }}>Deduction</th>
                                    <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #e2e8f0' }}>Prev. Balance</th>
                                    <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #e2e8f0' }}>Deducted</th>
                                    <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #e2e8f0' }}>Remaining</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedHistory.map(log => (
                                    <tr key={log.id}>
                                        <td style={{ padding: '10px', border: '1px solid #e2e8f0' }}>
                                            {new Date(log.payment_date).toLocaleDateString()}<br/>
                                            <span style={{ fontSize: '11px', color: '#64748b' }}>{log.bill_period}</span>
                                        </td>
                                        <td style={{ padding: '10px', border: '1px solid #e2e8f0', fontWeight: '600' }}>{log.name}</td>
                                        <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #e2e8f0' }}>₹{parseFloat(log.prev_balance || 0).toFixed(2)}</td>
                                        <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #e2e8f0', color: '#ef4444', fontWeight: '700' }}>₹{parseFloat(log.amount).toFixed(2)}</td>
                                        <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #e2e8f0', fontWeight: '700' }}>₹{parseFloat(log.rem_balance || 0).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p style={{ color: '#64748b', fontSize: '14px' }}>No historical logs available.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FarmerDeductionStatement;
