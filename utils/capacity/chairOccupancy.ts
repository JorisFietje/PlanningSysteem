import { DEPARTMENT_CONFIG } from '@/types'

interface PatientSchedule {
  startTime: string
  duration: number // Total duration in minutes
}

export class ChairOccupancyTracker {
  private occupancy: Map<number, number> = new Map()
  private readonly maxChairs = DEPARTMENT_CONFIG.TOTAL_CHAIRS
  private readonly startHour = DEPARTMENT_CONFIG.START_HOUR

  /**
   * Convert time string (HH:MM) to minutes since start of day
   */
  private timeToMinutes(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number)
    return hours * 60 + minutes
  }

  /**
   * Add a patient's occupancy to the tracker
   */
  public addPatient(startTime: string, duration: number): void {
    const startMinutes = this.timeToMinutes(startTime)
    
    for (let minute = startMinutes; minute < startMinutes + duration; minute++) {
      const current = this.occupancy.get(minute) || 0
      this.occupancy.set(minute, current + 1)
    }
  }

  /**
   * Check if adding a patient would exceed chair capacity
   * ALSO checks if patient would finish BEFORE closing time (16:30)
   */
  public canAddPatient(startTime: string, duration: number): boolean {
    const startMinutes = this.timeToMinutes(startTime)
    const endMinutes = startMinutes + duration
    const closingTime = DEPARTMENT_CONFIG.END_MINUTES
    
    // Check if treatment would end AFTER closing time
    if (endMinutes > closingTime) {
      console.log(`⚠️ Patient starting at ${startTime} with ${duration}min would end at ${Math.floor(endMinutes/60)}:${String(endMinutes%60).padStart(2,'0')}, after closing (16:30)`)
      return false // Treatment would extend past closing time
    }
    
    for (let minute = startMinutes; minute < endMinutes; minute++) {
      const current = this.occupancy.get(minute) || 0
      if (current >= this.maxChairs) {
        return false // Would exceed capacity
      }
    }
    
    return true
  }

  /**
   * Get peak occupancy
   */
  public getPeakOccupancy(): number {
    return Math.max(...Array.from(this.occupancy.values()), 0)
  }

  /**
   * Get average occupancy
   */
  public getAverageOccupancy(): number {
    if (this.occupancy.size === 0) return 0
    const sum = Array.from(this.occupancy.values()).reduce((a, b) => a + b, 0)
    return sum / this.occupancy.size
  }

  /**
   * Get occupancy at specific time
   */
  public getOccupancyAt(timeString: string): number {
    const minutes = this.timeToMinutes(timeString)
    return this.occupancy.get(minutes) || 0
  }

  /**
   * Find the next available time slot that can fit a patient with given duration
   * Ensures patient finishes BEFORE closing time (16:30)
   */
  public findNextAvailableSlot(preferredStartTime: string, duration: number): string | null {
    const startMinutes = this.timeToMinutes(preferredStartTime)
    const closingTime = DEPARTMENT_CONFIG.END_MINUTES
    
    // Latest possible start time = closing time - duration
    const latestStart = closingTime - duration
    
    if (latestStart < startMinutes) {
      console.log(`⚠️ No slot found: patient needs ${duration}min but only ${Math.max(0, closingTime - startMinutes)}min left before closing`)
      return null // Not enough time left in the day
    }
    
    // Try every 15 minutes from preferred time until latest possible start
    for (let tryMinutes = startMinutes; tryMinutes <= latestStart; tryMinutes += 15) {
      let canFit = true
      
      for (let minute = tryMinutes; minute < tryMinutes + duration; minute++) {
        const current = this.occupancy.get(minute) || 0
        if (current >= this.maxChairs) {
          canFit = false
          break
        }
      }
      
      if (canFit) {
        const hours = Math.floor(tryMinutes / 60)
        const mins = tryMinutes % 60
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
      }
    }
    
    return null // No available slot found
  }
}
