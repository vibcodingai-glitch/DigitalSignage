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
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_OUT') {
                if (mounted) { setUser(null); setProfile(null) }
            } else if (session?.user && mounted) {
                setUser(session.user)
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('*, organizations(*)')
                    .eq('id', session.user.id)
                    .single()
                if (mounted && profileData) setProfile(profileData as Profile)
            }
        })

        return () => {
            mounted = false
            authListener?.subscription.unsubscribe()
        }
    }, [supabase])

    return { user, profile, isLoading }
}
