import { useState, useRef, useEffect } from 'react';

export default function ItemSelector({ value, onChange, suggestions, placeholder, onSelectSuggestion }) {
    const [isOpen, setIsOpen] = useState(false);
    const [filtered, setFiltered] = useState([]);
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleInputChange = (e) => {
        const val = e.target.value;
        onChange(val);
        if (val.trim()) {
            const matches = suggestions
                .filter(item => item.toLowerCase().includes(val.toLowerCase()))
                .slice(0, 10);
            setFiltered(matches);
            setIsOpen(matches.length > 0);
        } else {
            setIsOpen(false);
        }
    };

    const handleSelect = (item) => {
        onChange(item);
        setIsOpen(false);
        if (onSelectSuggestion) onSelectSuggestion(item);
    };

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
            <input
                className="form-input"
                placeholder={placeholder}
                value={value}
                onChange={handleInputChange}
                onFocus={() => {
                    if (value.trim()) {
                        const matches = suggestions.filter(item => item.toLowerCase().includes(value.toLowerCase())).slice(0, 5);
                        setFiltered(matches);
                        setIsOpen(matches.length > 0);
                    }
                }}
                style={{ padding: '7px 10px', fontSize: 13, background: '#f8fafc', marginBottom: 0 }}
            />
            {isOpen && (
                <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
                    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, marginTop: 4,
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', overflow: 'hidden'
                }}>
                    {filtered.map((item, i) => (
                        <div
                            key={i}
                            onClick={() => handleSelect(item)}
                            style={{
                                padding: '8px 12px', fontSize: 12, cursor: 'pointer',
                                borderBottom: i === filtered.length - 1 ? 'none' : '1px solid #f1f5f9',
                                background: '#fff', transition: 'background 0.2s', fontWeight: 600, color: '#0f172a'
                            }}
                            onMouseOver={e => e.currentTarget.style.background = '#f8fafc'}
                            onMouseOut={e => e.currentTarget.style.background = '#fff'}
                        >
                            🛒 {item}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
