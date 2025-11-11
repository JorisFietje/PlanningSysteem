import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DayOfWeek, getDayOfWeekFromDate, getMondayOfWeek } from '@/types'
import { optimizeDayPlanning } from '@/utils/planning/planningOptimizer'
import { generateActionsForMedication } from '@/utils/patients/actionGenerator'
import { StaffScheduler } from '@/utils/staff/staffAssignment'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { date } = body as { date?: string }

    if (!date) {
      return NextResponse.json({ error: 'date is required (YYYY-MM-DD)' }, { status: 400 })
    }

    const dayOfWeek: DayOfWeek = getDayOfWeekFromDate(date)
    const weekStart = getMondayOfWeek(date)

    // Load staff members
    const staffRows = await prisma.staff.findMany({ orderBy: { name: 'asc' } })
    const staffMembers = staffRows.map(s => ({
      name: s.name,
      maxPatients: s.maxPatients,
      maxWorkTime: s.maxWorkTime ?? undefined,
      workDays: []
    }))

    // Load week plan assignments for this day
    const weekPlan = await prisma.weekPlan.findUnique({
      where: { weekStartDate: weekStart },
      include: { staffSchedules: true }
    })

    const assignedNames: string[] =
      weekPlan?.staffSchedules
        ?.filter(s => s.dayOfWeek === dayOfWeek)
        .flatMap(s => {
          try {
            return JSON.parse(s.staffNames) as string[]
          } catch {
            return []
          }
        }) ?? []
    // Try to read coordinator from stored JSON object if present
    let coordinatorName: string | undefined
    const scheduleForDay = weekPlan?.staffSchedules?.find(s => s.dayOfWeek === dayOfWeek)
    if (scheduleForDay) {
      try {
        const parsed = JSON.parse(scheduleForDay.staffNames)
        if (parsed && typeof parsed === 'object' && parsed.coordinator) {
          coordinatorName = parsed.coordinator as string
        }
      } catch {}
    }

    // Load patients for this date (with actions)
    const patients = await prisma.patient.findMany({
      where: { scheduledDate: date },
      include: { actions: true },
      orderBy: { startTime: 'asc' }
    })

    if (patients.length === 0) {
      return NextResponse.json({ ok: true, moved: 0, message: 'Geen patiënten op deze datum' })
    }

    // Run optimizer with assigned staff for this date
    const result = await optimizeDayPlanning(
      patients as any,
      staffMembers as any,
      date,
      assignedNames,
      coordinatorName
    )

    // Apply updates
    let updatedCount = 0
    for (const p of patients) {
      const newStartTime = result.newStartTimes.get(p.id)
      if (!newStartTime || newStartTime === p.startTime) continue

      // Update start time
      await prisma.patient.update({
        where: { id: p.id },
        data: { startTime: newStartTime }
      })

      // Delete existing actions
      await prisma.action.deleteMany({ where: { patientId: p.id } })

      // Recreate actions using same logic as client
      const actions = generateActionsForMedication(p.medicationType, p.treatmentNumber)
      const availableStaff =
        assignedNames.length > 0
          ? staffMembers.filter(s => assignedNames.includes(s.name))
          : staffMembers
      const scheduler = new StaffScheduler(availableStaff as any, dayOfWeek, coordinatorName)

      const [hours, minutes] = newStartTime.split(':').map(Number)
      let patientStartMinutes = hours * 60 + minutes
      let cumulativeMinutes = 0
      let setupStaff: string | null = null
      let infusionStartMinutes = 0

      for (const action of actions) {
        if (action.type === 'infusion') {
          infusionStartMinutes = patientStartMinutes + cumulativeMinutes
        }

        let actionStartMinutes: number
        if ((action.type === 'check' || (action as any).type === 'pc_switch') && (action as any).checkOffset !== undefined) {
          actionStartMinutes = infusionStartMinutes + (action as any).checkOffset
        } else {
          actionStartMinutes = patientStartMinutes + cumulativeMinutes
        }

        const actionStartHours = Math.floor(actionStartMinutes / 60)
        const actionStartMins = actionStartMinutes % 60
        const actionStartTime = `${actionStartHours.toString().padStart(2, '0')}:${actionStartMins.toString().padStart(2, '0')}`

        // Assign staff for actions where applicable (same as client)
        if (action.type === 'setup') {
          const assignment = scheduler.assignStaffForSetup(actionStartTime, action.duration)
          setupStaff = assignment.staff
        } else if (action.type === 'protocol_check') {
          const duration = (action as any).actualDuration || action.duration
          scheduler.assignStaffForAction(action.type, duration, actionStartTime, setupStaff || undefined)
        } else if (action.type !== 'infusion' && action.type !== 'observation') {
          const duration = (action as any).actualDuration || action.duration
          scheduler.assignStaffForAction(action.type, duration, actionStartTime)
        }

        // Persist action
        await prisma.action.create({
          data: {
            name: action.name,
            duration: action.duration,
            type: (action as any).type ?? null,
            actualDuration: (action as any).actualDuration ?? null,
            staff: (action as any).staff ?? null,
            patientId: p.id
          }
        })

        cumulativeMinutes += action.duration
      }

      updatedCount++
    }

    return NextResponse.json({
      ok: true,
      moved: result.movedCount,
      updated: updatedCount,
      score: result.score
    })
  } catch (error) {
    console.error('Failed to rebalance day:', error)
    return NextResponse.json({ error: 'Failed to rebalance day' }, { status: 500 })
  }
}


