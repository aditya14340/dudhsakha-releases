import React from 'react';
import { Loader2 } from 'lucide-react';

const Loader = ({ text = "Loading..." }) => {
    return (
        <div className="loader-container" style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            minHeight: '200px',
            width: '100%',
            color: '#64748b'
        }}>
            <Loader2 className="animate-spin" size={40} style={{ marginBottom: '16px', color: '#4f46e5' }} />
            <p style={{ fontSize: '0.9rem', fontWeight: '500' }}>{text}</p>
            <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
        </div>
    );
};

export default Loader;
