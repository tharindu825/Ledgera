import React, { useState, useEffect, useRef } from 'react';

export default function CategorySelector({ categories, type, value, onChange, placeholder, label }) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const wrapperRef = useRef(null);

    const filtered = categories
        .filter(c => c.type === type)
        .filter(c => c.mainCategory.toLowerCase().includes(search.toLowerCase()));

    const selected = categories.find(c => c.mainCategory === value && c.type === type);

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (cat) => {
        onChange(cat.mainCategory);
        setIsOpen(false);
        setSearch('');
    };

    const handleCustomAdd = () => {
        if (!search.trim()) return;
        onChange(search.trim());
        setIsOpen(false);
        setSearch('');
    };

    return (
        <div className="form-group" style={{ position: 'relative' }} ref={wrapperRef}>
            <label className="form-label">{label}</label>
            <div
                className="form-input"
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    padding: '0 12px',
                    height: 44
                }}
            >
                {selected ? (
                    <>
                        <span style={{ fontSize: 18 }}>{selected.icon || '📁'}</span>
                        <span style={{ flex: 1, fontWeight: 600 }}>{selected.mainCategory.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                    </>
                ) : (
                    <span style={{ color: '#94a3b8', flex: 1 }}>{value || placeholder}</span>
                )}
                <span style={{ fontSize: 12, opacity: 0.5 }}>{isOpen ? '▲' : '▼'}</span>
            </div>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 100,
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 14,
                    marginTop: 8,
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                    overflow: 'hidden',
                    animation: 'slideDown 0.2s ease-out'
                }}>
                    <div style={{ padding: 10, borderBottom: '1px solid #f1f5f9' }}>
                        <input
                            autoFocus
                            className="form-input"
                            style={{ marginBottom: 0, height: 36, fontSize: 14 }}
                            placeholder="Search or type new..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCustomAdd()}
                        />
                    </div>
                    <div style={{ maxH: 250, overflowY: 'auto', maxHeight: 250 }}>
                        {filtered.map(cat => (
                            <div
                                key={cat._id}
                                onClick={() => handleSelect(cat)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    padding: '10px 16px',
                                    cursor: 'pointer',
                                    background: value === cat.mainCategory ? '#f8fafc' : 'transparent',
                                    transition: 'background 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                                onMouseLeave={e => e.currentTarget.style.background = value === cat.mainCategory ? '#f8fafc' : 'transparent'}
                            >
                                <div style={{
                                    width: 32, height: 32, borderRadius: 8, background: cat.color + '15',
                                    color: cat.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16
                                }}>
                                    {cat.icon || '📁'}
                                </div>
                                <span style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>
                                    {cat.mainCategory.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </span>
                            </div>
                        ))}
                        {search.trim() && !filtered.find(c => c.mainCategory.toLowerCase() === search.toLowerCase()) && (
                            <div
                                onClick={handleCustomAdd}
                                style={{
                                    padding: '12px 16px',
                                    cursor: 'pointer',
                                    borderTop: '1px solid #f1f5f9',
                                    color: '#0f172a',
                                    fontSize: 14,
                                    fontWeight: 700
                                }}
                            >
                                ✨ Create "{search}"
                            </div>
                        )}
                        {filtered.length === 0 && !search && (
                            <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                                No categories found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
