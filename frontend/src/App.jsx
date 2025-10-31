import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Navbar from './components/common/Navbar';
import ContactAdminWidget from './components/common/ContactAdminWidget';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import StudentDashboard from './pages/StudentDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminEditProfile from './pages/AdminEditProfile';
import StudentEditProfile from './pages/StudentEditProfile';
import OwnerEditProfile from './pages/OwnerEditProfile';
import AreasPage from './pages/AreasPage';
import HousesByArea from './pages/HousesByArea';
import HouseDetail from './pages/HouseDetail';
import AdminAreasAndHouses from './pages/AdminAreasAndHouses';
import OwnerHouseEdit from './pages/OwnerHouseEdit';
import AdminCreate from './pages/AdminCreate';
import AdminAudits from './pages/AdminAudits';
import VerifyEmail from './pages/VerifyEmail';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (allowedRoles && !allowedRoles.includes(user?.user_type)) return <Navigate to="/" />;
  return children;
};

function AppContent() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <ContactAdminWidget />
      <Routes>
        <Route path="/" element={<HomePage />} />
  <Route path="/login" element={<LoginPage />} />
  <Route path="/register" element={<RegisterPage />} />
  <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/student" element={<ProtectedRoute allowedRoles={['student']}><StudentDashboard /></ProtectedRoute>} />
    <Route path="/areas" element={<AreasPage />} />
    <Route path="/areas/:areaId" element={<HousesByArea />} />
    <Route path="/houses/:id" element={<HouseDetail />} />
  <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
  <Route path="/admin/areas-houses" element={<ProtectedRoute allowedRoles={['admin']}><AdminAreasAndHouses /></ProtectedRoute>} />
  <Route path="/admin/create" element={<ProtectedRoute allowedRoles={['admin']}><AdminCreate /></ProtectedRoute>} />
  <Route path="/admin/audits" element={<ProtectedRoute allowedRoles={['admin']}><AdminAudits /></ProtectedRoute>} />
  <Route path="/admin/profile" element={<ProtectedRoute allowedRoles={['admin']}><AdminEditProfile /></ProtectedRoute>} />
  <Route path="/student/profile" element={<ProtectedRoute allowedRoles={['student']}><StudentEditProfile /></ProtectedRoute>} />
  <Route path="/owner/profile" element={<ProtectedRoute allowedRoles={['house_owner']}><OwnerEditProfile /></ProtectedRoute>} />
  <Route path="/owner/house" element={<ProtectedRoute allowedRoles={['house_owner']}><OwnerHouseEdit /></ProtectedRoute>} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}
