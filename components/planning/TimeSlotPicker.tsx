'use client'

import { useState, useId, useRef, useEffect } from 'react'

interface TimeSlotPickerProps {
  value: string
  onChange: (time: string) => void
  label?: string
}

export default function TimeSlotPicker({ value, onChange, label }: TimeSlotPickerProps) {
  const selectId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Generate time slots in 15-minute intervals from 08:00 to 16:00
  const generateTimeSlots = () => {
    const slots = []
    const startMinutes = 8 * 60 // 08:00
    const endMinutes = 16 * 60 // 16:00
    
    for (let minutes = startMinutes; minutes <= endMinutes; minutes += 15) {
      const hour = Math.floor(minutes / 60)
      const min = minutes % 60
      const timeString = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`
      
      slots.push(timeString)
    }
    return slots
  }

  const timeSlots = generateTimeSlots()

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Parse current value to display
  const displayValue = value || '08:00'

  const handleTimeSelect = (time: string) => {
    onChange(time)
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label htmlFor={selectId} className="block text-xs font-medium text-slate-600 mb-1">
          {label}
        </label>
      )}
      
      {/* Custom dropdown button */}
      <button
        type="button"
        id={selectId}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all bg-white text-left flex items-center justify-between"
        aria-label={label || "Start tijd selecteren"}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span>{displayValue}</span>
        <svg 
          className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown grid */}
      {isOpen && (
        <div className="absolute z-50 mt-1 bg-white border border-slate-300 rounded-lg shadow-lg p-3 max-h-[320px] overflow-y-auto">
          <div className="grid grid-cols-4 gap-1.5">
            {timeSlots.map(time => {
              const isSelected = time === value
              return (
                <button
                  key={time}
                  type="button"
                  onClick={() => handleTimeSelect(time)}
                  className={`
                    px-3 py-2 text-xs font-medium rounded transition-colors
                    ${isSelected 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : 'bg-slate-100 text-slate-700 hover:bg-blue-100 hover:text-blue-700'
                    }
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
                  `}
                  aria-selected={isSelected}
                  role="option"
                >
                  {time}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Hidden select for form validation */}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      >
        {timeSlots.map(time => (
          <option key={time} value={time}>
            {time}
          </option>
        ))}
      </select>
    </div>
  )
}

