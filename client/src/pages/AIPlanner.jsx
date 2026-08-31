import { useState, useEffect, useRef } from 'react';
import { getAIPlan, getAIAnalysis, getAIPrediction, getAIAlerts, chatWithAI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getCurrency } from '../utils/currency';
import toast from 'react-hot-toast';
import {
    Brain, ClipboardList, BarChart3,
    Bell, ShoppingBasket,
    DollarSign, Target, Heart, RefreshCw,
    CheckCircle2, AlertTriangle, Info,
    TrendingUp, Activity, Sparkles,
    ChevronRight, ArrowRight, Zap,
    ShieldCheck, Lightbulb, PieChart,
    Calendar, TrendingDown, MessageSquare, Send, Bot
} from 'lucide-react';

const categoryLabels = {
    food: '🍚 Food', vegetables: '🥦 Vegetables', fruits: '🍎 Fruits',
    dairy: '🥛 Dairy', meat: '🥩 Meat', household: '🧼 Household',
    snacks: '🍿 Snacks', beverages: '🥤 Beverages',
    personal_care: '🧴 Personal Care', other: '📦 Other'
};

export default function AIPlanner() {
    const [tab, setTab] = useState('chat');
    const [plan, setPlan] = useState(null);
    const [analysis, setAnalysis] = useState(null);
    const [prediction, setPrediction] = useState(null);
    const [alerts, setAlerts] = useState([]);
    const [alertsSeen, setAlertsSeen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [chatMessages, setChatMessages] = useState([{
        role: 'assistant',
        content: '👋 Hi! I\'m Ledgera AI, your personal finance assistant. I have access to your real financial data — bills, budget, accounts, debts, and transactions. Ask me anything!',
        timestamp: new Date()
    }]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const chatEndRef = useRef(null);
    const { user } = useAuth();
    const currInfo = getCurrency(user?.currency || 'LKR');
    const sym = currInfo.symbol;

    useEffect(() => { loadAll(); }, []);
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, chatLoading]);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [planRes, analysisRes, predRes, alertsRes] = await Promise.all([
                getAIPlan().catch(() => null),
                getAIAnalysis().catch(() => null),
                getAIPrediction().catch(() => null),
                getAIAlerts().catch(() => null)
            ]);
            if (planRes) setPlan(planRes.data);
            if (analysisRes) setAnalysis(analysisRes.data);
            if (predRes) setPrediction(predRes.data);
            if (alertsRes) { setAlerts(alertsRes.data.alerts || []); setAlertsSeen(false); }
        } catch (err) {
            toast.error('Failed to load AI data');
        } finally {
            setLoading(false);
        }
    };


    const sendChatMessage = async (overrideMsg) => {
        const msg = overrideMsg || chatInput.trim();
        if (!msg || chatLoading) return;
        setChatInput('');
        const userMsg = { role: 'user', content: msg, timestamp: new Date() };
        setChatMessages(prev => [...prev, userMsg]);
        setChatLoading(true);
        try {
            const history = chatMessages.map(m => ({ role: m.role, content: m.content }));
            const res = await chatWithAI({ message: msg, chatHistory: history });
            setChatMessages(prev => [...prev, {
                role: 'assistant',
                content: res.data.reply,
                timestamp: new Date()
            }]);
        } catch (err) {
            toast.error('AI chat failed. Please try again.');
            setChatMessages(prev => [...prev, {
                role: 'assistant',
                content: '⚠️ Sorry, I ran into an issue. Please try again in a moment.',
                timestamp: new Date()
            }]);
        } finally {
            setChatLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="loading-page">
                <div className="spinner"></div>
                <p style={{ color: 'var(--text-muted)', marginTop: 16, fontWeight: 600 }}>Syncing with Ledgera AI Engine...</p>
            </div>
        );
    }

    const TABS = [
        { id: 'chat', label: 'AI Chat', shortLabel: 'Chat', icon: MessageSquare },
        { id: 'plan', label: 'Smart Plan', shortLabel: 'Plan', icon: ClipboardList },
        { id: 'analysis', label: 'Budget Analysis', shortLabel: 'Analysis', icon: PieChart },
        { id: 'predict', label: 'Predictions', shortLabel: 'Predict', icon: TrendingUp },
        { id: 'alerts', label: 'Intelligence', shortLabel: 'Alerts', icon: Zap, count: alertsSeen ? 0 : alerts.length }
    ];

    return (
        <div className="slide-up">
            <div className="settings-sticky-header" style={{ paddingBottom: 16 }}>
                <div className="page-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #0f172a, #334155)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(15, 23, 42, 0.15)' }}>
                            <Brain size={24} />
                        </div>
                        <div>
                            <h2 className="text-responsive-2xl" style={{ fontWeight: 900, marginBottom: 0 }}>AI Smart Planner</h2>
                            <p className="page-header-sub" style={{ marginTop: 2 }}>Hyper-personalized financial intelligence</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={loadAll} className="btn btn-ghost" style={{ borderRadius: 12 }}>
                            <RefreshCw size={18} />
                        </button>
                    </div>
                </div>

                <div className="ai-pill-tabs" style={{ paddingRight: 32 }}>
                    {TABS.map(t => (
                        <button
                            key={t.id}
                            className={`ai-pill-tab ${tab === t.id ? 'active' : ''}`}
                            onClick={() => { setTab(t.id); if (t.id === 'alerts') setAlertsSeen(true); }}
                        >
                            <t.icon size={18} />
                            <span className="tab-label-full">{t.label}</span>
                            <span className="tab-label-short">{t.shortLabel}</span>
                            {t.count > 0 && <span className="tab-badge">{t.count}</span>}
                        </button>
                    ))}
                </div>
            </div>

            <div className="settings-content" style={{ marginTop: 0 }}>
                {/* Grocery Plan Section */}
                {tab === 'plan' && (
                    <div className="slide-up">
                        {plan?.plan ? (
                            <>
                                <div className="ai-stat-grid">
                                    <div className="ai-card" style={{ minWidth: 0, padding: '16px 12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                                            <div style={{ width: 32, height: 32, borderRadius: 10, background: '#f0f9ff', color: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ShoppingBasket size={18} /></div>
                                            <div style={{ fontSize: 9, fontWeight: 700, color: '#0ea5e9', background: '#e0f2fe', padding: '2px 6px', borderRadius: 6 }}>OPTIMIZED</div>
                                        </div>
                                        <div className="text-responsive-xl" style={{ fontWeight: 900, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{plan.plan.recommendedItems?.length || 0}</div>
                                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Recommended Items</div>
                                    </div>

                                    <div className="ai-card" style={{ minWidth: 0, padding: '16px 12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                                            <div style={{ width: 32, height: 32, borderRadius: 10, background: '#f0fdf4', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><DollarSign size={18} /></div>
                                            <div style={{ fontSize: 9, fontWeight: 700, color: '#10b981', background: '#dcfce7', padding: '2px 6px', borderRadius: 6 }}>ESTIMATED</div>
                                        </div>
                                        <div className="text-responsive-xl" style={{ fontWeight: 900, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sym} {(plan.plan.totalEstimatedCost || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Total Plan Value</div>
                                    </div>

                                    <div className="ai-card" style={{ minWidth: 0, padding: '16px 12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                                            <div style={{ width: 32, height: 32, borderRadius: 10, background: '#fffbeb', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Zap size={18} /></div>
                                            <div style={{ fontSize: 9, fontWeight: 700, color: '#f59e0b', background: '#fef3c7', padding: '2px 6px', borderRadius: 6 }}>POTENTIAL</div>
                                        </div>
                                        <div className="text-responsive-xl" style={{ fontWeight: 900, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sym} {(plan.plan.potentialSavings || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Monthly Savings</div>
                                    </div>

                                    <div className="ai-card" style={{ minWidth: 0, padding: '16px 12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                                            <div style={{ width: 32, height: 32, borderRadius: 10, background: '#fff1f2', color: '#f43f5e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Heart size={18} /></div>
                                            <div style={{ fontSize: 9, fontWeight: 700, color: '#f43f5e', background: '#ffe4e6', padding: '2px 6px', borderRadius: 6 }}>VITALITY</div>
                                        </div>
                                        <div className="text-responsive-xl" style={{ fontWeight: 900, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{plan.plan.healthScore || 0}%</div>
                                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Health Score</div>
                                    </div>
                                </div>

                                <div className="grid-2" style={{ marginBottom: 24 }}>
                                    <div className="ai-card">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                                            <div style={{ width: 48, height: 48, borderRadius: 50, border: '4px solid #f1f5f9', borderTopColor: plan.plan.healthScore >= 70 ? '#10b981' : plan.plan.healthScore >= 40 ? '#f59e0b' : '#f43f5e', transform: 'rotate(-45deg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <div style={{ transform: 'rotate(45deg)', fontSize: 14, fontWeight: 900 }}>{plan.plan.healthScore}</div>
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 800, fontSize: 16 }}>Health Index Analysis</div>
                                                <div style={{ fontSize: 12, color: '#64748b' }}>
                                                    {plan.plan.healthScore >= 70 ? 'Optimal nutritional balance detected.' : plan.plan.healthScore >= 40 ? 'Moderate nutritional quality.' : 'Critical nutritional imbalance detected.'}
                                                </div>
                                            </div>
                                        </div>
                                        <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6 }}>
                                            Your grocery patterns suggest a <strong>{plan.plan.healthScore >= 70 ? 'highly diverse' : 'fair'}</strong> diet. Ledgera AI recommends increasing {plan.plan.healthScore < 70 ? 'leafy greens and fresh fruits' : 'continued balance'} to maintain your wellness goals.
                                        </p>
                                    </div>

                                    <div className="ai-card">
                                        <div className="card-title" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <Lightbulb size={18} color="#f59e0b" /> Optimization Logic
                                        </div>
                                        <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6 }}>
                                            This plan is generated using <strong>Pattern Analysis</strong> on your last 3 months of spending. We've prioritized staple items while suggesting healthier alternatives that reduce your total estimated cost by <strong>{Math.round((plan.plan.potentialSavings / plan.plan.totalEstimatedCost) * 100) || 0}%</strong>.
                                        </p>
                                    </div>
                                </div>

                                <div className="ai-card" style={{ marginBottom: 24 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                                        <div>
                                            <h3 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>Smart Alternatives</h3>
                                            <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>AI suggestions to save money without compromising quality</p>
                                        </div>
                                    </div>
                                    
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))', gap: 16 }}>
                                        {plan.plan.recommendedItems?.filter(item => item.alternative).map((item, i) => (
                                            <div key={i} style={{ padding: 20, borderRadius: 20, background: '#f8fafc', border: '1px solid #f1f5f9', position: 'relative' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', background: '#e0e7ff', padding: '2px 8px', borderRadius: 6 }}>{categoryLabels[item.category] || item.category}</span>
                                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981' }}>SAVE {sym} {(item.estimatedPrice - item.alternativePrice).toLocaleString()}</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                                    <div style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', textDecoration: 'line-through' }}>{item.name}</div>
                                                    <ArrowRight size={14} color="#cbd5e1" />
                                                    <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{item.alternative}</div>
                                                </div>
                                                <div style={{ fontSize: 13, color: '#64748b', fontStyle: 'italic' }}>"{item.reason}"</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="ai-card">
                                    <div className="card-header" style={{ marginBottom: 24 }}>
                                        <div className="card-title">Detailed Grocery Plan</div>
                                    </div>
                                    <div className="table-container responsive-table-container" style={{ border: 'none' }}>
                                        <table className="responsive-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ background: 'transparent', paddingLeft: 0 }}>ITEM NAME</th>
                                                    <th style={{ background: 'transparent' }}>CATEGORY</th>
                                                    <th style={{ background: 'transparent' }}>EST. PRICE</th>
                                                    <th style={{ background: 'transparent' }}>STRATEGIC NOTE</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {plan.plan.recommendedItems?.map((item, i) => (
                                                    <tr key={i} style={{ background: '#fcfdfe', borderRadius: 12 }}>
                                                        <td style={{ padding: '16px', borderRadius: '12px 0 0 12px', border: '1px solid #f1f5f9', borderRight: 'none', fontWeight: 700, color: '#0f172a' }}>{item.name}</td>
                                                        <td style={{ padding: '16px', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
                                                            <span className="badge badge-blue" style={{ fontSize: 10 }}>{categoryLabels[item.category]?.split(' ')[1] || item.category}</span>
                                                        </td>
                                                        <td style={{ padding: '16px', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', fontWeight: 800 }}>{sym} {item.estimatedPrice?.toLocaleString()}</td>
                                                        <td style={{ padding: '16px', borderRadius: '0 12px 12px 0', border: '1px solid #f1f5f9', borderLeft: 'none', fontSize: 13, color: '#64748b' }}>{item.reason}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="ai-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
                                <div style={{ fontSize: 48, marginBottom: 20 }}>🧠</div>
                                <h3 style={{ fontSize: 20, fontWeight: 900 }}>Plan Generation in Progress</h3>
                                <p style={{ color: '#64748b', maxWidth: 400, margin: '0 auto 24px' }}>Add at least 3-5 grocery bills to unlock hyper-personalized smart planning and savings suggestions.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Budget Analysis Section */}
                {tab === 'analysis' && (
                    <div className="slide-up">
                        {analysis?.analysis ? (
                            <>
                                <div className="ai-card" style={{ marginBottom: 16, borderLeft: `6px solid ${analysis.analysis.status === 'safe' ? '#10b981' : analysis.analysis.status === 'warning' ? '#f59e0b' : '#f43f5e'}` }}>
                                    <div className="ai-alert-banner" style={{ padding: 0, background: 'transparent', border: 'none' }}>
                                        <div style={{ width: 44, height: 44, borderRadius: 12, background: analysis.analysis.status === 'safe' ? '#f0fdf4' : analysis.analysis.status === 'warning' ? '#fffbeb' : '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                                            {analysis.analysis.status === 'safe' ? '✅' : analysis.analysis.status === 'warning' ? '⚠️' : '🚨'}
                                        </div>
                                        <div>
                                            <h3 style={{ fontSize: 18, fontWeight: 900, margin: 0, lineHeight: 1.2 }}>{analysis.analysis.statusMessage}</h3>
                                            <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Spending analysis for {new Date(0, analysis.month - 1).toLocaleString('default', { month: 'long' })} {analysis.year}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid-2">
                                    <div>
                                        <div className="ai-card" style={{ marginBottom: 24 }}>
                                            <div className="card-title" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <ShieldCheck size={20} color="#10b981" /> Positive Trends
                                            </div>
                                            {analysis.analysis.insights?.map((insight, i) => (
                                                <div key={i} className="ai-alert-banner info">
                                                    <div style={{ marginTop: 2 }}><CheckCircle2 size={18} /></div>
                                                    <div style={{ fontSize: 14, lineHeight: 1.5 }}>{insight}</div>
                                                </div>
                                            ))}
                                            {(!analysis.analysis.insights || analysis.analysis.insights.length === 0) && (
                                                <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8', fontSize: 14 }}>No significant positive trends detected yet.</div>
                                            )}
                                        </div>

                                        <div className="ai-card">
                                            <div className="card-title" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <AlertTriangle size={20} color="#f43f5e" /> Budget Warnings
                                            </div>
                                            {analysis.analysis.warnings?.map((w, i) => (
                                                <div key={i} className="ai-alert-banner danger">
                                                    <div style={{ marginTop: 2 }}><AlertTriangle size={18} /></div>
                                                    <div style={{ fontSize: 14, lineHeight: 1.5 }}>{w}</div>
                                                </div>
                                            ))}
                                            {(!analysis.analysis.warnings || analysis.analysis.warnings.length === 0) && (
                                                <div style={{ textAlign: 'center', padding: '20px 0', color: '#10b981', fontSize: 14, fontWeight: 600 }}>Your spending is perfectly within safe limits! 🚀</div>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="ai-card" style={{ height: '100%' }}>
                                            <div className="card-title" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <Lightbulb size={20} color="#f59e0b" /> Expert Saving Tips
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                                {analysis.analysis.tips?.map((tip, i) => (
                                                    <div key={i} style={{ padding: 20, borderRadius: 16, background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)', border: '1px solid #e2e8f0' }}>
                                                        <div style={{ display: 'flex', gap: 12 }}>
                                                            <div style={{ fontSize: 18 }}>💡</div>
                                                            <div style={{ fontSize: 14, color: '#0f172a', fontWeight: 600, lineHeight: 1.5 }}>{tip}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="ai-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
                                <div style={{ fontSize: 48, marginBottom: 20 }}>📊</div>
                                <h3 style={{ fontSize: 20, fontWeight: 900 }}>Budget Analysis Locked</h3>
                                <p style={{ color: '#64748b', maxWidth: 400, margin: '0 auto' }}>Define your monthly income in Settings to enable deep budget analysis and spending warnings.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Predictions Section */}
                {tab === 'predict' && (
                    <div className="slide-up">
                        {prediction?.prediction ? (
                            <>
                                <div className="ai-stat-grid">
                                    <div className="ai-card">
                                        <div className="ai-stat-box" style={{ background: '#eff6ff', border: 'none' }}>
                                            <div className="label">Predicted Next Month</div>
                                            <div className="value" style={{ color: '#1d4ed8' }}>{sym} {prediction.prediction.predictedAmount?.toLocaleString()}</div>
                                        </div>
                                    </div>
                                    <div className="ai-card">
                                        <div className="ai-stat-box" style={{ background: '#f0fdf4', border: 'none' }}>
                                            <div className="label">Monthly Average</div>
                                            <div className="value" style={{ color: '#15803d' }}>{sym} {prediction.prediction.averageMonthly?.toLocaleString()}</div>
                                        </div>
                                    </div>
                                    <div className="ai-card">
                                        <div className="ai-stat-box" style={{ background: '#fffbeb', border: 'none' }}>
                                            <div className="label">Spending Trend</div>
                                            <div className="value" style={{ color: '#b45309', textTransform: 'capitalize' }}>
                                                {prediction.prediction.trend === 'increasing' ? <TrendingUp size={24} style={{ marginRight: 8 }} /> : <TrendingDown size={24} style={{ marginRight: 8 }} />}
                                                {prediction.prediction.trend}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="ai-card">
                                        <div className="ai-stat-box" style={{ background: '#fdf2f8', border: 'none' }}>
                                            <div className="label">Model Confidence</div>
                                            <div className="value" style={{ color: '#be185d' }}>{prediction.prediction.confidence}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="ai-card" style={{ marginBottom: 24 }}>
                                    <div className="card-title" style={{ marginBottom: 24 }}>Spending Trajectory</div>
                                    <div style={{ height: 200, display: 'flex', alignItems: 'flex-end', gap: 12, padding: '0 10px 40px', borderBottom: '1px solid #e2e8f0', overflowX: 'auto', minWidth: 0 }}>
                                        {prediction.trendData?.map((t, i) => {
                                            const max = Math.max(...prediction.trendData.map(x => x.totalSpent), prediction.prediction.predictedAmount);
                                            const height = (t.totalSpent / max) * 100;
                                            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                                            return (
                                                <div key={i} style={{ flex: 1, minWidth: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                                                    <div style={{ width: '100%', height: `${height}%`, background: '#e2e8f0', borderRadius: '8px 8px 0 0', position: 'relative' }}>
                                                        <div style={{ position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)', fontSize: 10, fontWeight: 700, color: '#94a3b8' }}>{Math.round(t.totalSpent / 1000)}k</div>
                                                    </div>
                                                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap' }}>{monthNames[t.month - 1]} {t.year}</div>
                                                </div>
                                            );
                                        })}
                                        <div style={{ flex: 1, minWidth: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                                            <div style={{ width: '100%', height: `${(prediction.prediction.predictedAmount / Math.max(...prediction.trendData.map(x => x.totalSpent), prediction.prediction.predictedAmount)) * 100}%`, background: 'linear-gradient(180deg, #6366f1, #4f46e5)', borderRadius: '8px 8px 0 0', position: 'relative', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)' }}>
                                                <div style={{ position: 'absolute', top: -24, left: '50%', transform: 'translateX(-50%)', fontSize: 12, fontWeight: 900, color: '#6366f1' }}>{Math.round(prediction.prediction.predictedAmount / 1000)}k</div>
                                                <div style={{ position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)', color: '#fff' }}><Sparkles size={12} /></div>
                                            </div>
                                            <div style={{ fontSize: 10, fontWeight: 900, color: '#6366f1', whiteSpace: 'nowrap' }}>
                                                {(() => {
                                                    if (!prediction.trendData || prediction.trendData.length === 0) return "NEXT";
                                                    const lastT = prediction.trendData[prediction.trendData.length - 1];
                                                    const nextM = lastT.month === 12 ? 1 : lastT.month + 1;
                                                    const nextY = lastT.month === 12 ? lastT.year + 1 : lastT.year;
                                                    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                                                    return `${monthNames[nextM - 1]} ${nextY}`;
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 16 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748b' }}><div style={{ width: 12, height: 12, background: '#e2e8f0', borderRadius: 3 }}></div> Historical</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#6366f1', fontWeight: 700 }}><div style={{ width: 12, height: 12, background: '#6366f1', borderRadius: 3 }}></div> AI Predicted</div>
                                    </div>
                                </div>

                                <div className="ai-card">
                                    <div className="card-title" style={{ marginBottom: 20 }}>Model Commentary</div>
                                    <div className={`ai-alert-banner ${prediction.prediction.predictedAmount > prediction.budgetLimit ? 'danger' : 'info'}`} style={{ border: 'none' }}>
                                        <div style={{ fontSize: 24 }}>{prediction.prediction.predictedAmount > prediction.budgetLimit ? '🧨' : '🎯'}</div>
                                        <div>
                                            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>
                                                {prediction.prediction.predictedAmount > prediction.budgetLimit ? 'Budget Breach Imminent' : 'Strategic Budget Alignment'}
                                            </div>
                                            <div style={{ fontSize: 14, opacity: 0.9 }}>
                                                {prediction.prediction.predictedAmount > prediction.budgetLimit
                                                    ? `Based on current trajectory, you are likely to exceed your budget by ${prediction.currency} ${(prediction.prediction.predictedAmount - prediction.budgetLimit).toLocaleString()}. We recommend cutting back on 'Snacks' and 'Beverages' next month.`
                                                    : `Your spending is trending efficiently. If patterns hold, you'll finish next month ${prediction.currency} ${(prediction.budgetLimit - prediction.prediction.predictedAmount).toLocaleString()} under budget.`
                                                }
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="ai-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
                                <div style={{ fontSize: 48, marginBottom: 20 }}>🔮</div>
                                <h3 style={{ fontSize: 20, fontWeight: 900 }}>Predictive Engine Offline</h3>
                                <p style={{ color: '#64748b', maxWidth: 400, margin: '0 auto' }}>Ledgera AI requires at least 2 consecutive months of spending data to build a reliable linear regression model for your finances.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Intelligence Alerts Section */}
                {tab === 'alerts' && (
                    <div className="slide-up">
                        <div className="ai-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
                                <div>
                                    <h3 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>Intelligence Feed</h3>
                                    <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Real-time alerts and strategic financial suggestions</p>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, background: '#fef2f2', color: '#ef4444', padding: '4px 10px', borderRadius: 20, fontWeight: 700 }}>
                                        <div className="ai-dot" style={{ background: '#ef4444' }}></div> {alerts.filter(a => a.severity === 'danger').length} Critical
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, background: '#fffbeb', color: '#f59e0b', padding: '4px 10px', borderRadius: 20, fontWeight: 700 }}>
                                        <div className="ai-dot" style={{ background: '#f59e0b' }}></div> {alerts.filter(a => a.severity === 'warning').length} Warnings
                                    </div>
                                </div>
                            </div>

                            {alerts.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {alerts.map((alert, i) => (
                                        <div key={i} className={`ai-alert-banner ${alert.severity === 'danger' ? 'danger' : alert.severity === 'warning' ? 'warning' : 'info'}`}>
                                            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                                                {alert.severity === 'danger' ? '🚨' : alert.severity === 'warning' ? '⚠️' : 'ℹ️'}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2, textTransform: 'capitalize' }}>{alert.type.replace(/_/g, ' ')}</div>
                                                <div style={{ fontSize: 14, opacity: 0.9, lineHeight: 1.5 }}>{alert.message}</div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <button className="btn btn-ghost" style={{ padding: 8, borderRadius: 8 }}><ChevronRight size={18} /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="empty-state" style={{ background: 'transparent', border: '2px dashed #f1f5f9' }}>
                                    <div style={{ fontSize: 48, marginBottom: 16 }}>🛡️</div>
                                    <h3 style={{ fontWeight: 900 }}>Clear Horizon</h3>
                                    <p>Our intelligence engine hasn't detected any spending anomalies or risks. You are perfectly on track!</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* AI Chat Section */}
                {tab === 'chat' && (
                    <div className="slide-up">
                        <div className="ai-card" style={{ padding: 0 }}>
                            {/* Header */}
                            <div className="chat-header" style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 10, background: 'linear-gradient(135deg, #0f172a, #1e293b)' }}>
                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Bot size={18} color="#fff" />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>Ledgera AI Assistant</div>
                                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                                        Powered by real-time financial data
                                    </div>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="chat-body" style={{ height: 'auto', maxHeight: 420, overflowY: 'auto', overflowX: 'hidden', padding: '16px 12px 12px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                                {chatMessages.map((msg, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 10, alignItems: 'flex-end' }}>
                                        {msg.role === 'assistant' && (
                                            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #0f172a, #334155)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <Bot size={14} color="#fff" />
                                            </div>
                                        )}
                                        <div className="chat-msg-container" style={{ maxWidth: '85%', padding: '12px 16px', borderRadius: msg.role === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px', background: msg.role === 'user' ? 'linear-gradient(135deg, #0f172a, #334155)' : '#f8fafc', color: msg.role === 'user' ? '#fff' : '#0f172a', border: msg.role === 'assistant' ? '1px solid #e2e8f0' : 'none', fontSize: 14, lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                            {msg.content}
                                            <div style={{ fontSize: 10, marginTop: 6, opacity: 0.5, textAlign: 'right' }}>
                                                {new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                        {msg.role === 'user' && (
                                            <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#e0f2fe', color: '#0369a1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 800, fontSize: 12 }}>
                                                {user?.name?.charAt(0).toUpperCase() || 'U'}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {chatLoading && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #0f172a, #334155)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <Bot size={14} color="#fff" />
                                        </div>
                                        <div style={{ padding: '12px 18px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '20px 20px 20px 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                                            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Analyzing your data...</span>
                                        </div>
                                    </div>
                                )}
                                <div ref={chatEndRef} />
                            </div>

                            {/* Input */}
                            <div className="chat-input-area" style={{ borderTop: '1px solid #f1f5f9', padding: '14px 16px', display: 'flex', gap: 10, background: '#fafafa' }}>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Ask about your spending, budget, debts, bills..."
                                    value={chatInput}
                                    onChange={e => setChatInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && !chatLoading && sendChatMessage()}
                                    style={{ flex: 1, borderRadius: 14, fontSize: 14 }}
                                    disabled={chatLoading}
                                />
                                <button
                                    onClick={() => sendChatMessage()}
                                    disabled={chatLoading || !chatInput.trim()}
                                    style={{ width: 44, height: 44, borderRadius: 14, background: chatInput.trim() && !chatLoading ? 'linear-gradient(135deg, #0f172a, #334155)' : '#e2e8f0', color: chatInput.trim() && !chatLoading ? '#fff' : '#94a3b8', border: 'none', cursor: chatInput.trim() && !chatLoading ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', flexShrink: 0 }}
                                >
                                    <Send size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
