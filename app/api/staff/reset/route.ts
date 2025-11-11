import { NextRequest, NextResponse } from 'next/server'
import { DayOfWeek } from '@/types'
import { prisma } from '@/lib/prisma'

// Default staff members
const DEFAULT_STAFF = [
  { name: 'Carla', maxPatients: 10 },
  { name: 'Merel', maxPatients: 10 },
  { name: 'Irma', maxPatients: 8 },
  { name: 'Henriette', maxPatients: 10 },
  { name: 'Emmy', maxPatients: 10 },
  { name: 'Yvonne', maxPatients: 8, maxWorkTime: 360 },
  { name: 'Joyce', maxPatients: 10 },
  { name: 'Suzan', maxPatients: 10 },
  { name: 'Vera', maxPatients: 8 },
  { name: 'Chayenne', maxPatients: 5 },
  { name: 'Serina', maxPatients: 3 },
]

// POST - Reset to default staff members
export async function POST() {
  try {
    // Delete all existing staff
    await prisma.staff.deleteMany()

    // Create default staff
    for (const staff of DEFAULT_STAFF) {
      await prisma.staff.create({
        data: {
          name: staff.name,
          maxPatients: staff.maxPatients,
          maxWorkTime: staff.maxWorkTime || null,
          workDays: JSON.stringify(staff.workDays)
        }
      })
    }

    const staff = await prisma.staff.findMany({
      orderBy: { name: 'asc' }
    })

    const staffMembers = staff.map(s => ({
      name: s.name,
      maxPatients: s.maxPatients,
          maxWorkTime: s.maxWorkTime || undefined,
          workDays: []
    }))

    return NextResponse.json(staffMembers)
  } catch (error) {
    console.error('Failed to reset staff:', error)
    return NextResponse.json(
      { error: 'Failed to reset staff members' },
      { status: 500 }
    )
  }
}

