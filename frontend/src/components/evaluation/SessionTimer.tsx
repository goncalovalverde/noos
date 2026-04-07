import { useState, useEffect } from 'react'
import { Timer } from 'lucide-react'

export default function SessionTimer() {
  const [seconds, setSeconds] = useState(0)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>
    if (running) interval = setInterval(() => setSeconds(s => s + 1), 1000)
    return () => clearInterval(interval)
  }, [running])

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="flex items-center gap-3 mb-6 p-3 bg-white rounded-card shadow-card">
      <Timer className="w-4 h-4 text-brand-mid" aria-hidden="true" />
      <span className="font-mono text-lg font-semibold text-brand-dark" aria-label="cronómetro">{fmt(seconds)}</span>
      <div className="flex gap-2 ml-auto">
        <button
          onClick={() => setRunning(r => !r)}
          className="text-xs font-medium px-3 py-1 rounded-btn border border-brand-mid text-brand-mid hover:bg-brand-mid/10 transition-colors"
        >
          {running ? 'Pausar' : 'Iniciar'}
        </button>
        <button onClick={() => { setSeconds(0); setRunning(false) }} className="text-xs text-brand-muted hover:text-brand-ink">
          Reset
        </button>
      </div>
    </div>
  )
}
