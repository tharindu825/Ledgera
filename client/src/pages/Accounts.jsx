import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAccounts, createAccount, updateAccount, deleteAccount } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getCurrency } from '../utils/currency';
import { confirmToast } from '../utils/confirmToast';
import toast from 'react-hot-toast';
import {
    Plus, X, Pencil, Trash2, Eye,
    Wallet, Landmark, CreditCard, Smartphone,
    PiggyBank, Coins, Home, Banknote, Diamond, Save
} from 'lucide-react';

const ACCOUNT_ICONS = [
    { icon: Banknote, label: 'Cash' },
    { icon: Landmark, label: 'Bank' },
    { icon: CreditCard, label: 'Card' },
    { icon: Smartphone, label: 'Digital' },
    { icon: Wallet, label: 'Wallet' },
    { icon: PiggyBank, label: 'Savings' },
    { icon: Coins, label: 'Coins' },
    { icon: Home, label: 'Home' },
];

const ACCOUNT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'];

export default function Accounts() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const curr = getCurrency(user?.currency || 'LKR');
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [editingAcc, setEditingAcc] = useState(null);
    const [form, setForm] = useState({ name: '', balance: '', icon: 'Bank', color: '#3b82f6' });

    useEffect(() => { fetchAccounts(); }, []);

    const fetchAccounts = async () => {
        setLoading(true);
        try {
            const res = await getAccounts();
            setAccounts(res.data);
        } catch {
            toast.error('Failed to load accounts');
        } finally {
            setLoading(false);
        }
    };

    const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return toast.error('Account name is required');
        try {
            if (editingAcc) {
                await updateAccount(editingAcc._id, form);
                toast.success('Account updated!');
            } else {
                await createAccount(form);
                toast.success('Account created!');
            }
            setShowAdd(false);
            setEditingAcc(null);
            setForm({ name: '', balance: '', icon: 'Bank', color: '#3b82f6' });
            fetchAccounts();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to save account');
        }
    };

    const handleEdit = (acc) => {
        setEditingAcc(acc);
        setForm({ name: acc.name, balance: acc.balance, icon: acc.icon, color: acc.color });
        setShowAdd(true);
    };

    const handleDelete = async (acc) => {
        if (acc.isDefault) return toast.error('Cannot delete the default Cash account');
        const confirmed = await confirmToast(`Delete "${acc.name}" account?`);
        if (!confirmed) return;
        try {
            await deleteAccount(acc._id);
            toast.success('Account deleted');
            fetchAccounts();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to delete');
        }
    };

    const cancelForm = () => {
        setShowAdd(false);
        setEditingAcc(null);
        setForm({ name: '', balance: '', icon: 'Bank', color: '#3b82f6' });
    };

    if (loading) return <div className="loading-page"><div className="spinner" /></div>;

    return (
        <div className="slide-up">
            {/* ── Page Header ─────────────────────────────────────────────── */}
            <div className="page-header">
                <div>
                    <h2>Accounts</h2>
                    <p className="page-header-sub" style={{ fontSize: 13, color: '#64748b' }}>Bank &amp; wallet management</p>
                </div>
            </div>

            {/* Total Balance Card */}
            <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', border: 'none', color: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>
                            Total Balance
                        </div>
                        <div className="text-responsive-3xl" style={{ fontSize: 36, fontWeight: 900, letterSpacing: -1.5 }}>
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: user?.currency || 'LKR', minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(totalBalance)}
                        </div>
                    </div>
                    <div style={{ opacity: 0.2 }}>
                        <Diamond size={48} />
                    </div>
                </div>
            </div>

            {/* Add / Edit Modal */}
            {showAdd && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 2000,
                    background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
                }}>
                    <div className="modal-container" style={{
                        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 24,
                        width: '100%', maxWidth: 480, padding: 32,
                        boxShadow: '0 25px 60px -12px rgba(15,23,42,0.2)',
                        animation: 'modalSlide 0.3s cubic-bezier(0.16,1,0.3,1)',
                        maxHeight: '90vh', overflowY: 'auto'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <h3 style={{ fontWeight: 800, fontSize: 20, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                {editingAcc ? <><Pencil size={20} /> Edit Account</> : <><Plus size={20} /> New Account</>}
                            </h3>
                            <button onClick={cancelForm} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={24} /></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">Account Name</label>
                                <input className="form-input" placeholder="e.g. BOC, HNB, Cash"
                                    value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                    required disabled={editingAcc?.isDefault} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Initial Balance ({curr.symbol})</label>
                                <input className="form-input" type="number" step="any" min="0" placeholder="e.g. 25000"
                                    value={form.balance} onChange={e => setForm({ ...form, balance: e.target.value })} />
                            </div>

                            {/* Icon Picker */}
                            <div className="form-group">
                                <label className="form-label">Icon</label>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {ACCOUNT_ICONS.map(ic => {
                                        const IconComp = ic.icon;
                                        return (
                                            <button key={ic.label} type="button" onClick={() => setForm({ ...form, icon: ic.label })} style={{
                                                width: 44, height: 44, borderRadius: 12, border: form.icon === ic.label ? '2px solid #0f172a' : '1px solid #e2e8f0',
                                                background: form.icon === ic.label ? '#f1f5f9' : '#fff', cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s'
                                            }}>
                                                <IconComp size={20} color={form.icon === ic.label ? '#0f172a' : '#64748b'} />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Color Picker */}
                            <div className="form-group">
                                <label className="form-label">Color</label>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {ACCOUNT_COLORS.map(c => (
                                        <button key={c} type="button" onClick={() => setForm({ ...form, color: c })} style={{
                                            width: 32, height: 32, borderRadius: 10, background: c, border: form.color === c ? '3px solid #0f172a' : '2px solid transparent',
                                            cursor: 'pointer', transition: 'all 0.15s', boxShadow: form.color === c ? '0 0 0 2px #fff, 0 0 0 4px #0f172a' : 'none'
                                        }} />
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                                <button type="button" className="btn btn-ghost flex-1" onClick={cancelForm}>Cancel</button>
                                <button type="submit" className="btn btn-primary flex-1">
                                    {editingAcc ? <><Save size={18} /> Save Changes</> : <><Plus size={18} /> Create Account</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Account Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {accounts.map(acc => {
                    const IconComp = ACCOUNT_ICONS.find(i => i.label === acc.icon)?.icon || Landmark;
                    return (
                        <div key={acc._id} className="card" style={{
                            borderLeft: `4px solid ${acc.color}`, position: 'relative', overflow: 'hidden'
                        }}>
                            {/* Decorative circle */}
                            <div style={{
                                position: 'absolute', top: -20, right: -20, width: 80, height: 80,
                                borderRadius: '50%', background: `${acc.color}10`
                            }} />

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{
                                        width: 48, height: 48, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        background: `${acc.color}15`, border: `1px solid ${acc.color}30`, color: acc.color
                                    }}>
                                        <IconComp size={24} />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a' }}>{acc.name}</div>
                                        {acc.isDefault && (
                                            <span style={{ fontSize: 10, color: '#10b981', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                                Default
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(acc)}
                                        style={{ padding: '4px 8px', color: '#3b82f6' }}><Pencil size={16} /></button>
                                    {!acc.isDefault && (
                                        <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(acc)}
                                            style={{ padding: '4px 8px', color: '#f43f5e' }}><Trash2 size={16} /></button>
                                    )}
                                </div>
                            </div>

                            <div>
                                <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 }}>
                                    Available Balance
                                </div>
                                <div style={{ fontSize: 28, fontWeight: 900, color: acc.balance >= 0 ? '#0f172a' : '#ef4444', letterSpacing: -1 }}>
                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: user?.currency || 'LKR', minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(acc.balance)}
                                </div>
                            </div>

                            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <button onClick={() => navigate(`/transactions?accountId=${acc._id}`)} style={{
                                    background: 'transparent', border: 'none', color: '#3b82f6', fontSize: 11, fontWeight: 700,
                                    cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6
                                }}>
                                    <Eye size={14} /> View Transactions
                                </button>
                                <span style={{ fontSize: 11, color: '#94a3b8' }}>
                                    Updated {new Date(acc.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* FAB for Accounts */}
            <div className="fab-container">
                <button className="btn btn-primary" onClick={() => setShowAdd(true)} style={{ width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 30px rgba(15, 23, 42, 0.4)', border: 'none', background: '#0f172a' }}>
                    <Plus size={32} />
                </button>
            </div>
        </div>
    );
}
