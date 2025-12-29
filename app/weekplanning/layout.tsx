'use client'

import { useState, useEffect, createContext, useContext, ReactNode, useCallback, useRef } from 'react'
import Image from 'next/image'
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
import SidebarTree from '@/components/common/SidebarTree'
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
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

  const saveAndSync = useCallback(async () => {
    await saveWeekPlan()
  }, [saveWeekPlan])

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
          <div className="max-w-[1800px] mx-auto px-6 py-2.5 min-h-[64px] flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white/30 bg-white/10 flex items-center justify-center">
                <Image
                  src="/logo.png"
                  alt="St. Antonius Logo"
                  width={36}
                  height={36}
                  className="object-contain"
                />
              </div>
              <div>
                <h1 className="text-xl font-bold">Dagbehandeling 4B</h1>
                <p className="text-[11px] text-white/80">Week van {selectedWeekStart}</p>
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
              {allWeekPatients.length === 0 ? 'Geen patiënten ingepland' : `${allWeekPatients.length} patiënten`}
            </div>
          </div>
        </header>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex overflow-hidden">
          <aside className={`${sidebarCollapsed ? 'w-16' : 'w-56'} bg-white border-r border-slate-200 flex-shrink-0 flex flex-col transition-[width] duration-300 ease-in-out`}>
            <div className="flex items-center justify-end px-2 py-2 border-b border-slate-200">
              <button
                type="button"
                onClick={() => setSidebarCollapsed(prev => !prev)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                title={sidebarCollapsed ? 'Sidebar uitklappen' : 'Sidebar inklappen'}
              >
                {sidebarCollapsed ? '»' : '«'}
              </button>
            </div>
            <div className="flex-1">
              <SidebarTree collapsed={sidebarCollapsed} />
            </div>

              {pathname !== '/weekplanning/cap-overzicht' && (
                <div className={`p-3 border-t border-slate-200 space-y-2 ${sidebarCollapsed ? 'hidden' : ''}`}>
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
              )}
            </aside>

          <div className="flex-1 overflow-y-auto p-3" tabIndex={0} role="region" aria-label="Weekplanning inhoud">
            <div className={sidebarCollapsed ? 'max-w-none mx-0' : 'max-w-[1800px] mx-auto'}>
              {children}
            </div>
          </div>
          </div>
        </div>
      </main>
    </WeekplanningContext.Provider>
  )
}
