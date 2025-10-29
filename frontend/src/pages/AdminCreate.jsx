import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { adminAPI } from '../services/api';

export default function AdminCreate() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', email: '', phone_number: '', password: '', confirm_password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (form.password !== form.confirm_password) {
      setError('Passwords do not match');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        full_name: form.full_name,
        email: form.email,
        phone_number: form.phone_number,
        password: form.password,
      };
      const res = await adminAPI.createAdmin(payload);
      if (res.data && res.data.success) {
        setSuccess('Admin created successfully');
        setForm({ full_name: '', email: '', phone_number: '', password: '', confirm_password: '' });
        // optionally go to admin list or dashboard after a short delay
        setTimeout(() => navigate('/admin'), 800);
      } else {
        setError((res.data && res.data.message) || 'Failed to create admin');
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-semibold mb-4">Create Admin</h2>
      {error && <div className="mb-4 text-red-600">{error}</div>}
      {success && <div className="mb-4 text-green-600">{success}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Full name</label>
          <input name="full_name" value={form.full_name} onChange={handleChange} className="input input-bordered w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input name="email" value={form.email} onChange={handleChange} type="email" className="input input-bordered w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium">Phone number</label>
          <input name="phone_number" value={form.phone_number} onChange={handleChange} placeholder="e.g. +263771234567 or 0771234567" className="input input-bordered w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium">Password</label>
          <input name="password" value={form.password} onChange={handleChange} type="password" className="input input-bordered w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium">Confirm password</label>
          <input name="confirm_password" value={form.confirm_password} onChange={handleChange} type="password" className="input input-bordered w-full" />
        </div>

        <div>
          <button disabled={loading} className="btn btn-primary">
            {loading ? 'Creating...' : 'Create Admin'}
          </button>
        </div>
      </form>
    </div>
  );
}
