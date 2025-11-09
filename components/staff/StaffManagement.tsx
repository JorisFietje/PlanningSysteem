'use client'

import { useState, useEffect } from 'react'
import { StaffMember, DayOfWeek, DAY_LABELS } from '@/types'
import { getStaffMembers, addStaffMember, updateStaffMember, deleteStaffMember, resetToDefaults } from '@/utils/staff/staffManagement'

interface StaffManagementProps {
  onUpdate: () => void // Callback when staff is updated
}

export default function StaffManagement({ onUpdate }: StaffManagementProps) {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [formData, setFormData] = useState<{
    name: string
    maxPatients: number
    maxWorkTime?: number
    workDays: DayOfWeek[]
  }>({
    name: '',
    maxPatients: 10,
    workDays: []
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadStaff()
  }, [])

  const loadStaff = async () => {
    const loaded = await getStaffMembers()
    setStaff(loaded)
  }

  const handleAdd = () => {
    setIsAdding(true)
    setEditingStaff(null)
    setFormData({ name: '', maxPatients: 10, workDays: [] })
    setError(null)
  }

  const handleEdit = (s: StaffMember) => {
    setEditingStaff(s)
    setIsAdding(false)
    setFormData({
      name: s.name,
      maxPatients: s.maxPatients,
      maxWorkTime: s.maxWorkTime,
      workDays: [...s.workDays]
    })
    setError(null)
  }

  const handleCancel = () => {
    setIsAdding(false)
    setEditingStaff(null)
    setFormData({ name: '', maxPatients: 10, workDays: [] })
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.name.trim()) {
      setError('Naam is verplicht')
      return
    }

    if (formData.maxPatients < 1 || formData.maxPatients > 50) {
      setError('Max patiënten moet tussen 1 en 50 zijn')
      return
    }

    try {
      if (editingStaff) {
        await updateStaffMember(editingStaff.name, formData)
      } else {
        await addStaffMember(formData)
      }
      
      await loadStaff()
      handleCancel()
      onUpdate()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleDelete = async (name: string) => {
    if (!confirm(`Weet je zeker dat je ${name} wilt verwijderen?`)) {
      return
    }

    try {
      await deleteStaffMember(name)
      await loadStaff()
      onUpdate()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleReset = async () => {
    if (!confirm('Weet je zeker dat je wilt resetten naar standaard verpleegkundigen? Dit kan niet ongedaan worden gemaakt.')) {
      return
    }

    await resetToDefaults()
    await loadStaff()
    onUpdate()
  }

  const toggleWorkDay = (day: DayOfWeek) => {
    setFormData(prev => ({
      ...prev,
      workDays: prev.workDays.includes(day)
        ? prev.workDays.filter(d => d !== day)
        : [...prev.workDays, day]
    }))
  }

  // Group staff by day for overview
  const staffByDay: Record<DayOfWeek, StaffMember[]> = {
    monday: staff.filter(s => s.workDays.includes('monday')),
    tuesday: staff.filter(s => s.workDays.includes('tuesday')),
    wednesday: staff.filter(s => s.workDays.includes('wednesday')),
    thursday: staff.filter(s => s.workDays.includes('thursday')),
    friday: staff.filter(s => s.workDays.includes('friday')),
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 h-full overflow-auto">
      <div className="flex items-center justify-between mb-6 pb-3 border-b">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Verpleegkundige Beheer</h2>
          <p className="text-sm text-slate-600 mt-1">Beheer verpleegkundigen en hun werkdagen</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors text-sm font-semibold"
          >
 Reset naar Standaard
          </button>
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-semibold flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nieuwe Verpleegkundige
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg">
          <div className="text-red-800 font-semibold text-sm"> {error}</div>
        </div>
      )}

      {/* Add/Edit Form */}
      {(isAdding || editingStaff) && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-bold text-lg mb-4">
            {editingStaff ? `Bewerk ${editingStaff.name}` : 'Nieuwe Verpleegkundige'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Naam *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                  placeholder="bijv. Anna"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Max Patiënten per Dag *
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={formData.maxPatients}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxPatients: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Werktijd Beperking (optioneel)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="hasWorkTime"
                  checked={formData.maxWorkTime !== undefined}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    maxWorkTime: e.target.checked ? 360 : undefined
                  }))}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="hasWorkTime" className="text-sm text-slate-700">
                  Werkt tot een bepaald tijdstip
                </label>
                {formData.maxWorkTime !== undefined && (
                  <select
                    value={formData.maxWorkTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxWorkTime: parseInt(e.target.value) }))}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value={300}>13:00</option>
                    <option value={330}>13:30</option>
                    <option value={360}>14:00</option>
                    <option value={390}>14:30</option>
                    <option value={420}>15:00</option>
                    <option value={450}>15:30</option>
                  </select>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Werkdagen (optioneel - kan per week worden aangepast)
              </label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(DAY_LABELS) as DayOfWeek[]).map(day => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleWorkDay(day)}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                      formData.workDays.includes(day)
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    {DAY_LABELS[day]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-semibold"
              >
 Opslaan
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 bg-slate-300 hover:bg-slate-400 text-slate-700 rounded-lg transition-colors text-sm font-semibold"
              >
                ✕ Annuleren
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Staff Overview by Day */}
      <div className="mb-6">
        <h3 className="font-bold text-lg mb-3">Planning Overzicht per Dag</h3>
        <div className="grid grid-cols-5 gap-3">
          {(Object.keys(DAY_LABELS) as DayOfWeek[]).map(day => {
            const dayStaff = staffByDay[day]
            const totalCapacity = dayStaff.reduce((sum, s) => sum + s.maxPatients, 0)
            
            return (
              <div key={day} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <div className="font-bold text-sm text-slate-900 mb-1">{DAY_LABELS[day]}</div>
                <div className="text-xs text-slate-600 mb-2">
                  {dayStaff.length} VPK • Max {totalCapacity} pat.
                </div>
                <div className="space-y-1">
                  {dayStaff.length === 0 ? (
                    <div className="text-xs text-slate-400 italic">Geen VPK</div>
                  ) : (
                    dayStaff.map(s => (
                      <div key={s.name} className="text-xs bg-white px-2 py-1 rounded border border-slate-200">
                        {s.name} ({s.maxPatients})
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Staff List */}
      <div>
        <h3 className="font-bold text-lg mb-3">Alle Verpleegkundigen ({staff.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-100 border-b-2 border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Naam</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Max Patiënten</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Werktijd</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Werkdagen</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700 uppercase">Acties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {staff.map(s => (
                <tr key={s.name} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{s.name}</td>
                  <td className="px-4 py-3 text-slate-700">{s.maxPatients} patiënten</td>
                  <td className="px-4 py-3 text-slate-700">
                    {s.maxWorkTime 
                      ? `Tot ${Math.floor(s.maxWorkTime / 60) + 8}:${String(s.maxWorkTime % 60).padStart(2, '0')}`
                      : 'Hele dag'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {s.workDays.map(day => (
                        <span key={day} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                          {DAY_LABELS[day].substring(0, 2)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleEdit(s)}
                        className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-sm font-medium transition-colors"
                      >
                        Bewerk
                      </button>
                      <button
                        onClick={() => handleDelete(s.name)}
                        className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-sm font-medium transition-colors"
                      >
 Verwijder
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

