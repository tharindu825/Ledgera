import { createContext, useContext, useState, useEffect } from 'react';
import { getProfile } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('grocery_token');
        const savedUser = localStorage.getItem('grocery_user');

        if (token && savedUser) {
            setUser(JSON.parse(savedUser));
            // Verify token is still valid
            getProfile()
                .then(res => {
                    setUser(res.data.user);
                    localStorage.setItem('grocery_user', JSON.stringify(res.data.user));
                })
                .catch(() => {
                    localStorage.removeItem('grocery_token');
                    localStorage.removeItem('grocery_user');
                    setUser(null);
                })
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    const loginUser = (token, userData) => {
        localStorage.setItem('grocery_token', token);
        localStorage.setItem('grocery_user', JSON.stringify(userData));
        setUser(userData);
    };

    const logoutUser = () => {
        localStorage.removeItem('grocery_token');
        localStorage.removeItem('grocery_user');
        setUser(null);
    };

    const updateUser = (userData) => {
        localStorage.setItem('grocery_user', JSON.stringify(userData));
        setUser(userData);
    };

    return (
        <AuthContext.Provider value={{ user, loading, loginUser, logoutUser, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
