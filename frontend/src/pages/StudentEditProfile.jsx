import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';

export default function StudentEditProfile() {
  const { user, updateLocalUser } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ full_name: '', email: '', phone_number: '', student_id: '', institution: '', current_password: '', new_password: '', confirm_new_password: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name || '',
        email: user.email || '',
        phone_number: user.phone_number || '',
        student_id: user.student_info?.student_id || '',
        institution: user.student_info?.institution || ''
      });
    }
  }, [user]);

  const handleChange = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      const payload = {
        full_name: form.full_name,
        email: form.email,
        phone_number: form.phone_number,
        student_profile: {
          student_id: form.student_id,
          institution: form.institution
        }
      };
      const res = await authAPI.updateProfile(payload);
      const updated = res.data?.user || { ...user, ...payload };
      updateLocalUser(updated);
      // If user requested a password change, validate and call changePassword
      if (form.new_password) {
        if (form.new_password !== form.confirm_new_password) {
          setMessage('New password and confirmation do not match');
          setSaving(false);
          return;
        }
        try {
          await authAPI.changePassword({ current_password: form.current_password, new_password: form.new_password });
          setMessage('Profile and password updated');
        } catch (err) {
          setMessage(err.response?.data?.message || 'Profile updated but failed to change password');
          setSaving(false);
          return;
        }
      } else {
        setMessage('Profile updated');
      }
      setTimeout(() => navigate('/student'), 700);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Edit My Profile</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Full name</label>
            <input className="input w-full" value={form.full_name} onChange={handleChange('full_name')} />
          </div>
          <div>
            <label className="text-sm font-medium">Email</label>
            <input className="input w-full" value={form.email} onChange={handleChange('email')} />
          </div>
          <div>
            <label className="text-sm font-medium">Phone</label>
            <input className="input w-full" value={form.phone_number} onChange={handleChange('phone_number')} />
          </div>
          <div>
            <label className="text-sm font-medium">Student ID</label>
            <input className="input w-full" value={form.student_id} onChange={handleChange('student_id')} />
          </div>
          <div>
            <label className="text-sm font-medium">Institution</label>
            <input className="input w-full" value={form.institution} onChange={handleChange('institution')} />
          </div>

          <div>
            <label className="text-sm font-medium">Current password (required to change password)</label>
            <input type="password" className="input w-full" value={form.current_password} onChange={handleChange('current_password')} />
          </div>
          <div>
            <label className="text-sm font-medium">New password</label>
            <input type="password" className="input w-full" value={form.new_password} onChange={handleChange('new_password')} />
          </div>
          <div>
            <label className="text-sm font-medium">Confirm new password</label>
            <input type="password" className="input w-full" value={form.confirm_new_password} onChange={handleChange('confirm_new_password')} />
          </div>

          {message && <div className="text-sm text-gray-700">{message}</div>}

          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded">{saving ? 'Saving...' : 'Save'}</button>
            <button onClick={() => navigate('/student')} className="px-4 py-2 bg-gray-100 rounded">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
