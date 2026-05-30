"use client"

import React, { useEffect, useRef, useState } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Music, ExternalLink, X } from "lucide-react"
import type { ContentItem } from "@/components/dashboard/ContentClient"
import { isTableauUrl, getTableauViewsUrl, getEmbedUrl } from "@/lib/utils/embed-utils"
import { typeColors } from "@/components/content/ContentGrid"

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

interface ContentPreviewDialogProps {
    item: ContentItem | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export const ContentPreviewDialog = React.memo(function ContentPreviewDialog({ item, open, onOpenChange }: ContentPreviewDialogProps) {
    const [iframeBlocked, setIframeBlocked] = useState(false)

    // Reset iframe blocked state when item changes
    useEffect(() => {
        if (item) setIframeBlocked(false)
    }, [item])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl sm:h-[80vh] flex flex-col p-1 gap-0 bg-slate-950 border-slate-800 text-slate-100 overflow-hidden">
                <div className="p-3 flex justify-between items-center border-b border-slate-800 bg-slate-900 absolute top-0 w-full z-10 shadow-sm opacity-0 hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`capitalize ${item ? typeColors[item.type as keyof typeof typeColors] : ''} border-none bg-indigo-900/50`}>{item?.type}</Badge>
                        <h3 className="font-semibold">{item?.name}</h3>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="h-8 w-8 text-slate-400 hover:text-white">
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                <div className="flex-1 w-full h-full flex items-center justify-center bg-black overflow-hidden relative group">
                    {item?.type === 'image' && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={item.source_url!} alt={item.name} className="max-w-full max-h-full object-contain" />
                    )}
                    {item?.type === 'video' && (
                        <video src={item.source_url!} controls autoPlay className="max-w-full max-h-full w-full outline-none" />
                    )}
                    {item?.type === 'audio' && (
                        <div className="flex flex-col items-center justify-center h-full w-full p-12 text-center bg-gradient-to-tr from-emerald-950 to-slate-950">
                            <div className="h-24 w-24 rounded-full bg-emerald-900/40 flex items-center justify-center mb-6 border-4 border-emerald-800/50 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                                <Music className="h-10 w-10 text-emerald-400" />
                            </div>
                            <h3 className="text-xl font-bold mb-4">{item.name}</h3>
                            <audio src={item.source_url!} controls autoPlay className="w-full max-w-sm" />
                        </div>
                    )}
                    {(['url', 'webpage', 'powerbi', 'dashboard'].includes(item?.type as string)) && item?.source_url && (
                        isTableauUrl(item.source_url) ? (
                            /* Tableau: use official Embedding API v3 — bypasses X-Frame-Options */
                            <div className="w-full h-full relative">
                                <TableauEmbed url={item.source_url} />
                                <div className="absolute bottom-4 right-4 z-30">
                                    <Button
                                        variant="default" size="sm"
                                        onClick={() => window.open(item.source_url!, '_blank')}
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
                                            onClick={() => window.open(item.source_url!, '_blank')}
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
                                            key={item.source_url}
                                            src={getEmbedUrl(item.source_url)}
                                            className="w-full h-full relative z-10 border-0"
                                            title={item.name}
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
                                                onClick={() => window.open(item.source_url!, '_blank')}
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
                    {item?.type === 'html_snippet' && item?.source_url && (
                        <div className="w-full h-full relative bg-white">
                            <iframe srcDoc={item.source_url} className="w-full h-full border-0" title={item.name} />
                        </div>
                    )}

                    <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="absolute top-4 right-4 h-10 w-10 bg-black/50 text-white rounded-full opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity z-50">
                        <X className="h-5 w-5" />
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
})
