'use client'

import { Patient, WorkloadSlot, DayOfWeek, StaffMember, getDailyPatientCapacity } from '@/types'

interface StatisticsProps {
  patients: Patient[]
  workload: WorkloadSlot[]
  selectedDay: DayOfWeek
  staffMembers: StaffMember[]
}

export default function Statistics({ patients, workload, selectedDay, staffMembers }: StatisticsProps) {
  const totalActions = patients.reduce((sum, p) => sum + p.actions.filter(a => a.type !== 'infusion').length, 0)
  const capacity = getDailyPatientCapacity(selectedDay, staffMembers)
  const targetPatients = capacity.max

  let peakTime = '--:--'
  let maxConcurrent = 0

  if (workload.length > 0) {
    maxConcurrent = Math.max(...workload.map(w => w.count))
    const peakSlot = workload.find(w => w.count === maxConcurrent)
    if (peakSlot) {
      peakTime = peakSlot.time
    }
  }

  return (
    <div className="flex gap-6 text-white">
      <div className="flex items-center gap-2">
        <div className="bg-white/20 rounded-lg p-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <div>
          <div className="text-xs opacity-80">Patiënten</div>
          <div className="text-xl font-bold">{patients.length}/{targetPatients}</div>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <div className="bg-white/20 rounded-lg p-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
        <div>
          <div className="text-xs opacity-80">Handelingen</div>
          <div className="text-xl font-bold">{totalActions}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="bg-white/20 rounded-lg p-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <div className="text-xs opacity-80">Drukste Tijd</div>
          <div className="text-lg font-bold">{peakTime}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="bg-white/20 rounded-lg p-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        <div>
          <div className="text-xs opacity-80">Max Gelijktijdig</div>
          <div className="text-xl font-bold">{maxConcurrent}</div>
        </div>
      </div>
    </div>
  )
}

