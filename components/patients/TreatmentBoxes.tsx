'use client'

import { Patient } from '@/types'
import { getTotalDuration } from '@/utils/planning/workload'

interface TreatmentBoxesProps {
  patients: Patient[]
  onDeleteAction: (actionId: string) => void
  onEditPatient?: (patient: Patient) => void
}

export default function TreatmentBoxes({ patients, onDeleteAction, onEditPatient }: TreatmentBoxesProps) {
  if (patients.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold mb-6 text-slate-900 border-b pb-3">Behandelingsvakken</h2>
        <div className="text-center py-16">
          <div className="text-4xl mb-2 text-slate-300">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div className="text-lg text-slate-500">Geen behandelingen</div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 h-full flex flex-col">
      <h2 className="text-xl font-bold mb-6 text-slate-900 border-b pb-3">Behandelingsvakken</h2>
      <div className="flex-1 overflow-y-auto pr-2">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {patients.map(patient => {
            const totalDuration = getTotalDuration(patient)

            return (
              <div
                key={patient.id}
                className="bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-slate-200 rounded-xl p-4 hover:border-blue-500 hover:shadow-lg transition-all"
              >
                <div className="flex justify-between items-center pb-3 mb-3 border-b-2 border-slate-200">
                  <h3 className="text-base font-bold text-slate-900 truncate" title={patient.name}>{patient.name}</h3>
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                      {patient.startTime}
                    </div>
                    {onEditPatient && (
                      <button
                        onClick={() => onEditPatient(patient)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        title="Bewerk behandeling"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {patient.actions.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 italic text-sm">
                    Nog geen handelingen
                  </div>
                ) : (
                  <div className="space-y-2">
                    {patient.actions.map(action => {
                      const isSetup = action.name.includes('Aanbrengen')
                      const isRemoval = action.name.includes('Afkoppelen')
                      const isCheck = action.name.includes('Check')
                      const isInfusion = action.name.includes('Loopt')
                      
                      // Skip check actions with 0 duration (they happen during infusion)
                      if (isCheck && action.duration === 0) {
                        return null
                      }
                      
                      const borderColor = isSetup ? 'border-purple-600' : 
                                        isRemoval ? 'border-orange-600' : 
                                        isInfusion ? 'border-green-600' :
                                        'border-blue-600'
                      const badgeColor = isSetup ? 'bg-purple-600' : 
                                        isRemoval ? 'bg-orange-600' : 
                                        isInfusion ? 'bg-green-600' :
                                        'bg-blue-600'
                      
                      return (
                        <div
                          key={action.id}
                          className={`bg-white p-2 rounded-lg border-l-4 ${borderColor} flex justify-between items-center gap-2`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm text-slate-900 truncate" title={action.name}>
                              {action.name}
                            </div>
                            <div className="text-xs text-slate-600 truncate" title={action.staff}>
                              {action.staff || 'Automatisch'}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <div className={`${badgeColor} text-white px-2 py-1 rounded-md font-semibold text-xs`}>
                              {action.duration}m
                            </div>
                            {!isInfusion && (
                              <button
                                onClick={() => onDeleteAction(action.id)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                title="Verwijder handeling"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    <div className="text-xs text-slate-600 pt-2 border-t border-slate-200 text-right">
                      Totaal: {totalDuration} minuten
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

