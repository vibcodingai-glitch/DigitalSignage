"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { PlaylistItem, Project } from "@/types/display"
import ContentRenderer from "./ContentRenderer"
import { MonitorPlay } from "lucide-react"
import { isPlaylistItemValid } from "@/lib/display-utils"
import { QRCodeOverlay } from "./QRCodeOverlay"

export function ZoneRenderer({ 
    items, 
    project, 
    isMuted, 
    playerKey,
    onItemChange,
    onPowerBIShow,
    onPowerBIHide,
}: { 
    items: PlaylistItem[], 
    project: Project | null, 
    isMuted: boolean, 
    playerKey: number,
    onItemChange?: (index: number, item: PlaylistItem) => void,
    onPowerBIShow?: (url: string) => void,
    onPowerBIHide?: () => void
}) {
    const [currentIndex, setCurrentIndex] = useState(0)
    const [projectKey, setProjectKey] = useState(project?.id || 'none')
    const errorLogQueueRef = useRef<string[]>([])
    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const stuckTimerRef = useRef<NodeJS.Timeout | null>(null)
    const playlistRef = useRef(items)
    
    useEffect(() => {
        if (project?.id && project.id !== projectKey) {
            console.log('[Display] Project changed, resetting index to 0')
            setProjectKey(project.id)
            setCurrentIndex(0)
        }
    }, [project?.id, projectKey])

    useEffect(() => { playlistRef.current = items }, [items])

    const getNextValidIndex = useCallback((startIndex: number, itemsToSearch: PlaylistItem[]) => {
        if (itemsToSearch.length === 0) return -1;
        let next = startIndex;
        let attempts = 0;
        while (attempts < itemsToSearch.length) {
            if (isPlaylistItemValid(itemsToSearch[next])) return next;
            next = (next + 1) % itemsToSearch.length;
            attempts++;
        }
        return -1;
    }, []);

    const advanceToNext = useCallback(() => {
        setCurrentIndex(prev => {
            const loop = project?.settings?.loop !== false
            let next = prev + 1
            if (next >= playlistRef.current.length) {
                if (!loop) return prev;
                next = 0;
            }
            
            const nextValid = getNextValidIndex(next, playlistRef.current)
            if (nextValid === -1) {
                console.log('[Display] No valid items in playlist currently')
                return prev // Fallback or clear display
            }
            return nextValid
        })
    }, [project, getNextValidIndex])

    useEffect(() => {
        if (items.length === 0) return
        let item = items[currentIndex]
        
        // Ensure the current item is actually valid, if not, jump to first valid
        if (item && !isPlaylistItemValid(item)) {
            const validIdx = getNextValidIndex(0, items)
            if (validIdx !== -1 && validIdx !== currentIndex) {
                setCurrentIndex(validIdx)
                return
            } else if (validIdx === -1) {
                // No valid items
                if (timerRef.current) clearTimeout(timerRef.current)
                // Retry in 10s to see if validity changes
                timerRef.current = setTimeout(advanceToNext, 10000)
                return
            }
        }

        if (!item) {
            setCurrentIndex(0)
            return
        }

        console.log(`[Display] Playing item ${currentIndex + 1}: ${item.content_item.name}`)
        if (onItemChange) onItemChange(currentIndex, item)

        const durationMs = (item.duration_override || item.content_item.duration_seconds || 10) * 1000
        const stuckMs = durationMs * 3

        if (timerRef.current) clearTimeout(timerRef.current)
        if (stuckTimerRef.current) clearTimeout(stuckTimerRef.current)

        const isPowerBI = item.content_item.type === 'powerbi' || (
            item.content_item.type === 'url' &&
            item.content_item.source_url?.includes('powerbi.com')
        )
        if (isPowerBI && onPowerBIShow && item.content_item.source_url) {
            console.log('[Display] Triggering PowerBI Relay for:', item.content_item.source_url)
            onPowerBIShow(item.content_item.source_url)
        }

        const isVideo = item.content_item.type === 'video'
        if (!isVideo) {
            if (isPowerBI && onPowerBIHide) {
                timerRef.current = setTimeout(() => {
                    onPowerBIHide()
                    setTimeout(advanceToNext, 300)
                }, Math.max(durationMs - 300, 0))
            } else {
                timerRef.current = setTimeout(advanceToNext, durationMs)
            }
        }

        stuckTimerRef.current = setTimeout(() => {
            console.warn('[Display] Stuck watchdog fired, advancing.')
            advanceToNext()
        }, stuckMs)

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
            if (stuckTimerRef.current) clearTimeout(stuckTimerRef.current)
        }
    }, [currentIndex, items, advanceToNext, onPowerBIShow, onPowerBIHide])

    useEffect(() => {
        if (items.length < 2) return
        const nextIdx = (currentIndex + 1) % items.length
        const next = items[nextIdx]
        if (next?.content_item.type === 'image' && next.content_item.source_url) {
            const img = new Image()
            img.src = next.content_item.source_url
        }
    }, [currentIndex, items])

    const handleContentError = useCallback((itemId: string) => {
        if (errorLogQueueRef.current.includes(itemId)) return
        errorLogQueueRef.current.push(itemId)
        advanceToNext()
    }, [advanceToNext])

    if (items.length === 0) return <div className="w-full h-full bg-black/50 border-gray-800/30" />

    const currentItem = items[currentIndex]

    return (
        <div className="w-full h-full relative overflow-hidden border border-gray-800/30">
            {currentItem && (
                <ContentRenderer
                    key={`${playerKey}-${currentIndex}-${currentItem.id}`}
                    item={currentItem}
                    defaultTransition={project?.settings?.transition_type || 'fade'}
                    onEnded={advanceToNext}
                    onError={handleContentError}
                    isMuted={isMuted}
                />
            )}
            {(currentItem?.content_item.type === 'powerbi' || (currentItem?.content_item.type === 'url' && currentItem?.content_item.source_url?.includes('powerbi.com'))) && (
                <div className="absolute inset-0 bg-gray-950 flex flex-col items-center justify-center z-10">
                    <div className="relative mb-6">
                        <div className="absolute inset-0 rounded-full bg-yellow-400/10 animate-ping" />
                        <div className="h-16 w-16 rounded-2xl bg-yellow-400/5 border border-yellow-400/20 flex items-center justify-center">
                            <MonitorPlay className="h-8 w-8 text-yellow-400/40" />
                        </div>
                    </div>
                    <p className="text-white/60 font-medium text-sm">PowerBI Active on Relay</p>
                    <p className="text-white/20 text-[10px] font-mono mt-1 uppercase tracking-widest">{currentItem.content_item.name}</p>
                </div>
            )}
            
            {currentItem?.show_qr_code && currentItem?.qr_code_url && (
                <QRCodeOverlay url={currentItem.qr_code_url} />
            )}
        </div>
    )
}

export function TickerZoneRenderer({ items, project, playerKey }: { items: PlaylistItem[], project: Project | null, playerKey: number }) {
    if (items.length === 0) return <div className="w-full h-full bg-black/50 border-gray-800/30" />

    const isTextLike = items[0].content_item.type === 'html_snippet'

    if (isTextLike) {
        const rawHtml = (items[0].content_item.metadata?.raw_html as string) || items[0].content_item.source_url || ''
        return (
            <div className="w-full h-full border border-gray-800/30 bg-black text-white flex items-center overflow-hidden">
                <style>{`
                    @keyframes scroll {
                        0% { transform: translateX(100vw); }
                        100% { transform: translateX(-100%); }
                    }
                    .animate-ticker {
                        display: inline-block;
                        white-space: nowrap;
                        animation: scroll 20s linear infinite;
                    }
                `}</style>
                <div className="animate-ticker" dangerouslySetInnerHTML={{ __html: rawHtml }} />
            </div>
        )
    }

    return <ZoneRenderer items={items} project={project} isMuted={true} playerKey={playerKey} />
}
