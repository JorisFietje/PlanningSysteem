import { DayOfWeek, DEPARTMENT_CONFIG, Patient, StaffMember, getDayOfWeekFromDate, getDepartmentHours } from '@/types'
import { getMedicationById } from '@/types/medications'
import { generateActionsForMedication, calculateTotalTreatmentTime } from '@/utils/patients/actionGenerator'
import { ChairOccupancyTracker } from '@/utils/capacity/chairOccupancy'
import { StaffScheduler } from '@/utils/staff/staffAssignment'

type TreatmentRequest = {
  medicationId: string
  treatmentNumber: number
  quantity: number
}

type ScheduledAction = {
  name: string
  duration: number
  actualDuration?: number
  type?: string
  staff: string
}

type ScheduledPatient = {
  date: string
  startTime: string
  medicationId: string
  treatmentNumber: number
  actions: ScheduledAction[]
}

type ScheduleResult = {
  scheduled: ScheduledPatient[]
  skipped: Array<{ medicationId: string; treatmentNumber: number; reason: string }>
}

type RegisteredTask = {
  staff: string
  startTime: string
  duration: number
  type: string
}

type DayContext = {
  date: string
  day: DayOfWeek
  staff: StaffMember[]
  coordinator?: string | null
  tasks: RegisteredTask[]
  occupancy: Array<{ startTime: string; duration: number }>
  maxPatientsLimit?: number | null
  plannedCount: number
}

const buildChairTracker = (entries: Array<{ startTime: string; duration: number }>) => {
  const tracker = new ChairOccupancyTracker()
  entries.forEach(entry => tracker.addPatient(entry.startTime, entry.duration))
  return tracker
}

const buildScheduler = (
  staff: StaffMember[],
  day: DayOfWeek,
  coordinator: string | null | undefined,
  tasks: RegisteredTask[]
) => {
  const scheduler = new StaffScheduler(staff, day, coordinator, { suppressLogs: true })
  tasks.forEach(task => {
    scheduler.registerExistingTask(task.staff, task.startTime, task.duration, task.type)
  })
  return scheduler
}

const generateTimeSlots = () => {
  const slots: string[] = []
  const { startMinutes, endMinutes } = getDepartmentHours()
  for (let minutes = startMinutes; minutes <= endMinutes - 15; minutes += 15) {
    const hour = Math.floor(minutes / 60)
    const mins = minutes % 60
    slots.push(`${hour.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`)
  }
  return slots
}

const inferActionType = (action: Patient['actions'][number]) => {
  if (action.type) return action.type
  const name = action.name.toLowerCase()
  if (name.includes('aanbreng')) return 'setup'
  if (name.includes('protocol')) return 'protocol_check'
  if (name.includes('afkoppel')) return 'removal'
  if (name.includes('spoel')) return 'flush'
  if (name.includes('observ')) return 'observation'
  if (name.includes('loopt')) return 'infusion'
  if (name.includes('pc wissel')) return 'pc_switch'
  if (name.includes('check') || name.includes('controle')) return 'check'
  return 'custom'
}

const isNurseAction = (actionType?: string, nurseFlag?: boolean, hasStaff?: boolean) => {
  if (nurseFlag !== undefined) return nurseFlag
  if (!actionType && hasStaff) return true
  return (
    actionType === 'setup' ||
    actionType === 'protocol_check' ||
    actionType === 'check' ||
    actionType === 'flush' ||
    actionType === 'removal' ||
    actionType === 'custom_nurse' ||
    actionType === 'pc_switch'
  )
}

const getPatientDuration = (patient: Patient) => {
  return patient.actions.reduce((sum, action) => sum + action.duration, 0)
}

