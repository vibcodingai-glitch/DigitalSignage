"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/hooks/use-user"
import { format } from "date-fns"
import { useDropzone } from "react-dropzone"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import {
    Search, UploadCloud, Link as LinkIcon, Trash2, Play, Image as ImageIcon,
    Video as VideoIcon, Music, Globe, BarChart2, Code, File as FileIcon, Eye, Copy, X, ArrowUpCircle, ExternalLink
} from "lucide-react"

export interface ContentItem {
    id: string;
    organization_id: string;
    name: string;
    type: 'image' | 'video' | 'audio' | 'powerbi' | 'url' | 'webpage' | 'html_snippet' | 'dashboard';
    source_url: string | null;
    file_path: string | null;
    file_size: number | null;
    thumbnail_url: string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata: any;
    created_at: string;
}

const typeIcons = {
    image: <ImageIcon className="h-5 w-5" />,
    video: <VideoIcon className="h-5 w-5" />,
    audio: <Music className="h-5 w-5" />,
    url: <Globe className="h-5 w-5" />,
    webpage: <Globe className="h-5 w-5" />,
    powerbi: <BarChart2 className="h-5 w-5" />,
    dashboard: <BarChart2 className="h-5 w-5" />,
    html_snippet: <Code className="h-5 w-5" />
}

const typeColors = {
    image: "text-blue-500 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-900/50",
    video: "text-purple-500 bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-900/50",
    audio: "text-emerald-500 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-900/50",
    url: "text-indigo-500 bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-900/50",
    webpage: "text-indigo-500 bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-900/50",
    powerbi: "text-amber-500 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-900/50",
    dashboard: "text-amber-500 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-900/50",
    html_snippet: "text-slate-500 bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700"
}

// Detect Tableau URLs
function isTableauUrl(url: string): boolean {
    try { return new URL(url).hostname.includes('tableau.com') } catch { return false }
}

// Convert Tableau profile URL → embeddable /views/ URL
// e.g. /app/profile/user/viz/Workbook/Sheet → /views/Workbook/Sheet
function getTableauViewsUrl(url: string): string {
    try {
        const match = url.match(/\/viz\/([^/?#]+)\/([^/?#]+)/)
        if (match) return `https://public.tableau.com/views/${match[1]}/${match[2]}`
        return url
    } catch { return url }
}

// Auto-transform other dashboard URLs to embeddable variants.
function getEmbedUrl(url: string): string {
    try {
        const u = new URL(url)
        // PowerBI: add embedview action if missing
        if (u.hostname.includes('powerbi.com') && !u.searchParams.has('action')) {
            u.searchParams.set('action', 'embedview')
            return u.toString()
        }
        return url
    } catch { return url }
}

// Renders a Tableau visualization using the official Embedding API v3.
// This bypasses X-Frame-Options entirely — it's the only reliable way to embed Tableau.
function TableauEmbed({ url }: { url: string }) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
    const viewsUrl = getTableauViewsUrl(url)

    useEffect(() => {
        const scriptId = 'tableau-embedding-api-v3'
        const injectViz = () => {
            if (!containerRef.current) return
            containerRef.current.innerHTML = ''
            const viz = document.createElement('tableau-viz') as HTMLElement
            viz.setAttribute('src', viewsUrl)
            viz.setAttribute('width', '100%')
            viz.setAttribute('height', '100%')
            viz.setAttribute('hide-tabs', '')
            viz.setAttribute('toolbar', 'hidden')
            viz.addEventListener('firstinteractive', () => setStatus('ready'))
            viz.addEventListener('vizloaderror', () => setStatus('error'))
            containerRef.current.appendChild(viz)
        }

        if (document.getElementById(scriptId)) {
            // Script already loaded
            injectViz()
            return
        }
        // Dynamically load the Tableau Embedding API v3
        const script = document.createElement('script')
        script.id = scriptId
        script.type = 'module'
        script.src = 'https://public.tableau.com/javascripts/api/tableau.embedding.3.latest.min.js'
        script.onload = injectViz
        script.onerror = () => setStatus('error')
        document.head.appendChild(script)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewsUrl])

    return (
        <div className="relative w-full h-full bg-slate-950">
            {status === 'loading' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 pointer-events-none">
                    <div className="h-8 w-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                    <p className="text-slate-400 text-sm">Loading Tableau viz…</p>
                </div>
            )}
            {status === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10">
                    <p className="text-slate-300 font-semibold">Could not load visualization</p>
                    <a href={url} target="_blank" rel="noopener noreferrer"
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm flex items-center gap-2">
                        Open on Tableau Public <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                </div>
            )}
            <div ref={containerRef} className="w-full h-full" />
        </div>
    )
}


