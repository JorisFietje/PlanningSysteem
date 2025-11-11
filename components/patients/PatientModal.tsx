'use client'

import { useState, useEffect } from 'react'
import { MEDICATIONS, MEDICATION_CATEGORIES, TREATMENT_NUMBER_OPTIONS, DEPARTMENT_CONFIG, StaffMember, getDayOfWeekFromDate, Patient } from '@/types'
import { getTreatmentBreakdown } from '@/utils/patients/actionGenerator'
import TimeSlotPicker from '../planning/TimeSlotPicker'
import Select from '../common/Select'

interface PatientModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (name: string, startTime: string, medicationId: string, treatmentNumber: number, preferredNurse?: string, customInfusionMinutes?: number) => void
  selectedDate: string
  staffMembers: StaffMember[]
  editingPatient?: Patient | null
  onUpdate?: (patientId: string, startTime: string, medicationId: string, treatmentNumber: number, preferredNurse?: string, customInfusionMinutes?: number) => void
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
  // Optional custom infusion duration (minutes)
  const [customInfusionMinutes, setCustomInfusionMinutes] = useState<string>('')
  
  // Get day of week from selected date
  const dayOfWeek = getDayOfWeekFromDate(selectedDate)
  
  // Beschikbaarheid via weekrooster (reeds gefilterd door aanroeper)
  const availableStaff = staffMembers
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
        setCustomInfusionMinutes('')
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
        onUpdate(
          editingPatient.id,
          startTime,
          medicationId,
          treatmentNumber,
          undefined,
          customInfusionMinutes !== '' ? Number(customInfusionMinutes) : undefined
        )
      } else {
        // Create new patient
        const medication = MEDICATIONS.find(m => m.id === medicationId)
        const patientName = generatePatientName(medication?.displayName || medicationId)
        // Laat de planningsengine de verpleegkundige automatisch toewijzen
        onSubmit(
          patientName,
          startTime,
          medicationId,
          treatmentNumber,
          undefined,
          customInfusionMinutes !== '' ? Number(customInfusionMinutes) : undefined
        )
      }
      onClose()
    }
  }

  const filteredMedications = MEDICATIONS.filter(m => m.category === selectedCategory)
  const selectedMedication = MEDICATIONS.find(m => m.id === medicationId)
  const breakdown = medicationId ? getTreatmentBreakdown(medicationId, treatmentNumber) : null
  const effectiveInfusion = breakdown
    ? (customInfusionMinutes !== '' ? Number(customInfusionMinutes) : breakdown.infusionTime)
    : 0
  const effectiveTotal = breakdown
    ? breakdown.totalTime - breakdown.infusionTime + effectiveInfusion
    : 0
  
  const hasMultipleTreatments = selectedMedication ? selectedMedication.variants.length > 1 : false
  
  const [startHours, startMinutes] = startTime.split(':').map(Number)
  const startInMinutes = startHours * 60 + startMinutes
  const endInMinutes = breakdown ? startInMinutes + effectiveTotal : startInMinutes
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
        role="dialog"
        aria-modal="true"
        aria-labelledby="patient-modal-title"
      >
        {/* Header */}
        <div className="sticky top-0 bg-blue-700 border-b-2 border-blue-800 text-white p-6 rounded-t-xl flex items-center justify-between">
          <h2 id="patient-modal-title" className="text-2xl font-bold">{isEditing ? 'Behandeling Bewerken' : 'Nieuwe Behandeling Toevoegen'}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-700"
            aria-label="Modal sluiten"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
              <Select
                value={selectedCategory}
                onChange={(newCategory) => {
                  setSelectedCategory(newCategory)
                  // Reset medication if current selection is not in new category
                  const newFilteredMedications = MEDICATIONS.filter(m => m.category === newCategory)
                  if (!newFilteredMedications.some(m => m.id === medicationId)) {
                    setMedicationId('')
                  }
                }}
                options={MEDICATION_CATEGORIES.map(cat => ({
                  value: cat.id,
                  label: cat.name
                }))}
                label="Medicatie Categorie"
              />
            </div>

            <div>
              <Select
                value={medicationId}
                onChange={setMedicationId}
                options={filteredMedications.map(med => ({
                  value: med.id,
                  label: med.displayName
                }))}
                label="Medicatie Type"
                required
                searchable={filteredMedications.length > 5}
                placeholder="Selecteer medicatie"
              />
            </div>

            {hasMultipleTreatments && (
              <div>
                <Select
                  value={treatmentNumber.toString()}
                  onChange={(value) => setTreatmentNumber(parseInt(value))}
                  options={TREATMENT_NUMBER_OPTIONS.filter(opt => {
                    return selectedMedication?.variants.some(v => v.treatmentNumber === opt.value)
                  }).map(opt => ({
                    value: opt.value.toString(),
                    label: opt.label
                  }))}
                  label="Behandeling Nummer"
                  required
                />
              </div>
            )}

            {/* Verpleegkundige-keuze verwijderd: toewijzing gebeurt automatisch door het systeem */}

            <TimeSlotPicker
              value={startTime}
              onChange={setStartTime}
              label="Start Tijd (15 min intervallen)"
            />

            {/* Custom infusion duration override */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Infuusduur (minuten, optioneel)
              </label>
              <input
                type="number"
                min={1}
                placeholder={breakdown ? String(breakdown.infusionTime) : 'bijv. 120'}
                value={customInfusionMinutes}
                onChange={(e) => setCustomInfusionMinutes(e.target.value)}
                className="w-full px-3 py-2 rounded-md border-2 border-slate-200 bg-white text-slate-900 text-sm"
              />
              <p className="text-xs text-slate-500 mt-1">
                Laat leeg om de standaardduur van het protocol te gebruiken.
              </p>
            </div>

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
                    <span className="font-semibold">{effectiveInfusion} min</span>
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
                    <span>{effectiveTotal} min</span>
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
                    : 'bg-blue-700 hover:bg-blue-800 text-white'
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

