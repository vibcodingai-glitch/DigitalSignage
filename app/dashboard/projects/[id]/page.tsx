"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/hooks/use-user"
import { useProjectDetails, useContentLibrary } from "@/hooks/use-dashboard"
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragOverlay,
    DragStartEvent
} from '@dnd-kit/core'
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    horizontalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import {
    Search, Plus, Play, Image as ImageIcon, Video, Music, Globe, BarChart2,
    Code, Trash2, ArrowLeft, GripVertical, Settings2, Calendar, MonitorPlay, Save, X, Layers, Signal
} from "lucide-react"
import { SchedulePanel } from "@/components/schedule-panel"
import LayoutSelector, { LayoutType } from '@/components/projects/LayoutSelector'
import { AssignToScreenDialog } from "@/components/AssignToScreenDialog"

// Types
type PlaylistItem = {
    id: string; // Internal id for DND, either the DB id or a temp string
    playlist_item_id?: string; // actual db id, if it exists
    content_item_id: string;
    order_index: number;
    duration_override: number;
    transition_type: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content_item: any;
    zone_index: number;
    valid_from?: string;
    valid_until?: string;
    day_part_start?: string;
    day_part_end?: string;
    show_qr_code?: boolean;
    qr_code_url?: string;
}

const ZONE_CONFIG: Record<string, { index: number, label: string }[]> = {
  fullscreen: [{ index: 0, label: 'Main Zone' }],
  split_horizontal: [
    { index: 0, label: 'Top Zone' },
    { index: 1, label: 'Bottom Zone' }
  ],
  split_vertical: [
    { index: 0, label: 'Left Zone' },
    { index: 1, label: 'Right Zone' }
  ],
  l_shape: [
    { index: 0, label: 'Main Zone' },
    { index: 1, label: 'Sidebar Top' },
    { index: 2, label: 'Sidebar Bottom' }
  ],
  grid_2x2: [
    { index: 0, label: 'Top Left' },
    { index: 1, label: 'Top Right' },
    { index: 2, label: 'Bottom Left' },
    { index: 3, label: 'Bottom Right' }
  ],
  main_ticker: [
    { index: 0, label: 'Main Content' },
    { index: 1, label: 'Ticker Bar' }
  ]
}

