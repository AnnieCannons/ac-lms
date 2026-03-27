'use client'

import { useState, useEffect, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Plus, Target, X, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Skill {
  id: string
  name: string
  entries: Entry[]
}

interface Entry {
  id: string
  score: number
  goal_points: number | null
  created_at: string
}

const SCORE_LABELS: Record<number, string> = {
  1: "😳 I just learned this exists",
  2: "👀 I've seen examples of this",
  3: "🤔 I can follow along with guidance",
  4: "😅 I finished assignments, but it feels fuzzy",
  5: "🙂 I understand the basics",
  6: "😊 I can complete tasks independently",
  7: "💬 I can talk about my own code",
  8: "💡 I can solve new problems with this skill",
  9: "🤓 I can talk about other people's code with this skill",
  10: "🌟 I could teach this to a brand new developer",
}

function Confetti() {
  const pieces = Array.from({ length: 50 }, (_, i) => i)
  const colors = ['#1AA5A5', '#f59e0b', '#ef4444', '#22c55e', '#a855f7']
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[200] overflow-hidden">
      {pieces.map(i => (
        <div
          key={i}
          className="absolute w-2.5 h-2.5 rounded-sm animate-confetti-fall"
          style={{
            left: `${Math.random() * 100}%`,
            top: '-10px',
            backgroundColor: colors[Math.floor(Math.random() * colors.length)],
            animationDelay: `${Math.random() * 0.5}s`,
            animationDuration: `${2 + Math.random() * 2}s`,
          }}
        />
      ))}
    </div>
  )
}

