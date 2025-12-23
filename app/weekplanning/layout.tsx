'use client'

import { useState, useEffect, createContext, useContext, ReactNode, useCallback, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  DayOfWeek,
  formatDateToISO,
  getDayOfWeekFromDate,
  Patient,
  WorkloadSlot,
} from '@/types'
import { useStaff } from '@/hooks/useStaff'
import { calculateWorkloadByTimeSlot } from '@/utils/planning/workload'
import Navbar from '@/components/common/Navbar'
import Statistics from '@/components/analysis/Statistics'
import WeekPicker from '@/components/planning/WeekPicker'

interface WeekPlanResponse {
  id?: string
  staffSchedules?: Array<{ dayOfWeek: DayOfWeek; staffNames: string }>
  treatments?: Array<{ medicationId: string; treatmentNumber: number; quantity: number }>
  generatedPatients?: string
  dayCapacities?: Array<{ date: string; plannedPatients?: number | null; agreedMaxPatients?: number | null; note?: string | null; sennaNote?: string | null }>
}

interface WeekplanningContextType {
  selectedWeekStart: string
  setSelectedWeekStart: (date: string) => void
  staffSchedule: Record<DayOfWeek, string[]>
  setStaffSchedule: (schedule: Record<DayOfWeek, string[]>) => void
  coordinatorByDay: Record<DayOfWeek, string | null>
  setCoordinatorByDay: (coordinators: Record<DayOfWeek, string | null>) => void
  treatments: Array<{ medicationId: string; treatmentNumber: number; quantity: number }>
  setTreatments: (treatments: Array<{ medicationId: string; treatmentNumber: number; quantity: number }>) => void
  generatedPatients: string[]
  setGeneratedPatients: (patients: string[]) => void
  isGenerating: boolean
  setIsGenerating: (generating: boolean) => void
  allWeekPatients: Patient[]
  setAllWeekPatients: (patients: Patient[]) => void
  workload: WorkloadSlot[]
  setWorkload: (workload: WorkloadSlot[]) => void
  dayCapacities: Record<string, { plannedPatients?: number | null; agreedMaxPatients?: number | null; note?: string | null; sennaNote?: string | null }>
  setDayCapacities: (capacities: Record<string, { plannedPatients?: number | null; agreedMaxPatients?: number | null; note?: string | null; sennaNote?: string | null }>) => void
  updateDayCapacity: (date: string, updates: { plannedPatients?: number | null; agreedMaxPatients?: number | null; note?: string | null; sennaNote?: string | null }) => Promise<void>
  staffMembers: any[]
  loadStaffMembers: () => void
  loadWeekPlan: () => Promise<void>
  saveWeekPlan: () => Promise<boolean>
  getWeekDates: () => string[]
  getWeekEndDate: (weekStart: string) => string
}

const WeekplanningContext = createContext<WeekplanningContextType | undefined>(undefined)

export function useWeekplanningContext() {
  const context = useContext(WeekplanningContext)
  if (!context) {
    throw new Error('useWeekplanningContext must be used within WeekplanningLayout')
  }
  return context
}

const emptySchedule: Record<DayOfWeek, string[]> = {
  monday: [],
  tuesday: [],
  wednesday: [],
  thursday: [],
  friday: []
}

const emptyCoordinators: Record<DayOfWeek, string | null> = {
  monday: null,
  tuesday: null,
  wednesday: null,
  thursday: null,
  friday: null
}

