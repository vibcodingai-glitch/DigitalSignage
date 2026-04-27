"use client"

import { useEffect, useState } from "react"
import { DAY_LABELS, getNowInTimezone, timeStringToMinutes } from "@/lib/schedule-engine"
import type { ScreenProject } from "@/lib/screen-projects"

// ─────────────────────────────────────────────────────────────────
// PALETTE
// ─────────────────────────────────────────────────────────────────
const PALETTE = [
  { bg: "bg-indigo-500", text: "text-indigo-100", dot: "bg-indigo-500", border: "border-indigo-300" },
  { bg: "bg-violet-500", text: "text-violet-100", dot: "bg-violet-500", border: "border-violet-300" },
  { bg: "bg-emerald-500", text: "text-emerald-100", dot: "bg-emerald-500", border: "border-emerald-300" },
  { bg: "bg-amber-500", text: "text-amber-100", dot: "bg-amber-500", border: "border-amber-300" },
  { bg: "bg-rose-500", text: "text-rose-100", dot: "bg-rose-500", border: "border-rose-300" },
  { bg: "bg-cyan-500", text: "text-cyan-100", dot: "bg-cyan-500", border: "border-cyan-300" },
  { bg: "bg-pink-500", text: "text-pink-100", dot: "bg-pink-500", border: "border-pink-300" },
  { bg: "bg-teal-500", text: "text-teal-100", dot: "bg-teal-500", border: "border-teal-300" },
]

export function getProjectColor(index: number) {
  return PALETTE[index % PALETTE.length]
}

