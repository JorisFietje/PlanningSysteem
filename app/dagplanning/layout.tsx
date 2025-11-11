'use client'

import { useState, useEffect, createContext, useContext, ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
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
import Navbar from '@/components/common/Navbar'
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

  useEffect(() => {
    loadStaffMembers()
  }, [loadStaffMembers])

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

  const navItems = [
    {
      href: '/dagplanning/planning',
      label: 'Dagplanning',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      href: '/dagplanning/behandelingen',
      label: 'Behandelingen',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      )
    },
    {
      href: '/dagplanning/analyse',
      label: 'Werkdruk Analyse',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    {
      href: '/dagplanning/medewerkers',
      label: 'Medewerker Planning',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    }
  ]

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
                <p className="text-xs text-white/80">{DAY_LABELS[currentDay]} • {selectedDate}</p>
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
              />
            </div>
            <div className="md:hidden text-xs text-white/80">
              {patients.length === 0 ? 'Geen patiënten ingepland' : `${patients.length} patiënten • ${workload.reduce((max, slot) => Math.max(max, slot.count), 0)} gelijktijdig`}
            </div>
          </div>
          <Navbar
            variant="primary"
          />
        </header>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex overflow-hidden">
            <aside className="w-64 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col">
              <nav className="flex flex-col p-4 space-y-1 flex-1" aria-label="Hoofdnavigatie">
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

                {pathname === '/dagplanning/planning' && (
                  <div className="mt-6 pt-6 border-t border-slate-200 space-y-2">
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
              </nav>
              {pathname === '/dagplanning/planning' && (
                <div className="p-4 border-t border-slate-200">
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
              <div className="max-w-[1800px] mx-auto">
                {children}
              </div>
            </div>
          </div>
        </div>
      </main>
    </DagplanningContext.Provider>
  )
}

