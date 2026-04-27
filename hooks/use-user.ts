import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

interface Profile {
    id: string;
    email: string;
    full_name: string;
    avatar_url: string;
    organization_id: string;
    role: string;
    organizations?: Record<string, unknown> | null;
}

export function useUser() {
    const [user, setUser] = useState<User | null>(null)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [session, setSession] = useState<any | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        let mounted = true

        async function init() {
            // 1. Use getSession() — reads from local cache, no network call
            const { data: { session } } = await supabase.auth.getSession()
            const sessionUser = session?.user ?? null

            if (sessionUser && mounted) {
                setUser(sessionUser)
                setSession(session)

                // 2. Fetch profile in parallel — don't block on it
                supabase
                    .from('profiles')
                    .select('*, organizations(*)')
                    .eq('id', sessionUser.id)
                    .single()
                    .then(({ data: profileData }) => {
                        if (mounted && profileData) {
                            setProfile(profileData as Profile)
                        }
                    })
            }

            // Mark loading done as soon as session is known (profile loads async)
            if (mounted) setIsLoading(false)
        }

        init()

        // Listen for auth state changes
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
            if (event === 'SIGNED_OUT') {
                if (mounted) { setUser(null); setProfile(null); setSession(null) }
            } else if (currentSession?.user && mounted) {
                setUser(currentSession.user)
                setSession(currentSession)
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('*, organizations(*)')
                    .eq('id', currentSession.user.id)
                    .single()
                if (mounted && profileData) setProfile(profileData as Profile)
            }
        })

        return () => {
            mounted = false
            authListener?.subscription.unsubscribe()
        }
    }, [supabase])

    return { user, profile, session, isLoading }
}
