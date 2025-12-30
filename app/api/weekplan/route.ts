import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET week plan by week start date
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
      where: {
        weekStartDate: weekStart
      },
      include: {
        staffSchedules: {
          orderBy: {
            dayOfWeek: 'asc'
          }
        },
        treatments: {
          orderBy: {
            createdAt: 'asc'
          }
        },
        dayCapacities: {
          orderBy: {
            date: 'asc'
          }
        }
      }
    })

    if (!weekPlan) {
      return NextResponse.json(null)
    }

    return NextResponse.json(weekPlan)
  } catch (error) {
    console.error('Failed to fetch week plan:', error)
    return NextResponse.json(
      { error: 'Failed to fetch week plan' },
      { status: 500 }
    )
  }
}

// POST create or update week plan
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { weekStartDate, weekEndDate, staffSchedules, treatments } = body

    const normalizedStaffSchedules = Array.isArray(staffSchedules)
      ? Array.from(
          staffSchedules.reduce((map: Map<string, any>, entry: any) => {
            if (!entry?.dayOfWeek) return map
            map.set(entry.dayOfWeek, entry)
            return map
          }, new Map()).values()
        )
      : []

    if (!weekStartDate || !weekEndDate) {
      return NextResponse.json(
        { error: 'weekStartDate and weekEndDate are required' },
        { status: 400 }
      )
    }

    // Check if week plan already exists
    const existing = await prisma.weekPlan.findUnique({
      where: { weekStartDate }
    })

    if (existing) {
      // Update existing week plan
      // Delete old treatments (staff schedules handled in nested update)
      await prisma.weekTreatment.deleteMany({
        where: { weekPlanId: existing.id }
      })

      // Update week plan
      const weekPlan = await prisma.weekPlan.update({
        where: { id: existing.id },
        data: {
          weekEndDate,
          staffSchedules: {
            deleteMany: {},
            createMany: {
              data: normalizedStaffSchedules.map((s: any) => ({
                dayOfWeek: s.dayOfWeek,
                staffNames: s.staffNames
              })),
              skipDuplicates: true
            }
          },
          treatments: {
            create: treatments?.map((t: any) => ({
              medicationId: t.medicationId,
              treatmentNumber: t.treatmentNumber,
              quantity: t.quantity
            })) || []
          }
        },
        include: {
          staffSchedules: true,
          treatments: true
        }
      })

      return NextResponse.json(weekPlan, { status: 200 })
    } else {
      // Create new week plan
      const weekPlan = await prisma.weekPlan.create({
        data: {
          weekStartDate,
          weekEndDate,
          staffSchedules: {
            create: normalizedStaffSchedules.map((s: any) => ({
              dayOfWeek: s.dayOfWeek,
              staffNames: s.staffNames
            }))
          },
          treatments: {
            create: treatments?.map((t: any) => ({
              medicationId: t.medicationId,
              treatmentNumber: t.treatmentNumber,
              quantity: t.quantity
            })) || []
          }
        },
        include: {
          staffSchedules: true,
          treatments: true
        }
      })

      return NextResponse.json(weekPlan, { status: 201 })
    }
  } catch (error) {
    console.error('Failed to save week plan:', error)
    return NextResponse.json(
      { error: 'Failed to save week plan' },
      { status: 500 }
    )
  }
}

// PUT update week plan (for generatedPatients)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { weekStartDate, generatedPatients } = body

    if (!weekStartDate) {
      return NextResponse.json(
        { error: 'weekStartDate is required' },
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

    const updated = await prisma.weekPlan.update({
      where: { id: weekPlan.id },
      data: {
        generatedPatients: generatedPatients || weekPlan.generatedPatients
      }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Failed to update week plan:', error)
    return NextResponse.json(
      { error: 'Failed to update week plan' },
      { status: 500 }
    )
  }
}
