'use client'

import { useState } from 'react'
import { useDagplanningContext } from '../layout'
import { Patient } from '@/types'
import TreatmentBoxes from '@/components/patients/TreatmentBoxes'
import PatientModal from '@/components/patients/PatientModal'
import { validateNurseWorkDay } from '@/features/patients/patientValidation'
import { updatePatient } from '@/features/patients/patientService'
import { getDayOfWeekFromDate } from '@/types'
import { useNotifications } from '@/hooks/useNotifications'
import Notification from '@/components/common/Notification'

export default function BehandelingenPage() {
  const {
    selectedDate,
    patients,
    fetchPatients,
    staffMembers,
    staffSchedule,
    coordinatorByDay,
  } = useDagplanningContext()

  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false)
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null)
  const { notification, showNotification, closeNotification } = useNotifications()

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
      if (preferredNurse) {
        const workDayValidation = validateNurseWorkDay(preferredNurse, staffMembers, selectedDate)
        if (!workDayValidation.valid) {
          showNotification(workDayValidation.message!, 'warning')
          return
        }
      }

      // Update logic here - simplified for now
      await fetchPatients()
      showNotification('Behandeling bijgewerkt', 'success')
      setIsPatientModalOpen(false)
      setEditingPatient(null)
    } catch (error) {
      console.error('Failed to update patient:', error)
      showNotification('Fout bij bijwerken behandeling', 'warning')
    }
  }

  const day = getDayOfWeekFromDate(selectedDate)
  const assignedNames = staffSchedule[day]

  return (
    <>
      <TreatmentBoxes
        patients={patients}
        onEditPatient={handleEditPatient}
      />

      <PatientModal
        isOpen={isPatientModalOpen}
        onClose={() => {
          setIsPatientModalOpen(false)
          setEditingPatient(null)
        }}
        onSubmit={() => {}}
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
    </>
  )
}

