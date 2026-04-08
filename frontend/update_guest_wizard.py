import os
import re

file_path = r'd:\CertificateSoftware\frontend\src\components\GuestWizard.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Helpers
content = content.replace("const isValidId = (v) => v && v !== 'null' && v !== 'undefined'\n\n", "")

# Step signatures and APIs
content = content.replace(
    "function Step1({ clubId, eventId, initialTemplateUrl, initialBlobUrl, onComplete }) {",
    "function Step1({ initialTemplateUrl, initialBlobUrl, onComplete }) {"
)
content = content.replace(
    "`/clubs/${clubId}/events/${eventId}/guest/template`",
    "`/guest/template`"
)

content = content.replace(
    "function Step2({ clubId, eventId, initialState, onComplete, onBack }) {",
    "function Step2({ initialState, onComplete, onBack }) {"
)
content = content.replace(
    "`/clubs/${clubId}/events/${eventId}/guest/excel`",
    "`/guest/excel`"
)
content = content.replace(
    "`/clubs/${clubId}/events/${eventId}/guest/config`",
    "`/guest/config`"
)

content = content.replace(
    "function Step3({ clubId, eventId, templateUrl, templateBlobUrl, selectedColumns, initialPositions, onComplete, onBack }) {",
    "function Step3({ templateUrl, templateBlobUrl, selectedColumns, initialPositions, onComplete, onBack }) {"
)
content = content.replace(
    "`/clubs/${clubId}/events/${eventId}/field-positions`",
    "`/guest/field-positions`"
)

content = content.replace(
    "function Step4({ clubId, eventId, rowCount, onComplete, onBack }) {",
    "function Step4({ rowCount, onComplete, onBack }) {"
)
content = content.replace(
    "`/clubs/${clubId}/events/${eventId}/guest/generate`",
    "`/guest/generate`"
)

content = content.replace(
    "function Step5({ clubId, eventId, generatedCount, emailsSent: initialEmailsSent, onBack }) {",
    "function Step5({ generatedCount, emailsSent: initialEmailsSent, onBack }) {"
)
content = content.replace(
    "`/clubs/${clubId}/events/${eventId}/guest/send-emails`",
    "`/guest/send-emails`"
)
content = content.replace(
    "`/clubs/${clubId}/events/${eventId}/guest/zip`",
    "`/guest/zip`"
)
content = content.replace(
    "a.download = `certificates_${eventId}.zip`",
    "a.download = `certificates.zip`"
)

# GuestWizard main body
main_body_old = """export default function GuestWizard({ clubId: propClubId, eventId: propEventId }) {
  const auth = useAuthStore()

  // Resolve IDs: URL params take priority; fall back to auth store JWT values.
  // Guards against the string "null"/"undefined" that occurs when auth-store
  // values are used to build the URL before being populated.
  const clubId  = isValidId(propClubId)  ? propClubId  : auth.club_id
  const eventId = isValidId(propEventId) ? propEventId : auth.event_id

  const [step, setStep]         = useState(1)
  const [loading, setLoading]   = useState(true)
  const [status, setStatus]     = useState(null)

  // Per-step state carried between wizard steps
  const [templateUrl,    setTemplateUrl]    = useState(null)  // server path /storage/guest_templates/…
  const [templateBlob,   setTemplateBlob]   = useState(null)  // blob: URL for instant canvas display
  const [excelState,     setExcelState]     = useState(null)  // { headers, rowCount, selectedColumns, emailColumn }
  const [fieldPositions, setFieldPositions] = useState(null)  // { positions }
  const [generatedCount, setGeneratedCount] = useState(0)

  // Load persisted progress from backend on mount
  useEffect(() => {
    if (!clubId || !eventId) { setLoading(false); return }
    ;(async () => {
      try {
        const { data } = await axiosInstance.get(`/clubs/${clubId}/events/${eventId}/guest/status`)
        setStatus(data)
        if (data.template_url) setTemplateUrl(data.template_url)
        if (data.step2_complete) {
          setExcelState({
            headers:         data.all_excel_headers,
            rowCount:        data.excel_row_count,
            selectedColumns: data.selected_columns,
            emailColumn:     data.email_column,
          })
        }
        if (data.step3_complete && data.field_positions) {
          setFieldPositions({ positions: data.field_positions.column_positions })
        }
        if (data.step4_complete) setGeneratedCount(data.generated_count)

        // Resume at the furthest completed step
        if      (data.step4_complete)  setStep(5)
        else if (data.step3_complete)  setStep(4)
        else if (data.step2_complete)  setStep(3)
        else if (data.step1_complete)  setStep(2)
        else                           setStep(1)
      } catch {
        setStep(1)  // first visit — start fresh
      } finally {
        setLoading(false)
      }
    })()
  }, [clubId, eventId])

  // ── Guard: IDs still not resolved ─────────────────────────────────────────
  if (!clubId || !eventId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="text-4xl">⚠️</div>
        <p className="text-gray-600 text-sm max-w-xs">
          Could not determine your event ID. Please log out and log in again.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <LoadingSpinner label="Loading your workspace…" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <StepIndicator current={step} />

      {step === 1 && (
        <Step1
          clubId={clubId}
          eventId={eventId}"""

main_body_new = """export default function GuestWizard({ eventName }) {
  const [step, setStep]         = useState(1)

  // Per-step state carried between wizard steps
  const [templateUrl,    setTemplateUrl]    = useState(null)  // server path /storage/guest_templates/…
  const [templateBlob,   setTemplateBlob]   = useState(null)  // blob: URL for instant canvas display
  const [excelState,     setExcelState]     = useState(null)  // { headers, rowCount, selectedColumns, emailColumn }
  const [fieldPositions, setFieldPositions] = useState(null)  // { positions }
  const [generatedCount, setGeneratedCount] = useState(0)

  return (
    <div className="max-w-4xl mx-auto">
      <StepIndicator current={step} />

      {step === 1 && (
        <Step1"""

content = content.replace(main_body_old, main_body_new)

# Step 2 props
content = content.replace(
"""        <Step2
          clubId={clubId}
          eventId={eventId}""",
"""        <Step2"""
)

# Step 3 props
content = content.replace(
"""        <Step3
          clubId={clubId}
          eventId={eventId}""",
"""        <Step3"""
)

# Step 4 props
content = content.replace(
"""        <Step4
          clubId={clubId}
          eventId={eventId}""",
"""        <Step4"""
)

# Step 5 props
content = content.replace(
"""        <Step5
          clubId={clubId}
          eventId={eventId}
          generatedCount={generatedCount}
          emailsSent={status?.step5_emails_sent || false}""",
"""        <Step5
          generatedCount={generatedCount}
          emailsSent={false}"""
)


with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("GuestWizard updated successfully.")
