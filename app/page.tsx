'use client'

import { useState, useEffect } from 'react'
import { OptimizationSuggestion, DEPARTMENT_CONFIG, DAY_LABELS, getDailyPatientCapacity, getTodayISO, getDayOfWeekFromDate, DayOfWeek, formatDateToISO, getMondayOfWeek, formatDateToDutch } from '@/types'
import { generateOptimizationSuggestions, calculateWorkloadByTimeSlot } from '@/utils/planning/workload'
import { usePatients } from '@/hooks/usePatients'
import { useStaff } from '@/hooks/useStaff'
import { useWorkload } from '@/hooks/useWorkload'
import { useNotifications } from '@/hooks/useNotifications'
import { Patient } from '@/types'
import { validateNurseWorkDay } from '@/features/patients/patientValidation'
import { addPatientWithActions } from '@/features/patients/patientAssignment'
import { reassignAllStaffAssignments } from '@/features/staff/staffReassignment'
import { deletePatient as deletePatientService, updatePatient } from '@/features/patients/patientService'
import { deleteAction, createAction } from '@/features/patients/actionService'
import { optimizeDayPlanning } from '@/utils/planning/planningOptimizer'
import { generateSimulationData } from '@/utils/patients/simulation'
import { generateActionsForMedication, calculateTotalTreatmentTime } from '@/utils/patients/actionGenerator'
import { StaffScheduler } from '@/utils/staff/staffAssignment'
import { ChairOccupancyTracker } from '@/utils/capacity/chairOccupancy'
import { generateWeekPlan } from '@/utils/planning/weekPlanGenerator'
import PatientModal from '@/components/patients/PatientModal'
import Navbar from '@/components/common/Navbar'
import Statistics from '@/components/analysis/Statistics'
import ScheduleBoard from '@/components/patients/ScheduleBoard'
import DatePicker from '@/components/planning/DatePicker'
import WeekPicker from '@/components/planning/WeekPicker'
import TreatmentBoxes from '@/components/patients/TreatmentBoxes'
import WorkloadAnalysis from '@/components/analysis/WorkloadAnalysis'
import OptimizationSuggestions from '@/components/analysis/OptimizationSuggestions'
import StaffTimeline from '@/components/staff/StaffTimeline'
import StaffManagement from '@/components/staff/StaffManagement'
import WeekStaffSchedule from '@/components/planning/WeekStaffSchedule'
import WeekTreatments from '@/components/planning/WeekTreatments'
import WeekOverview from '@/components/planning/WeekOverview'
import Notification from '@/components/common/Notification'
import ConfirmModal from '@/components/common/ConfirmModal'

type TabType = 'planning' | 'behandelingen' | 'analyse' | 'medewerkers' | 'beheer'
type WeekPlanTab = 'rooster' | 'behandelingen' | 'overzicht'

