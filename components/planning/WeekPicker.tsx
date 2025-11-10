'use client'

import { useState } from 'react'
import { formatDateToISO, getMondayOfWeek, formatDateToDutch } from '@/types'

interface WeekPickerProps {
  value: string // YYYY-MM-DD format (Monday of the week)
  onChange: (monday: string) => void
}

export default function WeekPicker({ value, onChange }: WeekPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  
  const selectedDate = new Date(value + 'T00:00:00')
  const currentMonth = selectedDate.getMonth()
  const currentYear = selectedDate.getFullYear()
  
  // Get Monday and Friday of selected week
  const monday = new Date(selectedDate)
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)
  
  // Get first day of month and number of days
  const firstDay = new Date(currentYear, currentMonth, 1)
  const lastDay = new Date(currentYear, currentMonth + 1, 0)
  const daysInMonth = lastDay.getDate()
  const startingDayOfWeek = firstDay.getDay() // 0 = Sunday, 1 = Monday, etc.
  
  // Adjust for Monday as first day (0 = Monday, 6 = Sunday)
  const adjustedStartingDay = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1
  
  // Navigate to previous/next week
  const prevWeek = () => {
    const newDate = new Date(selectedDate)
    newDate.setDate(selectedDate.getDate() - 7)
    onChange(formatDateToISO(newDate))
  }
  
  const nextWeek = () => {
    const newDate = new Date(selectedDate)
    newDate.setDate(selectedDate.getDate() + 7)
    onChange(formatDateToISO(newDate))
  }
  
  // Navigate to previous/next month
  const prevMonth = () => {
    const newDate = new Date(currentYear, currentMonth - 1, 1)
    const mondayOfMonth = getMondayOfWeek(formatDateToISO(newDate))
    onChange(mondayOfMonth)
  }
  
  const nextMonth = () => {
    const newDate = new Date(currentYear, currentMonth + 1, 1)
    const mondayOfMonth = getMondayOfWeek(formatDateToISO(newDate))
    onChange(mondayOfMonth)
  }
  
  // Check if a day is in the selected week (Monday-Friday)
  const isInSelectedWeek = (day: number) => {
    const dayDate = new Date(currentYear, currentMonth, day)
    const dayMonday = getMondayOfWeek(formatDateToISO(dayDate))
    return dayMonday === value
  }
  
  // Check if a day is today
  const isToday = (day: number) => {
    const today = new Date()
    return day === today.getDate() && 
           currentMonth === today.getMonth() && 
           currentYear === today.getFullYear()
  }
  
  // Select a week by clicking on any day
  const selectWeek = (day: number) => {
    const dayDate = new Date(currentYear, currentMonth, day)
    const mondayOfWeek = getMondayOfWeek(formatDateToISO(dayDate))
    onChange(mondayOfWeek)
    setIsOpen(false)
  }
  
  const monthNames = [
    'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
    'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'
  ]
  
  const weekDays = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']
  
  // Generate calendar days
  const days: (number | null)[] = []
  
  // Add empty cells for days before the first day of the month
  for (let i = 0; i < adjustedStartingDay; i++) {
    days.push(null)
  }
  
  // Add all days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day)
  }
  
  // Get week range for display
  const weekEnd = new Date(monday)
  weekEnd.setDate(monday.getDate() + 4) // Friday
  
  return (
    <div className="relative">
      {/* Week Input Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-white rounded-lg border border-slate-300 hover:border-blue-500 hover:shadow-sm transition-all px-3 py-2 flex items-center gap-2 min-w-[200px]"
      >
        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <div className="flex-1 text-left">
          <div className="font-semibold text-sm text-slate-900">
            {formatDateToDutch(value)} - {formatDateToDutch(formatDateToISO(weekEnd))}
          </div>
        </div>
        <svg 
          className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {/* Calendar Dropdown */}
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 p-4 z-20 min-w-[320px]">
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={prevWeek}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  aria-label="Vorige week"
                  title="Vorige week"
                >
                  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={prevMonth}
                  className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  aria-label="Vorige maand"
                  title="Vorige maand"
                >
                  <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              </div>
              <div className="font-bold text-lg text-slate-900">
                {monthNames[currentMonth]} {currentYear}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={nextMonth}
                  className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  aria-label="Volgende maand"
                  title="Volgende maand"
                >
                  <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <button
                  onClick={nextWeek}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  aria-label="Volgende week"
                  title="Volgende week"
                >
                  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Week Days Header */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map((day) => (
                <div
                  key={day}
                  className={`text-center text-xs font-semibold py-1 ${
                    ['Za', 'Zo'].includes(day) ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, index) => {
                if (day === null) {
                  return <div key={`empty-${index}`} className="aspect-square" />
                }
                
                const inSelectedWeek = isInSelectedWeek(day)
                const isWeekend = (() => {
                  const dayDate = new Date(currentYear, currentMonth, day)
                  const dayOfWeek = dayDate.getDay()
                  return dayOfWeek === 0 || dayOfWeek === 6 // Sunday or Saturday
                })()
                const isWorkDay = (() => {
                  const dayDate = new Date(currentYear, currentMonth, day)
                  const dayOfWeek = dayDate.getDay()
                  return dayOfWeek >= 1 && dayOfWeek <= 5 // Monday to Friday
                })()
                
                return (
                  <button
                    key={day}
                    onClick={() => selectWeek(day)}
                    className={`aspect-square rounded-lg text-sm font-semibold transition-all relative ${
                      inSelectedWeek && isWorkDay
                        ? 'bg-blue-700 text-white shadow-md'
                        : inSelectedWeek && !isWorkDay
                        ? 'bg-blue-200 text-blue-800'
                        : isToday(day)
                        ? 'bg-blue-50 text-blue-600 border-2 border-blue-300'
                        : isWeekend
                        ? 'text-slate-400 hover:bg-slate-50'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                    title={inSelectedWeek ? `Week: ${formatDateToDutch(value)} - ${formatDateToDutch(formatDateToISO(weekEnd))}` : undefined}
                  >
                    {day}
                    {inSelectedWeek && isWorkDay && (
                      <div className="absolute inset-0 border-2 border-blue-400 rounded-lg pointer-events-none" />
                    )}
                  </button>
                )
              })}
            </div>
            
            {/* Week Info Footer */}
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="text-xs text-slate-600">
                <div className="font-semibold text-slate-900 mb-1">
                  Geselecteerde week: {formatDateToDutch(value)} - {formatDateToDutch(formatDateToISO(weekEnd))}
                </div>
                <div className="text-slate-500">Klik op een dag om de week te selecteren</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

