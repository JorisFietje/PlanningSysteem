import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET all actions
export async function GET() {
  try {
    const actions = await prisma.action.findMany({
      include: {
        patient: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    })
    return NextResponse.json(actions)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch actions' },
      { status: 500 }
    )
  }
}

// POST create new action
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, duration, staff, type, actualDuration, patientId } = body

    if (!name || duration === undefined || !patientId) {
      return NextResponse.json(
        { error: 'Name, duration, and patient ID are required' },
        { status: 400 }
      )
    }

    const action = await prisma.action.create({
      data: {
        name,
        duration: parseInt(duration),
        staff: staff || null,
        type: type || null,
        actualDuration: actualDuration ? parseInt(actualDuration) : null,
        patientId
      },
      include: {
        patient: true
      }
    })

    return NextResponse.json(action, { status: 201 })
  } catch (error) {
    console.error('Error creating action:', error)
    return NextResponse.json(
      { error: 'Failed to create action' },
      { status: 500 }
    )
  }
}

