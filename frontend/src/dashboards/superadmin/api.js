import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axiosInstance from '../../utils/axiosInstance'
import { useToastStore } from '../../store/uiStore'

// ── Query keys ────────────────────────────────────────────────────────────────
export const adminKeys = {
  stats:     ()            => ['admin', 'stats'],
  clubs:     ()            => ['admin', 'clubs'],
  users:     ()            => ['admin', 'users'],
  roleMappings: ()         => ['admin', 'role-mappings'],
  certs:     (filters, p) => ['admin', 'certificates', filters, p],
  scanLogs:  (filters, p) => ['admin', 'scan-logs', filters, p],
  creditRules: ()          => ['admin', 'credit-rules'],
  activity:  ()            => ['admin', 'activity'],
}

// ── useAdminStats ─────────────────────────────────────────────────────────────
/**
 * GET /admin/stats
 * {
 *   total_clubs, total_users, total_students,
 *   total_events, active_events,
 *   total_certs, certs_today,
 *   pending_emails, failed_emails, emails_sent_today
 * }
 */
export function useAdminStats() {
  return useQuery({
    queryKey: adminKeys.stats(),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/admin/stats')
      return data
    },
    refetchInterval: 60_000,
  })
}

// ── useAdminClubs ─────────────────────────────────────────────────────────────
/**
 * GET /admin/clubs
 * Returns all clubs with aggregate counts.
 */
export function useAdminClubs() {
  return useQuery({
    queryKey: adminKeys.clubs(),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/admin/clubs')
      return data
    },
  })
}

// ── useCreateAdminClub ────────────────────────────────────────────────────────
/**
 * POST /admin/clubs
 * { name, slug, contact_email }
 */
export function useCreateAdminClub() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (payload) => axiosInstance.post('/admin/clubs', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.clubs() })
      qc.invalidateQueries({ queryKey: adminKeys.stats() })
      addToast({ type: 'success', message: 'Club created successfully.' })
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to create club.' })
    },
  })
}

// ── useAdminUsers ─────────────────────────────────────────────────────────────
/**
 * GET /admin/users
 * Returns all platform users (coordinators, admins).
 */
export function useAdminUsers() {
  return useQuery({
    queryKey: adminKeys.users(),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/admin/users')
      return data
    },
  })
}

// ── useCreateUser ─────────────────────────────────────────────────────────────
/**
 * POST /admin/users
 * { email, role, club_id?, name? }
 * Backend auto-generates initial password and emails the user.
 */
export function useCreateUser() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (payload) => axiosInstance.post('/admin/users', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.users() })
      qc.invalidateQueries({ queryKey: adminKeys.stats() })
      addToast({
        type: 'success',
        message: 'User created. Login credentials sent to their email.',
      })
    },
    onError: (err) => {
      addToast({
        type: 'error',
        message: err?.response?.data?.detail || 'Failed to create user.',
      })
    },
  })
}

// ── useResetUserPassword ──────────────────────────────────────────────────────
/**
 * POST /admin/users/:user_id/reset-password
 * Generates new temporary password and emails user.
 */
export function useResetUserPassword() {
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (userId) =>
      axiosInstance.post(`/admin/users/${userId}/reset-password`),
    onSuccess: () => {
      addToast({ type: 'success', message: 'Password reset. New credentials emailed.' })
    },
    onError: () => {
      addToast({ type: 'error', message: 'Password reset failed.' })
    },
  })
}

// ── useAdminRecentActivity ────────────────────────────────────────────────────
/**
 * GET /admin/activity
 * Recent platform activity: cert generations, registrations, logins.
 * Array<{ action, actor, target, timestamp }>
 */
export function useAdminRecentActivity() {
  return useQuery({
    queryKey: adminKeys.activity(),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/admin/activity')
      return data
    },
    refetchInterval: 30_000,
  })
}

// ── useAdminCertificates ──────────────────────────────────────────────────────
/**
 * GET /admin/certificates
 * Query params: club_id?, status?, date_from?, date_to?, page, limit
 *
 * Returns:
 * {
 *   items: Array<{
 *     cert_number, status, cert_type, issued_at,
 *     snapshot: { name, email, club_name, event_name }
 *   }>,
 *   total, page, pages
 * }
 */
export function useAdminCertificates(filters = {}, page = 1) {
  return useQuery({
    queryKey: adminKeys.certs(filters, page),
    queryFn: async () => {
      const params = { ...filters, page, limit: 50 }
      // Remove empty/undefined filter values
      Object.keys(params).forEach((k) => {
        if (params[k] === '' || params[k] == null) delete params[k]
      })
      const { data } = await axiosInstance.get('/admin/certificates', { params })
      return data
    },
    placeholderData: (prev) => prev,
  })
}

