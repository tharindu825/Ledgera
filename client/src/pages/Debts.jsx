import { useState, useEffect, useRef } from 'react';
import { getDebts, createDebt, updateDebt, recordRepayment, deleteDebt, updateRepayment, getAccounts, getCategories } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getCurrency } from '../utils/currency';
import { confirmToast } from '../utils/confirmToast';
import toast from 'react-hot-toast';
import {
    Plus, X, Pencil, Trash2, CircleDollarSign,
    ArrowUpCircle, ArrowDownCircle, History,
    Wallet, Save, CreditCard, Bell, Tag
} from 'lucide-react';

const emptyForm = () => ({
    title: '',
    type: 'owed_by_me',
    totalAmount: '',
    personName: '',
    dueDate: '',
    notes: '',
    accountId: ''
});

// Utility: days until due date
function getDaysUntilDue(dueDate) {
    if (!dueDate) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return Math.round((due - now) / (1000 * 60 * 60 * 24));
}

export default function Debts() {
    const [debts, setDebts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingDebt, setEditingDebt] = useState(null);
    const [formData, setFormData] = useState(emptyForm());
    const [repayAmount, setRepayAmount] = useState('');
    const [repayNote, setRepayNote] = useState('');
    const [repayCategory, setRepayCategory] = useState('Financial_Debts');
    const [repaySubcategory, setRepaySubcategory] = useState('Loan_Repay');
    const [selectedDebt, setSelectedDebt] = useState(null);
    const [editingRepayment, setEditingRepayment] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [repayAccountId, setRepayAccountId] = useState('');
    const [tab, setTab] = useState('owed_by_me');
    // Debt due date notification modal
    const [dueDateAlerts, setDueDateAlerts] = useState([]);
    const [showDueAlert, setShowDueAlert] = useState(false);
    const alertFiredRef = useRef(false);

    const { user } = useAuth();
    const curr = getCurrency(user?.currency || 'LKR');

    useEffect(() => {
        fetchDebts();
        fetchAccounts();
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const res = await getCategories();
            setCategories(res.data);
        } catch (err) {
            console.error('Failed to load categories');
        }
    };

    const fetchAccounts = async () => {
        try {
            const res = await getAccounts();
            setAccounts(res.data);
        } catch (err) {
            console.error('Failed to load accounts');
        }
    };

    const fetchDebts = async () => {
        try {
            const res = await getDebts();
            setDebts(res.data);
        } catch (err) {
            toast.error('Failed to load debts');
        } finally {
            setLoading(false);
        }
    };

    // Check for due date alerts after debts load
    useEffect(() => {
        if (loading || alertFiredRef.current) return;
        const sessionKey = 'debt_due_alerts_shown';
        if (sessionStorage.getItem(sessionKey)) return;

        const activeDebts = debts.filter(d => d.status === 'active' && d.dueDate);
        const alerts = [];
        activeDebts.forEach(debt => {
            const days = getDaysUntilDue(debt.dueDate);
            if (days !== null && days <= 7) {
                alerts.push({ debt, days });
            }
        });

        if (alerts.length > 0) {
            alertFiredRef.current = true;
            sessionStorage.setItem(sessionKey, '1');
            setDueDateAlerts(alerts);
            setShowDueAlert(true);
        }
    }, [debts, loading]);

    const handleCreateOrUpdate = async (e) => {
        e.preventDefault();
        try {
            if (editingDebt) {
                await updateDebt(editingDebt._id, formData);
                toast.success('Debt updated!');
            } else {
                await createDebt(formData);
                toast.success('Debt recorded!');
            }
            cancelForm();
            fetchDebts();
            fetchAccounts(); // refresh account balances
        } catch (err) {
            toast.error('Failed to save debt');
        }
    };

    const openEdit = (debt) => {
        setEditingDebt(debt);
        setFormData({
            title: debt.title,
            type: debt.type,
            totalAmount: debt.totalAmount,
            personName: debt.personName,
            dueDate: debt.dueDate ? debt.dueDate.split('T')[0] : '',
            notes: debt.notes || '',
            accountId: ''
        });
        setShowForm(true);
    };

    const cancelForm = () => {
        setShowForm(false);
        setEditingDebt(null);
        setFormData(emptyForm());
    };

    // Get subcategories for selected repay category
    const repayMainCat = categories.find(c =>
        c.mainCategory === repayCategory || c.mainCategory.toLowerCase().replace(/ /g, '_') === repayCategory.toLowerCase()
    );
    const repaySubcats = repayMainCat?.subcategories || [];

    const handleRepayment = async (debtId) => {
        const debt = debts.find(d => d._id === debtId);
        if (!repayAmount || parseFloat(repayAmount) <= 0) return toast.error('Enter a valid amount');

        if (parseFloat(repayAmount) > debt.remainingAmount) {
            return toast.error(`Amount exceeds remaining balance (${curr.symbol} ${debt.remainingAmount.toLocaleString()})`);
        }

        // Validate account balance if an account is selected
        if (repayAccountId) {
            const selectedAcc = accounts.find(a => a._id === repayAccountId);
            if (selectedAcc && selectedAcc.balance < parseFloat(repayAmount)) {
                return toast.error(`Account "${selectedAcc.name}" balance (${curr.symbol} ${selectedAcc.balance.toLocaleString()}) is not enough for this repayment`);
            }
        }

        try {
            await recordRepayment(debtId, {
                amount: parseFloat(repayAmount),
                note: repayNote,
                accountId: repayAccountId || null,
                category: repayCategory,
                subcategory: repaySubcategory
            });
            toast.success('Repayment recorded!');
            setRepayAmount('');
            setRepayNote('');
            setRepayAccountId('');
            setRepayCategory('Financial_Debts');
            setRepaySubcategory('Loan_Repay');
            setSelectedDebt(null);
            fetchDebts();
            fetchAccounts();
        } catch (err) {
            toast.error('Failed to save repayment');
        }
    };

    const handleUpdateRepayment = async () => {
        // Validate account balance if account changed or amount changed
        if (editingRepayment.accountId) {
            const selectedAcc = accounts.find(a => a._id === editingRepayment.accountId);
            if (selectedAcc) {
                // Find original repayment to compute delta
                const debt = debts.find(d => d._id === editingRepayment.debtId);
                const origRepayment = debt?.repayments?.find(r => r._id === editingRepayment.repaymentId);
                const origAmount = origRepayment?.origAmount || 0;
                const newAmount = parseFloat(editingRepayment.amount) || 0;
                const delta = newAmount - origAmount; // additional amount that will be deducted
                if (delta > 0 && selectedAcc.balance < delta) {
                    return toast.error(`Account "${selectedAcc.name}" balance (${curr.symbol} ${selectedAcc.balance.toLocaleString()}) is not enough for the updated amount`);
                }
            }
        }
        try {
            await updateRepayment(editingRepayment.debtId, editingRepayment.repaymentId, {
                amount: parseFloat(editingRepayment.amount),
                note: editingRepayment.note,
                date: editingRepayment.date,
                accountId: editingRepayment.accountId || null
            });
            toast.success('Repayment updated!');
            setEditingRepayment(null);
            fetchDebts();
            fetchAccounts();
        } catch (err) {
            toast.error('Failed to update repayment');
        }
    };

    const handleDelete = async (id) => {
        const confirmed = await confirmToast('Delete this debt/loan record permanently?');
        if (!confirmed) return;
        try {
            await deleteDebt(id);
            toast.success('Record deleted');
            fetchDebts();
        } catch (err) {
            toast.error('Failed to delete');
        }
    };

    if (loading) return <div className="loading-page"><div className="spinner"></div></div>;

    const netOwedByMe = debts.filter(d => d.type === 'owed_by_me' && d.status === 'active').reduce((s, d) => s + d.remainingAmount, 0);
    const netOwedToMe = debts.filter(d => d.type === 'owed_to_me' && d.status === 'active').reduce((s, d) => s + d.remainingAmount, 0);

    // All expense categories for repayment category selector
    const expenseCategories = categories.filter(c => c.type === 'expense');

    return (
        <div className="slide-up">
            {/* ── Due Date Alert Modal ─────────────────────────────────────── */}
            {showDueAlert && dueDateAlerts.length > 0 && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                    <div style={{ background: '#fff', borderRadius: 24, width: '100%', maxWidth: 440, padding: 32, boxShadow: '0 25px 60px -12px rgba(15, 23, 42, 0.3)', animation: 'modalSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 14, background: '#fff1f2', color: '#f43f5e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Bell size={22} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontWeight: 800, fontSize: 18, color: '#0f172a' }}>Debt Due Date Alert</h3>
                                <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>You have upcoming debt deadlines</p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                            {dueDateAlerts.map(({ debt, days }) => (
                                <div key={debt._id} style={{
                                    padding: '12px 16px', borderRadius: 14,
                                    background: days < 0 ? '#fef2f2' : days === 0 ? '#fff7ed' : '#fffbeb',
                                    border: `1px solid ${days < 0 ? '#fecaca' : days === 0 ? '#fed7aa' : '#fde68a'}`,
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{debt.title}</div>
                                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                                            {debt.personName} • {curr.symbol} {debt.remainingAmount.toLocaleString()}
                                        </div>
                                    </div>
                                    <div style={{
                                        textAlign: 'right', fontWeight: 800, fontSize: 13,
                                        color: days < 0 ? '#dc2626' : days === 0 ? '#d97706' : '#b45309'
                                    }}>
                                        {days < 0
                                            ? `⚠️ ${Math.abs(days)}d Overdue`
                                            : days === 0
                                                ? '🔴 Due Today!'
                                                : `🟡 ${days}d left`}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button
                            className="btn btn-primary"
                            style={{ width: '100%', justifyContent: 'center' }}
                            onClick={() => setShowDueAlert(false)}
                        >
                            Got it, I'll take care of it
                        </button>
                    </div>
                </div>
            )}

            {/* ── Edit Repayment Modal ─────────────────────────────────────── */}
            {editingRepayment && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                    <div className="modal-container" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 24, width: '100%', maxWidth: 400, padding: 32, boxShadow: '0 25px 60px -12px rgba(15, 23, 42, 0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h3 style={{ margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Pencil size={20} /> Edit Repayment
                            </h3>
                            <button onClick={() => setEditingRepayment(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={20} /></button>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Amount ({curr.symbol})</label>
                            <input className="form-input" type="number" min="0" step="any" value={editingRepayment.amount} onChange={e => setEditingRepayment({ ...editingRepayment, amount: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Date</label>
                            <input className="form-input" type="date" value={editingRepayment.date} onChange={e => setEditingRepayment({ ...editingRepayment, date: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Wallet size={12} /> Payment Source / Account</label>
                            <select className="form-select" value={editingRepayment.accountId || ''} onChange={e => setEditingRepayment({ ...editingRepayment, accountId: e.target.value || null })}>
                                <option value="">Cash / Manual</option>
                                {accounts.map(acc => (
                                    <option key={acc._id} value={acc._id}>
                                        {acc.icon} {acc.name} ({curr.symbol} {acc.balance.toLocaleString()})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Note</label>
                            <input className="form-input" value={editingRepayment.note} onChange={e => setEditingRepayment({ ...editingRepayment, note: e.target.value })} placeholder="Optional note" />
                        </div>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button className="btn btn-ghost flex-1" onClick={() => setEditingRepayment(null)}>Cancel</button>
                            <button className="btn btn-primary flex-1" onClick={handleUpdateRepayment}>
                                <Save size={18} /> Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Mobile Header ─────────────────────────────────────────────── */}
            <div className="page-header">
                <div>
                    <h2>Debts &amp; Loans</h2>
                    <p className="page-header-sub" style={{ fontSize: 13, color: '#64748b' }}>Borrowings and lending tracking</p>
                </div>
            </div>

            {/* Summary Tiles */}
            <div className="flex-split" style={{ marginBottom: 24 }}>
                <div className="card" style={{ background: '#ffffff', border: '1px solid #f1f5f9', borderRadius: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.03)', padding: '16px 20px', margin: 0, cursor: 'pointer', border: tab === 'owed_by_me' ? '2px solid #f43f5e' : '1px solid #f1f5f9' }} onClick={() => setTab('owed_by_me')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#fef2f2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ArrowUpCircle size={14} />
                        </div>
                        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>My Borrowings</span>
                    </div>
                    <div className="text-responsive-xl" style={{ fontSize: 22, fontWeight: 900, color: '#ef4444' }}>{curr.symbol}{netOwedByMe.toLocaleString()}</div>
                </div>
                <div className="card" style={{ background: '#ffffff', border: '1px solid #f1f5f9', borderRadius: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.03)', padding: '16px 20px', margin: 0, cursor: 'pointer', border: tab === 'owed_to_me' ? '2px solid #10b981' : '1px solid #f1f5f9' }} onClick={() => setTab('owed_to_me')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#f0fdf4', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ArrowDownCircle size={14} />
                        </div>
                        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Money Lent</span>
                    </div>
                    <div className="text-responsive-xl" style={{ fontSize: 22, fontWeight: 900, color: '#10b981' }}>{curr.symbol}{netOwedToMe.toLocaleString()}</div>
                </div>
            </div>

            {/* ── New/Edit Debt Modal ────────────────────────────────────────── */}
            {showForm && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                    <div className="modal-container" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 24, width: '100%', maxWidth: 540, padding: 32, boxShadow: '0 25px 60px -12px rgba(15, 23, 42, 0.2)', animation: 'modalSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1)', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <h3 style={{ margin: 0, fontWeight: 800, fontSize: 22, color: '#0f172a' }}>
                                {editingDebt ? 'Edit Debt/Loan' : 'New Debt/Loan'}
                            </h3>
                            <button onClick={cancelForm} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={24} /></button>
                        </div>
                        <form onSubmit={handleCreateOrUpdate}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Loan Purpose / Title</label>
                                    <input className="form-input" required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="e.g. Personal Loan, Keells Bill" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Type</label>
                                    <select className="form-select" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                                        <option value="owed_by_me">My Borrowings (I borrowed)</option>
                                        <option value="owed_to_me">Money Lent (I lent)</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Amount
                                        {editingDebt && editingDebt.repayments?.length > 0 && (
                                            <span style={{ marginLeft: 8, fontSize: 10, color: '#f59e0b', fontWeight: 700, background: '#fef3c7', padding: '2px 6px', borderRadius: 4 }}>🔒 Locked after first repayment</span>
                                        )}
                                    </label>
                                    <input
                                        className="form-input"
                                        type="number" required step="any"
                                        value={formData.totalAmount}
                                        onChange={e => setFormData({ ...formData, totalAmount: e.target.value })}
                                        disabled={!!(editingDebt && editingDebt.repayments?.length > 0)}
                                        style={editingDebt && editingDebt.repayments?.length > 0 ? { opacity: 0.6, cursor: 'not-allowed', background: '#f8fafc' } : {}}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Person Name</label>
                                    <input className="form-input" required value={formData.personName} onChange={e => setFormData({ ...formData, personName: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Due Date</label>
                                    <input className="form-input" type="date" value={formData.dueDate} onChange={e => setFormData({ ...formData, dueDate: e.target.value })} />
                                </div>
                                {/* Account selection - only on create */}
                                {!editingDebt && (
                                    <div className="form-group">
                                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Wallet size={12} />
                                            {formData.type === 'owed_by_me' ? 'Credit to Account (Borrowed)' : 'Deduct from Account (Lent)'}
                                        </label>
                                        <select className="form-select" value={formData.accountId} onChange={e => setFormData({ ...formData, accountId: e.target.value })}>
                                            <option value="">None / Manual</option>
                                            {accounts.map(acc => (
                                                <option key={acc._id} value={acc._id}>
                                                    {acc.icon} {acc.name} ({curr.symbol} {acc.balance.toLocaleString()})
                                                </option>
                                            ))}
                                        </select>
                                        {formData.accountId && (
                                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, fontStyle: 'italic' }}>
                                                {formData.type === 'owed_by_me'
                                                    ? `💳 ${curr.symbol} ${parseFloat(formData.totalAmount || 0).toLocaleString()} will be added to this account`
                                                    : `💸 ${curr.symbol} ${parseFloat(formData.totalAmount || 0).toLocaleString()} will be deducted from this account`}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                                <button type="button" className="btn btn-ghost flex-1" onClick={cancelForm}>Cancel</button>
                                <button type="submit" className="btn btn-primary flex-1">
                                    {editingDebt ? <><Save size={18} /> Update Record</> : <><Plus size={18} /> Save Record</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="debts-list">
                {debts.filter(d => d.type === tab).map(debt => {
                    const daysLeft = getDaysUntilDue(debt.dueDate);
                    return (
                        <div key={debt._id} className="card" style={{ borderLeft: `6px solid ${debt.type === 'owed_by_me' ? '#f43f5e' : '#10b981'}`, padding: '16px 12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 15, fontWeight: 700, textTransform: 'capitalize', color: 'var(--text-primary)', lineHeight: 1.2, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        {debt.type === 'owed_by_me' ? <ArrowUpCircle size={16} color="#f43f5e" /> : <ArrowDownCircle size={16} color="#10b981" />}
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{debt.title}</span>
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{debt.personName}</div>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <div style={{ fontSize: 17, fontWeight: 800, color: debt.type === 'owed_by_me' ? '#f43f5e' : '#10b981' }}>
                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: user?.currency || 'LKR', minimumFractionDigits: 0 }).format(debt.remainingAmount)}
                                    </div>
                                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>of {new Intl.NumberFormat('en-US', { style: 'currency', currency: user?.currency || 'LKR', minimumFractionDigits: 0 }).format(debt.totalAmount)}</div>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div style={{ height: 6, background: 'rgba(0,0,0,0.05)', borderRadius: 3, margin: '12px 0' }}>
                                <div style={{
                                    height: '100%',
                                    width: `${Math.min(100, ((debt.totalAmount - debt.remainingAmount) / debt.totalAmount) * 100)}%`,
                                    background: debt.type === 'owed_by_me' ? '#f43f5e' : '#10b981',
                                    borderRadius: 3,
                                    transition: 'width 0.3s'
                                }}></div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                        {debt.dueDate ? `Due: ${new Date(debt.dueDate).toLocaleDateString()}` : 'No due date'}
                                    </span>
                                    {/* Due date badge */}
                                    {debt.status === 'active' && daysLeft !== null && daysLeft <= 7 && (
                                        <span style={{
                                            fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
                                            background: daysLeft < 0 ? '#fef2f2' : daysLeft === 0 ? '#fff7ed' : '#fffbeb',
                                            color: daysLeft < 0 ? '#dc2626' : daysLeft === 0 ? '#d97706' : '#b45309',
                                            border: `1px solid ${daysLeft < 0 ? '#fecaca' : daysLeft === 0 ? '#fed7aa' : '#fde68a'}`
                                        }}>
                                            {daysLeft < 0 ? `${Math.abs(daysLeft)}d Overdue` : daysLeft === 0 ? 'Due Today' : `${daysLeft}d left`}
                                        </span>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button className="btn btn-ghost btn-sm" style={{ color: '#3b82f6', padding: 4 }} title="Edit" onClick={() => openEdit(debt)}><Pencil size={16} /></button>
                                    <button className="btn btn-ghost btn-sm" style={{ color: '#f43f5e', padding: 4 }} title="Delete" onClick={() => handleDelete(debt._id)}><Trash2 size={16} /></button>
                                    {debt.status === 'active' && (
                                        <button className="btn btn-secondary btn-sm" onClick={() => setSelectedDebt(debt._id === selectedDebt ? null : debt._id)} style={{ gap: 4 }}>
                                            <CircleDollarSign size={14} /> Repay
                                        </button>
                                    )}
                                </div>
                            </div>

                            {debt.repayments?.length > 0 && (
                                <div style={{ marginTop: 16, padding: 12, background: 'rgba(0,0,0,0.02)', borderRadius: 10, border: '1px solid rgba(0,0,0,0.05)' }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <History size={14} /> Repayment History
                                    </div>
                                    {debt.repayments.map(r => (
                                        <div key={r._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px dashed rgba(0,0,0,0.08)', fontSize: 13 }}>
                                            <div style={{ color: '#475569' }}>
                                                <strong>{new Date(r.date).toLocaleDateString()}</strong> {r.note ? `• ${r.note}` : ''}
                                                {r.accountId && (() => {
                                                    const acc = accounts.find(a => a._id === (r.accountId?._id || r.accountId));
                                                    return acc ? <span style={{ marginLeft: 4, fontSize: 10, color: '#64748b', background: '#f1f5f9', padding: '1px 5px', borderRadius: 4 }}>via {acc.icon} {acc.name}</span> : null;
                                                })()}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{ fontWeight: 700, color: '#0f172a' }}>{new Intl.NumberFormat('en-US', { style: 'currency', currency: user?.currency || 'LKR', minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(r.amount)}</div>
                                                <button className="btn btn-ghost btn-sm" style={{ padding: '4px', color: '#3b82f6' }} title="Edit Repayment" onClick={() => setEditingRepayment({ debtId: debt._id, repaymentId: r._id, amount: r.amount.toString(), note: r.note || '', date: r.date ? new Date(r.date).toISOString().split('T')[0] : '', accountId: r.accountId?._id || r.accountId || '', origAmount: r.amount })}>
                                                    <Pencil size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {selectedDebt === debt._id && (
                                <div style={{ marginTop: 20, padding: 20, background: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0' }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <CreditCard size={16} /> Record Repayment
                                    </div>

                                    {/* Category & Subcategory */}
                                    <div className="form-row" style={{ marginBottom: 12 }}>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}><Tag size={12} /> Category</label>
                                            <select
                                                className="form-select"
                                                style={{ height: 44 }}
                                                value={repayCategory}
                                                onChange={e => {
                                                    setRepayCategory(e.target.value);
                                                    setRepaySubcategory('');
                                                }}
                                            >
                                                {expenseCategories.map(cat => (
                                                    <option key={cat._id} value={cat.mainCategory}>
                                                        {cat.mainCategory.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}><Tag size={12} /> Subcategory</label>
                                            <select
                                                className="form-select"
                                                style={{ height: 44 }}
                                                value={repaySubcategory}
                                                onChange={e => setRepaySubcategory(e.target.value)}
                                            >
                                                <option value="">— None —</option>
                                                {(categories.find(c => c.mainCategory === repayCategory)?.subcategories || []).map((sub, i) => (
                                                    <option key={i} value={sub}>{sub}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="form-group" style={{ marginBottom: 12 }}>
                                        <label className="form-label" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}><Wallet size={12} /> Payment Source / Account</label>
                                        <select className="form-select" style={{ height: 44 }} value={repayAccountId} onChange={e => setRepayAccountId(e.target.value)}>
                                            <option value="">Cash / Manual</option>
                                            {accounts.map(acc => (
                                                <option key={acc._id} value={acc._id}>
                                                    {acc.icon} {acc.name} ({curr.symbol} {acc.balance.toLocaleString()})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="form-row" style={{ marginBottom: 12 }}>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label" style={{ fontSize: 11 }}>Amount</label>
                                            <input className="form-input" style={{ height: 44 }} type="number" step="any" placeholder="0.00" value={repayAmount} onChange={e => setRepayAmount(e.target.value)} />
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label" style={{ fontSize: 11 }}>Note (Optional)</label>
                                            <input className="form-input" style={{ height: 44 }} placeholder="e.g. Paid via mobile" value={repayNote} onChange={e => setRepayNote(e.target.value)} />
                                        </div>
                                    </div>

                                    <button className="btn btn-primary" style={{ width: '100%', height: 44, justifyContent: 'center', marginTop: 8 }} onClick={() => handleRepayment(debt._id)}>
                                        ✅ Confirm Repayment
                                    </button>

                                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 12, textAlign: 'center', fontStyle: 'italic' }}>
                                        {repayAccountId
                                            ? `Balance will be ${debt.type === 'owed_by_me' ? 'reduced' : 'increased'} in ${accounts.find(a => a._id === repayAccountId)?.name}`
                                            : 'Account balance will be updated & transaction recorded.'}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {debts.filter(d => d.type === tab).length === 0 && (
                    <div className="empty-state" style={{ padding: '60px 20px' }}>
                        <div style={{ fontSize: 40, marginBottom: 12 }}>{tab === 'owed_by_me' ? '🛡️' : '💸'}</div>
                        <h3 style={{ fontWeight: 800 }}>No {tab === 'owed_by_me' ? 'Borrowings' : 'Lendings'} Found</h3>
                        <p style={{ color: '#64748b' }}>You don't have any active records in this category.</p>
                    </div>
                )}
            </div>

            {/* FAB for Debts */}
            <div className="fab-container">
                <button className="btn btn-primary" onClick={() => setShowForm(true)} style={{ width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 30px rgba(15, 23, 42, 0.4)', border: 'none', background: '#0f172a' }}>
                    <Plus size={32} />
                </button>
            </div>
        </div>
    );
}
