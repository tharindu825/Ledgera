import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/Legera Logo.png';
import {
    LayoutDashboard, CreditCard, Landmark, Handshake,
    BrainCircuit, CalendarDays, BarChart3, Settings,
    LogOut, ChevronLeft, ChevronRight, Plus, ShieldCheck
} from 'lucide-react';

const mainNavItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/transactions', icon: CreditCard, label: 'Transactions' },
    { path: '/accounts', icon: Landmark, label: 'Accounts' },
    { path: '/debts', icon: Handshake, label: 'Debts & Loans' },
];

const aiNavItems = [
    { path: '/ai-planner', icon: BrainCircuit, label: 'AI Insights', badge: 'PRO' },
];

const historyNavItems = [
    { path: '/budget-history', icon: CalendarDays, label: 'Monthly Recap' },
    { path: '/analytics', icon: BarChart3, label: 'Analytics' },
];

const accountNavItems = [
    { path: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar({ isOpen, onClose, isCollapsed, toggleCollapse }) {
    const { user, logoutUser } = useAuth();

    const initials = user?.name
        ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
        : '?';

    const renderNavItem = (item) => {
        const Icon = item.icon;
        return (
            <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={onClose}
                end={item.path === '/'}
            >
                <span className="nav-icon">
                    <Icon size={18} strokeWidth={2} />
                </span>
                <span className="nav-label">{item.label}</span>
                {item.badge && (
                    <span className="nav-badge" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                        {item.badge}
                    </span>
                )}
            </NavLink>
        );
    };

    return (
        <>
            {/* Mobile overlay */}
            {isOpen && (
                <div
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000, backdropFilter: 'blur(4px)' }}
                    onClick={onClose}
                />
            )}

            <aside className={`sidebar ${isOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
                {/* Brand */}
                <div className="sidebar-brand">
                    <img src={logo} alt="Ledgera" style={{ width: 40, height: 40, objectFit: 'contain', flexShrink: 0 }} />
                    <div className="sidebar-brand-text">
                        <h1>Ledgera</h1>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="sidebar-nav">
                    <div className="sidebar-section-title">Main</div>
                    {mainNavItems.map(renderNavItem)}
                    <div className="sidebar-section-title">Intelligence</div>
                    {aiNavItems.map(renderNavItem)}
                    <div className="sidebar-section-title">Reports</div>
                    {historyNavItems.map(renderNavItem)}
                    <div className="sidebar-section-title">System</div>
                    {accountNavItems.map(renderNavItem)}
                    {user?.role === 'admin' && renderNavItem({ path: '/admin', icon: ShieldCheck, label: 'User Access', badge: 'ADMIN' })}
                </nav>

                {/* Collapse toggle */}
                <div style={{ padding: '0 12px', marginBottom: 8 }}>
                    <button onClick={toggleCollapse} className="collapse-btn">
                        {isCollapsed
                            ? <ChevronRight size={16} />
                            : <><ChevronLeft size={16} /><span>Collapse</span></>
                        }
                    </button>
                </div>

                {/* Footer */}
                <div className="sidebar-footer">
                    <div className="sidebar-user">
                        <div className="sidebar-user-avatar">{initials}</div>
                        <div className="sidebar-user-info">
                            <div className="sidebar-user-name">{user?.name || 'User'}</div>
                            <div className="sidebar-user-email">{user?.email || ''}</div>
                        </div>
                    </div>
                    <button className="logout-btn" onClick={logoutUser} title="Sign Out">
                        <LogOut size={16} strokeWidth={2} />
                        {!isCollapsed && <span className="logout-text">Sign Out</span>}
                    </button>
                </div>
            </aside>
        </>
    );
}
