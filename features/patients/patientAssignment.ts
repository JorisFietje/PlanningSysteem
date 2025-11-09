import { Patient, StaffMember, DayOfWeek, DEPARTMENT_CONFIG } from '@/types'
import { getDayOfWeekFromDate } from '@/types'
import { StaffScheduler } from '@/utils/staff/staffAssignment'
import { generateActionsForMedication, calculateTotalTreatmentTime } from '@/utils/patients/actionGenerator'
import { getMedicationById } from '@/types'
import { createPatient, deletePatient, updatePatientStartTime } from './patientService'
import { createAction } from './actionService'

type ShowNotification = (message: string, type: 'success' | 'warning' | 'info') => void

export async function assignActionsToPatient(
  patient: Patient,
  actions: any[],
  scheduler: StaffScheduler,
  preferredNurse?: string,
  showNotification?: ShowNotification,
  allowOverlaps: boolean = false
): Promise<{ success: boolean; cancelled: boolean }> {
  let cumulativeMinutes = 0
  const [startHours, startMinutes] = patient.startTime.split(':').map(Number)
  let patientStartMinutes = startHours * 60 + startMinutes
  let setupStaff: string | null = null
  let infusionStartMinutes = 0
  const totalDuration = calculateTotalTreatmentTime(patient.medicationType, patient.treatmentNumber)

  for (const action of actions) {
    if (action.type === 'infusion') {
      infusionStartMinutes = patientStartMinutes + cumulativeMinutes
    }

    let actionStartMinutes: number
    if ((action.type === 'check' || action.type === 'pc_switch') && (action as any).checkOffset) {
      actionStartMinutes = infusionStartMinutes + (action as any).checkOffset
    } else {
      actionStartMinutes = patientStartMinutes + cumulativeMinutes
    }

    const actionStartHours = Math.floor(actionStartMinutes / 60)
    const actionStartMins = actionStartMinutes % 60
    const actionStartTime = `${actionStartHours.toString().padStart(2, '0')}:${actionStartMins.toString().padStart(2, '0')}`

    let staff: string

    if (action.type === 'infusion') {
      staff = 'Systeem'
    } else if (action.type === 'observation') {
      staff = 'Geen'
    } else if (action.type === 'setup') {
      if (preferredNurse) {
        staff = preferredNurse
      } else if (allowOverlaps) {
        // For manual entry, allow overlaps - just pick first available staff member
        const availableStaff = scheduler.getAvailableStaffForDay()
        if (availableStaff.length > 0) {
          staff = availableStaff[0]
        } else {
          staff = 'GEEN'
        }
      } else {
        const assignment = scheduler.assignStaffForSetup(actionStartTime, action.duration)
        staff = assignment.staff

        if (staff === 'GEEN') {
          console.log(`⚠️ Geen verpleegkundigen beschikbaar voor ${patient.name}. Patient wordt geannuleerd.`)
          await deletePatient(patient.id)
          showNotification?.(`${patient.name} geannuleerd - alle verpleegkundigen hebben hun limiet bereikt`, 'warning')
          return { success: false, cancelled: true }
        }

        if (assignment.wasDelayed) {
          const [delayedHours, delayedMins] = assignment.actualStartTime.split(':').map(Number)
          const delayedMinutes = delayedHours * 60 + delayedMins
          const delay = delayedMinutes - actionStartMinutes
          if (delay > 0) {
            const newEndMinutes = delayedMinutes + totalDuration
            const closingMinutes = DEPARTMENT_CONFIG.END_HOUR * 60

            if (newEndMinutes > closingMinutes) {
              const endHours = Math.floor(newEndMinutes / 60)
              const endMins = String(newEndMinutes % 60).padStart(2, '0')
              console.log(`⚠️ Setup delay would cause ${patient.name} to end at ${endHours}:${endMins}, after closing (16:00). Deleting patient.`)
              await deletePatient(patient.id)
              showNotification?.(`${patient.name} geannuleerd - zou na sluitingstijd (16:00) eindigen`, 'warning')
              return { success: false, cancelled: true }
            }

            console.log(`⏱️ Setup delayed by ${delay} min for ${patient.name}, updating patient start time to ${assignment.actualStartTime}`)
            await updatePatientStartTime(patient.id, assignment.actualStartTime)
            patientStartMinutes = delayedMinutes
            cumulativeMinutes = 0
          }
        }
      }
      setupStaff = staff
    } else if ((action.type as string) === 'protocol_check' || action.name.includes('Protocol Controle')) {
      const duration = action.actualDuration || action.duration
      if (allowOverlaps) {
        // For manual entry, allow overlaps - pick a different staff member than setup
        const availableStaff = scheduler.getAvailableStaffForDay()
        const staffList = availableStaff.filter(s => s !== setupStaff)
        staff = staffList.length > 0 ? staffList[0] : (availableStaff.length > 0 ? availableStaff[0] : 'GEEN')
      } else {
        const assignment = scheduler.assignStaffForAction(action.type || 'protocol_check', duration, actionStartTime, setupStaff || undefined)
        staff = assignment.staff

        if (staff === 'GEEN') {
          console.log(`⚠️ Protocol check valt buiten werktijden voor ${patient.name}. Patient wordt geannuleerd.`)
          await deletePatient(patient.id)
          showNotification?.(`${patient.name} geannuleerd - protocol check valt buiten werktijden`, 'warning')
          return { success: false, cancelled: true }
        }

        if (assignment.wasDelayed) {
          console.log(`⏱️ Protocol check delayed for ${patient.name}`)
        }
      }
    } else if (action.type === 'check' || action.type === 'pc_switch') {
      const duration = action.actualDuration || action.duration
      if (allowOverlaps) {
        // For manual entry, allow overlaps - just pick first available staff member
        const availableStaff = scheduler.getAvailableStaffForDay()
        staff = availableStaff.length > 0 ? availableStaff[0] : 'GEEN'
      } else {
        const assignment = scheduler.assignStaffForAction(action.type, duration, actionStartTime)
        staff = assignment.staff

        if (staff === 'GEEN') {
          console.log(`⚠️ ${action.type} valt buiten werktijden voor ${patient.name}. Patient wordt geannuleerd.`)
          await deletePatient(patient.id)
          showNotification?.(`${patient.name} geannuleerd - ${action.type} valt buiten werktijden`, 'warning')
          return { success: false, cancelled: true }
        }
      }
    } else {
      const duration = action.actualDuration || action.duration
      if (allowOverlaps) {
        // For manual entry, allow overlaps - just pick first available staff member
        const availableStaff = scheduler.getAvailableStaffForDay()
        staff = availableStaff.length > 0 ? availableStaff[0] : 'GEEN'
      } else {
        const assignment = scheduler.assignStaffForAction(action.type || 'other', duration, actionStartTime)
        staff = assignment.staff

        if (staff === 'GEEN') {
          console.log(`⚠️ ${action.type || 'Actie'} valt buiten werktijden voor ${patient.name}. Patient wordt geannuleerd.`)
          await deletePatient(patient.id)
          showNotification?.(`${patient.name} geannuleerd - actie valt buiten werktijden`, 'warning')
          return { success: false, cancelled: true }
        }

        if (assignment.wasDelayed && (action.type === 'removal' || action.type === 'flush')) {
          const [delayedHours, delayedMins] = assignment.actualStartTime.split(':').map(Number)
          const delayedMinutes = delayedHours * 60 + delayedMins
          const delay = delayedMinutes - actionStartMinutes
          if (delay > 0) {
            const estimatedEndMinutes = delayedMinutes + duration
            const closingMinutes = DEPARTMENT_CONFIG.END_HOUR * 60

            if (estimatedEndMinutes > closingMinutes) {
              const endHours = Math.floor(estimatedEndMinutes / 60)
              const endMins = String(estimatedEndMinutes % 60).padStart(2, '0')
              console.log(`⚠️ ${action.type} delay would cause ${patient.name} to end at ${endHours}:${endMins}, after closing (16:00). Deleting patient.`)
              await deletePatient(patient.id)
              showNotification?.(`${patient.name} geannuleerd - zou na sluitingstijd (16:00) eindigen`, 'warning')
              return { success: false, cancelled: true }
            }

            console.log(`⏱️ ${action.type} delayed by ${delay} min for ${patient.name}, adjusting cumulative time`)
            cumulativeMinutes += delay
          }
        }
      }
    }

    await createAction(
      patient.id,
      action.name,
      action.duration,
      action.type,
      action.actualDuration,
      staff
    )

    cumulativeMinutes += action.duration
  }

  return { success: true, cancelled: false }
}

