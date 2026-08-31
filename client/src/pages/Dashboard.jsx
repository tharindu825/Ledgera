import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getDashboard, getTransactionYears } from '../services/api';
import { getCurrency } from '../utils/currency';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import toast from 'react-hot-toast';
import {
    TrendingDown, TrendingUp, Target, Handshake,
    Zap, Calendar, Activity
} from 'lucide-react';

ChartJS.register(ArcElement, Tooltip, Legend);

const categoryLabels = {
    food: '🍚 Food', shopping: '🛍️ Shopping', bills: '🧾 Bills',
    transport: '🚗 Transport', health: '🏥 Health', entertainment: '🎬 Fun',
    other: '📦 Other'
};

const categoryColors = ['#f59e0b', '#3b82f6', '#10b981', '#f97316', '#ef4444', '#8b5cf6', '#94a3b8'];

export default function Dashboard() {
    const { user } = useAuth();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [availableYears, setAvailableYears] = useState([new Date().getFullYear()]);
    const [filter, setFilter] = useState({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear()
    });

    // Load available years from transaction data
    useEffect(() => {
        getTransactionYears()
            .then(res => {
                const years = res.data.years || [];
                // Always ensure current filter year is in the list
                const currentFilterYear = new Date().getFullYear();
                if (!years.includes(currentFilterYear)) years.push(currentFilterYear);
                setAvailableYears(years.sort((a, b) => a - b));
            })
            .catch(() => {});
    }, []);

    useEffect(() => { loadDashboard(); }, [filter]);

    const loadDashboard = async () => {
        setLoading(true);
        try {
            const res = await getDashboard({ month: filter.month, year: filter.year });
            setData(res.data);
        } catch (err) {
            toast.error('Failed to load dashboard');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="loading-page"><div className="spinner"></div></div>;
    if (!data) return null;

    const { currentMonth, debts, user: userInfo } = data;
    const curr = getCurrency(userInfo.currency || 'LKR');
    const sym = curr.symbol;

    const spentPercent = currentMonth.spentPercentage;
    const budgetStatus = spentPercent >= 90 ? 'rose' : spentPercent >= 70 ? 'amber' : 'green';

    const doughnutData = {
        labels: Object.keys(currentMonth.categoryBreakdown || {}).map(k => categoryLabels[k] || k),
        datasets: [{
            data: Object.values(currentMonth.categoryBreakdown || {}),
            backgroundColor: categoryColors,
            borderWidth: 0,
            hoverOffset: 10
        }]
    };

    const formatNum = (n) => {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return n?.toLocaleString() || '0';
    };

    return (
        <div className="slide-up" style={{ paddingBottom: 20 }}>
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="page-header">
                <div>
                    <h2 style={{ fontSize: 24, fontWeight: 900 }}>Executive Overview</h2>
                    <p style={{ fontSize: 13, color: '#64748b' }}>{filter.month}/{filter.year} Insights</p>
                </div>

                <div className="filters-bar">
                    <select className="form-select" value={filter.month}
                        onChange={e => setFilter({ ...filter, month: parseInt(e.target.value) })}>
                        {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => (
                            <option key={i} value={i + 1}>{m}</option>
                        ))}
                    </select>
                    <select className="form-select" value={filter.year}
                        onChange={e => setFilter({ ...filter, year: parseInt(e.target.value) })}>
                        {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            {/* ── Main Balance Card ────────────────────────────────────────── */}
            <div className="net-balance-card" style={{
                background: userInfo.balance >= 0 ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' : 'linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%)',
                padding: '24px 32px',
                borderRadius: 28,
                color: '#fff',
                marginBottom: 16,
                boxShadow: '0 20px 40px -12px rgba(15, 23, 42, 0.3)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{ position: 'absolute', top: -20, right: -20, opacity: 0.1 }}><Target size={120} /></div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Total Net Balance</div>
                <div className="net-balance-value" style={{ fontSize: 44, fontWeight: 900, letterSpacing: -2, marginBottom: 4 }}>{sym}{userInfo.balance.toLocaleString()}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                    <Zap size={14} color="#f59e0b" fill="#f59e0b" />
                    <span>Financial Status: {userInfo.balance >= 0 ? 'Healthy' : 'Deficit'}</span>
                </div>
            </div>

            {/* ── Key Stats Grid ─────────────────────────────────────────── */}
            <div className="stat-grid" style={{ marginBottom: 16 }}>
                {[
                    { label: 'Income', val: currentMonth.income, icon: <TrendingUp size={16} />, color: '#10b981', bg: '#f0fdf4' },
                    { label: 'Expense', val: currentMonth.expense, icon: <TrendingDown size={16} />, color: '#ef4444', bg: '#fef2f2' },
                    { label: 'Budget', val: currentMonth.remainingBudget, icon: <Target size={16} />, color: '#3b82f6', bg: '#eff6ff' },
                    { label: 'Owed', val: debts.owedByMe, icon: <Handshake size={16} />, color: '#f59e0b', bg: '#fffbeb' }
                ].map((item, i) => (
                    <div key={i} className="card" style={{ padding: '14px 16px', margin: 0, borderRadius: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 10, background: item.bg, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {item.icon}
                            </div>
                            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>{item.label}</span>
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>{sym}{formatNum(item.val)}</div>
                    </div>
                ))}
            </div>

            <div className="grid-2">
                {/* ── Category Spend Analysis ────────────────────────────── */}
                <div className="card" style={{ borderRadius: 24 }}>
                    <div className="card-header" style={{ marginBottom: 8 }}>
                        <div>
                            <div className="card-title" style={{ fontSize: 18 }}>Category Spend</div>
                            <div className="card-subtitle">Budget: {sym}{currentMonth.budgetLimit.toLocaleString()}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 20, fontWeight: 900, color: budgetStatus === 'rose' ? '#ef4444' : '#10b981' }}>{spentPercent}%</div>
                            <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase' }}>Used</div>
                        </div>
                    </div>

                    <div className="progress-bar" style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden', marginBottom: 16 }}>
                        <div style={{
                            height: '100%',
                            width: `${Math.min(100, spentPercent)}%`,
                            background: budgetStatus === 'rose' ? '#ef4444' : budgetStatus === 'amber' ? '#f59e0b' : '#10b981',
                            borderRadius: 4,
                            transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                        }} />
                    </div>

                    <div style={{ height: 280, position: 'relative' }}>
                        {Object.keys(currentMonth.categoryBreakdown || {}).length > 0 ? (
                            <Doughnut data={doughnutData} options={{
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 20, font: { size: 11, weight: 600 } } }
                                },
                                cutout: '70%'
                            }} />
                        ) : (
                            <div className="empty-state">No data recorded</div>
                        )}
                    </div>
                </div>

                {/* ── Recent Activity ──────────────────────────────────── */}
                <div className="card" style={{ borderRadius: 24 }}>
                    <div className="card-header">
                        <div className="card-title" style={{ fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Activity size={20} color="#6366f1" /> Recent Activity
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {data.recentBills?.length > 0 ? (
                            data.recentBills.map(bill => (
                                <div key={bill._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid #f1f5f9' }}>
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                        <div style={{ width: 40, height: 40, borderRadius: 12, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🧾</div>
                                        <div>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{bill.storeName}</div>
                                            <div style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(bill.billDate).toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 16 }}>{sym}{bill.totalAmount.toLocaleString()}</div>
                                </div>
                            ))
                        ) : (
                            <div className="empty-state">No recent activity detected</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
