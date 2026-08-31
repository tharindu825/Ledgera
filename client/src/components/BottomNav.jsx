import { NavLink } from 'react-router-dom';
import { 
    LayoutDashboard, 
    CreditCard, 
    BrainCircuit, 
    BarChart3,
    Settings
} from 'lucide-react';

export default function BottomNav() {
    const navItems = [
        { path: '/', icon: LayoutDashboard, label: 'Home' },
        { path: '/transactions', icon: CreditCard, label: 'Bills' },
        { path: '/ai-planner', icon: BrainCircuit, label: 'AI' },
        { path: '/analytics', icon: BarChart3, label: 'Trends' },
        { path: '/settings', icon: Settings, label: 'More' }
    ];

    return (
        <nav className="bottom-nav">
            {navItems.map((item) => (
                <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
                    end={item.path === '/'}
                >
                    <item.icon />
                    <span>{item.label}</span>
                </NavLink>
            ))}
        </nav>
    );
}
