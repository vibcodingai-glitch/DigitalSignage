/**
 * screen-projects.ts
 * Data access functions for the screen_projects table.
 * Follows the same direct Supabase client pattern used throughout the codebase.
 */



// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export type ScreenProjectScheduleType = 'always' | 'scheduled'

export interface ScreenProject {
  id: string
  screen_id: string
  project_id: string
  organization_id: string
  schedule_type: ScreenProjectScheduleType
  days_of_week: number[]
  start_time: string
  end_time: string
  start_date: string | null
  end_date: string | null
  priority: number
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
  // Joined fields (when fetched with project data)
  project?: {
    id: string
    name: string
    settings: Record<string, unknown>
    is_active: boolean
    created_at: string
    _playlist_count?: number
  }
}

export interface AssignProjectInput {
  screen_id: string
  project_id: string
  organization_id: string
  schedule_type: ScreenProjectScheduleType
  days_of_week?: number[]
  start_time?: string
  end_time?: string
  start_date?: string | null
  end_date?: string | null
  priority?: number
  sort_order?: number
}

export interface ResolvedProject {
  project: {
    id: string
    name: string
    settings: Record<string, unknown>
  }
  playlist: Array<{
    id: string
    order_index: number
    duration_override: number | null
    transition_type: string | null
    content_item: {
      id: string
      name: string
      type: string
      source_url: string | null
      file_path: string | null
      thumbnail_url: string | null
      duration_seconds: number
      metadata: Record<string, unknown>
    }
  }>
  source: 'screen_project' | 'fallback_active_project_id'
}

// ─────────────────────────────────────────────────────────────────
// FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Fetch all screen_projects for a screen, joined with project data.
 * Ordered by priority DESC, sort_order ASC.
 */
export async function getScreenProjects(screenId: string): Promise<ScreenProject[]> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const res = await fetch(`/api/dashboard?action=screen-projects&id=${screenId}`, { signal: controller.signal })
    if (!res.ok) throw new Error('Failed to fetch screen projects')
    return res.json()
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Assign a project to a screen with schedule settings.
 */
export async function assignProjectToScreen(input: AssignProjectInput): Promise<ScreenProject> {
  const res = await fetch('/api/dashboard/mutate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'screen-projects-assign', input })
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Failed to assign project')
  return json.data as ScreenProject
}

/**
 * Update schedule settings for a screen_project assignment.
 */
export async function updateScreenProject(
  id: string,
  updates: Partial<Omit<ScreenProject, 'id' | 'screen_id' | 'project_id' | 'organization_id' | 'created_at' | 'updated_at' | 'project'>>
): Promise<ScreenProject> {
  const res = await fetch('/api/dashboard/mutate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'screen-projects-update', id, updates })
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Failed to update project schedule')
  return json.data as ScreenProject
}

/**
 * Remove a project assignment from a screen (does NOT delete the project).
 */
export async function removeScreenProject(id: string): Promise<void> {
  const res = await fetch('/api/dashboard/mutate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'screen-projects-remove', id })
  })
  if (!res.ok) throw new Error('Failed to remove project assignment')
}

/**
 * Bulk-update sort_order for a list of screen_project records.
 */
export async function reorderScreenProjects(
  items: Array<{ id: string; sort_order: number }>
): Promise<void> {
  const res = await fetch('/api/dashboard/mutate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'screen-projects-reorder', items })
  })
  if (!res.ok) throw new Error('Failed to reorder projects')
}

/**
 * Resolves which project should play RIGHT NOW for a given screen.
 *
 * Resolution order:
 * 1. screen_projects with schedule_type='scheduled' — evaluated with the
 *    existing schedule-engine logic (days + time + date range + priority)
 * 2. screen_projects with schedule_type='always' (highest priority first)
 * 3. Fallback to screen.active_project_id
 *
 * Returns the winning project + its full playlist, or null if nothing.
 */
export async function resolveActiveProject(
  screenId: string,
  timezone = 'UTC'
): Promise<ResolvedProject | null> {
  const supabase = createClient()

  // Dynamically import schedule engine to avoid SSR issues
  const { getNowInTimezone, isScheduleActiveNow } = await import('@/lib/schedule-engine')

  // 1. Fetch all active screen_project assignments for this screen
  const { data: assignments, error: assignError } = await supabase
    .from('screen_projects')
    .select('*')
    .eq('screen_id', screenId)
    .eq('is_active', true)
    .order('priority', { ascending: false })
    .order('sort_order', { ascending: true })

  if (assignError) throw assignError

  let winningProjectId: string | null = null
  let source: ResolvedProject['source'] = 'screen_project'

  if (assignments && assignments.length > 0) {
    const nowInTz = getNowInTimezone(timezone)

    // First: try 'scheduled' assignments
    const scheduledAssignments = assignments.filter(
      (a: ScreenProject) => a.schedule_type === 'scheduled'
    )

    for (const assignment of scheduledAssignments) {
      // Build a pseudo-schedule object compatible with the schedule engine
      const pseudoSchedule = {
        id: assignment.id,
        project_id: assignment.project_id,
        name: '',
        start_time: assignment.start_time,
        end_time: assignment.end_time,
        days_of_week: assignment.days_of_week,
        start_date: assignment.start_date,
        end_date: assignment.end_date,
        priority: assignment.priority,
        is_active: true,
      }

      if (isScheduleActiveNow(pseudoSchedule, nowInTz)) {
        winningProjectId = assignment.project_id
        break // already sorted by priority DESC
      }
    }

    // Second: fall back to 'always' type if no scheduled match
    if (!winningProjectId) {
      const alwaysOn = assignments.find((a: ScreenProject) => a.schedule_type === 'always')
      if (alwaysOn) {
        winningProjectId = alwaysOn.project_id
      }
    }
  }

  // Third: fall back to screen.active_project_id
  if (!winningProjectId) {
    const { data: screenData } = await supabase
      .from('screens')
      .select('active_project_id')
      .eq('id', screenId)
      .single()

    if (screenData?.active_project_id) {
      winningProjectId = screenData.active_project_id
      source = 'fallback_active_project_id'
    }
  }

  if (!winningProjectId) return null

  // Fetch the winning project + playlist
  const { data: projectData, error: projError } = await supabase
    .from('projects')
    .select('id, name, settings, layout_type, layout_settings')
    .eq('id', winningProjectId)
    .single()

  if (projError || !projectData) return null

  const { data: playlistData } = await supabase
    .from('playlist_items')
    .select('*, content_item:content_items(*)')
    .eq('project_id', winningProjectId)
    .order('order_index', { ascending: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playlist = (playlistData || []).map((item: any) => ({
    ...item,
    // Ensure zone_index is always a number (defaults to 0 for fullscreen layouts)
    zone_index: typeof item.zone_index === 'number' ? item.zone_index : 0,
    content_item: Array.isArray(item.content_item) ? item.content_item[0] : item.content_item,
  }))

  return {
    project: projectData as ResolvedProject['project'],
    playlist,
    source,
  }
}
