import { useState, useRef, useEffect } from 'react';

/**
 * Subcategory dropdown selector that shows subcategories from the selected category.
 * Falls back to a text input if no subcategories are defined.
 *
 * Props:
 *   - subcategories: string[] — the subcategory options for the currently selected category
 *   - value: string — current subcategory value
 *   - onChange: (val: string) => void
 *   - placeholder?: string
 */
export default function SubcategorySelector({ subcategories = [], value, onChange, placeholder = 'Select subcategory' }) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Helper to get string label from string or object
    const getLabel = (sub) => typeof sub === 'string' ? sub : sub.name;

    // If no subcategories defined, show a simple text input
    if (!subcategories || subcategories.length === 0) {
        return (
            <input
                className="form-input"
                placeholder={placeholder || 'Type subcategory...'}
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                style={{ padding: '6px 8px', fontSize: 12 }}
            />
        );
    }

    const filtered = search
        ? subcategories.filter(s => getLabel(s).toLowerCase().includes(search.toLowerCase()))
        : subcategories;

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
            {/* Main button / display */}
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    padding: '6px 10px', fontSize: 12, cursor: 'pointer',
                    border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    minHeight: 34, color: value ? '#0f172a' : '#94a3b8',
                    transition: 'border-color 0.15s',
                    borderColor: isOpen ? '#94a3b8' : '#e2e8f0',
                }}
            >
                <span style={{ fontWeight: value ? 600 : 400 }}>
                    {value ? `🏷️ ${value}` : placeholder}
                </span>
                <span style={{ fontSize: 10, opacity: 0.5, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
            </div>

            {/* Dropdown */}
            {isOpen && (
                <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
                    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, marginTop: 4,
                    boxShadow: '0 10px 30px -5px rgba(0,0,0,0.12)', overflow: 'hidden',
                    maxHeight: 280, display: 'flex', flexDirection: 'column',
                }}>
                    {/* Search filter */}
                    {subcategories.length > 5 && (
                        <div style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9' }}>
                            <input
                                className="form-input"
                                placeholder="Search..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                autoFocus
                                style={{ padding: '4px 8px', fontSize: 11, marginBottom: 0, border: '1px solid #f1f5f9', borderRadius: 6 }}
                            />
                        </div>
                    )}

                    {/* Option: Clear / None */}
                    <div
                        onClick={() => { onChange(''); setIsOpen(false); setSearch(''); }}
                        style={{
                            padding: '8px 12px', fontSize: 11, cursor: 'pointer',
                            borderBottom: '1px solid #f8fafc',
                            background: !value ? '#f8fafc' : '#fff',
                            color: '#94a3b8', fontStyle: 'italic',
                        }}
                        onMouseOver={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseOut={e => e.currentTarget.style.background = !value ? '#f8fafc' : '#fff'}
                    >
                        — None —
                    </div>

                    {/* Subcategory options */}
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                        {filtered.map((sub, i) => {
                            const label = getLabel(sub);
                            const isSelected = value === label;
                            const hasBudget = typeof sub === 'object' && sub.budgetLimit > 0;
                            const spent = typeof sub === 'object' ? (sub.spent || 0) : 0;
                            const limit = typeof sub === 'object' ? (sub.budgetLimit || 0) : 0;
                            const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
                            const barColor = pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#22c55e';

                            return (
                                <div
                                    key={i}
                                    onClick={() => { onChange(label); setIsOpen(false); setSearch(''); }}
                                    style={{
                                        padding: '8px 12px', fontSize: 12, cursor: 'pointer',
                                        borderBottom: i === filtered.length - 1 ? 'none' : '1px solid #f8fafc',
                                        background: isSelected ? '#f0f9ff' : '#fff',
                                        fontWeight: isSelected ? 700 : 400,
                                        color: isSelected ? '#0369a1' : '#334155',
                                        display: 'flex', flexDirection: 'column', gap: 4
                                    }}
                                    onMouseOver={e => { if (!isSelected) e.currentTarget.style.background = '#f8fafc'; }}
                                    onMouseOut={e => { if (!isSelected) e.currentTarget.style.background = '#fff'; }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 14 }}>🏷️</span> {label}
                                        {isSelected && <span style={{ marginLeft: 'auto', fontSize: 12, color: '#0369a1' }}>✓</span>}
                                    </div>
                                    
                                    {hasBudget && (
                                        <div style={{ marginLeft: 22, marginTop: 2, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b', fontWeight: 500 }}>
                                                <span>{pct}% spent</span>
                                                <span>{limit - spent > 0 ? `${(limit - spent).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} left` : 'Over budget'}</span>
                                            </div>
                                            <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 2 }} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {filtered.length === 0 && (
                            <div style={{ padding: '16px 12px', fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
                                No matching subcategories
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
