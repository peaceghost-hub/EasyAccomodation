import axios from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:5000/api'
    : 'https://easyaccomodation-backend.onrender.com/api');

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
  verifyEmail: (token) => api.post('/auth/verify-email', { token }),
};

export const bookingAPI = {
  sendInquiry: (data) => api.post('/bookings/inquiry', data),
  reserveRoom: (data) => api.post('/bookings/reserve', data),
  confirmBooking: (data) => api.post('/bookings/confirm', data),
  myBookings: () => api.get('/bookings/my-bookings'),
  myInquiries: () => api.get('/bookings/inquiries'),
  // Accept either a reason string or an object payload
  cancelBooking: (id, reason) => {
    const payload = typeof reason === 'string' ? { reason } : (reason || {});
    return api.put(`/bookings/${id}/cancel`, payload);
  },
  cancelInquiry: (id) => api.put(`/bookings/inquiries/${id}/cancel`),
};

export const ownerAPI = {
  getMyHouse: () => api.get('/owner/house'),
  updateMyHouse: (data) => api.put('/owner/house', data),
  updatePaymentMethods: (data) => api.put('/owner/payment-methods', data),
  setRoomOccupancy: (roomId, data) => api.put(`/owner/rooms/${roomId}/occupancy`, data),
  claimHouse: (houseId, data) => api.post(`/houses/${houseId}/claim`, data),
  getMyHouseBookings: () => api.get('/owner/house/bookings'),
  acceptBooking: (id, data) => api.put(`/owner/bookings/${id}/accept`, data || {}),
  // Owner cancel: accept string or object, map string -> { message }
  cancelBooking: (id, data) => {
    let payload = {};
    if (typeof data === 'string') payload = { message: data };
    else if (data && typeof data === 'object') payload = data;
    return api.put(`/owner/bookings/${id}/cancel`, payload);
  },
  deleteBooking: (id) => api.delete(`/owner/bookings/${id}`),
  verifyInquiry: (id, response) => api.put(`/owner/inquiries/${id}/verify`, response ? { response } : {}),
  cancelInquiry: (id) => api.put(`/owner/inquiries/${id}/cancel`),
  deleteInquiry: (id) => api.delete(`/owner/inquiries/${id}`),
  deleteHouseImage: (filename) => api.delete(`/owner/house-image/${filename}`),
};

// Owner upload endpoint (replaces images list)
export const ownerUpload = {
  uploadHouseImages: (formData) => api.post('/owner/upload-house-images', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
};

export const paymentProofAPI = {
  uploadProof: (formData) => api.post('/payment-proofs/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

export const adminAPI = {
  addArea: (data) => api.post('/admin/residential-areas', data),
  updateArea: (id, data) => api.put(`/admin/residential-areas/${id}`, data),
  addHouse: (data) => api.post('/admin/houses', data),
  uploadHouseImages: (formData) => api.post('/admin/upload-house-images', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getStats: () => api.get('/admin/stats'),
  getHouses: (params) => api.get('/admin/houses', { params }),
  updateHouse: (id, data) => api.put(`/admin/houses/${id}`, data),
  deleteHouse: (id, force = false) => api.delete(`/admin/houses/${id}`, { params: force ? { force: true } : {} }),
  unassignHouseOwner: (id) => api.put(`/admin/houses/${id}/unassign-owner`),
  getUsers: (params) => api.get('/admin/users', { params }),
  deactivateUser: (id) => api.put(`/admin/users/${id}/deactivate`),
  activateUser: (id) => api.put(`/admin/users/${id}/activate`),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  getOwnerHouses: (id) => api.get(`/admin/users/${id}/houses`),
  getUser: (id) => api.get(`/admin/users/${id}`),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  setUserPassword: (id, data) => api.put(`/admin/users/${id}/password`, data),
  getHouseBookings: (houseId) => api.get(`/admin/houses/${houseId}/bookings`),
  getStudents: () => api.get('/auth/students'),
  deleteStudent: (studentRecordId) => api.delete(`/auth/students/${studentRecordId}`),
  deleteStudentForce: (studentRecordId) => api.delete(`/auth/students/${studentRecordId}`, { params: { force: true } }),
  getAreas: () => api.get('/admin/residential-areas'),
  deleteArea: (id) => api.delete(`/admin/residential-areas/${id}`),
  createAdmin: (data) => api.post('/admin/create-admin', data),
  getAudits: (params) => api.get('/admin/audits', { params }),
  // payment proof review
  listPendingProofs: () => api.get('/admin/payment-proofs/pending'),
  reviewProof: (proofId, data) => api.put(`/admin/payment-proofs/${proofId}/review`, data),
  deleteProof: (proofId) => api.delete(`/admin/payment-proofs/${proofId}`),
  // student verification management
  getStudentsWithVerification: () => api.get('/admin/students'),
  toggleStudentVerification: (studentId) => api.put(`/admin/students/${studentId}/toggle-verification`),
  // admin management
  getMyCreatedAdmins: () => api.get('/admin/my-created-admins'),
  deleteCreatedAdmin: (adminId) => api.delete(`/admin/delete-admin/${adminId}`),
};

export const houseAPI = {
  getAll: (params) => api.get('/houses', { params }),
  getAreas: () => api.get('/houses/residential-areas'),
  getByArea: (areaId) => api.get(`/houses/area/${areaId}`),
  getById: (id) => api.get(`/houses/${id}`),
  getUnclaimed: () => api.get('/houses/unclaimed'),
};

// adminAPI already declared above

export default api;
