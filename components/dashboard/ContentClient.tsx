"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useContent } from "@/hooks/use-content"
import { SWRConfig } from "swr"
import { useUser } from "@/hooks/use-user"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { Search, UploadCloud, Link as LinkIcon, File as FileIcon } from "lucide-react"

import { ContentGrid } from "@/components/content/ContentGrid"
import { UploadDialog } from "@/components/content/UploadDialog"
import { ContentPreviewDialog } from "@/components/content/ContentPreviewDialog"
import { BulkActionsBar } from "@/components/content/BulkActionsBar"
import { LinkDialog } from "@/components/content/LinkDialog"

export interface ContentItem {
    id: string;
    organization_id: string;
    name: string;
    type: 'image' | 'video' | 'audio' | 'powerbi' | 'powerbi_frame' | 'url' | 'webpage' | 'html_snippet' | 'dashboard';
    source_url: string | null;
    file_path: string | null;
    file_size: number | null;
    thumbnail_url: string | null;
    duration_seconds: number | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata: any;
    created_at: string;
}

export default function ContentClient({ fallbackData }: { fallbackData: any }) {
    return (
        <SWRConfig value={{ fallback: fallbackData }}>
            <ContentContent />
        </SWRConfig>
    )
}

function ContentContent() {
    const { profile } = useUser()
    const supabase = createClient()
    const { toast } = useToast()

    const { data: itemsData, isLoading: isFetching, refresh: fetchContent } = useContent()
    const [items, setItems] = useState<ContentItem[]>([])
    
    // Sync SWR data to local state for optimistic updates
    useEffect(() => {
        if (itemsData) setItems(itemsData)
    }, [itemsData])

    const [searchQuery, setSearchQuery] = useState("")
    const [selectedTab, setSelectedTab] = useState("all")

    // Multi-select
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

    // Dialogs
    const [isUploadOpen, setIsUploadOpen] = useState(false)
    const [isLinkOpen, setIsLinkOpen] = useState(false)
    const [previewItem, setPreviewItem] = useState<ContentItem | null>(null)

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

    // Multi-select actions
    const toggleSelectAll = useCallback(() => {
        if (selectedIds.size === filteredItems.length && filteredItems.length > 0) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(filteredItems.map(i => i.id)))
        }
    }, [selectedIds.size, filteredItems])

    const toggleSelect = useCallback((id: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev)
            if (newSet.has(id)) newSet.delete(id)
            else newSet.add(id)
            return newSet
        })
    }, [])

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

    const copyUrl = useCallback(async (url: string) => {
        try {
            await navigator.clipboard.writeText(url)
            toast({ title: "URL copied to clipboard" })
        } catch {
            toast({ title: "Failed to copy", variant: "destructive" })
        }
    }, [toast])

    const handlePreview = useCallback((item: ContentItem) => {
        setPreviewItem(item)
    }, [])

    const handleOpenUpload = useCallback(() => { setIsUploadOpen(true) }, [])
    const handleOpenLink = useCallback(() => { setIsLinkOpen(true) }, [])

    // Link optimistic update callbacks
    const handleLinkItemCreated = useCallback((_tempId: string, optimisticItem: ContentItem) => {
        setItems(prev => [optimisticItem, ...prev])
    }, [])

    const handleLinkItemConfirmed = useCallback((tempId: string, savedItem: ContentItem) => {
        setItems(prev => prev.map(item => item.id === tempId ? savedItem : item))
    }, [])

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
                    <Button onClick={() => setIsUploadOpen(true)} className="flex-1 sm:flex-none">
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
            <BulkActionsBar
                selectedCount={selectedIds.size}
                onDeleteSelected={() => setIsDeleteDialogOpen(true)}
                onClearSelection={() => setSelectedIds(new Set())}
            />

            {/* Grid */}
            <ContentGrid
                items={items}
                filteredItems={filteredItems}
                isFetching={isFetching}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onToggleSelectAll={toggleSelectAll}
                onPreview={handlePreview}
                onCopyUrl={copyUrl}
                onOpenUpload={handleOpenUpload}
                onOpenLink={handleOpenLink}
            />

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
            <UploadDialog
                open={isUploadOpen}
                onOpenChange={setIsUploadOpen}
                onUploadComplete={fetchContent}
            />

            {/* Add Link Dialog */}
            <LinkDialog
                open={isLinkOpen}
                onOpenChange={setIsLinkOpen}
                onItemCreated={handleLinkItemCreated}
                onItemConfirmed={handleLinkItemConfirmed}
                onError={fetchContent}
            />

            {/* Preview Modal */}
            <ContentPreviewDialog
                item={previewItem}
                open={!!previewItem}
                onOpenChange={(v) => !v && setPreviewItem(null)}
            />
        </div>
    )
}