const extractExistingTasks = (patients: Patient[], availableStaff: Set<string>) => {
  const tasks: RegisteredTask[] = []

  patients.forEach(patient => {
    const [hours, minutes] = patient.startTime.split(':').map(Number)
    const patientStartMinutes = hours * 60 + minutes
    let currentMinutes = patientStartMinutes

    let infusionStartMinutes = 0
    let cumulativeMinutesForInfusion = 0
    patient.actions.forEach(action => {
      if (inferActionType(action) === 'infusion') {
        infusionStartMinutes = patientStartMinutes + cumulativeMinutesForInfusion
      }
      cumulativeMinutesForInfusion += action.duration
    })

    const medication = getMedicationById(patient.medicationType)
    let checkCount = 0
    let pcSwitchCount = 0

    for (const action of patient.actions) {
      let startMinutesForAction = currentMinutes
      const inferredType = inferActionType(action)
      const hasStaff = Boolean(action.staff && action.staff !== 'Systeem' && action.staff !== 'Geen')
      const actionStaff = action.staff

      if (inferredType === 'pc_switch' && infusionStartMinutes > 0) {
        const offset = (action as any).checkOffset
        if (typeof offset === 'number') {
          startMinutesForAction = infusionStartMinutes + offset
        } else if (medication?.pcSwitchInterval) {
          pcSwitchCount++
          startMinutesForAction = infusionStartMinutes + (pcSwitchCount * medication.pcSwitchInterval)
        }
      }
      if (inferredType === 'check' && infusionStartMinutes > 0) {
        const offset = (action as any).checkOffset
        if (typeof offset === 'number') {
          startMinutesForAction = infusionStartMinutes + offset
        } else if (medication?.checkInterval) {
          checkCount++
          startMinutesForAction = infusionStartMinutes + (checkCount * medication.checkInterval)
        }
      }

      if (!isNurseAction(inferredType, action.nurseAction, hasStaff)) {
        currentMinutes += action.duration
        continue
      }

      if (!actionStaff || !availableStaff.has(actionStaff)) {
        currentMinutes += action.duration
        continue
      }

      const effectiveDuration = action.actualDuration || action.duration
      const actionStartHours = Math.floor(startMinutesForAction / 60)
      const actionStartMins = startMinutesForAction % 60
      const actionStartTime = `${actionStartHours.toString().padStart(2, '0')}:${actionStartMins.toString().padStart(2, '0')}`

      tasks.push({
        staff: actionStaff,
        startTime: actionStartTime,
        duration: effectiveDuration,
        type: inferredType || 'other'
      })

      currentMinutes += action.duration
    }
  })

  return tasks
}

