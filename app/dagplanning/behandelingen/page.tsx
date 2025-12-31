'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { formatDateToISO, getAllMedications, getDayOfWeekFromDate, getMondayOfWeek, Patient, StaffMember } from '@/types'
import { Medication } from '@/types/medications'
import { useDagplanningContext } from '../layout'
import { scheduleTreatmentsAcrossDates } from '@/utils/planning/dayAutoScheduler'
import { buildScheduleFromWorkDays } from '@/utils/staff/workDays'

type DragMode = 'add' | 'remove'

const monthNames = [
  'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
  'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'
]

const weekDays = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']

function treatmentLabel(treatmentNumber: number) {
  if (treatmentNumber === 1) return '1e behandeling'
  if (treatmentNumber === 2) return '2e-3e behandeling'
  if (treatmentNumber === 3) return '4e-6e behandeling'
  return '7e+ behandeling'
}

export default function BehandelingenPage() {
  const { staffMembers, staffSchedule, coordinatorByDay } = useDagplanningContext()
  const [isMounted, setIsMounted] = useState(false)
  const [medications, setMedications] = useState<Medication[]>([])
  const today = new Date()
  const [monthDate, setMonthDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDates, setSelectedDates] = useState<string[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartDay, setDragStartDay] = useState<number | null>(null)
  const [dragCurrentDay, setDragCurrentDay] = useState<number | null>(null)
  const [dragMode, setDragMode] = useState<DragMode>('add')
  const [selectionWarning, setSelectionWarning] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [saveError, setSaveError] = useState('')
  const [treatmentCounts, setTreatmentCounts] = useState<Record<string, number>>({})
  const [isScheduling, setIsScheduling] = useState(false)
  const [scheduleError, setScheduleError] = useState('')
  const [scheduleResult, setScheduleResult] = useState<Array<{
    date: string
    startTime: string
    label: string
    medicationId?: string
    treatmentNumber?: number
    patientId?: string
  }>>([])
  const [capacityStatus, setCapacityStatus] = useState<Record<string, { max: number | null; planned: number; remaining: number | null }>>({})
  const [scheduleSkipped, setScheduleSkipped] = useState<Array<{ label: string; reason: string }>>([])
  const [planGroups, setPlanGroups] = useState<Array<{
    id: string
    createdAt: string
    selectedDates: string[]
    requests: Array<{ medicationId: string; treatmentNumber: number; quantity: number }>
    scheduled: Array<{ date: string; startTime: string; label: string; medicationId?: string; treatmentNumber?: number; patientId?: string }>
    skipped: Array<{ label: string; reason: string }>
    patientIds: string[]
  }>>([])
  const [collapsedPlanGroups, setCollapsedPlanGroups] = useState<Record<string, boolean>>({})
  const [isCapacityCollapsed, setIsCapacityCollapsed] = useState(false)
  const [isScheduleCollapsed, setIsScheduleCollapsed] = useState(false)
  const [overbookModal, setOverbookModal] = useState<{
    isOpen: boolean
    dates: string[]
    remainingByDate: Record<string, number>
    maxByDate: Record<string, number>
    overflow: number
    values: Record<string, string>
    error: string
  }>({
    isOpen: false,
    dates: [],
    remainingByDate: {},
    maxByDate: {},
    overflow: 0,
    values: {},
    error: ''
  })
  const overbookResolverRef = useRef<((value: Record<string, number> | null) => void) | null>(null)

  const selectedSet = useMemo(() => new Set(selectedDates), [selectedDates])

  const currentMonth = monthDate.getMonth()
  const currentYear = monthDate.getFullYear()
  const firstDay = new Date(currentYear, currentMonth, 1)
  const lastDay = new Date(currentYear, currentMonth + 1, 0)
  const daysInMonth = lastDay.getDate()
  const startingDayOfWeek = firstDay.getDay()
  const adjustedStartingDay = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1

  const days: (number | null)[] = []
  for (let i = 0; i < adjustedStartingDay; i++) {
    days.push(null)
  }
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day)
  }

  const getDateISO = (day: number) => formatDateToISO(new Date(currentYear, currentMonth, day))
  const formatDateDMY = (value: string) => {
    const date = new Date(value + 'T00:00:00')
    if (Number.isNaN(date.getTime())) return value
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}-${month}-${year}`
  }

  const applyRange = (base: Set<string>, startDay: number, endDay: number, mode: DragMode) => {
    const next = new Set(base)
    const minDay = Math.min(startDay, endDay)
    const maxDay = Math.max(startDay, endDay)
    for (let day = minDay; day <= maxDay; day++) {
      const iso = getDateISO(day)
      if (mode === 'add') {
        next.add(iso)
      } else {
        next.delete(iso)
      }
    }
    return next
  }

  const previewSelectedSet = useMemo(() => {
    if (!isDragging || dragStartDay === null || dragCurrentDay === null) {
      return selectedSet
    }
    return applyRange(selectedSet, dragStartDay, dragCurrentDay, dragMode)
  }, [isDragging, dragStartDay, dragCurrentDay, dragMode, selectedSet, currentMonth, currentYear])

  useEffect(() => {
    if (!isDragging) return
    const handleUp = () => {
      if (dragStartDay === null || dragCurrentDay === null) {
        setIsDragging(false)
        return
      }
      const next = applyRange(selectedSet, dragStartDay, dragCurrentDay, dragMode)
      const nextDates = Array.from(next).sort()
      setSelectedDates(nextDates)
      setIsDragging(false)
      setDragStartDay(null)
      setDragCurrentDay(null)
    }
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
    return () => {
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
    }
  }, [isDragging, dragStartDay, dragCurrentDay, dragMode, selectedSet, currentMonth, currentYear])

  useEffect(() => {
    setIsMounted(true)
    setMedications(getAllMedications())
  }, [])

  const normalizeTreatmentCounts = (input: unknown) => {
    if (!input || typeof input !== 'object') return {}
    const next: Record<string, number> = {}
    Object.entries(input as Record<string, unknown>).forEach(([key, value]) => {
      const numeric = typeof value === 'number' ? value : parseInt(String(value), 10)
      if (Number.isFinite(numeric) && numeric > 0) {
        next[key] = numeric
      }
    })
    return next
  }

  useEffect(() => {
    try {
      const stored = localStorage.getItem('selectedTreatmentsByDate')
      if (!stored) return
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed.selectedDates)) {
        setSelectedDates(parsed.selectedDates)
      }
      if (parsed.treatmentCounts && typeof parsed.treatmentCounts === 'object') {
        setTreatmentCounts(normalizeTreatmentCounts(parsed.treatmentCounts))
      } else if (parsed.dateTreatmentCounts && typeof parsed.dateTreatmentCounts === 'object') {
        const aggregated: Record<string, number> = {}
        Object.values(parsed.dateTreatmentCounts).forEach((perDate: any) => {
          if (!perDate || typeof perDate !== 'object') return
          Object.entries(perDate).forEach(([id, count]) => {
            const numeric = typeof count === 'number' ? count : parseInt(String(count), 10)
            if (!Number.isFinite(numeric)) return
            aggregated[id] = Math.max(aggregated[id] || 0, numeric)
          })
        })
        setTreatmentCounts(normalizeTreatmentCounts(aggregated))
      }
    } catch (error) {
      console.error('Failed to load stored selections', error)
    }
    try {
      const storedPlan = localStorage.getItem('scheduledTreatments')
      if (!storedPlan) return
      const parsedPlan = JSON.parse(storedPlan)
      if (Array.isArray(parsedPlan)) {
        setScheduleResult(parsedPlan)
      }
    } catch (error) {
      console.error('Failed to load scheduled treatments', error)
    }
    try {
      const storedGroups = localStorage.getItem('planGroups')
      if (!storedGroups) return
      const parsedGroups = JSON.parse(storedGroups)
      if (Array.isArray(parsedGroups)) {
        const normalized = parsedGroups.map((group: any) => ({
          ...group,
          requests: Array.isArray(group.requests) ? group.requests : [],
          patientIds: Array.isArray(group.patientIds) ? group.patientIds : []
        }))
        setPlanGroups(normalized)
      }
    } catch (error) {
      console.error('Failed to load plan groups', error)
    }
    try {
      const storedCollapsed = localStorage.getItem('planGroupsCollapsed')
      if (!storedCollapsed) return
      const parsedCollapsed = JSON.parse(storedCollapsed)
      if (parsedCollapsed && typeof parsedCollapsed === 'object') {
        setCollapsedPlanGroups(parsedCollapsed)
      }
    } catch (error) {
      console.error('Failed to load plan groups collapsed state', error)
    }
  }, [])

  useEffect(() => {
    if (!isMounted) return
    try {
      const payload = {
        selectedDates,
        treatmentCounts
      }
      localStorage.setItem('selectedTreatmentsByDate', JSON.stringify(payload))
      setSaveMessage('Selecties automatisch opgeslagen.')
      setSaveError('')
    } catch (error) {
      console.error('Failed to auto save selections', error)
      setSaveError('Automatisch opslaan mislukt.')
      setSaveMessage('')
    }
  }, [isMounted, selectedDates, treatmentCounts])

  useEffect(() => {
    if (!isMounted) return
    try {
      localStorage.setItem('planGroups', JSON.stringify(planGroups))
    } catch (error) {
      console.error('Failed to save plan groups', error)
    }
  }, [isMounted, planGroups])

  useEffect(() => {
    if (!isMounted) return
    try {
      localStorage.setItem('planGroupsCollapsed', JSON.stringify(collapsedPlanGroups))
    } catch (error) {
      console.error('Failed to save plan groups collapsed state', error)
    }
  }, [isMounted, collapsedPlanGroups])

  const refreshCapacity = async (dates: string[]) => {
    if (dates.length === 0) {
      setCapacityStatus({})
      return {}
    }

    try {
      const weekStarts = Array.from(new Set(dates.map(date => getMondayOfWeek(date))))
      const weekPlans = await Promise.all(
        weekStarts.map(async weekStart => {
          const response = await fetch(`/api/weekplan?weekStart=${weekStart}`)
          if (!response.ok) return null
          return response.json()
        })
      )
      const maxByDate: Record<string, number | null> = {}
      weekPlans.forEach(plan => {
        if (!plan?.dayCapacities) return
        plan.dayCapacities.forEach((entry: any) => {
          if (entry?.date && entry.agreedMaxPatients !== undefined) {
            maxByDate[entry.date] = entry.agreedMaxPatients ?? null
          }
        })
      })

      const plannedCounts = await Promise.all(
        dates.map(async date => {
          const response = await fetch(`/api/patients?date=${date}`)
          if (!response.ok) return { date, planned: 0 }
          const patients = await response.json() as Patient[]
          return { date, planned: patients.length }
        })
      )

      const next: Record<string, { max: number | null; planned: number; remaining: number | null }> = {}
      plannedCounts.forEach(({ date, planned }) => {
        const max = maxByDate[date] ?? null
        next[date] = {
          max,
          planned,
          remaining: max !== null ? Math.max(max - planned, 0) : null
        }
      })
      setCapacityStatus(next)
      return next
    } catch (error) {
      console.error('Failed to load capacity status', error)
      return {}
    }
  }

  useEffect(() => {
    refreshCapacity(selectedDates)
  }, [selectedDates])

  const treatments = useMemo(() => {
    const colorOverrides: Record<string, string> = {
      abatacept: 'emerald',
      bevacizumab_long: 'orange',
      risankizumab: 'sky',
      ustekinumab: 'violet',
      infliximab_10mg: 'blue',
      rituximab_1000mg_day1: 'rose',
      rituximab_500mg_day1: 'rose',
      rituximab_day15: 'rose',
      tocilizumab_first: 'amber',
      tocilizumab_6months: 'amber',
      vedolizumab_first: 'cyan',
      vedolizumab_third_plus: 'cyan',
      ferinject_500mg: 'teal',
      ferinject_1000mg: 'teal',
      myozyme: 'indigo',
      methylprednisolon: 'lime',
      natalizumab_sc: 'fuchsia'
    }
    return medications.flatMap(med =>
      med.variants.map(variant => ({
        id: `${med.id}-${variant.treatmentNumber}`,
        medicationId: med.id,
        color: colorOverrides[med.id] || med.color,
        treatmentNumber: variant.treatmentNumber,
        label: variant.label || treatmentLabel(variant.treatmentNumber),
        displayName: med.displayName,
        totalMinutes: variant.timing.totalTime
      }))
    )
  }, [medications])

  const colorClasses: Record<string, string> = {
    purple: 'bg-purple-200 border-purple-300 text-purple-900',
    blue: 'bg-blue-200 border-blue-300 text-blue-900',
    green: 'bg-green-200 border-green-300 text-green-900',
    teal: 'bg-teal-200 border-teal-300 text-teal-900',
    orange: 'bg-orange-200 border-orange-300 text-orange-900',
    amber: 'bg-amber-200 border-amber-300 text-amber-900',
    red: 'bg-red-200 border-red-300 text-red-900',
    pink: 'bg-pink-200 border-pink-300 text-pink-900',
    indigo: 'bg-indigo-200 border-indigo-300 text-indigo-900',
    cyan: 'bg-cyan-200 border-cyan-300 text-cyan-900',
    lime: 'bg-lime-200 border-lime-300 text-lime-900',
    slate: 'bg-slate-200 border-slate-300 text-slate-900',
    emerald: 'bg-emerald-200 border-emerald-300 text-emerald-900',
    sky: 'bg-sky-200 border-sky-300 text-sky-900',
    violet: 'bg-violet-200 border-violet-300 text-violet-900',
    rose: 'bg-rose-200 border-rose-300 text-rose-900',
    fuchsia: 'bg-fuchsia-200 border-fuchsia-300 text-fuchsia-900'
  }

  const activeDateForBadge = selectedDates[0]

  const formatGroupTimestamp = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${day}-${month}-${year} ${hours}:${minutes}`
  }

  const buildTreatmentRequests = () => {
    if (selectedDates.length === 0) return []
    const counts: Record<string, number> = {}
    Object.entries(treatmentCounts).forEach(([id, count]) => {
      counts[id] = (counts[id] || 0) + count
    })

    return Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([id, count]) => {
        const [medicationId, treatmentNumber] = id.split('-')
        return {
          medicationId,
          treatmentNumber: parseInt(treatmentNumber, 10),
          quantity: count
        }
      })
      .filter(item => item.medicationId && Number.isFinite(item.treatmentNumber))
  }

  const countRequestedTreatments = (requests: Array<{ medicationId: string; treatmentNumber: number; quantity: number }>) => {
    return requests.reduce((sum, item) => sum + (Number.isFinite(item.quantity) ? item.quantity : 0), 0)
  }

  const requestOverbookByDate = (
    dates: string[],
    requestedCount: number,
    existingPatientsByDate: Record<string, Patient[]>,
    dayCapacityLimits: Record<string, number | null | undefined>,
    plannedOverrides?: Record<string, number>
  ): Promise<Record<string, number>> => {
    if (dates.length === 0 || requestedCount <= 0) return Promise.resolve({})
    let totalMax = 0
    const remainingByDate: Record<string, number> = {}
    const maxByDate: Record<string, number> = {}

    dates.forEach(date => {
      const max = dayCapacityLimits[date]
      if (typeof max !== 'number') {
        return
      }
      const planned = typeof plannedOverrides?.[date] === 'number'
        ? plannedOverrides[date]
        : (existingPatientsByDate[date]?.length || 0)
      totalMax += max
      remainingByDate[date] = Math.max(max - planned, 0)
      maxByDate[date] = max
    })

    if (totalMax === 0) return Promise.resolve({})
    const totalRemaining = Object.values(remainingByDate).reduce((sum, value) => sum + value, 0)
    const overflow = requestedCount - totalRemaining
    if (overflow <= 0) return Promise.resolve({})

    return new Promise(resolve => {
      const datesWithCapacity = dates.filter(date => remainingByDate[date] !== undefined)
      setOverbookModal({
        isOpen: true,
        dates: datesWithCapacity,
        remainingByDate,
        maxByDate,
        overflow,
        values: datesWithCapacity.reduce((acc, date) => {
          acc[date] = '0'
          return acc
        }, {} as Record<string, string>),
        error: ''
      })
      overbookResolverRef.current = resolve
    })
  }

  const totalSelectedTreatments = useMemo(() => {
    if (selectedDates.length === 0) return 0
    return treatments.reduce((sum, treatment) => {
      const count = treatmentCounts[treatment.id] || 0
      return sum + (Number.isFinite(count) ? count : 0)
    }, 0)
  }, [selectedDates, treatmentCounts, treatments])

  const capacitySummary = useMemo(() => {
    if (selectedDates.length === 0) return null
    let totalMax = 0
    let unknownCount = 0

    selectedDates.forEach(date => {
      const status = capacityStatus[date]
      if (!status || status.max === null) {
        unknownCount += 1
        return
      }
      totalMax += status.max
    })

    if (totalMax === 0 && unknownCount > 0) {
      return 'Capaciteit onbekend'
    }

    const base = `${totalSelectedTreatments}/${totalMax}`
    if (unknownCount > 0) {
      return `Capaciteit ${base} +?`
    }
    return `Capaciteit ${base}`
  }, [selectedDates, capacityStatus, totalSelectedTreatments])

  const handleTestSelectOverCapacity = () => {
    if (selectedDates.length === 0) {
      setSelectionWarning('Selecteer eerst één of meerdere datums in de agenda.')
      return
    }
    const totalMax = selectedDates.reduce((sum, date) => {
      const status = capacityStatus[date]
      if (!status || status.max === null) return sum
      return sum + status.max
    }, 0)
    if (totalMax === 0) {
      setSelectionWarning('Capaciteit onbekend voor de geselecteerde datums.')
      return
    }
    const targetTotal = totalMax + 10
    const next: Record<string, number> = {}
    const availableTreatments = treatments.filter(treatment => treatment.medicationId && Number.isFinite(treatment.treatmentNumber))
    if (availableTreatments.length === 0) {
      setSelectionWarning('Geen behandelingen beschikbaar om te selecteren.')
      return
    }
    for (let i = 0; i < targetTotal; i++) {
      const treatment = availableTreatments[i % availableTreatments.length]
      next[treatment.id] = (next[treatment.id] || 0) + 1
    }
    setSelectionWarning('')
    setSaveMessage('')
    setSaveError('')
    setTreatmentCounts(next)
  }

  const buildSchedulingContext = async (dates: string[]) => {
    const existingPatientsByDate: Record<string, Patient[]> = {}
    const responses = await Promise.all(
      dates.map(async date => {
        const response = await fetch(`/api/patients?date=${date}`)
        if (!response.ok) {
          return { date, patients: [] }
        }
        const patients = await response.json() as Patient[]
        return { date, patients }
      })
    )

    responses.forEach(({ date, patients }) => {
      existingPatientsByDate[date] = patients
    })

    const weekStarts = Array.from(new Set(dates.map(date => getMondayOfWeek(date))))
    const dayCapacityLimits: Record<string, number | null | undefined> = {}
    const weekPlans = await Promise.all(
      weekStarts.map(async weekStart => {
        const response = await fetch(`/api/weekplan?weekStart=${weekStart}`)
        if (!response.ok) return null
        return response.json()
      })
    )
    weekPlans.forEach(plan => {
      if (!plan?.dayCapacities) return
      plan.dayCapacities.forEach((entry: any) => {
        if (entry?.date && entry.agreedMaxPatients !== undefined) {
          dayCapacityLimits[entry.date] = entry.agreedMaxPatients
        }
      })
    })

    const defaultSchedule = buildScheduleFromWorkDays(staffMembers)
    const staffMembersByDate: Record<string, StaffMember[]> = {}
    const coordinatorByDate: Record<string, string | null> = {}

    dates.forEach(date => {
      const weekStart = getMondayOfWeek(date)
      const plan = weekPlans.find(p => p?.weekStartDate === weekStart || p?.weekStart === weekStart)
      const schedule: Record<string, string[]> = { ...defaultSchedule }
      const coordinators: Record<string, string | null> = { ...coordinatorByDay }
      if (plan?.staffSchedules) {
        plan.staffSchedules.forEach((s: any) => {
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
      }
      const day = getDayOfWeekFromDate(date)
      const names = schedule[day] || []
      const coordinatorName = coordinators[day] || null
      const allNames = coordinatorName && !names.includes(coordinatorName)
        ? [...names, coordinatorName]
        : names
      staffMembersByDate[date] = allNames.length > 0 ? staffMembers.filter(member => allNames.includes(member.name)) : []
      coordinatorByDate[date] = coordinatorName
    })

    return { existingPatientsByDate, dayCapacityLimits, staffMembersByDate, coordinatorByDate }
  }

  const handleAutoSchedule = async () => {
    if (selectedDates.length === 0) {
      setScheduleError('Selecteer eerst één of meerdere datums.')
      return
    }

    const treatmentRequests = buildTreatmentRequests()
    if (treatmentRequests.length === 0) {
      setScheduleError('Selecteer eerst behandelingen om in te plannen.')
      return
    }

    setIsScheduling(true)
    setScheduleError('')
    setScheduleResult([])
    setScheduleSkipped([])

    try {
      const {
        existingPatientsByDate,
        dayCapacityLimits,
        staffMembersByDate,
        coordinatorByDate
      } = await buildSchedulingContext(selectedDates)

      const freshCapacity = await refreshCapacity(selectedDates)
      const normalizedDayCapacityLimits = { ...dayCapacityLimits }
      const plannedOverrides: Record<string, number> = {}
      selectedDates.forEach(date => {
        if (typeof normalizedDayCapacityLimits[date] === 'number') return
        const status = freshCapacity[date] || capacityStatus[date]
        if (status && typeof status.max === 'number') {
          normalizedDayCapacityLimits[date] = status.max
        }
      })
      Object.entries(freshCapacity).forEach(([date, status]) => {
        if (status && typeof status.planned === 'number') {
          plannedOverrides[date] = status.planned
        }
      })

      const requestedCount = countRequestedTreatments(treatmentRequests)
      const overbookByDate = await requestOverbookByDate(
        selectedDates,
        requestedCount,
        existingPatientsByDate,
        normalizedDayCapacityLimits,
        plannedOverrides
      )

      const plan = scheduleTreatmentsAcrossDates(
        selectedDates,
        treatmentRequests,
        staffMembersByDate,
        coordinatorByDate,
        existingPatientsByDate,
        normalizedDayCapacityLimits,
        overbookByDate
      )

      const medications = getAllMedications()
      const scheduledDisplay: Array<{ date: string; startTime: string; label: string; medicationId?: string; treatmentNumber?: number; patientId?: string }> = []
      const skippedDisplay: Array<{ label: string; reason: string }> = []
      const scheduledPatientIds: string[] = []

      for (const item of plan.scheduled) {
        const medication = medications.find(med => med.id === item.medicationId)
        const label = `${medication?.displayName || item.medicationId} (${item.treatmentNumber}e)`
        const patientName = `Patiënt - ${label}`

        const patientResponse = await fetch('/api/patients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: patientName,
            startTime: item.startTime,
            scheduledDate: item.date,
            medicationType: item.medicationId,
            treatmentNumber: item.treatmentNumber
          })
        })

        if (!patientResponse.ok) {
          skippedDisplay.push({ label, reason: 'Kon patiënt niet aanmaken' })
          continue
        }

        const patient = await patientResponse.json()
        for (const action of item.actions) {
          await fetch('/api/actions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: action.name,
              duration: action.duration,
              staff: action.staff,
              type: action.type,
              actualDuration: action.actualDuration,
              patientId: patient.id
            })
          })
        }

        scheduledPatientIds.push(patient.id)
        scheduledDisplay.push({
          date: item.date,
          startTime: item.startTime,
          label,
          medicationId: item.medicationId,
          treatmentNumber: item.treatmentNumber,
          patientId: patient.id
        })
      }

      plan.skipped.forEach(item => {
        const medication = medications.find(med => med.id === item.medicationId)
        const label = `${medication?.displayName || item.medicationId} (${item.treatmentNumber}e)`
        skippedDisplay.push({ label, reason: item.reason })
      })

      scheduledDisplay.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        return a.startTime.localeCompare(b.startTime)
      })

      setScheduleResult(scheduledDisplay)
      setScheduleSkipped(skippedDisplay)
      const groupId = `${Date.now()}`
      setPlanGroups(prev => ([
        {
          id: groupId,
          createdAt: new Date().toISOString(),
          selectedDates: [...selectedDates],
          requests: treatmentRequests,
          scheduled: scheduledDisplay,
          skipped: skippedDisplay,
          patientIds: scheduledPatientIds
        },
        ...prev
      ]))
      setCollapsedPlanGroups(prev => ({
        ...prev,
        [groupId]: true
      }))
      try {
        localStorage.setItem('scheduledTreatments', JSON.stringify(scheduledDisplay))
      } catch (error) {
        console.error('Failed to save scheduled treatments', error)
      }

      if (plan.skipped.length > 0) {
        const remainingByType: Record<string, number> = {}
        plan.skipped.forEach(item => {
          const key = `${item.medicationId}-${item.treatmentNumber}`
          remainingByType[key] = (remainingByType[key] || 0) + 1
        })
        setTreatmentCounts(() => {
          const next: Record<string, number> = {}
          treatments.forEach(treatment => {
            const typeKey = `${treatment.medicationId}-${treatment.treatmentNumber}`
            const remaining = remainingByType[typeKey] ?? 0
            if (remaining > 0) {
              next[treatment.id] = remaining
            }
          })
          return Object.keys(next).length > 0 ? next : {}
        })
        setSelectionWarning('Niet alles kon ingepland worden. Selecteer extra datums om verder te plannen.')
        setSaveMessage('')
      } else {
        setSelectedDates([])
        setTreatmentCounts({})
        setSelectionWarning('')
        setSaveMessage('')
      }
      await refreshCapacity(selectedDates)
    } catch (error) {
      console.error('Failed to auto schedule treatments', error)
      setScheduleError('Automatisch inplannen mislukt.')
    } finally {
      setIsScheduling(false)
    }
  }

  const handleRescheduleGroup = async (groupId: string) => {
    const group = planGroups.find(item => item.id === groupId)
    if (!group) return
    if (!group.requests || group.requests.length === 0) {
      setScheduleError('Deze plangroep heeft geen opgeslagen behandelingen om opnieuw in te plannen.')
      return
    }

    setIsScheduling(true)
    setScheduleError('')
    setScheduleResult([])
    setScheduleSkipped([])

    try {
      if (group.patientIds && group.patientIds.length > 0) {
        await fetch('/api/patients/bulk-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: group.patientIds })
        })
      }

      const {
        existingPatientsByDate,
        dayCapacityLimits,
        staffMembersByDate,
        coordinatorByDate
      } = await buildSchedulingContext(group.selectedDates)

      const freshCapacity = await refreshCapacity(group.selectedDates)
      const normalizedDayCapacityLimits = { ...dayCapacityLimits }
      const plannedOverrides: Record<string, number> = {}
      group.selectedDates.forEach(date => {
        if (typeof normalizedDayCapacityLimits[date] === 'number') return
        const status = freshCapacity[date] || capacityStatus[date]
        if (status && typeof status.max === 'number') {
          normalizedDayCapacityLimits[date] = status.max
        }
      })
      Object.entries(freshCapacity).forEach(([date, status]) => {
        if (status && typeof status.planned === 'number') {
          plannedOverrides[date] = status.planned
        }
      })

      const requestedCount = countRequestedTreatments(group.requests)
      const overbookByDate = await requestOverbookByDate(
        group.selectedDates,
        requestedCount,
        existingPatientsByDate,
        normalizedDayCapacityLimits,
        plannedOverrides
      )

      const plan = scheduleTreatmentsAcrossDates(
        group.selectedDates,
        group.requests,
        staffMembersByDate,
        coordinatorByDate,
        existingPatientsByDate,
        normalizedDayCapacityLimits,
        overbookByDate
      )

      const medications = getAllMedications()
      const scheduledDisplay: Array<{ date: string; startTime: string; label: string; medicationId?: string; treatmentNumber?: number; patientId?: string }> = []
      const skippedDisplay: Array<{ label: string; reason: string }> = []
      const scheduledPatientIds: string[] = []

      for (const item of plan.scheduled) {
        const medication = medications.find(med => med.id === item.medicationId)
        const label = `${medication?.displayName || item.medicationId} (${item.treatmentNumber}e)`
        const patientName = `Patiënt - ${label}`

        const patientResponse = await fetch('/api/patients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: patientName,
            startTime: item.startTime,
            scheduledDate: item.date,
            medicationType: item.medicationId,
            treatmentNumber: item.treatmentNumber
          })
        })

        if (!patientResponse.ok) {
          skippedDisplay.push({ label, reason: 'Kon patiënt niet aanmaken' })
          continue
        }

        const patient = await patientResponse.json()
        for (const action of item.actions) {
          await fetch('/api/actions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: action.name,
              duration: action.duration,
              staff: action.staff,
              type: action.type,
              actualDuration: action.actualDuration,
              patientId: patient.id
            })
          })
        }

        scheduledPatientIds.push(patient.id)
        scheduledDisplay.push({
          date: item.date,
          startTime: item.startTime,
          label,
          medicationId: item.medicationId,
          treatmentNumber: item.treatmentNumber,
          patientId: patient.id
        })
      }

      plan.skipped.forEach(item => {
        const medication = medications.find(med => med.id === item.medicationId)
        const label = `${medication?.displayName || item.medicationId} (${item.treatmentNumber}e)`
        skippedDisplay.push({ label, reason: item.reason })
      })

      scheduledDisplay.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        return a.startTime.localeCompare(b.startTime)
      })

      setScheduleResult(scheduledDisplay)
      setScheduleSkipped(skippedDisplay)
      setPlanGroups(prev => prev.map(item => (
        item.id === groupId
          ? {
              ...item,
              scheduled: scheduledDisplay,
              skipped: skippedDisplay,
              patientIds: scheduledPatientIds
            }
          : item
      )))
      try {
        localStorage.setItem('scheduledTreatments', JSON.stringify(scheduledDisplay))
      } catch (error) {
        console.error('Failed to save scheduled treatments', error)
      }
      await refreshCapacity(group.selectedDates)
    } catch (error) {
      console.error('Failed to reschedule plan group', error)
      setScheduleError('Opnieuw inplannen mislukt.')
    } finally {
      setIsScheduling(false)
    }
  }

  const incrementTreatment = (treatmentId: string) => {
    if (selectedDates.length === 0) {
      setSelectionWarning('Selecteer eerst één of meerdere datums in de agenda.')
      return
    }
    setSelectionWarning('')
    setSaveMessage('')
    setSaveError('')
    setTreatmentCounts(prev => ({
      ...prev,
      [treatmentId]: (prev[treatmentId] || 0) + 1
    }))
  }

  const decrementTreatment = (treatmentId: string) => {
    if (selectedDates.length === 0) {
      setSelectionWarning('Selecteer eerst één of meerdere datums in de agenda.')
      return
    }
    setSelectionWarning('')
    setSaveMessage('')
    setSaveError('')
    setTreatmentCounts(prev => {
      const next = { ...prev }
      const currentCount = next[treatmentId] || 0
      if (currentCount <= 1) {
        delete next[treatmentId]
      } else {
        next[treatmentId] = currentCount - 1
      }
      return next
    })
  }

  const visibleScheduleResult = useMemo(() => {
    if (selectedDates.length === 0) return []
    return scheduleResult.filter(item => selectedSet.has(item.date))
  }, [scheduleResult, selectedDates, selectedSet])

  const handleOverbookCancel = () => {
    setOverbookModal(prev => ({ ...prev, isOpen: false, error: '' }))
    const resolver = overbookResolverRef.current
    overbookResolverRef.current = null
    if (resolver) resolver({})
  }

  const handleOverbookConfirm = () => {
    const values = overbookModal.values
    const parsed: Record<string, number> = {}
    let total = 0
    overbookModal.dates.forEach(date => {
      const raw = values[date]
      const amount = parseInt(raw, 10)
      const safe = Number.isFinite(amount) ? Math.max(amount, 0) : 0
      parsed[date] = safe
      total += safe
    })

    if (total <= 0) {
      setOverbookModal(prev => ({ ...prev, error: 'Geef minimaal 1 behandeling op of annuleer.' }))
      return
    }
    if (total > overbookModal.overflow) {
      setOverbookModal(prev => ({ ...prev, error: `Maximaal ${overbookModal.overflow} boven capaciteit toegestaan.` }))
      return
    }

    setOverbookModal(prev => ({ ...prev, isOpen: false, error: '' }))
    const resolver = overbookResolverRef.current
    overbookResolverRef.current = null
    if (resolver) resolver(parsed)
  }

  return (
    !isMounted ? (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex items-center justify-center text-sm text-slate-500">
        Laden...
      </div>
    ) : (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
      <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Behandelingen</h2>
          <p className="text-xs text-slate-600 mt-1">Selecteer datums en kies behandelingen om te koppelen.</p>
        </div>
        {selectedDates.length > 0 && (
          <div className="text-xs text-slate-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-full">
            {selectedDates.length} datum(s) geselecteerd • {totalSelectedTreatments} behandeling(en)
            {capacitySummary ? ` • ${capacitySummary}` : ''}
          </div>
        )}
      </div>

      {overbookModal.isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[10000] p-4"
          onClick={handleOverbookCancel}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-slate-50 border-b-2 border-slate-300 p-6 rounded-t-xl">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Boven capaciteit plannen</h3>
                  <p className="text-xs text-slate-600 mt-1">
                    Je zit {overbookModal.overflow} behandeling(en) boven de totale capaciteit. Verdeel de overschrijding per datum.
                  </p>
                </div>
                <button
                  onClick={handleOverbookCancel}
                  className="text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg p-2 transition-colors"
                  aria-label="Modal sluiten"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-3">
              <div className="grid grid-cols-[120px_1fr_80px] gap-2 text-xs font-semibold text-slate-500 uppercase">
                <span>Datum</span>
                <span>Capaciteit</span>
                <span>Boven</span>
              </div>
              <div className="space-y-2">
                {overbookModal.dates.map(date => (
                  <div key={date} className="grid grid-cols-[120px_1fr_80px] gap-2 items-center">
                    <div className="text-sm text-slate-700">{formatDateDMY(date)}</div>
                    <div className="text-sm text-slate-500">
                      {overbookModal.remainingByDate[date]} over (max {overbookModal.maxByDate[date]})
                    </div>
                    <input
                      type="number"
                      min={0}
                      value={overbookModal.values[date] ?? '0'}
                      onChange={(e) =>
                        setOverbookModal(prev => ({
                          ...prev,
                          values: { ...prev.values, [date]: e.target.value },
                          error: ''
                        }))
                      }
                      className="w-full px-2 py-1 rounded-md border border-slate-300 text-sm"
                    />
                  </div>
                ))}
              </div>
              {overbookModal.error && (
                <div className="text-xs text-red-700">{overbookModal.error}</div>
              )}
            </div>
            <div className="px-6 pb-6 flex gap-3 justify-end">
              <button
                onClick={handleOverbookCancel}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-semibold"
              >
                Annuleren
              </button>
              <button
                onClick={handleOverbookConfirm}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-sm font-semibold"
              >
                Bevestigen
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2 p-6 overflow-hidden items-start grid-flow-dense">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-3 h-fit w-full col-span-full sm:col-span-2 sm:row-span-5 sm:col-start-1 sm:row-start-1">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setMonthDate(new Date(currentYear, currentMonth - 1, 1))}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Vorige maand"
            >
              <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="font-bold text-sm text-slate-900">
              {monthNames[currentMonth]} {currentYear}
            </div>
            <button
              onClick={() => setMonthDate(new Date(currentYear, currentMonth + 1, 1))}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Volgende maand"
            >
              <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map(day => (
              <div key={day} className="text-center text-[10px] font-semibold text-slate-500 py-1">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 select-none">
            {days.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} className="aspect-square" />
              }
              const dateIso = getDateISO(day)
              const isSelected = previewSelectedSet.has(dateIso)
              const isToday = (() => {
                const d = new Date()
                return day === d.getDate() && currentMonth === d.getMonth() && currentYear === d.getFullYear()
              })()
              return (
                <button
                  key={day}
                  onPointerDown={() => {
                    const mode: DragMode = selectedSet.has(dateIso) ? 'remove' : 'add'
                    setDragMode(mode)
                    setDragStartDay(day)
                    setDragCurrentDay(day)
                    setIsDragging(true)
                  }}
                  onPointerEnter={() => {
                    if (!isDragging) return
                    setDragCurrentDay(day)
                  }}
                  className={`aspect-square rounded-lg text-sm font-semibold transition-all ${
                    isSelected
                      ? 'bg-blue-700 text-white shadow-md'
                      : isToday
                      ? 'bg-blue-50 text-blue-600 border-2 border-blue-300'
                      : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {selectionWarning && (
            <div className="mt-3 text-xs text-red-700">{selectionWarning}</div>
          )}
          {selectedDates.length > 0 && (
            <button
              onClick={handleTestSelectOverCapacity}
              className="mt-3 text-xs text-blue-700 hover:text-blue-800 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-full"
            >
              Test: selecteer 10 over capaciteit
            </button>
          )}
          {selectedDates.length > 0 && (
            <div className="mt-3 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-md p-2">
              <button
                onClick={() => setIsCapacityCollapsed(prev => !prev)}
                className="w-full flex items-center justify-between font-semibold text-slate-800"
              >
                <span>Capaciteit per geselecteerde datum</span>
                <span className="text-slate-500">{isCapacityCollapsed ? '▸' : '▾'}</span>
              </button>
              {!isCapacityCollapsed && (
                <div className="grid grid-cols-[110px_1fr] gap-2 mt-2">
                  {selectedDates.map(date => {
                    const status = capacityStatus[date]
                    if (!status) {
                      return (
                        <div key={date} className="contents">
                          <div>{formatDateDMY(date)}</div>
                          <div className="text-slate-500">Capaciteit laden...</div>
                        </div>
                      )
                    }
                    return (
                      <div key={date} className="contents">
                        <div>{formatDateDMY(date)}</div>
                        <div>
                          {status.max === null
                            ? `${status.planned} gepland • max onbekend`
                            : `${status.planned} gepland • ${status.planned} v/d ${status.max}`}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
          {visibleScheduleResult.length > 0 && (
            <div className="mt-3 text-xs text-slate-700 bg-emerald-50 border border-emerald-200 rounded-md p-2">
              <button
                onClick={() => setIsScheduleCollapsed(prev => !prev)}
                className="w-full flex items-center justify-between font-semibold text-emerald-800"
              >
                <span>Geplande behandelingen</span>
                <span className="text-emerald-600">{isScheduleCollapsed ? '▸' : '▾'}</span>
              </button>
              {!isScheduleCollapsed && (
                <div className="grid grid-cols-[110px_60px_1fr] gap-2 mt-2">
                  {visibleScheduleResult.map((item, index) => (
                    <div key={`${item.date}-${item.startTime}-${index}`} className="contents">
                      <div>{formatDateDMY(item.date)}</div>
                      <div>{item.startTime}</div>
                      <div>{item.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 overflow-hidden col-span-full sm:col-start-3 sm:col-end-[-1] sm:row-start-1 sm:row-end-[-1]">
          <div className="border border-slate-200 rounded-xl p-3 bg-white/80">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Plangroepen</h3>
              <span className="text-xs text-slate-500">{planGroups.length} gepland</span>
            </div>
            {planGroups.length === 0 ? (
              <div className="text-xs text-slate-500 mt-2">Nog geen plangroepen aangemaakt.</div>
            ) : (
              <div className="mt-3 space-y-3 max-h-[240px] overflow-auto pr-1">
                {planGroups.map(group => (
                  <div key={group.id} className="border border-slate-200 rounded-lg p-3 bg-white">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => setCollapsedPlanGroups(prev => ({ ...prev, [group.id]: !prev[group.id] }))}
                        className="flex items-center gap-2 text-xs font-semibold text-slate-700"
                      >
                        <span className="text-slate-500">{collapsedPlanGroups[group.id] ? '▸' : '▾'}</span>
                        Aangemaakt: {formatGroupTimestamp(group.createdAt)}
                      </button>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500">{group.selectedDates.length} datum(s)</span>
                        <button
                          onClick={() => handleRescheduleGroup(group.id)}
                          className="text-[11px] text-emerald-600 hover:text-emerald-700 disabled:text-slate-300"
                          disabled={isScheduling || !group.requests || group.requests.length === 0}
                        >
                          Opnieuw inplannen
                        </button>
                        <button
                          onClick={() => {
                            setPlanGroups(prev => prev.filter(item => item.id !== group.id))
                            setCollapsedPlanGroups(prev => {
                              const next = { ...prev }
                              delete next[group.id]
                              return next
                            })
                          }}
                          className="text-[11px] text-rose-600 hover:text-rose-700"
                        >
                          Verwijderen
                        </button>
                      </div>
                    </div>
                    {!collapsedPlanGroups[group.id] && (
                      <>
                        {group.scheduled.length > 0 ? (
                          <div className="mt-2 text-[11px] text-slate-700 grid grid-cols-[90px_60px_1fr] gap-2">
                            {group.scheduled.map((item, index) => (
                              <div key={`${group.id}-${item.date}-${item.startTime}-${index}`} className="contents">
                                <div>{item.date}</div>
                                <div>{item.startTime}</div>
                                <div>{item.label}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-400 mt-2">Geen behandelingen ingepland.</div>
                        )}
                        {group.skipped.length > 0 && (
                          <div className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                            <div className="font-semibold text-amber-800 mb-1">Niet ingepland</div>
                            {group.skipped.map((item, index) => (
                              <div key={`${group.id}-skip-${index}`}>{item.label} — {item.reason}</div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">Behandelingen selecteren</h3>
            <div className="flex items-center gap-3">
              {selectedDates.length > 0 && (
                <>
                  <button
                    onClick={() => {
                      setSelectedDates([])
                      setTreatmentCounts({})
                      setSelectionWarning('')
                      setSaveMessage('')
                      setSaveError('')
                    }}
                    className="text-xs text-slate-600 hover:text-slate-900"
                  >
                    Selectie wissen
                  </button>
                </>
              )}
              <button
                onClick={handleAutoSchedule}
                className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1 rounded-md"
                disabled={isScheduling}
              >
                {isScheduling ? 'Inplannen...' : 'Automatisch inplannen'}
              </button>
            </div>
          </div>
          {saveMessage && (
            <div className="text-xs text-green-700">{saveMessage}</div>
          )}
          {saveError && (
            <div className="text-xs text-red-700">{saveError}</div>
          )}
          {scheduleError && (
            <div className="text-xs text-red-700">{scheduleError}</div>
          )}
          {scheduleSkipped.length > 0 && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
              <div className="font-semibold text-amber-800 mb-1">Niet ingepland</div>
              <div className="space-y-1">
                {scheduleSkipped.map((item, index) => (
                  <div key={`${item.label}-${index}`}>{item.label} — {item.reason}</div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-1.5 overflow-auto">
            {treatments.map(treatment => {
              const badgeCount = activeDateForBadge
                ? treatmentCounts[treatment.id] || 0
                : 0
              const accent = colorClasses[treatment.color] || colorClasses.slate
              return (
                <button
                  key={treatment.id}
                  onClick={() => incrementTreatment(treatment.id)}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    decrementTreatment(treatment.id)
                  }}
                  className={`relative text-left border rounded-md p-1.5 transition-colors shadow-sm ${accent}`}
                >
                  <div className="font-semibold text-[11px] leading-tight">{treatment.displayName}</div>
                  <div className="text-[10px] mt-0.5">{treatment.label}</div>
                  <div className="text-[9px] mt-1">{treatment.totalMinutes} min</div>
                  {badgeCount > 0 && (
                    <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-blue-700 text-white text-[9px] font-bold flex items-center justify-center">
                      {badgeCount}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
    )
  )
}
