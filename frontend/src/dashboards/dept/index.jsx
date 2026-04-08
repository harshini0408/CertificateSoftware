import { useState, useEffect } from 'react'
import Navbar from '../../components/Navbar'
import Sidebar from '../../components/Sidebar'
import DataTable from '../../components/DataTable'
import LoadingSpinner from '../../components/LoadingSpinner'
import DeptFieldConfigurator from './DeptFieldConfigurator'
import {
  useDeptAssetStatus,
  useDeptCertificates,
  useDeptGenerateCertificates,
  useDeptStudents,
  useGetFieldPositions,
  downloadAllDeptCertificates,
  downloadDeptCertificatesZip,
} from './api'
import { useToastStore } from '../../store/uiStore'

function FeatureLanding({ onSelect }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <button
        onClick={() => onSelect('generate')}
        className="card p-6 text-left border-2 border-transparent hover:border-navy/30 transition-colors"
      >
        <h2 className="text-xl font-bold text-foreground">Generate Certificates</h2>
        <p className="mt-2 text-sm text-gray-500">
          Upload Excel with Name, Class, Contribution and generate department certificates using a single template.
        </p>
      </button>

      <button
        onClick={() => onSelect('credits')}
        className="card p-6 text-left border-2 border-transparent hover:border-navy/30 transition-colors"
      >
        <h2 className="text-xl font-bold text-foreground">View Student Credit Points</h2>
        <p className="mt-2 text-sm text-gray-500">
          View your department students and their current credit totals from issued certificates.
        </p>
      </button>
    </div>
  )
}

