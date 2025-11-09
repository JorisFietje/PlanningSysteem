import { useState, useEffect, useCallback } from 'react'
import { Patient } from '@/types'

export function usePatients(selectedDate: string) {
  const [patients, setPatients] = useState<Patient[]>([])

  const fetchPatients = useCallback(async () => {
    try {
      const response = await fetch(`/api/patients?date=${selectedDate}`)
      const data = await response.json()
      setPatients(data)
    } catch (error) {
      console.error('Failed to fetch patients:', error)
    }
  }, [selectedDate])

  useEffect(() => {
    fetchPatients()
  }, [fetchPatients])

  return { patients, setPatients, fetchPatients }
}

