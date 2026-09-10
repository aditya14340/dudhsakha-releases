import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, ArrowLeft, Printer } from 'lucide-react';

// ─── Dummy data for bill previews ────────────────────────────────────────────
const DUMMY = {
    dairyName: 'श्री दत्त डेअरी कोगनोळी',
    phone1: '9110617627',
    phone2: '8970652622',
    farmerCode: '52',
    billNo: '13',
    farmerName: 'महादेव तेळी',
    village: 'कोगनोळी',
    branch: 'मुख्य शाखा',
    milkType: 'म्हैस',
    billDate: '25/03/2026',
    periodStart: '11/03/2026',
    periodEnd: '20/03/2026',
    rows: [
        { date: '11/03/2026', mQty: 3.2, mFat: 5.0, mRate: 42.00, mAmt: 134.40, eQty: 3.2, eFat: 5.5, eRate: 50.00, eAmt: 160.00 },
        { date: '12/03/2026', mQty: null, mFat: null, mRate: null, mAmt: null, eQty: 5.7, eFat: 5.4, eRate: 46.00, eAmt: 262.20 },
        { date: '13/03/2026', mQty: 3.2, mFat: 5.1, mRate: 42.30, mAmt: 135.36, eQty: 2.1, eFat: 5.0, eRate: 42.00, eAmt: 88.20 },
        { date: '14/03/2026', mQty: 4.4, mFat: 5.0, mRate: 42.00, mAmt: 184.80, eQty: 2.0, eFat: 5.4, eRate: 46.00, eAmt: 92.00 },
        { date: '15/03/2026', mQty: 3.4, mFat: 5.0, mRate: 42.00, mAmt: 142.80, eQty: 2.2, eFat: 5.0, eRate: 42.00, eAmt: 92.40 },
        { date: '16/03/2026', mQty: 4.1, mFat: 5.0, mRate: 42.00, mAmt: 172.20, eQty: null, eFat: null, eRate: null, eAmt: null },
        { date: '17/03/2026', mQty: 7.0, mFat: 5.0, mRate: 42.00, mAmt: 294.00, eQty: 2.1, eFat: 5.3, eRate: 42.30, eAmt: 88.83 },
        { date: '18/03/2026', mQty: 3.3, mFat: 5.0, mRate: 42.00, mAmt: 138.60, eQty: 1.9, eFat: 5.2, eRate: 42.60, eAmt: 80.94 },
        { date: '19/03/2026', mQty: 3.8, mFat: 5.0, mRate: 42.00, mAmt: 159.60, eQty: 2.1, eFat: 5.3, eRate: 42.30, eAmt: 88.83 },
        { date: '20/03/2026', mQty: null, mFat: null, mRate: null, mAmt: null, eQty: 5.1, eFat: 8.0, eRate: 63.50, eAmt: 323.85 },
    ],
    mTotal: { qty: 32.40, amt: 1361.76 },
    eTotal: { qty: 26.40, amt: 1277.25 },
    totalQty: 58.8,
    totalAmt: 2639.01,
    netAmt: 2639.01,
    deductions: [{ name: 'Advance', prevBalance: '5000.00', deducted: '500.00', remaining: '4500.00' }],
    // For A4 format collections
    collections: [
        { date: '2026-03-11', shift: 'Morning', milk_type: 'Buffalo', quantity: 3.2, fat: 5.0, snf: 8.5, rate: 42.00, amount: 134.40 },
        { date: '2026-03-11', shift: 'Evening', milk_type: 'Buffalo', quantity: 3.2, fat: 5.5, snf: 8.8, rate: 50.00, amount: 160.00 },
        { date: '2026-03-12', shift: 'Evening', milk_type: 'Buffalo', quantity: 5.7, fat: 5.4, snf: 8.7, rate: 46.00, amount: 262.20 },
        { date: '2026-03-13', shift: 'Morning', milk_type: 'Buffalo', quantity: 3.2, fat: 5.1, snf: 8.5, rate: 42.30, amount: 135.36 },
        { date: '2026-03-13', shift: 'Evening', milk_type: 'Buffalo', quantity: 2.1, fat: 5.0, snf: 8.5, rate: 42.00, amount: 88.20 },
    ],
};

