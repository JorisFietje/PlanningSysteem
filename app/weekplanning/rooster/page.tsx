'use client'

import { useWeekplanningContext } from '../layout'
import WeekStaffSchedule from '@/components/planning/WeekStaffSchedule'

export default function RoosterPage() {
  const {
    selectedWeekStart,
    staffSchedule,
    setStaffSchedule,
    staffMembers,
    coordinatorByDay,
    setCoordinatorByDay,
    getWeekDates,
  } = useWeekplanningContext()

  const weekDates = getWeekDates()

  return (
    <WeekStaffSchedule
      weekDates={weekDates}
      staffSchedule={staffSchedule}
      setStaffSchedule={setStaffSchedule}
      staffMembers={staffMembers}
      coordinatorByDay={coordinatorByDay}
      setCoordinatorByDay={setCoordinatorByDay}
    />
  )
}

