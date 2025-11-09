// Real medication data from Infuusafdeling 4B
export interface MedicationTiming {
  infusionTime: number // Inloop tijd
  vpkTime: number // Verpleegkundige tijd
  observationTime?: number // Observatie tijd
  flushTime?: number // Spoelen tijd
  totalTime: number
}

export interface MedicationVariant {
  treatmentNumber: number // 1=eerste keer, 2=2-3e keer, 3=4-6e keer, 4=7e+ keer
  timing: MedicationTiming
}

export interface Medication {
  id: string
  name: string
  displayName: string
  category: 'infusion' | 'transfusion' | 'iron' | 'immunotherapy' | 'other'
  variants: MedicationVariant[]
  notes?: string
  checkInterval?: number // Minutes between checks (if applicable) - ONLY for Ocrelizumab and Blood transfusions
  pcSwitchInterval?: number // Minutes between PC switches (blood transfusions only)
  pcSwitchDuration?: number // Duration of PC switch in minutes (blood transfusions only)
  color: string
}

export const MEDICATIONS: Medication[] = [
  // === IMMUNOTHERAPY ===
  {
    id: 'infliximab_5mg',
    name: 'Infliximab / Inflectra 5 mg',
    displayName: 'Infliximab 5mg',
    category: 'immunotherapy',
    color: 'purple',
    notes: 'Opbouw 0–2–6 wkn; daarna 8-wekelijks',
    variants: [
      {
        treatmentNumber: 1,
        timing: { infusionTime: 175, vpkTime: 20, totalTime: 195 }
      },
      {
        treatmentNumber: 2,
        timing: { infusionTime: 165, vpkTime: 20, totalTime: 185 }
      },
      {
        treatmentNumber: 3,
        timing: { infusionTime: 90, vpkTime: 20, totalTime: 110 }
      },
      {
        treatmentNumber: 4,
        timing: { infusionTime: 35, vpkTime: 20, totalTime: 55 }
      }
    ]
  },
  {
    id: 'infliximab_10mg',
    name: 'Infliximab / Inflectra 10 mg',
    displayName: 'Infliximab 10mg',
    category: 'immunotherapy',
    color: 'purple',
    notes: 'Na 2 behandeling kan patiënt over naar SC',
    variants: [
      {
        treatmentNumber: 1,
        timing: { infusionTime: 235, vpkTime: 20, totalTime: 255 }
      },
      {
        treatmentNumber: 2,
        timing: { infusionTime: 225, vpkTime: 20, totalTime: 245 }
      },
      {
        treatmentNumber: 3,
        timing: { infusionTime: 150, vpkTime: 20, totalTime: 170 }
      },
      {
        treatmentNumber: 4,
        timing: { infusionTime: 70, vpkTime: 20, totalTime: 90 }
      }
    ]
  },
  {
    id: 'rituximab_1000mg_day1',
    name: 'Rituximab – Dag 1 (1000 mg)',
    displayName: 'Rituximab 1000mg (Dag 1)',
    category: 'immunotherapy',
    color: 'purple',
    variants: [
      {
        treatmentNumber: 1,
        timing: { infusionTime: 220, vpkTime: 20, totalTime: 240 }
      }
    ]
  },
  {
    id: 'rituximab_500mg_day1',
    name: 'Rituximab – Dag 1 (500 mg)',
    displayName: 'Rituximab 500mg (Dag 1)',
    category: 'immunotherapy',
    color: 'purple',
    variants: [
      {
        treatmentNumber: 1,
        timing: { infusionTime: 200, vpkTime: 20, totalTime: 220 }
      }
    ]
  },
  {
    id: 'rituximab_day15',
    name: 'Rituximab – Dag 15 (vervolg)',
    displayName: 'Rituximab (Dag 15)',
    category: 'immunotherapy',
    color: 'purple',
    variants: [
      {
        treatmentNumber: 1,
        timing: { infusionTime: 60, vpkTime: 20, flushTime: 5, totalTime: 85 }
      }
    ]
  },
  {
    id: 'tocilizumab_first',
    name: 'Tocilizumab – 1e',
    displayName: 'Tocilizumab (Eerste)',
    category: 'immunotherapy',
    color: 'purple',
    variants: [
      {
        treatmentNumber: 1,
        timing: { infusionTime: 115, vpkTime: 20, totalTime: 135 }
      },
      {
        treatmentNumber: 2,
        timing: { infusionTime: 75, vpkTime: 20, totalTime: 95 }
      }
    ]
  },
  {
    id: 'tocilizumab_6months',
    name: 'Tocilizumab – vanaf 6 maanden',
    displayName: 'Tocilizumab (>6 mnd)',
    category: 'immunotherapy',
    color: 'purple',
    variants: [
      {
        treatmentNumber: 1,
        timing: { infusionTime: 60, vpkTime: 20, totalTime: 80 }
      }
    ]
  },
  {
    id: 'vedolizumab_first',
    name: 'Vedolizumab – 1e–2e',
    displayName: 'Vedolizumab (1e-2e)',
    category: 'immunotherapy',
    color: 'purple',
    variants: [
      {
        treatmentNumber: 1,
        timing: { infusionTime: 170, vpkTime: 20, totalTime: 190 }
      }
    ]
  },
  {
    id: 'vedolizumab_third_plus',
    name: 'Vedolizumab – 3e+',
    displayName: 'Vedolizumab (3e+)',
    category: 'immunotherapy',
    color: 'purple',
    variants: [
      {
        treatmentNumber: 1,
        timing: { infusionTime: 100, vpkTime: 20, totalTime: 120 }
      }
    ]
  },

  // === BLOOD TRANSFUSIONS ===
  {
    id: 'transfusion_1pc',
    name: 'Bloedtransfusie – 1 PC',
    displayName: 'Bloedtransfusie 1 PC',
    category: 'transfusion',
    color: 'red',
    checkInterval: 30, // Checks om het half uur
    pcSwitchInterval: 120, // PC wisselen om de 2 uur
    pcSwitchDuration: 8, // PC wisselen duurt 8 min
    variants: [
      {
        treatmentNumber: 1,
        timing: { infusionTime: 90, vpkTime: 30, totalTime: 120 }
      }
    ]
  },
  {
    id: 'transfusion_2pc',
    name: 'Bloedtransfusie – 2 PC',
    displayName: 'Bloedtransfusie 2 PC',
    category: 'transfusion',
    color: 'red',
    checkInterval: 30, // Checks om het half uur
    pcSwitchInterval: 120, // PC wisselen om de 2 uur
    pcSwitchDuration: 8, // PC wisselen duurt 8 min
    variants: [
      {
        treatmentNumber: 1,
        timing: { infusionTime: 180, vpkTime: 30, totalTime: 210 }
      }
    ]
  },
  {
    id: 'transfusion_3pc',
    name: 'Bloedtransfusie – 3 PC',
    displayName: 'Bloedtransfusie 3 PC',
    category: 'transfusion',
    color: 'red',
    checkInterval: 30, // Checks om het half uur
    pcSwitchInterval: 120, // PC wisselen om de 2 uur
    pcSwitchDuration: 8, // PC wisselen duurt 8 min
    notes: 'Start op D4B, afronden op andere afdeling',
    variants: [
      {
        treatmentNumber: 1,
        timing: { infusionTime: 270, vpkTime: 30, totalTime: 300 }
      }
    ]
  },

  // === IRON INFUSIONS ===
  {
    id: 'monofer_500mg',
    name: 'Monofer – 500 mg',
    displayName: 'Monofer 500mg',
    category: 'iron',
    color: 'orange',
    notes: '1e keer bij voorkeur ochtend',
    variants: [
      {
        treatmentNumber: 1,
        timing: { infusionTime: 55, vpkTime: 20, totalTime: 75 }
      }
    ]
  },
  {
    id: 'monofer_1000mg',
    name: 'Monofer – 1000–1500 mg',
    displayName: 'Monofer 1000-1500mg',
    category: 'iron',
    color: 'orange',
    variants: [
      {
        treatmentNumber: 1,
        timing: { infusionTime: 90, vpkTime: 20, totalTime: 110 }
      }
    ]
  },
  {
    id: 'ferinject_500mg',
    name: 'Ferinject – 500 mg',
    displayName: 'Ferinject 500mg',
    category: 'iron',
    color: 'orange',
    variants: [
      {
        treatmentNumber: 1,
        timing: { infusionTime: 90, vpkTime: 20, totalTime: 110 }
      }
    ]
  },
  {
    id: 'ferinject_1000mg',
    name: 'Ferinject – 1000 mg',
    displayName: 'Ferinject 1000mg',
    category: 'iron',
    color: 'orange',
    variants: [
      {
        treatmentNumber: 1,
        timing: { infusionTime: 90, vpkTime: 20, totalTime: 110 }
      }
    ]
  },

  // === IMMUNOGLOBULIN ===
  {
    id: 'immunoglobulin_standard',
    name: 'Gammaglobuline / Immunoglobuline',
    displayName: 'Immunoglobuline (Standaard)',
    category: 'infusion',
    color: 'blue',
    notes: 'Max 2 per dag; tijden verschillen erg per patiënt',
    variants: [
      {
        treatmentNumber: 1,
        timing: { infusionTime: 250, vpkTime: 30, totalTime: 280 }
      }
    ]
  },
  {
    id: 'immunoglobulin_3h',
    name: 'Gammaglobuline / Immunoglobuline – 3 uur',
    displayName: 'Immunoglobuline (3 uur)',
    category: 'infusion',
    color: 'blue',
    notes: 'Tijden verschillen erg per patiënt',
    variants: [
      {
        treatmentNumber: 1,
        timing: { infusionTime: 180, vpkTime: 30, totalTime: 210 }
      }
    ]
  },
  {
    id: 'immunoglobulin_4h',
    name: 'Gammaglobuline / Immunoglobuline – 4 uur',
    displayName: 'Immunoglobuline (4 uur)',
    category: 'infusion',
    color: 'blue',
    notes: 'Tijden verschillen erg per patiënt',
    variants: [
      {
        treatmentNumber: 1,
        timing: { infusionTime: 240, vpkTime: 30, totalTime: 270 }
      }
    ]
  },

  // === OTHER MEDICATIONS ===
  {
    id: 'methylprednisolon',
    name: 'Methylprednisolon',
    displayName: 'Methylprednisolon',
    category: 'other',
    color: 'green',
    notes: 'Kuur 3 of 5 dagen (spoed), altijd rond de zelfde tijd plannen',
    variants: [
      {
        treatmentNumber: 1,
        timing: { infusionTime: 90, vpkTime: 20, totalTime: 110 }
      }
    ]
  },
  {
    id: 'ceftriaxon',
    name: 'Ceftriaxon (antibiotica)',
    displayName: 'Ceftriaxon',
    category: 'other',
    color: 'teal',
    variants: [
      {
        treatmentNumber: 1,
        timing: { infusionTime: 50, vpkTime: 20, totalTime: 70 }
      }
    ]
  },
  {
    id: 'pamidronaat_30mg',
    name: 'APD (Pamidronaat) 30 mg',
    displayName: 'Pamidronaat 30mg',
    category: 'other',
    color: 'indigo',
    variants: [
      {
        treatmentNumber: 1,
        timing: { infusionTime: 30, vpkTime: 20, flushTime: 5, totalTime: 55 }
      }
    ]
  },
  {
    id: 'pamidronaat_60mg',
    name: 'APD (Pamidronaat) 60 mg',
    displayName: 'Pamidronaat 60mg',
    category: 'other',
    color: 'indigo',
    variants: [
      {
        treatmentNumber: 1,
        timing: { infusionTime: 60, vpkTime: 20, flushTime: 5, totalTime: 85 }
      }
    ]
  },
  {
    id: 'pamidronaat_90mg',
    name: 'APD (Pamidronaat) 90 mg',
    displayName: 'Pamidronaat 90mg',
    category: 'other',
    color: 'indigo',
    variants: [
      {
        treatmentNumber: 1,
        timing: { infusionTime: 90, vpkTime: 20, flushTime: 5, totalTime: 115 }
      }
    ]
  },
  {
    id: 'natalizumab_iv',
    name: 'Natalizumab IV',
    displayName: 'Natalizumab IV',
    category: 'immunotherapy',
    color: 'purple',
    variants: [
      {
        treatmentNumber: 1,
        timing: { infusionTime: 130, vpkTime: 20, totalTime: 150 }
      },
      {
        treatmentNumber: 2,
        timing: { infusionTime: 120, vpkTime: 20, totalTime: 140 }
      },
      {
        treatmentNumber: 3,
        timing: { infusionTime: 90, vpkTime: 20, totalTime: 110 }
      }
    ]
  },
  {
    id: 'natalizumab_sc',
    name: 'Natalizumab SC',
    displayName: 'Natalizumab SC',
    category: 'immunotherapy',
    color: 'purple',
    notes: 'Incl. 60 min observatie',
    variants: [
      {
        treatmentNumber: 1,
        timing: { infusionTime: 0, vpkTime: 20, observationTime: 60, totalTime: 80 }
      },
      {
        treatmentNumber: 2,
        timing: { infusionTime: 0, vpkTime: 20, observationTime: 60, totalTime: 80 }
      },
      {
        treatmentNumber: 3,
        timing: { infusionTime: 0, vpkTime: 20, observationTime: 60, totalTime: 80 }
      },
      {
        treatmentNumber: 4,
        timing: { infusionTime: 0, vpkTime: 20, totalTime: 20 }
      }
    ]
  },
  {
    id: 'ocrelizumab_schema1',
    name: 'Ocrelizumab (Ocrevus) – Schema 1',
    displayName: 'Ocrelizumab Schema 1',
    category: 'immunotherapy',
    color: 'purple',
    checkInterval: 60, // Checks om het uur
    notes: 'Schema 1 (Dag 1 & 15)',
    variants: [
      {
        treatmentNumber: 1,
        timing: { infusionTime: 170, vpkTime: 30, observationTime: 60, totalTime: 290 }
      }
    ]
  },
  {
    id: 'ocrelizumab_schema2',
    name: 'Ocrelizumab (Ocrevus) – Schema 2',
    displayName: 'Ocrelizumab Schema 2',
    category: 'immunotherapy',
    color: 'purple',
    checkInterval: 60, // Checks om het uur
    notes: 'Alleen na eerdere reactie',
    variants: [
      {
        treatmentNumber: 1,
        timing: { infusionTime: 230, vpkTime: 30, observationTime: 60, totalTime: 320 }
      }
    ]
  },
  {
    id: 'ocrelizumab_schema3',
    name: 'Ocrelizumab (Ocrevus) – Schema 3',
    displayName: 'Ocrelizumab Schema 3',
    category: 'immunotherapy',
    color: 'purple',
    checkInterval: 60, // Checks om het uur
    notes: 'Observatie tijd is vervallen',
    variants: [
      {
        treatmentNumber: 1,
        timing: { infusionTime: 130, vpkTime: 30, observationTime: 60, totalTime: 220 }
      }
    ]
  },

  // === ADERLATING ===
  {
    id: 'aderlating',
    name: 'Aderlating',
    displayName: 'Aderlating',
    category: 'other',
    color: 'red',
    variants: [
      {
        treatmentNumber: 1,
        timing: { infusionTime: 30, vpkTime: 20, totalTime: 50 }
      }
    ]
  },
  {
    id: 'aderlating_infuus',
    name: 'Aderlating met infuus',
    displayName: 'Aderlating + Infuus',
    category: 'other',
    color: 'red',
    variants: [
      {
        treatmentNumber: 1,
        timing: { infusionTime: 60, vpkTime: 20, totalTime: 80 }
      }
    ]
  },
  {
    id: 'zoledroninezuur',
    name: 'Zoledroninezuur (Zometa)',
    displayName: 'Zometa',
    category: 'other',
    color: 'amber',
    notes: 'Jaarlijks; lab verplicht',
    variants: [
      {
        treatmentNumber: 1,
        timing: { infusionTime: 40, vpkTime: 20, totalTime: 60 }
      }
    ]
  },
]

