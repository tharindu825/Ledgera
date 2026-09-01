import { useState, useEffect } from 'react';
import { getAnalytics, getTransactionYears } from '../services/api';
import { getCurrency } from '../utils/currency';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS, ArcElement, Tooltip, Legend,
    CategoryScale, LinearScale, BarElement, PointElement, LineElement
} from 'chart.js';
import toast from 'react-hot-toast';
import { Download, Sparkles, TrendingUp, Filter, AlertTriangle, Lightbulb, PieChart, Info, ShoppingCart } from 'lucide-react';
import { getCategoryDisplay, formatCategoryLabel } from '../utils/categoryUtils';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement);

const categoryColors = {
    food: '#f59e0b', vegetables: '#10b981', fruits: '#f97316',
    dairy: '#3b82f6', meat: '#ef4444', household: '#8b5cf6',
    snacks: '#ec4899', beverages: '#06b6d4', personal_care: '#d946ef', other: '#94a3b8'
};

export default function Analytics() {
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [availableYears, setAvailableYears] = useState([new Date().getFullYear()]);

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

    useEffect(() => {
        loadAnalytics();
    }, [month, year]);

    const loadAnalytics = async () => {
        setLoading(true);
        try {
            const res = await getAnalytics(year, month);
            setData(res.data);
        } catch (err) {
            toast.error('Failed to load analytics');
        } finally {
            setLoading(false);
        }
    };

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    if (loading) {
        return <div className="loading-page"><div className="spinner"></div></div>;
    }

    if (!data) return null;

    const { summary, bills, topItems, budgetLimit, currency } = data;
    const currInfo = getCurrency(currency);
    const sym = currInfo.symbol;
    const catBreakdown = summary.categoryBreakdown || {};
    const catEntries = Object.entries(catBreakdown).filter(([, v]) => v > 0);

    // Category bar chart
    const barData = {
        labels: catEntries.map(([k]) => formatCategoryLabel(k)),
        datasets: [{
            label: 'Amount',
            data: catEntries.map(([, v]) => v),
            backgroundColor: catEntries.map(([k]) => categoryColors[k] || '#94a3b8'),
            borderRadius: 6,
            borderSkipped: false
        }]
    };

    const barOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#0f172a',
                titleColor: '#f1f5f9',
                bodyColor: '#94a3b8',
                cornerRadius: 8,
                padding: 12,
                callbacks: {
                    label: (ctx) => `${sym} ${ctx.raw.toLocaleString()}`
                }
            }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: '#64748b', font: { size: 9 }, maxRotation: 45, minRotation: 45 }
            },
            y: {
                grid: { color: 'rgba(0,0,0,0.05)' },
                ticks: { color: '#64748b', font: { size: 9 }, callback: (v) => v >= 1000 ? (v / 1000) + 'K' : v }
            }
        }
    };

    // Weekly bar
    const weeklyData = {
        labels: (summary.weeklySpending || []).map(w => `Week ${w.week}`),
        datasets: [{
            label: 'Spent',
            data: (summary.weeklySpending || []).map(w => w.amount),
            backgroundColor: 'rgba(16, 185, 129, 0.6)',
            borderRadius: 6,
            borderSkipped: false
        }]
    };

    return (
        <div className="slide-up">
            <div className="analytics-header">
                <div className="page-header">
                    <div>
                        <h2 className="text-responsive-2xl" style={{ fontWeight: 900 }}>Finance Analytics</h2>
                        <p className="page-header-sub">Comprehensive spending intelligence</p>
                    </div>
                    <div className="filters-bar">
                        <select className="form-select" value={month}
                            onChange={(e) => setMonth(parseInt(e.target.value))}>
                            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => (
                                <option key={i} value={i + 1}>{m}</option>
                            ))}
                        </select>
                        <select className="form-select" value={year}
                            onChange={(e) => setYear(parseInt(e.target.value))}>
                            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="analytics-stat-grid" style={{ marginBottom: 16 }}>
                {[
                    { label: 'Total Spent', val: summary.totalSpent, icon: <TrendingUp size={14} />, color: '#ef4444', bg: '#fef2f2' },
                    { label: 'Budget Limit', val: budgetLimit, icon: <Activity size={14} />, color: '#3b82f6', bg: '#eff6ff' },
                    { label: 'Total Bills', val: summary.totalBills, icon: <PieChart size={14} />, color: '#10b981', bg: '#f0fdf4', noCurr: true },
                    { label: 'Remaining', val: Math.max(0, (budgetLimit || 0) - (summary.totalSpent || 0)), icon: <ArrowUpRight size={14} />, color: '#f59e0b', bg: '#fffbeb' }
                ].map((item, i) => (
                    <div key={i} className="card analytics-stat-card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <div style={{ width: 28, height: 28, borderRadius: 8, background: item.bg, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{item.icon}</div>
                            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</span>
                        </div>
                        <div className="stat-value" style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>
                            {!item.noCurr && sym}{item.val?.toLocaleString()}
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts */}
            <div className="grid-2" style={{ marginBottom: 24 }}>
                <div className="card" style={{ overflow: 'hidden', minWidth: 0, padding: 0 }}>
                    <div className="card-header" style={{ padding: '20px 20px 10px' }}>
                        <div className="card-title">Category Breakdown</div>
                    </div>
                    <div className="chart-container" style={{ position: 'relative' }}>
                        {catEntries.length > 0 ? (
                            <Bar data={barData} options={barOptions} />
                        ) : (
                            <div className="empty-state"><p>No data for this month</p></div>
                        )}
                    </div>
                </div>

                <div className="card" style={{ overflow: 'hidden', minWidth: 0, padding: 0 }}>
                    <div className="card-header" style={{ padding: '20px 20px 10px' }}>
                        <div className="card-title">Weekly Spending</div>
                    </div>
                    <div className="chart-container" style={{ position: 'relative' }}>
                        {(summary.weeklySpending || []).length > 0 ? (
                            <Bar data={weeklyData} options={{ ...barOptions, scales: { ...barOptions.scales, x: { ...barOptions.scales.x, ticks: { color: '#64748b' } } } }} />
                        ) : (
                            <div className="empty-state"><p>No weekly data</p></div>
                        )}
                    </div>
                </div>
            </div>

            {/* Top Spending Items */}
            <div className="card">
                <div className="card-header">
                    <div className="card-title">🏆 Top Spending Items</div>
                </div>
                {topItems?.length > 0 ? (
                    <div className="responsive-table-container">
                        <table className="responsive-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Item</th>
                                    <th>Category</th>
                                    <th>Purchases</th>
                                    <th>Total Spent</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topItems.map((item, i) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight: 700, color: i < 3 ? 'var(--accent-400)' : '#94a3b8', fontSize: 12 }}>
                                            {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
                                        </td>
                                        <td style={{ fontWeight: 600, fontSize: 13, minWidth: 120 }}>{item.name}</td>
                                        <td><span className={`badge badge-${item.category === 'food' ? 'green' : 'rose'}`} style={{ fontSize: 10 }}>{getCategoryDisplay(item.category)}</span></td>
                                        <td style={{ fontSize: 13 }}>{item.count}x</td>
                                        <td style={{ fontWeight: 800, color: '#1e293b', fontSize: 13 }}>{sym}{item.total.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="empty-state" style={{ padding: '30px 20px' }}>
                        <p>No item data for this month</p>
                    </div>
                )}
            </div>
        </div>
    );
}

