"use client"

import { useMemo, useCallback } from "react"
import { useUser } from "@/hooks/use-user"
import { useStats, useScreens, useRecentActivity } from "@/hooks/use-dashboard"

import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Monitor, MapPin, Layers, FolderOpen } from "lucide-react"

import {
    KpiCard, WelcomeBanner, UptimeBar,
    ScreenStatusTable, LivePreviewPanel, ActivityFeed
} from "@/components/dashboard/DashboardWidgets"

export default function DashboardOverviewPage() {
    const { profile } = useUser()
    const { data: stats, isLoading: statsLoading, refresh: refreshStats } = useStats()
    const { data: screens, isLoading: screensLoading, refresh: refreshScreens } = useScreens()
    const { data: activity, isLoading: activityLoading, refresh: refreshActivity } = useRecentActivity()

    const fetchDashboardData = useCallback(() => {
        refreshStats()
        refreshScreens()
        refreshActivity()
    }, [refreshStats, refreshScreens, refreshActivity])

    const onlinePct = useMemo(() => 
        stats?.screens.total && stats.screens.total > 0
            ? Math.round((stats.screens.online / stats.screens.total) * 100)
            : 0,
        [stats?.screens.total, stats?.screens.online]
    )

    const firstName = profile?.full_name?.split(' ')[0] || 'Admin'

    return (
        <div className="space-y-8 animate-in fade-in duration-500">

            {/* Welcome banner */}
            <WelcomeBanner
                firstName={firstName}
                onlineCount={stats?.screens.online || 0}
                totalCount={stats?.screens.total || 0}
                onlinePct={onlinePct}
            />

            {/* KPI Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {statsLoading && !stats ? (
                    [1, 2, 3, 4].map(i => (
                        <Card key={i} className="border-slate-200 dark:border-slate-800">
                            <CardContent className="p-5 space-y-3">
                                <Skeleton className="h-10 w-10 rounded-xl bg-slate-200 dark:bg-slate-800" />
                                <Skeleton className="h-8 w-16 bg-slate-200 dark:bg-slate-800" />
                                <Skeleton className="h-4 w-24 bg-slate-200 dark:bg-slate-800" />
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <>
                        <KpiCard
                            title="Total Screens"
                            value={stats?.screens.total || 0}
                            icon={<Monitor className="h-5 w-5" />}
                            iconBg="from-emerald-500 to-teal-600"
                            sub={
                                <div className="flex items-center gap-3 text-xs">
                                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                                        {stats?.screens.online || 0} online
                                    </span>
                                    <span className="flex items-center gap-1 text-red-500 font-medium">
                                        <span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />
                                        {stats?.screens.offline || 0} offline
                                    </span>
                                </div>
                            }
                            href="/dashboard/screens"
                        />
                        <KpiCard
                            title="Locations"
                            value={stats?.locations || 0}
                            icon={<MapPin className="h-5 w-5" />}
                            iconBg="from-blue-500 to-cyan-600"
                            sub={<span className="text-xs text-slate-500 dark:text-slate-400">Registered regions</span>}
                            href="/dashboard/locations"
                        />
                        <KpiCard
                            title="Active Projects"
                            value={stats?.projects || 0}
                            icon={<Layers className="h-5 w-5" />}
                            iconBg="from-violet-500 to-purple-600"
                            sub={<span className="text-xs text-slate-500 dark:text-slate-400">Currently broadcasting</span>}
                            href="/dashboard/projects"
                        />
                        <KpiCard
                            title="Content Assets"
                            value={stats?.contentItems || 0}
                            icon={<FolderOpen className="h-5 w-5" />}
                            iconBg="from-orange-500 to-amber-600"
                            sub={<span className="text-xs text-slate-500 dark:text-slate-400">Uploaded media</span>}
                            href="/dashboard/content"
                        />
                    </>
                )}
            </div>

            {/* Screen Status + Live Preview */}
            <div className="space-y-3">
                <UptimeBar
                    onlinePct={onlinePct}
                    onlineCount={stats?.screens.online || 0}
                    totalCount={stats?.screens.total || 0}
                    offlineCount={stats?.screens.offline || 0}
                    unassignedCount={stats?.screens.unassigned || 0}
                    onRefresh={fetchDashboardData}
                />

                <div className="grid gap-4 xl:grid-cols-5">
                    <ScreenStatusTable screens={screens} isLoading={screensLoading} />

                    <div className="xl:col-span-2 space-y-3">
                        <LivePreviewPanel screens={screens} isLoading={screensLoading} />
                        <ActivityFeed activity={activity} isLoading={activityLoading} />
                    </div>
                </div>
            </div>
        </div>
    )
}
