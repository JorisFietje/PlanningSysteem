'use client'

import { useState } from 'react'
import { useWeekplanningContext } from '../layout'
import { useNotifications } from '@/hooks/useNotifications'
import { generateWeekPlan } from '@/utils/planning/weekPlanGenerator'
import { deletePatient as deletePatientService } from '@/features/patients/patientService'
import WeekOverview from '@/components/planning/WeekOverview'
import Notification from '@/components/common/Notification'

export default function OverzichtPage() {
  const {
    selectedWeekStart,
    staffSchedule,
    treatments,
    staffMembers,
    generatedPatients,
    setGeneratedPatients,
    isGenerating,
    setIsGenerating,
    loadWeekPlan,
    getWeekDates,
  } = useWeekplanningContext()

  const { notification, showNotification, closeNotification } = useNotifications()
  const weekDates = getWeekDates()

  const handleGeneratePlan = async () => {
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
      await loadWeekPlan()
    } catch (error) {
      console.error('Failed to generate plan:', error)
      showNotification('Fout bij genereren planning', 'warning')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDeletePlan = async () => {
    if (!confirm(`Weet je zeker dat je de gegenereerde planning wilt verwijderen? Dit verwijdert ${generatedPatients.length} patiënten.`)) return
    
    try {
      let deletedCount = 0
      for (const patientId of generatedPatients) {
        const success = await deletePatientService(patientId)
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

      showNotification(`Planning verwijderd! ${deletedCount} patiënten verwijderd.`, 'success')
      await loadWeekPlan()
    } catch (error) {
      console.error('Failed to delete plan:', error)
      showNotification('Fout bij verwijderen planning', 'warning')
    }
  }

  return (
    <>
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

