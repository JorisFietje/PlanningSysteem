'use client'

import { DayOfWeek, DAY_LABELS, StaffMember, getDayOfWeekFromDate, getDailyPatientCapacity } from '@/types'
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
  isGenerating: boolean
}

export default function WeekOverview({
  weekDates,
  staffSchedule,
  treatments,
  staffMembers,
  generatedPatients,
  onGenerate,
  isGenerating
}: WeekOverviewProps) {
  const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']

  const totalTreatments = treatments.reduce((sum, t) => sum + t.quantity, 0)

  const getDayCapacity = (day: DayOfWeek) => {
    const staffForDay = staffSchedule[day]
    const availableStaff = staffMembers.filter(s => staffForDay.includes(s.name))
    return getDailyPatientCapacity(day, availableStaff)
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
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Week Overzicht</h2>
            <p className="text-slate-600">
              Bekijk de weekplanning en genereer automatisch de patiënten planning
            </p>
          </div>
          <button
            onClick={onGenerate}
            disabled={isGenerating || totalTreatments === 0}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              isGenerating || totalTreatments === 0
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isGenerating ? 'Genereren...' : 'Genereer Planning'}
          </button>
        </div>

        {totalTreatments === 0 && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="text-amber-800 font-semibold"> Geen behandelingen toegevoegd</div>
            <div className="text-amber-700 text-sm mt-1">
              Voeg eerst behandelingen toe in het "Behandelingen" tabblad
            </div>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm text-blue-600 font-medium mb-1">Totaal Behandelingen</div>
          <div className="text-3xl font-bold text-blue-900">{totalTreatments}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-sm text-green-600 font-medium mb-1">Week Capaciteit</div>
          <div className="text-3xl font-bold text-green-900">{totalWeekCapacity}</div>
          <div className="text-xs text-green-600 mt-1">Totaal patiënten capaciteit</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm text-blue-600 font-medium mb-1">Gegenereerde Patiënten</div>
          <div className="text-3xl font-bold text-blue-900">{generatedPatients.length}</div>
          <div className="text-xs text-blue-600 mt-1">
            {generatedPatients.length > 0 ? 'Planning gegenereerd' : 'Nog niet gegenereerd'}
          </div>
        </div>
      </div>

      {/* Daily Breakdown */}
      <div className="mb-6">
        <h3 className="font-bold text-lg mb-4 text-slate-900">Dagelijkse Capaciteit</h3>
        <div className="space-y-3">
          {days.map((day, index) => {
            const date = weekDates[index]
            const staffForDay = staffSchedule[day]
            const capacity = getDayCapacity(day)
            const availableStaff = staffMembers.filter(s => staffForDay.includes(s.name))

            return (
              <div
                key={day}
                className="border-2 border-slate-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-lg text-slate-900">
                      {getDayLabel(date, day)}
                    </h4>
                    <div className="text-sm text-slate-600 mt-1">
                      {staffForDay.length > 0
                        ? `${staffForDay.length} verpleegkundige${staffForDay.length > 1 ? 'n' : ''}: ${staffForDay.join(', ')}`
                        : 'Geen verpleegkundigen ingeroosterd'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">
                      {capacity.total}
                    </div>
                    <div className="text-xs text-slate-600">
                      Max capaciteit
                    </div>
                    <div className="text-sm text-slate-500 mt-1">
                      Doel: {capacity.min}-{capacity.max}
                    </div>
                  </div>
                </div>

                {availableStaff.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {availableStaff.map(staff => (
                        <div
                          key={staff.name}
                          className="p-2 bg-slate-50 rounded border border-slate-200"
                        >
                          <div className="font-semibold text-sm text-slate-900">{staff.name}</div>
                          <div className="text-xs text-slate-600">
                            Max {staff.maxPatients} pat.
                            {staff.maxWorkTime && ` • Tot ${Math.floor(staff.maxWorkTime / 60) + 8}:00`}
                          </div>
                        </div>
                      ))}
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
        <h3 className="font-bold text-lg mb-4 text-slate-900">Behandelingen Overzicht</h3>
        {treatments.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 rounded-lg border border-slate-200 text-slate-500">
            Geen behandelingen toegevoegd
          </div>
        ) : (
          <div className="space-y-2">
            {treatments.map((treatment, index) => {
              const medication = MEDICATIONS.find(m => m.id === treatment.medicationId)
              return (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                >
                  <div>
                    <div className="font-semibold text-slate-900">
                      {medication?.displayName || treatment.medicationId}
                    </div>
                    <div className="text-sm text-slate-600">
                      Behandeling {treatment.treatmentNumber}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">
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

