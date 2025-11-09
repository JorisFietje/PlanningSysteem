import { NextRequest, NextResponse } from 'next/server'
import { DayOfWeek } from '@/types'
import { prisma } from '@/lib/prisma'

// Default staff members
const DEFAULT_STAFF = [
  { name: 'Carla', maxPatients: 10, workDays: ['monday', 'thursday'] },
  { name: 'Merel', maxPatients: 10, workDays: ['monday', 'friday'] },
  { name: 'Irma', maxPatients: 8, workDays: ['monday', 'friday'] },
  { name: 'Henriette', maxPatients: 10, workDays: ['tuesday'] },
  { name: 'Emmy', maxPatients: 10, workDays: ['tuesday', 'thursday'] },
  { name: 'Yvonne', maxPatients: 8, maxWorkTime: 360, workDays: ['tuesday'] },
  { name: 'Joyce', maxPatients: 10, workDays: ['wednesday'] },
  { name: 'Suzan', maxPatients: 10, workDays: ['wednesday'] },
  { name: 'Vera', maxPatients: 8, workDays: ['wednesday'] },
  { name: 'Chayenne', maxPatients: 5, workDays: ['thursday'] },
  { name: 'Serina', maxPatients: 3, workDays: ['friday'] },
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
      workDays: s.workDays ? (JSON.parse(s.workDays) as DayOfWeek[]) : []
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

