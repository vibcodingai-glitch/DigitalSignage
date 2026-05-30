"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/hooks/use-user"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Loader2, LayoutPanelLeft } from "lucide-react"
import { ContentItem } from "../dashboard/ContentClient"

export function WidgetDialog({
    open,
    onOpenChange,
    onWidgetCreated
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    onWidgetCreated: () => void
}) {
    const supabase = createClient()
    const { profile } = useUser()
    const { toast } = useToast()

    const [isSaving, setIsSaving] = useState(false)
    const [name, setName] = useState("")
    const [type, setType] = useState<"weather" | "rss">("weather")
    const [configValue, setConfigValue] = useState("") // location or rss url

    const handleSave = async () => {
        if (!profile?.organization_id) return
        if (!name.trim()) {
            toast({ title: "Name required", variant: "destructive" })
            return
        }
        if (!configValue.trim()) {
            toast({ title: "Configuration value required", variant: "destructive" })
            return
        }

        setIsSaving(true)
        try {
            const metadata = type === "weather" ? { location: configValue } : { rss_url: configValue }
            const source_url = type === "rss" ? configValue : configValue // save config in source_url as fallback too

            const { error } = await supabase.from("content_items").insert({
                organization_id: profile.organization_id,
                name: name.trim(),
                type,
                source_url,
                metadata,
                duration_seconds: 15
            })

            if (error) throw error

            toast({ title: "Widget created successfully" })
            onWidgetCreated()
            onOpenChange(false)
            
            // reset
            setName("")
            setConfigValue("")
        } catch (error: any) {
            toast({ title: "Failed to create widget", description: error.message, variant: "destructive" })
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <LayoutPanelLeft className="h-5 w-5 text-indigo-500" />
                        Create Dynamic Widget
                    </DialogTitle>
                    <DialogDescription>
                        Widgets fetch and display live data automatically.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Widget Type</Label>
                        <Select value={type} onValueChange={(v: "weather" | "rss") => setType(v)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="weather">Weather Forecast</SelectItem>
                                <SelectItem value="rss">RSS News Ticker</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Widget Name</Label>
                        <Input 
                            placeholder={type === "weather" ? "London Weather" : "BBC News"}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>{type === "weather" ? "Location (City or Zip)" : "RSS Feed URL"}</Label>
                        <Input 
                            placeholder={type === "weather" ? "e.g., New York, 10001" : "https://..."}
                            value={configValue}
                            onChange={(e) => setConfigValue(e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Widget
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
