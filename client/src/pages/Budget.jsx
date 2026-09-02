import { useState, useEffect, useCallback } from 'react';
import { getCategoryBudgets, updateCategoryBudget, updateCategory } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getCurrency } from '../utils/currency';
import { formatCategoryLabel } from '../utils/categoryUtils';
import SetBudgetModal from '../components/SetBudgetModal';
import toast from 'react-hot-toast';

const GROUP_META = {
    needs: {
        label: 'Needs',
        emoji: '🏠',
        desc: 'Essential expenses — housing, food, utilities, transport, healthcare',
        color: '#3b82f6',
        bg: '#eff6ff',
        border: '#bfdbfe',
        lightBg: '#f8fbff'
    },
    wants: {
        label: 'Wants',
        emoji: '🎬',
        desc: 'Discretionary & lifestyle — dining out, entertainment, shopping',
        color: '#8b5cf6',
        bg: '#f5f3ff',
        border: '#ddd6fe',
        lightBg: '#faf9ff'
    },
    savings_debt: {
        label: 'Savings & Debt',
        emoji: '📈',
        desc: 'Financial security — investments, savings, loan repayments',
        color: '#10b981',
        bg: '#f0fdf4',
        border: '#a7f3d0',
        lightBg: '#f7fef9'
    }
};

const GROUP_TABS = ['needs', 'wants', 'savings_debt'];

function formatNum(n, sym) {
    if (!n) return `${sym}0`;
    if (n >= 1000000) return `${sym}${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${sym}${(n / 1000).toFixed(1)}K`;
    return `${sym}${n.toLocaleString()}`;
}

function ProgressBar({ pct, color }) {
    const clamped = Math.min(pct, 100);
    const barColor = pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : color;
    return (
        <div style={{ height: 8, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
                height: '100%', width: `${clamped}%`,
                background: barColor, borderRadius: 99,
                transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
                boxShadow: pct >= 100 ? '0 0 8px #ef444460' : 'none'
            }} />
        </div>
    );
}