export default function WeekplanningLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(() => {
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(today.setDate(diff))
    return formatDateToISO(monday)
  })
  const [staffSchedule, setStaffSchedule] = useState<Record<DayOfWeek, string[]>>(emptySchedule)
  const [coordinatorByDay, setCoordinatorByDay] = useState<Record<DayOfWeek, string | null>>(emptyCoordinators)
  const [treatments, setTreatments] = useState<Array<{ medicationId: string; treatmentNumber: number; quantity: number }>>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedPatients, setGeneratedPatients] = useState<string[]>([])
  const [allWeekPatients, setAllWeekPatients] = useState<Patient[]>([])
  const [workload, setWorkload] = useState<WorkloadSlot[]>([])
  const [dayCapacities, setDayCapacities] = useState<Record<string, { plannedPatients?: number | null; agreedMaxPatients?: number | null; note?: string | null; sennaNote?: string | null }>>({})
  const isHydratingRef = useRef(false)
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipNextAutoSaveRef = useRef(true)

  const { staffMembers, loadStaffMembers } = useStaff()

  const getWeekDates = () => {
    const start = new Date(selectedWeekStart + 'T00:00:00')
    const dates: string[] = []
    for (let i = 0; i < 5; i++) {
      const date = new Date(start)
      date.setDate(start.getDate() + i)
      dates.push(formatDateToISO(date))
    }
    return dates
  }

  const getWeekEndDate = (weekStart: string): string => {
    const start = new Date(weekStart + 'T00:00:00')
    const friday = new Date(start)
    friday.setDate(start.getDate() + 4)
    return formatDateToISO(friday)
  }

  const resetWeekPlanState = useCallback(() => {
    setStaffSchedule({ ...emptySchedule })
    setCoordinatorByDay({ ...emptyCoordinators })
    setTreatments([])
    setGeneratedPatients([])
  }, [])

  const loadWeekPlan = useCallback(async () => {
    try {
      const response = await fetch(`/api/weekplan?weekStart=${selectedWeekStart}`)
      if (!response.ok) {
        resetWeekPlanState()
        setDayCapacities({})
        return
      }

      const data: WeekPlanResponse = await response.json()
      if (!data || !data.id) {
        resetWeekPlanState()
        return
      }

      const schedule: Record<DayOfWeek, string[]> = { ...emptySchedule }
      const coordinators: Record<DayOfWeek, string | null> = { ...emptyCoordinators }

      data.staffSchedules?.forEach(s => {
        const day = s.dayOfWeek
        try {
          const parsed = JSON.parse(s.staffNames)
          if (Array.isArray(parsed)) {
            schedule[day] = parsed
          } else {
            schedule[day] = parsed?.staff || []
            coordinators[day] = parsed?.coordinator || null
          }
        } catch {
          schedule[day] = []
        }
      })

      setStaffSchedule(schedule)
      setCoordinatorByDay(coordinators)
      setTreatments(data.treatments || [])
      setGeneratedPatients(data.generatedPatients ? JSON.parse(data.generatedPatients) : [])
      const capacities = data.dayCapacities || []
      const mapped: Record<string, { plannedPatients?: number | null; agreedMaxPatients?: number | null; note?: string | null; sennaNote?: string | null }> = {}
      capacities.forEach(cap => {
        mapped[cap.date] = {
          plannedPatients: cap.plannedPatients ?? null,
          agreedMaxPatients: cap.agreedMaxPatients ?? null,
          note: cap.note ?? null,
          sennaNote: cap.sennaNote ?? null
        }
      })
      setDayCapacities(mapped)
    } catch (error) {
      console.error('Failed to load week plan:', error)
      resetWeekPlanState()
      setDayCapacities({})
    }
  }, [selectedWeekStart, resetWeekPlanState])

  const updateDayCapacity = useCallback(async (
    date: string,
    updates: { plannedPatients?: number | null; agreedMaxPatients?: number | null; note?: string | null; sennaNote?: string | null }
  ) => {
    try {
      setDayCapacities(prev => ({
        ...prev,
        [date]: {
          plannedPatients: updates.plannedPatients ?? prev[date]?.plannedPatients ?? null,
          agreedMaxPatients: updates.agreedMaxPatients ?? prev[date]?.agreedMaxPatients ?? null,
          note: updates.note ?? prev[date]?.note ?? null,
          sennaNote: updates.sennaNote ?? prev[date]?.sennaNote ?? null
        }
      }))
      await fetch('/api/weekplan/day-capacity', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekStartDate: selectedWeekStart,
          date,
          plannedPatients: updates.plannedPatients ?? null,
          agreedMaxPatients: updates.agreedMaxPatients ?? null,
          note: updates.note ?? null,
          sennaNote: updates.sennaNote ?? null
        })
      })
    } catch (error) {
      console.error('Failed to update day capacity:', error)
    }
  }, [selectedWeekStart])

  const saveWeekPlan = useCallback(async (): Promise<boolean> => {
    try {
      const weekEnd = getWeekEndDate(selectedWeekStart)
      const response = await fetch('/api/weekplan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekStartDate: selectedWeekStart,
          weekEndDate: weekEnd,
          staffSchedules: (Object.entries(staffSchedule) as Array<[DayOfWeek, string[]]>).map(([day, names]) => ({
            dayOfWeek: day,
            staffNames: JSON.stringify({
              staff: names,
              coordinator: coordinatorByDay[day] || null
            })
          })),
          treatments
        })
      })

      if (response.ok) {
        await loadWeekPlan()
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to save week plan:', error)
      return false
    }
  }, [selectedWeekStart, staffSchedule, coordinatorByDay, treatments, loadWeekPlan])

  const syncWeekPlan = useCallback(async () => {
    try {
      await fetch('/api/weekplan/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekStartDate: selectedWeekStart,
          staffSchedule,
          coordinatorByDay,
          treatments
        })
      })
      await loadWeekPlan()
    } catch (error) {
      console.error('Failed to sync week plan:', error)
    }
  }, [selectedWeekStart, staffSchedule, coordinatorByDay, treatments, loadWeekPlan])

  const saveAndSync = useCallback(async () => {
    const saved = await saveWeekPlan()
    if (saved) {
      await syncWeekPlan()
    }
  }, [saveWeekPlan, syncWeekPlan])

  useEffect(() => {
    loadStaffMembers()
  }, [loadStaffMembers])

  useEffect(() => {
    isHydratingRef.current = true
    skipNextAutoSaveRef.current = true
    const run = async () => {
      await loadWeekPlan()
      isHydratingRef.current = false
    }
    run()
  }, [selectedWeekStart, loadWeekPlan])

  useEffect(() => {
    if (isHydratingRef.current) return
    if (skipNextAutoSaveRef.current) {
      skipNextAutoSaveRef.current = false
      return
    }
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }
    autoSaveTimeoutRef.current = setTimeout(() => {
      saveAndSync()
    }, 600)
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [staffSchedule, coordinatorByDay, treatments, saveAndSync])

  useEffect(() => {
    const fetchAllWeekPatients = async () => {
      try {
        const start = new Date(selectedWeekStart + 'T00:00:00')
        const dates: string[] = []
        for (let i = 0; i < 5; i++) {
          const date = new Date(start)
          date.setDate(start.getDate() + i)
          dates.push(formatDateToISO(date))
        }
        
        const allPatients: Patient[] = []
        
        for (const date of dates) {
          const response = await fetch(`/api/patients?date=${date}`)
          if (response.ok) {
            const patients = await response.json()
            allPatients.push(...patients)
          }
        }
        
        setAllWeekPatients(allPatients)
        const calculatedWorkload = calculateWorkloadByTimeSlot(allPatients)
        setWorkload(calculatedWorkload)
      } catch (error) {
        console.error('Failed to fetch week patients:', error)
      }
    }
    
    fetchAllWeekPatients()
  }, [selectedWeekStart])


  const navItems = [
    {
      href: '/weekplanning/cap-overzicht',
      label: 'CAP Overzicht',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6m6 0V9a2 2 0 012-2h2a2 2 0 012 2v8m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v12" />
        </svg>
      )
    },
    {
      href: '/weekplanning/behandelingen',
      label: 'Behandelingen',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      )
    }
  ]

  const contextValue: WeekplanningContextType = {
    selectedWeekStart,
    setSelectedWeekStart,
    staffSchedule,
    setStaffSchedule,
    coordinatorByDay,
    setCoordinatorByDay,
    treatments,
    setTreatments,
    generatedPatients,
    setGeneratedPatients,
    isGenerating,
    setIsGenerating,
    allWeekPatients,
    setAllWeekPatients,
    workload,
    setWorkload,
    dayCapacities,
    setDayCapacities,
    updateDayCapacity,
    staffMembers,
    loadStaffMembers,
    loadWeekPlan,
    saveWeekPlan,
    getWeekDates,
    getWeekEndDate,
  }

  return (
    <WeekplanningContext.Provider value={contextValue}>
      <main className="h-screen flex flex-col bg-slate-50 overflow-hidden">
        <header className="bg-gradient-to-r from-blue-700 to-blue-600 text-white shadow-lg flex-shrink-0">
          <div className="max-w-[1800px] mx-auto px-6 py-4 flex items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/30 bg-white/10 flex items-center justify-center">
                <Image
                  src="/logo.png"
                  alt="St. Antonius Logo"
                  width={40}
                  height={40}
                  className="object-contain"
                />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Dagbehandeling 4B</h1>
                <p className="text-xs text-white/80">Week van {selectedWeekStart}</p>
              </div>
            </div>
            <div className="hidden md:block">
              <Statistics
                patients={allWeekPatients}
                workload={workload}
                selectedDay={getDayOfWeekFromDate(selectedWeekStart)}
                staffMembers={staffMembers}
              />
            </div>
            <div className="md:hidden text-xs text-white/80">
              {allWeekPatients.length === 0 ? 'Geen patiënten ingepland' : `${allWeekPatients.length} patiënten • ${workload.reduce((max, slot) => Math.max(max, slot.count), 0)} gelijktijdig`}
            </div>
          </div>
          <Navbar
            variant="primary"
          />
        </header>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold text-slate-900">Plan per Week</h2>
              <div className="h-8 w-px bg-slate-300" />
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Week:</label>
                <WeekPicker
                  value={selectedWeekStart}
                  onChange={setSelectedWeekStart}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xs text-slate-500 bg-slate-100 px-3 py-2 rounded-lg border border-slate-200">
                Automatisch opslaan & synchroniseren
              </div>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            <aside className="w-64 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col">
              <nav className="flex flex-col p-4 space-y-1 flex-1" aria-label="Weekplanning navigatie">
                {navItems.map((item) => {
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`px-4 py-3 font-semibold transition-colors rounded-lg text-left flex items-center gap-3 ${
                        isActive
                          ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </nav>

              <div className="p-4 border-t border-slate-200 space-y-2">
                <button
                  onClick={async () => {
                    if (!confirm('Weet u zeker dat u de weekplanning wilt genereren? Dit vervangt de huidige patiënten voor deze week.')) return
                    setIsGenerating(true)
                    try {
                      const { generateWeekPlan } = await import('@/utils/planning/weekPlanGenerator')
                      const result = await generateWeekPlan(selectedWeekStart, staffSchedule as any, treatments, staffMembers)
                      if (!result || !result.patients || result.patients.length === 0) {
                        setIsGenerating(false)
                        return
                      }

                      const response = await fetch('/api/weekplan/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          weekStartDate: selectedWeekStart,
                          patientIds: result.patientIds,
                          patients: result.patients
                        })
                      })

                      if (response.ok) {
                        setGeneratedPatients(result.patientIds)
                        await loadWeekPlan()
                      }
                    } catch (error) {
                      console.error('Failed to generate week plan:', error)
                    } finally {
                      setIsGenerating(false)
                    }
                  }}
                  className="w-full px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-sm transition-colors"
                >
                  Weekplanning genereren
                </button>
                {generatedPatients.length > 0 && (
                  <button
                    onClick={async () => {
                      if (!confirm(`Weet je zeker dat je de gegenereerde planning wilt verwijderen? Dit verwijdert ${generatedPatients.length} patiënten.`)) return
                      try {
                        const { deletePatient } = await import('@/features/patients/patientService')
                        let deletedCount = 0
                        for (const patientId of generatedPatients) {
                          const success = await deletePatient(patientId)
                          if (success) {
                            deletedCount++
                          }
                        }

                        setGeneratedPatients([])

                        await fetch('/api/weekplan', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            weekStartDate: selectedWeekStart,
                            generatedPatients: JSON.stringify([])
                          })
                        })

                        await loadWeekPlan()
                      } catch (error) {
                        console.error('Failed to delete plan:', error)
                      }
                    }}
                    className="w-full px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-sm transition-colors"
                  >
                    Verwijder gegenereerde patiënten
                  </button>
                )}
              </div>
            </aside>

            <div className="flex-1 overflow-y-auto p-6" tabIndex={0} role="region" aria-label="Weekplanning inhoud">
              <div className="max-w-[1800px] mx-auto">
                {children}
              </div>
            </div>
          </div>
        </div>
      </main>
    </WeekplanningContext.Provider>
  )
}
