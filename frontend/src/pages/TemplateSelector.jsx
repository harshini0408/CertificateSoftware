import { useQuery, useMutation } from '@tanstack/react-query'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { templateApi } from '../api/templates'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import LoadingSpinner from '../components/LoadingSpinner'

function TemplatePreviewMock({ template }) {
  const bg = template.background || {}
  const bgStyle =
    bg.type === 'gradient' && bg.colors?.length >= 2
      ? { background: `linear-gradient(135deg, ${bg.colors[0]}, ${bg.colors[1]})` }
      : { backgroundColor: bg.colors?.[0] || '#FFFFFF' }

  return (
    <div
      className="relative w-full overflow-hidden rounded border border-gray-200 shadow-sm"
      style={{ aspectRatio: '210/297', ...bgStyle }}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
        {/* Placeholder label for cert_type */}
        <span className="mb-4 rounded bg-white/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-navy shadow-sm backdrop-blur-sm">
          {template.cert_type.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Render slot outlines */}
      {(template.field_slots || []).map((slot, i) => (
        <div
          key={i}
          className="absolute flex items-center justify-center border border-dashed border-indigo-400 bg-indigo-400/10"
          style={{
            left: `${slot.x}%`,
            top: `${slot.y}%`,
            width: `${slot.width}%`,
            height: `${slot.height}%`,
          }}
        >
          <span className="truncate px-1 text-[6px] font-medium text-indigo-700 opacity-60">
            {slot.label}
          </span>
        </div>
      ))}
    </div>
  )
}

function TemplateCard({ template, onSelect, selecting }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md">
      <TemplatePreviewMock template={template} />
      <div className="flex flex-1 flex-col justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground line-clamp-2" title={template.name}>
          {template.name}
        </h3>
        <button
          className="btn-primary w-full text-xs"
          onClick={() => onSelect(template)}
          disabled={selecting}
        >
          {selecting ? 'Assigning...' : 'Select & Configure Slots'}
        </button>
      </div>
    </div>
  )
}

export default function TemplateSelector() {
  const { clubId, eventId } = useParams()
  const [searchParams] = useSearchParams()
  const certType = searchParams.get('certType') || 'participant'
  const navigate = useNavigate()

  const { data: templates, isLoading, isError } = useQuery({
    queryKey: ['templates', clubId],
    queryFn: () => templateApi.getPresets(clubId),
  })

  const assignMutation = useMutation({
    mutationFn: (templateId) => templateApi.assignToEvent(clubId, eventId, certType, templateId),
    onSuccess: (_, templateId) => {
      navigate(`/clubs/${clubId}/events/${eventId}/templates/${templateId}/slots?certType=${certType}`)
    },
  })

  // Group fetched templates into Presets and Custom
  const presets = (templates || []).filter((t) => t.is_preset && t.cert_type === certType)
  const customs = (templates || []).filter((t) => !t.is_preset && t.cert_type === certType)

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
              <div>
                <button
                  onClick={() => navigate(-1)}
                  className="mb-2 flex items-center gap-1.5 text-sm text-gray-500 hover:text-navy transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to Event
                </button>
                <h1 className="text-2xl font-bold text-navy">
                  Select Template — <span className="capitalize text-gold">{certType.replace(/_/g, ' ')}</span>
                </h1>
                <p className="mt-1 text-sm text-gray-600">
                  Choose a preset or a custom template for this certificate type.
                </p>
              </div>
            </div>

            {isLoading ? (
              <LoadingSpinner fullPage label="Loading templates..." />
            ) : isError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                Failed to load templates. Please try again.
              </div>
            ) : (
              <div className="space-y-12">
                {/* ── Presets Section ── */}
                <section>
                  <h2 className="mb-4 text-lg font-semibold text-foreground">Preset Templates</h2>
                  {presets.length === 0 ? (
                    <p className="text-sm text-gray-500">No preset templates match "{certType}".</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {presets.map((t) => (
                        <TemplateCard
                          key={t._id || t.id}
                          template={t}
                          onSelect={(tpl) => assignMutation.mutate(tpl._id || tpl.id)}
                          selecting={assignMutation.isPending && assignMutation.variables === (t._id || t.id)}
                        />
                      ))}
                    </div>
                  )}
                </section>

                {/* ── Custom Section ── */}
                <section>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-foreground">Club Custom Templates</h2>
                    <button className="btn-secondary text-sm disabled:opacity-50" disabled>
                      + Add Custom
                    </button>
                  </div>
                  {customs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 py-12 text-center">
                      <svg className="mb-3 h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      <p className="text-sm font-medium text-gray-900">No Custom Templates</p>
                      <p className="text-xs text-gray-500 mt-1">This club has not built any custom {certType} templates yet.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {customs.map((t) => (
                        <TemplateCard
                          key={t._id || t.id}
                          template={t}
                          onSelect={(tpl) => assignMutation.mutate(tpl._id || tpl.id)}
                          selecting={assignMutation.isPending && assignMutation.variables === (t._id || t.id)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
