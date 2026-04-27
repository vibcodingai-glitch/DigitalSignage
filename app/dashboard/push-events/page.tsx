"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/hooks/use-user"
import { formatDistanceToNow, format } from "date-fns"
import { broadcastPushEvent } from "@/lib/actions/push-events"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import {
    Zap, Plus, MonitorPlay, RefreshCw, Volume2, AlertTriangle, Play, Loader2,
    Clock, Trash2, ChevronRight, Radio, Send, Upload
} from "lucide-react"
import { EmptyState } from "@/components/empty-state"

interface Screen {
    id: string
    name: string
    status: string
}

interface PushEvent {
    id: string
    screen_id: string
    event_type: string
    payload: Record<string, unknown>
    expires_at: string | null
    created_at: string
    screen?: { name: string }
    created_by_profile?: { full_name: string | null; email: string | null }
}

interface ContentItem {
    id: string
    name: string
    type: string
}

const EVENT_TYPE_META: Record<string, { label: string; icon: React.ReactNode; color: string; description: string }> = {
    play_sound: {
        label: "Play Sound",
        icon: <Volume2 className="h-4 w-4" />,
        color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800",
        description: "Play an audio alert or notification on the screen"
    },
    show_alert: {
        label: "Show Alert",
        icon: <AlertTriangle className="h-4 w-4" />,
        color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
        description: "Display a full-screen alert message or overlay"
    },
    override_content: {
        label: "Override Content",
        icon: <Play className="h-4 w-4" />,
        color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
        description: "Immediately push a specific content item to the display"
    },
    reload: {
        label: "Reload",
        icon: <RefreshCw className="h-4 w-4" />,
        color: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 border-sky-200 dark:border-sky-800",
        description: "Force the display client to reload the page"
    },
    custom: {
        label: "Custom",
        icon: <Zap className="h-4 w-4" />,
        color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
        description: "Send a custom JSON payload to the display client"
    }
}

const EXPIRY_OPTIONS = [
    { label: "1 minute", value: "1" },
    { label: "5 minutes", value: "5" },
    { label: "15 minutes", value: "15" },
    { label: "1 hour", value: "60" },
    { label: "Never", value: "0" },
]

