import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getBudget, updateBudget, updateProfile, getCategories, updateCategory, createCategory, addSubcategory, getWalletAccounts, syncWalletAccounts, getWalletCategories, syncWalletCategories } from '../services/api';
import { currencies, getCurrency, formatCurrency } from '../utils/currency';
import { confirmToast } from '../utils/confirmToast';
import toast from 'react-hot-toast';
import {
    User, Wallet, FolderOpen, Save,
    Plus, X, Info, Target, Landmark,
    Smartphone, CreditCard, PieChart, Tag, Trash2, ChevronRight, Calculator,
    RefreshCw, CheckCircle, AlertCircle
} from 'lucide-react';
import NewCategoryGroupModal from '../components/NewCategoryGroupModal';

export default function Settings() {
    const { user, updateUser, logoutUser } = useAuth();
    const [form, setForm] = useState({
        name: '',
        familySize: 1,
        savingsGoal: 0,
        budgetPercentage: 60,
        currency: 'LKR'
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [categories, setCategories] = useState([]);
    const [activeType, setActiveType] = useState('expense');
    const [selectedMainCat, setSelectedMainCat] = useState(null);
    const [activeTab, setActiveTab] = useState('general');
    const [newSub, setNewSub] = useState('');
    const [showNewCatModal, setShowNewCatModal] = useState(false);
    // Wallet Sync state
    const [walletAccounts, setWalletAccounts] = useState([]);
    const [walletCategories, setWalletCategories] = useState([]);
    const [walletLoading, setWalletLoading] = useState(false);
    const [walletSyncing, setWalletSyncing] = useState('');
    const [walletResult, setWalletResult] = useState(null);

    useEffect(() => {
        loadSettings();
        loadCategories();
    }, []);

    const loadCategories = async () => {
        try {
            const res = await getCategories();
            setCategories(res.data);
            if (res.data.length > 0) {
                const first = res.data.find(c => c.type === 'expense') || res.data[0];
                setSelectedMainCat(first);
                setActiveType(first.type);
            }
        } catch (err) {
            console.error('Failed to load categories');
        }
    };

    const loadSettings = async () => {
        try {
            const res = await getBudget();
            setForm({
                name: user?.name || '',
                familySize: res.data.familySize || 1,
                savingsGoal: res.data.savingsGoal || 0,
                budgetPercentage: res.data.budgetPercentage || 60,
                currency: res.data.currency || 'LKR'
            });
        } catch (err) {
            if (user) {
                setForm({
                    name: user.name || '',
                    familySize: user.familySize || 1,
                    savingsGoal: user.savingsGoal || 0,
                    budgetPercentage: user.budgetPercentage || 60,
                    currency: user.currency || 'LKR'
                });
            }
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await updateProfile({ name: form.name });
            await updateBudget({
                familySize: parseInt(form.familySize),
                savingsGoal: parseFloat(form.savingsGoal),
                budgetPercentage: parseFloat(form.budgetPercentage),
                currency: form.currency
            });
            updateUser({ ...user, ...form });
            toast.success('Settings saved! ✅');
        } catch (err) {
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const budgetLimit = (250000 * parseFloat(form.budgetPercentage)) / 100; // Estimated for preview
    const perPerson = parseInt(form.familySize) > 0 ? budgetLimit / parseInt(form.familySize) : budgetLimit;
    const monthlySavingsTarget = parseFloat(form.savingsGoal) / 12;
    const currInfo = getCurrency(form.currency);
    const sym = currInfo.symbol;

    if (loading) {
        return <div className="loading-page"><div className="spinner"></div></div>;
    }

    const TABS = [
        { id: 'general', label: 'General', icon: User, desc: 'Profile and system settings' },
        { id: 'budget', label: 'Budget', icon: PieChart, desc: 'Limits and family settings' },
        { id: 'categories', label: 'Categories', icon: FolderOpen, desc: 'Custom categories & subcategories' },
        { id: 'wallet', label: 'Wallet Sync', icon: Wallet, desc: 'Import from BudgetBakers' },
    ];

    const loadWalletPreview = async () => {
        setWalletLoading(true);
        setWalletResult(null);
        try {
            const [accRes, catRes] = await Promise.all([getWalletAccounts(), getWalletCategories()]);
            setWalletAccounts(accRes.data.accounts || []);
            setWalletCategories(catRes.data.categories || []);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to fetch Wallet data');
        } finally {
            setWalletLoading(false);
        }
    };

    const handleSyncAccounts = async () => {
        setWalletSyncing('accounts');
        setWalletResult(null);
        try {
            const res = await syncWalletAccounts();
            setWalletResult({ type: 'accounts', ...res.data });
            toast.success(`Accounts synced! ${res.data.created} created, ${res.data.updated} updated.`);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Sync failed');
        } finally {
            setWalletSyncing('');
        }
    };

    const handleSyncCategories = async () => {
        setWalletSyncing('categories');
        setWalletResult(null);
        try {
            const res = await syncWalletCategories();
            setWalletResult({ type: 'categories', ...res.data });
            toast.success(`Categories synced! ${res.data.created} created, ${res.data.updated} updated.`);
            loadCategories(); // refresh categories
        } catch (err) {
            toast.error(err.response?.data?.error || 'Sync failed');
        } finally {
            setWalletSyncing('');
        }
    };

    return (
        <div className="slide-up">
            <div className="settings-sticky-header">
                <div className="page-header">
                    <div>
                        <h2 style={{ fontSize: 28, fontWeight: 900, marginBottom: 0 }}>Settings</h2>
                        <p className="page-header-sub" style={{ marginTop: 2 }}>Configure your Ledgera executive experience</p>
                    </div>
                </div>

                {/* Premium Tabs */}
                <div className="tabs-scroll-wrapper" style={{ marginBottom: 0, borderBottom: 'none' }}>
                    <div className="tabs-inner-flex" style={{ display: 'flex', gap: 12 }}>
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    padding: '12px 20px',
                                    flexShrink: 0,
                                    borderRadius: '12px 12px 0 0',
                                    border: 'none',
                                    background: activeTab === tab.id ? '#fff' : 'transparent',
                                    color: activeTab === tab.id ? '#0f172a' : '#64748b',
                                    fontWeight: 700,
                                    fontSize: 14,
                                    cursor: 'pointer',
                                    position: 'relative',
                                    transition: 'all 0.2s',
                                    borderBottom: activeTab === tab.id ? '3px solid #0f172a' : '3px solid transparent',
                                    marginBottom: -1
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                                    <tab.icon size={16} />
                                    {tab.label}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="settings-content" style={{ marginTop: 0 }}>
                {activeTab === 'general' && (
                    <div className="grid-2 slide-up" style={{ alignItems: 'start' }}>
                        <div>
                            <form onSubmit={handleSubmit}>
                                <div className="card" style={{ marginBottom: 20 }}>
                                    <div className="card-header">
                                        <div className="card-title">Profile Information</div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Full Name</label>
                                        <input id="setting-name" type="text" className="form-input" name="name" value={form.name} onChange={handleChange} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Email Address (Primary)</label>
                                        <input type="email" className="form-input" value={user?.email || ''} disabled style={{ opacity: 0.6, background: '#f8fafc' }} />
                                    </div>
                                </div>

                                <div className="card" style={{ marginBottom: 20 }}>
                                    <div className="card-header">
                                        <div className="card-title">System Preferences</div>
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Base Currency</label>
                                        <select id="setting-currency" className="form-select" name="currency" value={form.currency} onChange={handleChange}>
                                            {currencies.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code} — {c.name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <button id="save-settings" type="submit" className="btn btn-primary btn-save-settings" disabled={saving}>
                                    {saving ? 'Saving...' : '💾 Save General Settings'}
                                </button>
                            </form>
                        </div>
                        <div className="card">
                            <div className="card-title" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Info size={18} color="#3b82f6" /> Pro Tip
                            </div>
                            <p style={{ color: '#64748b', fontSize: 14 }}>Updating your currency will affect how all transactions are displayed. Make sure to review your budgets after changing this.</p>
                        </div>
                    </div>
                )}

                {activeTab === 'budget' && (
                    <div className="grid-2 slide-up" style={{ alignItems: 'start' }}>
                        <div>
                            <form onSubmit={handleSubmit}>
                                <div className="card" style={{ marginBottom: 20 }}>
                                    <div className="card-header">
                                        <div className="card-title">Household & Goals</div>
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">Family Size</label>
                                            <select id="setting-family" className="form-select" name="familySize" value={form.familySize} onChange={handleChange}>
                                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <option key={n} value={n}>{n} {n === 1 ? 'person' : 'people'}</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Yearly Savings Goal</label>
                                            <input id="setting-savings" type="number" step="any" className="form-input" name="savingsGoal" value={form.savingsGoal} onChange={handleChange} min="0" />
                                        </div>
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                            <label className="form-label" style={{ margin: 0 }}>Grocery Budget Allocation</label>
                                            <span style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', background: '#f1f5f9', padding: '4px 12px', borderRadius: 8 }}>{form.budgetPercentage}%</span>
                                        </div>
                                        <input id="setting-budget-pct" type="range" min="10" max="100" value={form.budgetPercentage} onChange={(e) => setForm(f => ({ ...f, budgetPercentage: e.target.value }))} style={{ width: '100%', accentColor: '#0f172a', height: 6, borderRadius: 3, cursor: 'pointer' }} />
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginTop: 12 }}>
                                            <span>Conservative (10%)</span>
                                            <span>Standard (50%)</span>
                                            <span style={{ color: '#0f172a', fontWeight: 700 }}>Exclusive (100%)</span>
                                        </div>
                                    </div>
                                </div>
                                <button type="submit" className="btn btn-primary btn-save-settings" disabled={saving}>
                                    {saving ? 'Saving...' : '💾 Save Budget Plan'}
                                </button>
                            </form>
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Calculator size={18} color="#0f172a" /> Budget Model Estimator
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div style={{ fontSize: 12, color: '#94a3b8', background: '#f8fafc', padding: 8, borderRadius: 8 }}>
                                    Note: This preview uses an estimated monthly income of 250,000 {sym}. Real limits are calculated from your income transactions.
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#64748b', fontSize: 13 }}>Allocated for Groceries</span>
                                    <span style={{ fontWeight: 700, fontSize: 18 }}>{sym} {budgetLimit.toLocaleString()}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#64748b', fontSize: 13 }}>Per Person / Month</span>
                                    <span style={{ fontWeight: 600 }}>{sym} {Math.round(perPerson).toLocaleString()}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#64748b', fontSize: 13 }}>Per Person / Day</span>
                                    <span style={{ fontWeight: 600, color: '#10b981' }}>{sym} {Math.round(perPerson / 30).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'categories' && (
                    <div className="slide-up">
                        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                            <div className="category-studio-header">
                                <div>
                                    <h3 style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', margin: 0 }}>Category Studio</h3>
                                    <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Manage sub-tags for your transaction groups</p>
                                </div>
                                <div className="category-type-toggle" style={{ display: 'flex', background: '#f1f5f9', padding: 4, borderRadius: 12, flexShrink: 0 }}>
                                    <button type="button" className={`btn btn-sm ${activeType === 'expense' ? 'btn-primary' : 'btn-ghost'}`}
                                        style={{ borderRadius: 8, padding: '6px 16px' }}
                                        onClick={() => { setActiveType('expense'); const first = categories.find(c => c.type === 'expense'); if (first) setSelectedMainCat(first); }}>Expenses</button>
                                    <button type="button" className={`btn btn-sm ${activeType === 'income' ? 'btn-primary' : 'btn-ghost'}`}
                                        style={{ borderRadius: 8, padding: '6px 16px' }}
                                        onClick={() => { setActiveType('income'); const first = categories.find(c => c.type === 'income'); if (first) setSelectedMainCat(first); }}>Income</button>
                                </div>
                            </div>

                            <div className="category-studio-container">
                                {/* Sidebar: Main Categories */}
                                <div className="category-sidebar" style={{ borderRight: '1px solid #f1f5f9', background: '#fcfdfe', padding: '24px 16px' }}>
                                    {categories.filter(c => c.type === activeType).map(cat => (
                                        <button key={cat._id} type="button" onClick={() => setSelectedMainCat(cat)} style={{
                                            width: '100%', textAlign: 'left', padding: '12px 16px', borderRadius: 14, marginBottom: 8, border: 'none',
                                            background: selectedMainCat?._id === cat._id ? '#0f172a' : 'transparent',
                                            color: selectedMainCat?._id === cat._id ? '#fff' : '#64748b',
                                            fontWeight: 700, cursor: 'pointer', fontSize: 14, transition: 'all 0.2s',
                                            display: 'flex', alignItems: 'center', gap: 12,
                                            boxShadow: selectedMainCat?._id === cat._id ? '0 10px 15px -3px rgba(15, 23, 42, 0.2)' : 'none'
                                        }}>
                                            <div style={{
                                                width: 8, height: 8, borderRadius: '50%',
                                                background: selectedMainCat?._id === cat._id ? '#fff' : '#cbd5e1'
                                            }} />
                                            <span style={{ flex: 1 }}>{cat.mainCategory.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={handleCreateMainCat}
                                        style={{
                                            width: '100%', padding: '12px 16px', borderRadius: 14, marginTop: 16,
                                            border: '1px dashed #e2e8f0', background: 'transparent', color: '#64748b',
                                            fontWeight: 700, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 12
                                        }}>
                                        <div style={{ width: 32, height: 32, borderRadius: 10, border: '1px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>＋</div>
                                        <span>Add New Group</span>
                                    </button>
                                </div>

                                {/* Content: Category Editor */}
                                <div className="category-content-area" style={{ flex: 1, background: '#fff' }}>
                                    {selectedMainCat ? (
                                        <div className="slide-up">
                                            {/* Appearance Section */}
                                            {/* Category Heading */}
                                            <div style={{ marginBottom: 40 }}>
                                                <h4 style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>
                                                    {selectedMainCat.mainCategory.replace(/_/g, ' ')}
                                                </h4>
                                                <p style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>Manage sub-categories and tags for this group</p>
                                            </div>

                                            {/* Subcategories Section */}
                                            <div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                                    <h4 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>Manage Sub-tags</h4>
                                                    <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{selectedMainCat.subcategories.length} Tags defined</span>
                                                </div>
                                                <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                                                    <div style={{ position: 'relative', flex: 1 }}>
                                                        <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }}>＋</span>
                                                        <input type="text" className="form-input" placeholder={`New subcategory for ${selectedMainCat.mainCategory.replace(/_/g, ' ')}...`}
                                                            value={newSub} onChange={(e) => setNewSub(e.target.value)}
                                                            onKeyPress={(e) => e.key === 'Enter' && handleAddSub()}
                                                            style={{ marginBottom: 0, paddingLeft: 40, borderRadius: 16, height: 48, background: '#f8fafc' }} />
                                                    </div>
                                                    <button type="button" className="btn btn-primary" onClick={handleAddSub} disabled={!newSub.trim()} style={{ borderRadius: 16, padding: '0 24px' }}>Add Tag</button>
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                                                    {selectedMainCat.subcategories.map((sub, idx) => (
                                                        <div key={idx} className="sub-cat-pill" style={{
                                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                            padding: '12px 16px', background: '#fff', borderRadius: 14,
                                                            border: '1px solid #f1f5f9', boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                                                            transition: 'transform 0.2s'
                                                        }}>
                                                            <span style={{ fontSize: 13, color: '#0f172a', fontWeight: 600 }}>{sub}</span>
                                                            <button type="button" onClick={() => handleRemoveSub(sub)}
                                                                style={{
                                                                    border: 'none', background: '#fff1f2', color: '#f43f5e', cursor: 'pointer',
                                                                    width: 24, height: 24, borderRadius: 8, fontSize: 10, display: 'flex',
                                                                    alignItems: 'center', justifyContent: 'center'
                                                                }}>✕</button>
                                                        </div>
                                                    ))}
                                                </div>
                                                {selectedMainCat.subcategories.length === 0 && (
                                                    <div className="empty-state" style={{ padding: '60px 0', border: '1px dashed #e2e8f0', borderRadius: 24 }}>
                                                        <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.2 }}>🏷️</div>
                                                        <p style={{ fontWeight: 600, color: '#94a3b8' }}>No sub-tags defined yet.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="empty-state" style={{ padding: '100px 0' }}>
                                            <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.2 }}>👈</div>
                                            <p>Select a category to customize its properties.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {showNewCatModal && (
                            <NewCategoryGroupModal
                                type={activeType}
                                onClose={() => setShowNewCatModal(false)}
                                onConfirm={confirmCreateMainCat}
                            />
                        )}
                    </div>
                )}

                {/* ─── Wallet Sync Tab ────────────────────────────────────── */}
                {activeTab === 'wallet' && (
                    <div className="slide-up">
                        {/* Hero Card */}
                        <div className="card" style={{
                            marginBottom: 24,
                            background: 'linear-gradient(135deg, #312e81 0%, #4f46e5 100%)',
                            border: 'none', color: '#fff'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                        <Wallet size={24} />
                                        <h3 style={{ margin: 0, fontWeight: 900, fontSize: 20 }}>BudgetBakers Wallet Sync</h3>
                                    </div>
                                    <p style={{ color: '#c7d2fe', fontSize: 14, margin: 0 }}>
                                        Import your real accounts and category structure from Wallet into Ledgera. Merges safely — existing data is preserved.
                                    </p>
                                </div>
                                <button
                                    className="btn"
                                    onClick={loadWalletPreview}
                                    disabled={walletLoading}
                                    style={{
                                        background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
                                        color: '#fff', borderRadius: 14, padding: '10px 20px',
                                        display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, flexShrink: 0
                                    }}
                                >
                                    <RefreshCw size={16} className={walletLoading ? 'spin' : ''} />
                                    {walletLoading ? 'Loading...' : 'Load Preview'}
                                </button>
                            </div>
                        </div>

                        {/* Result Banner */}
                        {walletResult && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px',
                                borderRadius: 14, marginBottom: 20,
                                background: '#f0fdf4', border: '1px solid #bbf7d0'
                            }}>
                                <CheckCircle size={18} color="#10b981" />
                                <span style={{ fontWeight: 700, color: '#064e3b', fontSize: 14 }}>
                                    {walletResult.type === 'accounts'
                                        ? `Accounts: ${walletResult.created} created, ${walletResult.updated} updated`
                                        : `Categories: ${walletResult.created} created, ${walletResult.updated} updated`}
                                </span>
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                            {/* ── Accounts Panel */}
                            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a' }}>Wallet Accounts</div>
                                        <div style={{ fontSize: 12, color: '#64748b' }}>{walletAccounts.length} accounts found</div>
                                    </div>
                                    <button
                                        className="btn btn-primary btn-sm"
                                        onClick={handleSyncAccounts}
                                        disabled={walletSyncing === 'accounts' || walletAccounts.length === 0}
                                        style={{ borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
                                    >
                                        <RefreshCw size={13} />
                                        {walletSyncing === 'accounts' ? 'Syncing...' : 'Sync Accounts'}
                                    </button>
                                </div>
                                <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                                    {walletAccounts.length === 0 ? (
                                        <div style={{ padding: '40px 24px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                                            Click "Load Preview" to fetch accounts from Wallet
                                        </div>
                                    ) : walletAccounts.map((acc, i) => (
                                        <div key={i} style={{
                                            display: 'flex', alignItems: 'center', gap: 12,
                                            padding: '12px 24px', borderBottom: '1px solid #f8fafc',
                                            transition: 'background 0.15s'
                                        }}>
                                            <div style={{
                                                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                                                background: `${acc.color}20`, display: 'flex', alignItems: 'center',
                                                justifyContent: 'center', fontSize: 16
                                            }}>🏦</div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{acc.name}</div>
                                                <div style={{ fontSize: 11, color: '#64748b' }}>{acc.accountType}</div>
                                            </div>
                                            <div style={{ fontSize: 14, fontWeight: 800, color: acc.balance < 0 ? '#ef4444' : '#10b981', flexShrink: 0 }}>
                                                {new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(acc.balance)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* ── Categories Panel */}
                            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a' }}>Wallet Categories</div>
                                        <div style={{ fontSize: 12, color: '#64748b' }}>{walletCategories.length} category groups found</div>
                                    </div>
                                    <button
                                        className="btn btn-primary btn-sm"
                                        onClick={handleSyncCategories}
                                        disabled={walletSyncing === 'categories' || walletCategories.length === 0}
                                        style={{ borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
                                    >
                                        <RefreshCw size={13} />
                                        {walletSyncing === 'categories' ? 'Syncing...' : 'Sync Categories'}
                                    </button>
                                </div>
                                <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                                    {walletCategories.length === 0 ? (
                                        <div style={{ padding: '40px 24px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                                            Click "Load Preview" to fetch categories from Wallet
                                        </div>
                                    ) : walletCategories.map((cat, i) => (
                                        <div key={i} style={{
                                            padding: '12px 24px', borderBottom: '1px solid #f8fafc'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: cat.color || '#64748b', flexShrink: 0 }} />
                                                <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', textTransform: 'capitalize' }}>
                                                    {cat.groupName}
                                                </span>
                                                <span style={{ fontSize: 10, background: cat.type === 'income' ? '#d1fae5' : '#ede9fe', color: cat.type === 'income' ? '#065f46' : '#5b21b6', borderRadius: 6, padding: '2px 6px', fontWeight: 700 }}>
                                                    {cat.type}
                                                </span>
                                            </div>
                                            {cat.subcategories.slice(0, 3).map((sub, si) => (
                                                <span key={si} style={{ display: 'inline-block', fontSize: 11, color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '2px 8px', marginRight: 4, marginTop: 2 }}>{sub}</span>
                                            ))}
                                            {cat.subcategories.length > 3 && (
                                                <span style={{ fontSize: 11, color: '#94a3b8' }}>+{cat.subcategories.length - 3} more</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="card" style={{ marginTop: 20, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <AlertCircle size={16} color="#3b82f6" style={{ flexShrink: 0, marginTop: 2 }} />
                            <div style={{ fontSize: 13, color: '#64748b' }}>
                                <strong style={{ color: '#0f172a' }}>Safe merge:</strong> Syncing will <em>add</em> new accounts/categories that don't exist in Ledgera yet, and update balances/colors for matches. Your existing data is never deleted.
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );


    function handleCreateMainCat() {
        setShowNewCatModal(true);
    }

    async function confirmCreateMainCat(name) {
        try {
            const res = await createCategory({
                type: activeType,
                mainCategory: name
            });
            setCategories(prev => [...prev, res.data]);
            setSelectedMainCat(res.data);
            toast.success('New category group created');
        } catch (err) {
            toast.error('Failed to create category group');
        }
    }

    async function handleAddSub() {
        if (!newSub.trim() || !selectedMainCat) return;
        try {
            const updatedSubs = [...selectedMainCat.subcategories, newSub.trim()];
            const res = await updateCategory(selectedMainCat._id, { subcategories: updatedSubs });
            setCategories(prev => prev.map(c => c._id === res.data._id ? res.data : c));
            setSelectedMainCat(res.data);
            setNewSub('');
            toast.success('Subcategory added');
        } catch (err) {
            toast.error('Failed to add subcategory');
        }
    }

    async function handleRemoveSub(subName) {
        if (!selectedMainCat) return;
        const confirmed = await confirmToast(`Remove "${subName}" from subcategories?`);
        if (!confirmed) return;

        try {
            const updatedSubs = selectedMainCat.subcategories.filter(s => s !== subName);
            const res = await updateCategory(selectedMainCat._id, { subcategories: updatedSubs });
            setCategories(prev => prev.map(c => c._id === res.data._id ? res.data : c));
            setSelectedMainCat(res.data);
            toast.success('Subcategory removed');
        } catch (err) {
            toast.error('Failed to remove subcategory');
        }
    }
}
