'use client'

import { useState, useEffect } from 'react'
import { getTodayISO, formatDateToISO, getDayOfWeekFromDate, DAY_LABELS, DayOfWeek, StaffMember, getDailyPatientCapacity } from '@/types'
import { getStaffMembers } from '@/utils/staff/staffManagement'
import WeekStaffSchedule from '@/components/planning/WeekStaffSchedule'
import WeekTreatments from '@/components/planning/WeekTreatments'
import WeekOverview from '@/components/planning/WeekOverview'
import { generateWeekPlan } from '@/utils/planning/weekPlanGenerator'

type WeekPlanTab = 'rooster' | 'behandelingen' | 'overzicht'

export default function WeekPlanPage() {
  const [activeTab, setActiveTab] = useState<WeekPlanTab>('rooster')
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(() => {
    // Get Monday of current week
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
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
  
  const [treatments, setTreatments] = useState<Array<{
    medicationId: string
    treatmentNumber: number
    quantity: number
  }>>([])
  
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedPatients, setGeneratedPatients] = useState<string[]>([])

  useEffect(() => {
    loadStaffMembers()
    loadWeekPlan()
  }, [selectedWeekStart])

  const loadStaffMembers = async () => {
    const loaded = await getStaffMembers()
    setStaffMembers(loaded)
  }

  const loadWeekPlan = async () => {
    try {
      const response = await fetch(`/api/weekplan?weekStart=${selectedWeekStart}`)
      if (response.ok) {
        const data = await response.json()
        if (data) {
          // Load staff schedule
          const schedule: Record<DayOfWeek, string[]> = {
            monday: [],
            tuesday: [],
            wednesday: [],
            thursday: [],
            friday: []
          }
          data.staffSchedules?.forEach((s: any) => {
            const day = s.dayOfWeek as DayOfWeek
            schedule[day] = JSON.parse(s.staffNames)
          })
          setStaffSchedule(schedule)
          
          // Load treatments
          setTreatments(data.treatments?.map((t: any) => ({
            medicationId: t.medicationId,
            treatmentNumber: t.treatmentNumber,
            quantity: t.quantity
          })) || [])
          
          // Load generated patients
          if (data.generatedPatients) {
            setGeneratedPatients(JSON.parse(data.generatedPatients))
          }
        }
      }
    } catch (error) {
      console.error('Failed to load week plan:', error)
    }
  }

  const saveWeekPlan = async () => {
    try {
      const weekEnd = getWeekEndDate(selectedWeekStart)
      const response = await fetch('/api/weekplan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekStartDate: selectedWeekStart,
          weekEndDate: weekEnd,
          staffSchedules: Object.entries(staffSchedule).map(([day, names]) => ({
            dayOfWeek: day,
            staffNames: JSON.stringify(names)
          })),
          treatments
        })
      })
      
      if (response.ok) {
        alert('Weekplanning opgeslagen!')
        loadWeekPlan()
      }
    } catch (error) {
      console.error('Failed to save week plan:', error)
      alert('Fout bij opslaan weekplanning')
    }
  }

  const handleGeneratePlan = async () => {
    if (!confirm('Dit zal automatisch alle behandelingen over de week verdelen. Doorgaan?')) {
      return
    }

    setIsGenerating(true)
    try {
      const result = await generateWeekPlan(selectedWeekStart, staffSchedule, treatments, staffMembers)
      setGeneratedPatients(result.patientIds)
      
      // Save generated patients to week plan
      await fetch('/api/weekplan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekStartDate: selectedWeekStart,
          generatedPatients: JSON.stringify(result.patientIds)
        })
      })
      
      alert(`Planning gegenereerd! ${result.patientIds.length} patiënten ingepland over de week.`)
      setActiveTab('overzicht')
    } catch (error) {
      console.error('Failed to generate plan:', error)
      alert('Fout bij genereren planning')
    } finally {
      setIsGenerating(false)
    }
  }

  const getWeekEndDate = (weekStart: string): string => {
    const start = new Date(weekStart + 'T00:00:00')
    const friday = new Date(start)
    friday.setDate(start.getDate() + 4) // Friday is 4 days after Monday
    return formatDateToISO(friday)
  }

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

  const weekDates = getWeekDates()

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-700 to-indigo-600 text-white py-6 px-6 shadow-lg">
        <div className="max-w-[1800px] mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold">Plan per Week</h1>
              <p className="text-sm opacity-90 mt-1">
                Configureer verpleegkundigen rooster en behandelingen voor automatische weekplanning
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div>
                <label className="text-xs font-semibold opacity-80 block mb-1">Week:</label>
                <input
                  type="date"
                  value={selectedWeekStart}
                  onChange={(e) => setSelectedWeekStart(e.target.value)}
                  className="bg-white text-slate-900 px-3 py-2 rounded-md font-semibold text-sm border-0 focus:ring-2 focus:ring-white/50 outline-none"
                />
              </div>
              <button
                onClick={saveWeekPlan}
                className="px-6 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-semibold transition-colors"
              >
                Opslaan
              </button>
            </div>
          </div>

          {/* Tabs */}
          <nav className="flex gap-2">
            <button
              onClick={() => setActiveTab('rooster')}
              className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                activeTab === 'rooster'
                  ? 'text-white border-white'
                  : 'text-white/70 border-transparent hover:text-white hover:border-white/50'
              }`}
            >
              Verpleegkundigen Rooster
            </button>
            <button
              onClick={() => setActiveTab('behandelingen')}
              className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                activeTab === 'behandelingen'
                  ? 'text-white border-white'
                  : 'text-white/70 border-transparent hover:text-white hover:border-white/50'
              }`}
            >
              Behandelingen
            </button>
            <button
              onClick={() => setActiveTab('overzicht')}
              className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                activeTab === 'overzicht'
                  ? 'text-white border-white'
                  : 'text-white/70 border-transparent hover:text-white hover:border-white/50'
              }`}
            >
              Week Overzicht
            </button>
          </nav>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-[1800px] mx-auto p-6">
        {activeTab === 'rooster' && (
          <WeekStaffSchedule
            weekDates={weekDates}
            staffSchedule={staffSchedule}
            setStaffSchedule={setStaffSchedule}
            staffMembers={staffMembers}
          />
        )}

        {activeTab === 'behandelingen' && (
          <WeekTreatments
            treatments={treatments}
            setTreatments={setTreatments}
          />
        )}

        {activeTab === 'overzicht' && (
          <WeekOverview
            weekDates={weekDates}
            staffSchedule={staffSchedule}
            treatments={treatments}
            staffMembers={staffMembers}
            generatedPatients={generatedPatients}
            onGenerate={handleGeneratePlan}
            isGenerating={isGenerating}
          />
        )}
      </div>

      {/* Navigation back */}
      <div className="fixed bottom-6 right-6">
        <a
          href="/"
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-lg transition-colors"
        >
          ← Terug naar Dagplanning
        </a>
      </div>
    </main>
  )
}

