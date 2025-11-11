'use client'

import { useDagplanningContext } from '../layout'
import { getDayOfWeekFromDate } from '@/types'
import StaffTimeline from '@/components/staff/StaffTimeline'

export default function MedewerkersPage() {
  const {
    selectedDate,
    patients,
    staffMembers,
    staffSchedule,
  } = useDagplanningContext()

  const day = getDayOfWeekFromDate(selectedDate)
  const names = staffSchedule[day]

  return (
    <StaffTimeline
      patients={patients}
      selectedDate={selectedDate}
      staffMembers={(names && names.length > 0)
        ? staffMembers.filter(s => names.includes(s.name))
        : staffMembers}
    />
  )
}

