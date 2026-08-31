import { useAuth } from '../context/AuthContext';
import logo from '../assets/Legera Logo.png';
import { Menu } from 'lucide-react';

export default function MobileHeader({ onMenuClick }) {
    const { user } = useAuth();
    const initials = user?.name
        ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
        : '?';

    return (
        <header className="mobile-header">
            {/* Left: Logo + Brand */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <img src={logo} alt="Ledgera" style={{ width: 32, height: 32, objectFit: 'contain' }} />
                <span style={{ color: '#fff', fontSize: 18, fontWeight: 900, letterSpacing: '-0.5px' }}>Ledgera</span>
            </div>

            {/* Right: Menu Button */}
            <button onClick={onMenuClick} className="mobile-menu-btn" aria-label="Open menu">
                <Menu size={22} strokeWidth={2} />
            </button>
        </header>
    );
}
