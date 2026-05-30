"use client"

import React from "react"
import { format } from "date-fns"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TabsContent } from "@/components/ui/tabs"
import { AlertCircle, Activity } from "lucide-react"

interface PushCommandsTabProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    screen: any
    isOnline: boolean
    pushMessage: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pushEvents: any[]
    onPushMessageChange: (value: string) => void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSendPushEvent: (type: string, payload?: any) => void
}

export const PushCommandsTab = React.memo(function PushCommandsTab({
    screen,
    isOnline,
    pushMessage,
    pushEvents,
    onPushMessageChange,
    onSendPushEvent,
}: PushCommandsTabProps) {
    return (
        <TabsContent value="push" className="m-0 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                    <CardHeader>
                        <CardTitle>Instant Push Commands</CardTitle>
                        <CardDescription>Inject high-priority ephemeral states directly across the socket connection immediately into runtime logic.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/10 p-4 rounded-lg">
                            <Label className="text-amber-800 dark:text-amber-500 font-bold mb-2 flex items-center"><AlertCircle className="h-4 w-4 mr-2" /> Fire Text Alert</Label>
                            <div className="flex gap-2 mt-3">
                                <Input
                                    placeholder="ATTN: Store closing in 15 mins..."
                                    value={pushMessage}
                                    onChange={e => onPushMessageChange(e.target.value)}
                                />
                                <Button
                                    className="bg-amber-600 hover:bg-amber-700"
                                    disabled={!isOnline || !pushMessage}
                                    onClick={() => onSendPushEvent('alert', { text: pushMessage, duration: 30000 })}
                                >
                                    Dispatch
                                </Button>
                            </div>
                        </div>

                        <div className="border border-slate-200 dark:border-slate-800 p-4 rounded-lg flex justify-between items-center">
                            <div>
                                <Label className="font-bold flex items-center mb-1"><Activity className="h-4 w-4 mr-2" /> Force Global Reload</Label>
                                <p className="text-xs text-slate-500">Purge cache and instantly trigger a cold boot browser refresh sequence entirely.</p>
                            </div>
                            <Button variant="outline" disabled={!isOnline} onClick={() => onSendPushEvent('reload')}>
                                Force Refresh
                            </Button>
                        </div>

                        {!isOnline && (
                            <p className="text-sm text-red-500 font-medium pb-2 text-center animate-pulse">Endpoint is currently OFFLINE - Sockets unavailable.</p>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                    <CardHeader>
                        <CardTitle>Push Architecture Execution Log</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {pushEvents.length === 0 ? (
                            <div className="py-8 text-center text-slate-500">No push events fired.</div>
                        ) : (
                            <div className="space-y-4">
                                {pushEvents.map(pe => (
                                    <div key={pe.id} className="flex flex-col bg-slate-50 dark:bg-slate-900 rounded p-3 text-sm">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-semibold text-indigo-600 dark:text-indigo-400 capitalize bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded text-xs">{pe.event_type}</span>
                                            <span className="text-xs text-slate-400">{format(new Date(pe.created_at), 'MMM d, h:mm a')}</span>
                                        </div>
                                        <span className="text-slate-600 dark:text-slate-300 mt-1 truncate">
                                            Sent by: <span className="font-medium text-slate-900 dark:text-slate-100">{pe.created_by?.full_name || 'System API'}</span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </TabsContent>
    )
})
