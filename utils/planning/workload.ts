import { Patient, WorkloadSlot, OptimizationSuggestion, DEPARTMENT_CONFIG } from '@/types'
import { calculateTotalTreatmentTime } from '../patients/actionGenerator'

export function calculateWorkloadByTimeSlot(patients: Patient[]): WorkloadSlot[] {
  const slots: WorkloadSlot[] = []
  const startHour = DEPARTMENT_CONFIG.START_HOUR
  const endHour = DEPARTMENT_CONFIG.END_HOUR

  // Create 15-minute slots
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += 15) {
      const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
      slots.push({
        time,
        count: 0,
        patients: []
      })
    }
  }

  // Calculate workload
  patients.forEach(patient => {
    const [startHours, startMinutes] = patient.startTime.split(':').map(Number)
    const patientStartMinutes = startHours * 60 + startMinutes
    const totalDuration = patient.actions && patient.actions.length > 0
      ? patient.actions.reduce((sum, action) => sum + action.duration, 0)
      : calculateTotalTreatmentTime(patient.medicationType, patient.treatmentNumber)
    const patientEndMinutes = patientStartMinutes + totalDuration

    slots.forEach(slot => {
      const [slotHours, slotMinutes] = slot.time.split(':').map(Number)
      const slotStartMinutes = slotHours * 60 + slotMinutes
      const slotEndMinutes = slotStartMinutes + 15

      if (patientStartMinutes < slotEndMinutes && patientEndMinutes > slotStartMinutes) {
        slot.count++
        slot.patients.push(patient.name)
      }
    })
  })

  return slots
}

export function getTotalDuration(patient: Patient): number {
  return patient.actions.reduce((sum, action) => sum + action.duration, 0)
}

