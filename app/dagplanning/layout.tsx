'use client'

import { useState, useEffect, createContext, useContext, ReactNode } from 'react'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  DAY_LABELS,
  getTodayISO,
  getDayOfWeekFromDate,
  DayOfWeek,
  formatDateToISO,
  getMondayOfWeek,
  Patient,
  WorkloadSlot,
} from '@/types'
import { usePatients } from '@/hooks/usePatients'
import { useStaff } from '@/hooks/useStaff'
import { useWorkload } from '@/hooks/useWorkload'
import SidebarTree from '@/components/common/SidebarTree'
import Statistics from '@/components/analysis/Statistics'

interface DagplanningContextType {
  selectedDate: string
  setSelectedDate: (date: string) => void
  patients: Patient[]
  setPatients: (patients: Patient[]) => void
  fetchPatients: () => Promise<void>
  staffMembers: any[]
  loadStaffMembers: () => void
  workload: WorkloadSlot[]
  setWorkload: (workload: WorkloadSlot[]) => void
  staffSchedule: Record<DayOfWeek, string[]>
  setStaffSchedule: (schedule: Record<DayOfWeek, string[]>) => void
  coordinatorByDay: Record<DayOfWeek, string | null>
  setCoordinatorByDay: (coordinators: Record<DayOfWeek, string | null>) => void
}

const DagplanningContext = createContext<DagplanningContextType | undefined>(undefined)

export function useDagplanningContext() {
  const context = useContext(DagplanningContext)
  if (!context) {
    throw new Error('useDagplanningContext must be used within DagplanningLayout')
  }
  return context
}

