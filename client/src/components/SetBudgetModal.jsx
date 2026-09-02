import { useState } from 'react';
import { updateCategoryBudget } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getCurrency } from '../utils/currency';
import toast from 'react-hot-toast';

export default function SetBudgetModal({ category, month, year, onClose, onSaved }) {
    const { user } = useAuth();
    const curr = getCurrency(user?.currency || 'LKR');
    const [amount, setAmount] = useState(category.budgetLimit > 0 ? category.budgetLimit.toString() : '');
    const [applyToBase, setApplyToBase] = useState(true);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        const val = parseFloat(amount);
        if (!val || val <= 0) return toast.error('Enter a valid budget amount');
        setSaving(true);
        try {
            await updateCategoryBudget(category._id, month, year, val, applyToBase);
            toast.success(`Budget set for ${category.mainCategory}`);
            onSaved();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to save budget');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} onClick={onClose}>
            <div onClick={e => e.stopPropagation()} style={{
                background: '#fff', borderRadius: 24, padding: '32px 28px',
                width: '100%', maxWidth: 420, boxShadow: '0 25px 60px rgba(0,0,0,0.18)',
                animation: 'slideUp 0.2s ease'
            }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
                    <div style={{
                        width: 48, height: 48, borderRadius: 14,
                        background: `${category.color}15`, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontSize: 22
                    }}>
                        {category.icon}
                    </div>
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', textTransform: 'capitalize' }}>
                            {category.mainCategory.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500, marginTop: 2 }}>
                            Set monthly budget limit
                        </div>
                    </div>
                </div>

                {/* Amount input */}
                <div style={{ marginBottom: 20 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>
                        Monthly Budget ({curr.symbol})
                    </label>
                    <div style={{ position: 'relative' }}>
                        <span style={{
                            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                            color: '#64748b', fontWeight: 700, fontSize: 15
                        }}>{curr.symbol}</span>
                        <input
                            type="number"
                            min="0"
                            step="100"
                            autoFocus
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSave()}
                            placeholder="0.00"
                            style={{
                                width: '100%', padding: '14px 14px 14px 36px',
                                border: '2px solid #e2e8f0', borderRadius: 14,
                                fontSize: 18, fontWeight: 700, color: '#0f172a',
                                outline: 'none', boxSizing: 'border-box',
                                transition: 'border-color 0.2s'
                            }}
                            onFocus={e => e.target.style.borderColor = '#6366f1'}
                            onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                        />
                    </div>
                </div>

                {/* Apply to base toggle */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 16px', background: '#f8fafc', borderRadius: 12,
                    marginBottom: 24, cursor: 'pointer'
                }} onClick={() => setApplyToBase(!applyToBase)}>
                    <div style={{
                        width: 20, height: 20, borderRadius: 6,
                        border: `2px solid ${applyToBase ? '#6366f1' : '#d1d5db'}`,
                        background: applyToBase ? '#6366f1' : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s', flexShrink: 0
                    }}>
                        {applyToBase && <span style={{ color: '#fff', fontSize: 12 }}>✓</span>}
                    </div>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                            Apply to future months
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                            This amount will carry forward every month automatically
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 12 }}>
                    <button onClick={onClose} style={{
                        flex: 1, padding: '12px 0', borderRadius: 12, border: '2px solid #e2e8f0',
                        background: '#fff', color: '#64748b', fontWeight: 700, fontSize: 14, cursor: 'pointer'
                    }}>
                        Cancel
                    </button>
                    <button onClick={handleSave} disabled={saving} style={{
                        flex: 2, padding: '12px 0', borderRadius: 12, border: 'none',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                        opacity: saving ? 0.7 : 1
                    }}>
                        {saving ? 'Saving...' : 'Set Budget'}
                    </button>
                </div>
            </div>
        </div>
    );
}
