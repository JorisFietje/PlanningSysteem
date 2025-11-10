'use client'

import { DayOfWeek, DAY_LABELS, StaffMember, getDayOfWeekFromDate, getDailyPatientCapacity, getDayCoordinators } from '@/types'
import { MEDICATIONS } from '@/types'

interface WeekOverviewProps {
  weekDates: string[]
  staffSchedule: Record<DayOfWeek, string[]>
  treatments: Array<{
    medicationId: string
    treatmentNumber: number
    quantity: number
  }>
  staffMembers: StaffMember[]
  generatedPatients: string[]
  onGenerate: () => void
  onDelete?: () => void
  isGenerating: boolean
}

export default function WeekOverview({
  weekDates,
  staffSchedule,
  treatments,
  staffMembers,
  generatedPatients,
  onGenerate,
  onDelete,
  isGenerating
}: WeekOverviewProps) {
  const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']

  const totalTreatments = treatments.reduce((sum, t) => sum + t.quantity, 0)

  const getDayCapacity = (day: DayOfWeek) => {
    const staffForDay = staffSchedule[day]
    const availableStaff = staffMembers.filter(s => staffForDay.includes(s.name))
    
    // Get day coordinators - coordinator is 4th person, separate from the 3 VPK
    const dayCoordinators = getDayCoordinators()
    const coordinator = dayCoordinators[day]
    
    // Filter out coordinator from regular staff (coordinator is 4th person)
    const regularStaff = coordinator ? availableStaff.filter(s => s.name !== coordinator) : availableStaff
    
    // Calculate capacity: 3 regular staff + coordinator (5 patients) if coordinator exists
    const regularCapacity = regularStaff.reduce((sum, s) => sum + s.maxPatients, 0)
    const coordinatorCapacity = coordinator ? 5 : 0 // Coordinator always adds 5 if present
    const totalCapacity = regularCapacity + coordinatorCapacity
    
    // Target is 90% of capacity for minimum, max is the total capacity
    const min = Math.floor(totalCapacity * 0.90)
    const max = totalCapacity
    
    return { min, max, total: totalCapacity }
  }

  const totalWeekCapacity = days.reduce((sum, day) => {
    const capacity = getDayCapacity(day)
    return sum + capacity.total
  }, 0)

  const getDayLabel = (date: string, day: DayOfWeek) => {
    const dateObj = new Date(date + 'T00:00:00')
    const dayNum = dateObj.getDate()
    const month = dateObj.toLocaleDateString('nl-NL', { month: 'short' })
    return `${DAY_LABELS[day]} ${dayNum} ${month}`
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-1">Week Overzicht</h2>
            <p className="text-sm text-slate-600">
              Bekijk de weekplanning en genereer automatisch de patiënten planning
            </p>
          </div>
          <div className="flex items-center gap-2">
            {generatedPatients.length > 0 && onDelete && (
              <button
                onClick={onDelete}
                className="px-5 py-2 text-sm rounded-lg font-semibold transition-colors bg-red-600 hover:bg-red-700 text-white"
              >
                Verwijder Planning
              </button>
            )}
            <button
              onClick={onGenerate}
              disabled={isGenerating || totalTreatments === 0}
              className={`px-5 py-2 text-sm rounded-lg font-semibold transition-colors ${
                isGenerating || totalTreatments === 0
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-blue-700 hover:bg-blue-800 text-white'
              }`}
            >
              {isGenerating ? 'Genereren...' : 'Genereer Planning'}
            </button>
          </div>
        </div>

      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-xs text-blue-600 font-medium mb-1">Totaal Behandelingen</div>
          <div className="text-2xl font-bold text-blue-900">{totalTreatments}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="text-xs text-green-600 font-medium mb-1">Week Capaciteit</div>
          <div className="text-2xl font-bold text-green-900">{totalWeekCapacity}</div>
          <div className="text-xs text-green-600 mt-0.5">Totaal patiënten capaciteit</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-xs text-blue-600 font-medium mb-1">Gegenereerde Patiënten</div>
          <div className="text-2xl font-bold text-blue-900">{generatedPatients.length}</div>
          <div className="text-xs text-blue-600 mt-0.5">
            {generatedPatients.length > 0 ? 'Planning gegenereerd' : 'Nog niet gegenereerd'}
          </div>
        </div>
      </div>

      {/* Daily Breakdown */}
      <div className="mb-4">
        <h3 className="font-bold text-base mb-3 text-slate-900">Dagelijkse Capaciteit</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {days.map((day, index) => {
            const date = weekDates[index]
            const staffForDay = staffSchedule[day]
            const capacity = getDayCapacity(day)
            const availableStaff = staffMembers.filter(s => staffForDay.includes(s.name))

            return (
              <div
                key={day}
                className="border-2 border-slate-200 rounded-lg p-3 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm text-slate-900 mb-1">
                      {getDayLabel(date, day)}
                    </h4>
                    <div className="text-xs text-slate-600">
                      {staffForDay.length > 0
                        ? `${staffForDay.length} VPK: ${staffForDay.slice(0, 2).join(', ')}${staffForDay.length > 2 ? ` +${staffForDay.length - 2}` : ''}`
                        : 'Geen VPK ingeroosterd'}
                    </div>
                  </div>
                  <div className="text-right ml-3 flex-shrink-0">
                    <div className="text-xl font-bold text-blue-600">
                      {capacity.total}
                    </div>
                    <div className="text-xs text-slate-600">
                      Max capaciteit
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Doel: {capacity.min}-{capacity.max}
                    </div>
                  </div>
                </div>

                {availableStaff.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-200">
                    <div className="grid grid-cols-2 gap-1.5">
                      {availableStaff.slice(0, 4).map(staff => (
                        <div
                          key={staff.name}
                          className="p-1.5 bg-slate-50 rounded border border-slate-200"
                        >
                          <div className="font-semibold text-xs text-slate-900 truncate">{staff.name}</div>
                          <div className="text-xs text-slate-600">
                            Max {staff.maxPatients}
                            {staff.maxWorkTime && ` • ${Math.floor(staff.maxWorkTime / 60) + 8}:00`}
                          </div>
                        </div>
                      ))}
                      {availableStaff.length > 4 && (
                        <div className="p-1.5 bg-slate-100 rounded border border-slate-300 text-xs text-slate-600 flex items-center justify-center">
                          +{availableStaff.length - 4} meer
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Treatments Summary */}
      <div>
        <h3 className="font-bold text-base mb-3 text-slate-900">Behandelingen Overzicht</h3>
        {treatments.length === 0 ? (
          <div className="text-center py-6 bg-slate-50 rounded-lg border border-slate-200 text-slate-500 text-sm">
            Geen behandelingen toegevoegd
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {treatments.map((treatment, index) => {
              const medication = MEDICATIONS.find(m => m.id === treatment.medicationId)
              return (
                <div
                  key={index}
                  className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-slate-900 truncate">
                      {medication?.displayName || treatment.medicationId}
                    </div>
                    <div className="text-xs text-slate-600">
                      Behandeling {treatment.treatmentNumber}
                    </div>
                  </div>
                  <div className="text-right ml-3 flex-shrink-0">
                    <div className="text-lg font-bold text-blue-600">
                      {treatment.quantity}x
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