export default function ConfidenceTracker({ userName }: { userName: string }) {
  const supabase = createClient()
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)

  // New skill form
  const [showForm, setShowForm] = useState(false)
  const [newSkill, setNewSkill] = useState('')
  const [saving, setSaving] = useState(false)

  // Log modal
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null)
  const [confidenceScore, setConfidenceScore] = useState(5)
  const [goalPoints, setGoalPoints] = useState(1)
  const [loggingEntry, setLoggingEntry] = useState(false)

  // Celebration
  const [showConfetti, setShowConfetti] = useState(false)
  const [celebrationSkill, setCelebrationSkill] = useState<string | null>(null)
  const [masterySkill, setMasterySkill] = useState<string | null>(null)

  const loadSkills = useCallback(async () => {
    setLoading(true)
    const { data: skillRows } = await supabase
      .from('confidence_skills')
      .select('id, name, created_at')
      .order('created_at', { ascending: true })

    if (!skillRows) { setLoading(false); return }

    const skillIds = skillRows.map(s => s.id)
    const { data: entryRows } = skillIds.length > 0
      ? await supabase
          .from('confidence_entries')
          .select('id, skill_id, score, goal_points, created_at')
          .in('skill_id', skillIds)
          .order('created_at', { ascending: true })
      : { data: [] }

    const entryMap = new Map<string, Entry[]>()
    for (const e of entryRows ?? []) {
      const arr = entryMap.get(e.skill_id) ?? []
      arr.push({ id: e.id, score: e.score, goal_points: e.goal_points, created_at: e.created_at })
      entryMap.set(e.skill_id, arr)
    }

    setSkills(skillRows.map(s => ({ id: s.id, name: s.name, entries: entryMap.get(s.id) ?? [] })))
    setLoading(false)
  }, [])

  useEffect(() => { loadSkills() }, [loadSkills])

  const addSkill = async () => {
    if (!newSkill.trim() || saving) return
    setSaving(true)
    const { data } = await supabase
      .from('confidence_skills')
      .insert({ name: newSkill.trim() })
      .select('id, name')
      .single()
    if (data) {
      setSkills(prev => [...prev, { id: data.id, name: data.name, entries: [] }])
      setNewSkill('')
      setShowForm(false)
    }
    setSaving(false)
  }

  const removeSkill = async (skillId: string) => {
    if (!confirm('Remove this skill and all its entries?')) return
    await supabase.from('confidence_skills').delete().eq('id', skillId)
    setSkills(prev => prev.filter(s => s.id !== skillId))
    if (selectedSkill?.id === skillId) setSelectedSkill(null)
  }

  const openLog = (skill: Skill) => {
    const last = skill.entries[skill.entries.length - 1]
    setConfidenceScore(last ? last.score : 5)
    setGoalPoints(last?.goal_points ?? 1)
    setSelectedSkill(skill)
  }

  const logEntry = async () => {
    if (!selectedSkill || loggingEntry) return
    setLoggingEntry(true)

    const last = selectedSkill.entries[selectedSkill.entries.length - 1]
    const goalMet = last?.goal_points != null && confidenceScore >= last.score + last.goal_points
    const mastered = confidenceScore === 10

    const { data } = await supabase
      .from('confidence_entries')
      .insert({ skill_id: selectedSkill.id, score: confidenceScore, goal_points: goalPoints })
      .select('id, score, goal_points, created_at')
      .single()

    if (data) {
      const newEntry: Entry = { id: data.id, score: data.score, goal_points: data.goal_points, created_at: data.created_at }
      setSkills(prev => prev.map(s =>
        s.id === selectedSkill.id ? { ...s, entries: [...s.entries, newEntry] } : s
      ))

      if (mastered) {
        setMasterySkill(selectedSkill.name)
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 3500)
      } else if (goalMet) {
        setCelebrationSkill(selectedSkill.name)
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 3500)
      }
    }

    setSelectedSkill(null)
    setConfidenceScore(5)
    setGoalPoints(1)
    setLoggingEntry(false)
  }

  const getChartData = (skill: Skill) =>
    skill.entries.map((e, i) => ({
      name: `#${i + 1}`,
      date: new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      confidence: e.score,
    }))

  if (loading) return <p className="text-sm text-muted-text py-10 text-center">Loading…</p>

  return (
    <>
      <style>{`
        @keyframes confetti-fall {
          to { transform: translateY(100vh) rotate(360deg); opacity: 0; }
        }
        .animate-confetti-fall { animation: confetti-fall 3s ease-out forwards; }
        .ct-card {
          background: var(--color-surface);
          border: 3px solid var(--color-border);
          box-shadow: 6px 6px 0 var(--color-border);
          transition: box-shadow 0.15s, transform 0.15s;
        }
        .ct-card:hover { transform: translate(-2px,-2px); box-shadow: 8px 8px 0 var(--color-border); }
        .ct-btn {
          background: var(--color-teal-primary);
          border: 3px solid var(--color-border);
          box-shadow: 4px 4px 0 var(--color-border);
          color: white;
          transition: all 0.15s;
        }
        .ct-btn:hover { transform: translate(-1px,-1px); box-shadow: 5px 5px 0 var(--color-border); }
        .ct-btn:active { transform: translate(2px,2px); box-shadow: 2px 2px 0 var(--color-border); }
        .ct-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .ct-input {
          border: 3px solid var(--color-border);
          background: var(--color-background);
          color: var(--color-dark-text);
        }
        .ct-input:focus { outline: none; box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-teal-primary) 30%, transparent); }
        input[type=range].ct-range {
          -webkit-appearance: none; width: 100%; height: 12px;
          background: linear-gradient(to right, #ef4444 0%, #f59e0b 50%, var(--color-teal-primary) 100%);
          border: 3px solid var(--color-border); border-radius: 8px; outline: none;
        }
        input[type=range].ct-range::-webkit-slider-thumb {
          -webkit-appearance: none; width: 30px; height: 30px;
          background: var(--color-surface); border: 4px solid var(--color-border);
          border-radius: 50%; cursor: pointer;
        }
        input[type=range].ct-range::-moz-range-thumb {
          width: 30px; height: 30px;
          background: var(--color-surface); border: 4px solid var(--color-border);
          border-radius: 50%; cursor: pointer;
        }
      `}</style>

      {showConfetti && <Confetti />}

      {/* Goal met celebration */}
      {celebrationSkill && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[150] p-6">
          <div className="ct-card rounded-2xl p-8 max-w-sm w-full text-center">
            <div className="text-5xl mb-3">🎉</div>
            <h2 className="text-2xl font-bold text-dark-text mb-2">Goal Reached!</h2>
            <p className="text-muted-text mb-6">You hit your confidence goal for <strong className="text-dark-text">{celebrationSkill}</strong>! Keep it up.</p>
            <button onClick={() => setCelebrationSkill(null)} className="ct-btn px-6 py-3 rounded-xl font-bold w-full">
              Awesome! 🚀
            </button>
          </div>
        </div>
      )}

      {/* Mastery celebration */}
      {masterySkill && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[150] p-6">
          <div className="ct-card rounded-2xl p-8 max-w-sm w-full text-center">
            <div className="text-5xl mb-3">🌟</div>
            <h2 className="text-2xl font-bold text-dark-text mb-2">Mastered!</h2>
            <p className="text-muted-text mb-6">You reached a 10 in <strong className="text-dark-text">{masterySkill}</strong>! You can teach this to anyone.</p>
            <button onClick={() => setMasterySkill(null)} className="ct-btn px-6 py-3 rounded-xl font-bold w-full">
              Let&apos;s go! ✨
            </button>
          </div>
        </div>
      )}

      {/* Log modal */}
      {selectedSkill && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-[100] p-6 overflow-y-auto pt-16">
          <div className="ct-card rounded-2xl p-8 max-w-lg w-full mb-16">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-dark-text">
                  {selectedSkill.entries.length === 0 ? 'Log Your Confidence' : 'Check In'}
                </h2>
                <p className="text-muted-text mt-1">Tracking: <strong className="text-dark-text">{selectedSkill.name}</strong></p>
              </div>
              <button onClick={() => setSelectedSkill(null)} className="p-1.5 text-muted-text hover:text-dark-text transition-colors" aria-label="Close">
                <X size={20} />
              </button>
            </div>

            {/* Score display */}
            <div className="text-center mb-4">
              <div className="text-6xl font-bold text-teal-primary" style={{ fontFamily: 'var(--font-inter, sans-serif)' }}>
                {confidenceScore}
              </div>
              <p className="text-muted-text text-sm font-semibold">out of 10</p>
              <p className="mt-2 text-sm font-medium text-dark-text min-h-[24px]">{SCORE_LABELS[confidenceScore]}</p>
            </div>

            {/* Slider */}
            <div className="mb-8 px-1">
              <input
                type="range"
                min={1} max={10}
                value={confidenceScore}
                onChange={e => setConfidenceScore(parseInt(e.target.value))}
                className="ct-range w-full mb-3"
                aria-label="Confidence score"
              />
              <div className="flex justify-between text-xs font-semibold text-muted-text px-0.5">
                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <span key={n} title={SCORE_LABELS[n]}>{n}</span>
                ))}
              </div>
            </div>

            {/* Goal (only show if score < 10) */}
            {confidenceScore < 10 && (
              <div className="mb-6">
                <label className="block text-sm font-semibold text-dark-text mb-2">
                  Confidence goal for next check-in:
                </label>
                <select
                  value={goalPoints}
                  onChange={e => setGoalPoints(parseInt(e.target.value))}
                  className="ct-input w-full px-4 py-3 rounded-xl text-base font-semibold"
                >
                  {[1,2,3,4,5].map(n => (
                    <option key={n} value={n}>+{n} point{n !== 1 ? 's' : ''} (reach {Math.min(10, confidenceScore + n)})</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={logEntry} disabled={loggingEntry} className="ct-btn flex-1 px-6 py-3 rounded-xl font-bold">
                {loggingEntry ? 'Saving…' : 'Log Score'}
              </button>
              <button
                onClick={() => setSelectedSkill(null)}
                className="px-6 py-3 rounded-xl font-bold ct-input hover:bg-border/10 transition-colors"
              >
                Cancel
              </button>
            </div>

            <p className="text-xs text-muted-text text-center mt-4">
              {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>
      )}

      {/* Page content */}
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-dark-text mb-2">Confidence Tracker</h1>
          <p className="text-muted-text">Welcome back, <span className="font-semibold text-teal-primary">{userName}</span></p>
          <p className="text-sm text-muted-text mt-1">Track your coding skills and watch your confidence grow</p>
        </div>

        {/* Legend */}
        <div className="ct-card rounded-2xl p-6 mb-8">
          <h2 className="text-xl font-bold text-dark-text mb-4 text-center">Confidence Level Guide</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
            {[
              { range: '1–2', label: 'Just learning', bg: 'bg-red-50 dark:bg-red-950/30' },
              { range: '3–4', label: 'Following along', bg: 'bg-orange-50 dark:bg-orange-950/30' },
              { range: '5–6', label: 'Understanding basics', bg: 'bg-yellow-50 dark:bg-yellow-950/30' },
              { range: '7–8', label: 'Solving problems', bg: 'bg-teal-light' },
              { range: '9–10', label: 'Can teach others', bg: 'bg-green-50 dark:bg-green-950/30' },
            ].map(({ range, label, bg }) => (
              <div key={range} className={`text-center p-3 rounded-lg border-2 border-border ${bg}`}>
                <div className="font-bold text-xl text-dark-text mb-1">{range}</div>
                <div className="text-xs text-muted-text">{label}</div>
              </div>
            ))}
          </div>
          <details className="mt-2">
            <summary className="text-sm text-teal-primary font-semibold cursor-pointer hover:underline text-center list-none">
              View detailed descriptions ↓
            </summary>
            <div className="mt-3 space-y-1.5 text-sm text-dark-text">
              {Object.entries(SCORE_LABELS).map(([n, label]) => (
                <div key={n} className="flex gap-2"><strong>{n}:</strong> <span>{label}</span></div>
              ))}
            </div>
          </details>
        </div>

        {/* Add skill */}
        <div className="mb-8">
          {!showForm ? (
            <div className="text-center">
              <button onClick={() => setShowForm(true)} className="ct-btn px-8 py-3 rounded-xl font-bold inline-flex items-center gap-2">
                <Plus size={20} /> Track a New Skill
              </button>
            </div>
          ) : (
            <div className="ct-card rounded-2xl p-6">
              <h2 className="text-xl font-bold text-dark-text mb-4">What skill are you working on?</h2>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newSkill}
                  onChange={e => setNewSkill(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addSkill()}
                  placeholder="e.g., React Components, SQL Joins, CSS Flexbox…"
                  className="ct-input flex-1 px-4 py-3 rounded-xl text-base"
                  autoFocus
                />
                <button onClick={addSkill} disabled={saving || !newSkill.trim()} className="ct-btn px-6 py-3 rounded-xl font-bold">
                  {saving ? 'Adding…' : 'Add'}
                </button>
                <button onClick={() => { setShowForm(false); setNewSkill('') }} className="px-6 py-3 rounded-xl font-bold ct-input hover:bg-border/10 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Empty state */}
        {skills.length === 0 && !showForm && (
          <div className="text-center py-16">
            <Target size={56} className="mx-auto mb-4 text-teal-primary opacity-60" />
            <p className="text-lg text-muted-text">No skills tracked yet. Start building your confidence!</p>
          </div>
        )}

        {/* Skills grid */}
        <div className="grid sm:grid-cols-2 gap-6">
          {skills.map(skill => {
            const latest = skill.entries[skill.entries.length - 1]
            const latestScore = latest?.score ?? null
            const firstScore = skill.entries[0]?.score ?? null
            const progress = firstScore !== null && latestScore !== null ? latestScore - firstScore : null
            const isMastered = latestScore === 10
            const chartData = getChartData(skill)

            return (
              <div key={skill.id} className="ct-card rounded-2xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-dark-text leading-tight">{skill.name}</h3>
                    <p className="text-sm text-muted-text mt-0.5">
                      {skill.entries.length} {skill.entries.length === 1 ? 'entry' : 'entries'} logged
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {latestScore !== null && (
                      <span className="text-2xl font-bold text-teal-primary">{latestScore}<span className="text-sm text-muted-text font-normal">/10</span></span>
                    )}
                    {progress !== null && progress !== 0 && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border-2 border-border ${progress > 0 ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'}`}>
                        {progress > 0 ? '+' : ''}{progress}
                      </span>
                    )}
                    <button
                      onClick={() => removeSkill(skill.id)}
                      className="p-1.5 text-muted-text hover:text-red-500 transition-colors"
                      aria-label={`Remove ${skill.name}`}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Chart */}
                {chartData.length > 0 && (
                  <div className="mb-4 bg-teal-light/40 rounded-xl p-3 border-2 border-border">
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-muted-text)' }} stroke="var(--color-border)" />
                        <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ fontSize: 11, fill: 'var(--color-muted-text)' }} stroke="var(--color-border)" />
                        <Tooltip
                          contentStyle={{ border: '2px solid var(--color-border)', borderRadius: '8px', background: 'var(--color-surface)', color: 'var(--color-dark-text)' }}
                          formatter={(v) => [v, 'Confidence']}
                          labelFormatter={(_: unknown, payload: readonly {payload?: {date?: string}}[]) => payload?.[0]?.payload?.date ?? ''}
                        />
                        <Line
                          type="monotone"
                          dataKey="confidence"
                          stroke="var(--color-teal-primary)"
                          strokeWidth={3}
                          dot={{ fill: 'var(--color-teal-primary)', strokeWidth: 2, r: 5, stroke: 'var(--color-border)' }}
                          activeDot={{ r: 7 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Practice plan summary */}
                {latest && !isMastered && (
                  <div className="mb-4 rounded-xl p-3 border-2 border-teal-primary/40 bg-teal-light/30 text-sm text-dark-text">
                    Last score: <strong>{latest.score}</strong> — &ldquo;{SCORE_LABELS[latest.score]}&rdquo;
                    {latest.goal_points && (
                      <span className="block mt-1 text-muted-text">
                        Goal: reach <strong className="text-teal-primary">{Math.min(10, latest.score + latest.goal_points)}</strong> next check-in
                      </span>
                    )}
                  </div>
                )}

                {isMastered && (
                  <div className="mb-4 rounded-xl p-3 border-2 border-yellow-500/40 bg-yellow-50 dark:bg-yellow-950/30 text-sm text-center">
                    <Sparkles size={16} className="inline mr-1 text-yellow-500" />
                    <span className="font-semibold text-yellow-700 dark:text-yellow-400">Mastered! You can teach this skill.</span>
                  </div>
                )}

                {!isMastered && (
                  <button onClick={() => openLog(skill)} className="ct-btn w-full py-3 rounded-xl font-bold inline-flex items-center justify-center gap-2">
                    <Target size={18} />
                    {skill.entries.length === 0 ? 'Log First Score' : 'Log New Score'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
