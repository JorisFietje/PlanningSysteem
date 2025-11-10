'use client'

import { useState, useId, useRef, useEffect } from 'react'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  label?: string
  placeholder?: string
  required?: boolean
  searchable?: boolean
  className?: string
  ariaLabel?: string
  emptyMessage?: string
}

export default function Select({
  value,
  onChange,
  options,
  label,
  placeholder = 'Selecteer...',
  required = false,
  searchable = false,
  className = '',
  ariaLabel,
  emptyMessage = 'Geen opties beschikbaar'
}: SelectProps) {
  const selectId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      // Focus search input when dropdown opens
      if (searchable && searchInputRef.current) {
        setTimeout(() => searchInputRef.current?.focus(), 0)
      }
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, searchable])

  // Filter options based on search term
  const filteredOptions = searchable && searchTerm
    ? options.filter(opt => 
        opt.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options

  // Get selected option label
  const selectedOption = options.find(opt => opt.value === value)
  const displayValue = selectedOption?.label || placeholder

  const handleSelect = (optionValue: string) => {
    if (options.find(opt => opt.value === optionValue && !opt.disabled)) {
      onChange(optionValue)
      setIsOpen(false)
      setSearchTerm('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
      setSearchTerm('')
    } else if (e.key === 'Enter' && isOpen && filteredOptions.length > 0) {
      const firstEnabled = filteredOptions.find(opt => !opt.disabled)
      if (firstEnabled) {
        handleSelect(firstEnabled.value)
      }
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
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
        onKeyDown={handleKeyDown}
        className={`
          w-full px-3 py-2 text-sm border border-slate-300 rounded-lg 
          focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none 
          transition-all bg-white text-left flex items-center justify-between
          ${!selectedOption ? 'text-slate-400' : 'text-slate-900'}
          ${required && !value ? 'border-red-300' : ''}
        `}
        aria-label={ariaLabel || label || "Selecteer optie"}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="truncate">{displayValue}</span>
        <svg 
          className={`w-4 h-4 text-slate-500 transition-transform flex-shrink-0 ml-2 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div 
          className="absolute z-50 mt-1 bg-white border border-slate-300 rounded-lg shadow-lg w-full max-h-[300px] overflow-hidden"
          role="listbox"
        >
          {searchable && (
            <div className="p-2 border-b border-slate-200">
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Zoeken..."
                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
          
          <div className="overflow-y-auto max-h-[250px]">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-500 text-center">
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map(option => {
                const isSelected = option.value === value
                const isDisabled = option.disabled
                
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => !isDisabled && handleSelect(option.value)}
                    disabled={isDisabled}
                    className={`
                      w-full px-3 py-2 text-sm text-left transition-colors
                      ${isSelected 
                        ? 'bg-blue-600 text-white' 
                        : isDisabled
                        ? 'text-slate-400 cursor-not-allowed'
                        : 'text-slate-700 hover:bg-blue-100 hover:text-blue-700'
                      }
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset
                    `}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={isDisabled}
                  >
                    <div className="flex items-center justify-between">
                      <span>{option.label}</span>
                      {isSelected && (
                        <svg 
                          className="w-4 h-4 flex-shrink-0 ml-2" 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* Hidden select for form validation */}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      >
        {options.map(option => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

