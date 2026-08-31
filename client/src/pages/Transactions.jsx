import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import UploadBillModal from '../components/UploadBillModal';
import EditBillModal from '../components/EditBillModal';
import { getTransactions, createTransaction, updateTransaction, deleteTransaction, deleteBill, getAccounts, getCategories, getTransactionYears } from '../services/api';
import CategorySelector from '../components/CategorySelector';
import SubcategorySelector from '../components/SubcategorySelector';
import { useAuth } from '../context/AuthContext';
import { getCurrency } from '../utils/currency';
import { confirmToast } from '../utils/confirmToast';
import toast from 'react-hot-toast';
import {
    Plus, Receipt, ArrowUpRight, ArrowDownLeft,
    FileText, Calendar, Filter, X, Pencil, Trash2, ChevronDown, ChevronUp,
    Wallet, TrendingUp, TrendingDown, Camera
} from 'lucide-react';

const emptyForm = () => ({
    type: 'expense', amount: '', category: 'other', subcategory: '', merchant: '', description: '',
    date: new Date().toISOString().split('T')[0], accountId: ''
});

export default function Transactions() {
    const [searchParams] = useSearchParams();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [editingTx, setEditingTx] = useState(null); // transaction being edited
    const [editingBill, setEditingBill] = useState(null);
    const [expandedTx, setExpandedTx] = useState(null);
    const [availableYears, setAvailableYears] = useState([new Date().getFullYear()]);
    const [filter, setFilter] = useState({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        accountId: searchParams.get('accountId') || ''
    });

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
    const [formData, setFormData] = useState(emptyForm());
    const [accounts, setAccounts] = useState([]);
    const [userCategories, setUserCategories] = useState([]);

    const { user } = useAuth();
    const curr = getCurrency(user?.currency || 'LKR');

    // Auto-open upload modal when coming from sidebar "Scan Receipt"
    useEffect(() => {
        if (searchParams.get('upload') === 'true') setShowUploadModal(true);
        if (searchParams.get('accountId')) setFilter(f => ({ ...f, accountId: searchParams.get('accountId') }));
    }, [searchParams]);

    useEffect(() => { fetchTransactions(); }, [filter]);
    useEffect(() => {
        getAccounts().then(res => {
            setAccounts(res.data);
            // Default to Cash account for new transactions if no account is selected
            if (!formData.accountId) {
                const cashAcc = res.data.find(a => a.isDefault);
                if (cashAcc) setFormData(prev => ({ ...prev, accountId: cashAcc._id }));
            }
        }).catch(() => { });
        getCategories().then(res => setUserCategories(res.data)).catch(() => { });
    }, []);

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const res = await getTransactions({
                month: filter.month,
                year: filter.year,
                accountId: filter.accountId
            });
            // Sort by createdAt descending (lastly inserted first)
            const sorted = (res.data || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setTransactions(sorted);
        } catch {
            toast.error('Failed to load transactions');
        } finally {
            setLoading(false);
        }
    };

    /* ── Create ──────────────────────────────────────────────────────── */
    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await createTransaction(formData);
            toast.success('Transaction saved!');
            cancelForm();
            fetchTransactions();
            // Refresh accounts to show updated balances
            getAccounts().then(res => setAccounts(res.data)).catch(() => { });
        } catch {
            toast.error('Failed to save transaction');
        }
    };

    /* ── Edit helpers ────────────────────────────────────────────────── */
    const openEdit = (tx) => {
        if (tx.receiptId) {
            setEditingBill(tx.receiptId);
            return;
        }
        setEditingTx(tx);
        setFormData({
            type: tx.type,
            amount: tx.amount,
            category: tx.category,
            subcategory: tx.subcategory || '',
            merchant: tx.merchant || '',
            description: tx.description || '',
            date: tx.date ? tx.date.split('T')[0] : new Date().toISOString().split('T')[0],
            accountId: tx.accountId || ''
        });
        // We'll use a simple edit mode for single transactions
    };

    const cancelForm = () => {
        setEditingTx(null);
        const defaultData = emptyForm();
        const cashAcc = accounts.find(a => a.isDefault);
        if (cashAcc) defaultData.accountId = cashAcc._id;
        setFormData(defaultData);
    };

    /* ── Update ──────────────────────────────────────────────────────── */
    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            await updateTransaction(editingTx._id, formData);
            toast.success('Transaction updated!');
            cancelForm();
            fetchTransactions();
        } catch {
            toast.error('Failed to update transaction');
        }
    };

    /* ── Delete ──────────────────────────────────────────────────────── */
    const handleDelete = async (tx) => {
        const confirmed = await confirmToast('Delete this transaction permanently?');
        if (!confirmed) return;
        try {
            if (tx.receiptId) {
                await deleteBill(tx.receiptId._id);
            } else {
                await deleteTransaction(tx._id);
            }
            toast.success('Transaction deleted');
            fetchTransactions();
        } catch {
            toast.error('Failed to delete');
        }
    };

    if (loading) return <div className="loading-page"><div className="spinner" /></div>;

    const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    return (
        <div className="slide-up">
            {editingBill && (
                <EditBillModal
                    bill={editingBill}
                    onClose={() => setEditingBill(null)}
                    onSaved={() => { setEditingBill(null); fetchTransactions(); }}
                />
            )}

            {/* ── Mobile Header ─────────────────────────────────────────────── */}
            <div className="page-header">
                <div>
                    <h2>Transactions</h2>
                    <p className="page-header-sub" style={{ fontSize: 13, color: '#64748b' }}>Monthly activity tracking</p>
                </div>

                <div className="filters-bar" style={{ marginTop: 12 }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <span style={{ position: 'absolute', left: 12, color: '#94a3b8' }}><Calendar size={14} /></span>
                        <select className="form-select" style={{ paddingLeft: 34 }} value={filter.month}
                            onChange={e => setFilter({ ...filter, month: parseInt(e.target.value) })}>
                            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => (
                                <option key={i} value={i + 1}>{m}</option>
                            ))}
                        </select>
                    </div>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <span style={{ position: 'absolute', left: 12, color: '#94a3b8' }}><Calendar size={14} /></span>
                        <select className="form-select" style={{ paddingLeft: 34 }} value={filter.year}
                            onChange={e => setFilter({ ...filter, year: parseInt(e.target.value) })}>
                            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <span style={{ position: 'absolute', left: 12, color: '#94a3b8' }}><Wallet size={14} /></span>
                        <select className="form-select" style={{ paddingLeft: 34 }} value={filter.accountId}
                            onChange={e => setFilter({ ...filter, accountId: e.target.value })}>
                            <option value="">All Accounts</option>
                            {accounts.map(acc => (
                                <option key={acc._id} value={acc._id}>{acc.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* ── Modern App Summary Tiles ────────────────────────────────────── */}
            <div className="stat-grid" style={{ marginBottom: 16 }}>
                <div className="card" style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#f0fdf4', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><TrendingUp size={10} /></div>
                        <span style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Income</span>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#10b981' }}>{curr.symbol}{totalIncome.toLocaleString()}</div>
                </div>
                <div className="card" style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fef2f2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><TrendingDown size={10} /></div>
                        <span style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Expense</span>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#ef4444' }}>{curr.symbol}{totalExpense.toLocaleString()}</div>
                </div>
            </div>

            {/* ── Edit Transaction Modal ────────────────────────────────────── */}
            {editingTx && (
                <div className="modal-wrapper" style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                    <div className="modal-container" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 24, width: '100%', maxWidth: 960, padding: 32, boxShadow: '0 25px 60px -12px rgba(15, 23, 42, 0.2)', animation: 'modalSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1)', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: 32, overflowY: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                                <div>
                                    <h3 style={{ fontWeight: 800, fontSize: 20, color: '#0f172a', letterSpacing: '-0.5px', margin: 0 }}>
                                        Edit Transaction
                                    </h3>
                                </div>
                                <button onClick={cancelForm} style={{ background: '#f1f5f9', border: 'none', borderRadius: 10, width: 32, height: 32, cursor: 'pointer', color: '#94a3b8' }}><X size={16} /></button>
                            </div>

                            <form onSubmit={handleUpdate}>
                                <div className="grid-2">
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                        <div style={{ textAlign: 'left' }}>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>Amount ({curr.symbol})</div>
                                            <input
                                                className="modal-amount-input"
                                                style={{ width: '100%', border: 'none', fontSize: 60, fontWeight: 900, color: '#0f172a', outline: 'none', background: 'transparent', letterSpacing: -2 }}
                                                type="number" step="any" min="0" required autoFocus
                                                value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 12, padding: 4 }}>
                                            {['expense', 'income'].map(t => (
                                                <button key={t} type="button"
                                                    style={{
                                                        flex: 1, padding: '12px 0', border: 'none', borderRadius: 8,
                                                        fontSize: 14, fontWeight: 700, cursor: 'pointer',
                                                        background: formData.type === t ? '#fff' : 'transparent',
                                                        color: formData.type === t ? (t === 'expense' ? '#f43f5e' : '#10b981') : '#64748b'
                                                    }}
                                                    onClick={() => setFormData({ ...formData, type: t })}>
                                                    {t === 'expense' ? '💸 Expense' : '💰 Income'}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Account</label>
                                            <select className="form-select" value={formData.accountId}
                                                onChange={e => setFormData({ ...formData, accountId: e.target.value })}
                                                style={{ borderColor: formData.accountId && formData.type === 'expense' && accounts.find(a => a._id === formData.accountId)?.balance < (parseFloat(formData.amount) || 0) ? '#ef4444' : '' }}
                                            >
                                                {accounts.map(acc => <option key={acc._id} value={acc._id}>{acc.icon} {acc.name} — {curr.symbol}{acc.balance.toLocaleString()}</option>)}
                                            </select>
                                            {formData.accountId && formData.type === 'expense' && accounts.find(a => a._id === formData.accountId)?.balance < (parseFloat(formData.amount) || 0) && (
                                                <div style={{ color: '#ef4444', fontSize: 11, fontWeight: 700, marginTop: 4 }}>⚠️ Insufficient balance available</div>
                                            )}
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Merchant / Source</label>
                                            <input className="form-input" value={formData.merchant} onChange={e => setFormData({ ...formData, merchant: e.target.value })} />
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                        <div className="form-group">
                                            <label className="form-label">Date</label>
                                            <input className="form-input" type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                                        </div>
                                        <CategorySelector label="Category" categories={userCategories} type={formData.type} value={formData.category} onChange={cat => setFormData({ ...formData, category: cat, subcategory: '' })} />
                                        <div className="form-group">
                                            <label className="form-label">Subcategory</label>
                                            <SubcategorySelector subcategories={userCategories.find(c => c.type === formData.type && c.mainCategory === formData.category)?.subcategories || []} value={formData.subcategory} onChange={sub => setFormData({ ...formData, subcategory: sub })} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Notes</label>
                                            <textarea className="form-input" rows={3} style={{ height: 'auto', resize: 'none' }} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 16, marginTop: 40, borderTop: '1px solid #f1f5f9', paddingTop: 24 }}>
                                    <button type="button" className="btn btn-ghost" onClick={cancelForm}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Update Transaction</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Transaction List ─────────────────────────────────────────── */}
            <div className="transaction-list">
                {transactions.map(t => (
                    <div key={t._id} className="card"
                        style={{
                            borderLeft: `3px solid ${t.type === 'expense' ? '#f43f5e' : '#10b981'}`,
                            transition: 'box-shadow 0.2s',
                            cursor: t.receiptId ? 'pointer' : 'default',
                            padding: 0
                        }}>
                        <div
                            onClick={() => t.receiptId && setExpandedTx(expandedTx === t._id ? null : t._id)}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '12px 10px',
                                gap: 8
                            }}>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1, minWidth: 0 }}>
                                <div style={{
                                    width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 14, flexShrink: 0,
                                    color: userCategories.find(c => c.type === t.type && c.mainCategory === t.category)?.color || (t.type === 'expense' ? '#f43f5e' : '#10b981')
                                }}>
                                    {userCategories.find(c => c.type === t.type && c.mainCategory === t.category)?.icon || (t.type === 'expense' ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />)}
                                </div>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{
                                        fontSize: 13,
                                        fontWeight: 700,
                                        color: '#0f172a',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 4
                                    }}>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.merchant || t.description || t.category}</span>
                                        {t.receiptId && <span style={{ flexShrink: 0, fontSize: 8, background: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: 4, fontWeight: 800 }}>BILL</span>}
                                    </div>
                                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <span style={{ flexShrink: 0 }}>{new Date(t.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                                        <span>•</span>
                                        <span style={{ textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.category}</span>
                                    </div>
                                </div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 800, color: t.type === 'expense' ? '#1e293b' : '#10b981' }}>
                                    {t.type === 'expense' ? '-' : '+'} {curr.symbol}{t.amount.toLocaleString()}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                                    <button onClick={(e) => { e.stopPropagation(); openEdit(t); }} style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', opacity: 0.7, color: '#3b82f6' }}><Pencil size={14} /></button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(t); }} style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', opacity: 0.7, color: '#f43f5e' }}><Trash2 size={14} /></button>
                                </div>
                            </div>
                        </div>

                        {/* Bill Items Expansion */}
                        {t.receiptId && expandedTx === t._id && (
                            <div style={{ padding: '0 20px 16px', background: 'var(--bg-glass)', borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {t.receiptId.items?.map((item, idx) => {
                                        return (
                                            <div key={idx} style={{
                                                display: 'grid', gridTemplateColumns: '1fr auto auto',
                                                gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 14,
                                                background: '#ffffff',
                                                border: '1px solid #e2e8f0',
                                                boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                                            }}>
                                                <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{item.name}</div>
                                                <div style={{ fontSize: 12, color: '#94a3b8' }}>{item.quantity} x {curr.symbol}{item.unitPrice?.toLocaleString()}</div>
                                                <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>{curr.symbol}{item.totalPrice?.toLocaleString()}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                                {t.receiptId.discountAmount > 0 && (
                                    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                                        <div style={{ padding: '6px 12px', background: 'rgba(244,63,94,0.1)', color: '#f43f5e', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
                                            Discount Applied: - {curr.symbol} {t.receiptId.discountAmount.toLocaleString()}
                                        </div>
                                    </div>
                                )}
                                {t.receiptId.notes && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>📝 {t.receiptId.notes}</p>}
                            </div>
                        )}
                    </div>
                ))}

                {transactions.length === 0 && !loading && (
                    <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: 44, marginBottom: 12 }}>📭</div>
                        <p style={{ fontWeight: 600 }}>No transactions for this period.</p>
                        <p style={{ fontSize: 13 }}>Click <strong>＋ Add New</strong> or <strong>📸 Upload Bill</strong> to get started.</p>
                    </div>
                )}
            </div>

            {/* ── FAB Actions ─────────────────────────────────────────────── */}
            <div className="fab-container">
                <button
                    onClick={() => setShowUploadModal(true)}
                    className="btn btn-primary"
                    style={{
                        width: 64, height: 64, borderRadius: '50%', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.4)',
                        border: 'none', background: '#0f172a'
                    }}
                    title="Add Entry"
                >
                    <Plus size={32} />
                </button>
            </div>

            {/* ── Modals ───────────────────────────────────────────────────── */}
            {showUploadModal && (
                <UploadBillModal
                    isOpen={showUploadModal}
                    onClose={() => setShowUploadModal(false)}
                    onUploaded={() => fetchTransactions()}
                />
            )}
        </div>
    );
}
