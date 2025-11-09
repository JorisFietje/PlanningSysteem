import { Patient } from '@/types'

export async function createPatient(
  name: string,
  startTime: string,
  scheduledDate: string,
  medicationId: string,
  treatmentNumber: number
): Promise<Patient | null> {
  try {
    const response = await fetch('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, startTime, scheduledDate, medicationType: medicationId, treatmentNumber }),
    })

    if (response.ok) {
      return await response.json()
    }
    return null
  } catch (error) {
    console.error('Failed to create patient:', error)
    return null
  }
}

export async function deletePatient(patientId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/patients/${patientId}`, {
      method: 'DELETE',
    })
    return response.ok
  } catch (error) {
    console.error('Failed to delete patient:', error)
    return false
  }
}

export async function updatePatientStartTime(patientId: string, startTime: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/patients/${patientId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startTime }),
    })
    return response.ok
  } catch (error) {
    console.error('Failed to update patient:', error)
    return false
  }
}

export async function updatePatient(
  patientId: string,
  data: {
    startTime?: string
    medicationType?: string
    treatmentNumber?: number
  }
): Promise<Patient | null> {
  try {
    const response = await fetch(`/api/patients/${patientId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (response.ok) {
      return await response.json()
    }
    return null
  } catch (error) {
    console.error('Failed to update patient:', error)
    return null
  }
}

