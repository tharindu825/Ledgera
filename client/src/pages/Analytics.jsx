import React, { useState, useEffect, useMemo, Fragment } from 'react';
import { getAnalytics, getAnalyticsDrilldown, getTransactionYears } from '../services/api';
import { getCurrency } from '../utils/currency';
import { getCategoryEmoji, getSubcategoryEmoji, formatCategoryLabel } from '../utils/categoryUtils';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS, ArcElement, Tooltip, Legend,
    CategoryScale, LinearScale, BarElement, PointElement, LineElement
} from 'chart.js';
import toast from 'react-hot-toast';
import {
    TrendingUp, TrendingDown, PieChart, ChevronDown, ChevronRight,
    ChevronLeft, Search, Layers, X, Calendar, ArrowUpRight,
    Activity, Receipt, Wallet, Filter, CheckSquare, Maximize2, Minimize2
} from 'lucide-react';

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
    
    // View mode: 'matrix' (default comparison table), 'charts', 'items'
    const [activeView, setActiveView] = useState('matrix');
    
    // Set of expanded category keys
    const [expandedCats, setExpandedCats] = useState(new Set());
    const [searchQuery, setSearchQuery] = useState('');

    // Drilldown modal state
    const [drilldownModal, setDrilldownModal] = useState({
        open: false,
        title: '',
        subtitle: '',
        loading: false,
        items: [],
        totalAmount: 0
    });

    // Load available years
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

    useEffect(() => {
        loadAnalytics();
    }, [month, year]);

    const loadAnalytics = async () => {
        setLoading(true);
        try {
            const res = await getAnalytics(year, month);
            setData(res.data);
            
            // Auto expand top active expense categories
            const expCats = res.data.expenseCategories || [];
            const activeKeys = expCats.filter(c => c.totalSpend3M > 0).map(c => `expense_${c.key}`);
            setExpandedCats(prev => new Set([...prev, ...activeKeys]));
        } catch (err) {
            toast.error('Failed to load analytics');
        } finally {
            setLoading(false);
        }
    };

    const handlePrevMonth = () => {
        if (month === 1) {
            setMonth(12);
            setYear(y => y - 1);
        } else {
            setMonth(m => m - 1);
        }
    };

    const handleNextMonth = () => {
        if (month === 12) {
            setMonth(1);
            setYear(y => y + 1);
        } else {
            setMonth(m => m + 1);
        }
    };

    const toggleCat = (catKey) => {
        setExpandedCats(prev => {
            const next = new Set(prev);
            if (next.has(catKey)) {
                next.delete(catKey);
            } else {
                next.add(catKey);
            }
            return next;
        });
    };

    const expandAll = () => {
        if (!data) return;
        const allKeys = [
            ...(data.incomeCategories || []).map(c => `income_${c.key}`),
            ...(data.expenseCategories || []).map(c => `expense_${c.key}`)
        ];
        setExpandedCats(new Set(allKeys));
    };

    const collapseAll = () => {
        setExpandedCats(new Set());
    };

    // Open Drilldown Modal
    const openDrilldown = async (targetMonthObj, type, category, subcategory = null, label = '') => {
        const catLabel = label || formatCategoryLabel(category || type);
        const subLabel = subcategory ? ` • ${subcategory}` : '';
        const title = `${catLabel}${subLabel}`;
        const subtitle = `${targetMonthObj.label} (${type === 'expense' ? 'Expenses' : 'Income'})`;

        setDrilldownModal({
            open: true,
            title,
            subtitle,
            loading: true,
            items: [],
            totalAmount: 0
        });

        try {
            const params = {
                year: targetMonthObj.year,
                month: targetMonthObj.month,
                type,
                category: category || '',
                subcategory: subcategory || ''
            };
            const res = await getAnalyticsDrilldown(params);
            setDrilldownModal({
                open: true,
                title,
                subtitle,
                loading: false,
                items: res.data.results || [],
                totalAmount: res.data.totalAmount || 0
            });
        } catch (err) {
            toast.error('Failed to load transaction details');
            setDrilldownModal(prev => ({ ...prev, loading: false }));
        }
    };

    const currSym = data?.currency ? getCurrency(data.currency).symbol : 'LKR';

    // Format currency display
    const formatExpenseAmt = (amt) => {
        if (!amt || amt === 0) return `${currSym} 0.00`;
        return `-${currSym} ${amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const formatIncomeAmt = (amt) => {
        if (!amt || amt === 0) return `${currSym} 0.00`;
        return `${currSym} ${amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // Filter categories based on search & non-zero 3-month total
    const filteredIncomeCategories = useMemo(() => {
        if (!data?.incomeCategories) return [];
        let list = data.incomeCategories.filter(cat => (cat.totalIncome3M || 0) > 0);
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            list = list.filter(cat => {
                const matchCat = cat.name.toLowerCase().includes(q) || cat.key.toLowerCase().includes(q);
                const matchSub = (cat.subcategories || []).some(s => s.name.toLowerCase().includes(q) && (s.totalIncome3M || 0) > 0);
                return matchCat || matchSub;
            });
        }
        return list;
    }, [data?.incomeCategories, searchQuery]);

    const filteredExpenseCategories = useMemo(() => {
        if (!data?.expenseCategories) return [];
        let list = data.expenseCategories.filter(cat => (cat.totalSpend3M || 0) > 0);
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            list = list.filter(cat => {
                const matchCat = cat.name.toLowerCase().includes(q) || cat.key.toLowerCase().includes(q);
                const matchSub = (cat.subcategories || []).some(s => s.name.toLowerCase().includes(q) && (s.totalSpend3M || 0) > 0);
                return matchCat || matchSub;
            });
        }
        return list;
    }, [data?.expenseCategories, searchQuery]);

    if (loading && !data) {
        return <div className="loading-page"><div className="spinner"></div></div>;
    }

    if (!data) return null;

    const { months = [], totalIncome, totalExpense, summary, topItems, budgetLimit } = data;

    // Charts data for secondary tab
    const catBreakdown = summary?.categoryBreakdown || {};
    const catEntries = Object.entries(catBreakdown).filter(([, v]) => (typeof v === 'number' ? v : v?.total || 0) > 0);

    const barData = {
        labels: catEntries.map(([k]) => formatCategoryLabel(k)),
        datasets: [{
            label: 'Amount',
            data: catEntries.map(([, v]) => typeof v === 'number' ? v : v?.total || 0),
            backgroundColor: catEntries.map(([k]) => categoryColors[k] || '#3b82f6'),
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
                    label: (ctx) => `${currSym} ${ctx.raw.toLocaleString()}`
                }
            }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: '#64748b', font: { size: 10 }, maxRotation: 45, minRotation: 45 }
            },
            y: {
                grid: { color: 'rgba(0,0,0,0.05)' },
                ticks: { color: '#64748b', font: { size: 10 }, callback: (v) => v >= 1000 ? (v / 1000) + 'K' : v }
            }
        }
    };

    const currentMonthSpent = totalExpense?.monthsData?.[0]?.amount || 0;
    const currentMonthIncome = totalIncome?.monthsData?.[0]?.amount || 0;
    const netSavings = currentMonthIncome - currentMonthSpent;
    const savingsRate = currentMonthIncome > 0 ? Math.round((netSavings / currentMonthIncome) * 100) : 0;

    return (
        <div className="slide-up">
            {/* Page Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 16,
                marginBottom: 20
            }}>
                <div>
                    <h2 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em', margin: 0, color: '#0f172a' }}>
                        Finance Analytics
                    </h2>
                    <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
                        Current and historical category & subcategory breakdown
                    </p>
                </div>

                {/* Single horizontal line for month & year navigation */}
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
                        value={month}
                        onChange={(e) => setMonth(parseInt(e.target.value))}
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
                        value={year}
                        onChange={(e) => setYear(parseInt(e.target.value))}
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

            {/* Summary Stat Cards */}
            <div className="analytics-stat-grid" style={{ marginBottom: 20 }}>
                {[
                    { label: 'Total Spent', val: currentMonthSpent, icon: <TrendingDown size={14} />, color: '#ef4444', bg: '#fef2f2', negative: true },
                    { label: 'Total Income', val: currentMonthIncome, icon: <TrendingUp size={14} />, color: '#10b981', bg: '#f0fdf4' },
                    { label: 'Net Balance', val: netSavings, icon: <Wallet size={14} />, color: netSavings >= 0 ? '#10b981' : '#ef4444', bg: netSavings >= 0 ? '#f0fdf4' : '#fef2f2' },
                    { label: 'Savings Rate', val: `${savingsRate}%`, icon: <Activity size={14} />, color: '#3b82f6', bg: '#eff6ff', raw: true }
                ].map((item, i) => (
                    <div key={i} className="card analytics-stat-card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <div style={{ width: 28, height: 28, borderRadius: 8, background: item.bg, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {item.icon}
                            </div>
                            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</span>
                        </div>
                        <div className="stat-value" style={{ fontSize: 20, fontWeight: 900, color: '#0f172a' }}>
                            {item.raw ? item.val : `${item.negative && item.val > 0 ? '-' : ''}${currSym} ${Math.abs(item.val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        </div>
                    </div>
                ))}
            </div>

            {/* Controls Bar & View Navigation */}
            <div className="analytics-controls-bar">
                <div className="nav-pill-group">
                    <button
                        className={`nav-pill-btn ${activeView === 'matrix' ? 'active' : ''}`}
                        onClick={() => setActiveView('matrix')}
                    >
                        📊 Category Matrix
                    </button>
                    <button
                        className={`nav-pill-btn ${activeView === 'charts' ? 'active' : ''}`}
                        onClick={() => setActiveView('charts')}
                    >
                        📈 Visual Trends
                    </button>
                    <button
                        className={`nav-pill-btn ${activeView === 'items' ? 'active' : ''}`}
                        onClick={() => setActiveView('items')}
                    >
                        🏆 Top Items
                    </button>
                </div>

                {activeView === 'matrix' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <div className="search-bar" style={{ maxWidth: 240, margin: 0 }}>
                            <Search size={14} style={{ color: '#94a3b8' }} />
                            <input
                                type="text"
                                placeholder="Filter categories..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{ fontSize: 12.5 }}
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}>
                                    <X size={13} />
                                </button>
                            )}
                        </div>

                        <button className="btn btn-secondary btn-sm" onClick={expandAll} title="Expand All Categories">
                            <Maximize2 size={13} style={{ marginRight: 4 }} /> Expand
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={collapseAll} title="Collapse All Categories">
                            <Minimize2 size={13} style={{ marginRight: 4 }} /> Collapse
                        </button>
                    </div>
                )}
            </div>

            {/* ─── 1. MATRIX VIEW (3-MONTH CATEGORY & SUBCATEGORY COMPARISON) ─── */}
            {activeView === 'matrix' && (
                <div className="analytics-matrix-card">
                    <div className="analytics-matrix-wrapper">
                        <table className="analytics-matrix-table">
                            <thead>
                                <tr className="matrix-month-header-row">
                                    <th style={{ width: '34%' }}>Category / Subcategory</th>
                                    {months.map((m, idx) => (
                                        <th key={idx} style={{ width: '22%' }}>
                                            {m.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {/* ─── TOTAL INCOME SECTION ─── */}
                                <tr className="matrix-section-row">
                                    <td>
                                        <div className="matrix-section-title">
                                            <span>Total Income</span>
                                        </div>
                                    </td>
                                    {months.map((m, idx) => {
                                        const colData = totalIncome?.monthsData?.[idx] || { amount: 0, change: { text: '0%', direction: 'neutral', arrow: '⊝' } };
                                        const chg = colData.change;
                                        return (
                                            <td key={idx} className="matrix-cell-val">
                                                <div className="matrix-val-wrap">
                                                    <span className={`change-badge ${chg.direction}`}>
                                                        <span>{chg.arrow}</span>
                                                        <span>{chg.text}</span>
                                                    </span>
                                                    <span className="matrix-amount" style={{ color: '#0f172a' }}>
                                                        {formatIncomeAmt(colData.amount)}
                                                    </span>
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>

                                {/* Income Categories */}
                                {filteredIncomeCategories.length === 0 ? (
                                    <tr>
                                        <td colSpan={months.length + 1} style={{ padding: '14px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 12.5, background: '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                                            No income recorded in this 3-month period
                                        </td>
                                    </tr>
                                ) : (
                                    filteredIncomeCategories.map(cat => {
                                        const catKey = `income_${cat.key}`;
                                        const isExpanded = expandedCats.has(catKey);
                                        const activeSubs = (cat.subcategories || []).filter(s => (s.totalIncome3M || 0) > 0);
                                        const hasSubs = activeSubs.length > 0;
                                        const catEmoji = cat.icon && cat.icon !== '📁' && cat.icon !== '💰' ? cat.icon : getCategoryEmoji(cat.name || cat.key);

                                        return (
                                            <Fragment key={cat.key}>
                                                {/* Main Category Row */}
                                                <tr
                                                    className={`matrix-cat-row ${isExpanded ? 'expanded' : ''}`}
                                                    onClick={() => hasSubs && toggleCat(catKey)}
                                                    style={{ cursor: hasSubs ? 'pointer' : 'default' }}
                                                >
                                                    <td>
                                                        <div className="matrix-cat-name-cell">
                                                            <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                                                                {hasSubs ? (isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />) : <span style={{ width: 15 }} />}
                                                            </span>
                                                            <div className="matrix-cat-icon">
                                                                {catEmoji}
                                                            </div>
                                                            <span className="matrix-cat-label">
                                                                {formatCategoryLabel(cat.name || cat.key)}
                                                            </span>
                                                            {hasSubs && (
                                                                <span className="matrix-sub-count">{activeSubs.length}</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    {months.map((m, idx) => {
                                                        const colData = cat.monthsData?.[idx] || { amount: 0, change: { text: '0%', direction: 'neutral', arrow: '⊝' } };
                                                        const chg = colData.change;
                                                        return (
                                                            <td key={idx} className="matrix-cell-val" onClick={e => e.stopPropagation()}>
                                                                <div className="matrix-val-wrap">
                                                                    <button
                                                                        className="matrix-breakdown-btn"
                                                                        title={`View ${cat.name} transactions for ${m.label}`}
                                                                        onClick={() => openDrilldown(m, 'income', cat.key, null, cat.name)}
                                                                    >
                                                                        ≡
                                                                    </button>
                                                                    <span className={`change-badge ${chg.direction}`}>
                                                                        <span>{chg.arrow}</span>
                                                                        <span>{chg.text}</span>
                                                                    </span>
                                                                    <span className="matrix-amount">
                                                                        {formatIncomeAmt(colData.amount)}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>

                                                {/* Subcategories (when expanded, only non-zero) */}
                                                {isExpanded && activeSubs.map(sub => {
                                                    const subEmoji = getSubcategoryEmoji(sub.name);
                                                    return (
                                                        <tr key={sub.name} className="matrix-subcat-row">
                                                            <td>
                                                                <div className="matrix-subcat-name-cell">
                                                                    <div className="matrix-subcat-icon">
                                                                        {subEmoji}
                                                                    </div>
                                                                    <span className="matrix-subcat-label">{sub.name}</span>
                                                                </div>
                                                            </td>
                                                            {months.map((m, idx) => {
                                                                const colData = sub.monthsData?.[idx] || { amount: 0, change: { text: '0%', direction: 'neutral', arrow: '⊝' } };
                                                                const chg = colData.change;
                                                                return (
                                                                    <td key={idx} className="matrix-cell-val">
                                                                        <div className="matrix-val-wrap">
                                                                            <button
                                                                                className="matrix-breakdown-btn"
                                                                                title={`View ${sub.name} transactions for ${m.label}`}
                                                                                onClick={() => openDrilldown(m, 'income', cat.key, sub.name, `${cat.name} → ${sub.name}`)}
                                                                            >
                                                                                ≡
                                                                            </button>
                                                                            <span className={`change-badge ${chg.direction}`}>
                                                                                <span>{chg.arrow}</span>
                                                                                <span>{chg.text}</span>
                                                                            </span>
                                                                            <span className="matrix-amount" style={{ fontWeight: 600, color: '#334155' }}>
                                                                                {formatIncomeAmt(colData.amount)}
                                                                            </span>
                                                                        </div>
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    );
                                                })}
                                            </Fragment>
                                        );
                                    })
                                )}

                                {/* ─── TOTAL EXPENSE SECTION ─── */}
                                <tr className="matrix-section-row" style={{ borderTop: '2px solid #e2e8f0' }}>
                                    <td>
                                        <div className="matrix-section-title">
                                            <span>Total Expense</span>
                                        </div>
                                    </td>
                                    {months.map((m, idx) => {
                                        const colData = totalExpense?.monthsData?.[idx] || { amount: 0, change: { text: '0%', direction: 'neutral', arrow: '⊝' } };
                                        const chg = colData.change;
                                        return (
                                            <td key={idx} className="matrix-cell-val">
                                                <div className="matrix-val-wrap">
                                                    <span className={`change-badge ${chg.direction}`}>
                                                        <span>{chg.arrow}</span>
                                                        <span>{chg.text}</span>
                                                    </span>
                                                    <span className="matrix-amount" style={{ color: '#0f172a' }}>
                                                        {formatExpenseAmt(colData.amount)}
                                                    </span>
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>

                                {/* Expense Categories */}
                                {filteredExpenseCategories.length === 0 ? (
                                    <tr>
                                        <td colSpan={months.length + 1} style={{ padding: '14px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 12.5, background: '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                                            No expenses recorded in this 3-month period
                                        </td>
                                    </tr>
                                ) : (
                                    filteredExpenseCategories.map(cat => {
                                        const catKey = `expense_${cat.key}`;
                                        const isExpanded = expandedCats.has(catKey);
                                        const activeSubs = (cat.subcategories || []).filter(s => (s.totalSpend3M || 0) > 0);
                                        const hasSubs = activeSubs.length > 0;
                                        const catEmoji = cat.icon && cat.icon !== '📁' ? cat.icon : getCategoryEmoji(cat.name || cat.key);

                                        return (
                                            <Fragment key={cat.key}>
                                                {/* Main Category Row */}
                                                <tr
                                                    className={`matrix-cat-row ${isExpanded ? 'expanded' : ''}`}
                                                    onClick={() => hasSubs && toggleCat(catKey)}
                                                    style={{ cursor: hasSubs ? 'pointer' : 'default' }}
                                                >
                                                    <td>
                                                        <div className="matrix-cat-name-cell">
                                                            <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                                                                {hasSubs ? (isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />) : <span style={{ width: 15 }} />}
                                                            </span>
                                                            <div className="matrix-cat-icon">
                                                                {catEmoji}
                                                            </div>
                                                            <span className="matrix-cat-label">
                                                                {formatCategoryLabel(cat.name || cat.key)}
                                                            </span>
                                                            {hasSubs && (
                                                                <span className="matrix-sub-count">{activeSubs.length}</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    {months.map((m, idx) => {
                                                        const colData = cat.monthsData?.[idx] || { amount: 0, change: { text: '0%', direction: 'neutral', arrow: '⊝' } };
                                                        const chg = colData.change;
                                                        return (
                                                            <td key={idx} className="matrix-cell-val" onClick={e => e.stopPropagation()}>
                                                                <div className="matrix-val-wrap">
                                                                    <button
                                                                        className="matrix-breakdown-btn"
                                                                        title={`View ${cat.name} transactions for ${m.label}`}
                                                                        onClick={() => openDrilldown(m, 'expense', cat.key, null, cat.name)}
                                                                    >
                                                                        ≡
                                                                    </button>
                                                                    <span className={`change-badge ${chg.direction}`}>
                                                                        <span>{chg.arrow}</span>
                                                                        <span>{chg.text}</span>
                                                                    </span>
                                                                    <span className="matrix-amount">
                                                                        {formatExpenseAmt(colData.amount)}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>

                                                {/* Subcategories (when expanded, only non-zero) */}
                                                {isExpanded && activeSubs.map(sub => {
                                                    const subEmoji = getSubcategoryEmoji(sub.name);
                                                    return (
                                                        <tr key={sub.name} className="matrix-subcat-row">
                                                            <td>
                                                                <div className="matrix-subcat-name-cell">
                                                                    <div className="matrix-subcat-icon">
                                                                        {subEmoji}
                                                                    </div>
                                                                    <span className="matrix-subcat-label">{sub.name}</span>
                                                                </div>
                                                            </td>
                                                            {months.map((m, idx) => {
                                                                const colData = sub.monthsData?.[idx] || { amount: 0, change: { text: '0%', direction: 'neutral', arrow: '⊝' } };
                                                                const chg = colData.change;
                                                                return (
                                                                    <td key={idx} className="matrix-cell-val">
                                                                        <div className="matrix-val-wrap">
                                                                            <button
                                                                                className="matrix-breakdown-btn"
                                                                                title={`View ${sub.name} transactions for ${m.label}`}
                                                                                onClick={() => openDrilldown(m, 'expense', cat.key, sub.name, `${cat.name} → ${sub.name}`)}
                                                                            >
                                                                                ≡
                                                                            </button>
                                                                            <span className={`change-badge ${chg.direction}`}>
                                                                                <span>{chg.arrow}</span>
                                                                                <span>{chg.text}</span>
                                                                            </span>
                                                                            <span className="matrix-amount" style={{ fontWeight: 600, color: '#334155' }}>
                                                                                {formatExpenseAmt(colData.amount)}
                                                                            </span>
                                                                        </div>
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    );
                                                })}
                                            </Fragment>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ─── 2. CHARTS & TRENDS VIEW ─── */}
            {activeView === 'charts' && (
                <div className="grid-2" style={{ marginBottom: 24 }}>
                    <div className="card" style={{ overflow: 'hidden', minWidth: 0, padding: 0 }}>
                        <div className="card-header" style={{ padding: '20px 20px 10px' }}>
                            <div className="card-title">Category Spending ({months[0]?.label})</div>
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
                            {(summary?.weeklySpending || []).length > 0 ? (
                                <Bar
                                    data={{
                                        labels: (summary.weeklySpending || []).map(w => `Week ${w.week}`),
                                        datasets: [{
                                            label: 'Spent',
                                            data: (summary.weeklySpending || []).map(w => w.amount),
                                            backgroundColor: 'rgba(16, 185, 129, 0.6)',
                                            borderRadius: 6,
                                            borderSkipped: false
                                        }]
                                    }}
                                    options={{ ...barOptions, scales: { ...barOptions.scales, x: { ...barOptions.scales.x, ticks: { color: '#64748b' } } } }}
                                />
                            ) : (
                                <div className="empty-state"><p>No weekly data</p></div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ─── 3. TOP ITEMS VIEW ─── */}
            {activeView === 'items' && (
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">🏆 Top Spending Items ({months[0]?.label})</div>
                    </div>
                    {topItems?.length > 0 ? (
                        <div className="responsive-table-container">
                            <table className="responsive-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Item</th>
                                        <th>Category</th>
                                        <th>Subcategory</th>
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
                                            <td>
                                                <span className="badge badge-indigo" style={{ fontSize: 10 }}>
                                                    {formatCategoryLabel(item.category || 'Other')}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="badge badge-neutral" style={{ fontSize: 10 }}>
                                                    {item.subcategory || 'General'}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: 13 }}>{item.count}x</td>
                                            <td style={{ fontWeight: 800, color: '#1e293b', fontSize: 13 }}>
                                                {currSym} {item.total.toLocaleString()}
                                            </td>
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
            )}

            {/* ─── DRILLDOWN TRANSACTION DETAILS MODAL ─── */}
            {drilldownModal.open && (
                <div className="drilldown-modal-overlay" onClick={() => setDrilldownModal(prev => ({ ...prev, open: false }))}>
                    <div className="drilldown-modal-content" onClick={e => e.stopPropagation()}>
                        <div className="drilldown-modal-header">
                            <div>
                                <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#0f172a' }}>
                                    {drilldownModal.title}
                                </h3>
                                <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0' }}>
                                    {drilldownModal.subtitle}
                                </p>
                            </div>
                            <button
                                onClick={() => setDrilldownModal(prev => ({ ...prev, open: false }))}
                                style={{ border: 'none', background: '#f1f5f9', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="drilldown-modal-body">
                            {drilldownModal.loading ? (
                                <div style={{ padding: 40, textAlign: 'center' }}>
                                    <div className="spinner" style={{ margin: '0 auto 12px' }}></div>
                                    <p style={{ color: '#64748b', fontSize: 13 }}>Loading line items...</p>
                                </div>
                            ) : drilldownModal.items.length === 0 ? (
                                <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                                    <Receipt size={36} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                                    <p style={{ fontSize: 13, fontWeight: 600 }}>No individual transactions found for this period</p>
                                </div>
                            ) : (
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px 12px', borderBottom: '1px solid #f1f5f9', marginBottom: 12 }}>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>
                                            {drilldownModal.items.length} Entries
                                        </span>
                                        <span style={{ fontSize: 14, fontWeight: 900, color: '#0f172a' }}>
                                            Total: {currSym} {drilldownModal.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>

                                    {drilldownModal.items.map((item, idx) => (
                                        <div key={item.id || idx} className="drilldown-tx-item">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{
                                                    width: 32, height: 32, borderRadius: 8,
                                                    background: item.source === 'bill' ? '#eff6ff' : '#f0fdf4',
                                                    color: item.source === 'bill' ? '#3b82f6' : '#10b981',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14
                                                }}>
                                                    {item.source === 'bill' ? '🧾' : '💳'}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>
                                                        {item.name}
                                                    </div>
                                                    <div style={{ fontSize: 11, color: '#64748b', display: 'flex', gap: 8, marginTop: 2 }}>
                                                        <span>🏪 {item.store}</span>
                                                        <span>📅 {new Date(item.date).toLocaleDateString()}</span>
                                                        {item.quantity && item.quantity > 1 && (
                                                            <span>📦 {item.quantity}x @ {currSym}{item.unitPrice}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontWeight: 800, fontSize: 13.5, color: '#0f172a' }}>
                                                    {currSym} {Number(item.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </div>
                                                <span style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>
                                                    {item.subcategory || 'General'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
