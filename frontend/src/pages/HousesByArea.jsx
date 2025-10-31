import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { houseAPI } from '../services/api';

export default function HousesByArea() {
  const { areaId } = useParams();
  const [area, setArea] = useState(null);
  const [withAccommodation, setWithAccommodation] = useState([]);
  const [full, setFull] = useState([]);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await houseAPI.getByArea(areaId);
        setArea(res.data.area);
        setWithAccommodation(res.data.houses_with_accommodation || []);
        setFull(res.data.houses_full || []);
      } catch (e) {
        console.error(e);
      }
    };
    fetch();
  }, [areaId]);

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-2xl font-bold">Houses in {area?.name}</h1>
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="font-semibold mb-3">Available Accommodation</h3>
          <div className="space-y-4">
            {withAccommodation.map(h => (
              <div key={h.id} className="card p-4">
                <h4 className="font-medium">{h.house_number} {h.street_address}</h4>
                <p className="text-sm text-gray-600">Rooms: {h.total_rooms} — Available: {h.available_rooms}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link to={`/houses/${h.id}`} className="btn btn-primary text-sm w-full sm:w-auto text-center">View</Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-3">Full Houses (No accommodation)</h3>
          <div className="space-y-4">
            {full.map(h => (
              <div key={h.id} className="card p-4">
                <h4 className="font-medium">{h.house_number} {h.street_address}</h4>
                <p className="text-sm text-gray-600">This house is currently full.</p>
                <div className="mt-3">
                  <Link to={`/houses/${h.id}`} className="btn btn-secondary text-sm">View</Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
