import { DayOfWeek, StaffMember } from '@/types'

const STAFF_WORK_DAYS_KEY = 'staffWorkDays'

type StaffWorkDaysMap = Record<string, DayOfWeek[]>

const isDayOfWeek = (value: string): value is DayOfWeek => {
  return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].includes(value)
}

export const loadStaffWorkDays = (): StaffWorkDaysMap => {
  if (typeof window === 'undefined') return {}
  const stored = localStorage.getItem(STAFF_WORK_DAYS_KEY)
  if (!stored) return {}
  try {
    const parsed = JSON.parse(stored) as Record<string, string[]>
    const mapped: StaffWorkDaysMap = {}
    Object.entries(parsed).forEach(([name, days]) => {
      const validDays = Array.isArray(days) ? days.filter(isDayOfWeek) : []
      mapped[name] = validDays
    })
    return mapped
  } catch {
    return {}
  }
}

export const saveStaffWorkDays = (map: StaffWorkDaysMap) => {
  if (typeof window === 'undefined') return
  localStorage.setItem(STAFF_WORK_DAYS_KEY, JSON.stringify(map))
}

export const mergeStaffWithWorkDays = (staff: StaffMember[]): StaffMember[] => {
  const stored = loadStaffWorkDays()
  return staff.map(member => ({
    ...member,
    workDays: stored[member.name] ?? member.workDays ?? []
  }))
}

export const setStaffWorkDays = (name: string, days: DayOfWeek[], previousName?: string) => {
  const map = loadStaffWorkDays()
  if (previousName && previousName !== name) {
    delete map[previousName]
  }
  map[name] = days
  saveStaffWorkDays(map)
}

export const removeStaffWorkDays = (name: string) => {
  const map = loadStaffWorkDays()
  if (map[name]) {
    delete map[name]
    saveStaffWorkDays(map)
  }
}

export const clearStaffWorkDays = () => {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STAFF_WORK_DAYS_KEY)
}

export const buildScheduleFromWorkDays = (staffMembers: StaffMember[]): Record<DayOfWeek, string[]> => {
  const schedule: Record<DayOfWeek, string[]> = {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: []
  }
  staffMembers.forEach(member => {
    member.workDays.forEach(day => {
      if (!schedule[day].includes(member.name)) {
        schedule[day].push(member.name)
      }
    })
  })
  return schedule
}
