import { Patient, DEPARTMENT_CONFIG } from '@/types'

interface TimeSlotCapacity {
  time: string
  count: number
  patients: string[]
  hasCapacity: boolean
}

export function checkCapacityByTimeSlot(patients: Patient[]): TimeSlotCapacity[] {
  const slots: { [key: string]: TimeSlotCapacity } = {}
  
  // Initialize all 30-minute slots from 08:00 to 14:00
  for (let hour = DEPARTMENT_CONFIG.START_HOUR; hour < DEPARTMENT_CONFIG.END_HOUR - 1; hour++) {
    const slot1 = `${hour.toString().padStart(2, '0')}:00`
    const slot2 = `${hour.toString().padStart(2, '0')}:30`
    
    slots[slot1] = { time: slot1, count: 0, patients: [], hasCapacity: true }
    slots[slot2] = { time: slot2, count: 0, patients: [], hasCapacity: true }
  }
  
  // Count patients per start time slot
  patients.forEach(patient => {
    if (slots[patient.startTime]) {
      slots[patient.startTime].count++
      slots[patient.startTime].patients.push(patient.name)
      
      // Check if over capacity (max 3 per slot)
      if (slots[patient.startTime].count > DEPARTMENT_CONFIG.MAX_CONCURRENT_INFUSIONS) {
        slots[patient.startTime].hasCapacity = false
      }
    }
  })
  
  return Object.values(slots).sort((a, b) => a.time.localeCompare(b.time))
}

export function getCapacityWarnings(patients: Patient[]): string[] {
  const warnings: string[] = []
  const capacity = checkCapacityByTimeSlot(patients)
  
  const overCapacity = capacity.filter(slot => !slot.hasCapacity)
  
  if (overCapacity.length > 0) {
    overCapacity.forEach(slot => {
      warnings.push(
        `⚠️ ${slot.time}: ${slot.count} patiënten gepland (max ${DEPARTMENT_CONFIG.MAX_CONCURRENT_INFUSIONS})`
      )
    })
  }
  
  return warnings
}

