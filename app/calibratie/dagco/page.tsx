'use client'

import { useEffect, useState } from 'react'
import StaffManagement from '@/components/staff/StaffManagement'
import { getDaycoPatientsCount, getDepartmentHours, saveDepartmentHours } from '@/types'
import { useStaff } from '@/hooks/useStaff'
import { RampScheduleItem, RampScheduleMap, loadRampSchedules, saveRampSchedules } from '@/utils/staff/rampSchedules'

export default function CalibratieDagcoPage() {
  const [daycoPatients, setDaycoPatients] = useState<number>(getDaycoPatientsCount())
  const { staffMembers } = useStaff()
  const initialHours = getDepartmentHours()
  const [openStart, setOpenStart] = useState<number>(initialHours.startMinutes)
  const [openEnd, setOpenEnd] = useState<number>(initialHours.endMinutes)
  const [rampSchedules, setRampSchedules] = useState<RampScheduleMap>(() => loadRampSchedules())
  const [selectedRampStaff, setSelectedRampStaff] = useState<string>('')
  const timeOptions = Array.from({ length: 19 }, (_, index) => {
    const minutes = 8 * 60 + index * 30
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
  })

  useEffect(() => {
    localStorage.setItem('daycoPatients', String(daycoPatients))
  }, [daycoPatients])

  useEffect(() => {
    saveRampSchedules(rampSchedules)
  }, [rampSchedules])

  useEffect(() => {
    saveDepartmentHours(openStart, openEnd)
  }, [openStart, openEnd])

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
  }

  const sliderMin = 7 * 60
  const sliderMax = 18 * 60
  const sliderRange = sliderMax - sliderMin
  const startPercent = ((openStart - sliderMin) / sliderRange) * 100
  const endPercent = ((openEnd - sliderMin) / sliderRange) * 100

  const updateRampSchedule = (staffName: string, weekIndex: number, updates: Partial<RampScheduleItem>) => {
    setRampSchedules(prev => {
      const schedule = prev[staffName]?.items ? [...prev[staffName].items] : []
      schedule[weekIndex] = { ...schedule[weekIndex], ...updates }
      return { ...prev, [staffName]: { ...prev[staffName], items: schedule } as any }
    })
  }

  const addRampWeek = (staffName: string) => {
    setRampSchedules(prev => {
      const schedule = prev[staffName]?.items ? [...prev[staffName].items] : []
      const nextOccurrence = Math.max(0, ...schedule.map(item => item.occurrence || 0)) + 1
      schedule.push({ occurrence: nextOccurrence, startTime: '08:00', endTime: '16:30', patients: null })
      return { ...prev, [staffName]: { ...prev[staffName], items: schedule } as any }
    })
  }

  const removeRampWeek = (staffName: string, weekIndex: number) => {
    setRampSchedules(prev => {
      const schedule = prev[staffName]?.items ? [...prev[staffName].items] : []
      schedule.splice(weekIndex, 1)
      return { ...prev, [staffName]: { ...prev[staffName], items: schedule } as any }
    })
  }

  const addRampStaff = () => {
    const staffName = selectedRampStaff
    if (!staffName || rampSchedules[staffName]) return
    const today = new Date()
    const todayISO = today.toISOString().slice(0, 10)
    setRampSchedules(prev => ({
      ...prev,
      [staffName]: {
        createdAt: todayISO,
        startDate: todayISO,
        items: [{ occurrence: 1, startTime: '08:00', endTime: '16:30', patients: null }]
      }
    }))
    setSelectedRampStaff('')
  }

  const removeRampStaff = (staffName: string) => {
    setRampSchedules(prev => {
      const next = { ...prev }
      delete next[staffName]
      return next
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
        <h2 className="text-lg font-semibold">Openingstijden afdeling</h2>
        <p className="text-sm text-slate-600 mt-2">
          Bepaal van hoe laat tot hoe laat er patiënten ingepland mogen worden.
        </p>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between text-sm text-slate-700">
            <span>Start: <strong>{formatMinutes(openStart)}</strong></span>
            <span>Einde: <strong>{formatMinutes(openEnd)}</strong></span>
          </div>
          <div className="relative h-3 rounded-full bg-slate-200">
            <div
              className="absolute h-3 rounded-full bg-blue-600"
              style={{
                left: `${startPercent}%`,
                right: `${100 - endPercent}%`
              }}
            />
            <input
              type="range"
              min={sliderMin}
              max={sliderMax}
              step={5}
              value={openStart}
              onChange={(e) => {
                const next = Math.min(parseInt(e.target.value, 10), openEnd - 5)
                setOpenStart(next)
              }}
              className="absolute inset-0 w-full bg-transparent appearance-none range-thumb-only"
              aria-label="Openingstijd start"
            />
            <input
              type="range"
              min={sliderMin}
              max={sliderMax}
              step={5}
              value={openEnd}
              onChange={(e) => {
                const next = Math.max(parseInt(e.target.value, 10), openStart + 5)
                setOpenEnd(next)
              }}
              className="absolute inset-0 w-full bg-transparent appearance-none range-thumb-only"
              aria-label="Openingstijd einde"
            />
          </div>
        </div>
      </div>

      <style jsx global>{`
        .range-thumb-only {
          pointer-events: none;
        }
        .range-thumb-only::-webkit-slider-thumb {
          pointer-events: auto;
        }
        .range-thumb-only::-moz-range-thumb {
          pointer-events: auto;
        }
      `}</style>

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
          Voeg een verpleegkundige toe en maak een opbouwschema per ingeplande keer (keer, uren, patiënten).
        </p>
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <label className="text-xs text-slate-500">
            Verpleegkundige toevoegen
            <select
              value={selectedRampStaff}
              onChange={(e) => setSelectedRampStaff(e.target.value)}
              className="mt-2 w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800"
            >
              <option value="">Selecteer verpleegkundige</option>
              {staffMembers
                .filter(staff => !rampSchedules[staff.name])
                .map(staff => (
                  <option key={staff.name} value={staff.name}>
                    {staff.name}
                  </option>
                ))}
            </select>
          </label>
          <button
            onClick={addRampStaff}
            className="text-xs text-slate-700 border border-slate-300 px-3 py-2 rounded-full bg-white transition hover:border-slate-400 hover:bg-slate-50"
          >
            + Toevoegen
          </button>
        </div>

        {Object.keys(rampSchedules).length === 0 ? (
          <div className="text-xs text-slate-500">Nog geen opbouwschema’s toegevoegd.</div>
        ) : (
          <div className="space-y-4">
            {Object.entries(rampSchedules).map(([staffName, data]) => {
              const schedule = data.items || []
              return (
                <div key={staffName} className="border border-slate-200 rounded-2xl p-4 bg-white/80">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="font-semibold text-slate-900">{staffName}</div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => addRampWeek(staffName)}
                        className="text-xs text-slate-700"
                      >
                        + keer toevoegen
                      </button>
                      <button
                        onClick={() => removeRampStaff(staffName)}
                        className="text-xs text-rose-500"
                      >
                        Verwijder verpleegkundige
                      </button>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="text-xs text-slate-500">
                      Start datum
                      <input
                        type="date"
                        value={data.startDate ?? ''}
                        onChange={(e) => {
                          const value = e.target.value
                          setRampSchedules(prev => ({
                            ...prev,
                            [staffName]: {
                              ...prev[staffName],
                              startDate: value === '' ? undefined : value
                            }
                          }))
                        }}
                        className="mt-2 w-40 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800"
                      />
                    </label>
                  </div>

                  {schedule.length === 0 ? (
                    <div className="text-xs text-slate-500">Nog geen opbouwschema ingesteld.</div>
                  ) : (
                    <>
                      <div className="grid grid-cols-[80px_140px_140px_120px_90px] gap-2 text-[11px] font-semibold text-slate-500 mb-2">
                        <div>Keer</div>
                        <div>Van</div>
                        <div>Tot</div>
                        <div>Patiënten</div>
                        <div></div>
                      </div>
                      <div className="space-y-2">
                        {schedule.map((item, index) => (
                          <div key={`${staffName}-${index}`} className="grid grid-cols-[80px_140px_140px_120px_90px] gap-2 items-center text-sm">
                            <input
                              type="number"
                              min={1}
                              value={item.occurrence ?? ''}
                              onChange={(e) => {
                                const value = e.target.value
                                updateRampSchedule(staffName, index, { occurrence: value === '' ? null : parseInt(value, 10) })
                              }}
                              className="px-2 py-1 border border-slate-200 rounded text-center bg-white"
                              placeholder="Keer"
                            />
                            <select
                              value={item.startTime ?? '08:00'}
                              onChange={(e) => updateRampSchedule(staffName, index, { startTime: e.target.value })}
                              className="px-2 py-1 border border-slate-200 rounded text-center bg-white"
                            >
                              {timeOptions.map(option => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                            <select
                              value={item.endTime ?? '16:30'}
                              onChange={(e) => updateRampSchedule(staffName, index, { endTime: e.target.value })}
                              className="px-2 py-1 border border-slate-200 rounded text-center bg-white"
                            >
                              {timeOptions.map(option => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              min={0}
                              value={item.patients ?? ''}
                              onChange={(e) => {
                                const value = e.target.value
                                updateRampSchedule(staffName, index, { patients: value === '' ? null : parseInt(value, 10) })
                              }}
                              className="px-2 py-1 border border-slate-200 rounded text-center bg-white"
                              placeholder="Patiënten"
                            />
                            <button
                              onClick={() => removeRampWeek(staffName, index)}
                              className="text-xs text-rose-500"
                            >
                              Verwijder
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
