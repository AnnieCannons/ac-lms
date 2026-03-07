'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function StudentViewButton({ courseId }: { courseId: string }) {
  const router = useRouter()
  const [active, setActive] = useState(false)

  useEffect(() => {
    const value = document.cookie
      .split('; ')
      .find(row => row.startsWith('student-view='))
      ?.split('=')[1]
    setActive(value === courseId)
  }, [courseId])

  function handleClick() {
    if (active) {
      document.cookie = 'student-view=; path=/; max-age=0'
      setActive(false)
    } else {
      document.cookie = `student-view=${courseId}; path=/; max-age=86400`
      router.push(`/student/courses/${courseId}`)
    }
  }

  return (
    <button
      onClick={handleClick}
      className={`w-full text-sm font-semibold px-4 py-1.5 rounded-full transition-colors truncate ${
        active
          ? 'bg-amber-100 text-amber-800 border border-amber-400 hover:bg-amber-200'
          : 'text-teal-primary border border-teal-primary hover:bg-teal-light'
      }`}
    >
      {active ? 'Leave Student View' : 'Student View'}
    </button>
  )
}
