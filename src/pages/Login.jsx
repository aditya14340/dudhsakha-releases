import React, { useState } from 'react';
import { User, Lock, Loader2, ArrowRight, Building2, Eye, EyeOff } from 'lucide-react';
import { login } from '../lib/api';
import loginBg from '../assets/login-bg.png';

export default function Login({ onLogin }) {
  const [loginType, setLoginType] = useState('admin'); // 'admin' or 'employee'
  const [email, setEmail] = useState('');
  const [dairyId, setDairyId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {


      let finalUsername = email;

      const credentials = {
        username: finalUsername,
        password: password,
        role: loginType, // 'admin' or 'employee'
        dairyCode: dairyId // Optional, for employee
      };

      const result = await login(credentials);

      if (result.success) {
        if (result.user.role === 'super_admin') {
          throw new Error("Super Admin access has been moved to a separate application for enhanced security. Please use the Super Admin Portal.");
        }
        console.log("Login successful");
        onLogin(result.user);
      } else {
        throw new Error(result.error || "Invalid credentials");
      }

    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-wrapper">
        <div className="login-left">
          <div className="login-header">
            <h1 className="login-title">DudhSakha</h1>
            <p className="login-subtitle">Advanced Milk Management System</p>
          </div>
          <div className="login-intro">
            <h2>Welcome Back</h2>
            <p>Please log in to your account to continue.</p>
          </div>
        </div>

        <div className="login-right">
          <div className="login-box">
            <div className="login-box-header">
              <h2>Login</h2>
              <p>Enter your credentials to access the dashboard</p>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', padding: '4px', background: '#f1f5f9', borderRadius: '12px' }}>
              <button
                type="button"
                onClick={() => { setLoginType('admin'); setError(''); }}
                style={{
                  flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                  background: loginType === 'admin' ? 'white' : 'transparent',
                  color: loginType === 'admin' ? '#2563eb' : '#64748b',
                  fontWeight: '600', cursor: 'pointer', boxShadow: loginType === 'admin' ? '0 2px 5px rgba(0,0,0,0.05)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => { setLoginType('employee'); setError(''); }}
                style={{
                  flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                  background: loginType === 'employee' ? 'white' : 'transparent',
                  color: loginType === 'employee' ? '#2563eb' : '#64748b',
                  fontWeight: '600', cursor: 'pointer', boxShadow: loginType === 'employee' ? '0 2px 5px rgba(0,0,0,0.05)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                Employee
              </button>
            </div>

            {error && <div className="login-error">{error}</div>}

            <form onSubmit={handleSubmit} className="login-form">
              {loginType === 'employee' && (
                <div className="input-group">
                  <label htmlFor="dairyId">Dairy Code</label>
                  <div className="input-field">
                    <Building2 size={18} className="input-icon" />
                    <input
                      type="text"
                      id="dairyId"
                      placeholder="Enter 4-digit Code"
                      value={dairyId}
                      onChange={(e) => setDairyId(e.target.value)}
                      required
                      maxLength={4}
                    />
                  </div>
                </div>
              )}

              <div className="input-group">
                <label htmlFor="email">{loginType === 'admin' ? 'Username' : 'Username'}</label>
                <div className="input-field">
                  <User size={18} className="input-icon" />
                  <input
                    type="text" // changed from email to text for username support
                    id="email"
                    placeholder={loginType === 'admin' ? "Username or Email" : "Enter username"}
                    value={email}
                    onChange={(e) => setEmail(e.target.value.trim())}
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="password">Password</label>
                <div className="input-field">
                  <Lock size={18} className="input-icon" />
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#94a3b8',
                      padding: 0,
                      display: 'flex'
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="login-btn" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 size={20} className="spinner" />
                    <span>{'Logging in...'}</span>
                  </>
                ) : (
                  <>
                    <span>{`Login as ${loginType === 'admin' ? 'Admin' : 'Employee'}`}</span>
                    <ArrowRight size={20} />
                  </>
                )}
              </button>
            </form>

            <div className="login-footer">
              <p>Powered by DudhSakha v6.0.4</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .login-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          width: 100%;
          background: #f0f4f8;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          position: relative;
          overflow: hidden;
        }

        .login-container::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: url(${loginBg});
          background-size: cover;
          background-position: center;
          filter: blur(8px);
          opacity: 0.5;
          z-index: 0;
        }

        .login-wrapper {
          display: flex;
          width: 900px;
          height: 600px;
          background: #ffffff;
          border-radius: 20px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15);
          overflow: hidden;
          z-index: 1;
          position: relative;
          animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideUp {
          from { transform: translateY(50px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .login-left {
          flex: 1;
          background-image: linear-gradient(135deg, rgba(30, 64, 175, 0.9), rgba(59, 130, 246, 0.8)), url(${loginBg});
          background-size: cover;
          background-position: center;
          padding: 40px;
          display: flex;
          flex-direction: column;
          color: white;
          position: relative;
        }

        .login-header {
          margin-bottom: auto;
        }

        .login-title {
          font-size: 2.5rem;
          font-weight: 800;
          margin: 0;
          color: #fff;
          letter-spacing: -0.5px;
        }

        .login-subtitle {
          margin-top: 5px;
          opacity: 0.9;
          font-size: 0.95rem;
          font-weight: 400;
        }

        .login-intro h2 {
          font-size: 2rem;
          margin-bottom: 10px;
        }

        .login-intro p {
          opacity: 0.9;
          line-height: 1.5;
        }

        .login-right {
          flex: 1;
          padding: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .login-box {
          width: 100%;
          max-width: 320px;
        }

        .login-box-header {
          margin-bottom: 30px;
          text-align: center;
        }

        .login-box-header h2 {
          font-size: 1.8rem;
          color: #1e293b;
          margin-bottom: 8px;
        }

        .login-box-header p {
          color: #64748b;
          font-size: 0.9rem;
        }

        .input-group {
          margin-bottom: 20px;
        }

        .input-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
          color: #475569;
          font-size: 0.9rem;
        }

        .input-field {
          position: relative;
        }

        .input-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
        }

        .input-field input {
          width: 100%;
          padding: 12px 12px 12px 40px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          font-size: 0.95rem;
          transition: all 0.2s;
          outline: none;
        }

        .input-field input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .login-btn {
          width: 100%;
          padding: 12px;
          background: linear-gradient(135deg, #2563eb, #3b82f6);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: transform 0.1s, box-shadow 0.2s;
        }

        .login-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }

        .login-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .login-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .login-error {
          background: #fecaca;
          color: #991b1b;
          padding: 10px;
          border-radius: 6px;
          font-size: 0.9rem;
          margin-bottom: 20px;
          text-align: center;
        }

        .login-footer {
            margin-top: 30px;
            text-align: center;
            font-size: 0.8rem;
            color: #94a3b8;
        }
      `}</style>
    </div>
  );
}
