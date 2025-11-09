'use client'

interface TimeSlotPickerProps {
  value: string
  onChange: (time: string) => void
  label?: string
}

export default function TimeSlotPicker({ value, onChange, label }: TimeSlotPickerProps) {
  // Generate time slots in 15-minute intervals from 08:00 to 16:00
  // Include all times, including break times (10:00, 12:00, 12:30 are available)
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

  return (
    <div>
      {label && (
        <label className="block text-xs font-medium text-slate-600 mb-1">
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
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