const simulateAssignment = (
  slot: string,
  treatment: { medicationId: string; treatmentNumber: number },
  dayContext: DayContext
) => {
  const totalDuration = calculateTotalTreatmentTime(treatment.medicationId, treatment.treatmentNumber)
  const chairTracker = buildChairTracker(dayContext.occupancy)
  const scheduler = buildScheduler(dayContext.staff, dayContext.day, dayContext.coordinator, dayContext.tasks)
  const actions = generateActionsForMedication(treatment.medicationId, treatment.treatmentNumber)

  const [startHours, startMinutes] = slot.split(':').map(Number)
  let patientStartMinutes = startHours * 60 + startMinutes
  let currentMinutes = patientStartMinutes
  let setupStaff: string | null = null
  let resolvedStartTime = slot
  let chairReserved = false

  let infusionOffsetMinutes = 0
  let cumulativeMinutesForInfusion = 0
  actions.forEach(action => {
    if (action.type === 'infusion') {
      infusionOffsetMinutes = cumulativeMinutesForInfusion
    }
    cumulativeMinutesForInfusion += action.duration
  })
  let infusionStartMinutes = infusionOffsetMinutes ? patientStartMinutes + infusionOffsetMinutes : 0

  const reserveChair = (startTime: string) => {
    if (chairReserved && startTime === resolvedStartTime) return true
    if (!chairTracker.canAddPatient(startTime, totalDuration)) {
      return false
    }
    chairTracker.addPatient(startTime, totalDuration)
    chairReserved = true
    resolvedStartTime = startTime
    return true
  }

  const assignedActions: ScheduledAction[] = []
  const newTasks: RegisteredTask[] = []

  for (const action of actions) {
    let startMinutesForAction = currentMinutes
    const inferredType = action.type

    if (inferredType === 'pc_switch' && infusionStartMinutes > 0 && typeof action.checkOffset === 'number') {
      startMinutesForAction = infusionStartMinutes + action.checkOffset
    }
    if (inferredType === 'check' && infusionStartMinutes > 0 && typeof action.checkOffset === 'number') {
      startMinutesForAction = infusionStartMinutes + action.checkOffset
    }

    const actionStartHours = Math.floor(startMinutesForAction / 60)
    const actionStartMins = startMinutesForAction % 60
    const actionStartTime = `${actionStartHours.toString().padStart(2, '0')}:${actionStartMins.toString().padStart(2, '0')}`
    const effectiveDuration = action.actualDuration || action.duration

    let staff = 'Systeem'

    if (action.type === 'infusion') {
      staff = 'Systeem'
    } else if (action.type === 'observation') {
      staff = 'Geen'
    } else if (action.type === 'setup') {
      const assignment = scheduler.assignStaffForSetup(actionStartTime, action.duration)
      if (assignment.staff === 'GEEN') {
        return null
      }
      const assignedStartMinutes = (() => {
        const [h, m] = assignment.actualStartTime.split(':').map(Number)
        return h * 60 + m
      })()
      if (assignedStartMinutes !== startMinutesForAction) {
        patientStartMinutes = assignedStartMinutes
        currentMinutes = assignedStartMinutes
        infusionStartMinutes = infusionOffsetMinutes ? patientStartMinutes + infusionOffsetMinutes : 0
      }
      const actualStartTime = assignment.actualStartTime
      if (!reserveChair(actualStartTime)) {
        return null
      }
      staff = assignment.staff
      setupStaff = staff
      newTasks.push({ staff, startTime: actualStartTime, duration: action.duration, type: action.type })
    } else if (action.type === 'protocol_check') {
      const assignment = scheduler.assignStaffForAction(action.type || 'protocol_check', effectiveDuration, actionStartTime, setupStaff || undefined)
      if (assignment.staff === 'GEEN') {
        return null
      }
      staff = assignment.staff
      newTasks.push({ staff, startTime: actionStartTime, duration: effectiveDuration, type: action.type })
    } else if (action.type === 'check' || action.type === 'pc_switch' || action.type === 'flush' || action.type === 'removal' || action.type === 'custom_nurse') {
      const assignment = scheduler.assignStaffForAction(action.type || 'other', effectiveDuration, actionStartTime)
      if (assignment.staff === 'GEEN') {
        return null
      }
      staff = assignment.staff
      newTasks.push({ staff, startTime: actionStartTime, duration: effectiveDuration, type: action.type })
    }

    assignedActions.push({
      name: action.name,
      duration: action.duration,
      actualDuration: action.actualDuration,
      type: action.type,
      staff
    })

    currentMinutes += action.duration
  }

  if (!chairReserved) {
    if (!reserveChair(resolvedStartTime)) {
      return null
    }
  }

  const distribution = scheduler.getWorkloadDistribution()
  const workloads = Object.values(distribution).map(entry => entry.totalMinutes)
  const maxWorkload = workloads.length > 0 ? Math.max(...workloads) : 0
  const peakOccupancy = chairTracker.getPeakOccupancy()
  const occupancyAtStart = chairTracker.getOccupancyAt(resolvedStartTime)
  const averageOccupancy = chairTracker.getAverageOccupancyForRange(resolvedStartTime, totalDuration)
  const [resolvedHours, resolvedMinutes] = resolvedStartTime.split(':').map(Number)
  const slotMinutes = resolvedHours * 60 + resolvedMinutes
  // Favor spreading patients across the day by penalizing local occupancy more than time
  const score =
    maxWorkload * 100 +
    averageOccupancy * 50 +
    occupancyAtStart * 20 +
    peakOccupancy * 5 +
    slotMinutes * 0.01

  return {
    assignedActions,
    newTasks,
    score,
    startTime: resolvedStartTime
  }
}

