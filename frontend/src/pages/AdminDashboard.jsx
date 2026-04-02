import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import DataTable from '../components/DataTable'
import StatusBadge from '../components/StatusBadge'
import StatCard from '../components/StatCard'
import ConfirmModal from '../components/ConfirmModal'
import LoadingSpinner from '../components/LoadingSpinner'
import {
  useAdminStats,
  useAdminClubs,
  useCreateAdminClub,
  useToggleClub,
  useAdminUsers,
  useCreateUser,
  useResetUserPassword,
  useToggleUser,
  useAdminRecentActivity,
} from '../api/admin'
import { useAllCerts, useRevokeCert } from '../api/certificates'

// ─── Tab ids ──────────────────────────────────────────────────────────────────
const TABS = ['overview', 'clubs', 'users', 'certificates']

const ROLES = [
  { value: 'club_coordinator',   label: 'Club Coordinator' },
  { value: 'dept_coordinator',   label: 'Department Coordinator' },
  { value: 'admin',              label: 'Admin' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Shared modal shell
// ─────────────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-modal overflow-hidden"
        style={{ animation: 'fadeIn 0.15s ease-out' }}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <button
            onClick={onClose}
            className="rounded p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Create Club Modal
// ─────────────────────────────────────────────────────────────────────────────
function CreateClubModal({ onClose }) {
  const createClub = useCreateAdminClub()
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm()

  // Auto-generate slug from name
  const nameVal = watch('name', '')
  const autoSlug = nameVal.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '')

  const onSubmit = async (values) => {
    await createClub.mutateAsync({ ...values, slug: values.slug || autoSlug })
    onClose()
  }

  const busy = isSubmitting || createClub.isPending

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="form-label" htmlFor="club-name">Club Name *</label>
        <input
          id="club-name"
          className={`form-input ${errors.name ? 'form-input-error' : ''}`}
          placeholder="e.g. ACM Student Chapter"
          disabled={busy}
          {...register('name', { required: 'Club name is required.' })}
        />
        {errors.name && <p className="form-error">{errors.name.message}</p>}
      </div>

      <div>
        <label className="form-label" htmlFor="club-slug">
          Slug
          <span className="ml-1 text-xs text-gray-400 font-normal">(auto-generated)</span>
        </label>
        <input
          id="club-slug"
          className="form-input font-mono text-sm"
          placeholder={autoSlug || 'acm-student-chapter'}
          disabled={busy}
          {...register('slug')}
        />
      </div>

      <div>
        <label className="form-label" htmlFor="club-email">Contact Email *</label>
        <input
          id="club-email"
          type="email"
          className={`form-input ${errors.contact_email ? 'form-input-error' : ''}`}
          placeholder="club@psgtech.ac.in"
          disabled={busy}
          {...register('contact_email', {
            required: 'Contact email is required.',
            pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email.' },
          })}
        />
        {errors.contact_email && <p className="form-error">{errors.contact_email.message}</p>}
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Creating…' : 'Create Club'}
        </button>
      </div>
    </form>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Create User Modal
// ─────────────────────────────────────────────────────────────────────────────
function CreateUserModal({ clubs, onClose }) {
  const createUser = useCreateUser()
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { role: 'club_coordinator' },
  })
  const role = watch('role')
  const busy = isSubmitting || createUser.isPending

  const onSubmit = async (values) => {
    await createUser.mutateAsync(values)
    onClose()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="form-label" htmlFor="user-name">Full Name</label>
        <input
          id="user-name"
          className="form-input"
          placeholder="Coordinator name"
          disabled={busy}
          {...register('name')}
        />
      </div>

      <div>
        <label className="form-label" htmlFor="user-email">Email *</label>
        <input
          id="user-email"
          type="email"
          className={`form-input ${errors.email ? 'form-input-error' : ''}`}
          placeholder="coordinator@psgtech.ac.in"
          disabled={busy}
          {...register('email', {
            required: 'Email is required.',
            pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email.' },
          })}
        />
        {errors.email && <p className="form-error">{errors.email.message}</p>}
      </div>

      <div>
        <label className="form-label" htmlFor="user-role">Role *</label>
        <select
          id="user-role"
          className="form-input"
          disabled={busy}
          {...register('role', { required: true })}
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      {role === 'club_coordinator' && (
        <div>
          <label className="form-label" htmlFor="user-club">Assign to Club *</label>
          <select
            id="user-club"
            className={`form-input ${errors.club_id ? 'form-input-error' : ''}`}
            disabled={busy}
            {...register('club_id', { required: role === 'club_coordinator' ? 'Select a club.' : false })}
          >
            <option value="">— Select club —</option>
            {(clubs ?? []).map((c) => (
              <option key={c._id ?? c.id} value={c._id ?? c.id}>{c.name}</option>
            ))}
          </select>
          {errors.club_id && <p className="form-error">{errors.club_id.message}</p>}
        </div>
      )}

      <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
        <p className="text-xs text-blue-700">
          A temporary password will be generated and emailed to the user automatically.
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Creating…' : 'Create User'}
        </button>
      </div>
    </form>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Overview Tab
// ─────────────────────────────────────────────────────────────────────────────
function OverviewTab({ stats, statsLoading, activity, activityLoading }) {
  const statItems = [
    { label: 'Total Clubs',      value: stats?.total_clubs,   accent: 'navy',  icon: clubIcon },
    { label: 'Active Events',    value: stats?.active_events, accent: 'green', icon: calIcon },
    { label: 'Total Events',     value: stats?.total_events,  accent: 'blue',  icon: calIcon },
    { label: 'Certs Issued',     value: stats?.total_certs,   accent: 'gold',  icon: certIcon },
    { label: 'Pending Emails',   value: stats?.pending_emails, accent: 'amber', icon: mailIcon },
    { label: 'Failed Emails',    value: stats?.failed_emails,  accent: 'red',   icon: alertIcon },
  ]

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {statItems.map((s) => (
          <StatCard
            key={s.label}
            label={s.label}
            value={s.value ?? 0}
            icon={s.icon}
            accent={s.accent}
            isLoading={statsLoading}
          />
        ))}
      </div>

      {/* Recent activity */}
      <div>
        <h2 className="section-title mb-3">Recent Activity</h2>
        {activityLoading ? (
          <LoadingSpinner label="Loading activity…" />
        ) : !activity?.length ? (
          <div className="card p-6 text-center text-sm text-gray-400">No recent activity.</div>
        ) : (
          <div className="card divide-y divide-gray-50 overflow-hidden">
            {(activity ?? []).slice(0, 12).map((item, i) => (
              <div key={i} className="flex items-start gap-3 px-5 py-3">
                <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-navy/30" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">
                    <span className="font-semibold">{item.actor}</span>
                    {' '}{item.action}{' '}
                    <span className="text-navy font-medium">{item.target}</span>
                  </p>
                </div>
                <time className="shrink-0 text-xs text-gray-400 mt-0.5">
                  {item.timestamp
                    ? new Date(item.timestamp).toLocaleTimeString('en-IN', {
                        hour: '2-digit', minute: '2-digit',
                      })
                    : '—'}
                </time>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Clubs Tab
// ─────────────────────────────────────────────────────────────────────────────
function ClubsTab({ navigate }) {
  const [showCreate, setShowCreate] = useState(false)
  const { data: clubs, isLoading } = useAdminClubs()
  const toggleClub = useToggleClub()

  const columns = [
    { key: 'name',          header: 'Club Name',     sortable: true, searchKey: true },
    { key: 'slug',          header: 'Slug',           render: (v) => <span className="font-mono text-xs text-gray-500">{v}</span> },
    { key: 'contact_email', header: 'Contact',        searchKey: true },
    {
      key: 'event_count',
      header: 'Events',
      align: 'right',
      render: (v) => (v ?? 0).toLocaleString(),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (v) => <StatusBadge status={v ? 'active' : 'inactive'} />,
    },
    {
      key: 'id',
      header: 'Actions',
      align: 'center',
      render: (id, row) => (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/club/${id}`) }}
            className="rounded px-2.5 py-1 text-xs font-medium text-navy border border-navy/20 hover:bg-navy hover:text-white transition-colors"
          >
            Open
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); toggleClub.mutate(id) }}
            disabled={toggleClub.isPending}
            className={`rounded px-2.5 py-1 text-xs font-medium border transition-colors
              ${row.is_active
                ? 'text-red-500 border-red-200 hover:bg-red-500 hover:text-white'
                : 'text-green-600 border-green-200 hover:bg-green-600 hover:text-white'
              }`}
          >
            {row.is_active ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <DataTable
        columns={columns}
        data={clubs ?? []}
        isLoading={isLoading}
        searchable
        searchPlaceholder="Search clubs…"
        emptyMessage="No clubs yet. Create your first club."
        rowKey="id"
        actions={
          <button id="admin-create-club" className="btn-primary text-sm" onClick={() => setShowCreate(true)}>
            + New Club
          </button>
        }
      />
      {showCreate && (
        <Modal title="Create Club" onClose={() => setShowCreate(false)}>
          <CreateClubModal onClose={() => setShowCreate(false)} />
        </Modal>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Users Tab
// ─────────────────────────────────────────────────────────────────────────────
function UsersTab() {
  const [showCreate, setShowCreate] = useState(false)
  const [confirmReset, setConfirmReset] = useState(null)

  const { data: users,  isLoading: usersLoading } = useAdminUsers()
  const { data: clubs }  = useAdminClubs()
  const toggleUser = useToggleUser()
  const resetPwd   = useResetUserPassword()

  const ROLE_BADGES = {
    admin:              'bg-red-100 text-red-700',
    dept_coordinator:   'bg-purple-100 text-purple-700',
    club_coordinator:   'bg-blue-100 text-blue-700',
    student:            'bg-gray-100 text-gray-600',
  }

  const columns = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      searchKey: true,
      render: (v, row) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">{v ?? '—'}</span>
          <span className="text-xs text-gray-400">{row.email}</span>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (v) => (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ROLE_BADGES[v] ?? 'bg-gray-100 text-gray-600'}`}>
          {(v ?? '').replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'club_name',
      header: 'Club',
      render: (v) => <span className="text-xs text-gray-500">{v ?? '—'}</span>,
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (v) => <StatusBadge status={v ? 'active' : 'inactive'} />,
    },
    {
      key: 'last_login',
      header: 'Last Login',
      render: (v) =>
        v
          ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
          : 'Never',
    },
    {
      key: 'id',
      header: 'Actions',
      align: 'center',
      render: (id, row) => (
        <div className="flex items-center justify-center gap-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmReset(row) }}
            className="rounded px-2 py-1 text-xs text-amber-600 border border-amber-200 hover:bg-amber-500 hover:text-white transition-colors"
            title="Reset password"
          >
            Reset Pwd
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); toggleUser.mutate(id) }}
            disabled={toggleUser.isPending}
            className={`rounded px-2 py-1 text-xs border transition-colors
              ${row.is_active
                ? 'text-red-500 border-red-200 hover:bg-red-500 hover:text-white'
                : 'text-green-600 border-green-200 hover:bg-green-600 hover:text-white'
              }`}
          >
            {row.is_active ? 'Disable' : 'Enable'}
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <DataTable
        columns={columns}
        data={users ?? []}
        isLoading={usersLoading}
        searchable
        searchPlaceholder="Search by name or email…"
        emptyMessage="No users found."
        rowKey="id"
        actions={
          <button id="admin-create-user" className="btn-primary text-sm" onClick={() => setShowCreate(true)}>
            + New User
          </button>
        }
      />

      {showCreate && (
        <Modal title="Create User" onClose={() => setShowCreate(false)}>
          <CreateUserModal clubs={clubs} onClose={() => setShowCreate(false)} />
        </Modal>
      )}

      {confirmReset && (
        <ConfirmModal
          title="Reset Password"
          message={`Reset password for ${confirmReset.name ?? confirmReset.email}? A new temporary password will be emailed to them.`}
          confirmLabel="Reset Password"
          variant="warning"
          onConfirm={async () => {
            await resetPwd.mutateAsync(confirmReset.id)
            setConfirmReset(null)
          }}
          onCancel={() => setConfirmReset(null)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Certificates Tab (admin view)
// ─────────────────────────────────────────────────────────────────────────────
function CertificatesAdminTab() {
  const [statusFilter, setStatusFilter] = useState('all')
  const [confirmRevoke, setConfirmRevoke] = useState(null)

  const filters = statusFilter !== 'all' ? { status: statusFilter } : {}
  const { data: certs, isLoading } = useAllCerts(filters)
  const revokeMutation = useRevokeCert()

  const CERT_STATUS_FILTERS = [
    { id: 'all',       label: 'All' },
    { id: 'generated', label: 'Generated' },
    { id: 'emailed',   label: 'Emailed' },
    { id: 'failed',    label: 'Failed' },
    { id: 'revoked',   label: 'Revoked' },
  ]

  const columns = [
    {
      key: 'cert_number',
      header: 'Cert No.',
      sortable: true,
      searchKey: true,
      render: (v) => <span className="font-mono text-xs font-semibold text-navy">{v ?? '—'}</span>,
    },
    {
      key: 'participant_email',
      header: 'Participant',
      sortable: true,
      searchKey: true,
      render: (v, row) => (
        <div className="flex flex-col">
          <span className="text-sm">{row.participant_name ?? v}</span>
          {row.participant_name && <span className="text-xs text-gray-400">{v}</span>}
        </div>
      ),
    },
    {
      key: 'event_name',
      header: 'Event',
      sortable: true,
      searchKey: true,
      render: (v, row) => (
        <div className="flex flex-col">
          <span className="text-sm">{v}</span>
          <span className="text-xs text-gray-400">{row.club_name}</span>
        </div>
      ),
    },
    {
      key: 'cert_type',
      header: 'Type',
      render: (v) => <span className="text-xs capitalize">{(v ?? '').replace(/_/g, ' ')}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: 'id',
      header: 'Actions',
      align: 'center',
      render: (id, row) => (
        <div className="flex items-center justify-center gap-2">
          {row.pdf_url && (
            <a
              href={row.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="rounded p-1 text-navy hover:bg-navy/10 transition-colors"
              title="Download"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </a>
          )}
          {row.status !== 'revoked' && (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmRevoke(row) }}
              className="rounded px-2 py-1 text-xs text-red-500 border border-red-200 hover:bg-red-500 hover:text-white transition-colors"
            >
              Revoke
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      {/* Status filter */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        {CERT_STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            id={`admin-cert-filter-${f.id}`}
            onClick={() => setStatusFilter(f.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors
              ${statusFilter === f.id ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-navy'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={certs ?? []}
        isLoading={isLoading}
        searchable
        searchPlaceholder="Search cert no., email, event…"
        emptyMessage="No certificates found."
        rowKey="id"
      />

      {confirmRevoke && (
        <ConfirmModal
          title="Revoke Certificate"
          message={`Revoke certificate ${confirmRevoke.cert_number} for ${confirmRevoke.participant_email}? This action cannot be undone.`}
          confirmLabel="Revoke"
          variant="danger"
          onConfirm={async () => {
            await revokeMutation.mutateAsync(confirmRevoke.id)
            setConfirmRevoke(null)
          }}
          onCancel={() => setConfirmRevoke(null)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline SVG icons (used in stat cards)
// ─────────────────────────────────────────────────────────────────────────────
const clubIcon = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)
const calIcon = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)
const certIcon = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
  </svg>
)
const mailIcon = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
)
const alertIcon = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

// ─────────────────────────────────────────────────────────────────────────────
// AdminDashboard (main export)
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const navigate    = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')

  const { data: stats,    isLoading: statsLoading    } = useAdminStats()
  const { data: activity, isLoading: activityLoading } = useAdminRecentActivity()

  const TAB_LABELS = {
    overview:     'Overview',
    clubs:        'Clubs',
    users:        'Users',
    certificates: 'Certificates',
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main className="flex-1 overflow-y-auto bg-background">
          <div className="page-container">

            {/* ── Page header ────────────────────────────────────────── */}
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
                <p className="mt-0.5 text-sm text-gray-500">
                  Platform-wide management for PSG iTech Certificate System.
                </p>
              </div>
              {/* Live pulse indicator */}
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                Live
              </div>
            </div>

            {/* ── Tab bar ────────────────────────────────────────────── */}
            <div className="mb-6 flex gap-1 border-b border-gray-200">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  id={`admin-tab-${tab}`}
                  onClick={() => setActiveTab(tab)}
                  className={`
                    relative px-4 py-2.5 text-sm font-medium capitalize transition-colors
                    ${activeTab === tab
                      ? 'text-navy after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-navy after:rounded-t-full'
                      : 'text-gray-500 hover:text-navy'
                    }
                  `}
                >
                  {TAB_LABELS[tab]}
                </button>
              ))}
            </div>

            {/* ── Tab content ────────────────────────────────────────── */}
            {activeTab === 'overview' && (
              <OverviewTab
                stats={stats}
                statsLoading={statsLoading}
                activity={activity}
                activityLoading={activityLoading}
              />
            )}
            {activeTab === 'clubs' && (
              <ClubsTab navigate={navigate} />
            )}
            {activeTab === 'users' && (
              <UsersTab />
            )}
            {activeTab === 'certificates' && (
              <CertificatesAdminTab />
            )}

          </div>
        </main>
      </div>
    </div>
  )
}
