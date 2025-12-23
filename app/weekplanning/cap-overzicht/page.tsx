'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useWeekplanningContext } from '../layout'
import CapOverview from '@/components/planning/CapOverview'
import DayStaffModal from '@/components/planning/DayStaffModal'
import { DayOfWeek, formatDateToISO, getMondayOfWeek } from '@/types'

const emptySchedule: Record<DayOfWeek, string[]> = {
  monday: [],
  tuesday: [],
  wednesday: [],
  thursday: [],
  friday: []
}

const emptyCoordinators: Record<DayOfWeek, string | null> = {
  monday: null,
  tuesday: null,
  wednesday: null,
  thursday: null,
  friday: null
}

const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']

const getFirstMondayOfMonth = (monthValue: string): Date => {
  const [year, month] = monthValue.split('-').map(Number)
  const firstDay = new Date(year, month - 1, 1)
  const dayIndex = firstDay.getDay()
  const diff = dayIndex === 0 ? -6 : 1 - dayIndex
  const monday = new Date(firstDay)
  monday.setDate(firstDay.getDate() + diff)
  return monday
}

const getWeekDates = (weekStart: Date): string[] => {
  const dates: string[] = []
  for (let i = 0; i < 5; i++) {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + i)
    dates.push(formatDateToISO(date))
  }
  return dates
}

const addDays = (date: Date, daysToAdd: number) => {
  const next = new Date(date)
  next.setDate(date.getDate() + daysToAdd)
  return next
}

