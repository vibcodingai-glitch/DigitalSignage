"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/hooks/use-user"
import { formatDistanceToNow } from "date-fns"
import type { Schedule } from "@/lib/schedule-engine"

import { getScreenProjects, removeScreenProject, updateScreenProject, reorderScreenProjects } from "@/lib/screen-projects"
import type { ScreenProject } from "@/lib/screen-projects"
import { getOrgId } from "@/lib/utils/get-org-id"
import { ScreenHero } from "@/components/screens/ScreenHero"
import { BroadcastSourceTab } from "@/components/screens/BroadcastSourceTab"
import { PushCommandsTab } from "@/components/screens/PushCommandsTab"
import { ScreenSettingsTab } from "@/components/screens/ScreenSettingsTab"
import { ProjectScheduleTab } from "@/components/screens/ProjectScheduleTab"
import { ScheduleTimelineView } from "@/components/screens/ScheduleTimelineView"
import { ScreenLogsViewer } from "@/components/screens/ScreenLogsViewer"
import { AssignProjectDialog } from "@/components/AssignProjectDialog"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { ArrowLeft, Box, Settings, Bell, Clock, PlayCircle, CalendarDays, Layers } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ScreenDetailClientProps {
    params: { id: string }
    initialData?: {
        screen: any
        locations: any[]
        projects: any[]
        logs: any[]
        pushEvents: any[]
        schedules: any[]
        locationTz: string
    } | null
}

