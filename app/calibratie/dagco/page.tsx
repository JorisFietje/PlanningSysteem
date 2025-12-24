'use client'

import { useEffect, useState } from 'react'
import StaffManagement from '@/components/staff/StaffManagement'
import { getDaycoPatientsCount } from '@/types'
import { useStaff } from '@/hooks/useStaff'
import { RampScheduleItem, RampScheduleMap, loadRampSchedules, saveRampSchedules } from '@/utils/staff/rampSchedules'

export default function CalibratieDagcoPage() {
  const [daycoPatients, setDaycoPatients] = useState<number>(getDaycoPatientsCount())
  const { staffMembers } = useStaff()
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
      const nextWeek = Math.max(0, ...schedule.map(item => item.week || 0)) + 1
      schedule.push({ week: nextWeek, startTime: '08:00', endTime: '16:30', patients: null })
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
    const getISOWeekInfo = (date: Date) => {
      const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
      const dayNum = target.getUTCDay() || 7
      target.setUTCDate(target.getUTCDate() + 4 - dayNum)
      const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1))
      const weekNo = Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
      return { week: weekNo, year: target.getUTCFullYear() }
    }
    const weekInfo = getISOWeekInfo(today)
    setRampSchedules(prev => ({
      ...prev,
      [staffName]: {
        createdAt: today.toISOString().slice(0, 10),
        startWeek: weekInfo.week,
        startWeekYear: weekInfo.year,
        items: [{ week: 1, startTime: '08:00', endTime: '16:30', patients: null }]
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
        <h2 className="text-lg font-semibold mb-2">Verpleegkundigen (standaard)</h2>
        <p className="text-sm text-slate-600 mb-4">
          Beheer standaard maximale aantallen per verpleegkundige.
        </p>
        <StaffManagement onUpdate={() => {}} />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-2">Opbouwschema per verpleegkundige</h2>
        <p className="text-sm text-slate-600 mb-4">
          Voeg een verpleegkundige toe en maak een opbouwschema per week (week, uren, patiënten).
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
                        + week toevoegen
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
                      Start week (jaarweek)
                      <input
                        type="number"
                        min={1}
                        max={53}
                        value={data.startWeek ?? ''}
                        onChange={(e) => {
                          const value = e.target.value
                          setRampSchedules(prev => ({
                            ...prev,
                            [staffName]: {
                              ...prev[staffName],
                              startWeek: value === '' ? undefined : parseInt(value, 10),
                              startWeekYear: prev[staffName]?.startWeekYear ?? new Date().getFullYear()
                            }
                          }))
                        }}
                        className="mt-2 w-32 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800"
                      />
                    </label>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Jaar: {data.startWeekYear ?? new Date().getFullYear()}
                    </div>
                  </div>

                  {schedule.length === 0 ? (
                    <div className="text-xs text-slate-500">Nog geen opbouwschema ingesteld.</div>
                  ) : (
                    <>
                      <div className="grid grid-cols-[80px_140px_140px_120px_90px] gap-2 text-[11px] font-semibold text-slate-500 mb-2">
                        <div>Week</div>
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
                              value={item.week ?? ''}
                              onChange={(e) => {
                                const value = e.target.value
                                updateRampSchedule(staffName, index, { week: value === '' ? null : parseInt(value, 10) })
                              }}
                              className="px-2 py-1 border border-slate-200 rounded text-center bg-white"
                              placeholder="Week"
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
