'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts'

// The chart frame a student sees before choosing a skill: same axes and styling as a real
// trend, with nothing plotted yet.
export default function EmptySkillChart({ message }: { message: string }) {
  return (
    <div className="relative bg-teal-light/40 rounded-xl p-3 border-2 border-border">
      <ResponsiveContainer width="100%" height={190}>
        <LineChart data={[{ x: 1, rating: 0 }]} margin={{ top: 46, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis type="number" dataKey="x" domain={[0.5, 1.5]} ticks={[]} stroke="var(--color-border)" />
          <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ fontSize: 11, fill: 'var(--color-muted-text)' }} stroke="var(--color-border)" />
          <Line dataKey="rating" stroke="none" dot={false} activeDot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
      <p className="absolute inset-0 flex items-center justify-center px-8 text-center text-sm text-muted-text">{message}</p>
    </div>
  )
}
