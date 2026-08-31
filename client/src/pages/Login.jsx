import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login as loginApi } from '../services/api';
import toast from 'react-hot-toast';
import logo from '../assets/Legera Logo.png';
import { ShieldAlert, X } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [accessDeniedMsg, setAccessDeniedMsg] = useState(null);
    const { loginUser } = useAuth();
    const navigate = useNavigate();

    // Check for access denied message from interceptor redirect
    useEffect(() => {
        const msg = localStorage.getItem('access_denied_message');
        if (msg) {
            setAccessDeniedMsg(msg);
            localStorage.removeItem('access_denied_message');
        }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await loginApi({ email, password });

            // Registration pending access
            if (res.data.pendingAccess) {
                setAccessDeniedMsg(res.data.message);
                return;
            }

            loginUser(res.data.token, res.data.user);
            toast.success('Welcome back! 🎉');
            navigate('/');
        } catch (err) {
            const errorCode = err.response?.data?.error;
            const errorMsg = err.response?.data?.message;

            if (errorCode === 'ACCESS_DENIED' || errorCode === 'ACCESS_EXPIRED') {
                setAccessDeniedMsg(errorMsg);
            } else {
                toast.error(errorMsg || errorCode || 'Login failed');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page fade-in">
            {/* Access Denied Modal */}
            {accessDeniedMsg && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 9999,
                    background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(12px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
                }}>
                    <div style={{
                        background: '#ffffff', borderRadius: 24, padding: '40px 32px', textAlign: 'center',
                        maxWidth: 420, width: '100%',
                        boxShadow: '0 25px 60px rgba(15, 23, 42, 0.25)',
                        animation: 'modalSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                        border: '1px solid #fecaca'
                    }}>
                        <div style={{
                            width: 64, height: 64, borderRadius: '50%', margin: '0 auto 20px',
                            background: 'linear-gradient(135deg, #fef2f2, #fee2e2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <ShieldAlert size={32} color="#ef4444" />
                        </div>
                        <h3 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', marginBottom: 12 }}>
                            Access Denied
                        </h3>
                        <p style={{ fontSize: 15, color: '#64748b', lineHeight: 1.6, marginBottom: 24 }}>
                            {accessDeniedMsg}
                        </p>
                        <div style={{
                            background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: 12, padding: '12px 16px',
                            fontSize: 13, color: '#92400e', fontWeight: 600, marginBottom: 24
                        }}>
                            📧 Please contact your system administrator for access.
                        </div>
                        <button
                            onClick={() => setAccessDeniedMsg(null)}
                            className="btn btn-primary"
                            style={{ width: '100%', borderRadius: 14, height: 48 }}
                        >
                            OK, Got It
                        </button>
                    </div>
                </div>
            )}

            <div className="auth-popup-box">
                <div className="auth-visual">
                    <div className="auth-visual-dots" />
                    <div className="auth-visual-content">
                        <div style={{ marginBottom: 40 }}>
                            <img src={logo} alt="Ledgera" style={{ width: 120, height: 120, objectFit: 'contain', filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.2))' }} />
                        </div>
                        <h2>Master Your <br />Wealth with <br />Precision.</h2>
                        <p style={{ fontSize: 20, opacity: 0.8 }}>Ledgera provides executive-level financial clarity, helping you track assets, manage debts, and optimize your grocery spending with AI.</p>
                    </div>
                </div>

                <div className="auth-form-container">
                    <div className="auth-form-box" style={{ padding: 48, border: 'none' }}>
                        <div className="auth-header-mini">
                            <h1 style={{ fontSize: 32, fontWeight: 900, color: '#0f172a', marginBottom: 8 }}>Sign In</h1>
                            <p style={{ color: '#64748b', fontSize: 16 }}>Welcome back! Please enter your credentials.</p>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">Email Address</label>
                                <input
                                    id="login-email"
                                    type="email"
                                    className="form-input"
                                    placeholder="name@company.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Password</label>
                                <input
                                    id="login-password"
                                    type="password"
                                    className="form-input"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>

                            <button
                                id="login-submit"
                                type="submit"
                                className="btn btn-primary btn-lg"
                                style={{ width: '100%', marginTop: 8 }}
                                disabled={loading}
                            >
                                {loading ? <span className="spinner" style={{ width: 18, height: 18 }}></span> : 'Sign In'}
                            </button>
                        </form>

                        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 14, color: '#64748b' }}>
                            Don't have an account? <Link to="/register" style={{ color: '#0f172a', fontWeight: 700 }}>Start for free</Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
