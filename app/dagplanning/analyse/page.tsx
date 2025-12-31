'use client'

import { useEffect, useMemo, useState } from 'react'
import { useDagplanningContext } from '../layout'
import {
  DayOfWeek,
  DEPARTMENT_CONFIG,
  Patient,
  getDayOfWeekFromDate,
  getDaycoPatientsCount,
  getDepartmentHours,
  getMondayOfWeek
} from '@/types'
import { getMedicationById } from '@/types/medications'
import { getTotalDuration } from '@/utils/planning/workload'
import { buildScheduleFromWorkDays } from '@/utils/staff/workDays'
import { buildRampOccurrenceCounts, getRampValuesForOccurrence, loadRampSchedules } from '@/utils/staff/rampSchedules'

type Period = 'day' | 'week' | 'month' | 'quarter' | 'year'
type PeriodOption = Period | 'dashboard'
type DragMode = 'add' | 'remove'

type TreatmentEntry = {
  date: string
  startTime: string
  label: string
  duration?: number
}

const parseDate = (iso: string) => new Date(`${iso}T00:00:00`)

const formatISO = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatDateDMY = (iso: string) => {
  const date = parseDate(iso)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}-${month}-${year}`
}

const getRangeForPeriod = (anchorISO: string, period: Period) => {
  const anchor = parseDate(anchorISO)
  if (period === 'day') {
    return { start: anchor, end: anchor }
  }
  if (period === 'week') {
    const day = anchor.getDay()
    const diff = anchor.getDate() - day + (day === 0 ? -6 : 1)
    const start = new Date(anchor)
    start.setDate(diff)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return { start, end }
  }
  if (period === 'month') {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
    return { start, end }
  }
  if (period === 'quarter') {
    const quarterStartMonth = Math.floor(anchor.getMonth() / 3) * 3
    const start = new Date(anchor.getFullYear(), quarterStartMonth, 1)
    const end = new Date(anchor.getFullYear(), quarterStartMonth + 3, 0)
    return { start, end }
  }
  const start = new Date(anchor.getFullYear(), 0, 1)
  const end = new Date(anchor.getFullYear(), 11, 31)
  return { start, end }
}

const enumerateDates = (start: Date, end: Date) => {
  const dates: string[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    dates.push(formatISO(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

export default function DashboardPage() {
  const { staffMembers, selectedDate } = useDagplanningContext()
  const [plannedPatients, setPlannedPatients] = useState<Patient[]>([])
  const [weekPlans, setWeekPlans] = useState<
    Record<string, { staffSchedule: Record<DayOfWeek, string[]>; coordinatorByDay: Record<DayOfWeek, string | null>; dayCapacities: Record<string, { agreedMaxPatients?: number | null }> }>
  >({})
  const [monthDate, setMonthDate] = useState(() => new Date(selectedDate + 'T00:00:00'))
  const [selectedDates, setSelectedDates] = useState<string[]>([])
  const [hasCustomSelection, setHasCustomSelection] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartDay, setDragStartDay] = useState<number | null>(null)
  const [dragCurrentDay, setDragCurrentDay] = useState<number | null>(null)
  const [dragMode, setDragMode] = useState<DragMode>('add')

  const rampSchedules = useMemo(() => loadRampSchedules(), [])
  const defaultSchedule = useMemo(() => buildScheduleFromWorkDays(staffMembers), [staffMembers])

  useEffect(() => {
    if (hasCustomSelection) return
    setSelectedDates([selectedDate])
    setMonthDate(new Date(selectedDate + 'T00:00:00'))
  }, [selectedDate, hasCustomSelection])

  useEffect(() => {
    if (selectedDates.length > 0) return
    setSelectedDates([selectedDate])
    setHasCustomSelection(false)
  }, [selectedDates, selectedDate])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem('dashboardSelectedDates')
    if (!stored) return
    try {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed) && parsed.length > 0) {
        setSelectedDates(parsed)
        setHasCustomSelection(true)
        setMonthDate(new Date(parsed[0] + 'T00:00:00'))
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (selectedDates.length === 0) return
    localStorage.setItem('dashboardSelectedDates', JSON.stringify(selectedDates))
  }, [selectedDates])

  useEffect(() => {
    const dates = selectedDates.length > 0 ? selectedDates : [selectedDate]
    let isMounted = true
    Promise.all(
      dates.map(date =>
        fetch(`/api/patients?date=${date}`)
          .then(res => (res.ok ? res.json() : []))
          .catch(() => [])
      )
    )
      .then(results => {
        if (!isMounted) return
        const merged = results.flat() as Patient[]
        merged.sort((a, b) => a.startTime.localeCompare(b.startTime))
        setPlannedPatients(merged)
      })
      .catch(() => {
        if (isMounted) setPlannedPatients([])
      })
    return () => {
      isMounted = false
    }
  }, [selectedDates, selectedDate])

  useEffect(() => {
    const dates = selectedDates.length > 0 ? selectedDates : [selectedDate]
    const weekStarts = Array.from(new Set(dates.map(date => getMondayOfWeek(date))))
    if (weekStarts.length === 0) return
    let isMounted = true
    Promise.all(
      weekStarts.map(async weekStart => {
        const res = await fetch(`/api/weekplan?weekStart=${weekStart}`)
        if (!res.ok) return [weekStart, null] as const
        const data = await res.json()
        return [weekStart, data] as const
      })
    )
      .then(entries => {
        if (!isMounted) return
        const next: typeof weekPlans = {}
        entries.forEach(([weekStart, plan]) => {
          if (!plan) return
          const staffSchedule: Record<DayOfWeek, string[]> = {
            monday: [],
            tuesday: [],
            wednesday: [],
            thursday: [],
            friday: []
          }
          const coordinatorByDay: Record<DayOfWeek, string | null> = {
            monday: null,
            tuesday: null,
            wednesday: null,
            thursday: null,
            friday: null
          }
          plan.staffSchedules?.forEach((s: any) => {
            const day = s.dayOfWeek as DayOfWeek
            try {
              const parsed = JSON.parse(s.staffNames)
              if (Array.isArray(parsed)) {
                staffSchedule[day] = parsed
              } else {
                staffSchedule[day] = parsed?.staff || []
                coordinatorByDay[day] = parsed?.coordinator || null
              }
            } catch {
              staffSchedule[day] = []
            }
          })
          const dayCapacities = (plan.dayCapacities || []).reduce((acc: Record<string, { agreedMaxPatients?: number | null }>, item: any) => {
            acc[item.date] = { agreedMaxPatients: item.agreedMaxPatients }
            return acc
          }, {})
          next[weekStart] = { staffSchedule, coordinatorByDay, dayCapacities }
        })
        setWeekPlans(next)
      })
      .catch(() => {
        if (isMounted) setWeekPlans({})
      })
    return () => {
      isMounted = false
    }
  }, [selectedDates, selectedDate])

  const patientEntries = useMemo<TreatmentEntry[]>(() => {
    return plannedPatients.map(patient => ({
      date: patient.scheduledDate || selectedDate,
      startTime: patient.startTime,
      label: getMedicationById(patient.medicationType)?.displayName || patient.medicationType,
      duration: getTotalDuration(patient)
    }))
  }, [plannedPatients, selectedDate])

  const selectedSet = useMemo(() => new Set(selectedDates), [selectedDates])

  const baseEntries = useMemo(() => {
    if (selectedDates.length === 0) return patientEntries
    return patientEntries.filter(entry => selectedSet.has(entry.date))
  }, [patientEntries, selectedDates, selectedSet])

  const getActiveDates = (period: Period) => {
    const range = getRangeForPeriod(selectedDate, period)
    const baseDates = selectedDates.length > 0 ? selectedDates : enumerateDates(range.start, range.end)
    return baseDates
      .filter(date => {
        const parsed = parseDate(date)
        return parsed >= range.start && parsed <= range.end
      })
      .sort()
  }

  const filterEntries = (period: Period) => {
    const range = getRangeForPeriod(selectedDate, period)
    return baseEntries.filter(entry => {
      const date = parseDate(entry.date)
      return date >= range.start && date <= range.end
    })
  }

  const filteredForCapacity = useMemo(() => filterEntries('year'), [baseEntries, selectedDate])
  const filteredForMedication = useMemo(() => filterEntries('year'), [baseEntries, selectedDate])
  const filteredForOccupancy = useMemo(() => filterEntries('year'), [baseEntries, selectedDate])
  const filteredForWorkload = useMemo(() => filterEntries('year'), [baseEntries, selectedDate])
  const filteredForDistribution = useMemo(() => filterEntries('year'), [baseEntries, selectedDate])

  const scheduleByWeekStart = useMemo(() => {
    const map: Record<string, Record<DayOfWeek, string[]>> = {}
    Object.entries(weekPlans).forEach(([weekStart, plan]) => {
      map[weekStart] = plan.staffSchedule
    })
    return map
  }, [weekPlans])

  const rampOccurrencesByDate = useMemo(() => {
    if (!rampSchedules || Object.keys(rampSchedules).length === 0) return {}
    const sorted = [...(selectedDates.length > 0 ? selectedDates : [selectedDate])].sort()
    const lastDate = sorted[sorted.length - 1]
    return buildRampOccurrenceCounts(rampSchedules, scheduleByWeekStart, defaultSchedule, lastDate)
  }, [rampSchedules, scheduleByWeekStart, defaultSchedule, selectedDates, selectedDate])

  const getMaxCapacityForDate = (date: string) => {
    const day = getDayOfWeekFromDate(date)
    const weekStart = getMondayOfWeek(date)
    const plan = weekPlans[weekStart]
    const schedule = plan?.staffSchedule || defaultSchedule
    const coordinator = plan?.coordinatorByDay?.[day] || null
    const staffForDay = schedule[day] || []
    const availableStaff = staffMembers.filter(s => staffForDay.includes(s.name))
    const regularStaff = coordinator ? availableStaff.filter(s => s.name !== coordinator) : availableStaff
    const regularCapacity = regularStaff.reduce((sum, staff) => {
      const occurrence = rampOccurrencesByDate[date]?.[staff.name]
      const ramp = rampSchedules[staff.name]
      const rampValues = occurrence && ramp ? getRampValuesForOccurrence(ramp, occurrence) : null
      const effectiveMax = rampValues?.patients ?? staff.maxPatients
      return sum + effectiveMax
    }, 0)
    return regularCapacity + (coordinator ? getDaycoPatientsCount() : 0)
  }

  const capacityOverview = useMemo(() => {
    const dates = selectedDates.length > 0 ? selectedDates : [selectedDate]
    const plannedCounts = filteredForCapacity.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.date] = (acc[entry.date] || 0) + 1
      return acc
    }, {})
    let planned = 0
    let capacity = 0
    dates.forEach(date => {
      const count = plannedCounts[date] || 0
      planned += count
      capacity += getMaxCapacityForDate(date)
    })
    const ratio = capacity > 0 ? planned / capacity : 0
    return {
      planned,
      capacity,
      percent: Math.min(100, Math.round(ratio * 100))
    }
  }, [filteredForCapacity, selectedDates, selectedDate, staffMembers, weekPlans, rampOccurrencesByDate])

  const medicationTotals = useMemo(() => {
    const totals = filteredForMedication.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.label] = (acc[entry.label] || 0) + 1
      return acc
    }, {})
    return Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [filteredForMedication])

  const peakChairOccupancy = useMemo(() => {
    const entriesWithDuration = filteredForOccupancy.filter(entry => entry.duration && entry.startTime)
    if (entriesWithDuration.length === 0) return { peak: 0, date: null as string | null }
    const byDate = new Map<string, TreatmentEntry[]>()
    entriesWithDuration.forEach(entry => {
      if (!byDate.has(entry.date)) byDate.set(entry.date, [])
      byDate.get(entry.date)?.push(entry)
    })
    let peak = 0
    let peakDate: string | null = null
    byDate.forEach((entries, date) => {
      const minutes: Record<number, number> = {}
      entries.forEach(entry => {
        const [h, m] = entry.startTime.split(':').map(Number)
        const start = h * 60 + m
        const duration = entry.duration || 0
        for (let min = start; min < start + duration; min++) {
          minutes[min] = (minutes[min] || 0) + 1
        }
      })
      const localPeak = Math.max(...Object.values(minutes), 0)
      if (localPeak > peak) {
        peak = localPeak
        peakDate = date
      }
    })
    return { peak, date: peakDate }
  }, [filteredForOccupancy])

  const workloadProfile = useMemo(() => {
    const countsByDate = filteredForWorkload.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.date] = (acc[entry.date] || 0) + 1
      return acc
    }, {})
    const values = Object.values(countsByDate)
    if (values.length === 0) return { average: 0, peak: 0 }
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length
    const peak = Math.max(...values, 0)
    return { average: Math.round(avg * 10) / 10, peak }
  }, [filteredForWorkload])

  const dayPartDistribution = useMemo(() => {
    const result = { ochtend: 0, middag: 0, avond: 0 }
    filteredForDistribution.forEach(entry => {
      const hour = parseInt(entry.startTime.slice(0, 2), 10)
      if (hour < 12) result.ochtend += 1
      else if (hour < 16) result.middag += 1
      else result.avond += 1
    })
    return result
  }, [filteredForDistribution])

  const occupancyUtilization = useMemo(() => {
    const entriesWithDuration = filteredForOccupancy.filter(entry => entry.duration)
    if (entriesWithDuration.length === 0) return 0
    const range = getRangeForPeriod(selectedDate, 'year')
    const { startMinutes, endMinutes } = getDepartmentHours()
    const totalMinutes = Math.max(endMinutes - startMinutes, 1)
    const dates = selectedDates.length > 0 ? selectedDates : [selectedDate]
    const capacityMinutes = dates.length * totalMinutes * DEPARTMENT_CONFIG.TOTAL_CHAIRS
    const usedMinutes = entriesWithDuration.reduce((sum, entry) => sum + (entry.duration || 0), 0)
    const ratio = capacityMinutes > 0 ? usedMinutes / capacityMinutes : 0
    return Math.min(100, Math.round(ratio * 100))
  }, [filteredForOccupancy, selectedDates, selectedDate])

  const currentMonth = monthDate.getMonth()
  const currentYear = monthDate.getFullYear()
  const firstDay = new Date(currentYear, currentMonth, 1)
  const lastDay = new Date(currentYear, currentMonth + 1, 0)
  const daysInMonth = lastDay.getDate()
  const startingDayOfWeek = firstDay.getDay()
  const adjustedStartingDay = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1
  const monthNames = [
    'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
    'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'
  ]
  const weekDays = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']
  const days: (number | null)[] = []
  for (let i = 0; i < adjustedStartingDay; i++) days.push(null)
  for (let day = 1; day <= daysInMonth; day++) days.push(day)

  const getDateISO = (day: number) => formatISO(new Date(currentYear, currentMonth, day))

  const applyRange = (base: Set<string>, startDay: number, endDay: number, mode: DragMode) => {
    const next = new Set(base)
    const minDay = Math.min(startDay, endDay)
    const maxDay = Math.max(startDay, endDay)
    for (let day = minDay; day <= maxDay; day++) {
      const iso = getDateISO(day)
      if (mode === 'add') next.add(iso)
      else next.delete(iso)
    }
    return next
  }

  const previewSelectedSet = useMemo(() => {
    if (!isDragging || dragStartDay === null || dragCurrentDay === null) return selectedSet
    return applyRange(selectedSet, dragStartDay, dragCurrentDay, dragMode)
  }, [isDragging, dragStartDay, dragCurrentDay, dragMode, selectedSet])

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
      setHasCustomSelection(true)
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
  }, [isDragging, dragStartDay, dragCurrentDay, dragMode, selectedSet])

  const isSelected = (day: number) => previewSelectedSet.has(getDateISO(day))
  const isToday = (day: number) => {
    const today = new Date()
    return day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear()
  }

  const selectedLabel = useMemo(() => {
    if (selectedDates.length === 0) return formatDateDMY(selectedDate)
    if (selectedDates.length === 1) return formatDateDMY(selectedDates[0])
    const sorted = [...selectedDates].sort()
    return `${formatDateDMY(sorted[0])} t/m ${formatDateDMY(sorted[sorted.length - 1])}`
  }, [selectedDates, selectedDate])

  const statusSummary = useMemo(() => {
    const noShows = plannedPatients.filter(patient => patient.noShow).length
    const lateCancellations = plannedPatients.filter(patient => patient.lateCancellation).length
    const discardedMedication = plannedPatients.filter(patient => patient.medicationDiscarded).length
    return { noShows, lateCancellations, discardedMedication }
  }, [plannedPatients])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">Overzicht van planning, capaciteit en drukte.</p>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <div className="relative">
            <button
              onClick={() => setCalendarOpen(!calendarOpen)}
              className="bg-white rounded-lg border border-slate-300 hover:border-blue-500 hover:shadow-sm transition-all px-3 py-2 flex items-center gap-2 min-w-[210px]"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <div className="flex-1 text-left">
                <div className="font-semibold text-sm text-slate-900">{selectedLabel}</div>
              </div>
              <svg
                className={`w-4 h-4 text-slate-400 transition-transform ${calendarOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {calendarOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setCalendarOpen(false)} />
                <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 p-4 z-20 min-w-[320px]">
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={() => setMonthDate(new Date(currentYear, currentMonth - 1, 1))}
                      className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                      aria-label="Vorige maand"
                    >
                      <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <div className="font-bold text-lg text-slate-900">
                      {monthNames[currentMonth]} {currentYear}
                    </div>
                    <button
                      onClick={() => setMonthDate(new Date(currentYear, currentMonth + 1, 1))}
                      className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                      aria-label="Volgende maand"
                    >
                      <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {weekDays.map(day => (
                      <div key={day} className="text-center text-xs font-semibold text-slate-500 py-1">
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1 select-none">
                    {days.map((day, index) => {
                      if (day === null) return <div key={`empty-${index}`} className="aspect-square" />
                      return (
                        <button
                          key={day}
                          onPointerDown={() => {
                            const iso = getDateISO(day)
                            const mode: DragMode = selectedSet.has(iso) ? 'remove' : 'add'
                            setDragMode(mode)
                            setIsDragging(true)
                            setDragStartDay(day)
                            setDragCurrentDay(day)
                          }}
                          onPointerEnter={() => {
                            if (isDragging) setDragCurrentDay(day)
                          }}
                          className={`aspect-square rounded-lg text-sm font-semibold transition-all ${
                            isSelected(day)
                              ? 'bg-blue-700 text-white shadow-md'
                              : isToday(day)
                              ? 'bg-blue-50 text-blue-600 border-2 border-blue-300'
                              : 'hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          {day}
                        </button>
                      )
                    })}
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-200 text-xs text-slate-500">
                    Sleep om meerdere datums te selecteren.
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">No-show</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{statusSummary.noShows}</div>
          <div className="text-xs text-slate-500 mt-1">Geselecteerde periode</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Late annulering</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{statusSummary.lateCancellations}</div>
          <div className="text-xs text-slate-500 mt-1">Geselecteerde periode</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Medicatie weggegooid</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{statusSummary.discardedMedication}</div>
          <div className="text-xs text-slate-500 mt-1">Geselecteerde periode</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-slate-500">Ingeplande patiënten vs capaciteit</div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{capacityOverview.planned}</span>
            <span className="text-sm text-slate-500">/ {capacityOverview.capacity} max</span>
          </div>
          <div className="mt-3 h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-blue-600" style={{ width: `${capacityOverview.percent}%` }} />
          </div>
          <div className="mt-2 text-xs text-slate-500">{capacityOverview.percent}% van de capaciteit in deze periode</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-slate-500">Werkdruk (gemiddeld / piek)</div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{workloadProfile.average}</span>
            <span className="text-sm text-slate-500">gemiddeld</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">Piek: <span className="font-semibold text-slate-700">{workloadProfile.peak}</span> patiënten tegelijk</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-slate-500">Stoelbezetting (tijd × stoelen)</div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{occupancyUtilization}%</span>
          </div>
          <div className="mt-3 h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-emerald-600" style={{ width: `${occupancyUtilization}%` }} />
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Hoogste bezetting: <span className="font-semibold text-slate-700">{peakChairOccupancy.peak}</span>{' '}
            {peakChairOccupancy.date ? `op ${formatDateDMY(peakChairOccupancy.date)}` : ''}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-900">Behandelingen per medicatie</h2>
          </div>
          {medicationTotals.length === 0 ? (
            <div className="text-sm text-slate-400">Geen behandelingen gevonden in deze periode.</div>
          ) : (
            <div className="space-y-2">
              {medicationTotals.map(([label, count]) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="w-36 text-xs text-slate-600 truncate">{label}</div>
                  <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-indigo-600" style={{ width: `${Math.min(100, count * 8)}%` }} />
                  </div>
                  <div className="w-6 text-xs text-slate-600 text-right">{count}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-900">Dagdeel verdeling</h2>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            {(['ochtend', 'middag', 'avond'] as const).map(key => (
              <div key={key} className="border border-slate-200 rounded-lg p-3">
                <div className="text-xs text-slate-500">{key}</div>
                <div className="text-2xl font-bold text-slate-900">{dayPartDistribution[key]}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-900">Behandelingstrend per dag</h2>
          <div className="text-xs text-slate-500">Gebaseerd op ingeplande behandelingen</div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {selectedDates.length > 0 ? selectedDates : [selectedDate].map(date => {
            const count = filteredForCapacity.filter(entry => entry.date === date).length
            return (
              <div key={date} className="border border-slate-200 rounded-lg p-3">
                <div className="text-xs text-slate-500">{formatDateDMY(date)}</div>
                <div className="text-2xl font-bold text-slate-900">{count}</div>
                <div className="h-2 mt-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-sky-600" style={{ width: `${Math.min(100, count * 10)}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
