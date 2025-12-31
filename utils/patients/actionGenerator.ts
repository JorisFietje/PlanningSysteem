import { getMedicationById, getMedicationVariant, isCheckDisabledMedication, Medication, MedicationVariant } from '@/types/medications'

export interface GeneratedAction {
  name: string
  duration: number
  type: 'setup' | 'infusion' | 'check' | 'removal' | 'observation' | 'flush' | 'pc_switch' | 'custom' | 'custom_nurse'
  actualDuration?: number
  checkOffset?: number // For checks and PC switches: minutes from START OF INFUSION (not patient start)
  description?: string
}

const isNurseType = (type?: string) => {
  return (
    type === 'setup' ||
    type === 'check' ||
    type === 'flush' ||
    type === 'removal' ||
    type === 'custom_nurse'
  )
}

export function generateActionsForMedication(
  medicationId: string,
  treatmentNumber: number
): GeneratedAction[] {
  const medication = getMedicationById(medicationId)
  if (!medication) {
    console.error(`Medication not found: ${medicationId}`)
    return []
  }

  const variant = getMedicationVariant(medicationId, treatmentNumber)
  if (!variant) {
    console.error(`No variant found for treatment number: ${treatmentNumber}`)
    return []
  }

  if (variant.actions && variant.actions.length > 0) {
    return [...variant.actions]
      .filter(action => action.type !== 'protocol_check')
      .sort((a, b) => (a.startOffset ?? 0) - (b.startOffset ?? 0))
      .map((action) => {
        const rawType = (action.type as GeneratedAction['type']) || 'custom'
        const mappedType = action.nurseAction && rawType === 'custom' ? 'custom_nurse' : rawType
        return {
          name: action.name,
          duration: action.duration,
          type: mappedType,
          description: action.type ? `${action.type} (${action.duration} min)` : `${action.duration} min`,
          checkOffset: undefined
        }
      })
  }

  const actions: GeneratedAction[] = []
  const timing = variant.timing

  // Check if this is actually an infusion (not SC injection)
  const isInfusion = timing.infusionTime > 0
  
  if (!isInfusion) {
    // For SC injections or medications without infusion - NOT suitable for infusion department
    console.warn(`⚠️ Medication ${medication.displayName} has no infusion time - not suitable for infusion department simulation`)
    
    // Generate minimal actions for SC injection
    actions.push({
      name: `${medication.displayName} Toedienen (SC)`,
      duration: timing.vpkTime || 15,
      type: 'setup',
      description: `Subcutane injectie toedienen (${timing.vpkTime || 15} min)`
    })
    
    if (timing.observationTime && timing.observationTime > 0) {
      actions.push({
        name: 'Observatie',
        duration: timing.observationTime,
        type: 'observation',
        description: `Patiënt observeren na injectie (${timing.observationTime} min)`
      })
    }
    
    return actions
  }

  // 1. Setup / Aanbrengen (altijd 15 minuten) - ONLY for infusions
  const setupDuration = 15 // Vast 15 minuten voor aanbrengen
  actions.push({
    name: 'Infuus Aanbrengen',
    duration: setupDuration,
    type: 'setup',
    description: `${medication.displayName} voorbereiden, aansluiten en starten (${setupDuration} min)`
  })

  // 2. Main Infusion
  if (timing.infusionTime > 0) {
    actions.push({
      name: `${medication.displayName} Loopt`,
      duration: timing.infusionTime,
      type: 'infusion',
      description: `Medicatie wordt toegediend gedurende ${timing.infusionTime} minuten`
    })

    // 2a. First collect PC switch times (if applicable)
    const pcSwitchTimes: number[] = []
    if (medication.pcSwitchInterval && medication.pcSwitchDuration && timing.infusionTime > medication.pcSwitchInterval) {
      const numSwitches = Math.floor(timing.infusionTime / medication.pcSwitchInterval)
      for (let i = 1; i <= numSwitches; i++) {
        pcSwitchTimes.push(i * medication.pcSwitchInterval)
      }
    }
    
    // 2b. Generate checks during infusion ONLY when explicitly configured in the medicatie builder
    // NOTE: Checks worden TIJDENS het infuus uitgevoerd, niet na afloop
    // SKIP checks tijdens PC wisselen en vlak voor het einde (afkoppelen)
    const hasConfiguredChecks = !isCheckDisabledMedication(medicationId) && Boolean(variant.actions?.some(action => action.type === 'check'))
    if (hasConfiguredChecks && medication.checkInterval && medication.checkInterval > 0 && timing.infusionTime > medication.checkInterval) {
      const maxCheckTime = timing.infusionTime - 15 // No checks in last 15 minutes (during disconnection prep)
      let checkNumber = 0
      const checkDuration = 5 // Checks are always exactly 5 minutes
      const pcSwitchDuration = medication.pcSwitchDuration || 8
      
      for (let i = 1; i * medication.checkInterval <= maxCheckTime; i++) {
        const checkOffset = i * medication.checkInterval
        const checkEnd = checkOffset + checkDuration
        
        // SKIP this check if it overlaps with ANY PC switch period
        // Check overlaps with PC switch if:
        // - Check starts during PC switch: checkOffset between [pcTime, pcTime + pcSwitchDuration]
        // - Check ends during PC switch: checkEnd between [pcTime, pcTime + pcSwitchDuration]
        // - Check completely contains PC switch: checkOffset < pcTime AND checkEnd > pcTime + pcSwitchDuration
        const overlapsWithPcSwitch = pcSwitchTimes.some(pcTime => {
          const pcEnd = pcTime + pcSwitchDuration
          
          // Check if there's any overlap
          return (
            (checkOffset >= pcTime && checkOffset < pcEnd) ||  // Check starts during PC switch
            (checkEnd > pcTime && checkEnd <= pcEnd) ||        // Check ends during PC switch
            (checkOffset < pcTime && checkEnd > pcEnd)         // Check contains PC switch
          )
        })
        
        if (!overlapsWithPcSwitch) {
          checkNumber++
          
          actions.push({
            name: `Check ${checkNumber}`,
            duration: 0, // Doesn't extend total schedule (happens during infusion)
            actualDuration: checkDuration,
            type: 'check',
            checkOffset: checkOffset, // Minutes from INFUSION START (not patient start)
            description: `Vitale functies controle ${checkOffset} min na infuus start (${checkDuration} min werk)`
          })
        }
      }
    }
    
    // 2c. PC wisselen voor bloedtransfusies (om de 2 uur, duurt 8 min)
    // checkOffset is VANAF HET BEGIN VAN HET INFUUS
    if (pcSwitchTimes.length > 0 && medication.pcSwitchDuration) {
      pcSwitchTimes.forEach((switchOffset, index) => {
        actions.push({
          name: `🔄 PC Wisselen ${index + 1}`,
          duration: 0, // Doesn't extend total schedule (happens during infusion)
          actualDuration: medication.pcSwitchDuration,
          type: 'pc_switch',
          checkOffset: switchOffset, // Minutes from INFUSION START (not patient start)
          description: `Bloedproduct wisselen ${switchOffset} min na infuus start (${medication.pcSwitchDuration} min werk)`
        })
      })
    }
  }

  // 3. Observation time (if applicable)
  if (timing.observationTime && timing.observationTime > 0) {
    actions.push({
      name: 'Observatie',
      duration: timing.observationTime,
      type: 'observation',
      description: `Patiënt observeren na medicatie toediening (${timing.observationTime} min)`
    })
  }

  // 4. Flush time (if applicable)
  if (timing.flushTime && timing.flushTime > 0) {
    actions.push({
      name: 'Spoelen',
      duration: timing.flushTime,
      actualDuration: 2, // VPK time is 2 min, machine/patient time is flushTime (5 min)
      type: 'flush',
      description: `Infuuslijn spoelen (${timing.flushTime} min)`
    })
  }

  // 5. Removal / Afkoppelen (VPK tijd voor afkoppelen en nazorg)
  // Only if there was an infusion (not for SC injections without infusion)
  if (timing.infusionTime > 0 || timing.flushTime) {
    actions.push({
      name: 'Infuus Afkoppelen',
      duration: 5, // 5 minuten voor afkoppelen
      type: 'removal',
      description: `${medication.displayName} verwijderen, wond verzorgen, nazorg (5 min)`
    })
  }

  return actions
}

