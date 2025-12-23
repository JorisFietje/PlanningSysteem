'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Medication,
  MedicationActionTemplate,
  MedicationVariant,
  TREATMENT_NUMBER_OPTIONS,
  getAllMedications,
  saveCalibratedMedications
} from '@/types'
import { generateActionsForMedication, getTreatmentBreakdown } from '@/utils/patients/actionGenerator'

const ACTION_TEMPLATES: Array<Omit<MedicationActionTemplate, 'id' | 'startOffset'>> = [
  { name: 'Aanbrengen infuus', duration: 15, type: 'setup' },
  { name: 'Protocol controle', duration: 2, type: 'protocol_check' },
  { name: 'Infuus loopt', duration: 30, type: 'infusion' },
  { name: 'Check', duration: 5, type: 'check' },
  { name: 'Observatie', duration: 30, type: 'observation' },
  { name: 'Spoelen', duration: 5, type: 'flush' },
  { name: 'Infuus Afkoppelen', duration: 5, type: 'removal' },
  { name: 'Nieuwe handeling', duration: 5, type: 'custom' }
]

const ACTION_COLORS: Record<string, string> = {
  setup: 'bg-blue-500',
  protocol_check: 'bg-emerald-500',
  infusion: 'bg-blue-500',
  check: 'bg-indigo-500',
  observation: 'bg-teal-500',
  flush: 'bg-cyan-500',
  removal: 'bg-rose-500',
  custom: 'bg-slate-500'
}

const CATEGORY_LABELS: Record<Medication['category'], string> = {
  immunotherapy: 'Immunotherapie',
  transfusion: 'Transfusie',
  iron: 'IJzer',
  infusion: 'Infusie',
  other: 'Overig'
}

type DragPreview = { minute: number; label: string } | null
type ResizeState = { actionId: string; startX: number; startDuration: number }
type DragImageState = { node: HTMLElement } | null

const buildActionTimeline = (variant: MedicationVariant) => {
  const actions = variant.actions ? [...variant.actions] : []
  const withOffsets = actions.map((action, index) => {
    if (action.startOffset !== undefined) return action
    const previous = actions.slice(0, index)
    const offset = previous.reduce((sum, item) => sum + item.duration, 0)
    return { ...action, startOffset: offset }
  })
  return withOffsets.sort((a, b) => (a.startOffset ?? 0) - (b.startOffset ?? 0))
}

