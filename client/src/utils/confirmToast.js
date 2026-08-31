// confirmToast.jsx — reusable toast-based confirm dialog (no JSX to avoid module resolution issues)
import React from 'react';
import toast from 'react-hot-toast';

/**
 * Shows a premium toast-based confirmation dialog instead of window.confirm.
 * Returns a Promise that resolves to true (confirmed) or false (cancelled).
 */
export function confirmToast(message = 'Are you sure?', { danger = true } = {}) {
    return new Promise((resolve) => {
        toast(
            (t) => React.createElement(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: 10, minWidth: 240 } },
                React.createElement(
                    'div',
                    { style: { display: 'flex', alignItems: 'center', gap: 10 } },
                    React.createElement('span', { style: { fontSize: 20 } }, danger ? '🗑️' : '❓'),
                    React.createElement('span', { style: { fontWeight: 600, fontSize: 14, color: '#0f172a', lineHeight: 1.4 } }, message)
                ),
                React.createElement(
                    'div',
                    { style: { display: 'flex', gap: 8, justifyContent: 'flex-end' } },
                    React.createElement(
                        'button',
                        {
                            onClick: () => { toast.dismiss(t.id); resolve(false); },
                            style: {
                                padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e8f0',
                                background: '#f8fafc', color: '#64748b', cursor: 'pointer',
                                fontWeight: 600, fontSize: 13
                            }
                        },
                        'Cancel'
                    ),
                    React.createElement(
                        'button',
                        {
                            onClick: () => { toast.dismiss(t.id); resolve(true); },
                            style: {
                                padding: '6px 14px', borderRadius: 8, border: 'none',
                                background: danger ? '#f43f5e' : '#0f172a', color: '#fff',
                                cursor: 'pointer', fontWeight: 700, fontSize: 13
                            }
                        },
                        danger ? 'Delete' : 'Confirm'
                    )
                )
            ),
            {
                duration: Infinity,
                style: {
                    padding: '16px 18px',
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 8px 30px rgba(15,23,42,0.15)',
                    background: '#ffffff',
                    maxWidth: 320,
                },
            }
        );
    });
}