export default function ContentLibraryPage() {
    const { profile } = useUser()
    const supabase = createClient()
    const { toast } = useToast()

    const [items, setItems] = useState<ContentItem[]>([])
    const [isFetching, setIsFetching] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedTab, setSelectedTab] = useState("all")

    // Multi-select
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

    // Dialogs
    const [isUploadOpen, setIsUploadOpen] = useState(false)
    const [isLinkOpen, setIsLinkOpen] = useState(false)
    const [previewItem, setPreviewItem] = useState<ContentItem | null>(null)
    const [iframeBlocked, setIframeBlocked] = useState(false)

    // Link Form State
    const [linkForm, setLinkForm] = useState({
        name: "",
        type: "url" as ContentItem['type'],
        source_url: "",
        duration_seconds: 10
    })
    const [isSavingLink, setIsSavingLink] = useState(false)

    // Upload Form State
    const [uploadFiles, setUploadFiles] = useState<{ file: File, progress: number, status: 'pending' | 'uploading' | 'success' | 'error', error?: string, duration: number, name: string }[]>([])
    const [isUploading, setIsUploading] = useState(false)

    const fetchContent = useCallback(async () => {
        setIsFetching(true)
        try {
            const { data, error } = await supabase
                .from('content_items')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error
            setItems(data as ContentItem[])
        } catch (error) {
            toast({ title: "Failed to load content", variant: "destructive", description: (error as Error).message })
        } finally {
            setIsFetching(false)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        fetchContent()
    }, [fetchContent])

    // Multi-select actions
    const toggleSelectAll = () => {
        if (selectedIds.size === filteredItems.length && filteredItems.length > 0) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(filteredItems.map(i => i.id)))
        }
    }

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds)
        if (newSet.has(id)) newSet.delete(id)
        else newSet.add(id)
        setSelectedIds(newSet)
    }

    const handleDeleteSelected = async () => {
        const idsToDelete = Array.from(selectedIds)
        if (idsToDelete.length === 0) return

        try {
            const { error } = await supabase
                .from('content_items')
                .delete()
                .in('id', idsToDelete)

            if (error) throw error

            toast({ title: `Deleted ${idsToDelete.length} item(s) successfully` })
            setSelectedIds(new Set())
            fetchContent()
        } catch (error) {
            toast({ title: "Failed to delete files", variant: "destructive", description: (error as Error).message })
        } finally {
            setIsDeleteDialogOpen(false)
        }
    }

    // Link handling
    const [linkError, setLinkError] = useState<string | null>(null)

    const handleSaveLink = async (e: React.FormEvent) => {
        e.preventDefault()
        setLinkError(null)

        let orgId = profile?.organization_id
        if (!orgId) {
            const { data } = await supabase.rpc('get_auth_user_organization_id')
            orgId = data
        }
        if (!orgId) {
            setLinkError('Session not ready — please try again')
            return
        }

        // Validate URL
        if (linkForm.type !== 'html_snippet') {
            let validUrl = false
            try {
                const parsed = new URL(linkForm.source_url)
                validUrl = parsed.protocol === 'http:' || parsed.protocol === 'https:'
            } catch {
                validUrl = false
            }
            if (!validUrl) {
                setLinkError('Please enter a valid URL starting with http:// or https://')
                return
            }
        }

        setIsSavingLink(true)
        try {
            const { error } = await supabase.from('content_items').insert({
                organization_id: orgId,
                name: linkForm.name,
                type: linkForm.type,
                source_url: linkForm.source_url,
                duration_seconds: parseInt(String(linkForm.duration_seconds)) || 10
            })

            if (error) {
                console.error('[SaveLink] DB error:', error)
                throw error
            }
            toast({ title: "Link added successfully" })
            setIsLinkOpen(false)
            setLinkError(null)
            setLinkForm({ name: "", type: "url", source_url: "", duration_seconds: 10 })
            fetchContent()
        } catch (error) {
            const msg = (error as Error).message || 'Unknown error'
            console.error('[SaveLink] Error:', msg)
            setLinkError(msg)
            toast({ title: "Failed to add link", variant: "destructive", description: msg })
        } finally {
            setIsSavingLink(false)
        }
    }

    // Upload handling
    const onDrop = useCallback((acceptedFiles: File[]) => {
        const newFiles = acceptedFiles.map(file => ({
            file,
            progress: 0,
            status: 'pending' as const,
            duration: 10,
            name: file.name
        }))
        setUploadFiles(prev => [...prev, ...newFiles])
    }, [])

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp', '.svg'],
            'video/*': ['.mp4', '.webm', '.ogg', '.mov'],
            'audio/*': ['.mp3', '.wav', '.ogg']
        }
    })

    const updateUploadState = (index: number, updates: Partial<typeof uploadFiles[0]>) => {
        setUploadFiles(prev => {
            const clone = [...prev]
            clone[index] = { ...clone[index], ...updates }
            return clone
        })
    }

    const startUploads = async () => {
        let orgId = profile?.organization_id
        if (!orgId) {
            const { data } = await supabase.rpc('get_auth_user_organization_id')
            orgId = data
        }
        if (!orgId) return
        setIsUploading(true)

        for (let i = 0; i < uploadFiles.length; i++) {
            if (uploadFiles[i].status === 'success') continue;

            const fileItem = uploadFiles[i]
            updateUploadState(i, { status: 'uploading', progress: 10 })

            const file = fileItem.file
            const ext = file.name.split('.').pop()
            const filePath = `${orgId}/${Date.now()}_${Math.random().toString(36).substring(2)}.${ext}`

            // Progress Simulator
            const progressTimer = setInterval(() => {
                setUploadFiles(prev => {
                    const clone = [...prev]
                    if (clone[i].progress < 90) {
                        clone[i].progress += 5
                    }
                    return clone
                })
            }, 300)

            try {
                // Upload to storage
                const { data: storageData, error: storageError } = await supabase.storage
                    .from('content')
                    .upload(filePath, file)

                clearInterval(progressTimer)

                if (storageError) {
                    // It will fail gracefully if the bucket "content" doesn't exist, displaying error.
                    throw storageError
                }

                updateUploadState(i, { progress: 95 })

                const { data: { publicUrl } } = supabase.storage.from('content').getPublicUrl(storageData.path)

                // Determine mapped type
                const mime = file.type
                let type: ContentItem['type'] = 'image'
                if (mime.startsWith('video/')) type = 'video'
                if (mime.startsWith('audio/')) type = 'audio'

                // Insert to content_items
                const { error: dbError } = await supabase.from('content_items').insert({
                    organization_id: orgId,
                    name: fileItem.name,
                    type: type,
                    file_path: storageData.path,
                    source_url: publicUrl,
                    file_size: file.size,
                    duration_seconds: type === 'video' ? 0 : fileItem.duration, // Video overrides dynamically on run
                    thumbnail_url: type === 'image' ? publicUrl : null // Simple image thumb fallback
                })

                if (dbError) throw dbError

                updateUploadState(i, { status: 'success', progress: 100 })
            } catch (error) {
                clearInterval(progressTimer)
                updateUploadState(i, { status: 'error', error: (error as Error).message })
            }
        }

        setIsUploading(false)
        fetchContent()
    }

    const formatBytes = (bytes: number, decimals = 2) => {
        if (!+bytes) return '0 Bytes'
        const k = 1024, dm = decimals < 0 ? 0 : decimals
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
    }

    const copyUrl = async (url: string) => {
        try {
            await navigator.clipboard.writeText(url)
            toast({ title: "URL copied to clipboard" })
        } catch {
            toast({ title: "Failed to copy", variant: "destructive" })
        }
    }

    // Filtering
    const filteredItems = items.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase())
        if (!matchesSearch) return false

        switch (selectedTab) {
            case "image": return item.type === "image"
            case "video": return item.type === "video"
            case "audio": return item.type === "audio"
            case "url": return item.type === "url" || item.type === "webpage"
            case "powerbi": return item.type === "powerbi" || item.type === "dashboard"
            case "html": return item.type === "html_snippet"
            default: return true
        }
    })

    const removeFileFromQueue = (index: number) => {
        setUploadFiles(prev => prev.filter((_, i) => i !== index))
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400 rounded-lg">
                        <FileIcon className="h-6 w-6" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">Content Library</h1>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button onClick={() => setIsLinkOpen(true)} variant="outline" className="flex-1 sm:flex-none">
                        <LinkIcon className="mr-2 h-4 w-4" /> Add Link
                    </Button>
                    <Button onClick={() => { setUploadFiles([]); setIsUploadOpen(true) }} className="flex-1 sm:flex-none">
                        <UploadCloud className="mr-2 h-4 w-4" /> Upload Media
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 justify-between bg-white dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full truncate overflow-x-auto">
                    <TabsList className="bg-transparent h-10 w-full justify-start md:w-auto p-0">
                        <TabsTrigger value="all" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-600 dark:data-[state=active]:bg-indigo-900/30 dark:data-[state=active]:text-indigo-400">All Items</TabsTrigger>
                        <TabsTrigger value="image" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 dark:data-[state=active]:bg-blue-900/30 dark:data-[state=active]:text-blue-400">Images</TabsTrigger>
                        <TabsTrigger value="video" className="data-[state=active]:bg-purple-50 data-[state=active]:text-purple-600 dark:data-[state=active]:bg-purple-900/30 dark:data-[state=active]:text-purple-400">Videos</TabsTrigger>
                        <TabsTrigger value="audio" className="data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-600 dark:data-[state=active]:bg-emerald-900/30 dark:data-[state=active]:text-emerald-400">Audio</TabsTrigger>
                        <TabsTrigger value="url" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-600 dark:data-[state=active]:bg-indigo-900/30 dark:data-[state=active]:text-indigo-400">Web Links</TabsTrigger>
                        <TabsTrigger value="powerbi" className="data-[state=active]:bg-amber-50 data-[state=active]:text-amber-600 dark:data-[state=active]:bg-amber-900/30 dark:data-[state=active]:text-amber-400">PowerBI</TabsTrigger>
                        <TabsTrigger value="html" className="data-[state=active]:bg-slate-100 data-[state=active]:text-slate-600 dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-slate-400">HTML</TabsTrigger>
                    </TabsList>
                </Tabs>
                <div className="relative w-full md:w-64 shrink-0">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                    <Input placeholder="Search content..." className="pl-9 h-10 bg-slate-50 dark:bg-slate-900" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
            </div>

            {/* Bulk Actions */}
            {selectedIds.size > 0 && (
                <div className="flex items-center justify-between p-3 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 rounded-lg border border-indigo-100 dark:border-indigo-800 animate-in slide-in-from-top-2">
                    <div className="text-sm font-medium flex items-center">
                        <span className="bg-indigo-200 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-200 h-6 w-6 flex items-center justify-center rounded-full mr-2 text-xs">
                            {selectedIds.size}
                        </span>
                        assets selected
                    </div>
                    <Button variant="outline" size="sm" className="border-indigo-200 hover:bg-indigo-100 text-red-600 border-red-200 hover:border-red-300 hover:text-red-700" onClick={() => setIsDeleteDialogOpen(true)}>
                        <Trash2 className="h-4 w-4 mr-2" /> Delete Selected
                    </Button>
                </div>
            )}

            {/* Grid */}
            {isFetching ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
                        <div key={i} className="flex flex-col space-y-3">
                            <Skeleton className="h-32 w-full rounded-xl" />
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-[250px] max-w-full" />
                                <Skeleton className="h-4 w-[200px]" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                    <div className="p-4 bg-white dark:bg-slate-900 rounded-full shadow-sm mb-4">
                        <UploadCloud className="h-10 w-10 text-slate-300 dark:text-slate-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">Your library is empty</h3>
                    <p className="text-slate-500 max-w-md mb-6">Start populating your workspace by dragging media files, uploading assets, or linking to dynamic external web portals and BI dashboards.</p>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <Button onClick={() => { setUploadFiles([]); setIsUploadOpen(true) }}>
                            <UploadCloud className="mr-2 h-4 w-4" /> Upload Media
                        </Button>
                        <Button onClick={() => setIsLinkOpen(true)} variant="outline">
                            <LinkIcon className="mr-2 h-4 w-4" /> Create Link
                        </Button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex items-center mb-2 px-1">
                        <Checkbox
                            id="select-all"
                            checked={selectedIds.size === filteredItems.length && filteredItems.length > 0}
                            onCheckedChange={toggleSelectAll}
                            className="mr-3"
                        />
                        <Label htmlFor="select-all" className="text-sm text-slate-500 font-medium cursor-pointer">
                            Select All {filteredItems.length} items
                        </Label>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {filteredItems.map(item => {
                            const isSelected = selectedIds.has(item.id)
                            const isImage = item.type === 'image'
                            const isVideo = item.type === 'video'

                            return (
                                <Card
                                    key={item.id}
                                    className={`group overflow-hidden transition-all duration-200 border-2 cursor-pointer relative ${isSelected ? 'border-indigo-500 shadow-md ring-2 ring-indigo-500/20 dark:ring-indigo-500/30' : 'border-slate-100 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md'}`}
                                    onClick={() => toggleSelect(item.id)}
                                >
                                    <div className="absolute top-2 left-2 z-10 opactiy-100">
                                        <div className={`p-0.5 rounded flex items-center justify-center ${isSelected ? 'bg-white opacity-100' : 'bg-white/80 opacity-0 group-hover:opacity-100 transition-opacity'} shadow-sm border border-slate-200`}>
                                            <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(item.id)} />
                                        </div>
                                    </div>

                                    <div className="aspect-square relative bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-center overflow-hidden">
                                        {/* Overlay Actions */}
                                        <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center justify-center gap-2">
                                            <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full shadow-lg" onClick={(e) => { e.stopPropagation(); setIframeBlocked(false); setPreviewItem(item); }}>
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            {item.source_url && (
                                                <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full shadow-lg" onClick={(e) => { e.stopPropagation(); copyUrl(item.source_url!); }}>
                                                    <Copy className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>

                                        {/* Thumbnails */}
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        {isImage && item.source_url ? (
                                            <img src={item.source_url} alt={item.name} className="object-cover w-full h-full" />
                                        ) : isVideo && item.source_url ? (
                                            <div className="w-full h-full bg-slate-950 relative">
                                                <video src={item.source_url} className="w-full h-full object-cover opacity-50" />
                                                <Play className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-white drop-shadow-lg" />
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                {typeIcons[item.type]}
                                                {item.type === 'url' || item.type === 'webpage' ? (
                                                    <div className="px-3 truncate w-full text-center">
                                                        <span className="text-xs text-slate-500 font-mono inline-block truncate max-w-full">
                                                            {item.source_url}
                                                        </span>
                                                    </div>
                                                ) : null}
                                            </div>
                                        )}

                                        <Badge className={`absolute bottom-2 right-2 border capitalize text-[10px] ${typeColors[item.type]}`} variant="outline">
                                            {item.type}
                                        </Badge>
                                    </div>

                                    <CardContent className="p-3">
                                        <h3 className="font-semibold text-sm truncate text-slate-900 dark:text-slate-100" title={item.name}>{item.name}</h3>
                                        <div className="flex justify-between items-center mt-1">
                                            <span className="text-[10px] text-slate-500">{formatBytes(item.file_size || 0)}</span>
                                            <span className="text-[10px] text-slate-400">{format(new Date(item.created_at), 'MMM d, yyyy')}</span>
                                        </div>
                                    </CardContent>
                                    <div className={`absolute inset-0 bg-indigo-500/5 pointer-events-none transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
                                </Card>
                            )
                        })}
                    </div>
                </>
            )}

            {/* Delete Alert Dialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete {selectedIds.size} selected item(s) from your content library. Active screens rendering this content will instantly start skipping missing timelines.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteSelected} className="bg-red-600 hover:bg-red-700">Confirm Deletion</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Upload Dialog */}
            <Dialog open={isUploadOpen} onOpenChange={(v) => {
                if (!isUploading) setIsUploadOpen(v)
            }}>
                <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Upload Media Library Assets</DialogTitle>
                        <DialogDescription>
                            Drag native static media (JPG, MP4, MP3) into this bucket workspace.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="overflow-y-auto pr-2 pb-2">
                        {/* Dropzone */}
                        <div
                            {...getRootProps()}
                            className={`border-2 border-dashed rounded-xl p-8 transition-colors flex flex-col items-center justify-center cursor-pointer text-center bg-slate-50/50 dark:bg-slate-900/20
                                ${isDragActive ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900'}
                                ${isUploading ? 'pointer-events-none opacity-50' : ''}`
                            }
                        >
                            <input {...getInputProps()} />
                            <div className="bg-white dark:bg-slate-950 p-3 rounded-full shadow-sm border border-slate-100 dark:border-slate-800 mb-3">
                                <UploadCloud className={`h-6 w-6 ${isDragActive ? 'text-indigo-500' : 'text-slate-400'}`} />
                            </div>
                            <h4 className="font-semibold text-slate-800 dark:text-slate-200">
                                {isDragActive ? "Drop files now..." : "Drag files here to queue uploads"}
                            </h4>
                            <p className="text-sm text-slate-500 mt-1">Or click to manually browse your machine.</p>
                        </div>

                        {/* Queue List */}
                        {uploadFiles.length > 0 && (
                            <div className="mt-6 space-y-3">
                                <Label className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 dark:border-slate-800 pb-2">
                                    <span>Upload Queue</span>
                                    <span>{uploadFiles.length} files</span>
                                </Label>

                                {uploadFiles.map((uf, i) => (
                                    <div key={i} className={`p-3 rounded-lg border flex gap-3 ${uf.status === 'success' ? 'bg-emerald-50/50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/30' : uf.status === 'error' ? 'bg-red-50/50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30' : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800'}`}>
                                        <div className="h-10 w-10 shrink-0 bg-slate-100 dark:bg-slate-900 rounded-md flex items-center justify-center">
                                            {uf.file.type.startsWith('image') ? <ImageIcon className="h-4 w-4 text-slate-400" /> :
                                                uf.file.type.startsWith('video') ? <VideoIcon className="h-4 w-4 text-slate-400" /> :
                                                    <FileIcon className="h-4 w-4 text-slate-400" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start mb-1">
                                                <Input
                                                    value={uf.name}
                                                    onChange={(e) => updateUploadState(i, { name: e.target.value })}
                                                    className="h-6 text-xs px-2 w-[55%] border-transparent hover:border-slate-200 focus:border-indigo-500 bg-transparent font-medium"
                                                    disabled={isUploading || uf.status === 'success'}
                                                />
                                                {!uf.file.type.startsWith('video/') && (
                                                    <div className="flex items-center gap-2">
                                                        <Label className="text-[10px] text-slate-500">Dur.(s)</Label>
                                                        <Input
                                                            type="number"
                                                            value={uf.duration}
                                                            onChange={(e) => updateUploadState(i, { duration: parseInt(e.target.value) || 0 })}
                                                            className="h-6 w-16 text-xs px-2 p-0 text-center"
                                                            disabled={isUploading || uf.status === 'success'}
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-3">
                                                {uf.status === 'error' ? (
                                                    <p className="text-[10px] text-red-500 truncate flex-1">{uf.error}</p>
                                                ) : uf.status === 'success' ? (
                                                    <p className="text-[10px] text-emerald-500 font-medium">Uploaded Successfully</p>
                                                ) : (
                                                    <>
                                                        <Progress value={uf.progress} className="h-1 flex-1" />
                                                        <span className="text-[10px] text-slate-400 shrink-0 w-8">{uf.progress}%</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {!isUploading && uf.status !== 'success' && (
                                            <Button size="icon" variant="ghost" className="h-6 w-6 self-start text-slate-400 hover:text-red-500" onClick={() => removeFileFromQueue(i)}>
                                                <X className="h-3 w-3" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                    </div>
                    <DialogFooter className="pt-4 border-t border-slate-100 dark:border-slate-800">
                        <Button variant="outline" onClick={() => setIsUploadOpen(false)} disabled={isUploading}>Close Window</Button>
                        <Button
                            onClick={startUploads}
                            disabled={isUploading || uploadFiles.length === 0 || uploadFiles.every(u => u.status === 'success')}
                        >
                            {isUploading ? (
                                <>Uploading in Progress...</>
                            ) : (
                                <>
                                    <ArrowUpCircle className="h-4 w-4 mr-2" />
                                    Push {uploadFiles.filter(u => u.status !== 'success').length} files to Cloud
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add Link Dialog */}
            <Dialog open={isLinkOpen} onOpenChange={setIsLinkOpen}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle>Bind External Links</DialogTitle>
                        <DialogDescription>
                            Direct browsers to render dynamic React web apps natively.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSaveLink} className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="type">URL Source Type</Label>
                            <Select value={linkForm.type} onValueChange={(v: ContentItem['type']) => setLinkForm({ ...linkForm, type: v })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="url">Webpage URL</SelectItem>
                                    <SelectItem value="powerbi">PowerBI Dashboard</SelectItem>
                                    <SelectItem value="dashboard">Grafana / Tableu Dashboard</SelectItem>
                                    <SelectItem value="html_snippet">Direct Raw HTML Render</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="name">Asset Display Name</Label>
                            <Input
                                id="name"
                                value={linkForm.name}
                                onChange={e => setLinkForm({ ...linkForm, name: e.target.value })}
                                placeholder="e.g. Daily Metrics TV"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="source_url">Remote Resource Path / Code</Label>
                            {linkForm.type === 'html_snippet' ? (
                                <textarea
                                    className="flex min-h-[100px] w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 dark:border-slate-800 font-mono"
                                    value={linkForm.source_url}
                                    onChange={e => setLinkForm({ ...linkForm, source_url: e.target.value })}
                                    placeholder="<div style='background: red;'>...</div>"
                                    required
                                />
                            ) : (
                                <Input
                                    id="source_url"
                                    type="text"
                                    value={linkForm.source_url}
                                    onChange={e => setLinkForm({ ...linkForm, source_url: e.target.value })}
                                    placeholder="https://"
                                    required
                                />
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="duration">Default Timeline Duration (seconds)</Label>
                            <Input
                                id="duration"
                                type="number"
                                min={1}
                                value={linkForm.duration_seconds}
                                onChange={e => setLinkForm({ ...linkForm, duration_seconds: parseInt(e.target.value) || 10 })}
                                required
                            />
                            <p className="text-[10px] text-slate-500">Determines how long this iframe holds cycle priority within default queues.</p>
                        </div>

                        {linkError && (
                            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-2">
                                {linkError}
                            </p>
                        )}
                        <DialogFooter className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
                            <Button type="button" variant="outline" onClick={() => { setIsLinkOpen(false); setLinkError(null) }}>Cancel</Button>
                            <Button type="submit" disabled={isSavingLink}>
                                {isSavingLink ? "Saving..." : "Save Link Resource"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Preview Modal */}
            <Dialog open={!!previewItem} onOpenChange={(v) => !v && setPreviewItem(null)}>
                <DialogContent className="sm:max-w-4xl sm:h-[80vh] flex flex-col p-1 gap-0 bg-slate-950 border-slate-800 text-slate-100 overflow-hidden">
                    <div className="p-3 flex justify-between items-center border-b border-slate-800 bg-slate-900 absolute top-0 w-full z-10 shadow-sm opacity-0 hover:opacity-100 transition-opacity">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`capitalize ${previewItem ? typeColors[previewItem.type as keyof typeof typeColors] : ''} border-none bg-indigo-900/50`}>{previewItem?.type}</Badge>
                            <h3 className="font-semibold">{previewItem?.name}</h3>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setPreviewItem(null)} className="h-8 w-8 text-slate-400 hover:text-white">
                            <X className="h-5 w-5" />
                        </Button>
                    </div>

                    <div className="flex-1 w-full h-full flex items-center justify-center bg-black overflow-hidden relative group">
                        {previewItem?.type === 'image' && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={previewItem.source_url!} alt={previewItem.name} className="max-w-full max-h-full object-contain" />
                        )}
                        {previewItem?.type === 'video' && (
                            <video src={previewItem.source_url!} controls autoPlay className="max-w-full max-h-full w-full outline-none" />
                        )}
                        {previewItem?.type === 'audio' && (
                            <div className="flex flex-col items-center justify-center h-full w-full p-12 text-center bg-gradient-to-tr from-emerald-950 to-slate-950">
                                <div className="h-24 w-24 rounded-full bg-emerald-900/40 flex items-center justify-center mb-6 border-4 border-emerald-800/50 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                                    <Music className="h-10 w-10 text-emerald-400" />
                                </div>
                                <h3 className="text-xl font-bold mb-4">{previewItem.name}</h3>
                                <audio src={previewItem.source_url!} controls autoPlay className="w-full max-w-sm" />
                            </div>
                        )}
                        {(['url', 'webpage', 'powerbi', 'dashboard'].includes(previewItem?.type as string)) && previewItem?.source_url && (
                            isTableauUrl(previewItem.source_url) ? (
                                /* Tableau: use official Embedding API v3 — bypasses X-Frame-Options */
                                <div className="w-full h-full relative">
                                    <TableauEmbed url={previewItem.source_url} />
                                    <div className="absolute bottom-4 right-4 z-30">
                                        <Button
                                            variant="default" size="sm"
                                            onClick={() => window.open(previewItem.source_url!, '_blank')}
                                            className="shadow-lg bg-indigo-600/90 hover:bg-indigo-500 gap-1.5"
                                        >
                                            Open in Tableau <ExternalLink className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                /* Other URLs: try iframe with blocked fallback */
                                <div className="w-full h-full bg-white relative flex flex-col">
                                    {iframeBlocked ? (
                                        <div className="flex-1 flex flex-col items-center justify-center gap-5 bg-slate-950 text-center px-8">
                                            <div className="h-16 w-16 rounded-2xl bg-slate-800 flex items-center justify-center">
                                                <ExternalLink className="h-7 w-7 text-slate-400" />
                                            </div>
                                            <div>
                                                <p className="text-white font-semibold text-lg">Preview not available</p>
                                                <p className="text-slate-400 text-sm mt-1 max-w-sm">
                                                    This site blocks embedding in iframes. Open it in a new tab to view it.
                                                </p>
                                            </div>
                                            <Button
                                                size="lg"
                                                onClick={() => window.open(previewItem.source_url!, '_blank')}
                                                className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2"
                                            >
                                                Open in New Tab <ExternalLink className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="absolute inset-0 flex items-center justify-center z-0 bg-slate-100 text-slate-400 text-sm">
                                                Loading preview...
                                            </div>
                                            <iframe
                                                key={previewItem.source_url}
                                                src={getEmbedUrl(previewItem.source_url)}
                                                className="w-full h-full relative z-10 border-0"
                                                title={previewItem.name}
                                                allow="fullscreen"
                                                onError={() => setIframeBlocked(true)}
                                                onLoad={(e) => {
                                                    try {
                                                        const doc = (e.target as HTMLIFrameElement).contentDocument
                                                        if (doc === null) setIframeBlocked(true)
                                                    } catch { /* cross-origin = loaded fine */ }
                                                }}
                                            />
                                            <div className="absolute bottom-4 right-4 z-20">
                                                <Button variant="default" size="sm"
                                                    onClick={() => window.open(previewItem.source_url!, '_blank')}
                                                    className="shadow-lg backdrop-blur bg-indigo-600/90 gap-1.5"
                                                >
                                                    Open in New Tab <ExternalLink className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )
                        )}
                        {previewItem?.type === 'html_snippet' && previewItem?.source_url && (
                            <div className="w-full h-full relative bg-white">
                                <iframe srcDoc={previewItem.source_url} className="w-full h-full border-0" title={previewItem.name} />
                            </div>
                        )}

                        <Button variant="ghost" size="icon" onClick={() => setPreviewItem(null)} className="absolute top-4 right-4 h-10 w-10 bg-black/50 text-white rounded-full opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity z-50">
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    )
}
