import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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

