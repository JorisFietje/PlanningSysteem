'use client'

import { Patient } from '@/types'
import { getTotalDuration } from '@/utils/planning/workload'
import { getMedicationById, getMedicationVariant, isCheckDisabledMedication } from '@/types/medications'

interface TreatmentBoxesProps {
  patients: Patient[]
  onEditPatient?: (patient: Patient) => void
}

export default function TreatmentBoxes({ patients, onEditPatient }: TreatmentBoxesProps) {
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {patients.map(patient => {
            const totalDuration = getTotalDuration(patient)
            
            // Extract medication name from patient name (remove "Patiënt X - " prefix)
            const medication = getMedicationById(patient.medicationType)
            const displayName = medication?.displayName || patient.medicationType
            const variant = getMedicationVariant(patient.medicationType, patient.treatmentNumber)
            const allowChecks = !isCheckDisabledMedication(patient.medicationType) && Boolean(variant?.actions?.some(action => action.type === 'check'))
            // Remove "Patiënt X - " prefix if present
            const cleanName = patient.name.includes(' - ') 
              ? patient.name.split(' - ').slice(1).join(' - ')
              : displayName

            return (
              <div
                key={patient.id}
                className="bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-slate-200 rounded-xl p-4 hover:border-blue-500 hover:shadow-lg transition-all"
              >
                <div className="flex justify-between items-center pb-3 mb-3 border-b-2 border-slate-200">
                  <h3 className="text-base font-bold text-slate-900 truncate" title={cleanName}>{cleanName}</h3>
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
                      
                      // Hide checks when not configured in the medicatie builder
                      if (isCheck && !allowChecks) {
                        return null
                      }
                      // Skip check actions with 0 duration (they happen during infusion)
                      if (isCheck && action.duration === 0) {
                        return null
                      }
                      
                      const borderColor = isSetup ? 'border-purple-600' : 
                                        isRemoval ? 'border-orange-600' : 
                                        isInfusion ? 'border-green-600' :
                                        'border-blue-600'
                      
                      return (
                        <div
                          key={action.id}
                          className={`bg-white p-2 rounded-lg border-l-4 ${borderColor} flex justify-between items-center gap-2`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm text-slate-900 truncate" title={action.name}>
                              {action.name}
                            </div>
                            <div className="text-xs text-slate-600 truncate mt-0.5" title={action.staff}>
                              {action.staff || 'Automatisch'}
                            </div>
                          </div>
                          <div className="flex items-center justify-center flex-shrink-0 min-w-[50px]">
                            <span className="text-sm text-slate-700 font-semibold">
                              {(isSetup || isRemoval) ? `~${action.duration}m` : `${action.duration}m`}
                            </span>
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
