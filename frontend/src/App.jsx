import { Routes, Route, Navigate } from 'react-router-dom'

import ProtectedRoute from './components/ProtectedRoute'
import ToastProvider from './components/ToastProvider'

// ── Pages ─────────────────────────────────────────────────────────────────────
import Login from './pages/Login'
import AdminDashboard from './pages/AdminDashboard'
import ClubDashboard from './pages/ClubDashboard'
import EventDetail from './pages/EventDetail'
import DeptCoordinatorDashboard from './pages/DeptCoordinatorDashboard'
import StudentDashboard from './pages/StudentDashboard'
import VerifyPage from './pages/VerifyPage'
import TemplateSelector from './pages/TemplateSelector'

// ── Role constants ─────────────────────────────────────────────────────────────
const ROLES = {
  SUPER_ADMIN: 'super_admin',
  CLUB_COORD: 'club_coordinator',
  DEPT_COORD: 'dept_coordinator',
  STUDENT: 'student',
  GUEST: 'guest',
}

export default function App() {
  return (
    <>
      {/* Global toast portal */}
      <ToastProvider />

      <Routes>
        {/* ── Public routes ──────────────────────────────────────────────── */}
        <Route path="/login" element={<Login />} />
        <Route path="/verify/:cert_number" element={<VerifyPage />} />

        {/* ── Super admin ────────────────────────────────────────────────── */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* ── Club coordinator ───────────────────────────────────────────── */}
        <Route
          path="/club/:club_id"
          element={
            <ProtectedRoute allowedRoles={[ROLES.CLUB_COORD, ROLES.SUPER_ADMIN]}>
              <ClubDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/club/:club_id/events/:event_id"
          element={
            <ProtectedRoute
              allowedRoles={[ROLES.CLUB_COORD, ROLES.SUPER_ADMIN, ROLES.GUEST]}
            >
              <EventDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/club/:club_id/events/:event_id/templates/select"
          element={
            <ProtectedRoute allowedRoles={[ROLES.CLUB_COORD, ROLES.SUPER_ADMIN, ROLES.GUEST]}>
              <TemplateSelector />
            </ProtectedRoute>
          }
        />

        {/* ── Dept coordinator ───────────────────────────────────────────── */}
        <Route
          path="/dept"
          element={
            <ProtectedRoute allowedRoles={[ROLES.DEPT_COORD, ROLES.SUPER_ADMIN]}>
              <DeptCoordinatorDashboard />
            </ProtectedRoute>
          }
        />

        {/* ── Student ────────────────────────────────────────────────────── */}
        <Route
          path="/student"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STUDENT]}>
              <StudentDashboard />
            </ProtectedRoute>
          }
        />

        {/* ── Fallback ───────────────────────────────────────────────────── */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  )
}
