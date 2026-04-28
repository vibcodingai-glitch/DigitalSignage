"use client"

import { useRef, useCallback, useEffect } from "react"

// ─────────────────────────────────────────────────────────────────
// MESSAGE PROTOCOL
// ─────────────────────────────────────────────────────────────────
export type RelayMessage =
    | { type: "NAVIGATE"; url: string }
    | { type: "STANDBY" }
    | { type: "CLOSE" }
    | { type: "PING" }
    | { type: "PONG" }

const CHANNEL_NAME = "powerbi-relay"

// ─────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────
/**
 * usePowerBIRelay
 *
 * Manages the lifecycle of the PowerBI relay window.
 * The relay window is a dedicated fullscreen browser window that
 * navigates to PowerBI URLs. All timing is controlled by ZoneRenderer
 * in the display page; this hook only handles IPC and window management.
 *
 * Flow:
 *  1. openRelay()  → opens /display/powerbi-relay as a fullscreen popup
 *  2. showURL(url) → relay navigates to powerbi URL (real browser tab)
 *  3. hide()       → relay returns to transparent standby
 *  4. close()      → relay window is closed on unmount / FORCE_RELOAD
 */
export function usePowerBIRelay() {
    const relayWindowRef = useRef<Window | null>(null)
    const channelRef = useRef<BroadcastChannel | null>(null)
    const isOpenRef = useRef(false)

    // ── Setup BroadcastChannel ─────────────────────────────────
    useEffect(() => {
        if (typeof window === "undefined") return
        const ch = new BroadcastChannel(CHANNEL_NAME)
        channelRef.current = ch

        ch.onmessage = (e: MessageEvent<RelayMessage>) => {
            if (e.data.type === "PONG") {
                isOpenRef.current = true
            }
        }

        return () => {
            ch.close()
            channelRef.current = null
        }
    }, [])

    // ── Send helper ────────────────────────────────────────────
    const send = useCallback((msg: RelayMessage) => {
        channelRef.current?.postMessage(msg)
    }, [])

    // ── Ping to check if relay is alive ───────────────────────
    const pingRelay = useCallback((): Promise<boolean> => {
        return new Promise(resolve => {
            if (!channelRef.current) return resolve(false)
            isOpenRef.current = false
            send({ type: "PING" })
            setTimeout(() => resolve(isOpenRef.current), 300)
        })
    }, [send])

    // ── Open relay window ──────────────────────────────────────
    const openRelay = useCallback(async () => {
        if (typeof window === "undefined") return

        // Check if already open and responsive
        const alive = await pingRelay()
        if (alive && relayWindowRef.current && !relayWindowRef.current.closed) {
            return
        }

        const w = screen.width || window.innerWidth
        const h = screen.height || window.innerHeight

        const relayUrl = `${window.location.origin}/display/powerbi-relay`
        const features = [
            `width=${w}`,
            `height=${h}`,
            "top=0",
            "left=0",
            "toolbar=no",
            "menubar=no",
            "scrollbars=no",
            "resizable=no",
            "location=no",
            "status=no",
        ].join(",")

        const win = window.open(relayUrl, "powerbi_relay_window", features)
        if (win) {
            relayWindowRef.current = win
            // Give relay time to boot before sending commands
            await new Promise(r => setTimeout(r, 800))
        } else {
            console.warn("[PowerBIRelay] Popup blocked — ask user to click to enable popups.")
        }
    }, [pingRelay])

    // ── Show a PowerBI URL in the relay ───────────────────────
    const showURL = useCallback(async (url: string) => {
        // Auto-open relay if it was closed
        if (!relayWindowRef.current || relayWindowRef.current.closed) {
            await openRelay()
        }
        send({ type: "NAVIGATE", url })
    }, [openRelay, send])

    // ── Hide relay (navigate back to standby) ─────────────────
    // IMPORTANT: BroadcastChannel won't work here because once the relay
    // window navigated to PowerBI, its listener is destroyed. We must use
    // the window ref directly — this works because both pages are same-origin.
    const hide = useCallback(() => {
        if (relayWindowRef.current && !relayWindowRef.current.closed) {
            try {
                const standbyUrl = `${window.location.origin}/display/powerbi-relay`
                relayWindowRef.current.location.href = standbyUrl
            } catch {
                // Fallback: relay hasn't navigated yet, BroadcastChannel still works
                send({ type: 'STANDBY' })
            }
        }
    }, [send])

    // ── Close relay entirely ───────────────────────────────────
    const close = useCallback(() => {
        send({ type: "CLOSE" })
        setTimeout(() => {
            if (relayWindowRef.current && !relayWindowRef.current.closed) {
                relayWindowRef.current.close()
            }
            relayWindowRef.current = null
        }, 300)
    }, [send])

    // ── Cleanup on unmount ────────────────────────────────────
    useEffect(() => {
        return () => { close() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return { openRelay, showURL, hide, close }
}
