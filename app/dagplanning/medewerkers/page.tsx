'use client'

import { useMemo } from 'react'
import { useDagplanningContext } from '../layout'
import { getDayOfWeekFromDate, getMondayOfWeek, getDepartmentHours } from '@/types'
import StaffTimeline from '@/components/staff/StaffTimeline'
import { buildScheduleFromWorkDays } from '@/utils/staff/workDays'
import { buildRampOccurrenceCounts, getRampValuesForOccurrence, loadRampSchedules } from '@/utils/staff/rampSchedules'
import DatePicker from '@/components/planning/DatePicker'

export default function MedewerkersPage() {
  const {
    selectedDate,
    setSelectedDate,
    patients,
    staffMembers,
    staffSchedule,
    coordinatorByDay,
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
    const { startMinutes } = getDepartmentHours()
    const occurrenceForDate = rampOccurrencesByDate[selectedDate] || {}
    return staffMembers.map(member => {
      const occurrence = occurrenceForDate[member.name]
      const ramp = rampSchedules[member.name]
      const rampValues = occurrence && ramp ? getRampValuesForOccurrence(ramp, occurrence) : null
      if (!rampValues?.endTime) return member
      const [endH, endM] = rampValues.endTime.split(':').map(Number)
      const endMinutes = (endH * 60 + endM) - startMinutes
      return {
        ...member,
        maxWorkTime: Math.max(endMinutes, 0)
      }
    })
  }, [staffMembers, rampOccurrencesByDate, rampSchedules, selectedDate])

  const coordinatorForDay = coordinatorByDay[day] || null
  const displayNames = coordinatorForDay && (!names || !names.includes(coordinatorForDay))
    ? [...(names || []), coordinatorForDay]
    : names
  const filteredStaff = (displayNames && displayNames.length > 0)
    ? displayNames
        .map(name => adjustedStaffMembers.find(member => member.name === name))
        .filter(Boolean)
    : []

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
      <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white flex items-center justify-end">
        <DatePicker
          value={selectedDate}
          onChange={setSelectedDate}
          staffMembers={staffMembers}
        />
      </div>
      <div className="flex-1">
        <StaffTimeline
          patients={patients}
          selectedDate={selectedDate}
          staffMembers={filteredStaff}
          coordinatorName={coordinatorForDay}
        />
      </div>
    </div>
  )
}
