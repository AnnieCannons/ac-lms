'use client'

export default function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="bg-teal-primary text-white text-sm font-semibold px-5 py-2 rounded-full hover:opacity-90">
      Print
    </button>
  )
}
