'use client'

import { DayOfWeek, StaffMember, getDayCoordinators, getDaycoPatientsCount } from '@/types'

interface CapOverviewWeek {
  weekStart: string
  dates: string[]
  staffSchedule: Record<DayOfWeek, string[]>
  coordinatorByDay: Record<DayOfWeek, string | null>
  dayCapacities: Record<string, { plannedPatients?: number | null; agreedMaxPatients?: number | null; note?: string | null; sennaNote?: string | null }>
}

interface CapOverviewProps {
  weeks: CapOverviewWeek[]
  staffMembers: StaffMember[]
  plannedCounts: Record<string, number>
  onEditDayStaff: (weekStart: string, date: string, day: DayOfWeek) => void
  onUpdateDayCapacity: (
    weekStart: string,
    date: string,
    updates: { plannedPatients?: number | null; agreedMaxPatients?: number | null; note?: string | null; sennaNote?: string | null }
  ) => void
}

const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
const dayLabelShort: Record<DayOfWeek, string> = {
  monday: 'ma',
  tuesday: 'di',
  wednesday: 'wo',
  thursday: 'do',
  friday: 'vr'
}

const getWeekNumber = (date: Date): number => {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = target.getUTCDay() || 7
  target.setUTCDate(target.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1))
  return Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

const parseNumericInput = (value: string): number | null => {
  if (value.trim() === '') return null
  const parsed = parseInt(value, 10)
  if (Number.isNaN(parsed)) return null
  return parsed
}

