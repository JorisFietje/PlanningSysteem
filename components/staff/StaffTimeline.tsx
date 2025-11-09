'use client'

import { Patient, DEPARTMENT_CONFIG, StaffMember, getDailyPatientCapacity, getDayOfWeekFromDate } from '@/types'
import { getMedicationById } from '@/types/medications'
import { calculateTotalTreatmentTime } from '@/utils/patients/actionGenerator'

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
  const startHour = DEPARTMENT_CONFIG.START_HOUR
  const endHour = DEPARTMENT_CONFIG.END_HOUR
  const totalMinutes = (endHour - startHour) * 60

  // Get day of week from selected date
  const dayOfWeek = getDayOfWeekFromDate(selectedDate)

  // Filter staff members who work on selected day (or have no workDays set)
  const availableStaff = staffMembers.filter(s => s.workDays.length === 0 || s.workDays.includes(dayOfWeek))

  // Calculate all activities
  const activities: StaffActivity[] = []
  
  patients.forEach(patient => {
    const [hours, minutes] = patient.startTime.split(':').map(Number)
    const patientStartMinutes = hours * 60 + minutes
    let currentMinutes = patientStartMinutes
    
    // Find when infusion starts (after setup + protocol check)
    let infusionStartMinutes = 0
    let cumulativeMinutes = 0
    patient.actions.forEach(action => {
      if (action.type === 'infusion') {
        infusionStartMinutes = patientStartMinutes + cumulativeMinutes
      }
      cumulativeMinutes += action.duration
    })
    
    // Get medication info for check/PC switch intervals
    const medication = getMedicationById(patient.medicationType)
    
    // Calculate actual start times for each action
    currentMinutes = patientStartMinutes
    let checkCount = 0
    let pcSwitchCount = 0
    
    patient.actions.forEach(action => {
      // Only track actions with staff assigned (not 'Systeem' or 'Geen')
      // 'Systeem' = infusion (automated), 'Geen' = observation (patient waits alone)
      if (action.staff && action.staff !== 'Systeem' && action.staff !== 'Geen') {
        let actualStartMinutes = currentMinutes
        
        // For checks and PC switches: calculate start time from infusion start + offset
        if (action.type === 'check' && infusionStartMinutes > 0 && medication?.checkInterval) {
          checkCount++
          actualStartMinutes = infusionStartMinutes + (checkCount * medication.checkInterval)
        } else if (action.type === 'pc_switch' && infusionStartMinutes > 0 && medication?.pcSwitchInterval) {
          pcSwitchCount++
          actualStartMinutes = infusionStartMinutes + (pcSwitchCount * medication.pcSwitchInterval)
        }
        
        // For checks and PC switches, use actualDuration for staff workload
        const staffWorkDuration = action.actualDuration || action.duration
        
        // Only add activities that start before closing time
        const closingMinutes = endHour * 60
        if (actualStartMinutes < closingMinutes) {
          activities.push({
            staff: action.staff,
            startMinutes: actualStartMinutes,
            duration: staffWorkDuration,
            actionName: action.name,
            patientName: patient.name,
            type: action.type || 'other'
          })
        } else {
          console.warn(`⚠️ Activity ${action.name} for ${patient.name} starts at ${Math.floor(actualStartMinutes/60)}:${String(actualStartMinutes%60).padStart(2,'0')}, after closing time (${endHour}:00)`)
        }
      }
      currentMinutes += action.duration
    })
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
  const maxChairOccupancy = Math.max(...Object.values(chairOccupancy), 0)
  const avgChairOccupancy = Object.values(chairOccupancy).reduce((sum, val) => sum + val, 0) / Object.values(chairOccupancy).length || 0

  // Calculate staff workload over time (how many unique nurses are busy at each minute)
  const calculateStaffWorkload = () => {
    const workload: { [key: number]: number } = {}
    
    // For each minute, count how many unique nurses are busy
    for (let minute = startHour * 60; minute < endHour * 60; minute++) {
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
      case 'setup': return 'bg-purple-600'
      case 'protocol_check': return 'bg-green-600' // Protocol check by 2nd nurse
      case 'removal': return 'bg-orange-600'
      case 'check': return 'bg-blue-500'
      case 'pc_switch': return 'bg-red-500' // PC wisselen voor bloedtransfusies
      case 'observation': return 'bg-green-500'
      case 'flush': return 'bg-cyan-500'
      default: return 'bg-slate-500'
    }
  }

  const getActivityBorder = (type: string) => {
    switch(type) {
      case 'setup': return 'border-purple-700'
      case 'protocol_check': return 'border-green-700'
      case 'removal': return 'border-orange-700'
      case 'check': return 'border-blue-600'
      case 'pc_switch': return 'border-red-600' // PC wisselen
      case 'observation': return 'border-green-600'
      case 'flush': return 'border-cyan-600'
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
        <h2 className="text-xl font-bold mb-6 text-slate-900 border-b pb-3">Medewerker Planning & Capaciteit</h2>
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
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 h-full overflow-auto">
        <h2 className="text-xl font-bold mb-6 text-slate-900 border-b pb-3">Medewerker Planning & Capaciteit</h2>
        <div className="text-center py-16 text-slate-500">Geen activiteiten gepland</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 h-full overflow-auto">
      <div className="flex items-center justify-between mb-6 pb-3 border-b">
        <h2 className="text-xl font-bold text-slate-900">Medewerker Planning & Capaciteit</h2>
        <div className="flex gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-purple-600 rounded"></div>
            <span>Aanbrengen</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-600 rounded"></div>
            <span>Protocol Check</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span>Check</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span>PC Wissel</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-orange-600 rounded"></div>
            <span>Afkoppelen</span>
          </div>
        </div>
      </div>

      {/* Department Statistics */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-xs text-blue-600 font-medium mb-1">Totaal Patiënten</div>
          <div className="text-2xl font-bold text-blue-900">{patients.length}</div>
          <div className="text-xs text-blue-600">doel: {getDailyPatientCapacity(dayOfWeek, staffMembers).min}-{getDailyPatientCapacity(dayOfWeek, staffMembers).max}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="text-xs text-green-600 font-medium mb-1">Stoelen Bezetting</div>
          <div className="text-2xl font-bold text-green-900">{maxChairOccupancy}/{DEPARTMENT_CONFIG.TOTAL_CHAIRS}</div>
          <div className="text-xs text-green-600">Ø {avgChairOccupancy.toFixed(1)} stoelen</div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <div className="text-xs text-purple-600 font-medium mb-1">Verpleegkundigen</div>
          <div className="text-2xl font-bold text-purple-900">{availableStaff.length}</div>
          <div className="text-xs text-purple-600">totaal capaciteit: {getDailyPatientCapacity(dayOfWeek, staffMembers).total}</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <div className="text-xs text-orange-600 font-medium mb-1">Totaal Activiteiten</div>
          <div className="text-2xl font-bold text-orange-900">{activities.length}</div>
          <div className="text-xs text-orange-600">{availableStaff.length > 0 ? (activities.length / availableStaff.length).toFixed(0) : '0'} per VPK</div>
        </div>
      </div>

      {/* Staff Timelines - extra padding top for tooltips */}
      <div className="space-y-4 mb-6 pt-4">
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
            <div key={staffMember.name} className="border-2 border-slate-200 rounded-lg p-4 hover:border-blue-300 transition-colors overflow-visible">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    {staffMember.name}
                    <span className="text-xs text-slate-500 ml-2">
                      (max {staffMember.maxPatients} patiënten{staffMember.maxWorkTime ? `, tot ${Math.floor(staffMember.maxWorkTime / 60) + 8}:00` : ''})
                    </span>
                  </h3>
                  <div className="flex gap-4 text-xs text-slate-600 mt-1">
                    <span>{uniquePatients}/{staffMember.maxPatients} patiënten</span>
                    <span>{staffTasks.length} taken</span>
                    <span>{totalTime} min ({workloadPercentage}%)</span>
                  </div>
                </div>
                <div className="flex gap-2 text-xs flex-wrap">
                  <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded">{setupTasks}× aanbrengen</span>
                  <span className="bg-green-100 text-green-700 px-2 py-1 rounded">{protocolCheckTasks}× protocol</span>
                  <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">{checkTasks}× check</span>
                  {pcSwitchTasks > 0 && <span className="bg-red-100 text-red-700 px-2 py-1 rounded">{pcSwitchTasks}× PC wissel</span>}
                  <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded">{removalTasks}× afkoppelen</span>
                </div>
              </div>
              
              {staffTasks.length === 0 ? (
                <div className="text-xs text-slate-400 italic py-4 text-center bg-slate-50 rounded">Geen taken toegewezen</div>
              ) : (
                <>
                  <div className="relative h-16 bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg overflow-visible border border-slate-200">
                    {/* Timeline background with hour markers */}
                    <div className="absolute inset-0 flex">
                      {Array.from({ length: endHour - startHour }).map((_, i) => (
                        <div key={i} className="flex-1 border-r border-slate-300" />
                      ))}
                    </div>
                    
                    {/* Gray overlay for non-working hours */}
                    {staffMember.maxWorkTime && (
                      <div 
                        className="absolute top-0 bottom-0 right-0 bg-slate-400 bg-opacity-30 border-l-2 border-dashed border-slate-500"
                        style={{
                          left: `${(staffMember.maxWorkTime / totalMinutes) * 100}%`
                        }}
                      >
                        <div className="absolute top-1/2 left-2 -translate-y-1/2 text-[10px] font-bold text-slate-700 bg-white px-1 rounded">
                          Eindtijd {Math.floor(staffMember.maxWorkTime / 60) + startHour}:00
                        </div>
                      </div>
                    )}
                    
                    {/* Activity blocks */}
                    {staffTasks.map((activity, idx) => {
                      const startOffset = ((activity.startMinutes - (startHour * 60)) / totalMinutes) * 100
                      const width = (activity.duration / totalMinutes) * 100
                      
                      return (
                        <div
                          key={idx}
                          className={`absolute top-2 bottom-2 ${getActivityColor(activity.type)} ${getActivityBorder(activity.type)} border-2 rounded-md shadow hover:shadow-lg transition-all cursor-pointer group z-10 hover:z-[9999] hover:scale-y-110`}
                          style={{
                            left: `${startOffset}%`,
                            width: `${Math.max(width, 0.5)}%`,
                          }}
                        >
                          {width > 2 && (
                            <div className="absolute inset-0 flex items-center justify-center text-[9px] text-white font-bold truncate px-0.5">
                              {activity.actionName.includes('Aanbrengen') ? '→' : 
                               activity.actionName.includes('Afkoppelen') ? '←' :
                               activity.actionName.includes('Check') ? 'C' :
                               activity.actionName.includes('PC Wisselen') ? '↻' : ''}
                            </div>
                          )}
                          
                          {/* Enhanced Tooltip - now with very high z-index */}
                          <div className="absolute hidden group-hover:block bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-slate-900 text-white px-3 py-2 rounded-lg text-xs whitespace-nowrap shadow-2xl border border-slate-700" style={{ zIndex: 99999 }}>
                            <div className="font-bold text-blue-300">{formatTime(activity.startMinutes)} - {formatTime(activity.startMinutes + activity.duration)}</div>
                            <div className="font-semibold mt-1">{activity.actionName}</div>
                            <div className="text-slate-300">{activity.patientName}</div>
                            <div className="text-slate-400 text-[10px] mt-1">Duur: {activity.duration} minuten</div>
                            {/* Arrow */}
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  
                  {/* Time markers */}
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1 px-1">
                    {Array.from({ length: endHour - startHour + 1 }).map((_, i) => (
                      <span key={i}>{(startHour + i).toString().padStart(2, '0')}:00</span>
                    ))}
                  </div>

                  {/* Workload bar */}
                  <div className="mt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600 font-medium">Werkdruk:</span>
                      <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${parseFloat(workloadPercentage) > 75 ? 'bg-red-500' : parseFloat(workloadPercentage) > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                          style={{ width: `${workloadPercentage}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-slate-700">{workloadPercentage}%</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Chair Occupancy Timeline */}
      <div className="border-t-2 border-slate-200 pt-4 mb-6">
        <h3 className="font-bold text-base text-slate-900 mb-3">Stoelen Bezetting Over De Dag</h3>
        <div className="relative h-24 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg overflow-hidden border-2 border-slate-200">
          {/* Background grid */}
          <div className="absolute inset-0 flex">
            {Array.from({ length: endHour - startHour }).map((_, i) => (
              <div key={i} className="flex-1 border-r border-slate-300" />
            ))}
          </div>
          
          {/* Capacity line */}
          <div className="absolute inset-x-0 h-px bg-red-400 border-t-2 border-dashed border-red-500" 
               style={{ top: `${100 - (DEPARTMENT_CONFIG.TOTAL_CHAIRS / DEPARTMENT_CONFIG.TOTAL_CHAIRS * 100)}%` }} />
          <div className="absolute right-2 text-xs font-bold text-red-600" 
               style={{ top: `${100 - (DEPARTMENT_CONFIG.TOTAL_CHAIRS / DEPARTMENT_CONFIG.TOTAL_CHAIRS * 100)}%` }}>
            Max: {DEPARTMENT_CONFIG.TOTAL_CHAIRS} stoelen
          </div>
          
          {/* Occupancy bars */}
          {Object.entries(chairOccupancy).map(([minute, count]) => {
            const minuteNum = parseInt(minute)
            const xPos = ((minuteNum - (startHour * 60)) / totalMinutes) * 100
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
        </div>
        <div className="flex justify-center gap-4 mt-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>Normaal (&lt;80%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-yellow-500 rounded"></div>
            <span>Druk (80-100%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span>Over capaciteit (&gt;100%)</span>
          </div>
        </div>
      </div>

      {/* Staff Workload Timeline */}
      <div className="border-t-2 border-slate-200 pt-4 mb-6">
        <h3 className="font-bold text-base text-slate-900 mb-3">Werkdruk Verpleegkundigen Over De Dag</h3>
        <div className="relative h-24 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg overflow-hidden border-2 border-slate-200">
          {/* Background grid */}
          <div className="absolute inset-0 flex">
            {Array.from({ length: endHour - startHour }).map((_, i) => (
              <div key={i} className="flex-1 border-r border-slate-300" />
            ))}
          </div>
          
          {/* Capacity line */}
          <div className="absolute inset-x-0 h-px bg-red-400 border-t-2 border-dashed border-red-500" 
               style={{ top: `${100 - (maxNurses / maxNurses * 100)}%` }} />
          <div className="absolute right-2 text-xs font-bold text-red-600" 
               style={{ top: `${100 - (maxNurses / maxNurses * 100)}%` }}>
            Max: {maxNurses} verpleegkundigen
          </div>
          
          {/* Workload bars */}
          {Object.entries(staffWorkload).map(([minute, count]) => {
            const minuteNum = parseInt(minute)
            const xPos = ((minuteNum - (startHour * 60)) / totalMinutes) * 100
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
        </div>
        <div className="flex justify-center gap-4 mt-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>Normaal (&lt;80%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-yellow-500 rounded"></div>
            <span>Druk (80-100%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span>Over capaciteit (&gt;100%)</span>
          </div>
        </div>
      </div>

      {/* Peak Times Analysis */}
      <div className="border-t-2 border-slate-200 pt-4">
        <h3 className="font-bold text-base text-slate-900 mb-3">Drukte Analyse</h3>
        {(() => {
          // Find peak chair occupancy times
          const peaks = Object.entries(chairOccupancy)
            .filter(([_, count]) => count >= DEPARTMENT_CONFIG.TOTAL_CHAIRS * 0.7)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([min, count]) => ({ 
              time: formatTime(parseInt(min)), 
              count,
              percentage: ((count / DEPARTMENT_CONFIG.TOTAL_CHAIRS) * 100).toFixed(0)
            }))
          
          if (peaks.length === 0) {
            return <div className="text-sm text-slate-500 bg-green-50 border border-green-200 rounded-lg p-3">Geen capaciteitsproblemen gedetecteerd</div>
          }
          
          return (
            <div className="grid grid-cols-4 gap-2">
              {peaks.map((peak, idx) => (
                <div 
                  key={idx} 
                  className={`${peak.count > DEPARTMENT_CONFIG.TOTAL_CHAIRS ? 'bg-red-50 border-red-300 text-red-900' : 'bg-yellow-50 border-yellow-300 text-yellow-900'} border-2 rounded-lg px-3 py-2 text-xs`}
                >
                  <div className="font-bold text-sm">{peak.time}</div>
                  <div className="font-semibold">{peak.count}/{DEPARTMENT_CONFIG.TOTAL_CHAIRS} stoelen</div>
                  <div className="text-[10px] opacity-75">{peak.percentage}% bezet</div>
                </div>
              ))}
            </div>
          )
        })()}
      </div>
    </div>
  )
}
