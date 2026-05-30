"use client"

import React from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { TabsContent } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface ScreenSettingsTabProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    screen: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    locations: any[]
    settingsData: {
        location_id: string
        orientation: string
        resolution: string
    }
    onSettingsChange: (data: { location_id: string; orientation: string; resolution: string }) => void
    onUpdateSettings: (e: React.FormEvent) => void
    onDeleteScreen: () => void
}

export const ScreenSettingsTab = React.memo(function ScreenSettingsTab({
    screen,
    locations,
    settingsData,
    onSettingsChange,
    onUpdateSettings,
    onDeleteScreen,
}: ScreenSettingsTabProps) {
    return (
        <TabsContent value="settings" className="m-0 space-y-6">
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm max-w-3xl">
                <CardHeader>
                    <CardTitle>Hardware Configuration</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={onUpdateSettings} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label>Registered Location Node</Label>
                                <Select value={settingsData.location_id} onValueChange={v => onSettingsChange({ ...settingsData, location_id: v })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Location Group..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Unassigned Site</SelectItem>
                                        {locations.map(loc => (
                                            <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Render Orientation</Label>
                                <Select value={settingsData.orientation} onValueChange={v => onSettingsChange({ ...settingsData, orientation: v })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Orientation..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="landscape">Landscape 16:9</SelectItem>
                                        <SelectItem value="portrait">Portrait 9:16 (Tall)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Native Resolution</Label>
                                <Select value={settingsData.resolution} onValueChange={v => onSettingsChange({ ...settingsData, resolution: v })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Resolutions..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1920x1080">1920x1080 (1080p FHD)</SelectItem>
                                        <SelectItem value="3840x2160">3840x2160 (4K UHD)</SelectItem>
                                        <SelectItem value="1080x1920">1080x1920 (Portrait FHD)</SelectItem>
                                        <SelectItem value="custom">Custom Canvas Array</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <Button type="submit">Deploy Settings</Button>
                    </form>
                </CardContent>
            </Card>

            {/* Danger zone */}
            <Card className="border-red-200 dark:border-red-900 shadow-sm max-w-3xl">
                <CardHeader>
                    <CardTitle className="text-red-700 dark:text-red-500">Danger Zone</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4 p-4 border border-red-100 dark:border-red-900/50 rounded-lg bg-red-50 dark:bg-red-950/20">
                        <div>
                            <h4 className="font-semibold text-slate-900 dark:text-slate-100">Decommission Endpoint</h4>
                            <p className="text-sm text-slate-500 mt-1">Permanently severs access token mapping. Device will instantly drop into untrusted state.</p>
                        </div>
                        <Button variant="destructive" onClick={onDeleteScreen}>Delete Endpoint</Button>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
    )
})