export default function CapOverzichtPage() {
  const { staffMembers, selectedWeekStart } = useWeekplanningContext()
  const [selectedMonth, setSelectedMonth] = useState(() => selectedWeekStart.slice(0, 7))
  const [weeks, setWeeks] = useState<
    Array<{
      weekStart: string
      dates: string[]
      staffSchedule: Record<DayOfWeek, string[]>
      coordinatorByDay: Record<DayOfWeek, string | null>
      dayCapacities: Record<string, { plannedPatients?: number | null; agreedMaxPatients?: number | null; note?: string | null; sennaNote?: string | null }>
      exists: boolean
    }>
  >([])
  const [plannedCounts, setPlannedCounts] = useState<Record<string, number>>({})
  const [staffModal, setStaffModal] = useState<{
    isOpen: boolean
    weekStart: string
    date: string
    day: DayOfWeek
  }>({ isOpen: false, weekStart: '', date: '', day: 'monday' })

  const weekStarts = useMemo(() => {
    const firstMonday = getFirstMondayOfMonth(selectedMonth)
    return [0, 7, 14, 21].map(offset => addDays(firstMonday, offset))
  }, [selectedMonth])

  useEffect(() => {
    const loadWeeks = async () => {
      const results = await Promise.all(
        weekStarts.map(async (weekStartDate) => {
          const weekStart = formatDateToISO(weekStartDate)
          const weekEndDate = addDays(weekStartDate, 4)
          const dates = getWeekDates(weekStartDate)

          const response = await fetch(`/api/weekplan?weekStart=${weekStart}`)
          if (!response.ok) {
            return {
              weekStart,
              dates,
              staffSchedule: { ...emptySchedule },
              coordinatorByDay: { ...emptyCoordinators },
              dayCapacities: {},
              exists: false
            }
          }

          const data = await response.json()
          if (!data) {
            return {
              weekStart,
              dates,
              staffSchedule: { ...emptySchedule },
              coordinatorByDay: { ...emptyCoordinators },
              dayCapacities: {},
              exists: false
            }
          }
          const schedule: Record<DayOfWeek, string[]> = { ...emptySchedule }
          const coordinators: Record<DayOfWeek, string | null> = { ...emptyCoordinators }

          data.staffSchedules?.forEach((s: { dayOfWeek: DayOfWeek; staffNames: string }) => {
            const day = s.dayOfWeek
            try {
              const parsed = JSON.parse(s.staffNames)
              if (Array.isArray(parsed)) {
                schedule[day] = parsed
              } else {
                schedule[day] = parsed?.staff || []
                coordinators[day] = parsed?.coordinator || null
              }
            } catch {
              schedule[day] = []
            }
          })

          const mapped: Record<string, { plannedPatients?: number | null; agreedMaxPatients?: number | null; note?: string | null; sennaNote?: string | null }> = {}
          data.dayCapacities?.forEach((cap: any) => {
            mapped[cap.date] = {
              plannedPatients: cap.plannedPatients ?? null,
              agreedMaxPatients: cap.agreedMaxPatients ?? null,
              note: cap.note ?? null,
              sennaNote: cap.sennaNote ?? null
            }
          })

          return {
            weekStart,
            dates,
            staffSchedule: schedule,
            coordinatorByDay: coordinators,
            dayCapacities: mapped,
            exists: Boolean(data?.id),
            weekEnd: formatDateToISO(weekEndDate)
          }
        })
      )

      setWeeks(results as any)
    }

    loadWeeks()
  }, [weekStarts])

  const fetchPlannedCounts = useCallback(async (dates: string[]) => {
    if (dates.length === 0) return
    try {
      const uniqueDates = Array.from(new Set(dates))
      const results = await Promise.all(
        uniqueDates.map(async (date) => {
          const response = await fetch(`/api/patients?date=${date}`)
          if (!response.ok) {
            return { date, count: 0 }
          }
          const patients = await response.json()
          return { date, count: Array.isArray(patients) ? patients.length : 0 }
        })
      )

      const nextCounts: Record<string, number> = {}
      results.forEach(({ date, count }) => {
        nextCounts[date] = count
      })
      setPlannedCounts(nextCounts)
    } catch (error) {
      console.error('Failed to fetch planned patient counts:', error)
    }
  }, [])

  useEffect(() => {
    const dates = weeks.flatMap(week => week.dates)
    fetchPlannedCounts(dates)
  }, [weeks, fetchPlannedCounts])

  useEffect(() => {
    const handleFocus = () => {
      const dates = weeks.flatMap(week => week.dates)
      fetchPlannedCounts(dates)
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') handleFocus()
    }
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [weeks, fetchPlannedCounts])

  const ensureWeekPlanExists = async (weekStart: string) => {
    const existing = weeks.find(w => w.weekStart === weekStart)
    if (existing?.exists) return

    const weekStartDate = new Date(weekStart + 'T00:00:00')
    const weekEndDate = addDays(weekStartDate, 4)
    await fetch('/api/weekplan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        weekStartDate: weekStart,
        weekEndDate: formatDateToISO(weekEndDate),
        staffSchedules: [],
        treatments: []
      })
    })

    setWeeks(prev =>
      prev.map(w => (w.weekStart === weekStart ? { ...w, exists: true } : w))
    )
  }

  const handleUpdateDayCapacity = async (
    weekStart: string,
    date: string,
    updates: { plannedPatients?: number | null; agreedMaxPatients?: number | null; note?: string | null; sennaNote?: string | null }
  ) => {
    setWeeks(prev =>
      prev.map(week => {
        if (week.weekStart !== weekStart) return week
        const existing = week.dayCapacities[date] || {}
        return {
          ...week,
          dayCapacities: {
            ...week.dayCapacities,
            [date]: {
              plannedPatients: updates.plannedPatients ?? existing.plannedPatients ?? null,
              agreedMaxPatients: updates.agreedMaxPatients ?? existing.agreedMaxPatients ?? null,
              note: updates.note ?? existing.note ?? null,
              sennaNote: updates.sennaNote ?? existing.sennaNote ?? null
            }
          }
        }
      })
    )

    await ensureWeekPlanExists(weekStart)

    await fetch('/api/weekplan/day-capacity', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        weekStartDate: getMondayOfWeek(date),
        date,
        plannedPatients: updates.plannedPatients ?? null,
        agreedMaxPatients: updates.agreedMaxPatients ?? null,
        note: updates.note ?? null,
        sennaNote: updates.sennaNote ?? null
      })
    })
  }

  const handleOpenStaffModal = (weekStart: string, date: string, day: DayOfWeek) => {
    setStaffModal({ isOpen: true, weekStart, date, day })
  }

  const handleSaveStaff = async (nextStaff: string[], nextCoordinator: string | null) => {
    const { weekStart, day } = staffModal
    if (!weekStart) return

    setWeeks(prev =>
      prev.map(week => {
        if (week.weekStart !== weekStart) return week
        return {
          ...week,
          staffSchedule: {
            ...week.staffSchedule,
            [day]: nextStaff
          },
          coordinatorByDay: {
            ...week.coordinatorByDay,
            [day]: nextCoordinator
          }
        }
      })
    )

    await fetch('/api/weekplan/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        weekStartDate: weekStart,
        weekEndDate: formatDateToISO(addDays(new Date(weekStart + 'T00:00:00'), 4)),
        dayOfWeek: day,
        staff: nextStaff,
        coordinator: nextCoordinator
      })
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">CAP Overzicht</h2>
          <p className="text-sm text-slate-600">Bekijk 4 weken per maand en wissel eenvoudig van maand.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">Maand:</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
          />
        </div>
      </div>

      <CapOverview
        weeks={weeks}
        staffMembers={staffMembers}
        plannedCounts={plannedCounts}
        onEditDayStaff={handleOpenStaffModal}
        onUpdateDayCapacity={handleUpdateDayCapacity}
      />

      <DayStaffModal
        isOpen={staffModal.isOpen}
        date={staffModal.date}
        day={staffModal.day}
        staffMembers={staffMembers}
        selectedStaff={
          weeks.find(w => w.weekStart === staffModal.weekStart)?.staffSchedule[staffModal.day] || []
        }
        coordinator={
          weeks.find(w => w.weekStart === staffModal.weekStart)?.coordinatorByDay[staffModal.day] || null
        }
        onClose={() => setStaffModal({ ...staffModal, isOpen: false })}
        onSave={handleSaveStaff}
      />
    </div>
  )
}
