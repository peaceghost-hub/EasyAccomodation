import React, { useState, useEffect } from 'react';
import { ownerAPI, houseAPI } from '../services/api';

export default function ClaimHouse() {
  const [ownerDetails, setOwnerDetails] = useState({ full_name: '', email: '', phone_number: '' });
  const [houses, setHouses] = useState([]);
  const [selectedHouseId, setSelectedHouseId] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await houseAPI.getUnclaimed();
        if (res.data && res.data.houses) setHouses(res.data.houses);
      } catch (e) {
        // ignore
      }
    };
    fetch();
  }, []);

  const claimHouse = async () => {
    if (!selectedHouseId) {
      setMessage('Please select a house to claim');
      return;
    }

    try {
      const res = await ownerAPI.claimHouse(selectedHouseId, {
        name: ownerDetails.full_name,
        email: ownerDetails.email,
        phone: ownerDetails.phone_number
      });
      setMessage(res.data.message || 'House claimed successfully');
      // Refresh list
      const r = await houseAPI.getUnclaimed();
      if (r.data && r.data.houses) setHouses(r.data.houses);
    } catch (e) {
      setMessage(e.response?.data?.message || 'Failed to claim house');
    }
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Claim Your House</h2>
      <input
        className="input mt-2"
        placeholder="Full Name"
        value={ownerDetails.full_name}
        onChange={e => setOwnerDetails({ ...ownerDetails, full_name: e.target.value })}
      />
      <input
        className="input mt-2"
        placeholder="Email"
        value={ownerDetails.email}
        onChange={e => setOwnerDetails({ ...ownerDetails, email: e.target.value })}
      />
      <input
        className="input mt-2"
        placeholder="Phone Number"
        value={ownerDetails.phone_number}
        onChange={e => setOwnerDetails({ ...ownerDetails, phone_number: e.target.value })}
      />

      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700">Select house to claim</label>
        <select className="input mt-2" value={selectedHouseId || ''} onChange={e => setSelectedHouseId(Number(e.target.value) || null)}>
          <option value="">-- Select house --</option>
          {houses.map(h => (
            <option key={h.id} value={h.id}>{`${h.house_number} ${h.street_address} (${h.residential_area})`}</option>
          ))}
        </select>
      </div>

      <button className="btn btn-primary mt-4" onClick={claimHouse}>Claim House</button>
      {message && <div className="mt-4 p-3 bg-green-50 text-green-800 rounded">{message}</div>}
    </div>
  );
}