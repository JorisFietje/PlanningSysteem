export interface Action {
  id: string
  name: string
  duration: number
  staff?: string
  type?: string // 'setup', 'protocol_check', 'infusion', 'check', 'pc_switch', 'removal', 'observation', 'flush'
  actualDuration?: number // For checks, PC switches, and protocol checks during infusion
  patientId: string
  createdAt: Date
  updatedAt: Date
}

export interface Patient {
  id: string
  name: string
  startTime: string // HH:MM format
  scheduledDate: string // YYYY-MM-DD format (ISO 8601)
  medicationType: string
  treatmentNumber: number
  createdAt: Date
  updatedAt: Date
  actions: Action[]
}

export interface WorkloadSlot {
  time: string
  count: number
  patients: string[]
}

export interface OptimizationSuggestion {
  type: string
  text: string
}

// Re-export medication types for backward compatibility and easy access
export * from './medications'
export { MEDICATIONS as INFUSION_TYPES } from './medications' // Backward compatibility alias

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday'

export interface StaffMember {
  name: string
  maxPatients: number
  maxWorkTime?: number // In minutes from start of day (e.g., 360 = 14:00 for Yvonne)
  workDays: DayOfWeek[] // Days this staff member works
}

export const STAFF_MEMBERS: StaffMember[] = [
  // Elke dag werken PRECIES 3 verpleegkundigen (totaal 11 VPK, sommigen werken meerdere dagen)
  
  // MAANDAG (3): Carla (11) + Merel (10) + Irma (10) = 31 max
  { name: 'Carla', maxPatients: 10, workDays: ['monday', 'thursday'] },
  { name: 'Merel', maxPatients: 10, workDays: ['monday', 'friday'] },
  { name: 'Irma', maxPatients: 8, workDays: ['monday', 'friday'] },
  
  // DINSDAG (3): Henriette (11) + Emmy (11) + Yvonne (8) = 30 max
  { name: 'Henriette', maxPatients: 10, workDays: ['tuesday'] },
  { name: 'Emmy', maxPatients: 10, workDays: ['tuesday', 'thursday'] },
  { name: 'Yvonne', maxPatients: 8, maxWorkTime: 360, workDays: ['tuesday'] }, // Werkt tot 14:00
  
  // WOENSDAG (3): Joyce (11) + Suzan (11) + Vera (9) = 31 max
  { name: 'Joyce', maxPatients: 10, workDays: ['wednesday'] },
  { name: 'Suzan', maxPatients: 10, workDays: ['wednesday'] },
  { name: 'Vera', maxPatients: 8, workDays: ['wednesday'] },
  
  // DONDERDAG (3): Carla (11) + Emmy (11) + Chayenne (10) = 32 max
  { name: 'Chayenne', maxPatients: 5, workDays: ['thursday'] },
  
  // VRIJDAG (3): Merel (10) + Irma (10) + Serina (10) = 30 max
  { name: 'Serina', maxPatients: 3, workDays: ['friday'] },
]

export const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: 'Maandag',
  tuesday: 'Dinsdag',
  wednesday: 'Woensdag',
  thursday: 'Donderdag',
  friday: 'Vrijdag',
}

// Infusion department configuration
export const DEPARTMENT_CONFIG = {
  START_HOUR: 8,
  END_HOUR: 16,
  TOTAL_CHAIRS: 14, // Totaal aantal stoelen op de afdeling (MAXIMUM CAPACITEIT)
  STAFF_COUNT: 3, // Aantal verpleegkundigen PER DAG (altijd 3)
  MAX_CONCURRENT_INFUSIONS: 3, // Max 3 gelijktijdige aanprik momenten (1 per verpleegkundige)
  STAFF_PREPARATION_TIME: 30, // 30 minuten voorbereiding tussen patiënten
  TIME_SLOT_INTERVAL: 30, // Patiënten kunnen elke 30 minuten starten
}

/**
 * Get day of week from date string (YYYY-MM-DD)
 * Returns 'monday', 'tuesday', etc.
 */
export function getDayOfWeekFromDate(dateString: string): DayOfWeek {
  const date = new Date(dateString + 'T00:00:00') // Add time to avoid timezone issues
  const dayIndex = date.getDay() // 0=Sunday, 1=Monday, etc.
  
  const dayMap: DayOfWeek[] = [
    'monday', // We map Sunday (0) to Monday for now, can adjust
    'monday',
    'tuesday', 
    'wednesday',
    'thursday',
    'friday',
    'monday', // Saturday maps to Monday for now
  ]
  
  // Proper mapping: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  const properDayMap: Record<number, DayOfWeek> = {
    0: 'monday', // Sunday -> Monday (no work on Sunday)
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday', 
    4: 'thursday',
    5: 'friday',
    6: 'monday', // Saturday -> Monday (no work on Saturday)
  }
  
  return properDayMap[dayIndex]
}

/**
 * Format date to YYYY-MM-DD
 */
export function formatDateToISO(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayISO(): string {
  return formatDateToISO(new Date())
}

/**
 * Calculate dynamic daily patient capacity based on staff working on that day
 * Returns { min: number, max: number } where max is the total capacity
 */
export function getDailyPatientCapacity(day: DayOfWeek, staffMembers: StaffMember[] = STAFF_MEMBERS): { min: number; max: number; total: number } {
  // Filter staff working on this day (or have no workDays set)
  const staffForDay = staffMembers.filter(s => s.workDays.length === 0 || s.workDays.includes(day))
  
  // Calculate total capacity (sum of maxPatients)
  const totalCapacity = staffForDay.reduce((sum, s) => sum + s.maxPatients, 0)
  
  // Target is 90% of capacity for minimum, max is the total capacity
  const min = Math.floor(totalCapacity * 0.90)
  const max = totalCapacity // Use total capacity as max
  
  return { min, max, total: totalCapacity }
}
