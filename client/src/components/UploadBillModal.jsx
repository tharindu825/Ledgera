// UploadBillModal.jsx – Full Grocery Bill feature inside a modal
import { useState, useRef, useCallback, useEffect } from 'react';
import { createBill, scanBillBase64, getAccounts, getCategories, getBillSuggestions, predictCategory, createTransaction } from '../services/api';
import ItemSelector from './ItemSelector';
import SubcategorySelector from './SubcategorySelector';
import CategorySelector from './CategorySelector';
import { useAuth } from '../context/AuthContext';
import { getCurrency } from '../utils/currency';
import toast from 'react-hot-toast';

const newItem = (o = {}) => ({ name: '', category: 'other', subcategory: '', quantity: 1, unitPrice: 0, totalPrice: 0, ...o });

export default function UploadBillModal({ isOpen, onClose, onUploaded }) {
    const { user } = useAuth();
    const curr = getCurrency(user?.currency || 'LKR');

    const [tab, setTab] = useState('quick');
    const [quickData, setQuickData] = useState({ amount: '', type: 'expense', category: 'other', subcategory: '', merchant: '', description: '' });
    const [storeName, setStoreName] = useState('');
    const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState('');
    const [discountAmount, setDiscountAmount] = useState(0);
    const [items, setItems] = useState([newItem()]);
    const [categories, setCategories] = useState([{ value: 'other', label: '📦 Other', color: '#64748b' }]);
    const [rawCategories, setRawCategories] = useState([]); // For the CategorySelector component
    const [loading, setLoading] = useState(false);
    const [ocrLoading, setOcrLoading] = useState(false);
    const [ocrResult, setOcrResult] = useState(null);
    const [lastImageData, setLastImageData] = useState(null);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef(null);
    const [accounts, setAccounts] = useState([]);
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [suggestions, setSuggestions] = useState({ items: [], stores: [], subcategories: [], itemMap: {}, priceMap: {}, subCatMap: {} });

    useEffect(() => {
        getAccounts().then(res => {
            setAccounts(res.data);
            // Default to Cash account for new bills
            const cashAcc = res.data.find(a => a.isDefault);
            if (cashAcc) setSelectedAccountId(cashAcc._id);
        }).catch(() => { });
        getBillSuggestions().then(res => setSuggestions(res.data)).catch(() => { });
        getCategories().then(res => {
            setRawCategories(res.data);
            if (res.data.length > 0) {
                const mapped = res.data.map(c => ({
                    value: c.mainCategory,
                    label: `✨ ${c.mainCategory.charAt(0).toUpperCase() + c.mainCategory.slice(1).replace(/_/g, ' ')}`,
                    color: c.color || '#94a3b8'
                }));
                if (!mapped.find(m => m.value === 'other')) {
                    mapped.push({ value: 'other', label: '📦 Other', color: '#64748b' });
                }
                setCategories(mapped);
            }
        }).catch(() => { });
    }, []);

    /* ── Item helpers ───────────────────────────────────────────────────── */
    const addItem = () => setItems(p => [...p, newItem()]);
    const removeItem = i => setItems(p => p.filter((_, idx) => idx !== i));
    const updateItem = (i, field, val) => {
        setItems(p => {
            const n = [...p];
            n[i] = { ...n[i], [field]: val };
            if (field === 'unitPrice' || field === 'quantity') {
                const up = parseFloat(field === 'unitPrice' ? val : n[i].unitPrice) || 0;
                const qty = parseFloat(field === 'quantity' ? val : n[i].quantity) || 1;
                n[i].totalPrice = parseFloat((up * qty).toFixed(3));
            }
            return n;
        });

        // Trigger AI prediction if name changes and category is 'other'
        if (field === 'name' && val.length > 3) {
            const currentItem = items[i];
            if (currentItem.category === 'other') {
                // Throttle/Debounce prediction
                clearTimeout(window.predictTimeout);
                window.predictTimeout = setTimeout(async () => {
                    try {
                        const res = await predictCategory(val);
                        if (res.data.category) updateItem(i, 'category', res.data.category);
                        if (res.data.subcategory) updateItem(i, 'subcategory', res.data.subcategory);
                    } catch (e) { }
                }, 1000);
            }
        }
    };

    const subTotal = items.reduce((s, it) => s + (parseFloat(it.totalPrice) || 0), 0);
    const totalAmount = Math.max(0, subTotal - (parseFloat(discountAmount) || 0));
    const validItems = items.filter(it => it.name.trim() && it.totalPrice > 0);
    const getCatInfo = val => categories.find(c => c.value === val) || categories[categories.length - 1];

    /* ── OCR ────────────────────────────────────────────────────────────── */
    const runOCR = useCallback(async (imageData) => {
        setOcrLoading(true);
        const toastId = toast.loading(
            <div style={{ marginLeft: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Reading Receipt...</div>
                <div style={{ fontSize: 11, opacity: 0.8 }}>AI is analyzing line items & totals</div>
            </div>,
            {
                style: {
                    background: '#0f172a',
                    color: '#fff',
                    borderRadius: 16,
                    padding: '12px 20px',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.1)'
                },
                icon: <div className="spinner-sm" style={{ width: 22, height: 22, border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            }
        );
        try {
            const res = await scanBillBase64(imageData);
            toast.dismiss(toastId);
            const data = res.data;
            setOcrResult(data);

            // Sync metadata
            if (data.storeName) setStoreName(data.storeName);
            if (data.billDate) setBillDate(new Date(data.billDate).toISOString().split('T')[0]);
            if (typeof data.discountAmount !== 'undefined') setDiscountAmount(data.discountAmount);

            if (data.items?.length > 0) {
                // Match AI results against user-defined categories
                const matchCategory = (aiCat) => {
                    if (!aiCat) return 'other';
                    const raw = aiCat.toLowerCase();
                    const noSpaces = raw.replace(/ /g, '_');
                    
                    // Exact match first (case insensitive)
                    let exact = rawCategories.find(c => c.mainCategory.toLowerCase() === raw);
                    if (exact) return exact.mainCategory;

                    // Match if user's DB category has spaces but AI returned underscores (or vice versa)
                    exact = rawCategories.find(c => c.mainCategory.toLowerCase().replace(/ /g, '_') === noSpaces);
                    if (exact) return exact.mainCategory;

                    // Partial match (e.g. "food" matches "food & dining")
                    const partial = rawCategories.find(c => c.mainCategory.toLowerCase().includes(raw) || raw.includes(c.mainCategory.toLowerCase()));
                    if (partial) return partial.mainCategory;
                    
                    return aiCat.toLowerCase(); // keep user's original casing but lowercase
                };

                const matchSubcategory = (aiSub, matchedCat) => {
                    if (!aiSub) return '';
                    const catDef = rawCategories.find(c => c.mainCategory === matchedCat);
                    if (!catDef || !catDef.subcategories || catDef.subcategories.length === 0) return aiSub;
                    // Exact match (case-insensitive)
                    const exact = catDef.subcategories.find(s => s.toLowerCase() === aiSub.toLowerCase());
                    if (exact) return exact;
                    // Partial match
                    const partial = catDef.subcategories.find(s => s.toLowerCase().includes(aiSub.toLowerCase()) || aiSub.toLowerCase().includes(s.toLowerCase()));
                    if (partial) return partial;
                    return aiSub;
                };

                // Collect ANY category found by AI and add to local dropdown
                const foundCats = [...new Set(data.items.map(it => it.category).filter(Boolean))];

                setCategories(current => {
                    const updated = [...current];
                    foundCats.forEach(cat => {
                        const val = matchCategory(cat);
                        if (!updated.find(c => c.value === val)) {
                            updated.push({
                                value: val,
                                label: `✨ ${val.charAt(0).toUpperCase() + val.slice(1).replace(/_/g, ' ')}`,
                                color: '#94a3b8'
                            });
                        }
                    });
                    return updated;
                });

                setItems(data.items.map(it => {
                    const cat = matchCategory(it.category);
                    const sub = matchSubcategory(it.subcategory, cat);
                    return {
                        name: it.name || '',
                        category: cat,
                        subcategory: sub,
                        quantity: it.quantity || 1,
                        unitPrice: it.unitPrice || (it.totalPrice / (it.quantity || 1)) || 0,
                        totalPrice: it.totalPrice || 0,
                    };
                }));

                toast.success(`✅ ${data.items.length} items extracted! Review and save.`);
                setTab('manual');
            } else {
                toast('⚠️ No items detected — add manually.', { icon: '⚠️' });
                setTab('manual');
            }
        } catch (err) {
            toast.dismiss(toastId);
            const detail = err.response?.data?.detail || err.message || 'Unknown error';
            toast.error(`Scan failed: ${detail}`, {
                duration: 6000,
                style: { borderRadius: 16, background: '#fef2f2', color: '#991b1b', fontWeight: 600, border: '1px solid #fee2e2' }
            });
        } finally {
            setOcrLoading(false);
        }
    }, [setStoreName, setBillDate, setDiscountAmount, setCategories, setItems, setTab, rawCategories]);

    const handleImageUpload = useCallback(async (file) => {
        if (!file) return;
        if (file.size > 15 * 1024 * 1024) return toast.error('Image too large (max 15MB)');
        const reader = new FileReader();
        reader.onload = async () => { setLastImageData(reader.result); await runOCR(reader.result); };
        reader.onerror = () => toast.error('Failed to read image');
        reader.readAsDataURL(file);
    }, [runOCR]);

    /* ── Submit ─────────────────────────────────────────────────────────── */
    const handleSubmit = async (e) => {
        if (e) e.preventDefault();

        if (tab === 'quick') {
            if (!quickData.amount || parseFloat(quickData.amount) <= 0) return toast.error('Enter a valid amount');
            setLoading(true);
            try {
                await createTransaction({ ...quickData, date: billDate, accountId: selectedAccountId });
                toast.success('🎉 Transaction saved!');
                onUploaded && onUploaded();
                handleClose();
            } catch (err) {
                toast.error(err.response?.data?.error || 'Failed to save');
            } finally {
                setLoading(false);
            }
            return;
        }

        if (validItems.length === 0) return toast.error('Add at least one item with a name and price');
        setLoading(true);
        try {
            await createBill({ items: validItems, storeName, billDate, notes, discountAmount: parseFloat(discountAmount) || 0, inputMethod: tab, accountId: selectedAccountId || null });
            toast.success('🎉 Grocery bill saved!');
            onUploaded && onUploaded();
            handleClose();
        } catch (err) {
            if (err.response?.status === 409) toast.error('Duplicate bill', { duration: 5000 });
            else toast.error(err.response?.data?.error || 'Failed to save bill');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setTab('quick'); setStoreName(''); setBillDate(new Date().toISOString().split('T')[0]);
        setNotes(''); setDiscountAmount(0); setItems([newItem()]); setOcrResult(null); setLastImageData(null);
        setQuickData({ amount: '', type: 'expense', category: 'other', subcategory: '', merchant: '', description: '' });

        const defaultAcc = accounts.find(a => a.isDefault);
        setSelectedAccountId(defaultAcc ? defaultAcc._id : '');

        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="modal-wrapper" style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
            <div className="modal-container" style={{
                background: '#fff', border: '1px solid #e2e8f0', borderRadius: 24,
                width: '95vw', maxWidth: 960, height: '85vh', minHeight: 640, maxHeight: '92vh', overflow: 'hidden',
                display: 'flex', flexDirection: 'column',
                boxShadow: '0 32px 80px -12px rgba(15,23,42,0.25)',
                animation: 'modalSlide 0.3s cubic-bezier(0.16,1,0.3,1)',
            }}>
                {/* ── Header ──────────────────────────────────────────── */}
                <div style={{
                    padding: '20px 28px', borderBottom: '1px solid #f1f5f9',
                    background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    flexShrink: 0,
                }}>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: 18, color: '#0f172a' }}>📋 Add Entry</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                            {tab === 'quick' ? 'Record a single expense or income' : 'Detailed grocery bill tracking'}
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        {tab !== 'quick' && validItems.length > 0 && (
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Total</div>
                                <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>
                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: user?.currency || 'LKR', minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(totalAmount)}
                                </div>
                            </div>
                        )}
                        {tab === 'quick' && quickData.amount > 0 && (
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Entry Amount</div>
                                <div style={{ fontSize: 20, fontWeight: 800, color: quickData.type === 'expense' ? '#f43f5e' : '#10b981' }}>
                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: user?.currency || 'LKR', minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(quickData.amount)}
                                </div>
                            </div>
                        )}
                        <button onClick={handleClose} style={{
                            background: '#f1f5f9', border: 'none', borderRadius: 12,
                            width: 36, height: 36, cursor: 'pointer', fontSize: 16, color: '#64748b',
                        }}>✕</button>
                    </div>
                </div>

                {/* ── Tab Switcher ─────────────────────────────────────── */}
                <div style={{ padding: '12px 28px 0', display: 'flex', gap: 8, flexShrink: 0, borderBottom: '1px solid #f1f5f9', background: '#fcfdfe' }}>
                    {[
                        { key: 'quick', icon: '✏️', label: 'Quick Entry' },
                        { key: 'manual', icon: '✍️', label: 'Item Wise' },
                        { key: 'scan', icon: '📸', label: 'Scan Receipt' },
                    ].map(t => (
                        <button key={t.key} type="button" onClick={() => setTab(t.key)} style={{
                            padding: '10px 16px', borderRadius: '10px 10px 0 0', fontWeight: 600, fontSize: 13,
                            border: '1px solid', borderBottom: 'none',
                            borderColor: tab === t.key ? '#e2e8f0' : 'transparent',
                            background: tab === t.key ? '#ffffff' : 'transparent',
                            color: tab === t.key ? '#0f172a' : '#64748b',
                            cursor: 'pointer', transition: 'all 0.15s',
                        }}>
                            {t.icon} {t.label}
                        </button>
                    ))}
                </div>

                {/* ── Body ─────────────────────────────────────────────── */}
                <div className="modal-body custom-scrollbar" style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>

                    {/* ── Quick Entry Tab ─────────────────────────────────── */}
                    {tab === 'quick' && (
                        <form id="quick-form" onSubmit={handleSubmit}>
                            <div className="grid-2">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    <div style={{ textAlign: 'left' }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>Entry Amount ({curr.symbol})</div>
                                        <input
                                            style={{ width: '100%', border: 'none', fontSize: 60, fontWeight: 900, color: '#0f172a', outline: 'none', background: 'transparent', letterSpacing: -2 }}
                                            type="number" step="any" min="0" required autoFocus
                                            value={quickData.amount} onChange={e => setQuickData({ ...quickData, amount: e.target.value })}
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 12, padding: 4 }}>
                                        {['expense', 'income'].map(t => (
                                            <button key={t} type="button"
                                                style={{
                                                    flex: 1, padding: '12px 0', border: 'none', borderRadius: 8,
                                                    fontSize: 14, fontWeight: 700, cursor: 'pointer',
                                                    background: quickData.type === t ? '#fff' : 'transparent',
                                                    color: quickData.type === t ? (t === 'expense' ? '#f43f5e' : '#10b981') : '#64748b',
                                                    boxShadow: quickData.type === t ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                                                }}
                                                onClick={() => setQuickData({ ...quickData, type: t })}>
                                                {t === 'expense' ? '💸 Expense' : '💰 Income'}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Payment Source</label>
                                        <select className="form-select" value={selectedAccountId}
                                            onChange={e => setSelectedAccountId(e.target.value)}
                                            style={{ borderColor: selectedAccountId && quickData.type === 'expense' && accounts.find(a => a._id === selectedAccountId)?.balance < (parseFloat(quickData.amount) || 0) ? '#ef4444' : '' }}
                                        >
                                            <option value="">Select Account</option>
                                            {accounts.map(acc => (
                                                <option key={acc._id} value={acc._id}>{acc.icon} {acc.name} — {curr.symbol}{acc.balance.toLocaleString()}</option>
                                            ))}
                                        </select>
                                        {selectedAccountId && quickData.type === 'expense' && accounts.find(a => a._id === selectedAccountId)?.balance < (parseFloat(quickData.amount) || 0) && (
                                            <div style={{ color: '#ef4444', fontSize: 11, fontWeight: 700, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <span>⚠️</span> Insufficient balance available
                                            </div>
                                        )}
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{quickData.type === 'expense' ? 'Merchant / Paid To' : 'Income Source'}</label>
                                        <input className="form-input" value={quickData.merchant}
                                            onChange={e => setQuickData({ ...quickData, merchant: e.target.value })}
                                            placeholder={quickData.type === 'expense' ? 'e.g. Starbucks, Grocery' : 'e.g. Salary, Gift'} />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    <div className="form-group">
                                        <label className="form-label">Date of Transaction</label>
                                        <input className="form-input" type="date" required
                                            value={billDate} onChange={e => setBillDate(e.target.value)} />
                                    </div>
                                    <CategorySelector
                                        label="Primary Category"
                                        categories={rawCategories}
                                        type={quickData.type}
                                        value={quickData.category}
                                        onChange={cat => setQuickData({ ...quickData, category: cat, subcategory: '' })}
                                    />
                                    <div className="form-group">
                                        <label className="form-label">Subcategory (optional)</label>
                                        <SubcategorySelector
                                            subcategories={rawCategories.find(c => c.type === quickData.type && c.mainCategory === quickData.category)?.subcategories || []}
                                            value={quickData.subcategory}
                                            onChange={sub => setQuickData({ ...quickData, subcategory: sub })}
                                            placeholder="Select subcategory"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Notes / Description</label>
                                        <textarea className="form-input" rows={3} style={{ height: 'auto', resize: 'none' }}
                                            value={quickData.description} onChange={e => setQuickData({ ...quickData, description: e.target.value })}
                                            placeholder="Add a short description..." />
                                    </div>
                                </div>
                            </div>
                        </form>
                    )}

                    {/* ── Scan Tab ─────────────────────────────────────── */}
                    {tab === 'scan' && (
                        <div>
                            <div
                                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={e => { e.preventDefault(); setDragOver(false); handleImageUpload(e.dataTransfer.files[0]); }}
                                onClick={() => !ocrLoading && fileInputRef.current?.click()}
                                style={{
                                    border: `2px dashed ${dragOver ? '#0f172a' : '#e2e8f0'}`,
                                    borderRadius: 16, padding: '40px 20px', textAlign: 'center',
                                    cursor: ocrLoading ? 'wait' : 'pointer',
                                    background: dragOver ? 'rgba(15,23,42,0.03)' : '#fafafa',
                                    transition: 'all 0.2s', marginBottom: 16,
                                }}
                            >
                                <input ref={fileInputRef} type="file" accept="image/*"
                                    onChange={e => handleImageUpload(e.target.files[0])} style={{ display: 'none' }} />
                                {ocrLoading ? (
                                    <div style={{ position: 'relative' }}>
                                        <div style={{
                                            width: 60, height: 60, margin: '0 auto 20px', borderRadius: '50%',
                                            border: '4px solid #f1f5f9', borderTopColor: '#0f172a',
                                            animation: 'spin 1s cubic-bezier(0.5, 0, 0.5, 1) infinite'
                                        }} />
                                        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 17, letterSpacing: -0.5, marginBottom: 6 }}>
                                            🤖 AI Executive Analysis
                                        </div>
                                        <div style={{ fontSize: 13, color: '#64748b', maxWidth: 280, margin: '0 auto' }}>
                                            Extracting items, prices, and categories with neural precision...
                                        </div>
                                        {lastImageData && (
                                            <div style={{ marginTop: 24, position: 'relative', overflow: 'hidden', borderRadius: 12, display: 'inline-block' }}>
                                                <img src={lastImageData} alt="Scanning" style={{ maxHeight: 150, opacity: 0.5, filter: 'grayscale(1)' }} />
                                                <div style={{
                                                    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                                                    background: 'linear-gradient(90deg, transparent, #3b82f6, transparent)',
                                                    boxShadow: '0 0 15px #3b82f6',
                                                    animation: 'scanBar 2s ease-in-out infinite'
                                                }} />
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        <div style={{ fontSize: 48, marginBottom: 12 }}>{lastImageData ? '🔄' : '📷'}</div>
                                        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 16, marginBottom: 6, letterSpacing: -0.3 }}>
                                            {lastImageData ? 'Tap to re-scan receipt' : 'Add Receipt Image'}
                                        </div>
                                        <div style={{ fontSize: 13, color: '#94a3b8' }}>Drag or click to choose from JPG, PNG, WEBP</div>
                                        {lastImageData && (
                                            <div style={{ marginTop: 16 }}>
                                                <img src={lastImageData} alt="Preview"
                                                    style={{ maxHeight: 140, borderRadius: 12, boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }} />
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {ocrResult && (
                                <div style={{
                                    padding: '14px 18px', borderRadius: 12, marginBottom: 12,
                                    background: ocrResult.items?.length > 0 ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
                                    border: `1px solid ${ocrResult.items?.length > 0 ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
                                    display: 'flex', alignItems: 'center', gap: 14,
                                }}>
                                    <span style={{ fontSize: 24 }}>{ocrResult.items?.length > 0 ? '✅' : '⚠️'}</span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 700, color: ocrResult.items?.length > 0 ? '#10b981' : '#f59e0b', fontSize: 14 }}>
                                            {ocrResult.items?.length > 0 ? `${ocrResult.items.length} items extracted!` : 'No items found — try adding manually'}
                                        </div>
                                        {ocrResult.storeName && <div style={{ fontSize: 12, color: '#64748b' }}>Store: <strong>{ocrResult.storeName}</strong></div>}
                                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                                            AI Model: {ocrResult.strategy || ocrResult.model_used}
                                        </div>
                                    </div>
                                    {ocrResult.items?.length > 0 && (
                                        <button type="button" className="btn btn-primary btn-sm" onClick={() => setTab('manual')}>
                                            Review Items →
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Manual Entry Tab ──────────────────────────────── */}
                    {tab === 'manual' && (
                        <form id="bill-form" onSubmit={handleSubmit}>
                            {/* Bill Details */}
                            <div className="modal-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Store / Shop Name</label>
                                    <ItemSelector value={storeName} onChange={setStoreName} suggestions={suggestions.stores} placeholder="e.g. Keells Super, Cargills" />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Bill Date</label>
                                    <input className="form-input" type="date" value={billDate} onChange={e => setBillDate(e.target.value)} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">🏦 Payment Source</label>
                                    <select className="form-select" value={selectedAccountId}
                                        onChange={e => setSelectedAccountId(e.target.value)}
                                        style={{ borderColor: selectedAccountId && accounts.find(a => a._id === selectedAccountId)?.balance < totalAmount ? '#ef4444' : '' }}
                                    >
                                        <option value="">Select Account</option>
                                        {accounts.map(acc => (
                                            <option key={acc._id} value={acc._id}>
                                                {acc.icon} {acc.name} — {curr.symbol} {acc.balance.toLocaleString()}
                                            </option>
                                        ))}
                                    </select>
                                    {selectedAccountId && accounts.find(a => a._id === selectedAccountId)?.balance < totalAmount && (
                                        <div style={{ color: '#ef4444', fontSize: 10, fontWeight: 700, marginTop: 4 }}>⚠️ Insufficient balance</div>
                                    )}
                                </div>
                            </div>

                            {/* Items Table */}
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                    <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>🛒 Items <span style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>({validItems.length} valid of {items.length})</span></div>
                                    <button type="button" className="btn btn-primary btn-sm" onClick={addItem}>＋ Add Item</button>
                                </div>

                                {/* Column Headers */}
                                <div className="modal-table-container">
                                    <div className="modal-table-inner">
                                        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.1fr 1.1fr 55px 85px 85px 32px', gap: 6, padding: '0 4px 6px', borderBottom: '1px solid #f1f5f9', marginBottom: 6 }}>
                                            {['Item Name', 'Category', 'Subcategory', 'Qty', 'Unit Price', 'Total', ''].map(h => (
                                                <span key={h} style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6 }}>{h}</span>
                                            ))}
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {items.map((item, idx) => {
                                                const cat = getCatInfo(item.category);
                                                const isValid = item.name.trim() && item.totalPrice > 0;
                                                return (
                                                    <div key={idx} style={{
                                                        display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 60px 100px 100px 32px',
                                                        gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 14,
                                                        background: isValid ? '#ffffff' : '#f8fafc',
                                                        border: `1px solid ${isValid ? '#e2e8f0' : '#f1f5f9'}`,
                                                        boxShadow: isValid ? '0 2px 6px rgba(0,0,0,0.02)' : 'none',
                                                        transition: 'all 0.2s'
                                                    }}>
                                                        <ItemSelector
                                                            value={item.name}
                                                            suggestions={suggestions.items}
                                                            placeholder="Item name"
                                                            onChange={val => updateItem(idx, 'name', val)}
                                                            onSelectSuggestion={async (name) => {
                                                                // 1. Check history first
                                                                const historyCat = suggestions.itemMap[name];
                                                                const historySub = suggestions.subCatMap[name];
                                                                const historyPrice = suggestions.priceMap[name];

                                                                if (historyCat) updateItem(idx, 'category', historyCat);
                                                                if (historySub) updateItem(idx, 'subcategory', historySub);
                                                                if (historyPrice) updateItem(idx, 'unitPrice', historyPrice);

                                                                // 2. If no category found, use AI
                                                                if (!historyCat) {
                                                                    try {
                                                                        const res = await predictCategory(name);
                                                                        if (res.data.category) updateItem(idx, 'category', res.data.category);
                                                                        if (res.data.subcategory) updateItem(idx, 'subcategory', res.data.subcategory);
                                                                    } catch (err) { console.error('AI prediction failed', err); }
                                                                }
                                                            }}
                                                        />
                                                        <select className="form-select" value={item.category}
                                                            onChange={e => updateItem(idx, 'category', e.target.value)}
                                                            style={{ padding: '8px 12px', fontSize: 12, color: cat.color, background: `${cat.color}10`, borderColor: `${cat.color}20`, borderRadius: 10, appearance: 'none' }}>
                                                            {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                                        </select>
                                                        <SubcategorySelector
                                                            value={item.subcategory || ''}
                                                            subcategories={rawCategories.find(c => c.type === 'expense' && c.mainCategory === item.category)?.subcategories || []}
                                                            onChange={val => updateItem(idx, 'subcategory', val)}
                                                            placeholder="Subcategory"
                                                        />
                                                        <input className="form-input" type="number" min="0.001" step="any" value={item.quantity}
                                                            onChange={e => updateItem(idx, 'quantity', e.target.value)}
                                                            style={{ padding: '8px 4px', fontSize: 13, textAlign: 'center', borderRadius: 10 }} />
                                                        <input className="form-input" type="number" min="0" step="any" value={item.unitPrice || ''}
                                                            placeholder="0" onChange={e => updateItem(idx, 'unitPrice', e.target.value)}
                                                            style={{ padding: '8px 12px', fontSize: 13, borderRadius: 10 }} />
                                                        <div style={{ fontWeight: 800, fontSize: 14, color: item.totalPrice > 0 ? '#0f172a' : '#94a3b8', textAlign: 'right' }}>
                                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: user?.currency || 'LKR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(item.totalPrice)}
                                                        </div>
                                                        <button type="button" onClick={() => removeItem(idx)}
                                                            style={{ width: 32, height: 32, borderRadius: 10, border: 'none', background: '#fef2f2', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <button type="button" onClick={addItem} style={{
                                    width: '100%', marginTop: 8, padding: '9px', borderRadius: 10,
                                    border: '1px dashed #e2e8f0', background: 'transparent', color: '#94a3b8',
                                    cursor: 'pointer', fontSize: 13, fontWeight: 600,
                                }}>＋ Add Another Item</button>

                                {/* Grand Total */}
                                {validItems.length > 0 && (
                                    <div style={{ marginTop: 14 }}>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 12, gap: 12 }}>
                                            <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 700 }}>Discount ({curr.symbol}):</div>
                                            <input className="form-input" type="number" min="0" step="any" value={discountAmount || ''} placeholder="0" onChange={e => setDiscountAmount(e.target.value)} style={{ width: 120, textAlign: 'right', padding: '8px 12px' }} />
                                        </div>
                                        <div className="modal-footer-totals" style={{
                                            padding: '16px 20px', borderRadius: 14,
                                            background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
                                            border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        }}>
                                            <div style={{ fontSize: 13, color: '#64748b' }}>
                                                {validItems.length} valid items<br />
                                                Subtotal: {new Intl.NumberFormat('en-US', { style: 'currency', currency: user?.currency || 'LKR', minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(subTotal)}
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', textAlign: 'right' }}>Grand Total</div>
                                                <div style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', letterSpacing: -1 }}>
                                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: user?.currency || 'LKR', minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(totalAmount)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Notes */}
                            <div className="form-group">
                                <label className="form-label">📝 Notes (optional)</label>
                                <textarea className="form-textarea" placeholder="Any notes about this bill..." value={notes}
                                    onChange={e => setNotes(e.target.value)} rows={2} style={{ marginBottom: 0 }} />
                            </div>
                        </form>
                    )}
                </div>

                {/* ── Footer Actions ───────────────────────────────────── */}
                <div className="modal-footer modal-footer-actions" style={{
                    padding: '16px 28px', borderTop: '1px solid #f1f5f9',
                    display: 'flex', gap: 12, justifyContent: 'flex-end', flexShrink: 0, background: '#f8fafc',
                }}>
                    <button className="btn btn-ghost" onClick={handleClose} disabled={loading}>Cancel</button>
                    {tab === 'scan' && !ocrResult && (
                        <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()} disabled={ocrLoading}>
                            {ocrLoading ? '⏳ Scanning…' : '📸 Choose Receipt Image'}
                        </button>
                    )}
                    {tab === 'quick' && (
                        <button type="submit" form="quick-form" className="btn btn-primary" disabled={loading} style={{ padding: '14px 28px' }}>
                            {loading ? '⏳ Saving…' : `Save ${quickData.type === 'expense' ? 'Expense' : 'Income'}`}
                        </button>
                    )}
                    {(tab === 'manual' || (tab === 'scan' && ocrResult)) && (
                        <button
                            type="submit" form="bill-form"
                            className="btn btn-primary"
                            onClick={tab !== 'manual' ? () => setTab('manual') : undefined}
                            disabled={loading || (tab === 'manual' && validItems.length === 0)}
                        >
                            {loading ? '⏳ Saving…' : tab === 'manual' ? `💾 Save Bill (${validItems.length} items)` : '✍️ Review & Save'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
