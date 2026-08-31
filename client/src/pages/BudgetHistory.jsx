import { useState, useEffect } from 'react';
import { getBudgetHistory, updateHistoricalBudget } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getCurrency } from '../utils/currency';
import toast from 'react-hot-toast';

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function BudgetHistory() {
    const { user } = useAuth();
    const currInfo = getCurrency(user?.currency || 'LKR');
    const [summaries, setSummaries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null); // { year, month, monthlyIncome, budgetPercentage }
    const [saving, setSaving] = useState(false);

    useEffect(() => { loadHistory(); }, []);

    const loadHistory = async () => {
        setLoading(true);
        try {
            const res = await getBudgetHistory();
            setSummaries(res.data.summaries);
        } catch {
            toast.error('Failed to load history');
        } finally {
            setLoading(false);
        }
    };

    const startEdit = (s) => {
        // Use historical values if they exist, otherwise fallback to reconstructed or current user settings
        const historicalIncome = s.monthlyIncome || (s.budgetLimit && user?.budgetPercentage 
            ? Math.round((s.budgetLimit / user.budgetPercentage) * 100) 
            : (user?.monthlyIncome || 0));
        
        const historicalPct = s.budgetPercentage || user?.budgetPercentage || 30;

        setEditing({
            year: s.year,
            month: s.month,
            monthlyIncome: historicalIncome.toString(),
            budgetPercentage: historicalPct.toString(),
        });
    };

    const handleSave = async () => {
        if (!editing?.monthlyIncome || parseFloat(editing.monthlyIncome) <= 0)
            return toast.error('Enter a valid income amount');
        setSaving(true);
        try {
            await updateHistoricalBudget(editing.year, editing.month, {
                monthlyIncome: parseFloat(editing.monthlyIncome),
                budgetPercentage: parseFloat(editing.budgetPercentage),
            });
            toast.success(`Budget for ${monthNames[editing.month - 1]} ${editing.year} updated!`);
            setEditing(null);
            loadHistory();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Update failed');
        } finally {
            setSaving(false);
        }
    };

    const getStatusColor = (s) => {
        if (!s.budgetLimit || s.budgetLimit === 0) return '#64748b';
        const pct = (s.totalSpent / s.budgetLimit) * 100;
        if (pct >= 90) return '#f43f5e';
        if (pct >= 70) return '#f59e0b';
        return '#10b981';
    };

    return (
        <div className="slide-up">
            <div className="page-header">
                <div>
                    <h2>📅 Budget History</h2>
                    <p className="page-header-sub">View and edit past months' income & budget settings</p>
                </div>
            </div>

            {/* Edit Modal */}
            {editing && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 24, width: '100%', maxWidth: 440, padding: 32, boxShadow: '0 25px 60px -12px rgba(15, 23, 42, 0.2)', animation: 'modalSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                            <div>
                                <h3 style={{ fontWeight: 800, fontSize: 20, color: '#0f172a', letterSpacing: '-0.5px', marginBottom: 4 }}>✏️ Edit Budget</h3>
                                <div style={{ fontSize: 13, color: '#64748b' }}>
                                    {monthNames[editing.month - 1]} {editing.year} — Affects calculations for this month.
                                </div>
                            </div>
                            <button onClick={() => setEditing(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 10, width: 32, height: 32, cursor: 'pointer', color: '#94a3b8' }}>✕</button>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Monthly Income ({currInfo.symbol})</label>
                            <input
                                className="form-input"
                                type="number"
                                min="0"
                                value={editing.monthlyIncome}
                                onChange={e => setEditing(ed => ({ ...ed, monthlyIncome: e.target.value }))}
                                placeholder="e.g. 150000"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Grocery Budget % of Income</label>
                            <input
                                className="form-input"
                                type="number"
                                min="1" max="100"
                                value={editing.budgetPercentage}
                                onChange={e => setEditing(ed => ({ ...ed, budgetPercentage: e.target.value }))}
                                placeholder="e.g. 30"
                            />
                        </div>

                        {editing.monthlyIncome && editing.budgetPercentage && (
                            <div style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.1)', borderRadius: 12, padding: '16px', marginBottom: 24 }}>
                                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>New Monthly Limit</div>
                                <div style={{ fontSize: 24, fontWeight: 800, color: '#2563eb', marginTop: 4 }}>
                                    {currInfo.symbol} {Math.round((parseFloat(editing.monthlyIncome) * parseFloat(editing.budgetPercentage)) / 100).toLocaleString()}
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 12 }}>
                            <button className="btn btn-secondary flex-1" onClick={() => setEditing(null)}>Cancel</button>
                            <button className="btn btn-primary flex-1" onClick={handleSave} disabled={saving} style={{ boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)' }}>
                                {saving ? 'Saving...' : '💾 Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="loading-page"><div className="spinner"></div></div>
            ) : summaries.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon">📅</div>
                        <h3>No historical data yet</h3>
                        <p>Your monthly summaries will appear here once you start recording bills.</p>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {summaries.map((s) => {
                        const pct = s.budgetLimit > 0 ? Math.round((s.totalSpent / s.budgetLimit) * 100) : 0;
                        const color = getStatusColor(s);
                        const savings = Math.max(0, s.budgetLimit - s.totalSpent);
                        return (
                            <div key={`${s.year}-${s.month}`} className="card" style={{ borderLeft: `4px solid ${color}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                                    <div>
                                        <div style={{ fontSize: 18, fontWeight: 700 }}>
                                            {monthNames[s.month - 1]} {s.year}
                                            <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 600, color, background: `${color}20`, padding: '2px 10px', borderRadius: 20, verticalAlign: 'middle' }}>
                                                {pct}% used
                                            </span>
                                        </div>
                                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{s.totalBills || 0} bills recorded</div>
                                    </div>
                                    <button className="btn btn-secondary btn-sm" onClick={() => startEdit(s)} style={{ flexShrink: 0 }}>
                                        ✏️ Edit Budget
                                    </button>
                                </div>

                                {/* Progress */}
                                <div className="progress-bar" style={{ marginTop: 14, marginBottom: 10 }}>
                                    <div className={`progress-bar-fill ${pct >= 90 ? 'danger' : pct >= 70 ? 'warning' : 'safe'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                                </div>

                                {/* Stats row */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 12 }}>
                                    <div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Income</div>
                                        <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{currInfo.symbol} {(s.monthlyIncome || 0).toLocaleString()}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Budget Limit</div>
                                        <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{currInfo.symbol} {(s.budgetLimit || 0).toLocaleString()}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Spent</div>
                                        <div style={{ fontSize: 15, fontWeight: 700, color: '#f59e0b', marginTop: 2 }}>{currInfo.symbol} {(s.totalSpent || 0).toLocaleString()}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Saved</div>
                                        <div style={{ fontSize: 15, fontWeight: 700, color: '#10b981', marginTop: 2 }}>{currInfo.symbol} {savings.toLocaleString()}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Top Category</div>
                                        <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>
                                            {s.categoryBreakdown
                                                ? (() => {
                                                    const labs = { food: '🍚 Food', vegetables: '🥦 Veggies', fruits: '🍎 Fruits', dairy: '🥛 Dairy', meat: '🥩 Meat', household: '🧼 Household', snacks: '🍿 Snacks', beverages: '🥤 Beverages', personal_care: '🧴 Care', other: '📦 Other' };
                                                    const top = Object.entries(s.categoryBreakdown).sort((a, b) => b[1] - a[1])[0];
                                                    return top && top[1] > 0 ? labs[top[0]] || top[0] : '—';
                                                })()
                                                : '—'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
