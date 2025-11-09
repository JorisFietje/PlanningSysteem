'use client'

import { Patient } from '@/types'
import { getTotalDuration } from '@/utils/planning/workload'
import { getMedicationById } from '@/types/medications'
import { useState } from 'react'

interface ScheduleBoardProps {
  patients: Patient[]
  onAddPatient?: () => void
  onDeletePatient?: (patientId: string) => void
  showHeader?: boolean
}

interface TimeSlot {
  startMinutes: number
  endMinutes: number
  patient: Patient
}

export default function ScheduleBoard({ patients, onAddPatient, onDeletePatient, showHeader = true }: ScheduleBoardProps) {
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  
  const startHour = 8  // Afdeling werktijden: 08:00 - 16:00
  const endHour = 16
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => {
    const h = startHour + i
    return `${h.toString().padStart(2, '0')}:00`
  })

  if (patients.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 h-full">
        <h2 className="text-xl font-bold mb-6 text-slate-900 border-b pb-3">Dagplanning</h2>
        <div className="text-center py-16">
          <div className="text-4xl mb-2 text-slate-300">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="text-lg text-slate-500">Geen patiënten ingepland</div>
        </div>
      </div>
    )
  }

  // Prepare time slots with patient data
  const timeSlots: TimeSlot[] = patients.map(patient => {
    const [hours, minutes] = patient.startTime.split(':').map(Number)
    const startMinutes = hours * 60 + minutes
    const duration = getTotalDuration(patient)
    return {
      startMinutes,
      endMinutes: startMinutes + duration,
      patient
    }
  }).sort((a, b) => a.startMinutes - b.startMinutes || (b.endMinutes - b.startMinutes) - (a.endMinutes - a.startMinutes))

  // Assign columns to avoid overlaps
  const columns: TimeSlot[][] = []
  
  timeSlots.forEach(slot => {
    let placed = false
    
    // Try to place in existing column
    for (let col of columns) {
      const hasOverlap = col.some(existing => {
        return slot.startMinutes < existing.endMinutes && slot.endMinutes > existing.startMinutes
      })
      
      if (!hasOverlap) {
        col.push(slot)
        placed = true
        break
      }
    }
    
    // Create new column if needed
    if (!placed) {
      columns.push([slot])
    }
  })

  // Show ALL columns (no limit)
  const maxColumns = columns.length
  
  // Calculate positioning for each patient
  const patientPositions = new Map()
  
  columns.forEach((col, colIndex) => {
    col.forEach(slot => {
      const position = ((slot.startMinutes - (startHour * 60)) / 60) * 60
      const height = Math.max(((slot.endMinutes - slot.startMinutes) / 60) * 60, 40)
      
      patientPositions.set(slot.patient.id, {
        column: colIndex,
        totalColumns: maxColumns,
        position,
        height,
        duration: slot.endMinutes - slot.startMinutes
      })
    })
  })

  // Extended color palette for many columns
  const colors = [
    'bg-blue-600 hover:bg-blue-700',
    'bg-indigo-600 hover:bg-indigo-700',
    'bg-purple-600 hover:bg-purple-700',
    'bg-pink-600 hover:bg-pink-700',
    'bg-teal-600 hover:bg-teal-700',
    'bg-cyan-600 hover:bg-cyan-700',
    'bg-sky-600 hover:bg-sky-700',
    'bg-violet-600 hover:bg-violet-700',
    'bg-fuchsia-600 hover:bg-fuchsia-700',
    'bg-rose-600 hover:bg-rose-700',
    'bg-emerald-600 hover:bg-emerald-700',
    'bg-green-600 hover:bg-green-700',
    'bg-lime-600 hover:bg-lime-700',
    'bg-amber-600 hover:bg-amber-700',
    'bg-orange-600 hover:bg-orange-700',
  ]

  const hasMultipleColumns = maxColumns > 1

  const containerClass = showHeader 
    ? "bg-white rounded-xl p-6 shadow-sm border border-slate-200 h-full flex flex-col"
    : "h-full flex flex-col p-6"

  return (
    <div className={containerClass}>
      {showHeader && (
        <div className="flex items-center justify-between mb-4 pb-3 border-b">
          <h2 className="text-xl font-bold text-slate-900">Dagplanning</h2>
          <div className="flex items-center gap-3">
            {hasMultipleColumns && (
              <div className="flex items-center gap-1 text-xs text-slate-600 bg-blue-50 px-3 py-1 rounded-full">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="font-medium">{maxColumns} gelijktijdige slots</span>
              </div>
            )}
            {onAddPatient && (
              <button
                onClick={onAddPatient}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Nieuwe Behandeling</span>
              </button>
            )}
          </div>
        </div>
      )}
      
      <div className="flex-1 overflow-auto overflow-y-visible">
        <div className="grid grid-cols-[80px_1fr] gap-4 min-h-[600px]">
          {/* Time labels */}
          <div className="flex flex-col flex-shrink-0 relative z-0">
            {hours.map(hour => (
              <div key={hour} className="h-[60px] flex items-center justify-end pr-4 font-semibold text-slate-600 text-sm">
                {hour}
              </div>
            ))}
          </div>

          {/* Timeline with columns - with horizontal scroll for many columns */}
          <div className="relative border-l-3 border-slate-300 overflow-x-auto overflow-y-visible" style={{ minWidth: maxColumns > 5 ? `${maxColumns * 120}px` : 'auto' }}>
            {hours.map((hour, index) => (
              <div
                key={hour}
                className="h-[60px] border-b border-slate-200"
              />
            ))}

            {/* Patient blocks */}
            {patients.map((patient) => {
              const pos = patientPositions.get(patient.id)
              if (!pos) return null

              const columnWidth = 100 / pos.totalColumns
              const leftPosition = pos.column * columnWidth
              const color = colors[pos.column % colors.length]
              
              // Get medication info
              const medication = getMedicationById(patient.medicationType)
              const medicationName = medication?.displayName || patient.medicationType
              
              // Get staff assignments for key actions
              const setupAction = patient.actions.find(a => a.type === 'setup')
              const protocolCheckAction = patient.actions.find(a => a.type === 'protocol_check')
              const removalAction = patient.actions.find(a => a.type === 'removal')
              const checkActions = patient.actions.filter(a => a.type === 'check')
              
              // Adjust for compact display based on number of columns
              const isCompact = pos.totalColumns >= 3
              const isVeryCompact = pos.totalColumns >= 5
              const isExtremelyCompact = pos.totalColumns >= 8

              return (
                <div
                  key={patient.id}
                  onClick={() => setSelectedPatient(patient)}
                  className={`absolute ${color} text-white rounded-md shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer group border-2 border-white`}
                  style={{ 
                    top: `${pos.position}px`, 
                    height: `${pos.height}px`,
                    left: `calc(${leftPosition}% + 4px)`,
                    width: `calc(${columnWidth}% - 8px)`,
                    padding: isExtremelyCompact ? '4px 6px' : isVeryCompact ? '6px 8px' : isCompact ? '8px 10px' : '10px 12px',
                    zIndex: 10 + pos.column,
                    minWidth: isExtremelyCompact ? '60px' : isVeryCompact ? '80px' : 'auto',
                    transformOrigin: 'center center',
                    transform: 'scale(1)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.01)'
                    e.currentTarget.style.zIndex = '30'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)'
                    e.currentTarget.style.zIndex = `${10 + pos.column}`
                  }}
                  title={`${medicationName} - Klik voor details`}
                >
                  <div className={`font-bold leading-tight truncate ${
                    isExtremelyCompact ? 'text-[10px]' : isVeryCompact ? 'text-xs' : 'text-sm'
                  }`}>
                    {medicationName}
                  </div>
                  <div className={`opacity-90 mt-0.5 ${
                    isExtremelyCompact ? 'text-[8px]' : isVeryCompact ? 'text-[10px]' : 'text-xs'
                  }`}>
                    {isExtremelyCompact ? patient.startTime.slice(0, 5) : patient.startTime}
                  </div>
                  {pos.height > 50 && !isExtremelyCompact && (
                    <div className={`opacity-75 mt-0.5 ${
                      isVeryCompact ? 'text-[10px]' : 'text-xs'
                    }`}>
                      {pos.duration}m
                    </div>
                  )}
                  
                  {/* Staff assignments - only show if there's enough space */}
                  {pos.height > 60 && !isExtremelyCompact && (
                    <div className={`mt-1.5 space-y-0.5 ${
                      isVeryCompact ? 'text-[9px]' : 'text-[10px]'
                    }`}>
                      {setupAction?.staff && setupAction.staff !== 'Systeem' && setupAction.staff !== 'Geen' && (
                        <div className="opacity-90 truncate">
                          Prikt: {setupAction.staff}
                        </div>
                      )}
                      {protocolCheckAction?.staff && protocolCheckAction.staff !== 'Systeem' && protocolCheckAction.staff !== 'Geen' && (
                        <div className="opacity-90 truncate">
                          Protocol: {protocolCheckAction.staff}
                        </div>
                      )}
                      {checkActions.length > 0 && checkActions[0]?.staff && checkActions[0].staff !== 'Systeem' && checkActions[0].staff !== 'Geen' && (
                        <div className="opacity-90 truncate">
                          Checks: {new Set(checkActions.map(c => c.staff).filter(s => s && s !== 'Systeem' && s !== 'Geen')).size > 1 
                            ? `${new Set(checkActions.map(c => c.staff).filter(s => s && s !== 'Systeem' && s !== 'Geen')).size} VPK`
                            : checkActions[0].staff}
                        </div>
                      )}
                      {removalAction?.staff && removalAction.staff !== 'Systeem' && removalAction.staff !== 'Geen' && (
                        <div className="opacity-90 truncate">
                          Afkoppelt: {removalAction.staff}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Hover tooltip for compact view */}
                  {(isVeryCompact || isExtremelyCompact) && (
                    <div className="absolute hidden group-hover:block bottom-full right-0 mb-2 bg-slate-900 text-white px-3 py-2 rounded-lg shadow-2xl z-[10000] whitespace-nowrap text-sm pointer-events-none" style={{ minWidth: '200px', maxWidth: '300px' }}>
                      <div className="font-bold">{medicationName}</div>
                      <div className="opacity-90 text-xs">{patient.name}</div>
                      <div className="opacity-90 text-xs">{patient.startTime} • {pos.duration} min</div>
                      {setupAction?.staff && setupAction.staff !== 'Systeem' && setupAction.staff !== 'Geen' && (
                        <div className="opacity-90 text-xs mt-1">Prikt: {setupAction.staff}</div>
                      )}
                      {protocolCheckAction?.staff && protocolCheckAction.staff !== 'Systeem' && protocolCheckAction.staff !== 'Geen' && (
                        <div className="opacity-90 text-xs">Protocol: {protocolCheckAction.staff}</div>
                      )}
                      {checkActions.length > 0 && checkActions[0]?.staff && checkActions[0].staff !== 'Systeem' && checkActions[0].staff !== 'Geen' && (
                        <div className="opacity-90 text-xs">
                          Checks: {new Set(checkActions.map(c => c.staff).filter(s => s && s !== 'Systeem' && s !== 'Geen')).size > 1 
                            ? `${new Set(checkActions.map(c => c.staff).filter(s => s && s !== 'Systeem' && s !== 'Geen')).size} VPK`
                            : checkActions[0].staff}
                        </div>
                      )}
                      {removalAction?.staff && removalAction.staff !== 'Systeem' && removalAction.staff !== 'Geen' && (
                        <div className="opacity-90 text-xs">Afkoppelt: {removalAction.staff}</div>
                      )}
                      {/* Arrow pointing down */}
                      <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900"></div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      
      {/* Legend */}
      {hasMultipleColumns && (
        <div className="mt-4 pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Verschillende kleuren = gelijktijdige patiënten</span>
              </div>
              <div className="flex items-center gap-1 text-blue-600 font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
                <span>Klik op behandeling voor details</span>
              </div>
              {maxColumns > 5 && (
                <span className="text-slate-500">
                  • Scroll horizontaal voor alle {maxColumns} kolommen
                </span>
              )}
            </div>
            <div className="flex gap-1 flex-wrap max-w-xs justify-end">
              {colors.slice(0, Math.min(maxColumns, 15)).map((color, idx) => (
                <div 
                  key={idx} 
                  className={`w-4 h-4 rounded ${color.split(' ')[0]} border border-white shadow-sm`} 
                  title={`Kolom ${idx + 1}`}
                ></div>
              ))}
              {maxColumns > 15 && (
                <div className="text-xs text-slate-500 ml-1 self-center">+{maxColumns - 15}</div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Patient Details Modal */}
      {selectedPatient && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
          onClick={() => setSelectedPatient(null)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-xl">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-2xl font-bold mb-2">{selectedPatient.name}</h3>
                  <div className="flex items-center gap-3 text-blue-100">
                    <div className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{selectedPatient.startTime}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>{getTotalDuration(selectedPatient)} minuten</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {onDeletePatient && (
                    <button
                      onClick={() => {
                        if (onDeletePatient) {
                          onDeletePatient(selectedPatient.id)
                          setSelectedPatient(null)
                        }
                      }}
                      className="text-white hover:bg-red-600 hover:bg-opacity-80 rounded-lg p-2 transition-colors"
                      title="Behandeling verwijderen"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedPatient(null)}
                    className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {/* Medication Info */}
              <div className="mb-6">
                <h4 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Behandeling Informatie
                </h4>
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-slate-600 mb-1">Medicatie Type</div>
                      <div className="font-semibold text-slate-900">
                        {getMedicationById(selectedPatient.medicationType)?.displayName || selectedPatient.medicationType}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-600 mb-1">Behandeling Nummer</div>
                      <div className="font-semibold text-slate-900">
                        {selectedPatient.treatmentNumber === 1 ? '1e behandeling' :
                         selectedPatient.treatmentNumber === 2 ? '2e-3e behandeling' :
                         selectedPatient.treatmentNumber === 3 ? '4e-6e behandeling' :
                         '7e+ behandeling'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions Timeline */}
              <div>
                <h4 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  Behandeling Overzicht ({selectedPatient.actions.filter(a => a.type !== 'infusion').length} handelingen)
                </h4>
                <div className="space-y-2">
                  {selectedPatient.actions.map((action, index) => {
                    const getActionColor = (type?: string) => {
                      switch(type) {
                        case 'setup': return 'bg-purple-100 border-purple-300 text-purple-800'
                        case 'protocol_check': return 'bg-green-100 border-green-300 text-green-800'
                        case 'infusion': return 'bg-blue-100 border-blue-300 text-blue-800'
                        case 'check': return 'bg-cyan-100 border-cyan-300 text-cyan-800'
                        case 'pc_switch': return 'bg-red-100 border-red-300 text-red-800'
                        case 'observation': return 'bg-slate-100 border-slate-300 text-slate-800'
                        case 'flush': return 'bg-teal-100 border-teal-300 text-teal-800'
                        case 'removal': return 'bg-orange-100 border-orange-300 text-orange-800'
                        default: return 'bg-gray-100 border-gray-300 text-gray-800'
                      }
                    }

                    return (
                      <div 
                        key={action.id} 
                        className={`p-3 rounded-lg border-2 ${getActionColor(action.type)}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-semibold text-sm">{action.name}</div>
                            {action.staff && action.staff !== 'Systeem' && action.staff !== 'Geen' && (
                              <div className="text-xs opacity-75 mt-1">{action.staff}</div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-sm">
                              {action.actualDuration || action.duration} min
                            </div>
                            {action.actualDuration && action.actualDuration !== action.duration && (
                              <div className="text-xs opacity-75">
                                (werk: {action.actualDuration}m)
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Summary */}
              <div className="mt-6 pt-6 border-t border-slate-200">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
                    <div className="text-2xl font-bold text-blue-900">{getTotalDuration(selectedPatient)}</div>
                    <div className="text-xs text-blue-700 mt-1">Totaal minuten</div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border border-purple-200">
                    <div className="text-2xl font-bold text-purple-900">
                      {selectedPatient.actions.filter(a => a.staff && a.staff !== 'Systeem' && a.staff !== 'Geen').length}
                    </div>
                    <div className="text-xs text-purple-700 mt-1">VPK handelingen</div>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 border border-green-200">
                    <div className="text-2xl font-bold text-green-900">
                      {new Set(selectedPatient.actions.filter(a => a.staff && a.staff !== 'Systeem' && a.staff !== 'Geen').map(a => a.staff)).size}
                    </div>
                    <div className="text-xs text-green-700 mt-1">Verpleegkundigen</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
