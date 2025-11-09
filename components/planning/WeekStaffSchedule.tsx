'use client'

import { useState } from 'react'
import { DayOfWeek, DAY_LABELS, StaffMember } from '@/types'

interface WeekStaffScheduleProps {
  weekDates: string[]
  staffSchedule: Record<DayOfWeek, string[]>
  setStaffSchedule: (schedule: Record<DayOfWeek, string[]>) => void
  staffMembers: StaffMember[]
}

export default function WeekStaffSchedule({
  weekDates,
  staffSchedule,
  setStaffSchedule,
  staffMembers
}: WeekStaffScheduleProps) {
  const [editingDay, setEditingDay] = useState<DayOfWeek | null>(null)
  const [editingStaff, setEditingStaff] = useState<string[]>([])

  const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']

  const handleEditDay = (day: DayOfWeek) => {
    setEditingDay(day)
    setEditingStaff([...staffSchedule[day]])
  }

  const handleSaveDay = (day: DayOfWeek) => {
    setStaffSchedule({
      ...staffSchedule,
      [day]: [...editingStaff]
    })
    setEditingDay(null)
    setEditingStaff([])
  }

  const handleCancelEdit = () => {
    setEditingDay(null)
    setEditingStaff([])
  }

  const toggleStaff = (staffName: string) => {
    if (editingStaff.includes(staffName)) {
      setEditingStaff(editingStaff.filter(s => s !== staffName))
    } else {
      setEditingStaff([...editingStaff, staffName])
    }
  }

  const getDayLabel = (date: string, day: DayOfWeek) => {
    const dateObj = new Date(date + 'T00:00:00')
    const dayNum = dateObj.getDate()
    const month = dateObj.toLocaleDateString('nl-NL', { month: 'short' })
    return `${DAY_LABELS[day]} ${dayNum} ${month}`
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Verpleegkundigen Rooster</h2>
        <p className="text-slate-600">
          Selecteer per dag welke verpleegkundigen werken. Je kunt later per dag aanpassingen maken (bijv. max patiënten, werktijd).
        </p>
      </div>

      <div className="space-y-4">
        {days.map((day, index) => {
          const date = weekDates[index]
          const staffForDay = staffSchedule[day]
          const isEditing = editingDay === day

          return (
              <div
                key={day}
                className="border-2 border-slate-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">
                      {getDayLabel(date, day)}
                    </h3>
                    <p className="text-sm text-slate-600">
                      {staffForDay.length > 0
                        ? `${staffForDay.length} verpleegkundige${staffForDay.length > 1 ? 'n' : ''} ingeroosterd`
                        : 'Geen verpleegkundigen ingeroosterd'}
                    </p>
                  </div>
                  {!isEditing ? (
                    <button
                      onClick={() => handleEditDay(day)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Bewerk
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveDay(day)}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
                      >
                        Opslaan
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="px-4 py-2 bg-slate-300 hover:bg-slate-400 text-slate-700 rounded-lg font-semibold transition-colors"
                      >
                        Annuleren
                      </button>
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-slate-700 mb-2">
                      Selecteer verpleegkundigen (meerdere mogelijk):
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {staffMembers.map(staff => {
                        const isSelected = editingStaff.includes(staff.name)
                        return (
                          <button
                            key={staff.name}
                            onClick={() => toggleStaff(staff.name)}
                            className={`p-3 rounded-lg border-2 transition-all text-left ${
                              isSelected
                                ? 'bg-blue-50 border-blue-500 text-blue-900'
                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-blue-300'
                            }`}
                          >
                            <div className="font-semibold">{staff.name}</div>
                            <div className="text-xs text-slate-600 mt-1">
                              Max {staff.maxPatients} pat.
                              {staff.maxWorkTime && ` • Tot ${Math.floor(staff.maxWorkTime / 60) + 8}:00`}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                    {editingStaff.length > 0 && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                        <div className="text-sm font-medium text-blue-900 mb-1">
                          Geselecteerd ({editingStaff.length}):
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {editingStaff.map(name => (
                            <span
                              key={name}
                              className="px-3 py-1 bg-blue-600 text-white rounded-full text-sm font-medium"
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {staffForDay.length > 0 ? (
                      staffForDay.map(name => {
                        const staff = staffMembers.find(s => s.name === name)
                        return (
                          <div
                            key={name}
                            className="px-4 py-2 bg-blue-50 border border-blue-300 rounded-lg"
                          >
                            <div className="font-semibold text-blue-900">{name}</div>
                            {staff && (
                              <div className="text-xs text-blue-700">
                                Max {staff.maxPatients} pat.
                                {staff.maxWorkTime && ` • Tot ${Math.floor(staff.maxWorkTime / 60) + 8}:00`}
                              </div>
                            )}
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-slate-400 italic">Klik op "Bewerk" om verpleegkundigen toe te voegen</div>
                    )}
                  </div>
                )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

