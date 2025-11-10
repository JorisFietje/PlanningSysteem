'use client'

import { useEffect, useState } from 'react'

interface NotificationProps {
  message: string
  type: 'success' | 'warning' | 'info'
  onClose: () => void
}

export default function Notification({ message, type, onClose }: NotificationProps) {
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true)
      setTimeout(onClose, 300)
    }, 3000)

    return () => clearTimeout(timer)
  }, [onClose])

  const bgColor = {
    success: 'bg-green-700',
    warning: 'bg-orange-700',
    info: 'bg-blue-700',
  }[type]

  return (
    <div
      className={`fixed top-5 right-5 ${bgColor} text-white px-6 py-4 rounded-lg shadow-2xl font-semibold z-50 ${
        isExiting ? 'animate-slide-out' : 'animate-slide-in'
      }`}
    >
      {message}
    </div>
  )
}

