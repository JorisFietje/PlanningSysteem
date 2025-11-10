'use client'

import { useState } from 'react'
import { Patient } from '@/types'

interface ActionFormProps {
  patients: Patient[]
  onSubmit: (patientId: string, name: string, duration: number, staff: string) => void
}

export default function ActionForm({ patients, onSubmit }: ActionFormProps) {
  const [patientId, setPatientId] = useState('')
  const [name, setName] = useState('')
  const [duration, setDuration] = useState(15)
  const [staff, setStaff] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (patientId && name && duration && staff) {
      onSubmit(patientId, name, duration, staff)
      setPatientId('')
      setName('')
      setDuration(15)
      setStaff('')
    }
  }

  return (
    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
      <h2 className="text-base font-bold mb-4 text-slate-900">Nieuwe Handeling</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="selectPatient" className="block text-xs font-medium text-slate-600 mb-1">
            Patiënt
          </label>
          <select
            id="selectPatient"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            required
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
          >
            <option value="">-- Kies --</option>
            {patients.map(patient => (
              <option key={patient.id} value={patient.id}>
                {patient.name} ({patient.startTime})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="actionName" className="block text-xs font-medium text-slate-600 mb-1">
            Handeling
          </label>
          <input
            type="text"
            id="actionName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="bijv. Intake"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="actionDuration" className="block text-xs font-medium text-slate-600 mb-1">
              Duur (min)
            </label>
            <input
              type="number"
              id="actionDuration"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              required
              min="5"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
            />
          </div>
          <div>
            <label htmlFor="actionStaff" className="block text-xs font-medium text-slate-600 mb-1">
              Medewerker
            </label>
            <input
              type="text"
              id="actionStaff"
              value={staff}
              onChange={(e) => setStaff(e.target.value)}
              required
              placeholder="Dr. Smit"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
            />
          </div>
        </div>
        <button
          type="submit"
          className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
        >
          Toevoegen
        </button>
      </form>
    </div>
  )
}

