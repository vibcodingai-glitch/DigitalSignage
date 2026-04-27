"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/hooks/use-user"
import { useToast } from "@/hooks/use-toast"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MonitorPlay } from "lucide-react"

function AcceptInviteContent() {
    const searchParams = useSearchParams()
    const token = searchParams.get('token')
    const { user } = useUser()
    const router = useRouter()
    const { toast } = useToast()
    const supabase = createClient()
    const [isAccepting, setIsAccepting] = useState(false)

    useEffect(() => {
        if (!token || !user) return

        const acceptInvite = async () => {
            setIsAccepting(true)
            const { data, error } = await supabase.rpc('accept_invite', {
                invite_token: token,
                user_id: user.id
            })

            if (error || !data.success) {
                toast({ title: "Invalid or expired invite", variant: "destructive" })
                setIsAccepting(false)
                return
            }

            toast({ title: `You've joined ${data.organization_name}!` })
            router.push('/dashboard')
            router.refresh()
        }

        acceptInvite()
    }, [token, user, supabase, router, toast])

    if (!token) {
        return (
            <Card className="w-full max-w-md shadow-xl border-slate-200 dark:border-slate-800">
                <CardHeader className="text-center pb-6">
                    <CardTitle className="text-xl">Invalid Invite Link</CardTitle>
                    <CardDescription>Please check the URL or request a new invite.</CardDescription>
                </CardHeader>
            </Card>
        )
    }

    if (user || isAccepting) {
        return (
            <Card className="w-full max-w-md shadow-xl border-slate-200 dark:border-slate-800">
                <CardHeader className="text-center pb-6">
                    <CardTitle className="text-xl">Accepting Invite...</CardTitle>
                    <CardDescription>Please wait while we set up your workspace.</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center py-6">
                    <div className="h-8 w-8 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="w-full max-w-md shadow-xl border-slate-200 dark:border-slate-800">
            <CardHeader className="text-center pb-6">
                <div className="mx-auto bg-indigo-100 dark:bg-indigo-900/30 p-3 rounded-full w-14 h-14 flex items-center justify-center mb-4">
                    <MonitorPlay className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <CardTitle className="text-2xl font-bold">You've been invited to join SignageHub</CardTitle>
                <CardDescription className="text-base mt-2">
                    An organization administrator has invited you to collaborate on their digital signage network.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                <Button className="w-full" size="lg" onClick={() => router.push(`/login?invite=${token}`)}>
                    I have an account
                </Button>
                <Button variant="outline" className="w-full" size="lg" onClick={() => router.push(`/register?invite=${token}`)}>
                    Create new account
                </Button>
            </CardContent>
        </Card>
    )
}

export default function AcceptInvitePage() {
    return (
        <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
            <Suspense fallback={
                <div className="h-8 w-8 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
            }>
                <AcceptInviteContent />
            </Suspense>
        </div>
    )
}
