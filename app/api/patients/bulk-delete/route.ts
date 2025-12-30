import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const ids = Array.isArray(body?.ids)
      ? body.ids.filter((id: unknown) => typeof id === 'string' && id.trim().length > 0)
      : []

    if (ids.length === 0) {
      return NextResponse.json({ deleted: 0 })
    }

    const result = await prisma.patient.deleteMany({
      where: {
        id: { in: ids }
      }
    })

    return NextResponse.json({ deleted: result.count })
  } catch (error) {
    console.error('Failed to bulk delete patients:', error)
    return NextResponse.json(
      { error: 'Failed to bulk delete patients' },
      { status: 500 }
    )
  }
}
