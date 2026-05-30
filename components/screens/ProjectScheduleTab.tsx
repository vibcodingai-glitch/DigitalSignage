"use client"

import React from "react"
import { DAY_LABELS } from "@/lib/schedule-engine"
import { WeeklyScheduleTimeline, getProjectColor } from "@/components/WeeklyScheduleTimeline"
import type { ScreenProject } from "@/lib/screen-projects"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { TabsContent } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Trash2, ChevronUp, ChevronDown, Layers } from "lucide-react"

interface ProjectScheduleTabProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    screen: any
    screenProjects: ScreenProject[]
    screenProjectsLoading: boolean
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    liveCurrentState: any
    locationTz: string
    onAssign: () => void
    onEdit: (sp: ScreenProject) => void
    onDelete: (sp: ScreenProject) => void
    onToggleActive: (sp: ScreenProject, checked: boolean) => void
    onReorder: (index: number, direction: 'up' | 'down') => void
    onRefreshProjects: () => void
}

export const ProjectScheduleTab = React.memo(function ProjectScheduleTab({
    screen,
    screenProjects,
    screenProjectsLoading,
    liveCurrentState,
    locationTz,
    onAssign,
    onEdit,
    onDelete,
    onToggleActive,
    onReorder,
    onRefreshProjects,
}: ProjectScheduleTabProps) {
    return (
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
                    <Button onClick={onAssign}>
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
                            <Button variant="outline" className="mt-4" onClick={onAssign}>
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
                                                onClick={() => onReorder(idx, 'up')}>
                                                <ChevronUp className="h-4 w-4" />
                                            </button>
                                            <button className="h-5 w-5 text-slate-400 hover:text-slate-700 disabled:opacity-20" disabled={idx === screenProjects.length-1}
                                                onClick={() => onReorder(idx, 'down')}>
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
                                                onCheckedChange={(checked) => onToggleActive(sp, checked)}
                                            />
                                            <Button size="sm" variant="ghost" onClick={() => onEdit(sp)}>Edit</Button>
                                            <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => onDelete(sp)}>
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
    )
})
