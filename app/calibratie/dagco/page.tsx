'use client'

import { useEffect, useMemo, useState } from 'react'
import StaffManagement from '@/components/staff/StaffManagement'
import { DAYCO_PATIENTS_DEFAULT, getDaycoPatientsCount } from '@/types'
import { useStaff } from '@/hooks/useStaff'
import Select from '@/components/common/Select'

type RampScheduleMap = { [key: string]: Array<{ week: number; hours: number; patients: number }> }

export default function CalibratieDagcoPage() {
  const [daycoPatients, setDaycoPatients] = useState<number>(DAYCO_PATIENTS_DEFAULT)
  const [daycoCurrentPatients, setDaycoCurrentPatients] = useState<number>(DAYCO_PATIENTS_DEFAULT)
  const [daycoEffectiveDate, setDaycoEffectiveDate] = useState<string>('')
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
  const [selectedRampStaff, setSelectedRampStaff] = useState<string>('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const storedNext = localStorage.getItem('daycoPatientsNext') || localStorage.getItem('daycoPatients')
    const storedCurrent = localStorage.getItem('daycoPatientsCurrent') || localStorage.getItem('daycoPatients')
    const storedDate = localStorage.getItem('daycoPatientsEffectiveDate')
    const parsedNext = parseInt(storedNext || '', 10)
    const parsedCurrent = parseInt(storedCurrent || '', 10)
    setDaycoPatients(Number.isNaN(parsedNext) ? DAYCO_PATIENTS_DEFAULT : parsedNext)
    setDaycoCurrentPatients(Number.isNaN(parsedCurrent) ? DAYCO_PATIENTS_DEFAULT : parsedCurrent)
    setDaycoEffectiveDate(storedDate || new Date().toISOString().slice(0, 10))
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const today = new Date().toISOString().slice(0, 10)
    const effectiveDate = daycoEffectiveDate || today
    const isFuture = effectiveDate > today

    if (isFuture) {
      localStorage.setItem('daycoPatientsCurrent', String(daycoCurrentPatients))
      localStorage.setItem('daycoPatientsNext', String(daycoPatients))
    } else {
      localStorage.setItem('daycoPatientsCurrent', String(daycoPatients))
      localStorage.setItem('daycoPatientsNext', String(daycoPatients))
      if (daycoCurrentPatients !== daycoPatients) {
        setDaycoCurrentPatients(daycoPatients)
      }
    }

    localStorage.setItem('daycoPatientsEffectiveDate', effectiveDate)
    localStorage.setItem('daycoPatients', String(daycoPatients))
  }, [daycoPatients, daycoEffectiveDate, daycoCurrentPatients])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('staffRampSchedules', JSON.stringify(rampSchedules))
  }, [rampSchedules])

  const staffWithSchedules = useMemo(() => {
    const existing = new Set(Object.keys(rampSchedules))
    return staffMembers.filter(staff => existing.has(staff.name))
  }, [rampSchedules, staffMembers])

  useEffect(() => {
    if (selectedRampStaff) return
    if (staffWithSchedules.length > 0) {
      setSelectedRampStaff(staffWithSchedules[0].name)
      return
    }
    if (staffMembers.length > 0) {
      setSelectedRampStaff(staffMembers[0].name)
    }
  }, [selectedRampStaff, staffWithSchedules, staffMembers])

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

  const ensureRampSchedule = (staffName: string) => {
    setRampSchedules(prev => {
      if (prev[staffName]?.length) return prev
      return { ...prev, [staffName]: [{ week: 1, hours: 0, patients: 0 }] }
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

      <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Dagco capaciteit</h2>
        <p className="text-sm text-slate-600 mt-2">
          Stel in hoeveel patiënten meetellen wanneer iemand dagco is.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_200px] items-center">
          <label className="text-xs text-slate-500">
            Ingangsdatum
            <input
              type="date"
              value={daycoEffectiveDate}
              onChange={(e) => setDaycoEffectiveDate(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
            />
          </label>
          <div className="text-xs text-slate-500 md:text-right">
            Geldig vanaf: <span className="font-semibold text-slate-700">{daycoEffectiveDate || '—'}</span>
          </div>
        </div>
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

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1fr] gap-6">
        
          <StaffManagement onUpdate={() => {}} />
        

        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-2">Opbouwschema per verpleegkundige</h2>
          <p className="text-sm text-slate-600 mb-4">
            Selecteer een verpleegkundige en stel eventueel een opbouwschema in.
          </p>
          <div className="space-y-4">
            <div className="max-w-sm">
              <Select
                value={selectedRampStaff}
                onChange={(value) => setSelectedRampStaff(value)}
                options={staffMembers.map(staff => ({ value: staff.name, label: staff.name }))}
                label="Verpleegkundige"
                placeholder="Selecteer verpleegkundige"
              />
            </div>

            {selectedRampStaff ? (
              (() => {
                const schedule = rampSchedules[selectedRampStaff] || []
                const totalWeeks = schedule.reduce((max, item) => Math.max(max, item.week), 0)
                return (
                  <div className="border border-slate-200 rounded-2xl p-4 bg-white/80">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div className="font-semibold text-slate-900">{selectedRampStaff}</div>
                      <div className="text-xs text-slate-500">
                        Totale duur: <span className="font-semibold text-slate-700">{totalWeeks || 0}</span> weken
                      </div>
                      <button
                        onClick={() => addRampWeek(selectedRampStaff)}
                        className="text-xs text-slate-700"
                        disabled={!schedule.length}
                      >
                        + week toevoegen
                      </button>
                    </div>

                    {schedule.length === 0 ? (
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs text-slate-500">
                          Nog geen opbouwschema ingesteld voor deze verpleegkundige.
                        </div>
                        <button
                          onClick={() => ensureRampSchedule(selectedRampStaff)}
                          className="text-xs text-blue-700 font-semibold"
                        >
                          Opbouwschema toevoegen
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="grid grid-cols-[120px_160px_160px_90px] gap-2 text-[11px] font-semibold text-slate-500">
                          <div>Weeknummer</div>
                          <div>Uren per week</div>
                          <div>Patiënten per week</div>
                          <div />
                        </div>
                        {schedule.map((item, index) => (
                          <div key={`${selectedRampStaff}-${index}`} className="grid grid-cols-[120px_160px_160px_90px] gap-2 items-center text-sm">
                            <input
                              type="number"
                              min={1}
                              value={item.week}
                              onChange={(e) => updateRampSchedule(selectedRampStaff, index, { week: parseInt(e.target.value, 10) || 1 })}
                              className="px-2 py-1 border border-slate-200 rounded text-center bg-white"
                            />
                            <input
                              type="number"
                              min={0}
                              value={item.hours}
                              onChange={(e) => updateRampSchedule(selectedRampStaff, index, { hours: parseInt(e.target.value, 10) || 0 })}
                              className="px-2 py-1 border border-slate-200 rounded text-center bg-white"
                            />
                            <input
                              type="number"
                              min={0}
                              value={item.patients}
                              onChange={(e) => updateRampSchedule(selectedRampStaff, index, { patients: parseInt(e.target.value, 10) || 0 })}
                              className="px-2 py-1 border border-slate-200 rounded text-center bg-white"
                            />
                            <button
                              onClick={() => removeRampWeek(selectedRampStaff, index)}
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
              })()
            ) : (
              <div className="text-xs text-slate-500">Geen verpleegkundigen beschikbaar.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
