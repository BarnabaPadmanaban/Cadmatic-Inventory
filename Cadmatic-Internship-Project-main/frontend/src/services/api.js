import axios from 'axios';

const TOKEN_KEY = 'ems_auth_token';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT to every outgoing request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

API.interceptors.response.use(
  (res) => res,
  (err) => {
    // Session expired / invalid token — force back to login
    if (err.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('ems_auth_user');
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem('ems_auth_user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    const msg = err.response?.data?.message || err.message || 'Request failed';
    return Promise.reject(new Error(msg));
  }
);

export const authAPI = {
  login: (data) => API.post('/auth/login', data),
  logout: () => API.post('/auth/logout'),
  getMe: () => API.get('/auth/me'),
  getUsers: () => API.get('/auth/users'),
  createUser: (data) => API.post('/auth/users', data),
  updateUser: (id, data) => API.put(`/auth/users/${id}`, data),
  setUserStatus: (id, status) => API.patch(`/auth/users/${id}/status`, { status }),
  deleteUser: (id) => API.delete(`/auth/users/${id}`),
  getActivityLogs: (params) => API.get('/auth/activity-logs', { params }),
};

export const fieldConfigAPI = {
  getAll: () => API.get('/fields'),
  create: (data) => API.post('/fields', data),
  update: (key, data) => API.put(`/fields/${key}`, data),
  remove: (key) => API.delete(`/fields/${key}`),
};

export const equipmentAPI = {
  getAll: (params) => API.get('/equipment', { params }),
  getById: (id) => API.get(`/equipment/${id}`),
  create: (data) => API.post('/equipment', data),
  update: (id, data) => API.put(`/equipment/${id}`, data),
  delete: (id) => API.delete(`/equipment/${id}`),
  getDashboard: () => API.get('/equipment/stats/dashboard'),
  getStatusLookup: () => API.get('/equipment/status-lookup'),
  import: (formData) => API.post('/equipment/import/excel', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  export: async (params = {}) => {
    const res = await API.get('/equipment/export', { params, responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'equipment_status_export.xlsx');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
  addMaintenance: (id, data) => API.post(`/equipment/${id}/maintenance`, data),
  getEquipmentMaintenance: (id) => API.get(`/equipment/${id}/maintenance`),
};

export const maintenanceAPI = {
  getAll: (params) => API.get('/maintenance', { params }),
  getDashboard: () => API.get('/maintenance/dashboard'),
  create: (data) => API.post('/maintenance', data),
  update: (id, data) => API.put(`/maintenance/${id}`, data),
  delete: (id) => API.delete(`/maintenance/${id}`),
  import: (formData) => API.post('/maintenance/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  export: async () => {
    const res = await API.get('/maintenance/export', { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'maintenance_records.xlsx');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
  uploadDocument: (maintenanceId, formData) => API.post(
    `/maintenance/${maintenanceId}/documents`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  ),
};
export default API;