export async function addPatientWithActions(
  name: string,
  startTime: string,
  selectedDate: string,
  medicationId: string,
  treatmentNumber: number,
  staffMembers: StaffMember[],
  existingPatients: Patient[],
  preferredNurse?: string,
  showNotification?: ShowNotification,
  allowOverlaps: boolean = false
): Promise<{ success: boolean; patient?: Patient }> {
  const dayOfWeek = getDayOfWeekFromDate(selectedDate)
  const medication = getMedicationById(medicationId)
  
  if (!medication) {
    showNotification?.('Medicatie niet gevonden', 'warning')
    return { success: false }
  }

  const patient = await createPatient(name, startTime, selectedDate, medicationId, treatmentNumber)
  if (!patient) {
    showNotification?.('Fout bij aanmaken patiënt', 'warning')
    return { success: false }
  }

  const actions = generateActionsForMedication(medicationId, treatmentNumber)
  const scheduler = new StaffScheduler(staffMembers, dayOfWeek)

  // Load existing patient data to inform scheduling
  existingPatients.forEach(p => {
    const [pH, pM] = p.startTime.split(':').map(Number)
    const pStartMinutes = pH * 60 + pM
    let pCumulative = 0

    p.actions.forEach(a => {
      if (a.staff && a.staff !== 'Systeem') {
        const aStartMinutes = pStartMinutes + pCumulative
        const aH = Math.floor(aStartMinutes / 60)
        const aM = aStartMinutes % 60
        const aTime = `${aH.toString().padStart(2, '0')}:${aM.toString().padStart(2, '0')}`

        const aDuration = a.actualDuration || a.duration

        if (a.type === 'setup') {
          scheduler.assignStaffForSetup(aTime, aDuration)
        } else {
          scheduler.assignStaffForAction(a.type || 'other', aDuration, aTime)
        }
      }
      pCumulative += a.duration
    })
  })

  const result = await assignActionsToPatient(patient, actions, scheduler, preferredNurse, showNotification, allowOverlaps)
  
  if (result.cancelled) {
    return { success: false }
  }

  return { success: result.success, patient }
}

