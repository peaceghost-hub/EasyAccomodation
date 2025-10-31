import React, { useEffect, useState } from 'react';
import api, { ownerAPI, ownerUpload } from '../services/api';
import axios from 'axios';
import ActionMenu from '../components/common/ActionMenu';

// include is_occupied by default for new rooms
const emptyRoom = () => ({ room_number: '', capacity: 1, price_per_month: 0, is_available: true, is_occupied: false });

export default function OwnerHouseEdit() {
  const [house, setHouse] = useState(null);
  const [message, setMessage] = useState('');
  const [description, setDescription] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [isTiled, setIsTiled] = useState(false);
  const [hasSolar, setHasSolar] = useState(false);
  const [hasJojo, setHasJojo] = useState(false);
  const [roomsState, setRoomsState] = useState([]);
  const [ecocashNumber, setEcocashNumber] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [otherPaymentInfo, setOtherPaymentInfo] = useState('');
  const [bookings, setBookings] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [actionMessage, setActionMessage] = useState('');
  const [lightboxImage, setLightboxImage] = useState(null);
  const [uploadingSlot, setUploadingSlot] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await ownerAPI.getMyHouse();
        // Normalize image URLs to full backend paths
        const h = res.data.house;
        try {
          const backendBase = (api.defaults.baseURL || '').replace(/\/?api\/?$/, '');
          if (h && Array.isArray(h.images)) {
            h.images = h.images.map(img => (img && (img.startsWith('http') || img.startsWith('data:')) ? img : `${backendBase}${img.startsWith('/') ? img : '/' + img}`));
          }
        } catch (e) {
          // ignore mapping errors
        }
        setHouse(h);
        if (res.data.house) {
          setDescription(res.data.house.description || '');
          if (typeof res.data.house.latitude !== 'undefined') setLatitude(String(res.data.house.latitude));
          if (typeof res.data.house.longitude !== 'undefined') setLongitude(String(res.data.house.longitude));
          setIsTiled(!!res.data.house.is_tiled);
          setHasSolar(!!res.data.house.has_solar);
          setHasJojo(!!res.data.house.has_jojo_tank);
          setRoomsState(res.data.house.rooms || []);
          // fetch owner payment info
          if (res.data.house.owner) {
            const ownerInfo = res.data.house.owner.owner_info || {};
            setEcocashNumber(ownerInfo.ecocash_number || '');
            setBankAccount(ownerInfo.bank_account || '');
            setOtherPaymentInfo(ownerInfo.other_payment_info || '');
          }
        }
      } catch (e) {
        setMessage('Failed to load house');
      }
    };
    fetch();
    // load bookings and inquiries for this owner
    const loadOwnerBookings = async () => {
      try {
        const r = await ownerAPI.getMyHouseBookings();
        if (r.data && r.data.bookings) setBookings(r.data.bookings || []);
        if (r.data && r.data.inquiries) setInquiries(r.data.inquiries || []);
      } catch (e) {
        // non-fatal
      }
    };
    loadOwnerBookings();
  }, []);

  const handleFileChange = (e) => setFiles(Array.from(e.target.files || []));

  const uploadImageToSlot = async (slotIndex, file) => {
    if (!file) return;
    
    // Check if we already have 3 images
    const currentImages = house.images || [];
    if (currentImages.length >= 3 && slotIndex >= currentImages.length) {
      setMessage('Maximum of 3 images allowed');
      return;
    }

    setUploadingSlot(slotIndex);
    const formData = new FormData();
    formData.append('images', file);
    
    try {
      const res = await ownerUpload.uploadHouseImages(formData);
      setMessage('Image uploaded successfully');
      
      // Reload house data
      const r2 = await ownerAPI.getMyHouse();
      const h2 = r2.data.house;
      try {
        const backendBase = (api.defaults.baseURL || '').replace(/\/?api\/?$/, '');
        if (h2 && Array.isArray(h2.images)) {
          h2.images = h2.images.map(img => (img && (img.startsWith('http') || img.startsWith('data:')) ? img : `${backendBase}${img.startsWith('/') ? img : '/' + img}`));
        }
      } catch (e) {
        // ignore
      }
      setHouse(h2);
    } catch (e) {
      setMessage(e.response?.data?.message || 'Upload failed');
    } finally {
      setUploadingSlot(null);
    }
  };

  const deleteImage = async (imageUrl) => {
    if (!confirm('Delete this image?')) return;
    
    try {
      // Extract filename from URL
      const filename = imageUrl.split('/').pop();
      await ownerAPI.deleteHouseImage(filename);
      setMessage('Image deleted successfully');
      
      // Reload house data
      const r2 = await ownerAPI.getMyHouse();
      const h2 = r2.data.house;
      try {
        const backendBase = (api.defaults.baseURL || '').replace(/\/?api\/?$/, '');
        if (h2 && Array.isArray(h2.images)) {
          h2.images = h2.images.map(img => (img && (img.startsWith('http') || img.startsWith('data:')) ? img : `${backendBase}${img.startsWith('/') ? img : '/' + img}`));
        }
      } catch (e) {
        // ignore
      }
      setHouse(h2);
    } catch (e) {
      setMessage(e.response?.data?.message || 'Delete failed');
    }
  };

  const addRoom = () => {
    setRoomsState(prev => [...prev, emptyRoom()]);
  };

  const updateRoom = (index, field, value) => {
    setRoomsState(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const removeRoom = (index) => {
    setRoomsState(prev => prev.filter((_, i) => i !== index));
  };

  const saveHouse = async () => {
    try {
      const payload = {
        description,
        latitude: latitude === '' ? undefined : Number(latitude),
        longitude: longitude === '' ? undefined : Number(longitude),
        is_tiled: isTiled,
        has_solar: hasSolar,
        has_jojo_tank: hasJojo,
        rooms: roomsState
      };
      const res = await ownerAPI.updateMyHouse(payload);
      setMessage(res.data?.message || 'House updated');

      // update payment methods
      await ownerAPI.updatePaymentMethods({ ecocash_number: ecocashNumber, bank_account: bankAccount, other_payment_info: otherPaymentInfo });
      setMessage('House and payment methods updated');
      const r2 = await ownerAPI.getMyHouse();
      setHouse(r2.data.house);
    } catch (e) {
      setMessage(e.response?.data?.message || 'Save failed');
    }
  };

  if (!house) return <div className="p-6">No house assigned or loading...</div>;

  const refreshInquiries = async () => {
    try {
      const r = await ownerAPI.getMyHouseBookings();
      if (r.data && r.data.inquiries) setInquiries(r.data.inquiries || []);
    } catch {}
  };

  const verifyInquiry = async (iq) => {
    const response = prompt('Optional message to student (will be saved with verification):');
    try {
      await ownerAPI.verifyInquiry(iq.id, response);
      setActionMessage('Inquiry verified');
      refreshInquiries();
    } catch (e) {
      setActionMessage(e.response?.data?.message || 'Failed to verify inquiry');
    }
  };

  const cancelInquiry = async (iq) => {
    if (!confirm('Cancel this inquiry?')) return;
    try {
      await ownerAPI.cancelInquiry(iq.id);
      setActionMessage('Inquiry cancelled');
      refreshInquiries();
    } catch (e) {
      setActionMessage(e.response?.data?.message || 'Failed to cancel inquiry');
    }
  };

  const deleteInquiry = async (iq) => {
    if (!confirm('Delete this inquiry permanently?')) return;
    try {
      await ownerAPI.deleteInquiry(iq.id);
      setActionMessage('Inquiry deleted');
      refreshInquiries();
    } catch (e) {
      setActionMessage(e.response?.data?.message || 'Failed to delete inquiry');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-100 house-pattern-bg">
      <div className="max-w-6xl mx-auto p-6">
        <div className="glass rounded-2xl shadow-xl p-8 mb-6">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
            Edit My House
          </h2>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="font-medium text-gray-800 text-lg">
              {house.house_number} {house.street_address}
            </div>
            {house.is_full ? (
              <div className="inline-block px-3 py-1 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-full text-sm font-semibold shadow-md">
                House Full
              </div>
            ) : (
              <div className="inline-block px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full text-sm font-semibold shadow-md">
                {house.available_rooms} available
              </div>
            )}
            <div className="text-sm text-gray-600 bg-white px-3 py-1 rounded-full shadow-sm">
              ({house.occupied_rooms}/{house.total_rooms} occupied)
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg px-3 py-1 mr-2">📝</span>
              House Details
            </h3>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea 
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all" 
              rows={4} 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
            />

            <textarea 
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all" 
              rows={4} 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
            />

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Latitude</label>
                <input
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  placeholder="e.g., -19.475672"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                />
                <div className="text-xs text-gray-500 mt-1">Range: -90 to 90</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Longitude</label>
                <input
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  placeholder="e.g., 29.814875"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                />
                <div className="text-xs text-gray-500 mt-1">Range: -180 to 180</div>
              </div>
            </div>

            <div className="mt-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                <span className="text-blue-600 mr-2">✨</span>
                Amenities
              </h4>
              <label className="flex items-center mb-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={isTiled} 
                  onChange={e => setIsTiled(e.target.checked)} 
                  className="mr-3 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500" 
                />
                <span className="text-gray-700 group-hover:text-blue-600 transition-colors">Tiled</span>
              </label>
              <label className="flex items-center mb-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={hasSolar} 
                  onChange={e => setHasSolar(e.target.checked)} 
                  className="mr-3 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500" 
                />
                <span className="text-gray-700 group-hover:text-blue-600 transition-colors">Solar</span>
              </label>
              <label className="flex items-center cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={hasJojo} 
                  onChange={e => setHasJojo(e.target.checked)} 
                  className="mr-3 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500" 
                />
                <span className="text-gray-700 group-hover:text-blue-600 transition-colors">Jojo tank</span>
              </label>
            </div>

            <div className="mt-6">
              <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                <span className="text-blue-600 mr-2">🚪</span>
                Rooms
              </h4>
              <button 
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 shadow-md transition-all transform hover:scale-105" 
                onClick={addRoom}
              >
                + Add Room
              </button>
              <button 
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 shadow-md transition-all transform hover:scale-105" 
                onClick={addRoom}
              >
                + Add Room
              </button>
              <ul className="mt-3 space-y-3">
                {roomsState.map((r, i) => (
                  <li key={i} className="bg-white border-2 border-gray-200 rounded-lg p-3 hover:border-blue-300 transition-colors">
                    <div className="flex items-center space-x-2 flex-wrap gap-2">
                      <input 
                        className="px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 w-24" 
                        placeholder="Room #" 
                        value={r.room_number} 
                        onChange={e => updateRoom(i, 'room_number', e.target.value)} 
                      />
                      <input 
                        className="px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 w-20" 
                        placeholder="Cap" 
                        type="number"
                        value={r.capacity} 
                        onChange={e => updateRoom(i, 'capacity', Number(e.target.value))} 
                      />
                      <input 
                        className="px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 w-28" 
                        placeholder="Price" 
                        type="number"
                        value={r.price_per_month} 
                        onChange={e => updateRoom(i, 'price_per_month', Number(e.target.value))} 
                      />
                      <label className="flex items-center space-x-2 bg-gray-50 px-3 py-2 rounded-lg cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={!!r.is_occupied} 
                          onChange={async (e) => {
                            const checked = e.target.checked;
                            if (r.id) {
                              try {
                                const res = await ownerAPI.setRoomOccupancy(r.id, { is_occupied: checked });
                                const updatedRoom = res.data.room;
                                const updatedHouse = res.data.house;
                                setRoomsState(prev => prev.map(rr => rr.id === updatedRoom.id ? { ...rr, ...updatedRoom } : rr));
                                setHouse(updatedHouse);
                              } catch (err) {
                                setMessage(err?.response?.data?.message || 'Failed to update occupancy');
                              }
                            } else {
                              updateRoom(i, 'is_occupied', checked);
                            }
                          }} 
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm text-gray-700">Occupied</span>
                      </label>
                      <button 
                        className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors" 
                        onClick={() => removeRoom(i)}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="glass rounded-xl shadow-lg p-6">
            {/* 3-Slot Image Upload Section */}
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-1 flex items-center">
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg px-3 py-1 mr-2">📸</span>
                House Images
              </h3>
              <p className="text-sm text-gray-600 mb-4">Upload up to 3 images to showcase your property</p>
              <p className="text-sm text-gray-600 mb-4">Upload up to 3 images to showcase your property</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[0, 1, 2].map((slotIndex) => {
                  const currentImages = house.images || [];
                  const imageAtSlot = currentImages[slotIndex];
                  const isUploading = uploadingSlot === slotIndex;

                  return (
                    <div key={slotIndex} className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-gradient-to-br from-gray-50 to-blue-50 hover:border-blue-400 transition-all shadow-sm hover:shadow-md">
                      {imageAtSlot ? (
                        <div className="relative group h-56">
                          <img
                            src={imageAtSlot}
                            alt={`House image ${slotIndex + 1}`}
                            className="w-full h-full object-cover cursor-pointer"
                            onClick={() => setLightboxImage(imageAtSlot)}
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all flex items-center justify-center gap-2">
                            <button
                              onClick={() => setLightboxImage(imageAtSlot)}
                              className="opacity-0 group-hover:opacity-100 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:scale-105 shadow-lg"
                            >
                              👁️ View
                            </button>
                            <button
                              onClick={() => deleteImage(imageAtSlot)}
                              className="opacity-0 group-hover:opacity-100 px-4 py-2 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-lg text-sm hover:from-red-700 hover:to-pink-700 transition-all transform hover:scale-105 shadow-lg"
                            >
                              🗑️ Remove
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="h-56 flex flex-col items-center justify-center p-4">
                          {isUploading ? (
                            <div className="text-center">
                              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto"></div>
                              <p className="text-sm text-gray-600 mt-3 font-medium">Uploading...</p>
                            </div>
                          ) : (
                            <>
                              <svg className="w-16 h-16 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <label className="cursor-pointer">
                                <span className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm hover:from-blue-700 hover:to-indigo-700 transition-all inline-block shadow-md transform hover:scale-105">
                                  📤 Upload Image
                                </span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                      uploadImageToSlot(slotIndex, e.target.files[0]);
                                    }
                                  }}
                                />
                              </label>
                              <p className="text-xs text-gray-500 mt-3 font-medium">Slot {slotIndex + 1}</p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-700">💡 <span className="font-semibold">Tip:</span> Click on any image to view full size. Hover over images to see View and Remove options.</p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border-2 border-green-200">
              <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                <span className="text-green-600 mr-2">💳</span>
                Payment Methods
              </h4>
              <p className="text-xs text-gray-600 mb-3">These details will be visible to students when making payments</p>
              <p className="text-xs text-gray-600 mb-3">These details will be visible to students when making payments</p>
              <input 
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all mb-3" 
                placeholder="📱 Ecocash number" 
                value={ecocashNumber} 
                onChange={e => setEcocashNumber(e.target.value)} 
              />
              <input 
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all mb-3" 
                placeholder="🏦 Bank account" 
                value={bankAccount} 
                onChange={e => setBankAccount(e.target.value)} 
              />
              <input 
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all" 
                placeholder="💵 Other payment info" 
                value={otherPaymentInfo} 
                onChange={e => setOtherPaymentInfo(e.target.value)} 
              />
            </div>

            <div className="mt-6">
              <button 
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 shadow-lg transition-all transform hover:scale-105" 
                onClick={saveHouse}
              >
                💾 Save All Changes
              </button>
            </div>
          </div>
        </div>

        {message && (
          <div className="mt-6 glass rounded-lg p-4 border-l-4 border-blue-600">
            <p className="text-gray-700">{message}</p>
          </div>
        )}

        {/* Bookings & Inquiries for Owner */}
        <div className="mt-8 glass rounded-2xl shadow-xl border border-gray-100 p-6">
          <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-6 flex items-center">
            <span className="text-blue-600 mr-2">📋</span>
            Bookings & Inquiries
          </h3>
          
          <div className="mb-8">
            <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <span className="bg-green-100 text-green-700 rounded-lg px-3 py-1 mr-2">✓</span>
              Active Bookings
            </h4>
            {bookings.length === 0 ? (
              <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <p className="text-gray-500">No bookings for your house yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto bg-white rounded-lg shadow-sm">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Student</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Contact</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Room</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {bookings.map((b, idx) => (
                      <tr key={b.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-3 text-sm text-gray-700 font-medium">{b.id}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{b.student?.name || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {b.student?.email ? (
                            <a
                              href={`https://mail.google.com/mail/?view=cm&fs=1&to=${b.student.email}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                            >
                              {b.student.email}
                            </a>
                          ) : '—'}
                          <br/><span className="text-gray-500">{b.student?.phone || ''}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 font-medium">{b.room?.room_number || '—'}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                            {b.booking_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{new Date(b.booking_date).toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm">
                          {b.is_paid ? (
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">✓ Paid</span>
                          ) : b.booking_type === 'reserved' ? (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">Reserved ({b.days_until_expiry}d left)</span>
                          ) : (
                            <span className="text-gray-600">{b.booking_type}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <span className="bg-yellow-100 text-yellow-700 rounded-lg px-3 py-1 mr-2">💬</span>
              Inquiries
            </h4>
            {inquiries.length === 0 ? (
              <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <p className="text-gray-500">No inquiries yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {inquiries.map(iq => (
                  <div key={iq.id} className="glass rounded-lg p-4 border-l-4 border-blue-500 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-800 mb-1">
                          {iq.student_name} — {iq.student_email ? (
                            <a
                              href={`https://mail.google.com/mail/?view=cm&fs=1&to=${iq.student_email}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {iq.student_email}
                            </a>
                          ) : '—'}
                        </div>
                        <div className="text-sm font-medium text-gray-700 mb-2">{iq.subject}</div>
                        <div className="text-sm text-gray-600 mb-2">{iq.message}</div>
                        <div className="flex items-center text-xs">
                          <span className="text-gray-500 mr-3">Status:</span>
                          {iq.status === 'verified' ? (
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">✓ Verified</span>
                          ) : iq.status === 'cancelled' ? (
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full font-medium">✕ Cancelled</span>
                          ) : (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full font-medium">⏳ Pending</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-sm text-gray-500">
                        <div className="mb-3">{new Date(iq.created_at).toLocaleString()}</div>
                        <ActionMenu
                          align="right"
                          items={[
                            ...(iq.status !== 'verified'
                              ? [{ label: 'Mark as Verified', onClick: () => verifyInquiry(iq) }]
                              : []),
                            ...(iq.status !== 'cancelled'
                              ? [{ label: 'Cancel Inquiry', onClick: () => cancelInquiry(iq) }]
                              : []),
                            {
                              label: 'Delete Inquiry',
                              onClick: () => deleteInquiry(iq),
                              danger: true,
                            },
                          ]}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {actionMessage && (
          <div className="mt-6 glass rounded-lg p-4 border-l-4 border-green-600">
            <p className="text-gray-700">{actionMessage}</p>
          </div>
        )}

        {/* Lightbox Modal */}
        {lightboxImage && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4"
            onClick={() => setLightboxImage(null)}
          >
            <div className="relative max-w-5xl max-h-[90vh]">
              <button
                onClick={() => setLightboxImage(null)}
                className="absolute -top-10 right-0 text-white hover:text-gray-300 text-4xl font-bold"
              >
                ×
              </button>
              <img
                src={lightboxImage}
                alt="Full size view"
                className="max-w-full max-h-[85vh] object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
