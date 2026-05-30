"use client"

import React, { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/hooks/use-user"

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import type { ContentItem } from "@/app/dashboard/content/page"

interface LinkDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onItemCreated: (tempId: string, optimisticItem: ContentItem) => void
    onItemConfirmed: (tempId: string, savedItem: ContentItem) => void
    onError: () => void
}

export const LinkDialog = React.memo(function LinkDialog({ open, onOpenChange, onItemCreated, onItemConfirmed, onError }: LinkDialogProps) {
    const { profile, session, user } = useUser()
    const supabase = createClient()
    const { toast } = useToast()

    const [linkForm, setLinkForm] = useState({
        name: "",
        type: "url" as ContentItem['type'],
        source_url: "",
        duration_seconds: 10
    })
    const [isSavingLink, setIsSavingLink] = useState(false)
    const [linkError, setLinkError] = useState<string | null>(null)

    const handleSaveLink = async (e: React.FormEvent) => {
        e.preventDefault()
        setLinkError(null)

        let orgId = profile?.organization_id
        if (!orgId) {
            // Only try to fetch orgId if user exists but profile isn't fully loaded
            if (user) {
                const { data } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
                if (data?.organization_id) orgId = data.organization_id
            }
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
            console.log('[SaveLink] Payload:', { organization_id: orgId, name: linkForm.name, type: linkForm.type, source_url: linkForm.source_url })
            
            if (!session?.access_token) throw new Error("No active session token")

            // Optimistic UI Update: Make it completely seamless
            const tempId = `temp-${Date.now()}`
            const optimisticItem = {
                id: tempId,
                organization_id: orgId,
                name: linkForm.name,
                type: linkForm.type,
                source_url: linkForm.source_url,
                file_path: null,
                file_size: null,
                thumbnail_url: null,
                metadata: {},
                duration_seconds: parseInt(String(linkForm.duration_seconds)) || 10,
                created_at: new Date().toISOString()
            } as ContentItem
            
            onItemCreated(tempId, optimisticItem)
            onOpenChange(false)
            setLinkForm({ name: "", type: "url", source_url: "", duration_seconds: 10 })
            toast({ title: "Saving link in background..." })

            const payload = {
                organization_id: orgId,
                name: optimisticItem.name,
                type: optimisticItem.type,
                source_url: optimisticItem.source_url,
                duration_seconds: optimisticItem.duration_seconds
            };

            const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/content_items?select=*`, {
                method: 'POST',
                headers: {
                    'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`DB error: ${response.status} ${errText}`);
            }

            // Replace temp item with real DB item
            const [savedItem] = await response.json();
            onItemConfirmed(tempId, savedItem)
            toast({ title: "Link saved successfully" })
            
        } catch (error) {
            const msg = (error as Error).message || 'Unknown error'
            console.error('[SaveLink] Error:', msg)
            setLinkError(msg)
            toast({ title: "Failed to add link", variant: "destructive", description: msg })
            // Fetch content to restore correct state since optimistic update failed
            onError()
        } finally {
            setIsSavingLink(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
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
                                <SelectItem value="powerbi">PowerBI (Relay Window)</SelectItem>
                                <SelectItem value="powerbi_frame">PowerBI (Direct Frame — session auth)</SelectItem>
                                <SelectItem value="dashboard">Grafana / Tableau Dashboard</SelectItem>
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
                        <Button type="button" variant="outline" onClick={() => { onOpenChange(false); setLinkError(null) }}>Cancel</Button>
                        <Button type="submit" disabled={isSavingLink}>
                            {isSavingLink ? "Saving..." : "Save Link Resource"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
})
