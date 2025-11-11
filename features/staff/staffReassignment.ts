import { Patient, StaffMember, DayOfWeek } from '@/types'
import { getDayOfWeekFromDate } from '@/types'
import { StaffScheduler } from '@/utils/staff/staffAssignment'
import { generateActionsForMedication } from '@/utils/patients/actionGenerator'
import { createAction, deleteAction } from '../patients/actionService'
import { updatePatientStartTime } from '../patients/patientService'

export async function reassignAllStaffAssignments(
  selectedDate: string,
  staffMembers: StaffMember[]
): Promise<void> {
  try {
    const response = await fetch(`/api/patients?date=${selectedDate}`)
    if (!response.ok) return
    
    const allPatients: Patient[] = await response.json()
    if (allPatients.length === 0) return
    
    const dayOfWeek = getDayOfWeekFromDate(selectedDate)
    const availableStaff = staffMembers
    
    if (availableStaff.length === 0) return
    
    const sortedPatients = [...allPatients].sort((a, b) => a.startTime.localeCompare(b.startTime))
    const scheduler = new StaffScheduler(availableStaff, dayOfWeek)
    
    for (const patient of sortedPatients) {
      // Delete all existing actions
      for (const action of patient.actions) {
        await deleteAction(action.id)
      }
      
      // Regenerate actions
      const actions = generateActionsForMedication(patient.medicationType, patient.treatmentNumber)
      
      const [startHours, startMinutes] = patient.startTime.split(':').map(Number)
      let patientStartMinutes = startHours * 60 + startMinutes
      let cumulativeMinutes = 0
      let setupStaff: string | null = null
      let infusionStartMinutes = 0
      
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
          const assignment = scheduler.assignStaffForSetup(actionStartTime, action.duration)
          staff = assignment.staff
          
          if (staff === 'GEEN') {
            console.warn(`⚠️ Geen verpleegkundige beschikbaar voor setup van ${patient.name} om ${actionStartTime}`)
            staff = availableStaff[0]?.name || 'GEEN'
          }
          
          if (assignment.wasDelayed && assignment.actualStartTime) {
            const [delayedHours, delayedMins] = assignment.actualStartTime.split(':').map(Number)
            const delayedMinutes = delayedHours * 60 + delayedMins
            const delay = delayedMinutes - actionStartMinutes
            if (delay > 0) {
              await updatePatientStartTime(patient.id, assignment.actualStartTime)
              patientStartMinutes = delayedMinutes
              cumulativeMinutes = 0
            }
          }
          
          setupStaff = staff
        } else if ((action.type as string) === 'protocol_check' || action.name.includes('Protocol Controle')) {
          const duration = action.actualDuration || action.duration
          const assignment = scheduler.assignStaffForAction(action.type || 'protocol_check', duration, actionStartTime, setupStaff || undefined)
          staff = assignment.staff
          
          if (staff === 'GEEN') {
            console.warn(`⚠️ Geen verpleegkundige beschikbaar voor protocol check van ${patient.name} om ${actionStartTime}`)
            staff = availableStaff.find(s => s.name !== setupStaff)?.name || availableStaff[0]?.name || 'GEEN'
          }
        } else if (action.type === 'check' || action.type === 'pc_switch') {
          const duration = action.actualDuration || action.duration
          const assignment = scheduler.assignStaffForAction(action.type, duration, actionStartTime)
          staff = assignment.staff
          
          if (staff === 'GEEN') {
            console.warn(`⚠️ Geen verpleegkundige beschikbaar voor ${action.type} van ${patient.name} om ${actionStartTime}`)
            staff = availableStaff[0]?.name || 'GEEN'
          }
        } else {
          const duration = action.actualDuration || action.duration
          const assignment = scheduler.assignStaffForAction(action.type || 'other', duration, actionStartTime)
          staff = assignment.staff
          
          if (staff === 'GEEN') {
            console.warn(`⚠️ Geen verpleegkundige beschikbaar voor ${action.type || 'actie'} van ${patient.name} om ${actionStartTime}`)
            staff = availableStaff[0]?.name || 'GEEN'
          }
          
          if (assignment.wasDelayed && assignment.actualStartTime) {
            const [delayedHours, delayedMins] = assignment.actualStartTime.split(':').map(Number)
            const delayedMinutes = delayedHours * 60 + delayedMins
            const delay = delayedMinutes - actionStartMinutes
            if (delay > 0 && (action.type === 'removal' || action.type === 'flush')) {
              cumulativeMinutes += delay
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
    }
    
    console.log('✅ Alle staff assignments opnieuw toegewezen')
  } catch (error) {
    console.error('Failed to reassign staff assignments:', error)
  }
}

