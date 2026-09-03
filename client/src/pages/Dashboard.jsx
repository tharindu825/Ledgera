import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { getDashboard, getTransactionYears } from '../services/api';
import { getCurrency } from '../utils/currency';
import { getCategoryDisplay } from '../utils/categoryUtils';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import toast from 'react-hot-toast';
import {
    TrendingDown, TrendingUp, Target, Handshake,
    Zap, Calendar, PieChart, ShieldCheck, ChevronLeft, ChevronRight
} from 'lucide-react';

ChartJS.register(ArcElement, Tooltip, Legend);

const categoryColors = ['#f59e0b', '#3b82f6', '#10b981', '#f97316', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#94a3b8'];

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

    const handlePrevMonth = () => {
        if (filter.month === 1) {
            setFilter({ month: 12, year: filter.year - 1 });
        } else {
            setFilter({ ...filter, month: filter.month - 1 });
        }
    };

    const handleNextMonth = () => {
        if (filter.month === 12) {
            setFilter({ month: 1, year: filter.year + 1 });
        } else {
            setFilter({ ...filter, month: filter.month + 1 });
        }
    };

    const budgetGroupsData = useMemo(() => {
        if (data?.budgetGroups) return data.budgetGroups;

        // Fallback calculation from category breakdown
        const breakdown = data?.currentMonth?.categoryBreakdown || {};
        let needs = 0, wants = 0, savings_debt = 0;

        Object.entries(breakdown).forEach(([k, v]) => {
            const amt = typeof v === 'number' ? v : v?.total || 0;
            const key = k.toLowerCase().trim();
            if (key.includes('lifestyle') || key.includes('entertainment') || key.includes('shopping') || key.includes('dining')) {
                wants += amt;
            } else if (key.includes('debt') || key.includes('saving') || key.includes('investment') || key.includes('financial')) {
                savings_debt += amt;
            } else {
                needs += amt;
            }
        });

        const total = needs + wants + savings_debt;
        return {
            needs: {
                key: 'needs',
                label: 'Needs',
                emoji: '🏠',
                color: '#3b82f6',
                bg: '#eff6ff',
                amount: needs,
                percentage: total > 0 ? Math.round((needs / total) * 1000) / 10 : 0,
                targetPercentage: 50,
                desc: 'Essential expenses'
            },
            wants: {
                key: 'wants',
                label: 'Wants',
                emoji: '🛍️',
                color: '#8b5cf6',
                bg: '#f5f3ff',
                amount: wants,
                percentage: total > 0 ? Math.round((wants / total) * 1000) / 10 : 0,
                targetPercentage: 30,
                desc: 'Lifestyle & discretionary'
            },
            savings_debt: {
                key: 'savings_debt',
                label: 'Savings & Debts',
                emoji: '📈',
                color: '#10b981',
                bg: '#f0fdf4',
                amount: savings_debt,
                percentage: total > 0 ? Math.round((savings_debt / total) * 1000) / 10 : 0,
                targetPercentage: 20,
                desc: 'Savings, investments & debts'
            },
            total
        };
    }, [data]);

    if (loading) return <div className="loading-page"><div className="spinner"></div></div>;
    if (!data) return null;

    const { currentMonth, debts, user: userInfo } = data;
    const curr = getCurrency(userInfo.currency || 'LKR');
    const sym = curr.symbol;

    const spentPercent = currentMonth.spentPercentage;
    const budgetStatus = spentPercent >= 90 ? 'rose' : spentPercent >= 70 ? 'amber' : 'green';

    // 1. Category Spend Doughnut Data
    const categoryEntries = Object.entries(currentMonth.categoryBreakdown || {}).filter(([, v]) => (typeof v === 'number' ? v : v?.total || 0) > 0);
    const doughnutData = {
        labels: categoryEntries.map(([k]) => getCategoryDisplay(k)),
        datasets: [{
            data: categoryEntries.map(([, v]) => typeof v === 'number' ? v : v?.total || 0),
            backgroundColor: categoryColors,
            borderWidth: 0,
            hoverOffset: 10
        }]
    };

    // 2. Needs, Wants & Savings/Debts Doughnut Data
    const groupItems = [
        budgetGroupsData.needs || { label: 'Needs', amount: 0, percentage: 0, color: '#3b82f6', emoji: '🏠', targetPercentage: 50 },
        budgetGroupsData.wants || { label: 'Wants', amount: 0, percentage: 0, color: '#8b5cf6', emoji: '🛍️', targetPercentage: 30 },
        budgetGroupsData.savings_debt || { label: 'Savings & Debts', amount: 0, percentage: 0, color: '#10b981', emoji: '📈', targetPercentage: 20 }
    ];

    const hasGroupData = groupItems.some(g => (g.amount || 0) > 0);

    const groupsDoughnutData = {
        labels: groupItems.map(g => `${g.label} (${g.percentage}%)`),
        datasets: [{
            data: hasGroupData ? groupItems.map(g => g.amount || 0) : [1],
            backgroundColor: hasGroupData ? groupItems.map(g => g.color) : ['#e2e8f0'],
            borderWidth: 0,
            hoverOffset: 8
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
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 16,
                marginBottom: 20
            }}>
                <div>
                    <h2 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em', margin: 0, color: '#0f172a' }}>Executive Overview</h2>
                    <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>{filter.month}/{filter.year} Financial Insights</p>
                </div>

                <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: '#ffffff',
                    padding: '4px 8px',
                    borderRadius: 12,
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
                }}>
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={handlePrevMonth}
                        title="Previous Month"
                        style={{ padding: '6px 8px', minWidth: 30, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}
                    >
                        <ChevronLeft size={16} />
                    </button>

                    <select
                        className="form-select"
                        value={filter.month}
                        onChange={e => setFilter({ ...filter, month: parseInt(e.target.value) })}
                        style={{
                            height: 32,
                            padding: '0 8px',
                            borderRadius: 8,
                            border: '1px solid #e2e8f0',
                            fontSize: 13,
                            fontWeight: 700,
                            color: '#0f172a',
                            background: '#f8fafc',
                            cursor: 'pointer',
                            outline: 'none'
                        }}
                    >
                        {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => (
                            <option key={i} value={i + 1}>{m}</option>
                        ))}
                    </select>

                    <select
                        className="form-select"
                        value={filter.year}
                        onChange={e => setFilter({ ...filter, year: parseInt(e.target.value) })}
                        style={{
                            height: 32,
                            padding: '0 8px',
                            borderRadius: 8,
                            border: '1px solid #e2e8f0',
                            fontSize: 13,
                            fontWeight: 700,
                            color: '#0f172a',
                            background: '#f8fafc',
                            cursor: 'pointer',
                            outline: 'none'
                        }}
                    >
                        {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>

                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={handleNextMonth}
                        title="Next Month"
                        style={{ padding: '6px 8px', minWidth: 30, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}
                    >
                        <ChevronRight size={16} />
                    </button>
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
                {/* ── Left Card: Category Spend Analysis ────────────────────────────── */}
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
                        {categoryEntries.length > 0 ? (
                            <Doughnut data={doughnutData} options={{
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 14, font: { size: 11, weight: 600 } } }
                                },
                                cutout: '70%'
                            }} />
                        ) : (
                            <div className="empty-state">No category spending recorded</div>
                        )}
                    </div>
                </div>

                {/* ── Right Card: Needs, Wants & Savings & Debts ──────────────── */}
                <div className="card" style={{ borderRadius: 24 }}>
                    <div className="card-header" style={{ marginBottom: 12 }}>
                        <div>
                            <div className="card-title" style={{ fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <PieChart size={20} color="#3b82f6" /> Needs, Wants & Savings
                            </div>
                            <div className="card-subtitle">50/30/20 Rule Allocation</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a' }}>
                                {sym}{currentMonth.expense.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase' }}>Total Spent</div>
                        </div>
                    </div>

                    {/* Chart & Breakdown container */}
                    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 16, alignItems: 'center', marginBottom: 16 }}>
                        {/* Mini Doughnut */}
                        <div style={{ height: 130, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Doughnut data={groupsDoughnutData} options={{
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: { display: false },
                                    tooltip: {
                                        enabled: hasGroupData,
                                        callbacks: {
                                            label: (ctx) => ` ${ctx.label}: ${sym}${ctx.parsed.toLocaleString()}`
                                        }
                                    }
                                },
                                cutout: '72%'
                            }} />
                            <div style={{
                                position: 'absolute',
                                textAlign: 'center',
                                pointerEvents: 'none',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center'
                            }}>
                                <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Split</span>
                                <span style={{ fontSize: 12, fontWeight: 900, color: '#0f172a' }}>50/30/20</span>
                            </div>
                        </div>

                        {/* Top quick summary cards */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {groupItems.map(g => (
                                <div key={g.label} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '8px 12px',
                                    borderRadius: 12,
                                    background: g.color === '#3b82f6' ? '#eff6ff' : g.color === '#8b5cf6' ? '#f5f3ff' : '#f0fdf4',
                                    border: `1px solid ${g.color === '#3b82f6' ? '#dbeafe' : g.color === '#8b5cf6' ? '#ede9fe' : '#dcfce7'}`
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 16 }}>{g.emoji}</span>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{g.label}</div>
                                            <div style={{ fontSize: 10, color: '#64748b' }}>Target: {g.targetPercentage}%</div>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: 13, fontWeight: 900, color: g.color }}>
                                            {sym}{(g.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                        <div style={{
                                            display: 'inline-block',
                                            padding: '1px 6px',
                                            borderRadius: 6,
                                            fontSize: 10,
                                            fontWeight: 800,
                                            background: g.color,
                                            color: '#ffffff',
                                            marginTop: 2
                                        }}>
                                            {g.percentage || 0}%
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Progress distribution bar */}
                    <div style={{ marginTop: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>
                            <span>Expense Distribution</span>
                            <span>{hasGroupData ? '100% Tracked' : 'No Expenses'}</span>
                        </div>
                        <div style={{
                            height: 10,
                            borderRadius: 6,
                            background: '#f1f5f9',
                            overflow: 'hidden',
                            display: 'flex',
                            width: '100%'
                        }}>
                            {groupItems.map(g => (
                                <div
                                    key={g.label}
                                    title={`${g.label}: ${g.percentage}% (${sym}${(g.amount || 0).toLocaleString()})`}
                                    style={{
                                        height: '100%',
                                        width: `${g.percentage || 0}%`,
                                        background: g.color,
                                        transition: 'width 0.5s ease'
                                    }}
                                />
                            ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10.5, color: '#94a3b8' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }}></span> Needs ({groupItems[0].percentage}%)
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#8b5cf6', display: 'inline-block' }}></span> Wants ({groupItems[1].percentage}%)
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span> Savings/Debt ({groupItems[2].percentage}%)
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
