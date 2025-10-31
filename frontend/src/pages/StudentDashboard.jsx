import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { bookingAPI, paymentProofAPI, authAPI, houseAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function StudentDashboard() {
  const [areas, setAreas] = useState([]);
  const [areasSorted, setAreasSorted] = useState([]);
  const [campus, setCampus] = useState('main'); // 'main' | 'telone' | 'batanai'
  const [selectedArea, setSelectedArea] = useState(null);
  const [withAccommodation, setWithAccommodation] = useState([]);
  const [full, setFull] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [myBookings, setMyBookings] = useState([]);
  const [myInquiries, setMyInquiries] = useState([]);
  const [sortByClosest, setSortByClosest] = useState(true);
  const { isAuthenticated, isStudent, user } = useAuth();
  const navigate = useNavigate();
  
  // Check if student is verified
  const isVerified = user && user.admin_verified;
  const expiresAt = user && user.admin_verified_expires_at ? new Date(user.admin_verified_expires_at) : null;
  const daysRemaining = expiresAt ? Math.ceil((expiresAt - new Date()) / (1000 * 60 * 60 * 24)) : null;

  useEffect(() => {
    // Fetch areas for all students (verified or not) so they can see what's available
    const fetchAreas = async () => {
      setLoading(true);
      try {
        const res = await houseAPI.getAreas();
        const arr = res.data.areas || [];
        setAreas(arr);
        // default sorted closest-first using current campus (main initially)
        const getD = (a) => {
          if (campus === 'main') return (typeof a.approximate_distance_km === 'number') ? a.approximate_distance_km : a.computed_distance_main_km ?? a.computed_distance_km ?? null;
          if (campus === 'telone') return a.computed_distance_telone_km ?? null;
          if (campus === 'batanai') return a.computed_distance_batanai_km ?? null;
          return null;
        };
        const list = [...arr].sort((a,b) => {
          const da = getD(a); const db = getD(b);
          if (da == null && db == null) return 0; if (da == null) return 1; if (db == null) return -1; return da - db;
        });
        setAreasSorted(list);
      } catch (e) {
        setMessage('Failed to load residential areas');
      } finally {
        setLoading(false);
      }
    };
    fetchAreas();
  }, [campus]);

  useEffect(() => {
    if (!areas || areas.length === 0) { setAreasSorted([]); return; }
    const getD = (a) => {
      if (campus === 'main') return (typeof a.approximate_distance_km === 'number') ? a.approximate_distance_km : a.computed_distance_main_km ?? a.computed_distance_km ?? null;
      if (campus === 'telone') return a.computed_distance_telone_km ?? null;
      if (campus === 'batanai') return a.computed_distance_batanai_km ?? null;
      return null;
    };
    const list = [...areas].sort((a,b) => {
      const da = getD(a); const db = getD(b);
      if (da == null && db == null) return 0; if (da == null) return 1; if (db == null) return -1; return da - db;
    });
    setAreasSorted(sortByClosest ? list : list.reverse());
  }, [areas, sortByClosest, campus]);

  useEffect(() => {
    // Allow viewing houses even if not verified, but block booking actions
    if (!selectedArea) return;
    const fetchHouses = async () => {
      try {
        const res = await houseAPI.getByArea(selectedArea.id);
        setWithAccommodation(res.data.houses_with_accommodation || []);
        setFull(res.data.houses_full || []);
      } catch (e) {
        setMessage('Failed to load houses for area');
      }
    };
    fetchHouses();
  }, [selectedArea]);

  // Load student's own bookings and inquiries - only for verified students
  useEffect(() => {
    const loadMine = async () => {
      if (!isAuthenticated || !isStudent || !isVerified) return;
      try {
        const [bRes, iRes] = await Promise.all([
          bookingAPI.myBookings(),
          bookingAPI.myInquiries(),
        ]);
        setMyBookings(bRes.data.bookings || []);
        setMyInquiries(iRes.data.inquiries || []);
      } catch (e) {
        // don't spam message if browsing is also loading
      }
    };
    loadMine();
  }, [isAuthenticated, isStudent, isVerified]);

  const cancelBooking = async (b) => {
    if (!confirm('Cancel this booking?')) return;
    try {
      await bookingAPI.cancelBooking(b.id, 'Cancelled by student');
      setMessage('Booking cancelled');
      const r = await bookingAPI.myBookings();
      setMyBookings(r.data.bookings || []);
    } catch (e) {
      setMessage(e.response?.data?.message || 'Failed to cancel booking');
    }
  };

  const cancelInquiry = async (iq) => {
    if (!confirm('Cancel this inquiry?')) return;
    try {
      await bookingAPI.cancelInquiry(iq.id);
      setMessage('Inquiry cancelled');
      const r = await bookingAPI.myInquiries();
      setMyInquiries(r.data.inquiries || []);
    } catch (e) {
      setMessage(e.response?.data?.message || 'Failed to cancel inquiry');
    }
  };

  return (
    <div className="min-h-screen house-pattern-bg relative">
      {/* Gradient overlay */}
      <div className="gradient-overlay"></div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {/* Welcome Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent mb-2">
            🎓 Student Dashboard
          </h1>
          <p className="text-gray-600">Welcome back! Browse available accommodations and manage your bookings</p>
        </div>

        {/* Verification Status Banner */}
        {!isVerified && (
          <div className="mb-6 glass border-l-4 border-yellow-400 p-6 rounded-r-xl shadow-xl">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-4 flex-1">
                <h3 className="text-xl font-bold text-yellow-800">⏳ Waiting for Verification</h3>
                <div className="mt-2 text-sm text-yellow-700 space-y-2">
                  <p className="font-semibold">Your account is pending admin verification.</p>
                  <p>To gain full access to browse houses and make bookings, please:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Upload your proof of payment below ($5 subscription fee)</li>
                    <li>Wait for admin approval (usually within 24 hours)</li>
                  </ol>
                  <p className="mt-3 font-medium">Until verified, you can only upload proof of payment. Areas and houses are locked.</p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Verification Expiry Warning */}
        {isVerified && daysRemaining !== null && daysRemaining <= 7 && (
          <div className={`mb-6 glass border-l-4 p-6 rounded-r-xl shadow-xl ${
            daysRemaining <= 3 
              ? 'border-red-400' 
              : 'border-orange-400'
          }`}>
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className={`h-8 w-8 ${daysRemaining <= 3 ? 'text-red-500' : 'text-orange-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className={`text-xl font-bold ${daysRemaining <= 3 ? 'text-red-800' : 'text-orange-800'}`}>
                  {daysRemaining <= 3 ? '⚠️ Verification Expiring Soon!' : '⏰ Verification Renewal Reminder'}
                </h3>
                <div className={`mt-2 text-sm ${daysRemaining <= 3 ? 'text-red-700' : 'text-orange-700'}`}>
                  <p className="font-semibold">Your verification expires in {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}.</p>
                  <p className="mt-1">Upload a new proof of payment to renew your subscription for another 30 days.</p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Subscription Active Info - Show when verified and more than 7 days remaining */}
        {isVerified && daysRemaining !== null && daysRemaining > 7 && (
          <div className="mb-6 glass border-l-4 border-green-400 p-6 rounded-r-xl shadow-xl">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-xl font-bold text-green-800">✅ Subscription Active</h3>
                <div className="mt-2 text-sm text-green-700">
                  <p className="font-semibold">Your verification is active for {daysRemaining} more {daysRemaining === 1 ? 'day' : 'days'}.</p>
                  <p className="mt-1">Your subscription will automatically expire after 30 days from verification. Upload a new proof of payment to renew when needed.</p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div className="flex flex-col lg:flex-row gap-8">
          <aside className="lg:w-80">
            <div className="sticky top-8 glass rounded-xl shadow-xl border-2 border-blue-100 overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600">
                <h3 className="font-bold text-white text-lg flex items-center gap-2">
                  <span>🏘️</span>
                  Residential Areas
                </h3>
              </div>
              <div className="p-4">
                <div className="mb-4">
                  <div className="text-gray-700 mb-2 font-semibold text-sm">📍 Campus Location</div>
                  <div className="inline-flex border-2 border-blue-200 rounded-lg overflow-hidden">
                    <button className={`px-3 py-2 text-sm font-medium transition-all ${campus==='main'?'bg-gradient-to-r from-blue-600 to-indigo-600 text-white':'bg-white text-gray-700 hover:bg-blue-50'}`} onClick={()=>setCampus('main')}>Main</button>
                    <button className={`px-3 py-2 text-sm font-medium transition-all ${campus==='telone'?'bg-gradient-to-r from-blue-600 to-indigo-600 text-white':'bg-white text-gray-700 hover:bg-blue-50'}`} onClick={()=>setCampus('telone')}>TelOne</button>
                    <button className={`px-3 py-2 text-sm font-medium transition-all ${campus==='batanai'?'bg-gradient-to-r from-blue-600 to-indigo-600 text-white':'bg-white text-gray-700 hover:bg-blue-50'}`} onClick={()=>setCampus('batanai')}>Batanai</button>
                  </div>
                </div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-gray-700 font-semibold text-sm">🔃 Sort Order</span>
                  <div className="inline-flex border-2 border-blue-200 rounded-lg overflow-hidden">
                    <button
                      className={`px-3 py-1 text-sm font-medium transition-all ${sortByClosest ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-blue-50'}`}
                      onClick={() => setSortByClosest(true)}
                      title="Closest first"
                    >Closest</button>
                    <button
                      className={`px-3 py-1 text-sm font-medium transition-all ${!sortByClosest ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-blue-50'}`}
                      onClick={() => setSortByClosest(false)}
                      title="Furthest first"
                    >Furthest</button>
                  </div>
                </div>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {areasSorted.map(a => (
                      <button
                        key={a.id}
                        disabled={!isVerified}
                        className={`w-full text-left p-3 rounded-lg transition-all duration-200 ${
                          !isVerified 
                            ? 'opacity-60 cursor-not-allowed bg-gray-50'
                            : selectedArea?.id === a.id
                            ? 'bg-blue-50 border border-blue-200 shadow-sm'
                            : 'hover:bg-blue-50'
                        }`}
                        onClick={() => isVerified && setSelectedArea(a)}
                        title={!isVerified ? 'Verify your account to browse houses' : ''}
                      >
                        {!isVerified && (
                          <div className="flex items-center gap-1 mb-1">
                            <svg className="h-3 w-3 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                            <span className="text-xs text-gray-500">Locked</span>
                          </div>
                        )}
                        <div className="font-medium text-gray-900">{a.name}</div>
                        <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                          <div>Main: {(() => {
                            const d = typeof a.approximate_distance_km === 'number' ? a.approximate_distance_km : (a.computed_distance_main_km ?? a.computed_distance_km);
                            return typeof d === 'number' ? `${d} km` : '—';
                          })()}</div>
                          <div>TelOne: {typeof a.computed_distance_telone_km === 'number' ? `${a.computed_distance_telone_km} km` : '—'}</div>
                          <div>Batanai: {typeof a.computed_distance_batanai_km === 'number' ? `${a.computed_distance_batanai_km} km` : '—'}</div>
                        </div>
                        <div className="text-sm text-blue-600">
                          {a.active_house_count} {a.active_house_count === 1 ? 'house' : 'houses'} available
                        </div>
                      </button>
                    ))}
                    {areas.length === 0 && (
                      <div className="text-sm text-gray-500 py-4 text-center">
                        No residential areas available yet.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </aside>

          <main className="flex-1">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-md p-6 mb-6 text-white">
              <h1 className="text-3xl font-bold">Welcome to Easy Accommodation</h1>
              <p className="mt-2 text-blue-100">
                Find your perfect student accommodation by exploring our available houses in different residential areas.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <div className="text-2xl font-bold">{areas.length}</div>
                  <div className="text-blue-100">Residential Areas</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <div className="text-2xl font-bold">{withAccommodation.length}</div>
                  <div className="text-blue-100">Houses Available</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <div className="text-2xl font-bold">
                    {withAccommodation.reduce((acc, house) => acc + (house.available_rooms || 0), 0)}
                  </div>
                  <div className="text-blue-100">Total Rooms Available</div>
                </div>
              </div>
            </div>

            {!selectedArea ? (
              <div className="bg-white rounded-xl shadow-md border border-gray-100 p-8">
                <div className="max-w-2xl mx-auto text-center">
                  <div className="text-5xl mb-4">🏠</div>
                  <div className="text-gray-900 text-xl font-medium mb-2">
                    Find Your Perfect Student Housing
                  </div>
                  <div className="text-gray-500">
                    Select a residential area from the left to explore available houses in that location.
                    Each area offers different options to suit your needs.
                  </div>
                  <div className="mt-6 grid grid-cols-3 gap-4 text-center">
                    {areasSorted.map((area, index) => (
                      <button
                        key={area.id}
                        disabled={!isVerified}
                        className={`p-4 rounded-lg border border-blue-100 transition-all duration-200 ${!isVerified ? 'opacity-60 cursor-not-allowed' : 'hover:border-blue-300 hover:bg-blue-50'}`}
                        onClick={() => isVerified && setSelectedArea(area)}
                        title={!isVerified ? 'Verify your account to view area details' : ''}
                      >
                        <div className="font-medium text-gray-900 flex items-center justify-center gap-1">
                          {area.name} {!isVerified && <span className="text-xs">🔒</span>}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          <span>Main: {(() => { const d = typeof area.approximate_distance_km === 'number' ? area.approximate_distance_km : (area.computed_distance_main_km ?? area.computed_distance_km); return typeof d === 'number' ? `${d} km` : '—'; })()}</span>
                          {' • '}<span>TelOne: {typeof area.computed_distance_telone_km === 'number' ? `${area.computed_distance_telone_km} km` : '—'}</span>
                          {' • '}<span>Batanai: {typeof area.computed_distance_batanai_km === 'number' ? `${area.computed_distance_batanai_km} km` : '—'}</span>
                        </div>
                        <div className="text-sm text-blue-600">
                          {area.active_house_count} houses
                        </div>
                      </button>
                    )).slice(0, 3)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-semibold text-gray-900">
                        Houses in {selectedArea.name}
                      </h2>
                      <p className="text-gray-500 mt-1">
                        {withAccommodation.length + full.length} total houses • {withAccommodation.length} with availability
                      </p>
                      <div className="text-xs text-gray-600 mt-1">
                        Distances — Main: {(() => { const d = typeof selectedArea.approximate_distance_km === 'number' ? selectedArea.approximate_distance_km : (selectedArea.computed_distance_main_km ?? selectedArea.computed_distance_km); return typeof d === 'number' ? `${d} km` : '—'; })()} · TelOne: {typeof selectedArea.computed_distance_telone_km === 'number' ? `${selectedArea.computed_distance_telone_km} km` : '—'} · Batanai: {typeof selectedArea.computed_distance_batanai_km === 'number' ? `${selectedArea.computed_distance_batanai_km} km` : '—'}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                        onClick={() => setSelectedArea(null)}
                      >
                        ← Back to Areas
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg text-gray-900 pb-2 border-b">
                        Available Accommodation
                      </h3>
                      <div className="space-y-4">
                        {withAccommodation.map(h => (
                          <div key={h.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-medium text-gray-900">{h.house_number} {h.street_address}</div>
                                <div className="mt-1 text-sm text-gray-600">
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    {h.available_rooms} rooms available
                                  </span>
                                  <span className="ml-2">Total: {h.total_rooms} rooms</span>
                                </div>
                              </div>
                              <button 
                                disabled={!isVerified}
                                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${!isVerified ? 'bg-gray-400 cursor-not-allowed opacity-60' : 'bg-blue-600 hover:bg-blue-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                                onClick={() => isVerified && navigate(`/houses/${h.id}`)}
                                title={!isVerified ? 'Verify your account to view details' : ''}
                              >
                                View Details {!isVerified && '🔒'}
                              </button>
                            </div>
                          </div>
                        ))}
                        {withAccommodation.length === 0 && (
                          <div className="text-center py-8 text-gray-500">
                            No houses available in this area at the moment.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg text-gray-900 pb-2 border-b">
                        Full Houses
                      </h3>
                      <div className="space-y-4">
                        {full.map(h => (
                          <div key={h.id} className="bg-gray-50 rounded-lg shadow-sm border border-gray-200 p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-medium text-gray-700">{h.house_number} {h.street_address}</div>
                                <div className="mt-1">
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                    Currently Full
                                  </span>
                                </div>
                              </div>
                              <button 
                                disabled={!isVerified}
                                className={`inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 ${!isVerified ? 'bg-gray-100 cursor-not-allowed opacity-60' : 'bg-white hover:bg-gray-50'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                                onClick={() => isVerified && navigate(`/houses/${h.id}`)}
                                title={!isVerified ? 'Verify your account to view details' : ''}
                              >
                                View Details {!isVerified && '🔒'}
                              </button>
                            </div>
                          </div>
                        ))}
                        {full.length === 0 && (
                          <div className="text-center py-8 text-gray-500">
                            No full houses in this area.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
          )}

          {/* My Activity: show student's own bookings & inquiries */}
          {isAuthenticated && isStudent && (
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Payment proof upload card */}
              <section className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">Subscription — Upload Proof of Payment</h2>
                </div>
                <div className="text-sm text-gray-700 mb-3">
                  A subscription to access the app is $5. Please pay via Ecocash to <strong>0787690803 (Benam Magomo)</strong> or
                  bank account <strong>263787690803840</strong>. After payment, upload a photo or screenshot of the payment here and the admin will review it.
                </div>
                <div className="flex items-center gap-3">
                  <input type="file" id="proofFile" className="" />
                  <button className="btn btn-primary" onClick={async () => {
                    const input = document.getElementById('proofFile');
                    if (!input || !input.files || input.files.length === 0) return setMessage('Select a file to upload');
                    const f = input.files[0];
                    const fd = new FormData();
                    fd.append('proof', f);
                    try {
                      const res = await paymentProofAPI.uploadProof(fd);
                      setMessage('Proof uploaded — awaiting admin review');
                    } catch (e) {
                      setMessage(e.response?.data?.message || 'Upload failed');
                    }
                  }}>Upload</button>
                </div>
              </section>
              <section className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">My Bookings</h2>
                  <button
                    onClick={async () => {
                      try {
                        const r = await bookingAPI.myBookings();
                        setMyBookings(r.data.bookings || []);
                      } catch {}
                    }}
                    className="text-sm px-3 py-1.5 border rounded bg-white hover:bg-gray-50"
                  >
                    Refresh
                  </button>
                </div>
                {myBookings.length === 0 ? (
                  <div className="text-sm text-gray-600">No bookings yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">House</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Room</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Type</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Owner Response</th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {myBookings.map(b => (
                          <tr key={b.id}>
                            <td className="px-3 py-2 text-sm text-gray-700">
                              <button className="underline" onClick={() => navigate(`/houses/${b.house?.id}`)}>
                                {b.house?.address}
                              </button>
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-700">{b.room?.room_number}</td>
                            <td className="px-3 py-2 text-sm text-gray-700">{b.booking_type}</td>
                            <td className="px-3 py-2 text-sm text-gray-700">{new Date(b.booking_date).toLocaleString()}</td>
                            <td className="px-3 py-2 text-sm">
                              {b.is_paid ? (
                                <span className="text-green-700">Paid</span>
                              ) : b.booking_type === 'cancelled' ? (
                                <span className="text-gray-600">Cancelled</span>
                              ) : b.booking_type === 'reserved' ? (
                                <span className="text-yellow-700">Reserved{typeof b.days_until_expiry === 'number' ? ` (${b.days_until_expiry}d)` : ''}</span>
                              ) : (
                                b.booking_type
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {!b.is_paid && b.booking_type !== 'cancelled' && (
                                <button className="text-sm px-3 py-1.5 border rounded bg-white hover:bg-gray-50" onClick={() => cancelBooking(b)}>Cancel</button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">My Inquiries</h2>
                  <button
                    onClick={async () => {
                      try {
                        const r = await bookingAPI.myInquiries();
                        setMyInquiries(r.data.inquiries || []);
                      } catch {}
                    }}
                    className="text-sm px-3 py-1.5 border rounded bg-white hover:bg-gray-50"
                  >
                    Refresh
                  </button>
                </div>
                {myInquiries.length === 0 ? (
                  <div className="text-sm text-gray-600">No inquiries sent yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">House</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Subject</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {myInquiries.map(iq => (
                          <tr key={iq.id}>
                            <td className="px-3 py-2 text-sm text-gray-700">
                              <button className="underline" onClick={() => navigate(`/houses/${iq.house_id}`)}>
                                {iq.house_address}
                              </button>
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-700">{iq.subject}</td>
                            <td className="px-3 py-2 text-sm">
                              {iq.status === 'verified' ? (
                                <span className="text-green-700">Verified</span>
                              ) : iq.status === 'cancelled' ? (
                                <span className="text-gray-600">Cancelled</span>
                              ) : (
                                <span className="text-yellow-700">Pending</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-700">{iq.response ? iq.response : '—'}</td>
                            <td className="px-3 py-2 text-sm text-gray-700">{new Date(iq.created_at).toLocaleString()}</td>
                            <td className="px-3 py-2 text-right">
                              {iq.status !== 'cancelled' && (
                                <button className="text-sm px-3 py-1.5 border rounded bg-white hover:bg-gray-50" onClick={() => cancelInquiry(iq)}>Cancel</button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          )}
          </main>
        </div>
        {message && (
          <div className="fixed top-6 right-6 z-50 max-w-md bg-white rounded-lg shadow-lg border border-yellow-200 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-800">{message}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
