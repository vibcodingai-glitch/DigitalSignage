/**
 * Schedule Engine
 * Evaluates which project should be active right now based on schedule rules.
 * Timezone-aware: uses the screen's location timezone for all time comparisons.
 */

export interface Schedule {
    id: string
    project_id: string
    name: string
    start_time: string | null   // "HH:MM:SS"
    end_time: string | null     // "HH:MM:SS"
    days_of_week: number[]      // 0=Sunday, 1=Monday, ... 6=Saturday (JS convention)
    start_date: string | null   // "YYYY-MM-DD"
    end_date: string | null     // "YYYY-MM-DD"
    priority: number
    is_active: boolean
}

export interface ScheduleWithProject extends Schedule {
    project_name?: string
}

/**
 * Given a list of schedules (across all projects for a screen),
 * returns the project_id that should be active right now.
 *
 * Returns null if no schedule is currently active (fall back to screen.active_project_id).
 */
export function evaluateActiveProject(
    schedules: Schedule[],
    nowInTz: Date
): string | null {
    const activeSchedules = schedules.filter(s => isScheduleActiveNow(s, nowInTz))

    if (activeSchedules.length === 0) return null

    // Sort by descending priority, take the highest
    activeSchedules.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    return activeSchedules[0].project_id
}

/**
 * Checks if a single schedule rule is active at the given moment.
 */
export function isScheduleActiveNow(schedule: Schedule, now: Date): boolean {
    if (!schedule.is_active) return false
    if (!schedule.start_time || !schedule.end_time) return false

    // Day of week check (0 = Sunday)
    const currentDow = now.getDay()
    if (!schedule.days_of_week.includes(currentDow)) return false

    // Optional date range check
    const todayStr = formatDate(now)
    if (schedule.start_date && todayStr < schedule.start_date) return false
    if (schedule.end_date && todayStr > schedule.end_date) return false

    // Time range check — compare HH:MM
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const startMinutes = timeStringToMinutes(schedule.start_time)
    const endMinutes = timeStringToMinutes(schedule.end_time)

    if (startMinutes <= endMinutes) {
        // Normal range: e.g. 09:00 - 18:00
        return currentMinutes >= startMinutes && currentMinutes < endMinutes
    } else {
        // Overnight range: e.g. 22:00 - 06:00
        return currentMinutes >= startMinutes || currentMinutes < endMinutes
    }
}

/**
 * Get the current time in a specific IANA timezone as a Date object.
 * Uses Intl to do proper tz conversion.
 */
export function getNowInTimezone(tz: string): Date {
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        })

        const parts = formatter.formatToParts(new Date())
        const part = (type: string) => parts.find(p => p.type === type)?.value || '00'

        const year = parseInt(part('year'))
        const month = parseInt(part('month')) - 1
        const day = parseInt(part('day'))
        const hour = parseInt(part('hour')) % 24
        const minute = parseInt(part('minute'))
        const second = parseInt(part('second'))

        return new Date(year, month, day, hour, minute, second)
    } catch {
        // Fallback to local time if timezone is invalid
        return new Date()
    }
}

/**
 * Detect conflicting schedules: two schedules for DIFFERENT projects
 * that share at least one day and have overlapping time ranges.
 */
export function detectConflicts(schedules: Schedule[]): Set<string> {
    const conflictIds = new Set<string>()

    for (let i = 0; i < schedules.length; i++) {
        for (let j = i + 1; j < schedules.length; j++) {
            const a = schedules[i]
            const b = schedules[j]

            // Only flag as conflict if they're for different projects
            if (a.project_id === b.project_id) continue

            const sharedDays = a.days_of_week.filter(d => b.days_of_week.includes(d))
            if (sharedDays.length === 0) continue

            if (timesOverlap(a.start_time, a.end_time, b.start_time, b.end_time)) {
                conflictIds.add(a.id)
                conflictIds.add(b.id)
            }
        }
    }

    return conflictIds
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

export function timeStringToMinutes(t: string): number {
    const [h, m] = t.split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
}

export function minutesToTimeString(minutes: number): string {
    const h = Math.floor(minutes / 60) % 24
    const m = minutes % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function formatDate(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

function timesOverlap(
    startA: string | null, endA: string | null,
    startB: string | null, endB: string | null
): boolean {
    if (!startA || !endA || !startB || !endB) return false
    const sA = timeStringToMinutes(startA)
    const eA = timeStringToMinutes(endA)
    const sB = timeStringToMinutes(startB)
    const eB = timeStringToMinutes(endB)
    return sA < eB && sB < eA
}

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const DAY_LABELS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const WEEKDAYS = [1, 2, 3, 4, 5]
export const WEEKEND = [0, 6]
