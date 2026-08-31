import { useState, useEffect } from 'react';
import { getUsers, grantUserAccess, revokeUserAccess, updateUserAccess, deleteUser } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { confirmToast } from '../utils/confirmToast';
import toast from 'react-hot-toast';
import {
    Shield, ShieldCheck, ShieldX, UserCheck, UserX, Clock,
    Trash2, Crown, Users, CalendarDays, X, Save
} from 'lucide-react';

export default function AdminPanel() {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingUser, setEditingUser] = useState(null);
    const [editForm, setEditForm] = useState({ accessExpiresAt: '', role: 'user' });

    useEffect(() => { fetchUsers(); }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await getUsers();
            setUsers(res.data);
        } catch (err) {
            toast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const handleGrantAccess = async (userId) => {
        try {
            await grantUserAccess(userId, {});
            toast.success('Access granted!');
            fetchUsers();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed');
        }
    };

    const handleRevokeAccess = async (userId) => {
        const confirmed = await confirmToast('Revoke access for this user?');
        if (!confirmed) return;
        try {
            await revokeUserAccess(userId);
            toast.success('Access revoked');
            fetchUsers();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed');
        }
    };

    const handleDelete = async (userId, userName) => {
        const confirmed = await confirmToast(`Permanently delete "${userName}"?`);
        if (!confirmed) return;
        try {
            await deleteUser(userId);
            toast.success('User deleted');
            fetchUsers();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed');
        }
    };

    const openEditModal = (u) => {
        setEditingUser(u);
        setEditForm({
            accessExpiresAt: u.accessExpiresAt ? new Date(u.accessExpiresAt).toISOString().split('T')[0] : '',
            role: u.role
        });
    };

    const handleSaveEdit = async () => {
        try {
            await updateUserAccess(editingUser._id, {
                accessExpiresAt: editForm.accessExpiresAt || null
            });
            toast.success('User updated!');
            setEditingUser(null);
            fetchUsers();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update');
        }
    };

    const getAccessStatus = (u) => {
        if (u.role === 'admin') return { label: 'Admin', color: '#8b5cf6', bg: '#f5f3ff', icon: Crown };
        if (!u.accessGranted) return { label: 'No Access', color: '#ef4444', bg: '#fef2f2', icon: ShieldX };
        if (u.accessExpiresAt && new Date(u.accessExpiresAt) < new Date()) return { label: 'Expired', color: '#f59e0b', bg: '#fffbeb', icon: Clock };
        return { label: 'Active', color: '#10b981', bg: '#f0fdf4', icon: ShieldCheck };
    };

    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

    if (loading) return <div className="loading-page"><div className="spinner" /></div>;

    const activeCount = users.filter(u => u.accessGranted && (u.role === 'admin' || !u.accessExpiresAt || new Date(u.accessExpiresAt) >= new Date())).length;
    const pendingCount = users.filter(u => !u.accessGranted && u.role !== 'admin').length;

    return (
        <div className="slide-up">
            <div className="page-header">
                <div>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Shield size={24} /> User Management
                    </h2>
                    <p className="page-header-sub" style={{ fontSize: 13, color: '#64748b' }}>
                        Control user access to the system
                    </p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="stat-grid" style={{ marginBottom: 24 }}>
                <div className="card" style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#f0fdf4', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={14} /></div>
                        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Total Users</span>
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 900 }}>{users.length}</div>
                </div>
                <div className="card" style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#f0fdf4', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserCheck size={14} /></div>
                        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Active</span>
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: '#10b981' }}>{activeCount}</div>
                </div>
                <div className="card" style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#fef2f2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserX size={14} /></div>
                        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Pending</span>
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: '#ef4444' }}>{pendingCount}</div>
                </div>
            </div>

            {/* Edit Modal */}
            {editingUser && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 2000,
                    background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
                }}>
                    <div style={{
                        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 24,
                        width: '100%', maxWidth: 440, padding: 32,
                        boxShadow: '0 25px 60px -12px rgba(15, 23, 42, 0.2)',
                        animation: 'modalSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <h3 style={{ fontWeight: 800, fontSize: 20, color: '#0f172a', margin: 0 }}>
                                ⚙️ Edit Access — {editingUser.name}
                            </h3>
                            <button onClick={() => setEditingUser(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 10, width: 32, height: 32, cursor: 'pointer', color: '#94a3b8' }}>
                                <X size={16} />
                            </button>
                        </div>



                        <div className="form-group">
                            <label className="form-label">Access Expires On</label>
                            <input
                                className="form-input"
                                type="date"
                                value={editForm.accessExpiresAt}
                                onChange={e => setEditForm(f => ({ ...f, accessExpiresAt: e.target.value }))}
                            />
                            <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                                Leave empty for unlimited access
                            </p>
                        </div>

                        {editForm.accessExpiresAt && (
                            <div style={{
                                background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 12,
                                fontSize: 13, color: '#166534', fontWeight: 600, marginBottom: 16
                            }}>
                                ✅ Access valid until: {new Date(editForm.accessExpiresAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                            <button className="btn btn-ghost flex-1" onClick={() => setEditingUser(null)}>Cancel</button>
                            <button className="btn btn-primary flex-1" onClick={handleSaveEdit}>
                                <Save size={16} /> Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Users List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {users.map(u => {
                    const status = getAccessStatus(u);
                    const StatusIcon = status.icon;
                    const isCurrentUser = currentUser?.id === u._id || currentUser?._id === u._id;

                    return (
                        <div key={u._id} className="card" style={{
                            borderLeft: `4px solid ${status.color}`,
                            padding: '16px 20px',
                            transition: 'all 0.2s'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                                {/* User Info */}
                                <div style={{ display: 'flex', gap: 14, alignItems: 'center', flex: 1, minWidth: 200 }}>
                                    <div style={{
                                        width: 44, height: 44, borderRadius: '50%',
                                        background: u.role === 'admin' ? 'linear-gradient(135deg, #0f172a, #334155)' : '#f1f5f9',
                                        color: u.role === 'admin' ? '#fff' : '#64748b',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontWeight: 800, fontSize: 15, flexShrink: 0
                                    }}>
                                        {u.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                                            {u.name}
                                            {isCurrentUser && <span style={{ fontSize: 10, background: '#e0f2fe', color: '#0369a1', padding: '1px 8px', borderRadius: 6, fontWeight: 800 }}>YOU</span>}
                                        </div>
                                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{u.email}</div>
                                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                                            Joined: {formatDate(u.createdAt)}
                                            {u.accessExpiresAt && u.accessGranted && (
                                                <span style={{ marginLeft: 8 }}>
                                                    • Expires: <strong style={{ color: new Date(u.accessExpiresAt) < new Date() ? '#ef4444' : '#0f172a' }}>{formatDate(u.accessExpiresAt)}</strong>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Status + Actions */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                    <span style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
                                        background: status.bg, color: status.color
                                    }}>
                                        <StatusIcon size={14} /> {status.label}
                                    </span>

                                    {u.role !== 'admin' && (
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            {!u.accessGranted ? (
                                                <button className="btn btn-sm" onClick={() => handleGrantAccess(u._id)}
                                                    style={{ background: '#10b981', color: '#fff', borderRadius: 10, padding: '6px 14px', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <UserCheck size={14} /> Grant
                                                </button>
                                            ) : (
                                                <button className="btn btn-sm" onClick={() => handleRevokeAccess(u._id)}
                                                    style={{ background: '#fef2f2', color: '#ef4444', borderRadius: 10, padding: '6px 14px', fontSize: 12, fontWeight: 700, border: '1px solid #fecaca', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <UserX size={14} /> Revoke
                                                </button>
                                            )}

                                            <button className="btn btn-ghost btn-sm" onClick={() => openEditModal(u)}
                                                style={{ padding: '6px 10px', color: '#3b82f6' }} title="Edit access settings">
                                                <CalendarDays size={16} />
                                            </button>

                                            <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(u._id, u.name)}
                                                style={{ padding: '6px 10px', color: '#f43f5e' }} title="Delete user">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {users.length === 0 && (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon">👥</div>
                        <h3>No users found</h3>
                    </div>
                </div>
            )}
        </div>
    );
}
