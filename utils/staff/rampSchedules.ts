import { DayOfWeek, formatDateToISO } from '@/types'

export type RampScheduleItem = {
  week: number | null
  startTime?: string | null
  endTime?: string | null
  patients: number | null
}
export type RampSchedule = { createdAt: string; startWeek?: number; startWeekYear?: number; items: RampScheduleItem[] }
export type RampScheduleMap = Record<string, RampSchedule>

const STORAGE_KEY = 'staffRampSchedules'

const isDayOfWeek = (value: string): value is DayOfWeek => {
  return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].includes(value)
}

const parseDate = (date: string) => new Date(date + 'T00:00:00')

const getISOWeekInfo = (date: Date) => {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = target.getUTCDay() || 7
  target.setUTCDate(target.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return { week: weekNo, year: target.getUTCFullYear() }
}

const getDateOfISOWeek = (week: number, year: number) => {
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7))
  const dow = simple.getUTCDay()
  const ISOweekStart = new Date(simple)
  if (dow <= 4) {
    ISOweekStart.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1)
  } else {
    ISOweekStart.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay())
  }
  return ISOweekStart
}

const getTodayISO = () => formatDateToISO(new Date())

export const loadRampSchedules = (): RampScheduleMap => {
  if (typeof window === 'undefined') return {}
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return {}
  try {
    const parsed = JSON.parse(stored) as Record<string, any>
    const mapped: RampScheduleMap = {}
    Object.entries(parsed).forEach(([name, value]) => {
      if (Array.isArray(value)) {
        const todayInfo = getISOWeekInfo(new Date())
        mapped[name] = {
          createdAt: getTodayISO(),
          startWeek: todayInfo.week,
          startWeekYear: todayInfo.year,
          items: value
        }
        return
      }
      if (value && typeof value === 'object') {
        const items = Array.isArray(value.items) ? value.items : []
        const createdAt = typeof value.createdAt === 'string' ? value.createdAt : getTodayISO()
        const startWeek = typeof value.startWeek === 'number' ? value.startWeek : undefined
        const startWeekYear = typeof value.startWeekYear === 'number' ? value.startWeekYear : undefined
        const normalizedItems = items.map((item: any) => {
          if (item && typeof item === 'object' && typeof item.hours === 'number') {
            const endMinutes = Math.max(0, item.hours) * 60
            const endHours = Math.floor(endMinutes / 60) + 8
            const endMins = endMinutes % 60
            const endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`
            return { ...item, startTime: '08:00', endTime }
          }
          return item
        })
        mapped[name] = { createdAt, startWeek, startWeekYear, items: normalizedItems }
      }
    })
    return mapped
  } catch {
    return {}
  }
}

export const saveRampSchedules = (map: RampScheduleMap) => {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}

export const removeRampSchedule = (name: string) => {
  const map = loadRampSchedules()
  if (map[name]) {
    delete map[name]
    saveRampSchedules(map)
  }
}

const getWeekdayFromDate = (date: Date): DayOfWeek | null => {
  const dayIndex = date.getDay()
  if (dayIndex === 0 || dayIndex === 6) return null
  const mapping: DayOfWeek[] = ['sunday' as DayOfWeek, 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday' as DayOfWeek]
  return mapping[dayIndex] || null
}

const getMondayOfWeek = (date: Date): string => {
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(date)
  monday.setDate(diff)
  return formatDateToISO(monday)
}

export const buildRampOccurrenceCounts = (
  rampSchedules: RampScheduleMap,
  scheduleByWeekStart: Record<string, Record<DayOfWeek, string[]>>,
  defaultSchedule: Record<DayOfWeek, string[]>,
  endDate: string
): Record<string, Record<string, number>> => {
  const entries = Object.entries(rampSchedules)
  if (entries.length === 0) return {}

  const earliestStart = entries.reduce((min, [_, schedule]) => {
    if (schedule.startWeek && schedule.startWeekYear) {
      const startDate = getDateOfISOWeek(schedule.startWeek, schedule.startWeekYear)
      const iso = formatDateToISO(new Date(startDate))
      if (!min) return iso
      return parseDate(iso) < parseDate(min) ? iso : min
    }
    if (!schedule.createdAt) return min
    if (!min) return schedule.createdAt
    return parseDate(schedule.createdAt) < parseDate(min) ? schedule.createdAt : min
  }, '' as string)

  if (!earliestStart) return {}

  const occurrenceCounts: Record<string, number> = {}
  const lastWeekKeyByName: Record<string, string> = {}
  const perDate: Record<string, Record<string, number>> = {}

  const start = parseDate(earliestStart)
  const end = parseDate(endDate)

  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const dayOfWeek = getWeekdayFromDate(cursor)
    if (!dayOfWeek || !isDayOfWeek(dayOfWeek)) continue
    const dateISO = formatDateToISO(cursor)
    const dateWeekInfo = getISOWeekInfo(cursor)
    const weekStart = getMondayOfWeek(cursor)
    const scheduleForWeek = scheduleByWeekStart[weekStart] || defaultSchedule
    const staffForDay = scheduleForWeek[dayOfWeek] || []

    staffForDay.forEach(name => {
      const ramp = rampSchedules[name]
      if (!ramp) return
      if (ramp.startWeek && ramp.startWeekYear) {
        if (dateWeekInfo.year < ramp.startWeekYear) return
        if (dateWeekInfo.year === ramp.startWeekYear && dateWeekInfo.week < ramp.startWeek) return
      } else if (parseDate(dateISO) < parseDate(ramp.createdAt)) {
        return
      }
      const weekKey = `${dateWeekInfo.year}-W${dateWeekInfo.week}`
      if (lastWeekKeyByName[name] !== weekKey) {
        occurrenceCounts[name] = (occurrenceCounts[name] || 0) + 1
        lastWeekKeyByName[name] = weekKey
      }
      if (!perDate[dateISO]) perDate[dateISO] = {}
      perDate[dateISO][name] = occurrenceCounts[name]
    })
  }

  return perDate
}

export const getRampValuesForOccurrence = (schedule: RampSchedule, occurrenceIndex: number) => {
  const items = (schedule.items || [])
    .filter(item => typeof item.week === 'number' && item.week !== null)
    .sort((a, b) => (a.week as number) - (b.week as number))

  if (items.length === 0) return null

  const maxWeek = items[items.length - 1]?.week ?? null
  if (maxWeek !== null && occurrenceIndex > maxWeek) return null

  const matched = items.reduce<RampScheduleItem | null>((acc, item) => {
    if (item.week !== null && item.week <= occurrenceIndex) return item
    return acc
  }, null)

  if (!matched) return null

  return {
    patients: matched.patients ?? undefined,
    startTime: matched.startTime ?? undefined,
    endTime: matched.endTime ?? undefined
  }
}
