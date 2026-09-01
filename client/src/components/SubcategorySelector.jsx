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
        ? subcategories.filter(s => s.toLowerCase().includes(search.toLowerCase()))
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
                    maxHeight: 220, display: 'flex', flexDirection: 'column',
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
                        {filtered.map((sub, i) => (
                            <div
                                key={i}
                                onClick={() => { onChange(sub); setIsOpen(false); setSearch(''); }}
                                style={{
                                    padding: '8px 12px', fontSize: 12, cursor: 'pointer',
                                    borderBottom: i === filtered.length - 1 ? 'none' : '1px solid #f8fafc',
                                    background: value === sub ? '#f0f9ff' : '#fff',
                                    fontWeight: value === sub ? 700 : 400,
                                    color: value === sub ? '#0369a1' : '#334155',
                                    display: 'flex', alignItems: 'center', gap: 8,
                                }}
                                onMouseOver={e => { if (value !== sub) e.currentTarget.style.background = '#f8fafc'; }}
                                onMouseOut={e => { if (value !== sub) e.currentTarget.style.background = '#fff'; }}
                            >
                                <span style={{ fontSize: 14 }}>🏷️</span> {sub}
                                {value === sub && <span style={{ marginLeft: 'auto', fontSize: 12, color: '#0369a1' }}>✓</span>}
                            </div>
                        ))}
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