export default function ProjectEditorPage({ params }: { params: { id: string } }) {
    const { profile } = useUser()
    const supabase = createClient()
    const { toast } = useToast()

    const { data: detailData, isLoading, error: detailError, refresh: fetchData } = useProjectDetails(params.id)
    const { data: libraryData } = useContentLibrary()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [project, setProject] = useState<any>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [screen, setScreen] = useState<any>(null)

    // Playlist State
    const [playlist, setPlaylist] = useState<PlaylistItem[]>([])

    // Library State
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [libraryItems, setLibraryItems] = useState<any[]>([])
    const [librarySearch, setLibrarySearch] = useState("")

    // Project Settings State
    const [settings, setSettings] = useState({
        loop: true,
        transition_type: "fade",
        default_duration: 10
    })

    // Schedules State
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [schedules, setSchedules] = useState<any[]>([])

    const [isSaving, setIsSaving] = useState(false)
    const [unsavedChanges, setUnsavedChanges] = useState(false)
    const [activeId, setActiveId] = useState<string | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [pushingToScreen, setPushingToScreen] = useState(false)
    const [selectedPlaylistIndex, setSelectedPlaylistIndex] = useState<number | null>(null)
    const [activeZoneIndex, setActiveZoneIndex] = useState(0)
    const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)

    useEffect(() => {
        if (detailData) {
            setProject(detailData.project)
            setScreen(detailData.screen)
            setPlaylist(detailData.playlist)
            setSchedules(detailData.schedules)
            setSettings(detailData.project.settings || { loop: true, transition_type: "fade", default_duration: 10 })
        }
    }, [detailData])

    useEffect(() => {
        if (libraryData) {
            setLibraryItems(libraryData)
        }
    }, [libraryData])

    const currentLayoutType = project?.layout_type || 'fullscreen';
    const activeZones = ZONE_CONFIG[currentLayoutType] || ZONE_CONFIG.fullscreen;

    useEffect(() => {
        if (!activeZones.find(z => z.index === activeZoneIndex)) {
            setActiveZoneIndex(0)
        }
    }, [currentLayoutType, activeZones, activeZoneIndex])

    const activeZonePlaylist = useMemo(() => {
        return playlist
            .filter(item => item.zone_index === activeZoneIndex)
            .sort((a, b) => a.order_index - b.order_index)
    }, [playlist, activeZoneIndex])

    // ── Keyboard shortcuts ──────────────────────────────────────────
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement).tagName
            const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

            // Ctrl+S / Cmd+S — Save
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault()
                if (unsavedChanges && !isSaving) handleSaveChanges()
                return
            }

            // Arrow Up/Down — navigate playlist (only when not focused on input)
            if (!isInput && playlist.length > 0) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setSelectedPlaylistIndex(prev =>
                        prev === null ? 0 : Math.min(prev + 1, playlist.length - 1)
                    )
                    return
                }
                if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setSelectedPlaylistIndex(prev =>
                        prev === null ? 0 : Math.max(prev - 1, 0)
                    )
                    return
                }
                if (e.key === 'Delete' || e.key === 'Backspace') {
                    if (!isInput && selectedPlaylistIndex !== null) {
                        e.preventDefault()
                        const updated = playlist.filter((_, i) => i !== selectedPlaylistIndex)
                        setPlaylist(updated)
                        setUnsavedChanges(true)
                        setSelectedPlaylistIndex(prev =>
                            prev !== null && prev >= updated.length ? updated.length - 1 : prev
                        )
                    }
                }
            }
        }

        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unsavedChanges, isSaving, playlist, selectedPlaylistIndex])

    // --- DND Logic ---
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Require 8px drag before taking over, allows clicking buttons inside
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        // If dragging from library to timeline
        if (String(active.id).startsWith('library-')) {
            const contentItemId = String(active.id).replace('library-', '')
            const contentItem = libraryItems.find(i => i.id === contentItemId)

            if (!contentItem) return

            const newItem: PlaylistItem = {
                id: `temp-${Date.now()}`,
                content_item_id: contentItem.id,
                order_index: 0,
                duration_override: contentItem.duration_seconds || settings.default_duration,
                transition_type: settings.transition_type,
                content_item: contentItem,
                zone_index: activeZoneIndex
            }

            const zoneItems = playlist.filter(item => item.zone_index === activeZoneIndex);
            const otherItems = playlist.filter(item => item.zone_index !== activeZoneIndex);

            let newIndex = zoneItems.length;
            if (over.id !== 'playlist-zone' && !String(over.id).startsWith('library-')) {
                const overIndex = zoneItems.findIndex((item) => item.id === over.id);
                if (overIndex >= 0) {
                    newIndex = overIndex;
                }
            }

            const newZonePlaylist = [...zoneItems];
            newZonePlaylist.splice(newIndex, 0, newItem);

            const mappedZonePlaylist = newZonePlaylist.map((item, index) => ({
                ...item,
                order_index: index
            }))

            setPlaylist([...otherItems, ...mappedZonePlaylist]);
            setUnsavedChanges(true);
            return;
        }

        // Internal Sort
        if (active.id !== over.id) {
            setPlaylist((items) => {
                const zoneItems = items.filter(item => item.zone_index === activeZoneIndex);
                const otherItems = items.filter(item => item.zone_index !== activeZoneIndex);

                const oldIndex = zoneItems.findIndex((item) => item.id === active.id);
                const newIndex = zoneItems.findIndex((item) => item.id === over.id);

                if (oldIndex < 0 || newIndex < 0) return items;

                const relocated = arrayMove(zoneItems, oldIndex, newIndex);
                const mappedRelocated = relocated.map((item, i) => ({ ...item, order_index: i }));
                return [...otherItems, ...mappedRelocated];
            });
            setUnsavedChanges(true);
        }
    };

    // Form handlers
    const updatePlaylistItem = (id: string, updates: Partial<PlaylistItem>) => {
        setPlaylist(items => items.map(item => item.id === id ? { ...item, ...updates } : item));
        setUnsavedChanges(true);
    };

    const removePlaylistItem = (id: string) => {
        setPlaylist(items => {
            const itemToRemove = items.find(i => i.id === id);
            if (!itemToRemove) return items;
            const zoneIndex = itemToRemove.zone_index;
            const zoneItems = items.filter(i => i.zone_index === zoneIndex && i.id !== id);
            const otherItems = items.filter(i => i.zone_index !== zoneIndex);
            return [...otherItems, ...zoneItems.map((item, i) => ({ ...item, order_index: i }))];
        });
        setUnsavedChanges(true);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleLibraryAddClick = (contentItem: any) => {
        const zoneItems = playlist.filter(item => item.zone_index === activeZoneIndex);
        const otherItems = playlist.filter(item => item.zone_index !== activeZoneIndex);

        const newItem: PlaylistItem = {
            id: `temp-${Date.now()}`,
            content_item_id: contentItem.id,
            order_index: zoneItems.length,
            duration_override: contentItem.duration_seconds || settings.default_duration,
            transition_type: settings.transition_type,
            content_item: contentItem,
            zone_index: activeZoneIndex
        }
        setPlaylist([...otherItems, ...zoneItems, newItem]);
        setUnsavedChanges(true);
    };

    // SAVE LOGIC
    const handleSaveChanges = async () => {
        setIsSaving(true)
        try {
            // 1-2-3. Save via server API (settings + delete old + insert new)
            const saveRes = await fetch('/api/dashboard/mutate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'save-playlist',
                    project_id: project.id,
                    settings,
                    items: playlist.map(p => ({
                        content_item_id: p.content_item_id,
                        duration_override: p.duration_override,
                        transition_type: p.transition_type,
                        zone_index: p.zone_index || 0,
                        valid_from: p.valid_from || null,
                        valid_until: p.valid_until || null,
                        day_part_start: p.day_part_start || null,
                        day_part_end: p.day_part_end || null,
                        show_qr_code: p.show_qr_code || false,
                        qr_code_url: p.qr_code_url || null
                    }))
                })
            })
            if (!saveRes.ok) {
                const err = await saveRes.json()
                throw new Error(err.error || 'Failed to save')
            }

            setUnsavedChanges(false)
            toast({ title: "Sequence committed", description: `Successfully saved ${playlist.length} items to database.` })

            setPushingToScreen(true)
            const channel = supabase.channel(`screen-sync-${project.id}`)
            channel.subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    const { data: assignments } = await supabase
                        .from('screen_projects')
                        .select('screen_id')
                        .eq('project_id', project.id)
                        .eq('is_active', true)
                    
                    if (assignments && assignments.length > 0) {
                        for (const a of assignments) {
                            const screenChan = supabase.channel(`screen-${a.screen_id}`)
                            screenChan.subscribe(async (s) => {
                                if (s === 'SUBSCRIBED') {
                                    await screenChan.send({
                                        type: 'broadcast',
                                        event: 'command',
                                        payload: { command: 'FORCE_RELOAD' }
                                    })
                                    supabase.removeChannel(screenChan)
                                }
                            })
                        }
                    }
                    supabase.removeChannel(channel)
                }
            })

            setTimeout(() => {
                setPushingToScreen(false)
                toast({ title: "✓ Sync Complete", description: "Display hardware instructed to reload." })
            }, 1000)

            // CRITICAL: Refresh local data to ensure we have correct DB IDs
            fetchData() 

        } catch (error) {
            console.error('[Editor] Save error:', error)
            toast({ title: "Failed to save sequence", variant: "destructive", description: (error as Error).message })
        } finally {
            setIsSaving(false)
        }
    };

    const handleLayoutChange = async (newLayout: LayoutType) => {
        if (project.layout_type !== 'fullscreen' && newLayout === 'fullscreen') {
            const confirmed = window.confirm(
                'Switching to fullscreen will move all content to a single zone. Continue?'
            )
            if (!confirmed) return
        }

        const res = await fetch('/api/dashboard/mutate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update-layout', project_id: project.id, layout_type: newLayout })
        })

        if (!res.ok) {
            toast({ title: 'Failed to update layout', variant: 'destructive' })
            return
        }

        toast({ title: 'Layout updated' })
        fetchData()
    }

    const handleToggleActiveProject = async () => {
        if (!screen) return

        try {
            const isActive = project.is_active

            const res = await fetch('/api/dashboard/mutate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'toggle-project',
                    project_id: project.id,
                    is_active: !isActive,
                    screen_id: !isActive ? screen.id : null
                })
            })
            if (!res.ok) throw new Error('Failed to toggle')

            if (!isActive && screen) {
                setScreen({ ...screen, active_project_id: project.id })
            }

            setProject({ ...project, is_active: !isActive })

            if (!isActive) {
                toast({ title: "Sequence is now LIVE on endpoint." })
            } else {
                toast({ title: "Sequence suspended." })
            }

        } catch (err) {
            toast({ title: "System fault tying sequence", variant: "destructive", description: (err as Error).message })
        }
    }

    // Rendering Helpers
    const typeIcons = {
        image: <ImageIcon className="h-4 w-4" />,
        video: <Video className="h-4 w-4" />,
        audio: <Music className="h-4 w-4" />,
        url: <Globe className="h-4 w-4" />,
        webpage: <Globe className="h-4 w-4" />,
        powerbi: <BarChart2 className="h-4 w-4" />,
        dashboard: <BarChart2 className="h-4 w-4" />,
        html_snippet: <Code className="h-4 w-4" />,
        weather: <Globe className="h-4 w-4" />,
        rss: <Globe className="h-4 w-4" />,
        qr: <Globe className="h-4 w-4" />
    }

    const typeColors = {
        image: "text-blue-500 bg-blue-50 dark:bg-blue-900/20",
        video: "text-purple-500 bg-purple-50 dark:bg-purple-900/20",
        audio: "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20",
        url: "text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20",
        webpage: "text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20",
        powerbi: "text-amber-500 bg-amber-50 dark:bg-amber-900/20",
        dashboard: "text-amber-500 bg-amber-50 dark:bg-amber-900/20",
        html_snippet: "text-slate-500 bg-slate-100 dark:bg-slate-800",
        weather: "text-sky-500 bg-sky-50 dark:bg-sky-900/20",
        rss: "text-orange-500 bg-orange-50 dark:bg-orange-900/20",
        qr: "text-slate-500 bg-slate-100 dark:bg-slate-800"
    }

    const filteredLibrary = useMemo(() => {
        return libraryItems.filter(item => (item.name || '').toLowerCase().includes((librarySearch || '').toLowerCase()))
    }, [libraryItems, librarySearch])

    const totalDuration = useMemo(() => {
        return activeZonePlaylist.reduce((acc, curr) => acc + (curr.duration_override || 0), 0)
    }, [activeZonePlaylist])

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60)
        const s = seconds % 60
        return m > 0 ? `${m}m ${s}s` : `${s}s`
    }

    if (detailError) {
        return (
            <div className="p-8 flex flex-col items-center justify-center h-[50vh] gap-4">
                <div className="text-red-500 font-bold text-lg">Error loading project</div>
                <div className="text-slate-500 font-mono text-sm max-w-lg text-left bg-slate-100 dark:bg-slate-900 p-4 rounded-lg overflow-auto w-full">
                    <pre>{JSON.stringify(detailError, null, 2)}</pre>
                </div>
                <Button onClick={() => fetchData()}>Retry</Button>
            </div>
        )
    }

    if (isLoading || !project) {
        return <div className="p-8 flex items-center justify-center h-[50vh]"><Skeleton className="h-10 w-10 rounded-full animate-spin" /></div>
    }

    const isScreenBound = !!screen

    return (
        <div className="flex flex-col h-[calc(100vh-65px)] -m-6 animate-in fade-in duration-500 overflow-hidden bg-slate-50 dark:bg-slate-950">
            {/* Header / Subnav */}
            <div className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 shrink-0 z-10 shadow-sm">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2" asChild>
                        <Link href="/dashboard/projects"><ArrowLeft className="h-4 w-4" /></Link>
                    </Button>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <h2 className="font-bold text-base leading-none tracking-tight">{project.name}</h2>
                            {unsavedChanges && <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none px-1.5 py-0 h-4 text-[10px]">Unsaved</Badge>}
                        </div>
                        {isScreenBound ? (
                            <Link href={`/dashboard/screens/${screen.id}`} className="text-xs text-indigo-500 hover:underline flex items-center mt-0.5">
                                <MonitorPlay className="h-3 w-3 mr-1" /> Bound: {screen.name}
                            </Link>
                        ) : (
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-slate-500">Float Project (No bound Screen)</span>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-5 px-1.5 text-[10px] text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border border-indigo-100"
                                    onClick={() => setIsAssignDialogOpen(true)}
                                >
                                    Assign to Screen
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={() => setPreviewUrl(screen?.display_key ? `/display/${screen.display_key}` : null)}>
                        <Play className="h-4 w-4 mr-2" /> Pre-flight
                    </Button>
                    {unsavedChanges && (
                        <Button variant="ghost" size="sm" onClick={() => fetchData()} className="text-slate-500">
                            Revert
                        </Button>
                    )}
                    <Button size="sm" onClick={handleSaveChanges} disabled={isSaving || !unsavedChanges} className="shadow-md">
                        <Save className="h-4 w-4 mr-2" />
                        {isSaving ? 'Syncing...' : pushingToScreen ? 'Pushing to screen...' : 'Commit Sequence'}
                    </Button>
                </div>
            </div>

            {/* DND Context wrapping columns */}
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className="flex-1 flex overflow-hidden">

                    {/* LEFT: Library Panel */}
                    <div className="w-80 min-w-[320px] bg-slate-100/50 dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-800 flex flex-col items-stretch shrink-0 shadow-inner z-[5]">
                        <div className="p-4 shrink-0 border-b border-slate-200 dark:border-slate-800">
                            <div className="flex items-center justify-between mb-3">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Media Library</Label>
                                <Badge variant="secondary" className="text-xs">{filteredLibrary.length}</Badge>
                            </div>
                            <div className="flex gap-2 mb-3">
                                <Button size="sm" variant="default" className="flex-1 h-8 text-xs" onClick={() => window.open('/dashboard/content', '_blank')}>
                                    <ArrowLeft className="h-3 w-3 mr-1 rotate-180" /> Upload
                                </Button>
                                <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => window.open('/dashboard/content', '_blank')}>
                                    <Globe className="h-3 w-3 mr-1" /> Add URL
                                </Button>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Search library..."
                                    className="pl-9 h-9 bg-white dark:bg-slate-950 border-slate-200 shadow-sm text-sm"
                                    value={librarySearch}
                                    onChange={e => setLibrarySearch(e.target.value)}
                                />
                            </div>
                        </div>

                        <ScrollArea className="flex-1 px-4 pb-4">
                            <div className="space-y-2">
                                {filteredLibrary.length === 0 ? (
                                    <div className="text-center py-6 text-sm text-slate-500">No assets found. Upload in Content Library.</div>
                                ) : (
                                    filteredLibrary.map(item => (
                                        <DraggableLibraryItem
                                            key={item.id}
                                            item={item}
                                            onAdd={() => handleLibraryAddClick(item)}
                                            icon={typeIcons[item.type as keyof typeof typeIcons]}
                                            colorClass={typeColors[item.type as keyof typeof typeColors]}
                                        />
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* MIDDLE: Timeline Builder */}
                    <div className="flex-1 bg-white dark:bg-slate-950 flex flex-col relative overflow-hidden z-[4]">
                        <div className="absolute inset-0 pattern-grid-lg text-slate-100 dark:text-slate-900/50 z-0 pointer-events-none" />

                        <ScrollArea className="flex-1 px-8 py-8 z-10">
                            <div className="max-w-4xl mx-auto space-y-8">
                                {/* LAYOUT SECTION - collapsed into header dropdown, not full page section */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                                            <Layers className="h-4 w-4" /> Screen Layout
                                        </h3>
                                        <span className="text-xs text-slate-400">{activeZones.length} Zone{activeZones.length !== 1 && 's'}</span>
                                    </div>
                                    <LayoutSelector 
                                        currentLayout={project?.layout_type || 'fullscreen'}
                                        onSelect={handleLayoutChange}
                                    />
                                </div>

                                {/* TIMELINE BUILDER */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                            <Play className="h-4 w-4 text-indigo-500" /> Active Playlist Stream
                                        </h3>
                                        <span className="text-xs text-slate-400">{activeZonePlaylist.length} items · {formatTime(totalDuration)}</span>
                                    </div>
                                    {currentLayoutType !== 'fullscreen' && (
                                        <Tabs value={activeZoneIndex.toString()} onValueChange={(v) => {
                                            setActiveZoneIndex(parseInt(v));
                                            setSelectedPlaylistIndex(null);
                                        }}>
                                            <TabsList className="mb-4">
                                                {activeZones.map(zone => (
                                                    <TabsTrigger key={zone.index} value={zone.index.toString()}>{zone.label}</TabsTrigger>
                                                ))}
                                            </TabsList>
                                        </Tabs>
                                    )}
                                    <SortableContext items={activeZonePlaylist.map(i => i.id)} strategy={horizontalListSortingStrategy}>
                                    {activeZonePlaylist.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/20">
                                            <div className="bg-white dark:bg-slate-900 p-4 rounded-full shadow-sm mb-4">
                                                <Layers className="h-8 w-8 text-indigo-300 dark:text-indigo-700" />
                                            </div>
                                            <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">Chronological Array is Empty</h3>
                                            <p className="text-sm text-slate-500 max-w-sm mt-1">Drag assets from the left library panel into this zone to architect your playback timeline.</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-row flex-wrap gap-4 pb-8 pt-4 px-2 items-start min-h-[250px]">

                                            {activeZonePlaylist.map((playItem, index) => (
                                                <SortablePlaylistItem
                                                    key={playItem.id}
                                                    item={playItem}
                                                    index={index}
                                                    onUpdate={(updates) => updatePlaylistItem(playItem.id, updates)}
                                                    onRemove={() => removePlaylistItem(playItem.id)}
                                                    icon={typeIcons[playItem.content_item.type as keyof typeof typeIcons]}
                                                    colorClass={typeColors[playItem.content_item.type as keyof typeof typeColors]}
                                                    isSelected={selectedPlaylistIndex === index}
                                                    onSelect={() => setSelectedPlaylistIndex(index)}
                                                />
                                            ))}
                                        </div>
                                    )}
                                    </SortableContext>
                                </div>
                            </div>
                        </ScrollArea>

                        {/* Middle Bottom Analytics Bar */}
                        <div className="h-12 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center justify-between px-6 z-10 shrink-0">
                            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                {activeZonePlaylist.length} Node{activeZonePlaylist.length !== 1 && 's'} in Zone
                            </div>
                            <div className="flex items-center text-sm font-mono gap-4">
                                <span className="text-slate-500">Zone Cycle Time:</span>
                                <span className="font-bold text-indigo-600 dark:text-indigo-400">{formatTime(totalDuration)}</span>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: Rules Engine & Params */}
                    <div className="w-80 min-w-[320px] bg-slate-50 dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shrink-0 z-[5]">
                        <Tabs defaultValue="settings" className="w-full flex flex-col flex-1 h-full">
                            <TabsList className="w-full justify-start rounded-none border-b border-slate-200 dark:border-slate-800 h-12 bg-white dark:bg-slate-950 shrink-0">
                                <TabsTrigger value="settings" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none h-12 flex-1">
                                    <Settings2 className="h-4 w-4 mr-2" /> Deployment Config
                                </TabsTrigger>
                                <TabsTrigger value="schedule" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none h-12 flex-1">
                                    <Calendar className="h-4 w-4 mr-2" /> Overrides
                                </TabsTrigger>
                            </TabsList>

                            <ScrollArea className="flex-1">
                                <TabsContent value="settings" className="p-4 m-0 space-y-6">

                                    {/* Activate Zone */}
                                    <Card className={`border shadow-sm overflow-hidden transition-all ${project.is_active ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10' : 'border-slate-200 dark:border-slate-800'}`}>
                                        <CardContent className="p-4 flex flex-col items-center text-center">
                                            <div className="mb-4">
                                                {project.is_active ? (
                                                    <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
                                                        <Signal className="h-6 w-6" />
                                                    </div>
                                                ) : (
                                                    <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400 dark:bg-slate-800">
                                                        <MonitorPlay className="h-6 w-6" />
                                                    </div>
                                                )}
                                            </div>
                                            <h4 className="font-bold mb-1">{project.is_active ? 'Priority Feed Active' : 'Sequence Dormant'}</h4>
                                            <p className="text-xs text-slate-500 mb-4 px-2">
                                                {project.is_active
                                                    ? 'This timeline is actively being transmitted to the hardware display layer.'
                                                    : 'Hardware will ignore this timeline until explicitly flagged as the active feed.'}
                                            </p>

                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    id="active-toggle"
                                                    checked={project.is_active}
                                                    onCheckedChange={handleToggleActiveProject}
                                                    disabled={!isScreenBound}
                                                />
                                                <Label htmlFor="active-toggle" className={`font-semibold cursor-pointer ${!isScreenBound ? 'opacity-50' : ''}`}>Execute Feed</Label>
                                            </div>
                                            {!isScreenBound && (
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="w-full mt-4 border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 flex items-center gap-2"
                                                    onClick={() => setIsAssignDialogOpen(true)}
                                                >
                                                    <MonitorPlay className="h-4 w-4" /> Bind to a Screen
                                                </Button>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* Default Variables */}
                                    <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                                        <Label className="text-sm font-bold block mb-1">Timeline Global Mutators</Label>

                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="loop" className="text-sm text-slate-600 flex flex-col gap-1">
                                                <span>Infinity Loop</span>
                                                <span className="text-[10px] text-slate-400 font-normal">Restart timeline autonomously</span>
                                            </Label>
                                            <Switch
                                                id="loop"
                                                checked={settings.loop}
                                                onCheckedChange={v => { setSettings({ ...settings, loop: v }); setUnsavedChanges(true) }}
                                            />
                                        </div>

                                        <div className="space-y-2 pt-2">
                                            <Label className="text-sm text-slate-600">Default Node Transition (CSS)</Label>
                                            <Select value={settings.transition_type} onValueChange={v => { setSettings({ ...settings, transition_type: v }); setUnsavedChanges(true) }}>
                                                <SelectTrigger className="w-full">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">Hard Cut (0ms)</SelectItem>
                                                    <SelectItem value="fade">Alpha Fade (Opacity)</SelectItem>
                                                    <SelectItem value="slide-left">TranslateX Slide Left (-100%)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2 pt-2">
                                            <Label className="text-sm text-slate-600">Fallback Dwell Duration (s)</Label>
                                            <Input
                                                type="number"
                                                min={1}
                                                value={settings.default_duration}
                                                onChange={e => {
                                                    const val = parseInt(e.target.value) || 10;
                                                    setSettings({ ...settings, default_duration: val });
                                                    setUnsavedChanges(true);
                                                }}
                                            />
                                            <p className="text-[10px] text-slate-500 leading-tight">Applied automatically if dynamic duration logic fails to compute boundaries.</p>
                                        </div>
                                    </div>

                                </TabsContent>

                                <TabsContent value="schedule" className="p-4 m-0">
                                    <SchedulePanel
                                        schedules={schedules}
                                        projectId={params.id}
                                        onRefresh={fetchData}
                                    />
                                </TabsContent>
                            </ScrollArea>
                        </Tabs>
                    </div>
                </div>

                {/* Drag Overlay for smooth ghosting */}
                <DragOverlay>
                    {activeId ? (
                        activeId.startsWith('library-') ? (
                            <div className="opacity-90 scale-105 pointer-events-none rounded-md overflow-hidden ring-2 ring-indigo-500 shadow-xl bg-white dark:bg-slate-900 flex items-center p-3 gap-3">
                                {typeIcons[libraryItems.find(i => i.id === activeId.replace('library-', ''))?.type as keyof typeof typeIcons]}
                                <span className="font-semibold text-sm truncate max-w-[150px]">
                                    {libraryItems.find(i => i.id === activeId.replace('library-', ''))?.name}
                                </span>
                            </div>
                        ) : (
                            <div className="opacity-90 scale-[1.02] pointer-events-none ring-2 ring-indigo-500 shadow-xl rounded-xl bg-white dark:bg-slate-900 h-[220px] flex flex-col w-[200px] border border-slate-200">
                                <div className="h-10 bg-slate-50 dark:bg-slate-900 flex items-center justify-center border-b border-slate-200 dark:border-slate-800">
                                    <GripVertical className="h-4 w-4 text-slate-400 rotate-90" />
                                </div>
                                <div className="flex-1 flex flex-col items-center justify-center px-4 gap-4">
                                    <Badge className="bg-slate-100 text-slate-800 border-none shadow-none" variant="outline">Moving Node</Badge>
                                </div>
                            </div>
                        )
                    ) : null}
                </DragOverlay>

                <AssignToScreenDialog
                    open={isAssignDialogOpen}
                    onOpenChange={setIsAssignDialogOpen}
                    projectId={params.id}
                    organizationId={profile?.organization_id || ""}
                    onSuccess={() => fetchData()}
                />
            </DndContext>

            {/* Preview Modal Simulation */}
            {previewUrl && (
                <Dialog open={!!previewUrl} onOpenChange={(v) => !v && setPreviewUrl(null)}>
                    <DialogContent className="max-w-7xl w-[90vw] h-[90vh] p-0 overflow-hidden bg-black border-slate-800 flex flex-col">
                        <div className="h-10 bg-slate-900 border-b border-slate-800 flex justify-between items-center px-4 shrink-0 text-slate-300 text-xs font-mono">
                            <span className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Pre-flight Execution Sandbox</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-white" onClick={() => setPreviewUrl(null)}><X className="h-4 w-4" /></Button>
                        </div>
                        <iframe src={previewUrl} className="flex-1 w-full bg-black border-0" />
                    </DialogContent>
                </Dialog>
            )}
        </div>
    )
}


// --- Sub Components ---

// Draggable from Left Bar
import { useDraggable } from '@dnd-kit/core';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DraggableLibraryItem({ item, onAdd, icon, colorClass }: { item: any, onAdd: () => void, icon: React.ReactNode, colorClass: string }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `library-${item.id}`,
        data: item,
    });

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            className={`flex items-center p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm hover:border-indigo-300 dark:hover:border-indigo-700 transition-all cursor-grab active:cursor-grabbing group ${isDragging ? 'opacity-30' : ''}`}
        >
            <div className={`p-1.5 rounded-md text-xs font-medium mr-3 shrink-0 uppercase w-10 h-10 flex items-center justify-center ${colorClass}`}>
                {icon}
            </div>

            <div className="flex-1 min-w-0 pr-2">
                <h4 className="font-semibold text-sm truncate text-slate-900 dark:text-slate-100">{item.name}</h4>
                <div className="text-[10px] text-slate-500 flex gap-2">
                    <span>{item.type}</span>
                    <span className="text-slate-300">•</span>
                    <span>{item.duration_seconds}s</span>
                </div>
            </div>

            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 hover:bg-indigo-50 transition-all z-10 shrink-0" onPointerDown={e => { e.stopPropagation(); onAdd() }}>
                <Plus className="h-4 w-4" />
            </Button>
        </div>
    )
}


// Sortable Middle Timeline Item
function SortablePlaylistItem({ item, index, onUpdate, onRemove, icon, colorClass, isSelected, onSelect }: { item: PlaylistItem, index: number, onUpdate: (updates: Partial<PlaylistItem>) => void, onRemove: () => void, icon: React.ReactNode, colorClass: string, isSelected?: boolean, onSelect?: () => void }) {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: item.id });

    const computedWidth = Math.max(180, Math.min(600, item.duration_override * 12)); // 12px per second, min 180px, max 600px

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 2 : 1,
        width: '240px',
        flexShrink: 0
    };

    return (
        <Card
            ref={setNodeRef}
            style={style}
            onClick={onSelect}
            className={`group shadow-sm border overflow-hidden flex flex-col transition-all cursor-pointer h-[240px] ${isDragging
                ? 'border-indigo-500 shadow-md ring-1 ring-indigo-500/50 opacity-80'
                : isSelected
                    ? 'border-indigo-400 dark:border-indigo-500 ring-2 ring-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-900/10'
                    : 'border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700'
                }`}
        >
            <div
                {...attributes}
                {...listeners}
                className="h-8 bg-slate-50/50 dark:bg-slate-900 w-full flex items-center justify-center border-b border-slate-200 dark:border-slate-800 cursor-grab active:cursor-grabbing text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-colors shrink-0"
            >
                <div className="text-[10px] font-mono font-bold text-slate-300 mr-2">{index + 1}</div>
                <GripVertical className="h-4 w-4 rotate-90" />
            </div>

            <CardContent className="p-3 flex-1 flex flex-col items-start gap-2 min-w-0">
                <div className="flex flex-col items-center w-full gap-2 min-w-0 flex-1">
                    <div className="h-20 w-full rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                        {item.content_item.type === 'image' && item.content_item.source_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.content_item.source_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <div className={colorClass}>{icon}</div>
                        )}
                    </div>

                    <div className="flex flex-col w-full text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                            <Badge variant="outline" className={`text-[9px] h-4 py-0 px-1 uppercase leading-none border-none ${colorClass}`}>{item.content_item.type}</Badge>
                        </div>
                        <h4 className="font-semibold text-xs truncate text-slate-900 dark:text-slate-100 w-full">{item.content_item.name}</h4>
                    </div>
                </div>

                <div className="flex flex-row items-center justify-between w-full mt-auto pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center space-x-1" onClick={e => e.stopPropagation()}>
                        <Input
                            type="number"
                            min={1}
                            value={item.duration_override}
                            onChange={(e) => onUpdate({ duration_override: parseInt(e.target.value) || 0 })}
                            className="h-7 w-12 px-1 text-center font-mono text-xs bg-white dark:bg-slate-950 border-slate-200"
                        />
                        <span className="text-[10px] text-slate-500 font-mono">s</span>
                    </div>

                    <div className="flex items-center gap-1">
                        <Select value={item.transition_type} onValueChange={(v) => onUpdate({ transition_type: v })}>
                            <SelectTrigger className="w-[72px] h-7 text-xs px-2" onClick={e => e.stopPropagation()}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="fade" className="text-xs">Fade</SelectItem>
                                <SelectItem value="slide-left" className="text-xs">Slide L</SelectItem>
                                <SelectItem value="none" className="text-xs">Cut</SelectItem>
                            </SelectContent>
                        </Select>

                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 shrink-0" onClick={(e) => { e.stopPropagation(); setIsSettingsOpen(true); }}>
                            <Settings2 className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
                            <Trash2 className="h-3 w-3" />
                        </Button>
                    </div>
                </div>
            </CardContent>

            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DialogContent className="sm:max-w-md" onClick={e => e.stopPropagation()}>
                    <DialogHeader>
                        <DialogTitle>Node Settings & Rules</DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-bold">Validity Dates</Label>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <Label className="text-xs text-slate-500 mb-1 block">Start Date</Label>
                                    <Input type="date" value={item.valid_from || ""} onChange={e => onUpdate({ valid_from: e.target.value })} />
                                </div>
                                <div className="flex-1">
                                    <Label className="text-xs text-slate-500 mb-1 block">End Date</Label>
                                    <Input type="date" value={item.valid_until || ""} onChange={e => onUpdate({ valid_until: e.target.value })} />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm font-bold">Day-Parting</Label>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <Label className="text-xs text-slate-500 mb-1 block">Time Start</Label>
                                    <Input type="time" value={item.day_part_start || ""} onChange={e => onUpdate({ day_part_start: e.target.value })} />
                                </div>
                                <div className="flex-1">
                                    <Label className="text-xs text-slate-500 mb-1 block">Time End</Label>
                                    <Input type="time" value={item.day_part_end || ""} onChange={e => onUpdate({ day_part_end: e.target.value })} />
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-500">If set, the item will be skipped outside these hours.</p>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-bold">QR Code Handoff</Label>
                                <Switch checked={item.show_qr_code || false} onCheckedChange={v => onUpdate({ show_qr_code: v })} />
                            </div>
                            {item.show_qr_code && (
                                <div>
                                    <Label className="text-xs text-slate-500 mb-1 block">Destination URL</Label>
                                    <Input placeholder="https://..." value={item.qr_code_url || ""} onChange={e => onUpdate({ qr_code_url: e.target.value })} />
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" className="w-full">Done</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    )
}
