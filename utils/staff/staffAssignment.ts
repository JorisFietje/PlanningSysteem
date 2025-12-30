import { DEPARTMENT_CONFIG, StaffMember, DayOfWeek, getDayCoordinators, getDepartmentHours, getDaycoPatientsCount } from '@/types'

interface StaffAvailability {
  staff: string
  maxPatients: number // Maximum number of patients this staff can handle
  maxWorkTime?: number // Maximum work time in minutes from start of day (e.g., 360 = 14:00 for Yvonne)
  maxWorkloadMinutes?: number // Maximum total workload minutes (used for dayco free time)
  lastSetupTime: number // Minutes since start of day
  totalWorkload: number // Total minutes of work
  setupCount: number // Number of setups done
  busyUntil: number // Minutes since start of day - when they're free again
}

interface ScheduledTask {
  staff: string
  startTime: number
  endTime: number
  type: string
}

export class StaffScheduler {
  private availability: StaffAvailability[]
  private readonly dayStartMinutes: number
  private scheduledTasks: ScheduledTask[] = []
  private setupRoundRobinIndex: number = 0 // Round-robin counter for fair setup distribution
  private staffMembers: StaffMember[]
  private selectedDay: DayOfWeek
  private coordinatorName?: string
  private suppressLogs: boolean

  constructor(
    staffMembers: StaffMember[],
    selectedDay: DayOfWeek,
    coordinatorName?: string,
    options?: { suppressLogs?: boolean }
  ) {
    const departmentHours = getDepartmentHours()
    this.dayStartMinutes = departmentHours.startMinutes
    this.selectedDay = selectedDay
    this.coordinatorName = coordinatorName
    this.suppressLogs = Boolean(options?.suppressLogs)
    
    // Beschikbaarheid komt uit het weekrooster; gebruik alle medewerkers
    const availableStaffForDay = staffMembers
    
    // Get day coordinators - coordinator is 4th person, separate from the 3 VPK
    const dayCoordinators = getDayCoordinators()
    const coordinator = this.coordinatorName ?? dayCoordinators[selectedDay]
    
    // If coordinator exists and is not in the regular staff, add them as 4th person
    let allStaffForDay = [...availableStaffForDay]
    if (coordinator) {
      const coordinatorExists = availableStaffForDay.some(s => s.name === coordinator)
      if (!coordinatorExists) {
        // Coordinator is not in regular staff, find them and add as 4th person
        const coordinatorStaff = staffMembers.find(s => s.name === coordinator)
        if (coordinatorStaff) {
          allStaffForDay.push(coordinatorStaff)
        }
      }
    }
    
    this.staffMembers = allStaffForDay
    
    // Initialize all staff members for this day (3 VPK + 1 coordinator if present)
    const totalDayMinutes = departmentHours.endMinutes - departmentHours.startMinutes
    const coordinatorMaxPatients = getDaycoPatientsCount()
    const coordinatorReservedMinutes = 120 + 60

    this.availability = allStaffForDay.map(staffMember => {
      // If this staff member is the day coordinator, limit to 5 patients
      const isCoordinator = coordinator && staffMember.name === coordinator
      const maxPatients = isCoordinator
        ? Math.min(coordinatorMaxPatients, staffMember.maxPatients)
        : staffMember.maxPatients
      const maxWorkloadMinutes = isCoordinator
        ? Math.max(totalDayMinutes - coordinatorReservedMinutes, 0)
        : undefined
      
      return {
        staff: staffMember.name,
        maxPatients: maxPatients,
        maxWorkTime: staffMember.maxWorkTime,
        maxWorkloadMinutes,
        lastSetupTime: -999, // Far in the past
        totalWorkload: 0,
        setupCount: 0,
        busyUntil: 0 // Available from start of day
      }
    })
    
    // Removed console.log to prevent spam in loops
    // const regularStaff = coordinator ? allStaffForDay.filter(s => s.name !== coordinator) : allStaffForDay
    // console.log(`🗓️ StaffScheduler geïnitialiseerd voor ${selectedDay} met ${regularStaff.length} VPK${coordinator ? ` + 1 Coördinator (${coordinator} - max 5 patiënten)` : ''}: ${allStaffForDay.map(s => s.name).join(', ')}`)
  }