export default function CapOverview({ weeks, staffMembers, plannedCounts, onEditDayStaff, onUpdateDayCapacity }: CapOverviewProps) {
  const dayCoordinators = getDayCoordinators()

  const getDayLabel = (date: string) => {
    const dateObj = new Date(date + 'T00:00:00')
    return `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getFullYear()}`
  }

  const getPlannedStatus = (planned: number | null, base: number) => {
    if (planned === null) return 'empty'
    if (planned > base) return 'over'
    if (planned === base) return 'equal'
    return 'under'
  }

  const plannedColor = (status: string) => {
    if (status === 'over') return 'bg-red-100 text-red-900 border-red-200'
    if (status === 'equal') return 'bg-yellow-100 text-yellow-900 border-yellow-200'
    if (status === 'under') return 'bg-green-100 text-green-900 border-green-200'
    return 'bg-white text-slate-700 border-slate-200'
  }

  const overschrijdingColor = (status: string) => {
    if (status === 'over') return 'bg-red-100 text-red-700 border-red-200'
    if (status === 'equal') return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    if (status === 'under') return 'bg-green-100 text-green-700 border-green-200'
    return 'bg-slate-50 text-slate-500 border-slate-200'
  }

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[1400px]">
            <div className="grid grid-cols-[120px_70px_130px_220px_140px_110px_240px_90px_220px_140px_220px] bg-slate-50 text-xs font-semibold text-slate-600 px-3 py-2 border-b border-slate-200 sticky top-0 z-10">
              <div>Datum</div>
              <div className="text-center">Weekdag</div>
              <div className="text-center">Aantal patiënten</div>
              <div className="text-center">Max aantal patiënten afgesproken</div>
              <div className="text-center">Max capaciteit</div>
              <div className="text-center">Overschrijding</div>
              <div>Opmerking</div>
              <div className="text-center">Aantal vpk</div>
              <div>Naam verpleegkundige</div>
              <div className="text-center">Dagco (naam)</div>
              <div>Opmerkingen Senna</div>
            </div>

        {weeks.map((week) => {
          const weekStartDate = new Date(week.weekStart + 'T00:00:00')
          const weekNumber = getWeekNumber(weekStartDate)

          return (
            <div key={week.weekStart}>
              <div className="grid grid-cols-[120px_70px_130px_220px_140px_110px_240px_90px_220px_140px_220px] bg-slate-100 text-xs font-semibold text-slate-600 px-3 py-2 border-b border-slate-200">
                <div className="col-span-11">Week {weekNumber}</div>
              </div>
              {days.map((day, index) => {
                const date = week.dates[index]
                const staffForDay = week.staffSchedule[day]
                const availableStaff = staffMembers.filter(s => staffForDay.includes(s.name))
                const coordinator = week.coordinatorByDay[day] || dayCoordinators[day]
                const regularStaff = coordinator ? availableStaff.filter(s => s.name !== coordinator) : availableStaff
                const regularCapacity = regularStaff.reduce((sum, s) => sum + s.maxPatients, 0)
                const maxCapacity = regularCapacity + (coordinator ? getDaycoPatientsCount() : 0)
                const capacity = week.dayCapacities[date] || {}
                const agreedMax = capacity.agreedMaxPatients ?? null
                const planned = plannedCounts[date] ?? capacity.plannedPatients ?? null
                const overschrijdingBase = agreedMax ?? maxCapacity
                const overschrijding = planned !== null ? Math.max(0, planned - overschrijdingBase) : null
                const status = getPlannedStatus(planned, overschrijdingBase)

                return (
                  <div
                    key={`${week.weekStart}-${day}`}
                    className="grid grid-cols-[120px_70px_130px_220px_140px_110px_240px_90px_220px_140px_220px] items-center text-sm px-3 py-2 border-b border-slate-100 last:border-b-0 odd:bg-white even:bg-slate-50"
                  >
                    <div className="text-slate-900 font-semibold">{getDayLabel(date)}</div>
                    <div className="text-slate-600 text-center">{dayLabelShort[day]}</div>
                    <div>
                      <div className={`w-full px-2 py-1 border rounded text-sm text-center ${plannedColor(status)}`}>
                        {planned ?? '—'}
                      </div>
                    </div>
                    <div>
                      <input
                        type="number"
                        min={0}
                        value={agreedMax ?? ''}
                        onChange={(e) => onUpdateDayCapacity(week.weekStart, date, { agreedMaxPatients: parseNumericInput(e.target.value) })}
                        className="w-full px-2 py-1 border border-slate-200 rounded text-sm text-center"
                        placeholder={`${maxCapacity}`}
                      />
                    </div>
                    <div className="text-slate-900 font-semibold text-center">{maxCapacity}</div>
                    <div className="flex items-center justify-center">
                      <span className={`px-2 py-1 rounded border text-xs font-semibold ${overschrijdingColor(status)}`}>
                        {overschrijding && overschrijding > 0 ? `+${overschrijding}` : status === 'equal' ? '0' : ''}
                      </span>
                    </div>
                    <div>
                      <input
                        type="text"
                        value={capacity.note ?? ''}
                        onChange={(e) => onUpdateDayCapacity(week.weekStart, date, { note: e.target.value })}
                        className="w-full px-2 py-1 border border-slate-200 rounded text-sm"
                        placeholder="—"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => onEditDayStaff(week.weekStart, date, day)}
                      className="text-slate-700 text-center hover:text-blue-700 transition-colors"
                      title="Verpleegkundigen bewerken"
                    >
                      {staffForDay.length || '—'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditDayStaff(week.weekStart, date, day)}
                      className="text-slate-600 truncate text-left hover:text-blue-700 transition-colors"
                      title="Verpleegkundigen bewerken"
                    >
                      {staffForDay.length > 0 ? staffForDay.join(', ') : '—'}
                    </button>
                    <div className="text-slate-600 text-center">{coordinator || '—'}</div>
                    <div>
                      <input
                        type="text"
                        value={capacity.sennaNote ?? ''}
                        onChange={(e) => onUpdateDayCapacity(week.weekStart, date, { sennaNote: e.target.value })}
                        className="w-full px-2 py-1 border border-slate-200 rounded text-sm"
                        placeholder="—"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
          </div>
        </div>
      </div>
    </div>
  )
}