// ─── Format 1: Thermal ────────────────────────────────────────────────────────
function ThermalPreview() {
    const morning = DUMMY.collections.filter(c => c.shift === 'Morning');
    const evening = DUMMY.collections.filter(c => c.shift === 'Evening');
    const totalQty = DUMMY.collections.reduce((s, c) => s + c.quantity, 0);
    const totalAmt = DUMMY.collections.reduce((s, c) => s + c.amount, 0);
    const totalDed = DUMMY.deductions.reduce((s, d) => s + parseFloat(d.deducted), 0);
    const netAmt = totalAmt - totalDed;

    const cellStyle = { padding: '1px 2px', fontSize: '7pt', textAlign: 'right' };

    return (
        <div style={{ 
            width: '72mm', margin: '0 auto', padding: '6px',
            fontFamily: '"Courier New", Courier, monospace',
            background: 'white', border: '1px solid #ddd', borderRadius: '4px',
            fontSize: '8pt', color: 'black'
         }}>
            <div style={{ color: 'black',  textAlign: 'center', borderBottom: '1px solid #000', paddingBottom: '4px', marginBottom: '4px'  }}>
                <div style={{ color: 'black',  fontWeight: 'bold', fontSize: '10pt'  }}>{DUMMY.dairyName}</div>
                <div style={{ color: 'black',  fontWeight: 'bold', fontSize: '9pt'  }}>MILK BILL</div>
                <div style={{ color: 'black',  display: 'flex', justifyContent: 'space-between', fontSize: '7pt', marginTop: '2px'  }}>
                    <span>Code: <strong>{DUMMY.farmerCode}</strong></span>
                    <span>{DUMMY.billDate}</span>
                </div>
                <div style={{ color: 'black',  fontWeight: 'bold', textAlign: 'left'  }}>{DUMMY.farmerName}</div>
                <div style={{ color: 'black',  fontSize: '7pt', textAlign: 'left'  }}>Period: {DUMMY.periodStart} to {DUMMY.periodEnd}</div>
            </div>

            {[{ label: 'MORNING', cols: morning }, { label: 'EVENING', cols: evening }].map(g => (
                g.cols.length > 0 && (
                    <div key={g.label} style={{ color: 'black',  marginBottom: '6px'  }}>
                        <div style={{ color: 'black',  fontWeight: 'bold', borderBottom: '1px solid #000', fontSize: '7pt'  }}>{g.label} ({g.cols.length})</div>
                        <div style={{ color: 'black',  display: 'flex', fontSize: '6.5pt', fontWeight: 'bold', borderBottom: '0.5px solid #999'  }}>
                            <div style={{ color: 'black',  flex: 1.5  }}>Date</div>
                            <div style={{ color: 'black',  flex: 1, ...cellStyle  }}>F</div>
                            <div style={{ color: 'black',  flex: 1, ...cellStyle  }}>S</div>
                            <div style={{ color: 'black',  flex: 1, ...cellStyle  }}>R</div>
                            <div style={{ color: 'black',  flex: 1, ...cellStyle  }}>Q</div>
                            <div style={{ color: 'black',  flex: 1.2, ...cellStyle  }}>Amt</div>
                        </div>
                        {g.cols.map((c, i) => (
                            <div key={i} style={{ color: 'black',  display: 'flex', fontSize: '6.5pt', borderBottom: '0.2px solid #eee'  }}>
                                <div style={{ color: 'black',  flex: 1.5  }}>{new Date(c.date).getDate()}/{new Date(c.date).getMonth() + 1}</div>
                                <div style={{ color: 'black',  flex: 1, ...cellStyle  }}>{c.fat.toFixed(1)}</div>
                                <div style={{ color: 'black',  flex: 1, ...cellStyle  }}>{c.snf.toFixed(1)}</div>
                                <div style={{ color: 'black',  flex: 1, ...cellStyle  }}>{c.rate.toFixed(0)}</div>
                                <div style={{ color: 'black',  flex: 1, ...cellStyle  }}>{c.quantity.toFixed(1)}</div>
                                <div style={{ color: 'black',  flex: 1.2, ...cellStyle  }}>{Math.round(c.amount)}</div>
                            </div>
                        ))}
                        <div style={{ color: 'black',  display: 'flex', justifyContent: 'flex-end', fontWeight: 'bold', fontSize: '7pt', borderTop: '0.5px solid #000'  }}>
                            <span>Total:</span>
                            <span style={{ color: 'black',  width: '35px', textAlign: 'right'  }}>{g.cols.reduce((s, c) => s + c.quantity, 0).toFixed(1)}</span>
                            <span style={{ color: 'black',  width: '40px', textAlign: 'right'  }}>{Math.round(g.cols.reduce((s, c) => s + c.amount, 0))}</span>
                        </div>
                    </div>
                )
            ))}

            <div style={{ color: 'black',  borderTop: '1px solid #000', paddingTop: '4px', fontSize: '7pt'  }}>
                <div style={{ color: 'black',  display: 'flex', justifyContent: 'space-between'  }}><span>Total Milk:</span><span style={{ color: 'black',  fontWeight: 'bold'  }}>{totalQty.toFixed(1)} L</span></div>
                <div style={{ color: 'black',  display: 'flex', justifyContent: 'space-between'  }}><span>Gross Bill:</span><span>₹{totalAmt.toFixed(1)}</span></div>
                <div style={{ color: 'black',  display: 'flex', justifyContent: 'space-between'  }}><span>Deductions:</span><span style={{  color: 'black'  }}>-₹{totalDed.toFixed(1)}</span></div>
                <div style={{ color: 'black',  display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderTop: '1px solid #000', marginTop: '3px', paddingTop: '3px', fontSize: '9pt'  }}>
                    <span>NET PAYABLE:</span><span>₹{netAmt.toFixed(1)}</span>
                </div>
            </div>
            <div style={{ textAlign: 'center', fontSize: '6.5pt', marginTop: '6px', borderTop: '1px dashed #999', paddingTop: '4px', color: 'black' }}>
                Thank You! | Powered by DudhSakha
            </div>
        </div>
    );
}

