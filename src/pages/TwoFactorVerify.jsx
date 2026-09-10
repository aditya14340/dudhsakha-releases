import React, { useEffect, useState } from 'react';
import { Loader2, ShieldCheck, Lock } from 'lucide-react';
import { useAlert } from '../hooks/useAlert';
import loginBg from '../assets/login-bg.png';

export default function TwoFactorVerify({ user, onVerified }) {
  const [loading, setLoading] = useState(false); // Initially false, MojoAuth starts immediately
  const [email, setEmail] = useState(user?.email || '');
  const { showConfirm, AlertComponent } = useAlert();

  useEffect(() => {
    // CRITICAL SECURITY CHECK: User MUST have an email to be here
    // This should also be caught by the login API, but this is a fail-safe
    const checkEmail = async () => {
      if (!user?.email || user.email.trim() === '') {
        await showConfirm('Security Error: Super admin account must have a registered email address. Please contact support.', 'Security Error', 'OK');
        sessionStorage.clear();
        localStorage.clear();
        window.location.reload();
        return;
      }
    };
    checkEmail();

    const MojoAuth = window.MojoAuth;
    if (!MojoAuth) {
      console.error("MojoAuth SDK not loaded from CDN");
      // Note: We can't await here easily inside useEffect synchronous block easily without IIFE, 
      // but the above checkEmail covers the critical part. 
      // For this one, we'll try to show it but it might look odd if it doesn't block.
      // Actually let's use an IIFE for the whole effect logic or separate async function.
      return;
    }

    // Initialize MojoAuth with STRICT email policy
    const mojoauth = new MojoAuth(import.meta.env.VITE_MOJOAUTH_TOKEN, {
      source: [{ type: "email", feature: "otp" }],
      language: {
        title: "DudhSakha Security",
        header_title: "Verify Your Identity",
        footer_text: "Secure Super Admin Access"
      }
    });

    try {
      // Start sign-in process immediately with the locked email
      // We pass the email to signIn if the SDK supports it, or we rely on the user entering 
      // ONLY this email. Since the standard SDK might still show an input, 
      // we must VALIDATE the result rigorously.
      mojoauth.signIn().then(payload => {
        console.log("MojoAuth Success Payload:", payload);

        if (payload && payload.user) {
          const verifiedEmail = payload.user.identifier;
          const expectedEmail = user.email; // STICTLY from database

          // SECURITY BREACH CHECK: Case-insensitive comparison
          if (verifiedEmail.toLowerCase().trim() !== expectedEmail.toLowerCase().trim()) {
            console.error("CRITICAL SECURITY BREACH: Email mismatch!", {
              verified: verifiedEmail,
              expected: expectedEmail
            });

            showConfirm(`Security Error: The verified email (${verifiedEmail}) does not match your registered account email. Access Denied.`, 'Security Error', 'OK')
              .then(() => {
                // Nuking the session is the only safe option here
                sessionStorage.clear();
                localStorage.clear();
                window.location.reload();
              });
            return;
          }

          console.log("Identity verified successfully for:", verifiedEmail);
          onVerified();
        } else {
          console.error("MojoAuth payload invalid");
          setLoading(false);
        }
      }).catch(err => {
        console.error("MojoAuth internal error:", err);
        setLoading(false);
      });
    } catch (e) {
      console.error("MojoAuth Init Error:", e);
      setLoading(false);
    }
  }, [user, onVerified]);

  if (!user) {
    return null;
  }

  return (
    <div className="login-container">
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
        }

        .login-left {
          flex: 1;
          background-image: linear-gradient(135deg, rgba(30, 64, 175, 0.95), rgba(59, 130, 246, 0.9)), url(${loginBg});
          background-size: cover;
          padding: 40px;
          display: flex;
          flex-direction: column;
          color: white;
          justify-content: center;
        }

        .login-right {
          flex: 1;
          padding: 50px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          background: #fff;
        }

        .security-info {
          background: rgba(255, 255, 255, 0.1);
          padding: 20px;
          border-radius: 12px;
          margin-top: 20px;
          backdrop-filter: blur(10px);
        }
        
        .locked-email-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #f1f5f9;
          color: #475569;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 0.9rem;
          margin-bottom: 24px;
          border: 1px solid #e2e8f0;
        }
      `}</style>

      <div className="login-wrapper">
        <div className="login-left">
          <div style={{ marginBottom: '20px' }}>
            <ShieldCheck size={48} color="#fff" />
          </div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '10px' }}>Secure Access</h1>
          <p style={{ fontSize: '1.1rem', opacity: '0.9', lineHeight: '1.5' }}>
            Additional verification required for Super Admin privileges.
          </p>

          <div className="security-info">
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem' }}>Why is this required?</h3>
            <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.8 }}>
              To protect sensitive system data, we require Two-Factor Authentication (2FA) for all administrative sessions.
            </p>
          </div>
        </div>

        <div className="login-right">
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h2 style={{ fontSize: '1.8rem', color: '#1e293b', marginBottom: '8px' }}>Two-Factor Verification</h2>
            <p style={{ color: '#64748b' }}>Enter the OTP sent to your registered email</p>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div className="locked-email-badge">
              <Lock size={14} />
              <strong>{user.email}</strong>
            </div>

            {loading && <Loader2 className="animate-spin" style={{ display: 'block', margin: '0 auto 20px auto' }} />}

            <div id="mojoauth-passwordless-form" style={{ minHeight: '220px' }}></div>

            <button
              onClick={() => {
                sessionStorage.clear();
                localStorage.clear();
                window.location.reload();
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                marginTop: '20px',
                fontSize: '0.9rem',
                textDecoration: 'underline'
              }}
            >
              Cancel and Logout
            </button>
          </div>
        </div>
      </div>
      <AlertComponent />
    </div>
  );
}
