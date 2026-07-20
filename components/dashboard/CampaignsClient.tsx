"use client"

import { useState, useCallback } from "react"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    Megaphone, Plus, Play, Square, Trash2, Monitor,
    Layers, AlertTriangle, ChevronRight, Loader2, Edit2, X
} from "lucide-react"

// ─── Types ───────────────────────────────────────────────────────────────────

interface Screen { id: string; name: string; display_key: string; status?: string }
interface Project { id: string; name: string; color?: string }
interface CampaignScreen {
    id: string; screen_id: string; project_id: string
    screens: Screen; projects: Project
}
interface Campaign {
    id: string; name: string; description?: string; color: string
    is_active: boolean; activated_at?: string; created_at: string
    campaign_screens: CampaignScreen[]
}

interface Props {
    initialCampaigns: Campaign[]
    screens: Screen[]
    projects: Project[]
}

// ─── Screen mapping row in the builder ───────────────────────────────────────
function ScreenMappingRow({
    screen, selectedProjectId, projects, onChange, onRemove
}: {
    screen: Screen; selectedProjectId: string; projects: Project[]
    onChange: (projectId: string) => void; onRemove: () => void
}) {
    const selectedProject = projects.find(p => p.id === selectedProjectId)
    return (
        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 overflow-hidden">
            {/* Screen header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-white/10">
                <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-lg bg-slate-200 dark:bg-white/10 flex items-center justify-center">
                        <Monitor className="h-3.5 w-3.5 text-slate-500" />
                    </div>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{screen.name}</span>
                </div>
                <button
                    onClick={onRemove}
                    className="h-6 w-6 flex items-center justify-center rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>
            {/* Project selector */}
            <div className="p-3">
                <Select value={selectedProjectId} onValueChange={onChange}>
                    <SelectTrigger className="w-full h-10 text-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 focus:ring-violet-500">
                        {selectedProject ? (
                            <div className="flex items-center gap-2">
                                <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: selectedProject.color || '#6366f1' }} />
                                <span className="truncate">{selectedProject.name}</span>
                            </div>
                        ) : (
                            <SelectValue placeholder="Choose override project…" />
                        )}
                    </SelectTrigger>
                    <SelectContent>
                        <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            Override Project
                        </div>
                        {projects.map(p => (
                            <SelectItem key={p.id} value={p.id}>
                                <div className="flex items-center gap-2">
                                    <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: p.color || '#6366f1' }} />
                                    <span>{p.name}</span>
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {!selectedProjectId && (
                    <p className="text-[11px] text-amber-500 mt-1.5 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Select a project for this screen
                    </p>
                )}
            </div>
        </div>
    )
}

