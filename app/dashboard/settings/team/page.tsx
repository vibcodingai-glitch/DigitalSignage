"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/hooks/use-user"
import { useToast } from "@/hooks/use-toast"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Trash, Copy, UserPlus, Clock } from "lucide-react"

type Invite = {
    id: string
    organization_id: string
    email: string
    role: 'owner' | 'admin' | 'editor' | 'viewer'
    token: string
    accepted: boolean
    expires_at: string
    created_at: string
}

type Profile = {
    id: string
    organization_id: string | null
    full_name: string | null
    avatar_url: string | null
    role: 'owner' | 'admin' | 'editor' | 'viewer'
    created_at: string
    last_login?: string
}

export default function TeamManagementPage() {
    const supabase = createClient()
    const { user, profile } = useUser()
    const { toast } = useToast()

    const [invites, setInvites] = useState<Invite[]>([])
    const [members, setMembers] = useState<Profile[]>([])
    
    // Invite Form State
    const [emailInput, setEmailInput] = useState("")
    const [selectedRole, setSelectedRole] = useState("viewer")
    const [isInviting, setIsInviting] = useState(false)

    useEffect(() => {
        if (!user || !profile?.organization_id) return

        fetchInvites()
        fetchMembers()

        const channel = supabase
            .channel('invites-changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'invites',
                filter: `organization_id=eq.${profile.organization_id}`
            }, () => {
                fetchInvites()
            })
            .subscribe()

        return () => { channel.unsubscribe() }
    }, [user, profile])

    const fetchInvites = async () => {
        if (!profile?.organization_id) return
        const { data, error } = await supabase
            .from('invites')
            .select('*')
            .eq('organization_id', profile.organization_id)
            .eq('accepted', false)
            .order('created_at', { ascending: false })
        
        if (!error && data) {
            setInvites(data)
        }
    }

    const fetchMembers = async () => {
        if (!profile?.organization_id) return
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('organization_id', profile.organization_id)
            .order('created_at', { ascending: true })
        
        if (!error && data) {
            setMembers(data)
        }
    }

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!profile?.organization_id) return
        if (!emailInput || !emailInput.includes('@')) {
            toast({ title: "Invalid email address", variant: "destructive" })
            return
        }

        setIsInviting(true)
        const generatedToken = crypto.randomUUID()

        const { data, error } = await supabase
            .from('invites')
            .insert({
                organization_id: profile.organization_id,
                email: emailInput.toLowerCase(),
                role: selectedRole,
                token: generatedToken,
                expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            })
            .select()
            .single()

        setIsInviting(false)

        if (error) {
            toast({ title: "Failed to send invite", description: error.message, variant: "destructive" })
        } else {
            toast({ 
                title: "Invite Created", 
                description: `Link generated for ${emailInput}`,
            })
            setEmailInput("")
            fetchInvites()
        }
    }

    const copyInviteLink = (token: string) => {
        const url = `${window.location.origin}/accept-invite?token=${token}`
        navigator.clipboard.writeText(url)
        toast({ title: "Invite link copied to clipboard" })
    }

    const handleDeleteInvite = async (id: string, email: string) => {
        if (!confirm(`Cancel invite to ${email}?`)) return

        const { error } = await supabase
            .from('invites')
            .delete()
            .eq('id', id)

        if (error) {
            toast({ title: "Failed to cancel invite", variant: "destructive" })
        } else {
            toast({ title: "Invite cancelled" })
            fetchInvites()
        }
    }

    const handleRoleChange = async (memberId: string, newRole: string) => {
        const { error } = await supabase
            .from('profiles')
            .update({ role: newRole })
            .eq('id', memberId)

        if (error) {
            toast({ title: "Failed to update role", variant: "destructive" })
        } else {
            toast({ title: "Role updated" })
            fetchMembers()
        }
    }

    const handleRemoveMember = async (memberId: string, name: string) => {
        if (!confirm(`Remove ${name} from the organization? They will lose access to all screens and content.`)) return

        const { error } = await supabase
            .from('profiles')
            .delete() // The task instructions say "delete from profiles table"
            .eq('id', memberId)

        if (error) {
            toast({ title: "Failed to remove member", variant: "destructive" })
        } else {
            toast({ title: "Member removed" })
            fetchMembers()
        }
    }

    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'owner': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
            case 'admin': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
            case 'editor': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
            case 'viewer':
            default: return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
        }
    }

    const formatRelativeTime = (dateStr: string) => {
        const date = new Date(dateStr)
        const now = new Date()
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
        
        if (diffInSeconds < 60) return "Just now"
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`
        return `${Math.floor(diffInSeconds / 86400)} days ago`
    }

    const formatExpiresTime = (dateStr: string) => {
        const date = new Date(dateStr)
        const now = new Date()
        const diffInSeconds = Math.floor((date.getTime() - now.getTime()) / 1000)
        
        if (diffInSeconds < 0) return "Expired"
        if (diffInSeconds < 3600) return `in ${Math.floor(diffInSeconds / 60)} minutes`
        if (diffInSeconds < 86400) return `in ${Math.floor(diffInSeconds / 3600)} hours`
        return `in ${Math.floor(diffInSeconds / 86400)} days`
    }

    const isExpiringSoon = (dateStr: string) => {
        const date = new Date(dateStr)
        const now = new Date()
        return (date.getTime() - now.getTime()) < 86400000 // Less than 24 hours
    }

    const isAdminOrOwner = profile?.role === 'admin' || profile?.role === 'owner'

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-12">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Team Management</h1>
                <p className="text-slate-500 mt-2">Invite members and manage roles within your organization.</p>
            </div>

            {/* SECTION 1 - INVITE NEW MEMBER */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5 text-indigo-500" />
                        Invite Team Member
                    </CardTitle>
                    <CardDescription>Send an invitation link to add someone to your organization.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-4 items-end">
                        <div className="flex-1 space-y-2 w-full">
                            <label className="text-sm font-medium">Email Address</label>
                            <Input 
                                type="email" 
                                placeholder="colleague@company.com" 
                                required 
                                value={emailInput}
                                onChange={e => setEmailInput(e.target.value)}
                            />
                        </div>
                        <div className="w-full sm:w-48 space-y-2">
                            <label className="text-sm font-medium">Role</label>
                            <Select value={selectedRole} onValueChange={setSelectedRole}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="editor">Editor</SelectItem>
                                    <SelectItem value="viewer">Viewer</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button type="submit" disabled={isInviting || !isAdminOrOwner} className="w-full sm:w-auto">
                            {isInviting ? "Sending..." : "Send Invite"}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* SECTION 2 - PENDING INVITES */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-amber-500" />
                        Pending Invites
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {invites.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 text-sm">
                            No pending invites
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead>Sent</TableHead>
                                        <TableHead>Expires</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {invites.map(invite => (
                                        <TableRow key={invite.id}>
                                            <TableCell className="font-medium">{invite.email}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={getRoleBadgeColor(invite.role)}>
                                                    {invite.role}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm text-slate-500">
                                                {formatRelativeTime(invite.created_at)}
                                            </TableCell>
                                            <TableCell className={`text-sm ${isExpiringSoon(invite.expires_at) ? 'text-red-500 font-medium' : 'text-slate-500'}`}>
                                                {formatExpiresTime(invite.expires_at)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="outline" size="sm" onClick={() => copyInviteLink(invite.token)}>
                                                        <Copy className="h-4 w-4 mr-2" /> Copy Link
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteInvite(invite.id, invite.email)} disabled={!isAdminOrOwner}>
                                                        <Trash className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* SECTION 3 - TEAM MEMBERS */}
            <Card>
                <CardHeader>
                    <CardTitle>Team Members</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Member</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Last Login</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {members.map(member => {
                                    const isSelf = member.id === user?.id
                                    const isOwner = member.role === 'owner'
                                    const canEdit = isAdminOrOwner && !isSelf && !isOwner

                                    return (
                                        <TableRow key={member.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar>
                                                        <AvatarImage src={member.avatar_url || ''} />
                                                        <AvatarFallback>{member.full_name?.substring(0, 2).toUpperCase() || 'U'}</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <div className="font-medium">{member.full_name || member.id.substring(0, 8)} {isSelf && "(You)"}</div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {canEdit ? (
                                                    <Select value={member.role} onValueChange={(val) => handleRoleChange(member.id, val)}>
                                                        <SelectTrigger className="w-[110px] h-8">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="admin">Admin</SelectItem>
                                                            <SelectItem value="editor">Editor</SelectItem>
                                                            <SelectItem value="viewer">Viewer</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                ) : (
                                                    <Badge variant="outline" className={getRoleBadgeColor(member.role)}>
                                                        {member.role}
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm text-slate-500">
                                                {member.last_login ? formatRelativeTime(member.last_login) : "Never"}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="text-red-500 hover:text-red-600 hover:bg-red-50" 
                                                    onClick={() => handleRemoveMember(member.id, member.full_name || 'User')} 
                                                    disabled={!canEdit}
                                                >
                                                    <Trash className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