export default function CalibratiePage() {
  const [isMounted, setIsMounted] = useState(false)
  const [medications, setMedications] = useState<Medication[]>([])
  const [selectedMedicationId, setSelectedMedicationId] = useState<string | null>(null)
  const [selectedVariantNumber, setSelectedVariantNumber] = useState<number>(1)
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [dragPreview, setDragPreview] = useState<DragPreview>(null)
  const [resizeState, setResizeState] = useState<ResizeState | null>(null)
  const [dragImageState, setDragImageState] = useState<DragImageState>(null)
  const timelineRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsMounted(true)
    const baseMedications = getAllMedications()
    const withActions = baseMedications.map(med => ({
      ...med,
      variants: med.variants.map(variant => {
        const existing = buildActionTimeline(variant)
        if (existing.length > 0) {
          return { ...variant, actions: existing }
        }
        const generated = generateActionsForMedication(med.id, variant.treatmentNumber)
        let cursor = 0
        const actions = generated.map((action, index) => {
          const mapped = {
            id: `${med.id}-${variant.treatmentNumber}-${index}`,
            name: action.name,
            duration: action.duration,
            type: action.type,
            startOffset: cursor
          }
          cursor += action.duration
          return mapped
        })
        return { ...variant, actions }
      })
    }))
    setMedications(withActions)
    saveCalibratedMedications(withActions)
    if (withActions.length > 0) {
      setSelectedMedicationId(withActions[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saveMedications = (next: Medication[]) => {
    setMedications(next)
    saveCalibratedMedications(next)
  }

  const selectedMedication = medications.find(med => med.id === selectedMedicationId) || medications[0]
  const variants = selectedMedication ? selectedMedication.variants : []
  const selectedVariant = variants.find(v => v.treatmentNumber === selectedVariantNumber) || variants[0]

  useEffect(() => {
    if (selectedVariant) {
      setSelectedVariantNumber(selectedVariant.treatmentNumber)
    }
  }, [selectedMedicationId])

  const filteredMedications = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return medications
    return medications.filter(med => med.displayName.toLowerCase().includes(query))
  }, [medications, search])

  const timelineActions = selectedVariant ? buildActionTimeline(selectedVariant) : []
  const maxActionEnd = timelineActions.reduce((max, action) => Math.max(max, (action.startOffset ?? 0) + action.duration), 0)
  const timelineMinutes = Math.max(selectedVariant?.timing.totalTime || 0, maxActionEnd, 60)

  const updateMedication = (medId: string, updates: Partial<Medication>) => {
    saveMedications(medications.map(med => (med.id === medId ? { ...med, ...updates } : med)))
  }

  const updateVariant = (medId: string, treatmentNumber: number, updates: Partial<MedicationVariant>) => {
    saveMedications(
      medications.map(med => {
        if (med.id !== medId) return med
        return {
          ...med,
          variants: med.variants.map(variant =>
            variant.treatmentNumber === treatmentNumber ? { ...variant, ...updates } : variant
          )
        }
      })
    )
  }

  const updateAction = (
    medId: string,
    treatmentNumber: number,
    actionId: string,
    updates: Partial<MedicationActionTemplate>
  ) => {
    saveMedications(
      medications.map(med => {
        if (med.id !== medId) return med
        return {
          ...med,
          variants: med.variants.map(variant => {
            if (variant.treatmentNumber !== treatmentNumber) return variant
            const actions = (variant.actions || []).map(action =>
              action.id === actionId ? { ...action, ...updates } : action
            )
            return { ...variant, actions }
          })
        }
      })
    )
  }

  const normalizeActions = (actions: MedicationActionTemplate[]) => {
    const sorted = actions
      .map((action, index) => ({ ...action, __index: index }))
      .sort((a, b) => (a.startOffset ?? 0) - (b.startOffset ?? 0) || a.__index - b.__index)
    let cursor = 0
    const adjusted = sorted.map(action => {
      const start = Math.max(action.startOffset ?? 0, cursor)
      cursor = start + action.duration
      const { __index, ...rest } = action
      return { ...rest, startOffset: start }
    })
    return adjusted
  }

  const updateActionWithCollision = (
    medId: string,
    treatmentNumber: number,
    actionId: string,
    updates: Partial<MedicationActionTemplate>
  ) => {
    saveMedications(
      medications.map(med => {
        if (med.id !== medId) return med
        return {
          ...med,
          variants: med.variants.map(variant => {
            if (variant.treatmentNumber !== treatmentNumber) return variant
            const actions = (variant.actions || []).map(action =>
              action.id === actionId ? { ...action, ...updates } : action
            )
            return { ...variant, actions: normalizeActions(actions) }
          })
        }
      })
    )
  }

  const addActionWithCollision = (
    medId: string,
    treatmentNumber: number,
    newAction: MedicationActionTemplate
  ) => {
    saveMedications(
      medications.map(med => {
        if (med.id !== medId) return med
        return {
          ...med,
          variants: med.variants.map(variant => {
            if (variant.treatmentNumber !== treatmentNumber) return variant
            const actions = [...(variant.actions || []), newAction]
            return { ...variant, actions: normalizeActions(actions) }
          })
        }
      })
    )
  }

  const removeAction = (medId: string, treatmentNumber: number, actionId: string) => {
    saveMedications(
      medications.map(med => {
        if (med.id !== medId) return med
        return {
          ...med,
          variants: med.variants.map(variant => {
            if (variant.treatmentNumber !== treatmentNumber) return variant
            const actions = (variant.actions || []).filter(action => action.id !== actionId)
            return { ...variant, actions }
          })
        }
      })
    )
    setSelectedActionId(null)
  }

  const addAction = (template: Omit<MedicationActionTemplate, 'id' | 'startOffset'>, startOffset: number) => {
    if (!selectedMedication || !selectedVariant) return
    const id = `${selectedMedication.id}-${selectedVariant.treatmentNumber}-${Date.now()}`
    const newAction: MedicationActionTemplate = {
      id,
      name: template.name,
      duration: template.duration,
      type: template.type,
      startOffset
    }
    addActionWithCollision(selectedMedication.id, selectedVariant.treatmentNumber, newAction)
    setSelectedActionId(id)
  }

  const addMedication = () => {
    const id = `nieuw-${Date.now()}`
    const newMedication: Medication = {
      id,
      name: 'Nieuwe medicatie',
      displayName: 'Nieuwe medicatie',
      category: 'other',
      color: 'slate',
      effectiveFrom: new Date().toISOString().slice(0, 10),
      variants: [
        {
          treatmentNumber: 1,
          timing: {
            infusionTime: 30,
            vpkTime: 15,
            observationTime: 0,
            flushTime: 0,
            totalTime: 45
          },
          actions: [
            { id: `${id}-1-setup`, name: 'Aanbrengen infuus', duration: 15, type: 'setup', startOffset: 0 },
            { id: `${id}-1-infusion`, name: 'Infuus loopt', duration: 30, type: 'infusion', startOffset: 15 },
            { id: `${id}-1-removal`, name: 'Infuus Afkoppelen', duration: 5, type: 'removal', startOffset: 45 }
          ]
        }
      ]
    }
    saveMedications([newMedication, ...medications])
    setSelectedMedicationId(id)
    setSelectedVariantNumber(1)
  }

  const removeMedication = (medId: string) => {
    const remaining = medications.filter(med => med.id !== medId)
    saveMedications(remaining)
    if (selectedMedicationId === medId) {
      setSelectedMedicationId(remaining[0]?.id || null)
    }
  }

  const addVariant = () => {
    if (!selectedMedication) return
    const existingNumbers = selectedMedication.variants.map(v => v.treatmentNumber)
    const nextNumber = Math.max(...existingNumbers) + 1
    updateMedication(selectedMedication.id, {
      variants: [
        ...selectedMedication.variants,
        {
          treatmentNumber: nextNumber,
          timing: {
            infusionTime: 30,
            vpkTime: 15,
            observationTime: 0,
            flushTime: 0,
            totalTime: 45
          },
          actions: [
            { id: `${selectedMedication.id}-${nextNumber}-setup`, name: 'Aanbrengen infuus', duration: 15, type: 'setup', startOffset: 0 },
            { id: `${selectedMedication.id}-${nextNumber}-infusion`, name: 'Infuus loopt', duration: 30, type: 'infusion', startOffset: 15 }
          ]
        }
      ]
    })
    setSelectedVariantNumber(nextNumber)
  }

  const clearDragImage = () => {
    if (dragImageState?.node) {
      dragImageState.node.remove()
    }
    setDragImageState(null)
  }

  const attachDragImage = (event: React.DragEvent<HTMLElement>, source: HTMLElement) => {
    if (typeof document === 'undefined') return
    const clone = source.cloneNode(true) as HTMLElement
    clone.style.position = 'fixed'
    clone.style.top = '-1000px'
    clone.style.left = '-1000px'
    clone.style.margin = '0'
    clone.style.transform = 'scale(1.06) rotate(-1deg)'
    clone.style.boxShadow = '0 18px 40px rgba(15, 23, 42, 0.3)'
    clone.style.borderRadius = '16px'
    clone.style.opacity = '0.98'
    clone.style.border = '1px solid rgba(255, 255, 255, 0.6)'
    clone.style.pointerEvents = 'none'
    document.body.appendChild(clone)
    event.dataTransfer.setDragImage(clone, 20, 20)
    setDragImageState({ node: clone })
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (!timelineRef.current || !selectedMedication || !selectedVariant) return

    const rect = timelineRef.current.getBoundingClientRect()
    const x = event.clientX - rect.left
    const rawMinutes = Math.round((x / rect.width) * timelineMinutes / 5) * 5
    const startOffset = Math.max(0, Math.min(rawMinutes, timelineMinutes - 5))

    const templateData = event.dataTransfer.getData('application/x-action-template')
    if (templateData) {
      const template = JSON.parse(templateData) as Omit<MedicationActionTemplate, 'id' | 'startOffset'>
      addAction(template, startOffset)
      return
    }

    const actionId = event.dataTransfer.getData('application/x-action')
    if (actionId) {
      updateActionWithCollision(selectedMedication.id, selectedVariant.treatmentNumber, actionId, { startOffset })
    }
    setDragPreview(null)
    clearDragImage()
  }

  const handleActionDragStart = (event: React.DragEvent<HTMLDivElement>, actionId: string) => {
    event.dataTransfer.setData('application/x-action', actionId)
    attachDragImage(event, event.currentTarget)
  }

  const handleActionDragEnd = () => {
    clearDragImage()
  }

  const handleTemplateDragStart = (
    event: React.DragEvent<HTMLButtonElement>,
    template: Omit<MedicationActionTemplate, 'id' | 'startOffset'>
  ) => {
    event.dataTransfer.setData('application/x-action-template', JSON.stringify(template))
    attachDragImage(event, event.currentTarget)
  }

  const handleTemplateDragEnd = () => {
    clearDragImage()
  }

  const handleTimelineDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return
    event.preventDefault()
    const rect = timelineRef.current.getBoundingClientRect()
    const x = event.clientX - rect.left
    const step = 5
    const rawMinutes = Math.round((x / rect.width) * timelineMinutes / step) * step
    const minute = Math.max(0, Math.min(rawMinutes, timelineMinutes))
    setDragPreview({ minute, label: `${minute}m` })
  }

  const handleTimelineDragLeave = () => {
    setDragPreview(null)
  }

  const startResize = (event: React.PointerEvent<HTMLDivElement>, actionId: string, duration: number) => {
    event.stopPropagation()
    event.preventDefault()
    const target = event.currentTarget
    target.setPointerCapture(event.pointerId)
    setResizeState({ actionId, startX: event.clientX, startDuration: duration })
  }

  useEffect(() => {
    if (!resizeState || !timelineRef.current || !selectedMedication || !selectedVariant) return
    const handleMove = (event: PointerEvent) => {
      if (!timelineRef.current) return
      const rect = timelineRef.current.getBoundingClientRect()
      const deltaX = event.clientX - resizeState.startX
      const deltaMinutes = Math.round((deltaX / rect.width) * timelineMinutes / 5) * 5
      const nextDuration = Math.max(5, resizeState.startDuration + deltaMinutes)
      updateActionWithCollision(selectedMedication.id, selectedVariant.treatmentNumber, resizeState.actionId, { duration: nextDuration })
    }
    const handleUp = () => setResizeState(null)
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp, { once: true })
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [resizeState, selectedMedication, selectedVariant, timelineMinutes])

  if (!isMounted) {
    return <div className="text-sm text-slate-600">Laden...</div>
  }

  return (
    <div className="space-y-8">
      <section id="medicatie" className="space-y-4 scroll-mt-24">
        <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
              <aside className="rounded-3xl border border-blue-100 bg-white/80 shadow-sm p-4 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Medicaties</h2>
                  <button
                    onClick={addMedication}
                    className="px-3 py-1.5 rounded-full bg-blue-500 text-white text-xs font-semibold shadow transition transform hover:-translate-y-0.5 hover:bg-blue-400 hover:shadow-md"
                  >
                    + Nieuwe
                  </button>
                </div>
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Zoek medicatie..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm"
                />
                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                  {filteredMedications.map(med => (
                    <button
                      key={med.id}
                      onClick={() => setSelectedMedicationId(med.id)}
                      className={`w-full text-left rounded-2xl border px-3 py-3 transition ${
                        med.id === selectedMedication?.id
                          ? 'border-blue-400 bg-blue-100/70'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:-translate-y-0.5 hover:shadow-sm'
                      }`}
                    >
                      <div className="text-sm font-semibold text-slate-900">{med.displayName}</div>
                      <div className="text-xs text-slate-500">{CATEGORY_LABELS[med.category]}</div>
                    </button>
                  ))}
                </div>
              </aside>

              <div className="space-y-6">
                {selectedMedication ? (
                  <>
                    <div className="rounded-3xl border border-slate-200 bg-white/80 shadow-sm p-6 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <h2 className="text-2xl font-semibold">{selectedMedication.displayName}</h2>
                          <p className="text-xs text-slate-500">ID: {selectedMedication.id}</p>
                        </div>
                        <button
                          onClick={() => removeMedication(selectedMedication.id)}
                          className="text-xs text-rose-500 border border-rose-200 px-3 py-1.5 rounded-full bg-white transition hover:border-rose-300 hover:bg-rose-50 hover:-translate-y-0.5"
                        >
                          Verwijder medicatie
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="text-xs text-slate-500">
                          Displaynaam
                          <input
                            type="text"
                            value={selectedMedication.displayName}
                            onChange={(e) => updateMedication(selectedMedication.id, { displayName: e.target.value })}
                            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
                          />
                        </label>
                        <label className="text-xs text-slate-500">
                          Categorie
                          <select
                            value={selectedMedication.category}
                            onChange={(e) => updateMedication(selectedMedication.id, { category: e.target.value as Medication['category'] })}
                            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
                          >
                            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                              <option key={key} value={key}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white/80 shadow-sm p-6 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap gap-2">
                          {variants.map(variant => (
                            <button
                              key={variant.treatmentNumber}
                              onClick={() => setSelectedVariantNumber(variant.treatmentNumber)}
                              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                                variant.treatmentNumber === selectedVariant?.treatmentNumber
                                  ? 'bg-slate-900 text-white border-slate-900 shadow'
                                  : 'border-slate-300 text-slate-600 bg-white hover:border-slate-400 hover:-translate-y-0.5'
                              }`}
                            >
                              {TREATMENT_NUMBER_OPTIONS.find(opt => opt.value === variant.treatmentNumber)?.label || `${variant.treatmentNumber}e`}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={addVariant}
                          className="text-xs text-slate-700 border border-slate-300 px-3 py-1.5 rounded-full bg-white transition hover:border-slate-400 hover:bg-slate-50 hover:-translate-y-0.5"
                        >
                          + Variant
                        </button>
                      </div>

                      {selectedVariant && (
                        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
                          <div className="space-y-4">
                            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                              <div className="flex flex-wrap gap-3 items-center justify-between">
                                <div className="text-sm text-slate-600">Totale duur: {timelineMinutes} min</div>
                                <label className="text-xs text-slate-500">
                                  Tijdlijn duur
                                  <input
                                    type="number"
                                    min={30}
                                    value={selectedVariant.timing.totalTime}
                                    onChange={(e) =>
                                      updateVariant(selectedMedication.id, selectedVariant.treatmentNumber, {
                                        timing: { ...selectedVariant.timing, totalTime: parseInt(e.target.value, 10) || 0 }
                                      })
                                    }
                                    className="ml-3 w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800"
                                  />
                                </label>
                              </div>
                              <div
                                ref={timelineRef}
                                onDragOver={handleTimelineDragOver}
                                onDragLeave={handleTimelineDragLeave}
                                onDrop={handleDrop}
                                className="mt-4 h-28 rounded-xl border border-dashed border-slate-300 relative overflow-hidden bg-slate-50"
                              >
                                {Array.from({ length: Math.floor(timelineMinutes / 5) + 1 }).map((_, index) => {
                                  const minute = index * 5
                                  const left = (minute / timelineMinutes) * 100
                                  const isMajor = minute % 30 === 0
                                  return (
                                    <div
                                      key={`snap-${minute}`}
                                      className={`absolute top-0 bottom-0 ${isMajor ? 'border-l border-slate-200' : 'border-l border-slate-200/40'}`}
                                      style={{ left: `${left}%` }}
                                    />
                                  )
                                })}
                                {Array.from({ length: Math.ceil(timelineMinutes / 30) + 1 }).map((_, index) => {
                                  const left = (index * 30 / timelineMinutes) * 100
                                  return (
                                    <div
                                      key={index}
                                      className="absolute top-0 bottom-0 border-l border-slate-200 text-[10px] text-slate-400"
                                      style={{ left: `${left}%` }}
                                    >
                                      <span className="absolute top-1 left-1">{index * 30}m</span>
                                    </div>
                                  )
                                })}
                                {timelineActions.map(action => {
                                  const start = action.startOffset ?? 0
                                  const left = (start / timelineMinutes) * 100
                                  const width = (action.duration / timelineMinutes) * 100
                                  const colorClass = ACTION_COLORS[action.type || 'custom'] || 'bg-slate-500'
                                  return (
                                    <div
                                      key={action.id}
                                      draggable
                                      onDragStart={(event) => handleActionDragStart(event, action.id)}
                                      onDragEnd={handleActionDragEnd}
                                      onClick={() => setSelectedActionId(action.id)}
                                      className={`group absolute top-10 ${colorClass} text-white text-xs rounded-lg px-2 py-1 cursor-grab active:cursor-grabbing shadow-lg ${
                                        selectedActionId === action.id ? 'ring-2 ring-white' : ''
                                      }`}
                                      style={{ left: `${left}%`, width: `${Math.max(width, 2)}%` }}
                                    >
                                      <div className="truncate">{action.name}</div>
                                      <div className="text-[10px] opacity-80">{action.duration}m</div>
                                      {action.type === 'infusion' && (
                                        <div
                                          onPointerDown={(event) => startResize(event, action.id, action.duration)}
                                          className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-white/40 opacity-0 group-hover:opacity-100"
                                          title="Sleep om duur te wijzigen"
                                        />
                                      )}
                                    </div>
                                  )
                                })}
                                {dragPreview && (
                                  <div
                                    className="absolute top-0 bottom-0 w-[2px] bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.7)]"
                                    style={{ left: `${(dragPreview.minute / timelineMinutes) * 100}%` }}
                                  >
                                    <div className="absolute -top-6 -left-4 rounded-full bg-blue-500 text-white text-[10px] px-2 py-0.5">
                                      {dragPreview.label}
                                    </div>
                                  </div>
                                )}
                                {dragPreview && (
                                  <div
                                    className="absolute top-6 bottom-6 rounded-md bg-blue-200/60 border border-blue-300/70 pointer-events-none"
                                    style={{
                                      left: `${(dragPreview.minute / timelineMinutes) * 100}%`,
                                      width: `${(5 / timelineMinutes) * 100}%`
                                    }}
                                  />
                                )}
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {ACTION_TEMPLATES.map(template => (
                                <button
                                  key={template.name}
                                  draggable
                                  onDragStart={(event) => handleTemplateDragStart(event, template)}
                                  onDragEnd={handleTemplateDragEnd}
                                  className="px-3 py-2 rounded-full border border-slate-300 text-xs text-slate-700 bg-white shadow-sm transition hover:border-slate-400 hover:-translate-y-0.5 hover:shadow-md"
                                >
                                  {template.name}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4 shadow-sm">
                            <div className="text-sm font-semibold text-slate-700">Actie details</div>
                            {selectedActionId ? (
                              (() => {
                                const action = timelineActions.find(item => item.id === selectedActionId)
                                if (!action) return <div className="text-xs text-slate-500">Selecteer een handeling.</div>
                                return (
                                  <div className="space-y-3">
                                    <label className="text-xs text-slate-500">
                                      Naam
                                      <input
                                        type="text"
                                        value={action.name}
                                        onChange={(e) => updateAction(selectedMedication.id, selectedVariant.treatmentNumber, action.id, { name: e.target.value })}
                                        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800"
                                      />
                                    </label>
                                    <label className="text-xs text-slate-500">
                                      Duur (min)
                                      <input
                                        type="number"
                                        min={0}
                                        value={action.duration}
                                        onChange={(e) => updateAction(selectedMedication.id, selectedVariant.treatmentNumber, action.id, { duration: parseInt(e.target.value, 10) || 0 })}
                                        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800"
                                      />
                                    </label>
                                    <label className="text-xs text-slate-500">
                                      Start (min)
                                      <input
                                        type="number"
                                        min={0}
                                        value={action.startOffset ?? 0}
                                        onChange={(e) => updateAction(selectedMedication.id, selectedVariant.treatmentNumber, action.id, { startOffset: parseInt(e.target.value, 10) || 0 })}
                                        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800"
                                      />
                                    </label>
                                    <label className="text-xs text-slate-500">
                                      Type
                                      <select
                                        value={action.type || 'custom'}
                                        onChange={(e) => updateAction(selectedMedication.id, selectedVariant.treatmentNumber, action.id, { type: e.target.value })}
                                        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800"
                                      >
                                        <option value="setup">Aanbrengen</option>
                                        <option value="protocol_check">Protocol</option>
                                        <option value="infusion">Infuus</option>
                                        <option value="check">Check</option>
                                        <option value="pc_switch">PC wissel</option>
                                        <option value="observation">Observatie</option>
                                        <option value="flush">Spoelen</option>
                                        <option value="removal">Afkoppelen</option>
                                        <option value="custom">Overig</option>
                                      </select>
                                    </label>
                                    <button
                                      onClick={() => removeAction(selectedMedication.id, selectedVariant.treatmentNumber, action.id)}
                                      className="text-xs text-rose-500"
                                    >
                                      Handeling verwijderen
                                    </button>
                                  </div>
                                )
                              })()
                            ) : (
                              <div className="text-xs text-slate-500">Selecteer een handeling in de tijdlijn.</div>
                            )}

                            <div className="pt-2 border-t border-slate-200 text-xs text-slate-500">
                              VPK tijd: {getTreatmentBreakdown(selectedMedication.id, selectedVariant.treatmentNumber).vpkTime} min
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm">
                    <div className="text-sm text-slate-500">Geen medicatie geselecteerd.</div>
                  </div>
                )}
              </div>
            </div>
      </section>

    </div>
  )
}
