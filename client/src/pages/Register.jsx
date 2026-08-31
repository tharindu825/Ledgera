import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { register as registerApi } from '../services/api';
import { currencies } from '../utils/currency';
import toast from 'react-hot-toast';
import logo from '../assets/Legera Logo.png';

export default function Register() {
    const [form, setForm] = useState({
        name: '', email: '', password: '', confirmPassword: '',
        familySize: '1', currency: 'LKR'
    });
    const [loading, setLoading] = useState(false);
    const { loginUser } = useAuth();
    const navigate = useNavigate();

    const handleChange = (e) => {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (form.password !== form.confirmPassword) {
            return toast.error('Passwords do not match');
        }
        if (form.password.length < 6) {
            return toast.error('Password must be at least 6 characters');
        }
        setLoading(true);
        try {
            const res = await registerApi({
                name: form.name,
                email: form.email,
                password: form.password,
                familySize: parseInt(form.familySize) || 1,
                currency: form.currency
            });

            // If pending access, redirect to login with message
            if (res.data.pendingAccess) {
                toast.success(res.data.message || 'Account created! Waiting for admin access.');
                navigate('/login');
                return;
            }

            loginUser(res.data.token, res.data.user);
            toast.success('Account created! Welcome! 🎉');
            navigate('/');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page fade-in">
            <div className="auth-popup-box">
                <div className="auth-visual">
                    <div className="auth-visual-dots" />
                    <div className="auth-visual-content">
                        <div style={{ marginBottom: 40 }}>
                            <img src={logo} alt="Ledgera" style={{ width: 120, height: 120, objectFit: 'contain', filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.2))' }} />
                        </div>
                        <h2>Join the <br />Executive <br />Elite.</h2>
                        <p style={{ fontSize: 20, opacity: 0.8 }}>Experience the future of personal wealth management. Automate your tracking, analyze your habits, and secure your future with Ledgera.</p>
                    </div>
                </div>

                <div className="auth-form-container" style={{ padding: '16px 40px' }}>
                    <div className="auth-form-box" style={{ maxWidth: 480, padding: '12px 0', border: 'none' }}>
                        <div className="auth-header-mini" style={{ marginBottom: 16 }}>
                            <h1 style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', marginBottom: 2 }}>Register</h1>
                            <p style={{ color: '#64748b', fontSize: 13 }}>Create your executive account to get started.</p>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="form-group" style={{ marginBottom: 12 }}>
                                <label className="form-label">Full Name</label>
                                <input
                                    id="register-name"
                                    type="text"
                                    className="form-input"
                                    placeholder="John Doe"
                                    name="name"
                                    value={form.name}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: 12 }}>
                                <label className="form-label">Email Address</label>
                                <input
                                    id="register-email"
                                    type="email"
                                    className="form-input"
                                    placeholder="name@company.com"
                                    name="email"
                                    value={form.email}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group" style={{ marginBottom: 12 }}>
                                    <label className="form-label">Password</label>
                                    <input
                                        id="register-password"
                                        type="password"
                                        className="form-input"
                                        placeholder="••••••••"
                                        name="password"
                                        value={form.password}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                                <div className="form-group" style={{ marginBottom: 12 }}>
                                    <label className="form-label">Confirm</label>
                                    <input
                                        id="register-confirm-password"
                                        type="password"
                                        className="form-input"
                                        placeholder="••••••••"
                                        name="confirmPassword"
                                        value={form.confirmPassword}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group" style={{ marginBottom: 12 }}>
                                    <label className="form-label">Family Size</label>
                                    <select
                                        id="register-family-size"
                                        className="form-select"
                                        name="familySize"
                                        value={form.familySize}
                                        onChange={handleChange}
                                    >
                                        {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                                            <option key={n} value={n}>{n} {n === 1 ? 'person' : 'people'}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group" style={{ marginBottom: 12 }}>
                                    <label className="form-label">Curr</label>
                                    <select
                                        id="register-currency"
                                        className="form-select"
                                        name="currency"
                                        value={form.currency}
                                        onChange={handleChange}
                                    >
                                        {currencies.map(c => (
                                            <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <button
                                id="register-submit"
                                type="submit"
                                className="btn btn-primary btn-lg"
                                style={{ width: '100%', marginTop: 8 }}
                                disabled={loading}
                            >
                                {loading ? <span className="spinner" style={{ width: 18, height: 18 }}></span> : 'Create Account'}
                            </button>
                        </form>

                        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 14, color: '#64748b' }}>
                            Already have an account? <Link to="/login" style={{ color: '#0f172a', fontWeight: 700 }}>Sign in instead</Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