export function scheduleTreatmentsAcrossDates(
  selectedDates: string[],
  treatments: TreatmentRequest[],
  staffMembersByDate: Record<string, StaffMember[]>,
  coordinatorByDate: Record<string, string | null>,
  existingPatientsByDate: Record<string, Patient[]>,
  dayCapacityLimits: Record<string, number | null | undefined>
): ScheduleResult {
  const scheduled: ScheduledPatient[] = []
  const skipped: Array<{ medicationId: string; treatmentNumber: number; reason: string }> = []

  const dayContexts: DayContext[] = selectedDates.map(date => {
    const day = getDayOfWeekFromDate(date)
    const staff = staffMembersByDate[date] || []
    const availableStaffSet = new Set(staff.map(member => member.name))
    const patients = existingPatientsByDate[date] || []

    return {
      date,
      day,
      staff,
      coordinator: coordinatorByDate[date] || null,
      tasks: extractExistingTasks(patients, availableStaffSet),
      occupancy: patients.map(patient => ({ startTime: patient.startTime, duration: getPatientDuration(patient) })),
      maxPatientsLimit: dayCapacityLimits[date],
      plannedCount: patients.length
    }
  })

  const expandedTreatments: Array<{ medicationId: string; treatmentNumber: number; duration: number }> = []
  treatments.forEach(treatment => {
    const duration = calculateTotalTreatmentTime(treatment.medicationId, treatment.treatmentNumber)
    for (let i = 0; i < treatment.quantity; i++) {
      expandedTreatments.push({
        medicationId: treatment.medicationId,
        treatmentNumber: treatment.treatmentNumber,
        duration
      })
    }
  })

  expandedTreatments.sort((a, b) => b.duration - a.duration)

  const slots = generateTimeSlots()

  for (const treatment of expandedTreatments) {
    let bestCandidate: { contextIndex: number; slot: string; result: NonNullable<ReturnType<typeof simulateAssignment>> } | null = null
    const hasCapacity = dayContexts.some(context => {
      if (context.staff.length === 0) return false
      if (typeof context.maxPatientsLimit === 'number') {
        return context.plannedCount < context.maxPatientsLimit
      }
      return true
    })

    if (!hasCapacity) {
      skipped.push({
        medicationId: treatment.medicationId,
        treatmentNumber: treatment.treatmentNumber,
        reason: 'Dagcapaciteit bereikt'
      })
      continue
    }

    dayContexts.forEach((context, contextIndex) => {
      if (context.staff.length === 0) return
      if (typeof context.maxPatientsLimit === 'number' && context.plannedCount >= context.maxPatientsLimit) return
      slots.forEach(slot => {
        const result = simulateAssignment(slot, treatment, context)
        if (!result) return
        if (!bestCandidate || result.score < bestCandidate.result.score) {
          bestCandidate = { contextIndex, slot, result }
        }
      })
    })

    if (!bestCandidate) {
      skipped.push({
        medicationId: treatment.medicationId,
        treatmentNumber: treatment.treatmentNumber,
        reason: 'Geen beschikbare tijd gevonden'
      })
      continue
    }

    const context = dayContexts[bestCandidate.contextIndex]
    const resolvedStartTime = bestCandidate.result.startTime || bestCandidate.slot
    context.tasks = [...context.tasks, ...bestCandidate.result.newTasks]
    context.occupancy = [
      ...context.occupancy,
      { startTime: resolvedStartTime, duration: treatment.duration }
    ]
    context.plannedCount += 1

    scheduled.push({
      date: context.date,
      startTime: resolvedStartTime,
      medicationId: treatment.medicationId,
      treatmentNumber: treatment.treatmentNumber,
      actions: bestCandidate.result.assignedActions
    })
  }

  return { scheduled, skipped }
}
