"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { assignProjectToScreen, updateScreenProject } from "@/lib/screen-projects"
import type { ScreenProject, AssignProjectInput } from "@/lib/screen-projects"
import { DAY_LABELS } from "@/lib/schedule-engine"
import { useToast } from "@/hooks/use-toast"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, CalendarDays, Clock } from "lucide-react"

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

interface Project {
  id: string
  name: string
  _playlist_count?: number
  layout_type?: 'fullscreen' | 'split_horizontal' | 'split_vertical' | 'l_shape' | 'grid_2x2' | 'main_ticker'
  layout_settings?: Record<string, any>
}

interface AssignProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  screenId: string
  organizationId: string
  alreadyAssignedProjectIds: string[]
  existingAssignments: ScreenProject[]
  onSuccess: () => void
  // Pass to open as edit mode
  editTarget?: ScreenProject | null
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]
const WEEKDAYS = [1, 2, 3, 4, 5]
const WEEKEND = [0, 6]

// ─────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────

export function AssignProjectDialog({
  open,
  onOpenChange,
  screenId,
  organizationId,
  alreadyAssignedProjectIds,
  existingAssignments,
  onSuccess,
  editTarget,
}: AssignProjectDialogProps) {
  const supabase = createClient()
  const { toast } = useToast()

  const isEdit = !!editTarget

  // Form state
  const [availableProjects, setAvailableProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>("")
  const [scheduleType, setScheduleType] = useState<"always" | "scheduled">("always")
  const [selectedDays, setSelectedDays] = useState<number[]>(ALL_DAYS)
  const [startTime, setStartTime] = useState("09:00")
  const [endTime, setEndTime] = useState("17:00")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [priority, setPriority] = useState(0)
  const [showDateRange, setShowDateRange] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Load available projects
  useEffect(() => {
    if (!open || !organizationId) return
    const load = async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, name")
        .eq("organization_id", organizationId)
        .order("name")

      if (data) {
        // Filter out already assigned (unless editing)
        const filtered = isEdit
          ? data
          : data.filter((p) => !alreadyAssignedProjectIds.includes(p.id))
        setAvailableProjects(filtered as Project[])
      }
    }
    load()
  }, [open, organizationId, alreadyAssignedProjectIds, isEdit, supabase])

  // Pre-fill in edit mode
  useEffect(() => {
    if (editTarget) {
      setSelectedProjectId(editTarget.project_id)
      setScheduleType(editTarget.schedule_type)
      setSelectedDays(editTarget.days_of_week)
      setStartTime(editTarget.start_time)
      setEndTime(editTarget.end_time)
      setStartDate(editTarget.start_date || "")
      setEndDate(editTarget.end_date || "")
      setPriority(editTarget.priority)
      setShowDateRange(!!(editTarget.start_date || editTarget.end_date))
    } else {
      // Reset
      setSelectedProjectId("")
      setScheduleType("always")
      setSelectedDays(ALL_DAYS)
      setStartTime("09:00")
      setEndTime("17:00")
      setStartDate("")
      setEndDate("")
      setPriority(0)
      setShowDateRange(false)
    }
  }, [editTarget, open])

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    )
  }

  const handleSave = async () => {
    if (!isEdit && !selectedProjectId) {
      toast({ title: "Please select a project", variant: "destructive" })
      return
    }

    if (scheduleType === "scheduled" && selectedDays.length === 0) {
      toast({ title: "Please select at least one day", variant: "destructive" })
      return
    }

    if (scheduleType === "scheduled" && startTime >= endTime) {
      toast({ title: "End time must be after start time", variant: "destructive" })
      return
    }

    setIsSaving(true)
    try {
      if (isEdit && editTarget) {
        await updateScreenProject(editTarget.id, {
          schedule_type: scheduleType,
          days_of_week: scheduleType === "scheduled" ? selectedDays : ALL_DAYS,
          start_time: scheduleType === "scheduled" ? startTime : "00:00",
          end_time: scheduleType === "scheduled" ? endTime : "23:59",
          start_date: scheduleType === "scheduled" && startDate ? startDate : null,
          end_date: scheduleType === "scheduled" && endDate ? endDate : null,
          priority,
        })
        toast({ title: "Schedule updated successfully" })
      } else {
        const payload: AssignProjectInput = {
          screen_id: screenId,
          project_id: selectedProjectId,
          organization_id: organizationId,
          schedule_type: scheduleType,
          days_of_week: scheduleType === "scheduled" ? selectedDays : ALL_DAYS,
          start_time: scheduleType === "scheduled" ? startTime : "00:00",
          end_time: scheduleType === "scheduled" ? endTime : "23:59",
          start_date: scheduleType === "scheduled" && startDate ? startDate : null,
          end_date: scheduleType === "scheduled" && endDate ? endDate : null,
          priority,
        }
        await assignProjectToScreen(payload)
        toast({ title: "Project assigned successfully" })
      }
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      toast({
        title: isEdit ? "Failed to update schedule" : "Failed to assign project",
        description: (err as Error).message,
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Conflict + always-on warnings
  const selectedProject = availableProjects.find((p) => p.id === selectedProjectId)
  const alwaysOnExists = existingAssignments.some(
    (a) => a.schedule_type === "always" && (!isEdit || a.id !== editTarget?.id)
  )

  const hasOverlapWarning =
    scheduleType === "scheduled" &&
    existingAssignments.some((a) => {
      if (a.schedule_type !== "scheduled") return false
      if (isEdit && a.id === editTarget?.id) return false
      if (a.priority !== priority) return false
      const sharedDays = a.days_of_week.filter((d) => selectedDays.includes(d))
      if (sharedDays.length === 0) return false
      return startTime < a.end_time && a.start_time < endTime
    })

  const overlapProject = hasOverlapWarning
    ? existingAssignments.find((a) => {
        if (a.schedule_type !== "scheduled") return false
        if (isEdit && a.id === editTarget?.id) return false
        if (a.priority !== priority) return false
        const sharedDays = a.days_of_week.filter((d) => selectedDays.includes(d))
        if (sharedDays.length === 0) return false
        return startTime < a.end_time && a.start_time < endTime
      })
    : null

  const editTargetProjectName =
    editTarget?.project?.name ||
    availableProjects.find((p) => p.id === editTarget?.project_id)?.name ||
    "this project"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? `Edit Schedule for ${editTargetProjectName}`
              : "Assign Project to Screen"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the schedule settings for this project assignment."
              : "Choose a project and configure when it should play on this screen."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Step 1: Select Project (only for new assignments) */}
          {!isEdit && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Select Project</Label>
              {availableProjects.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 p-4 text-center text-sm text-slate-500">
                  All your projects are already assigned to this screen.{" "}
                  <a
                    href="/dashboard/projects"
                    className="text-indigo-600 hover:underline"
                  >
                    Create a new project
                  </a>{" "}
                  first.
                </div>
              ) : (
                <div className="grid gap-2">
                  {availableProjects.map((proj) => (
                    <button
                      key={proj.id}
                      type="button"
                      onClick={() => setSelectedProjectId(proj.id)}
                      className={`w-full text-left rounded-lg border px-4 py-3 transition-all text-sm ${
                        selectedProjectId === proj.id
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 dark:border-indigo-400"
                          : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      <div className="font-medium">{proj.name}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Schedule Type */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Schedule Type</Label>
            <div className="grid gap-2">
              {(["always", "scheduled"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setScheduleType(type)}
                  className={`w-full text-left rounded-lg border px-4 py-3 transition-all ${
                    scheduleType === type
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 dark:border-indigo-400"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                  }`}
                >
                  <div className="font-medium text-sm">
                    {type === "always" ? "Always On (Default Fallback)" : "Scheduled (Specific Times)"}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {type === "always"
                      ? "Plays whenever no scheduled project matches. Only one Always-On project recommended."
                      : "Only plays during the days and times you specify below."}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Warnings */}
          {scheduleType === "always" && alwaysOnExists && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/10 p-3 text-sm text-amber-800 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Another project is already set as Always On. Having two Always On projects may cause
                unpredictable behavior. Consider using a schedule instead.
              </span>
            </div>
          )}

          {hasOverlapWarning && overlapProject && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/10 p-3 text-sm text-amber-800 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                This schedule overlaps with{" "}
                <strong>{overlapProject.project?.name || "another project"}</strong> at the same
                priority level. Consider setting a higher priority to resolve conflicts.
              </span>
            </div>
          )}

          {/* Scheduled options */}
          {scheduleType === "scheduled" && (
            <div className="space-y-4 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
              {/* Days */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" /> Days
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {DAY_LABELS.map((label, i) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleDay(i)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                        selectedDays.includes(i)
                          ? "bg-indigo-500 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  {[
                    { label: "Weekdays", days: WEEKDAYS },
                    { label: "Weekends", days: WEEKEND },
                    { label: "Every Day", days: ALL_DAYS },
                  ].map(({ label, days }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setSelectedDays(days)}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time range */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Time Range
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="start-time" className="text-xs text-slate-500">Start</Label>
                    <input
                      id="start-time"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="end-time" className="text-xs text-slate-500">End</Label>
                    <input
                      id="end-time"
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-1.5 text-sm"
                    />
                  </div>
                </div>
                {startTime >= endTime && (
                  <p className="text-xs text-red-500">End time must be after start time.</p>
                )}
              </div>

              {/* Optional date range */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowDateRange((v) => !v)}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline-offset-2 hover:underline"
                >
                  {showDateRange ? "▾ Hide" : "▸ Set"} date range (optional)
                </button>
                {showDateRange && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="start-date" className="text-xs text-slate-500">Start Date</Label>
                      <input
                        id="start-date"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-1.5 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="end-date" className="text-xs text-slate-500">End Date</Label>
                      <input
                        id="end-date"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-1.5 text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Priority */}
              <div className="space-y-2">
                <Label htmlFor="priority" className="text-xs uppercase tracking-wider text-slate-500">
                  Priority
                </Label>
                <input
                  id="priority"
                  type="number"
                  min={0}
                  value={priority}
                  onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
                  className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-1.5 text-sm"
                />
                <p className="text-xs text-slate-400">
                  If two scheduled projects overlap, the one with higher priority plays. Equal
                  priority = unpredictable.
                </p>
              </div>
            </div>
          )}

          {/* Priority for always type */}
          {scheduleType === "always" && (
            <div className="space-y-2">
              <Label htmlFor="priority-always" className="text-xs uppercase tracking-wider text-slate-500">
                Priority
              </Label>
              <input
                id="priority-always"
                type="number"
                min={0}
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
                className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-1.5 text-sm"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || (!isEdit && !selectedProjectId) || availableProjects.length === 0}
          >
            {isSaving
              ? isEdit
                ? "Saving..."
                : "Assigning..."
              : isEdit
              ? "Save Changes"
              : "Assign Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