// ─────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────
interface WeeklyScheduleTimelineProps {
  screenProjects: ScreenProject[]
  timezone: string
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const TOTAL_MINUTES = 24 * 60

// ─────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────
export function WeeklyScheduleTimeline({
  screenProjects,
  timezone,
}: WeeklyScheduleTimelineProps) {
  const [now, setNow] = useState(() => getNowInTimezone(timezone))

  // Update time indicator every minute
  useEffect(() => {
    const iv = setInterval(() => setNow(getNowInTimezone(timezone)), 60_000)
    return () => clearInterval(iv)
  }, [timezone])

  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const nowDow = now.getDay()

  // Build a color map: project_id -> palette index
  const projectColorMap: Record<string, number> = {}
  screenProjects.forEach((sp, idx) => {
    if (!(sp.project_id in projectColorMap)) {
      projectColorMap[sp.project_id] = idx
    }
  })

  // Detect conflicts (same day + overlapping time + different project_id + same priority)
  const conflictIds = new Set<string>()
  for (let i = 0; i < screenProjects.length; i++) {
    for (let j = i + 1; j < screenProjects.length; j++) {
      const a = screenProjects[i]
      const b = screenProjects[j]
      if (a.project_id === b.project_id) continue
      if (a.schedule_type !== "scheduled" || b.schedule_type !== "scheduled") continue
      if (a.priority !== b.priority) continue
      const sharedDays = a.days_of_week.filter((d) => b.days_of_week.includes(d))
      if (sharedDays.length === 0) continue
      const sA = timeStringToMinutes(a.start_time)
      const eA = timeStringToMinutes(a.end_time)
      const sB = timeStringToMinutes(b.start_time)
      const eB = timeStringToMinutes(b.end_time)
      if (sA < eB && sB < eA) {
        conflictIds.add(a.id)
        conflictIds.add(b.id)
      }
    }
  }

  // Mobile: show list view
  const scheduledSps = screenProjects.filter((sp) => sp.schedule_type === "scheduled")
  const alwaysSps = screenProjects.filter((sp) => sp.schedule_type === "always")

  if (screenProjects.length === 0) {
    return (
      <div className="text-center py-10 text-slate-500 text-sm border border-dashed rounded-lg">
        No projects assigned to this screen yet.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Mobile list fallback */}
      <div className="block md:hidden space-y-3">
        {screenProjects.map((sp, idx) => {
          const col = getProjectColor(projectColorMap[sp.project_id] ?? idx)
          return (
            <div
              key={sp.id}
              className="flex items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-800 p-3"
            >
              <div className={`h-3 w-3 rounded-full mt-1 shrink-0 ${col.dot}`} />
              <div>
                <p className="font-semibold text-sm">{sp.project?.name}</p>
                {sp.schedule_type === "always" ? (
                  <p className="text-xs text-slate-500">Always On</p>
                ) : (
                  <p className="text-xs text-slate-500">
                    {sp.days_of_week
                      .map((d) => DAY_LABELS[d])
                      .join(", ")}{" "}
                    · {sp.start_time}–{sp.end_time}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Desktop grid */}
      <div className="hidden md:block rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-950">
        {/* Header row */}
        <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div />
          {DAY_LABELS.map((d, dow) => (
            <div
              key={d}
              className={`py-2 text-center text-[10px] font-bold uppercase tracking-widest ${
                dow === nowDow ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"
              }`}
            >
              {d}
              {dow === nowDow && (
                <div className="h-0.5 w-4 bg-indigo-400 mx-auto mt-0.5 rounded-full" />
              )}
            </div>
          ))}
        </div>

        {/* Hour rows */}
        <div className="relative overflow-x-auto">
          <div className="min-w-[560px]">
            {/* Current time indicator */}
            <div
              className="absolute z-10 left-0 right-0 flex pointer-events-none"
              style={{ top: `${(nowMinutes / TOTAL_MINUTES) * 100}%` }}
            >
              <div className="w-[48px]" />
              {Array.from({ length: 7 }, (_, dow) => (
                <div key={dow} className={`flex-1 ${dow === nowDow ? "border-t-2 border-red-500" : ""}`}>
                  {dow === nowDow && (
                    <div className="h-2.5 w-2.5 rounded-full bg-red-500 -mt-[5px] -ml-[5px]" />
                  )}
                </div>
              ))}
            </div>

            {/* Always-on background bars */}
            {alwaysSps.map((sp, idx) => {
              const col = getProjectColor(projectColorMap[sp.project_id] ?? idx)
              return (
                <div
                  key={`always-${sp.id}`}
                  className={`absolute inset-0 ${col.bg} opacity-5 pointer-events-none`}
                  style={{ left: "48px" }}
                  title={`Always On: ${sp.project?.name}`}
                />
              )
            })}

            {HOURS.map((hour) => (
              <div
                key={hour}
                className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-slate-50 dark:border-slate-900/80"
                style={{ height: "32px" }}
              >
                <div className="text-[9px] font-mono text-slate-400 p-1 text-right pr-2 leading-none pt-1.5">
                  {hour === 0
                    ? "12a"
                    : hour < 12
                    ? `${hour}a`
                    : hour === 12
                    ? "12p"
                    : `${hour - 12}p`}
                </div>
                {Array.from({ length: 7 }, (_, dow) => {
                  const slotStart = hour * 60
                  const slotEnd = slotStart + 60

                  const matches = scheduledSps.filter((sp) => {
                    if (!sp.days_of_week.includes(dow)) return false
                    const sMin = timeStringToMinutes(sp.start_time)
                    const eMin = timeStringToMinutes(sp.end_time)
                    return sMin < slotEnd && eMin > slotStart
                  })

                  return (
                    <div key={dow} className="relative border-l border-slate-50 dark:border-slate-900">
                      {matches.map((sp, matchIdx) => {
                        const col = getProjectColor(projectColorMap[sp.project_id] ?? 0)
                        const isConflict = conflictIds.has(sp.id)
                        return (
                          <div
                            key={sp.id}
                            title={`${sp.project?.name}: ${sp.start_time}–${sp.end_time}`}
                            style={{
                              insetInlineStart: `${matchIdx * 25}%`,
                              width: `${100 - matchIdx * 25}%`,
                              top: "1px",
                              bottom: "1px",
                              position: "absolute",
                            }}
                            className={`rounded-sm ${isConflict ? "bg-red-400" : col.bg} opacity-75`}
                          />
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-3">
          {screenProjects.map((sp, idx) => {
            const col = getProjectColor(projectColorMap[sp.project_id] ?? idx)
            return (
              <div key={sp.id} className="flex items-center gap-1.5">
                <div className={`h-2.5 w-2.5 rounded-sm ${col.bg}`} />
                <span className="text-[10px] text-slate-500">{sp.project?.name}</span>
              </div>
            )
          })}
          {conflictIds.size > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-sm bg-red-400" />
              <span className="text-[10px] text-slate-500">Conflict</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
