import { useMemo, useState, useEffect } from 'react'
import LoadingSpinner from '../../components/LoadingSpinner'
import { useToastStore } from '../../store/uiStore'
import {
  useRoleMappings,
  useCreateRoleMapping,
  useUpdateRoleMapping,
  useSeedRoleMappings,
} from './api'
import { useImageTemplates } from '../club/eventsApi'

const DEFAULT_FIELDS = [
  'Name',
  'Registration Number',
  'Role',
  'Event Name',
  'Event Date',
  'Club Name',
  'Year',
]

const EMPTY_POSITION = { x_percent: 50, y_percent: 50, font_size_percent: 2.5 }
const EMPTY_ASSET = { x_percent: 50, y_percent: 50, width_percent: 10 }

function normalizeRoleName(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_')
}

function asNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function toFormState(preset) {
  if (!preset) {
    const columns = {}
    DEFAULT_FIELDS.forEach((f) => {
      columns[f] = { ...EMPTY_POSITION }
    })
    return {
      role_name: '',
      display_label: '',
      template_filename: '',
      display_width: 1905,
      is_active: true,
      column_positions: columns,
      asset_positions: {
        logo: { ...EMPTY_ASSET },
        signature: { ...EMPTY_ASSET },
      },
    }
  }

  const columns = { ...(preset.column_positions || {}) }
  DEFAULT_FIELDS.forEach((f) => {
    if (!columns[f]) columns[f] = { ...EMPTY_POSITION }
  })

  return {
    role_name: preset.role_name || '',
    display_label: preset.display_label || '',
    template_filename: preset.template_filename || '',
    display_width: asNumber(preset.display_width, 1905),
    is_active: !!preset.is_active,
    column_positions: columns,
    asset_positions: {
      logo: { ...EMPTY_ASSET, ...(preset.asset_positions?.logo || {}) },
      signature: { ...EMPTY_ASSET, ...(preset.asset_positions?.signature || {}) },
    },
  }
}

