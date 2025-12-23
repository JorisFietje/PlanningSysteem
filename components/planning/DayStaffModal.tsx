'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { DayOfWeek, DAY_LABELS, StaffMember } from '@/types'

interface DayStaffModalProps {
  isOpen: boolean
  date: string
  day: DayOfWeek
  staffMembers: StaffMember[]
  selectedStaff: string[]
  coordinator: string | null
  onClose: () => void
  onSave: (nextStaff: string[], nextCoordinator: string | null) => void
}

export default function DayStaffModal({
  isOpen,
  date,
  day,
  staffMembers,
  selectedStaff,
  coordinator,
  onClose,
  onSave
}: DayStaffModalProps) {
  const [editingStaff, setEditingStaff] = useState<string[]>([])
  const [editingCoordinator, setEditingCoordinator] = useState<string | null>(null)
  const skipInitialSaveRef = useRef(true)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setEditingStaff([...selectedStaff])
    setEditingCoordinator(coordinator || null)
    skipInitialSaveRef.current = true
  }, [isOpen, selectedStaff, coordinator])

  useEffect(() => {
    if (!isOpen) return
    if (skipInitialSaveRef.current) {
      skipInitialSaveRef.current = false
      return
    }
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      onSave(editingStaff, editingCoordinator)
    }, 500)
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [editingStaff, editingCoordinator, isOpen, onSave])

  const toggleStaff = (name: string) => {
    setEditingStaff(prev => (prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]))
    if (editingCoordinator === name && editingStaff.includes(name)) {
      setEditingCoordinator(null)
    }
  }

  const toggleCoordinator = (name: string) => {
    setEditingCoordinator(prev => (prev === name ? null : name))
    setEditingStaff(prev => (prev.includes(name) ? prev : [...prev, name]))
  }

  const formattedDate = useMemo(() => {
    const dateObj = new Date(date + 'T00:00:00')
    const dayNum = dateObj.getDate()
    const month = dateObj.toLocaleDateString('nl-NL', { month: 'short' })
    return `${DAY_LABELS[day]} ${dayNum} ${month}`
  }, [date, day])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500">Verpleegkundigen</div>
            <h2 className="text-xl font-bold text-slate-900">{formattedDate}</h2>
            <div className="text-sm text-slate-600">{editingStaff.length} verpleegkundige(n) geselecteerd</div>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold"
          >
            Opslaan
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="text-xs text-slate-600">
            Klik op een kaart om een verpleegkundige te selecteren. Gebruik de ster om dagco te kiezen. Wijzigingen worden automatisch opgeslagen.
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {staffMembers.map(staff => {
              const isSelected = editingStaff.includes(staff.name)
              const isCoordinator = editingCoordinator === staff.name
              return (
                <div
                  key={staff.name}
                  onClick={() => toggleStaff(staff.name)}
                  className={`relative p-3 rounded-lg border-2 transition-all text-left cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 border-blue-500 text-blue-900'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-blue-300'
                  }`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      toggleStaff(staff.name)
                    }
                  }}
                >
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      toggleCoordinator(staff.name)
                    }}
                    className={`absolute right-2 top-2 w-7 h-7 rounded-full border flex items-center justify-center transition-colors ${
                      isCoordinator
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-white border-slate-200 text-slate-400 hover:text-blue-600'
                    }`}
                    aria-label={isCoordinator ? 'Dagco verwijderen' : 'Maak dagco'}
                    title={isCoordinator ? 'Dagco verwijderen' : 'Maak dagco'}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M12 3l2.7 5.45 6.02.87-4.36 4.25 1.03 6-5.39-2.83-5.39 2.83 1.03-6-4.36-4.25 6.02-.87L12 3z"
                        fill="currentColor"
                        stroke="currentColor"
                        strokeLinejoin="round"
                        strokeWidth="1.2"
                      />
                    </svg>
                  </button>
                  <div className="font-semibold text-sm">{staff.name}</div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    Max {staff.maxPatients} pat.
                    {staff.maxWorkTime && ` • Tot ${Math.floor(staff.maxWorkTime / 60) + 8}:00`}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600">
              Dagco: <strong>{editingCoordinator || 'Geen'}</strong>
            </div>
          </div>

          {editingStaff.length > 0 && (
            <div className="p-3 bg-blue-50 rounded-lg">
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
      </div>
    </div>
  )
}