export default function DagplanningLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [selectedDate, setSelectedDate] = useState<string>(getTodayISO())
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(() => {
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(today.setDate(diff))
    return formatDateToISO(monday)
  })
  const [staffSchedule, setStaffSchedule] = useState<Record<DayOfWeek, string[]>>({
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: []
  })
  const [agreedMaxPatients, setAgreedMaxPatients] = useState<number | null>(null)
  const [coordinatorByDay, setCoordinatorByDay] = useState<Record<DayOfWeek, string | null>>({
    monday: null,
    tuesday: null,
    wednesday: null,
    thursday: null,
    friday: null
  })

  const { patients, setPatients, fetchPatients } = usePatients(selectedDate)
  const { staffMembers, loadStaffMembers } = useStaff()
  const { workload, setWorkload } = useWorkload(patients)

  useEffect(() => {
    const storedDate = localStorage.getItem('dagplanningSelectedDate')
    if (storedDate) {
      setSelectedDate(storedDate)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('dagplanningSelectedDate', selectedDate)
  }, [selectedDate])

  useEffect(() => {
    const monday = getMondayOfWeek(selectedDate)
    if (monday !== selectedWeekStart) {
      setSelectedWeekStart(monday)
    } else {
      loadWeekPlan()
    }
  }, [selectedDate])

  useEffect(() => {
    loadWeekPlan()
  }, [selectedWeekStart])

  // loadStaffMembers is already called inside useStaff on mount

  const loadWeekPlan = async () => {
    try {
      const response = await fetch(`/api/weekplan?weekStart=${selectedWeekStart}`)
      if (response.ok) {
        const data = await response.json()
        if (data && data.id) {
          const schedule: Record<DayOfWeek, string[]> = {
            monday: [],
            tuesday: [],
            wednesday: [],
            thursday: [],
            friday: []
          }
          const coordinators: Record<DayOfWeek, string | null> = {
            monday: null,
            tuesday: null,
            wednesday: null,
            thursday: null,
            friday: null
          }
          data.staffSchedules?.forEach((s: any) => {
            const day = s.dayOfWeek as DayOfWeek
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
          if (Array.isArray(data.dayCapacities)) {
            const match = data.dayCapacities.find((entry: any) => entry?.date === selectedDate)
            setAgreedMaxPatients(typeof match?.agreedMaxPatients === 'number' ? match.agreedMaxPatients : null)
          } else {
            setAgreedMaxPatients(null)
          }
          setStaffSchedule(schedule)
          setCoordinatorByDay(coordinators)
        } else {
          setStaffSchedule({
            monday: [],
            tuesday: [],
            wednesday: [],
            thursday: [],
            friday: []
          })
          setAgreedMaxPatients(null)
          setCoordinatorByDay({
            monday: null,
            tuesday: null,
            wednesday: null,
            thursday: null,
            friday: null
          })
        }
      } else {
        setStaffSchedule({
          monday: [],
          tuesday: [],
          wednesday: [],
          thursday: [],
          friday: []
        })
        setAgreedMaxPatients(null)
        setCoordinatorByDay({
          monday: null,
          tuesday: null,
          wednesday: null,
          thursday: null,
          friday: null
        })
      }
    } catch (error) {
      console.error('Failed to load week plan:', error)
      setStaffSchedule({
        monday: [],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: []
      })
      setAgreedMaxPatients(null)
      setCoordinatorByDay({
        monday: null,
        tuesday: null,
        wednesday: null,
        thursday: null,
        friday: null
      })
    }
  }

  const currentDay = getDayOfWeekFromDate(selectedDate)
  const assignedNamesForDay = staffSchedule[currentDay]
  const coordinatorForDay = coordinatorByDay[currentDay] || null

  const contextValue: DagplanningContextType = {
    selectedDate,
    setSelectedDate,
    patients,
    setPatients,
    fetchPatients,
    staffMembers,
    loadStaffMembers,
    workload,
    setWorkload,
    staffSchedule,
    setStaffSchedule,
    coordinatorByDay,
    setCoordinatorByDay,
  }

  return (
    <DagplanningContext.Provider value={contextValue}>
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
                <p className="text-[11px] text-white/80" suppressHydrationWarning>
                  {DAY_LABELS[currentDay]} • {selectedDate}
                </p>
              </div>
            </div>
            <div className="hidden md:block">
              <Statistics
                patients={patients}
                workload={workload}
                selectedDay={currentDay}
                staffMembers={staffMembers}
                assignedStaffNames={assignedNamesForDay}
                coordinatorName={coordinatorForDay}
                agreedMaxPatients={agreedMaxPatients}
              />
            </div>
            <div className="md:hidden text-xs text-white/80">
              {patients.length === 0 ? 'Geen patiënten ingepland' : `${patients.length} patiënten`}
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
              {pathname === '/dagplanning/planning' && (
                <div className={`mt-3 pt-3 border-t border-slate-200 space-y-2 px-3 ${sidebarCollapsed ? 'hidden' : ''}`}>
                  <button
                    onClick={async () => {
                      if (patients.length === 0) {
                        return
                        }
                        const response = await fetch('/api/rebalance-day', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ date: selectedDate })
                        })
                        if (response.ok) {
                          await fetchPatients()
                        }
                      }}
                      className="w-full px-4 py-2.5 bg-green-700 hover:bg-green-800 text-white rounded-lg transition-colors font-semibold text-sm flex items-center gap-2 justify-center"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>Optimaliseer</span>
                    </button>
                </div>
              )}
            </div>
              {pathname === '/dagplanning/planning' && (
                <div className={`p-4 border-t border-slate-200 ${sidebarCollapsed ? 'hidden' : ''}`}>
                    <button
                      onClick={async () => {
                        if (!confirm('Weet u zeker dat u de planning wilt wissen?')) return
                        const response = await fetch(`/api/patients?date=${selectedDate}`, { method: 'DELETE' })
                        if (response.ok) {
                          setPatients([])
                          await fetchPatients()
                        }
                      }}
                      className="w-full px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors font-semibold text-sm flex flex-col items-center gap-1"
                    >
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Wissen</span>
                      </div>
                      <span className="text-xs font-normal text-red-800">
                        {(() => {
                          const d = new Date(selectedDate + 'T00:00:00')
                          const dayNames = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag']
                          const dayName = dayNames[d.getDay()]
                          const day = d.getDate()
                          const month = d.getMonth() + 1
                          return `${dayName} ${day}/${month}`
                        })()}
                      </span>
                    </button>
                  </div>
              )}
            </aside>

            <div className="flex-1 overflow-y-auto p-6" tabIndex={0} role="region" aria-label="Hoofdinhoud">
              <div className={sidebarCollapsed ? 'max-w-none mx-0' : 'max-w-[1800px] mx-auto'}>
                {children}
              </div>
            </div>
          </div>
        </div>
      </main>
    </DagplanningContext.Provider>
  )
}
