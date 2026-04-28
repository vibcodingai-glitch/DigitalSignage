"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/hooks/use-user"
import { formatDistanceToNow } from "date-fns"
import { useScreens } from "@/hooks/use-dashboard"

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { MonitorPlay, Search, Plus, MapPin, CheckCircle2, XCircle, AlertCircle, Copy, MoreVertical, Edit, ExternalLink, Trash2, Smartphone, Signal, ChevronRight } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { EmptyState } from "@/components/empty-state"
import { getDisplayUrl, getAppUrl } from "@/lib/app-url"

interface Screen {
    id: string;
    display_key: string;
    name: string;
    status: string;
    orientation: string;
    resolution: string;
    last_heartbeat: string | null;
    location_id: string | null;
    location?: { id: string, name: string } | null;
    project?: { name: string } | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    current_state?: any;
    screen_projects?: { count: number }[];
}

interface Location {
    id: string;
    name: string;
}

export default function ScreensPage() {
    const { profile } = useUser()
    const supabase = createClient()
    const { toast } = useToast()

    const { data: screensData, isLoading: isFetching, refresh: fetchData } = useScreens()
    const screens = screensData || []

    // Fetch locations for the create form
    const [locations, setLocations] = useState<Location[]>([])
    useEffect(() => {
        supabase.from('locations').select('id, name').then(({ data }) => {
            if (data) setLocations(data as Location[])
        })
    }, [supabase])

    // Filters
    const [searchQuery, setSearchQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")
    const [locationFilter, setLocationFilter] = useState("all")

    // Dialog states
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [isSuccessOpen, setIsSuccessOpen] = useState(false)
    const [createdScreenUrl, setCreatedScreenUrl] = useState("")

    // Delete states
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [screenToDelete, setScreenToDelete] = useState<Screen | null>(null)

    // Form states
    const [formData, setFormData] = useState({
        name: "",
        location_id: "none",
        orientation: "landscape",
        resolution: "1920x1080"
    })

    // Filters
    const filteredScreens = screens.filter(screen => {
        const matchesSearch = screen.name.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesStatus = statusFilter === 'all' || screen.status === statusFilter
        const matchesLocation = locationFilter === 'all'
            || (locationFilter === 'none' && !screen.location_id)
            || screen.location_id === locationFilter

        return matchesSearch && matchesStatus && matchesLocation
    })

    const handleCreateScreen = async (e: React.FormEvent) => {
        e.preventDefault()

        // Get organization_id from profile, or fetch it directly if profile not yet loaded
        let orgId = profile?.organization_id
        if (!orgId) {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
                if (data?.organization_id) orgId = data.organization_id
            }
        }
        if (!orgId) {
            toast({ title: "Not ready", description: "Your session is still loading. Please try again.", variant: "destructive" })
            return
        }

        setIsSaving(true)
        try {
            const payload = {
                organization_id: orgId,
                name: formData.name,
                location_id: formData.location_id === "none" ? null : formData.location_id,
                orientation: formData.orientation,
                resolution: formData.resolution,
                status: 'unassigned' // Let the DB constraints allow it
            }

            const { data, error } = await supabase
                .from('screens')
                .insert(payload)
                .select()
                .single()

            if (error) throw error

            setIsCreateOpen(false)
            setCreatedScreenUrl(getDisplayUrl(data.display_key))
            setIsSuccessOpen(true)

            // reset form
            setFormData({
                name: "",
                location_id: "none",
                orientation: "landscape",
                resolution: "1920x1080"
            })

            fetchData()
        } catch (error) {
            toast({
                title: "Failed to create screen",
                description: (error as Error).message,
                variant: "destructive"
            })
        } finally {
            setIsSaving(false)
        }
    }

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text)
            toast({ title: "Copied to clipboard" })
        } catch {
            toast({
                title: "Failed to copy",
                description: "Please copy it manually",
                variant: "destructive"
            })
        }
    }

    const handleConfirmDelete = async () => {
        if (!screenToDelete) return

        try {
            const { error } = await supabase
                .from('screens')
                .delete()
                .eq('id', screenToDelete.id)

            if (error) throw error

            toast({ title: "Screen deleted successfully" })
            fetchData()
        } catch (error) {
            toast({
                title: "Failed to delete screen",
                description: (error as Error).message,
                variant: "destructive"
            })
        } finally {
            setIsDeleteDialogOpen(false)
            setScreenToDelete(null)
        }
    }

    const openDisplayApp = (displayKey: string) => {
        window.open(`/display/${displayKey}`, '_blank')
    }

    // compute stats for header
    const onlineCount = screens.filter(s => s.status === 'online').length
    const offlineCount = screens.filter(s => s.status === 'offline').length

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <div className="flex items-center gap-2.5 mb-1">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-500/20">
                            <MonitorPlay className="h-4.5 w-4.5 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Screens</h1>
                    </div>
                    <div className="flex items-center gap-3 ml-1 text-sm">
                        <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                            </span>
                            {onlineCount} online
                        </span>
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        <span className="text-slate-500 dark:text-slate-400">{offlineCount} offline</span>
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        <span className="text-slate-500 dark:text-slate-400">{screens.length} total</span>
                    </div>
                </div>
                <Button
                    onClick={() => setIsCreateOpen(true)}
                    className="gap-1.5 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 border-0 shadow-md shadow-blue-500/20 text-white"
                >
                    <Plus className="h-4 w-4" /> New Screen
                </Button>
            </div>

            {/* Filter bar */}
            <div className="flex flex-col sm:flex-row gap-3 p-1">
                <div className="relative flex-1 sm:max-w-xs">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search screens..."
                        className="pl-9 bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 focus:ring-blue-500"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[150px] bg-white dark:bg-white/5 border-slate-200 dark:border-white/10">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="online">Online</SelectItem>
                        <SelectItem value="offline">Offline</SelectItem>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={locationFilter} onValueChange={setLocationFilter}>
                    <SelectTrigger className="w-full sm:w-[200px] bg-white dark:bg-white/5 border-slate-200 dark:border-white/10">
                        <SelectValue placeholder="Location" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Locations</SelectItem>
                        <SelectItem value="none">Unassigned Location</SelectItem>
                        {locations.map(loc => (
                            <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {isFetching ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
                            <Skeleton className="h-32 w-full rounded-md" />
                            <div className="space-y-2">
                                <Skeleton className="h-5 w-3/4" />
                                <Skeleton className="h-4 w-1/2" />
                            </div>
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ))}
                </div>
            ) : filteredScreens.length === 0 ? (
                <EmptyState
                    icon={MonitorPlay}
                    title={searchQuery || statusFilter !== 'all' || locationFilter !== 'all'
                        ? "No screens match your filters"
                        : "No screens yet"}
                    description={searchQuery || statusFilter !== 'all' || locationFilter !== 'all'
                        ? "Try adjusting your search or filter criteria to find what you're looking for."
                        : "Create your first digital signage endpoint to start broadcasting content to physical screens."}
                    action={(!searchQuery && statusFilter === 'all' && locationFilter === 'all') ? {
                        label: "+ Create Screen",
                        onClick: () => setIsCreateOpen(true)
                    } : undefined}
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {filteredScreens.map((screen) => {
                        const isOnline = screen.status === 'online'
                        const isOffline = screen.status === 'offline'

                        return (
                            <Card key={screen.id} className="group flex flex-col overflow-hidden border border-slate-200 dark:border-white/5 dark:bg-white/[0.02] shadow-sm hover:shadow-xl hover:shadow-blue-500/5 hover:border-blue-300 dark:hover:border-blue-500/30 transition-all duration-200">
                                {/* Status accent line */}
                                <div className={`h-1 w-full ${isOnline ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : isOffline ? 'bg-gradient-to-r from-red-500 to-rose-600' : 'bg-gradient-to-r from-amber-400 to-orange-500'}`} />

                                {/* Screen preview */}
                                <div className="relative bg-gradient-to-br from-slate-900 to-slate-950 aspect-video flex items-center justify-center overflow-hidden">
                                    <div className="absolute inset-0 opacity-5" style={{backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px'}} />

                                    {/* Status badge */}
                                    <div className="absolute top-2 left-2">
                                        {isOnline ? (
                                            <span className="flex items-center gap-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                Live
                                            </span>
                                        ) : isOffline ? (
                                            <span className="flex items-center gap-1 bg-red-500/20 border border-red-500/30 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                                                Offline
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                                                Idle
                                            </span>
                                        )}
                                    </div>

                                    {/* Action menu */}
                                    <div className="absolute top-2 right-2">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-7 w-7 p-0 bg-black/40 hover:bg-black/60 text-white/70 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                                                    <MoreVertical className="h-3.5 w-3.5" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-[160px]">
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/dashboard/screens/${screen.id}`} className="cursor-pointer">
                                                        <Edit className="mr-2 h-4 w-4" /> Edit
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => openDisplayApp(screen.display_key)} className="cursor-pointer">
                                                    <ExternalLink className="mr-2 h-4 w-4" /> Open Display
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem className="text-red-600 cursor-pointer" onClick={() => {
                                                    setScreenToDelete(screen)
                                                    setIsDeleteDialogOpen(true)
                                                }}>
                                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>

                                    {/* Centre content */}
                                    <div className="text-center px-4">
                                        <MonitorPlay className="h-6 w-6 mx-auto text-white/10 mb-1.5" />
                                        <p className="text-[11px] text-white/40 font-medium truncate max-w-[150px] mx-auto">
                                            {screen.current_state?.is_playing
                                                ? <span className="text-emerald-400">▶ {screen.current_state.project_name || screen.project?.name}</span>
                                                : (screen.project?.name || 'No project')}
                                        </p>
                                    </div>

                                    {/* Hover overlay */}
                                    <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>

                                {/* Card body */}
                                <CardContent className="p-4 flex-grow space-y-3">
                                    <div>
                                        <Link href={`/dashboard/screens/${screen.id}`}>
                                            <h3 className="font-semibold text-sm text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                {screen.name}
                                            </h3>
                                        </Link>
                                        <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500 dark:text-slate-400">
                                            <MapPin className="h-3 w-3 shrink-0" />
                                            <span className="truncate">{screen.location?.name || 'No location'}</span>
                                            {screen.orientation === 'portrait' && (
                                                <>
                                                    <span className="text-slate-300 dark:text-slate-700">·</span>
                                                    <Smartphone className="h-3 w-3 shrink-0" />
                                                    <span>Portrait</span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* URL row */}
                                    <div className="flex items-center gap-1.5 p-2 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-100 dark:border-white/5">
                                        <code className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate flex-1">
                                            /display/{screen.display_key.substring(0, 12)}...
                                        </code>
                                        <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0 text-slate-400 hover:text-slate-700" onClick={() => copyToClipboard(getDisplayUrl(screen.display_key))}>
                                            <Copy className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </CardContent>

                                <CardFooter className="px-4 py-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs text-slate-500">
                                    <div className="flex items-center gap-1.5">
                                        <Signal className={`h-3 w-3 ${isOnline ? 'text-emerald-500' : 'text-slate-400'}`} />
                                        {screen.last_heartbeat
                                            ? formatDistanceToNow(new Date(screen.last_heartbeat), { addSuffix: true })
                                            : 'Never connected'}
                                    </div>
                                    <Link
                                        href={`/dashboard/screens/${screen.id}`}
                                        className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-0.5"
                                    >
                                        Details <ChevronRight className="h-3 w-3" />
                                    </Link>
                                </CardFooter>
                            </Card>
                        )
                    })}
                </div>
            )}

            {/* Create Screen Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Add New Screen</DialogTitle>
                        <DialogDescription>
                            Configure a new physical endpoint for your digital signage network.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateScreen} className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="name">Screen Name *</Label>
                            <Input
                                id="name"
                                placeholder="e.g. Lobby Entrance Display"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="location">Location</Label>
                            <Select
                                value={formData.location_id}
                                onValueChange={v => setFormData({ ...formData, location_id: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select location" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Unassigned / No Location</SelectItem>
                                    {locations.map(loc => (
                                        <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="orientation">Orientation</Label>
                                <Select
                                    value={formData.orientation}
                                    onValueChange={v => setFormData({ ...formData, orientation: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Orientation" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="landscape">Landscape</SelectItem>
                                        <SelectItem value="portrait">Portrait</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="resolution">Resolution</Label>
                                <Select
                                    value={formData.resolution}
                                    onValueChange={v => setFormData({ ...formData, resolution: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Resolution" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1920x1080">1080p (FHD)</SelectItem>
                                        <SelectItem value="3840x2160">4K (UHD)</SelectItem>
                                        <SelectItem value="1080x1920">Portrait FHD</SelectItem>
                                        <SelectItem value="1280x720">720p (HD)</SelectItem>
                                        <SelectItem value="custom">Custom</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <DialogFooter className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-800">
                            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSaving || !formData.name}>
                                {isSaving ? "Creating..." : "Create Screen"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Success Setup Dialog */}
            <Dialog open={isSuccessOpen} onOpenChange={setIsSuccessOpen}>
                <DialogContent className="sm:max-w-[500px] text-center">
                    <DialogHeader>
                        <DialogTitle className="text-2xl text-center flex flex-col items-center gap-2 mb-2">
                            <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-2">
                                <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            Screen Created Successfully!
                        </DialogTitle>
                        <DialogDescription className="text-center text-base mt-2">
                            To connect your physical screen to this endpoint, open a web browser on the device and navigate to your unique, permanent display URL below.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="bg-slate-100 dark:bg-slate-900 rounded-lg p-6 my-6 border border-slate-200 dark:border-slate-800">
                        <code className="text-lg font-mono text-indigo-600 dark:text-indigo-400 break-all select-all block">
                            {createdScreenUrl}
                        </code>
                        <Button
                            className="w-full mt-6 flex items-center gap-2 h-12 text-md"
                            onClick={() => copyToClipboard(createdScreenUrl)}
                        >
                            <Copy className="h-5 w-5" /> Copy Permanent Link
                        </Button>
                    </div>

                    <DialogFooter className="sm:justify-center">
                        <Button variant="outline" onClick={() => setIsSuccessOpen(false)}>Done</Button>
                        <Button onClick={() => window.open(createdScreenUrl, '_blank')}>
                            Open in New Tab <ExternalLink className="ml-2 h-4 w-4" />
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Screen</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete <strong>{screenToDelete?.name}</strong>?
                            This action cannot be undone. Any active playback will instantly stop, and the display URL will permanently expire.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700">
                            Delete Screen
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
