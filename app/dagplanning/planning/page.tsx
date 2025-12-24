'use client'

import { useState, useEffect } from 'react'
import { useDagplanningContext } from '../layout'
import { Patient, getDayOfWeekFromDate, DEPARTMENT_CONFIG, getMondayOfWeek, formatDateToISO } from '@/types'
import { validateNurseWorkDay } from '@/features/patients/patientValidation'
import { addPatientWithActions } from '@/features/patients/patientAssignment'
import { deletePatient as deletePatientService, updatePatient, updatePatientStartTime } from '@/features/patients/patientService'
import { deleteAction, updateActionDuration } from '@/features/patients/actionService'
import { calculateWorkloadByTimeSlot } from '@/utils/planning/workload'
import DatePicker from '@/components/planning/DatePicker'
import ScheduleBoard from '@/components/patients/ScheduleBoard'
import PatientModal from '@/components/patients/PatientModal'
import { useNotifications } from '@/hooks/useNotifications'
import ConfirmModal from '@/components/common/ConfirmModal'
import Notification from '@/components/common/Notification'

type ConfirmModalState = {
  isOpen: boolean
  title: string
  message: string
  onConfirm: () => void
  variant?: 'danger' | 'warning' | 'info'
  confirmText?: string
}

export default function PlanningPage() {
  const {
    selectedDate,
    setSelectedDate,
    patients,
    setPatients,
    fetchPatients,
    staffMembers,
    workload,
    setWorkload,
    staffSchedule,
    coordinatorByDay,
  } = useDagplanningContext()

  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false)
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null)
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'info'
  })

  const { notification, showNotification, closeNotification } = useNotifications()

  useEffect(() => {
    fetchPatients()
  }, [fetchPatients, selectedDate])

  useEffect(() => {
    const calculatedWorkload = calculateWorkloadByTimeSlot(patients)
    setWorkload(calculatedWorkload)
  }, [patients, setWorkload])

  const syncWeekPlanTreatment = async (
    medicationId: string,
    treatmentNumber: number,
    delta: number
  ) => {
    if (delta === 0) return
    try {
      const monday = getMondayOfWeek(selectedDate)
      const res = await fetch(`/api/weekplan?weekStart=${monday}`)
      let existing: any = null
      if (res.ok) {
        existing = await res.json()
      }
      
      const getWeekEndFromMonday = (mondayISO: string): string => {
        const start = new Date(mondayISO + 'T00:00:00')
        const friday = new Date(start)
        friday.setDate(start.getDate() + 4)
        return formatDateToISO(friday)
      }

      const weekStartDate = monday
      const weekEndDate = getWeekEndFromMonday(monday)

      const staffSchedulesPayload =
        existing?.staffSchedules?.map((s: any) => ({
          dayOfWeek: s.dayOfWeek,
          staffNames: s.staffNames
        })) || []

      const mapKey = (m: string, t: number) => `${m}__${t}`
      const counts = new Map<string, number>()
      if (existing?.treatments) {
        for (const t of existing.treatments) {
          const key = mapKey(t.medicationId, t.treatmentNumber)
          counts.set(key, (counts.get(key) || 0) + t.quantity)
        }
      }
      
      const key = mapKey(medicationId, treatmentNumber)
      counts.set(key, Math.max(0, (counts.get(key) || 0) + delta))

      const treatmentsPayload: Array<{ medicationId: string; treatmentNumber: number; quantity: number }> = []
      counts.forEach((q, k) => {
        if (q > 0) {
          const [mid, tn] = k.split('__')
          treatmentsPayload.push({ medicationId: mid, treatmentNumber: parseInt(tn), quantity: q })
        }
      })

      await fetch('/api/weekplan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekStartDate,
          weekEndDate,
          staffSchedules: staffSchedulesPayload,
          treatments: treatmentsPayload
        })
      })
    } catch (e) {
      console.error('Failed to sync week plan treatments:', e)
    }
  }

  const handleAddPatient = async (
    name: string,
    startTime: string,
    medicationId: string,
    treatmentNumber: number,
    preferredNurse?: string,
    customInfusionMinutes?: number
  ) => {
    try {
      if (preferredNurse) {
        const workDayValidation = validateNurseWorkDay(preferredNurse, staffMembers, selectedDate)
        if (!workDayValidation.valid) {
          showNotification(workDayValidation.message!, 'warning')
          return
        }
      }

      const patientsAtTime = patients.filter(p => p.startTime === startTime).length
      const day = getDayOfWeekFromDate(selectedDate)
      const assignedNames = staffSchedule[day]
      const filteredStaff = (assignedNames && assignedNames.length > 0)
        ? staffMembers.filter(s => assignedNames.includes(s.name))
        : staffMembers

      const result = await addPatientWithActions(
        name,
        startTime,
        selectedDate,
        medicationId,
        treatmentNumber,
        filteredStaff,
        patients,
        preferredNurse,
        showNotification,
        false,
        coordinatorByDay[day] || undefined,
        customInfusionMinutes
      )

      if (!result.success) {
        return
      }

      await fetchPatients()
      await syncWeekPlanTreatment(medicationId, treatmentNumber, 1)

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

  const handleEditPatient = (patient: Patient) => {
    setEditingPatient(patient)
    setIsPatientModalOpen(true)
  }

  const handleUpdatePatient = async (
    patientId: string,
    startTime: string,
    medicationId: string,
    treatmentNumber: number,
    preferredNurse?: string,
    customInfusionMinutes?: number
  ) => {
    try {
      const prevPatient = patients.find(p => p.id === patientId) || null
      const prevMedicationId = prevPatient?.medicationType
      const prevTreatmentNumber = prevPatient?.treatmentNumber

      if (preferredNurse) {
        const workDayValidation = validateNurseWorkDay(preferredNurse, staffMembers, selectedDate)
        if (!workDayValidation.valid) {
          showNotification(workDayValidation.message!, 'warning')
          return
        }
      }

      const updatedPatient = await updatePatient(patientId, {
        startTime,
        medicationType: medicationId,
        treatmentNumber
      })

      if (!updatedPatient) {
        showNotification('Fout bij bijwerken behandeling', 'warning')
        return
      }

      const patient = patients.find(p => p.id === patientId)
      if (patient) {
        for (const action of patient.actions) {
          await deleteAction(action.id)
        }
      }

      const day = getDayOfWeekFromDate(selectedDate)
      const assignedNames = staffSchedule[day]
      const filteredStaff = (assignedNames && assignedNames.length > 0)
        ? staffMembers.filter(s => assignedNames.includes(s.name))
        : staffMembers
      const result = await addPatientWithActions(
        updatedPatient.name,
        startTime,
        selectedDate,
        medicationId,
        treatmentNumber,
        filteredStaff,
        patients.filter(p => p.id !== patientId),
        preferredNurse,
        showNotification,
        false,
        coordinatorByDay[day] || undefined,
        customInfusionMinutes
      )

      if (!result.success) {
        showNotification('Behandeling kon niet worden bijgewerkt', 'warning')
        return
      }

      await fetchPatients()

      if (prevMedicationId && prevTreatmentNumber) {
        await syncWeekPlanTreatment(prevMedicationId, prevTreatmentNumber, -1)
      }
      await syncWeekPlanTreatment(medicationId, treatmentNumber, 1)

      showNotification('Behandeling bijgewerkt', 'success')
      setIsPatientModalOpen(false)
      setEditingPatient(null)
    } catch (error) {
      console.error('Failed to update patient:', error)
      showNotification('Fout bij bijwerken behandeling', 'warning')
    }
  }

  const handleDeletePatient = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId)
    if (!patient) return

    setConfirmModal({
      isOpen: true,
      title: 'Behandeling verwijderen',
      message: `Weet u zeker dat u de behandeling voor ${patient.name} wilt verwijderen?`,
      variant: 'danger',
      confirmText: 'Verwijderen',
      onConfirm: async () => {
        try {
          await deletePatientService(patientId)
          await fetchPatients()
          await syncWeekPlanTreatment(patient.medicationType, patient.treatmentNumber, -1)
          showNotification(`Behandeling voor ${patient.name} verwijderd`, 'success')
        } catch (error) {
          console.error('Failed to delete patient:', error)
          showNotification('Fout bij verwijderen behandeling', 'warning')
        }
      }
    })
  }

  const handleUpdateInfusionDuration = async (patientId: string, actionId: string, duration: number) => {
    const ok = await updateActionDuration(actionId, duration)
    if (!ok) {
      showNotification('Fout bij aanpassen infuusduur', 'warning')
      return false
    }
    setPatients(prev =>
      prev.map(patient => {
        if (patient.id !== patientId) return patient
        return {
          ...patient,
          actions: patient.actions.map(action =>
            action.id === actionId ? { ...action, duration } : action
          )
        }
      })
    )
    showNotification('Infuusduur aangepast', 'success')
    return true
  }

  const handleUpdatePatientStartTime = async (patientId: string, startTime: string) => {
    const [hours, minutes] = startTime.split(':').map(Number)
    const roundedMinutes = Math.round(minutes / 5) * 5
    const carryHours = Math.floor(roundedMinutes / 60)
    const normalizedMinutes = roundedMinutes % 60
    const normalizedHours = hours + carryHours
    const normalizedTime = `${String(normalizedHours).padStart(2, '0')}:${String(normalizedMinutes).padStart(2, '0')}`
    setPatients(prev =>
      prev.map(patient => (patient.id === patientId ? { ...patient, startTime: normalizedTime } : patient))
    )
    const ok = await updatePatientStartTime(patientId, normalizedTime)
    if (!ok) {
      setPatients(prev =>
        prev.map(patient => (patient.id === patientId ? { ...patient, startTime } : patient))
      )
      showNotification('Fout bij aanpassen starttijd', 'warning')
      return false
    }
    showNotification('Starttijd aangepast', 'success')
    return true
  }

  const handleDuplicatePatient = async (patient: Patient) => {
    const infusionAction = patient.actions.find(a => a.type === 'infusion')
    const customInfusionMinutes = infusionAction ? infusionAction.duration : undefined
    const newName = `${patient.name} (kopie)`
    try {
      const day = getDayOfWeekFromDate(selectedDate)
      const assignedNames = staffSchedule[day]
      const filteredStaff = (assignedNames && assignedNames.length > 0)
        ? staffMembers.filter(s => assignedNames.includes(s.name))
        : staffMembers

      const result = await addPatientWithActions(
        newName,
        patient.startTime,
        selectedDate,
        patient.medicationType,
        patient.treatmentNumber,
        filteredStaff,
        patients,
        undefined,
        showNotification,
        true,
        coordinatorByDay[day] || undefined,
        customInfusionMinutes
      )

      if (!result.success) return

      await fetchPatients()
      await syncWeekPlanTreatment(patient.medicationType, patient.treatmentNumber, 1)
      showNotification('Behandeling gekopieerd', 'success')
    } catch (error) {
      console.error('Failed to duplicate patient:', error)
      showNotification('Fout bij dupliceren behandeling', 'warning')
    }
  }

  const day = getDayOfWeekFromDate(selectedDate)
  const assignedNames = staffSchedule[day]

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
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

        <div className="flex-1 overflow-hidden">
          <ScheduleBoard
            patients={patients}
            onAddPatient={undefined}
            onDeletePatient={handleDeletePatient}
            onUpdateInfusionDuration={handleUpdateInfusionDuration}
            onUpdatePatientStartTime={handleUpdatePatientStartTime}
            onDuplicatePatient={handleDuplicatePatient}
            showHeader={false}
          />
        </div>
      </div>

      <PatientModal
        isOpen={isPatientModalOpen}
        onClose={() => {
          setIsPatientModalOpen(false)
          setEditingPatient(null)
        }}
        onSubmit={handleAddPatient}
        selectedDate={selectedDate}
        staffMembers={(assignedNames && assignedNames.length > 0)
          ? staffMembers.filter(s => assignedNames.includes(s.name))
          : staffMembers}
        editingPatient={editingPatient}
        onUpdate={handleUpdatePatient}
      />

      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={closeNotification}
        />
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant || 'info'}
        confirmText={confirmModal.confirmText}
      />
    </>
  )
}
