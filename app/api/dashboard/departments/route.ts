import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const DEFAULT_DEPARTMENTS = [
  'Hematologie',
  'Oncologie',
  'Reumatologie',
  'Gastro-enterologie',
  'Longziekten',
  'Neurologie',
  'Interne geneeskunde'
]

export async function GET() {
  try {
    const existing = await prisma.dashboardDepartment.findMany({
      orderBy: { name: 'asc' }
    })

    if (existing.length === 0) {
      await prisma.dashboardDepartment.createMany({
        data: DEFAULT_DEPARTMENTS.map(name => ({ name })),
        skipDuplicates: true
      })
    }

    const departments = await prisma.dashboardDepartment.findMany({
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(departments.map(dep => dep.name))
  } catch (error) {
    console.error('Failed to fetch departments:', error)
    return NextResponse.json({ error: 'Failed to fetch departments' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const name = String(body?.name || '').trim()
    if (!name) {
      return NextResponse.json({ error: 'Naam is verplicht' }, { status: 400 })
    }

    const department = await prisma.dashboardDepartment.upsert({
      where: { name },
      update: {},
      create: { name }
    })

    return NextResponse.json({ name: department.name })
  } catch (error) {
    console.error('Failed to create department:', error)
    return NextResponse.json({ error: 'Failed to create department' }, { status: 500 })
  }
}
