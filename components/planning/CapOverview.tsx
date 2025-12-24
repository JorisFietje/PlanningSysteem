'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { DayOfWeek, StaffMember, formatDateToISO, getDayCoordinators, getDaycoPatientsCount } from '@/types'
import { buildScheduleFromWorkDays } from '@/utils/staff/workDays'
import { RampScheduleMap, buildRampOccurrenceCounts, getRampValuesForOccurrence } from '@/utils/staff/rampSchedules'

interface CapOverviewWeek {
  weekStart: string
  dates: string[]
  staffSchedule: Record<DayOfWeek, string[]>
  coordinatorByDay: Record<DayOfWeek, string | null>
  dayCapacities: Record<string, { plannedPatients?: number | null; agreedMaxPatients?: number | null; note?: string | null; sennaNote?: string | null }>
}

interface CapOverviewProps {
  weeks: CapOverviewWeek[]
  staffMembers: StaffMember[]
  plannedCounts: Record<string, number>
  rampSchedules?: RampScheduleMap
  monthValue?: string
  onMonthChange?: (value: string) => void
  onEditDayStaff: (weekStart: string, date: string, day: DayOfWeek) => void
  onUpdateDayCapacity: (
    weekStart: string,
    date: string,
    updates: { plannedPatients?: number | null; agreedMaxPatients?: number | null; note?: string | null; sennaNote?: string | null }
  ) => void
}

const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
const dayLabelShort: Record<DayOfWeek, string> = {
  monday: 'ma',
  tuesday: 'di',
  wednesday: 'wo',
  thursday: 'do',
  friday: 'vr'
}

const getWeekNumber = (date: Date): number => {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = target.getUTCDay() || 7
  target.setUTCDate(target.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1))
  return Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

  const parseNumericInput = (value: string): number | null => {
    if (value.trim() === '') return null
    const parsed = parseInt(value, 10)
    if (Number.isNaN(parsed)) return null
    return parsed
  }

  const resizeTextarea = (element: HTMLTextAreaElement, resetOnBlur = false) => {
    if (resetOnBlur) {
      element.style.height = '32px'
      return
  }
  element.style.height = '0px'
  const nextHeight = Math.max(element.scrollHeight, 32)
  element.style.height = `${nextHeight}px`
}

