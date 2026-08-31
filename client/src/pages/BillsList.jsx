import { useState, useEffect } from 'react';
import { getBills, deleteBill } from '../services/api';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getCurrency } from '../utils/currency';
import EditBillModal from '../components/EditBillModal';
import { confirmToast } from '../utils/confirmToast';
import toast from 'react-hot-toast';
import {
    Plus, Receipt, Calendar, Filter,
    X, Pencil, Trash2, Camera, Edit2,
    ChevronLeft, ChevronRight, FileText
} from 'lucide-react';

const categoryLabels = {
    food: '🍚 Food', vegetables: '🥦 Vegetables', fruits: '🍎 Fruits',
    dairy: '🥛 Dairy', meat: '🥩 Meat', household: '🧼 Household',
    snacks: '🍿 Snacks', beverages: '🥤 Beverages',
    personal_care: '🧴 Care', other: '📦 Other'
};

export default function BillsList() {
    const [bills, setBills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [pages, setPages] = useState(1);
    const [filter, setFilter] = useState({ month: '', year: '' });
    const [expandedBill, setExpandedBill] = useState(null);
    const [editingBill, setEditingBill] = useState(null);
    const { user } = useAuth();
    const currInfo = getCurrency(user?.currency || 'LKR');

    useEffect(() => { loadBills(); }, [page, filter]);

    const loadBills = async () => {
        setLoading(true);
        try {
            const params = { page, limit: 15 };
            if (filter.month) params.month = filter.month;
            if (filter.year) params.year = filter.year;
            const res = await getBills(params);
            setBills(res.data.bills);
            setTotal(res.data.total);
            setPages(res.data.pages);
        } catch (err) {
            toast.error('Failed to load bills');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        const confirmed = await confirmToast('Delete this bill? Monthly summary will be recalculated.');
        if (!confirmed) return;
        try {
            await deleteBill(id);
            toast.success('Bill deleted');
            loadBills();
        } catch (err) {
            toast.error('Failed to delete');
        }
    };

    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    return (
        <div className="slide-up">
            {editingBill && (
                <EditBillModal
                    bill={editingBill}
                    onClose={() => setEditingBill(null)}
                    onSaved={loadBills}
                />
            )}

            {/* ── Mobile Header ─────────────────────────────────────────────── */}
            <div className="page-header">
                <div>
                    <h2>Bills History</h2>
                    <p className="page-header-sub" style={{ fontSize: 13, color: '#64748b' }}>{total} total records</p>
                </div>

                <div className="filters-bar" style={{ marginTop: 12 }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <span style={{ position: 'absolute', left: 12, color: '#94a3b8' }}><Calendar size={14} /></span>
                        <select className="form-select" style={{ paddingLeft: 34 }} value={filter.month}
                            onChange={(e) => { setFilter(f => ({ ...f, month: e.target.value })); setPage(1); }}>
                            <option value="">All Months</option>
                            {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                        </select>
                    </div>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <span style={{ position: 'absolute', left: 12, color: '#94a3b8' }}><Calendar size={14} /></span>
                        <select className="form-select" style={{ paddingLeft: 34 }} value={filter.year}
                            onChange={(e) => { setFilter(f => ({ ...f, year: e.target.value })); setPage(1); }}>
                            <option value="">All Years</option>
                            {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 3 + i).map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="loading-page"><div className="spinner"></div></div>
            ) : bills.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon">🧾</div>
                        <h3>No bills found</h3>
                        <p>Start by uploading your first grocery bill</p>
                        <Link to="/upload" className="btn btn-primary" style={{ marginTop: 16 }}>Upload Bill</Link>
                    </div>
                </div>
            ) : (
                <>
                    <div className="bills-grid" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {bills.map(bill => (
                            <div key={bill._id} className="card"
                                onClick={() => setExpandedBill(expandedBill === bill._id ? null : bill._id)}
                                style={{ padding: 0, overflow: 'hidden', border: expandedBill === bill._id ? '1px solid #1e293b' : '1px solid #f1f5f9' }}>
                                <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                                        <div style={{ width: 44, height: 44, borderRadius: 14, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                                            {bill.inputMethod === 'ocr' ? <Camera size={20} /> : <Edit2 size={20} />}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{bill.storeName}</div>
                                            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                                                {new Date(bill.billDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} • {bill.items?.length || 0} items
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: user?.currency || 'LKR', minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(bill.totalAmount)}
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                                            <button onClick={(e) => { e.stopPropagation(); setEditingBill(bill); }} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer' }}><Pencil size={15} /></button>
                                            <button onClick={(e) => { e.stopPropagation(); handleDelete(bill._id); }} style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer' }}><Trash2 size={15} /></button>
                                        </div>
                                    </div>
                                </div>

                                {expandedBill === bill._id && bill.items?.length > 0 && (
                                    <div style={{ background: '#f8fafc', padding: '16px', borderTop: '1px solid #f1f5f9' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {bill.items.map((item, idx) => (
                                                <div key={idx} style={{
                                                    display: 'grid', gridTemplateColumns: '1fr auto auto',
                                                    gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 14,
                                                    background: '#ffffff',
                                                    border: '1px solid #e2e8f0',
                                                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <span style={{ fontSize: 16 }}>{categoryLabels[item.category]?.split(' ')[0] || '📦'}</span>
                                                        <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{item.name}</div>
                                                    </div>
                                                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{item.quantity} x {currInfo.symbol}{item.unitPrice?.toLocaleString()}</div>
                                                    <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>{currInfo.symbol}{item.totalPrice?.toLocaleString()}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Pagination */}
                    {pages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
                            <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Previous</button>
                            <span style={{ display: 'flex', alignItems: 'center', fontSize: 13, color: 'var(--text-muted)', padding: '0 12px' }}>
                                Page {page} of {pages}
                            </span>
                            <button className="btn btn-secondary btn-sm" disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next →</button>
                        </div>
                    )}
                </>
            )}

            {/* FAB for Bills */}
            <div className="fab-container">
                <Link to="/upload" className="btn btn-primary" style={{ width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 30px rgba(15, 23, 42, 0.4)', border: 'none', background: '#0f172a', textDecoration: 'none', color: '#fff' }}>
                    <Plus size={32} />
                </Link>
            </div>
        </div>
    );
}
