import React, { useEffect, useState } from 'react';
import { adminAPI } from '../services/api';

export default function AdminAudits() {
  const [audits, setAudits] = useState([]);
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAudits = async (p = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminAPI.getAudits({ page: p, per_page: perPage });
      if (res.data && res.data.success) {
        setAudits(res.data.audits || []);
        setTotal(res.data.count || 0);
        setPage(res.data.page || p);
      } else {
        setError((res.data && res.data.message) || 'Failed to fetch audits');
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAudits(1); }, []);

  const nextPage = () => {
    if (page * perPage >= total) return;
    fetchAudits(page + 1);
  };
  const prevPage = () => {
    if (page <= 1) return;
    fetchAudits(page - 1);
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h2 className="text-2xl font-semibold mb-4">Audit Log</h2>
      {error && <div className="mb-4 text-red-600">{error}</div>}
      <div className="mb-4 text-sm text-gray-600">Showing page {page} — {total} total</div>

      <div className="overflow-x-auto">
        <table className="table w-full">
          <thead>
            <tr>
              <th>ID</th>
              <th>Action</th>
              <th>Actor</th>
              <th>Target</th>
              <th>Details</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8">Loading...</td></tr>
            ) : audits.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8">No audit records found.</td></tr>
            ) : (
              audits.map(a => (
                <tr key={a.id}>
                  <td>{a.id}</td>
                  <td className="font-mono text-sm">{a.action}</td>
                  <td>{a.actor_id || '-'}</td>
                  <td>{a.target_user_id || '-'}</td>
                  <td className="text-sm break-words max-w-xl">{a.details || '-'}</td>
                  <td className="text-sm">{new Date(a.created_at).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="text-sm">{Math.min((page-1)*perPage+1, total)} - {Math.min(page*perPage, total)} of {total}</div>
        <div className="space-x-2">
          <button onClick={prevPage} disabled={page <= 1} className="btn btn-sm">Prev</button>
          <button onClick={nextPage} disabled={page * perPage >= total} className="btn btn-sm">Next</button>
        </div>
      </div>
    </div>
  );
}
