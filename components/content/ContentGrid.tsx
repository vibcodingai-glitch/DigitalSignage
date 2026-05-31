"use client"

import React from "react"
import { format } from "date-fns"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Play, Image as ImageIcon,
    Video as VideoIcon, Music, Globe, BarChart2, Code, Eye, Copy, UploadCloud,
    Link as LinkIcon
} from "lucide-react"
import type { ContentItem } from "@/components/dashboard/ContentClient"
import { formatBytes } from "@/lib/utils/embed-utils"

const typeIcons: Record<ContentItem['type'], React.ReactNode> = {
    image: <ImageIcon className="h-5 w-5" />,
    video: <VideoIcon className="h-5 w-5" />,
    audio: <Music className="h-5 w-5" />,
    url: <Globe className="h-5 w-5" />,
    webpage: <Globe className="h-5 w-5" />,
    powerbi: <BarChart2 className="h-5 w-5" />,
    powerbi_frame: <BarChart2 className="h-5 w-5" />,
    dashboard: <BarChart2 className="h-5 w-5" />,
    html_snippet: <Code className="h-5 w-5" />,
    weather: <Globe className="h-5 w-5" />,
    rss: <Globe className="h-5 w-5" />,
    qr: <Globe className="h-5 w-5" />
}

const typeColors: Record<ContentItem['type'], string> = {
    image: "text-blue-500 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-900/50",
    video: "text-purple-500 bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-900/50",
    audio: "text-emerald-500 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-900/50",
    url: "text-indigo-500 bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-900/50",
    webpage: "text-indigo-500 bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-900/50",
    powerbi: "text-amber-500 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-900/50",
    powerbi_frame: "text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-900/50",
    dashboard: "text-amber-500 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-900/50",
    html_snippet: "text-slate-500 bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700",
    weather: "text-sky-500 bg-sky-50 border-sky-200 dark:bg-sky-900/20 dark:border-sky-900/50",
    rss: "text-orange-500 bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-900/50",
    qr: "text-slate-500 bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700"
}

export { typeIcons, typeColors }

interface ContentGridProps {
    items: ContentItem[]
    filteredItems: ContentItem[]
    isFetching: boolean
    selectedIds: Set<string>
    onToggleSelect: (id: string) => void
    onToggleSelectAll: () => void
    onPreview: (item: ContentItem) => void
    onCopyUrl: (url: string) => void
    onOpenUpload: () => void
    onOpenLink: () => void
}

export const ContentGrid = React.memo(function ContentGrid({
    filteredItems,
    isFetching,
    selectedIds,
    onToggleSelect,
    onToggleSelectAll,
    onPreview,
    onCopyUrl,
    onOpenUpload,
    onOpenLink,
}: ContentGridProps) {
    if (isFetching) {
        return (
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
        )
    }

    if (filteredItems.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                <div className="p-4 bg-white dark:bg-slate-900 rounded-full shadow-sm mb-4">
                    <UploadCloud className="h-10 w-10 text-slate-300 dark:text-slate-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">Your library is empty</h3>
                <p className="text-slate-500 max-w-md mb-6">Start populating your workspace by dragging media files, uploading assets, or linking to dynamic external web portals and BI dashboards.</p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                    <Button onClick={onOpenUpload}>
                        <UploadCloud className="mr-2 h-4 w-4" /> Upload Media
                    </Button>
                    <Button onClick={onOpenLink} variant="outline">
                        <LinkIcon className="mr-2 h-4 w-4" /> Create Link
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <>
            <div className="flex items-center mb-2 px-1">
                <Checkbox
                    id="select-all"
                    checked={selectedIds.size === filteredItems.length && filteredItems.length > 0}
                    onCheckedChange={onToggleSelectAll}
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
                            onClick={() => onToggleSelect(item.id)}
                        >
                            <div className="absolute top-2 left-2 z-10 opactiy-100">
                                <div className={`p-0.5 rounded flex items-center justify-center ${isSelected ? 'bg-white opacity-100' : 'bg-white/80 opacity-0 group-hover:opacity-100 transition-opacity'} shadow-sm border border-slate-200`}>
                                    <Checkbox checked={isSelected} onCheckedChange={() => onToggleSelect(item.id)} />
                                </div>
                            </div>

                            <div className="aspect-square relative bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-center overflow-hidden">
                                {/* Overlay Actions */}
                                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center justify-center gap-2">
                                    <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full shadow-lg" onClick={(e) => { e.stopPropagation(); onPreview(item); }}>
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                    {item.source_url && (
                                        <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full shadow-lg" onClick={(e) => { e.stopPropagation(); onCopyUrl(item.source_url!); }}>
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
                                    <span className="text-[10px] text-slate-400">{item.created_at ? format(new Date(item.created_at), 'MMM d, yyyy') : '—'}</span>
                                </div>
                            </CardContent>
                            <div className={`absolute inset-0 bg-indigo-500/5 pointer-events-none transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
                        </Card>
                    )
                })}
            </div>
        </>
    )
})
