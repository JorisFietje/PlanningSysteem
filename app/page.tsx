'use client'

import { useState, useEffect } from 'react'
import { OptimizationSuggestion, DEPARTMENT_CONFIG, DAY_LABELS, getDailyPatientCapacity, getTodayISO, getDayOfWeekFromDate, DayOfWeek, formatDateToISO } from '@/types'
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
import TreatmentBoxes from '@/components/patients/TreatmentBoxes'
import WorkloadAnalysis from '@/components/analysis/WorkloadAnalysis'
import OptimizationSuggestions from '@/components/analysis/OptimizationSuggestions'
import StaffTimeline from '@/components/staff/StaffTimeline'
import StaffManagement from '@/components/staff/StaffManagement'
import WeekStaffSchedule from '@/components/planning/WeekStaffSchedule'
import WeekTreatments from '@/components/planning/WeekTreatments'
import WeekOverview from '@/components/planning/WeekOverview'
import Notification from '@/components/common/Notification'

type TabType = 'planning' | 'behandelingen' | 'analyse' | 'medewerkers' | 'beheer'
type WeekPlanTab = 'rooster' | 'behandelingen' | 'overzicht'

export default function Home() {
  const [activeView, setActiveView] = useState<'dagplanning' | 'weekplanning'>('dagplanning')
  const [selectedDate, setSelectedDate] = useState<string>(getTodayISO())
  const [activeTab, setActiveTab] = useState<TabType>('planning')
  const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([])
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false)
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null)
  
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
        if (data) {
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
        showNotification('Weekplanning opgeslagen!', 'success')
        loadWeekPlan()
      }
    } catch (error) {
      console.error('Failed to save week plan:', error)
      showNotification('Fout bij opslaan weekplanning', 'warning')
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
    if (!confirm('Weet je zeker dat je deze behandeling volledig wilt verwijderen? Alle handelingen worden ook verwijderd.')) {
      return
    }

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
  }

  const handleDeleteAction = async (actionId: string) => {
    if (!confirm('Weet je zeker dat je deze handeling wilt verwijderen?')) {
      return
    }

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

    if (!confirm('Wil je de planning automatisch optimaliseren? Dit verplaatst patiënten naar betere tijden en herverdeelt de werkdruk over verpleegkundigen.')) {
      return
    }

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
  }

  const handleClearAll = async () => {
    if (!confirm(`Weet je zeker dat je alle planning voor ${selectedDate} wilt wissen?`)) {
      return
    }

    try {
      const response = await fetch(`/api/patients?date=${selectedDate}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setPatients([])
        setWorkload([])
        setSuggestions([])
        showNotification(`Planning voor ${selectedDate} gewist`, 'success')
      }
    } catch (error) {
      console.error('Failed to clear data:', error)
      showNotification('Fout bij wissen gegevens', 'warning')
    }
  }


  const handleRunSimulation = async () => {
    if (!confirm('Dit zal alle huidige data wissen en een nieuwe simulatie starten. Doorgaan?')) {
      return
    }

    try {
      // Get day of week from selected date
      const dayOfWeek = getDayOfWeekFromDate(selectedDate)
      
      // Clear existing data for this date only
      await fetch(`/api/patients?date=${selectedDate}`, { method: 'DELETE' })
      
      // TARGET: Calculate dynamic capacity based on staff working today
      const capacity = getDailyPatientCapacity(dayOfWeek, staffMembers)
      const targetPatientsToAdd = Math.floor(Math.random() * (capacity.max - capacity.min + 1)) + capacity.min
      console.log(`🎯 Capacity for ${selectedDate} (${DAY_LABELS[dayOfWeek]}): ${capacity.min}-${capacity.max} patients (total capacity: ${capacity.total})`)
      showNotification(`Simulatie gestart... Doel: ${targetPatientsToAdd} patiënten toevoegen (capaciteit: ${capacity.min}-${capacity.max})`, 'info')
      
      // Create trackers
      const scheduler = new StaffScheduler(staffMembers, dayOfWeek)
      const chairTracker = new ChairOccupancyTracker()
      
      let addedPatients = 0
      let skippedPatients = 0
      let rescheduledPatients = 0
      let generationRound = 0
      const MAX_ROUNDS = 10 // Safety limit
      
      // Keep generating batches until we have enough ADDED patients
      while (addedPatients < targetPatientsToAdd && generationRound < MAX_ROUNDS) {
        generationRound++
        console.log(`📦 Generation round ${generationRound}: ${addedPatients}/${targetPatientsToAdd} added so far`)
        
        // Generate a new batch of patients
        const simulatedPatients = generateSimulationData()
        
        // Sort patients by start time to ensure proper scheduling
        const sortedPatients = [...simulatedPatients].sort((a, b) => 
          a.startTime.localeCompare(b.startTime)
        )
        
        // Try to add patients from this batch
        for (const simPatient of sortedPatients) {
          // Stop THIS BATCH if we've reached our target
          if (addedPatients >= targetPatientsToAdd) {
            console.log(` Target reached in round ${generationRound}: ${addedPatients}/${targetPatientsToAdd} patients added`)
            break
          }
        // Calculate total treatment duration
        const totalDuration = calculateTotalTreatmentTime(simPatient.medicationId, simPatient.treatmentNumber)
        
        // STEP 1: Check if patient fits within chair capacity
        if (!chairTracker.canAddPatient(simPatient.startTime, totalDuration)) {
          // Try to find an alternative time slot with chair capacity
          const alternativeTime = chairTracker.findNextAvailableSlot(simPatient.startTime, totalDuration)
          
          if (!alternativeTime) {
            // No available slot - skip this patient
            skippedPatients++
            console.log(` Skipped ${simPatient.name} - no chair capacity`)
            continue
          }
          
          // Use alternative time
          simPatient.startTime = alternativeTime
          rescheduledPatients++
          console.log(` Rescheduled ${simPatient.name} to ${alternativeTime} (chair capacity)`)
        }
        
        // Reserve chair capacity
        chairTracker.addPatient(simPatient.startTime, totalDuration)
        
        // Create patient with the (possibly rescheduled) start time
        const patientResponse = await fetch('/api/patients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            name: simPatient.name, 
            startTime: simPatient.startTime,
            scheduledDate: selectedDate, // Date for this simulation
            medicationType: simPatient.medicationId, 
            treatmentNumber: simPatient.treatmentNumber 
          }),
        })
        
        if (!patientResponse.ok) continue
        
        const patient = await patientResponse.json()
        
        // Generate actions for this patient
        const actions = generateActionsForMedication(simPatient.medicationId, simPatient.treatmentNumber)
        
        // Track cumulative time for this patient's actions
        let cumulativeMinutes = 0
        const [startHours, startMinutes] = simPatient.startTime.split(':').map(Number)
        let patientStartMinutes = startHours * 60 + startMinutes // Let so we can update if setup is delayed
        
        // Keep track of initial total duration for closing time checks
        const patientTotalDuration = totalDuration
        
        // Assign staff intelligently
        let setupStaff: string | null = null // Track who did the setup
        let infusionStartMinutes = 0 // Track when infusion starts (after setup + protocol check)
        
        for (const action of actions) {
          let staff: string
          
          // Track when the infusion starts (we need this for check/PC switch offsets)
          if (action.type === 'infusion') {
            infusionStartMinutes = patientStartMinutes + cumulativeMinutes
          }
          
          // Calculate when this action occurs
          // For checks and PC switches: use checkOffset FROM START OF INFUSION
          let actionStartMinutes: number
          if ((action.type === 'check' || action.type === 'pc_switch') && (action as any).checkOffset) {
            // Check/PC switch happens DURING infusion, offset from INFUSION START
            actionStartMinutes = infusionStartMinutes + (action as any).checkOffset
          } else {
            actionStartMinutes = patientStartMinutes + cumulativeMinutes
          }
          
          const actionStartHours = Math.floor(actionStartMinutes / 60)
          const actionStartMins = actionStartMinutes % 60
          const actionStartTime = `${actionStartHours.toString().padStart(2, '0')}:${actionStartMins.toString().padStart(2, '0')}`
          
          if (action.type === 'infusion') {
            staff = 'Systeem'
          } else if (action.type === 'observation') {
            staff = 'Geen' // Observation requires no staff - patient just waits on ward
          } else if (action.type === 'setup') {
            const assignment = scheduler.assignStaffForSetup(actionStartTime, action.duration)
            staff = assignment.staff
            
            // Check if NO staff available
            if (staff === 'GEEN') {
              console.log(` Geen verpleegkundigen beschikbaar voor ${simPatient.name} in simulatie. Patient wordt geannuleerd.`)
              
              // Delete the patient from database
              await fetch(`/api/patients/${patient.id}`, {
                method: 'DELETE',
              })
              
              // Decrease added patients count (was incremented earlier)
              addedPatients--
              
              // Skip rest of actions for this patient
              break
            }
            
            // If setup was delayed, we need to update the patient's start time
            if (assignment.wasDelayed) {
              const [delayedHours, delayedMins] = assignment.actualStartTime.split(':').map(Number)
              const delayedMinutes = delayedHours * 60 + delayedMins
              const delay = delayedMinutes - actionStartMinutes
              if (delay > 0) {
                // Check if delayed start would cause treatment to end after closing
                const newEndMinutes = delayedMinutes + patientTotalDuration
                const closingMinutes = DEPARTMENT_CONFIG.END_HOUR * 60
                
                if (newEndMinutes > closingMinutes) {
                  const endHours = Math.floor(newEndMinutes/60)
                  const endMins = String(newEndMinutes%60).padStart(2,'0')
                  console.log(` Setup delay would cause ${simPatient.name} to end at ${endHours}:${endMins}, after closing (16:00). Deleting patient.`)
                  
                  // Delete the patient from database
                  await fetch(`/api/patients/${patient.id}`, {
                    method: 'DELETE',
                  })
                  
                  // Decrease added patients count
                  addedPatients--
                  
                  // Skip rest of actions for this patient
                  break
                }
                
                console.log(` Setup delayed by ${delay} min for ${simPatient.name}, updating patient start time to ${assignment.actualStartTime}`)
                
                // Update patient start time in database
                await fetch(`/api/patients/${patient.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ startTime: assignment.actualStartTime }),
                })
                
                // Adjust tracking
                patientStartMinutes = delayedMinutes
                cumulativeMinutes = 0 // Reset as we're starting fresh with new start time
              }
            }
            setupStaff = staff // Remember who did the setup
          } else if ((action.type as string) === 'protocol_check' || action.name.includes('Protocol Controle')) {
            // MUST be a DIFFERENT staff member than setup!
            const duration = action.actualDuration || action.duration
            const assignment = scheduler.assignStaffForAction(action.type || 'protocol_check', duration, actionStartTime, setupStaff || undefined)
            staff = assignment.staff
            
            // Check if NO staff available (action falls outside working hours)
            if (staff === 'GEEN') {
              console.log(` Protocol check valt buiten werktijden voor ${simPatient.name}. Patient wordt geannuleerd.`)
              await fetch(`/api/patients/${patient.id}`, { method: 'DELETE' })
              addedPatients--
              break
            }
          } else if (action.type === 'check' || action.type === 'pc_switch') {
            // Check/PC switch during infusion - assign to ANY available nurse (can be same as setup nurse)
            const duration = action.actualDuration || action.duration
            const assignment = scheduler.assignStaffForAction(action.type, duration, actionStartTime)
            staff = assignment.staff
            
            // Check if NO staff available (action falls outside working hours)
            if (staff === 'GEEN') {
              console.log(` ${action.type} valt buiten werktijden voor ${simPatient.name}. Patient wordt geannuleerd.`)
              await fetch(`/api/patients/${patient.id}`, { method: 'DELETE' })
              addedPatients--
              break
            }
          } else {
            const duration = action.actualDuration || action.duration
            const assignment = scheduler.assignStaffForAction(action.type || 'other', duration, actionStartTime)
            staff = assignment.staff
            
            // Check if NO staff available (action falls outside working hours)
            if (staff === 'GEEN') {
              console.log(` ${action.type || 'Actie'} valt buiten werktijden voor ${simPatient.name}. Patient wordt geannuleerd.`)
              await fetch(`/api/patients/${patient.id}`, { method: 'DELETE' })
              addedPatients--
              break
            }
            
            // If removal/flush was delayed, we need to adjust cumulative time to prevent overlap
            if (assignment.wasDelayed && (action.type === 'removal' || action.type === 'flush')) {
              const [delayedHours, delayedMins] = assignment.actualStartTime.split(':').map(Number)
              const delayedMinutes = delayedHours * 60 + delayedMins
              const delay = delayedMinutes - actionStartMinutes
              if (delay > 0) {
                // Check if this delay would push end time past closing
                const estimatedEndMinutes = delayedMinutes + duration
                const closingMinutes = DEPARTMENT_CONFIG.END_HOUR * 60
                
                if (estimatedEndMinutes > closingMinutes) {
                  const endHours = Math.floor(estimatedEndMinutes/60)
                  const endMins = String(estimatedEndMinutes%60).padStart(2,'0')
                  console.log(` ${action.type} delay would cause ${simPatient.name} to end at ${endHours}:${endMins}, after closing (16:00). Deleting patient.`)
                  
                  // Delete the patient from database
                  await fetch(`/api/patients/${patient.id}`, {
                    method: 'DELETE',
                  })
                  
                  // Decrease added patients count
                  addedPatients--
                  
                  // Skip rest of actions for this patient
                  break
                }
                
                console.log(` ${action.type} delayed by ${delay} min for ${simPatient.name}, adjusting cumulative time`)
                cumulativeMinutes += delay
              }
            }
          }
          
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
          
          // Update cumulative time
          cumulativeMinutes += action.duration
        }
        
        addedPatients++
        
        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      
      // End of generation round - check if we need another batch
      console.log(`Round ${generationRound} complete: ${addedPatients}/${targetPatientsToAdd}, skipped: ${skippedPatients}`)
    }
      
      // Final check
      if (addedPatients < targetPatientsToAdd) {
        console.warn(` Could not reach target. Added ${addedPatients}/${targetPatientsToAdd} after ${generationRound} rounds`)
      }
      
      await fetchPatients()
      
      // Show statistics
      const distribution = scheduler.getWorkloadDistribution()
      console.log('Staff workload distribution:', distribution)
      console.log(`Chair occupancy - Peak: ${chairTracker.getPeakOccupancy()}/${DEPARTMENT_CONFIG.TOTAL_CHAIRS}, Avg: ${chairTracker.getAverageOccupancy().toFixed(1)}`)
      
      // Fetch the latest patients to analyze medication distribution
      const response = await fetch('/api/patients')
      if (response.ok) {
        const allPatients = await response.json()
        const medCounts: { [key: string]: number } = {}
        allPatients.forEach((p: Patient) => {
          medCounts[p.medicationType] = (medCounts[p.medicationType] || 0) + 1
        })
        console.log('Medication distribution:', medCounts)
        
        // Count key medications
        const infliximabCount = (medCounts['infliximab_5mg'] || 0) + (medCounts['infliximab_10mg'] || 0)
        const zometaCount = medCounts['zoledroninezuur'] || 0
        const ocrelizumabCount = (medCounts['ocrelizumab_schema1'] || 0) + (medCounts['ocrelizumab_schema2'] || 0) + (medCounts['ocrelizumab_schema3'] || 0)
        const aderlatingCount = (medCounts['aderlating'] || 0) + (medCounts['aderlating_infuus'] || 0)
        
        console.log(`Distribution summary:
  Infliximab: ${infliximabCount} (${((infliximabCount/allPatients.length)*100).toFixed(1)}%)
  Zometa: ${zometaCount} (${((zometaCount/allPatients.length)*100).toFixed(1)}%)
  Ocrelizumab: ${ocrelizumabCount} (${((ocrelizumabCount/allPatients.length)*100).toFixed(1)}%)
  Aderlating: ${aderlatingCount} (${((aderlatingCount/allPatients.length)*100).toFixed(1)}%)
  Overige: ${allPatients.length - infliximabCount - zometaCount - ocrelizumabCount - aderlatingCount}`)
      }
      
      // Report results
      const resultMessage = addedPatients === targetPatientsToAdd 
        ? ` Simulatie voltooid! ${addedPatients} patiënten toegevoegd${rescheduledPatients > 0 ? ` (${rescheduledPatients} verplaatst)` : ''}` 
        : ` Simulatie voltooid! ${addedPatients}/${targetPatientsToAdd} patiënten toegevoegd (${skippedPatients} overgeslagen door capaciteit)`
      
      showNotification(resultMessage, addedPatients === targetPatientsToAdd ? 'success' : 'warning')
      setActiveTab('medewerkers')
    } catch (error) {
      console.error('Failed to run simulation:', error)
      showNotification('Fout bij uitvoeren simulatie', 'warning')
    }
  }

  return (
    <main className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* Compact Header */}
      <header className="bg-gradient-to-r from-blue-700 to-blue-600 text-white py-4 px-6 shadow-lg flex-shrink-0">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dagbehandeling 4B</h1>
            <p className="text-sm opacity-90">
              {(() => {
                const dayOfWeek = getDayOfWeekFromDate(selectedDate)
                const staffForDay = staffMembers.filter(s => s.workDays.length === 0 || s.workDays.includes(dayOfWeek))
                const capacity = getDailyPatientCapacity(dayOfWeek, staffMembers)
                return `08:00-16:00 • ${staffForDay.length} verpleegkundigen • ${DEPARTMENT_CONFIG.TOTAL_CHAIRS} stoelen max • max ${capacity.max} patiënten/dag`
              })()}
            </p>
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
            {/* Quick Actions Bar */}
            <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3 flex-shrink-0">
              <button
                onClick={handleRunSimulation}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-semibold text-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Start Simulatie
              </button>
              <button
                onClick={handleOptimizePlanning}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-semibold text-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Optimaliseer
              </button>
              <button
                onClick={handleClearAll}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors font-semibold text-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Wissen
              </button>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">
              {/* Sidebar */}
              <aside className="w-64 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col">
            <nav className="flex flex-col p-4 space-y-1">
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
            </nav>
          </aside>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-6">
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
                      <div className="flex items-center gap-3">
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
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors shadow-sm"
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
                    onDeleteAction={handleDeleteAction}
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
                          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                        >
                          Analyseer Werkdruk
                        </button>
                        <button
                          onClick={handleOptimizePlanning}
                          className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
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
                  <input
                    type="date"
                    value={selectedWeekStart}
                    onChange={(e) => setSelectedWeekStart(e.target.value)}
                    className="bg-white text-slate-900 px-3 py-2 rounded-md font-semibold text-sm border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
              <button
                onClick={saveWeekPlan}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
              >
                Opslaan
              </button>
            </div>

            {/* Week Planning Tabs */}
            <div className="bg-white border-b border-slate-200 px-6 flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setWeekPlanTab('rooster')}
                className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                  weekPlanTab === 'rooster'
                    ? 'text-blue-600 border-blue-600'
                    : 'text-slate-600 border-transparent hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                Verpleegkundigen Rooster
              </button>
              <button
                onClick={() => setWeekPlanTab('behandelingen')}
                className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                  weekPlanTab === 'behandelingen'
                    ? 'text-blue-600 border-blue-600'
                    : 'text-slate-600 border-transparent hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                Behandelingen
              </button>
              <button
                onClick={() => setWeekPlanTab('overzicht')}
                className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                  weekPlanTab === 'overzicht'
                    ? 'text-blue-600 border-blue-600'
                    : 'text-slate-600 border-transparent hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                Week Overzicht
              </button>
            </div>

            {/* Week Planning Content */}
            <div className="flex-1 overflow-y-auto p-6">
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
                    isGenerating={isGenerating}
                  />
                )}
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
    </main>
  )
}
