'use client'

import { useState } from 'react'
import { MEDICATION_CATEGORIES, TREATMENT_NUMBER_OPTIONS, getAllMedications } from '@/types'
import Select from '../common/Select'

interface WeekTreatmentsProps {
  treatments: Array<{
    medicationId: string
    treatmentNumber: number
    quantity: number
  }>
  setTreatments: (treatments: Array<{
    medicationId: string
    treatmentNumber: number
    quantity: number
  }>) => void
}

export default function WeekTreatments({ treatments, setTreatments }: WeekTreatmentsProps) {
  const [selectedCategory, setSelectedCategory] = useState('immunotherapy')
  const [selectedMedication, setSelectedMedication] = useState('')
  const [selectedTreatmentNumber, setSelectedTreatmentNumber] = useState(1)
  const [quantity, setQuantity] = useState<number | ''>(1)

  const filteredMedications = getAllMedications().filter(m => m.category === selectedCategory)
  const selectedMedicationData = getAllMedications().find(m => m.id === selectedMedication)
  const hasMultipleTreatments = selectedMedicationData ? selectedMedicationData.variants.length > 1 : false

  const handleAdd = () => {
    const numericQuantity = typeof quantity === 'number' ? quantity : parseInt(quantity, 10)
    if (!selectedMedication || !Number.isFinite(numericQuantity) || numericQuantity < 1) return

    // Check if this treatment already exists
    const existing = treatments.find(
      t => t.medicationId === selectedMedication && t.treatmentNumber === selectedTreatmentNumber
    )

    if (existing) {
      // Update quantity
      setTreatments(
        treatments.map(t =>
          t.medicationId === selectedMedication && t.treatmentNumber === selectedTreatmentNumber
            ? { ...t, quantity: t.quantity + numericQuantity }
            : t
        )
      )
    } else {
      // Add new treatment
      setTreatments([
        ...treatments,
        {
          medicationId: selectedMedication,
          treatmentNumber: selectedTreatmentNumber,
          quantity: numericQuantity
        }
      ])
    }

    // Reset form
    setQuantity(1)
  }

  const handleRemove = (index: number) => {
    setTreatments(treatments.filter((_, i) => i !== index))
  }

  const handleUpdateQuantity = (index: number, newQuantity: number) => {
    if (newQuantity < 1) return
    setTreatments(
      treatments.map((t, i) => (i === index ? { ...t, quantity: newQuantity } : t))
    )
  }

  const totalTreatments = treatments.reduce((sum, t) => sum + t.quantity, 0)

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-2xl font-bold text-slate-900">Behandelingen voor deze Week</h2>
          <div className="relative group">
            <svg className="w-5 h-5 text-blue-600 flex-shrink-0 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {/* Tooltip */}
            <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-slate-900 text-white text-sm rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
              <p className="text-white">
                Voeg behandelingen toe die deze week moeten plaatsvinden. Het systeem verdeelt deze automatisch over de week.
              </p>
              {/* Arrow */}
              <div className="absolute bottom-full left-4 border-4 border-transparent border-b-slate-900"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Treatment Form */}
      <div className="bg-slate-50 rounded-lg p-4 mb-6 border border-slate-200">
        <h3 className="font-bold text-lg mb-4 text-slate-900">Nieuwe Behandeling Toevoegen</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <Select
              value={selectedCategory}
              onChange={(value) => {
                setSelectedCategory(value)
                setSelectedMedication('')
              }}
              options={MEDICATION_CATEGORIES.map(cat => ({
                value: cat.id,
                label: cat.name
              }))}
              label="Categorie"
            />
          </div>

          <div>
            <Select
              value={selectedMedication}
              onChange={(value) => {
                setSelectedMedication(value)
                setSelectedTreatmentNumber(1)
              }}
              options={filteredMedications.map(med => ({
                value: med.id,
                label: med.displayName
              }))}
              label="Medicatie"
              placeholder="Selecteer medicatie"
              searchable={filteredMedications.length > 5}
            />
          </div>

          {hasMultipleTreatments ? (
            <div>
              <Select
                value={selectedTreatmentNumber.toString()}
                onChange={(value) => setSelectedTreatmentNumber(parseInt(value))}
                options={TREATMENT_NUMBER_OPTIONS.filter(opt => {
                  return selectedMedicationData?.variants.some(v => v.treatmentNumber === opt.value)
                }).map(opt => ({
                  value: opt.value.toString(),
                  label: opt.label
                }))}
                label="Behandeling Nummer"
              />
            </div>
          ) : (
            <div></div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Aantal
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => {
                  const value = e.target.value
                  setQuantity(value === '' ? '' : parseInt(value, 10))
                }}
                className="flex-1 px-3 py-2.5 border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-sm"
              />
              <button
                onClick={handleAdd}
                className="px-6 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-semibold transition-colors text-sm whitespace-nowrap"
              >
                + Toevoegen
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Treatments List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg text-slate-900">
            Behandelingen ({treatments.length})
          </h3>
          <div className="text-sm text-slate-600">
            Totaal: <span className="font-bold text-blue-600">{totalTreatments}</span> behandelingen
          </div>
        </div>

        {treatments.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-lg border border-slate-200">
            <svg className="w-12 h-12 mx-auto mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            <div className="text-slate-600 font-medium">Nog geen behandelingen toegevoegd</div>
            <div className="text-sm text-slate-500 mt-2">
              Voeg behandelingen toe met het formulier hierboven
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {treatments.map((treatment, index) => {
              const medication = getAllMedications().find(m => m.id === treatment.medicationId)
              const variant = medication?.variants.find(v => v.treatmentNumber === treatment.treatmentNumber)
              const treatmentLabel = TREATMENT_NUMBER_OPTIONS.find(
                opt => opt.value === treatment.treatmentNumber
              )?.label || `${treatment.treatmentNumber}e behandeling`

              return (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-blue-300 transition-colors"
                >
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900">
                      {medication?.displayName || treatment.medicationId}
                    </div>
                    <div className="text-sm text-slate-600">
                      {treatmentLabel}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleUpdateQuantity(index, treatment.quantity - 1)}
                        className="w-8 h-8 flex items-center justify-center bg-slate-200 hover:bg-slate-300 rounded-lg font-bold text-slate-700 transition-colors"
                      >
                        -
                      </button>
                      <span className="w-12 text-center font-bold text-blue-600">
                        {treatment.quantity}x
                      </span>
                      <button
                        onClick={() => handleUpdateQuantity(index, treatment.quantity + 1)}
                        className="w-8 h-8 flex items-center justify-center bg-slate-200 hover:bg-slate-300 rounded-lg font-bold text-slate-700 transition-colors"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => handleRemove(index)}
                      className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-semibold transition-colors"
                    >
 Verwijder
                    </button>
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
