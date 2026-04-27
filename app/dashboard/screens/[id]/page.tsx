"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/hooks/use-user"
import { formatDistanceToNow, format } from "date-fns"
import { QRCodeSVG } from "qrcode.react"
import { isScheduleActiveNow, detectConflicts, DAY_LABELS, timeStringToMinutes, getNowInTimezone } from "@/lib/schedule-engine"
import type { Schedule } from "@/lib/schedule-engine"
import { getDisplayUrl } from "@/lib/app-url"
import { getScreenProjects, removeScreenProject, updateScreenProject, reorderScreenProjects } from "@/lib/screen-projects"
import type { ScreenProject } from "@/lib/screen-projects"
import { LiveScreenPreview } from "@/components/LiveScreenPreview"
import { NowPlayingBadge } from "@/components/NowPlayingBadge"
import { WeeklyScheduleTimeline, getProjectColor } from "@/components/WeeklyScheduleTimeline"
import { AssignProjectDialog } from "@/components/AssignProjectDialog"
import { ScreenLogsViewer } from "@/components/screens/ScreenLogsViewer"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { ArrowLeft, MapPin, Signal, Activity, Box, Settings, Bell, Clock, Copy, ExternalLink, Save, Edit2, PlayCircle, Play, AlertCircle, Eye, CalendarDays, Plus, Trash2, ChevronUp, ChevronDown, Layers, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function ScreenDetailPage({ params }: { params: { id: string } }) {
    const { profile } = useUser()
    const supabase = createClient()
    const { toast } = useToast()
    const router = useRouter()

    // org_id fetched independently so AssignProjectDialog doesn't block on slow profile load
    const [orgId, setOrgId] = useState<string | null>(null)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [screen, setScreen] = useState<any>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [locations, setLocations] = useState<any[]>([])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [projects, setProjects] = useState<any[]>([])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [logs, setLogs] = useState<any[]>([])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [pushEvents, setPushEvents] = useState<any[]>([])

    // Schedule data across all projects for this screen
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [allSchedules, setAllSchedules] = useState<(Schedule & { project_name: string; project_color: number })[]>([])
    const [locationTz, setLocationTz] = useState('UTC')

    // screen_projects (multi-project scheduling)
    const [screenProjects, setScreenProjects] = useState<ScreenProject[]>([])
    const [screenProjectsLoading, setScreenProjectsLoading] = useState(false)
    const [assignDialogOpen, setAssignDialogOpen] = useState(false)
    const [editTarget, setEditTarget] = useState<ScreenProject | null>(null)
    const [deleteTargetSP, setDeleteTargetSP] = useState<ScreenProject | null>(null)

    // current_state from screen heartbeat (NowPlaying)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [liveCurrentState, setLiveCurrentState] = useState<any>(null)

    const [isLoading, setIsLoading] = useState(true)

    // Realtime live status (updated by Supabase Realtime without page reload)
    const [liveStatus, setLiveStatus] = useState<string | null>(null)
    const [liveHeartbeat, setLiveHeartbeat] = useState<string | null>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const realtimeChannelRef = useRef<any>(null)

    // UI state
    const [isEditingName, setIsEditingName] = useState(false)
    const [editNameValue, setEditNameValue] = useState("")

    const [settingsData, setSettingsData] = useState({
        location_id: "none",
        orientation: "landscape",
        resolution: "1920x1080"
    })

    const [activeProjectSelection, setActiveProjectSelection] = useState<string>("none")
    const [pushMessage, setPushMessage] = useState("")

    const fetchScreenData = useCallback(async () => {
        setIsLoading(true)
        try {
            // Screen info — simple query without ambiguous FK hint
            const { data: screenData, error: screenError } = await supabase
                .from('screens')
                .select('*, location:locations(id, name)')
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
            // Pre-populate "Currently Playing" from DB on first load
            if (screenData.current_state) setLiveCurrentState(screenData.current_state)

            // Reference lookups — run in parallel
            const [{ data: locs }, { data: projs }, { data: lg }, { data: pe }] = await Promise.all([
                supabase.from('locations').select('id, name').order('name'),
                supabase.from('projects').select('*').eq('screen_id', params.id).order('created_at', { ascending: false }),
                supabase.from('screen_logs').select('*').eq('screen_id', params.id).order('created_at', { ascending: false }).limit(20),
                supabase.from('push_events').select('*, created_by:profiles(full_name)').eq('screen_id', params.id).order('created_at', { ascending: false }).limit(10)
            ])

            if (locs) setLocations(locs)
            if (lg) setLogs(lg)
            if (pe) setPushEvents(pe)

            if (projs) {
                setProjects(projs)
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

            // Location timezone
            if (screenData?.location_id) {
                const { data: locData } = await supabase.from('locations').select('timezone').eq('id', screenData.location_id).single()
                if (locData?.timezone) setLocationTz(locData.timezone)
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
        fetchScreenData()
    }, [fetchScreenData])

    // Fetch orgId independently — profile from useUser loads async and can be null
    // when user interacts with AssignProjectDialog early after page load
    useEffect(() => {
        const fetchOrgId = async () => {
            if (profile?.organization_id) {
                setOrgId(profile.organization_id)
                return
            }
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data } = await supabase
                    .from('profiles')
                    .select('organization_id')
                    .eq('id', user.id)
                    .single()
                if (data?.organization_id) setOrgId(data.organization_id)
            }
        }
        fetchOrgId()
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

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text)
            toast({ title: "Display URL copied!" })
        } catch {
            toast({ title: "Failed to copy", variant: "destructive" })
        }
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

    const displayUrl = getDisplayUrl(screen.display_key)
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
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* LEFT COLUMN: 60% Width */}
                <div className="lg:col-span-3">
                    <LiveScreenPreview
                        displayKey={screen.display_key}
                        screenName={screen.name}
                        orientation="landscape"
                        isOnline={isOnline}
                    />
                </div>

                {/* RIGHT COLUMN: 40% Width */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden h-full flex flex-col">
                        <div className={`absolute top-0 left-0 w-1.5 h-full transition-colors duration-1000 ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex flex-col mb-1">
                                <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1">Screen Details</span>
                                {isEditingName ? (
                                    <div className="flex items-center gap-2">
                                        <Input
                                            value={editNameValue}
                                            onChange={(e) => setEditNameValue(e.target.value)}
                                            className="h-8 md:text-xl font-bold max-w-xs"
                                            autoFocus
                                        />
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600" onClick={handleUpdateName}>
                                            <Save className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsEditingName(true)}>
                                        <h1 className="text-2xl font-bold tracking-tight">{screen.name}</h1>
                                        <Edit2 className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        
                        <CardContent className="flex-1 p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Status</span>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center">
                                            <div className={`h-2 w-2 rounded-full mr-2 ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                                            <span className={`text-sm font-medium ${isOnline ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                                                {effectiveStatus.toUpperCase()}
                                            </span>
                                        </div>
                                        {isOnline && (
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="h-7 px-2 text-[10px] text-indigo-600 border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40" 
                                                onClick={handleForceSync}
                                            >
                                                <RefreshCw className="h-3 w-3 mr-1" /> Sync Hardware
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Last Seen</span>
                                    <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                        {effectiveHeartbeat ? formatDistanceToNow(new Date(effectiveHeartbeat), { addSuffix: true }) : 'Never'}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Location</span>
                                    <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                        {screen.location?.name || 'Unassigned'}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Format</span>
                                    <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                        1920×1080 (Landscape)
                                    </div>
                                </div>
                            </div>
                            
                            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-3">Currently Playing</span>
                                <NowPlayingBadge
                                    projectName={liveCurrentState?.project_name || screen.project?.name || null}
                                    contentName={liveCurrentState?.content_name || null}
                                    isPlaying={liveCurrentState?.is_playing ?? false}
                                />
                                {liveCurrentState && liveCurrentState.total_playlist_items > 0 && (
                                    <p className="text-[10px] text-slate-500 mt-2 font-mono ml-2">
                                        Item {liveCurrentState.playlist_position} of {liveCurrentState.total_playlist_items}
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

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
                    <TabsContent value="active-project" className="m-0 space-y-6">
                        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                            <CardHeader>
                                <CardTitle>Current Broadcast Origin</CardTitle>
                                <CardDescription>Determine exactly what timeline project is looping actively on this display hardware.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border border-indigo-100 dark:border-indigo-900/30 rounded-lg flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="h-16 w-16 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-lg shadow-inner flex items-center justify-center text-white">
                                            <Play className="h-8 w-8 fill-white" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mb-1">
                                                {screen.project?.name || "Nothing Playing"}
                                            </h3>
                                            <p className="text-sm text-slate-500">{screen.active_project_id ? "Currently orchestrating real-time" : "Endpoints without a loaded sequence default to a blank ambient logo state."}</p>
                                        </div>
                                    </div>
                                    {screen.active_project_id && (
                                        <Button variant="outline" asChild>
                                            <Link href={`/dashboard/projects/${screen.active_project_id}`}>
                                                Launch Editor <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
                                            </Link>
                                        </Button>
                                    )}
                                </div>

                                <div className="mt-8">
                                    <Label className="text-sm font-semibold mb-3 block">Change Active Assignment</Label>
                                    <div className="flex items-end gap-3 max-w-lg">
                                        <div className="flex-1">
                                            <Select value={activeProjectSelection} onValueChange={setActiveProjectSelection}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a project sequence" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none" className="text-amber-600">Unassign / Clear Playback</SelectItem>
                                                    {projects.map(proj => (
                                                        <SelectItem key={proj.id} value={proj.id}>{proj.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <Button
                                            onClick={handleSetActiveProject}
                                            disabled={activeProjectSelection === (screen.active_project_id || "none")}
                                        >
                                            Push Update
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

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
                    <TabsContent value="push" className="m-0 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                                <CardHeader>
                                    <CardTitle>Instant Push Commands</CardTitle>
                                    <CardDescription>Inject high-priority ephemeral states directly across the socket connection immediately into runtime logic.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/10 p-4 rounded-lg">
                                        <Label className="text-amber-800 dark:text-amber-500 font-bold mb-2 flex items-center"><AlertCircle className="h-4 w-4 mr-2" /> Fire Text Alert</Label>
                                        <div className="flex gap-2 mt-3">
                                            <Input
                                                placeholder="ATTN: Store closing in 15 mins..."
                                                value={pushMessage}
                                                onChange={e => setPushMessage(e.target.value)}
                                            />
                                            <Button
                                                className="bg-amber-600 hover:bg-amber-700"
                                                disabled={!isOnline || !pushMessage}
                                                onClick={() => handleSendPushEvent('alert', { text: pushMessage, duration: 30000 })}
                                            >
                                                Dispatch
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="border border-slate-200 dark:border-slate-800 p-4 rounded-lg flex justify-between items-center">
                                        <div>
                                            <Label className="font-bold flex items-center mb-1"><Activity className="h-4 w-4 mr-2" /> Force Global Reload</Label>
                                            <p className="text-xs text-slate-500">Purge cache and instantly trigger a cold boot browser refresh sequence entirely.</p>
                                        </div>
                                        <Button variant="outline" disabled={!isOnline} onClick={() => handleSendPushEvent('reload')}>
                                            Force Refresh
                                        </Button>
                                    </div>

                                    {!isOnline && (
                                        <p className="text-sm text-red-500 font-medium pb-2 text-center animate-pulse">Endpoint is currently OFFLINE - Sockets unavailable.</p>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                                <CardHeader>
                                    <CardTitle>Push Architecture Execution Log</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {pushEvents.length === 0 ? (
                                        <div className="py-8 text-center text-slate-500">No push events fired.</div>
                                    ) : (
                                        <div className="space-y-4">
                                            {pushEvents.map(pe => (
                                                <div key={pe.id} className="flex flex-col bg-slate-50 dark:bg-slate-900 rounded p-3 text-sm">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="font-semibold text-indigo-600 dark:text-indigo-400 capitalize bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded text-xs">{pe.event_type}</span>
                                                        <span className="text-xs text-slate-400">{format(new Date(pe.created_at), 'MMM d, h:mm a')}</span>
                                                    </div>
                                                    <span className="text-slate-600 dark:text-slate-300 mt-1 truncate">
                                                        Sent by: <span className="font-medium text-slate-900 dark:text-slate-100">{pe.created_by?.full_name || 'System API'}</span>
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* Logs */}
                    <TabsContent value="logs" className="m-0 pt-2">
                        <ScreenLogsViewer screenId={screen.id} />
                    </TabsContent>

                    {/* Settings */}
                    <TabsContent value="settings" className="m-0 space-y-6">
                        <Card className="border-slate-200 dark:border-slate-800 shadow-sm max-w-3xl">
                            <CardHeader>
                                <CardTitle>Hardware Configuration</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleUpdateSettings} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label>Registered Location Node</Label>
                                            <Select value={settingsData.location_id} onValueChange={v => setSettingsData({ ...settingsData, location_id: v })}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Location Group..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">Unassigned Site</SelectItem>
                                                    {locations.map(loc => (
                                                        <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Render Orientation</Label>
                                            <Select value={settingsData.orientation} onValueChange={v => setSettingsData({ ...settingsData, orientation: v })}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Orientation..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="landscape">Landscape 16:9</SelectItem>
                                                    <SelectItem value="portrait">Portrait 9:16 (Tall)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Native Resolution</Label>
                                            <Select value={settingsData.resolution} onValueChange={v => setSettingsData({ ...settingsData, resolution: v })}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Resolutions..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="1920x1080">1920x1080 (1080p FHD)</SelectItem>
                                                    <SelectItem value="3840x2160">3840x2160 (4K UHD)</SelectItem>
                                                    <SelectItem value="1080x1920">1080x1920 (Portrait FHD)</SelectItem>
                                                    <SelectItem value="custom">Custom Canvas Array</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <Button type="submit">Deploy Settings</Button>
                                </form>
                            </CardContent>
                        </Card>

                        {/* Danger zone */}
                        <Card className="border-red-200 dark:border-red-900 shadow-sm max-w-3xl">
                            <CardHeader>
                                <CardTitle className="text-red-700 dark:text-red-500">Danger Zone</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 p-4 border border-red-100 dark:border-red-900/50 rounded-lg bg-red-50 dark:bg-red-950/20">
                                    <div>
                                        <h4 className="font-semibold text-slate-900 dark:text-slate-100">Decommission Endpoint</h4>
                                        <p className="text-sm text-slate-500 mt-1">Permanently severs access token mapping. Device will instantly drop into untrusted state.</p>
                                    </div>
                                    <Button variant="destructive" onClick={handleDeleteScreen}>Delete Endpoint</Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>


                    {/* ── SCHEDULE TIMELINE TAB ────────────────────────────── */}
                    <TabsContent value="schedule" className="m-0">
                        <ScheduleTimeline
                            allSchedules={allSchedules}
                            locationTz={locationTz}
                            projects={projects}
                        />
                    </TabsContent>
                    {/* ── PROJECT SCHEDULE TAB ──────────────────────────────── */}
                    <TabsContent value="project-schedule" className="m-0 space-y-6">
                        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Weekly Schedule Timeline</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {screenProjectsLoading ? (
                                    <Skeleton className="h-48 w-full" />
                                ) : (
                                    <WeeklyScheduleTimeline screenProjects={screenProjects} timezone={locationTz} />
                                )}
                            </CardContent>
                        </Card>
                        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between pb-3">
                                <div>
                                    <CardTitle className="text-base">Assigned Projects</CardTitle>
                                    <CardDescription>Manage which projects play on this screen and when</CardDescription>
                                </div>
                                <Button onClick={() => { setEditTarget(null); setAssignDialogOpen(true) }}>
                                    <Plus className="h-4 w-4 mr-2" /> Assign Project
                                </Button>
                            </CardHeader>
                            <CardContent>
                                {screenProjectsLoading ? (
                                    <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
                                ) : screenProjects.length === 0 ? (
                                    <div className="text-center py-10 text-slate-500 border border-dashed rounded-lg">
                                        <Layers className="h-8 w-8 mx-auto mb-3 opacity-20" />
                                        <p className="text-sm">No projects assigned yet.</p>
                                        <Button variant="outline" className="mt-4" onClick={() => { setEditTarget(null); setAssignDialogOpen(true) }}>
                                            <Plus className="h-4 w-4 mr-2" /> Assign First Project
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {screenProjects.map((sp, idx) => {
                                            const col = getProjectColor(idx)
                                            const isCurrentlyPlaying = liveCurrentState?.project_id === sp.project_id
                                            return (
                                                <div key={sp.id} className="flex items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-800 p-4 hover:border-slate-300 transition-all">
                                                    <div className="flex flex-col gap-0.5 shrink-0">
                                                        <button className="h-5 w-5 text-slate-400 hover:text-slate-700 disabled:opacity-20" disabled={idx === 0}
                                                            onClick={async () => {
                                                                const r = [...screenProjects]
                                                                ;[r[idx-1], r[idx]] = [r[idx], r[idx-1]]
                                                                await reorderScreenProjects(r.map((s,i) => ({id:s.id,sort_order:i})))
                                                                fetchScreenProjects()
                                                            }}>
                                                            <ChevronUp className="h-4 w-4" />
                                                        </button>
                                                        <button className="h-5 w-5 text-slate-400 hover:text-slate-700 disabled:opacity-20" disabled={idx === screenProjects.length-1}
                                                            onClick={async () => {
                                                                const r = [...screenProjects]
                                                                ;[r[idx], r[idx+1]] = [r[idx+1], r[idx]]
                                                                await reorderScreenProjects(r.map((s,i) => ({id:s.id,sort_order:i})))
                                                                fetchScreenProjects()
                                                            }}>
                                                            <ChevronDown className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                    <div className={`h-2.5 w-2.5 rounded-full mt-1.5 shrink-0 ${col.dot}`} />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                                            <span className="font-semibold text-sm">{sp.project?.name || sp.project_id}</span>
                                                            {sp.schedule_type === 'always' ? (
                                                                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]">Always On</Badge>
                                                            ) : (
                                                                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 text-[10px]">Scheduled</Badge>
                                                            )}
                                                            {isCurrentlyPlaying && (
                                                                <Badge className="bg-emerald-500 text-white text-[10px]">▶ NOW PLAYING</Badge>
                                                            )}
                                                        </div>
                                                        {sp.schedule_type === 'scheduled' && (
                                                            <p className="text-xs text-slate-500 font-mono">
                                                                {sp.start_time}→{sp.end_time} · {sp.days_of_week.map(d => DAY_LABELS[d]).join(', ')}
                                                                {sp.start_date && ` · ${sp.start_date}→${sp.end_date}`}
                                                            </p>
                                                        )}
                                                        <p className="text-[10px] text-slate-400 mt-0.5">Priority: {sp.priority}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <Switch
                                                            checked={sp.is_active}
                                                            onCheckedChange={async (checked) => {
                                                                await updateScreenProject(sp.id, { is_active: checked })
                                                                fetchScreenProjects()
                                                            }}
                                                        />
                                                        <Button size="sm" variant="ghost" onClick={() => { setEditTarget(sp); setAssignDialogOpen(true) }}>Edit</Button>
                                                        <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => setDeleteTargetSP(sp)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
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


// ─────────────────────────────────────────────────────────────────
// PROJECT PALETTE (matches schedule-panel.tsx)
// ─────────────────────────────────────────────────────────────────
const PALETTE = [
    { bg: 'bg-indigo-500', text: 'text-indigo-100', ring: 'ring-indigo-300' },
    { bg: 'bg-violet-500', text: 'text-violet-100', ring: 'ring-violet-300' },
    { bg: 'bg-emerald-500', text: 'text-emerald-100', ring: 'ring-emerald-300' },
    { bg: 'bg-amber-500', text: 'text-amber-100', ring: 'ring-amber-300' },
    { bg: 'bg-rose-500', text: 'text-rose-100', ring: 'ring-rose-300' },
    { bg: 'bg-cyan-500', text: 'text-cyan-100', ring: 'ring-cyan-300' },
    { bg: 'bg-pink-500', text: 'text-pink-100', ring: 'ring-pink-300' },
    { bg: 'bg-teal-500', text: 'text-teal-100', ring: 'ring-teal-300' },
]

// ─────────────────────────────────────────────────────────────────
// WEEKLY TIMELINE COMPONENT
// ─────────────────────────────────────────────────────────────────
function ScheduleTimeline({
    allSchedules,
    locationTz,
    projects,
}: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    allSchedules: (Schedule & { project_name: string; project_color: number })[]
    locationTz: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    projects: any[]
}) {
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
                        const col = PALETTE[s.project_color % PALETTE.length]
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
                        const col = PALETTE[s.project_color % PALETTE.length]
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
                                                    const col = PALETTE[s.project_color % PALETTE.length]
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
                        const col = PALETTE[idx % PALETTE.length]
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
}
