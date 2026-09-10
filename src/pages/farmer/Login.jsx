import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Smartphone, Lock, ArrowRight, Loader2, Milk } from 'lucide-react';
import { useAlert } from '../../hooks/useAlert';
// Farmer login via Supabase Auth — handled by the mobile Milk Analyzer App

function FarmerLogin() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { showAlert, AlertComponent } = useAlert();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        phone: '',
        password: ''
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!formData.phone || !formData.password) {
            showAlert('Please enter both Mobile Number and Password', 'Error', 'error');
            return;
        }

        setLoading(true);
        try {
            // Farmer authentication is handled via Supabase Auth in the Milk Analyzer mobile app.
            // This page is reserved for future desktop farmer portal access.
            showAlert('Farmer login is available in the DudhSakha mobile app.', 'Use Mobile App', 'info');
        } catch (error) {
            console.error(error);
            showAlert(error.message || 'Login failed', 'Error', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            fontFamily: "'Inter', sans-serif"
        }}>
            {/* Logo / Brand */}
            <div style={{ marginBottom: '40px', textAlign: 'center' }}>
                <div style={{
                    width: '80px',
                    height: '80px',
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    borderRadius: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px auto',
                    boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.4)'
                }}>
                    <Milk size={40} color="white" strokeWidth={1.5} />
                </div>
                <h1 style={{
                    fontSize: '28px',
                    fontWeight: '800',
                    color: '#1e3a8a',
                    margin: '0',
                    letterSpacing: '-0.5px'
                }}>
                    DudhSakha
                </h1>
                <p style={{
                    color: '#64748b',
                    marginTop: '8px',
                    fontWeight: '500'
                }}>Farmer App</p>
            </div>

            {/* Login Card */}
            <div style={{
                background: 'white',
                width: '100%',
                maxWidth: '360px',
                borderRadius: '24px',
                padding: '32px 24px',
                boxShadow: '0 20px 40px -5px rgba(0, 0, 0, 0.05)'
            }}>
                <form onSubmit={handleLogin}>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{
                            display: 'block',
                            fontSize: '13px',
                            fontWeight: '600',
                            color: '#475569',
                            marginBottom: '8px',
                            marginLeft: '4px'
                        }}>
                            Mobile Number
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Smartphone size={20} color="#94a3b8" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                placeholder="Enter mobile number"
                                style={{
                                    width: '100%',
                                    padding: '14px 16px 14px 48px',
                                    borderRadius: '16px',
                                    border: '2px solid #f1f5f9',
                                    fontSize: '15px',
                                    fontWeight: '500',
                                    color: '#0f172a',
                                    outline: 'none',
                                    transition: 'border-color 0.2s',
                                    backgroundColor: '#f8fafc'
                                }}
                                onFocus={(e) => {
                                    e.target.style.borderColor = '#3b82f6';
                                    e.target.style.backgroundColor = 'white';
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = '#f1f5f9';
                                    e.target.style.backgroundColor = '#f8fafc';
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: '32px' }}>
                        <label style={{
                            display: 'block',
                            fontSize: '13px',
                            fontWeight: '600',
                            color: '#475569',
                            marginBottom: '8px',
                            marginLeft: '4px'
                        }}>
                            Password
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={20} color="#94a3b8" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="Enter your password"
                                style={{
                                    width: '100%',
                                    padding: '14px 16px 14px 48px',
                                    borderRadius: '16px',
                                    border: '2px solid #f1f5f9',
                                    fontSize: '15px',
                                    fontWeight: '500',
                                    color: '#0f172a',
                                    outline: 'none',
                                    transition: 'border-color 0.2s',
                                    backgroundColor: '#f8fafc'
                                }}
                                onFocus={(e) => {
                                    e.target.style.borderColor = '#3b82f6';
                                    e.target.style.backgroundColor = 'white';
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = '#f1f5f9';
                                    e.target.style.backgroundColor = '#f8fafc';
                                }}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '16px',
                            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '16px',
                            fontSize: '16px',
                            fontWeight: '600',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                            opacity: loading ? 0.8 : 1
                        }}
                    >
                        {loading ? (
                            <>
                                <Loader2 size={20} className="animate-spin" />
                                Please wait...
                            </>
                        ) : (
                            <>
                                Login
                                <ArrowRight size={20} />
                            </>
                        )}
                    </button>
                </form>
            </div>

            <p style={{
                marginTop: '32px',
                color: '#94a3b8',
                fontSize: '12px',
                textAlign: 'center',
                maxWidth: '250px',
                lineHeight: '1.5'
            }}>
                Protected by DudhSakha Security.
                <br />
                &copy; 2026 DudhSakha
            </p>

            <AlertComponent />
        </div>
    );
}

export default FarmerLogin;