function MoveGroupDropdown({ item, currentGroup, onMove }) {
    const [open, setOpen] = useState(false);
    const others = GROUP_TABS.filter(g => g !== currentGroup);

    return (
        <div style={{ position: 'relative', flexShrink: 0 }}>
            <button onClick={() => setOpen(!open)} title="Move to group" style={{
                width: 32, height: 32, borderRadius: 8, border: '1px solid #e2e8f0',
                background: '#f8fafc', color: '#94a3b8', fontSize: 14,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s'
            }}
                onMouseOver={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#475569'; }}
                onMouseOut={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#94a3b8'; }}
            >⇄</button>

            {open && (
                <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />
                    <div style={{
                        position: 'absolute', right: 0, top: 36, zIndex: 100,
                        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 170, overflow: 'hidden'
                    }}>
                        <div style={{ padding: '8px 12px 6px', fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Move to group
                        </div>
                        {others.map(g => {
                            const meta = GROUP_META[g];
                            return (
                                <div key={g} onClick={() => { onMove(item, g); setOpen(false); }} style={{
                                    padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8,
                                    cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#334155',
                                    borderTop: '1px solid #f8fafc',
                                    transition: 'background 0.1s'
                                }}
                                    onMouseOver={e => e.currentTarget.style.background = meta.bg}
                                    onMouseOut={e => e.currentTarget.style.background = '#fff'}
                                >
                                    <span style={{ fontSize: 16 }}>{meta.emoji}</span>
                                    <span style={{ color: meta.color }}>{meta.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}

function ActionsRow({ item, groupKey, onEdit, onMove, onDelete }) {
    const hasLimit = item.budgetLimit > 0;
    return (
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <MoveGroupDropdown item={item} currentGroup={groupKey} onMove={onMove} />
            <button onClick={() => onDelete(item)} title="Remove from budget" style={{
                width: 32, height: 32, borderRadius: 8, border: '1px solid #fee2e2',
                background: '#fff0f0', color: '#ef4444', fontSize: 14,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s'
            }}
                onMouseOver={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#dc2626'; }}
                onMouseOut={e => { e.currentTarget.style.background = '#fff0f0'; e.currentTarget.style.color = '#ef4444'; }}
            >
                🗑️
            </button>
            <button onClick={() => onEdit(item)} style={{
                padding: '6px 12px', borderRadius: 9,
                border: '1px solid #e2e8f0', background: '#f8fafc',
                color: '#64748b', fontSize: 12, fontWeight: 700,
                cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap'
            }}
                onMouseOver={e => { e.currentTarget.style.background = '#6366f1'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#6366f1'; }}
                onMouseOut={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
            >
                ✏️ {hasLimit ? 'Edit' : 'Set'}
            </button>
        </div>
    );
}

function CategoryRow({ cat, groupKey, sym, onEdit, onMove, onDelete }) {
    const spent = cat.spent || 0;
    const limit = cat.budgetLimit || 0;
    const pct = cat.pct || 0;
    const hasLimit = limit > 0;
    const statusColor = pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#10b981';
    
    const subs = cat.subcategories || [];
    const hasSubs = subs.length > 0;
    const [expanded, setExpanded] = useState(false);

    const isMainInGroup = cat.budgetGroup === groupKey;

    return (
        <div style={{
            borderRadius: 14, background: '#fff', border: '1px solid #f1f5f9',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)', transition: 'box-shadow 0.2s',
            overflow: 'hidden'
        }}
            onMouseOver={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
            onMouseOut={e => e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'}
        >
            {/* Main Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
                {/* Expand toggle or Icon */}
                {hasSubs ? (
                    <button onClick={() => setExpanded(!expanded)} style={{
                        width: 40, height: 40, borderRadius: 12, background: `${cat.color}18`, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                        border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                        color: cat.color
                    }}>
                        <span style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>▶</span>
                    </button>
                ) : (
                    <div style={{
                        width: 40, height: 40, borderRadius: 12,
                        background: `${cat.color}18`, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18
                    }}>
                        {cat.icon}
                    </div>
                )}

                {/* Name + bar */}
                <div style={{ flex: 1, minWidth: 0, opacity: isMainInGroup ? 1 : 0.5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: 6 }}>
                            {hasSubs && <span style={{ fontSize: 14 }}>{cat.icon}</span>}
                            {formatCategoryLabel(cat.mainCategory)}
                            {hasSubs && <span style={{ fontSize: 10, background: '#f1f5f9', padding: '2px 6px', borderRadius: 6, color: '#64748b' }}>{subs.length} subs</span>}
                            {!isMainInGroup && <span style={{ fontSize: 9, color: '#ef4444', border: '1px solid #ef4444', borderRadius: 4, padding: '0 4px' }}>In {cat.budgetGroup}</span>}
                        </span>
                        {isMainInGroup ? (
                            hasLimit ? (
                                <span style={{ fontSize: 12, fontWeight: 800, color: statusColor }}>{pct}%</span>
                            ) : (
                                <span style={{ fontSize: 10, color: '#cbd5e1', fontStyle: 'italic' }}>No limit set</span>
                            )
                        ) : null}
                    </div>

                    {isMainInGroup && (
                        <>
                            <ProgressBar pct={pct} color={cat.color || '#6366f1'} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                                <span style={{ fontSize: 11, color: '#64748b' }}>
                                    Spent: <strong style={{ color: '#0f172a' }}>{formatNum(spent, sym)}</strong>
                                </span>
                                {hasLimit && (
                                    <span style={{ fontSize: 11, color: '#64748b' }}>
                                        Limit: <strong>{formatNum(limit, sym)}</strong>
                                    </span>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Actions */}
                {isMainInGroup ? (
                    <ActionsRow item={cat} groupKey={groupKey} onEdit={onEdit} onMove={onMove} onDelete={onDelete} />
                ) : (
                    <div style={{ width: 100 }} /> // Spacer if main cat is not in this group but shown because of subcats
                )}
            </div>

            {/* Subcategories */}
            {expanded && hasSubs && (
                <div style={{ borderTop: '1px solid #f8fafc', background: '#fafafa', padding: '8px 14px 12px 52px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {subs.map(sub => {
                        const subLimit = sub.budgetLimit || 0;
                        const subPct = sub.pct || 0;
                        const subHasLimit = subLimit > 0;
                        const subStatusColor = subPct >= 100 ? '#ef4444' : subPct >= 80 ? '#f59e0b' : cat.color;
                        
                        // Create an item object that acts like a category for the ActionsRow
                        const subItem = { ...cat, subcategoryName: sub.name, budgetLimit: subLimit, spent: sub.spent, pct: subPct, budgetGroup: sub.budgetGroup };

                        return (
                            <div key={sub.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: '#334155', textTransform: 'capitalize' }}>
                                            ↳ {formatCategoryLabel(sub.name)}
                                        </span>
                                        {subHasLimit ? (
                                            <span style={{ fontSize: 11, fontWeight: 800, color: subStatusColor }}>{subPct}%</span>
                                        ) : (
                                            <span style={{ fontSize: 10, color: '#cbd5e1', fontStyle: 'italic' }}>No limit</span>
                                        )}
                                    </div>
                                    <ProgressBar pct={subPct} color={cat.color || '#6366f1'} />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                                        <span style={{ fontSize: 10, color: '#64748b' }}>
                                            Spent: <strong style={{ color: '#0f172a' }}>{formatNum(sub.spent, sym)}</strong>
                                        </span>
                                        {subHasLimit && (
                                            <span style={{ fontSize: 10, color: '#64748b' }}>
                                                Limit: <strong>{formatNum(subLimit, sym)}</strong>
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <ActionsRow item={subItem} groupKey={groupKey} onEdit={onEdit} onMove={onMove} onDelete={onDelete} />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function AddCategoryPanel({ unassigned, groupKey, sym, onAdd }) {
    const [expanded, setExpanded] = useState(false);
    const meta = GROUP_META[groupKey];
    if (unassigned.length === 0) return null;

    return (
        <div style={{
            marginTop: 12, borderRadius: 14,
            border: `1.5px dashed ${meta.border}`,
            background: meta.lightBg, overflow: 'hidden'
        }}>
            <button onClick={() => setExpanded(!expanded)} style={{
                width: '100%', padding: '11px 16px',
                background: 'transparent', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                color: meta.color, fontWeight: 700, fontSize: 13
            }}>
                <span>➕ Add items to {meta.label} ({unassigned.length} available)</span>
                <span style={{ fontSize: 11, transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>▼</span>
            </button>

            {expanded && (
                <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                    {unassigned.map((item, i) => (
                        <div key={i} style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 12px', borderRadius: 10,
                            background: '#fff', border: '1px solid #e2e8f0'
                        }}>
                            <span style={{ fontSize: 18 }}>{item.icon}</span>
                            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#334155', textTransform: 'capitalize' }}>
                                {item.title}
                            </span>
                            <span style={{ fontSize: 11, color: '#94a3b8', marginRight: 4 }}>
                                Currently: <em>{item.currentGroup === 'unassigned' ? 'Unassigned' : GROUP_META[item.currentGroup]?.label || item.currentGroup}</em>
                            </span>
                            <button onClick={() => onAdd(item, groupKey)} style={{
                                padding: '5px 12px', borderRadius: 8, border: 'none',
                                background: meta.color, color: '#fff', fontWeight: 700,
                                fontSize: 12, cursor: 'pointer'
                            }}>
                                Add here
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function GroupCard({ groupKey, cats, allExpenseCats, sym, onEdit, onMove, onDelete }) {
    const meta = GROUP_META[groupKey];
    
    // Calculate totals including subcategories that are in this group
    let totalSpent = 0;
    let totalBudget = 0;
    let withBudgetCount = 0;
    let totalItems = 0;

    cats.forEach(c => {
        if (c.budgetGroup === groupKey) {
            totalSpent += (c.spent || 0);
            totalBudget += (c.budgetLimit || 0);
            if (c.budgetLimit > 0) withBudgetCount++;
            totalItems++;
        }
        c.subcategories.forEach(s => {
            if (s.budgetGroup === groupKey) {
                totalSpent += (s.spent || 0);
                totalBudget += (s.budgetLimit || 0);
                if (s.budgetLimit > 0) withBudgetCount++;
                totalItems++;
            }
        });
    });

    // Categories and subcategories not currently in this group
    const unassignedItems = [];
    allExpenseCats.forEach(cat => {
        if (cat.budgetGroup !== groupKey) {
            unassignedItems.push({ ...cat, title: formatCategoryLabel(cat.mainCategory), currentGroup: cat.budgetGroup });
        }
        (cat.subcategories || []).forEach(sub => {
            if (sub.budgetGroup !== groupKey) {
                unassignedItems.push({ 
                    ...cat, 
                    subcategoryName: sub.name, 
                    title: `${formatCategoryLabel(cat.mainCategory)} ➔ ${formatCategoryLabel(sub.name)}`,
                    currentGroup: sub.budgetGroup
                });
            }
        });
    });

    return (
        <div style={{
            background: '#fff', borderRadius: 20, overflow: 'hidden',
            border: `1px solid ${meta.border}`, boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
            marginBottom: 24
        }}>
            {/* Group header */}
            <div style={{
                padding: '18px 20px', background: meta.bg,
                borderBottom: `1px solid ${meta.border}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
                <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: meta.color, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {meta.emoji} {meta.label}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>{meta.desc}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    {totalBudget > 0 ? (
                        <>
                            <div style={{ fontSize: 17, fontWeight: 900, color: meta.color }}>
                                {formatNum(totalSpent, sym)}
                                <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}> / {formatNum(totalBudget, sym)}</span>
                            </div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>{withBudgetCount} of {totalItems} items budgeted</div>
                        </>
                    ) : (
                        <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>No budgets set</div>
                    )}
                </div>
            </div>

            {/* Category rows */}
            <div style={{ padding: '14px 14px 0' }}>
                {cats.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: 13 }}>
                        No categories in this group yet. Add some below ↓
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {cats.map(cat => (
                            <CategoryRow key={cat._id} cat={cat} groupKey={groupKey} sym={sym} onEdit={onEdit} onMove={onMove} onDelete={onDelete} />
                        ))}
                    </div>
                )}

                {/* Add categories panel */}
                <AddCategoryPanel unassigned={unassignedItems} groupKey={groupKey} sym={sym} onAdd={onMove} />
            </div>
            <div style={{ height: 14 }} />
        </div>
    );
}

export default function Budget() {
    const { user } = useAuth();
    const curr = getCurrency(user?.currency || 'LKR');
    const sym = curr.symbol;

    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeGroup, setActiveGroup] = useState('needs');
    const [editingCat, setEditingCat] = useState(null);

    const availableYears = [now.getFullYear(), now.getFullYear() - 1];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getCategoryBudgets(month, year);
            setData(res.data);
        } catch {
            toast.error('Failed to load budget data');
        } finally {
            setLoading(false);
        }
    }, [month, year]);

    useEffect(() => { load(); }, [load]);

    const handleMove = useCallback(async (item, newGroup) => {
        try {
            if (item.subcategoryName) {
                await updateCategory(item._id, { subcategory: item.subcategoryName, budgetGroup: newGroup });
                toast.success(`"${formatCategoryLabel(item.subcategoryName)}" moved to ${GROUP_META[newGroup].label}`);
            } else {
                await updateCategory(item._id, { budgetGroup: newGroup });
                toast.success(`"${formatCategoryLabel(item.mainCategory)}" moved to ${GROUP_META[newGroup].label}`);
            }
            load();
        } catch {
            toast.error('Failed to move item');
        }
    }, [load]);

    const handleDelete = useCallback(async (item) => {
        const title = item.subcategoryName ? formatCategoryLabel(item.subcategoryName) : formatCategoryLabel(item.mainCategory);
        if (!window.confirm(`Are you sure you want to remove "${title}" from the budget planner? You can add it back later from the "Add items" panel below.`)) return;
        try {
            if (item.subcategoryName) {
                await updateCategory(item._id, { subcategory: item.subcategoryName, budgetGroup: 'unassigned' });
            } else {
                await updateCategory(item._id, { budgetGroup: 'unassigned' });
            }
            toast.success(`Removed from budget`);
            load();
        } catch {
            toast.error('Failed to remove from budget');
        }
    }, [load]);

    if (loading) return <div className="loading-page"><div className="spinner" /></div>;

    const groups = data?.groups || { needs: [], wants: [], savings_debt: [] };
    const allExpenseCats = data?.categories || [];

    // Summary across all groups
    let totalSpent = 0;
    let totalBudget = 0;
    let overBudget = 0;
    let nearBudget = 0;

    allExpenseCats.forEach(cat => {
        if (cat.budgetGroup !== 'unassigned') {
            totalSpent += cat.spent;
            totalBudget += cat.budgetLimit;
            if (cat.pct >= 100) overBudget++;
            else if (cat.pct >= 80) nearBudget++;
        }
        (cat.subcategories || []).forEach(sub => {
            if (sub.budgetGroup !== 'unassigned') {
                totalSpent += sub.spent;
                totalBudget += sub.budgetLimit;
                if (sub.pct >= 100) overBudget++;
                else if (sub.pct >= 80) nearBudget++;
            }
        });
    });

    return (
        <div className="slide-up" style={{ paddingBottom: 24 }}>
            {/* Header */}
            <div className="page-header" style={{ marginBottom: 20 }}>
                <div>
                    <h2 style={{ fontSize: 24, fontWeight: 900 }}>💰 Budget Planner</h2>
                    <p style={{ fontSize: 13, color: '#64748b' }}>Assign limits to categories and subcategories</p>
                </div>
                <div className="filters-bar">
                    <select className="form-select" value={month} onChange={e => setMonth(parseInt(e.target.value))}>
                        {monthNames.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                    </select>
                    <select className="form-select" value={year} onChange={e => setYear(parseInt(e.target.value))}>
                        {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            {/* Summary Strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))', gap: 12, marginBottom: 24 }}>
                {[
                    { label: 'Total Spent', val: formatNum(totalSpent, sym), color: '#6366f1', bg: '#f0f0ff', icon: '💸' },
                    { label: 'Total Budget', val: totalBudget > 0 ? formatNum(totalBudget, sym) : '—', color: '#3b82f6', bg: '#eff6ff', icon: '🎯' },
                    { label: 'Over Budget', val: `${overBudget} items`, color: '#ef4444', bg: '#fef2f2', icon: '🚨' },
                    { label: 'Near Limit', val: `${nearBudget} items`, color: '#f59e0b', bg: '#fffbeb', icon: '⚠️' },
                ].map((s, i) => (
                    <div key={i} style={{
                        background: '#fff', borderRadius: 16, padding: '14px 16px',
                        border: '1px solid #f1f5f9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <div style={{ width: 30, height: 30, borderRadius: 8, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                                {s.icon}
                            </div>
                            <span style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</span>
                        </div>
                        <div style={{ fontSize: 19, fontWeight: 900, color: s.color }}>{s.val}</div>
                    </div>
                ))}
            </div>

            {/* Tip banner */}
            <div style={{
                padding: '10px 16px', borderRadius: 12, background: '#f0f9ff', border: '1px solid #bae6fd',
                fontSize: 12, color: '#0369a1', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8
            }}>
                <span style={{ fontSize: 16 }}>💡</span>
                Expand rows (▶) to set separate budgets for subcategories. You can move subcategories to different groups independently of their parent.
            </div>

            {/* Group Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, background: '#f8fafc', padding: 6, borderRadius: 16, width: 'fit-content' }}>
                {GROUP_TABS.map(g => {
                    const meta = GROUP_META[g];
                    const cats = groups[g] || [];
                    
                    let itemCount = 0;
                    let overCount = 0;
                    cats.forEach(c => {
                        if (c.budgetGroup === g) {
                            itemCount++;
                            if (c.pct >= 100) overCount++;
                        }
                        c.subcategories.forEach(s => {
                            if (s.budgetGroup === g) {
                                itemCount++;
                                if (s.pct >= 100) overCount++;
                            }
                        });
                    });

                    return (
                        <button key={g} onClick={() => setActiveGroup(g)} style={{
                            padding: '10px 18px', borderRadius: 12, border: 'none', cursor: 'pointer',
                            fontWeight: 700, fontSize: 13, transition: 'all 0.2s',
                            background: activeGroup === g ? meta.color : 'transparent',
                            color: activeGroup === g ? '#fff' : '#64748b',
                            display: 'flex', alignItems: 'center', gap: 6
                        }}>
                            {meta.emoji} {meta.label}
                            <span style={{ fontSize: 10, background: activeGroup === g ? 'rgba(255,255,255,0.25)' : '#e2e8f0', borderRadius: 99, padding: '1px 6px', color: activeGroup === g ? '#fff' : '#64748b' }}>
                                {itemCount}
                            </span>
                            {overCount > 0 && (
                                <span style={{ background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 900, borderRadius: 99, padding: '1px 6px' }}>{overCount}</span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Active Group Card */}
            <GroupCard
                key={activeGroup}
                groupKey={activeGroup}
                cats={groups[activeGroup] || []}
                allExpenseCats={allExpenseCats}
                sym={sym}
                onEdit={setEditingCat}
                onMove={handleMove}
                onDelete={handleDelete}
            />

            {/* Set Budget Modal */}
            {editingCat && (
                <SetBudgetModal
                    category={editingCat}
                    month={month}
                    year={year}
                    onClose={() => setEditingCat(null)}
                    onSaved={() => { setEditingCat(null); load(); }}
                />
            )}
        </div>
    );
}
