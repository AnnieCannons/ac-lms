'use client'
import { useEffect } from 'react'
import { checkAndCreateDueCardsNotification } from '@/lib/flashcards/actions'

export default function DueCardsNotifier() {
  useEffect(() => {
    checkAndCreateDueCardsNotification().then(created => {
      if (created) window.dispatchEvent(new Event('notifications-updated'))
    })
  }, [])
  return null
}
