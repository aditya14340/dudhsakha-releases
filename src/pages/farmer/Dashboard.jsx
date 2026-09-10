import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Home, FileText, IndianRupee, Bell, Menu } from 'lucide-react';
import { useAlert } from '../../hooks/useAlert';

// Simple Bottom Nav Component
const BottomNav = ({ activeTab, onTabChange }) => (
    <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'white',
        display: 'flex',
        justifyContent: 'space-around',
        padding: '12px 0',
        boxShadow: '0 -2px 10px rgba(0,0,0,0.05)',
        zIndex: 1000
    }}>
        <button onClick={() => onTabChange('home')} style={{ background: 'none', border: 'none', color: activeTab === 'home' ? '#2563eb' : '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '10px' }}>
            <Home size={24} />
            <span style={{ marginTop: '4px' }}>Home</span>
        </button>
        <button onClick={() => onTabChange('milk')} style={{ background: 'none', border: 'none', color: activeTab === 'milk' ? '#2563eb' : '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '10px' }}>
            <FileText size={24} />
            <span style={{ marginTop: '4px' }}>My Milk</span>
        </button>
        <button onClick={() => onTabChange('money')} style={{ background: 'none', border: 'none', color: activeTab === 'money' ? '#2563eb' : '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '10px' }}>
            <IndianRupee size={24} />
            <span style={{ marginTop: '4px' }}>Payments</span>
        </button>
    </div>
);

function FarmerDashboard() {
    const navigate = useNavigate();
    const { showConfirm, AlertComponent } = useAlert();
    const [user, setUser] = useState(null);
    const [activeTab, setActiveTab] = useState('home');

    useEffect(() => {
        const storedUser = localStorage.getItem('farmer_user');
        if (!storedUser) {
            navigate('/farmer/login');
        } else {
            setUser(JSON.parse(storedUser));
        }
    }, [navigate]);

    const handleLogout = async () => {
        const confirmed = await showConfirm('Are you sure you want to logout?', 'Logout', 'Yes, Logout', 'Cancel');
        if (confirmed) {
            localStorage.removeItem('farmer_user');
            navigate('/farmer/login');
        }
    };

    if (!user) return null;

    return (
        <div style={{
            minHeight: '100vh',
            background: '#f8fafc',
            fontFamily: "'Inter', sans-serif",
            paddingBottom: '80px' // Space for bottom nav
        }}>
            {/* Header */}
            <header style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: 'white',
                padding: '20px',
                borderRadius: '0 0 24px 24px',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                        <h1 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>DudhSakha</h1>
                        <p style={{ fontSize: '13px', opacity: 0.9, marginTop: '2px' }}>Welcome, {user.name}</p>
                    </div>
                    <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', padding: '8px', borderRadius: '50%', color: 'white' }}>
                        <LogOut size={20} />
                    </button>
                </div>

                {/* Summary Card (Example) */}
                <div style={{
                    background: 'white',
                    color: '#1e293b',
                    padding: '16px',
                    borderRadius: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}>
                    <div>
                        <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Today's Milk</p>
                        <p style={{ fontSize: '24px', fontWeight: '700', color: '#2563eb', margin: '4px 0 0 0' }}>-- L</p>
                    </div>
                    <div style={{ height: '32px', width: '1px', background: '#e2e8f0' }}></div>
                    <div>
                        <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Avg Fat</p>
                        <p style={{ fontSize: '24px', fontWeight: '700', color: '#059669', margin: '4px 0 0 0' }}>--</p>
                    </div>
                    <div style={{ height: '32px', width: '1px', background: '#e2e8f0' }}></div>
                    <div>
                        <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Est. Amt</p>
                        <p style={{ fontSize: '24px', fontWeight: '700', color: '#d97706', margin: '4px 0 0 0' }}>₹ --</p>
                    </div>
                </div>
            </header>

            {/* Content Area */}
            <div style={{ padding: '20px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#334155', marginBottom: '16px' }}>Quick Actions</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ background: 'white', padding: '16px', borderRadius: '16px', textAlign: 'center' }}>
                        <FileText size={32} color="#3b82f6" style={{ marginBottom: '8px' }} />
                        <p style={{ margin: 0, fontSize: '13px', fontWeight: '600' }}>View Log</p>
                    </div>
                    <div style={{ background: 'white', padding: '16px', borderRadius: '16px', textAlign: 'center' }}>
                        <IndianRupee size={32} color="#10b981" style={{ marginBottom: '8px' }} />
                        <p style={{ margin: 0, fontSize: '13px', fontWeight: '600' }}>Payments</p>
                    </div>
                </div>
            </div>

            <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
            <AlertComponent />
        </div>
    );
}

export default FarmerDashboard;
