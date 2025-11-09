import { useState } from 'react'

type NotificationType = 'success' | 'warning' | 'info'

export function useNotifications() {
  const [notification, setNotification] = useState<{ message: string; type: NotificationType } | null>(null)

  const showNotification = (message: string, type: NotificationType) => {
    setNotification({ message, type })
    setTimeout(() => {
      setNotification(null)
    }, 5000)
  }

  const closeNotification = () => {
    setNotification(null)
  }

  return { notification, setNotification, showNotification, closeNotification }
}

