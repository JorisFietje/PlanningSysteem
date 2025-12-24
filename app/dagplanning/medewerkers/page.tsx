'use client'

import { useMemo } from 'react'
import { useDagplanningContext } from '../layout'
import { getDayOfWeekFromDate, getMondayOfWeek } from '@/types'
import StaffTimeline from '@/components/staff/StaffTimeline'
import { buildScheduleFromWorkDays } from '@/utils/staff/workDays'
import { buildRampOccurrenceCounts, getRampValuesForOccurrence, loadRampSchedules } from '@/utils/staff/rampSchedules'

export default function MedewerkersPage() {
  const {
    selectedDate,
    patients,
    staffMembers,
    staffSchedule,
  } = useDagplanningContext()

  const day = getDayOfWeekFromDate(selectedDate)
  const names = staffSchedule[day]
  const rampSchedules = useMemo(() => loadRampSchedules(), [])
  const defaultSchedule = useMemo(() => buildScheduleFromWorkDays(staffMembers), [staffMembers])
  const scheduleByWeekStart = useMemo(() => {
    const weekStart = getMondayOfWeek(selectedDate)
    return {
      [weekStart]: staffSchedule
    }
  }, [selectedDate, staffSchedule])
  const rampOccurrencesByDate = useMemo(() => {
    if (!rampSchedules || Object.keys(rampSchedules).length === 0) return {}
    return buildRampOccurrenceCounts(rampSchedules, scheduleByWeekStart, defaultSchedule, selectedDate)
  }, [rampSchedules, scheduleByWeekStart, defaultSchedule, selectedDate])

  const adjustedStaffMembers = useMemo(() => {
    const occurrenceForDate = rampOccurrencesByDate[selectedDate] || {}
    return staffMembers.map(member => {
      const occurrence = occurrenceForDate[member.name]
      const ramp = rampSchedules[member.name]
      const rampValues = occurrence && ramp ? getRampValuesForOccurrence(ramp, occurrence) : null
      if (!rampValues?.endTime) return member
      const [endH, endM] = rampValues.endTime.split(':').map(Number)
      const endMinutes = (endH - 8) * 60 + endM
      return {
        ...member,
        maxWorkTime: Math.max(endMinutes, 0)
      }
    })
  }, [staffMembers, rampOccurrencesByDate, rampSchedules, selectedDate])

  return (
    <StaffTimeline
      patients={patients}
      selectedDate={selectedDate}
      staffMembers={(names && names.length > 0)
        ? adjustedStaffMembers.filter(s => names.includes(s.name))
        : adjustedStaffMembers}
    />
  )
}
