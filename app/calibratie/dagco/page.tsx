'use client'

import { useEffect, useState } from 'react'
import StaffManagement from '@/components/staff/StaffManagement'
import { getDaycoPatientsCount } from '@/types'
import { useStaff } from '@/hooks/useStaff'

type RampScheduleMap = { [key: string]: Array<{ week: number; hours: number; patients: number }> }

export default function CalibratieDagcoPage() {
  const [daycoPatients, setDaycoPatients] = useState<number>(getDaycoPatientsCount())
  const { staffMembers } = useStaff()
  const [rampSchedules, setRampSchedules] = useState<RampScheduleMap>(() => {
    if (typeof window === 'undefined') return {}
    const stored = localStorage.getItem('staffRampSchedules')
    if (!stored) return {}
    try {
      return JSON.parse(stored)
    } catch {
      return {}
    }
  })

  useEffect(() => {
    localStorage.setItem('daycoPatients', String(daycoPatients))
  }, [daycoPatients])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('staffRampSchedules', JSON.stringify(rampSchedules))
  }, [rampSchedules])

  const updateRampSchedule = (staffName: string, weekIndex: number, updates: Partial<{ week: number; hours: number; patients: number }>) => {
    setRampSchedules(prev => {
      const schedule = prev[staffName] ? [...prev[staffName]] : []
      schedule[weekIndex] = { ...schedule[weekIndex], ...updates }
      return { ...prev, [staffName]: schedule }
    })
  }

  const addRampWeek = (staffName: string) => {
    setRampSchedules(prev => {
      const schedule = prev[staffName] ? [...prev[staffName]] : []
      schedule.push({ week: schedule.length + 1, hours: 0, patients: 0 })
      return { ...prev, [staffName]: schedule }
    })
  }

  const removeRampWeek = (staffName: string, weekIndex: number) => {
    setRampSchedules(prev => {
      const schedule = prev[staffName] ? [...prev[staffName]] : []
      schedule.splice(weekIndex, 1)
      return { ...prev, [staffName]: schedule }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Dagco & personeel</h2>
        <p className="text-sm text-slate-600">
          Beheer standaardcapaciteit en opbouwschema’s voor verpleegkundigen.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Dagco capaciteit</h2>
        <p className="text-sm text-slate-600 mt-2">
          Stel in hoeveel patiënten meetellen wanneer iemand dagco is.
        </p>
        <div className="mt-4 flex items-center gap-4">
          <input
            type="range"
            min={0}
            max={15}
            value={daycoPatients}
            onChange={(e) => setDaycoPatients(parseInt(e.target.value, 10))}
            className="flex-1"
          />
          <div className="w-14 text-center text-xl font-semibold">{daycoPatients}</div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-2">Verpleegkundigen (standaard)</h2>
        <p className="text-sm text-slate-600 mb-4">
          Beheer standaard maximale aantallen per verpleegkundige.
        </p>
        <StaffManagement onUpdate={() => {}} />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-2">Opbouwschema per verpleegkundige</h2>
        <p className="text-sm text-slate-600 mb-4">
          Stel per verpleegkundige een opbouwschema in (weken, uren, patiënten).
        </p>
        <div className="space-y-4">
          {staffMembers.map(staff => {
            const schedule = rampSchedules[staff.name] || []
            return (
              <div key={staff.name} className="border border-slate-200 rounded-2xl p-4 bg-white/80">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-semibold text-slate-900">{staff.name}</div>
                  <button
                    onClick={() => addRampWeek(staff.name)}
                    className="text-xs text-slate-700"
                  >
                    + week toevoegen
                  </button>
                </div>
                {schedule.length === 0 ? (
                  <div className="text-xs text-slate-500">Nog geen opbouwschema ingesteld.</div>
                ) : (
                  <div className="space-y-2">
                    {schedule.map((item, index) => (
                      <div key={`${staff.name}-${index}`} className="grid grid-cols-[80px_120px_120px_90px] gap-2 items-center text-sm">
                        <input
                          type="number"
                          min={1}
                          value={item.week}
                          onChange={(e) => updateRampSchedule(staff.name, index, { week: parseInt(e.target.value, 10) || 1 })}
                          className="px-2 py-1 border border-slate-200 rounded text-center bg-white"
                          placeholder="Week"
                        />
                        <input
                          type="number"
                          min={0}
                          value={item.hours}
                          onChange={(e) => updateRampSchedule(staff.name, index, { hours: parseInt(e.target.value, 10) || 0 })}
                          className="px-2 py-1 border border-slate-200 rounded text-center bg-white"
                          placeholder="Uren"
                        />
                        <input
                          type="number"
                          min={0}
                          value={item.patients}
                          onChange={(e) => updateRampSchedule(staff.name, index, { patients: parseInt(e.target.value, 10) || 0 })}
                          className="px-2 py-1 border border-slate-200 rounded text-center bg-white"
                          placeholder="Patiënten"
                        />
                        <button
                          onClick={() => removeRampWeek(staff.name, index)}
                          className="text-xs text-rose-500"
                        >
                          Verwijder
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