export default function CapOverview({
  weeks,
  staffMembers,
  plannedCounts,
  rampSchedules = {},
  monthValue,
  onMonthChange,
  onEditDayStaff,
  onUpdateDayCapacity
}: CapOverviewProps) {
  const [collapsedWeeks, setCollapsedWeeks] = useState<Record<string, boolean>>({})
  const initializedDefaultsRef = useRef<Set<string>>(new Set())
  const [plannedDrafts, setPlannedDrafts] = useState<Record<string, string>>({})
  const dayCoordinators = getDayCoordinators()
  const defaultSchedule = useMemo(() => buildScheduleFromWorkDays(staffMembers), [staffMembers])

  const scheduleByWeekStart = useMemo(() => {
    const map: Record<string, Record<DayOfWeek, string[]>> = {}
    weeks.forEach(week => {
      map[week.weekStart] = week.staffSchedule
    })
    return map
  }, [weeks])

  const maxDateInWeeks = useMemo(() => {
    const allDates = weeks.flatMap(week => week.dates).filter(Boolean)
    if (allDates.length === 0) return formatDateToISO(new Date())
    return allDates.reduce((max, date) => (date > max ? date : max), allDates[0])
  }, [weeks])

  const rampOccurrencesByDate = useMemo(() => {
    if (!rampSchedules || Object.keys(rampSchedules).length === 0) return {}
    return buildRampOccurrenceCounts(rampSchedules, scheduleByWeekStart, defaultSchedule, maxDateInWeeks)
  }, [rampSchedules, scheduleByWeekStart, defaultSchedule, maxDateInWeeks])

  const today = useMemo(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }, [])

  useEffect(() => {
    setCollapsedWeeks(prev => {
      const next: Record<string, boolean> = { ...prev }
      weeks.forEach(week => {
        if (next[week.weekStart] === undefined) {
          next[week.weekStart] = false
        }
      })
      return next
    })
  }, [weeks])

  useEffect(() => {
    const nextInitialized = new Set(initializedDefaultsRef.current)
    weeks.forEach(week => {
      days.forEach((day, index) => {
        const date = week.dates[index]
        if (!date) return
        const capacity = week.dayCapacities[date]
        const agreedMax = capacity?.agreedMaxPatients ?? null
        const key = `${week.weekStart}-${date}`
        if (agreedMax !== null) {
          nextInitialized.add(key)
          return
        }

        const staffForDay = week.staffSchedule[day] || []
        const availableStaff = staffMembers.filter(s => staffForDay.includes(s.name))
        const coordinator = week.coordinatorByDay[day] || null
        const regularStaff = coordinator ? availableStaff.filter(s => s.name !== coordinator) : availableStaff
        const regularCapacity = regularStaff.reduce((sum, s) => sum + s.maxPatients, 0)
        const maxCapacity = regularCapacity + (coordinator ? getDaycoPatientsCount() : 0)

        if (!nextInitialized.has(key)) {
          onUpdateDayCapacity(week.weekStart, date, { agreedMaxPatients: maxCapacity })
          nextInitialized.add(key)
        }
      })
    })
    initializedDefaultsRef.current = nextInitialized
  }, [weeks, staffMembers, onUpdateDayCapacity])

  const getDayLabel = (date: string) => {
    const dateObj = new Date(date + 'T00:00:00')
    return `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getFullYear()}`
  }

  const isDateInMonth = (date: string, month: string | undefined) => {
    if (!month) return true
    return date.startsWith(`${month}-`)
  }

  const getPlannedStatus = (planned: number | null, base: number) => {
    if (planned === null) return 'empty'
    if (planned > base) return 'over'
    if (planned === base) return 'equal'
    return 'under'
  }

  const buildAutoNotes = (note: string, autoLines: string[]) => {
    if (autoLines.length === 0) return note
    const noteLines = note.split('\n').filter(line => line.trim() !== '')
    const filtered = noteLines.filter(line => {
      return !autoLines.some(autoLine => {
        const name = autoLine.split(' werkt van ')[0]
        const regex = new RegExp(`^${name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')} werkt van .* tot .*\\.?$`, 'i')
        return regex.test(line.trim())
      })
    })
    return [...filtered, ...autoLines].join('\n').trim()
  }

  const getPlannedRatioStatus = (planned: number | null, base: number) => {
    if (planned === null || base <= 0) return 'empty'
    const ratio = planned / base
    if (ratio >= 1) return 'over'
    if (ratio >= 0.8) return 'near'
    return 'under'
  }

  const plannedColor = (status: string) => {
    if (status === 'over') return 'bg-red-100 text-red-900 border-transparent'
    if (status === 'near') return 'bg-yellow-100 text-yellow-900 border-transparent'
    if (status === 'under') return 'bg-green-100 text-green-900 border-transparent'
    return 'bg-white text-slate-700 border-transparent'
  }

  const overschrijdingColor = (status: string) => {
    if (status === 'over') return 'bg-red-100 text-red-700 border-red-200'
    if (status === 'equal') return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    if (status === 'under') return 'bg-green-100 text-green-700 border-green-200'
    return 'bg-slate-50 text-slate-500 border-slate-200'
  }

  return (
    <div className="bg-white rounded-lg p-3 shadow-sm border border-slate-200">
      {(monthValue && onMonthChange) && (
        <div className="flex items-center justify-between gap-2 pb-1">
          <div className="text-xs font-semibold text-slate-900">CAP Overzicht</div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-semibold text-slate-600">Maand:</label>
            <input
              type="month"
              value={monthValue}
              onChange={(e) => onMonthChange(e.target.value)}
              className="px-2 py-1 border border-slate-200 rounded-md text-xs"
            />
          </div>
        </div>
      )}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-full">
            <div className="grid grid-cols-[100px_70px_120px_105px_50px_70px_90px_minmax(200px,1.2fr)_70px_minmax(230px,1.4fr)_110px_minmax(220px,1.4fr)] bg-slate-50 text-[11px] font-semibold text-slate-700 px-0 py-1.5 border-b border-slate-200 sticky top-0 z-10 divide-x divide-slate-300">
              <div className="px-2 whitespace-nowrap">Datum</div>
              <div className="px-2 text-center whitespace-nowrap">Weekdag</div>
              <div className="px-2 text-center whitespace-nowrap">Aantal patiënten</div>
              <div className="px-2 text-center leading-tight">Afgesproken<br />patiënten</div>
              <div className="px-2 text-center whitespace-nowrap">Trend</div>
              <div className="px-2 text-center leading-tight">Max<br />capaciteit</div>
              <div className="px-2 text-center whitespace-nowrap">Overschrijding</div>
              <div className="px-2 whitespace-nowrap">Opmerking</div>
              <div className="px-2 text-center whitespace-nowrap">Aantal vpk</div>
              <div className="px-2 text-center whitespace-nowrap">Naam verpleegkundige</div>
              <div className="px-2 text-center whitespace-nowrap">Dagco (naam)</div>
              <div className="px-2 whitespace-nowrap">Opmerkingen Senna</div>
            </div>

        {weeks.map((week) => {
          const weekStartDate = new Date(week.weekStart + 'T00:00:00')
          const weekNumber = getWeekNumber(weekStartDate)
          const isCollapsed = collapsedWeeks[week.weekStart]
          const visibleDays = days.filter((_, index) => {
            const date = week.dates[index]
            return Boolean(date) && isDateInMonth(date, monthValue)
          })

          if (visibleDays.length === 0) return null

          return (
            <div key={week.weekStart}>
              <button
                type="button"
                onClick={() => setCollapsedWeeks(prev => ({ ...prev, [week.weekStart]: !prev[week.weekStart] }))}
                className="w-full grid grid-cols-[100px_70px_120px_105px_50px_70px_90px_minmax(200px,1.2fr)_70px_minmax(230px,1.4fr)_110px_minmax(220px,1.4fr)] bg-slate-100 text-[11px] font-semibold text-slate-600 px-0 py-1.5 border-b border-slate-200 text-left hover:bg-slate-200/60 transition divide-x divide-slate-300"
                aria-expanded={!isCollapsed}
              >
                <div className="col-span-full flex items-center gap-1.5 px-2">
                  <span className="text-slate-500 text-[10px]">{isCollapsed ? '▸' : '▾'}</span>
                  Week {weekNumber}
                </div>
              </button>
              {isCollapsed ? null : days.map((day, index) => {
                const date = week.dates[index]
                if (!date || !isDateInMonth(date, monthValue)) return null
                const staffForDay = week.staffSchedule[day]
                const availableStaff = staffMembers.filter(s => staffForDay.includes(s.name))
                const coordinator = week.coordinatorByDay[day] || null
                const regularStaff = coordinator ? availableStaff.filter(s => s.name !== coordinator) : availableStaff
                const regularCapacity = regularStaff.reduce((sum, s) => {
                  const occurrence = rampOccurrencesByDate[date]?.[s.name]
                  const ramp = rampSchedules[s.name]
                  const rampValues = occurrence && ramp ? getRampValuesForOccurrence(ramp, occurrence) : null
                  const effectiveMax = rampValues?.patients ?? s.maxPatients
                  return sum + effectiveMax
                }, 0)
                const maxCapacity = regularCapacity + (coordinator ? getDaycoPatientsCount() : 0)
                const capacity = week.dayCapacities[date] || {}
                const agreedMax = capacity.agreedMaxPatients ?? null
                const planned = capacity.plannedPatients ?? plannedCounts[date] ?? null
                const plannedInputValue = plannedDrafts[date] ?? (planned ?? '')
                const overschrijdingBase = agreedMax ?? maxCapacity
                const overschrijding = planned !== null ? Math.max(0, planned - overschrijdingBase) : null
                const status = getPlannedStatus(planned, overschrijdingBase)
                const plannedStatus = getPlannedRatioStatus(planned, overschrijdingBase)
                const autoLines = regularStaff
                  .map(s => {
                    const occurrence = rampOccurrencesByDate[date]?.[s.name]
                    const ramp = rampSchedules[s.name]
                    const rampValues = occurrence && ramp ? getRampValuesForOccurrence(ramp, occurrence) : null
                    if (!rampValues?.startTime || !rampValues?.endTime) return null
                    return `${s.name} werkt van ${rampValues.startTime} tot ${rampValues.endTime}.`
                  })
                  .filter((line): line is string => Boolean(line))
                const noteValue = buildAutoNotes(capacity.note ?? '', autoLines)

                return (
                  <div
                    key={`${week.weekStart}-${day}`}
                    className="grid grid-cols-[100px_70px_120px_105px_50px_70px_90px_minmax(200px,1.2fr)_70px_minmax(230px,1.4fr)_110px_minmax(220px,1.4fr)] items-center text-[12px] px-0 py-0 border-b border-slate-200 last:border-b-0 odd:bg-white even:bg-slate-50 divide-x divide-slate-300"
                  >
                    <div className="flex items-center text-slate-900 font-semibold text-[12px] px-2 h-8">{getDayLabel(date)}</div>
                    <div className="flex items-center justify-center text-slate-600 text-[12px] px-2 h-8">{dayLabelShort[day]}</div>
                    <div className="flex items-center justify-center px-1 h-8">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={plannedInputValue}
                        onChange={(e) => {
                          const value = e.target.value
                          setPlannedDrafts(prev => ({ ...prev, [date]: value }))
                          if (value === '') {
                            onUpdateDayCapacity(week.weekStart, date, { plannedPatients: null })
                            return
                          }
                          const parsed = parseNumericInput(value)
                          if (parsed !== null) {
                            onUpdateDayCapacity(week.weekStart, date, { plannedPatients: parsed })
                          }
                        }}
                        onBlur={() => {
                          setPlannedDrafts(prev => {
                            const { [date]: _, ...rest } = prev
                            return rest
                          })
                        }}
                        className={`w-full h-7 px-2 py-0 border text-[12px] font-medium text-center focus:bg-white focus:border-slate-300 ${plannedColor(plannedStatus)}`}
                        placeholder="—"
                      />
                    </div>
                    <div className="flex items-center justify-center px-1 h-8">
                      <input
                        type="text"
                        inputMode="numeric"
                        min={0}
                        value={agreedMax ?? ''}
                        onChange={(e) => onUpdateDayCapacity(week.weekStart, date, { agreedMaxPatients: parseNumericInput(e.target.value) })}
                        className="w-full h-7 px-2 py-0 border border-transparent bg-slate-50/70 text-[12px] text-center focus:bg-white focus:border-slate-300"
                        placeholder={`${maxCapacity}`}
                      />
                    </div>
                    <div className="flex items-center justify-center px-1 h-8">
                      {agreedMax === null ? (
                        <span className="text-[10px] text-slate-400">—</span>
                      ) : agreedMax > maxCapacity ? (
                        <span className="text-[12px] text-red-500">▼</span>
                      ) : agreedMax === maxCapacity ? (
                        <span className="text-[10px] text-slate-400">—</span>
                      ) : (
                        <span className="text-[12px] text-green-600">▲</span>
                      )}
                    </div>
                    <div className="flex items-center justify-center text-slate-900 font-semibold text-[12px] px-2 h-8">{maxCapacity}</div>
                    <div className="flex items-center justify-center px-1 h-8">
                      <span className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${overschrijdingColor(status)}`}>
                        {overschrijding && overschrijding > 0 ? `+${overschrijding}` : status === 'equal' ? '0' : ''}
                      </span>
                    </div>
                    <div className="flex items-center px-1 h-8">
                      <textarea
                        rows={1}
                        value={noteValue}
                        onChange={(e) => {
                          const nextValue = buildAutoNotes(e.target.value, autoLines)
                          onUpdateDayCapacity(week.weekStart, date, { note: nextValue })
                        }}
                        onInput={(e) => resizeTextarea(e.currentTarget)}
                        onFocus={(e) => resizeTextarea(e.currentTarget)}
                        onBlur={(e) => resizeTextarea(e.currentTarget, true)}
                        className="w-full h-7 px-1.5 py-0.5 border border-transparent bg-slate-50/70 text-[11px] leading-snug resize-none focus:bg-white focus:border-slate-300"
                        placeholder="Voeg opmerking toe"
                        aria-label="Opmerking invoeren"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => onEditDayStaff(week.weekStart, date, day)}
                      className="flex items-center justify-center text-slate-700 hover:text-blue-700 transition-colors text-[12px] px-2 h-8"
                    >
                      {staffForDay.length || '—'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditDayStaff(week.weekStart, date, day)}
                      className="group relative w-full h-8 text-slate-600 text-[12px] transition-colors hover:text-blue-700 hover:bg-blue-50/70 rounded-none px-2"
                    >
                      {staffForDay.length === 0 ? (
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] text-blue-600 font-semibold">
                          + toevoegen
                        </span>
                      ) : (
                        <>
                          <span className="block truncate transition-opacity group-hover:opacity-0">
                            {staffForDay.join(', ')}
                          </span>
                          <span className="absolute inset-0 flex items-center justify-center text-[10px] text-blue-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                            + toevoegen
                          </span>
                          <div className="absolute left-1/2 top-full z-20 mt-1 hidden w-[220px] -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-2 text-[11px] text-slate-700 shadow-lg group-hover:block">
                            <div className="flex flex-wrap gap-1">
                              {staffForDay.map(name => (
                                <span key={name} className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                  {name}
                                </span>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </button>
                    <div className="flex items-center justify-center text-slate-600 text-[12px] px-2 h-8">{coordinator || '—'}</div>
                    <div className="flex items-center px-1 h-8">
                      <textarea
                        rows={1}
                        value={capacity.sennaNote ?? ''}
                        onChange={(e) => onUpdateDayCapacity(week.weekStart, date, { sennaNote: e.target.value })}
                        onInput={(e) => resizeTextarea(e.currentTarget)}
                        onFocus={(e) => resizeTextarea(e.currentTarget)}
                        onBlur={(e) => resizeTextarea(e.currentTarget, true)}
                        className="w-full h-7 px-1.5 py-0.5 border border-transparent bg-slate-50/70 text-[11px] leading-snug resize-none focus:bg-white focus:border-slate-300"
                        placeholder="Voeg opmerking toe"
                        aria-label="Opmerking Senna invoeren"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
          </div>
        </div>
      </div>
    </div>
  )
}
