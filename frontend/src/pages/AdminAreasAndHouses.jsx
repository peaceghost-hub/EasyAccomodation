import React, { useState, useEffect } from 'react';
import { adminAPI, houseAPI } from '../services/api';
import { useLocation, useNavigate } from 'react-router-dom';

export default function AdminAreasAndHouses() {
  const location = useLocation();
  const navigate = useNavigate();
  const [areaName, setAreaName] = useState('');
  const [areaDesc, setAreaDesc] = useState('');
  const [areaDistanceKm, setAreaDistanceKm] = useState('');
  const [areaLat, setAreaLat] = useState('');
  const [areaLon, setAreaLon] = useState('');
  const MAIN_CAMPUS = { lat: -19.516, lon: 29.833 };
  const computeKm = (lat, lon) => {
    const nlat = Number(lat); const nlon = Number(lon);
    if (Number.isNaN(nlat) || Number.isNaN(nlon)) return null;
    if (nlat < -90 || nlat > 90 || nlon < -180 || nlon > 180) return null;
    const R = 6371;
    const dLat = (MAIN_CAMPUS.lat - nlat) * Math.PI / 180;
    const dLon = (MAIN_CAMPUS.lon - nlon) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(nlat * Math.PI/180) * Math.cos(MAIN_CAMPUS.lat * Math.PI/180) * Math.sin(dLon/2)**2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c * 10) / 10;
  };
  const [houseData, setHouseData] = useState({
    house_number: '',
    street_address: '',
    residential_area_id: '',
    latitude: '',
    longitude: '',
    rooms: [],
    owner_details: {
      full_name: '',
      email: '',
      phone_number: ''
    }
  });
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadedFilenames, setUploadedFilenames] = useState([]);
  const [areas, setAreas] = useState([]);
  const [roomInput, setRoomInput] = useState({ room_number: '', capacity: 1, price_per_month: 0 });
  const [message, setMessage] = useState('');

  // Edit House state
  const [editId, setEditId] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editData, setEditData] = useState({
    address: '',
    latitude: '',
    longitude: '',
    description: '',
    is_active: true,
    is_verified: false,
    is_tiled: false,
    has_solar: false,
    has_jojo_tank: false,
    has_wifi: false,
    has_parking: false,
    has_kitchen: false,
    has_laundry: false,
  });

  useEffect(() => {
    const fetchAreas = async () => {
      try {
        const res = await houseAPI.getAreas();
        if (res.data && res.data.areas) {
          const list = res.data.areas.slice().sort((a,b) => {
            const da = a.approximate_distance_km ?? a.computed_distance_km;
            const db = b.approximate_distance_km ?? b.computed_distance_km;
            if (da == null && db == null) return 0;
            if (da == null) return 1;
            if (db == null) return -1;
            return da - db; // closest first
          });
          setAreas(list);
        }
      } catch (err) {
        console.error('Failed to load areas', err);
      }
    };
    fetchAreas();
  }, []);

  // Detect edit mode via ?edit={id}
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const idStr = params.get('edit');
    if (!idStr) { setEditId(null); return; }
    const id = Number(idStr);
    if (!id || Number.isNaN(id)) { setEditId(null); return; }
    setEditId(id);
    const load = async () => {
      setEditLoading(true);
      try {
        const res = await houseAPI.getById(id);
        const h = res.data?.house;
        if (!h) { setMessage('House not found'); return; }
        setEditData({
          address: `${h.house_number} ${h.street_address}`,
          latitude: (h.latitude ?? '') + '',
          longitude: (h.longitude ?? '') + '',
          description: h.description || '',
          is_active: !!h.is_active,
          is_verified: !!h.is_verified,
          is_tiled: !!(h.amenities?.is_tiled),
          has_solar: !!(h.amenities?.has_solar),
          has_jojo_tank: !!(h.amenities?.has_jojo_tank),
          has_wifi: !!(h.amenities?.has_wifi),
          has_parking: !!(h.amenities?.has_parking),
          has_kitchen: !!(h.amenities?.has_kitchen),
          has_laundry: !!(h.amenities?.has_laundry),
        });
      } catch (e) {
        setMessage(e.response?.data?.message || 'Failed to load house');
      } finally {
        setEditLoading(false);
      }
    };
    load();
  }, [location.search]);

  const saveEdit = async () => {
    if (!editId) return;
    try {
      const payload = {
        description: editData.description,
        latitude: editData.latitude === '' ? undefined : Number(editData.latitude),
        longitude: editData.longitude === '' ? undefined : Number(editData.longitude),
        is_active: editData.is_active,
        is_verified: editData.is_verified,
        is_tiled: editData.is_tiled,
        has_solar: editData.has_solar,
        has_jojo_tank: editData.has_jojo_tank,
        has_wifi: editData.has_wifi,
        has_parking: editData.has_parking,
        has_kitchen: editData.has_kitchen,
        has_laundry: editData.has_laundry,
      };
      const res = await adminAPI.updateHouse(editId, payload);
      setMessage(res.data?.message || 'House updated');
    } catch (e) {
      setMessage(e.response?.data?.message || 'Failed to update house');
    }
  };

  const addArea = async () => {
    console.log('addArea called', { areaName, areaDesc });
    if (!areaName || areaName.trim() === '') {
      setMessage('Area name is required');
      return;
    }
    try {
  const payload = { name: areaName.trim(), description: areaDesc };
  if (areaLat !== '') payload.latitude = Number(areaLat);
  if (areaLon !== '') payload.longitude = Number(areaLon);
      if (areaDistanceKm !== '') payload.approximate_distance_km = Number(areaDistanceKm);
      const res = await adminAPI.addArea(payload);
      console.log('addArea response', res);
      setMessage(res.data.message || 'Area added');
      // clear inputs on success
      setAreaName('');
      setAreaDesc('');
  setAreaDistanceKm('');
  setAreaLat('');
  setAreaLon('');
      // refresh areas list
      try {
        const ra = await houseAPI.getAreas();
        if (ra.data && ra.data.areas) {
          const list = ra.data.areas.slice().sort((a,b) => {
            const da = a.approximate_distance_km ?? a.computed_distance_km;
            const db = b.approximate_distance_km ?? b.computed_distance_km;
            if (da == null && db == null) return 0;
            if (da == null) return 1;
            if (db == null) return -1;
            return da - db;
          });
          setAreas(list);
        }
      } catch (innerErr) {
        console.error('Failed to refresh areas after add', innerErr);
      }
    } catch (e) {
      console.error('addArea error', e);
      const serverMsg = e?.response?.data?.message;
      if (e?.response?.status === 401) {
        setMessage('You must be logged in as an admin to perform this action');
        alert('Please log in as an admin');
      } else {
        setMessage(serverMsg || 'Failed to add area');
        alert(`Add area failed: ${serverMsg || e.message}`);
      }
    }
  };

  const addRoomToHouse = () => {
    setHouseData(prev => ({ ...prev, rooms: [...prev.rooms, roomInput] }));
    setRoomInput({ room_number: '', capacity: 1, price_per_month: 0 });
  };

  const addHouse = async () => {
    console.log('addHouse called', houseData);
    // basic validation
    if (!houseData.house_number || !houseData.street_address || !houseData.residential_area_id) {
      setMessage('House number, street address and residential area id are required');
      return;
    }
    try {
      const payload = { ...houseData, rooms: houseData.rooms };
      // ensure numeric fields
      payload.residential_area_id = Number(payload.residential_area_id);
      payload.latitude = payload.latitude ? Number(payload.latitude) : null;
      payload.longitude = payload.longitude ? Number(payload.longitude) : null;
      if (uploadedFilenames.length > 0) payload.image_filenames = uploadedFilenames.join(',');
      const res = await adminAPI.addHouse(payload);
      console.log('addHouse response', res);
      setMessage(res.data.message || 'House added');
      // clear house form
      setHouseData({
        house_number: '',
        street_address: '',
        residential_area_id: '',
        latitude: '',
        longitude: '',
        rooms: [],
        owner_details: { full_name: '', email: '', phone_number: '' }
      });
      setUploadedFilenames([]);
      setSelectedFiles([]);
      setRoomInput({ room_number: '', capacity: 1, price_per_month: 0 });
    } catch (e) {
      console.error('addHouse error', e);
      const serverMsg = e?.response?.data?.message;
      if (e?.response?.status === 401) {
        setMessage('You must be logged in as an admin to perform this action');
        alert('Please log in as an admin');
      } else {
        setMessage(serverMsg || 'Failed to add house');
        alert(`Add house failed: ${serverMsg || e.message}`);
      }
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(files);
  };

  const uploadImages = async () => {
    if (selectedFiles.length === 0) {
      setMessage('No files selected');
      return;
    }

    if (selectedFiles.length > 3) {
      setMessage('You may upload a maximum of 3 images per house');
      return;
    }

    const formData = new FormData();
    selectedFiles.forEach((f) => formData.append('images', f));

    try {
      const res = await adminAPI.uploadHouseImages(formData);
      if (res.data && res.data.filenames) {
        setUploadedFilenames(res.data.filenames);
        setMessage('Images uploaded successfully');
      } else {
        setMessage('Upload succeeded but no filenames returned');
      }
    } catch (err) {
      setMessage(err.response?.data?.message || 'Image upload failed');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Admin — Areas & Houses</h2>

      {editId && (
        <section className="card p-4 mb-4">
          <div className="flex items-start justify-between">
            <h3 className="font-semibold">Edit House (ID: {editId})</h3>
            <button className="text-sm text-gray-600 underline" onClick={() => navigate('/admin/areas-houses')}>Exit edit</button>
          </div>
          {editLoading ? (
            <div className="text-sm text-gray-600">Loading house...</div>
          ) : (
            <div className="space-y-3 mt-2">
              <div className="text-sm text-gray-700">Address: <span className="font-medium">{editData.address}</span></div>
              <div className="grid grid-cols-2 gap-2">
                <input className="input" placeholder="Latitude" value={editData.latitude} onChange={e => setEditData({ ...editData, latitude: e.target.value })} />
                <input className="input" placeholder="Longitude" value={editData.longitude} onChange={e => setEditData({ ...editData, longitude: e.target.value })} />
              </div>
              <div>
                <label className="block">Description</label>
                <textarea className="input" rows={3} value={editData.description} onChange={e => setEditData({ ...editData, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="inline-flex items-center text-sm"><input type="checkbox" className="mr-2" checked={editData.is_active} onChange={e => setEditData({ ...editData, is_active: e.target.checked })} />Active</label>
                <label className="inline-flex items-center text-sm"><input type="checkbox" className="mr-2" checked={editData.is_verified} onChange={e => setEditData({ ...editData, is_verified: e.target.checked })} />Verified</label>
              </div>
              <div>
                <h4 className="font-medium">Amenities</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 text-sm">
                  <label className="inline-flex items-center"><input type="checkbox" className="mr-2" checked={editData.is_tiled} onChange={e => setEditData({ ...editData, is_tiled: e.target.checked })} />Tiled</label>
                  <label className="inline-flex items-center"><input type="checkbox" className="mr-2" checked={editData.has_solar} onChange={e => setEditData({ ...editData, has_solar: e.target.checked })} />Solar</label>
                  <label className="inline-flex items-center"><input type="checkbox" className="mr-2" checked={editData.has_jojo_tank} onChange={e => setEditData({ ...editData, has_jojo_tank: e.target.checked })} />Jojo tank</label>
                  <label className="inline-flex items-center"><input type="checkbox" className="mr-2" checked={editData.has_wifi} onChange={e => setEditData({ ...editData, has_wifi: e.target.checked })} />Wi‑Fi</label>
                  <label className="inline-flex items-center"><input type="checkbox" className="mr-2" checked={editData.has_parking} onChange={e => setEditData({ ...editData, has_parking: e.target.checked })} />Parking</label>
                  <label className="inline-flex items-center"><input type="checkbox" className="mr-2" checked={editData.has_kitchen} onChange={e => setEditData({ ...editData, has_kitchen: e.target.checked })} />Kitchen</label>
                  <label className="inline-flex items-center"><input type="checkbox" className="mr-2" checked={editData.has_laundry} onChange={e => setEditData({ ...editData, has_laundry: e.target.checked })} />Laundry</label>
                </div>
              </div>
              <div className="pt-2">
                <button className="btn btn-primary" onClick={saveEdit}>Save Changes</button>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="card p-4 mb-4">
        <h3 className="font-semibold">Add Residential Area</h3>
        <input className="input mt-2" placeholder="Area name" value={areaName} onChange={e => setAreaName(e.target.value)} />
        <textarea className="input mt-2" placeholder="Description" value={areaDesc} onChange={e => setAreaDesc(e.target.value)} />
        <div className="grid grid-cols-2 gap-2 mt-2">
          <input className="input" placeholder="Latitude (optional)" value={areaLat} onChange={e => setAreaLat(e.target.value)} />
          <input className="input" placeholder="Longitude (optional)" value={areaLon} onChange={e => setAreaLon(e.target.value)} />
        </div>
        <div className="text-xs text-gray-500 mt-1">If you leave distance empty and provide coordinates, it will be auto-calculated.</div>
        <input className="input mt-2" placeholder="Approx. distance to campus (km)" value={areaDistanceKm} onChange={e => setAreaDistanceKm(e.target.value)} />
        <button onClick={addArea} className="btn btn-primary mt-2">Add Area</button>
      </section>

      {/* Manage Areas - Edit existing */}
      <section className="card p-4 mb-4">
        <h3 className="font-semibold mb-2">Manage Residential Areas</h3>
        {areas.length === 0 ? (
          <div className="text-sm text-gray-600">No areas yet.</div>
        ) : (
          <div className="space-y-3">
            {areas.map(a => (
              <AreaEditor key={a.id} area={a} onUpdated={async () => {
                const ra = await houseAPI.getAreas();
                if (ra.data && ra.data.areas) {
                  const list = ra.data.areas.slice().sort((x,y) => {
                    const dx = x.approximate_distance_km ?? x.computed_distance_km;
                    const dy = y.approximate_distance_km ?? y.computed_distance_km;
                    if (dx == null && dy == null) return 0; if (dx == null) return 1; if (dy == null) return -1; return dx - dy;
                  });
                  setAreas(list);
                }
              }} />
            ))}
          </div>
        )}
      </section>

      <section className="card p-4">
        <h3 className="font-semibold">Add House</h3>
        <input className="input mt-2" placeholder="House number" value={houseData.house_number} onChange={e => setHouseData({ ...houseData, house_number: e.target.value })} />
        <input className="input mt-2" placeholder="Street address" value={houseData.street_address} onChange={e => setHouseData({ ...houseData, street_address: e.target.value })} />
        {areas.length > 0 ? (
          <select className="input mt-2" value={houseData.residential_area_id} onChange={e => setHouseData({ ...houseData, residential_area_id: e.target.value })}>
            <option value="">-- Select area --</option>
            {areas.map(a => (
              <option key={a.id} value={a.id}>
                  {a.name} {(() => {
                    const d = (typeof a.approximate_distance_km === 'number') ? a.approximate_distance_km : (typeof a.computed_distance_km === 'number' ? a.computed_distance_km : null);
                    return d != null ? `— ${d} km` : '';
                  })()} (id: {a.id})
              </option>
            ))}
          </select>
        ) : (
          <input className="input mt-2" placeholder="Residential area id" value={houseData.residential_area_id} onChange={e => setHouseData({ ...houseData, residential_area_id: e.target.value })} />
        )}
        <div className="grid grid-cols-2 gap-2 mt-2">
          <input className="input" placeholder="Latitude" value={houseData.latitude} onChange={e => setHouseData({ ...houseData, latitude: e.target.value })} />
          <input className="input" placeholder="Longitude" value={houseData.longitude} onChange={e => setHouseData({ ...houseData, longitude: e.target.value })} />
        </div>

        <div className="mt-3">
          <h4 className="font-medium">Owner Details</h4>
          <input className="input mt-2" placeholder="Owner Full Name" value={houseData.owner_details.full_name} onChange={e => setHouseData({ ...houseData, owner_details: { ...houseData.owner_details, full_name: e.target.value } })} />
          <input className="input mt-2" placeholder="Owner Email" value={houseData.owner_details.email} onChange={e => setHouseData({ ...houseData, owner_details: { ...houseData.owner_details, email: e.target.value } })} />
          <input className="input mt-2" placeholder="Owner Phone Number" value={houseData.owner_details.phone_number} onChange={e => setHouseData({ ...houseData, owner_details: { ...houseData.owner_details, phone_number: e.target.value } })} />
        </div>

        <div className="mt-3">
          <h4 className="font-medium">Rooms</h4>
          <div className="flex space-x-2 mt-2">
            <input className="input" placeholder="Room #" value={roomInput.room_number} onChange={e => setRoomInput({ ...roomInput, room_number: e.target.value })} />
            <input className="input" placeholder="Capacity" value={roomInput.capacity} onChange={e => setRoomInput({ ...roomInput, capacity: Number(e.target.value) })} />
            <input className="input" placeholder="Price" value={roomInput.price_per_month} onChange={e => setRoomInput({ ...roomInput, price_per_month: Number(e.target.value) })} />
            <button className="btn btn-secondary" onClick={addRoomToHouse}>Add Room</button>
          </div>
          <ul className="mt-2">
            {houseData.rooms.map((r, i) => (<li key={i} className="text-sm">{r.room_number} - {r.capacity} - {r.price_per_month}</li>))}
          </ul>
        </div>

        <button className="btn btn-primary mt-4" onClick={addHouse}>Create House</button>
      </section>

      {message && <div className="mt-4 p-3 bg-green-50 text-green-800 rounded">{message}</div>}
    </div>
  );
}

function AreaEditor({ area, onUpdated }) {
  const [editing, setEditing] = React.useState(false);
  const [form, setForm] = React.useState({
    name: area.name || '',
    description: area.description || '',
    latitude: area.latitude ?? '',
    longitude: area.longitude ?? '',
    approximate_distance_km: area.approximate_distance_km ?? '',
  });
  const MAIN_CAMPUS = { lat: -19.516, lon: 29.833 };
  const computeKm = (lat, lon) => {
    const nlat = Number(lat); const nlon = Number(lon);
    if (Number.isNaN(nlat) || Number.isNaN(nlon)) return null;
    if (nlat < -90 || nlat > 90 || nlon < -180 || nlon > 180) return null;
    const R = 6371; const dLat = (MAIN_CAMPUS.lat - nlat) * Math.PI/180; const dLon = (MAIN_CAMPUS.lon - nlon) * Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(nlat*Math.PI/180)*Math.cos(MAIN_CAMPUS.lat*Math.PI/180)*Math.sin(dLon/2)**2; const c = 2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R*c*10)/10;
  };
  const previewDistance = form.latitude !== '' && form.longitude !== '' ? computeKm(form.latitude, form.longitude) : null;

  const save = async () => {
    const payload = { name: form.name, description: form.description };
    if (form.latitude === '') payload.latitude = null; else payload.latitude = Number(form.latitude);
    if (form.longitude === '') payload.longitude = null; else payload.longitude = Number(form.longitude);
    if (form.approximate_distance_km === '') payload.approximate_distance_km = null; else payload.approximate_distance_km = Number(form.approximate_distance_km);
    try {
      await adminAPI.updateArea(area.id, payload);
      setEditing(false);
      onUpdated && onUpdated();
    } catch (e) {
      alert(e?.response?.data?.message || 'Failed to update area');
    }
  };

  return (
    <div className="border rounded p-3">
      {!editing ? (
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">{area.name}</div>
            <div className="text-xs text-gray-600">{area.description || '—'}</div>
            <div className="text-xs mt-1">Coords: {area.latitude ?? '—'}, {area.longitude ?? '—'}</div>
            <div className="text-xs">Distance: {typeof area.approximate_distance_km === 'number' ? `${area.approximate_distance_km} km (manual)` : (typeof area.computed_distance_km === 'number' ? `${area.computed_distance_km} km (auto)` : '—')}</div>
          </div>
          <button className="btn btn-secondary" onClick={() => setEditing(true)}>Edit</button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <input className="input" placeholder="Approx. distance (km) — leave empty to auto" value={form.approximate_distance_km} onChange={e => setForm({ ...form, approximate_distance_km: e.target.value })} />
          </div>
          <textarea className="input" placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="Latitude" value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} />
            <input className="input" placeholder="Longitude" value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} />
          </div>
          <div className="text-xs text-gray-600">Preview (auto): {previewDistance != null ? `${previewDistance} km` : '—'}</div>
          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={save}>Save</button>
            <button className="btn" onClick={() => { setEditing(false); setForm({ name: area.name || '', description: area.description || '', latitude: area.latitude ?? '', longitude: area.longitude ?? '', approximate_distance_km: area.approximate_distance_km ?? '' }); }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
