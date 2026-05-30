"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/hooks/use-user"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { User, Building2, ShieldCheck, Loader2, Save, AlertTriangle } from "lucide-react"
import Link from "next/link"

export default function SettingsPage() {
    const { user, profile, isLoading } = useUser()
    const supabase = createClient()
    const { toast } = useToast()

    const [fullName, setFullName] = useState("")
    const [orgName, setOrgName] = useState("")
    const [isSavingProfile, setIsSavingProfile] = useState(false)
    const [isSavingOrg, setIsSavingOrg] = useState(false)

    useEffect(() => {
        if (profile) {
            setFullName(profile.full_name || "")
            const org = profile.organizations as { name?: string } | null
            setOrgName(org?.name || "")
        }
    }, [profile])

    const getInitials = (name?: string) => {
        if (!name) return "U"
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    }

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user) return
        setIsSavingProfile(true)
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ full_name: fullName })
                .eq('id', user.id)
            if (error) throw error
            toast({ title: "Profile updated successfully" })
        } catch (err) {
            toast({ title: "Failed to update profile", description: (err as Error).message, variant: "destructive" })
        } finally {
            setIsSavingProfile(false)
        }
    }

    const handleSaveOrg = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!profile?.organization_id) return
        setIsSavingOrg(true)
        try {
            const { error } = await supabase
                .from('organizations')
                .update({ name: orgName })
                .eq('id', profile.organization_id)
            if (error) throw error
            toast({ title: "Organization updated successfully" })
        } catch (err) {
            toast({ title: "Failed to update organization", description: (err as Error).message, variant: "destructive" })
        } finally {
            setIsSavingOrg(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        )
    }

    const orgData = profile?.organizations as { name?: string; slug?: string } | null
    const canEditOrg = profile?.role === 'owner' || profile?.role === 'admin'

    return (
        <div className="max-w-2xl space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your account and organization preferences</p>
            </div>

            {/* Profile Section */}
            <Card className="border-slate-200 dark:border-white/5 dark:bg-white/[0.02]">
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600">
                            <User className="h-4 w-4 text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-base">Profile</CardTitle>
                            <CardDescription>Your personal account information</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Avatar + role */}
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                        <Avatar className="h-14 w-14 border-2 border-white dark:border-slate-800 shadow-md">
                            <AvatarImage src={profile?.avatar_url || ""} />
                            <AvatarFallback className="bg-gradient-to-br from-blue-600 to-violet-700 text-white text-lg font-bold">
                                {getInitials(profile?.full_name)}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-semibold text-slate-900 dark:text-white">{profile?.full_name || "—"}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{user?.email}</p>
                            <Badge className="mt-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 capitalize text-xs">
                                <ShieldCheck className="h-3 w-3 mr-1" />
                                {profile?.role || "viewer"}
                            </Badge>
                        </div>
                    </div>

                    <form onSubmit={handleSaveProfile} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="full-name" className="text-sm font-medium">Full name</Label>
                            <Input
                                id="full-name"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Your full name"
                                className="bg-white dark:bg-white/5 border-slate-200 dark:border-white/10"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Email address</Label>
                            <Input
                                value={user?.email || ""}
                                disabled
                                className="bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400 cursor-not-allowed"
                            />
                            <p className="text-xs text-slate-400">Email cannot be changed here.</p>
                        </div>
                        <div className="flex justify-end">
                            <Button
                                type="submit"
                                disabled={isSavingProfile}
                                className="gap-2 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 border-0 text-white"
                            >
                                {isSavingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Save Profile
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {/* Organization Section */}
            <Card className="border-slate-200 dark:border-white/5 dark:bg-white/[0.02]">
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600">
                            <Building2 className="h-4 w-4 text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-base">Organization</CardTitle>
                            <CardDescription>Your workspace details</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <form onSubmit={handleSaveOrg} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="org-name" className="text-sm font-medium">Organization name</Label>
                            <Input
                                id="org-name"
                                value={orgName}
                                onChange={(e) => setOrgName(e.target.value)}
                                placeholder="Your organization name"
                                disabled={!canEditOrg}
                                className="bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Slug</Label>
                            <Input
                                value={orgData?.slug || "—"}
                                disabled
                                className="bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400 cursor-not-allowed font-mono text-sm"
                            />
                            <p className="text-xs text-slate-400">The slug is auto-generated and cannot be changed.</p>
                        </div>

                        {!canEditOrg && (
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 text-sm">
                                <AlertTriangle className="h-4 w-4 shrink-0" />
                                Only owners and admins can edit organization details.
                            </div>
                        )}

                        {canEditOrg && (
                            <div className="flex justify-end">
                                <Button
                                    type="submit"
                                    disabled={isSavingOrg}
                                    className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border-0 text-white"
                                >
                                    {isSavingOrg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    Save Organization
                                </Button>
                            </div>
                        )}
                    </form>

                    <Separator className="my-2 bg-slate-100 dark:bg-white/5" />

                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Team Members</p>
                            <p className="text-xs text-slate-400 mt-0.5">Manage your team and invite new members</p>
                        </div>
                        <Button variant="outline" size="sm" className="border-slate-200 dark:border-white/10" asChild>
                            <Link href="/dashboard/settings/team">Manage Team →</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-red-200 dark:border-red-500/20 dark:bg-red-500/[0.02]">
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-rose-600">
                            <AlertTriangle className="h-4 w-4 text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-base text-red-600 dark:text-red-400">Danger Zone</CardTitle>
                            <CardDescription>Irreversible actions — proceed with caution</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between p-4 rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/5">
                        <div>
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Sign out of all devices</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Invalidates all active sessions for your account</p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="border-red-300 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                            onClick={async () => {
                                await supabase.auth.signOut({ scope: 'global' })
                                window.location.href = '/login'
                            }}
                        >
                            Sign Out All
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
