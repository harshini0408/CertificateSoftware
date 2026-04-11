import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'

import Navbar from '../../components/Navbar'
import Sidebar from '../../components/Sidebar'
import StatCard from '../../components/StatCard'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import FileUpload from '../../components/FileUpload'
import LoadingSpinner from '../../components/LoadingSpinner'

import { useChangePassword } from '../auth/api'

import {
  useDeptDashboard,
  useDeptEvents,
  useDeptEvent,
  useCreateDeptEvent,
  useDeptAssets,
  useUpdateDeptAssets,
} from './api'
import { BACKEND_URL } from '../../utils/axiosInstance'
import DeptEventCertificateConfigurator from './DeptEventCertificateConfigurator'
import DeptCertificateIssue from './DeptCertificateIssue'

const TABS = ['events', 'settings']

const TAB_LABELS = {
  events: 'Department Dashboard',
  settings: 'Settings',
}

function fmtDate(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const Icon = {
  events: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  certs: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>,
  participants: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
}

function DashboardTab() {
  const { data, isLoading } = useDeptDashboard()

  if (isLoading) return <LoadingSpinner fullPage label="Loading dashboard..." />

  const stats = data?.stats || {}
  const recentEvents = data?.recent_events || []

  const eventColumns = [
    { key: 'name', header: 'Event', sortable: true },
    { key: 'event_date', header: 'Date', sortable: true, render: (v) => fmtDate(v) },
    { key: 'status', header: 'Status', render: (v) => <StatusBadge status={v} /> },
    { key: 'participant_count', header: 'Participants', align: 'right', render: (v) => (v ?? 0).toLocaleString() },
    { key: 'cert_count', header: 'Certs Issued', align: 'right', render: (v) => (v ?? 0).toLocaleString() },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Department Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total Events" value={stats.total_events ?? 0} icon={Icon.events} accent="navy" />
        <StatCard label="Certificates Issued" value={stats.total_certificates_issued ?? 0} icon={Icon.certs} accent="green" />
        <StatCard label="Total Participants" value={stats.total_participants ?? 0} icon={Icon.participants} accent="blue" />
      </div>

      <div>
        <h2 className="section-title mb-3">Recent Events</h2>
        <DataTable
          columns={eventColumns}
          data={recentEvents}
          isLoading={false}
          emptyMessage="No events yet. Create your first event."
          rowKey="id"
        />
      </div>
    </div>
  )
}

function EventsTab() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: events, isLoading } = useDeptEvents()
  const createEvent = useCreateDeptEvent()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name: '',
      event_date: '',
    },
  })

  const isModalOpen = searchParams.get('openEvent') === '1'

  const openModal = () => {
    const next = new URLSearchParams(searchParams)
    next.set('openEvent', '1')
    setSearchParams(next, { replace: true })
  }

  const closeModal = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('openEvent')
    setSearchParams(next, { replace: true })
  }

  const onSubmit = async (values) => {
    const payload = {
      name: values.name,
      event_date: values.event_date || null,
    }
    const created = await createEvent.mutateAsync(payload)
    const eventId = created?.id || created?._id
    closeModal()
    reset()
    if (eventId) {
      navigate(`/dept/events/${eventId}`)
    }
  }

  const eventColumns = [
    {
      key: 'name',
      header: 'Event Name',
      sortable: true,
      searchKey: true,
      render: (v, row) => (
        <button
          className="text-sm font-semibold text-navy hover:underline text-left"
          onClick={() => navigate(`/dept/events/${row.id ?? row._id}`)}
        >
          {v}
        </button>
      ),
    },
    { key: 'event_date', header: 'Date', sortable: true, render: (v) => fmtDate(v) },
    { key: 'status', header: 'Status', render: (v) => <StatusBadge status={v} /> },
    { key: 'participant_count', header: 'Participants', align: 'right', render: (v) => (v ?? 0).toLocaleString() },
    { key: 'cert_count', header: 'Certs Issued', align: 'right', render: (v) => (v ?? 0).toLocaleString() },
    {
      key: '_actions',
      header: 'Actions',
      searchKey: false,
      render: (_, row) => (
        <button className="btn-secondary text-xs" onClick={() => navigate(`/dept/events/${row.id ?? row._id}`)}>
          Configure & Generate
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Events</h1>
        <button className="btn-primary" onClick={openModal}>+ New Event</button>
      </div>

      <DataTable
        columns={eventColumns}
        data={events ?? []}
        isLoading={isLoading}
        emptyMessage="No events yet. Click '+ New Event' to create one."
        searchable
        searchPlaceholder="Search events..."
        rowKey="id"
      />

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-navy">Create New Event</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">x</button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div>
                <label className="form-label" htmlFor="name">Event Name *</label>
                <input
                  id="name"
                  type="text"
                  className={`form-input ${errors.name ? 'form-input-error' : ''}`}
                  placeholder="e.g. Department Symposium"
                  {...register('name', { required: 'Event name is required' })}
                />
                {errors.name && <p className="form-error">{errors.name.message}</p>}
              </div>

              <div>
                <label className="form-label" htmlFor="event_date">Event Date</label>
                <input id="event_date" type="date" className="form-input" {...register('event_date')} />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={isSubmitting || createEvent.isPending} className="btn-primary">
                  {(isSubmitting || createEvent.isPending) ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function EventDetailView({ eventId }) {
  const navigate = useNavigate()
  const { data: event, isLoading } = useDeptEvent(eventId)
  const [activeTab, setActiveTab] = useState('overview')

  if (isLoading) {
    return <LoadingSpinner fullPage label="Loading event..." />
  }

  if (!event) {
    return (
      <div className="space-y-4">
        <button className="btn-secondary" onClick={() => navigate('/dept?tab=events')}>Back to Events</button>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Event not found.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <button className="btn-secondary" onClick={() => navigate('/dept?tab=events')}>Back to Events</button>
      <div className="card p-4">
        <h1 className="text-2xl font-bold text-foreground">{event.name}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {event.event_date ? fmtDate(event.event_date) : 'No date'}
        </p>
      </div>

      <div className="mb-2 flex gap-1 border-b border-gray-200 overflow-x-auto scrollbar-hide">
        {['overview', 'certificates'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`relative whitespace-nowrap shrink-0 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'text-navy after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-navy after:rounded-t-full'
                : 'text-gray-500 hover:text-navy'
            }`}
          >
            {tab === 'overview' ? 'Overview' : 'Certificates'}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <DeptEventCertificateConfigurator
          event={event}
          onClose={(action) => {
            if (action?.nextTab === 'certificates') {
              setActiveTab('certificates')
              return
            }
            navigate('/dept?tab=events')
          }}
        />
      )}
      {activeTab === 'certificates' && (
        <DeptCertificateIssue event={event} />
      )}
    </div>
  )
}

function SettingsTab() {
  const { data: assets, isLoading: assetsLoading } = useDeptAssets()
  const updateAssets = useUpdateDeptAssets()
  const changePassword = useChangePassword()

  const [logoFile, setLogoFile] = useState(null)
  const [signatureFile, setSignatureFile] = useState(null)

  const [logoPreview, setLogoPreview] = useState(null)
  const [signaturePreview, setSignaturePreview] = useState(null)

  const toAssetSrc = (url, hash) => {
    if (!url) return null
    const withVersion = hash ? `${url}${url.includes('?') ? '&' : '?'}v=${hash}` : url
    if (withVersion.startsWith('blob:') || withVersion.startsWith('http')) return withVersion
    return `${BACKEND_URL}${withVersion}`
  }

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview(toAssetSrc(assets?.logo_url, assets?.logo_hash))
      return undefined
    }
    const objectUrl = URL.createObjectURL(logoFile)
    setLogoPreview(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [logoFile, assets?.logo_url, assets?.logo_hash])

  useEffect(() => {
    if (!signatureFile) {
      setSignaturePreview(toAssetSrc(assets?.signature_url, assets?.signature_hash))
      return undefined
    }
    const objectUrl = URL.createObjectURL(signatureFile)
    setSignaturePreview(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [signatureFile, assets?.signature_url, assets?.signature_hash])

  const handleAssetSave = () => {
    if (!logoFile && !signatureFile) return
    updateAssets.mutate({ logoFile, signatureFile }, {
      onSuccess: () => {
        setLogoFile(null)
        setSignatureFile(null)
      },
    })
  }

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      current_password: '',
      new_password: '',
      confirm_password: '',
    },
  })

  const onPasswordSubmit = (values) => {
    changePassword.mutate(
      { current_password: values.current_password, new_password: values.new_password },
      { onSuccess: () => reset() },
    )
  }

  if (assetsLoading) {
    return <LoadingSpinner fullPage label="Loading settings..." />
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="card p-5 space-y-4">
        <h2 className="section-title">Department Assets</h2>
        <p className="text-sm text-gray-500">
          Upload department logo and coordinator signature. These can be updated anytime.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FileUpload
            id="dept-logo-upload"
            accept="image/*"
            label="Department Logo"
            hint="PNG/JPG"
            maxSizeMB={5}
            onFile={setLogoFile}
          />
          <FileUpload
            id="dept-signature-upload"
            accept="image/*"
            label="Coordinator Signature"
            hint="PNG/JPG"
            maxSizeMB={5}
            onFile={setSignatureFile}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium mb-2">Logo Preview</p>
            {logoPreview ? (
              <img src={logoPreview} alt="Logo preview" className="h-24 w-auto rounded border border-gray-200 bg-gray-50 p-2 object-contain" />
            ) : <p className="text-xs text-gray-400">No logo uploaded.</p>}
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Signature Preview</p>
            {signaturePreview ? (
              <img src={signaturePreview} alt="Signature preview" className="h-24 w-auto rounded border border-gray-200 bg-gray-50 p-2 object-contain" />
            ) : <p className="text-xs text-gray-400">No signature uploaded.</p>}
          </div>
        </div>

        <div className="flex justify-end">
          <button className="btn-primary" onClick={handleAssetSave} disabled={updateAssets.isPending || (!logoFile && !signatureFile)}>
            {updateAssets.isPending ? 'Saving...' : 'Save Assets'}
          </button>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="section-title mb-4">Change Password</h2>
        <form onSubmit={handleSubmit(onPasswordSubmit)} className="space-y-4">
          <div>
            <label className="form-label">Current Password</label>
            <input
              type="password"
              className={`form-input ${errors.current_password ? 'form-input-error' : ''}`}
              {...register('current_password', { required: 'Current password is required' })}
            />
            {errors.current_password && <p className="form-error">{errors.current_password.message}</p>}
          </div>
          <div>
            <label className="form-label">New Password</label>
            <input
              type="password"
              className={`form-input ${errors.new_password ? 'form-input-error' : ''}`}
              {...register('new_password', { required: 'New password is required', minLength: { value: 8, message: 'Minimum 8 characters' } })}
            />
            {errors.new_password && <p className="form-error">{errors.new_password.message}</p>}
          </div>
          <div>
            <label className="form-label">Confirm New Password</label>
            <input
              type="password"
              className={`form-input ${errors.confirm_password ? 'form-input-error' : ''}`}
              {...register('confirm_password', {
                required: 'Confirm your new password',
                validate: (v) => v === watch('new_password') || 'Passwords do not match',
              })}
            />
            {errors.confirm_password && <p className="form-error">{errors.confirm_password.message}</p>}
          </div>
          <button type="submit" className="btn-primary" disabled={changePassword.isPending}>
            {changePassword.isPending ? 'Updating...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function DeptCoordinatorDashboard() {
  const { event_id: eventId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()

  const activeTab = TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'events'

  const setTab = (tab) => {
    setSearchParams({ tab }, { replace: true })
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="page-container">
            <div className="mb-6 flex gap-1 border-b border-gray-200">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setTab(tab)}
                  className={`relative px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
                    activeTab === tab
                      ? 'text-navy after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-navy after:rounded-t-full'
                      : 'text-gray-500 hover:text-navy'
                  }`}
                >
                  {TAB_LABELS[tab] || tab}
                </button>
              ))}
            </div>

            {eventId ? (
              <EventDetailView eventId={eventId} />
            ) : (
              <>
                {activeTab === 'events' && <EventsTab />}
                {activeTab === 'settings' && <SettingsTab />}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
