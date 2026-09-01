import { useState, useEffect } from 'react';
import { updateBill, getAccounts, getCategories } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getCurrency } from '../utils/currency';
import { dbCategoriesToOptions } from '../utils/categoryUtils';
import toast from 'react-hot-toast';

export default function EditBillModal({ bill, onClose, onSaved }) {
    const { user } = useAuth();
    const currInfo = getCurrency(user?.currency || 'LKR');

    const [storeName, setStoreName] = useState(bill.storeName || '');
    const [billDate, setBillDate] = useState(bill.billDate ? bill.billDate.split('T')[0] : '');
    const [notes, setNotes] = useState(bill.notes || '');
    const [discountAmount, setDiscountAmount] = useState(bill.discountAmount || 0);
    const [items, setItems] = useState(
        (bill.items || []).map(it => ({ ...it, totalPrice: it.totalPrice?.toString() || '' }))
    );
    const [accountId, setAccountId] = useState(bill.accountId || '');

    const [accounts, setAccounts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [saving, setSaving] = useState(false);
    const [loadingData, setLoadingData] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [catsRes, accsRes] = await Promise.all([
                    getCategories(),
                    getAccounts()
                ]);
                const expenseCats = dbCategoriesToOptions(catsRes.data.filter(c => c.type === 'expense'));

                setCategories(expenseCats.length > 0 ? expenseCats : [{ value: 'other', label: '📦 Other', color: '#64748b' }]);
                setAccounts(accsRes.data);
            } catch (error) {
                console.error("Error loading specific modal data", error);
            } finally {
                setLoadingData(false);
            }
        };
        loadData();
    }, []);

    const updateItem = (i, field, val) => {
        setItems(prev => {
            const next = [...prev];
            next[i] = { ...next[i], [field]: val };
            if (field === 'unitPrice' || field === 'quantity') {
                const up = parseFloat(field === 'unitPrice' ? val : next[i].unitPrice) || 0;
                const qty = parseFloat(field === 'quantity' ? val : next[i].quantity) || 1;
                next[i].totalPrice = (up * qty).toString();
            }
            return next;
        });
    };

    const addItem = () => setItems(prev => [...prev, { name: '', category: categories[0]?.value || 'other', subcategory: '', quantity: 1, unitPrice: 0, totalPrice: '0' }]);

    const removeItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i));

    const subTotal = items.reduce((sum, it) => sum + (parseFloat(it.totalPrice) || 0), 0);
    const totalAmount = Math.max(0, subTotal - (parseFloat(discountAmount) || 0));

    const handleSave = async () => {
        if (!storeName.trim()) return toast.error('Store name is required');
        const validItems = items.filter(it => it.name.trim());
        if (validItems.length === 0) return toast.error('Add at least one item');
        setSaving(true);
        try {
            const payload = {
                storeName,
                billDate,
                notes,
                discountAmount: parseFloat(discountAmount) || 0,
                accountId: accountId || null,
                items: validItems.map(it => ({
                    name: it.name,
                    category: it.category || 'other',
                    subcategory: it.subcategory || '',
                    quantity: parseFloat(it.quantity) || 1,
                    unitPrice: parseFloat(it.unitPrice) || 0,
                    totalPrice: parseFloat(it.totalPrice) || 0,
                }))
            };
            await updateBill(bill._id, payload);
            toast.success('Bill updated successfully!');
            onSaved();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update bill');
        } finally {
            setSaving(false);
        }
    };

    const getCatInfo = (val) => categories.find(c => c.value === val) || { color: '#64748b' };

    return (
        <div className="modal-wrapper" style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
            <div className="modal-container" style={{
                background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 24,
                width: '100%', maxWidth: 960, maxHeight: '92vh', overflow: 'hidden',
                display: 'flex', flexDirection: 'column',
                boxShadow: '0 32px 80px -12px rgba(15, 23, 42, 0.25)',
                animation: 'modalSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
                {/* Header */}
                <div style={{ padding: '24px 32px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: 20, color: '#0f172a', letterSpacing: '-0.5px' }}>✏️ Edit Receipt</div>
                        <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Refine details for accurate financial tracking.</div>
                    </div>
                    <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 12, width: 36, height: 36, cursor: 'pointer', fontSize: 16, color: '#94a3b8', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onMouseOver={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#64748b' }} onMouseOut={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#94a3b8' }}>✕</button>
                </div>

                {/* Body */}
                <div className="modal-body custom-scrollbar" style={{ flex: 1, padding: '28px 32px', overflowY: 'auto' }}>
                    {loadingData ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner"></div></div>
                    ) : (
                        <>
                            {/* Basic info */}
                            <div className="modal-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, marginBottom: 32 }}>
                                <div>
                                    <label className="form-label">Store Name</label>
                                    <input className="form-input" value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="e.g. Keells Super" />
                                </div>
                                <div>
                                    <label className="form-label">Transaction Date</label>
                                    <input className="form-input" type="date" value={billDate} onChange={e => setBillDate(e.target.value)} />
                                </div>
                                <div>
                                    <label className="form-label">🏦 Payment Source</label>
                                    <select className="form-select" value={accountId} onChange={e => setAccountId(e.target.value)}>
                                        <option value="">💵 Cash</option>
                                        {accounts.map(acc => (
                                            <option key={acc._id} value={acc._id}>
                                                {acc.icon} {acc.name} — {currInfo.symbol} {acc.balance.toLocaleString()}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Items */}
                            <div style={{ marginBottom: 24 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                    <label className="form-label" style={{ marginBottom: 0, color: '#0f172a', fontSize: 15, fontWeight: 700 }}>Line Items ({items.length})</label>
                                    <button className="btn btn-secondary btn-sm" onClick={addItem} style={{ borderRadius: 10 }}>+ Add Item</button>
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
                                                        <input className="form-input" placeholder="Item name" value={item.name}
                                                            onChange={e => updateItem(idx, 'name', e.target.value)}
                                                            style={{ padding: '8px 12px', fontSize: 13, borderRadius: 10 }} />
                                                        <select className="form-select" value={item.category}
                                                            onChange={e => updateItem(idx, 'category', e.target.value)}
                                                            style={{ padding: '8px 12px', fontSize: 12, color: cat.color, background: `${cat.color}10`, borderColor: `${cat.color}20`, borderRadius: 10, appearance: 'none' }}>
                                                            {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                                        </select>
                                                        <input className="form-input" placeholder="Sub-category" value={item.subcategory || ''}
                                                            onChange={e => updateItem(idx, 'subcategory', e.target.value)}
                                                            style={{ padding: '8px 12px', fontSize: 12, borderRadius: 10 }} />
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
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="modal-footer" style={{ padding: '20px 32px', borderTop: '1px solid #f1f5f9', background: '#fff', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <label className="form-label" style={{ marginBottom: 4 }}>Notes (optional)</label>
                            <textarea className="form-textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add any extra notes here..." rows={1} style={{ width: 300, resize: 'none', padding: '8px 12px' }} />
                        </div>

                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 700 }}>Discount ({currInfo.symbol}):</div>
                            <input className="form-input" type="number" min="0" step="any" value={discountAmount || ''} placeholder="0" onChange={e => setDiscountAmount(e.target.value)} style={{ width: 120, textAlign: 'right', padding: '8px 12px' }} />
                        </div>
                    </div>

                    <div className="modal-footer-totals" style={{
                        padding: '16px 20px', borderRadius: 14,
                        background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
                        border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                        <div style={{ fontSize: 13, color: '#64748b' }}>
                            {items.filter(it => it.name.trim() && it.totalPrice > 0).length} valid items<br />
                            Subtotal: {new Intl.NumberFormat('en-US', { style: 'currency', currency: user?.currency || 'LKR', minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(subTotal)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                            <div>
                                <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', textAlign: 'right' }}>Total Amount</div>
                                <div style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', letterSpacing: -1 }}>
                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: user?.currency || 'LKR', minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(totalAmount)}
                                </div>
                            </div>
                            <div className="modal-footer-actions" style={{ display: 'flex', gap: 8 }}>
                                <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                                <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)' }}>
                                    {saving ? 'Saving...' : '💾 Save Changes'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
