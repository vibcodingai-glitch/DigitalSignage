"use client"

import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { MonitorPlay, WifiOff, AlertTriangle, ExternalLink } from "lucide-react"
import { resolveActiveProject } from "@/lib/screen-projects"
import { usePowerBIRelay } from "@/hooks/use-powerbi-relay"

import { Screen, Project, PlaylistItem, PushOverlay, ConnectionStatus } from "@/types/display"
import { ZoneRenderer, TickerZoneRenderer } from "@/components/display/ZoneRenderer"
import ContentRenderer from "@/components/display/ContentRenderer"
import { getProxiedUrl, loadFromCache, saveToCache } from "@/lib/display-utils"

// ==============================================================
// MAIN PAGE COMPONENT
// ==============================================================
export default function ScreenDisplayPage({ params }: { params: { screenId: string } }) {
    const supabase = createClient()

    // --- Core State ---
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [screen, setScreen] = useState<Screen | null>(null)
    const [project, setProject] = useState<Project | null>(null)
    const [playlist, setPlaylist] = useState<PlaylistItem[]>([])
    const [loadState, setLoadState] = useState<'booting' | 'loaded' | 'error' | 'no_project'>('booting')
    const [isOffline, setIsOffline] = useState(false)
    const [connStatus, setConnStatus] = useState<ConnectionStatus>('connecting')

    // --- Player State ---
    const [playerKey, setPlayerKey] = useState(0) // Bumped to force re-mount on playlist reload

    // --- UI State ---
    const [hideCursor, setHideCursor] = useState(false)
    const [showHint, setShowHint] = useState(true)
    const [pushOverlay, setPushOverlay] = useState<PushOverlay | null>(null)
    const [isMuted, setIsMuted] = useState(true)
    const [livePlayState, setLivePlayState] = useState<{ index: number, item: PlaylistItem | null }>({ index: 0, item: null })
    const [showRelayTrigger, setShowRelayTrigger] = useState(false)

    // --- PowerBI Relay ---
    const relay = usePowerBIRelay()

    // --- Uptime tracking ---
    const bootTimeRef = useRef<number>(Date.now())
    const playStateRef = useRef(livePlayState)
    
    useEffect(() => { playStateRef.current = livePlayState }, [livePlayState])

    // --- Refs ---
    const cursorTimerRef = useRef<NodeJS.Timeout | null>(null)
    const wakeLockRef = useRef<unknown>(null)
    const screenRef = useRef<Screen | null>(null)
    const projectRef = useRef<Project | null>(null)
    const playlistRef = useRef<PlaylistItem[]>([])

    // Keep refs in sync
    screenRef.current = screen
    projectRef.current = project
    playlistRef.current = playlist

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`)
            })
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen()
            }
        }
    }

    // ==============================================================
    // WAKE LOCK
    // ==============================================================
    const requestWakeLock = useCallback(async () => {
        if (typeof window === 'undefined' || !('wakeLock' in navigator)) return;
        
        // If we already have an active lock, don't request another one
        if (wakeLockRef.current) return;

        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const lock = await (navigator as any).wakeLock.request('screen');
            
            // Handle the lock being released by the system
            lock.addEventListener('release', () => {
                wakeLockRef.current = null;
            });

            wakeLockRef.current = lock;
        } catch (err: any) {
            // Ignore AbortError as it's often caused by double-requests in dev mode
            if (err.name !== 'AbortError') {
                console.warn('[Display] WakeLock failed:', err.message);
            }
            wakeLockRef.current = null;
        }
    }, [])

    // ==============================================================
    // DATA LOADING
    // Uses server-side API route so RLS never blocks unauthenticated
    // display clients (kiosk hardware, Safari, non-logged-in browsers).
    // ==============================================================
    const loadSequence = useCallback(async (displayKey: string, silent = false, keepIndex = false) => {
        if (!silent) setLoadState('booting')

        try {
            const res = await fetch(`/api/display/${displayKey}`)

            if (!res.ok) {
                // Try local cache on network/server error
                const cached = loadFromCache(displayKey)
                if (cached) {
                    setScreen(cached.screen)
                    setProject(cached.project)
                    setPlaylist(cached.playlist)
                    setIsOffline(true)
                    setLoadState(cached.playlist?.length > 0 ? 'loaded' : 'no_project')
                    setPlayerKey(k => k + 1)
                    return
                }
                setLoadState(res.status === 404 ? 'error' : 'no_project')
                return
            }

            const { screen: screenData, project: projData, playlist: items } = await res.json()

            setIsOffline(false)
            setScreen(screenData as Screen)

            if (!projData) {
                setProject(null)
                setPlaylist([])
                setLoadState('no_project')
                saveToCache(displayKey, { screen: screenData as Screen, project: null!, playlist: [] })
                return
            }

            setProject(projData as Project)
            setPlaylist(items as PlaylistItem[])

            if (!keepIndex) {
                setPlayerKey(k => k + 1)
            }
            setLoadState(items.length > 0 ? 'loaded' : 'no_project')
            saveToCache(displayKey, { screen: screenData as Screen, project: projData as Project, playlist: items as PlaylistItem[] })

        } catch (err) {
            console.error('[Display] Load fault:', err)
            const cached = loadFromCache(displayKey)
            if (cached) {
                setScreen(cached.screen)
                setProject(cached.project)
                setPlaylist(cached.playlist)
                setIsOffline(true)
                setLoadState(cached.playlist?.length > 0 ? 'loaded' : 'no_project')
                setPlayerKey(k => k + 1)
            } else {
                setLoadState('error')
            }
        }
    // fetch is stable, no supabase dependency needed here
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ==============================================================
    // BOOT & KIOSK AUTO-RECOVERY
    // ==============================================================
    useEffect(() => {
        loadSequence(params.screenId)
        requestWakeLock()

        // Phase 7: Kiosk auto-open for PowerBI relay
        const urlParams = new URLSearchParams(window.location.search)
        if (urlParams.get('kiosk') === 'true') {
            console.log('[Kiosk] Auto-opening PowerBI relay on boot')
            relay.openRelay()
            setShowRelayTrigger(false)
        }

        // Re-acquire wake lock on visibility change
        const onVisChange = () => {
            if (document.visibilityState === 'visible') requestWakeLock()
        }
        document.addEventListener('visibilitychange', onVisChange)

        // Hide "Hardware Mode" hint
        const hintT = setTimeout(() => setShowHint(false), 5000)

        // Auto-recovery at 3:00 AM
        const scheduleDailyReload = () => {
            const now = new Date()
            const tomorrow3am = new Date()
            tomorrow3am.setHours(3, 0, 0, 0)
            if (tomorrow3am <= now) tomorrow3am.setDate(tomorrow3am.getDate() + 1)
            const msUntil = tomorrow3am.getTime() - now.getTime()
            return setTimeout(() => window.location.reload(), msUntil)
        }
        const reloadTimer = scheduleDailyReload()

        return () => {
            clearTimeout(hintT)
            clearTimeout(reloadTimer)
            document.removeEventListener('visibilitychange', onVisChange)
        }
    }, [params.screenId, loadSequence, requestWakeLock])

    // ==============================================================
    // CURSOR HIDING
    // ==============================================================
    useEffect(() => {
        const reset = () => {
            setHideCursor(false)
            if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current)
            cursorTimerRef.current = setTimeout(() => setHideCursor(true), 3000)
        }
        window.addEventListener('mousemove', reset)
        reset()
        return () => {
            window.removeEventListener('mousemove', reset)
            if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current)
        }
    }, [])

    // ==============================================================
    // HEARTBEAT — uses server-side API so any browser can report status
    // ==============================================================
    useEffect(() => {
        if (!screen) return

        const beat = async (statusVal?: string) => {
            try {
                const currentItem = playStateRef.current.item
                const uptimeSeconds = Math.floor((Date.now() - bootTimeRef.current) / 1000)

                const currentState = {
                    project_id: projectRef.current?.id ?? null,
                    project_name: projectRef.current?.name ?? null,
                    content_item_id: currentItem?.content_item?.id ?? null,
                    content_name: currentItem?.content_item?.name ?? null,
                    is_playing: playlistRef.current.length > 0,
                    playlist_position: playStateRef.current.index + 1,
                    total_playlist_items: playlistRef.current.length,
                    uptime_seconds: uptimeSeconds,
                }

                await fetch('/api/display/heartbeat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        display_key: params.screenId,
                        status: statusVal || 'online',
                        current_state: currentState,
                    }),
                })
            } catch { /* non-critical */ }
        }

        beat('online')
        const iv = setInterval(() => beat(), 30_000)

        const onUnload = () => beat('offline')
        window.addEventListener('beforeunload', onUnload)

        return () => {
            clearInterval(iv)
            window.removeEventListener('beforeunload', onUnload)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [screen, params.screenId])

    // ==============================================================
    // SCHEDULE EVALUATION — runs every 60s
    // Re-fetches from the server-side API and switches project if changed.
    // ==============================================================
    useEffect(() => {
        if (!screen) return

        const evaluateSchedules = async () => {
            try {
                const res = await fetch(`/api/display/${params.screenId}`)
                if (!res.ok) return
                const { project: resolvedProject } = await res.json()
                const winningProjectId = resolvedProject?.id ?? null
                const currentProjectId = projectRef.current?.id || screenRef.current?.active_project_id

                if (winningProjectId && winningProjectId !== currentProjectId) {
                    console.log(`[Schedule] Switching to project ${winningProjectId} (was ${currentProjectId})`)
                    loadSequence(params.screenId, true, false)
                }
            } catch (err) {
                console.warn('[Schedule] Evaluation error:', err)
            }
        }

        // Run immediately on mount, then every 60s
        evaluateSchedules()
        const scheduleIv = setInterval(evaluateSchedules, 60_000)

        return () => clearInterval(scheduleIv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [screen, params.screenId, loadSequence])

    // ==============================================================
    // REALTIME SUBSCRIPTIONS
    // ==============================================================
    useEffect(() => {
        if (!screen) return
        // Realtime subscriptions
        let reconnectDelay = 1000
        let reconnectTimer: NodeJS.Timeout | null = null

        const setupChannel = () => {
            const channel = supabase.channel(`display-${screen.id}`)

            // Screen changes
            channel.on('postgres_changes', {
                event: 'UPDATE', schema: 'public', table: 'screens', filter: `id=eq.${screen.id}`
            }, (payload) => {
                if (payload.new.active_project_id !== screenRef.current?.active_project_id) {
                    loadSequence(params.screenId, true, false) // New project — restart from 0
                }
            })

            // Playlist mutations — keep current position
            if (project) {
                channel.on('postgres_changes', {
                    event: '*', schema: 'public', table: 'playlist_items', filter: `project_id=eq.${project.id}`
                }, () => {
                    loadSequence(params.screenId, true, true) // Smart refresh keeps index
                })
            }

            // screen_projects changes — re-evaluate active project immediately
            channel.on('postgres_changes', {
                event: '*', schema: 'public', table: 'screen_projects', filter: `screen_id=eq.${screen.id}`
            }, () => {
                console.log('[Display] screen_projects changed — re-evaluating active project')
                loadSequence(params.screenId, true, false)
            })

            // Push events — check expires_at before acting
            channel.on('postgres_changes', {
                event: 'INSERT', schema: 'public', table: 'push_events', filter: `screen_id=eq.${screen.id}`
            }, (payload) => {
                const ev = payload.new
                // Ignore expired events (e.g. device was offline, came back to stale queue)
                if (ev.expires_at && new Date(ev.expires_at) < new Date()) {
                    console.log('[Display] Ignoring expired push event:', ev.id)
                    return
                }

                const pld = ev.payload || {}
                switch (ev.event_type) {
                    case 'reload': window.location.reload(); break
                    case 'show_alert':
                        setPushOverlay({ type: 'alert', message: pld.message || 'Alert from admin', duration: pld.duration || 8 })
                        setTimeout(() => setPushOverlay(null), (pld.duration || 8) * 1000)
                        break
                    case 'play_sound':
                        setPushOverlay({ type: 'sound' })
                        if (pld.url) {
                            const audio = new Audio(pld.url)
                            audio.play().catch(() => { })
                            audio.onended = () => setPushOverlay(null)
                        }
                        break
                    case 'override_content':
                        if (pld.content_item && (pld.content_item.source_url || pld.content_item.file_path)) {
                            setPushOverlay({ type: 'override', content_item: pld.content_item, duration: pld.duration || 30 })
                            setTimeout(() => setPushOverlay(null), (pld.duration || 30) * 1000)
                        }
                        break
                }
            })

            channel.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    setConnStatus('connected')
                    reconnectDelay = 1000 // Reset backoff on success
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    setConnStatus('disconnected')
                    // Exponential backoff reconnect
                    if (reconnectTimer) clearTimeout(reconnectTimer)
                    reconnectTimer = setTimeout(() => {
                        reconnectDelay = Math.min(reconnectDelay * 2, 30000)
                        supabase.removeChannel(channel)
                        setupChannel()
                    }, reconnectDelay)
                }
            })

            return channel
        }

        const activeChannel = setupChannel()
        setConnStatus('connecting')

        return () => {
            if (reconnectTimer) clearTimeout(reconnectTimer)
            supabase.removeChannel(activeChannel)
        }
    }, [screen, project, params.screenId, loadSequence, supabase])

    // ==============================================================
    // PUSH EVENT POLLING (reliable fallback for broken Realtime)
    // ==============================================================
    const processedPushIdsRef = useRef<Set<string>>(new Set())
    
    const processPushEvent = useCallback((ev: any) => {
        if (processedPushIdsRef.current.has(ev.id)) return
        processedPushIdsRef.current.add(ev.id)
        
        // Keep set from growing forever
        if (processedPushIdsRef.current.size > 100) {
            const arr = Array.from(processedPushIdsRef.current)
            processedPushIdsRef.current = new Set(arr.slice(-50))
        }

        // Ignore expired events
        if (ev.expires_at && new Date(ev.expires_at) < new Date()) return

        const pld = ev.payload || {}
        console.log('[Display] Processing push event:', ev.event_type, ev.id)

        switch (ev.event_type) {
            case 'reload': window.location.reload(); break
            case 'show_alert':
                setPushOverlay({ type: 'alert', message: pld.message || 'Alert from admin', duration: pld.duration || 8 })
                setTimeout(() => setPushOverlay(null), (pld.duration || 8) * 1000)
                break
            case 'play_sound':
                setPushOverlay({ type: 'sound' })
                if (pld.url) {
                    const audio = new Audio(pld.url)
                    audio.play().catch(() => { })
                    audio.onended = () => setPushOverlay(null)
                }
                break
            case 'override_content':
                if (pld.content_item && (pld.content_item.source_url || pld.content_item.file_path)) {
                    setPushOverlay({ type: 'override', content_item: pld.content_item, duration: pld.duration || 30 })
                    setTimeout(() => setPushOverlay(null), (pld.duration || 30) * 1000)
                } else {
                    console.warn('[Display] Override content_item missing source_url/file_path, skipping')
                }
                break
        }
    }, [])

    useEffect(() => {
        if (!screen) return
        const displayKey = params.screenId

        const pollPushEvents = async () => {
            try {
                const res = await fetch(`/api/display/${displayKey}/push-events`)
                if (!res.ok) return
                const { events } = await res.json()
                if (events && events.length > 0) {
                    // Process newest first (they come sorted by created_at desc)
                    for (const ev of events) {
                        processPushEvent(ev)
                    }
                }
            } catch {
                // Silent fail — display should never crash from polling
            }
        }

        // Poll every 3 seconds
        const interval = setInterval(pollPushEvents, 3000)
        // Also poll once immediately
        pollPushEvents()

        return () => clearInterval(interval)
    }, [screen, params.screenId, processPushEvent])


    // ==============================================================
    // DERIVED STATE — must be before any early returns (Rules of Hooks)
    // ==============================================================
    const itemsByZone = useMemo(() => {
        return playlist.reduce((acc, item) => {
            if (!acc[item.zone_index]) acc[item.zone_index] = []
            acc[item.zone_index].push(item)
            return acc
        }, {} as Record<number, PlaylistItem[]>)
    }, [playlist])

    const layoutType = project?.layout_type || 'fullscreen'

    // ==============================================================
    // RENDER STATES
    // ==============================================================
    if (loadState === 'error') {
        return (
            <div className={`w-screen h-screen bg-black flex items-center justify-center ${hideCursor ? 'cursor-none' : ''}`}>
                <div className="flex flex-col items-center text-center px-8">
                    <div className="h-16 w-16 rounded-full bg-red-900/30 border border-red-800 flex items-center justify-center mb-6">
                        <AlertTriangle className="h-8 w-8 text-red-500" />
                    </div>
                    <h1 className="text-white font-bold text-xl mb-2">Endpoint Not Found</h1>
                    <p className="text-slate-500 text-sm font-mono">This display key is not registered in the network.</p>
                    <code className="text-slate-700 text-xs mt-4 bg-slate-900 px-3 py-1.5 rounded">{params.screenId}</code>
                </div>
            </div>
        )
    }

    if (loadState === 'booting') {
        return (
            <div className={`w-screen h-screen bg-black flex items-center justify-center ${hideCursor ? 'cursor-none' : ''}`}>
                <div className="flex flex-col items-center gap-6 animate-in fade-in duration-1000">
                    <div className="relative">
                        <div className="h-16 w-16 rounded-full border-2 border-indigo-500/30 animate-spin" style={{ borderTopColor: 'rgb(99,102,241)' }} />
                        <MonitorPlay className="h-6 w-6 text-indigo-400 absolute inset-0 m-auto" />
                    </div>
                    <p className="text-slate-600 text-xs font-mono uppercase tracking-widest">Initializing Display Node...</p>
                </div>

                {/* Push overlay — must render even during boot */}
                {pushOverlay?.type === 'alert' && (
                    <div className="absolute inset-x-0 top-0 z-50 flex items-start justify-center p-6 animate-in slide-in-from-top-4 duration-500">
                        <div className="bg-amber-500 text-black font-bold text-lg px-8 py-4 rounded-xl shadow-2xl max-w-2xl text-center">
                            {pushOverlay.message}
                        </div>
                    </div>
                )}
                {pushOverlay?.type === 'override' && pushOverlay.content_item && (
                    <div className="absolute inset-0 z-[60] bg-black animate-in fade-in duration-500">
                        <ContentRenderer 
                            item={{ id: 'push', content_item: pushOverlay.content_item, project_id: '', order_index: 0, zone_index: 0 } as any}
                            defaultTransition="none" isMuted={isMuted} onEnded={() => {}} onError={() => {}} 
                        />
                    </div>
                )}
            </div>
        )
    }

    if (loadState === 'no_project') {
        return (
            <div className={`w-screen h-screen bg-black flex flex-col items-center justify-center overflow-hidden ${hideCursor ? 'cursor-none' : ''}`}>
                {/* Ambient gradient */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(79,70,229,0.08)_0%,transparent_70%)]" />

                {/* Floating particles */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {[...Array(12)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute rounded-full bg-indigo-500/10"
                            style={{
                                width: `${8 + (i % 4) * 12}px`,
                                height: `${8 + (i % 4) * 12}px`,
                                left: `${(i * 17 + 5) % 95}%`,
                                top: `${(i * 23 + 10) % 90}%`,
                                animation: `pulse ${2 + (i % 3)}s ease-in-out infinite`,
                                animationDelay: `${i * 0.3}s`
                            }}
                        />
                    ))}
                </div>

                <div className="z-10 flex flex-col items-center animate-in fade-in duration-2000">
                    <div className="relative mb-8">
                        <div className="h-24 w-24 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center backdrop-blur-sm">
                            <MonitorPlay className="h-10 w-10 text-indigo-400" />
                        </div>
                        <div className="absolute -inset-1 rounded-2xl bg-indigo-500/5 blur-xl animate-pulse" />
                    </div>

                    <h1 className="text-2xl font-light text-white/80 tracking-widest uppercase mb-3">
                        {screen?.name || 'Display Node'}
                    </h1>
                    <div className="flex items-center gap-2 text-slate-500">
                        <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                        <p className="text-xs font-mono uppercase tracking-wider">Awaiting Timeline Assignment...</p>
                    </div>
                </div>

                <div className="absolute bottom-6 right-6 text-[10px] text-slate-700 font-mono text-right space-y-1">
                    <p>{new Date().toLocaleDateString()} · SignageHub</p>
                    <p>Node: {screen?.display_key?.slice(0, 8)}</p>
                </div>

                {/* Push overlay — must render even with no project */}
                {pushOverlay?.type === 'alert' && (
                    <div className="absolute inset-x-0 top-0 z-50 flex items-start justify-center p-6 animate-in slide-in-from-top-4 duration-500">
                        <div className="bg-amber-500 text-black font-bold text-lg px-8 py-4 rounded-xl shadow-2xl max-w-2xl text-center">
                            {pushOverlay.message}
                        </div>
                    </div>
                )}
                {pushOverlay?.type === 'override' && pushOverlay.content_item && (
                    <div className="absolute inset-0 z-[60] bg-black animate-in fade-in duration-500">
                        <ContentRenderer 
                            item={{ id: 'push', content_item: pushOverlay.content_item, project_id: '', order_index: 0, zone_index: 0 } as any}
                            defaultTransition="none" isMuted={isMuted} onEnded={() => {}} onError={() => {}} 
                        />
                    </div>
                )}
                {pushOverlay?.type === 'sound' && (
                    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-50 animate-in fade-in duration-500">
                        <div className="bg-black/70 backdrop-blur-md border border-white/10 text-white/60 text-xs font-mono px-4 py-2 rounded-full flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> Audio Push Received
                        </div>
                    </div>
                )}

                {/* Connection dot */}
                <ConnectionDot status={connStatus} isOffline={isOffline} />
            </div>
        )
    }

    // ==============================================================
    // ACTIVE PLAYBACK
    // ==============================================================

    const renderLayout = () => {
        if (playlist.length === 0) {
            return (
                <div className="w-full h-full flex items-center justify-center">
                    <p className="text-slate-700 font-mono text-sm">Playlist is empty.</p>
                </div>
            )
        }

        switch (layoutType) {
            case 'split_horizontal':
                return (
                    <div className="grid grid-rows-2 w-full h-full gap-1">
                        {/* Zone 0 only gets relay — side zones must not cover the full screen */}
                        <ZoneRenderer items={itemsByZone[0] || []} project={project} isMuted={isMuted} playerKey={playerKey} onPowerBIShow={relay.showURL} onPowerBIHide={relay.hide} />
                        <ZoneRenderer items={itemsByZone[1] || []} project={project} isMuted={isMuted} playerKey={playerKey} />
                    </div>
                )
            case 'split_vertical':
                return (
                    <div className="grid grid-cols-2 w-full h-full gap-1">
                        <ZoneRenderer items={itemsByZone[0] || []} project={project} isMuted={isMuted} playerKey={playerKey} onPowerBIShow={relay.showURL} onPowerBIHide={relay.hide} />
                        <ZoneRenderer items={itemsByZone[1] || []} project={project} isMuted={isMuted} playerKey={playerKey} />
                    </div>
                )
            case 'l_shape':
                return (
                    <div className="grid grid-cols-[70%_30%] grid-rows-2 w-full h-full gap-1">
                        <div className="row-span-2">
                            <ZoneRenderer items={itemsByZone[0] || []} project={project} isMuted={isMuted} playerKey={playerKey} onPowerBIShow={relay.showURL} onPowerBIHide={relay.hide} />
                        </div>
                        <ZoneRenderer items={itemsByZone[1] || []} project={project} isMuted={isMuted} playerKey={playerKey} />
                        <ZoneRenderer items={itemsByZone[2] || []} project={project} isMuted={isMuted} playerKey={playerKey} />
                    </div>
                )
            case 'grid_2x2':
                return (
                    <div className="grid grid-cols-2 grid-rows-2 w-full h-full gap-1">
                        <ZoneRenderer items={itemsByZone[0] || []} project={project} isMuted={isMuted} playerKey={playerKey} onPowerBIShow={relay.showURL} onPowerBIHide={relay.hide} />
                        <ZoneRenderer items={itemsByZone[1] || []} project={project} isMuted={isMuted} playerKey={playerKey} />
                        <ZoneRenderer items={itemsByZone[2] || []} project={project} isMuted={isMuted} playerKey={playerKey} />
                        <ZoneRenderer items={itemsByZone[3] || []} project={project} isMuted={isMuted} playerKey={playerKey} />
                    </div>
                )
            case 'main_ticker':
                return (
                    <div className="grid grid-rows-[90%_10%] w-full h-full gap-1">
                        <ZoneRenderer items={itemsByZone[0] || []} project={project} isMuted={isMuted} playerKey={playerKey} onPowerBIShow={relay.showURL} onPowerBIHide={relay.hide} />
                        <TickerZoneRenderer items={itemsByZone[1] || []} project={project} playerKey={playerKey} />
                    </div>
                )
            case 'fullscreen':
            default:
                return (
                    <div className="w-full h-full">
                        <ZoneRenderer 
                            items={itemsByZone[0] || []} 
                            project={project} 
                            isMuted={isMuted} 
                            playerKey={playerKey} 
                            onItemChange={(index, item) => {
                                setLivePlayState({ index, item })
                                // If it's a PowerBI item, make sure we prompt to enable relay if not already open
                                if (item.content_item.type === 'powerbi' || (item.content_item.type === 'url' && item.content_item.source_url?.includes('powerbi.com'))) {
                                    setShowRelayTrigger(true)
                                }
                            }}
                            onPowerBIShow={relay.showURL}
                            onPowerBIHide={relay.hide}
                        />
                    </div>
                )
        }
    }

    return (
        <div className={`w-screen h-screen bg-black overflow-hidden relative ${hideCursor ? 'cursor-none' : ''}`}>

            {/* Hardware mode OSD hint */}
            <div className={`absolute top-5 left-1/2 -translate-x-1/2 z-50 transition-all duration-1000 ${showHint ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
                <div className="bg-black/60 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full text-white/50 text-xs font-mono uppercase tracking-widest flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Hardware Display Mode · F11 for Fullscreen
                </div>
            </div>

            {/* Fullscreen Button — appears on mouse move */}
            <button 
                onClick={toggleFullscreen}
                className={`fixed bottom-6 right-6 z-[100] p-3 rounded-full bg-slate-900/80 text-white backdrop-blur-md border border-white/20 transition-opacity duration-300 ${hideCursor ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                title="Toggle Fullscreen"
            >
                <MonitorPlay className="h-6 w-6" />
            </button>

            {/* PowerBI Relay Trigger — Browser security requires a user gesture to open a window */}
            {showRelayTrigger && (
                <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-500">
                    <div className="bg-[#111827] border border-yellow-400/20 p-8 rounded-3xl max-w-md w-full text-center shadow-2xl">
                        <div className="h-20 w-20 rounded-2xl bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center mx-auto mb-6">
                            <ExternalLink className="h-10 w-10 text-yellow-400" />
                        </div>
                        <h2 className="text-white text-2xl font-bold mb-2">PowerBI Ready</h2>
                        <p className="text-slate-400 text-sm mb-8">
                            This project contains PowerBI content. Click below to enable the display relay. This only needs to be done once.
                        </p>
                        <button
                            onClick={() => {
                                relay.openRelay()
                                setShowRelayTrigger(false)
                            }}
                            className="w-full py-4 bg-yellow-400 hover:bg-yellow-300 text-black font-bold rounded-2xl transition-all shadow-lg shadow-yellow-400/20 flex items-center justify-center gap-2"
                        >
                            Enable PowerBI Display
                        </button>
                    </div>
                </div>
            )}

            {/* MAIN CONTENT LAYER */}
            {renderLayout()}

            {/* PUSH EVENT — Alert Banner */}
            {pushOverlay?.type === 'alert' && (
                <div className="absolute inset-x-0 top-0 z-50 flex items-start justify-center p-6 animate-in slide-in-from-top-4 duration-500">
                    <div className="bg-amber-500 text-black font-bold text-lg px-8 py-4 rounded-xl shadow-2xl max-w-2xl text-center">
                        {pushOverlay.message}
                    </div>
                </div>
            )}

            {/* PUSH EVENT — Override Content */}
            {pushOverlay?.type === 'override' && pushOverlay.content_item && (
                <div className="absolute inset-0 z-[60] bg-black animate-in fade-in duration-500">
                    <ContentRenderer 
                        item={{ 
                            id: 'push', 
                            content_item: pushOverlay.content_item,
                            project_id: '',
                            order_index: 0,
                            zone_index: 0
                        } as any} 
                        project={project || { id: 'push' } as any} 
                        defaultTransition="none"
                        isMuted={isMuted} 
                        onEnded={() => {}} 
                        onError={() => {}} 
                    />
                </div>
            )}

            {/* PUSH EVENT — Sound playing indicator */}
            {pushOverlay?.type === 'sound' && (
                <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-50 animate-in fade-in duration-500">
                    <div className="bg-black/70 backdrop-blur-md border border-white/10 text-white/60 text-xs font-mono px-4 py-2 rounded-full flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> Audio Push Received
                    </div>
                </div>
            )}

            {/* Offline banner */}
            {isOffline && (
                <div className="absolute top-3 left-3 z-50">
                    <div className="bg-black/70 backdrop-blur-md border border-amber-700/40 text-amber-400 text-[10px] font-mono px-3 py-1 rounded-full flex items-center gap-1.5">
                        <WifiOff className="h-3 w-3" /> Offline Cache
                    </div>
                </div>
            )}

            {/* Mute toggle (hidden, activate via keyboard M key) */}
            <MuteKeyboardListener isMuted={isMuted} onToggle={() => setIsMuted(m => !m)} />

            {/* Connection indicator */}
            <ConnectionDot status={connStatus} isOffline={isOffline} />
        </div>
    )
}

// ==============================================================
// CONNECTION STATUS DOT
// ==============================================================
function ConnectionDot({ status, isOffline }: { status: ConnectionStatus; isOffline: boolean }) {
    const color =
        isOffline ? 'bg-amber-400' :
            status === 'connected' ? 'bg-emerald-400' :
                status === 'connecting' ? 'bg-yellow-400 animate-pulse' :
                    'bg-red-500 animate-pulse'

    const label =
        isOffline ? 'Offline Cache' :
            status === 'connected' ? 'Live' :
                status === 'connecting' ? 'Connecting' :
                    'Disconnected'

    return (
        <div className="absolute bottom-4 right-4 z-50 group/dot flex items-center gap-2">
            <span className="text-[9px] font-mono text-slate-700 uppercase tracking-widest opacity-0 group-hover/dot:opacity-100 transition-opacity">
                {label}
            </span>
            <div className={`h-2 w-2 rounded-full ${color} opacity-40 group-hover/dot:opacity-100 transition-opacity`} />
        </div>
    )
}

// ==============================================================
// KEYBOARD LISTENER (M = toggle mute, F = fullscreen)
// ==============================================================
function MuteKeyboardListener({ isMuted, onToggle }: { isMuted: boolean; onToggle: () => void }) {
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'm' || e.key === 'M') onToggle()
            if (e.key === 'F' || e.key === 'f') {
                if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => { })
                else document.exitFullscreen().catch(() => { })
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [isMuted, onToggle])

    return null
}
