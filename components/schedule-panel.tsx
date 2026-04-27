"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Schedule, detectConflicts, DAY_LABELS, WEEKDAYS, WEEKEND, timeStringToMinutes } from "@/lib/schedule-engine"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Plus, Trash2, AlertTriangle, Clock, CalendarDays, Edit2 } from "lucide-react"

// ─────────────────────────────────────────────────────────────────
// Default form state
// ─────────────────────────────────────────────────────────────────
const DEFAULT_FORM = {
    name: "",
    start_time: "09:00",
    end_time: "18:00",
    days_of_week: [1, 2, 3, 4, 5] as number[],
    start_date: "",
    end_date: "",
    priority: 0,
    is_active: true,
}

// ─────────────────────────────────────────────────────────────────
// PROJECT COLORS (deterministic per project_id first char)
// ─────────────────────────────────────────────────────────────────
const PROJECT_COLORS = [
    'bg-indigo-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500',
    'bg-rose-500', 'bg-cyan-500', 'bg-pink-500', 'bg-teal-500'
]
export function projectColor(projectId: string, index = 0) {
    const charCode = projectId.charCodeAt(0) || 0
    return PROJECT_COLORS[(charCode + index) % PROJECT_COLORS.length]
}

// ─────────────────────────────────────────────────────────────────
// WEEKLY MINI-CALENDAR display
// ─────────────────────────────────────────────────────────────────
function WeeklyCalendar({ schedules, conflictIds }: { schedules: Schedule[], conflictIds: Set<string> }) {
    const HOURS = Array.from({ length: 24 }, (_, i) => i)

    return (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
            {/* Header: days */}
            <div className="grid grid-cols-[40px_repeat(7,1fr)] text-[10px] font-semibold uppercase tracking-widest text-slate-500 border-b border-slate-100 dark:border-slate-800">
                <div className="p-1" />
                {DAY_LABELS.map(d => (
                    <div key={d} className="p-1 text-center">{d}</div>
                ))}
            </div>

            {/* Body: hours × days */}
            <div className="relative">
                {HOURS.map(hour => (
                    <div key={hour} className="grid grid-cols-[40px_repeat(7,1fr)] min-h-[24px] border-b border-slate-50 dark:border-slate-900">
                        <div className="text-[9px] font-mono text-slate-400 p-1 text-right pr-2 leading-none">
                            {hour === 0 ? '12a' : hour < 12 ? `${hour}a` : hour === 12 ? '12p' : `${hour - 12}p`}
                        </div>
                        {Array.from({ length: 7 }, (_, dow) => {
                            const slotMinStart = hour * 60
                            const slotMinEnd = slotMinStart + 60

                            const matchingSchedules = schedules.filter(s => {
                                if (!s.start_time || !s.end_time) return false
                                if (!s.days_of_week.includes(dow)) return false
                                const sMin = timeStringToMinutes(s.start_time)
                                const eMin = timeStringToMinutes(s.end_time)
                                return sMin < slotMinEnd && eMin > slotMinStart
                            })

                            return (
                                <div key={dow} className="relative border-l border-slate-50 dark:border-slate-900">
                                    {matchingSchedules.map((s, idx) => {
                                        const isConflict = conflictIds.has(s.id)
                                        const color = isConflict ? 'bg-red-400' : projectColor(s.project_id, idx)
                                        return (
                                            <div
                                                key={s.id}
                                                title={`${s.name} (${s.start_time?.slice(0, 5)}–${s.end_time?.slice(0, 5)})`}
                                                className={`absolute inset-x-0.5 rounded-sm opacity-80 ${color} ${!s.is_active ? 'opacity-30' : ''}`}
                                                style={{ top: '1px', bottom: '1px' }}
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
    )
}

// ─────────────────────────────────────────────────────────────────
// SCHEDULE FORM DIALOG
// ─────────────────────────────────────────────────────────────────
interface ScheduleFormProps {
    open: boolean
    onClose: () => void
    projectId: string
    existing?: Schedule | null
    onSaved: () => void
}

function ScheduleFormDialog({ open, onClose, projectId, existing, onSaved }: ScheduleFormProps) {
    const supabase = createClient()
    const { toast } = useToast()
    const [form, setForm] = useState(existing ? {
        name: existing.name,
        start_time: existing.start_time?.slice(0, 5) || "09:00",
        end_time: existing.end_time?.slice(0, 5) || "18:00",
        days_of_week: existing.days_of_week,
        start_date: existing.start_date || "",
        end_date: existing.end_date || "",
        priority: existing.priority ?? 0,
        is_active: existing.is_active,
    } : { ...DEFAULT_FORM })
    const [saving, setSaving] = useState(false)

    const toggleDay = (dow: number) => {
        setForm(f => ({
            ...f,
            days_of_week: f.days_of_week.includes(dow)
                ? f.days_of_week.filter(d => d !== dow)
                : [...f.days_of_week, dow].sort()
        }))
    }

    const handleSave = async () => {
        if (!form.name.trim()) {
            toast({ title: "Schedule name is required", variant: "destructive" })
            return
        }
        if (!form.start_time || !form.end_time) {
            toast({ title: "Start and end time required", variant: "destructive" })
            return
        }
        if (form.days_of_week.length === 0) {
            toast({ title: "Select at least one day", variant: "destructive" })
            return
        }

        setSaving(true)
        try {
            const payload = {
                project_id: projectId,
                name: form.name.trim(),
                start_time: form.start_time + ':00',
                end_time: form.end_time + ':00',
                days_of_week: form.days_of_week,
                start_date: form.start_date || null,
                end_date: form.end_date || null,
                priority: form.priority,
                is_active: form.is_active,
            }

            if (existing) {
                const { error } = await supabase.from('schedules').update(payload).eq('id', existing.id)
                if (error) throw error
                toast({ title: "Schedule updated" })
            } else {
                const { error } = await supabase.from('schedules').insert(payload)
                if (error) throw error
                toast({ title: "Schedule created" })
            }

            onSaved()
            onClose()
        } catch (err) {
            toast({ title: "Failed to save schedule", variant: "destructive", description: (err as Error).message })
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={v => !v && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{existing ? 'Edit Schedule Rule' : 'New Schedule Rule'}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Name */}
                    <div className="space-y-1.5">
                        <Label className="text-sm">Rule Name</Label>
                        <Input
                            placeholder="e.g. Morning Promo"
                            value={form.name}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        />
                    </div>

                    {/* Time range */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-sm flex items-center gap-1.5"><Clock className="h-3 w-3" /> Start Time</Label>
                            <Input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm flex items-center gap-1.5"><Clock className="h-3 w-3" /> End Time</Label>
                            <Input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
                        </div>
                    </div>

                    {/* Days */}
                    <div className="space-y-2">
                        <Label className="text-sm">Active Days</Label>
                        <div className="flex gap-1.5 flex-wrap">
                            {DAY_LABELS.map((label, dow) => (
                                <button
                                    key={dow}
                                    type="button"
                                    onClick={() => toggleDay(dow)}
                                    className={`h-8 w-8 rounded-md text-xs font-bold transition-all ${form.days_of_week.includes(dow)
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'
                                        }`}
                                >
                                    {label[0]}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2 mt-1">
                            <Button variant="outline" size="sm" type="button" className="h-6 text-xs px-2"
                                onClick={() => setForm(f => ({ ...f, days_of_week: WEEKDAYS }))}>
                                Weekdays
                            </Button>
                            <Button variant="outline" size="sm" type="button" className="h-6 text-xs px-2"
                                onClick={() => setForm(f => ({ ...f, days_of_week: WEEKEND }))}>
                                Weekend
                            </Button>
                            <Button variant="outline" size="sm" type="button" className="h-6 text-xs px-2"
                                onClick={() => setForm(f => ({ ...f, days_of_week: [0, 1, 2, 3, 4, 5, 6] }))}>
                                Every Day
                            </Button>
                        </div>
                    </div>

                    {/* Date range */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-sm flex items-center gap-1.5"><CalendarDays className="h-3 w-3" /> Start Date <span className="text-slate-400">(opt)</span></Label>
                            <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm flex items-center gap-1.5"><CalendarDays className="h-3 w-3" /> End Date <span className="text-slate-400">(opt)</span></Label>
                            <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                        </div>
                    </div>

                    {/* Priority + Active */}
                    <div className="flex items-center justify-between">
                        <div className="space-y-1.5">
                            <Label className="text-sm">Priority</Label>
                            <Input
                                type="number"
                                min={0}
                                max={100}
                                value={form.priority}
                                onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))}
                                className="w-24 h-8"
                            />
                            <p className="text-[10px] text-slate-400">Higher wins conflicts</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch
                                id="is_active_toggle"
                                checked={form.is_active}
                                onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))}
                            />
                            <Label htmlFor="is_active_toggle" className="text-sm">Enabled</Label>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving...' : existing ? 'Update Rule' : 'Create Rule'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// ─────────────────────────────────────────────────────────────────
// MAIN EXPORTED COMPONENT
// ─────────────────────────────────────────────────────────────────
interface SchedulePanelProps {
    schedules: Schedule[]
    projectId: string
    onRefresh: () => void
}

export function SchedulePanel({ schedules, projectId, onRefresh }: SchedulePanelProps) {
    const supabase = createClient()
    const { toast } = useToast()
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)

    const conflictIds = detectConflicts(schedules)

    const handleDelete = async (id: string) => {
        try {
            await supabase.from('schedules').delete().eq('id', id)
            toast({ title: "Schedule removed" })
            onRefresh()
        } catch {
            toast({ title: "Failed to delete", variant: "destructive" })
        }
    }

    const openNew = () => { setEditingSchedule(null); setDialogOpen(true) }
    const openEdit = (s: Schedule) => { setEditingSchedule(s); setDialogOpen(true) }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <Label className="text-sm font-bold">Time-Based Schedule Rules</Label>
                <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={openNew}>
                    <Plus className="h-3 w-3 mr-1" /> Add Rule
                </Button>
            </div>

            {/* Conflict warning */}
            {conflictIds.size > 0 && (
                <div className="flex gap-2 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/40 rounded-lg p-3">
                    <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700 dark:text-red-400">
                        {conflictIds.size / 2} overlapping rules detected across projects sharing this screen. The highest-priority rule wins.
                    </p>
                </div>
            )}

            {/* Mini calendar view */}
            {schedules.length > 0 && (
                <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wider text-slate-400">Weekly Overview</Label>
                    <WeeklyCalendar schedules={schedules} conflictIds={conflictIds} />
                </div>
            )}

            {/* Schedule list */}
            {schedules.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-slate-500 bg-white/50 dark:bg-slate-950/50">
                    <CalendarDays className="h-6 w-6 mx-auto mb-2 opacity-40" />
                    <p className="text-xs font-medium">No rules configured.</p>
                    <p className="text-[10px] text-slate-400 mt-1">Add a rule to show this project at specific times.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {schedules.map(s => {
                        const isConflict = conflictIds.has(s.id)
                        return (
                            <div
                                key={s.id}
                                className={`flex items-center gap-3 p-3 rounded-lg border text-sm transition-colors ${isConflict
                                    ? 'border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-900/40'
                                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950'}`}
                            >
                                {/* Color swatch */}
                                <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${projectColor(s.project_id)}`} />

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">{s.name}</span>
                                        {!s.is_active && <Badge variant="secondary" className="text-[9px] h-4 px-1">Disabled</Badge>}
                                        {isConflict && <Badge className="text-[9px] h-4 px-1 bg-red-500 text-white border-none">Conflict</Badge>}
                                        <Badge variant="outline" className="text-[9px] h-4 px-1 font-mono">P{s.priority}</Badge>
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                                        <span className="font-mono">{s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)}</span>
                                        <span>·</span>
                                        <span>{s.days_of_week.map(d => DAY_LABELS[d]).join(', ')}</span>
                                        {(s.start_date || s.end_date) && (
                                            <>
                                                <span>·</span>
                                                <span>{s.start_date || '∞'} → {s.end_date || '∞'}</span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-indigo-600"
                                        onClick={() => openEdit(s)}>
                                        <Edit2 className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600"
                                        onClick={() => handleDelete(s.id)}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Info note */}
            <div className="bg-amber-50 dark:bg-amber-900/10 p-3 rounded-lg border border-amber-200 dark:border-amber-900/30 flex gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-800 dark:text-amber-400 leading-relaxed">
                    Schedule evaluation runs every 60s on the display device using the location&apos;s timezone. If no rule is active, the screen defaults to the manually-set active project.
                </p>
            </div>

            {/* Dialog */}
            {dialogOpen && (
                <ScheduleFormDialog
                    open={dialogOpen}
                    onClose={() => setDialogOpen(false)}
                    projectId={projectId}
                    existing={editingSchedule}
                    onSaved={onRefresh}
                />
            )}
        </div>
    )
}