export function calculateTotalTreatmentTime(
  medicationId: string,
  treatmentNumber: number
): number {
  const breakdown = getTreatmentBreakdown(medicationId, treatmentNumber)
  return breakdown.totalTime
}

export function getTreatmentBreakdown(
  medicationId: string,
  treatmentNumber: number
): {
  vpkTime: number
  protocolCheckTime: number
  infusionTime: number
  observationTime: number
  flushTime: number
  removalTime: number
  totalTime: number
  checkCount: number
} {
  const medication = getMedicationById(medicationId)
  const variant = getMedicationVariant(medicationId, treatmentNumber)
  
  if (!medication || !variant) {
    return {
      vpkTime: 0,
      protocolCheckTime: 0,
      infusionTime: 0,
      observationTime: 0,
      flushTime: 0,
      removalTime: 0,
      totalTime: 0,
      checkCount: 0
    }
  }

  if (variant.actions && variant.actions.length > 0) {
    const actions = [...variant.actions]
      .filter(action => action.type !== 'protocol_check')
      .sort((a, b) => (a.startOffset ?? 0) - (b.startOffset ?? 0))
    const totalTime = actions.reduce((max, action) => {
      const end = (action.startOffset ?? 0) + action.duration
      return Math.max(max, end)
    }, 0)

    const typeTotals = actions.reduce((acc, action) => {
      const type = action.type || 'custom'
      acc[type] = (acc[type] || 0) + action.duration
      return acc
    }, {} as Record<string, number>)

    const nurseTime = actions.reduce((sum, action) => {
      const rawType = action.type || 'custom'
      const nurseAction = action.nurseAction ?? isNurseType(rawType)
      return nurseAction ? sum + action.duration : sum
    }, 0)

    return {
      vpkTime: nurseTime,
      protocolCheckTime: 0,
      infusionTime: typeTotals.infusion || 0,
      observationTime: typeTotals.observation || 0,
      flushTime: typeTotals.flush || 0,
      removalTime: typeTotals.removal || 0,
      totalTime,
      checkCount: typeTotals.check ? Math.max(1, Math.floor((typeTotals.check || 0) / 5)) : 0
    }
  }

  const timing = variant.timing
  const isInfusion = timing.infusionTime > 0
  
  // For SC injections (no infusion time)
  if (!isInfusion) {
    return {
      vpkTime: timing.vpkTime || 15,
      protocolCheckTime: 0,
      infusionTime: 0,
      observationTime: timing.observationTime || 0,
      flushTime: 0,
      removalTime: 0,
      totalTime: (timing.vpkTime || 15) + (timing.observationTime || 0),
      checkCount: 0
    }
  }
  
  const checkCount = medication.checkInterval && timing.infusionTime > 0
    ? Math.floor(timing.infusionTime / medication.checkInterval)
    : 0

  // VPK tijd componenten (ONLY for infusions)
  const setupDuration = 15 // Altijd 15 minuten voor aanbrengen
  const removalDuration = 5 // Altijd 5 minuten voor afkoppelen
  
  // Bereken totale tijd: setup + protocol check + infusion + observation + flush + removal
  const calculatedTotal = setupDuration + 
                          timing.infusionTime + 
                          (timing.observationTime || 0) + 
                          (timing.flushTime || 0) + 
                          (timing.infusionTime > 0 || timing.flushTime ? removalDuration : 0)

  return {
    vpkTime: setupDuration, // Altijd 15 minuten voor aanbrengen
    protocolCheckTime: 0,
    infusionTime: timing.infusionTime,
    observationTime: timing.observationTime || 0,
    flushTime: timing.flushTime || 0,
    removalTime: timing.infusionTime > 0 || timing.flushTime ? removalDuration : 0,
    totalTime: calculatedTotal,
    checkCount
  }
}
