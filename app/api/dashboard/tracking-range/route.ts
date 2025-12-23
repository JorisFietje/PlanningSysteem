import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  if (!start || !end) {
    return NextResponse.json({ error: 'Start and end are required' }, { status: 400 })
  }

  try {
    const rows = await prisma.dashboardTracking.findMany({
      where: {
        date: {
          gte: start,
          lte: end
        }
      },
      orderBy: { date: 'asc' }
    })

    const data = rows.map(row => ({
      date: row.date,
      referrals: JSON.parse(row.referralsJson || '[]'),
      wastedMeds: JSON.parse(row.wastedMedsJson || '[]'),
      noShows: row.noShows,
      lateCancellations: row.lateCancellations
    }))

    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to fetch tracking range:', error)
    return NextResponse.json({ error: 'Failed to fetch tracking range' }, { status: 500 })
  }
}
