'use client'

import { useEffect, useState } from 'react'
import { useDagplanningContext } from '../layout'
import { OptimizationSuggestion } from '@/types'
import { generateOptimizationSuggestions, calculateWorkloadByTimeSlot } from '@/utils/planning/workload'
import WorkloadAnalysis from '@/components/analysis/WorkloadAnalysis'
import OptimizationSuggestions from '@/components/analysis/OptimizationSuggestions'

export default function AnalysePage() {
  const { patients, workload } = useDagplanningContext()
  const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([])

  useEffect(() => {
    if (workload.length > 0 && workload.some(w => w.count > 0)) {
      const calculatedWorkload = calculateWorkloadByTimeSlot(patients)
      const generatedSuggestions = generateOptimizationSuggestions(calculatedWorkload, patients)
      setSuggestions(generatedSuggestions)
    } else {
      setSuggestions([])
    }
  }, [patients, workload])

  return (
    <div className="space-y-6">
      {workload.length > 0 && workload.some(w => w.count > 0) ? (
        <>
          <WorkloadAnalysis workload={workload} />
          {suggestions.length > 0 && (
            <OptimizationSuggestions suggestions={suggestions} show={true} />
          )}
        </>
      ) : (
        <div className="bg-white rounded-xl p-12 shadow-sm border border-slate-200 text-center">
          <svg className="w-20 h-20 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="text-xl font-bold text-slate-900">Geen analyse beschikbaar</h3>
        </div>
      )}
    </div>
  )
}

