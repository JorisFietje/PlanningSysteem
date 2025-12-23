import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const weekStart = searchParams.get('weekStart')

    if (!weekStart) {
      return NextResponse.json(
        { error: 'weekStart parameter is required (YYYY-MM-DD)' },
        { status: 400 }
      )
    }

    const weekPlan = await prisma.weekPlan.findUnique({
      where: { weekStartDate: weekStart },
      include: {
        dayCapacities: {
          orderBy: { date: 'asc' }
        }
      }
    })

    return NextResponse.json(weekPlan?.dayCapacities || [])
  } catch (error) {
    console.error('Failed to fetch day capacities:', error)
    return NextResponse.json(
      { error: 'Failed to fetch day capacities' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { weekStartDate, date, plannedPatients, agreedMaxPatients, note, sennaNote } = body

    if (!weekStartDate || !date) {
      return NextResponse.json(
        { error: 'weekStartDate and date are required' },
        { status: 400 }
      )
    }

    const weekPlan = await prisma.weekPlan.findUnique({
      where: { weekStartDate }
    })

    if (!weekPlan) {
      return NextResponse.json(
        { error: 'Week plan not found' },
        { status: 404 }
      )
    }

    const updated = await prisma.weekDayCapacity.upsert({
      where: {
        weekPlanId_date: {
          weekPlanId: weekPlan.id,
          date
        }
      },
      update: {
        plannedPatients: plannedPatients ?? null,
        agreedMaxPatients: agreedMaxPatients ?? null,
        note: note ?? null,
        sennaNote: sennaNote ?? null
      },
      create: {
        weekPlanId: weekPlan.id,
        date,
        plannedPatients: plannedPatients ?? null,
        agreedMaxPatients: agreedMaxPatients ?? null,
        note: note ?? null,
        sennaNote: sennaNote ?? null
      }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Failed to update day capacity:', error)
    return NextResponse.json(
      { error: 'Failed to update day capacity' },
      { status: 500 }
    )
  }
}
