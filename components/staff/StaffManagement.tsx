'use client'

import { useState, useEffect } from 'react'
import { StaffMember, DayOfWeek } from '@/types'
import { getStaffMembers, addStaffMember, updateStaffMember, deleteStaffMember, resetToDefaults } from '@/utils/staff/staffManagement'
import ConfirmModal from '@/components/common/ConfirmModal'

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
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
    variant?: 'danger' | 'warning' | 'info'
    confirmText?: string
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'info'
  })

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
    setConfirmModal({
      isOpen: true,
      title: 'Verpleegkundige Verwijderen',
      message: `Weet je zeker dat je ${name} wilt verwijderen?`,
      onConfirm: async () => {
        try {
          await deleteStaffMember(name)
          await loadStaff()
          onUpdate()
        } catch (err: any) {
          setError(err.message)
        }
      },
      variant: 'danger',
      confirmText: 'Verwijderen'
    })
  }

  const handleReset = async () => {
    setConfirmModal({
      isOpen: true,
      title: 'Resetten naar Standaard',
      message: 'Weet je zeker dat je wilt resetten naar standaard verpleegkundigen? Dit kan niet ongedaan worden gemaakt.',
      onConfirm: async () => {
        await resetToDefaults()
        await loadStaff()
        onUpdate()
      },
      variant: 'warning',
      confirmText: 'Resetten'
    })
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 h-full overflow-auto">
      <div className="flex items-center justify-between mb-6 pb-3 border-b">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Verpleegkundige Beheer</h2>
          <p className="text-sm text-slate-600 mt-1">Beheer verpleegkundigen en hun maximale capaciteit</p>
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
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg transition-colors text-sm font-semibold flex items-center gap-2"
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

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg transition-colors text-sm font-semibold"
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

      {/* Staff List */}
      <div>
        <h3 className="font-bold text-lg mb-3">Alle Verpleegkundigen ({staff.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-100 border-b-2 border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Naam</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Max Patiënten</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700 uppercase">Acties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {staff.map(s => {
                return (
                  <tr 
                    key={s.name} 
                    className="hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {s.name}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{s.maxPatients} patiënten</td>
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
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant || 'info'}
        confirmText={confirmModal.confirmText}
      />
    </div>
  )
}
