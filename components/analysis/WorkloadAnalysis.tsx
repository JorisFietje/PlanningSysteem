'use client'

import { useEffect, useRef } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { WorkloadSlot } from '@/types'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface WorkloadAnalysisProps {
  workload: WorkloadSlot[]
}

export default function WorkloadAnalysis({ workload }: WorkloadAnalysisProps) {
  const activeWorkload = workload.filter(w => w.count > 0)

  if (activeWorkload.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold mb-6 text-slate-900 border-b pb-3">Werkdruk Analyse (per 15 minuten)</h2>
        <div className="text-center py-16">
          <div className="text-4xl mb-2 text-slate-300">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div className="text-lg text-slate-500">Geen gegevens om te analyseren</div>
        </div>
      </div>
    )
  }

  // Get range of active times with padding
  const firstActive = workload.findIndex(w => w.count > 0)
  const lastActive = workload.length - 1 - [...workload].reverse().findIndex(w => w.count > 0)
  const startIndex = Math.max(0, firstActive - 4)
  const endIndex = Math.min(workload.length, lastActive + 5)
  const displayWorkload = workload.slice(startIndex, endIndex)

  const chartData = {
    labels: displayWorkload.map(w => w.time),
    datasets: [
      {
        label: 'Aantal Gelijktijdige Patiënten',
        data: displayWorkload.map(w => w.count),
        backgroundColor: displayWorkload.map(w => {
          if (w.count >= 4) return '#dc2626' // High
          if (w.count >= 3) return '#ea580c' // Medium-high
          if (w.count >= 2) return '#f59e0b' // Medium
          return '#16a34a' // Low
        }),
        borderColor: 'rgba(0, 0, 0, 0.1)',
        borderWidth: 1,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
        title: {
          display: true,
          text: 'Aantal Patiënten',
        },
      },
      x: {
        title: {
          display: true,
          text: 'Tijdslot (15 minuten)',
        },
      },
    },
    plugins: {
      legend: {
        display: true,
      },
      tooltip: {
        callbacks: {
          afterLabel: function (context: any) {
            const slot = displayWorkload[context.dataIndex]
            if (slot.patients.length > 0) {
              return 'Patiënten: ' + slot.patients.join(', ')
            }
            return ''
          },
        },
      },
    },
  }

  const maxCount = Math.max(...activeWorkload.map(w => w.count))

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
      <h2 className="text-xl font-bold mb-6 text-slate-900 border-b pb-3">Werkdruk Analyse (per 15 minuten)</h2>
      
      <div className="mb-8">
        <Bar data={chartData} options={options} />
      </div>

      <div>
        <h3 className="font-bold text-lg mb-4 text-slate-900">Details per Tijdslot:</h3>
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
          {activeWorkload.map(slot => {
            const percentage = (slot.count / maxCount) * 100
            const isHigh = slot.count >= 3

            return (
              <div key={slot.time} className="flex items-center gap-4">
                <div className="font-semibold text-slate-700 min-w-[100px] flex-shrink-0">{slot.time}</div>
                <div className="flex-1 min-w-0">
                  <div className="h-6 bg-slate-200 rounded-lg overflow-hidden">
                    <div
                      className={`h-full flex items-center px-2 text-white text-xs font-semibold ${
                        isHigh
                          ? 'bg-gradient-to-r from-orange-500 to-red-600'
                          : 'bg-gradient-to-r from-green-500 to-orange-500'
                      }`}
                      style={{ width: `${Math.max(percentage, 15)}%` }}
                    >
                      <span className="truncate">{slot.count} patiënt(en)</span>
                    </div>
                  </div>
                  {slot.patients.length > 0 && (
                    <div className="text-xs text-slate-600 mt-1 truncate" title={slot.patients.join(', ')}>
                      {slot.patients.join(', ')}
                    </div>
                  )}
                </div>
                <div className="font-bold text-slate-900 min-w-[40px] text-right flex-shrink-0">{slot.count}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

