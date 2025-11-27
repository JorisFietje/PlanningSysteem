'use client'

import { Patient } from '@/types'
import { getTotalDuration } from '@/utils/planning/workload'
import { getMedicationById } from '@/types/medications'
import { useState, useRef, useEffect } from 'react'

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
  const [hoveredPatient, setHoveredPatient] = useState<{ patient: Patient, element: HTMLElement } | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  
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
      const position = ((slot.startMinutes - (startHour * 60)) / 60) * 80
      const height = Math.max(((slot.endMinutes - slot.startMinutes) / 60) * 80, 50)
      
      patientPositions.set(slot.patient.id, {
        column: colIndex,
        totalColumns: maxColumns,
        position,
        height,
        duration: slot.endMinutes - slot.startMinutes
      })
    })
  })

  // Extended color palette for many columns - using -700 shades for WCAG 2.1 AA contrast
  const colors = [
    'bg-blue-700 hover:bg-blue-800',
    'bg-indigo-700 hover:bg-indigo-800',
    'bg-purple-700 hover:bg-purple-800',
    'bg-pink-700 hover:bg-pink-800',
    'bg-teal-700 hover:bg-teal-800',
    'bg-cyan-700 hover:bg-cyan-800',
    'bg-sky-700 hover:bg-sky-800',
    'bg-violet-700 hover:bg-violet-800',
    'bg-fuchsia-700 hover:bg-fuchsia-800',
    'bg-rose-700 hover:bg-rose-800',
    'bg-emerald-700 hover:bg-emerald-800',
    'bg-green-700 hover:bg-green-800',
    'bg-lime-700 hover:bg-lime-800',
    'bg-amber-700 hover:bg-amber-800',
    'bg-orange-700 hover:bg-orange-800',
  ]

  // Map start times to colors - all treatments starting at the same time get the same color
  const startTimeToColor = new Map<string, string>()
  const uniqueStartTimes = Array.from(new Set(patients.map(p => p.startTime))).sort()
  uniqueStartTimes.forEach((startTime, index) => {
    startTimeToColor.set(startTime, colors[index % colors.length])
  })

  const hasMultipleColumns = maxColumns > 1

  const containerClass = showHeader 
    ? "bg-white rounded-xl p-6 shadow-sm border border-slate-200 h-full flex flex-col"
    : "h-full flex flex-col p-6"

  return (
    <div className={containerClass}>
      <style dangerouslySetInnerHTML={{__html: `
        .patient-card::-webkit-scrollbar {
          width: 4px;
        }
        .patient-card::-webkit-scrollbar-track {
          background: transparent;
        }
        .patient-card::-webkit-scrollbar-thumb {
          background-color: rgba(255, 255, 255, 0.5);
          border-radius: 4px;
        }
        .patient-card {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.5) transparent;
        }
      `}} />
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
                className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-semibold transition-colors shadow-sm"
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
      
      <div className="flex-1 overflow-auto" style={{ isolation: 'isolate', overflowY: 'visible' }} tabIndex={0} role="region" aria-label="Dagplanning tijdlijn">
        <div className="grid grid-cols-[80px_1fr] gap-4 min-h-[600px]">
          {/* Time labels */}
          <div className="flex flex-col flex-shrink-0 relative z-0">
            {hours.map(hour => (
              <div key={hour} className="h-[70px] flex items-center justify-end pr-4 font-semibold text-slate-600 text-sm">
                {hour}
              </div>
            ))}
          </div>

          {/* Timeline with columns - with horizontal scroll for many columns */}
          <div className="relative border-l-3 border-slate-300 overflow-x-auto" style={{ minWidth: maxColumns > 5 ? `${maxColumns * 90}px` : 'auto', isolation: 'isolate', overflowY: 'visible', position: 'relative' }}>
            {hours.map((hour, index) => (
              <div
                key={hour}
                className="h-[70px] border-b border-slate-200"
              />
            ))}

            {/* Patient blocks */}
            {patients.map((patient) => {
              const pos = patientPositions.get(patient.id)
              if (!pos) return null

              const columnWidth = 100 / pos.totalColumns
              const leftPosition = pos.column * columnWidth
              // Get color based on start time instead of column
              const color = startTimeToColor.get(patient.startTime) || colors[0]
              
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
                  className={`absolute ${color} text-white rounded-md shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer group border-2 border-white patient-card`}
                  style={{ 
                    top: `${pos.position}px`, 
                    height: `${pos.height}px`,
                    left: `calc(${leftPosition}% + 2px)`,
                    width: `calc(${columnWidth}% - 4px)`,
                    padding: isExtremelyCompact ? '4px 6px' : isVeryCompact ? '6px 8px' : isCompact ? '8px 10px' : '10px 12px',
                    zIndex: 10 + pos.column,
                    minWidth: isExtremelyCompact ? '60px' : isVeryCompact ? '80px' : 'auto',
                    transformOrigin: 'center center',
                    transform: 'scale(1)',
                    overflowY: 'auto',
                    overflowX: 'hidden'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.01)'
                    e.currentTarget.style.zIndex = '30'
                    if (isVeryCompact || isExtremelyCompact) {
                      setHoveredPatient({ patient, element: e.currentTarget })
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)'
                    e.currentTarget.style.zIndex = `${10 + pos.column}`
                    setHoveredPatient(null)
                  }}
                  title={`${medicationName} - Klik voor details`}
                >
                  <div className={`font-bold leading-tight truncate ${
                    isExtremelyCompact ? 'text-xs' : isVeryCompact ? 'text-sm' : 'text-base'
                  }`}>
                    {medicationName}
                  </div>
                  <div className={`mt-0.5 font-medium ${
                    isExtremelyCompact ? 'text-[10px]' : isVeryCompact ? 'text-xs' : 'text-sm'
                  }`}>
                    {isExtremelyCompact ? patient.startTime.slice(0, 5) : patient.startTime}
                  </div>
                  {pos.height > 50 && !isExtremelyCompact && (
                    <div className={`mt-0.5 ${
                      isVeryCompact ? 'text-xs' : 'text-sm'
                    }`}>
                      {pos.duration}m
                    </div>
                  )}
                  
                  {/* Staff assignments - only show if there's enough space */}
                  {pos.height > 70 && !isExtremelyCompact && (
                    <div className={`mt-2 space-y-1 ${
                      isVeryCompact ? 'text-[10px]' : 'text-xs'
                    }`}>
                      {setupAction?.staff && setupAction.staff !== 'Systeem' && setupAction.staff !== 'Geen' && (
                        <div className="truncate flex items-center gap-1">
                          <span className="opacity-75 text-[10px] uppercase tracking-wider min-w-[35px]">Prikt:</span>
                          <span className="font-semibold truncate">{setupAction.staff}</span>
                        </div>
                      )}
                      {protocolCheckAction?.staff && protocolCheckAction.staff !== 'Systeem' && protocolCheckAction.staff !== 'Geen' && (
                        <div className="truncate flex items-center gap-1">
                          <span className="opacity-75 text-[10px] uppercase tracking-wider min-w-[35px]">Prot:</span>
                          <span className="font-semibold truncate">{protocolCheckAction.staff}</span>
                        </div>
                      )}
                      {checkActions.length > 0 && checkActions[0]?.staff && checkActions[0].staff !== 'Systeem' && checkActions[0].staff !== 'Geen' && (
                        <div className="truncate flex items-center gap-1">
                          <span className="opacity-75 text-[10px] uppercase tracking-wider min-w-[35px]">Check:</span>
                          <span className="font-semibold truncate">
                            {new Set(checkActions.map(c => c.staff).filter(s => s && s !== 'Systeem' && s !== 'Geen')).size > 1 
                              ? `${new Set(checkActions.map(c => c.staff).filter(s => s && s !== 'Systeem' && s !== 'Geen')).size} VPK`
                              : checkActions[0].staff}
                          </span>
                        </div>
                      )}
                      {removalAction?.staff && removalAction.staff !== 'Systeem' && removalAction.staff !== 'Geen' && (
                        <div className="truncate flex items-center gap-1">
                          <span className="opacity-75 text-[10px] uppercase tracking-wider min-w-[35px]">Af:</span>
                          <span className="font-semibold truncate">{removalAction.staff}</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                </div>
              )
            })}
          </div>
        </div>
      </div>
      
      {/* Fixed position tooltip - rendered outside overflow container */}
      {hoveredPatient && (() => {
        const { patient, element } = hoveredPatient
        const pos = patientPositions.get(patient.id)
        if (!pos) return null
        
        const medication = getMedicationById(patient.medicationType)
        const medicationName = medication?.displayName || patient.medicationType
        const setupAction = patient.actions.find(a => a.type === 'setup')
        const protocolCheckAction = patient.actions.find(a => a.type === 'protocol_check')
        const removalAction = patient.actions.find(a => a.type === 'removal')
        const checkActions = patient.actions.filter(a => a.type === 'check')
        
        const rect = element.getBoundingClientRect()
        const tooltipStyle: React.CSSProperties = {
          position: 'fixed',
          zIndex: 99999,
          minWidth: '200px',
          maxWidth: '300px',
        }
        
        // Position tooltip above the element by default
        tooltipStyle.top = `${rect.top - 10}px`
        tooltipStyle.left = `${rect.left + rect.width / 2}px`
        tooltipStyle.transform = 'translate(-50%, -100%)'
        
        // Adjust if tooltip would go off screen to the right
        const tooltipWidth = 220 // approximate width
        if (rect.left + tooltipWidth / 2 > window.innerWidth) {
          tooltipStyle.left = `${window.innerWidth - tooltipWidth / 2 - 10}px`
          tooltipStyle.transform = 'translate(-100%, -100%)'
        }
        // Adjust if tooltip would go off screen to the left
        if (rect.left - tooltipWidth / 2 < 0) {
          tooltipStyle.left = `${tooltipWidth / 2 + 10}px`
          tooltipStyle.transform = 'translate(0, -100%)'
        }
        // If tooltip would go above screen, show it below instead
        if (rect.top - 150 < 0) {
          tooltipStyle.top = `${rect.bottom + 10}px`
          tooltipStyle.transform = tooltipStyle.transform?.toString().replace('translateY(-100%)', 'translateY(0)') || 'translate(-50%, 0)'
          if (tooltipStyle.transform?.includes('translate(-100%')) {
            tooltipStyle.transform = 'translate(-100%, 0)'
          } else if (tooltipStyle.transform?.includes('translate(0')) {
            tooltipStyle.transform = 'translate(0, 0)'
          } else {
            tooltipStyle.transform = 'translate(-50%, 0)'
          }
        }
        
        return (
          <div
            ref={tooltipRef}
            className="bg-slate-900 text-white px-3 py-2 rounded-lg shadow-2xl whitespace-nowrap text-sm pointer-events-none"
            style={tooltipStyle}
            onMouseEnter={() => setHoveredPatient({ patient, element })}
            onMouseLeave={() => setHoveredPatient(null)}
          >
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
          </div>
        )
      })()}
      
      {/* Legend */}
      {hasMultipleColumns && (
        <div className="mt-4 pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Zelfde kleur = zelfde starttijd</span>
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
              {uniqueStartTimes.slice(0, Math.min(uniqueStartTimes.length, 15)).map((startTime) => {
                const color = startTimeToColor.get(startTime) || colors[0]
                return (
                  <div 
                    key={startTime} 
                    className={`w-4 h-4 rounded ${color.split(' ')[0]} border border-white shadow-sm`} 
                    title={`Starttijd ${startTime}`}
                  ></div>
                )
              })}
              {uniqueStartTimes.length > 15 && (
                <div className="text-xs text-slate-500 ml-1 self-center">+{uniqueStartTimes.length - 15}</div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Patient Details Modal */}
      {selectedPatient && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-4"
          onClick={() => setSelectedPatient(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="patient-modal-title"
        >
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-blue-700 border-b-2 border-blue-800 p-4 rounded-t-xl">
              <div className="flex items-start justify-between">
                <div>
                  <h3 id="patient-modal-title" className="text-xl font-bold mb-1.5 text-white">{selectedPatient.name}</h3>
                  <div className="flex items-center gap-3 text-blue-50">
                    <div className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm">{selectedPatient.startTime}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span className="text-sm">{getTotalDuration(selectedPatient)} minuten</span>
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
                      className="text-white hover:text-red-200 hover:bg-blue-700 rounded-lg p-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600"
                      title="Behandeling verwijderen"
                      aria-label="Behandeling verwijderen"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedPatient(null)}
                    className="text-white hover:text-blue-100 hover:bg-blue-700 rounded-lg p-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600"
                    aria-label="Modal sluiten"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-5">
              {/* Medication Info */}
              <div className="mb-4">
                <h4 className="text-base font-semibold text-slate-900 mb-2.5 flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Behandeling Informatie
                </h4>
                <div className="bg-slate-50 rounded-lg p-3 border-2 border-slate-300">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs font-medium text-slate-700 mb-1">Medicatie Type</div>
                      <div className="font-semibold text-sm text-slate-900">
                        {getMedicationById(selectedPatient.medicationType)?.displayName || selectedPatient.medicationType}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-700 mb-1">Behandeling Nummer</div>
                      <div className="font-semibold text-sm text-slate-900">
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
                <h4 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  Behandeling Overzicht ({selectedPatient.actions.filter(a => a.type !== 'infusion').length} handelingen)
                </h4>
                <div className="space-y-2.5" role="list">
                  {selectedPatient.actions.map((action, index) => {
                    const isSetup = action.type === 'setup' || action.name.includes('Aanbrengen')
                    const isRemoval = action.type === 'removal' || action.name.includes('Afkoppelen')
                    const isInfusion = action.type === 'infusion' || action.name.includes('Loopt')
                    const isCheck = action.type === 'check' || action.name.includes('Controle') || action.name.includes('Check')
                    
                    // Determine color based on action type
                    let barColor = 'bg-slate-400'
                    if (isSetup) barColor = 'bg-purple-500'
                    else if (isCheck) barColor = 'bg-blue-500'
                    else if (isInfusion) barColor = 'bg-green-500'
                    else if (isRemoval) barColor = 'bg-orange-500'
                    
                    const duration = action.duration
                    const durationText = (isSetup || isRemoval) ? `~${duration}m` : `${duration}m`
                    
                    return (
                      <div 
                        key={action.id} 
                        role="listitem"
                        className="flex rounded-lg border-2 border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors overflow-hidden"
                      >
                        {/* Colored left bar */}
                        <div className={`w-2 ${barColor} flex-shrink-0`}></div>
                        
                        {/* Content */}
                        <div className="flex-1 p-3 flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-semibold text-sm text-slate-900">{action.name}</div>
                            {action.staff && action.staff !== 'Systeem' && action.staff !== 'Geen' ? (
                              <div className="text-xs text-slate-600 mt-0.5">{action.staff}</div>
                            ) : action.staff === 'Systeem' ? (
                              <div className="text-xs text-slate-600 mt-0.5">Systeem</div>
                            ) : null}
                          </div>
                          <div className="text-right ml-3">
                            <div className="font-bold text-base text-slate-900">
                              {durationText}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Summary */}
              <div className="mt-4 pt-4 border-t-2 border-slate-300">
                <div className="grid grid-cols-3 gap-3 text-center" role="group" aria-label="Behandeling samenvatting">
                  <div className="bg-slate-50 rounded-lg p-3 border-2 border-slate-300">
                    <div className="text-xl font-bold text-slate-900">{getTotalDuration(selectedPatient)}</div>
                    <div className="text-xs font-medium text-slate-700 mt-1.5">Totaal minuten</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 border-2 border-slate-300">
                    <div className="text-xl font-bold text-slate-900">
                      {selectedPatient.actions.filter(a => a.staff && a.staff !== 'Systeem' && a.staff !== 'Geen').length}
                    </div>
                    <div className="text-xs font-medium text-slate-700 mt-1.5">VPK handelingen</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 border-2 border-slate-300">
                    <div className="text-xl font-bold text-slate-900">
                      {new Set(selectedPatient.actions.filter(a => a.staff && a.staff !== 'Systeem' && a.staff !== 'Geen').map(a => a.staff)).size}
                    </div>
                    <div className="text-xs font-medium text-slate-700 mt-1.5">Verpleegkundigen</div>
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
