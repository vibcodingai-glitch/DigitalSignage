"use client"

import React from "react"
import { isScheduleActiveNow, detectConflicts, DAY_LABELS, timeStringToMinutes, getNowInTimezone } from "@/lib/schedule-engine"
import type { Schedule } from "@/lib/schedule-engine"
import { SCHEDULE_PALETTE } from "@/lib/constants/palette"

import { CalendarDays } from "lucide-react"

interface ScheduleTimelineViewProps {
    allSchedules: (Schedule & { project_name: string; project_color: number })[]
    locationTz: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    projects: any[]
}

// ─────────────────────────────────────────────────────────────────
// WEEKLY TIMELINE COMPONENT
// ─────────────────────────────────────────────────────────────────
export const ScheduleTimelineView = React.memo(function ScheduleTimelineView({
    allSchedules,
    locationTz,
    projects,
}: ScheduleTimelineViewProps) {
    const now = getNowInTimezone(locationTz)
    const nowMinutes = now.getHours() * 60 + now.getMinutes()
    const nowDow = now.getDay()
    const conflictIds = detectConflicts(allSchedules)

    // What's active right now?
    const activeNow = allSchedules
        .filter(s => isScheduleActiveNow(s, now))
        .sort((a, b) => b.priority - a.priority)

    // What's coming up next today?
    const upcoming = allSchedules
        .filter(s => s.days_of_week.includes(nowDow) && s.start_time)
        .filter(s => timeStringToMinutes(s.start_time!) > nowMinutes)
        .sort((a, b) => timeStringToMinutes(a.start_time!) - timeStringToMinutes(b.start_time!))

    const HOURS = Array.from({ length: 24 }, (_, i) => i)
    const TOTAL_MINUTES = 24 * 60

    if (allSchedules.length === 0) {
        return (
            <div className="text-center py-16 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-500">
                <CalendarDays className="h-8 w-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No schedules configured</p>
                <p className="text-xs text-slate-400 mt-1">Open a project&apos;s editor to add schedule rules.</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Active now + upcoming */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-950">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-3">Active Right Now</p>
                    {activeNow.length === 0 ? (
                        <p className="text-slate-500 text-sm">No scheduled content</p>
                    ) : activeNow.map(s => {
                        const col = SCHEDULE_PALETTE[s.project_color % SCHEDULE_PALETTE.length]
                        return (
                            <div key={s.id} className="flex items-center gap-3">
                                <div className={`h-2.5 w-2.5 rounded-full ${col.bg} animate-pulse`} />
                                <div>
                                    <p className="font-semibold text-sm text-slate-900 dark:text-white">{s.project_name}</p>
                                    <p className="text-[10px] text-slate-400 font-mono">{s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)} · <span className="uppercase">{locationTz}</span></p>
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-950">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-3">Coming Up Today</p>
                    {upcoming.length === 0 ? (
                        <p className="text-slate-500 text-sm">Nothing more scheduled today</p>
                    ) : upcoming.slice(0, 3).map(s => {
                        const col = SCHEDULE_PALETTE[s.project_color % SCHEDULE_PALETTE.length]
                        const startsIn = timeStringToMinutes(s.start_time!) - nowMinutes
                        return (
                            <div key={s.id} className="flex items-center gap-3 mb-2">
                                <div className={`h-2 w-2 rounded-full ${col.bg} opacity-60`} />
                                <div>
                                    <p className="font-medium text-sm text-slate-700 dark:text-slate-300">{s.project_name}</p>
                                    <p className="text-[10px] text-slate-400 font-mono">
                                        {s.start_time?.slice(0, 5)} · in {startsIn < 60 ? `${startsIn}m` : `${Math.floor(startsIn / 60)}h ${startsIn % 60}m`}
                                    </p>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Weekly grid */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-950">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Weekly Timeline</p>
                    <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-white ring-2 ring-red-500 ring-offset-1" />
                        <span className="text-[10px] font-mono text-slate-400">Current time ({locationTz})</span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <div className="min-w-[640px]">
                        {/* Day column headers */}
                        <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                            <div />
                            {DAY_LABELS.map((d, dow) => (
                                <div key={d} className={`py-2 text-center text-[10px] font-bold uppercase tracking-widest ${dow === nowDow ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
                                    {d}
                                    {dow === nowDow && <div className="h-0.5 w-4 bg-indigo-400 mx-auto mt-0.5 rounded-full" />}
                                </div>
                            ))}
                        </div>

                        {/* Hour rows */}
                        <div className="relative">
                            {/* Current time indicator line (only in today's column) */}
                            <div
                                className="absolute z-10 left-0 right-0 flex"
                                style={{ top: `${(nowMinutes / TOTAL_MINUTES) * 100}%` }}
                            >
                                <div className="w-[48px]" />
                                {Array.from({ length: 7 }, (_, dow) => (
                                    <div key={dow} className={`flex-1 ${dow === nowDow ? 'border-t-2 border-red-500' : ''}`}>
                                        {dow === nowDow && (
                                            <div className="h-2.5 w-2.5 rounded-full bg-red-500 -mt-[5px] -ml-[5px]" />
                                        )}
                                    </div>
                                ))}
                            </div>

                            {HOURS.map(hour => (
                                <div
                                    key={hour}
                                    className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-slate-50 dark:border-slate-900/80"
                                    style={{ height: '32px' }}
                                >
                                    <div className="text-[9px] font-mono text-slate-400 p-1 text-right pr-2 leading-none pt-1.5">
                                        {hour === 0 ? '12a' : hour < 12 ? `${hour}a` : hour === 12 ? '12p' : `${hour - 12}p`}
                                    </div>
                                    {Array.from({ length: 7 }, (_, dow) => {
                                        const slotStart = hour * 60
                                        const slotEnd = slotStart + 60

                                        const matches = allSchedules.filter(s => {
                                            if (!s.start_time || !s.end_time) return false
                                            if (!s.days_of_week.includes(dow)) return false
                                            const sMin = timeStringToMinutes(s.start_time)
                                            const eMin = timeStringToMinutes(s.end_time)
                                            return sMin < slotEnd && eMin > slotStart
                                        })

                                        return (
                                            <div key={dow} className="relative border-l border-slate-50 dark:border-slate-900">
                                                {matches.map((s, idx) => {
                                                    const col = SCHEDULE_PALETTE[s.project_color % SCHEDULE_PALETTE.length]
                                                    const isConflict = conflictIds.has(s.id)
                                                    return (
                                                        <div
                                                            key={s.id}
                                                            title={`${s.project_name}: ${s.start_time?.slice(0, 5)}–${s.end_time?.slice(0, 5)}`}
                                                            style={{
                                                                insetInlineStart: `${idx * 25}%`,
                                                                width: `${100 - idx * 25}%`,
                                                                top: '1px',
                                                                bottom: '1px',
                                                                position: 'absolute'
                                                            }}
                                                            className={`rounded-sm ${isConflict ? 'bg-red-400' : col.bg} opacity-75`}
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
                </div>

                {/* Legend */}
                <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-3">
                    {projects.map((p, idx) => {
                        const col = SCHEDULE_PALETTE[idx % SCHEDULE_PALETTE.length]
                        const hasSchedules = allSchedules.some(s => s.project_id === p.id)
                        if (!hasSchedules) return null
                        return (
                            <div key={p.id} className="flex items-center gap-1.5">
                                <div className={`h-2.5 w-2.5 rounded-sm ${col.bg}`} />
                                <span className="text-[10px] text-slate-500">{p.name}</span>
                            </div>
                        )
                    })}
                    <div className="flex items-center gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-sm bg-red-400" />
                        <span className="text-[10px] text-slate-500">Conflict</span>
                    </div>
                </div>
            </div>
        </div>
    )
})
