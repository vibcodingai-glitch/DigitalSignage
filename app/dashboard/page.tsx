"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/hooks/use-user"
import { formatDistanceToNow } from "date-fns"

import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Activity, ChevronRight, CheckCircle2, XCircle,
    TrendingUp, Wifi, Radio, Monitor, MapPin, Layers,
    FolderOpen, AlertCircle, ArrowRight
} from "lucide-react"

interface RecentScreen {
    id: string;
    name: string;
    status: string;
    resolution?: string | null;
    last_heartbeat?: string | null;
    location?: { name: string } | null;
    project?: { name: string } | null;
}

interface RecentActivity {
    id: string;
    event: string;
    created_at: string;
    details?: Record<string, unknown> | null;
    screen?: { name: string } | null;
}

interface DashboardData {
    screens: { total: number; online: number; offline: number; unassigned: number };
    locations: number;
    projects: number;
    contentItems: number;
    recentScreens: RecentScreen[];
    recentActivity: RecentActivity[];
}

const eventColorMap: Record<string, string> = {
    connect: "bg-emerald-500",
    disconnect: "bg-red-500",
    heartbeat: "bg-blue-500",
    status_change: "bg-amber-500",
    error: "bg-red-500",
}

const EMPTY_DATA: DashboardData = {
    screens: { total: 0, online: 0, offline: 0, unassigned: 0 },
    locations: 0, projects: 0, contentItems: 0,
    recentScreens: [], recentActivity: []
}

