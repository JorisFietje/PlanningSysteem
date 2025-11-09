import { NextRequest, NextResponse } from 'next/server'
import { DayOfWeek } from '@/types'
import { prisma } from '@/lib/prisma'

// Default staff members (initial setup)
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

// GET - Get all staff members
export async function GET() {
  try {
    // Initialize defaults if database is empty
    await initializeDefaults()

    const staff = await prisma.staff.findMany({
      orderBy: { name: 'asc' }
    })

    // Convert database format to StaffMember format
    const staffMembers = staff.map(s => ({
      name: s.name,
      maxPatients: s.maxPatients,
      maxWorkTime: s.maxWorkTime || undefined,
      workDays: s.workDays ? (JSON.parse(s.workDays) as DayOfWeek[]) : []
    }))

    return NextResponse.json(staffMembers)
  } catch (error) {
    console.error('Failed to fetch staff:', error)
    return NextResponse.json(
      { error: 'Failed to fetch staff members' },
      { status: 500 }
    )
  }
}

// POST - Create a new staff member
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, maxPatients, maxWorkTime, workDays } = body

    if (!name || !maxPatients) {
      return NextResponse.json(
        { error: 'Naam en max patiënten zijn verplicht' },
        { status: 400 }
      )
    }

    // Check if staff member with this name already exists
    const existing = await prisma.staff.findUnique({
      where: { name }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Een verpleegkundige met deze naam bestaat al' },
        { status: 400 }
      )
    }

    const staff = await prisma.staff.create({
      data: {
        name,
        maxPatients: parseInt(maxPatients),
        maxWorkTime: maxWorkTime ? parseInt(maxWorkTime) : null,
        workDays: workDays && Array.isArray(workDays) && workDays.length > 0 
          ? JSON.stringify(workDays) 
          : null
      }
    })

    return NextResponse.json({
      name: staff.name,
      maxPatients: staff.maxPatients,
      maxWorkTime: staff.maxWorkTime || undefined,
      workDays: staff.workDays ? (JSON.parse(staff.workDays) as DayOfWeek[]) : []
    })
  } catch (error) {
    console.error('Failed to create staff:', error)
    return NextResponse.json(
      { error: 'Failed to create staff member' },
      { status: 500 }
    )
  }
}

// Initialize default staff members (if database is empty)
export async function initializeDefaults() {
  try {
    const count = await prisma.staff.count()
    if (count === 0) {
      // Database is empty, initialize with defaults
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
    }
  } catch (error) {
    console.error('Failed to initialize default staff:', error)
  }
}

