import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type ReferralEntry = { department: string; count: number }
type MedicationWasteEntry = { medicationId: string; count: number }

const emptyTracking = {
  referrals: [] as ReferralEntry[],
  wastedMeds: [] as MedicationWasteEntry[],
  noShows: 0,
  lateCancellations: 0
}

const parseJsonArray = <T>(value: string | null): T[] => {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')
  if (!date) {
    return NextResponse.json({ error: 'Date is required' }, { status: 400 })
  }

  try {
    const tracking = await prisma.dashboardTracking.findUnique({
      where: { date }
    })

    if (!tracking) {
      return NextResponse.json({ date, ...emptyTracking })
    }

    return NextResponse.json({
      date,
      referrals: parseJsonArray<ReferralEntry>(tracking.referralsJson),
      wastedMeds: parseJsonArray<MedicationWasteEntry>(tracking.wastedMedsJson),
      noShows: tracking.noShows,
      lateCancellations: tracking.lateCancellations
    })
  } catch (error) {
    console.error('Failed to fetch tracking:', error)
    return NextResponse.json({ error: 'Failed to fetch tracking' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const date = String(body?.date || '').trim()
    if (!date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 })
    }

    const referrals = Array.isArray(body?.referrals) ? body.referrals : []
    const wastedMeds = Array.isArray(body?.wastedMeds) ? body.wastedMeds : []
    const noShows = Number.isFinite(body?.noShows) ? Number(body.noShows) : 0
    const lateCancellations = Number.isFinite(body?.lateCancellations) ? Number(body.lateCancellations) : 0

    const updated = await prisma.dashboardTracking.upsert({
      where: { date },
      update: {
        referralsJson: JSON.stringify(referrals),
        wastedMedsJson: JSON.stringify(wastedMeds),
        noShows,
        lateCancellations
      },
      create: {
        date,
        referralsJson: JSON.stringify(referrals),
        wastedMedsJson: JSON.stringify(wastedMeds),
        noShows,
        lateCancellations
      }
    })

    return NextResponse.json({
      date: updated.date,
      referrals,
      wastedMeds,
      noShows: updated.noShows,
      lateCancellations: updated.lateCancellations
    })
  } catch (error) {
    console.error('Failed to update tracking:', error)
    return NextResponse.json({ error: 'Failed to update tracking' }, { status: 500 })
  }
}