export default function CertificateMappingTab() {
  const addToast = useToastStore((s) => s.addToast)
  const { data: mappings, isLoading, refetch } = useRoleMappings(true)
  const { data: templates } = useImageTemplates()

  const createMutation = useCreateRoleMapping()
  const updateMutation = useUpdateRoleMapping()
  const seedMutation = useSeedRoleMappings()

  const [selectedRole, setSelectedRole] = useState('')
  const [addingField, setAddingField] = useState('')
  const [form, setForm] = useState(() => toFormState(null))

  const sortedMappings = useMemo(() => {
    return [...(mappings || [])].sort((a, b) =>
      String(a.display_label || a.role_name).localeCompare(String(b.display_label || b.role_name)),
    )
  }, [mappings])

  const selectedPreset = useMemo(
    () => sortedMappings.find((m) => m.role_name === selectedRole) || null,
    [sortedMappings, selectedRole],
  )

  const templateOptions = useMemo(() => {
    return [...new Set((templates || []).map((t) => t.filename).filter(Boolean))]
  }, [templates])

  useEffect(() => {
    if (!selectedRole) {
      setForm(toFormState(null))
      return
    }
    setForm(toFormState(selectedPreset))
  }, [selectedRole, selectedPreset])

  const allFieldKeys = useMemo(() => Object.keys(form.column_positions || {}), [form.column_positions])

  const busy = createMutation.isPending || updateMutation.isPending

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleFieldPos = (field, axis, value) => {
    setForm((prev) => ({
      ...prev,
      column_positions: {
        ...prev.column_positions,
        [field]: {
          ...(prev.column_positions?.[field] || EMPTY_POSITION),
          [axis]: asNumber(value, 0),
        },
      },
    }))
  }

  const handleAssetPos = (assetName, axis, value) => {
    setForm((prev) => ({
      ...prev,
      asset_positions: {
        ...prev.asset_positions,
        [assetName]: {
          ...(prev.asset_positions?.[assetName] || EMPTY_ASSET),
          [axis]: asNumber(value, 0),
        },
      },
    }))
  }

  const handleAddField = () => {
    const name = addingField.trim()
    if (!name) return
    if (form.column_positions?.[name]) {
      setAddingField('')
      return
    }
    setForm((prev) => ({
      ...prev,
      column_positions: {
        ...prev.column_positions,
        [name]: { ...EMPTY_POSITION },
      },
    }))
    setAddingField('')
  }

  const handleRemoveField = (field) => {
    setForm((prev) => {
      const next = { ...(prev.column_positions || {}) }
      delete next[field]
      return { ...prev, column_positions: next }
    })
  }

  const handleNew = () => {
    setSelectedRole('')
    setForm(toFormState(null))
  }

  const handleSave = async () => {
    const normalizedRole = normalizeRoleName(form.role_name)
    const payload = {
      role_name: normalizedRole,
      display_label: String(form.display_label || '').trim(),
      template_filename: String(form.template_filename || '').trim(),
      column_positions: form.column_positions || {},
      asset_positions: form.asset_positions || null,
      display_width: asNumber(form.display_width, 1905),
      is_active: !!form.is_active,
    }

    if (!payload.role_name) {
      addToast({ type: 'warning', message: 'Role key is required.' })
      return
    }
    if (!payload.display_label) {
      addToast({ type: 'warning', message: 'Display label is required.' })
      return
    }
    if (!payload.template_filename) {
      addToast({ type: 'warning', message: 'Template selection is required.' })
      return
    }
    if (templateOptions.length > 0 && !templateOptions.includes(payload.template_filename)) {
      addToast({ type: 'warning', message: 'Selected template is not valid.' })
      return
    }

    try {
      if (selectedPreset) {
        // Keep role key stable while updating an existing mapping.
        const updatePayload = { ...payload, role_name: selectedPreset.role_name }
        await updateMutation.mutateAsync({ roleName: selectedPreset.role_name, payload: updatePayload })
        await refetch()
        setSelectedRole(selectedPreset.role_name)
        return
      }

      await createMutation.mutateAsync(payload)
      await refetch()
      setSelectedRole(payload.role_name)
    } catch {
      // Mutation hooks already surface detailed error toasts.
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Certificate Mapping</h1>
          <p className="mt-1 text-sm text-gray-500">
            Superadmin-controlled role to template mapping with default field coordinates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={handleNew}>New Mapping</button>
          <button
            className="btn-secondary"
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
          >
            {seedMutation.isPending ? 'Seeding…' : 'Seed Defaults'}
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[320px,1fr]">
        <section className="card p-4">
          <p className="mb-3 text-sm font-semibold text-foreground">Existing Role Mappings</p>
          {isLoading ? (
            <LoadingSpinner />
          ) : sortedMappings.length === 0 ? (
            <p className="text-sm text-gray-500">No mappings found.</p>
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
              {sortedMappings.map((m) => {
                const active = selectedRole === m.role_name
                return (
                  <button
                    key={m.role_name}
                    onClick={() => setSelectedRole(m.role_name)}
                    className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                      active ? 'border-navy bg-navy/5' : 'border-gray-200 hover:border-navy/40'
                    }`}
                  >
                    <p className="text-sm font-semibold text-foreground">{m.display_label}</p>
                    <p className="text-xs text-gray-500">{m.role_name}</p>
                    <p className="mt-1 text-xs text-gray-400">{m.template_filename}</p>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <section className="card p-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="form-label">Role Key *</label>
              <input
                className="form-input"
                value={form.role_name}
                onChange={(e) => handleChange('role_name', e.target.value)}
                placeholder="non_technical_participant"
                disabled={!!selectedPreset}
              />
              <p className="mt-1 text-xs text-gray-400">Used in Excel Role matching.</p>
            </div>
            <div>
              <label className="form-label">Display Label *</label>
              <input
                className="form-input"
                value={form.display_label}
                onChange={(e) => handleChange('display_label', e.target.value)}
                placeholder="Non-Technical Participant"
              />
            </div>
            <div>
              <label className="form-label">Template *</label>
              <select
                className="form-input"
                value={form.template_filename}
                onChange={(e) => handleChange('template_filename', e.target.value)}
              >
                <option value="">Select template</option>
                {templateOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Display Width</label>
              <input
                type="number"
                className="form-input"
                value={form.display_width}
                onChange={(e) => handleChange('display_width', e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="mapping-active"
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => handleChange('is_active', e.target.checked)}
            />
            <label htmlFor="mapping-active" className="text-sm text-gray-700">Active</label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">Field Mapping Positions</p>
              <div className="flex items-center gap-2">
                <input
                  className="form-input h-9 w-48"
                  placeholder="Add extra field"
                  value={addingField}
                  onChange={(e) => setAddingField(e.target.value)}
                />
                <button className="btn-secondary h-9 px-3" onClick={handleAddField}>Add</button>
              </div>
            </div>

            <div className="space-y-2">
              {allFieldKeys.map((field) => (
                <div key={field} className="rounded-lg border border-gray-200 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">{field}</p>
                    {!DEFAULT_FIELDS.includes(field) && (
                      <button
                        className="text-xs text-red-500 hover:underline"
                        onClick={() => handleRemoveField(field)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <input
                      type="number"
                      step="0.1"
                      className="form-input"
                      value={form.column_positions?.[field]?.x_percent ?? 0}
                      onChange={(e) => handleFieldPos(field, 'x_percent', e.target.value)}
                      placeholder="X %"
                    />
                    <input
                      type="number"
                      step="0.1"
                      className="form-input"
                      value={form.column_positions?.[field]?.y_percent ?? 0}
                      onChange={(e) => handleFieldPos(field, 'y_percent', e.target.value)}
                      placeholder="Y %"
                    />
                    <input
                      type="number"
                      step="0.1"
                      className="form-input"
                      value={form.column_positions?.[field]?.font_size_percent ?? 0}
                      onChange={(e) => handleFieldPos(field, 'font_size_percent', e.target.value)}
                      placeholder="Font %"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Asset Positions</p>
            {['logo', 'signature'].map((asset) => (
              <div key={asset} className="rounded-lg border border-gray-200 p-3">
                <p className="mb-2 text-sm font-medium capitalize text-foreground">{asset}</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <input
                    type="number"
                    step="0.1"
                    className="form-input"
                    value={form.asset_positions?.[asset]?.x_percent ?? 0}
                    onChange={(e) => handleAssetPos(asset, 'x_percent', e.target.value)}
                    placeholder="X %"
                  />
                  <input
                    type="number"
                    step="0.1"
                    className="form-input"
                    value={form.asset_positions?.[asset]?.y_percent ?? 0}
                    onChange={(e) => handleAssetPos(asset, 'y_percent', e.target.value)}
                    placeholder="Y %"
                  />
                  <input
                    type="number"
                    step="0.1"
                    className="form-input"
                    value={form.asset_positions?.[asset]?.width_percent ?? 0}
                    onChange={(e) => handleAssetPos(asset, 'width_percent', e.target.value)}
                    placeholder="Width %"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button className="btn-primary" onClick={handleSave} disabled={busy}>
              {busy ? 'Saving…' : selectedPreset ? 'Update Mapping' : 'Create Mapping'}
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
