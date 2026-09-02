import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { getCategoryBudgetAlerts } from '../services/api';

/**
 * useBudgetAlerts — fires once per session when a category budget is at/above 80%.
 * Suppresses duplicate notifications using sessionStorage.
 */
export default function useBudgetAlerts() {
    const fired = useRef(false);

    useEffect(() => {
        if (fired.current) return;
        fired.current = true;

        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        const sessionKey = `budget_alerts_${month}_${year}`;

        // Only fire once per browser session
        if (sessionStorage.getItem(sessionKey)) return;

        getCategoryBudgetAlerts(month, year)
            .then(res => {
                const alerts = res.data.alerts || [];
                if (alerts.length === 0) return;

                // Mark as shown so we don't spam
                sessionStorage.setItem(sessionKey, '1');

                alerts.forEach((alert, i) => {
                    // Stagger the toasts slightly
                    setTimeout(() => {
                        if (alert.severity === 'exceeded') {
                            toast.error(alert.message, {
                                duration: 6000,
                                icon: '🚨',
                                style: {
                                    borderRadius: 14,
                                    background: '#fef2f2',
                                    color: '#991b1b',
                                    fontWeight: 600,
                                    border: '1px solid #fee2e2',
                                    fontSize: 13
                                }
                            });
                        } else {
                            toast(alert.message, {
                                duration: 5000,
                                icon: '⚠️',
                                style: {
                                    borderRadius: 14,
                                    background: '#fffbeb',
                                    color: '#92400e',
                                    fontWeight: 600,
                                    border: '1px solid #fef3c7',
                                    fontSize: 13
                                }
                            });
                        }
                    }, i * 800);
                });
            })
            .catch(() => { /* Silently ignore if alerts endpoint fails */ });
    }, []);
}