// ─── Format 2: A4 Multi-Column ────────────────────────────────────────────────
function A4Preview() {
    const th = (label, style = {}) => (
        <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '2px 3px', textAlign: 'center', fontSize: '8px', fontWeight: 'bold', ...style  }}>{label}</th>
    );
    const td = (val, style = {}) => (
        <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '1px 3px', textAlign: 'right', fontSize: '8px', ...style  }}>{val}</td>
    );

    return (
        <div style={{ background: 'white', padding: '8px', color: 'black', fontFamily: '"Noto Sans", sans-serif', fontSize: '9px', border: '1px solid #ddd', borderRadius: '4px' }}>
            {/* Header */}
            <div style={{ color: 'black',  textAlign: 'center', marginBottom: '4px'  }}>
                <div style={{ color: 'black',  fontSize: '13px', fontWeight: 'bold'  }}>{DUMMY.dairyName}</div>
                <div style={{ color: 'black',  display: 'flex', justifyContent: 'space-between', marginTop: '3px', fontSize: '8px', fontWeight: 'bold'  }}>
                    <span>Code: {DUMMY.farmerCode}  {DUMMY.farmerName}</span>
                    <span>Milk Bill  {DUMMY.periodStart} to {DUMMY.periodEnd}</span>
                    <span>Date: {DUMMY.billDate}</span>
                </div>
            </div>
            <div style={{ color: 'black',  fontWeight: 'bold', fontSize: '8px', marginBottom: '3px', display: 'flex', justifyContent: 'space-between'  }}>
                <span>Branch: {DUMMY.branch}</span>
                <span>10 Days Bill</span>
                <span>Village: {DUMMY.village}</span>
            </div>

            {/* Table */}
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '8px' }}>
                <thead>
                    <tr>
                        {th('Date', { rowSpan: 2 })}
                        {th('MORNING', { colSpan: 5 })}
                        {th('EVENING', { colSpan: 5 })}
                        {th('DEDUCTION', { colSpan: 5 })}
                    </tr>
                    <tr>
                        {th('Qty')} {th('Fat')} {th('SNF')} {th('Rate')} {th('Amt')}
                        {th('Qty')} {th('Fat')} {th('SNF')} {th('Rate')} {th('Amt')}
                        {th('Name')} {th('Prev')} {th('Curr')} {th('Ded')} {th('Rem')}
                    </tr>
                </thead>
                <tbody>
                    {DUMMY.rows.slice(0, 7).map((row, i) => (
                        <tr key={i}>
                            {td(row.date.slice(0, 5), { textAlign: 'center' })}
                            {td(row.mQty || '')} {td(row.mFat || '')} {td('')} {td(row.mRate || '')} {td(row.mAmt || '')}
                            {td(row.eQty || '')} {td(row.eFat || '')} {td('')} {td(row.eRate || '')} {td(row.eAmt || '')}
                            {td(i === 0 ? 'Advance' : '', { textAlign: 'left', fontSize: '7px' })}
                            {td(i === 0 ? '5000' : '')} {td('')}
                            {td(i === 0 ? '500' : '')} {td(i === 0 ? '4500' : '')}
                        </tr>
                    ))}
                    {/* Totals */}
                    <tr style={{ fontWeight: 'bold', background: '#f5f5f5' }}>
                        {td('', {})}
                        {td(DUMMY.mTotal.qty)} {td('')} {td('')} {td('')} {td(DUMMY.mTotal.amt)}
                        {td(DUMMY.eTotal.qty)} {td('')} {td('')} {td('')} {td(DUMMY.eTotal.amt)}
                        {td('')} {td('')} {td('')} {td('500')} {td('4500')}
                    </tr>
                </tbody>
            </table>

            {/* Summary */}
            <div style={{ color: 'black',  border: '1px solid black', borderTop: 'none', padding: '3px 5px', display: 'flex', justifyContent: 'space-between', fontSize: '8px', fontWeight: 'bold'  }}>
                <span>Total Qty: {DUMMY.totalQty}L</span>
                <span>Total Bill: ₹{DUMMY.totalAmt}</span>
                <span>Deductions: ₹500</span>
                <span style={{ color: 'black',  fontSize: '10px'  }}>NET: ₹{DUMMY.netAmt - 500}</span>
            </div>
        </div>
    );
}