function GenerateCertificatesView() {
  const { data: assetStatus } = useDeptAssetStatus()
  const { data: savedPositions, isLoading: posLoading } = useGetFieldPositions()
  const [excelFile, setExcelFile] = useState(null)
  const [logoFile, setLogoFile] = useState(null)
  const [sig1File, setSig1File] = useState(null)
  const [sig2File, setSig2File] = useState(null)
  const [localError, setLocalError] = useState('')
  const [lastResult, setLastResult] = useState(null)
  const [showConfigurator, setShowConfigurator] = useState(false)
  const [isDownloadingAll, setIsDownloadingAll] = useState(false)
  const [isDownloadingBatch, setIsDownloadingBatch] = useState(false)
  const addToast = useToastStore((s) => s.addToast)

  // Check if first-time setup is needed
  useEffect(() => {
    if (assetStatus && !assetStatus.positions_configured && !posLoading) {
      setShowConfigurator(true)
    }
  }, [assetStatus, posLoading])

  const generateMutation = useDeptGenerateCertificates()
  const { data: certs, isLoading: certsLoading } = useDeptCertificates()

  const handleSubmit = (e) => {
    e.preventDefault()
    setLocalError('')

    if (!excelFile) {
      setLocalError('Please upload an Excel file.')
      return
    }

    const missingStoredAssets = assetStatus && (!assetStatus.has_logo || !assetStatus.has_signature_primary || !assetStatus.has_signature_secondary)
    if (missingStoredAssets && (!logoFile || !sig1File || !sig2File)) {
      setLocalError('First-time setup for your department requires Logo + Primary Signature + Secondary Signature.')
      return
    }

    const formData = new FormData()
    formData.append('excel_file', excelFile)
    if (logoFile) formData.append('logo_file', logoFile)
    if (sig1File) formData.append('signature_primary_file', sig1File)
    if (sig2File) formData.append('signature_secondary_file', sig2File)

    generateMutation.mutate(formData, {
      onSuccess: (data) => {
        setLastResult(data)
        setExcelFile(null)
      },
    })
  }

  const handleDownloadAll = async () => {
    setIsDownloadingAll(true)
    try {
      const blob = await downloadAllDeptCertificates()
      const url = window.URL.createObjectURL(new Blob([blob]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'certificates.zip')
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
    } catch (err) {
      addToast({ type: 'error', message: 'Failed to download certificates ZIP archive.' })
    } finally {
      setIsDownloadingAll(false)
    }
  }

  const handleDownloadBatch = async () => {
    const certNumbers = lastResult?.cert_numbers || []
    if (!certNumbers.length) {
      addToast({ type: 'error', message: 'No certificates found in the latest batch.' })
      return
    }

    setIsDownloadingBatch(true)
    try {
      const blob = await downloadDeptCertificatesZip(certNumbers)
      const url = window.URL.createObjectURL(new Blob([blob]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'dept_certs_batch.zip')
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
    } catch (err) {
      addToast({ type: 'error', message: 'Failed to download this batch ZIP archive.' })
    } finally {
      setIsDownloadingBatch(false)
    }
  }

  // If position config needed, show configurator only
  if (showConfigurator) {
    return (
      <DeptFieldConfigurator
        onComplete={() => {
          setShowConfigurator(false)
        }}
      />
    )
  }
  const certColumns = [
    {
      key: 'cert_number',
      header: 'Cert No',
      render: (v) => <span className="font-mono text-xs font-semibold text-navy">{v}</span>,
    },
    { key: 'name', header: 'Name', searchKey: true },
    { key: 'class_name', header: 'Class', searchKey: true },
    { key: 'contribution', header: 'Contribution', searchKey: true },
    {
      key: 'issued_at',
      header: 'Issued',
      render: (v) => (v ? new Date(v).toLocaleString('en-IN') : '—'),
    },
    {
      key: 'png_url',
      header: 'Action',
      render: (url) => (
        <a
          href={url}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium text-white bg-navy rounded hover:bg-navy/90 transition-colors"
        >
          📥 Download
        </a>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h2 className="text-lg font-bold text-foreground">Department Certificate Generation</h2>
        <p className="mt-1 text-sm text-gray-500">
          Single template with fields: Name, Class, Contribution. Credits are not awarded in this flow.
        </p>
        {savedPositions?.positions_configured && (
          <button
            onClick={() => setShowConfigurator(true)}
            className="btn-secondary mt-3"
          >
            ⚙️ Edit Position Configuration
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="card p-5 space-y-4">
        <div>
          <label className="form-label">Excel File * (columns: Name, Class, Contribution)</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            className="form-input"
            onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="form-label">Logo (optional if already saved)</label>
            <input type="file" accept="image/*" className="form-input" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
          </div>
          <div>
            <label className="form-label">Primary Signature (optional if already saved)</label>
            <input type="file" accept="image/*" className="form-input" onChange={(e) => setSig1File(e.target.files?.[0] || null)} />
          </div>
          <div>
            <label className="form-label">Secondary Signature (optional if already saved)</label>
            <input type="file" accept="image/*" className="form-input" onChange={(e) => setSig2File(e.target.files?.[0] || null)} />
          </div>
        </div>

        {assetStatus && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
            Stored assets for your department: Logo {assetStatus.has_logo ? 'Yes' : 'No'} | Primary Signature {assetStatus.has_signature_primary ? 'Yes' : 'No'} | Secondary Signature {assetStatus.has_signature_secondary ? 'Yes' : 'No'}
          </div>
        )}

        {localError && <p className="text-sm text-red-600">{localError}</p>}

        <button type="submit" className="btn-primary min-w-[180px]" disabled={generateMutation.isPending}>
          {generateMutation.isPending ? <LoadingSpinner size="sm" label="" /> : 'Generate Certificates'}
        </button>
      </form>

      {lastResult && (
        <div className="card p-4">
          <p className="text-sm font-medium text-navy">{lastResult.message}</p>
          <p className="mt-1 text-xs text-gray-500">Generated: {lastResult.generated} / Rows: {lastResult.total_rows}</p>
          {(lastResult.cert_numbers || []).length > 0 && (
            <button
              onClick={handleDownloadBatch}
              disabled={isDownloadingBatch}
              className="btn-secondary mt-3"
            >
              {isDownloadingBatch ? <LoadingSpinner size="sm" label="Zipping..." /> : '📦 Download this batch as ZIP'}
            </button>
          )}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="section-title mb-0">Recently Generated Department Certificates</h3>
          {certs?.length > 0 && (
            <button
              onClick={handleDownloadAll}
              disabled={isDownloadingAll}
              className="btn-secondary"
            >
              {isDownloadingAll ? <LoadingSpinner size="sm" label="Zipping..." /> : '📦 Download All as ZIP'}
            </button>
          )}
        </div>
        <DataTable
          columns={certColumns}
          data={certs || []}
          isLoading={certsLoading}
          emptyMessage="No department certificates generated yet."
          searchable
          searchPlaceholder="Search by name/class/contribution…"
          rowKey="id"
        />
      </div>
    </div>
  )
}

function CreditsView() {
  const { data: students, isLoading } = useDeptStudents({ sort_by: 'total_credits', order: 'desc' })

  const columns = [
    { key: 'student_name', header: 'Name', searchKey: true },
    { key: 'registration_number', header: 'Reg No', searchKey: true, render: (v) => <span className="font-mono text-xs">{v}</span> },
    { key: 'student_email', header: 'Email', searchKey: true },
    { key: 'department', header: 'Department', searchKey: true },
    { key: 'batch', header: 'Batch', searchKey: true },
    { key: 'section', header: 'Section', searchKey: true },
    { key: 'total_credits', header: 'Credits', align: 'right', render: (v) => <span className="font-semibold text-navy">{v ?? 0}</span> },
    { key: 'last_updated', header: 'Last Updated', render: (v) => (v ? new Date(v).toLocaleString('en-IN') : '—') },
  ]

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h2 className="text-lg font-bold text-foreground">Department Student Credit Points</h2>
        <p className="mt-1 text-sm text-gray-500">
          Credits shown here are from club-issued certificates mapped to student email IDs.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={students || []}
        isLoading={isLoading}
        emptyMessage="No student credit records found for your department."
        searchable
        searchPlaceholder="Search by name, reg no, email, batch…"
        rowKey="id"
      />
    </div>
  )
}

export default function DeptCoordinatorDashboard() {
  const [view, setView] = useState('home')

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main className="flex-1 overflow-y-auto bg-background">
          <div className="page-container space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Department Coordinator</h1>
                <p className="mt-0.5 text-sm text-gray-500">Choose what you want to do.</p>
              </div>

              {view !== 'home' && (
                <button className="btn-secondary" onClick={() => setView('home')}>
                  ← Back to Options
                </button>
              )}
            </div>

            {view === 'home' && <FeatureLanding onSelect={setView} />}
            {view === 'generate' && <GenerateCertificatesView />}
            {view === 'credits' && <CreditsView />}
          </div>
        </main>
      </div>
    </div>
  )
}
