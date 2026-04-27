"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/hooks/use-user"
import { format } from "date-fns"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { Search, Plus, PlayCircle, MonitorPlay, Layers, Trash2, Edit, Calendar, Loader2 } from "lucide-react"
import { EmptyState } from "@/components/empty-state"

export default function ProjectsListPage() {
    const { profile } = useUser()
    const supabase = createClient()
    const { toast } = useToast()
    const router = useRouter()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [projects, setProjects] = useState<any[]>([])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [screens, setScreens] = useState<any[]>([])

    const [isFetching, setIsFetching] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [screenFilter, setScreenFilter] = useState("all")
    const [activeFilter, setActiveFilter] = useState("all")

    // Create Project Modal
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [isCreating, setIsCreating] = useState(false)
    const [newProject, setNewProject] = useState({
        name: "",
        screen_id: "unassigned",
        copy_from_id: "none"
    })

    const fetchProjects = useCallback(async () => {
        setIsFetching(true)
        try {
            // 1. Fetch base projects and screens without complex nested RLS joins
            const [{ data: projectsData, error: projectsError }, { data: screensData }] = await Promise.all([
                supabase
                    .from('projects')
                    .select('*, screen:screens!projects_screen_id_fkey(id, name)')
                    .order('created_at', { ascending: false }),
                supabase
                    .from('screens')
                    .select('id, name')
                    .order('name')
            ])

            if (projectsError) throw projectsError

            const projectsList = projectsData || []
            const projectIds = projectsList.map(p => p.id)

            // 2. Fetch related data separately to bypass RLS Cartesian join explosion
            let playlistItemsData: any[] = []
            let schedulesData: any[] = []

            if (projectIds.length > 0) {
                const [plRes, schRes] = await Promise.all([
                    supabase
                        .from('playlist_items')
                        .select('id, project_id, duration_override, content_item:content_items(duration_seconds)')
                        .in('project_id', projectIds),
                    supabase
                        .from('schedules')
                        .select('id, project_id')
                        .in('project_id', projectIds)
                ])
                playlistItemsData = plRes.data || []
                schedulesData = schRes.data || []
            }

            // 3. Map relationships in memory
            const formatted = projectsList.map((p: any) => {
                const pItems = playlistItemsData.filter(pi => pi.project_id === p.id)
                const pSchedules = schedulesData.filter(s => s.project_id === p.id)

                let totalDuration = 0
                pItems.forEach((pi: any) => {
                    totalDuration += (pi.duration_override || pi.content_item?.duration_seconds || 10)
                })
                
                return { 
                    ...p, 
                    numItems: pItems.length, 
                    totalDuration, 
                    numSchedules: pSchedules.length 
                }
            })

            setProjects(formatted)
            if (screensData) setScreens(screensData)
        } catch (error) {
            toast({ title: "Failed to load projects", variant: "destructive", description: (error as Error).message })
        } finally {
            setIsFetching(false)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        fetchProjects()
    }, [fetchProjects])

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newProject.name) return

        // profile loads async after session — fetch org_id directly to avoid race condition
        let orgId = profile?.organization_id
        if (!orgId) {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('organization_id')
                    .eq('id', user.id)
                    .single()
                orgId = profileData?.organization_id
            }
        }
        if (!orgId) {
            toast({ title: "Session not ready", description: "Please try again.", variant: "destructive" })
            return
        }

        setIsCreating(true)
        try {
            // 1. Create project
            const { data: projectRecord, error: projectError } = await supabase.from('projects').insert({
                organization_id: orgId,
                name: newProject.name,
                screen_id: newProject.screen_id === "unassigned" ? null : newProject.screen_id,
                is_active: false,
                settings: { "transition_type": "fade", "default_duration": 10, "loop": true }
            }).select().single()

            if (projectError) throw projectError

            // 2. Clone playlist items if specified
            if (newProject.copy_from_id !== "none") {
                const { data: sourceItems, error: itemsError } = await supabase
                    .from('playlist_items')
                    .select('*')
                    .eq('project_id', newProject.copy_from_id)

                if (itemsError) throw itemsError

                if (sourceItems && sourceItems.length > 0) {
                    const clonedItems = sourceItems.map(item => ({
                        project_id: projectRecord.id,
                        content_item_id: item.content_item_id,
                        order_index: item.order_index,
                        duration_override: item.duration_override,
                        transition_type: item.transition_type,
                        settings: item.settings
                    }))

                    const { error: cloneError } = await supabase.from('playlist_items').insert(clonedItems)
                    if (cloneError) throw cloneError
                }
            }

            toast({ title: "Project mapped successfully! Redirecting setup..." })
            router.push(`/dashboard/projects/${projectRecord.id}`)

        } catch (error) {
            toast({ title: "Failed to create project", variant: "destructive", description: (error as Error).message })
            setIsCreating(false)
        }
    }

    const deleteProject = async (id: string) => {
        try {
            const { error } = await supabase.from('projects').delete().eq('id', id)
            if (error) throw error
            toast({ title: "Project sequence wiped" })
            fetchProjects()
        } catch {
            toast({ title: "Failed to delete project", variant: "destructive" })
        }
    }

    // Formatting utils
    const formatDuration = (seconds: number) => {
        if (!seconds) return "0s"
        const m = Math.floor(seconds / 60)
        const s = seconds % 60
        if (m > 0) return `${m}m ${s}s`
        return `${s}s`
    }

    const filteredProjects = projects.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase())
        if (!matchesSearch) return false

        if (screenFilter !== 'all') {
            if (screenFilter === 'unassigned' && p.screen_id) return false
            if (screenFilter !== 'unassigned' && p.screen_id !== screenFilter) return false
        }

        if (activeFilter !== 'all') {
            if (activeFilter === 'active' && !p.is_active) return false
            if (activeFilter === 'inactive' && p.is_active) return false
        }

        return true
    })

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400 rounded-lg">
                        <Layers className="h-6 w-6" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">Timeline Projects</h1>
                </div>
                <Button onClick={() => setIsCreateOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Design Sequence
                </Button>
            </div>

            <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row gap-4 justify-between bg-slate-50/50 dark:bg-slate-900/20">
                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                            <Input placeholder="Search projects..." className="pl-9 h-10" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                        </div>

                        <Select value={screenFilter} onValueChange={setScreenFilter}>
                            <SelectTrigger className="w-full sm:w-48 h-10">
                                <SelectValue placeholder="Screen" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Bound Screens</SelectItem>
                                <SelectItem value="unassigned">Unassigned Sequences</SelectItem>
                                {screens.map(s => (
                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={activeFilter} onValueChange={setActiveFilter}>
                            <SelectTrigger className="w-full sm:w-40 h-10">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All States</SelectItem>
                                <SelectItem value="active">Active Playouts</SelectItem>
                                <SelectItem value="inactive">Idle Sequences</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-slate-100 dark:border-slate-800">
                                <TableHead className="w-[300px]">Project Name</TableHead>
                                <TableHead>Target Hub Matrix</TableHead>
                                <TableHead className="text-right">Playout Time</TableHead>
                                <TableHead className="text-center">Schedules</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Modified</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isFetching ? (
                                Array(4).fill(0).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-8 mx-auto" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-8 w-8 rounded-full ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : filteredProjects.length === 0 && !searchQuery && screenFilter === 'all' && activeFilter === 'all' ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="p-0">
                                        <EmptyState
                                            icon={Layers}
                                            title="No projects yet"
                                            description="Create your first project to start composing content timelines for your screens."
                                            action={{ label: "+ Create Project", onClick: () => setIsCreateOpen(true) }}
                                            className="border-none rounded-none"
                                        />
                                    </TableCell>
                                </TableRow>
                            ) : filteredProjects.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-32 text-center text-slate-500">
                                        No projects match your filters.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredProjects.map((project) => (
                                    <TableRow key={project.id} className="group border-slate-100 dark:border-slate-800">
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className={`flex h-8 w-8 items-center justify-center rounded-md border ${project.is_active ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-400' : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-900 dark:border-slate-800'}`}>
                                                    <PlayCircle className="h-4 w-4" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <Link href={`/dashboard/projects/${project.id}`} className="font-semibold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                                                        {project.name}
                                                    </Link>
                                                    <span className="text-xs text-slate-500">{project.numItems} assets queued</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {project.screen ? (
                                                <Link href={`/dashboard/screens/${project.screen.id}`}>
                                                    <Badge variant="outline" className="font-normal bg-white dark:bg-slate-950 hover:bg-slate-100 cursor-pointer">
                                                        <MonitorPlay className="h-3 w-3 mr-1.5 text-slate-400" />
                                                        {project.screen.name}
                                                    </Badge>
                                                </Link>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">Floating Sandbox (Unbound)</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-sm text-slate-600 dark:text-slate-300">
                                            {formatDuration(project.totalDuration)}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {project.numSchedules > 0 ? (
                                                <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-none">
                                                    <Calendar className="h-3 w-3 mr-1" /> {project.numSchedules} Rule(s)
                                                </Badge>
                                            ) : (
                                                <span className="text-xs text-slate-400">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {project.is_active ? (
                                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 shadow-none font-medium">LIVE BROADCAST</Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-slate-500 font-medium border-slate-200">IDLE CYCLE</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm text-slate-500">
                                            {format(new Date(project.created_at), 'MMM d, h:mm a')}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                                    <Link href={`/dashboard/projects/${project.id}`}>
                                                        <Edit className="h-4 w-4 text-slate-500" />
                                                    </Link>
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => deleteProject(project.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Frame Initial Architecture</DialogTitle>
                        <DialogDescription>
                            Deploy a fresh structural matrix timeline sequence.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleCreateProject} className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Sequence Build Designation</Label>
                            <Input
                                id="name"
                                placeholder="E.g. Morning Lobby Showcase..."
                                value={newProject.name}
                                onChange={e => setNewProject({ ...newProject, name: e.target.value })}
                                required
                                autoFocus
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="screen_id">Hardware Node Binding</Label>
                            <Select value={newProject.screen_id} onValueChange={v => setNewProject({ ...newProject, screen_id: v })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select target node" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="unassigned" className="text-amber-600 font-medium">Float Unassigned (Sandbox Draft)</SelectItem>
                                    {screens.map(s => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-[10px] text-slate-500">Dictates aspect ratio guidelines and geographical routing limits implicitly.</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="copy_from_id">Duplicate Master Template</Label>
                            <Select value={newProject.copy_from_id} onValueChange={v => setNewProject({ ...newProject, copy_from_id: v })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Start from blank frame..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none" className="italic">Standard Blank Frame</SelectItem>
                                    {projects.map(p => (
                                        <SelectItem key={p.id} value={p.id}>Copy &quot;{p.name}&quot;</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <DialogFooter className="pt-4 mt-2">
                            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel Origin</Button>
                            <Button type="submit" disabled={isCreating || !newProject.name}>
                                {isCreating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</> : "Create Project"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