// ─── Format 3: Marathi Grid (exact match to reference photo) ──────────────────
function MarathiPreview() {
    const cell = (val, style = {}) => (
        <td style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '1px 4px', textAlign: 'center', fontSize: '8px', ...style  }}>{val ?? ''}</td>
    );
    const hdr = (label, style = {}) => (
        <th style={{ color: 'black',  borderBottom: '1px solid black', borderRight: '1px solid black', padding: '2px 4px', textAlign: 'center', fontSize: '8px', fontWeight: 'bold', background: 'white', ...style  }}>{label}</th>
    );

    return (
        <div style={{ background: 'white', padding: '10px', color: 'black', fontFamily: '"Noto Sans", sans-serif', border: '1px solid #ddd', borderRadius: '4px', fontSize: '8px' }}>

            {/* ── TOP HEADER: large dairy name centered only ── */}
            <div style={{ color: 'black',  textAlign: 'center', marginBottom: '6px'  }}>
                <div style={{ color: 'black',  fontSize: '15px', fontWeight: 'bold'  }}>{DUMMY.dairyName}</div>
            </div>

            {/* ── ROW 1: विभाग | दूध प्रकार | नंबर | दिनांक — spread out ── */}
            <div style={{ color: 'black',  display: 'flex', justifyContent: 'space-between', fontSize: '8px', fontWeight: 'bold', marginBottom: '4px', alignItems: 'center'  }}>
                <span>विभाग : {DUMMY.branch}</span>
                <span>दुध प्रकार : {DUMMY.milkType}</span>
                <span>नंबर : {DUMMY.farmerCode}</span>
                <span>दिनांक {DUMMY.billDate}</span>
            </div>

            {/* ── ROW 2: नांव name | बील दिनांक ... ते ... ── */}
            <div style={{ color: 'black',  display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '8px', fontWeight: 'bold', marginBottom: '6px'  }}>
                <div style={{ color: 'black',  whiteSpace: 'nowrap'  }}>नांव &nbsp; {DUMMY.farmerName}</div>
                <div style={{ color: 'black',  whiteSpace: 'nowrap'  }}>बील दिनांक {DUMMY.periodStart} ते {DUMMY.periodEnd}</div>
            </div>

            {/* ── MAIN TABLE with fixed layout ── */}
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, borderTop: '1px solid black', borderLeft: '1px solid black', tableLayout: 'fixed', fontSize: '8px' }}>
                <colgroup>
                    <col style={{ width: '50px' }} />
                    <col style={{ width: '30px' }} />
                    <col style={{ width: '26px' }} />
                    <col style={{ width: '26px' }} />
                    <col style={{ width: '42px' }} />
                    <col style={{ width: '30px' }} />
                    <col style={{ width: '26px' }} />
                    <col style={{ width: '26px' }} />
                    <col style={{ width: '42px' }} />
                    <col style={{ width: '42px' }} />
                    <col style={{ width: '38px' }} />
                    <col style={{ width: '38px' }} />
                </colgroup>
                <thead>
                    <tr>
                        {hdr('दिनांक', { rowSpan: 2 })}
                        {hdr('सकाळ', { colSpan: 4 })}
                        {hdr('संध्याकाळ', { colSpan: 4 })}
                        {hdr('कपात', { rowSpan: 2 })}
                        {hdr('रक्कम', { rowSpan: 2 })}
                        {hdr('येणे बाकी', { rowSpan: 2 })}
                    </tr>
                    <tr>
                        {hdr('दुध')} {hdr('फॅट')} {hdr('दर')} {hdr('रक्कम')}
                        {hdr('दुध')} {hdr('फॅट')} {hdr('दर')} {hdr('रक्कम')}
                    </tr>
                </thead>
                <tbody>
                    {DUMMY.rows.map((row, i) => (
                        <tr key={i}>
                            {cell(row.date, { textAlign: 'center', fontSize: '7px' })}
                            {cell(row.mQty)} {cell(row.mFat)} {cell(row.mRate)} {cell(row.mAmt)}
                            {cell(row.eQty)} {cell(row.eFat)} {cell(row.eRate)} {cell(row.eAmt)}
                            {/* कपात: show label like 'adv' on first deduction row */}
                            {cell(i === 0 ? 'adv' : '', { textAlign: 'left' })}
                            {cell(i === 0 ? '1000.00' : '')}
                            {cell(i === 0 ? '2000.00' : '')}
                        </tr>
                    ))}
                    {/* ── TOTALS ROW ── */}
                    <tr style={{ fontWeight: 'bold' }}>
                        {cell('एकुण', { textAlign: 'center', fontWeight: 'bold' })}
                        {cell(DUMMY.mTotal.qty)} {cell('')} {cell('')} {cell(DUMMY.mTotal.amt)}
                        {cell(DUMMY.eTotal.qty)} {cell('')} {cell('')} {cell(DUMMY.eTotal.amt)}
                        {cell('एकुण कपात', { textAlign: 'left', fontSize: '7px' })}
                        {cell('1000.00')} {cell('')}
                    </tr>
                </tbody>
            </table>

            {/* ── FOOTER: एकुण दुध | एकुण रक्कम | निव्वळ अदा ── */}
            <div style={{ color: 'black',  border: '1px solid black', borderTop: 'none', padding: '3px 6px', display: 'flex', justifyContent: 'space-between', fontSize: '8px', fontWeight: 'bold'  }}>
                <span>एकुण दुध {DUMMY.totalQty}</span>
                <span>एकुण रक्कम {DUMMY.totalAmt}</span>
                <span>निव्वळ अदा {DUMMY.netAmt}</span>
            </div>

            {/* ── SIGNATURE ── */}
            <div style={{ color: 'black',  display: 'flex', justifyContent: 'flex-end', marginTop: '12px'  }}>
                <div style={{ color: 'black',  textAlign: 'center'  }}>
                    <div style={{ color: 'black',  borderTop: '1px solid black', width: '60px', marginBottom: '2px'  }} />
                    <span style={{ color: 'black',  fontSize: '8px', fontWeight: 'bold'  }}>सही</span>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page Component ───────────────────────────────────────────────────────