export default function Home() {
  const [activeView, setActiveView] = useState<'dagplanning' | 'weekplanning'>('dagplanning')
  const [selectedDate, setSelectedDate] = useState<string>(getTodayISO())
  const [activeTab, setActiveTab] = useState<TabType>('planning')
  const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([])
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false)
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null)
  
  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
    variant?: 'danger' | 'warning' | 'info'
    confirmText?: string
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'info'
  })
  
  // Week planning state
  const [weekPlanTab, setWeekPlanTab] = useState<WeekPlanTab>('rooster')
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
  const [treatments, setTreatments] = useState<Array<{
    medicationId: string
    treatmentNumber: number
    quantity: number
  }>>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedPatients, setGeneratedPatients] = useState<string[]>([])

  // Custom hooks
  const { patients, setPatients, fetchPatients } = usePatients(selectedDate)
  const { staffMembers, setStaffMembers, loadStaffMembers } = useStaff()
  const { workload, setWorkload } = useWorkload(patients)
  const { notification, showNotification, closeNotification } = useNotifications()

  // Week planning functions
  useEffect(() => {
    if (activeView === 'weekplanning') {
      loadWeekPlan()
    }
  }, [selectedWeekStart, activeView])

  const loadWeekPlan = async () => {
    try {
      const response = await fetch(`/api/weekplan?weekStart=${selectedWeekStart}`)
      if (response.ok) {
        const data = await response.json()
        if (data && data.id) {
          // Load data for this week
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
          setTreatments(data.treatments?.map((t: any) => ({
            medicationId: t.medicationId,
            treatmentNumber: t.treatmentNumber,
            quantity: t.quantity
          })) || [])
          if (data.generatedPatients) {
            setGeneratedPatients(JSON.parse(data.generatedPatients))
          } else {
            setGeneratedPatients([])
          }
        } else {
          // No data for this week - reset to empty state
          setStaffSchedule({
            monday: [],
            tuesday: [],
            wednesday: [],
            thursday: [],
            friday: []
          })
          setTreatments([])
          setGeneratedPatients([])
        }
      } else {
        // Response not ok - reset to empty state
        setStaffSchedule({
          monday: [],
          tuesday: [],
          wednesday: [],
          thursday: [],
          friday: []
        })
        setTreatments([])
        setGeneratedPatients([])
      }
    } catch (error) {
      console.error('Failed to load week plan:', error)
      // On error, reset to empty state
      setStaffSchedule({
        monday: [],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: []
      })
      setTreatments([])
      setGeneratedPatients([])
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
        showNotification('Weekplanning opgeslagen!', 'success')
        loadWeekPlan()
      }
    } catch (error) {
      console.error('Failed to save week plan:', error)
      showNotification('Fout bij opslaan weekplanning', 'warning')
    }
  }

  const handleGeneratePlan = async () => {
    setConfirmModal({
      isOpen: true,
      title: 'Planning Genereren',
      message: 'Dit zal automatisch alle behandelingen over de week verdelen. Doorgaan?',
      onConfirm: async () => {
        setIsGenerating(true)
        try {
          const result = await generateWeekPlan(selectedWeekStart, staffSchedule, treatments, staffMembers)
          setGeneratedPatients(result.patientIds)
          
          await fetch('/api/weekplan', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              weekStartDate: selectedWeekStart,
              generatedPatients: JSON.stringify(result.patientIds)
            })
          })
          
          showNotification(`Planning gegenereerd! ${result.patientIds.length} patiënten ingepland over de week.`, 'success')
          setWeekPlanTab('overzicht')
        } catch (error) {
          console.error('Failed to generate plan:', error)
          showNotification('Fout bij genereren planning', 'warning')
        } finally {
          setIsGenerating(false)
        }
      },
      variant: 'info'
    })
  }

  const handleDeletePlan = async () => {
    setConfirmModal({
      isOpen: true,
      title: 'Planning Verwijderen',
      message: `Weet je zeker dat je de gegenereerde planning wilt verwijderen? Dit verwijdert ${generatedPatients.length} patiënten.`,
      onConfirm: async () => {
        try {
          // Delete all generated patients
          let deletedCount = 0
          for (const patientId of generatedPatients) {
            const success = await deletePatientService(patientId)
            if (success) {
              deletedCount++
            }
          }

          // Clear generated patients from state and database
          setGeneratedPatients([])
          
          await fetch('/api/weekplan', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              weekStartDate: selectedWeekStart,
              generatedPatients: JSON.stringify([])
            })
          })
          
          showNotification(`Planning verwijderd! ${deletedCount} patiënten verwijderd.`, 'success')
        } catch (error) {
          console.error('Failed to delete plan:', error)
          showNotification('Fout bij verwijderen planning', 'warning')
        }
      },
      variant: 'danger',
      confirmText: 'Verwijderen'
    })
  }

  const getWeekEndDate = (weekStart: string): string => {
    const start = new Date(weekStart + 'T00:00:00')
    const friday = new Date(start)
    friday.setDate(start.getDate() + 4)
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

  const handleAddPatient = async (name: string, startTime: string, medicationId: string, treatmentNumber: number, preferredNurse?: string) => {
    try {
      // Only validate that nurse works on selected day (basic requirement)
      if (preferredNurse) {
        const workDayValidation = validateNurseWorkDay(preferredNurse, staffMembers, selectedDate)
        if (!workDayValidation.valid) {
          showNotification(workDayValidation.message!, 'warning')
          return
        }
      }

      const patientsAtTime = patients.filter(p => p.startTime === startTime).length
      
      // Add patient with actions (allow overlaps for manual entry)
      const result = await addPatientWithActions(
        name,
        startTime,
        selectedDate,
        medicationId,
        treatmentNumber,
        staffMembers,
        patients,
        preferredNurse,
        showNotification,
        true // allowOverlaps = true for manual entry
      )

      if (!result.success) {
        return
      }

      await fetchPatients()
      
      // Don't reassign staff assignments during manual entry - only when optimizing
      // await reassignAllStaffAssignments(selectedDate, staffMembers)
      
      // Check if we're approaching capacity
      const newPatientsAtTime = patientsAtTime + 1
      if (newPatientsAtTime === DEPARTMENT_CONFIG.MAX_CONCURRENT_INFUSIONS) {
        showNotification(
          `${name} toegevoegd!  Tijdslot ${startTime} is nu vol (${newPatientsAtTime}/${DEPARTMENT_CONFIG.MAX_CONCURRENT_INFUSIONS})`,
          'info'
        )
      } else {
        showNotification(`${name} toegevoegd! (${newPatientsAtTime}/${DEPARTMENT_CONFIG.MAX_CONCURRENT_INFUSIONS} om ${startTime})`, 'success')
      }
      setIsPatientModalOpen(false)
    } catch (error) {
      console.error('Failed to add patient:', error)
      showNotification('Fout bij toevoegen patiënt', 'warning')
    }
  }

  const handleAddAction = async (patientId: string, name: string, duration: number, staff: string) => {
    try {
      const response = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, name, duration, staff }),
      })

      if (response.ok) {
        await fetchPatients()
        showNotification(`Handeling "${name}" toegevoegd!`, 'success')
      }
    } catch (error) {
      console.error('Failed to add action:', error)
      showNotification('Fout bij toevoegen handeling', 'warning')
    }
  }

  const handleEditPatient = (patient: Patient) => {
    setEditingPatient(patient)
    setIsPatientModalOpen(true)
  }

  const handleUpdatePatient = async (
    patientId: string,
    startTime: string,
    medicationId: string,
    treatmentNumber: number,
    preferredNurse?: string
  ) => {
    try {
      // Only validate that nurse works on selected day (basic requirement)
      if (preferredNurse) {
        const workDayValidation = validateNurseWorkDay(preferredNurse, staffMembers, selectedDate)
        if (!workDayValidation.valid) {
          showNotification(workDayValidation.message!, 'warning')
          return
        }
      }

      // Update patient
      const updatedPatient = await updatePatient(patientId, {
        startTime,
        medicationType: medicationId,
        treatmentNumber
      })

      if (!updatedPatient) {
        showNotification('Fout bij bijwerken behandeling', 'warning')
        return
      }

      // Delete all existing actions
      const patient = patients.find(p => p.id === patientId)
      if (patient) {
        for (const action of patient.actions) {
          await deleteAction(action.id)
        }
      }

      // Regenerate actions with new medication/treatment/start time
      const dayOfWeek = getDayOfWeekFromDate(selectedDate)
      const availableStaff = staffMembers.filter(s => s.workDays.length === 0 || s.workDays.includes(dayOfWeek))
      const scheduler = new StaffScheduler(availableStaff, dayOfWeek)
      
      const actions = generateActionsForMedication(medicationId, treatmentNumber)
      const [hours, minutes] = startTime.split(':').map(Number)
      let patientStartMinutes = hours * 60 + minutes
      let cumulativeMinutes = 0
      let setupStaff: string | null = null
      let infusionStartMinutes = 0

      for (const action of actions) {
        if (action.type === 'infusion') {
          infusionStartMinutes = patientStartMinutes + cumulativeMinutes
        }
        
        let actionStartMinutes: number
        if ((action.type === 'check' || action.type === 'pc_switch') && (action as any).checkOffset !== undefined) {
          actionStartMinutes = infusionStartMinutes + (action as any).checkOffset
        } else {
          actionStartMinutes = patientStartMinutes + cumulativeMinutes
        }
        
        const actionStartHours = Math.floor(actionStartMinutes / 60)
        const actionStartMins = actionStartMinutes % 60
        const actionStartTime = `${actionStartHours.toString().padStart(2, '0')}:${actionStartMins.toString().padStart(2, '0')}`
        
        let staff: string
        
        if (action.type === 'infusion') {
          staff = 'Systeem'
        } else if (action.type === 'setup') {
          if (preferredNurse) {
            staff = preferredNurse
            setupStaff = staff
          } else {
            // For manual entry, allow overlaps - just pick first available staff member
            const availableStaff = scheduler.getAvailableStaffForDay()
            if (availableStaff.length > 0) {
              staff = availableStaff[0]
            } else {
              staff = 'GEEN'
            }
            setupStaff = staff
          }
        } else if (action.type === 'protocol_check') {
          // For manual entry, allow overlaps - pick a different staff member than setup
          const availableStaff = scheduler.getAvailableStaffForDay()
          const staffList = availableStaff.filter(s => s !== setupStaff)
          staff = staffList.length > 0 ? staffList[0] : (availableStaff.length > 0 ? availableStaff[0] : 'GEEN')
        } else {
          // For manual entry, allow overlaps - just pick first available staff member
          const availableStaff = scheduler.getAvailableStaffForDay()
          staff = availableStaff.length > 0 ? availableStaff[0] : 'GEEN'
        }
        
        await createAction(
          patientId,
          action.name,
          action.duration,
          action.type || 'other',
          action.actualDuration,
          staff
        )
        
        cumulativeMinutes += action.duration
      }

      // Don't reassign staff assignments during manual entry - only when optimizing
      // await reassignAllStaffAssignments(selectedDate, staffMembers)
      
      // Refresh patients after update
      await fetchPatients()
      
      showNotification('Behandeling bijgewerkt!', 'success')
      setEditingPatient(null)
      setIsPatientModalOpen(false)
    } catch (error) {
      console.error('Failed to update patient:', error)
      showNotification('Fout bij bijwerken behandeling', 'warning')
    }
  }

  const handleDeletePatient = async (patientId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Behandeling Verwijderen',
      message: 'Weet je zeker dat je deze behandeling volledig wilt verwijderen? Alle handelingen worden ook verwijderd.',
      onConfirm: async () => {
        try {
          const success = await deletePatientService(patientId)
          if (success) {
            await fetchPatients()
            showNotification('Behandeling verwijderd', 'success')
          } else {
            showNotification('Fout bij verwijderen behandeling', 'warning')
          }
        } catch (error) {
          console.error('Failed to delete patient:', error)
          showNotification('Fout bij verwijderen behandeling', 'warning')
        }
      },
      variant: 'danger',
      confirmText: 'Verwijderen'
    })
  }

  const handleDeleteAction = async (actionId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Handeling Verwijderen',
      message: 'Weet je zeker dat je deze handeling wilt verwijderen?',
      onConfirm: async () => {
        try {
          const success = await deleteAction(actionId)
          if (success) {
            await fetchPatients()
            showNotification('Handeling verwijderd', 'success')
          } else {
            showNotification('Fout bij verwijderen handeling', 'warning')
          }
        } catch (error) {
          console.error('Failed to delete action:', error)
          showNotification('Fout bij verwijderen handeling', 'warning')
        }
      },
      variant: 'danger',
      confirmText: 'Verwijderen'
    })
  }

  const handleAnalyzeWorkload = () => {
    if (patients.length === 0) {
      showNotification('Geen gegevens om te analyseren', 'warning')
      return
    }

    // Workload is already calculated by useWorkload hook
    setActiveTab('analyse')
    showNotification('Werkdruk analyse voltooid!', 'success')
  }

  const handleOptimizePlanning = async () => {
    if (patients.length === 0) {
      showNotification('Geen patiënten om te optimaliseren', 'warning')
      return
    }

    setConfirmModal({
      isOpen: true,
      title: 'Planning Optimaliseren',
      message: 'Wil je de planning automatisch optimaliseren? Dit verplaatst patiënten naar betere tijden en herverdeelt de werkdruk over verpleegkundigen.',
      onConfirm: async () => {
        try {
          showNotification('Planning optimaliseren... Dit kan even duren.', 'info')
          
          // Use advanced optimizer
          const result = await optimizeDayPlanning(patients, staffMembers, selectedDate)
          
          if (result.movedCount === 0 && result.success) {
            showNotification('Planning is al optimaal!', 'success')
            return
          }

          // Update all patients with new start times
          let updatedCount = 0
          for (const patientId of Array.from(result.newStartTimes.keys())) {
            const newStartTime = result.newStartTimes.get(patientId)
            if (!newStartTime) continue
            const patient = patients.find(p => p.id === patientId)
            if (!patient || patient.startTime === newStartTime) continue

            // Update patient start time
            const response = await fetch(`/api/patients/${patientId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ startTime: newStartTime }),
            })

            if (response.ok) {
              // Delete all existing actions for this patient
              for (const action of patient.actions) {
                await fetch(`/api/actions/${action.id}`, {
                  method: 'DELETE',
            })
          }

          // Regenerate actions with new start time
          const dayOfWeek = getDayOfWeekFromDate(selectedDate)
          const availableStaff = staffMembers.filter(s => s.workDays.length === 0 || s.workDays.includes(dayOfWeek))
          const scheduler = new StaffScheduler(availableStaff, dayOfWeek)
          
          const actions = generateActionsForMedication(patient.medicationType, patient.treatmentNumber)
          const [hours, minutes] = newStartTime.split(':').map(Number)
          let patientStartMinutes = hours * 60 + minutes
          let cumulativeMinutes = 0
          let setupStaff: string | null = null
          let infusionStartMinutes = 0

          for (const action of actions) {
            if (action.type === 'infusion') {
              infusionStartMinutes = patientStartMinutes + cumulativeMinutes
            }

            let actionStartMinutes: number
            if ((action.type === 'check' || action.type === 'pc_switch') && (action as any).checkOffset) {
              actionStartMinutes = infusionStartMinutes + (action as any).checkOffset
            } else {
              actionStartMinutes = patientStartMinutes + cumulativeMinutes
            }

            const actionStartHours = Math.floor(actionStartMinutes / 60)
            const actionStartMins = actionStartMinutes % 60
            const actionStartTime = `${actionStartHours.toString().padStart(2, '0')}:${actionStartMins.toString().padStart(2, '0')}`

            let staff: string

            if (action.type === 'infusion') {
              staff = 'Systeem'
            } else if (action.type === 'observation') {
              staff = 'Geen'
            } else if (action.type === 'setup') {
              const setupAssignment = scheduler.assignStaffForSetup(actionStartTime, action.duration)
              staff = setupAssignment.staff
              setupStaff = staff
            } else if (action.type === 'protocol_check') {
              const duration = action.actualDuration || action.duration
              const assignment = scheduler.assignStaffForAction(action.type, duration, actionStartTime, setupStaff || undefined)
              staff = assignment.staff
            } else {
              const duration = action.actualDuration || action.duration
              const assignment = scheduler.assignStaffForAction(action.type, duration, actionStartTime)
              staff = assignment.staff
            }

            if (staff === 'GEEN') {
              console.warn(`⚠️ Could not assign staff for ${action.name} at ${actionStartTime}`)
              continue
            }

            // Create action
            await fetch('/api/actions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                patientId: patient.id,
                name: action.name,
                duration: action.duration,
                type: action.type,
                actualDuration: action.actualDuration,
                staff: staff
              }),
            })

            cumulativeMinutes += action.duration
          }

          updatedCount++
        }
      }

          // Refresh patients
          await fetchPatients()
          
          // Show results
          const calculatedWorkloadAfter = calculateWorkloadByTimeSlot(patients)
          const generatedSuggestions = generateOptimizationSuggestions(calculatedWorkloadAfter, patients)
          
          setWorkload(calculatedWorkloadAfter)
          setSuggestions(generatedSuggestions)
          setActiveTab('analyse')
          
          if (updatedCount > 0) {
            showNotification(`Planning geoptimaliseerd! ${updatedCount} patiënt(en) verplaatst. Score: ${result.score.toFixed(1)}/100`, 'success')
          } else {
            showNotification(result.message || 'Geen verbeteringen mogelijk met huidige constraints.', 'info')
          }
        } catch (error) {
          console.error('Failed to optimize planning:', error)
          showNotification('Fout bij optimaliseren planning', 'warning')
        }
      },
      variant: 'info'
    })
  }

  const handleClearAll = async () => {
    const d = new Date(selectedDate + 'T00:00:00')
    const dayNames = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag']
    const dayName = dayNames[d.getDay()]
    const day = d.getDate()
    const month = d.getMonth() + 1
    const year = d.getFullYear()
    const formattedDate = `${dayName} ${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`
    
    setConfirmModal({
      isOpen: true,
      title: 'Planning Wissen',
      message: `Weet u zeker dat u de planning voor ${formattedDate} wilt wissen?\n\nDit wist alleen de planning voor deze dag.`,
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/patients?date=${selectedDate}`, {
            method: 'DELETE',
          })

          if (response.ok) {
            setPatients([])
            setWorkload([])
            setSuggestions([])
            showNotification(`Planning voor ${formattedDate} gewist`, 'success')
          }
        } catch (error) {
          console.error('Failed to clear data:', error)
          showNotification('Fout bij wissen gegevens', 'warning')
        }
      },
      variant: 'danger',
      confirmText: 'Wissen'
    })
  }

  return (
    <main className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* Compact Header */}
      <header className="bg-gradient-to-r from-blue-700 to-blue-600 text-white py-4 px-6 shadow-lg flex-shrink-0">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dagbehandeling 4B</h1>
          </div>
          
          {/* Statistics */}
          <Statistics 
            patients={patients} 
            workload={workload} 
            selectedDay={getDayOfWeekFromDate(selectedDate)} 
            staffMembers={staffMembers} 
          />
        </div>
      </header>

      {/* Navbar */}
      <Navbar activeView={activeView} onViewChange={setActiveView} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {activeView === 'dagplanning' && (
          <>
            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">
              {/* Sidebar */}
              <aside className="w-64 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col">
            <nav className="flex flex-col p-4 space-y-1 flex-1" aria-label="Hoofdnavigatie">
              <button
                onClick={() => setActiveTab('planning')}
                className={`px-4 py-3 font-semibold transition-colors rounded-lg text-left flex items-center gap-3 ${
                  activeTab === 'planning'
                    ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Dagplanning</span>
              </button>
              <button
                onClick={() => setActiveTab('behandelingen')}
                className={`px-4 py-3 font-semibold transition-colors rounded-lg text-left flex items-center gap-3 ${
                  activeTab === 'behandelingen'
                    ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
                <span>Behandelingen</span>
              </button>
              <button
                onClick={() => setActiveTab('analyse')}
                className={`px-4 py-3 font-semibold transition-colors rounded-lg text-left flex items-center gap-3 ${
                  activeTab === 'analyse'
                    ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>Werkdruk Analyse</span>
              </button>
              <button
                onClick={() => setActiveTab('medewerkers')}
                className={`px-4 py-3 font-semibold transition-colors rounded-lg text-left flex items-center gap-3 ${
                  activeTab === 'medewerkers'
                    ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span>Medewerker Planning</span>
              </button>
              <button
                onClick={() => setActiveTab('beheer')}
                className={`px-4 py-3 font-semibold transition-colors rounded-lg text-left flex items-center gap-3 ${
                  activeTab === 'beheer'
                    ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span>VPK Beheer</span>
              </button>
              
              {/* Action Buttons Section */}
              {activeTab === 'planning' && (
                <>
                  <div className="my-4 border-t border-slate-200" />
                  <div className="space-y-2">
                    <button
                      onClick={handleOptimizePlanning}
                      className="w-full px-4 py-2.5 bg-green-700 hover:bg-green-800 text-white rounded-lg transition-colors font-semibold text-sm flex items-center gap-2 justify-center"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>Optimaliseer</span>
                    </button>
                  </div>
                </>
              )}
            </nav>
            
            {/* Clear Button at Bottom */}
            {activeTab === 'planning' && (
              <div className="p-4 border-t border-slate-200">
                <button
                  onClick={handleClearAll}
                  className="w-full px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors font-semibold text-sm flex flex-col items-center gap-1"
                  title={`Wis alle planning voor ${selectedDate}`}
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

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-6" tabIndex={0} role="region" aria-label="Hoofdinhoud">
            <div className={activeTab === 'planning' ? 'max-w-[1800px] mx-auto' : 'max-w-[1400px] mx-auto'}>
              {activeTab === 'planning' && (
                <div className="h-full">
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
                    {/* Integrated Header with Date Picker */}
                    <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                      <div className="flex items-center gap-6">
                        <h2 className="text-xl font-bold text-slate-900">Dagplanning</h2>
                        <div className="h-8 w-px bg-slate-300" />
                        <DatePicker
                          value={selectedDate}
                          onChange={setSelectedDate}
                          staffMembers={staffMembers}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        {patients.length > 0 && (
                          <div className="flex items-center gap-1 text-xs text-slate-600 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <span className="font-medium">{patients.length} patiënt{patients.length !== 1 ? 'en' : ''}</span>
                          </div>
                        )}
                        <button
                          onClick={() => setIsPatientModalOpen(true)}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-semibold transition-colors shadow-sm text-sm"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          <span>Nieuwe Behandeling</span>
                        </button>
                      </div>
                    </div>
                    
                    {/* Schedule Board Content */}
                    <div className="flex-1 overflow-hidden">
                      <ScheduleBoard 
                        patients={patients} 
                        onAddPatient={undefined}
                        onDeletePatient={handleDeletePatient}
                        showHeader={false}
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'behandelingen' && (
                <div className="h-full">
                  <TreatmentBoxes 
                    patients={patients} 
                    onEditPatient={handleEditPatient}
                  />
                </div>
              )}

              {activeTab === 'analyse' && (
                <div className="space-y-6">
                  {workload.length > 0 && workload.some(w => w.count > 0) ? (
                    <>
                      <WorkloadAnalysis workload={workload} />
                      {suggestions.length > 0 && (
                        <OptimizationSuggestions suggestions={suggestions} show={true} />
                      )}
                    </>
                  ) : (
                    <div className="bg-white rounded-xl p-12 shadow-sm border border-slate-200 text-center">
                      <svg className="w-20 h-20 mx-auto mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">Geen analyse beschikbaar</h3>
                      <p className="text-slate-600 mb-6">Klik op "Analyseer" of "Optimaliseer" om werkdruk te analyseren</p>
                      <div className="flex gap-3 justify-center">
                        <button
                          onClick={handleAnalyzeWorkload}
                          className="px-6 py-3 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-semibold transition-colors"
                        >
                          Analyseer Werkdruk
                        </button>
                        <button
                          onClick={handleOptimizePlanning}
                          className="px-6 py-3 bg-green-700 hover:bg-green-800 text-white rounded-lg font-semibold transition-colors"
                        >
                          Optimaliseer Planning
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'medewerkers' && (
                <div className="h-full">
                  <StaffTimeline patients={patients} selectedDate={selectedDate} staffMembers={staffMembers} />
                </div>
              )}

              {activeTab === 'beheer' && (
                <div className="h-full">
                  <StaffManagement onUpdate={loadStaffMembers} />
                </div>
              )}
            </div>
          </div>
        </div>
          </>
        )}

        {activeView === 'weekplanning' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Week Planning Header */}
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
              <button
                onClick={saveWeekPlan}
                className="px-6 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-semibold transition-colors"
              >
                Opslaan
              </button>
            </div>

            {/* Main Content Area with Sidebar */}
            <div className="flex-1 flex overflow-hidden">
              {/* Sidebar */}
              <aside className="w-64 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col">
                <nav className="flex flex-col p-4 space-y-1" aria-label="Weekplanning navigatie">
                  <button
                    onClick={() => setWeekPlanTab('rooster')}
                    className={`px-4 py-3 font-semibold transition-colors rounded-lg text-left flex items-center gap-3 ${
                      weekPlanTab === 'rooster'
                        ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span>Verpleegkundigen Rooster</span>
                  </button>
                  <button
                    onClick={() => setWeekPlanTab('behandelingen')}
                    className={`px-4 py-3 font-semibold transition-colors rounded-lg text-left flex items-center gap-3 ${
                      weekPlanTab === 'behandelingen'
                        ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                    <span>Behandelingen</span>
                  </button>
                  <button
                    onClick={() => setWeekPlanTab('overzicht')}
                    className={`px-4 py-3 font-semibold transition-colors rounded-lg text-left flex items-center gap-3 ${
                      weekPlanTab === 'overzicht'
                        ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span>Week Overzicht</span>
                  </button>
                </nav>
              </aside>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-6" tabIndex={0} role="region" aria-label="Hoofdinhoud">
                <div className="max-w-[1800px] mx-auto">
                  {weekPlanTab === 'rooster' && (
                    <WeekStaffSchedule
                      weekDates={weekDates}
                      staffSchedule={staffSchedule}
                      setStaffSchedule={setStaffSchedule}
                      staffMembers={staffMembers}
                    />
                  )}

                  {weekPlanTab === 'behandelingen' && (
                    <WeekTreatments
                      treatments={treatments}
                      setTreatments={setTreatments}
                    />
                  )}

                  {weekPlanTab === 'overzicht' && (
                    <WeekOverview
                      weekDates={weekDates}
                      staffSchedule={staffSchedule}
                      treatments={treatments}
                      staffMembers={staffMembers}
                      generatedPatients={generatedPatients}
                      onGenerate={handleGeneratePlan}
                      onDelete={handleDeletePlan}
                      isGenerating={isGenerating}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Patient Modal */}
      <PatientModal
        isOpen={isPatientModalOpen}
        onClose={() => {
          setIsPatientModalOpen(false)
          setEditingPatient(null)
        }}
        onSubmit={handleAddPatient}
        selectedDate={selectedDate}
        staffMembers={staffMembers}
        editingPatient={editingPatient}
        onUpdate={handleUpdatePatient}
      />

      {/* Notifications */}
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={closeNotification}
        />
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant || 'info'}
        confirmText={confirmModal.confirmText}
      />
    </main>
  )
}
