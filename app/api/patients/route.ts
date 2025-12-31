import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET all patients (optionally filtered by date)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') // Optional: YYYY-MM-DD format
    
    const patients = await prisma.patient.findMany({
      where: date ? {
        scheduledDate: date
      } : undefined,
      include: {
        actions: {
          orderBy: {
            createdAt: 'asc'
          }
        }
      },
      orderBy: {
        startTime: 'asc'
      }
    })
    return NextResponse.json(patients)
  } catch (error) {
    console.error('Failed to fetch patients:', error)
    return NextResponse.json(
      { error: 'Failed to fetch patients' },
      { status: 500 }
    )
  }
}

// POST create new patient
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      startTime,
      scheduledDate,
      medicationType,
      treatmentNumber,
      noShow,
      lateCancellation,
      medicationDiscarded
    } = body

    if (!name || !startTime || !scheduledDate || !medicationType) {
      return NextResponse.json(
        { error: 'Name, start time, scheduled date, and medication type are required' },
        { status: 400 }
      )
    }

    const patient = await prisma.patient.create({
      data: {
        name,
        startTime,
        scheduledDate, // YYYY-MM-DD format
        medicationType,
        treatmentNumber: treatmentNumber || 1,
        noShow: Boolean(noShow),
        lateCancellation: Boolean(lateCancellation),
        medicationDiscarded: Boolean(medicationDiscarded)
      },
      include: {
        actions: true
      }
    })

    return NextResponse.json(patient, { status: 201 })
  } catch (error) {
    console.error('Error creating patient:', error)
    return NextResponse.json(
      { error: 'Failed to create patient' },
      { status: 500 }
    )
  }
}

// DELETE all patients (optionally filtered by date)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') // Optional: YYYY-MM-DD format
    
    const result = await prisma.patient.deleteMany({
      where: date ? {
        scheduledDate: date
      } : undefined
    })
    
    return NextResponse.json({ 
      message: date ? `Deleted ${result.count} patients for ${date}` : `Deleted ${result.count} patients`
    })
  } catch (error) {
    console.error('Failed to delete patients:', error)
    return NextResponse.json(
      { error: 'Failed to delete patients' },
      { status: 500 }
    )
  }
}
