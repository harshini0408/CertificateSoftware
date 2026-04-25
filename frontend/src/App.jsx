import { Routes, Route, Navigate } from 'react-router-dom'

import ProtectedRoute from './components/ProtectedRoute'
import ToastProvider from './components/ToastProvider'
import AuthSessionSync from './components/AuthSessionSync'

// ── Pages ─────────────────────────────────────────────────────────────────────
import Login from './dashboards/auth/Login'
import AdminDashboard from './dashboards/superadmin'
import ClubDashboard from './dashboards/club'
import EventDetail from './dashboards/club/EventDetail'
import DeptCoordinatorDashboard from './dashboards/dept'
import TutorDashboard from './dashboards/tutor'
import StudentDashboard from './dashboards/student'
import PrincipalDashboard from './dashboards/principal'
import VerifyPage from './pages/Verify'
import TemplateSelector from './dashboards/club/TemplateSelector'
import GuestDashboard from './dashboards/guest/GuestDashboard'
import GuestHistory from './dashboards/guest/GuestHistory'
import Footer from './components/Footer'
import Authors from './Authors'

// ── Role constants ─────────────────────────────────────────────────────────────
const ROLES = {
  SUPER_ADMIN: 'super_admin',
  PRINCIPAL: 'principal',
  CLUB_COORD: 'club_coordinator',
  DEPT_COORD: 'dept_coordinator',
  TUTOR: 'tutor',
  STUDENT: 'student',
  GUEST: 'guest',
}

export default function App() {
  return (
    <>
      {/* Global toast portal */}
      <ToastProvider />
      <AuthSessionSync />

      <Routes>
        {/* ── Public routes ──────────────────────────────────────────────── */}
        <Route path="/login" element={<Login />} />
        <Route path="/verify/:cert_number" element={<VerifyPage />} />
        <Route path="/authors" element={<Authors />} />

        {/* ── Super admin ────────────────────────────────────────────────── */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* ── Principal ─────────────────────────────────────────────────── */}
        <Route
          path="/principal"
          element={
            <ProtectedRoute allowedRoles={[ROLES.PRINCIPAL, ROLES.SUPER_ADMIN]}>
              <PrincipalDashboard />
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
              allowedRoles={[ROLES.CLUB_COORD, ROLES.SUPER_ADMIN]}
            >
              <EventDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/club/:club_id/events/:event_id/templates/select"
          element={
            <ProtectedRoute allowedRoles={[ROLES.CLUB_COORD, ROLES.SUPER_ADMIN]}>
              <TemplateSelector />
            </ProtectedRoute>
          }
        />

        {/* ── Guest dashboard ────────────────────────────────────────────── */}
        <Route
          path="/guest"
          element={
            <ProtectedRoute allowedRoles={[ROLES.GUEST]}>
              <GuestDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/guest/history"
          element={
            <ProtectedRoute allowedRoles={[ROLES.GUEST]}>
              <GuestHistory />
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
        <Route
          path="/dept/events/:event_id"
          element={
            <ProtectedRoute allowedRoles={[ROLES.DEPT_COORD, ROLES.SUPER_ADMIN]}>
              <DeptCoordinatorDashboard />
            </ProtectedRoute>
          }
        />

        {/* ── Student ────────────────────────────────────────────────────── */}
        <Route
          path="/tutor"
          element={
            <ProtectedRoute allowedRoles={[ROLES.TUTOR]}>
              <TutorDashboard />
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
      <Footer />
    </>
  )
}
