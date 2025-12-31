import { DayOfWeek, StaffMember, getDayOfWeekFromDate, getDailyPatientCapacity, formatDateToISO, getDepartmentHours } from '@/types'
import { getAllMedications, isLowPriorityMedication } from '@/types'
import { generateActionsForMedication, calculateTotalTreatmentTime } from '../patients/actionGenerator'
import { StaffScheduler } from '../staff/staffAssignment'
import { ChairOccupancyTracker } from '../capacity/chairOccupancy'
import { DEPARTMENT_CONFIG } from '@/types'

interface WeekPlanInput {
  weekStartDate: string // YYYY-MM-DD (Monday)
  staffSchedule: Record<DayOfWeek, string[]>
  treatments: Array<{
    medicationId: string
    treatmentNumber: number
    quantity: number
  }>
  staffMembers: StaffMember[]
}

interface GeneratedPatient {
  name: string
  startTime: string
  scheduledDate: string
  medicationType: string
  treatmentNumber: number
}

export async function generateWeekPlan(
  weekStartDate: string,
  staffSchedule: Record<DayOfWeek, string[]>,
  treatments: Array<{
    medicationId: string
    treatmentNumber: number
    quantity: number
  }>,
  staffMembers: StaffMember[]
): Promise<{ patientIds: string[]; patients: GeneratedPatient[] }> {
  const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
  
  // Calculate week dates
  const weekDates: string[] = []
  const start = new Date(weekStartDate + 'T00:00:00')
  for (let i = 0; i < 5; i++) {
    const date = new Date(start)
    date.setDate(start.getDate() + i)
    weekDates.push(formatDateToISO(date))
  }

  // Create a list of all treatments to distribute
  const allTreatments: Array<{
    medicationId: string
    treatmentNumber: number
    date: string
    dayOfWeek: DayOfWeek
  }> = []

  // Distribute treatments evenly across days
  let treatmentIndex = 0
  for (const treatment of treatments) {
    for (let i = 0; i < treatment.quantity; i++) {
      const dayIndex = treatmentIndex % 5
      const day = days[dayIndex]
      const date = weekDates[dayIndex]
      
      allTreatments.push({
        medicationId: treatment.medicationId,
        treatmentNumber: treatment.treatmentNumber,
        date,
        dayOfWeek: day
      })
      
      treatmentIndex++
    }
  }

  // Shuffle treatments to avoid clustering
  const shuffledTreatments = shuffleArray([...allTreatments])

  // Generate patients for each day
  const generatedPatients: GeneratedPatient[] = []
  const patientIds: string[] = []

  for (const day of days) {
    const date = weekDates[days.indexOf(day)]
    const dayTreatments = shuffledTreatments.filter(t => t.dayOfWeek === day)
    
    if (dayTreatments.length === 0) continue

    // Get staff for this day
    const staffForDay = staffSchedule[day]
    const availableStaff = staffMembers.filter(s => staffForDay.includes(s.name))
    
    if (availableStaff.length === 0) {
      console.warn(`⚠️ Geen verpleegkundigen voor ${day}, skip behandelingen`)
      continue
    }

    // Create scheduler for this day
    const scheduler = new StaffScheduler(availableStaff, day)
    const chairTracker = new ChairOccupancyTracker()

    // Sort treatments by duration (shorter first for better distribution)
    const sortedTreatments = dayTreatments.sort((a, b) => {
      const aLow = isLowPriorityMedication(a.medicationId)
      const bLow = isLowPriorityMedication(b.medicationId)
      if (aLow !== bLow) return aLow ? 1 : -1
      const durationA = calculateTotalTreatmentTime(a.medicationId, a.treatmentNumber)
      const durationB = calculateTotalTreatmentTime(b.medicationId, b.treatmentNumber)
      return durationA - durationB
    })

    // Generate time slots (every 30 minutes from 8:30 to 14:00, excluding breaks)
    const timeSlots: string[] = []
    for (let hour = 8; hour < 14; hour++) {
      if (hour === 8) {
        timeSlots.push('08:30')
      } else if (hour === 10) {
        timeSlots.push('10:30') // Skip 10:00 (coffee break)
      } else if (hour === 12) {
        // Skip entire hour 12 (lunch break 12:00-13:00)
        continue
      } else {
        timeSlots.push(`${hour.toString().padStart(2, '0')}:00`)
        if (hour < 13) {
          timeSlots.push(`${hour.toString().padStart(2, '0')}:30`)
        }
      }
    }

    let slotIndex = 0

    for (const treatment of sortedTreatments) {
      const totalDuration = calculateTotalTreatmentTime(treatment.medicationId, treatment.treatmentNumber)
      
      // Find available time slot
      let assigned = false
      let attempts = 0
      
      while (!assigned && attempts < timeSlots.length * 2) {
        const timeSlot = timeSlots[slotIndex % timeSlots.length]
        slotIndex++
        attempts++

        // Check chair capacity
        if (!chairTracker.canAddPatient(timeSlot, totalDuration)) {
          continue
        }

        // Check if treatment would end before closing
        const [hours, minutes] = timeSlot.split(':').map(Number)
        const startMinutes = hours * 60 + minutes
        const endMinutes = startMinutes + totalDuration
        const { endMinutes: closingMinutes } = getDepartmentHours()

        if (endMinutes > closingMinutes) {
          continue
        }

        // Try to assign staff for setup
        const setupDuration = 15
        const assignment = scheduler.assignStaffForSetup(timeSlot, setupDuration)

        if (assignment.staff === 'GEEN') {
          continue
        }

        // Create patient
        const medication = getAllMedications().find(m => m.id === treatment.medicationId)
        const patientName = `Patiënt - ${medication?.displayName || treatment.medicationId} (${treatment.treatmentNumber}e)`

        try {
          const response = await fetch('/api/patients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: patientName,
              startTime: timeSlot,
              scheduledDate: date,
              medicationType: treatment.medicationId,
              treatmentNumber: treatment.treatmentNumber
            })
          })

          if (response.ok) {
            const patient = await response.json()
            patientIds.push(patient.id)
            generatedPatients.push({
              name: patientName,
              startTime: timeSlot,
              scheduledDate: date,
              medicationType: treatment.medicationId,
              treatmentNumber: treatment.treatmentNumber
            })

            // Reserve chair
            chairTracker.addPatient(timeSlot, totalDuration)

            // Generate and assign actions
            const actions = generateActionsForMedication(treatment.medicationId, treatment.treatmentNumber)
            let cumulativeMinutes = 0
            let patientStartMinutes = startMinutes
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
                const setupAssignment = scheduler.assignStaffForSetup(actionStartTime, action.duration)
                staff = setupAssignment.staff
                setupStaff = staff
              } else if (action.type === 'protocol_check') {
                const duration = action.actualDuration || action.duration
                const assignment = scheduler.assignStaffForAction(action.type || 'protocol_check', duration, actionStartTime, setupStaff || undefined)
                staff = assignment.staff
              } else if (action.type === 'check' || action.type === 'pc_switch') {
                const duration = action.actualDuration || action.duration
                const assignment = scheduler.assignStaffForAction(action.type, duration, actionStartTime)
                staff = assignment.staff
              } else {
                const duration = action.actualDuration || action.duration
                const assignment = scheduler.assignStaffForAction(action.type || 'other', duration, actionStartTime)
                staff = assignment.staff
              }

              if (staff === 'GEEN') {
                // Skip this action if no staff available
                continue
              }

              // Create action
              await fetch('/api/actions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: action.name,
                  duration: action.duration,
                  staff: staff,
                  type: action.type,
                  actualDuration: action.actualDuration,
                  patientId: patient.id
                })
              })

              cumulativeMinutes += action.duration
            }

            assigned = true
          }
        } catch (error) {
          console.error(`Failed to create patient for ${treatment.medicationId}:`, error)
        }
      }

      if (!assigned) {
        console.warn(`⚠️ Kon geen tijd vinden voor behandeling ${treatment.medicationId} op ${day}`)
      }
    }
  }

  return { patientIds, patients: generatedPatients }
}

// Helper function to shuffle array
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}
