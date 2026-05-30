'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
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

interface UserContextValue {
    user: User | null;
    profile: Profile | null;
    session: any | null;
    isLoading: boolean;
}

const UserContext = createContext<UserContextValue>({
    user: null,
    profile: null,
    session: null,
    isLoading: true,
})

/**
 * Provider that manages auth state in a single place.
 * Wrap your layout with <UserProvider> so all children share
 * ONE getSession() call, ONE profile fetch, and ONE onAuthStateChange listener.
 *
 * PERF: When `initialProfile` is provided (from server-side fetch in layout),
 * the provider skips the entire client-side auth + profile waterfall.
 */
export function UserProvider({
    children,
    initialProfile,
    initialUser,
}: {
    children: ReactNode
    initialProfile?: Profile | null
    initialUser?: { id: string; email?: string } | null
}) {
    const [user, setUser] = useState<User | null>(initialUser as User | null)
    const [profile, setProfile] = useState<Profile | null>(initialProfile ?? null)
    const [session, setSession] = useState<any | null>(null)
    const [isLoading, setIsLoading] = useState(!initialProfile) // Not loading if pre-seeded
    const supabase = createClient()

    useEffect(() => {
        let mounted = true

        async function init() {
            // If we already have server-side data, just get the session for token management
            if (initialProfile) {
                const { data: { session } } = await supabase.auth.getSession()
                if (mounted) {
                    setSession(session)
                    if (session?.user) setUser(session.user)
                }
                return
            }

            // Fallback: client-side fetch (for pages without SSR)
            const { data: { session } } = await supabase.auth.getSession()
            const sessionUser = session?.user ?? null

            if (sessionUser && mounted) {
                setUser(sessionUser)
                setSession(session)

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
    // supabase is a singleton from createClient(), stable across renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <UserContext.Provider value={{ user, profile, session, isLoading }}>
            {children}
        </UserContext.Provider>
    )
}

/**
 * Hook to access user/profile data from the shared UserProvider context.
 * All components calling useUser() share the same underlying state —
 * no duplicate network requests or auth listeners.
 */
export function useUser() {
    return useContext(UserContext)
}
