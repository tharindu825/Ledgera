import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createBill, scanBillBase64, getBillSuggestions, getCategories } from '../services/api';
import { dbCategoriesToOptions, getCategoryDisplay } from '../utils/categoryUtils';
import ItemSelector from '../components/ItemSelector';
import { useAuth } from '../context/AuthContext';
import { getCurrency } from '../utils/currency';
import toast from 'react-hot-toast';
import {
    Camera, Upload, FileText, Plus, X,
    Save, Mic, MicOff, Search, Trash2,
    Zap, List, Layout, MousePointer2,
    Key, Info, Sparkles, Send, Check, ShoppingCart
} from 'lucide-react';

const OCR_STRATEGIES = [
    { key: 'auto', label: 'Auto', icon: Sparkles, desc: 'Tries all strategies, picks best result' },
    { key: 'standard', label: 'Standard', icon: FileText, desc: 'Item name then price at end of line' },
    { key: 'columns', label: 'Columns', icon: Layout, desc: 'Tabular layout: name | qty | price' },
    { key: 'priceRight', label: 'Price-Right', icon: MousePointer2, desc: 'Rightmost number on line = price' },
    { key: 'keywords', label: 'Keywords', icon: Key, desc: 'Detects known grocery item names' },
    { key: 'anyNumber', label: 'Broad', icon: Search, desc: 'Any line with a number (fallback)' },
];

const newItem = (overrides = {}) => ({
    name: '', category: 'other', quantity: 1, unitPrice: 0, totalPrice: 0, ...overrides
});

