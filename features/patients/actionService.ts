export async function createAction(
  patientId: string,
  name: string,
  duration: number,
  type: string,
  actualDuration?: number,
  staff: string = 'Systeem'
): Promise<boolean> {
  try {
    const response = await fetch('/api/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId,
        name,
        duration,
        type,
        actualDuration,
        staff
      }),
    })
    return response.ok
  } catch (error) {
    console.error('Failed to create action:', error)
    return false
  }
}

export async function deleteAction(actionId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/actions/${actionId}`, {
      method: 'DELETE',
    })
    return response.ok
  } catch (error) {
    console.error('Failed to delete action:', error)
    return false
  }
}

