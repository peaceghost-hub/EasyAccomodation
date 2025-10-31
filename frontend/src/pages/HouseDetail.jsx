import React, { useEffect, useRef, useState } from 'react';
import api, { houseAPI, bookingAPI } from '../services/api';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function HouseDetail() {
  const { id } = useParams();
  const [house, setHouse] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [message, setMessage] = useState('');
  const [showMap, setShowMap] = useState(false);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [campusSelection, setCampusSelection] = useState('main'); // 'main' | 'telone' | 'batanai' | 'all'
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await houseAPI.getById(id);
        const h = res.data.house;
        // Normalize images to full backend URLs (house.images may be '/static/house_images/..')
        const backendBase = (api.defaults.baseURL || '').replace(/\/?api\/?$/, '');
        if (h && Array.isArray(h.images)) {
          h.images = h.images.map(img => (img && (img.startsWith('http') || img.startsWith('data:')) ? img : `${backendBase}${img.startsWith('/') ? img : '/' + img}`));
        }
        setHouse(h);
        // set initial image if available
        const imgs = h?.images || [];
        if (imgs.length > 0) setSelectedImage(imgs[0]);
      } catch (e) {
        console.error(e);
      }
    };
    fetch();
  }, [id]);

  const handleInquiry = async () => {
    if (!isAuthenticated || user.user_type !== 'student') {
      setMessage('You must be logged in as a student to send an inquiry');
      return;
    }

    try {
      const res = await bookingAPI.sendInquiry({ house_id: house.id, message: 'I am interested in this room.' });
      setMessage(res.data.message || 'Inquiry sent');
    } catch (e) {
      setMessage(e.response?.data?.message || 'Failed to send inquiry');
    }
  };

  const handleReserve = async () => {
    if (!isAuthenticated || user.user_type !== 'student') {
      setMessage('You must be logged in as a student to reserve');
      return;
    }

    if (!selectedRoom) {
      setMessage('Select a room first');
      return;
    }

    try {
      const res = await bookingAPI.reserveRoom({ house_id: house.id, room_id: selectedRoom.id });
      setMessage(res.data.message || 'Reserved');
    } catch (e) {
      setMessage(e.response?.data?.message || 'Failed to reserve');
    }
  };

  // Helpers
  const isValidCoords = (lat, lon) => (
    typeof lat === 'number' && typeof lon === 'number' &&
    !Number.isNaN(lat) && !Number.isNaN(lon) &&
    lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
  );

  // Haversine distance (km)
  const kmBetween = (lat1, lon1, lat2, lon2) => {
    if ([lat1, lon1, lat2, lon2].some(v => typeof v !== 'number' || Number.isNaN(v))) return null;
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c * 10) / 10; // one decimal
  };

  // Campus coordinates (fixed)
  const CAMPUSES = {
    main: { key: 'main', name: 'Main Campus', lat: -19.516, lon: 29.833, color: '#2563eb' }, // blue-600
    telone: { key: 'telone', name: 'TelOne Campus', lat: -19.484133, lon: 29.833482, color: '#16a34a' }, // green-600
    batanai: { key: 'batanai', name: 'Batanai Campus', lat: -19.498133, lon: 29.84029, color: '#a855f7' }, // purple-500
  };

  // Initialize Mapbox map when modal opens and token is available
  useEffect(() => {
    // Use direct access to ensure Vite replaces at build time
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    const hasCoords = !!house && typeof house?.latitude === 'number' && typeof house?.longitude === 'number';
    if (!showMap || !token || !hasCoords) return;

    let cancelled = false;

    // Ensure Mapbox CSS is present (use CDN to avoid bundler issues)
    const cssId = 'mapbox-gl-css-cdn';
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link');
      link.id = cssId;
      link.rel = 'stylesheet';
      link.href = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css';
      document.head.appendChild(link);
    }

    (async () => {
      try {
        const mapbox = await import('mapbox-gl');
        if (cancelled) return;
        mapbox.default.accessToken = token;
        const center = [house.longitude, house.latitude];

        // Helper to remove existing line layers/sources
        const removeLineIfExists = (map, id) => {
          try {
            if (map.getLayer(id)) map.removeLayer(id);
          } catch {}
          try {
            if (map.getSource(id)) map.removeSource(id);
          } catch {}
        };

        const updateLinesAndBounds = (map) => {
          // Clean any previous lines
          ['line-main', 'line-telone', 'line-batanai'].forEach((id) => removeLineIfExists(map, id));

          const bounds = new mapbox.default.LngLatBounds();
          bounds.extend(center);

          const addLine = (campusKey) => {
            const c = CAMPUSES[campusKey];
            const campusCoord = [c.lon, c.lat];
            const sourceId = `line-${campusKey}`;
            map.addSource(sourceId, {
              type: 'geojson',
              data: {
                type: 'FeatureCollection',
                features: [
                  {
                    type: 'Feature',
                    geometry: { type: 'LineString', coordinates: [center, campusCoord] },
                  },
                ],
              },
            });
            map.addLayer({
              id: sourceId,
              type: 'line',
              source: sourceId,
              paint: {
                'line-color': c.color,
                'line-width': 3,
                'line-opacity': 0.85,
              },
            });
            bounds.extend(campusCoord);
          };

          if (campusSelection === 'all') {
            addLine('main');
            addLine('telone');
            addLine('batanai');
          } else if (['main', 'telone', 'batanai'].includes(campusSelection)) {
            addLine(campusSelection);
          }

          map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 500 });
        };

        // Create or reuse map
        let map = mapRef.current;
        if (!map) {
          map = new mapbox.default.Map({
            container: mapContainerRef.current,
            style: 'mapbox://styles/mapbox/streets-v11',
            center,
            zoom: 14,
          });
          mapRef.current = map;

          // Add controls
          map.addControl(new mapbox.default.NavigationControl());

          map.on('load', () => {
            // House marker
            new mapbox.default.Marker({ color: '#2563eb' /* blue-600 */ })
              .setLngLat(center)
              .setPopup(new mapbox.default.Popup().setText('House location'))
              .addTo(map);

            // Campus markers
            Object.values(CAMPUSES).forEach((c) => {
              new mapbox.default.Marker({ color: c.color })
                .setLngLat([c.lon, c.lat])
                .setPopup(new mapbox.default.Popup().setText(c.name))
                .addTo(map);
            });

            updateLinesAndBounds(map);
          });
        } else {
          // Map exists (modal still open): just update lines
          if (map.loaded()) {
            updateLinesAndBounds(map);
          } else {
            map.once('load', () => updateLinesAndBounds(map));
          }
        }
      } catch (e) {
        // Fail silently; UI already shows distance/coords.
        // Optionally log to console to aid debugging without crashing UI.
        console.warn('Map init failed', e);
      }
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        try { mapRef.current.remove(); } catch {}
        mapRef.current = null;
      }
    };
  }, [showMap, house, campusSelection]);

  return (
    <div className="min-h-screen house-pattern-bg relative py-8">
      {/* Gradient overlay */}
      <div className="gradient-overlay"></div>
      
      {/* Fixed Contact Admin Card */}
      <div className="fixed bottom-6 right-6 z-50">
        <div className="glass rounded-xl shadow-2xl p-5 w-72 border-2 border-blue-200">
          <div className="flex items-center mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-lg font-bold mr-3">
              👤
            </div>
            <h4 className="text-blue-900 font-bold text-lg">Contact Admin</h4>
          </div>
          <div className="space-y-2">
            <div className="text-sm text-blue-800">
              <div className="font-semibold text-base mb-2">Benam Magomo</div>
              <div className="flex items-center gap-2 mb-2 p-2 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                <span className="text-lg">📧</span>
                <a
                  href="https://mail.google.com/mail/?view=cm&fs=1&to=magomobenam765@gmail.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 font-medium text-xs"
                >
                  magomobenam765@gmail.com
                </a>
              </div>
              <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
                <span className="text-lg">📞</span>
                <span className="font-medium">+263787690803</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {!house ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="glass rounded-2xl shadow-2xl border-2 border-blue-100 p-8">
              <h1 className="text-4xl font-extrabold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent mb-4">
                🏠 {house.house_number} {house.street_address}
              </h1>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className={`px-4 py-2 rounded-full text-sm font-semibold shadow-md ${house.is_claimed ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white' : 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white'}`}>
                  {house.is_claimed ? '✓ Claimed by owner' : '⏳ Not claimed'}
                </div>
                {house.owner_contact && house.is_claimed && (
                  <div className="text-sm text-gray-700 bg-blue-50 px-4 py-2 rounded-full border border-blue-200">
                    Owner: <span className="font-semibold">{house.owner_contact.name}</span> —
                    {" "}
                    <a
                      href={`https://mail.google.com/mail/?view=cm&fs=1&to=${house.owner_contact.email}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {house.owner_contact.email}
                    </a>
                  </div>
                )}
              </div>
              <p className="mt-4 text-gray-700 text-lg leading-relaxed">{house.description}</p>

              {/* Images gallery */}
              <div className="mt-6">
                {selectedImage ? (
                  <div className="rounded-xl overflow-hidden shadow-xl border-2 border-blue-200">
                    <img src={selectedImage} alt="House" className="w-full h-96 object-cover" />
                  </div>
                ) : (
                  <div className="rounded-xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center h-64 border-2 border-gray-300">
                    <div className="text-gray-500 text-lg">📷 No images available</div>
                  </div>
                )}

                {house.images && house.images.length > 0 && (
                  <div className="mt-4 flex space-x-3 overflow-x-auto pb-2">
                    {house.images.map((img, idx) => (
                      <button key={idx} onClick={() => setSelectedImage(img)} className={`flex-shrink-0 rounded-lg border-2 transition-all duration-200 ${selectedImage === img ? 'ring-4 ring-blue-400 border-blue-500 scale-105' : 'border-gray-300 hover:border-blue-300'}`}>
                        <img src={img} alt={`thumb-${idx}`} className="h-24 w-36 object-cover rounded-lg" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Warning notice */}
              <div className="mt-6 glass border-l-4 border-blue-400 p-5 rounded-r-xl shadow-lg">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-blue-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-bold text-blue-900">💡 Important Notice</h3>
                    <div className="mt-2 text-sm text-blue-800">
                      Please verify accommodation availability with the owner before making any payment. Use "Inquire" to request confirmation.
                    </div>
                  </div>
                </div>
              </div>

              {/* Amenities */}
              {house.amenities && (
                <div className="mt-6 glass rounded-xl shadow-lg border-2 border-blue-100 p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span>✨</span>
                    Amenities
                  </h3>
                  {(() => {
                    const labels = {
                      is_tiled: 'Tiled',
                      has_solar: 'Solar',
                      has_jojo_tank: 'Jojo tank',
                      has_wifi: 'Wi‑Fi',
                      has_parking: 'Parking',
                      has_kitchen: 'Kitchen',
                      has_laundry: 'Laundry',
                    };
                    const items = Object.entries(house.amenities || {})
                      .filter(([, val]) => !!val)
                      .map(([key]) => labels[key] || key);
                    return items.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {items.map((label) => (
                          <span
                            key={label}
                            className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-50 text-green-700 border border-green-200"
                          >
                            <svg className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.364 7.364a1 1 0 01-1.414 0L3.293 9.829a1 1 0 111.414-1.414l3.01 3.01 6.657-6.657a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            {label}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-600">No amenities listed.</div>
                    );
                  })()}
                </div>
              )}

              {/* Owner contact & payment methods */}
              {house.owner_contact && (
                <div className="mt-6 glass rounded-xl shadow-lg border-2 border-blue-100 p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <span>📞</span>
                        Owner Contact
                      </h3>
                      <div className="space-y-3">
                        <div className="flex items-center text-gray-700 bg-blue-50 p-3 rounded-lg">
                          <svg className="h-5 w-5 mr-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span className="font-medium">{house.owner_contact.name}</span>
                        </div>
                        <div className="flex items-center text-gray-700 bg-blue-50 p-3 rounded-lg">
                          <svg className="h-5 w-5 mr-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          <span className="font-medium">{house.owner_contact.phone}</span>
                        </div>
                        <div className="flex items-center text-gray-700 bg-blue-50 p-3 rounded-lg">
                          <svg className="h-5 w-5 mr-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <a
                            href={`https://mail.google.com/mail/?view=cm&fs=1&to=${house.owner_contact.email}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {house.owner_contact.email}
                          </a>
                        </div>
                      </div>
                    </div>

                    {house.payment_methods && (
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                          <span>💳</span>
                          Payment Methods
                        </h3>
                        <div className="space-y-3">
                          <div className="flex items-center text-gray-700 bg-green-50 p-3 rounded-lg">
                            <svg className="h-5 w-5 mr-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
                            </svg>
                            <span className="font-medium">Ecocash: {house.payment_methods.ecocash || 'N/A'}</span>
                          </div>
                          <div className="flex items-center text-gray-700 bg-green-50 p-3 rounded-lg">
                            <svg className="h-5 w-5 mr-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                            </svg>
                            <span className="font-medium">Bank: {house.payment_methods.bank_account || 'N/A'}</span>
                          </div>
                          {house.payment_methods.other && (
                            <div className="flex items-center text-gray-700 bg-green-50 p-3 rounded-lg">
                              <svg className="h-5 w-5 mr-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                              <span className="font-medium">Other: {house.payment_methods.other}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Rooms Section */}
              <div className="mt-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span>🛏️</span>
                  Available Rooms
                </h3>
                <div className="grid gap-4">
                  {house.rooms.map(r => (
                    <div 
                      key={r.id} 
                      className={`rounded-xl border-2 transition-all duration-200 shadow-md ${
                        r.is_available && !r.is_occupied
                          ? 'bg-white border-blue-200 hover:border-blue-400 hover:shadow-lg'
                          : 'bg-gray-50 border-gray-300'
                      }`}
                    >
                      <label className="flex items-center p-5 cursor-pointer">
                        <input 
                          type="radio" 
                          name="room" 
                          disabled={!r.is_available || r.is_occupied}
                          checked={selectedRoom?.id === r.id}
                          onChange={() => setSelectedRoom(r)}
                          className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <div className="ml-4 flex-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-bold text-gray-900 text-lg">Room {r.room_number}</div>
                              <div className="text-sm text-gray-600 mt-1">Capacity: {r.capacity} {r.capacity === 1 ? 'person' : 'people'}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-blue-700 text-xl">${r.price_per_month}/month</div>
                              <div className="text-sm mt-1">
                                {r.is_available && !r.is_occupied ? (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">✓ Available</span>
                                ) : (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">✗ Occupied</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <button
                  onClick={handleInquiry}
                  className="btn btn-secondary inline-flex items-center justify-center gap-2 text-base py-3 px-6"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  Inquire About Availability
                </button>
                <button
                  onClick={handleReserve}
                  className="btn btn-primary inline-flex items-center justify-center gap-2 text-base py-3 px-6"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Book Room (Pay Later)
                </button>
                <button
                  onClick={() => setShowMap(true)}
                  className="btn btn-secondary inline-flex items-center justify-center gap-2 text-base py-3 px-6"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A2 2 0 013 15.382V6.618a2 2 0 011.105-1.789l5-2.5a2 2 0 011.79 0l5.21 2.604a2 2 0 001.79 0l2.21-1.105A2 2 0 0122 5.118v8.764a2 2 0 01-1.105 1.789l-5 2.5a2 2 0 01-1.79 0L8.895 16.5a2 2 0 00-1.79 0L5 17.382" />
                  </svg>
                  View on Map
                </button>
              </div>

              {/* Message Display */}
              {message && (
                <div className="mt-6 glass border-l-4 border-blue-400 p-5 rounded-r-xl shadow-lg">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-blue-900">{message}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Map Modal (safe, token-guarded) */}
      {showMap && house && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowMap(false)}></div>
          <div className="relative bg-white rounded-xl shadow-lg w-full max-w-3xl p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-lg font-semibold">Location Map</h3>
                {import.meta.env.VITE_MAPBOX_TOKEN ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">token OK</span>
                ) : null}
                {/* Campus selector */}
                <div className="text-xs bg-gray-100 border border-gray-200 rounded-full overflow-hidden flex">
                  {[
                    { key: 'main', label: 'Main' },
                    { key: 'telone', label: 'TelOne' },
                    { key: 'batanai', label: 'Batanai' },
                    { key: 'all', label: 'All' },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setCampusSelection(opt.key)}
                      className={`px-2 py-1 ${campusSelection === opt.key ? 'bg-white text-gray-900' : 'text-gray-600 hover:text-gray-800'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => setShowMap(false)} className="ml-4 text-gray-500 hover:text-gray-700">✕</button>
            </div>

            {(() => {
              const lat = typeof house.latitude === 'string' ? parseFloat(house.latitude) : house.latitude;
              const lon = typeof house.longitude === 'string' ? parseFloat(house.longitude) : house.longitude;
              const valid = isValidCoords(lat, lon);
              return (
                <div className="mt-3 text-sm text-gray-700 space-y-1">
                  <div>Address: <span className="font-medium">{house.house_number} {house.street_address}</span></div>
                  <div>
                    Coordinates: {valid ? (
                      <span className="font-mono">{lat}, {lon}</span>
                    ) : (
                      <span className="text-yellow-700">Invalid or missing (lat must be -90..90, lon -180..180)</span>
                    )}
                  </div>
                  {valid && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {Object.values(CAMPUSES).map(c => (
                        <div key={c.key} className="flex items-center gap-2">
                          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                          <span className="text-gray-600">{c.name}:</span>
                          <span className="font-medium">{kmBetween(lat, lon, c.lat, c.lon)} km</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="mt-4">
              {(() => {
                // Use direct access so Vite injects the value in prod builds
                const token = import.meta.env.VITE_MAPBOX_TOKEN;
                const lat = typeof house.latitude === 'string' ? parseFloat(house.latitude) : house.latitude;
                const lon = typeof house.longitude === 'string' ? parseFloat(house.longitude) : house.longitude;
                const hasCoords = isValidCoords(lat, lon);
                if (!hasCoords) {
                  return <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">No coordinates available for this house.</div>;
                }
                if (!token) {
                  return (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                      Map preview will appear after you set a Mapbox token.<br/>
                      Add a file <code>.env.local</code> in <code>frontend/</code> with:<br/>
                      <code>VITE_MAPBOX_TOKEN=pk.xxxxxx_your_mapbox_public_token</code>
                      <br/>Tokens must start with <code>pk.</code> (public access token).
                    </div>
                  );
                }
                // Render actual Mapbox map when token is present
                return <div ref={mapContainerRef} className="h-80 w-full rounded border border-gray-200" />;
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
