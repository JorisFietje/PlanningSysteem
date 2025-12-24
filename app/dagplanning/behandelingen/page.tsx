'use client'

import { useEffect, useMemo, useState } from 'react'
import { formatDateToISO, getAllMedications } from '@/types'

type DragMode = 'add' | 'remove'

const monthNames = [
  'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
  'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'
]

const weekDays = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']

function treatmentLabel(treatmentNumber: number) {
  if (treatmentNumber === 1) return '1e behandeling'
  if (treatmentNumber === 2) return '2e-3e behandeling'
  if (treatmentNumber === 3) return '4e-6e behandeling'
  return '7e+ behandeling'
}

export default function BehandelingenPage() {
  const today = new Date()
  const [monthDate, setMonthDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDates, setSelectedDates] = useState<string[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartDay, setDragStartDay] = useState<number | null>(null)
  const [dragCurrentDay, setDragCurrentDay] = useState<number | null>(null)
  const [dragMode, setDragMode] = useState<DragMode>('add')
  const [selectionWarning, setSelectionWarning] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [saveError, setSaveError] = useState('')
  const [dateTreatmentCounts, setDateTreatmentCounts] = useState<Record<string, Record<string, number>>>({})

  const selectedSet = useMemo(() => new Set(selectedDates), [selectedDates])

  const currentMonth = monthDate.getMonth()
  const currentYear = monthDate.getFullYear()
  const firstDay = new Date(currentYear, currentMonth, 1)
  const lastDay = new Date(currentYear, currentMonth + 1, 0)
  const daysInMonth = lastDay.getDate()
  const startingDayOfWeek = firstDay.getDay()
  const adjustedStartingDay = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1

  const days: (number | null)[] = []
  for (let i = 0; i < adjustedStartingDay; i++) {
    days.push(null)
  }
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day)
  }

  const getDateISO = (day: number) => formatDateToISO(new Date(currentYear, currentMonth, day))

  const applyRange = (base: Set<string>, startDay: number, endDay: number, mode: DragMode) => {
    const next = new Set(base)
    const minDay = Math.min(startDay, endDay)
    const maxDay = Math.max(startDay, endDay)
    for (let day = minDay; day <= maxDay; day++) {
      const iso = getDateISO(day)
      if (mode === 'add') {
        next.add(iso)
      } else {
        next.delete(iso)
      }
    }
    return next
  }

  const previewSelectedSet = useMemo(() => {
    if (!isDragging || dragStartDay === null || dragCurrentDay === null) {
      return selectedSet
    }
    return applyRange(selectedSet, dragStartDay, dragCurrentDay, dragMode)
  }, [isDragging, dragStartDay, dragCurrentDay, dragMode, selectedSet, currentMonth, currentYear])

  useEffect(() => {
    if (!isDragging) return
    const handleUp = () => {
      if (dragStartDay === null || dragCurrentDay === null) {
        setIsDragging(false)
        return
      }
      const next = applyRange(selectedSet, dragStartDay, dragCurrentDay, dragMode)
      const nextDates = Array.from(next).sort()
      setSelectedDates(nextDates)
      setIsDragging(false)
      setDragStartDay(null)
      setDragCurrentDay(null)
    }
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
    return () => {
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
    }
  }, [isDragging, dragStartDay, dragCurrentDay, dragMode, selectedSet, currentMonth, currentYear])

  const treatments = useMemo(() => {
    const medications = getAllMedications()
    const colorOverrides: Record<string, string> = {
      abatacept: 'emerald',
      bevacizumab_long: 'orange',
      risankizumab: 'sky',
      ustekinumab: 'violet',
      infliximab_10mg: 'blue',
      rituximab_1000mg_day1: 'rose',
      rituximab_500mg_day1: 'rose',
      rituximab_day15: 'rose',
      tocilizumab_first: 'amber',
      tocilizumab_6months: 'amber',
      vedolizumab_first: 'cyan',
      vedolizumab_third_plus: 'cyan',
      ferinject_500mg: 'teal',
      ferinject_1000mg: 'teal',
      myozyme: 'indigo',
      methylprednisolon: 'lime',
      natalizumab_sc: 'fuchsia'
    }
    return medications.flatMap(med =>
      med.variants.map(variant => ({
        id: `${med.id}-${variant.treatmentNumber}`,
        medicationId: med.id,
        color: colorOverrides[med.id] || med.color,
        treatmentNumber: variant.treatmentNumber,
        label: variant.label || treatmentLabel(variant.treatmentNumber),
        displayName: med.displayName,
        totalMinutes: variant.timing.totalTime
      }))
    )
  }, [])

  const colorClasses: Record<string, string> = {
    purple: 'bg-purple-200 border-purple-300 text-purple-900',
    blue: 'bg-blue-200 border-blue-300 text-blue-900',
    green: 'bg-green-200 border-green-300 text-green-900',
    teal: 'bg-teal-200 border-teal-300 text-teal-900',
    orange: 'bg-orange-200 border-orange-300 text-orange-900',
    amber: 'bg-amber-200 border-amber-300 text-amber-900',
    red: 'bg-red-200 border-red-300 text-red-900',
    pink: 'bg-pink-200 border-pink-300 text-pink-900',
    indigo: 'bg-indigo-200 border-indigo-300 text-indigo-900',
    cyan: 'bg-cyan-200 border-cyan-300 text-cyan-900',
    lime: 'bg-lime-200 border-lime-300 text-lime-900',
    slate: 'bg-slate-200 border-slate-300 text-slate-900',
    emerald: 'bg-emerald-200 border-emerald-300 text-emerald-900',
    sky: 'bg-sky-200 border-sky-300 text-sky-900',
    violet: 'bg-violet-200 border-violet-300 text-violet-900',
    rose: 'bg-rose-200 border-rose-300 text-rose-900',
    fuchsia: 'bg-fuchsia-200 border-fuchsia-300 text-fuchsia-900'
  }

  const activeDateForBadge = selectedDates[0]

  const incrementTreatment = (treatmentId: string) => {
    if (selectedDates.length === 0) {
      setSelectionWarning('Selecteer eerst één of meerdere datums in de agenda.')
      return
    }
    setSelectionWarning('')
    setSaveMessage('')
    setSaveError('')
    setDateTreatmentCounts(prev => {
      const next = { ...prev }
      selectedDates.forEach(date => {
        const current = next[date] ? { ...next[date] } : {}
        current[treatmentId] = (current[treatmentId] || 0) + 1
        next[date] = current
      })
      return next
    })
  }

  const decrementTreatment = (treatmentId: string) => {
    if (selectedDates.length === 0) {
      setSelectionWarning('Selecteer eerst één of meerdere datums in de agenda.')
      return
    }
    setSelectionWarning('')
    setSaveMessage('')
    setSaveError('')
    setDateTreatmentCounts(prev => {
      const next = { ...prev }
      selectedDates.forEach(date => {
        const current = next[date] ? { ...next[date] } : {}
        const currentCount = current[treatmentId] || 0
        if (currentCount <= 1) {
          delete current[treatmentId]
        } else {
          current[treatmentId] = currentCount - 1
        }
        if (Object.keys(current).length === 0) {
          delete next[date]
        } else {
          next[date] = current
        }
      })
      return next
    })
  }

  const handleSaveSelections = () => {
    try {
      const payload = {
        selectedDates,
        dateTreatmentCounts
      }
      localStorage.setItem('selectedTreatmentsByDate', JSON.stringify(payload))
      setSaveMessage('Selecties opgeslagen.')
      setSaveError('')
    } catch (error) {
      console.error('Failed to save selections', error)
      setSaveError('Opslaan mislukt.')
      setSaveMessage('')
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
      <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Behandelingen</h2>
          <p className="text-xs text-slate-600 mt-1">Selecteer datums en kies behandelingen om te koppelen.</p>
        </div>
        {selectedDates.length > 0 && (
          <div className="text-xs text-slate-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-full">
            {selectedDates.length} datum(s) geselecteerd
          </div>
        )}
      </div>

      <div className="flex-1 grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2 p-6 overflow-hidden items-start grid-flow-dense">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-3 h-fit w-full col-span-full sm:col-span-2 sm:row-span-5 sm:col-start-1 sm:row-start-1">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setMonthDate(new Date(currentYear, currentMonth - 1, 1))}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Vorige maand"
            >
              <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="font-bold text-sm text-slate-900">
              {monthNames[currentMonth]} {currentYear}
            </div>
            <button
              onClick={() => setMonthDate(new Date(currentYear, currentMonth + 1, 1))}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Volgende maand"
            >
              <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map(day => (
              <div key={day} className="text-center text-[10px] font-semibold text-slate-500 py-1">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 select-none">
            {days.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} className="aspect-square" />
              }
              const dateIso = getDateISO(day)
              const isSelected = previewSelectedSet.has(dateIso)
              const isToday = (() => {
                const d = new Date()
                return day === d.getDate() && currentMonth === d.getMonth() && currentYear === d.getFullYear()
              })()
              return (
                <button
                  key={day}
                  onPointerDown={() => {
                    const mode: DragMode = selectedSet.has(dateIso) ? 'remove' : 'add'
                    setDragMode(mode)
                    setDragStartDay(day)
                    setDragCurrentDay(day)
                    setIsDragging(true)
                  }}
                  onPointerEnter={() => {
                    if (!isDragging) return
                    setDragCurrentDay(day)
                  }}
                  className={`aspect-square rounded-lg text-sm font-semibold transition-all ${
                    isSelected
                      ? 'bg-blue-700 text-white shadow-md'
                      : isToday
                      ? 'bg-blue-50 text-blue-600 border-2 border-blue-300'
                      : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {selectionWarning && (
            <div className="mt-3 text-xs text-red-700">{selectionWarning}</div>
          )}
        </div>

        <div className="flex flex-col gap-2 overflow-hidden col-span-full sm:col-start-3 sm:col-end-[-1] sm:row-start-1 sm:row-end-[-1]">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">Behandelingen selecteren</h3>
            <div className="flex items-center gap-3">
              {selectedDates.length > 0 && (
                <>
                  <button
                    onClick={handleSaveSelections}
                    className="text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 px-3 py-1 rounded-md"
                  >
                    Selecties opslaan
                  </button>
                  <button
                    onClick={() => {
                      setSelectedDates([])
                      setSelectionWarning('')
                      setSaveMessage('')
                      setSaveError('')
                    }}
                    className="text-xs text-slate-600 hover:text-slate-900"
                  >
                    Selectie wissen
                  </button>
                </>
              )}
            </div>
          </div>
          {saveMessage && (
            <div className="text-xs text-green-700">{saveMessage}</div>
          )}
          {saveError && (
            <div className="text-xs text-red-700">{saveError}</div>
          )}

          <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-1.5 overflow-auto">
            {treatments.map(treatment => {
              const badgeCount = activeDateForBadge
                ? dateTreatmentCounts[activeDateForBadge]?.[treatment.id] || 0
                : 0
              const accent = colorClasses[treatment.color] || colorClasses.slate
              return (
                <button
                  key={treatment.id}
                  onClick={() => incrementTreatment(treatment.id)}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    decrementTreatment(treatment.id)
                  }}
                  className={`relative text-left border rounded-md p-1.5 transition-colors shadow-sm ${accent}`}
                >
                  <div className="font-semibold text-[11px] leading-tight">{treatment.displayName}</div>
                  <div className="text-[10px] mt-0.5">{treatment.label}</div>
                  <div className="text-[9px] mt-1">{treatment.totalMinutes} min</div>
                  {badgeCount > 0 && (
                    <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-blue-700 text-white text-[9px] font-bold flex items-center justify-center">
                      {badgeCount}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
