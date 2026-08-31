import { useState } from 'react';
import { X, FolderPlus } from 'lucide-react';

export default function NewCategoryGroupModal({ onClose, onConfirm, type }) {
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setLoading(true);
        await onConfirm(name.trim());
        setLoading(false);
        onClose();
    };

    return (
        <div className="modal-wrapper" style={{
            position: 'fixed', inset: 0, zIndex: 3000,
            background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
            <div className="modal-container" style={{
                background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 24,
                width: '100%', maxWidth: 450, overflow: 'hidden',
                display: 'flex', flexDirection: 'column',
                boxShadow: '0 32px 80px -12px rgba(15, 23, 42, 0.25)',
                animation: 'modalSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
                <div style={{ padding: '24px 32px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: '#e0f2fe', color: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FolderPlus size={20} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: 18, color: '#0f172a', letterSpacing: '-0.5px' }}>New {type === 'expense' ? 'Expense' : 'Income'} Group</div>
                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Create a top-level category container.</div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '32px' }}>
                    <div className="form-group">
                        <label className="form-label">Category Group Name</label>
                        <input
                            autoFocus
                            className="form-input"
                            placeholder="e.g. Household, Business, Health"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            style={{ height: 48, fontSize: 15 }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                        <button type="button" className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={!name.trim() || loading} style={{ flex: 2 }}>
                            {loading ? 'Creating...' : 'Create Group'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
