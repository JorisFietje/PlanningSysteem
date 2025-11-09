import { DEPARTMENT_CONFIG } from '@/types'

/**
 * Tracks how many setups (infusion starts) are scheduled at each time slot
 * to ensure we never exceed available nurse capacity (max 3 concurrent setups)
 */
export class SetupCapacityTracker {
  private setupsPerSlot: Map<string, number> = new Map()
  private readonly maxConcurrentSetups = DEPARTMENT_CONFIG.MAX_CONCURRENT_INFUSIONS // 3

  /**
   * Check if we can add a patient setup at this time
   * Returns true if fewer than 3 patients are starting at this time
   */
  public canAddSetup(startTime: string): boolean {
    const current = this.setupsPerSlot.get(startTime) || 0
    return current < this.maxConcurrentSetups
  }

  /**
   * Add a patient setup to this time slot
   */
  public addSetup(startTime: string): void {
    const current = this.setupsPerSlot.get(startTime) || 0
    this.setupsPerSlot.set(startTime, current + 1)
  }

  /**
   * Get the number of setups at a specific time
   */
  public getSetupsAt(startTime: string): number {
    return this.setupsPerSlot.get(startTime) || 0
  }

  /**
   * Find the next available time slot where we can add a setup
   * Returns null if no slot available before closing time
   */
  public findNextAvailableSlot(fromTime: string): string | null {
    // Generate all possible 30-minute slots from the given time onwards
    const [hours, minutes] = fromTime.split(':').map(Number)
    let currentMinutes = hours * 60 + minutes
    const closingMinutes = DEPARTMENT_CONFIG.END_HOUR * 60 - 120 // Stop 2 hours before closing

    while (currentMinutes < closingMinutes) {
      // Move to next 30-minute slot
      currentMinutes += 30
      
      const newHours = Math.floor(currentMinutes / 60)
      const newMinutes = currentMinutes % 60
      const timeSlot = `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`
      
      // Skip break times: 10:00-10:30 (coffee) and 12:00-13:00 (lunch)
      if ((newHours === 10 && newMinutes === 0) || newHours === 12) {
        continue
      }
      
      // Check if this slot has capacity
      if (this.canAddSetup(timeSlot)) {
        return timeSlot
      }
    }
    
    return null // No available slot found
  }

  /**
   * Get a summary of all time slots with their setup counts
   */
  public getSummary(): { time: string; count: number }[] {
    const summary: { time: string; count: number }[] = []
    
    for (const [time, count] of this.setupsPerSlot.entries()) {
      summary.push({ time, count })
    }
    
    return summary.sort((a, b) => a.time.localeCompare(b.time))
  }

  /**
   * Reset the tracker
   */
  public reset(): void {
    this.setupsPerSlot.clear()
  }
}

