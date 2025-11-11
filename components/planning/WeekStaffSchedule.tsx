'use client'

import { useState } from 'react'
import { DayOfWeek, DAY_LABELS, StaffMember } from '@/types'

interface WeekStaffScheduleProps {
  weekDates: string[]
  staffSchedule: Record<DayOfWeek, string[]>
  setStaffSchedule: (schedule: Record<DayOfWeek, string[]>) => void
  staffMembers: StaffMember[]
  onRebalanceDay?: (day: DayOfWeek) => void
  coordinatorByDay?: Record<DayOfWeek, string | null>
  setCoordinatorByDay?: (value: Record<DayOfWeek, string | null>) => void
  onStaffAdded?: () => void
}

export default function WeekStaffSchedule({
  weekDates,
  staffSchedule,
  setStaffSchedule,
  staffMembers,
  onRebalanceDay,
  coordinatorByDay,
  setCoordinatorByDay,
  onStaffAdded
}: WeekStaffScheduleProps) {
  const [editingDay, setEditingDay] = useState<DayOfWeek | null>(null)
  const [editingStaff, setEditingStaff] = useState<string[]>([])
  const [editingCoordinator, setEditingCoordinator] = useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newMaxPatients, setNewMaxPatients] = useState<number>(10)
  const [newMaxWorkTime, setNewMaxWorkTime] = useState<number | ''>('')

  const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']

  const handleEditDay = (day: DayOfWeek) => {
    setEditingDay(day)
    setEditingStaff([...staffSchedule[day]])
    setEditingCoordinator(coordinatorByDay ? coordinatorByDay[day] || null : null)
  }

  const handleSaveDay = (day: DayOfWeek) => {
    setStaffSchedule({
      ...staffSchedule,
      [day]: [...editingStaff]
    })
    if (setCoordinatorByDay && coordinatorByDay) {
      setCoordinatorByDay({
        ...coordinatorByDay,
        [day]: editingCoordinator || null
      })
    }
    setEditingDay(null)
    setEditingStaff([])
    setEditingCoordinator(null)
  }

  const handleCancelEdit = () => {
    setEditingDay(null)
    setEditingStaff([])
    setEditingCoordinator(null)
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
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">Verpleegkundigen Rooster</h2>
          <div className="relative group">
            <svg 
              className="w-5 h-5 text-blue-600 flex-shrink-0 cursor-help" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
              aria-label="Informatie"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {/* Tooltip */}
            <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-slate-900 text-white text-sm rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
              <p className="text-white">
                Selecteer per dag welke verpleegkundigen werken. Je kunt later per dag aanpassingen maken (bijv. max patiënten, werktijd).
              </p>
              {/* Arrow */}
              <div className="absolute bottom-full left-4 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-slate-900"></div>
            </div>
          </div>
          </div>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            Nieuwe Verpleegkundige
          </button>
        </div>
      </div>

      {isCreateOpen && (
        <div className="mb-5 p-4 border-2 border-indigo-200 rounded-lg bg-indigo-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Naam"
              className="px-3 py-2 rounded-md border-2 border-slate-200 bg-white text-slate-900 text-sm"
            />
            <input
              type="number"
              min={1}
              value={newMaxPatients}
              onChange={(e) => setNewMaxPatients(parseInt(e.target.value || '0', 10))}
              placeholder="Max patiënten"
              className="px-3 py-2 rounded-md border-2 border-slate-200 bg-white text-slate-900 text-sm"
            />
            <input
              type="number"
              min={0}
              step={30}
              value={newMaxWorkTime === '' ? '' : newMaxWorkTime}
              onChange={(e) => setNewMaxWorkTime(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
              placeholder="Max werktijd (minuten vanaf 08:00, optioneel)"
              className="px-3 py-2 rounded-md border-2 border-slate-200 bg-white text-slate-900 text-sm"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={async () => {
                const trimmed = newName.trim()
                if (!trimmed) {
                  alert('Vul een naam in')
                  return
                }
                if (!newMaxPatients || Number.isNaN(newMaxPatients) || newMaxPatients < 1) {
                  alert('Vul een geldig maximum patiënten in (minimaal 1)')
                  return
                }
                // Prevent duplicate by quick client check
                if (staffMembers.some(s => s.name.toLowerCase() === trimmed.toLowerCase())) {
                  alert(`Verpleegkundige "${trimmed}" bestaat al`)
                  return
                }
                const res = await fetch('/api/staff', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name: trimmed,
                    maxPatients: Number(newMaxPatients),
                    maxWorkTime: newMaxWorkTime === '' ? null : Number(newMaxWorkTime),
                    workDays: []
                  })
                })
                if (res.ok) {
                  setIsCreateOpen(false)
                  setNewName('')
                  setNewMaxPatients(10)
                  setNewMaxWorkTime('')
                  onStaffAdded && onStaffAdded()
                } else {
                  try {
                    const data = await res.json()
                    alert(data?.error || 'Aanmaken mislukt')
                  } catch {
                    alert('Aanmaken mislukt')
                  }
                }
              }}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              Opslaan
            </button>
            <button
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 bg-slate-300 hover:bg-slate-400 text-slate-700 rounded-lg text-sm font-semibold transition-colors"
            >
              Annuleren
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3.5">
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
                    <h3 className="font-bold text-base text-slate-900">
                      {getDayLabel(date, day)}
                    </h3>
                    <p className="text-xs text-slate-600">
                      {staffForDay.length > 0
                        ? `${staffForDay.length} verpleegkundige${staffForDay.length > 1 ? 'n' : ''} ingeroosterd`
                        : 'Geen verpleegkundigen ingeroosterd'}
                    </p>
                  </div>
                  {!isEditing ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditDay(day)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-sm font-semibold transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Bewerk
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveDay(day)}
                        className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg text-sm font-semibold transition-colors"
                      >
                        Opslaan
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="px-4 py-2 bg-slate-300 hover:bg-slate-400 text-slate-700 rounded-lg text-sm font-semibold transition-colors"
                      >
                        Annuleren
                      </button>
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-3">
                    <div className="text-xs font-medium text-slate-700 mb-2">
                      Selecteer verpleegkundigen (meerdere mogelijk):
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
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
                            <div className="font-semibold text-sm">{staff.name}</div>
                            <div className="text-xs text-slate-600 mt-0.5">
                              Max {staff.maxPatients} pat.
                              {staff.maxWorkTime && ` • Tot ${Math.floor(staff.maxWorkTime / 60) + 8}:00`}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                    <div className="mt-4">
                      <div className="text-xs font-medium text-slate-700 mb-2">Dagcoördinator (optioneel):</div>
                      <div className="flex gap-2 items-center">
                        <select
                          value={editingCoordinator || ''}
                          onChange={(e) => setEditingCoordinator(e.target.value || null)}
                          className="px-3 py-2 rounded-md border-2 border-slate-200 bg-white text-slate-900 text-sm"
                        >
                          <option value="">Geen</option>
                          {editingStaff.map(name => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                        {editingCoordinator && (
                          <span className="text-xs text-slate-600">
                            Geselecteerd: <strong>{editingCoordinator}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                    {editingStaff.length > 0 && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                        <div className="text-xs font-medium text-blue-900 mb-2">
                          Geselecteerd ({editingStaff.length}):
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {editingStaff.map(name => (
                            <span
                              key={name}
                              className="px-3 py-1 bg-blue-700 text-white rounded-full text-xs font-medium"
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2.5">
                    {staffForDay.length > 0 ? (
                      staffForDay.map(name => {
                        const staff = staffMembers.find(s => s.name === name)
                        const isCoordinator = coordinatorByDay && coordinatorByDay[day] === name
                        return (
                          <div
                            key={name}
                            className={`px-3.5 py-2 rounded-lg border ${
                              isCoordinator
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'bg-blue-50 border-blue-300 text-blue-900'
                            }`}
                          >
                            <div className={`font-semibold text-sm ${isCoordinator ? 'text-white' : 'text-blue-900'} flex items-center gap-1.5`}>
                              <span>{name}</span>
                            </div>
                            {staff && (
                              <div className={`text-xs ${isCoordinator ? 'text-white/90' : 'text-blue-700'}`}>
                                Max {staff.maxPatients} pat.
                                {staff.maxWorkTime && ` • Tot ${Math.floor(staff.maxWorkTime / 60) + 8}:00`}
                              </div>
                            )}
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-xs text-slate-400 italic">Klik op "Bewerk" om verpleegkundigen toe te voegen</div>
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