// Helper functions
export function getMedicationById(id: string): Medication | undefined {
  return MEDICATIONS.find(m => m.id === id)
}

export function getMedicationVariant(medicationId: string, treatmentNumber: number): MedicationVariant | undefined {
  const medication = getMedicationById(medicationId)
  if (!medication) return undefined
  
  // Find exact match or closest lower treatment number
  const sortedVariants = [...medication.variants].sort((a, b) => b.treatmentNumber - a.treatmentNumber)
  return sortedVariants.find(v => v.treatmentNumber <= treatmentNumber) || medication.variants[0]
}

export function getMedicationsByCategory(category: string): Medication[] {
  return MEDICATIONS.filter(m => m.category === category)
}

export const MEDICATION_CATEGORIES = [
  { id: 'immunotherapy', name: 'Immunotherapie', icon: '💉' },
  { id: 'transfusion', name: 'Bloedtransfusie', icon: '🩸' },
  { id: 'iron', name: 'IJzer Infusies', icon: '⚡' },
  { id: 'infusion', name: 'Algemene Infusies', icon: '💊' },
  { id: 'other', name: 'Overige', icon: '🏥' },
]

export const TREATMENT_NUMBER_OPTIONS = [
  { value: 1, label: '1e behandeling' },
  { value: 2, label: '2e - 3e behandeling' },
  { value: 3, label: '4e - 6e behandeling' },
  { value: 4, label: '7e+ behandeling' },
]

