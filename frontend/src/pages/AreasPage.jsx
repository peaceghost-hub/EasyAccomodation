import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

export default function AreasPage() {
  const [areas, setAreas] = useState([]);

  useEffect(() => {
    const fetchAreas = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/houses/residential-areas');
        setAreas(res.data.areas || []);
      } catch (e) {
        console.error('Failed to fetch areas', e);
      }
    };
    fetchAreas();
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Where do you wish to reside?</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {areas.map(area => (
          <Link key={area.id} to={`/areas/${area.id}`} className="card p-4 hover:shadow-lg text-left">
            <h2 className="text-xl font-semibold">{area.name}</h2>
            <p className="text-sm text-gray-600">{area.house_count} houses</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
