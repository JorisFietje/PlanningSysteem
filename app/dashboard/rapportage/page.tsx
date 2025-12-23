"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import Select from '@/components/common/Select'
import { getAllMedications, getTodayISO } from '@/types'

type ReferralEntry = { department: string; count: number }
type MedicationWasteEntry = { medicationId: string; count: number }
type DayTracking = {
  referrals: ReferralEntry[]
  noShows: number
  lateCancellations: number
  wastedMeds: MedicationWasteEntry[]
}

const DEFAULT_DEPARTMENTS = [
  'Hematologie',
  'Oncologie',
  'Reumatologie',
  'Gastro-enterologie',
  'Longziekten',
  'Neurologie',
  'Interne geneeskunde'
]

const emptyTracking: DayTracking = {
  referrals: [],
  noShows: 0,
  lateCancellations: 0,
  wastedMeds: []
}

export default function BijhoudenPage() {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayISO())
  const [departments, setDepartments] = useState<string[]>(DEFAULT_DEPARTMENTS)
  const [trackingData, setTrackingData] = useState<Record<string, DayTracking>>({})
  const [newDepartment, setNewDepartment] = useState('')
  const [departmentToAdd, setDepartmentToAdd] = useState('')
  const [medicationToAdd, setMedicationToAdd] = useState('')
  const [rangeStart, setRangeStart] = useState<string>(() => {
    const today = new Date()
    const start = new Date(today)
    start.setDate(today.getDate() - 6)
    return start.toISOString().slice(0, 10)
  })
  const [rangeEnd, setRangeEnd] = useState<string>(getTodayISO())
  const [rangeRows, setRangeRows] = useState<Array<{ date: string; referrals: ReferralEntry[]; wastedMeds: MedicationWasteEntry[]; noShows: number; lateCancellations: number }>>([])
  const [isRangeLoading, setIsRangeLoading] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [draftRangeStart, setDraftRangeStart] = useState(rangeStart)
  const [draftRangeEnd, setDraftRangeEnd] = useState(rangeEnd)
  const pendingSavesRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const response = await fetch('/api/dashboard/departments')
        if (!response.ok) return
        const data = await response.json()
        if (Array.isArray(data) && data.length > 0) {
          setDepartments(data)
        }
      } catch (error) {
        console.error('Failed to load departments:', error)
      }
    }
    loadDepartments()
  }, [])

  useEffect(() => {
    const loadTracking = async () => {
      try {
        const response = await fetch(`/api/dashboard/tracking?date=${selectedDate}`)
        if (!response.ok) return
        const data = await response.json()
        setTrackingData(prev => ({
          ...prev,
          [selectedDate]: {
            referrals: Array.isArray(data.referrals) ? data.referrals : [],
            wastedMeds: Array.isArray(data.wastedMeds) ? data.wastedMeds : [],
            noShows: Number.isFinite(data.noShows) ? data.noShows : 0,
            lateCancellations: Number.isFinite(data.lateCancellations) ? data.lateCancellations : 0
          }
        }))
      } catch (error) {
        console.error('Failed to load tracking:', error)
      }
    }
    loadTracking()
  }, [selectedDate])

  useEffect(() => {
    if (!rangeStart || !rangeEnd) return
    const loadRange = async () => {
      setIsRangeLoading(true)
      try {
        const response = await fetch(`/api/dashboard/tracking-range?start=${rangeStart}&end=${rangeEnd}`)
        if (!response.ok) return
        const data = await response.json()
        if (Array.isArray(data)) {
          setRangeRows(data)
        }
      } catch (error) {
        console.error('Failed to load range:', error)
      } finally {
        setIsRangeLoading(false)
      }
    }
    loadRange()
  }, [rangeStart, rangeEnd])

  useEffect(() => {
    if (!isExportOpen || !draftRangeStart || !draftRangeEnd) return
    const loadDraftRange = async () => {
      setIsRangeLoading(true)
      try {
        const response = await fetch(`/api/dashboard/tracking-range?start=${draftRangeStart}&end=${draftRangeEnd}`)
        if (!response.ok) return
        const data = await response.json()
        if (Array.isArray(data)) {
          setRangeRows(data)
        }
      } catch (error) {
        console.error('Failed to load draft range:', error)
      } finally {
        setIsRangeLoading(false)
      }
    }
    loadDraftRange()
  }, [isExportOpen, draftRangeStart, draftRangeEnd])

  useEffect(() => {
    if (!isExportOpen) return
    setDraftRangeStart(rangeStart)
    setDraftRangeEnd(rangeEnd)
  }, [isExportOpen, rangeStart, rangeEnd])

  const medications = useMemo(() => getAllMedications(), [])
  const medicationOptions = useMemo(
    () => medications.map(med => ({ value: med.id, label: med.displayName })),
    [medications]
  )

  const currentTracking = trackingData[selectedDate] || emptyTracking

  const availableDepartments = departments.filter(
    dep => !currentTracking.referrals.some(entry => entry.department === dep)
  )
  const availableMedications = medicationOptions.filter(
    opt => !currentTracking.wastedMeds.some(entry => entry.medicationId === opt.value)
  )

  const rangeTotals = useMemo(() => {
    return rangeRows.reduce(
      (acc, row) => {
        acc.noShows += row.noShows || 0
        acc.lateCancellations += row.lateCancellations || 0
        acc.referrals += row.referrals.reduce((sum, item) => sum + (item.count || 0), 0)
        acc.wasted += row.wastedMeds.reduce((sum, item) => sum + (item.count || 0), 0)
        return acc
      },
      { noShows: 0, lateCancellations: 0, referrals: 0, wasted: 0 }
    )
  }, [rangeRows])

  const handleExportCsv = (mode: 'summary' | 'details') => {
    const escapeValue = (value: string | number) => {
      const text = String(value ?? '')
      if (text.includes(',') || text.includes('"') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`
      }
      return text
    }

    if (mode === 'details') {
      const headers = ['Datum', 'Type', 'Naam', 'Aantal']
      const rows: string[] = []
      rangeRows.forEach(row => {
        row.referrals.forEach(item => {
          rows.push([row.date, 'Doorverwijzing', item.department, item.count].map(escapeValue).join(','))
        })
        row.wastedMeds.forEach(item => {
          const medication = medications.find(med => med.id === item.medicationId)
          rows.push([row.date, 'Weggegooid', medication?.displayName || item.medicationId, item.count].map(escapeValue).join(','))
        })
        if (row.noShows) {
          rows.push([row.date, 'No-show', 'No-show', row.noShows].map(escapeValue).join(','))
        }
        if (row.lateCancellations) {
          rows.push([row.date, 'Late annulering', 'Late annulering', row.lateCancellations].map(escapeValue).join(','))
        }
      })
      const csvContent = [headers.join(','), ...rows].join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `bijhouden_detail_${rangeStart}_${rangeEnd}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      return
    }

    const headers = [
      'Datum',
      'Doorverwijzingen (totaal)',
      'No-shows',
      'Late annuleringen',
      'Weggegooide medicatie (totaal)'
    ]
    const rows = rangeRows.map(row => {
      const referralTotal = row.referrals.reduce((sum, item) => sum + (item.count || 0), 0)
      const wastedTotal = row.wastedMeds.reduce((sum, item) => sum + (item.count || 0), 0)
      return [
        escapeValue(row.date),
        escapeValue(referralTotal),
        escapeValue(row.noShows || 0),
        escapeValue(row.lateCancellations || 0),
        escapeValue(wastedTotal)
      ].join(',')
    })
    const csvContent = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `bijhouden_${rangeStart}_${rangeEnd}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const scheduleSave = (date: string, payload: DayTracking) => {
    const existing = pendingSavesRef.current.get(date)
    if (existing) clearTimeout(existing)
    const timeoutId = setTimeout(async () => {
      try {
        await fetch('/api/dashboard/tracking', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date, ...payload })
        })
      } catch (error) {
        console.error('Failed to save tracking:', error)
      } finally {
        pendingSavesRef.current.delete(date)
      }
    }, 400)
    pendingSavesRef.current.set(date, timeoutId)
  }

  const updateTracking = (updates: Partial<DayTracking>) => {
    setTrackingData(prev => {
      const current = prev[selectedDate] || emptyTracking
      const next = {
        ...current,
        ...updates
      }
      scheduleSave(selectedDate, next)
      return {
        ...prev,
        [selectedDate]: next
      }
    })
  }

  const addDepartmentToDay = (department: string) => {
    if (!department) return
    if (currentTracking.referrals.some(entry => entry.department === department)) return
    updateTracking({
      referrals: [...currentTracking.referrals, { department, count: 0 }]
    })
    setDepartmentToAdd('')
  }

  const addCustomDepartment = () => {
    const next = newDepartment.trim()
    if (!next) return
    const createDepartment = async () => {
      try {
        const response = await fetch('/api/dashboard/departments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: next })
        })
        if (!response.ok) return
        const data = await response.json()
        const name = data?.name || next
        if (!departments.includes(name)) {
          setDepartments(prev => [...prev, name])
        }
        addDepartmentToDay(name)
      } catch (error) {
        console.error('Failed to add department:', error)
      } finally {
        setNewDepartment('')
      }
    }
    createDepartment()
  }

  const addMedicationToDay = (medicationId: string) => {
    if (!medicationId) return
    if (currentTracking.wastedMeds.some(entry => entry.medicationId === medicationId)) return
    updateTracking({
      wastedMeds: [...currentTracking.wastedMeds, { medicationId, count: 0 }]
    })
    setMedicationToAdd('')
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Rapportage</h2>
            <p className="text-sm text-slate-600">Registreer doorverwijzingen, no-shows en weggegooide medicatie per dag.</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-slate-500">
              Datum
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
              />
            </label>
            <button
              type="button"
              onClick={() => setIsExportOpen(true)}
              className="h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
            >
              Export rapportage
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-slate-700">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs text-slate-500">Geselecteerde afdelingen</div>
            <div className="text-lg font-semibold text-slate-900">{currentTracking.referrals.length}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs text-slate-500">No-shows</div>
            <div className="text-lg font-semibold text-slate-900">{currentTracking.noShows}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs text-slate-500">Late annuleringen</div>
            <div className="text-lg font-semibold text-slate-900">{currentTracking.lateCancellations}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs text-slate-500">Weggegooide medicatie soorten</div>
            <div className="text-lg font-semibold text-slate-900">{currentTracking.wastedMeds.length}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6">
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Doorverwijzingen per afdeling</h3>
            <p className="text-sm text-slate-600">Selecteer de afdelingen en vul per afdeling het aantal doorverwijzingen in.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3 items-end">
            <Select
              value={departmentToAdd}
              onChange={(value) => {
                setDepartmentToAdd(value)
                addDepartmentToDay(value)
              }}
              options={availableDepartments.map(dep => ({ value: dep, label: dep }))}
              label="Standaardafdeling toevoegen"
              placeholder="Selecteer afdeling"
            />
            <div className="text-xs text-slate-500">
              Meerdere afdelingen mogelijk.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_160px] gap-3 items-end">
            <label className="text-xs text-slate-500">
              Nieuwe afdeling
              <input
                type="text"
                value={newDepartment}
                onChange={(e) => setNewDepartment(e.target.value)}
                placeholder="Bijv. Dermatologie"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
              />
            </label>
            <button
              type="button"
              onClick={addCustomDepartment}
              className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
            >
              Afdeling toevoegen
            </button>
          </div>

          {currentTracking.referrals.length === 0 ? (
            <div className="text-sm text-slate-500">Nog geen afdelingen geselecteerd.</div>
          ) : (
            <div className="space-y-2">
              {currentTracking.referrals.map(entry => (
                <div key={entry.department} className="grid grid-cols-[1fr_120px_90px] gap-2 items-center">
                  <div className="text-sm font-medium text-slate-800">{entry.department}</div>
                  <input
                    type="number"
                    min={0}
                    value={entry.count}
                    onChange={(e) => {
                      const next = currentTracking.referrals.map(item =>
                        item.department === entry.department
                          ? { ...item, count: parseInt(e.target.value, 10) || 0 }
                          : item
                      )
                      updateTracking({ referrals: next })
                    }}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-center bg-white"
                    placeholder="Aantal"
                    aria-label={`Aantal doorverwijzingen voor ${entry.department}`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = currentTracking.referrals.filter(item => item.department !== entry.department)
                      updateTracking({ referrals: next })
                    }}
                    className="text-xs text-rose-500"
                  >
                    Verwijder
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-slate-200 pt-6 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Weggegooide medicatie</h3>
              <p className="text-sm text-slate-600">Selecteer het medicatietype en registreer de hoeveelheid.</p>
            </div>

            <Select
              value={medicationToAdd}
              onChange={(value) => {
                setMedicationToAdd(value)
                addMedicationToDay(value)
              }}
              options={availableMedications}
              label="Medicatie toevoegen"
              placeholder="Selecteer medicatie"
              searchable
              emptyMessage="Geen medicatie beschikbaar"
            />

            {currentTracking.wastedMeds.length === 0 ? (
              <div className="text-sm text-slate-500">Nog geen weggegooide medicatie geregistreerd.</div>
            ) : (
              <div className="space-y-2">
                {currentTracking.wastedMeds.map(entry => {
                  const medication = medications.find(med => med.id === entry.medicationId)
                  return (
                    <div key={entry.medicationId} className="grid grid-cols-[1fr_120px_90px] gap-2 items-center">
                      <div className="text-sm font-medium text-slate-800">{medication?.displayName || entry.medicationId}</div>
                      <input
                        type="number"
                        min={0}
                        value={entry.count}
                        onChange={(e) => {
                          const next = currentTracking.wastedMeds.map(item =>
                            item.medicationId === entry.medicationId
                              ? { ...item, count: parseInt(e.target.value, 10) || 0 }
                              : item
                          )
                          updateTracking({ wastedMeds: next })
                        }}
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-center bg-white"
                        placeholder="Aantal"
                        aria-label={`Aantal weggegooide medicatie voor ${medication?.displayName || entry.medicationId}`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = currentTracking.wastedMeds.filter(item => item.medicationId !== entry.medicationId)
                          updateTracking({ wastedMeds: next })
                        }}
                        className="text-xs text-rose-500"
                      >
                        Verwijder
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">No-shows & late annuleringen</h3>
              <p className="text-sm text-slate-600">Vul per dag alleen het aantal in.</p>
            </div>
            <div className="space-y-3">
              <label className="text-xs text-slate-500">
                No-shows (aantal)
                <input
                  type="number"
                  min={0}
                  value={currentTracking.noShows}
                  onChange={(e) => updateTracking({ noShows: parseInt(e.target.value, 10) || 0 })}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
                />
              </label>
              <label className="text-xs text-slate-500">
                Late annuleringen (aantal)
                <input
                  type="number"
                  min={0}
                  value={currentTracking.lateCancellations}
                  onChange={(e) => updateTracking({ lateCancellations: parseInt(e.target.value, 10) || 0 })}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
                />
              </label>
            </div>
          </div>

        </div>
      </div>

      {isExportOpen && (
        <div
          className="fixed inset-0 z-[9999] bg-black/40 flex items-center justify-center p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) setIsExportOpen(false)
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Rapportage export</h3>
                <p className="text-sm text-slate-600">Kies een periode en exporteer.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsExportOpen(false)}
                className="text-slate-500 hover:text-slate-900"
                aria-label="Sluiten"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-xs text-slate-500">
                Van
                <input
                  type="date"
                  value={draftRangeStart}
                  onChange={(e) => setDraftRangeStart(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
                />
              </label>
              <label className="text-xs text-slate-500">
                Tot
                <input
                  type="date"
                  value={draftRangeEnd}
                  onChange={(e) => setDraftRangeEnd(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
                />
              </label>
            </div>

            <div className="border-t border-slate-200 pt-4 space-y-3">
              <div className="text-sm text-slate-600">
                Voorbeelddata (periode {draftRangeStart} t/m {draftRangeEnd})
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm text-slate-700">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-xs text-slate-500">Doorverwijzingen totaal</div>
                  <div className="text-lg font-semibold text-slate-900">{rangeTotals.referrals}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-xs text-slate-500">Weggegooide medicatie totaal</div>
                  <div className="text-lg font-semibold text-slate-900">{rangeTotals.wasted}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-xs text-slate-500">No-shows totaal</div>
                  <div className="text-lg font-semibold text-slate-900">{rangeTotals.noShows}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-xs text-slate-500">Late annuleringen totaal</div>
                  <div className="text-lg font-semibold text-slate-900">{rangeTotals.lateCancellations}</div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
                {isRangeLoading ? 'Voorbeelddata laden…' : `Aantal dagen met data: ${rangeRows.length}`}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRangeStart(draftRangeStart)
                    setRangeEnd(draftRangeEnd)
                    handleExportCsv('summary')
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
                  disabled={rangeRows.length === 0}
                >
                  Exporteer CSV (dag)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRangeStart(draftRangeStart)
                    setRangeEnd(draftRangeEnd)
                    handleExportCsv('details')
                  }}
                  className="px-4 py-2 rounded-xl bg-white text-slate-900 text-sm font-semibold border border-slate-200 hover:bg-slate-50"
                  disabled={rangeRows.length === 0}
                >
                  Exporteer CSV (detail)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
