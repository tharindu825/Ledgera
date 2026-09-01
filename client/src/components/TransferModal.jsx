import { useState, useEffect } from 'react';
import { createTransfer } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getCurrency } from '../utils/currency';
import toast from 'react-hot-toast';
import {
    X, ArrowRight, Wallet, AlertCircle, CheckCircle, ArrowLeftRight
} from 'lucide-react';

export default function TransferModal({ accounts, onClose, onSuccess }) {
    const { user } = useAuth();
    const curr = getCurrency(user?.currency || 'LKR');

    const [form, setForm] = useState({
        fromAccountId: '',
        toAccountId: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        note: ''
    });
    const [loading, setLoading] = useState(false);

    // Auto-select the first account as "from"
    useEffect(() => {
        if (accounts.length > 0) {
            setForm(f => ({ ...f, fromAccountId: accounts[0]._id }));
        }
        if (accounts.length > 1) {
            setForm(f => ({ ...f, toAccountId: accounts[1]._id }));
        }
    }, [accounts]);

    const fromAcc = accounts.find(a => a._id === form.fromAccountId);
    const toAcc = accounts.find(a => a._id === form.toAccountId);
    const numAmount = parseFloat(form.amount) || 0;
    const isInsufficient = fromAcc && numAmount > fromAcc.balance;
    const isSameAccount = form.fromAccountId && form.fromAccountId === form.toAccountId;
    const canSubmit = form.fromAccountId && form.toAccountId && numAmount > 0 && !isInsufficient && !isSameAccount;

    const fmt = (val) => new Intl.NumberFormat('en-US', {
        style: 'currency', currency: user?.currency || 'LKR',
        minimumFractionDigits: 2, maximumFractionDigits: 2
    }).format(val);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!canSubmit) return;
        setLoading(true);
        try {
            await createTransfer({
                fromAccountId: form.fromAccountId,
                toAccountId: form.toAccountId,
                amount: numAmount,
                date: form.date,
                note: form.note
            });
            toast.success(`Transferred ${fmt(numAmount)} from "${fromAcc?.name}" to "${toAcc?.name}"`);
            onSuccess?.();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.message || err.response?.data?.error || 'Transfer failed');
        } finally {
            setLoading(false);
        }
    };

    const swapAccounts = () => {
        setForm(f => ({ ...f, fromAccountId: f.toAccountId, toAccountId: f.fromAccountId }));
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
            <div style={{
                background: '#fff', borderRadius: 28, width: '100%', maxWidth: 520,
                boxShadow: '0 32px 80px -12px rgba(15,23,42,0.35)',
                animation: 'modalSlide 0.3s cubic-bezier(0.16,1,0.3,1)',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                    padding: '28px 32px 24px',
                    position: 'relative'
                }}>
                    <button onClick={onClose} style={{
                        position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.1)',
                        border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <X size={18} />
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <ArrowLeftRight size={22} color="#fff" />
                        </div>
                        <div>
                            <h3 style={{ color: '#fff', fontWeight: 900, fontSize: 20, margin: 0 }}>Transfer Money</h3>
                            <p style={{ color: '#94a3b8', fontSize: 13, margin: '2px 0 0' }}>Move funds between accounts</p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} style={{ padding: '28px 32px' }}>

                    {/* From → To visual */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>From</label>
                            <select
                                value={form.fromAccountId}
                                onChange={e => setForm(f => ({ ...f, fromAccountId: e.target.value }))}
                                className="form-select"
                                style={{ borderRadius: 14, height: 52, fontWeight: 700, fontSize: 14 }}
                                required
                            >
                                <option value="">Select account</option>
                                {accounts.map(a => (
                                    <option key={a._id} value={a._id}>{a.name} ({fmt(a.balance)})</option>
                                ))}
                            </select>
                        </div>

                        <button type="button" onClick={swapAccounts} style={{
                            width: 44, height: 44, borderRadius: 12, border: '2px solid #e2e8f0',
                            background: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', flexShrink: 0, marginTop: 24, transition: 'all 0.2s',
                            color: '#64748b'
                        }}
                            title="Swap accounts"
                        >
                            <ArrowLeftRight size={16} />
                        </button>

                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>To</label>
                            <select
                                value={form.toAccountId}
                                onChange={e => setForm(f => ({ ...f, toAccountId: e.target.value }))}
                                className="form-select"
                                style={{ borderRadius: 14, height: 52, fontWeight: 700, fontSize: 14 }}
                                required
                            >
                                <option value="">Select account</option>
                                {accounts.map(a => (
                                    <option key={a._id} value={a._id}>{a.name} ({fmt(a.balance)})</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Validation warnings */}
                    {isSameAccount && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#fef3c7', borderRadius: 12, padding: '10px 14px', marginBottom: 16, border: '1px solid #f59e0b' }}>
                            <AlertCircle size={16} color="#d97706" />
                            <span style={{ fontSize: 13, color: '#92400e', fontWeight: 600 }}>Cannot transfer to the same account</span>
                        </div>
                    )}
                    {isInsufficient && !isSameAccount && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#fef2f2', borderRadius: 12, padding: '10px 14px', marginBottom: 16, border: '1px solid #fca5a5' }}>
                            <AlertCircle size={16} color="#ef4444" />
                            <span style={{ fontSize: 13, color: '#b91c1c', fontWeight: 600 }}>
                                Insufficient funds. Balance: {fmt(fromAcc?.balance || 0)}
                            </span>
                        </div>
                    )}

                    {/* Amount */}
                    <div className="form-group">
                        <label className="form-label">Amount ({curr.symbol})</label>
                        <input
                            type="number" step="any" min="0.01"
                            className="form-input"
                            placeholder={`e.g. 5,000`}
                            value={form.amount}
                            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                            style={{ fontWeight: 800, fontSize: 20, height: 60, borderRadius: 16, borderColor: isInsufficient ? '#fca5a5' : undefined }}
                            required
                        />
                    </div>

                    {/* Date & Note */}
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Date</label>
                            <input type="date" className="form-input" value={form.date}
                                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Note (optional)</label>
                            <input type="text" className="form-input" placeholder="e.g. Monthly savings"
                                value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
                        </div>
                    </div>

                    {/* Transfer Preview */}
                    {fromAcc && toAcc && numAmount > 0 && !isSameAccount && (
                        <div style={{
                            background: 'linear-gradient(135deg, #f0fdf4 0%, #f8fafc 100%)',
                            border: '1px solid #d1fae5', borderRadius: 16, padding: '16px 20px', marginBottom: 20
                        }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: '#064e3b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                                Transfer Preview
                            </div>
                            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{fromAcc.name}</div>
                                    <div style={{ fontSize: 16, fontWeight: 900, color: isInsufficient ? '#ef4444' : '#0f172a' }}>
                                        {fmt(fromAcc.balance - numAmount)}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#94a3b8' }}>after transfer</div>
                                </div>
                                <ArrowRight size={18} color="#10b981" />
                                <div style={{ flex: 1, textAlign: 'right' }}>
                                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{toAcc.name}</div>
                                    <div style={{ fontSize: 16, fontWeight: 900, color: '#10b981' }}>
                                        {fmt(toAcc.balance + numAmount)}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#94a3b8' }}>after transfer</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Buttons */}
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button type="button" className="btn btn-ghost flex-1" onClick={onClose}>Cancel</button>
                        <button
                            type="submit"
                            className="btn btn-primary flex-1"
                            disabled={!canSubmit || loading}
                            style={{ gap: 8, background: canSubmit ? '#0f172a' : undefined }}
                        >
                            {loading ? 'Processing...' : (
                                <><ArrowLeftRight size={16} /> Transfer {numAmount > 0 ? fmt(numAmount) : ''}</>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
