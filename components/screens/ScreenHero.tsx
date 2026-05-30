"use client"

import React from "react"
import { formatDistanceToNow } from "date-fns"
import { LiveScreenPreview } from "@/components/LiveScreenPreview"
import { NowPlayingBadge } from "@/components/NowPlayingBadge"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RefreshCw, Save, Edit2 } from "lucide-react"

interface ScreenHeroProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    screen: any
    isOnline: boolean
    effectiveStatus: string
    effectiveHeartbeat: string | null
    isEditingName: boolean
    editNameValue: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    liveCurrentState: any
    onEditName: () => void
    onSaveName: () => void
    onEditNameValueChange: (value: string) => void
    onForceSync: () => void
}

export const ScreenHero = React.memo(function ScreenHero({
    screen,
    isOnline,
    effectiveStatus,
    effectiveHeartbeat,
    isEditingName,
    editNameValue,
    liveCurrentState,
    onEditName,
    onSaveName,
    onEditNameValueChange,
    onForceSync,
}: ScreenHeroProps) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* LEFT COLUMN: 60% Width */}
            <div className="lg:col-span-3">
                <LiveScreenPreview
                    displayKey={screen.display_key}
                    screenName={screen.name}
                    orientation="landscape"
                    isOnline={isOnline}
                />
            </div>

            {/* RIGHT COLUMN: 40% Width */}
            <div className="lg:col-span-2 space-y-6">
                <Card className="border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden h-full flex flex-col">
                    <div className={`absolute top-0 left-0 w-1.5 h-full transition-colors duration-1000 ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex flex-col mb-1">
                            <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1">Screen Details</span>
                            {isEditingName ? (
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={editNameValue}
                                        onChange={(e) => onEditNameValueChange(e.target.value)}
                                        className="h-8 md:text-xl font-bold max-w-xs"
                                        autoFocus
                                    />
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600" onClick={onSaveName}>
                                        <Save className="h-4 w-4" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 group cursor-pointer" onClick={onEditName}>
                                    <h1 className="text-2xl font-bold tracking-tight">{screen.name}</h1>
                                    <Edit2 className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            )}
                        </div>
                    </CardHeader>
                    
                    <CardContent className="flex-1 p-6 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <span className="text-[10px] uppercase font-bold text-slate-400">Status</span>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <div className={`h-2 w-2 rounded-full mr-2 ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                                        <span className={`text-sm font-medium ${isOnline ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                                            {effectiveStatus.toUpperCase()}
                                        </span>
                                    </div>
                                    {isOnline && (
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="h-7 px-2 text-[10px] text-indigo-600 border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40" 
                                            onClick={onForceSync}
                                        >
                                            <RefreshCw className="h-3 w-3 mr-1" /> Sync Hardware
                                        </Button>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] uppercase font-bold text-slate-400">Last Seen</span>
                                <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    {effectiveHeartbeat ? formatDistanceToNow(new Date(effectiveHeartbeat), { addSuffix: true }) : 'Never'}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] uppercase font-bold text-slate-400">Location</span>
                                <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    {screen.location?.name || 'Unassigned'}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] uppercase font-bold text-slate-400">Format</span>
                                <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    1920×1080 (Landscape)
                                </div>
                            </div>
                        </div>
                        
                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-3">Currently Playing</span>
                            <NowPlayingBadge
                                projectName={liveCurrentState?.project_name || screen.project?.name || null}
                                contentName={liveCurrentState?.content_name || null}
                                isPlaying={liveCurrentState?.is_playing ?? false}
                            />
                            {liveCurrentState && liveCurrentState.total_playlist_items > 0 && (
                                <p className="text-[10px] text-slate-500 mt-2 font-mono ml-2">
                                    Item {liveCurrentState.playlist_position} of {liveCurrentState.total_playlist_items}
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
})