export function generateOptimizationSuggestions(
  workload: WorkloadSlot[],
  patients: Patient[]
): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = []
  const activeWorkload = workload.filter(w => w.count > 0)

  if (activeWorkload.length === 0) return suggestions

  const MAX_CHAIRS = DEPARTMENT_CONFIG.TOTAL_CHAIRS
  const STAFF_COUNT = DEPARTMENT_CONFIG.STAFF_COUNT
  const TARGET_EFFICIENCY = 0.75 // 75% bezetting is optimaal
  
  // 1. STOELEN CAPACITEIT ANALYSE
  const maxOccupancy = Math.max(...activeWorkload.map(w => w.count))
  const capacityUsage = (maxOccupancy / MAX_CHAIRS) * 100
  const overCapacitySlots = activeWorkload.filter(w => w.count > MAX_CHAIRS)
  
  if (overCapacitySlots.length > 0) {
    const overCapacityTimes = overCapacitySlots.map(s => `${s.time} (${s.count}/${MAX_CHAIRS})`).slice(0, 3).join(', ')
    const totalOverCapacity = overCapacitySlots.reduce((sum, s) => sum + (s.count - MAX_CHAIRS), 0)
    suggestions.push({
      type: '🚨 CAPACITEITSOVERSCHRIJDING',
      text: `KRITIEK: Stoelencapaciteit overschreden op ${overCapacitySlots.length} momenten (${overCapacityTimes}${overCapacitySlots.length > 3 ? '...' : ''}). ${totalOverCapacity} patiënt(en) hebben geen stoel. Onmiddellijk ${totalOverCapacity} patiënten verplaatsen.`
    })
  } else if (maxOccupancy > MAX_CHAIRS * 0.85) {
    const highOccupancySlots = activeWorkload.filter(w => w.count >= MAX_CHAIRS * 0.85)
    suggestions.push({
      type: '⚠️ HOGE STOELENBEZETTING',
      text: `Capaciteit bijna bereikt: ${maxOccupancy}/${MAX_CHAIRS} stoelen bezet (${capacityUsage.toFixed(0)}%). Op ${highOccupancySlots.length} momenten >85% bezetting. Risico op wachttijden. Buffer van 2-3 stoelen aanbevolen.`
    })
  }

  // 2. PERSONEELSBELASTING ANALYSE
  const totalWorkMinutes = patients.reduce((sum, p) => {
    // Tel alleen VPK taken (niet systeem/observatie)
    return sum + p.actions
      .filter(a => a.staff && a.staff !== 'Systeem' && a.staff !== 'Geen')
      .reduce((actionSum, a) => actionSum + (a.actualDuration || a.duration), 0)
  }, 0)
  
  const workDayMinutes = (DEPARTMENT_CONFIG.END_HOUR - DEPARTMENT_CONFIG.START_HOUR) * 60
  const availableStaffMinutes = STAFF_COUNT * workDayMinutes
  const staffUtilization = (totalWorkMinutes / availableStaffMinutes) * 100
  
  if (staffUtilization > 90) {
    suggestions.push({
      type: '🔴 PERSONEELSOVERBELASTING',
      text: `KRITIEK: VPK bezetting ${staffUtilization.toFixed(0)}% (${totalWorkMinutes} min werk / ${availableStaffMinutes} min beschikbaar). Werk niet haalbaar binnen 8 uur. Verminder ${Math.ceil((totalWorkMinutes - availableStaffMinutes * 0.85) / 60)} uur aan taken of voeg extra VPK toe.`
    })
  } else if (staffUtilization > 75) {
    suggestions.push({
      type: '🟡 HOGE PERSONEELSDRUK',
      text: `VPK bezetting ${staffUtilization.toFixed(0)}% (${totalWorkMinutes} min / ${availableStaffMinutes} min). Weinig buffer voor pauzes/urgentie. Optimaal: 65-75%. Overweeg ${Math.ceil((totalWorkMinutes - availableStaffMinutes * 0.70) / 60)} uur te verplaatsen naar rustigere dag.`
    })
  } else if (staffUtilization < 50) {
    const underutilizedMinutes = (availableStaffMinutes * 0.65) - totalWorkMinutes
    suggestions.push({
      type: '📊 ONDERBEZETTING PERSONEEL',
      text: `VPK bezetting slechts ${staffUtilization.toFixed(0)}%. Er zijn ${Math.floor(underutilizedMinutes / 60)} uur capaciteit onbenut. Mogelijkheid om ${Math.floor(underutilizedMinutes / 45)} extra patiënten (gem. 45 min) in te plannen. Capaciteit: ${Math.ceil(patients.length / TARGET_EFFICIENCY)} patiënten haalbaar.`
    })
  }

  // 3. PIEK DRUKTE ANALYSE MET CONCRETE VERPLAATSINGSVOORSTELLEN
  const peakSlots = activeWorkload.filter(w => w.count > MAX_CHAIRS * TARGET_EFFICIENCY).sort((a, b) => b.count - a.count)
  
  if (peakSlots.length > 0) {
    const peakHours = new Set(peakSlots.map(s => s.time.split(':')[0]))
    const peakTimeRanges = Array.from(peakHours).map(h => `${h}:00-${h}:59`).slice(0, 3).join(', ')
    
    // Vind rustige slots voor verplaatsing
    const quietSlots = activeWorkload.filter(w => w.count < MAX_CHAIRS * 0.4).sort((a, b) => a.count - b.count)
    
    if (quietSlots.length > 0) {
      const quietTimes = quietSlots.slice(0, 3).map(s => s.time).join(', ')
      const patientsToMove = Math.ceil(peakSlots.reduce((sum, s) => sum + Math.max(0, s.count - MAX_CHAIRS * TARGET_EFFICIENCY), 0))
      
      suggestions.push({
        type: '📈 PIEK OPTIMALISATIE',
        text: `Piekdrukte ${peakTimeRanges}: gemiddeld ${(peakSlots.reduce((s, p) => s + p.count, 0) / peakSlots.length).toFixed(1)} patiënten/slot (ideaal: ${Math.floor(MAX_CHAIRS * TARGET_EFFICIENCY)}). Verplaats ${patientsToMove} patiënten naar rustige momenten: ${quietTimes}. Verwachte verbetering: -${Math.ceil((1 - TARGET_EFFICIENCY) * 100)}% piekcapaciteit.`
      })
    }
  }

  // 4. OCHTEND VS MIDDAG BALANS (KOFFIE/LUNCH IMPACT)
  const morningSlots = activeWorkload.filter(w => {
    const hour = parseInt(w.time.split(':')[0])
    return hour >= 8 && hour < 12
  })
  const afternoonSlots = activeWorkload.filter(w => {
    const hour = parseInt(w.time.split(':')[0])
    return hour >= 13 && hour < 16
  })

  const morningPatients = new Set(morningSlots.flatMap(s => s.patients)).size
  const afternoonPatients = new Set(afternoonSlots.flatMap(s => s.patients)).size
  const morningLoad = morningSlots.reduce((sum, w) => sum + w.count, 0)
  const afternoonLoad = afternoonSlots.reduce((sum, w) => sum + w.count, 0)
  
  const imbalance = Math.abs(morningPatients - afternoonPatients)
  
  if (imbalance > patients.length * 0.3) {
    const busierPeriod = morningPatients > afternoonPatients ? 'ochtend (08:00-12:00)' : 'middag (13:00-16:00)'
    const quieterPeriod = morningPatients > afternoonPatients ? 'middag (13:00-16:00)' : 'ochtend (08:00-12:00)'
    const busierCount = Math.max(morningPatients, afternoonPatients)
    const quieterCount = Math.min(morningPatients, afternoonPatients)
    
    suggestions.push({
      type: '⚖️ DAG BALANS',
      text: `Ongelijke verdeling: ${busierCount} patiënten ${busierPeriod} vs ${quieterCount} ${quieterPeriod} (verschil: ${imbalance}). Verplaats ${Math.ceil(imbalance / 2)} patiënten naar ${quieterPeriod} voor betere spreiding. Let op: pauzes 10:00-10:30 (koffie) en 12:00-13:00 (lunch) = geen nieuwe starts.`
    })
  }

  // 5. EFFICIENCY SCORE & KOSTEN INDICATIE
  const idealPatients = Math.floor(availableStaffMinutes * TARGET_EFFICIENCY / 60) // Gem 60 min per patiënt
  const efficiencyScore = Math.min(100, (patients.length / idealPatients) * 100)
  const avgOccupancy = activeWorkload.reduce((sum, w) => sum + w.count, 0) / activeWorkload.length
  const chairEfficiency = (avgOccupancy / MAX_CHAIRS) * 100
  
  suggestions.push({
    type: '💰 EFFICIENCY RAPPORTAGE',
    text: `Dagcapaciteit: ${patients.length}/${idealPatients} patiënten (${efficiencyScore.toFixed(0)}% efficiency). Stoelen: ${avgOccupancy.toFixed(1)}/${MAX_CHAIRS} gem bezet (${chairEfficiency.toFixed(0)}%). Personeel: ${staffUtilization.toFixed(0)}% benut. Optimale range: 65-85%. ${efficiencyScore < 70 ? `Potentieel: ${idealPatients - patients.length} extra patiënten mogelijk.` : efficiencyScore > 90 ? 'WAARSCHUWING: Overbelast systeem.' : 'Goede balans.'}`
  })

  // 6. BREAK TIME IMPACT
  const breakTimePeriods = [
    { start: 10, end: 10.5, name: 'koffiepauze (10:00-10:30)' },
    { start: 12, end: 13, name: 'lunchpauze (12:00-13:00)' }
  ]
  
  breakTimePeriods.forEach(period => {
    const duringBreak = activeWorkload.filter(w => {
      const hour = parseInt(w.time.split(':')[0])
      const minute = parseInt(w.time.split(':')[1])
      const timeDecimal = hour + minute / 60
      return timeDecimal >= period.start && timeDecimal < period.end
    })
    
    if (duringBreak.length > 0 && duringBreak.some(s => s.count > 0)) {
      const patientsPresent = new Set(duringBreak.flatMap(s => s.patients)).size
      suggestions.push({
        type: '☕ PAUZE IMPACT',
        text: `Tijdens ${period.name} zijn ${patientsPresent} patiënten aanwezig (lopende infusies + checks mogelijk). Nieuwe starts zijn geblokkeerd. Overweeg langdurende behandelingen vóór pauzes te starten om capaciteit na pauze vrij te maken.`
      })
    }
  })

  return suggestions.slice(0, 6) // Max 6 suggesties tonen
}
