'use client'

import { useWeekplanningContext } from '../layout'
import WeekTreatments from '@/components/planning/WeekTreatments'

export default function BehandelingenPage() {
  const {
    treatments,
    setTreatments,
  } = useWeekplanningContext()

  return (
    <WeekTreatments
      treatments={treatments}
      setTreatments={setTreatments}
    />
  )
}

