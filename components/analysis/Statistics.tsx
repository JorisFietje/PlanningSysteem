'use client'

import { useState, useEffect } from 'react'
import { Patient, WorkloadSlot, DayOfWeek, StaffMember, getDailyPatientCapacity, getDaycoPatientsCount } from '@/types'

interface StatisticsProps {
  patients: Patient[]
  workload: WorkloadSlot[]
  selectedDay: DayOfWeek
  staffMembers: StaffMember[]
  assignedStaffNames?: string[]
  coordinatorName?: string | null
  agreedMaxPatients?: number | null
}

export default function Statistics({
  patients,
  workload,
  selectedDay,
  staffMembers,
  assignedStaffNames,
  coordinatorName,
  agreedMaxPatients
}: StatisticsProps) {
  const [targetPatients, setTargetPatients] = useState<number>(0)
  
  useEffect(() => {
    if (typeof agreedMaxPatients === 'number') {
      setTargetPatients(agreedMaxPatients)
      return
    }
    if (assignedStaffNames && assignedStaffNames.length > 0) {
      const assigned = staffMembers.filter(s => assignedStaffNames.includes(s.name))
      const total = assigned.reduce((sum, s) => {
        const cap = coordinatorName && s.name === coordinatorName
          ? Math.min(getDaycoPatientsCount(), s.maxPatients)
          : s.maxPatients
        return sum + cap
      }, 0)
      setTargetPatients(total)
    } else {
      const capacity = getDailyPatientCapacity(selectedDay, staffMembers)
      setTargetPatients(capacity.max)
    }
  }, [selectedDay, staffMembers, assignedStaffNames, coordinatorName, agreedMaxPatients])
  
  const totalActions = patients.reduce((sum, p) => sum + p.actions.filter(a => a.type !== 'infusion').length, 0)

  const cards: Array<{ label: string; value: string; subValue?: string; icon: JSX.Element }> = [
    {
      label: 'Patiënten',
      value: `${patients.length}`,
      subValue: targetPatients > 0 ? `/${targetPatients}` : undefined,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    },
    {
      label: 'Handelingen',
      value: `${totalActions}`,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      )
    }
  ]

  return (
    <div className="flex flex-wrap items-center gap-2 text-white">
      {cards.map(({ label, value, subValue, icon }) => (
        <div
          key={label}
          className="flex items-center gap-2 bg-blue-500/30 text-white backdrop-blur rounded-lg px-3 py-1.5 border border-white/20 shadow-sm"
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-white/20">
            {icon}
          </div>
          <div className="leading-tight">
            <div className="text-[10px] uppercase tracking-wide text-white/80">{label}</div>
            <div className="text-base font-semibold">
              {value}
              {subValue && <span className="ml-1 text-xs font-normal text-white/70">{subValue}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
