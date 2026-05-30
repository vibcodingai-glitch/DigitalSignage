"use client"

import React from "react"
import Link from "next/link"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { TabsContent } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Play } from "lucide-react"

interface BroadcastSourceTabProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    screen: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    projects: any[]
    activeProjectSelection: string
    onActiveProjectChange: (value: string) => void
    onSetActiveProject: () => void
}

export const BroadcastSourceTab = React.memo(function BroadcastSourceTab({
    screen,
    projects,
    activeProjectSelection,
    onActiveProjectChange,
    onSetActiveProject,
}: BroadcastSourceTabProps) {
    return (
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
                                <Select value={activeProjectSelection} onValueChange={onActiveProjectChange}>
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
                                onClick={onSetActiveProject}
                                disabled={activeProjectSelection === (screen.active_project_id || "none")}
                            >
                                Push Update
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
    )
})
