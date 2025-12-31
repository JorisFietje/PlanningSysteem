import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET single patient
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const patient = await prisma.patient.findUnique({
      where: { id: params.id },
      include: {
        actions: {
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    })

    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(patient)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch patient' },
      { status: 500 }
    )
  }
}

// PUT update patient
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { startTime, medicationType, treatmentNumber, noShow, lateCancellation, medicationDiscarded } = body

    const updateData: any = {}
    if (startTime) updateData.startTime = startTime
    if (medicationType) updateData.medicationType = medicationType
    if (treatmentNumber !== undefined) updateData.treatmentNumber = treatmentNumber
    if (noShow !== undefined) updateData.noShow = Boolean(noShow)
    if (lateCancellation !== undefined) updateData.lateCancellation = Boolean(lateCancellation)
    if (medicationDiscarded !== undefined) updateData.medicationDiscarded = Boolean(medicationDiscarded)

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'At least one field is required' },
        { status: 400 }
      )
    }

    const patient = await prisma.patient.update({
      where: { id: params.id },
      data: updateData,
      include: {
        actions: {
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    })

    return NextResponse.json(patient)
  } catch (error) {
    console.error('Failed to update patient:', error)
    return NextResponse.json(
      { error: 'Failed to update patient' },
      { status: 500 }
    )
  }
}

// DELETE single patient
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.patient.delete({
      where: { id: params.id }
    })
    return NextResponse.json({ message: 'Patient deleted' })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete patient' },
      { status: 500 }
    )
  }
}
