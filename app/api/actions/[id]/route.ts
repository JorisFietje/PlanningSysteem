import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// PUT update action duration
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { duration } = body

    if (duration === undefined) {
      return NextResponse.json(
        { error: 'Duration is required' },
        { status: 400 }
      )
    }

    const updated = await prisma.action.update({
      where: { id: params.id },
      data: { duration: parseInt(duration) }
    })

    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update action' },
      { status: 500 }
    )
  }
}

// DELETE single action
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.action.delete({
      where: { id: params.id }
    })
    return NextResponse.json({ message: 'Action deleted' })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete action' },
      { status: 500 }
    )
  }
}