export default function BillFormatSelector() {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const savedFormat = (() => {
        try { return localStorage.getItem('billFormat') || 'format1'; } catch { return 'format1'; }
    })();
    const [selected, setSelected] = useState(savedFormat);

    const handleSelect = (fmt) => {
        setSelected(fmt);
        localStorage.setItem('billFormat', fmt);
        // Also map to the old printMode key so thermal still works
        const printMode = fmt === 'format1' ? 'thermal' : 'normal';
        try {
            const stored = JSON.parse(localStorage.getItem('billingPrintSettings') || '{}');
            localStorage.setItem('billingPrintSettings', JSON.stringify({ ...stored, printMode }));
        } catch { /* ignore */ }
    };

    const handleConfirm = () => {
        navigate('/settings');
    };

    const formats = [
        {
            id: 'format1',
            name: t('settings.billFormat.format1Name', 'Thermal Receipt'),
            desc: t('settings.billFormat.format1Desc', 'Compact thermal printer format'),
            preview: <ThermalPreview />,
        },
        {
            id: 'format2',
            name: t('settings.billFormat.format2Name', 'Standard A4 Format'),
            desc: t('settings.billFormat.format2Desc', 'Multi-column A4 bill with morning/evening/deduction columns'),
            preview: <A4Preview />,
        },
        {
            id: 'format3',
            name: t('settings.billFormat.format3Name', 'Marathi Grid Format'),
            desc: t('settings.billFormat.format3Desc', 'Classic grid layout (सकाळ/संध्याकाळ) matching traditional dairy bill'),
            preview: <MarathiPreview />,
        },
    ];

    return (
        <div style={{ color: 'black',  padding: '24px 32px', maxWidth: '1600px', margin: '0 auto', minHeight: '100%'  }}>
            {/* Page Header */}
            <div style={{ color: 'black',  marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'  }}>
                <div style={{ color: 'black',  display: 'flex', alignItems: 'center', gap: '16px'  }}>
                    <button
                        onClick={() => navigate('/settings')}
                        style={{
                            background: '#f3f4f6', border: 'none', borderRadius: '12px',
                            padding: '10px 16px', cursor: 'pointer', display: 'flex',
                            alignItems: 'center', gap: '6px', color: 'black',
                            fontWeight: '600', fontSize: '14px', transition: 'all 0.2s'
                        }}
                    >
                        <ArrowLeft size={18} />
                        {t('settings.billFormat.back', 'Back to Settings')}
                    </button>
                    <div>
                        <h1 style={{ fontSize: '26px', fontWeight: '800', margin: 0, color: 'black', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Printer size={26} />
                            {t('settings.billFormat.title', 'Select Bill Format')}
                        </h1>
                        <p style={{ fontSize: '14px', color: 'black', margin: '4px 0 0' }}>
                            {t('settings.billFormat.subtitle', 'Choose the bill layout used for printing. Click a format to preview then confirm your choice.')}
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleConfirm}
                    style={{
                        padding: '12px 28px', background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)',
                        color: 'white', border: 'none', borderRadius: '14px',
                        fontSize: '15px', fontWeight: '700', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '8px',
                        boxShadow: '0 4px 15px rgba(99,102,241,0.4)', transition: 'all 0.2s'
                    }}
                >
                    <CheckCircle size={18} />
                    {t('settings.billFormat.confirm', 'Confirm & Go Back')}
                </button>
            </div>

            {/* Three previews side by side */}
            <div style={{ color: 'black',  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', alignItems: 'start'  }}>
                {formats.map(fmt => {
                    const isSelected = selected === fmt.id;
                    return (
                        <div
                            key={fmt.id}
                            onClick={() => handleSelect(fmt.id)}
                            style={{
                                borderRadius: '20px',
                                border: isSelected ? '3px solid #4338ca' : '3px solid #e5e7eb',
                                background: 'white',
                                overflow: 'hidden',
                                cursor: 'pointer',
                                transition: 'all 0.25s',
                                boxShadow: isSelected
                                    ? '0 8px 30px rgba(67,56,202,0.25)'
                                    : '0 2px 8px rgba(0,0,0,0.06)',
                                transform: isSelected ? 'scale(1.01)' : 'scale(1)',
                            }}
                        >
                            {/* Format title strip */}
                            <div style={{ color: 'black', 
                                padding: '14px 20px',
                                background: isSelected ? 'linear-gradient(135deg, #4338ca, #6366f1)' : '#f9fafb',
                                borderBottom: '1px solid ' + (isSelected ? 'transparent' : '#e5e7eb'),
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                             }}>
                                <div>
                                    <div style={{ fontSize: '15px', fontWeight: '700', color: isSelected ? 'white' : '#111827'  }}>{fmt.name}</div>
                                    <div style={{ fontSize: '12px', color: isSelected ? 'rgba(255,255,255,0.8)' : '#6b7280', marginTop: '2px'  }}>{fmt.desc}</div>
                                </div>
                                {isSelected && (
                                    <span style={{ 
                                        background: 'rgba(255,255,255,0.2)', color: 'white',
                                        padding: '4px 12px', borderRadius: '99px',
                                        fontSize: '12px', fontWeight: '700', whiteSpace: 'nowrap'
                                     }}>
                                        ✓ {t('settings.billFormat.selected', 'Selected')}
                                    </span>
                                )}
                            </div>

                            {/* Actual bill preview */}
                            <div style={{ color: 'black', 
                                padding: '16px',
                                background: '#f8fafc',
                                overflowX: 'auto',
                                minHeight: '300px',
                                position: 'relative'
                             }}>
                                <div style={{ color: 'black',  transform: 'scale(0.85)', transformOrigin: 'top center'  }}>
                                    {fmt.preview}
                                </div>
                            </div>

                            {/* Select button */}
                            <div style={{ color: 'black',  padding: '12px 16px', borderTop: '1px solid #f1f5f9', background: 'white', textAlign: 'center'  }}>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleSelect(fmt.id); }}
                                    style={{
                                        padding: '10px 32px',
                                        background: isSelected ? 'linear-gradient(135deg, #4338ca, #6366f1)' : '#f3f4f6',
                                        color: isSelected ? 'white' : '#374151',
                                        border: 'none', borderRadius: '12px',
                                        fontWeight: '700', fontSize: '14px', cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        boxShadow: isSelected ? '0 4px 12px rgba(99,102,241,0.3)' : 'none'
                                    }}
                                >
                                    {isSelected
                                        ? t('settings.billFormat.selected', '✓ Selected')
                                        : t('settings.billFormat.selectThis', 'Select This Format')}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
