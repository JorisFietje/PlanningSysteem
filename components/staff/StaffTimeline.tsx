'use client'

import { useMemo } from 'react'
import { Patient, DEPARTMENT_CONFIG, StaffMember, getDailyPatientCapacity, getDayOfWeekFromDate } from '@/types'
import { getMedicationById } from '@/types/medications'
import { calculateTotalTreatmentTime } from '@/utils/patients/actionGenerator'
import { StaffScheduler } from '@/utils/staff/staffAssignment'

interface StaffTimelineProps {
  patients: Patient[]
  selectedDate: string // YYYY-MM-DD format
  staffMembers: StaffMember[]
}

interface StaffActivity {
  staff: string
  startMinutes: number
  duration: number
  actionName: string
  patientName: string
  type: string
}

export default function StaffTimeline({ patients, selectedDate, staffMembers }: StaffTimelineProps) {
  const startMinutes = DEPARTMENT_CONFIG.START_MINUTES
  const endMinutes = DEPARTMENT_CONFIG.END_MINUTES
  const startHour = Math.floor(startMinutes / 60)
  const endHour = Math.floor(endMinutes / 60)
  const endMinuteRemainder = endMinutes % 60
  const totalMinutes = endMinutes - startMinutes

  // Get day of week from selected date
  const dayOfWeek = getDayOfWeekFromDate(selectedDate)

  // Availability komt vanuit het weekrooster; toon alle medewerkers
  const availableStaff = staffMembers

  // Calculate all activities
  const activities: StaffActivity[] = []
  
  // Build a temporary schedule for visualization using StaffScheduler
  // Rules: 
  // - Exclude: infusion, observation, cito/lab/urine (not modeled)
  // - Include: setup (aanbrengen), protocol_check, flush (only if no observation), pc_switch, removal
  // - First assign all setups respecting max patients; then assign other actions at their times
  // Use useMemo to prevent recreating scheduler on every render
  const scheduler = useMemo(
    () => new StaffScheduler(availableStaff, dayOfWeek, undefined, { suppressLogs: true }),
    [availableStaff, dayOfWeek]
  )
  
  patients.forEach(patient => {
    const [hours, minutes] = patient.startTime.split(':').map(Number)
    const patientStartMinutes = hours * 60 + minutes
    let currentMinutes = patientStartMinutes
    
    // Determine if there is any observation action for this patient
    const hasObservation = patient.actions.some(a => a.type === 'observation')
    
    // Track when infusion starts to position dependent actions that may specify offsets
    let infusionStartMinutes = 0
    let cumulativeMinutesForInfusion = 0
    patient.actions.forEach(a => {
      if (a.type === 'infusion') {
        infusionStartMinutes = patientStartMinutes + cumulativeMinutesForInfusion
      }
      cumulativeMinutesForInfusion += a.duration
    })
    
    const medication = getMedicationById(patient.medicationType)
    
    // We will keep reference to setup staff to exclude them from protocol_check
    let setupStaffForPatient: string | undefined
    
    // First pass: assign setup immediately when encountered (counts as patient)
    // Second pass continues inline for other actions using scheduler availability
    let checkCount = 0
    let pcSwitchCount = 0
    
    for (const action of patient.actions) {
      let startMinutesForAction = currentMinutes
      
      // Derive explicit times for actions with offsets relative to infusion start
      if ((action.type === 'pc_switch') && infusionStartMinutes > 0 && medication?.pcSwitchInterval) {
        pcSwitchCount++
        startMinutesForAction = infusionStartMinutes + (pcSwitchCount * medication.pcSwitchInterval)
      }
      
      // Exclusions
      if (action.type === 'infusion' || action.type === 'observation') {
        currentMinutes += action.duration
        continue
      }
      
      // 'check' does not count/show in this overview
      if (action.type === 'check') {
        currentMinutes += action.duration
        continue
      }
      
      // 'flush' only counts if there is no observation block
      if (action.type === 'flush' && hasObservation) {
        currentMinutes += action.duration
        continue
      }
      
      const actionStartHours = Math.floor(startMinutesForAction / 60)
      const actionStartMins = startMinutesForAction % 60
      const actionStartTime = `${actionStartHours.toString().padStart(2, '0')}:${actionStartMins.toString().padStart(2, '0')}`
      
      let assignedStaff: string | null = null
      let scheduledStartMinutes = startMinutesForAction
      const effectiveDuration = action.actualDuration || action.duration
      
      if (action.type === 'setup') {
        const assignment = scheduler.assignStaffForSetup(actionStartTime, action.duration)
        assignedStaff = assignment.staff
        const [ah, am] = assignment.actualStartTime.split(':').map(Number)
        scheduledStartMinutes = ah * 60 + am
        setupStaffForPatient = assignment.staff !== 'GEEN' ? assignment.staff : undefined
      } else if (action.type === 'protocol_check') {
        const assignment = scheduler.assignStaffForAction(action.type, effectiveDuration, actionStartTime, setupStaffForPatient)
        assignedStaff = assignment.staff
        const [ah, am] = assignment.actualStartTime.split(':').map(Number)
        scheduledStartMinutes = ah * 60 + am
      } else if (action.type === 'flush' || action.type === 'pc_switch' || action.type === 'removal') {
        const assignment = scheduler.assignStaffForAction(action.type, effectiveDuration, actionStartTime)
        assignedStaff = assignment.staff
        const [ah, am] = assignment.actualStartTime.split(':').map(Number)
        scheduledStartMinutes = ah * 60 + am
      }
      
      if (assignedStaff && assignedStaff !== 'GEEN') {
        const closingMinutes = endMinutes
        if (scheduledStartMinutes < closingMinutes) {
          activities.push({
            staff: assignedStaff,
            startMinutes: scheduledStartMinutes,
            duration: effectiveDuration,
            actionName: action.name,
            patientName: patient.name,
            type: action.type || 'other'
          })
        }
      }
      
      currentMinutes += action.duration
    }
  })

  // Group by staff member (only those working on selected day)
  const staffActivities: { [key: string]: StaffActivity[] } = {}
  availableStaff.forEach(staffMember => {
    staffActivities[staffMember.name] = activities
      .filter(a => a.staff === staffMember.name)
      .sort((a, b) => a.startMinutes - b.startMinutes)
  })

  // Calculate chair occupancy over time
  const calculateChairOccupancy = () => {
    const occupancy: { [key: number]: number } = {}
    
    patients.forEach(patient => {
      const [hours, minutes] = patient.startTime.split(':').map(Number)
      let currentMinutes = hours * 60 + minutes
      
      // Patient occupies chair for total duration
      const totalDuration = patient.actions.reduce((sum, action) => sum + action.duration, 0)
      
      for (let min = currentMinutes; min < currentMinutes + totalDuration; min++) {
        occupancy[min] = (occupancy[min] || 0) + 1
      }
    })
    
    return occupancy
  }

  const chairOccupancy = calculateChairOccupancy()

  // Calculate staff workload over time (how many unique nurses are busy at each minute)
  const calculateStaffWorkload = () => {
    const workload: { [key: number]: number } = {}
    
    // For each minute, count how many unique nurses are busy
    for (let minute = startMinutes; minute < endMinutes; minute++) {
      const busyNursesSet = new Set<string>()
      
      activities.forEach(activity => {
        if (minute >= activity.startMinutes && minute < activity.startMinutes + activity.duration) {
          busyNursesSet.add(activity.staff)
        }
      })
      
      workload[minute] = busyNursesSet.size
    }
    
    return workload
  }

  const staffWorkload = calculateStaffWorkload()
  const maxStaffWorkload = Math.max(...Object.values(staffWorkload), 0)
  const avgStaffWorkload = Object.values(staffWorkload).reduce((sum, val) => sum + val, 0) / Object.values(staffWorkload).length || 0
  const maxNurses = availableStaff.length

  const getActivityColor = (type: string) => {
    switch(type) {
      case 'setup': return 'bg-purple-700'
      case 'protocol_check': return 'bg-green-700' // Protocol / Spoelen in groen
      case 'removal': return 'bg-orange-600'
      case 'pc_switch': return 'bg-blue-500' // PC wissel in blauw
      case 'flush': return 'bg-green-700'
      case 'observation': return 'bg-green-500'
      default: return 'bg-slate-500'
    }
  }

  const getActivityBorder = (type: string) => {
    switch(type) {
      case 'setup': return 'border-purple-700'
      case 'protocol_check': return 'border-green-700'
      case 'removal': return 'border-orange-700'
      case 'pc_switch': return 'border-blue-600'
      case 'flush': return 'border-green-700'
      case 'observation': return 'border-green-600'
      default: return 'border-slate-600'
    }
  }

  const formatTime = (minutes: number) => {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  }

  if (availableStaff.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 h-full overflow-auto">
        <h2 className="text-xl font-bold text-slate-900">Medewerker Planning & Capaciteit</h2>
        <div className="text-center py-16">
          <svg className="w-16 h-16 mx-auto mb-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="text-lg font-semibold text-slate-900 mb-2">Geen verpleegkundigen beschikbaar</div>
          <div className="text-slate-500">Er zijn geen verpleegkundigen die op de geselecteerde dag werken.</div>
        </div>
      </div>
    )
  }

  if (patients.length === 0) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 h-full overflow-auto">
        <h2 className="text-xl font-bold text-slate-900">Medewerker Planning & Capaciteit</h2>
        <div className="text-center py-12 text-slate-500">Geen activiteiten gepland</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 h-full overflow-auto">
      <div className="flex items-center justify-between mb-3 pb-2 border-b">
        <h2 className="text-xl font-bold text-slate-900">Medewerker Planning & Capaciteit</h2>
        <div className="flex gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-purple-700 rounded"></div>
            <span>Aanbrengen</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-700 rounded"></div>
            <span>Protocol / Spoelen</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span>PC Wissel</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-orange-600 rounded"></div>
            <span>Afkoppelen</span>
          </div>
        </div>
      </div>

      {/* Staff Timelines - extra padding top for tooltips */}
      <div className="space-y-3 mb-4 pt-2">
        {availableStaff.map(staffMember => {
          const staffTasks = staffActivities[staffMember.name] || []
          const totalTime = staffTasks.reduce((sum, a) => sum + a.duration, 0)
          const uniquePatients = new Set(staffTasks.map(a => a.patientName)).size
          
          // Calculate workload percentage based on actual working time
          const staffWorkMinutes = staffMember.maxWorkTime 
            ? staffMember.maxWorkTime 
            : totalMinutes
          const workloadPercentage = ((totalTime / staffWorkMinutes) * 100).toFixed(1)
          
          const setupTasks = staffTasks.filter(a => a.type === 'setup').length
          const protocolCheckTasks = staffTasks.filter(a => a.type === 'protocol_check').length
          const checkTasks = staffTasks.filter(a => a.type === 'check').length
          const pcSwitchTasks = staffTasks.filter(a => a.type === 'pc_switch').length
          const removalTasks = staffTasks.filter(a => a.type === 'removal').length
          
          return (
            <div key={staffMember.name} className="border-2 border-slate-200 rounded-lg p-3 hover:border-blue-300 transition-colors overflow-visible relative" style={{ zIndex: 1 }}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    {staffMember.name}
                    <span className="text-[10px] text-slate-500 ml-1.5">
                      (max {staffMember.maxPatients} patiënten{staffMember.maxWorkTime ? `, tot ${Math.floor(staffMember.maxWorkTime / 60) + 8}:00` : ''})
                    </span>
                  </h3>
                  <div className="flex gap-3 text-[10px] text-slate-600 mt-0.5">
                    <span>{uniquePatients} patiënten</span>
                    <span>{staffTasks.length} taken</span>
                    <span>{totalTime} min ({workloadPercentage}%)</span>
                  </div>
                </div>
                <div className="flex gap-1.5 text-[10px] flex-wrap">
                  <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">{setupTasks}× aanbrengen</span>
                  <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{protocolCheckTasks}× protocol</span>
                  <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{checkTasks}× check</span>
                  {pcSwitchTasks > 0 && <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{pcSwitchTasks}× PC wissel</span>}
                  <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">{removalTasks}× afkoppelen</span>
                </div>
              </div>
              
              {staffTasks.length === 0 ? (
                <div className="text-xs text-slate-400 italic py-4 text-center bg-slate-50 rounded">Geen taken toegewezen</div>
              ) : (
                <>
                  {/* Compact timetable - colors only */}
                  <div className="mt-2 relative" style={{ zIndex: 1 }}>
                    <div className="relative bg-white rounded-lg border border-slate-200 shadow-sm overflow-visible" style={{ zIndex: 1 }}>
                      {/* Compact timeline header */}
                      <div className="relative h-8 bg-slate-50 border-b border-slate-200" style={{ zIndex: 1 }}>
                        <div className="absolute inset-0 flex">
                          {Array.from({ length: endHour - startHour }).map((_, i) => (
                            <div key={i} className="flex-1 border-r border-slate-200 relative">
                              <div className="absolute top-1 left-0 right-0 text-center">
                                <span className="text-[9px] font-semibold text-slate-600">{(startHour + i).toString().padStart(2, '0')}:00</span>
                              </div>
                            </div>
                          ))}
                          {endMinuteRemainder > 0 && (
                            <div className="flex-1 border-r border-slate-200 relative">
                              <div className="absolute top-1 left-0 right-0 text-center">
                                <span className="text-[9px] font-semibold text-slate-600">
                                  {endHour.toString().padStart(2, '0')}:{endMinuteRemainder.toString().padStart(2, '0')}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Main timeline area - smaller */}
                      <div className="relative h-10 bg-white overflow-visible" style={{ zIndex: 1 }}>
                        {/* Hour grid lines */}
                        <div className="absolute inset-0 flex">
                          {Array.from({ length: endHour - startHour }).map((_, i) => (
                            <div key={i} className="flex-1 border-r border-slate-200" />
                          ))}
                          {endMinuteRemainder > 0 && (
                            <div className="flex-1 border-r border-slate-200" />
                          )}
                        </div>
                        
                        {/* Gray overlay for non-working hours */}
                        {staffMember.maxWorkTime && (
                          <div 
                            className="absolute top-0 bottom-0 right-0 bg-slate-200 bg-opacity-25 border-l border-dashed border-slate-300"
                            style={{
                              left: `${(staffMember.maxWorkTime / totalMinutes) * 100}%`
                            }}
                          />
                        )}
                        
                        {/* Activity blocks - colors only, no text */}
                        {staffTasks.map((activity, idx) => {
                          const startOffset = ((activity.startMinutes - startMinutes) / totalMinutes) * 100
                          const width = (activity.duration / totalMinutes) * 100
                          
                          return (
                            <div
                              key={idx}
                              className={`absolute top-1 bottom-1 ${getActivityColor(activity.type)} ${getActivityBorder(activity.type)} border rounded transition-all cursor-pointer group hover:shadow-lg`}
                              style={{
                                left: `${startOffset}%`,
                                width: `${Math.max(width, 0.3)}%`,
                                zIndex: 10,
                              }}
                            >
                              {/* Tooltip only - no text in block */}
                              <div className="absolute hidden group-hover:block bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-slate-900 text-white px-3 py-2 rounded-lg text-xs whitespace-nowrap shadow-2xl border border-slate-700 pointer-events-none" style={{ zIndex: 999999 }}>
                                <div className="font-bold text-blue-300">{formatTime(activity.startMinutes)} - {formatTime(activity.startMinutes + activity.duration)}</div>
                                <div className="font-semibold mt-1">{activity.actionName}</div>
                                <div className="text-slate-300">{activity.patientName}</div>
                                <div className="text-slate-400 text-[10px] mt-1">Duur: {activity.duration} minuten</div>
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Workload bar */}
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-700 font-semibold min-w-[60px]">Werkdruk:</span>
                      <div className="flex-1 h-2.5 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                        <div 
                          className={`h-full transition-all ${parseFloat(workloadPercentage) > 75 ? 'bg-red-500' : parseFloat(workloadPercentage) > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                          style={{ width: `${workloadPercentage}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-700 min-w-[45px] text-right">{workloadPercentage}%</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Chair Occupancy Timeline */}
      <div className="border-t-2 border-slate-200 pt-3 mb-4">
        <h3 className="font-bold text-sm text-slate-900 mb-2">Stoelen Bezetting Over De Dag</h3>
        <div className="relative h-16 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg overflow-hidden border-2 border-slate-200">
          {/* Background grid */}
          <div className="absolute inset-0 flex">
            {Array.from({ length: endHour - startHour }).map((_, i) => (
              <div key={i} className="flex-1 border-r border-slate-300" />
            ))}
            {endMinuteRemainder > 0 && (
              <div className="flex-1 border-r border-slate-300" />
            )}
          </div>
          
          {/* Capacity line */}
          <div className="absolute inset-x-0 h-px bg-red-400 border-t-2 border-dashed border-red-500" 
               style={{ top: `${100 - (DEPARTMENT_CONFIG.TOTAL_CHAIRS / DEPARTMENT_CONFIG.TOTAL_CHAIRS * 100)}%` }} />
          <div className="absolute right-2 text-[10px] font-bold text-red-600" 
               style={{ top: `${100 - (DEPARTMENT_CONFIG.TOTAL_CHAIRS / DEPARTMENT_CONFIG.TOTAL_CHAIRS * 100)}%` }}>
            Max: {DEPARTMENT_CONFIG.TOTAL_CHAIRS} stoelen
          </div>
          
          {/* Occupancy bars */}
          {Object.entries(chairOccupancy).map(([minute, count]) => {
            const minuteNum = parseInt(minute)
            const xPos = ((minuteNum - startMinutes) / totalMinutes) * 100
            const height = (count / DEPARTMENT_CONFIG.TOTAL_CHAIRS) * 100
            const isOverCapacity = count > DEPARTMENT_CONFIG.TOTAL_CHAIRS
            
            return (
              <div
                key={minute}
                className={`absolute bottom-0 w-[0.5%] ${isOverCapacity ? 'bg-red-500' : count > DEPARTMENT_CONFIG.TOTAL_CHAIRS * 0.8 ? 'bg-yellow-500' : 'bg-green-500'} opacity-70 hover:opacity-100 transition-opacity`}
                style={{
                  left: `${xPos}%`,
                  height: `${Math.min(height, 100)}%`,
                }}
                title={`${formatTime(minuteNum)}: ${count} stoelen bezet`}
              />
            )
          })}
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 mt-1 px-1">
          {Array.from({ length: endHour - startHour + 1 }).map((_, i) => (
            <span key={i}>{(startHour + i).toString().padStart(2, '0')}:00</span>
          ))}
          {endMinuteRemainder > 0 && (
            <span>{endHour.toString().padStart(2, '0')}:{endMinuteRemainder.toString().padStart(2, '0')}</span>
          )}
        </div>
        <div className="flex justify-center gap-3 mt-2 text-[10px]">
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 bg-green-500 rounded"></div>
            <span>Normaal (&lt;80%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 bg-yellow-500 rounded"></div>
            <span>Druk (80-100%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 bg-red-500 rounded"></div>
            <span>Over capaciteit (&gt;100%)</span>
          </div>
        </div>
      </div>

      {/* Staff Workload Timeline */}
      <div className="border-t-2 border-slate-200 pt-3 mb-4">
        <h3 className="font-bold text-sm text-slate-900 mb-2">Werkdruk Verpleegkundigen Over De Dag</h3>
        <div className="relative h-16 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg overflow-hidden border-2 border-slate-200">
          {/* Background grid */}
          <div className="absolute inset-0 flex">
            {Array.from({ length: endHour - startHour }).map((_, i) => (
              <div key={i} className="flex-1 border-r border-slate-300" />
            ))}
            {endMinuteRemainder > 0 && (
              <div className="flex-1 border-r border-slate-300" />
            )}
          </div>
          
          {/* Capacity line */}
          <div className="absolute inset-x-0 h-px bg-red-400 border-t-2 border-dashed border-red-500" 
               style={{ top: `${100 - (maxNurses / maxNurses * 100)}%` }} />
          <div className="absolute right-2 text-[10px] font-bold text-red-600" 
               style={{ top: `${100 - (maxNurses / maxNurses * 100)}%` }}>
            Max: {maxNurses} verpleegkundigen
          </div>
          
          {/* Workload bars */}
          {Object.entries(staffWorkload).map(([minute, count]) => {
            const minuteNum = parseInt(minute)
            const xPos = ((minuteNum - startMinutes) / totalMinutes) * 100
            const height = (count / maxNurses) * 100
            const isOverCapacity = count > maxNurses
            const percentage = (count / maxNurses) * 100
            
            return (
              <div
                key={minute}
                className={`absolute bottom-0 w-[0.5%] ${isOverCapacity ? 'bg-red-500' : percentage > 80 ? 'bg-yellow-500' : 'bg-green-500'} opacity-70 hover:opacity-100 transition-opacity`}
                style={{
                  left: `${xPos}%`,
                  height: `${Math.min(height, 100)}%`,
                }}
                title={`${formatTime(minuteNum)}: ${count} verpleegkundigen bezig`}
              />
            )
          })}
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 mt-1 px-1">
          {Array.from({ length: endHour - startHour + 1 }).map((_, i) => (
            <span key={i}>{(startHour + i).toString().padStart(2, '0')}:00</span>
          ))}
          {endMinuteRemainder > 0 && (
            <span>{endHour.toString().padStart(2, '0')}:{endMinuteRemainder.toString().padStart(2, '0')}</span>
          )}
        </div>
        <div className="flex justify-center gap-3 mt-2 text-[10px]">
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 bg-green-500 rounded"></div>
            <span>Normaal (&lt;80%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 bg-yellow-500 rounded"></div>
            <span>Druk (80-100%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 bg-red-500 rounded"></div>
            <span>Over capaciteit (&gt;100%)</span>
          </div>
        </div>
      </div>

    </div>
  )
}
