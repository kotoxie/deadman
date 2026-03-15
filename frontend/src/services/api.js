import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// CSRF token store — updated by AuthContext after each successful auth check
let _csrfToken = null;
export function setCsrfToken(token) { _csrfToken = token; }

// Attach the CSRF token to every mutating request
api.interceptors.request.use((config) => {
  const method = (config.method || '').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && _csrfToken) {
    config.headers['X-CSRF-Token'] = _csrfToken;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      window.dispatchEvent(new Event('auth:logout'));
    }
    return Promise.reject(err);
  }
);

// Auth
export const authLogin = (password) => api.post('/auth/login', { password });
export const authLogout = () => api.post('/auth/logout');
export const authCheck = () => api.get('/auth/check');
export const changePassword = (currentPassword, newPassword) => api.post('/auth/change-password', { currentPassword, newPassword }).then(r => r.data);
export const skipPasswordChange = () => api.post('/auth/skip-password-change').then(r => r.data);

// Dashboard
export const getDashboard = () => api.get('/dashboard').then(r => r.data);

// Check-in
export const checkIn = () => api.post('/checkin').then(r => r.data);
export const triggerPanic = () => api.post('/checkin/panic', {}, { headers: { 'X-Confirm': 'DELIVER' } }).then(r => r.data);
export const togglePause = (paused) => api.post('/checkin/pause', { paused }).then(r => r.data);
export const testWarning = () => api.post('/checkin/test-warning').then(r => r.data);

// Vault
export const getVaultItems = () => api.get('/vault').then(r => r.data);
export const getVaultItem = (id) => api.get(`/vault/${id}`).then(r => r.data);
export const createVaultItem = (data) => api.post('/vault', data).then(r => r.data);
export const updateVaultItem = (id, data) => api.put(`/vault/${id}`, data).then(r => r.data);
export const deleteVaultItem = (id) => api.delete(`/vault/${id}`).then(r => r.data);

// Recipients
export const getRecipients = () => api.get('/recipients').then(r => r.data);
export const getRecipient = (id) => api.get(`/recipients/${id}`).then(r => r.data);
export const createRecipient = (data) => api.post('/recipients', data).then(r => r.data);
export const updateRecipient = (id, data) => api.put(`/recipients/${id}`, data).then(r => r.data);
export const deleteRecipient = (id) => api.delete(`/recipients/${id}`).then(r => r.data);
export const assignItems = (id, itemIds) => api.post(`/recipients/${id}/assign`, { itemIds }).then(r => r.data);
export const testDelivery = (id) => api.post(`/recipients/${id}/test`).then(r => r.data);

// Delivery Logs
export const getDeliveryLogs = (params) => api.get('/delivery-logs', { params }).then(r => r.data);
export const retryDelivery = (id) => api.post(`/delivery-logs/${id}/retry`).then(r => r.data);

// Audit Logs
export const getAuditLogs = (params) => api.get('/audit-logs', { params }).then(r => r.data);

// Version
export const getVersion = () => api.get('/version').then(r => r.data);

// Settings
export const getSettings = () => api.get('/settings').then(r => r.data);
export const updateSettings = (data) => api.put('/settings', data).then(r => r.data);
export const testEmail = (to) => api.post('/settings/test-email', { to }).then(r => r.data);
export const testTelegram = (chatId) => api.post('/settings/test-telegram', { chatId }).then(r => r.data);

export default api;
