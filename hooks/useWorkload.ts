import { useState, useEffect } from 'react'
import { Patient, WorkloadSlot } from '@/types'
import { calculateWorkloadByTimeSlot } from '@/utils/planning/workload'

export function useWorkload(patients: Patient[]) {
  const [workload, setWorkload] = useState<WorkloadSlot[]>([])

  useEffect(() => {
    if (patients.length > 0) {
      const calculatedWorkload = calculateWorkloadByTimeSlot(patients)
      setWorkload(calculatedWorkload)
    } else {
      setWorkload([])
    }
  }, [patients])

  return { workload, setWorkload }
}

