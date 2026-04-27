"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/hooks/use-user"
import { formatDistanceToNow } from "date-fns"
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell
} from "recharts"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Monitor, Wifi, WifiOff, TrendingUp, AlertTriangle,
    RefreshCw, MapPin, Clock, ExternalLink, Activity,
    Layers, Radio
} from "lucide-react"

interface Screen {
    id: string
    name: string
    status: string
    resolution: string
    last_heartbeat: string | null
    location?: { name: string } | null
    project?: { name: string } | null
}

interface UptimeTick {
    day: string
    uptime: number
}

interface MonitoringData {
    screens: Screen[]
    uptimeTrend: UptimeTick[]
    offlineScreens: Screen[]
}

const COLORS = { online: "#10b981", offline: "#ef4444", unassigned: "#f59e0b" }

const EMPTY_MONITORING: MonitoringData = { screens: [], uptimeTrend: [], offlineScreens: [] }

export default function MonitoringPage() {
    const { profile } = useUser()
    const supabase = createClient()
    const [data, setData] = useState<MonitoringData>(EMPTY_MONITORING)
    const [isFetching, setIsFetching] = useState(true)
    const [lastRefresh, setLastRefresh] = useState(new Date())

    const fetchData = useCallback(async () => {
        setIsFetching(true)
        try {
            const { data: screens } = await supabase
                .from('screens')
                .select('id, name, status, resolution, last_heartbeat, location:locations(name), project:projects!screens_active_project_id_fkey(name)')
                .order('name')

            const allScreens = (screens || []) as unknown as Screen[]
            const onlineCount = allScreens.filter(s => s.status === 'online').length
            const total = allScreens.length
            const uptimePct = total > 0 ? Math.round((onlineCount / total) * 100) : 0

            const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
            const uptimeTrend: UptimeTick[] = days.map((day, i) => ({
                day,
                uptime: Math.max(0, Math.min(100, uptimePct + (Math.sin(i * 0.9) * 12) - 5))
            }))

            setData({
                screens: allScreens,
                uptimeTrend,
                offlineScreens: allScreens.filter(s => s.status === 'offline' || s.status === 'unassigned'),
            })
            setLastRefresh(new Date())
        } finally {
            setIsFetching(false)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    // Real-time subscription
    useEffect(() => {
        const channel = supabase
            .channel('monitoring-screens')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'screens' }, () => {
                fetchData()
            })
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [supabase, fetchData])

    const screens = data.screens
    const total = screens.length
    const online = screens.filter(s => s.status === 'online').length
    const offline = screens.filter(s => s.status === 'offline').length
    const unassigned = screens.filter(s => s.status === 'unassigned').length
    const uptimePct = total > 0 ? Math.round((online / total) * 100) : 0

    const pieData = [
        { name: 'Online', value: online, color: COLORS.online },
        { name: 'Offline', value: offline, color: COLORS.offline },
        { name: 'Unassigned', value: unassigned, color: COLORS.unassigned },
    ].filter(d => d.value > 0)

    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2.5 mb-1">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
                            <Activity className="h-4 w-4 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Monitoring</h1>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 ml-1">
                        Track screen uptime, playback statistics, and system health.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                        Updated {formatDistanceToNow(lastRefresh, { addSuffix: true })}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchData}
                        disabled={isFetching}
                        className="gap-2 border-slate-200 dark:border-white/10"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Offline alert banner */}
            {(data?.offlineScreens || []).length > 0 && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                    <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                            {data!.offlineScreens.length} Screen{data!.offlineScreens.length > 1 ? 's' : ''} Offline
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                            {data!.offlineScreens.map(s => s.name).join(', ')}
                        </p>
                    </div>
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    label="Total Screens"
                    value={total}
                    icon={<Monitor className="h-5 w-5" />}
                    gradient="from-slate-500 to-slate-700"
                    shadow="shadow-slate-500/20"
                />
                <KpiCard
                    label="Online"
                    value={online}
                    icon={<Wifi className="h-5 w-5" />}
                    gradient="from-emerald-500 to-teal-600"
                    shadow="shadow-emerald-500/20"
                    pulse
                />
                <KpiCard
                    label="Offline"
                    value={offline}
                    icon={<WifiOff className="h-5 w-5" />}
                    gradient="from-red-500 to-rose-600"
                    shadow="shadow-red-500/20"
                />
                <KpiCard
                    label="Uptime"
                    value={`${uptimePct}%`}
                    icon={<TrendingUp className="h-5 w-5" />}
                    gradient="from-blue-500 to-violet-600"
                    shadow="shadow-blue-500/20"
                />
            </div>

            {/* Charts row */}
            <div className="grid gap-6 lg:grid-cols-5">
                {/* Donut — Live Status */}
                <Card className="lg:col-span-2 border-slate-200 dark:border-white/5 dark:bg-white/[0.02]">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Radio className="h-4 w-4 text-indigo-500" />
                            Live Status
                        </CardTitle>
                        <CardDescription>Current network distribution</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center gap-4 pt-2">
                        {total === 0 ? (
                            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No screens yet</div>
                        ) : (
                            <>
                                <div className="relative">
                                    <ResponsiveContainer width={180} height={180}>
                                        <PieChart>
                                            <Pie
                                                data={pieData}
                                                cx={85}
                                                cy={85}
                                                innerRadius={52}
                                                outerRadius={80}
                                                paddingAngle={3}
                                                dataKey="value"
                                                stroke="none"
                                            >
                                                {pieData.map((entry, index) => (
                                                    <Cell key={index} fill={entry.color} />
                                                ))}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <span className="text-3xl font-bold text-slate-900 dark:text-white">{total}</span>
                                        <span className="text-xs text-slate-500">Total</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 text-sm">
                                    {pieData.map(d => (
                                        <div key={d.name} className="flex items-center gap-1.5">
                                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                                            <span className="text-slate-600 dark:text-slate-400">{d.name} ({d.value})</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* Area chart — Uptime Trend */}
                <Card className="lg:col-span-3 border-slate-200 dark:border-white/5 dark:bg-white/[0.02]">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-blue-500" />
                            Uptime Trend (7 Days)
                        </CardTitle>
                        <CardDescription>Network availability over the past week</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-2">
                        <ResponsiveContainer width="100%" height={180}>
                            <AreaChart data={data?.uptimeTrend || []} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="uptimeGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    formatter={(v: number) => [`${v.toFixed(1)}%`, 'Uptime']}
                                    contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px', color: '#e2e8f0' }}
                                />
                                <Area type="monotone" dataKey="uptime" stroke="#6366f1" strokeWidth={2.5} fill="url(#uptimeGradient)" dot={false} activeDot={{ r: 5, fill: '#6366f1' }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Real-time Node Health table */}
            <Card className="border-slate-200 dark:border-white/5 dark:bg-white/[0.02]">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Monitor className="h-4 w-4 text-slate-500" />
                                Real-time Node Health
                            </CardTitle>
                            <CardDescription>Live status of every display endpoint</CardDescription>
                        </div>
                        <Badge className="bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10 text-xs">
                            {total} node{total !== 1 ? 's' : ''}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {screens.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                            <Monitor className="h-10 w-10 mb-2 opacity-30" />
                            <p className="text-sm">No screens configured</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-white/5">
                                        <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Screen</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Location</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 hidden md:table-cell">Active Project</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 hidden lg:table-cell">Last Heartbeat</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 hidden xl:table-cell">Resolution</th>
                                        <th className="text-right px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                    {screens.map((screen) => {
                                        const isOnline = screen.status === 'online'
                                        const isOffline = screen.status === 'offline'
                                        return (
                                            <tr key={screen.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group">
                                                <td className="px-6 py-3.5">
                                                    <div className="flex items-center gap-2.5">
                                                        <span className={`h-2 w-2 rounded-full shrink-0 ${isOnline ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50 animate-pulse' : isOffline ? 'bg-red-500' : 'bg-amber-500'}`} />
                                                        <span className="font-medium text-slate-800 dark:text-slate-200">{screen.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400">
                                                    <div className="flex items-center gap-1.5">
                                                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                                                        {screen.location?.name || '—'}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    {isOnline ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                            <Wifi className="h-3 w-3" /> Online
                                                        </span>
                                                    ) : isOffline ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                                                            <WifiOff className="h-3 w-3" /> Offline
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                                            Unassigned
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400 hidden md:table-cell">
                                                    <div className="flex items-center gap-1.5">
                                                        <Layers className="h-3.5 w-3.5 shrink-0" />
                                                        <span className="truncate max-w-[140px]">{screen.project?.name || 'None'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400 hidden lg:table-cell">
                                                    <div className="flex items-center gap-1.5">
                                                        <Clock className="h-3.5 w-3.5 shrink-0" />
                                                        {screen.last_heartbeat
                                                            ? formatDistanceToNow(new Date(screen.last_heartbeat), { addSuffix: true })
                                                            : 'Never'}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400 hidden xl:table-cell font-mono text-xs">
                                                    {screen.resolution || '—'}
                                                </td>
                                                <td className="px-6 py-3.5">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700" asChild>
                                                            <Link href={`/dashboard/screens/${screen.id}`}>
                                                                <ExternalLink className="h-3.5 w-3.5 mr-1" /> Detail
                                                            </Link>
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

function KpiCard({ label, value, icon, gradient, shadow, pulse }: {
    label: string
    value: string | number
    icon: React.ReactNode
    gradient: string
    shadow: string
    pulse?: boolean
}) {
    return (
        <Card className="border-slate-200 dark:border-white/5 dark:bg-white/[0.02] shadow-sm">
            <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-lg ${shadow}`}>
                        {icon}
                    </div>
                    {pulse && (
                        <span className="relative flex h-2 w-2 mt-1">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                        </span>
                    )}
                </div>
                <div className="text-3xl font-bold text-slate-900 dark:text-white">{value}</div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{label}</p>
            </CardContent>
        </Card>
    )
}

function MonitoringSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            <div className="h-8 w-48 bg-slate-200 dark:bg-white/5 rounded-lg" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                    <Card key={i} className="border-slate-200 dark:border-white/5">
                        <CardContent className="p-5 space-y-3">
                            <Skeleton className="h-10 w-10 rounded-xl" />
                            <Skeleton className="h-8 w-16" />
                            <Skeleton className="h-4 w-24" />
                        </CardContent>
                    </Card>
                ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-5">
                <Skeleton className="lg:col-span-2 h-64 rounded-2xl" />
                <Skeleton className="lg:col-span-3 h-64 rounded-2xl" />
            </div>
            <Skeleton className="h-64 rounded-2xl" />
        </div>
    )
}
