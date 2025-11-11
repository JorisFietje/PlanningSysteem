import { NextRequest, NextResponse } from 'next/server'
import { DayOfWeek } from '@/types'
import { prisma } from '@/lib/prisma'

// PUT - Update a staff member
export async function PUT(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const decodedName = decodeURIComponent(params.name)
    const body = await request.json()
    const { name, maxPatients, maxWorkTime } = body

    if (!name || !maxPatients) {
      return NextResponse.json(
        { error: 'Naam en max patiënten zijn verplicht' },
        { status: 400 }
      )
    }

    // Check if staff member exists
    const existing = await prisma.staff.findUnique({
      where: { name: decodedName }
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Verpleegkundige niet gevonden' },
        { status: 404 }
      )
    }

    // If name changed, check if new name already exists
    if (name !== decodedName) {
      const nameExists = await prisma.staff.findUnique({
        where: { name }
      })

      if (nameExists) {
        return NextResponse.json(
          { error: 'Een verpleegkundige met deze naam bestaat al' },
          { status: 400 }
        )
      }
    }

    // Update or create new record if name changed
    let staff
    if (name !== decodedName) {
      // Delete old and create new
      await prisma.staff.delete({
        where: { name: decodedName }
      })
      staff = await prisma.staff.create({
        data: {
          name,
          maxPatients: parseInt(maxPatients),
          maxWorkTime: maxWorkTime ? parseInt(maxWorkTime) : null,
          workDays: null
        }
      })
    } else {
      // Update existing
      staff = await prisma.staff.update({
        where: { name: decodedName },
        data: {
          maxPatients: parseInt(maxPatients),
          maxWorkTime: maxWorkTime ? parseInt(maxWorkTime) : null,
          workDays: null
        }
      })
    }

    return NextResponse.json({
      name: staff.name,
      maxPatients: staff.maxPatients,
      maxWorkTime: staff.maxWorkTime || undefined,
      workDays: []
    })
  } catch (error) {
    console.error('Failed to update staff:', error)
    return NextResponse.json(
      { error: 'Failed to update staff member' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a staff member
export async function DELETE(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const decodedName = decodeURIComponent(params.name)

    const staff = await prisma.staff.findUnique({
      where: { name: decodedName }
    })

    if (!staff) {
      return NextResponse.json(
        { error: 'Verpleegkundige niet gevonden' },
        { status: 404 }
      )
    }

    await prisma.staff.delete({
      where: { name: decodedName }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete staff:', error)
    return NextResponse.json(
      { error: 'Failed to delete staff member' },
      { status: 500 }
    )
  }
}