  /**
   * Convert time string (HH:MM) to minutes since start of day
   */
  private timeToMinutes(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number)
    return hours * 60 + minutes
  }

  /**
   * Check if staff member has ANY overlapping tasks at given time
   */
  private hasOverlappingTask(staffName: string, startMinutes: number, endMinutes: number): boolean {
    return this.scheduledTasks.some(task => 
      task.staff === staffName &&
      task.startTime < endMinutes &&
      task.endTime > startMinutes
    )
  }

  private hasOverlappingSetupForStaff(staffName: string, startMinutes: number, endMinutes: number): boolean {
    return this.scheduledTasks.some(task =>
      task.staff === staffName &&
      task.type === 'setup' &&
      task.startTime < endMinutes &&
      task.endTime > startMinutes
    )
  }

  private getOverlapCount(staffName: string, startMinutes: number, endMinutes: number): number {
    return this.scheduledTasks.filter(task =>
      task.staff === staffName &&
      task.startTime < endMinutes &&
      task.endTime > startMinutes
    ).length
  }

  private isDuringLunchRange(startMinutes: number, endMinutes: number): boolean {
    const lunchStart = 12 * 60
    const lunchEnd = 13 * 60
    return startMinutes < lunchEnd && endMinutes > lunchStart
  }

  private countConcurrentNurseTasks(startMinutes: number, endMinutes: number): number {
    const staffSet = new Set<string>()
    this.scheduledTasks.forEach(task => {
      if (task.startTime < endMinutes && task.endTime > startMinutes) {
        staffSet.add(task.staff)
      }
    })
    return staffSet.size
  }

  private getLunchAllowedNurses(): number {
    return Math.max(1, Math.ceil(this.availability.length / 2))
  }

  private getConcurrentSetupCount(startMinutes: number, endMinutes: number): number {
    return this.scheduledTasks.filter(task =>
      task.type === 'setup' &&
      task.startTime < endMinutes &&
      task.endTime > startMinutes
    ).length
  }

  private getMaxConcurrentSetups(startMinutes: number, endMinutes: number, duration: number): number {
    return this.availability.filter(staff => {
      if (staff.maxWorkTime && endMinutes > (this.dayStartMinutes + staff.maxWorkTime)) return false
      if (staff.maxWorkloadMinutes && staff.totalWorkload + duration > staff.maxWorkloadMinutes) return false
      if (this.isCoordinatorBlocked(staff.staff, startMinutes, endMinutes)) return false
      return true
    }).length
  }

  /**
   * Check if time falls within break periods (no setups allowed)
   * 12:00-13:00: Lunch break
   */
  private exceedsLunchCapacity(startMinutes: number, endMinutes: number, staffName: string): boolean {
    const lunchStart = 12 * 60
    const lunchMid = 12 * 60 + 30
    const lunchEnd = 13 * 60
    const overlapsEarly = startMinutes < lunchMid && endMinutes > lunchStart
    const overlapsLate = startMinutes < lunchEnd && endMinutes > lunchMid
    if (!overlapsEarly && !overlapsLate) return false
    const allowed = this.getLunchAllowedNurses()
    const windowStart = overlapsEarly ? lunchStart : lunchMid
    const windowEnd = overlapsLate ? lunchEnd : lunchMid
    const concurrent = this.countConcurrentNurseTasks(windowStart, windowEnd)
    const alreadyCounted = this.scheduledTasks.some(task =>
      task.staff === staffName &&
      task.startTime < windowEnd &&
      task.endTime > windowStart
    )
    return concurrent + (alreadyCounted ? 0 : 1) > allowed
  }

  private isCoordinatorBlocked(staffName: string, startMinutes: number, endMinutes: number): boolean {
    if (!this.coordinatorName || staffName !== this.coordinatorName) return false
    const blockStart = 9 * 60
    const blockEnd = 12 * 60
    return startMinutes < blockEnd && endMinutes > blockStart
  }

  private canScheduleSetupAt(startMinutes: number, endMinutes: number): boolean {
    if (this.isDuringLunchRange(startMinutes, endMinutes)) return false
    const duration = Math.max(endMinutes - startMinutes, 0)
    const maxConcurrent = this.getMaxConcurrentSetups(startMinutes, endMinutes, duration)
    if (maxConcurrent <= 0) return false
    return this.getConcurrentSetupCount(startMinutes, endMinutes) < maxConcurrent
  }

  /**
   * Find the best available staff member for a setup action at given time
   * Uses capacity-weighted balancing with availability checks to ensure fair distribution
   * BLOCKS setups during break time (12:00-13:00)
   * ENFORCES preparation time between setups for same staff member
   * (Staff CAN do other actions like removal, checks, flush during prep time)
   * Returns both the staff member AND the actual start time (which may be adjusted for breaks/availability)
   */
  public assignStaffForSetup(startTime: string, duration: number = 15): { staff: string; actualStartTime: string; wasDelayed: boolean } {
    const { endMinutes: closingMinutes } = getDepartmentHours()
    if (this.availability.length === 0) {
      return { staff: 'GEEN', actualStartTime: startTime, wasDelayed: true }
    }
    const stepMinutes = 5
    let requestedMinutes = this.timeToMinutes(startTime)
    let endMinutes = requestedMinutes + duration
    let adjustedStartTime = startTime
    
    // Find the next time that respects setup capacity and lunch rotation
    while (requestedMinutes + duration <= closingMinutes) {
      if (
        this.canScheduleSetupAt(requestedMinutes, requestedMinutes + duration) &&
        !this.isDuringLunchRange(requestedMinutes, requestedMinutes + duration)
      ) {
        break
      }
      requestedMinutes += stepMinutes
    }

    if (requestedMinutes + duration > closingMinutes) {
      return { staff: 'GEEN', actualStartTime: startTime, wasDelayed: true }
    }

    endMinutes = requestedMinutes + duration
    adjustedStartTime = `${Math.floor(requestedMinutes / 60).toString().padStart(2, '0')}:${(requestedMinutes % 60).toString().padStart(2, '0')}`
    
    const staffCount = this.staffMembers.length
    const candidates = this.availability
      .map((staff, index) => ({ staff, index }))
      .filter(({ staff }) => {
        const withinWorkingHours = !staff.maxWorkTime || endMinutes <= (this.dayStartMinutes + staff.maxWorkTime)
        const withinWorkload = !staff.maxWorkloadMinutes || staff.totalWorkload + duration <= staff.maxWorkloadMinutes
        const timeSinceLastSetup = requestedMinutes - staff.lastSetupTime
        const hasEnoughPrepTime = timeSinceLastSetup >= DEPARTMENT_CONFIG.STAFF_PREPARATION_TIME || staff.lastSetupTime === -999
        const hasNoOverlap = !this.hasOverlappingTask(staff.staff, requestedMinutes, endMinutes)
        const withinSetupCapacity = this.canScheduleSetupAt(requestedMinutes, endMinutes)
        const notInLunch = !this.isDuringLunchRange(requestedMinutes, endMinutes)
        const notBlocked = !this.isCoordinatorBlocked(staff.staff, requestedMinutes, endMinutes)
        return withinWorkingHours && withinWorkload && hasEnoughPrepTime && hasNoOverlap && withinSetupCapacity && notInLunch && notBlocked
      })

    if (candidates.length > 0) {
      const sorted = candidates.sort((a, b) => {
        const utilizationA = a.staff.maxPatients > 0 ? a.staff.setupCount / a.staff.maxPatients : 1
        const utilizationB = b.staff.maxPatients > 0 ? b.staff.setupCount / b.staff.maxPatients : 1
        if (utilizationA !== utilizationB) return utilizationA - utilizationB
        if (a.staff.setupCount !== b.staff.setupCount) return a.staff.setupCount - b.staff.setupCount
        if (a.staff.totalWorkload !== b.staff.totalWorkload) return a.staff.totalWorkload - b.staff.totalWorkload
        if (a.staff.busyUntil !== b.staff.busyUntil) return a.staff.busyUntil - b.staff.busyUntil
        const rrA = (a.index - this.setupRoundRobinIndex + staffCount) % staffCount
        const rrB = (b.index - this.setupRoundRobinIndex + staffCount) % staffCount
        return rrA - rrB
      })

      const selected = sorted[0]
      this.scheduleTask(selected.staff.staff, requestedMinutes, endMinutes, 'setup')
      this.updateStaffSetup(selected.staff.staff, requestedMinutes, duration)
      this.setupRoundRobinIndex = (selected.index + 1) % staffCount
      return { staff: selected.staff.staff, actualStartTime: adjustedStartTime, wasDelayed: false }
    }
    
    // LAST RESORT: If truly no one available (shouldn't happen with proper simulation)
    // Pick the one with least setup count and schedule AFTER their busy time
    // FILTER OUT staff who have reached their max patients or max work time
    const availableStaff = this.availability.filter(s => {
      // Must be within working hours (check if adjusted time would be within their work time)
      if (s.maxWorkTime && requestedMinutes >= (this.dayStartMinutes + s.maxWorkTime)) return false
      if (s.maxWorkloadMinutes && s.totalWorkload + duration > s.maxWorkloadMinutes) return false
      if (this.isCoordinatorBlocked(s.staff, requestedMinutes, requestedMinutes + duration)) return false
      return true
    })
    
    if (availableStaff.length === 0) {
      // NO STAFF AVAILABLE AT ALL - this patient cannot be scheduled
      if (!this.suppressLogs) {
        console.error(`❌ GEEN VERPLEEGKUNDIGEN BESCHIKBAAR voor ${startTime} - alle verpleegkundigen hebben hun limiet bereikt`)
      }
      // Return a dummy result - caller should handle this
      return { staff: 'GEEN', actualStartTime: adjustedStartTime, wasDelayed: true }
    }
    
    const fallbackStaff = availableStaff.sort((a, b) => {
      const utilizationA = a.maxPatients > 0 ? a.setupCount / a.maxPatients : 1
      const utilizationB = b.maxPatients > 0 ? b.setupCount / b.maxPatients : 1
      if (utilizationA !== utilizationB) return utilizationA - utilizationB
      if (a.setupCount !== b.setupCount) return a.setupCount - b.setupCount
      return a.busyUntil - b.busyUntil
    })[0]
    
    // Relaxed scheduling: allow overlap if needed, but never during lunch.
    let adjustedStart = requestedMinutes
    while (adjustedStart + duration <= closingMinutes) {
      if (!this.isDuringLunchRange(adjustedStart, adjustedStart + duration)) {
        break
      }
      adjustedStart += stepMinutes
    }

    if (this.isCoordinatorBlocked(fallbackStaff.staff, adjustedStart, adjustedStart + duration)) {
      return { staff: 'GEEN', actualStartTime: adjustedStartTime, wasDelayed: true }
    }

    // Check if adjusted start would exceed staff's work time or closing
    if (
      adjustedStart + duration > closingMinutes ||
      (fallbackStaff.maxWorkTime && adjustedStart >= (this.dayStartMinutes + fallbackStaff.maxWorkTime)) ||
      (fallbackStaff.maxWorkloadMinutes && fallbackStaff.totalWorkload + duration > fallbackStaff.maxWorkloadMinutes)
    ) {
      if (!this.suppressLogs) {
        const endMinutes = this.dayStartMinutes + (fallbackStaff.maxWorkTime || 0)
        console.error(`❌ ${fallbackStaff.staff} kan niet meer werken na ${Math.floor(endMinutes / 60)}:${String(endMinutes % 60).padStart(2, '0')}`)
      }
      return { staff: 'GEEN', actualStartTime: adjustedStartTime, wasDelayed: true }
    }
    
    const adjustedEnd = adjustedStart + duration
    
    this.scheduleTask(fallbackStaff.staff, adjustedStart, adjustedEnd, 'setup')
    this.updateStaffSetup(fallbackStaff.staff, adjustedStart, duration)
    
    const adjustedHours = Math.floor(adjustedStart / 60)
    const adjustedMins = adjustedStart % 60
    const actualStartTime = `${adjustedHours.toString().padStart(2, '0')}:${adjustedMins.toString().padStart(2, '0')}`
    
    // Removed console.log to prevent spam
    // if (adjustedStart > requestedMinutes) {
    //   const delayReason = adjustedStart === minSetupTime ? 'prep time' : 
    //                       adjustedStart === fallbackStaff.busyUntil ? 'busy with other tasks' : 
    //                       'break time'
    //   console.log(`⏰ Setup delayed from ${startTime} to ${actualStartTime} for ${fallbackStaff.staff} (reason: ${delayReason})`)
    // }
    
    return { staff: fallbackStaff.staff, actualStartTime, wasDelayed: adjustedStart > requestedMinutes }
  }

  /**
   * Assign staff for non-setup actions (checks, removal, observation, flush)
   * Only assigns if staff is truly available - NO OVERLAPS
   * Returns both the staff member AND the actual start time (which may be delayed)
   * @param excludeStaff - Optional: staff member to exclude (for protocol checks - must be different from setup staff)
   */
  public assignStaffForAction(
    actionType: string, 
    duration: number, 
    requestedTime: string, 
    excludeStaff?: string
  ): { staff: string; actualStartTime: string; wasDelayed: boolean } {
    const requestedMinutes = this.timeToMinutes(requestedTime)
    const endMinutes = requestedMinutes + duration
    
    // Find ALL staff who have no overlapping tasks at this time AND are not excluded AND within working hours
    const availableStaff = this.availability.filter(s => {
      // Do not overlap with an existing setup for this staff member
      if (this.hasOverlappingSetupForStaff(s.staff, requestedMinutes, endMinutes)) return false
      // Check if excluded
      if (excludeStaff && s.staff === excludeStaff) return false
      // Check if action would end within staff working hours
      if (s.maxWorkTime && endMinutes > (this.dayStartMinutes + s.maxWorkTime)) return false
      if (s.maxWorkloadMinutes && s.totalWorkload + duration > s.maxWorkloadMinutes) return false
      if (this.isCoordinatorBlocked(s.staff, requestedMinutes, endMinutes)) return false
      if (this.exceedsLunchCapacity(requestedMinutes, endMinutes, s.staff)) return false
      return true
    })

    if (availableStaff.length === 0) {
      if (!this.suppressLogs) {
        console.error(`❌ GEEN VERPLEEGKUNDIGEN beschikbaar voor ${actionType} om ${requestedTime}`)
      }
      return { staff: 'GEEN', actualStartTime: requestedTime, wasDelayed: true }
    }

    // From available staff, choose the one with least total workload
    const bestStaff = availableStaff.sort((a, b) => a.totalWorkload - b.totalWorkload)[0]

    // Schedule this task
    this.scheduleTask(bestStaff.staff, requestedMinutes, endMinutes, actionType)
    this.updateStaffWorkload(bestStaff.staff, endMinutes, duration)

    return { 
      staff: bestStaff.staff, 
      actualStartTime: requestedTime,
      wasDelayed: false
    }
  }

  /**
   * Relaxed assignment for non-setup actions when lunch capacity is the only blocker.
   * Still avoids overlapping setup tasks for the same staff member.
   */
  public assignStaffForActionRelaxed(
    actionType: string,
    duration: number,
    requestedTime: string,
    excludeStaff?: string
  ): { staff: string; actualStartTime: string; wasDelayed: boolean } {
    const requestedMinutes = this.timeToMinutes(requestedTime)
    const endMinutes = requestedMinutes + duration

    const availableStaff = this.availability.filter(s => {
      if (this.hasOverlappingSetupForStaff(s.staff, requestedMinutes, endMinutes)) return false
      if (excludeStaff && s.staff === excludeStaff) return false
      if (s.maxWorkTime && endMinutes > (this.dayStartMinutes + s.maxWorkTime)) return false
      if (s.maxWorkloadMinutes && s.totalWorkload + duration > s.maxWorkloadMinutes) return false
      if (this.isCoordinatorBlocked(s.staff, requestedMinutes, endMinutes)) return false
      return true
    })

    if (availableStaff.length === 0) {
      return { staff: 'GEEN', actualStartTime: requestedTime, wasDelayed: true }
    }

    const bestStaff = availableStaff.sort((a, b) => a.totalWorkload - b.totalWorkload)[0]

    this.scheduleTask(bestStaff.staff, requestedMinutes, endMinutes, actionType)
    this.updateStaffWorkload(bestStaff.staff, endMinutes, duration)

    return {
      staff: bestStaff.staff,
      actualStartTime: requestedTime,
      wasDelayed: false
    }
  }

  /**
   * Schedule a task for a staff member
   */
  private scheduleTask(staffName: string, startMinutes: number, endMinutes: number, type: string): void {
    this.scheduledTasks.push({
      staff: staffName,
      startTime: startMinutes,
      endTime: endMinutes,
      type
    })
  }

  /**
   * Update staff availability after SETUP assignment
   */
  private updateStaffSetup(staffName: string, setupTime: number, workMinutes: number) {
    const staff = this.availability.find(s => s.staff === staffName)
    if (staff) {
      // VALIDATION: Check if preparation time was respected
      if (staff.lastSetupTime !== -999) {
        const timeSinceLastSetup = setupTime - staff.lastSetupTime
        if (timeSinceLastSetup < DEPARTMENT_CONFIG.STAFF_PREPARATION_TIME) {
          const setupHour = Math.floor(setupTime / 60)
          const setupMin = setupTime % 60
          const lastHour = Math.floor(staff.lastSetupTime / 60)
          const lastMin = staff.lastSetupTime % 60
          console.error(`❌ VIOLATION: ${staffName} assigned setup at ${setupHour}:${String(setupMin).padStart(2, '0')}, only ${timeSinceLastSetup} min after previous setup at ${lastHour}:${String(lastMin).padStart(2, '0')} (min: ${DEPARTMENT_CONFIG.STAFF_PREPARATION_TIME} min)`)
        }
      }
      
      staff.lastSetupTime = setupTime
      staff.setupCount++
      staff.totalWorkload += workMinutes
      
      const endTime = setupTime + workMinutes
      if (endTime > staff.busyUntil) {
        staff.busyUntil = endTime
      }
    }
  }

  /**
   * Update staff availability after NON-SETUP action assignment
   */
  private updateStaffWorkload(staffName: string, endTime: number, workMinutes: number) {
    const staff = this.availability.find(s => s.staff === staffName)
    if (staff) {
      staff.totalWorkload += workMinutes
      
      if (endTime > staff.busyUntil) {
        staff.busyUntil = endTime
      }
    }
  }

  /**
   * Manually register a setup for a preferred nurse
   * Used when preferredNurse is specified
   */
  public registerPreferredNurseSetup(staffName: string, startTime: string, duration: number = 15): void {
    const requestedMinutes = this.timeToMinutes(startTime)
    const endMinutes = requestedMinutes + duration
    
    this.scheduleTask(staffName, requestedMinutes, endMinutes, 'setup')
    this.updateStaffSetup(staffName, requestedMinutes, duration)
  }

  /**
   * Register an existing task for a specific staff member
   * Used to seed the scheduler with already planned work
   */
  public registerExistingTask(staffName: string, startTime: string, duration: number, type: string): void {
    const requestedMinutes = this.timeToMinutes(startTime)
    const endMinutes = requestedMinutes + duration

    this.scheduleTask(staffName, requestedMinutes, endMinutes, type)

    if (type === 'setup') {
      this.updateStaffSetup(staffName, requestedMinutes, duration)
    } else {
      this.updateStaffWorkload(staffName, endMinutes, duration)
    }
  }

  /**
   * Get current workload distribution
   */
  public getWorkloadDistribution(): { [staff: string]: { setups: number, totalMinutes: number } } {
    const distribution: { [staff: string]: { setups: number, totalMinutes: number } } = {}
    
    this.availability.forEach(s => {
      distribution[s.staff] = {
        setups: s.setupCount,
        totalMinutes: s.totalWorkload
      }
    })
    
    return distribution
  }

  /**
   * Get list of available staff members for the selected day
   */
  public getAvailableStaffForDay(): string[] {
    return this.availability.map(s => s.staff)
  }
}

/**
 * @deprecated Legacy function - use StaffScheduler instead
 * This function is kept for backward compatibility only
 */
export function assignStaffRotation(actionIndex: number, staffMembers: StaffMember[]): string {
  if (staffMembers.length === 0) return 'Geen VPK'
  return staffMembers[actionIndex % staffMembers.length].name
}