export default function PushEventsPage() {
    const { profile } = useUser()
    const supabase = createClient()
    const { toast } = useToast()

    const [screens, setScreens] = useState<Screen[]>([])
    const [events, setEvents] = useState<PushEvent[]>([])
    const [contentItems, setContentItems] = useState<ContentItem[]>([])
    const [isFetching, setIsFetching] = useState(true)
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [isSending, setIsSending] = useState(false)
    const [isUploading, setIsUploading] = useState(false)

    // Form state
    const [targetType, setTargetType] = useState<"single" | "all">("single")
    const [screenId, setScreenId] = useState<string>("")
    const [eventType, setEventType] = useState<string>("play_sound")
    const [expiryMinutes, setExpiryMinutes] = useState("5")
    const [payload, setPayload] = useState<Record<string, any>>({})
    const [jsonPayloadStr, setJsonPayloadStr] = useState("{}")

    // Confirmation dialog
    const [isConfirmOpen, setIsConfirmOpen] = useState(false)

    const fetchData = useCallback(async () => {
        setIsFetching(true)
        try {
            const { data: screensData } = await supabase
                .from("screens")
                .select("id, name, status")
                .order("name")

            if (screensData) {
                setScreens(screensData)
                if (screensData.length > 0 && !screenId) {
                    setScreenId(screensData[0].id)
                }
            }

            const [{ data: contentData }, { data: eventsData }] = await Promise.all([
                supabase
                    .from("content_items")
                    .select("id, name, type")
                    .order("name"),
                supabase
                    .from("push_events")
                    .select(`*, screen:screens(name)`)
                    .in("screen_id", screensData?.map(s => s.id) ?? [])
                    .order("created_at", { ascending: false })
                    .limit(100)
            ])

            if (contentData) setContentItems(contentData)
            if (eventsData) setEvents(eventsData as PushEvent[])
        } catch (err) {
            toast({ title: "Failed to load push events", description: (err as Error).message, variant: "destructive" })
        } finally {
            setIsFetching(false)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    // Reset payload when event type changes
    useEffect(() => {
        if (eventType === 'show_alert') {
            setPayload({ message: '', duration: 8, position: 'top', style: 'info' })
        } else if (eventType === 'play_sound') {
            setPayload({ url: '' })
        } else if (eventType === 'override_content') {
            setPayload({ content_item_id: contentItems[0]?.id || '', duration: 30 })
        } else if (eventType === 'reload') {
            setPayload({})
        } else if (eventType === 'custom') {
            setJsonPayloadStr("{}")
        }
    }, [eventType, contentItems])

    // Realtime subscription for new events
    useEffect(() => {
        if (!screens.length) return
        const channel = supabase
            .channel("push-events-feed")
            .on("postgres_changes", {
                event: "INSERT",
                schema: "public",
                table: "push_events"
            }, (payload) => {
                fetchData() // Refresh cleanly to get relations
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [screens, supabase])

    const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setIsUploading(true)
        const fileExt = file.name.split('.').pop()
        const filePath = `audio/${crypto.randomUUID()}.${fileExt}`
        const { error: uploadError } = await supabase.storage.from('content').upload(filePath, file)
        if (!uploadError) {
            const { data } = supabase.storage.from('content').getPublicUrl(filePath)
            setPayload({ ...payload, url: data.publicUrl })
            toast({ title: "Audio uploaded successfully" })
        } else {
            toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" })
        }
        setIsUploading(false)
    }

    const prepareSend = (e: React.FormEvent) => {
        e.preventDefault()
        
        if (targetType === "single" && !screenId) {
            toast({ title: "Please select a screen", variant: "destructive" })
            return
        }

        if (targetType === "all") {
            setIsConfirmOpen(true)
        } else {
            executeSend()
        }
    }

    const executeSend = async () => {
        let orgId = profile?.organization_id
        if (!orgId) {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
                if (data?.organization_id) orgId = data.organization_id
            }
        }
        if (!orgId) {
            toast({ title: "Session not ready", description: "Please try again.", variant: "destructive" })
            return
        }

        let finalPayload = { ...payload }
        if (eventType === "custom") {
            try {
                finalPayload = JSON.parse(jsonPayloadStr)
            } catch {
                toast({ title: "Invalid JSON payload", description: "Please fix the JSON syntax", variant: "destructive" })
                setIsConfirmOpen(false)
                return
            }
        }

        const expiresAt = expiryMinutes !== "0"
            ? new Date(Date.now() + parseInt(expiryMinutes) * 60 * 1000).toISOString()
            : undefined

        setIsSending(true)
        try {
            if (targetType === "all") {
                const res = await broadcastPushEvent({
                    eventType,
                    payload: finalPayload,
                    expiresAt
                })
                if (!res.success) throw new Error(res.error)
                toast({ title: `✓ Broadcast sent to ${res.count} screens` })
            } else {
                const { error } = await supabase.from("push_events").insert({
                    screen_id: screenId,
                    event_type: eventType,
                    payload: finalPayload,
                    created_by: profile.id,
                    expires_at: expiresAt || null
                })
                if (error) throw error
                toast({ title: `✓ Push event sent successfully` })
            }

            setIsCreateOpen(false)
            setIsConfirmOpen(false)
            fetchData()
        } catch (err) {
            toast({ title: "Failed to send push event", description: (err as Error).message, variant: "destructive" })
        } finally {
            setIsSending(false)
        }
    }

    const handleDelete = async (ids: string[]) => {
        try {
            const { error } = await supabase.from("push_events").delete().in("id", ids)
            if (error) throw error
            setEvents(prev => prev.filter(e => !ids.includes(e.id)))
            toast({ title: "Event(s) deleted" })
        } catch (err) {
            toast({ title: "Failed to delete event", description: (err as Error).message, variant: "destructive" })
        }
    }

    const isExpired = (event: PushEvent) =>
        event.expires_at && new Date(event.expires_at) < new Date()

    const selectedMeta = EVENT_TYPE_META[eventType]

    // Group events for display
    const groupedEvents = useMemo(() => {
        const groups: any[] = []
        let currentGroup: any = null

        events.forEach(event => {
            if (
                currentGroup && 
                currentGroup.event_type === event.event_type && 
                Math.abs(new Date(currentGroup.created_at).getTime() - new Date(event.created_at).getTime()) < 1000
            ) {
                currentGroup.screens.push(event.screen)
                currentGroup.count += 1
                currentGroup.ids.push(event.id)
            } else {
                if (currentGroup) groups.push(currentGroup)
                currentGroup = { 
                    ...event, 
                    screens: [event.screen], 
                    count: 1, 
                    ids: [event.id] 
                }
            }
        })
        if (currentGroup) groups.push(currentGroup)
        return groups
    }, [events])

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-lg">
                        <Zap className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Push Events</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Send real-time commands to your screens
                        </p>
                    </div>
                </div>
                <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
                    <Send className="h-4 w-4" /> Send Push Event
                </Button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    {
                        label: "Online Screens",
                        value: screens.filter(s => s.status === "online").length,
                        icon: <Radio className="h-4 w-4 text-emerald-500" />,
                        sub: "ready to receive"
                    },
                    {
                        label: "Total Screens",
                        value: screens.length,
                        icon: <MonitorPlay className="h-4 w-4 text-slate-400" />,
                        sub: "in this workspace"
                    },
                    {
                        label: "Events Today",
                        value: events.filter(e => new Date(e.created_at) > new Date(Date.now() - 86400000)).length,
                        icon: <Zap className="h-4 w-4 text-amber-500" />,
                        sub: "last 24 hours"
                    },
                    {
                        label: "Active Events",
                        value: events.filter(e => !isExpired(e)).length,
                        icon: <Clock className="h-4 w-4 text-indigo-500" />,
                        sub: "not yet expired"
                    }
                ].map(stat => (
                    <Card key={stat.label} className="border-slate-200 dark:border-slate-800 shadow-sm">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{stat.label}</span>
                                {stat.icon}
                            </div>
                            <div className="text-2xl font-bold">{isFetching ? <Skeleton className="h-7 w-10" /> : stat.value}</div>
                            <div className="text-xs text-slate-400 mt-0.5">{stat.sub}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Event log */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <CardHeader className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-base">Event Log</CardTitle>
                        <CardDescription>All push events sent to your screens</CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" onClick={fetchData} className="gap-1.5 text-slate-500">
                        <RefreshCw className="h-3.5 w-3.5" /> Refresh
                    </Button>
                </CardHeader>
                <CardContent className="p-0">
                    {isFetching ? (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {Array(5).fill(0).map((_, i) => (
                                <div key={i} className="flex items-center gap-4 p-4">
                                    <Skeleton className="h-8 w-8 rounded-full" />
                                    <div className="flex-1 space-y-1.5">
                                        <Skeleton className="h-4 w-48" />
                                        <Skeleton className="h-3 w-32" />
                                    </div>
                                    <Skeleton className="h-5 w-20" />
                                    <Skeleton className="h-5 w-16" />
                                </div>
                            ))}
                        </div>
                    ) : groupedEvents.length === 0 ? (
                        <EmptyState
                            icon={Zap}
                            title="No push events yet"
                            description="Send your first push event to trigger an instant action on a connected screen — reload, alert, sound, or custom."
                            action={{ label: "+ Send Push Event", onClick: () => setIsCreateOpen(true) }}
                            className="border-none rounded-none"
                        />
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {groupedEvents.map(group => {
                                const meta = EVENT_TYPE_META[group.event_type] ?? EVENT_TYPE_META.custom
                                const expired = isExpired(group)
                                return (
                                    <div
                                        key={group.id}
                                        className={`flex items-center gap-4 px-5 py-3.5 group transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/30 ${expired ? "opacity-50" : ""}`}
                                    >
                                        {/* Icon */}
                                        <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 border ${meta.color}`}>
                                            {meta.icon}
                                        </div>

                                        {/* Main info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">{meta.label}</span>
                                                <ChevronRight className="h-3 w-3 text-slate-400" />
                                                <span className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-1">
                                                    <MonitorPlay className="h-3 w-3 text-slate-400" />
                                                    {group.count > 1 ? (
                                                        <span className="font-medium text-indigo-600 dark:text-indigo-400">Broadcast to {group.count} screens</span>
                                                    ) : (
                                                        group.screen?.name ?? "Unknown screen"
                                                    )}
                                                </span>
                                            </div>
                                            <div className="text-xs text-slate-400 flex items-center gap-3">
                                                <span>{formatDistanceToNow(new Date(group.created_at), { addSuffix: true })}</span>
                                                {group.expires_at && (
                                                    <span className={`flex items-center gap-1 ${expired ? "text-red-500" : "text-slate-400"}`}>
                                                        <Clock className="h-3 w-3" />
                                                        {expired ? "Expired" : `Expires ${formatDistanceToNow(new Date(group.expires_at), { addSuffix: true })}`}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Badges */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Badge variant="outline" className={`text-[10px] font-medium border ${meta.color}`}>
                                                {meta.label}
                                            </Badge>
                                            {expired && (
                                                <Badge variant="outline" className="text-[10px] text-red-500 border-red-200 dark:border-red-800">
                                                    Expired
                                                </Badge>
                                            )}
                                        </div>

                                        {/* Timestamp */}
                                        <div className="text-xs text-slate-400 w-28 text-right hidden md:block shrink-0">
                                            {format(new Date(group.created_at), "MMM d, h:mm a")}
                                        </div>

                                        {/* Delete */}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0"
                                            onClick={() => handleDelete(group.ids)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Send Event Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Zap className="h-5 w-5 text-rose-500" /> Send Push Event
                        </DialogTitle>
                        <DialogDescription>
                            Instantly trigger an action on one or all of your screens.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={prepareSend} className="space-y-6 py-2">
                        {/* Target selection */}
                        <div className="space-y-3">
                            <Label>Target Selection</Label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer border p-3 flex-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                                    <input 
                                        type="radio" 
                                        name="target" 
                                        checked={targetType === "single"} 
                                        onChange={() => setTargetType("single")}
                                        className="h-4 w-4 text-indigo-600"
                                    />
                                    <span className="text-sm font-medium">Single Screen</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer border p-3 flex-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                                    <input 
                                        type="radio" 
                                        name="target" 
                                        checked={targetType === "all"} 
                                        onChange={() => setTargetType("all")}
                                        className="h-4 w-4 text-indigo-600"
                                    />
                                    <span className="text-sm font-medium">All Screens</span>
                                </label>
                            </div>

                            {targetType === "single" && (
                                <div className="pt-2 animate-in fade-in slide-in-from-top-2">
                                    <Select value={screenId} onValueChange={setScreenId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select screen..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {screens.map(s => (
                                                <SelectItem key={s.id} value={s.id}>
                                                    <span className="flex items-center gap-2">
                                                        <span className={`h-2 w-2 rounded-full ${s.status === "online" ? "bg-emerald-500" : "bg-slate-300"}`} />
                                                        {s.name}
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>

                        {/* Event type */}
                        <div className="space-y-2">
                            <Label>Event Type</Label>
                            <Select value={eventType} onValueChange={setEventType}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(EVENT_TYPE_META).map(([key, meta]) => (
                                        <SelectItem key={key} value={key}>
                                            <span className="flex items-center gap-2">
                                                <span className={`flex items-center justify-center h-5 w-5 rounded shrink-0 border ${meta.color}`}>{meta.icon}</span>
                                                {meta.label}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Dynamic Payload Form */}
                        <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                            {eventType === "play_sound" && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Audio URL</Label>
                                        <Input 
                                            placeholder="https://example.com/sound.mp3" 
                                            value={payload.url || ''} 
                                            onChange={e => setPayload({ ...payload, url: e.target.value })} 
                                        />
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-xs text-slate-500 font-medium">OR</span>
                                        <Label htmlFor="audio-upload" className="flex items-center justify-center gap-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-2 text-sm font-medium cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors w-full">
                                            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                            {isUploading ? "Uploading..." : "Upload Audio File"}
                                        </Label>
                                        <input 
                                            id="audio-upload" 
                                            type="file" 
                                            accept="audio/*" 
                                            className="hidden" 
                                            onChange={handleAudioUpload} 
                                            disabled={isUploading}
                                        />
                                    </div>
                                </div>
                            )}

                            {eventType === "show_alert" && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Message</Label>
                                        <Textarea 
                                            placeholder="Emergency alert message..." 
                                            value={payload.message || ''} 
                                            onChange={e => setPayload({ ...payload, message: e.target.value })} 
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Duration (seconds)</Label>
                                            <Input 
                                                type="number" 
                                                value={payload.duration || 8} 
                                                onChange={e => setPayload({ ...payload, duration: parseInt(e.target.value) || 8 })} 
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Position</Label>
                                            <Select value={payload.position || 'top'} onValueChange={v => setPayload({ ...payload, position: v })}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="top">Top</SelectItem>
                                                    <SelectItem value="center">Center</SelectItem>
                                                    <SelectItem value="bottom">Bottom</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Style</Label>
                                        <Select value={payload.style || 'info'} onValueChange={v => setPayload({ ...payload, style: v })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="info">Info (Blue)</SelectItem>
                                                <SelectItem value="warning">Warning (Yellow)</SelectItem>
                                                <SelectItem value="error">Error (Red)</SelectItem>
                                                <SelectItem value="success">Success (Green)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            )}

                            {eventType === "override_content" && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Content Item</Label>
                                        <Select 
                                            value={payload.content_item_id || ''} 
                                            onValueChange={v => setPayload({ ...payload, content_item_id: v })}
                                        >
                                            <SelectTrigger><SelectValue placeholder="Select content..." /></SelectTrigger>
                                            <SelectContent>
                                                {contentItems.map(item => (
                                                    <SelectItem key={item.id} value={item.id}>
                                                        {item.name} <span className="text-xs text-slate-400 ml-1">({item.type})</span>
                                                    </SelectItem>
                                                ))}
                                                {contentItems.length === 0 && <SelectItem value="none" disabled>No content items found</SelectItem>}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Duration (seconds)</Label>
                                        <Input 
                                            type="number" 
                                            value={payload.duration || 30} 
                                            onChange={e => setPayload({ ...payload, duration: parseInt(e.target.value) || 30 })} 
                                        />
                                    </div>
                                </div>
                            )}

                            {eventType === "reload" && (
                                <div className="text-sm text-slate-500 py-2">
                                    This event requires no additional parameters. The screen will immediately refresh the page.
                                </div>
                            )}

                            {eventType === "custom" && (
                                <div className="space-y-2">
                                    <Label>JSON Payload</Label>
                                    <Textarea
                                        value={jsonPayloadStr}
                                        onChange={e => setJsonPayloadStr(e.target.value)}
                                        className="font-mono text-xs h-28"
                                        placeholder='{"command": "wake_up"}'
                                    />
                                </div>
                            )}
                        </div>

                        {/* Expiry */}
                        <div className="space-y-2">
                            <Label>Expires After</Label>
                            <Select value={expiryMinutes} onValueChange={setExpiryMinutes}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {EXPIRY_OPTIONS.map(o => (
                                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-slate-500">
                                Display clients ignore events that have expired. Set to &quot;Never&quot; for permanent events.
                            </p>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSending} className="gap-2 min-w-[130px]">
                                {isSending
                                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Preparing...</>
                                    : <><Send className="h-4 w-4" /> Send Event</>
                                }
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Confirm Broadcast Dialog */}
            <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Confirm Broadcast</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to send this <strong className="text-slate-900 dark:text-white">{selectedMeta.label}</strong> event to all {screens.length} screens simultaneously?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4">
                        <Button type="button" variant="outline" onClick={() => setIsConfirmOpen(false)}>Cancel</Button>
                        <Button type="button" disabled={isSending} onClick={executeSend} className="gap-2">
                            {isSending ? "Broadcasting..." : "Yes, Broadcast to All"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
