import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { weekStartDate, weekEndDate, dayOfWeek, staff, coordinator } = body

    if (!weekStartDate || !dayOfWeek) {
      return NextResponse.json(
        { error: 'weekStartDate and dayOfWeek are required' },
        { status: 400 }
      )
    }

    let weekPlan = await prisma.weekPlan.findUnique({
      where: { weekStartDate }
    })

    if (!weekPlan) {
      if (!weekEndDate) {
        return NextResponse.json(
          { error: 'weekEndDate is required when creating a new week plan' },
          { status: 400 }
        )
      }
      weekPlan = await prisma.weekPlan.create({
        data: {
          weekStartDate,
          weekEndDate
        }
      })
    }

    const staffNames = JSON.stringify({
      staff: Array.isArray(staff) ? staff : [],
      coordinator: coordinator || null
    })

    const updated = await prisma.weekStaffSchedule.upsert({
      where: {
        weekPlanId_dayOfWeek: {
          weekPlanId: weekPlan.id,
          dayOfWeek
        }
      },
      update: {
        staffNames
      },
      create: {
        weekPlanId: weekPlan.id,
        dayOfWeek,
        staffNames
      }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Failed to update week staff schedule:', error)
    return NextResponse.json(
      { error: 'Failed to update week staff schedule' },
      { status: 500 }
    )
  }
}
