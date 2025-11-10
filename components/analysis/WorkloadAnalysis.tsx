'use client'

import { useEffect, useRef } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { WorkloadSlot, DEPARTMENT_CONFIG } from '@/types'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface WorkloadAnalysisProps {
  workload: WorkloadSlot[]
}

export default function WorkloadAnalysis({ workload }: WorkloadAnalysisProps) {
  const activeWorkload = workload.filter(w => w.count > 0)

  if (activeWorkload.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold mb-6 text-slate-900 border-b pb-3">Werkdruk Analyse</h2>
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
          if (w.count >= 10) return '#dc2626' // Very high (>=10)
          if (w.count >= 7) return '#ea580c' // High (7-9)
          if (w.count >= 4) return '#f59e0b' // Medium (4-6)
          return '#16a34a' // Low (0-3)
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
        max: 14,
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
      <h2 className="text-xl font-bold mb-6 text-slate-900 border-b pb-3">Werkdruk Analyse</h2>
      
      <div className="mb-8">
        <Bar data={chartData} options={options} />
      </div>

      {/* Key Statistics & Insights */}
      <div>
        <h3 className="font-bold text-lg mb-4 text-slate-900">Belangrijke Inzichten</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Peak Times */}
          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border border-red-200">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <h4 className="font-bold text-red-900">Piekuren</h4>
            </div>
            <div className="space-y-2">
              {activeWorkload
                .filter(slot => slot.count >= 10)
                .slice(0, 3)
                .map(slot => (
                  <div key={slot.time} className="flex items-center justify-between bg-white/60 rounded px-3 py-2">
                    <span className="font-semibold text-slate-700">{slot.time}</span>
                    <span className="font-bold text-red-700">{slot.count} patiënten</span>
                  </div>
                ))}
              {activeWorkload.filter(slot => slot.count >= 10).length === 0 && (
                <div className="text-sm text-red-700">Geen piekuren (≥10 patiënten)</div>
              )}
            </div>
          </div>

          {/* Workload Distribution */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h4 className="font-bold text-blue-900">Drukte Verdeling</h4>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-white/60 rounded px-3 py-2">
                <span className="text-sm text-slate-700">Zeer Hoog (≥10)</span>
                <span className="font-bold text-red-700">
                  {activeWorkload.filter(s => s.count >= 10).length} tijdslot{activeWorkload.filter(s => s.count >= 10).length !== 1 ? 'ten' : ''}
                </span>
              </div>
              <div className="flex items-center justify-between bg-white/60 rounded px-3 py-2">
                <span className="text-sm text-slate-700">Hoog (7-9)</span>
                <span className="font-bold text-orange-700">
                  {activeWorkload.filter(s => s.count >= 7 && s.count < 10).length} tijdslot{activeWorkload.filter(s => s.count >= 7 && s.count < 10).length !== 1 ? 'ten' : ''}
                </span>
              </div>
              <div className="flex items-center justify-between bg-white/60 rounded px-3 py-2">
                <span className="text-sm text-slate-700">Gemiddeld (4-6)</span>
                <span className="font-bold text-yellow-700">
                  {activeWorkload.filter(s => s.count >= 4 && s.count < 7).length} tijdslot{activeWorkload.filter(s => s.count >= 4 && s.count < 7).length !== 1 ? 'ten' : ''}
                </span>
              </div>
              <div className="flex items-center justify-between bg-white/60 rounded px-3 py-2">
                <span className="text-sm text-slate-700">Laag (0-3)</span>
                <span className="font-bold text-green-700">
                  {activeWorkload.filter(s => s.count < 4).length} tijdslot{activeWorkload.filter(s => s.count < 4).length !== 1 ? 'ten' : ''}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