export default function DashboardOverviewPage() {
    const { profile } = useUser()
    const supabase = createClient()
    const [data, setData] = useState<DashboardData>(EMPTY_DATA)
    const [isFetching, setIsFetching] = useState(true)

    const fetchDashboardData = useCallback(async () => {
        setIsFetching(true)
        try {
            // 1. Fetch all base data in parallel without any nested RLS joins
            const [
                { data: screensBase },
                { data: locationsBase },
                { data: projectsBase },
                { data: contentBase },
                { data: activityBase }
            ] = await Promise.all([
                supabase.from('screens').select('id, name, status, resolution, last_heartbeat, location_id, active_project_id'),
                supabase.from('locations').select('id, name'),
                supabase.from('projects').select('id, name, is_active'),
                supabase.from('content_items').select('id'),
                supabase.from('screen_logs')
                    .select('id, event, created_at, details, screen_id')
                    .order('created_at', { ascending: false })
                    .limit(10)
            ])

            const screens = screensBase || []
            const locations = locationsBase || []
            const projects = projectsBase || []
            const contentItems = contentBase || []
            const activityLogs = activityBase || []

            // 2. Map relations in memory
            const enrichedScreens: RecentScreen[] = screens.map(s => ({
                id: s.id,
                name: s.name,
                status: s.status,
                resolution: s.resolution,
                last_heartbeat: s.last_heartbeat,
                location: locations.find(l => l.id === s.location_id) || null,
                project: projects.find(p => p.id === s.active_project_id) || null
            }))

            const enrichedActivity: RecentActivity[] = activityLogs.map(log => ({
                id: log.id,
                event: log.event,
                created_at: log.created_at,
                details: log.details as Record<string, unknown>,
                screen: screens.find(s => s.id === log.screen_id) || null
            }))

            setData({
                screens: {
                    total: screens.length,
                    online: screens.filter(s => s.status === 'online').length,
                    offline: screens.filter(s => s.status === 'offline').length,
                    unassigned: enrichedScreens.filter(s => !s.project).length,
                },
                locations: locations.length,
                projects: projects.filter(p => p.is_active).length,
                contentItems: contentItems.length,
                recentScreens: enrichedScreens,
                recentActivity: enrichedActivity
            })
        } catch (error) {
            console.error("Error fetching dashboard data:", error)
        } finally {
            setIsFetching(false)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        fetchDashboardData()
    }, [fetchDashboardData])


    const onlinePct = data.screens.total > 0
        ? Math.round((data.screens.online / data.screens.total) * 100)
        : 0

    return (
        <div className="space-y-8 animate-in fade-in duration-500">

            {/* Welcome banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-violet-800 p-6 text-white shadow-xl shadow-blue-500/20">
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
                <div className="relative flex items-center justify-between gap-6">
                    <div>
                        <p className="text-blue-200 text-sm font-medium mb-1">Welcome back 👋</p>
                        <h2 className="text-2xl font-bold tracking-tight">
                            {profile?.full_name?.split(' ')[0] || 'Admin'}
                        </h2>
                        <p className="text-blue-200 text-sm mt-1">
                            Your network has <span className="font-semibold text-white">{data.screens.online} screen{data.screens.online !== 1 ? 's' : ''}</span> broadcasting live right now.
                        </p>
                    </div>
                    <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-blue-200">Network health</span>
                            <span className="text-white font-bold text-lg">{onlinePct}%</span>
                        </div>
                        <div className="w-40 h-2 bg-white/20 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-white rounded-full transition-all duration-700"
                                style={{ width: `${onlinePct}%` }}
                            />
                        </div>
                        <span className="text-blue-200 text-xs">{data.screens.online} / {data.screens.total} online</span>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                    title="Total Screens"
                    value={data.screens.total}
                    icon={<Monitor className="h-5 w-5" />}
                    iconBg="from-emerald-500 to-teal-600"
                    sub={
                        <div className="flex items-center gap-3 text-xs">
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                                {data.screens.online} online
                            </span>
                            <span className="flex items-center gap-1 text-red-500 font-medium">
                                <span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />
                                {data.screens.offline} offline
                            </span>
                        </div>
                    }
                    href="/dashboard/screens"
                />
                <KpiCard
                    title="Locations"
                    value={data.locations}
                    icon={<MapPin className="h-5 w-5" />}
                    iconBg="from-blue-500 to-cyan-600"
                    sub={<span className="text-xs text-slate-500 dark:text-slate-400">Registered regions</span>}
                    href="/dashboard/locations"
                />
                <KpiCard
                    title="Active Projects"
                    value={data.projects}
                    icon={<Layers className="h-5 w-5" />}
                    iconBg="from-violet-500 to-purple-600"
                    sub={<span className="text-xs text-slate-500 dark:text-slate-400">Currently broadcasting</span>}
                    href="/dashboard/projects"
                />
                <KpiCard
                    title="Content Assets"
                    value={data.contentItems}
                    icon={<FolderOpen className="h-5 w-5" />}
                    iconBg="from-orange-500 to-amber-600"
                    sub={<span className="text-xs text-slate-500 dark:text-slate-400">Uploaded media</span>}
                    href="/dashboard/content"
                />
            </div>

            {/* Screen Status + Live Preview */}
            <div className="space-y-3">
                {/* Uptime bar */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-xl bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 shadow-sm">
                    <div className="flex items-center gap-3 shrink-0">
                        <span className="text-3xl font-bold text-slate-900 dark:text-white">{onlinePct}%</span>
                        <div>
                            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Screen Uptime</p>
                            <p className="text-[11px] text-slate-400">{data.screens.online} of {data.screens.total} screens online</p>
                        </div>
                    </div>
                    <div className="flex-1 h-2 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden mx-2 hidden sm:block">
                        <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-700" style={{ width: `${onlinePct}%` }} />
                    </div>
                    <div className="flex items-center gap-4 text-xs shrink-0">
                        <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                            <CheckCircle2 className="h-3.5 w-3.5" /> {data.screens.online} Online
                        </span>
                        <span className="flex items-center gap-1.5 text-red-500 font-semibold">
                            <XCircle className="h-3.5 w-3.5" /> {data.screens.offline} Offline
                        </span>
                        <span className="flex items-center gap-1.5 text-amber-500 font-semibold">
                            <AlertCircle className="h-3.5 w-3.5" /> {data.screens.unassigned} Unassigned
                        </span>
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-slate-500" onClick={fetchDashboardData}>
                            <TrendingUp className="h-3 w-3" /> Refresh
                        </Button>
                    </div>
                </div>

                {/* Table + Preview */}
                <div className="grid gap-4 xl:grid-cols-5">
                    {/* Screen Status Table */}
                    <div className="xl:col-span-3">
                        <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-white/[0.02] overflow-hidden shadow-sm">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/5">
                                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Screen Status</h2>
                                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-blue-600 dark:text-blue-400" asChild>
                                    <Link href="/dashboard/screens">View all <ChevronRight className="h-3 w-3" /></Link>
                                </Button>
                            </div>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-white/5">
                                        <th className="pl-4 pr-2 py-2 text-left">Status</th>
                                        <th className="px-2 py-2 text-left">Screen</th>
                                        <th className="px-2 py-2 text-left hidden sm:table-cell">Location</th>
                                        <th className="px-2 py-2 text-left hidden md:table-cell">Project</th>
                                        <th className="px-2 pr-4 py-2 text-right hidden lg:table-cell">Last Heartbeat</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                                    {data.recentScreens.length === 0 ? (
                                        <tr><td colSpan={5} className="text-center py-10 text-slate-400 text-xs">No screens configured</td></tr>
                                    ) : (
                                        data.recentScreens.map(screen => (
                                            <tr key={screen.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                                                <td className="pl-4 pr-2 py-2.5">
                                                    {screen.status === 'online' ? (
                                                        <span className="flex items-center gap-1.5 text-emerald-600 font-semibold text-xs">
                                                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Online
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1.5 text-red-500 font-semibold text-xs">
                                                            <span className="h-2 w-2 rounded-full bg-red-500" /> Offline
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-2 py-2.5">
                                                    <Link href={`/dashboard/screens/${screen.id}`} className="font-medium text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors block">
                                                        {screen.name}
                                                    </Link>
                                                    {screen.resolution && <span className="text-[10px] text-slate-400 uppercase">{screen.resolution}</span>}
                                                </td>
                                                <td className="px-2 py-2.5 text-xs text-slate-500 hidden sm:table-cell">
                                                    <span className="flex items-center gap-1">
                                                        <MapPin className="h-3 w-3 shrink-0" />
                                                        {screen.location?.name || <span className="text-slate-300">—</span>}
                                                    </span>
                                                </td>
                                                <td className="px-2 py-2.5 text-xs text-slate-500 hidden md:table-cell">
                                                    <span className="flex items-center gap-1">
                                                        <Layers className="h-3 w-3 shrink-0" />
                                                        {screen.project?.name || <span className="text-slate-300">No project</span>}
                                                    </span>
                                                </td>
                                                <td className="px-2 pr-4 py-2.5 text-[11px] text-slate-400 text-right hidden lg:table-cell">
                                                    {screen.last_heartbeat
                                                        ? formatDistanceToNow(new Date(screen.last_heartbeat), { addSuffix: true })
                                                        : '—'
                                                    }
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Live Preview Panel */}
                    <div className="xl:col-span-2 space-y-3">
                        <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-white/[0.02] overflow-hidden shadow-sm">
                            <div className="px-4 py-3 border-b border-slate-100 dark:border-white/5">
                                <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                    <Wifi className="h-4 w-4 text-blue-500" /> Live Preview
                                </h2>
                            </div>
                            <div className="divide-y divide-slate-50 dark:divide-white/5 max-h-80 overflow-y-auto">
                                {data.recentScreens.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                                        <Monitor className="h-8 w-8 mb-2 opacity-30" />
                                        <p className="text-xs">No screens yet</p>
                                    </div>
                                ) : (
                                    data.recentScreens.map(screen => (
                                        <Link key={screen.id} href={`/dashboard/screens/${screen.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group">
                                            <div className="relative shrink-0 w-16 h-10 rounded-md bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center overflow-hidden">
                                                <Monitor className="h-4 w-4 text-white/20" />
                                                <span className={`absolute top-1 right-1 h-2 w-2 rounded-full ${
                                                    screen.status === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
                                                }`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{screen.name}</p>
                                                <p className="text-[11px] text-slate-400 truncate">{screen.project?.name || 'No project'}</p>
                                            </div>
                                            <Badge className={`text-[10px] shrink-0 ${
                                                screen.status === 'online'
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
                                                    : 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
                                            } border`}>
                                                {screen.status === 'online' ? 'Online' : 'Offline'}
                                            </Badge>
                                        </Link>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Activity Feed — moved here in condensed form */}
                        <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-white/[0.02] overflow-hidden shadow-sm">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/5">
                                <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                    <Activity className="h-4 w-4 text-violet-500" /> Activity
                                </h2>
                                <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                    <span className="relative flex h-1.5 w-1.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                    </span>
                                    Live
                                </span>
                            </div>
                            <div className="divide-y divide-slate-50 dark:divide-white/5 max-h-48 overflow-y-auto">
                                {data.recentActivity.length === 0 ? (
                                    <div className="flex items-center justify-center py-8 text-slate-400">
                                        <Radio className="h-5 w-5 mr-2 opacity-30" />
                                        <p className="text-xs">No recent activity</p>
                                    </div>
                                ) : (
                                    data.recentActivity.map(log => (
                                        <div key={log.id} className="flex items-start gap-2.5 px-4 py-2.5">
                                            <div className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${eventColorMap[log.event] || 'bg-slate-400'}`} />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-tight">{formatEventName(log.event)}</p>
                                                <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                                                    {log.screen?.name && <span className="font-medium text-slate-500">{log.screen.name} · </span>}
                                                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ── Sub-components ──────────────────────────────────────────

function KpiCard({
    title, value, icon, iconBg, sub, href
}: {
    title: string
    value: number
    icon: React.ReactNode
    iconBg: string
    sub: React.ReactNode
    href: string
}) {
    return (
        <Link href={href} className="group block">
            <Card className="border-slate-200 dark:border-white/5 shadow-sm hover:shadow-md dark:bg-white/[0.02] transition-all hover:scale-[1.02] cursor-pointer">
                <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${iconBg} text-white shadow-lg`}>
                            {icon}
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-300 dark:text-slate-700 group-hover:text-blue-500 transition-colors mt-1" />
                    </div>
                    <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{value}</div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">{title}</p>
                    {sub}
                </CardContent>
            </Card>
        </Link>
    )
}



function formatEventName(event: string) {
    return event.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function DashboardSkeleton() {
    return (
        <div className="space-y-8 animate-pulse">
            <div className="h-28 rounded-2xl bg-gradient-to-br from-blue-600/30 to-violet-700/30" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map(i => (
                    <Card key={i} className="border-slate-200 dark:border-white/5">
                        <CardContent className="p-5 space-y-3">
                            <Skeleton className="h-10 w-10 rounded-xl" />
                            <Skeleton className="h-8 w-16" />
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-3 w-32" />
                        </CardContent>
                    </Card>
                ))}
            </div>
            <div className="grid gap-6 xl:grid-cols-7">
                <div className="xl:col-span-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[1, 2, 3].map(i => (
                            <Card key={i} className="border-slate-200 dark:border-white/5">
                                <Skeleton className="aspect-video" />
                                <CardContent className="p-3 space-y-2">
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-3 w-1/2" />
                                    <Skeleton className="h-3 w-2/3" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
                <div className="xl:col-span-2">
                    <Card className="border-slate-200 dark:border-white/5">
                        <CardContent className="p-4 space-y-4">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="flex gap-3">
                                    <Skeleton className="h-2 w-2 rounded-full mt-1.5 shrink-0" />
                                    <div className="space-y-1.5 flex-1">
                                        <Skeleton className="h-3.5 w-full" />
                                        <Skeleton className="h-3 w-1/2" />
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