// ─── Campaign Builder Dialog ──────────────────────────────────────────────────
function CampaignBuilderDialog({
    open, onOpenChange, screens, projects, editCampaign, onSaved
}: {
    open: boolean; onOpenChange: (v: boolean) => void
    screens: Screen[]; projects: Project[]
    editCampaign?: Campaign | null
    onSaved: (campaign: Campaign) => void
}) {
    const { toast } = useToast()
    const [name, setName] = useState(editCampaign?.name || '')
    const [description, setDescription] = useState(editCampaign?.description || '')
    const [isSaving, setIsSaving] = useState(false)

    // mappings: { screen_id → project_id }
    const [mappings, setMappings] = useState<Record<string, string>>(() => {
        if (!editCampaign) return {}
        return Object.fromEntries(editCampaign.campaign_screens.map(cs => [cs.screen_id, cs.project_id]))
    })

    // Screens added to the campaign
    const [addedScreenIds, setAddedScreenIds] = useState<string[]>(() =>
        editCampaign ? editCampaign.campaign_screens.map(cs => cs.screen_id) : []
    )

    const [screenToAdd, setScreenToAdd] = useState('')

    const addScreen = () => {
        if (!screenToAdd || addedScreenIds.includes(screenToAdd)) return
        setAddedScreenIds(prev => [...prev, screenToAdd])
        setScreenToAdd('')
    }

    const removeScreen = (screenId: string) => {
        setAddedScreenIds(prev => prev.filter(id => id !== screenId))
        setMappings(prev => { const n = { ...prev }; delete n[screenId]; return n })
    }

    const setProjectForScreen = (screenId: string, projectId: string) => {
        setMappings(prev => ({ ...prev, [screenId]: projectId }))
    }

    const handleSave = async () => {
        if (!name.trim()) { toast({ title: 'Campaign name is required', variant: 'destructive' }); return }

        // Validate all added screens have a project
        const incomplete = addedScreenIds.filter(id => !mappings[id])
        if (incomplete.length > 0) {
            toast({ title: 'Incomplete mapping', description: 'Please assign a project to every screen.', variant: 'destructive' })
            return
        }

        setIsSaving(true)
        try {
            const body = {
                name: name.trim(),
                description,
                screens: addedScreenIds.map(id => ({ screen_id: id, project_id: mappings[id] }))
            }

            const url = editCampaign ? `/api/campaigns/${editCampaign.id}` : '/api/campaigns'
            const method = editCampaign ? 'PUT' : 'POST'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.error || 'Failed to save campaign')
            }
            const { campaign } = await res.json()
            toast({ title: `Campaign ${editCampaign ? 'updated' : 'created'}!` })
            onSaved(campaign)
            onOpenChange(false)
        } catch (err) {
            toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' })
        } finally {
            setIsSaving(false)
        }
    }

    const availableScreens = screens.filter(s => !addedScreenIds.includes(s.id))

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[640px] max-h-[90vh] flex flex-col dark:bg-slate-900">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Megaphone className="h-5 w-5 text-violet-500" />
                        {editCampaign ? 'Edit Campaign' : 'New Campaign'}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto space-y-5 pr-1 py-2">
                    {/* Name */}
                    <div className="space-y-1.5">
                        <Label>Campaign Name</Label>
                        <Input
                            value={name} onChange={e => setName(e.target.value)}
                            placeholder="e.g. Black Friday Promo"
                            className="bg-white dark:bg-white/5"
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                        <Label>Description <span className="text-slate-400 font-normal">(optional)</span></Label>
                        <Input
                            value={description} onChange={e => setDescription(e.target.value)}
                            placeholder="Short note about this campaign"
                            className="bg-white dark:bg-white/5"
                        />
                    </div>

                    {/* Screen mappings */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>Screen → Project Mappings</Label>
                            <span className="text-xs text-slate-400">{addedScreenIds.length} screen{addedScreenIds.length !== 1 ? 's' : ''} added</span>
                        </div>
                        <p className="text-xs text-slate-500">Each screen plays a different project when this campaign is active.</p>

                        <div className="space-y-2">
                            {addedScreenIds.map(screenId => {
                                const screen = screens.find(s => s.id === screenId)
                                if (!screen) return null
                                return (
                                    <ScreenMappingRow
                                        key={screenId}
                                        screen={screen}
                                        selectedProjectId={mappings[screenId] || ''}
                                        projects={projects}
                                        onChange={pid => setProjectForScreen(screenId, pid)}
                                        onRemove={() => removeScreen(screenId)}
                                    />
                                )
                            })}
                        </div>

                        {/* Add screen row */}
                        {availableScreens.length > 0 && (
                            <div className="flex gap-2 pt-1">
                                <Select value={screenToAdd} onValueChange={setScreenToAdd}>
                                    <SelectTrigger className="flex-1 bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 text-sm">
                                        <div className="flex items-center gap-2 text-slate-500">
                                            <Plus className="h-4 w-4" />
                                            <SelectValue placeholder="Add a screen to this campaign…" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                            Available Screens
                                        </div>
                                        {availableScreens.map(s => (
                                            <SelectItem key={s.id} value={s.id}>
                                                <div className="flex items-center gap-2">
                                                    <Monitor className="h-3.5 w-3.5 text-slate-400" />
                                                    {s.name}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    variant="outline"
                                    onClick={addScreen}
                                    disabled={!screenToAdd}
                                    className="shrink-0 border-violet-300 dark:border-violet-500/30 text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-500/10"
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                        )}

                        {addedScreenIds.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-6 rounded-xl border border-dashed border-slate-200 dark:border-white/10 text-center">
                                <Monitor className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
                                <p className="text-sm text-slate-500">No screens added yet</p>
                                <p className="text-xs text-slate-400 mt-0.5">Use the dropdown above to add screens</p>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="pt-2">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white border-0"
                    >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        {editCampaign ? 'Save Changes' : 'Create Campaign'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// ─── Campaign Card ────────────────────────────────────────────────────────────
function CampaignCard({
    campaign, screens, projects,
    onActivate, onDeactivate, onEdit, onDelete
}: {
    campaign: Campaign; screens: Screen[]; projects: Project[]
    onActivate: () => void; onDeactivate: () => void
    onEdit: () => void; onDelete: () => void
}) {
    const [isToggling, setIsToggling] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    const handleToggle = async () => {
        setIsToggling(true)
        if (campaign.is_active) await onDeactivate()
        else await onActivate()
        setIsToggling(false)
    }

    return (
        <Card className={`border transition-all duration-200 ${
            campaign.is_active
                ? 'border-violet-500/50 bg-violet-500/5 dark:bg-violet-500/10 shadow-[0_0_0_1px_rgba(139,92,246,0.3)]'
                : 'border-slate-200 dark:border-white/10 dark:bg-white/[0.02]'
        }`}>
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${
                            campaign.is_active
                                ? 'bg-gradient-to-br from-violet-500 to-indigo-600'
                                : 'bg-slate-100 dark:bg-white/10'
                        }`}>
                            <Megaphone className={`h-5 w-5 ${campaign.is_active ? 'text-white' : 'text-slate-500'}`} />
                        </div>
                        <div className="min-w-0">
                            <CardTitle className="text-base truncate">{campaign.name}</CardTitle>
                            {campaign.description && (
                                <p className="text-xs text-slate-500 mt-0.5 truncate">{campaign.description}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {campaign.is_active ? (
                            <Badge className="bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/30 animate-pulse">
                                ● ACTIVE
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="text-slate-500 border-slate-300 dark:border-white/20">
                                Inactive
                            </Badge>
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Screen mappings summary */}
                <div className="space-y-2">
                    {campaign.campaign_screens.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No screens configured</p>
                    ) : (
                        campaign.campaign_screens.map(cs => (
                            <div key={cs.id} className="flex items-center gap-2 text-sm">
                                <Monitor className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span className="text-slate-600 dark:text-slate-400 truncate">{cs.screens?.name}</span>
                                <ChevronRight className="h-3 w-3 text-slate-300 shrink-0" />
                                <div className="h-2 w-2 rounded-full shrink-0" style={{ background: cs.projects?.color || '#6366f1' }} />
                                <span className="text-slate-700 dark:text-slate-300 truncate font-medium">{cs.projects?.name}</span>
                            </div>
                        ))
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-white/5">
                    <Button
                        size="sm"
                        onClick={handleToggle}
                        disabled={isToggling || campaign.campaign_screens.length === 0}
                        className={`gap-2 flex-1 ${
                            campaign.is_active
                                ? 'bg-red-500 hover:bg-red-600 text-white border-0'
                                : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white border-0'
                        }`}
                    >
                        {isToggling ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : campaign.is_active ? (
                            <><Square className="h-4 w-4" /> Deactivate</>
                        ) : (
                            <><Play className="h-4 w-4" /> Activate</>
                        )}
                    </Button>
                    <Button size="sm" variant="outline" onClick={onEdit} className="border-slate-200 dark:border-white/10">
                        <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                        size="sm" variant="outline"
                        onClick={onDelete}
                        disabled={isDeleting || campaign.is_active}
                        className="border-red-200 dark:border-red-500/20 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                        title={campaign.is_active ? 'Deactivate before deleting' : 'Delete campaign'}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

// ─── Main CampaignsClient ─────────────────────────────────────────────────────
export default function CampaignsClient({ initialCampaigns, screens, projects }: Props) {
    const { toast } = useToast()
    const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns)
    const [builderOpen, setBuilderOpen] = useState(false)
    const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)

    const openNew = () => { setEditingCampaign(null); setBuilderOpen(true) }
    const openEdit = (c: Campaign) => { setEditingCampaign(c); setBuilderOpen(true) }

    const handleSaved = useCallback((campaign: Campaign) => {
        setCampaigns(prev => {
            const idx = prev.findIndex(c => c.id === campaign.id)
            if (idx >= 0) {
                const updated = [...prev]; updated[idx] = campaign; return updated
            }
            return [campaign, ...prev]
        })
    }, [])

    const handleActivate = useCallback(async (campaign: Campaign) => {
        const res = await fetch(`/api/campaigns/${campaign.id}/activate`, { method: 'POST' })
        const data = await res.json()
        if (!res.ok) { toast({ title: 'Error', description: data.error, variant: 'destructive' }); return }
        toast({ title: '🚀 Campaign activated!', description: data.message })
        // Update local state: deactivate all, activate this one
        setCampaigns(prev => prev.map(c => ({ ...c, is_active: c.id === campaign.id })))
    }, [toast])

    const handleDeactivate = useCallback(async (campaign: Campaign) => {
        const res = await fetch(`/api/campaigns/${campaign.id}/deactivate`, { method: 'POST' })
        const data = await res.json()
        if (!res.ok) { toast({ title: 'Error', description: data.error, variant: 'destructive' }); return }
        toast({ title: 'Campaign deactivated', description: data.message })
        setCampaigns(prev => prev.map(c => c.id === campaign.id ? { ...c, is_active: false } : c))
    }, [toast])

    const handleDelete = useCallback(async (campaign: Campaign) => {
        if (!confirm(`Delete campaign "${campaign.name}"? This cannot be undone.`)) return
        const res = await fetch(`/api/campaigns/${campaign.id}`, { method: 'DELETE' })
        if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            toast({ title: 'Error', description: data.error, variant: 'destructive' }); return
        }
        toast({ title: 'Campaign deleted' })
        setCampaigns(prev => prev.filter(c => c.id !== campaign.id))
    }, [toast])

    const activeCampaign = campaigns.find(c => c.is_active)

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Campaigns</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
                        Override standard screen projects with a single activation.
                    </p>
                </div>
                <Button
                    onClick={openNew}
                    className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white border-0"
                >
                    <Plus className="h-4 w-4" /> New Campaign
                </Button>
            </div>

            {/* Active campaign banner */}
            {activeCampaign && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-violet-500/10 border border-violet-500/30">
                    <div className="h-2.5 w-2.5 rounded-full bg-violet-500 animate-pulse" />
                    <p className="text-sm font-medium text-violet-700 dark:text-violet-300">
                        <span className="font-bold">{activeCampaign.name}</span> is currently active across{' '}
                        {activeCampaign.campaign_screens.length} screen(s).
                    </p>
                </div>
            )}

            {/* Campaign grid */}
            {campaigns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="h-16 w-16 rounded-2xl bg-slate-100 dark:bg-white/10 flex items-center justify-center mb-4">
                        <Megaphone className="h-8 w-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">No campaigns yet</h3>
                    <p className="text-slate-500 mt-1 text-sm max-w-xs">
                        Create a campaign to instantly override multiple screens with screen-specific content.
                    </p>
                    <Button onClick={openNew} className="mt-6 gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-0">
                        <Plus className="h-4 w-4" /> Create your first campaign
                    </Button>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {campaigns.map(c => (
                        <CampaignCard
                            key={c.id}
                            campaign={c}
                            screens={screens}
                            projects={projects}
                            onActivate={() => handleActivate(c)}
                            onDeactivate={() => handleDeactivate(c)}
                            onEdit={() => openEdit(c)}
                            onDelete={() => handleDelete(c)}
                        />
                    ))}
                </div>
            )}

            {/* Builder dialog */}
            <CampaignBuilderDialog
                open={builderOpen}
                onOpenChange={setBuilderOpen}
                screens={screens}
                projects={projects}
                editCampaign={editingCampaign}
                onSaved={handleSaved}
            />
        </div>
    )
}
