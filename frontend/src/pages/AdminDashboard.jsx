import React, { useEffect, useState } from 'react';
import { adminAPI } from '../services/api';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const [houses, setHouses] = useState([]);
  const [users, setUsers] = useState([]);
  const [students, setStudents] = useState([]);
  const [createdAdmins, setCreatedAdmins] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ open: false, student: null });
  const [ownerDeleteModal, setOwnerDeleteModal] = useState({ open: false, owner: null });
  const [adminDeleteModal, setAdminDeleteModal] = useState({ open: false, admin: null });
  const [selected, setSelected] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [message, setMessage] = useState('');
  const [pendingProofs, setPendingProofs] = useState([]);
  const [proofModal, setProofModal] = useState({ open: false, proof: null });
  const [proofLoading, setProofLoading] = useState(false);

  const getModalProofId = () => {
    // Accept multiple possible shapes: item.proof.id OR item.proofId OR item.id
    try {
      const item = proofModal && proofModal.proof;
      if (!item) return null;
      // Case: item.proof (object) contains id
      if (item.proof && item.proof.id) return item.proof.id;
      // Case: item.proofId
      if (item.proofId) return item.proofId;
      // Case: maybe item.proof is at top-level
      if (item.id) return item.id;
      return null;
    } catch (e) {
      return null;
    }
  };
  const [areas, setAreas] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  // Derived filtered lists based on search query
  const q = (searchQuery || '').trim().toLowerCase();
  const filteredUsers = users.filter(u => {
    if (!q) return true;
    return [u.full_name, u.email].join(' ').toLowerCase().includes(q);
  });
  const filteredHouses = houses.filter(h => {
    if (!q) return true;
    const owner = h.owner_contact ? `${h.owner_contact.name || ''} ${h.owner_contact.email || ''}` : '';
    const area = (h.residential_area && (h.residential_area.name || h.residential_area)) || '';
    return [h.house_number, h.street_address, area, owner].join(' ').toLowerCase().includes(q);
  });
  const filteredStudents = students.filter(s => {
    if (!q) return true;
    return [s.full_name, s.email, s.student_id, s.institution].join(' ').toLowerCase().includes(q);
  });

  const loadData = async () => {
    try {
      const [hRes, uRes] = await Promise.all([
        adminAPI.getHouses(),
        adminAPI.getUsers({ user_type: 'house_owner' })
      ]);

      // load areas as well
      try {
        const aRes = await adminAPI.getAreas();
        if (aRes.data && aRes.data.areas) setAreas(aRes.data.areas);
      } catch (e) {
        // ignore area load errors
      }

      if (hRes.data && hRes.data.houses) setHouses(hRes.data.houses);
      if (uRes.data && uRes.data.users) setUsers(uRes.data.users);
      // residential areas already loaded above
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to load admin data');
    }
  };

  const fetchPendingProofs = async () => {
    try {
      const res = await adminAPI.listPendingProofs();
      if (res.data && res.data.items) {
        // Normalize view_url to absolute backend URL so images load correctly from the Flask server
        const backendBase = (api.defaults.baseURL || '').replace(/\/api\/?$/, '');
        const items = res.data.items.map(it => ({
          ...it,
          view_url_full: it.view_url ? `${backendBase}${it.view_url}` : null
        }));
        setPendingProofs(items);
      }
    } catch (e) {
      setMessage(e.response?.data?.message || 'Failed to load pending proofs');
    }
  };

  const reviewProof = async (proofId, action) => {
    setProofLoading(true);
    try {
      if (!proofId) throw new Error('Invalid proof id');
      await adminAPI.reviewProof(proofId, { action });
      setMessage(`Proof ${action}ed`);
      await fetchPendingProofs();
      // close modal if open
      setProofModal({ open: false, proof: null });
      await loadStudents();
    } catch (e) {
      console.error('reviewProof error', e);
      setMessage(e.response?.data?.message || e.message || 'Failed to review proof');
    } finally {
      setProofLoading(false);
    }
  };

  const deleteProof = async (proofId) => {
    if (!confirm('Delete this payment proof? This action is permanent.')) return;
    
    setProofLoading(true);
    try {
      if (!proofId) throw new Error('Invalid proof id');
      await adminAPI.deleteProof(proofId);
      setMessage('Payment proof deleted');
      await fetchPendingProofs();
      // close modal if open
      setProofModal({ open: false, proof: null });
      await loadStudents();
    } catch (e) {
      console.error('deleteProof error', e);
      setMessage(e.response?.data?.message || e.message || 'Failed to delete proof');
    } finally {
      setProofLoading(false);
    }
  };

  const loadStudents = async () => {
    try {
      const response = await adminAPI.getStudentsWithVerification();
      if (response.data && response.data.students) {
        // Only show active students in the admin list by default
        const activeStudents = response.data.students.filter(s => s.is_active !== false);
        setStudents(activeStudents);
      }
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to load students');
    }
  };

  const toggleVerification = async (studentId) => {
    try {
      const res = await adminAPI.toggleStudentVerification(studentId);
      setMessage(res.data.message || 'Verification status updated');
      await loadStudents(); // Refresh the list
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to update verification');
    }
  };

  const loadCreatedAdmins = async () => {
    try {
      const res = await adminAPI.getMyCreatedAdmins();
      if (res.data && res.data.admins) {
        setCreatedAdmins(res.data.admins);
      }
    } catch (err) {
      console.error('Failed to load created admins:', err);
    }
  };

  const handleDeleteAdmin = async (adminId) => {
    if (!adminId) return;
    try {
      const res = await adminAPI.deleteCreatedAdmin(adminId);
      setMessage(res.data.message || 'Admin deleted successfully');
      setAdminDeleteModal({ open: false, admin: null });
      await loadCreatedAdmins();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to delete admin');
    }
  };

  const openEditUser = async (userId) => {
    try {
      const res = await adminAPI.getUser(userId);
      if (res.data && res.data.user) {
        setEditModal({ open: true, user: res.data.user, loading: false });
      }
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to load user for edit');
    }
  };

  useEffect(() => {
    loadData();
    loadStudents();
    loadCreatedAdmins();
  }, []);

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      setSelectAll(false);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelected(new Set());
      setSelectAll(false);
    } else {
      const allIds = houses.map(h => h.id);
      setSelected(new Set(allIds));
      setSelectAll(true);
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) {
      setMessage('No houses selected');
      return;
    }
    if (!confirm(`Delete ${selected.size} houses? This is permanent.`)) return;

    try {
      for (let id of selected) {
        await adminAPI.deleteHouse(id);
      }
      setMessage('Selected houses deleted');
      setSelected(new Set());
      loadData();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to delete houses');
    }
  };

  const handleBulkEdit = async () => {
    if (selected.size === 0) { setMessage('No houses selected'); return; }
    // For simplicity open edit one-by-one in new tabs (or navigate to house detail)
    // Here we just navigate to the add/edit page for the first selected
    const first = Array.from(selected)[0];
    navigate(`/admin/areas-houses?edit=${first}`);
  };

  const handleUnassignOwner = async (houseId) => {
    if (!confirm('Unassign owner from this house? The house will remain unassigned.')) return;
    try {
      await adminAPI.unassignHouseOwner(houseId);
      setMessage('Owner unassigned');
      loadData();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to unassign owner');
    }
  };

  const handleDeleteHouse = async (house) => {
    // Fetch bookings first so admin can review them before deciding to proceed.
    try {
      const res = await adminAPI.getHouseBookings(house.id);
      const bookings = res.data?.bookings || [];

      if (!bookings || bookings.length === 0) {
        if (!confirm('Delete this house? This action is permanent.')) return;
        await adminAPI.deleteHouse(house.id);
        setMessage('House deleted');
        loadData();
        return;
      }

      // Show modal with booking details and option to proceed (force) or cancel
      setHouseDeleteModal({ open: true, house, message: `This house has ${bookings.length} booking(s). Review below before deleting.`, bookings });
    } catch (err) {
      // If fetching bookings failed, ask to delete anyway as fallback
      const fallback = confirm('Could not load bookings. Delete the house anyway? This is permanent.');
      if (!fallback) return;
      try {
        await adminAPI.deleteHouse(house.id);
        setMessage('House deleted');
        loadData();
      } catch (e) {
        setMessage(e.response?.data?.message || 'Failed to delete house');
      }
    }
  };

  const handleDeleteOwner = (owner) => {
    // Open modal to choose Deactivate vs Permanent delete
    setOwnerDeleteModal({ open: true, owner });
  };

  const confirmDeactivateOwner = async () => {
    const owner = ownerDeleteModal.owner;
    if (!owner) return;
    try {
      await adminAPI.deactivateUser(owner.id);
      setMessage('Owner deactivated');
      setOwnerDeleteModal({ open: false, owner: null });
      loadData();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to deactivate owner');
    }
  };

  const confirmPermanentDeleteOwner = async () => {
    const owner = ownerDeleteModal.owner;
    if (!owner) return;
    try {
      await adminAPI.deleteUser(owner.id);
      setMessage('Owner permanently deleted');
      setOwnerDeleteModal({ open: false, owner: null });
      loadData();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to permanently delete owner');
    }
  };

  const [ownerHousesModal, setOwnerHousesModal] = useState({ open: false, owner: null, houses: [] });
  const [houseDeleteModal, setHouseDeleteModal] = useState({ open: false, house: null, message: '', bookings: [] });
  const [editModal, setEditModal] = useState({ open: false, user: null, loading: false });

  const handleShowOwnerHouses = async (owner) => {
    try {
      const res = await adminAPI.getOwnerHouses(owner.id);
      setOwnerHousesModal({ open: true, owner, houses: res.data.houses || [] });
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to load owner houses');
    }
  };

  const handleDeleteStudent = (student) => {
    // Open confirmation modal with options: Deactivate (default) or Permanently delete
    setDeleteModal({ open: true, student });
  };

  const confirmDeactivate = async () => {
    const student = deleteModal.student;
    if (!student) return;
    try {
      await adminAPI.deleteStudent(student.student_record_id); // soft-delete
      setMessage('Student deactivated');
      setDeleteModal({ open: false, student: null });
      loadStudents();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to deactivate student');
    }
  };

  const confirmPermanentDelete = async () => {
    const student = deleteModal.student;
    if (!student) return;
    try {
      await adminAPI.deleteStudentForce(student.student_record_id); // force delete
      setMessage('Student permanently deleted');
      setDeleteModal({ open: false, student: null });
      loadStudents();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to permanently delete student');
    }
  };

  const showStudentDetails = (student) => {
    setSelectedStudent(prev => (prev && prev.student_record_id === student.student_record_id ? null : student));
  };

  return (
    <div className="min-h-screen house-pattern-bg relative">
      {/* Gradient overlay */}
      <div className="gradient-overlay"></div>
      {/* Payment Proofs Modal */}
      {pendingProofs && pendingProofs.length > 0 && (
        <div className={`fixed inset-0 z-50 ${proofModal.open ? '' : 'pointer-events-none'}`} aria-hidden={!proofModal.open}>
          {/* We'll show a simple floating panel when proofModal.open is true. */}
        </div>
      )}

      {proofModal.open && proofModal.proof && (
        <div className="fixed inset-0 flex items-center justify-center z-60">
          <div className="absolute inset-0 bg-black opacity-40" onClick={() => setProofModal({ open: false, proof: null })}></div>
          <div className="relative bg-white rounded-lg shadow-lg max-w-3xl w-full p-6">
            <h3 className="text-lg font-semibold">Review Payment Proof</h3>
            <div className="mt-3">
              <div className="text-sm text-gray-700 mb-2">Student: {proofModal.proof.student?.full_name || 'N/A'} — {proofModal.proof.student?.email || 'N/A'}</div>
              <div className="mb-4">
                <img src={proofModal.proof.view_url_full || proofModal.proof.view_url} alt="proof" className="max-h-96 object-contain border" />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const proofId = proofModal.proof?.proof?.id;
                    if (proofId) {
                      reviewProof(proofId, 'accept');
                    } else {
                      setMessage('Error: Could not determine proof ID');
                    }
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  disabled={proofLoading}
                >
                  {proofLoading ? 'Processing...' : 'Accept & Verify Student'}
                </button>
                <button
                  onClick={() => {
                    const proofId = proofModal.proof?.proof?.id;
                    if (proofId) {
                      reviewProof(proofId, 'reject');
                    } else {
                      setMessage('Error: Could not determine proof ID');
                    }
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  disabled={proofLoading}
                >
                  {proofLoading ? 'Processing...' : 'Reject (Invalid Proof)'}
                </button>
                <button
                  onClick={() => {
                    const proofId = proofModal.proof?.proof?.id;
                    if (proofId) {
                      deleteProof(proofId);
                    } else {
                      setMessage('Error: Could not determine proof ID');
                    }
                  }}
                  className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800"
                  disabled={proofLoading}
                >
                  {proofLoading ? 'Processing...' : 'Delete'}
                </button>
                <button onClick={() => setProofModal({ open: false, proof: null })} className="ml-auto px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}


      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {/* Header Section */}
        <div className="mb-8 text-center">
          <h1 className="text-5xl font-extrabold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent mb-2">
            👑 Admin Dashboard
          </h1>
          <p className="text-gray-600 text-lg">Manage properties, users, and payment verifications</p>
        </div>

        {/* Search Bar */}
        <div className="mb-6 glass rounded-xl p-4 shadow-lg border-2 border-blue-100">
          <div className="flex items-center space-x-3">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="🔍 Search houses, owners, students..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="input w-full"
              />
            </div>
            <button onClick={() => setSearchQuery('')} className="btn btn-secondary">
              ✕ Clear
            </button>
          </div>
        </div>

        {/* Action Cards */}
        <div className="glass rounded-2xl shadow-xl border-2 border-blue-100 p-6 mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Quick Actions</h2>
              <p className="text-gray-600 text-sm mt-1">Manage your system efficiently</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => navigate('/admin/areas-houses')}
                className="btn btn-primary inline-flex items-center gap-2"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Add House</span>
              </button>
              <button
                onClick={() => { fetchPendingProofs(); }}
                className="btn btn-secondary inline-flex items-center gap-2"
              >
                <span>💳</span>
                <span>Payment Proofs</span>
              </button>
              <button
                onClick={loadData}
                className="btn btn-secondary inline-flex items-center gap-2"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <div className="text-blue-600 text-sm font-medium">Total Houses</div>
              <div className="mt-1 text-2xl font-semibold text-blue-800">{houses.length}</div>
            </div>
            <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
              <div className="text-indigo-600 text-sm font-medium">House Owners</div>
              <div className="mt-1 text-2xl font-semibold text-indigo-800">{users.length}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 border border-green-100">
              <div className="text-green-600 text-sm font-medium">Available Rooms</div>
              <div className="mt-1 text-2xl font-semibold text-green-800">
                {houses.reduce((acc, h) => acc + (h.available_rooms || 0), 0)}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">House Owners</h2>
          {filteredUsers.length === 0 ? (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="mt-2 text-gray-500">No house owners registered yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredUsers.map(u => (
                <div key={u.id} className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-semibold text-lg">
                          {u.full_name ? u.full_name[0].toUpperCase() : 'U'}
                        </div>
                        <div className="ml-4">
                          <h3 className="text-sm font-medium text-gray-900">{u.full_name || u.email}</h3>
                          <div className="mt-1 text-sm text-gray-500">
                            <div className="flex items-center">
                              <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              <a
                                href={`https://mail.google.com/mail/?view=cm&fs=1&to=${u.email}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                {u.email}
                              </a>
                            </div>
                            <div className="flex items-center mt-1">
                              <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                              </svg>
                              {u.house ? u.house.address : 'No house assigned'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="ml-4 flex items-center space-x-3">
                      {u.house && (
                        <button
                          onClick={() => handleUnassignOwner(u.house.id)}
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                        >
                          Unassign House
                        </button>
                      )}
                      <button
                        onClick={() => handleShowOwnerHouses(u)}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                      >
                        View Houses
                      </button>
                      <button
                        onClick={() => handleDeleteOwner(u)}
                        className="inline-flex items-center px-3 py-1.5 border border-red-300 shadow-sm text-sm font-medium rounded text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        Remove Owner
                      </button>
                      <button
                        onClick={() => openEditUser(u.id)}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <div className="mt-8">
          <section className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Pending Payment Proofs</h2>
              <div>
                <button onClick={fetchPendingProofs} className="px-3 py-1.5 bg-white border rounded">Refresh</button>
              </div>
            </div>
            {pendingProofs.length === 0 ? (
              <div className="text-sm text-gray-600">No pending proofs.</div>
            ) : (
              <div className="divide-y divide-gray-200">
                {pendingProofs.map(item => (
                  <div key={item.proof.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{item.student.full_name || item.student.email}</div>
                      <div className="text-xs text-gray-500">Uploaded: {new Date(item.proof.uploaded_at).toLocaleString()}</div>
                    </div>
                    <div className="flex gap-2">
                      <a href={item.view_url_full || item.view_url} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-white border rounded text-sm">View</a>
                      <button onClick={() => setProofModal({ open: true, proof: item })} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm">Review</button>
                      <button 
                        onClick={() => deleteProof(item.proof.id)} 
                        className="px-3 py-1.5 bg-red-600 text-white rounded text-sm"
                        title="Delete this payment proof"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Houses</h2>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleBulkEdit}
                disabled={selected.size === 0}
                className={`inline-flex items-center px-3 py-1.5 border shadow-sm text-sm font-medium rounded focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  selected.size === 0
                    ? 'border-gray-300 text-gray-400 bg-gray-50 cursor-not-allowed'
                    : 'border-orange-300 text-orange-700 bg-white hover:bg-orange-50 focus:ring-orange-500'
                }`}
              >
                <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Selected
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={selected.size === 0}
                className={`inline-flex items-center px-3 py-1.5 border shadow-sm text-sm font-medium rounded focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  selected.size === 0
                    ? 'border-gray-300 text-gray-400 bg-gray-50 cursor-not-allowed'
                    : 'border-red-300 text-red-700 bg-white hover:bg-red-50 focus:ring-red-500'
                }`}
              >
                <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete Selected
              </button>
            </div>
          </div>

          <div className="border-b border-gray-200 pb-4 mb-4">
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={toggleSelectAll}
                className="rounded border-gray-300 text-orange-600 shadow-sm focus:border-orange-300 focus:ring focus:ring-orange-200 focus:ring-opacity-50"
              />
              <span className="ml-2 text-sm text-gray-600">Select all houses</span>
            </label>
          </div>

          {filteredHouses.length === 0 ? (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <p className="mt-2 text-gray-500">No houses added yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredHouses.map(h => (
                <div key={h.id} className="py-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selected.has(h.id)}
                      onChange={() => toggleSelect(h.id)}
                      className="rounded border-gray-300 text-orange-600 shadow-sm focus:border-orange-300 focus:ring focus:ring-orange-200 focus:ring-opacity-50"
                    />
                    <div className="ml-4 flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">{h.house_number} {h.street_address}</h3>
                          <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                            <div className="flex items-center">
                              <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {h.residential_area?.name || h.residential_area_id}
                            </div>
                            <div className="flex items-center">
                              <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                              </svg>
                              {h.total_rooms || 0} Rooms
                            </div>
                            <div className="flex items-center">
                              <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              {h.owner ? (
                                h.owner.email ? (
                                  <a
                                    href={`https://mail.google.com/mail/?view=cm&fs=1&to=${h.owner.email}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline"
                                  >
                                    {h.owner.email}
                                  </a>
                                ) : 'owner'
                              ) : 'Unassigned'}
                            </div>
                          </div>
                        </div>
                        <div className="ml-4 flex items-center space-x-3">
                          <button
                            onClick={() => navigate(`/houses/${h.id}`)}
                            className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                          >
                            View Details
                          </button>
                          {h.owner && (
                            <button
                              onClick={() => handleUnassignOwner(h.id)}
                              className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                            >
                              Unassign Owner
                            </button>
                          )}
                          <button
                            onClick={async () => {
                              // Use centralized handler so we can surface a force-delete modal
                              await handleDeleteHouse(h);
                            }}
                            className="inline-flex items-center px-3 py-1.5 border border-red-300 shadow-sm text-sm font-medium rounded text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Students</h2>
          {filteredStudents.length === 0 ? (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="mt-2 text-gray-500">No students registered yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredStudents.map(student => (
                <div key={student.student_record_id} className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <button onClick={() => showStudentDetails(student)} className="text-left w-full">
                        <div className="flex items-center gap-3">
                          <h3 className="text-sm font-medium text-gray-900 underline">
                            {student.full_name || (
                              <a
                                href={`https://mail.google.com/mail/?view=cm&fs=1&to=${student.email}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                {student.email}
                              </a>
                            )}
                          </h3>
                          {/* Verification badges */}
                          <div className="flex gap-2">
                            {student.email_verified ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                ✓ Email
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                                ✗ Email
                              </span>
                            )}
                            {student.admin_verified ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                ✓ Admin
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                ⏳ Pending
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="mt-1 text-sm text-gray-500">
                          <a
                            href={`https://mail.google.com/mail/?view=cm&fs=1&to=${student.email}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {student.email}
                          </a>
                        </div>
                      </button>
                    </div>
                    <div className="ml-4 flex items-center space-x-3">
                      <button
                        onClick={() => toggleVerification(student.student_record_id)}
                        className={`inline-flex items-center px-3 py-1.5 border shadow-sm text-sm font-medium rounded focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                          student.admin_verified
                            ? 'border-yellow-300 text-yellow-700 bg-yellow-50 hover:bg-yellow-100 focus:ring-yellow-500'
                            : 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100 focus:ring-green-500'
                        }`}
                        title={student.admin_verified ? 'Mark as unverified' : 'Mark as verified'}
                      >
                        {student.admin_verified ? '✗ Unverify' : '✓ Verify'}
                      </button>
                      <button
                        onClick={() => handleDeleteStudent(student)}
                        className="inline-flex items-center px-3 py-1.5 border border-red-300 shadow-sm text-sm font-medium rounded text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => openEditUser(student.user_id)}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Edit
                      </button>
                    </div>
                  </div>

                  {selectedStudent && selectedStudent.student_record_id === student.student_record_id && (
                    <div className="mt-3 bg-gray-50 p-3 rounded">
                      <div className="text-sm text-gray-700">Student ID: {student.student_id || '—'}</div>
                      <div className="text-sm text-gray-700">Institution: {student.institution || '—'}</div>
                      <div className="text-sm text-gray-700">Phone: {student.phone_number || '—'}</div>
                      <div className="text-sm text-gray-700">Registered: {student.created_at ? new Date(student.created_at).toLocaleString() : '—'}</div>
                      <div className="text-sm text-gray-700">Email Verified: {student.email_verified ? `✓ ${student.email_verified_at ? new Date(student.email_verified_at).toLocaleString() : ''}` : '✗'}</div>
                      <div className="text-sm text-gray-700">Admin Verified: {student.admin_verified ? `✓ ${student.admin_verified_at ? new Date(student.admin_verified_at).toLocaleString() : ''}` : '✗'}</div>
                      <div className="text-sm text-gray-700">Active: {student.is_active ? 'Yes' : 'No'}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Residential Areas Section */}
      <div className="mt-8">
        <section className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Residential Areas</h2>
            <div>
              <button onClick={() => navigate('/admin/areas-houses')} className="px-3 py-1.5 bg-orange-600 text-white rounded">Manage Areas</button>
            </div>
          </div>

          {areas.length === 0 ? (
            <div className="text-sm text-gray-600">No residential areas added yet.</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {areas.map(a => (
                <div key={a.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{a.name}</div>
                    <div className="text-xs text-gray-500">{a.description || ''}</div>
                  </div>
                  <div>
                    <button onClick={async () => {
                      if (!confirm(`Delete area "${a.name}" and all its houses? This is permanent.`)) return;
                      try {
                        await adminAPI.deleteArea(a.id);
                        setMessage('Residential area deleted');
                        // refresh lists
                        loadData();
                      } catch (err) {
                        setMessage(err.response?.data?.message || 'Failed to delete area');
                      }
                    }} className="px-3 py-1.5 bg-red-600 text-white rounded">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Created Admins Section */}
      <div className="mt-8">
        <section className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">👥 Admins You Created</h2>
            <span className="text-sm text-gray-500">{createdAdmins.length} admin{createdAdmins.length !== 1 ? 's' : ''}</span>
          </div>

          {createdAdmins.length === 0 ? (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <p className="mt-2 text-gray-500">You haven't created any admins yet</p>
              <p className="mt-1 text-sm text-gray-400">Create admin accounts from the Create Admin form above</p>
            </div>
          ) : (
            <div className="space-y-4">
              {createdAdmins.map(admin => (
                <div key={admin.id} className="flex items-center justify-between p-4 border border-blue-100 rounded-lg bg-blue-50/30 hover:bg-blue-50 transition-colors">
                  <div className="flex items-center flex-1 min-w-0">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
                      {admin.full_name ? admin.full_name[0].toUpperCase() : 'A'}
                    </div>
                    <div className="ml-4 flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-gray-900">{admin.full_name}</h3>
                      <div className="mt-1 space-y-1">
                        <div className="flex items-center text-sm text-gray-600">
                          <svg className="h-4 w-4 mr-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          {admin.email}
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <svg className="h-4 w-4 mr-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          {admin.phone_number}
                        </div>
                        <div className="flex items-center text-xs text-gray-500">
                          <svg className="h-3.5 w-3.5 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Created: {new Date(admin.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setAdminDeleteModal({ open: true, admin })}
                    className="ml-4 inline-flex items-center px-4 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                    title="Delete this admin"
                  >
                    <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      </div>

      {/* House Delete confirmation modal (shows bookings and allows force delete) */}
      {houseDeleteModal.open && houseDeleteModal.house && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="absolute inset-0 bg-black opacity-40"></div>
          <div className="relative bg-white rounded-lg shadow-lg max-w-3xl w-full p-6">
            <h3 className="text-lg font-semibold">Delete house</h3>
            <p className="mt-2 text-sm text-gray-600">{houseDeleteModal.message || `This house may have bookings. Review them before proceeding.`}</p>

            <div className="mt-4 max-h-64 overflow-auto">
              {houseDeleteModal.bookings && houseDeleteModal.bookings.length > 0 ? (
                <div className="space-y-3">
                  {houseDeleteModal.bookings.map(b => (
                    <div key={b.id} className="p-3 border rounded bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-sm font-medium">Booking #{b.id} — {b.booking_type}</div>
                          <div className="text-xs text-gray-600">Date: {new Date(b.booking_date).toLocaleString()}</div>
                          {b.student && (
                            <div className="text-xs text-gray-700 mt-1">
                              Student: {b.student.name} —
                              {" "}
                              <a
                                href={`https://mail.google.com/mail/?view=cm&fs=1&to=${b.student.email}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                {b.student.email}
                              </a>
                              {" "}— {b.student.phone}
                            </div>
                          )}
                          {b.room && b.room.room_number && (
                            <div className="text-xs text-gray-600 mt-1">Room: {b.room.room_number}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-600">No bookings found for this house.</div>
              )}
            </div>

            <div className="mt-4 flex gap-3">
              <button
                onClick={async () => {
                  // Proceed with forced deletion
                  try {
                    await adminAPI.deleteHouse(houseDeleteModal.house.id, true);
                    setMessage('House permanently deleted');
                    setHouseDeleteModal({ open: false, house: null, message: '', bookings: [] });
                    loadData();
                  } catch (err) {
                    setMessage(err.response?.data?.message || 'Failed to permanently delete house');
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded shadow-sm"
              >
                Permanently delete (force)
              </button>
              <button
                onClick={() => setHouseDeleteModal({ open: false, house: null, message: '', bookings: [] })}
                className="ml-auto px-4 py-2 bg-gray-100 text-gray-800 rounded border"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message Display */}
      {message && (
        <div className="fixed top-6 right-6 z-50 max-w-md">
          <div className="bg-white rounded-lg shadow-lg border border-orange-200 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-orange-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-gray-800">{message}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Owner Houses Modal */}
      {ownerHousesModal.open && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="absolute inset-0 bg-black opacity-40"></div>
          <div className="relative bg-white rounded-lg shadow-lg max-w-2xl w-full p-6">
            <h3 className="text-lg font-semibold">Houses owned by {ownerHousesModal.owner.full_name}</h3>
            <div className="mt-4 space-y-3">
              {ownerHousesModal.houses.length === 0 ? (
                <div className="text-sm text-gray-600">This owner has no assigned houses.</div>
              ) : (
                ownerHousesModal.houses.map(h => (
                  <div key={h.id} className="p-3 border rounded">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{h.house_number} {h.street_address}</div>
                        <div className="text-sm text-gray-500">{h.residential_area}</div>
                      </div>
                      <div>
                        <button onClick={() => { navigate(`/houses/${h.id}`); setOwnerHousesModal({ open: false, owner: null, houses: [] }); }} className="btn btn-primary text-sm">View</button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 text-right">
              <button onClick={() => setOwnerHousesModal({ open: false, owner: null, houses: [] })} className="px-4 py-2 bg-gray-100 rounded">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteModal.open && deleteModal.student && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="absolute inset-0 bg-black opacity-40"></div>
          <div className="relative bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold">Delete student</h3>
            <p className="mt-2 text-sm text-gray-600">Choose how to remove <strong>{deleteModal.student.full_name || deleteModal.student.email}</strong> from the system.</p>

            <div className="mt-4 flex gap-3">
              <button
                onClick={confirmDeactivate}
                className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded shadow-sm border"
              >
                Deactivate (keep history)
              </button>
              <button
                onClick={confirmPermanentDelete}
                className="px-4 py-2 bg-red-600 text-white rounded shadow-sm"
              >
                Permanently delete (remove bookings)
              </button>
              <button
                onClick={() => setDeleteModal({ open: false, student: null })}
                className="ml-auto px-4 py-2 bg-gray-100 text-gray-800 rounded border"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Owner Delete confirmation modal */}
      {ownerDeleteModal.open && ownerDeleteModal.owner && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="absolute inset-0 bg-black opacity-40"></div>
          <div className="relative bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold">Remove owner</h3>
            <p className="mt-2 text-sm text-gray-600">Choose how to remove <strong>{ownerDeleteModal.owner.full_name || ownerDeleteModal.owner.email}</strong> from the system.</p>

            <div className="mt-4 flex gap-3">
              <button
                onClick={confirmDeactivateOwner}
                className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded shadow-sm border"
              >
                Deactivate (keep data)
              </button>
              <button
                onClick={confirmPermanentDeleteOwner}
                className="px-4 py-2 bg-red-600 text-white rounded shadow-sm"
              >
                Permanently delete (remove owner)
              </button>
              <button
                onClick={() => setOwnerDeleteModal({ open: false, owner: null })}
                className="ml-auto px-4 py-2 bg-gray-100 text-gray-800 rounded border"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Delete confirmation modal */}
      {adminDeleteModal.open && adminDeleteModal.admin && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="absolute inset-0 bg-black opacity-40"></div>
          <div className="relative bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Delete Admin</h3>
                <p className="mt-2 text-sm text-gray-600">
                  Are you sure you want to delete <strong>{adminDeleteModal.admin.full_name}</strong>? This action cannot be undone.
                </p>
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                  <p className="text-xs text-amber-800">
                    ⚠️ The admin account will be deactivated and they will no longer be able to access the system.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={() => setAdminDeleteModal({ open: false, admin: null })}
                className="px-4 py-2 bg-gray-100 text-gray-800 rounded-md border border-gray-300 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteAdmin(adminDeleteModal.admin.id)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors shadow-sm"
              >
                Delete Admin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editModal.open && editModal.user && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="absolute inset-0 bg-black opacity-40"></div>
          <div className="relative bg-white rounded-lg shadow-lg max-w-lg w-full p-6">
            <h3 className="text-lg font-semibold">Edit User</h3>
            <div className="mt-3 space-y-3">
              <div>
                <label className="text-sm font-medium">Full name</label>
                <input value={editModal.user.full_name || ''} onChange={e => setEditModal(prev => ({ ...prev, user: { ...prev.user, full_name: e.target.value } }))} className="input w-full" />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <input value={editModal.user.email || ''} onChange={e => setEditModal(prev => ({ ...prev, user: { ...prev.user, email: e.target.value } }))} className="input w-full" />
              </div>
              <div>
                <label className="text-sm font-medium">Phone</label>
                <input value={editModal.user.phone_number || ''} onChange={e => setEditModal(prev => ({ ...prev, user: { ...prev.user, phone_number: e.target.value } }))} className="input w-full" />
              </div>

              {editModal.user.user_type === 'student' && (
                <div>
                  <label className="text-sm font-medium">Student ID</label>
                  <input value={(editModal.user.student_profile && editModal.user.student_profile.student_id) || ''} onChange={e => setEditModal(prev => ({ ...prev, user: { ...prev.user, student_profile: { ...(prev.user.student_profile || {}), student_id: e.target.value } } }))} className="input w-full" />
                  <label className="text-sm font-medium mt-2">Institution</label>
                  <input value={(editModal.user.student_profile && editModal.user.student_profile.institution) || ''} onChange={e => setEditModal(prev => ({ ...prev, user: { ...prev.user, student_profile: { ...(prev.user.student_profile || {}), institution: e.target.value } } }))} className="input w-full" />
                </div>
              )}

              {editModal.user.user_type === 'house_owner' && (
                <div>
                  <label className="text-sm font-medium">Ecocash Number</label>
                  <input value={(editModal.user.owner_profile && editModal.user.owner_profile.ecocash_number) || ''} onChange={e => setEditModal(prev => ({ ...prev, user: { ...prev.user, owner_profile: { ...(prev.user.owner_profile || {}), ecocash_number: e.target.value } } }))} className="input w-full" />
                  <label className="text-sm font-medium mt-2">Bank Account</label>
                  <input value={(editModal.user.owner_profile && editModal.user.owner_profile.bank_account) || ''} onChange={e => setEditModal(prev => ({ ...prev, user: { ...prev.user, owner_profile: { ...(prev.user.owner_profile || {}), bank_account: e.target.value } } }))} className="input w-full" />
                </div>
              )}
              <div>
                <label className="text-sm font-medium">Set / Reset password (admin override)</label>
                <input type="password" value={editModal.user.admin_new_password || ''} onChange={e => setEditModal(prev => ({ ...prev, user: { ...prev.user, admin_new_password: e.target.value } }))} className="input w-full" placeholder="Leave blank to keep existing password" />
              </div>
            </div>

            <div className="mt-4 flex gap-3">
              <button onClick={async () => {
                try {
                  setEditModal(prev => ({ ...prev, loading: true }));
                  const payload = {
                    full_name: editModal.user.full_name,
                    email: editModal.user.email,
                    phone_number: editModal.user.phone_number
                  };
                  if (editModal.user.user_type === 'student') payload.student_profile = editModal.user.student_profile || {};
                  if (editModal.user.user_type === 'house_owner') payload.owner_profile = editModal.user.owner_profile || {};

                  await adminAPI.updateUser(editModal.user.id, payload);
                  // If admin provided a new password, call admin password override endpoint
                  if (editModal.user.admin_new_password) {
                    try {
                      await adminAPI.setUserPassword(editModal.user.id, { new_password: editModal.user.admin_new_password });
                    } catch (pwErr) {
                      // surface password error to admin
                      alert(pwErr.response?.data?.message || 'Failed to set new password');
                      setEditModal(prev => ({ ...prev, loading: false }));
                      return;
                    }
                  }
                  setEditModal({ open: false, user: null, loading: false });
                  // refresh lists
                  loadData();
                  loadStudents();
                } catch (err) {
                  alert(err.response?.data?.message || 'Failed to update user');
                  setEditModal(prev => ({ ...prev, loading: false }));
                }
              }} className="px-4 py-2 bg-blue-600 text-white rounded shadow-sm">Save</button>
              <button onClick={() => setEditModal({ open: false, user: null, loading: false })} className="ml-auto px-4 py-2 bg-gray-100 text-gray-800 rounded border">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
