import { MEDICATIONS, STAFF_MEMBERS, DEPARTMENT_CONFIG } from '@/types'

interface SimulatedPatient {
  name: string
  startTime: string
  medicationId: string
  treatmentNumber: number
}

const PATIENT_NAMES = [
  'Emma de Vries',
  'Lucas van Dam',
  'Sophie Jansen',
  'Daan Bakker',
  'Mila Peters',
  'Noah Visser',
  'Lotte de Jong',
  'Sem Mulder',
  'Julia van Dijk',
  'Finn de Groot',
  'Saar Hendriks',
  'Max Vermeer',
  'Eva Smit',
  'Thijs Boer',
  'Lisa de Wit',
]

/**
 * Select medication with realistic distribution based on real-world frequencies
 * - 40% Infliximab 7e+ keer (treatment 4)
 * - 10% Zometa
 * - 10% Ocrelizumab
 * - 5% Aderlating
 * - 35% Rest (distributed among other medications)
 */
function selectRealisticMedication(): { medicationId: string, treatmentNumber: number } {
  const random = Math.random() * 100
  
  // 40% - Infliximab 7e+ keer (treatment 4)
  if (random < 40) {
    // Randomly choose between 5mg and 10mg
    const medicationId = Math.random() < 0.5 ? 'infliximab_5mg' : 'infliximab_10mg'
    return { medicationId, treatmentNumber: 4 } // 7e+ keer
  }
  
  // 10% - Zometa (40-50%)
  if (random < 50) {
    return { medicationId: 'zoledroninezuur', treatmentNumber: 1 }
  }
  
  // 10% - Ocrelizumab (50-60%)
  if (random < 60) {
    // Randomly choose between schema 1, 2, or 3
    const schemas = ['ocrelizumab_schema1', 'ocrelizumab_schema2', 'ocrelizumab_schema3']
    const medicationId = schemas[Math.floor(Math.random() * schemas.length)]
    return { medicationId, treatmentNumber: 1 }
  }
  
  // 5% - Aderlating (60-65%)
  if (random < 65) {
    // Randomly choose between regular or with infusion
    const medicationId = Math.random() < 0.7 ? 'aderlating' : 'aderlating_infuus'
    return { medicationId, treatmentNumber: 1 }
  }
  
  // 35% - Rest (65-100%) - distributed among other medications
  // EXCLUDE subcutane injecties (no infusion) - deze horen niet op infuusafdeling
  const otherMedications = MEDICATIONS.filter(m => {
    // Skip already covered medications
    if (m.id.startsWith('infliximab')) return false
    if (m.id === 'zoledroninezuur') return false
    if (m.id.startsWith('ocrelizumab')) return false
    if (m.id.startsWith('aderlating')) return false
    
    // SKIP subcutane injecties (infusionTime = 0) - geen infuus behandeling
    if (m.id === 'natalizumab_sc') return false
    
    // Check if medication has actual infusion time
    const hasInfusion = m.variants.some(v => v.timing.infusionTime > 0)
    return hasInfusion
  })
  
  const medication = otherMedications[Math.floor(Math.random() * otherMedications.length)]
  
  // Random treatment number based on available variants
  const availableTreatmentNumbers = medication.variants.map(v => v.treatmentNumber)
  const treatmentNumber = availableTreatmentNumbers[
    Math.floor(Math.random() * availableTreatmentNumbers.length)
  ]
  
  return { medicationId: medication.id, treatmentNumber }
}

export function generateSimulationData(): SimulatedPatient[] {
  const patients: SimulatedPatient[] = []
  const usedNames = new Set<string>()
  
  // Generate time slots every 30 minutes from 08:30 to 14:00
  // PRIKKEN BEGINT OM 8:30 (niet 8:00!)
  // SKIP break times: 10:00-10:30 (coffee) and 12:00-13:00 (lunch)
  const timeSlots: string[] = []
  for (let hour = DEPARTMENT_CONFIG.START_HOUR; hour < DEPARTMENT_CONFIG.END_HOUR - 2; hour++) {
    // Skip 8:00 - prikken begint pas om 8:30
    if (hour === 8) {
      timeSlots.push('08:30')
    } else if (hour !== 10 && hour !== 12) {
      // Normal slots (skip 10:00 and 12:00)
      timeSlots.push(`${hour.toString().padStart(2, '0')}:00`)
      timeSlots.push(`${hour.toString().padStart(2, '0')}:30`)
    } else if (hour === 10) {
      // Only allow 10:30 (after coffee break)
      timeSlots.push(`${hour.toString().padStart(2, '0')}:30`)
    }
    // Skip entire hour 12 (lunch break 12:00-13:00)
  }
  
  // Generate MANY patients (60-75) to ensure we get 29-31 ADDED after filtering
  // Many will be skipped/rescheduled due to chair capacity, closing time, 30 min prep time, etc.
  // With stricter rules, we need to generate MORE to hit 29-31 target
  const targetPatients = Math.floor(Math.random() * 16) + 60 // 60-75 generated
  const totalSlots = timeSlots.length
  const avgPatientsPerSlot = targetPatients / totalSlots
  
  // Distribute patients evenly across slots to reach target
  // Each slot can have MAX 3 patients (3 nurses, each can do 1 setup per 30 min)
  let remainingPatients = targetPatients
  const maxPerSlot = DEPARTMENT_CONFIG.MAX_CONCURRENT_INFUSIONS // 3
  
  // First pass: distribute evenly (most slots get 2 patients)
  const basePerSlot = Math.floor(targetPatients / totalSlots)
  const extraPatients = targetPatients % totalSlots
  
  timeSlots.forEach((timeSlot, index) => {
    // Calculate how many patients for this slot
    // Give some slots an extra patient to reach target
    let patientsInSlot = basePerSlot
    
    if (index < extraPatients) {
      patientsInSlot++ // Distribute remaining patients across early slots
    }
    
    // Never exceed capacity
    patientsInSlot = Math.min(patientsInSlot, maxPerSlot)
    patientsInSlot = Math.min(patientsInSlot, remainingPatients)
    
    // Add patients for this slot
    for (let i = 0; i < patientsInSlot; i++) {
      // Random patient name
      let name = PATIENT_NAMES[Math.floor(Math.random() * PATIENT_NAMES.length)]
      let attempts = 0
      while (usedNames.has(name) && attempts < 50) {
        name = PATIENT_NAMES[Math.floor(Math.random() * PATIENT_NAMES.length)]
        attempts++
      }
      if (attempts >= 50) {
        // Generate unique name if we run out
        name = `${PATIENT_NAMES[Math.floor(Math.random() * PATIENT_NAMES.length)]} ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`
      }
      usedNames.add(name)
      
      // Realistische medicatie verdeling
      const { medicationId, treatmentNumber } = selectRealisticMedication()
      
      patients.push({
        name,
        startTime: timeSlot,
        medicationId,
        treatmentNumber
      })
      
      remainingPatients--
      
      if (remainingPatients <= 0) break
    }
    
    if (remainingPatients <= 0) return
  })
  
  // Sort by start time
  return patients.sort((a, b) => a.startTime.localeCompare(b.startTime))
}

// Export for backward compatibility - now uses actionGenerator
export { generateActionsForMedication as generateCheckActions } from './actionGenerator'

