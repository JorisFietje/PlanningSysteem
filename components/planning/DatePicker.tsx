'use client'

import { useState } from 'react'
import { formatDateToISO, getDayOfWeekFromDate, DAY_LABELS, DayOfWeek, StaffMember } from '@/types'

interface DatePickerProps {
  value: string // YYYY-MM-DD format
  onChange: (date: string) => void
  staffMembers: StaffMember[]
}

export default function DatePicker({ value, onChange, staffMembers }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  
  const date = new Date(value + 'T00:00:00')
  const dayOfWeek = getDayOfWeekFromDate(value)
  const staffForDay = staffMembers.filter(s => s.workDays.length === 0 || s.workDays.includes(dayOfWeek))
  
  const currentMonth = date.getMonth()
  const currentYear = date.getFullYear()
  
  // Get first day of month and number of days
  const firstDay = new Date(currentYear, currentMonth, 1)
  const lastDay = new Date(currentYear, currentMonth + 1, 0)
  const daysInMonth = lastDay.getDate()
  const startingDayOfWeek = firstDay.getDay() // 0 = Sunday, 1 = Monday, etc.
  
  // Adjust for Monday as first day (0 = Monday, 6 = Sunday)
  const adjustedStartingDay = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1
  
  // Get previous and next month
  const prevMonth = () => {
    const newDate = new Date(currentYear, currentMonth - 1, 1)
    onChange(formatDateToISO(newDate))
  }
  
  const nextMonth = () => {
    const newDate = new Date(currentYear, currentMonth + 1, 1)
    onChange(formatDateToISO(newDate))
  }
  
  const selectDate = (day: number) => {
    const newDate = new Date(currentYear, currentMonth, day)
    onChange(formatDateToISO(newDate))
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
  
  const isToday = (day: number) => {
    const today = new Date()
    return day === today.getDate() && 
           currentMonth === today.getMonth() && 
           currentYear === today.getFullYear()
  }
  
  const isSelected = (day: number) => {
    return day === date.getDate() && 
           currentMonth === date.getMonth() && 
           currentYear === date.getFullYear()
  }
  
  const formatDisplayDate = (dateString: string) => {
    const d = new Date(dateString + 'T00:00:00')
    const day = d.getDate()
    const month = d.getMonth() + 1
    const year = d.getFullYear()
    return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`
  }

  return (
    <div className="relative">
      {/* Date Input Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-white rounded-lg border border-slate-300 hover:border-blue-500 hover:shadow-sm transition-all px-3 py-2 flex items-center gap-2 min-w-[180px]"
      >
        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <div className="flex-1 text-left">
          <div className="font-semibold text-sm text-slate-900">{formatDisplayDate(value)}</div>
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
          <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 p-4 z-20 min-w-[300px]">
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={prevMonth}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="font-bold text-lg text-slate-900">
                {monthNames[currentMonth]} {currentYear}
              </div>
              <button
                onClick={nextMonth}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            
            {/* Week Days Header */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-semibold text-slate-500 py-1"
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
                
                return (
                  <button
                    key={day}
                    onClick={() => selectDate(day)}
                    className={`aspect-square rounded-lg text-sm font-semibold transition-all ${
                      isSelected(day)
                        ? 'bg-blue-600 text-white shadow-md'
                        : isToday(day)
                        ? 'bg-blue-50 text-blue-600 border-2 border-blue-300'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
            
            {/* Info Footer */}
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="text-xs text-slate-600">
                <div className="font-semibold text-slate-900 mb-1">{DAY_LABELS[dayOfWeek]}</div>
                <div>{staffForDay.length} verpleegkundige{staffForDay.length !== 1 ? 'n' : ''} beschikbaar</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

