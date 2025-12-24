import { DEPARTMENT_CONFIG, StaffMember, DayOfWeek, getDayCoordinators } from '@/types'

interface StaffAvailability {
  staff: string
  maxPatients: number // Maximum number of patients this staff can handle
  maxWorkTime?: number // Maximum work time in minutes from start of day (e.g., 360 = 14:00 for Yvonne)
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
  private readonly startHour = DEPARTMENT_CONFIG.START_HOUR
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
    this.availability = allStaffForDay.map(staffMember => {
      // If this staff member is the day coordinator, limit to 5 patients
      const maxPatients = (coordinator && staffMember.name === coordinator) ? 5 : staffMember.maxPatients
      
      return {
        staff: staffMember.name,
        maxPatients: maxPatients,
        maxWorkTime: staffMember.maxWorkTime,
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

  /**
   * Check if time falls within break periods (no setups allowed)
   * 10:00-10:30: Coffee break
   * 12:00-13:00: Lunch break
   */
  private isDuringBreak(timeMinutes: number): boolean {
    const hour = Math.floor(timeMinutes / 60)
    const minute = timeMinutes % 60
    
    // 10:00-10:30 coffee break
    if (hour === 10 && minute >= 0 && minute < 30) {
      return true
    }
    
    // 12:00-13:00 lunch break
    if (hour === 12) {
      return true
    }
    
    return false
  }

  /**
   * Find the best available staff member for a setup action at given time
   * Uses capacity-weighted balancing with availability checks to ensure fair distribution
   * BLOCKS setups during break times (10:00-10:30 and 12:00-13:00)
   * ENFORCES preparation time between setups for same staff member
   * (Staff CAN do other actions like removal, checks, flush during prep time)
   * Returns both the staff member AND the actual start time (which may be adjusted for breaks/availability)
   */
  public assignStaffForSetup(startTime: string, duration: number = 15): { staff: string; actualStartTime: string; wasDelayed: boolean } {
    const requestedMinutes = this.timeToMinutes(startTime)
    const endMinutes = requestedMinutes + duration
    
    // CHECK: Is this during a break? If so, reschedule to after break
    if (this.isDuringBreak(requestedMinutes)) {
      const hour = Math.floor(requestedMinutes / 60)
      let adjustedMinutes = requestedMinutes
      
      if (hour === 10) {
        // Move to 10:30
        adjustedMinutes = 10 * 60 + 30
      } else if (hour === 12) {
        // Move to 13:00
        adjustedMinutes = 13 * 60
      }
      
      // Retry with adjusted time
      const adjustedTime = `${Math.floor(adjustedMinutes / 60).toString().padStart(2, '0')}:${(adjustedMinutes % 60).toString().padStart(2, '0')}`
      return this.assignStaffForSetup(adjustedTime, duration)
    }
    
    const staffCount = this.staffMembers.length
    const candidates = this.availability
      .map((staff, index) => ({ staff, index }))
      .filter(({ staff }) => {
        const hasCapacity = staff.setupCount < staff.maxPatients
        const withinWorkingHours = !staff.maxWorkTime || endMinutes <= staff.maxWorkTime
        const timeSinceLastSetup = requestedMinutes - staff.lastSetupTime
        const hasEnoughPrepTime = timeSinceLastSetup >= DEPARTMENT_CONFIG.STAFF_PREPARATION_TIME || staff.lastSetupTime === -999
        const hasNoOverlap = !this.hasOverlappingTask(staff.staff, requestedMinutes, endMinutes)
        return hasCapacity && withinWorkingHours && hasEnoughPrepTime && hasNoOverlap
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
      return { staff: selected.staff.staff, actualStartTime: startTime, wasDelayed: false }
    }
    
    // LAST RESORT: If truly no one available (shouldn't happen with proper simulation)
    // Pick the one with least setup count and schedule AFTER their busy time
    // FILTER OUT staff who have reached their max patients or max work time
    const availableStaff = this.availability.filter(s => {
      // Must have capacity left
      if (s.setupCount >= s.maxPatients) return false
      // Must be within working hours (check if adjusted time would be within their work time)
      if (s.maxWorkTime && requestedMinutes >= s.maxWorkTime) return false
      return true
    })
    
    if (availableStaff.length === 0) {
      // NO STAFF AVAILABLE AT ALL - this patient cannot be scheduled
      if (!this.suppressLogs) {
        console.error(`❌ GEEN VERPLEEGKUNDIGEN BESCHIKBAAR voor ${startTime} - alle verpleegkundigen hebben hun limiet bereikt`)
      }
      // Return a dummy result - caller should handle this
      return { staff: 'GEEN', actualStartTime: startTime, wasDelayed: true }
    }
    
    const fallbackStaff = availableStaff.sort((a, b) => {
      const utilizationA = a.maxPatients > 0 ? a.setupCount / a.maxPatients : 1
      const utilizationB = b.maxPatients > 0 ? b.setupCount / b.maxPatients : 1
      if (utilizationA !== utilizationB) return utilizationA - utilizationB
      if (a.setupCount !== b.setupCount) return a.setupCount - b.setupCount
      return a.busyUntil - b.busyUntil
    })[0]
    
    // Schedule at their next available time (but not during breaks!)
    // MUST respect preparation time between setups!
    const minSetupTime = fallbackStaff.lastSetupTime === -999 
      ? requestedMinutes 
      : fallbackStaff.lastSetupTime + DEPARTMENT_CONFIG.STAFF_PREPARATION_TIME
    
    let adjustedStart = Math.max(requestedMinutes, fallbackStaff.busyUntil, minSetupTime)
    
    // Check if adjusted start would exceed staff's work time
    if (fallbackStaff.maxWorkTime && adjustedStart >= fallbackStaff.maxWorkTime) {
      if (!this.suppressLogs) {
        console.error(`❌ ${fallbackStaff.staff} kan niet meer werken na ${Math.floor(fallbackStaff.maxWorkTime / 60) + 8}:00`)
      }
      return { staff: 'GEEN', actualStartTime: startTime, wasDelayed: true }
    }
    
    // Skip breaks if needed
    if (this.isDuringBreak(adjustedStart)) {
      const hour = Math.floor(adjustedStart / 60)
      if (hour === 10) {
        adjustedStart = 10 * 60 + 30
      } else if (hour === 12) {
        adjustedStart = 13 * 60
      }
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
      // Check for overlaps
      if (this.hasOverlappingTask(s.staff, requestedMinutes, endMinutes)) return false
      // Check if excluded
      if (excludeStaff && s.staff === excludeStaff) return false
      // Check if action would end within staff working hours
      if (s.maxWorkTime && endMinutes > s.maxWorkTime) return false
      return true
    })

    if (availableStaff.length === 0) {
      // NO ONE is available - we need to DELAY this action
      // Find who becomes free soonest (excluding specified staff if needed AND within working hours)
      const candidateStaff = this.availability.filter(s => {
        if (excludeStaff && s.staff === excludeStaff) return false
        // Also check if this staff member would still be working when the action completes
        const projectedEnd = Math.max(requestedMinutes, s.busyUntil) + duration
        if (s.maxWorkTime && projectedEnd > s.maxWorkTime) return false
        return true
      })
      
      if (candidateStaff.length === 0) {
        // NO STAFF can do this action (all are outside working hours or excluded)
        if (!this.suppressLogs) {
          console.error(`❌ GEEN VERPLEEGKUNDIGEN beschikbaar voor ${actionType} om ${requestedTime} - actie valt buiten werktijden`)
        }
        return { staff: 'GEEN', actualStartTime: requestedTime, wasDelayed: true }
      }
      
      const nextFreeStaff = [...candidateStaff].sort((a, b) => a.busyUntil - b.busyUntil)[0]
      const adjustedStart = Math.max(requestedMinutes, nextFreeStaff.busyUntil)
      const adjustedEnd = adjustedStart + duration
      
      this.scheduleTask(nextFreeStaff.staff, adjustedStart, adjustedEnd, actionType)
      this.updateStaffWorkload(nextFreeStaff.staff, adjustedEnd, duration)
      
      const adjustedHours = Math.floor(adjustedStart / 60)
      const adjustedMins = adjustedStart % 60
      const actualStartTime = `${adjustedHours.toString().padStart(2, '0')}:${adjustedMins.toString().padStart(2, '0')}`
      
      // Removed console.log to prevent spam
      // console.log(`⏰ Delayed ${actionType} from ${requestedTime} to ${actualStartTime} for ${nextFreeStaff.staff}`)
      
      return { 
        staff: nextFreeStaff.staff, 
        actualStartTime,
        wasDelayed: true
      }
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