export default function UploadBill() {
    const [tab, setTab] = useState('manual');
    const [storeName, setStoreName] = useState('');
    const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState('');
    const [items, setItems] = useState([newItem()]);
    const [categories, setCategories] = useState([]);
    const [showAddCat, setShowAddCat] = useState(false);
    const [newCatLabel, setNewCatLabel] = useState('');
    const [newCatEmoji, setNewCatEmoji] = useState('🏷️');
    const [loading, setLoading] = useState(false);
    const [ocrLoading, setOcrLoading] = useState(false);
    const [ocrResult, setOcrResult] = useState(null);
    const [ocrStrategy, setOcrStrategy] = useState('auto');
    const [lastImageData, setLastImageData] = useState(null);
    const [voiceText, setVoiceText] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [suggestions, setSuggestions] = useState({ items: [], stores: [], itemMap: {} });
    const fileInputRef = useRef(null);
    const navigate = useNavigate();
    const { user } = useAuth();
    const currInfo = getCurrency(user?.currency || 'LKR');

    useEffect(() => {
        const fetchSuggestions = async () => {
            try {
                const res = await getBillSuggestions();
                setSuggestions(res.data);
            } catch (err) {
                console.error('Failed to fetch suggestions', err);
            }
        };
        const fetchCategories = async () => {
            try {
                const res = await getCategories();
                setCategories(dbCategoriesToOptions(res.data.filter(c => c.type === 'expense')));
            } catch (err) {
                console.error('Failed to fetch categories', err);
            }
        };
        fetchSuggestions();
        fetchCategories();
    }, []);

    // ── Item helpers ──────────────────────────────────────────────────────────
    const addItem = () => setItems(p => [...p, newItem()]);
    const removeItem = (i) => setItems(p => p.filter((_, idx) => idx !== i));
    const updateItem = (i, field, val) => {
        setItems(p => {
            const n = [...p];
            n[i] = { ...n[i], [field]: val };
            if (field === 'unitPrice' || field === 'quantity') {
                const up = parseFloat(field === 'unitPrice' ? val : n[i].unitPrice) || 0;
                const qty = parseFloat(field === 'quantity' ? val : n[i].quantity) || 1;
                n[i].totalPrice = parseFloat((up * qty).toFixed(2));
            }
            return n;
        });
    };

    const totalAmount = items.reduce((s, it) => s + (parseFloat(it.totalPrice) || 0), 0);
    const validItems = items.filter(it => it.name.trim() && it.totalPrice > 0);

    // ── Add custom category ───────────────────────────────────────────────────
    const handleAddCategory = () => {
        if (!newCatLabel.trim()) return toast.error('Enter a category name');
        const val = newCatLabel.trim().toLowerCase().replace(/\s+/g, '_');
        if (categories.find(c => c.value === val)) return toast.error('Category already exists');
        setCategories(p => [...p, { value: val, label: `${newCatEmoji} ${newCatLabel.trim()}`, color: '#94a3b8' }]);
        toast.success(`Category "${newCatLabel}" added!`);
        setNewCatLabel('');
        setNewCatEmoji('🏷️');
        setShowAddCat(false);
    };

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (validItems.length === 0) return toast.error('Add at least one item with a name and price');
        setLoading(true);
        try {
            await createBill({ items: validItems, storeName, billDate, notes, inputMethod: tab });
            toast.success('🎉 Bill saved successfully!');
            navigate('/bills');
        } catch (err) {
            if (err.response?.status === 409) {
                toast.error(err.response?.data?.message || 'Bill already exists', { duration: 6000, icon: '🚫' });
            } else {
                toast.error(err.response?.data?.error || 'Failed to save bill');
            }
        } finally {
            setLoading(false);
        }
    };

    // ── OCR ───────────────────────────────────────────────────────────────────
    const runOCR = useCallback(async (imageData, strategy) => {
        setOcrLoading(true);
        setOcrResult(null);
        const toastId = toast.loading('🔍 Scanning receipt... ~20–30 seconds');
        try {
            const res = await scanBillBase64(imageData, strategy === 'auto' ? undefined : strategy);
            toast.dismiss(toastId);
            const data = res.data;
            setOcrResult(data);

            // Auto-fill store name if detected
            if (data.storeName && !storeName) setStoreName(data.storeName);
            // Auto-fill date if detected
            if (data.billDate) setBillDate(data.billDate);

            if (data.items?.length > 0) {
                // Auto-add new categories found by AI
                const foundCats = [...new Set(data.items.map(it => it.category).filter(Boolean))];
                setCategories(currentCats => {
                    const newCats = [...currentCats];
                    foundCats.forEach(cat => {
                        if (!newCats.find(c => c.value === cat)) {
                            newCats.push({
                                value: cat,
                                label: `✨ ${cat.charAt(0).toUpperCase() + cat.slice(1).replace('_', ' ')}`,
                                color: '#94a3b8'
                            });
                        }
                    });
                    return newCats;
                });

                setItems(data.items.map(it => ({
                    name: it.name || '',
                    category: it.category || 'other',
                    quantity: it.quantity || 1,
                    unitPrice: it.unitPrice || it.totalPrice,
                    totalPrice: it.totalPrice,
                })));
                toast.success(`✅ ${data.items.length} items found!`);
                setTab('manual');
            } else {
                toast('⚠️ No items detected — try a different strategy or add manually.', { icon: '⚠️', duration: 5000 });
            }
        } catch (err) {
            toast.dismiss(toastId);
            if (err.response?.status === 409) {
                toast.error(err.response?.data?.message || 'Bill already exists', { duration: 6000, icon: '🚫' });
            } else {
                const isConn = err.message?.includes('Network') || String(err.code).includes('REFUSED');
                toast.error(isConn
                    ? '❌ Server not reachable — make sure backend is running on port 5000.'
                    : `Scan error: ${err.response?.data?.detail || err.message}`,
                    { duration: 6000 });
            }
        } finally {
            setOcrLoading(false);
        }
    }, [storeName]);

    const handleImageUpload = useCallback(async (file) => {
        if (!file) return;
        if (file.size > 15 * 1024 * 1024) return toast.error('Image too large (max 15MB)');
        const reader = new FileReader();
        reader.onload = async () => { setLastImageData(reader.result); await runOCR(reader.result, ocrStrategy); };
        reader.onerror = () => toast.error('Failed to read image file');
        reader.readAsDataURL(file);
    }, [ocrStrategy, runOCR]);

    const handleRescan = async (strat) => {
        if (!lastImageData) return toast.error('Upload an image first');
        setOcrStrategy(strat);
        await runOCR(lastImageData, strat);
    };

    // ── Voice ─────────────────────────────────────────────────────────────────
    const startVoice = () => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window))
            return toast.error('Voice input not supported in this browser');
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        const r = new SR();
        r.continuous = false; r.interimResults = false; r.lang = 'en-US';
        r.onstart = () => setIsListening(true);
        r.onend = () => setIsListening(false);
        r.onresult = (ev) => {
            const text = ev.results[0][0].transcript;
            setVoiceText(text);
            const m = text.match(/(?:add\s+)?(.+?)\s+(\d+(?:\.\d+)?)\s*(?:rupees?|lkr|dollars?|rs)?/i);
            if (m) {
                const price = parseFloat(m[2]);
                setItems(p => [...p, newItem({ name: m[1].trim(), unitPrice: price, totalPrice: price, category: 'other' })]);
                toast.success(`Added: ${m[1].trim()} — ${currInfo.symbol}${price}`);
            } else toast.error('Try: "Add rice 1200" or "chicken 850"');
        };
        r.onerror = () => { setIsListening(false); toast.error('Voice recognition failed'); };
        r.start();
    };

    const getCatInfo = (val) => categories.find(c => c.value === val) || categories[categories.length - 1];

    return (
        <div className="slide-up">
            {/* Page Header */}
            <div className="page-header">
                <div>
                    <h2>📋 Add Grocery Bill</h2>
                    <p className="page-header-sub">Scan, voice or manually enter your grocery receipt</p>
                </div>
                {/* Live total badge */}
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Bill Total</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--primary-400)', letterSpacing: -1 }}>
                        {currInfo.symbol} {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{validItems.length} valid items</div>
                </div>
            </div>

            {/* ── Input Method Tabs ── */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {[
                    { key: 'manual', icon: '✍️', label: 'Manual Entry' },
                    { key: 'ocr', icon: '📸', label: 'Scan Receipt' },
                    { key: 'voice', icon: '🎤', label: 'Voice Input' },
                ].map(t => (
                    <button key={t.key} type="button" onClick={() => setTab(t.key)} style={{
                        padding: '12px 20px', borderRadius: 12, fontWeight: 700, fontSize: 13,
                        border: '1px solid',
                        borderColor: tab === t.key ? 'var(--primary)' : 'var(--border)',
                        background: tab === t.key ? 'rgba(15, 23, 42, 0.05)' : '#ffffff',
                        color: tab === t.key ? 'var(--primary)' : 'var(--text-secondary)',
                        cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 8,
                        boxShadow: tab === t.key ? '0 4px 12px rgba(15, 23, 42, 0.1)' : 'none',
                        textTransform: 'uppercase', letterSpacing: '0.5px'
                    }}>{t.icon} {t.label}</button>
                ))}
            </div>

            {/* ── OCR Tab ─────────────────────────────────────────────────── */}
            {tab === 'ocr' && (
                <div className="card" style={{ marginBottom: 20 }}>
                    <div className="card-header" style={{ marginBottom: 14 }}>
                        <div>
                            <div className="card-title">📸 Scan Bill Receipt</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                                Upload a photo of your grocery receipt — AI will extract items automatically
                            </div>
                        </div>
                        {lastImageData && !ocrLoading && (
                            <span style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399', padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600 }}>
                                ✓ Image ready
                            </span>
                        )}
                    </div>

                    {/* Strategy Selector */}
                    <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
                            Detection Model
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {OCR_STRATEGIES.map(s => (
                                <button key={s.key} type="button" title={s.desc}
                                    onClick={() => lastImageData ? handleRescan(s.key) : setOcrStrategy(s.key)}
                                    style={{
                                        padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                        border: `1px solid ${ocrStrategy === s.key ? 'rgba(16,185,129,0.6)' : 'rgba(0,0,0,0.07)'}`,
                                        background: ocrStrategy === s.key ? 'rgba(16,185,129,0.15)' : '#ffffff',
                                        color: ocrStrategy === s.key ? '#34d399' : 'var(--text-muted)',
                                        transition: 'all 0.15s',
                                    }}>{s.label}</button>
                            ))}
                        </div>
                        {lastImageData && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                                💡 Click a model button above to <strong>re-scan</strong> the same image with a different detection method
                            </div>
                        )}
                    </div>

                    {/* Drop Zone */}
                    <div
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleImageUpload(e.dataTransfer.files[0]); }}
                        onClick={() => !ocrLoading && fileInputRef.current?.click()}
                        style={{
                            border: `2px dashed ${dragOver ? 'var(--primary-400)' : '#e2e8f0'}`,
                            borderRadius: 16, padding: '32px 20px', textAlign: 'center',
                            cursor: ocrLoading ? 'wait' : 'pointer',
                            background: dragOver ? 'rgba(16,185,129,0.05)' : '#ffffff',
                            transition: 'all 0.2s',
                        }}
                    >
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => handleImageUpload(e.target.files[0])} style={{ display: 'none' }} />
                        {ocrLoading ? (
                            <>
                                <div className="spinner" style={{ width: 44, height: 44, margin: '0 auto 14px' }}></div>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Processing receipt with OCR...</div>
                                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Tesseract AI is reading your image</div>
                            </>
                        ) : (
                            <>
                                <div style={{ fontSize: 40, marginBottom: 10 }}>{lastImageData ? '🔄' : '📷'}</div>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                                    {lastImageData ? 'Click or drag to upload a different image' : 'Click or drag & drop your receipt image'}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>JPG, PNG, BMP, WEBP — max 15MB</div>
                            </>
                        )}
                    </div>

                    {/* OCR Result Badge */}
                    {ocrResult && (
                        <div style={{ marginTop: 14 }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12,
                                background: ocrResult.itemsFound > 0 ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
                                border: `1px solid ${ocrResult.itemsFound > 0 ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
                            }}>
                                <span style={{ fontSize: 22 }}>{ocrResult.itemsFound > 0 ? '✅' : '⚠️'}</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, color: ocrResult.itemsFound > 0 ? '#34d399' : '#fbbf24', fontSize: 14 }}>
                                        {ocrResult.itemsFound > 0 ? `${ocrResult.itemsFound} items detected` : 'No items found'}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                                        Model: <strong style={{ color: 'var(--text-secondary)' }}>{ocrResult.strategy}</strong>
                                        {ocrResult.storeName && <span> • Store: <strong style={{ color: 'var(--text-secondary)' }}>{ocrResult.storeName}</strong></span>}
                                        {ocrResult.confidence !== undefined && <span> • OCR: <strong>{ocrResult.confidence}%</strong></span>}
                                    </div>
                                </div>
                                {ocrResult.itemsFound > 0 && (
                                    <button type="button" className="btn btn-primary btn-sm" onClick={() => setTab('manual')}>
                                        Review Items →
                                    </button>
                                )}
                            </div>

                            {ocrResult.rawText && (
                                <details style={{ marginTop: 10 }}>
                                    <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)', userSelect: 'none', padding: '4px 0' }}>
                                        📄 Raw OCR text (debug view)
                                    </summary>
                                    <pre style={{ marginTop: 8, padding: 12, background: '#ffffff', borderRadius: 10, fontSize: 11, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', maxHeight: 180, overflowY: 'auto', border: '1px solid #e2e8f0' }}>
                                        {ocrResult.rawText}
                                    </pre>
                                </details>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── Voice Tab ──────────────────────────────────────────────────── */}
            {tab === 'voice' && (
                <div className="card" style={{ marginBottom: 20 }}>
                    <div className="card-title" style={{ marginBottom: 12 }}>🎤 Voice Input</div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
                        Say: <strong>"Add rice 1200"</strong> or <strong>"chicken 850"</strong> or <strong>"two milk 240"</strong>
                    </p>
                    <button className={`btn ${isListening ? 'btn-danger' : 'btn-primary'}`} onClick={startVoice} style={{ marginBottom: 12 }}>
                        {isListening ? '🔴 Listening... (speak now)' : '🎤 Start Speaking'}
                    </button>
                    {voiceText && (
                        <div className="alert alert-info">
                            <span className="alert-icon">💬</span>
                            <span>Heard: <strong>"{voiceText}"</strong></span>
                        </div>
                    )}
                </div>
            )}

            {/* ── Bill Form ──────────────────────────────────────────────────── */}
            <form onSubmit={handleSubmit}>
                {/* Bill Details Card */}
                <div className="card" style={{ marginBottom: 16 }}>
                    <div className="card-title" style={{ marginBottom: 16 }}>🏪 Bill Details</div>
                    <div className="responsive-grid-2" style={{ gap: 14 }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Store / Shop Name</label>
                            <ItemSelector
                                value={storeName}
                                onChange={setStoreName}
                                suggestions={suggestions.stores}
                                placeholder="e.g. Keells Super, Cargills Food City"
                            />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Bill Date</label>
                            <input className="form-input" type="date" value={billDate} onChange={e => setBillDate(e.target.value)} />
                        </div>
                    </div>
                </div>

                {/* Items Card */}
                <div className="card" style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <div>
                            <div className="card-title"><ShoppingCart size={18} style={{ marginRight: 6 }} /> Items</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                                {items.length} rows · {validItems.length} valid
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddCat(s => !s)}>
                                <Plus size={14} /> Category
                            </button>
                            <button type="button" className="btn btn-primary btn-sm" onClick={addItem}>
                                <Plus size={14} /> Add Item
                            </button>
                        </div>
                    </div>

                    {/* Add custom category inline */}
                    {showAddCat && (
                        <div style={{ background: '#ecfdf5', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#34d399', marginBottom: 10 }}>Add New Category</div>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                                <div style={{ flex: 0 }}>
                                    <label className="form-label">Emoji</label>
                                    <input
                                        className="form-input" style={{ width: 60, textAlign: 'center', fontSize: 20, padding: '6px' }}
                                        value={newCatEmoji} onChange={e => setNewCatEmoji(e.target.value)} maxLength={2}
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label className="form-label">Category Name</label>
                                    <input
                                        className="form-input" placeholder="e.g. Baby Food, Pet Food"
                                        value={newCatLabel} onChange={e => setNewCatLabel(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddCategory())}
                                    />
                                </div>
                                <button type="button" className="btn btn-primary btn-sm" onClick={handleAddCategory} style={{ flexShrink: 0 }}>
                                    Add
                                </button>
                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAddCat(false)} style={{ flexShrink: 0 }}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Column Headers */}
                    <div className="modal-table-container">
                        <div className="modal-table-inner">
                            <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1.6fr 70px 110px 110px 36px', gap: 6, padding: '0 6px 8px', marginBottom: 4, borderBottom: '1px solid #e2e8f0' }}>
                                {['Item Name', 'Category', 'Qty', 'Unit Price', 'Total', ''].map(h => (
                                    <span key={h} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.7 }}>{h}</span>
                                ))}
                            </div>

                            {/* Item Rows */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {items.map((item, index) => {
                                    const cat = getCatInfo(item.category);
                                    const isValid = item.name.trim() && item.totalPrice > 0;
                                    return (
                                        <div key={index} style={{
                                            display: 'grid', gridTemplateColumns: '2.5fr 1.6fr 70px 110px 110px 36px',
                                            gap: 6, alignItems: 'center',
                                            background: isValid ? '#f0fdf4' : '#ffffff',
                                            border: `1px solid ${isValid ? '#dcfce7' : '#f1f5f9'}`,
                                            borderRadius: 10, padding: '8px 8px',
                                            transition: 'all 0.15s',
                                        }}>
                                            {/* Item Name */}
                                            <ItemSelector
                                                value={item.name}
                                                onChange={val => updateItem(index, 'name', val)}
                                                suggestions={suggestions.items}
                                                placeholder="e.g. Basmati Rice 5kg"
                                                onSelectSuggestion={(name) => {
                                                    const knownCat = suggestions.itemMap[name];
                                                    const knownPrice = suggestions.priceMap[name];
                                                    if (knownCat) updateItem(index, 'category', knownCat);
                                                    if (knownPrice) updateItem(index, 'unitPrice', knownPrice);
                                                }}
                                            />

                                            {/* Category */}
                                            <div style={{ position: 'relative' }}>
                                                <select
                                                    className="form-select"
                                                    value={item.category}
                                                    onChange={e => updateItem(index, 'category', e.target.value)}
                                                    style={{
                                                        padding: '7px 24px 7px 8px', fontSize: 12, fontWeight: 600,
                                                        background: `${cat.color}18`,
                                                        borderColor: `${cat.color}40`,
                                                        color: cat.color,
                                                    }}
                                                >
                                                    {categories.map(c => (
                                                        <option key={c.value} value={c.value}>{c.label}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Quantity */}
                                            <input
                                                className="form-input"
                                                type="number" min="0.001" step="any"
                                                value={item.quantity}
                                                onChange={e => updateItem(index, 'quantity', e.target.value)}
                                                style={{ padding: '7px 6px', fontSize: 13, textAlign: 'center', background: '#f8fafc' }}
                                            />

                                            {/* Unit Price */}
                                            <div style={{ position: 'relative' }}>
                                                <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                                                    {currInfo.symbol}
                                                </span>
                                                <input
                                                    className="form-input"
                                                    type="number" min="0" step="0.01"
                                                    value={item.unitPrice || ''}
                                                    placeholder="0"
                                                    onChange={e => updateItem(index, 'unitPrice', e.target.value)}
                                                    style={{ padding: '7px 6px 7px 22px', fontSize: 13, background: '#f8fafc' }}
                                                />
                                            </div>

                                            {/* Total */}
                                            <div style={{
                                                fontWeight: 700, fontSize: 14,
                                                color: item.totalPrice > 0 ? '#34d399' : 'var(--text-muted)',
                                                textAlign: 'right', paddingRight: 4,
                                            }}>
                                                {currInfo.symbol} {(parseFloat(item.totalPrice) || 0).toLocaleString()}
                                            </div>

                                            {/* Remove */}
                                            <button
                                                type="button"
                                                onClick={() => removeItem(index)}
                                                title="Remove item"
                                                style={{
                                                    width: 28, height: 28, borderRadius: 8, border: 'none',
                                                    background: 'rgba(244,63,94,0.1)', color: '#f43f5e',
                                                    cursor: 'pointer', fontSize: 16, display: 'flex',
                                                    alignItems: 'center', justifyContent: 'center',
                                                    transition: 'all 0.15s'
                                                }}
                                            ><Trash2 size={14} /></button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Add Item Row button (inline) */}
                    <button
                        type="button"
                        onClick={addItem}
                        style={{
                            width: '100%', marginTop: 10, padding: '10px', borderRadius: 10, border: '1px dashed #e2e8f0',
                            background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
                            fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
                        }}
                        onMouseOver={e => e.currentTarget.style.borderColor = 'var(--primary-500)'}
                        onMouseOut={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                    >
                        ＋ Add Another Item
                    </button>

                    {/* Totals Bar */}
                    <div className="modal-footer-totals" style={{
                        marginTop: 20, padding: '20px 24px',
                        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                        borderRadius: 16, border: '1px solid #e2e8f0',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,1)'
                    }}>
                        <div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px' }}>
                                {validItems.length} ITEMS DETECTED
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                                {Object.entries(
                                    validItems.reduce((acc, it) => {
                                        acc[it.category] = (acc[it.category] || 0) + (it.totalPrice || 0);
                                        return acc;
                                    }, {})
                                ).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([cat, amt]) => {
                                    const ci = getCatInfo(cat);
                                    return (
                                        <span key={cat} style={{ background: '#ffffff', color: 'var(--primary)', border: '1px solid #e2e8f0', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                            {ci.label.split(' ')[0]} {currInfo.symbol}{Math.round(amt).toLocaleString()}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '1px' }}>GRAND TOTAL</div>
                            <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--primary)', letterSpacing: -1.5 }}>
                                {currInfo.symbol} {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Notes */}
                <div className="card" style={{ marginBottom: 16 }}>
                    <label className="form-label">📝 Notes (optional)</label>
                    <textarea className="form-textarea" placeholder="Any notes about this bill..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ marginBottom: 0 }} />
                </div>

                {/* Action Buttons */}
                <div className="modal-footer-actions" style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => navigate('/bills')}>Cancel</button>
                    <button type="submit" className="btn btn-primary btn-lg" disabled={loading || validItems.length === 0} style={{ minWidth: 160 }}>
                        {loading ? '⏳ Saving...' : `💾 Save Bill (${validItems.length} items)`}
                    </button>
                </div>
            </form>
        </div>
    );
}
