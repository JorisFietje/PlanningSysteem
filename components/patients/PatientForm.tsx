'use client'

import { useState, useEffect } from 'react'
import { MEDICATION_CATEGORIES, TREATMENT_NUMBER_OPTIONS, DEPARTMENT_CONFIG, StaffMember, getDayOfWeekFromDate, getAllMedications } from '@/types'
import { getTreatmentBreakdown } from '@/utils/patients/actionGenerator'
import TimeSlotPicker from '../planning/TimeSlotPicker'
import Select, { SelectOption } from '../common/Select'

interface PatientFormProps {
  onSubmit: (name: string, startTime: string, medicationId: string, treatmentNumber: number, preferredNurse?: string) => void
  selectedDate: string // YYYY-MM-DD format
  staffMembers: StaffMember[]
}

// Generate a unique patient name based on medication and counter
let patientCounter = 1
function generatePatientName(medicationName: string): string {
  const name = `Patiënt ${patientCounter} - ${medicationName}`
  patientCounter++
  return name
}

export default function PatientForm({ onSubmit, selectedDate, staffMembers }: PatientFormProps) {
  const [startTime, setStartTime] = useState('08:00')
  const [selectedCategory, setSelectedCategory] = useState('immunotherapy')
  const [medicationId, setMedicationId] = useState(getAllMedications().find(m => m.category === 'immunotherapy')?.id || '')
  const [treatmentNumber, setTreatmentNumber] = useState(1)
  
  // Get day of week from selected date
  const dayOfWeek = getDayOfWeekFromDate(selectedDate)
  
  // Beschikbaarheid via weekrooster; toon alle medewerkers
  const availableStaff = staffMembers
  const [preferredNurse, setPreferredNurse] = useState<string>(availableStaff[0]?.name || staffMembers[0]?.name || '') // Default to first available nurse
  
  // Reset preferred nurse when selected date changes (if current nurse doesn't work on new day)
  useEffect(() => {
    if (availableStaff.length > 0 && !availableStaff.some(s => s.name === preferredNurse)) {
      setPreferredNurse(availableStaff[0].name)
    }
  }, [selectedDate, availableStaff, preferredNurse])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (startTime && medicationId) {
      // Auto-generate patient name
      const medication = getAllMedications().find(m => m.id === medicationId)
      const patientName = generatePatientName(medication?.displayName || medicationId)
      
      onSubmit(patientName, startTime, medicationId, treatmentNumber, preferredNurse)
      setStartTime('08:00') // Reset to first valid time slot
      setMedicationId(getAllMedications().find(m => m.category === selectedCategory)?.id || '')
      setTreatmentNumber(1)
      setPreferredNurse(availableStaff[0]?.name || staffMembers[0]?.name || '') // Reset to first available nurse
    }
  }

  const filteredMedications = getAllMedications().filter(m => m.category === selectedCategory)
  const selectedMedication = getAllMedications().find(m => m.id === medicationId)
  const breakdown = medicationId ? getTreatmentBreakdown(medicationId, treatmentNumber) : null
  
  // Check if selected medication has multiple treatment variants
  const hasMultipleTreatments = selectedMedication ? selectedMedication.variants.length > 1 : false
  
  // Calculate if treatment would end after closing time
  const [startHours, startMinutes] = startTime.split(':').map(Number)
  const startInMinutes = startHours * 60 + startMinutes
  const endInMinutes = breakdown ? startInMinutes + breakdown.totalTime : startInMinutes
  const endHours = Math.floor(endInMinutes / 60)
  const endMins = endInMinutes % 60
  const closingTime = DEPARTMENT_CONFIG.END_MINUTES
  const endsAfterClosing = endInMinutes > closingTime

  return (
    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
      <h2 className="text-base font-bold mb-4 text-slate-900">Nieuwe Patiënt</h2>
      
      {/* Day info */}
      {availableStaff.length === 0 && (
        <div className="mb-4 p-3 bg-orange-100 border border-orange-300 rounded-lg">
          <div className="text-orange-800 font-bold text-xs"> Geen verpleegkundigen beschikbaar</div>
          <div className="text-orange-700 text-xs mt-1">
            Selecteer een andere werkdag in de header om verder te gaan.
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <Select
            value={selectedCategory}
            onChange={(value) => {
              setSelectedCategory(value)
              const firstMed = getAllMedications().find(m => m.category === value)
              if (firstMed) {
                setMedicationId(firstMed.id)
                setTreatmentNumber(1) // Reset treatment number when category changes
              }
            }}
            options={MEDICATION_CATEGORIES.map(cat => ({
              value: cat.id,
              label: `${cat.icon} ${cat.name}`
            }))}
            label="Medicatie Categorie"
          />
        </div>

        <div>
          <Select
            value={medicationId}
            onChange={(value) => {
              setMedicationId(value)
              setTreatmentNumber(1) // Reset treatment number when medication changes
            }}
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
                // Only show treatment options that exist for this medication
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

        <div>
          <Select
            value={preferredNurse}
            onChange={setPreferredNurse}
            options={availableStaff.length > 0 ? availableStaff.map(staff => ({
              value: staff.name,
              label: `👤 ${staff.name} (max ${staff.maxPatients} patiënten${staff.maxWorkTime ? `, werkt tot ${Math.floor(staff.maxWorkTime / 60) + 8}:00` : ''})`
            })) : [{
              value: '',
              label: 'Geen verpleegkundigen beschikbaar op deze dag',
              disabled: true
            }]}
            label="Verpleegkundige voor Aanbrengen"
            placeholder="Selecteer verpleegkundige"
            searchable={availableStaff.length > 5}
            emptyMessage="Geen verpleegkundigen beschikbaar"
          />
          <p className="text-xs text-slate-500 mt-1">
            {availableStaff.length > 0 
              ? `${availableStaff.length} verpleegkundige${availableStaff.length > 1 ? 'n' : ''} beschikbaar op deze dag`
              : ' Geen verpleegkundigen beschikbaar'}
          </p>
        </div>

        <TimeSlotPicker
          value={startTime}
          onChange={setStartTime}
          label="Start Tijd (15 min intervallen)"
        />

        {breakdown && selectedMedication && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs">
            {breakdown.infusionTime === 0 && (
              <div className="mb-2 p-2 bg-orange-100 border border-orange-300 rounded-lg">
                <div className="text-orange-800 font-bold text-xs"> GEEN INFUUS BEHANDELING</div>
                <div className="text-orange-700 text-xs mt-1">
                  Dit is een subcutane injectie, geen infuus. Deze behandeling is niet geschikt voor de infuusafdeling simulatie.
                </div>
              </div>
            )}
            <div className="font-medium text-blue-900 mb-2">Behandeling Overzicht:</div>
            <div className="text-blue-700 space-y-1.5">
              <div className="flex justify-between">
                <span>{breakdown.infusionTime > 0 ? 'Aanbrengen (VPK 1):' : 'Injectie toedienen:'}</span>
                <strong>{breakdown.vpkTime} min</strong>
              </div>
              {breakdown.protocolCheckTime > 0 && (
                <div className="flex justify-between bg-green-50 -mx-2 px-2 py-1 rounded">
                  <span>Protocol Check (VPK 2):</span>
                  <strong>{breakdown.protocolCheckTime} min</strong>
                </div>
              )}
              {breakdown.infusionTime > 0 && (
                <div className="flex justify-between">
                  <span>Infuus loopt:</span>
                  <strong>{breakdown.infusionTime} min</strong>
                </div>
              )}
              {breakdown.checkCount > 0 && (
                <div className="flex justify-between">
                  <span>Checks tijdens infuus:</span>
                  <strong>{breakdown.checkCount}×</strong>
                </div>
              )}
              {breakdown.observationTime > 0 && (
                <div className="flex justify-between">
                  <span>Observatie (geen VPK):</span>
                  <strong>{breakdown.observationTime} min</strong>
                </div>
              )}
              {breakdown.flushTime > 0 && (
                <div className="flex justify-between">
                  <span>Spoelen:</span>
                  <strong>{breakdown.flushTime} min</strong>
                </div>
              )}
              {breakdown.removalTime > 0 && (
                <div className="flex justify-between">
                  <span>Afkoppelen:</span>
                  <strong>{breakdown.removalTime} min</strong>
                </div>
              )}
              <div className="flex justify-between pt-1.5 border-t border-blue-300">
                <span>Totale tijd:</span>
                <strong className="text-blue-900">{breakdown.totalTime} min</strong>
              </div>
              <div className={`flex justify-between pt-1.5 border-t ${endsAfterClosing ? 'border-red-300' : 'border-blue-300'}`}>
                <span>Start tijd:</span>
                <strong>{startTime}</strong>
              </div>
              <div className={`flex justify-between ${endsAfterClosing ? 'text-red-700 font-bold' : ''}`}>
                <span>Eind tijd:</span>
                <strong>{endHours}:{String(endMins).padStart(2, '0')}</strong>
              </div>
              {endsAfterClosing && (
                <div className="mt-2 pt-2 border-t border-red-400 bg-red-100 -mx-2 -mb-2 px-2 py-2 rounded-b-lg">
                  <p className="text-red-800 font-bold text-xs"> LET OP: Eindtijd ({endHours}:{String(endMins).padStart(2, '0')}) is NA sluitingstijd (16:30)!</p>
                  <p className="text-red-700 text-xs mt-1">Kies een eerdere starttijd of kortere behandeling.</p>
                </div>
              )}
            </div>
            {selectedMedication.notes && (
              <div className="mt-2 pt-2 border-t border-blue-300 text-blue-600 italic">
                {selectedMedication.notes}
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={endsAfterClosing || availableStaff.length === 0}
          className={`w-full font-semibold py-2 px-4 rounded-lg transition-colors text-sm ${
            endsAfterClosing || availableStaff.length === 0
              ? 'bg-gray-400 cursor-not-allowed text-gray-200' 
              : 'bg-blue-700 hover:bg-blue-800 text-white'
          }`}
          title={
            availableStaff.length === 0 
              ? 'Geen verpleegkundigen beschikbaar op deze dag' 
              : endsAfterClosing 
                ? 'Behandeling eindigt na sluitingstijd (16:30)' 
                : ''
          }
        >
          {availableStaff.length === 0 
            ? ' Geen VPK beschikbaar' 
            : endsAfterClosing 
              ? ' Eindigt te laat' 
              : 'Patiënt Toevoegen'}
        </button>
      </form>
    </div>
  )
}