export default function ScreenDetailClient({ params, initialData }: ScreenDetailClientProps) {
    const { profile } = useUser()
    const supabase = createClient()
    const { toast } = useToast()
    const router = useRouter()

    // org_id fetched independently so AssignProjectDialog doesn't block on slow profile load
    const [orgId, setOrgId] = useState<string | null>(initialData?.screen?.organization_id || null)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [screen, setScreen] = useState<any>(initialData?.screen || null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [locations, setLocations] = useState<any[]>(initialData?.locations || [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [projects, setProjects] = useState<any[]>(initialData?.projects || [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [logs, setLogs] = useState<any[]>(initialData?.logs || [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [pushEvents, setPushEvents] = useState<any[]>(initialData?.pushEvents || [])

    // Schedule data across all projects for this screen
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [allSchedules, setAllSchedules] = useState<(Schedule & { project_name: string; project_color: number })[]>(initialData?.schedules as any || [])
    const [locationTz, setLocationTz] = useState(initialData?.locationTz || 'UTC')

    // screen_projects (multi-project scheduling)
    const [screenProjects, setScreenProjects] = useState<ScreenProject[]>([])
    const [screenProjectsLoading, setScreenProjectsLoading] = useState(false)
    const [assignDialogOpen, setAssignDialogOpen] = useState(false)
    const [editTarget, setEditTarget] = useState<ScreenProject | null>(null)
    const [deleteTargetSP, setDeleteTargetSP] = useState<ScreenProject | null>(null)

    // current_state from screen heartbeat (NowPlaying)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [liveCurrentState, setLiveCurrentState] = useState<any>(initialData?.screen?.current_state || null)

    const [isLoading, setIsLoading] = useState(!initialData)

    // Realtime live status (updated by Supabase Realtime without page reload)
    const [liveStatus, setLiveStatus] = useState<string | null>(null)
    const [liveHeartbeat, setLiveHeartbeat] = useState<string | null>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const realtimeChannelRef = useRef<any>(null)

    // UI state
    const [isEditingName, setIsEditingName] = useState(false)
    const [editNameValue, setEditNameValue] = useState(initialData?.screen?.name || "")

    const [settingsData, setSettingsData] = useState({
        location_id: initialData?.screen?.location_id || "none",
        orientation: initialData?.screen?.orientation || "landscape",
        resolution: initialData?.screen?.resolution || "1920x1080"
    })

    const [activeProjectSelection, setActiveProjectSelection] = useState<string>(initialData?.screen?.active_project_id || "none")
    const [pushMessage, setPushMessage] = useState("")

    const fetchScreenData = useCallback(async () => {
        setIsLoading(true)
        try {
            // Step 1: Fetch screen — we need org_id and location_id for the rest
            const { data: screenData, error: screenError } = await supabase
                .from('screens')
                .select('*, location:locations(id, name, timezone)')
                .eq('id', params.id)
                .single()

            if (screenError) throw screenError

            setScreen(screenData)
            setEditNameValue(screenData.name)
            setSettingsData({
                location_id: screenData.location_id || "none",
                orientation: screenData.orientation || "landscape",
                resolution: screenData.resolution || "1920x1080"
            })
            setActiveProjectSelection(screenData.active_project_id || "none")
            if (screenData.current_state) setLiveCurrentState(screenData.current_state)

            // Extract timezone from the joined location (no extra query needed)
            if (screenData.location?.timezone) setLocationTz(screenData.location.timezone)

            // Step 2: Fire ALL remaining queries in a single parallel batch
            const [{ data: locs }, { data: projs }, { data: lg }, { data: pe }] = await Promise.all([
                supabase.from('locations').select('id, name').eq('organization_id', screenData.organization_id).order('name'),
                supabase.from('projects').select('*').eq('organization_id', screenData.organization_id).order('created_at', { ascending: false }),
                supabase.from('screen_logs').select('*').eq('screen_id', params.id).order('created_at', { ascending: false }).limit(20),
                supabase.from('push_events').select('*, created_by:profiles(full_name)').eq('screen_id', params.id).order('created_at', { ascending: false }).limit(10)
            ])

            if (locs) setLocations(locs)
            if (lg) setLogs(lg)
            if (pe) setPushEvents(pe)

            if (projs) {
                setProjects(projs)
                // Fetch schedules in parallel — don't wait for the projects setState
                if (projs.length > 0) {
                    const { data: scheds } = await supabase
                        .from('schedules')
                        .select('*')
                        .in('project_id', projs.map(p => p.id))
                        .eq('is_active', true)
                    if (scheds) {
                        const enriched = scheds.map((s, idx) => ({
                            ...s,
                            project_name: projs.find(p => p.id === s.project_id)?.name || 'Unknown',
                            project_color: idx % 8
                        }))
                        setAllSchedules(enriched)
                    }
                }
            }

        } catch (error) {
            toast({
                title: "Failed to load screen",
                description: (error as Error).message,
                variant: "destructive"
            })
            router.push('/dashboard/screens')
        } finally {
            setIsLoading(false)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.id])

    const fetchScreenProjects = async () => {
        if (!params.id) return
        setScreenProjectsLoading(true)
        try {
            const data = await getScreenProjects(params.id)
            setScreenProjects(data)
        } catch (err) {
            toast({ title: 'Failed to load project schedule', description: (err as Error).message, variant: 'destructive' })
        } finally {
            setScreenProjectsLoading(false)
        }
    }

    useEffect(() => {
        // Skip initial fetch if server-side data was provided
        if (initialData) return
        fetchScreenData()
    }, [fetchScreenData, initialData])

    // Fetch orgId independently — profile from useUser loads async and can be null
    // when user interacts with AssignProjectDialog early after page load
    useEffect(() => {
        getOrgId(profile?.organization_id).then(id => {
            if (id) setOrgId(id)
        })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile?.organization_id])

    useEffect(() => {
        fetchScreenProjects()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.id])

    // Realtime subscription — live status, heartbeat & current_state
    useEffect(() => {
        if (!screen?.id) return

        const channel = supabase
            .channel(`screen-admin-${screen.id}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'screens',
                filter: `id=eq.${screen.id}`
            }, (payload) => {
                if (payload.new.status) setLiveStatus(payload.new.status as string)
                if (payload.new.last_heartbeat) setLiveHeartbeat(payload.new.last_heartbeat as string)
                if (payload.new.current_state) setLiveCurrentState(payload.new.current_state)
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'screen_projects',
                filter: `screen_id=eq.${screen.id}`
            }, () => {
                fetchScreenProjects()
            })
            .subscribe()

        realtimeChannelRef.current = channel

        return () => {
            supabase.removeChannel(channel)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [screen?.id])

    const handleUpdateName = async () => {
        if (!editNameValue.trim() || editNameValue === screen.name) {
            setIsEditingName(false)
            return
        }

        try {
            const { error } = await supabase
                .from('screens')
                .update({ name: editNameValue })
                .eq('id', screen.id)

            if (error) throw error

            setScreen({ ...screen, name: editNameValue })
            toast({ title: "Name updated" })
        } catch {
            toast({ title: "Failed to update name", variant: "destructive" })
        } finally {
            setIsEditingName(false)
        }
    }

    const handleForceSync = async () => {
        if (!screen) return
        try {
            // Use broadcast to send a direct command to the display page
            const channel = supabase.channel(`display-${screen.id}`)
            channel.subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.send({
                        type: 'broadcast',
                        event: 'command',
                        payload: { command: 'FORCE_RELOAD', timestamp: Date.now() }
                    })
                    toast({ title: "Sync command sent", description: "The display has been instructed to reload immediately." })
                    // Wait a moment for broadcast to send before closing
                    setTimeout(() => supabase.removeChannel(channel), 1000)
                }
            })
        } catch (err) {
            toast({ title: "Sync failed", variant: "destructive", description: (err as Error).message })
        }
    }

    const handleUpdateSettings = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const { error } = await supabase
                .from('screens')
                .update({
                    location_id: settingsData.location_id === "none" ? null : settingsData.location_id,
                    orientation: settingsData.orientation,
                    resolution: settingsData.resolution
                })
                .eq('id', screen.id)

            if (error) throw error

            toast({ title: "Settings saved successfully" })
            fetchScreenData()
        } catch (error) {
            toast({ title: "Failed to save settings", variant: "destructive", description: (error as Error).message })
        }
    }

    const handleSetActiveProject = async () => {
        try {
            const projectId = activeProjectSelection === "none" ? null : activeProjectSelection

            const { error } = await supabase
                .from('screens')
                .update({ active_project_id: projectId })
                .eq('id', screen.id)

            if (error) throw error

            toast({ title: "Active project updated" })

            // Log the event
            await supabase.from('screen_logs').insert({
                screen_id: screen.id,
                event: 'project_assigned',
                details: { project_id: projectId }
            })

            fetchScreenData()
        } catch {
            toast({ title: "Failed to update active project", variant: "destructive" })
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleSendPushEvent = async (type: string, payload: any = {}) => {
        try {
            const { error } = await supabase
                .from('push_events')
                .insert({
                    screen_id: screen.id,
                    event_type: type,
                    payload: payload,
                    created_by: profile?.id
                })

            if (error) throw error

            toast({ title: "Push command sent successfully" })
            setPushMessage("")
            fetchScreenData()
        } catch (error) {
            toast({ title: "Failed to send command", variant: "destructive", description: (error as Error).message })
        }
    }

    const handleDeleteScreen = async () => {
        try {
            const { error } = await supabase.from('screens').delete().eq('id', screen.id)
            if (error) throw error

            toast({ title: "Screen deleted" })
            router.push('/dashboard/screens')
        } catch {
            toast({ title: "Deletion failed", variant: "destructive" })
        }
    }

    const handleReorderProject = async (index: number, direction: 'up' | 'down') => {
        const swapIdx = direction === 'up' ? index - 1 : index + 1
        const r = [...screenProjects]
        ;[r[index], r[swapIdx]] = [r[swapIdx], r[index]]
        await reorderScreenProjects(r.map((s, i) => ({ id: s.id, sort_order: i })))
        fetchScreenProjects()
    }

    const handleToggleActive = async (sp: ScreenProject, checked: boolean) => {
        await updateScreenProject(sp.id, { is_active: checked })
        fetchScreenProjects()
    }

    if (isLoading || !screen) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-8 w-64" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Skeleton className="md:col-span-2 h-64" />
                    <Skeleton className="h-64" />
                </div>
            </div>
        )
    }


    // Prefer realtime-pushed status over stale loaded value
    const effectiveStatus = liveStatus || screen.status
    const effectiveHeartbeat = liveHeartbeat || screen.last_heartbeat
    const isOnline = effectiveStatus === 'online'

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Nav Back */}
            <div className="flex items-center gap-4 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors w-fit">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" asChild>
                    <Link href="/dashboard/screens">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div className="flex items-center gap-2 font-medium">Back to Screens</div>
            </div>

            {/* Top Level Hero */}
            <ScreenHero
                screen={screen}
                isOnline={isOnline}
                effectiveStatus={effectiveStatus}
                effectiveHeartbeat={effectiveHeartbeat}
                isEditingName={isEditingName}
                editNameValue={editNameValue}
                liveCurrentState={liveCurrentState}
                onEditName={() => setIsEditingName(true)}
                onSaveName={handleUpdateName}
                onEditNameValueChange={setEditNameValue}
                onForceSync={handleForceSync}
            />

            {/* Context Tabs */}
            <Tabs defaultValue="active-project" className="w-full">
                <TabsList className="w-full justify-start border-b rounded-none h-12 bg-transparent p-0 overflow-x-auto flex-nowrap">
                    <TabsTrigger value="active-project" className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none h-12 px-6">
                        <PlayCircle className="h-4 w-4 mr-2" /> Broadcast Source
                    </TabsTrigger>
                    <TabsTrigger value="all-projects" className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none h-12 px-6">
                        <Box className="h-4 w-4 mr-2" /> All Projects
                    </TabsTrigger>
                    <TabsTrigger value="push" className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none h-12 px-6">
                        <Bell className="h-4 w-4 mr-2" /> Push Commands
                    </TabsTrigger>
                    <TabsTrigger value="logs" className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none h-12 px-6">
                        <Clock className="h-4 w-4 mr-2" /> Activity Logs
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none h-12 px-6">
                        <Settings className="h-4 w-4 mr-2" /> Settings
                    </TabsTrigger>
                    <TabsTrigger value="schedule" className="data-[state=active]:border-b-2 data-[state=active]:border-violet-500 rounded-none h-12 px-6">
                        <CalendarDays className="h-4 w-4 mr-2" /> Schedule
                    </TabsTrigger>
                    <TabsTrigger value="project-schedule" className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 rounded-none h-12 px-6">
                        <Layers className="h-4 w-4 mr-2" /> Project Schedule
                        {screenProjects.length > 0 && (
                            <span className="ml-2 text-[10px] bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-full font-mono">
                                {screenProjects.length}
                            </span>
                        )}
                    </TabsTrigger>
                </TabsList>

                <div className="py-6">
                    {/* Active Project Tab */}
                    <BroadcastSourceTab
                        screen={screen}
                        projects={projects}
                        activeProjectSelection={activeProjectSelection}
                        onActiveProjectChange={setActiveProjectSelection}
                        onSetActiveProject={handleSetActiveProject}
                    />

                    {/* All Projects */}
                    <TabsContent value="all-projects" className="m-0">
                        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Bound Projects</CardTitle>
                                    <CardDescription>Sequences mapped explicitly towards {screen.name}&apos;s aspect ratio and location grouping.</CardDescription>
                                </div>
                                <Button asChild>
                                    {/* Link requires project wizard to exist */}
                                    <Link href="/dashboard/projects">
                                        + Design New Project
                                    </Link>
                                </Button>
                            </CardHeader>
                            <CardContent>
                                {projects.length === 0 ? (
                                    <div className="text-center py-12 text-slate-500 border border-dashed rounded-lg">
                                        <Box className="h-10 w-10 mx-auto mb-3 opacity-20" />
                                        <p>No bound sequence files established yet.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {projects.map(proj => (
                                            <div key={proj.id} className="group border border-slate-200 dark:border-slate-800 rounded-lg p-4 hover:border-indigo-300 transition-all flex justify-between items-center">
                                                <div>
                                                    <h4 className="font-semibold">{proj.name}</h4>
                                                    <div className="text-xs text-slate-500 mt-1 flex gap-3">
                                                        <span>Created {formatDistanceToNow(new Date(proj.created_at))} ago</span>
                                                    </div>
                                                </div>
                                                <Button variant="ghost" className="opacity-0 group-hover:opacity-100" asChild>
                                                    <Link href={`/dashboard/projects/${proj.id}`}>Edit sequence</Link>
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Push Events */}
                    <PushCommandsTab
                        screen={screen}
                        isOnline={isOnline}
                        pushMessage={pushMessage}
                        pushEvents={pushEvents}
                        onPushMessageChange={setPushMessage}
                        onSendPushEvent={handleSendPushEvent}
                    />

                    {/* Logs */}
                    <TabsContent value="logs" className="m-0 pt-2">
                        <ScreenLogsViewer screenId={screen.id} />
                    </TabsContent>

                    {/* Settings */}
                    <ScreenSettingsTab
                        screen={screen}
                        locations={locations}
                        settingsData={settingsData}
                        onSettingsChange={setSettingsData}
                        onUpdateSettings={handleUpdateSettings}
                        onDeleteScreen={handleDeleteScreen}
                    />

                    {/* ── SCHEDULE TIMELINE TAB ────────────────────────────── */}
                    <TabsContent value="schedule" className="m-0">
                        <ScheduleTimelineView
                            allSchedules={allSchedules}
                            locationTz={locationTz}
                            projects={projects}
                        />
                    </TabsContent>
                    {/* ── PROJECT SCHEDULE TAB ──────────────────────────────── */}
                    <ProjectScheduleTab
                        screen={screen}
                        screenProjects={screenProjects}
                        screenProjectsLoading={screenProjectsLoading}
                        liveCurrentState={liveCurrentState}
                        locationTz={locationTz}
                        onAssign={() => { setEditTarget(null); setAssignDialogOpen(true) }}
                        onEdit={(sp) => { setEditTarget(sp); setAssignDialogOpen(true) }}
                        onDelete={setDeleteTargetSP}
                        onToggleActive={handleToggleActive}
                        onReorder={handleReorderProject}
                        onRefreshProjects={fetchScreenProjects}
                    />
                </div>
            </Tabs>

            <AssignProjectDialog
                open={assignDialogOpen}
                onOpenChange={setAssignDialogOpen}
                screenId={params.id}
                organizationId={orgId || ""}
                alreadyAssignedProjectIds={screenProjects.map(sp => sp.project_id)}
                existingAssignments={screenProjects}
                editTarget={editTarget}
                onSuccess={fetchScreenProjects}
            />

            <AlertDialog open={!!deleteTargetSP} onOpenChange={(open) => { if (!open) setDeleteTargetSP(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove Project Assignment</AlertDialogTitle>
                        <AlertDialogDescription>
                            Remove <strong>{deleteTargetSP?.project?.name}</strong> from this screen&apos;s schedule?
                            The project itself will not be deleted.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-red-600 hover:bg-red-700"
                            onClick={async () => {
                                if (!deleteTargetSP) return
                                try {
                                    await removeScreenProject(deleteTargetSP.id)
                                    toast({ title: 'Project removed from schedule' })
                                    fetchScreenProjects()
                                } catch (err) {
                                    toast({ title: 'Failed to remove', description: (err as Error).message, variant: 'destructive' })
                                } finally { setDeleteTargetSP(null) }
                            }}>
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
