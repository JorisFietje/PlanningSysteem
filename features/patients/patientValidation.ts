import { Patient, StaffMember, DayOfWeek, DAY_LABELS, DEPARTMENT_CONFIG } from '@/types'
import { calculateTotalTreatmentTime } from '@/utils/patients/actionGenerator'
import { getDayOfWeekFromDate } from '@/types'

export function validateNurseWorkDay(
  preferredNurse: string,
  staffMembers: StaffMember[],
  selectedDate: string
): { valid: boolean; message?: string } {
  const dayOfWeek = getDayOfWeekFromDate(selectedDate)
  const nurseData = staffMembers.find(s => s.name === preferredNurse)
  
  // workDays uitgefaseerd; rooster bepaalt beschikbaarheid per datum
  
  return { valid: true }
}

export function validateNurseAvailability(
  preferredNurse: string,
  patients: Patient[],
  startTime: string
): { valid: boolean; message?: string } {
  const setupDuration = 15
  const [startHours, startMinutes] = startTime.split(':').map(Number)
  const startInMinutes = startHours * 60 + startMinutes
  const setupEndMinutes = startInMinutes + setupDuration
  
  const isNurseBusy = patients.some(patient => {
    return patient.actions.some(action => {
      if (action.staff !== preferredNurse) return false
      
      const [pStartHours, pStartMinutes] = patient.startTime.split(':').map(Number)
      const patientStartMinutes = pStartHours * 60 + pStartMinutes
      
      let actionStartMinutes = patientStartMinutes
      for (const a of patient.actions) {
        if (a.id === action.id) break
        actionStartMinutes += a.duration
      }
      
      const actionEndMinutes = actionStartMinutes + (action.actualDuration || action.duration)
      
      return (startInMinutes < actionEndMinutes) && (setupEndMinutes > actionStartMinutes)
    })
  })
  
  if (isNurseBusy) {
    return {
      valid: false,
      message: `${preferredNurse} is al bezet rond ${startTime}. Er is een overlap met een andere behandeling!`
    }
  }
  
  return { valid: true }
}

export function validateNurseWorkTime(
  preferredNurse: string,
  staffMembers: StaffMember[],
  medicationId: string,
  treatmentNumber: number,
  startTime: string
): { valid: boolean; message?: string } {
  const nurseData = staffMembers.find(s => s.name === preferredNurse)
  if (!nurseData || !nurseData.maxWorkTime) {
    return { valid: true }
  }
  
  const totalDuration = calculateTotalTreatmentTime(medicationId, treatmentNumber)
  const [startHours, startMinutes] = startTime.split(':').map(Number)
  const startInMinutes = startHours * 60 + startMinutes
  const treatmentEndInMinutes = startInMinutes + totalDuration
  
  const nurseEndMinutes = (DEPARTMENT_CONFIG.START_HOUR * 60) + nurseData.maxWorkTime
  
  if (treatmentEndInMinutes > nurseEndMinutes) {
    const nurseEndHours = Math.floor(nurseEndMinutes / 60)
    const nurseEndMins = nurseEndMinutes % 60
    const treatmentEndHours = Math.floor(treatmentEndInMinutes / 60)
    const treatmentEndMins = treatmentEndInMinutes % 60
    
    return {
      valid: false,
      message: `${preferredNurse} werkt tot ${nurseEndHours}:${String(nurseEndMins).padStart(2, '0')}, maar behandeling eindigt om ${treatmentEndHours}:${String(treatmentEndMins).padStart(2, '0')}. Kies een andere verpleegkundige of eerdere starttijd.`
    }
  }
  
  return { valid: true }
}

export function validateTreatmentTime(
  medicationId: string,
  treatmentNumber: number,
  startTime: string
): { valid: boolean; message?: string } {
  const totalDuration = calculateTotalTreatmentTime(medicationId, treatmentNumber)
  const [startHours, startMinutes] = startTime.split(':').map(Number)
  const startInMinutes = startHours * 60 + startMinutes
  const openingTime = DEPARTMENT_CONFIG.START_MINUTES
  const endInMinutes = startInMinutes + totalDuration
  const closingTime = DEPARTMENT_CONFIG.END_MINUTES
  
  if (startInMinutes < openingTime || startInMinutes > closingTime) {
    return {
      valid: false,
      message: `Starttijd moet tussen 08:00 en 16:30 liggen.`
    }
  }

  if (endInMinutes > closingTime) {
    const endHours = Math.floor(endInMinutes / 60)
    const endMins = endInMinutes % 60
    
    return {
      valid: false,
      message: `Behandeling zou eindigen om ${endHours}:${String(endMins).padStart(2, '0')}, maar de afdeling sluit om 16:30. Kies een eerdere starttijd.`
    }
  }
  
  return { valid: true }
}

export function validateCapacity(
  patients: Patient[],
  startTime: string
): { valid: boolean; message?: string } {
  const patientsAtTime = patients.filter(p => p.startTime === startTime).length
  
  if (patientsAtTime >= DEPARTMENT_CONFIG.MAX_CONCURRENT_INFUSIONS) {
    return {
      valid: false,
      message: `Capaciteit bereikt: Er zijn al ${patientsAtTime} patiënten om ${startTime} (max ${DEPARTMENT_CONFIG.MAX_CONCURRENT_INFUSIONS})`
    }
  }
  
  return { valid: true }
}