// ── useRevokeCertificate ──────────────────────────────────────────────────────
/**
 * PATCH /admin/certificates/:cert_number/revoke
 * Revokes an issued certificate.
 */
export function useRevokeCertificate() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (certNumber) =>
      axiosInstance.patch(`/admin/certificates/${certNumber}/revoke`),
    onSuccess: () => {
      // Invalidate all certificate queries (any filter/page combination)
      qc.invalidateQueries({ queryKey: ['admin', 'certificates'] })
      addToast({ type: 'success', message: 'Certificate revoked.' })
    },
    onError: (err) => {
      addToast({
        type: 'error',
        message: err?.response?.data?.detail || 'Failed to revoke certificate.',
      })
    },
  })
}

// ── useAdminScanLogs ──────────────────────────────────────────────────────────
/**
 * GET /admin/scan-logs
 * Query params: cert_number?, date_from?, date_to?, page, limit
 *
 * Returns:
 * {
 *   items: Array<{
 *     cert_number, scanned_at, ip_address, user_agent
 *   }>,
 *   total, page, pages
 * }
 */
export function useAdminScanLogs(filters = {}, page = 1) {
  return useQuery({
    queryKey: adminKeys.scanLogs(filters, page),
    queryFn: async () => {
      const params = { ...filters, page, limit: 50 }
      Object.keys(params).forEach((k) => {
        if (params[k] === '' || params[k] == null) delete params[k]
      })
      const { data } = await axiosInstance.get('/admin/scan-logs', { params })
      return data
    },
    placeholderData: (prev) => prev,
  })
}

// ── useCreditRules ────────────────────────────────────────────────────────────
/**
 * GET /admin/credit-rules
 * Returns:
 * Array<{ cert_type: string, points: number }>
 */
export function useCreditRules() {
  return useQuery({
    queryKey: adminKeys.creditRules(),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/admin/credit-rules')
      return data
    },
  })
}

// ── useUpdateCreditRules ──────────────────────────────────────────────────────
/**
 * PUT /admin/credit-rules
 * Body: { rules: Array<{ cert_type: string, points: number }> }
 * Replaces the full set of credit rules.
 */
export function useUpdateCreditRules() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (rules) =>
      axiosInstance.put('/admin/credit-rules', { rules }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.creditRules() })
      addToast({ type: 'success', message: 'Credit rules updated.' })
    },
    onError: (err) => {
      addToast({
        type: 'error',
        message: err?.response?.data?.detail || 'Failed to update credit rules.',
      })
    },
  })
}

// ── Role-Based Certificate Mapping ───────────────────────────────────────────
export function useRoleMappings(includeInactive = true) {
  return useQuery({
    queryKey: [...adminKeys.roleMappings(), includeInactive],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/role-presets', {
        params: includeInactive ? { include_inactive: true } : {},
      })
      return data
    },
  })
}

export function useCreateRoleMapping() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (payload) => axiosInstance.post('/role-presets', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.roleMappings() })
      addToast({ type: 'success', message: 'Certificate mapping created.' })
    },
    onError: (err) => {
      addToast({
        type: 'error',
        message: err?.response?.data?.detail || 'Failed to create mapping.',
      })
    },
  })
}

export function useUpdateRoleMapping() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: ({ roleName, payload }) => axiosInstance.put(`/role-presets/${roleName}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.roleMappings() })
      addToast({ type: 'success', message: 'Certificate mapping updated.' })
    },
    onError: (err) => {
      addToast({
        type: 'error',
        message: err?.response?.data?.detail || 'Failed to update mapping.',
      })
    },
  })
}

export function useSeedRoleMappings() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: () => axiosInstance.post('/role-presets/seed'),
    onSuccess: ({ data }) => {
      qc.invalidateQueries({ queryKey: adminKeys.roleMappings() })
      addToast({
        type: 'success',
        message: `Seed completed: ${data?.created ?? 0} created, ${data?.updated ?? 0} updated.`,
      })
    },
    onError: (err) => {
      addToast({
        type: 'error',
        message: err?.response?.data?.detail || 'Failed to seed mappings.',
      })
    },
  })
}

// ── useBulkImportStudents ─────────────────────────────────────────────────────
/**
 * POST /admin/users/bulk-import
 * Accepts a FormData with a single "file" field (.xlsx).
 * Returns { created, skipped, errors[] }
 */
export function useBulkImportStudents() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (file) => {
      const fd = new FormData()
      fd.append('file', file)
      return axiosInstance.post('/admin/users/bulk-import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onSuccess: ({ data }) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] })
      addToast({
        type: 'success',
        message: `${data.created} student${data.created !== 1 ? 's' : ''} imported, ${data.skipped} skipped.`,
      })
    },
    onError: (err) => {
      addToast({
        type: 'error',
        message: err?.response?.data?.detail || 'Bulk import failed.',
      })
    },
  })
}
