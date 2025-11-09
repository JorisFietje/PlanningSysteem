'use client'

import { useState, useEffect } from 'react'
import { MEDICATIONS, MEDICATION_CATEGORIES, TREATMENT_NUMBER_OPTIONS, DEPARTMENT_CONFIG, StaffMember, getDayOfWeekFromDate, Patient } from '@/types'
import { getTreatmentBreakdown } from '@/utils/patients/actionGenerator'
import TimeSlotPicker from '../planning/TimeSlotPicker'

interface PatientModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (name: string, startTime: string, medicationId: string, treatmentNumber: number, preferredNurse?: string) => void
  selectedDate: string
  staffMembers: StaffMember[]
  editingPatient?: Patient | null
  onUpdate?: (patientId: string, startTime: string, medicationId: string, treatmentNumber: number, preferredNurse?: string) => void
}

// Generate a unique patient name based on medication and counter
let patientCounter = 1
function generatePatientName(medicationName: string): string {
  const name = `Patiënt ${patientCounter} - ${medicationName}`
  patientCounter++
  return name
}

export default function PatientModal({ isOpen, onClose, onSubmit, selectedDate, staffMembers, editingPatient, onUpdate }: PatientModalProps) {
  const isEditing = !!editingPatient
  
  const [startTime, setStartTime] = useState('08:00')
  const [selectedCategory, setSelectedCategory] = useState('immunotherapy')
  const [medicationId, setMedicationId] = useState(MEDICATIONS.find(m => m.category === 'immunotherapy')?.id || '')
  const [treatmentNumber, setTreatmentNumber] = useState(1)
  
  // Get day of week from selected date
  const dayOfWeek = getDayOfWeekFromDate(selectedDate)
  
  // Filter staff members who work on selected day (or have no workDays set)
  const availableStaff = staffMembers.filter(s => s.workDays.length === 0 || s.workDays.includes(dayOfWeek))
  const [preferredNurse, setPreferredNurse] = useState<string>(availableStaff[0]?.name || staffMembers[0]?.name || '')
  
  // Load editing patient data or reset when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      if (editingPatient) {
        // Load editing patient data
        setStartTime(editingPatient.startTime)
        setMedicationId(editingPatient.medicationType)
        setTreatmentNumber(editingPatient.treatmentNumber)
        const medication = MEDICATIONS.find(m => m.id === editingPatient.medicationType)
        if (medication) {
          setSelectedCategory(medication.category)
        }
        // Find preferred nurse from setup action
        const setupAction = editingPatient.actions.find(a => a.name.includes('Aanbrengen'))
        if (setupAction?.staff) {
          setPreferredNurse(setupAction.staff)
        } else {
          setPreferredNurse(availableStaff[0]?.name || staffMembers[0]?.name || '')
        }
      } else {
        // Reset for new patient
        setStartTime('08:00')
        setSelectedCategory('immunotherapy')
        setMedicationId(MEDICATIONS.find(m => m.category === 'immunotherapy')?.id || '')
        setTreatmentNumber(1)
        setPreferredNurse(availableStaff[0]?.name || staffMembers[0]?.name || '')
      }
    }
  }, [isOpen, editingPatient])
  
  // Reset preferred nurse when selected date changes
  useEffect(() => {
    if (isOpen && availableStaff.length > 0 && !availableStaff.some(s => s.name === preferredNurse)) {
      setPreferredNurse(availableStaff[0].name)
    }
  }, [isOpen, selectedDate, availableStaff, preferredNurse])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (startTime && medicationId) {
      if (isEditing && editingPatient && onUpdate) {
        // Update existing patient
        onUpdate(editingPatient.id, startTime, medicationId, treatmentNumber, preferredNurse)
      } else {
        // Create new patient
        const medication = MEDICATIONS.find(m => m.id === medicationId)
        const patientName = generatePatientName(medication?.displayName || medicationId)
        onSubmit(patientName, startTime, medicationId, treatmentNumber, preferredNurse)
      }
      onClose()
    }
  }

  const filteredMedications = MEDICATIONS.filter(m => m.category === selectedCategory)
  const selectedMedication = MEDICATIONS.find(m => m.id === medicationId)
  const breakdown = medicationId ? getTreatmentBreakdown(medicationId, treatmentNumber) : null
  
  const hasMultipleTreatments = selectedMedication ? selectedMedication.variants.length > 1 : false
  
  const [startHours, startMinutes] = startTime.split(':').map(Number)
  const startInMinutes = startHours * 60 + startMinutes
  const endInMinutes = breakdown ? startInMinutes + breakdown.totalTime : startInMinutes
  const closingTime = DEPARTMENT_CONFIG.END_HOUR * 60
  const endsAfterClosing = endInMinutes > closingTime

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
      onClick={(e) => {
        // Only close if clicking directly on the backdrop, not on modal content
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-xl flex items-center justify-between">
          <h2 className="text-2xl font-bold">{isEditing ? 'Behandeling Bewerken' : 'Nieuwe Behandeling Toevoegen'}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {availableStaff.length === 0 && (
            <div className="mb-4 p-3 bg-orange-100 border border-orange-300 rounded-lg">
              <div className="text-orange-800 font-bold text-sm">Geen verpleegkundigen beschikbaar</div>
              <div className="text-orange-700 text-xs mt-1">
                Selecteer een andere datum om verder te gaan.
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Medicatie Categorie
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  const newCategory = e.target.value
                  setSelectedCategory(newCategory)
                  // Reset medication if current selection is not in new category
                  const newFilteredMedications = MEDICATIONS.filter(m => m.category === newCategory)
                  if (!newFilteredMedications.some(m => m.id === medicationId)) {
                    setMedicationId('')
                  }
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
              >
                {MEDICATION_CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Medicatie Type
              </label>
              <select
                value={medicationId}
                onChange={(e) => setMedicationId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
              >
                <option value="">Selecteer medicatie</option>
                {filteredMedications.map(med => (
                  <option key={med.id} value={med.id}>
                    {med.displayName}
                  </option>
                ))}
              </select>
            </div>

            {hasMultipleTreatments && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Behandeling Nummer
                </label>
                <select
                  value={treatmentNumber}
                  onChange={(e) => setTreatmentNumber(parseInt(e.target.value))}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                >
                  {TREATMENT_NUMBER_OPTIONS.filter(opt => {
                    return selectedMedication?.variants.some(v => v.treatmentNumber === opt.value)
                  }).map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Verpleegkundige voor Aanbrengen
              </label>
              <select
                value={preferredNurse}
                onChange={(e) => setPreferredNurse(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
              >
                {availableStaff.length > 0 ? (
                  availableStaff.map(staff => (
                    <option key={staff.name} value={staff.name}>
                      {staff.name} (max {staff.maxPatients} patiënten{staff.maxWorkTime ? `, werkt tot ${Math.floor(staff.maxWorkTime / 60) + 8}:00` : ''})
                    </option>
                  ))
                ) : (
                  <option value="">Geen verpleegkundigen beschikbaar op deze dag</option>
                )}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                {availableStaff.length > 0 
                  ? `${availableStaff.length} verpleegkundige${availableStaff.length > 1 ? 'n' : ''} beschikbaar op deze dag`
                  : 'Geen verpleegkundigen beschikbaar'}
              </p>
            </div>

            <TimeSlotPicker
              value={startTime}
              onChange={setStartTime}
              label="Start Tijd (15 min intervallen)"
            />

            {breakdown && (
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h3 className="font-bold text-sm mb-3 text-slate-900">Behandeling Overzicht</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Aanbrengen (VPK 1):</span>
                    <span className="font-semibold">{breakdown.vpkTime} min</span>
                  </div>
                  {breakdown.protocolCheckTime > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Protocol Check (VPK 2):</span>
                      <span className="font-semibold">{breakdown.protocolCheckTime} min</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-600">Infuus loopt:</span>
                    <span className="font-semibold">{breakdown.infusionTime} min</span>
                  </div>
                  {breakdown.flushTime > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Spoelen:</span>
                      <span className="font-semibold">{breakdown.flushTime} min</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-600">Afkoppelen:</span>
                    <span className="font-semibold">{breakdown.removalTime} min</span>
                  </div>
                  <div className="border-t border-blue-200 pt-2 mt-2 flex justify-between font-bold">
                    <span>Totale tijd:</span>
                    <span>{breakdown.totalTime} min</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Start tijd:</span>
                    <span>{startTime}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Eind tijd:</span>
                    <span>
                      {Math.floor(endInMinutes / 60)}:{String(endInMinutes % 60).padStart(2, '0')}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={endsAfterClosing || availableStaff.length === 0}
                className={`flex-1 font-semibold py-3 px-4 rounded-lg transition-colors ${
                  endsAfterClosing || availableStaff.length === 0
                    ? 'bg-gray-400 cursor-not-allowed text-gray-200' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {isEditing ? 'Behandeling Bijwerken' : 'Behandeling Toevoegen'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-semibold transition-colors"
              >
                Annuleren
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

