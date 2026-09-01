import axios from 'axios';

const API = axios.create({ baseURL: '/api' });

// Add token to requests
API.interceptors.request.use((config) => {
    const token = localStorage.getItem('grocery_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// Handle 401 and 403 errors
API.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('grocery_token');
            localStorage.removeItem('grocery_user');
            window.location.href = '/login';
        }
        // Handle access denied/expired — force logout with message
        if (error.response?.status === 403 && 
            (error.response?.data?.error === 'ACCESS_DENIED' || error.response?.data?.error === 'ACCESS_EXPIRED')) {
            localStorage.removeItem('grocery_token');
            localStorage.removeItem('grocery_user');
            localStorage.setItem('access_denied_message', error.response.data.message);
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// Auth
export const register = (data) => API.post('/auth/register', data);
export const login = (data) => API.post('/auth/login', data);
export const getProfile = () => API.get('/auth/profile');
export const updateProfile = (data) => API.put('/auth/profile', data);

// Bills
export const createBill = (data) => API.post('/bills', data);
export const getBills = (params) => API.get('/bills', { params });
export const getBill = (id) => API.get(`/bills/${id}`);
export const updateBill = (id, data) => API.put(`/bills/${id}`, data);
export const deleteBill = (id) => API.delete(`/bills/${id}`);
export const getBillSuggestions = () => API.get('/bills/suggestions');

// Budget
export const getBudget = (params) => API.get('/budget', { params });
export const updateBudget = (data) => API.put('/budget', data);
export const getBudgetStatus = (params) => API.get('/budget/status', { params });

// Dashboard
export const getDashboard = (params) => API.get('/dashboard', { params });
export const getAnalytics = (year, month) => API.get(`/dashboard/analytics/${year}/${month}`);

// AI
export const getAIAnalysis = (params) => API.get('/ai/analysis', { params });
export const getAIPlan = () => API.get('/ai/plan');
export const getAIPrediction = () => API.get('/ai/predict');
export const getAIAlerts = () => API.get('/ai/alerts');
export const predictCategory = (itemName) => API.post('/ai/predict-category', { itemName });
export const chatWithAI = (data) => API.post('/ai/chat', data);

// OCR
export const scanBillImage = (formData) => API.post('/ocr/scan', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
});
export const scanBillBase64 = (imageData, strategy) => API.post('/ocr/scan-base64', { imageData, strategy });

// Transactions
export const getTransactions = (params) => API.get('/transactions', { params });
export const createTransaction = (data) => API.post('/transactions', data);
export const createBulkTransactions = (data) => API.post('/transactions/bulk', data);
export const updateTransaction = (id, data) => API.put(`/transactions/${id}`, data);
export const deleteTransaction = (id) => API.delete(`/transactions/${id}`);
export const getTransactionYears = () => API.get('/transactions/years');

// Debts
export const getDebts = () => API.get('/debts');
export const createDebt = (data) => API.post('/debts', data);
export const updateDebt = (id, data) => API.put(`/debts/${id}`, data);
export const recordRepayment = (id, data) => API.post(`/debts/${id}/repayment`, data);
export const updateRepayment = (debtId, repaymentId, data) => API.put(`/debts/${debtId}/repayment/${repaymentId}`, data);
export const deleteDebt = (id) => API.delete(`/debts/${id}`);

// Budget History
export const getBudgetHistory = () => API.get('/budget/history');
export const updateHistoricalBudget = (year, month, data) => API.put(`/budget/history/${year}/${month}`, data);

// Accounts
export const getAccounts = () => API.get('/accounts');
export const createAccount = (data) => API.post('/accounts', data);
export const updateAccount = (id, data) => API.put(`/accounts/${id}`, data);
export const adjustAccountBalance = (id, data) => API.patch(`/accounts/${id}/adjust`, data);
export const deleteAccount = (id) => API.delete(`/accounts/${id}`);

// Categories
export const getCategories = () => API.get('/categories');
export const updateCategory = (id, data) => API.put(`/categories/${id}`, data);
export const createCategory = (data) => API.post('/categories', data);
export const addSubcategory = (data) => API.post('/categories/add-sub', data);
export const deleteCategory = (id) => API.delete(`/categories/${id}`);

// Admin
export const getUsers = () => API.get('/admin/users');
export const grantUserAccess = (id, data) => API.put(`/admin/users/${id}/grant-access`, data);
export const revokeUserAccess = (id) => API.put(`/admin/users/${id}/revoke-access`);
export const updateUserAccess = (id, data) => API.put(`/admin/users/${id}/update-access`, data);
export const deleteUser = (id) => API.delete(`/admin/users/${id}`);

// Wallet Sync (BudgetBakers)
export const getWalletAccounts = () => API.get('/wallet/accounts');
export const syncWalletAccounts = () => API.post('/wallet/sync-accounts');
export const getWalletCategories = () => API.get('/wallet/categories');
export const syncWalletCategories = () => API.post('/wallet/sync-categories');

// Transfers
export const createTransfer = (data) => API.post('/transfers', data);

export default API;
