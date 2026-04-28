"use client"

import { useEffect, useState, useRef } from "react"
import type { RelayMessage } from "@/hooks/use-powerbi-relay"

const CHANNEL_NAME = "powerbi-relay"

type RelayState = "standby" | "navigating" | "active"

export default function PowerBIRelayPage() {
    const [state, setState] = useState<RelayState>("standby")
    const [targetUrl, setTargetUrl] = useState<string | null>(null)
    const channelRef = useRef<BroadcastChannel | null>(null)

    useEffect(() => {
        const ch = new BroadcastChannel(CHANNEL_NAME)
        channelRef.current = ch

        ch.onmessage = (e: MessageEvent<RelayMessage>) => {
            const msg = e.data
            switch (msg.type) {
                case "PING":
                    ch.postMessage({ type: "PONG" })
                    break

                case "NAVIGATE":
                    setState("navigating")
                    setTargetUrl(msg.url)
                    // Brief delay to show fade-in before navigating
                    setTimeout(() => {
                        setState("active")
                        window.location.href = msg.url
                    }, 200)
                    break

                case "STANDBY":
                    setState("standby")
                    setTargetUrl(null)
                    break

                case "CLOSE":
                    window.close()
                    break
            }
        }

        // Signal ready to parent
        ch.postMessage({ type: "PONG" })

        return () => {
            ch.close()
            channelRef.current = null
        }
    }, [])

    // ── Standby screen ─────────────────────────────────────────
    // When on standby the window is visible but shows a branded
    // loading screen. When NAVIGATE fires, this page navigates
    // itself to PowerBI — the standby UI disappears as PowerBI loads.
    // When STANDBY fires (after duration), the display page will
    // close this window or navigate back to this standby page.
    return (
        <div
            className={`fixed inset-0 flex flex-col items-center justify-center bg-[#0a0a14] transition-opacity duration-300 ${state === "standby" ? "opacity-100" : "opacity-0"}`}
            style={{ zIndex: 9999 }}
        >
            {/* Animated PowerBI logo */}
            <div className="relative mb-10">
                {/* Outer glow rings */}
                <div className="absolute inset-0 rounded-full bg-yellow-400/10 animate-ping scale-150" />
                <div className="absolute inset-[-8px] rounded-2xl bg-yellow-400/5 animate-pulse" />

                {/* Logo box */}
                <div className="relative h-24 w-24 rounded-2xl bg-[#111827] border border-yellow-400/20 shadow-2xl shadow-yellow-400/10 flex items-center justify-center">
                    {/* PowerBI bar chart icon */}
                    <svg viewBox="0 0 32 32" className="h-14 w-14" fill="none">
                        <rect x="2" y="20" width="5" height="10" rx="1.5" fill="#F2C811" />
                        <rect x="9.5" y="13" width="5" height="17" rx="1.5" fill="#F2C811" opacity="0.85" />
                        <rect x="17" y="7" width="5" height="23" rx="1.5" fill="#F2C811" opacity="0.65" />
                        <rect x="24.5" y="2" width="5" height="28" rx="1.5" fill="#F2C811" opacity="0.4" />
                    </svg>
                </div>
            </div>

            {/* Status text */}
            <div className="text-center space-y-2">
                <p className="text-white font-semibold text-lg tracking-wide">Microsoft Power BI</p>
                <div className="flex items-center gap-2 justify-center">
                    {/* Animated dots */}
                    <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-bounce [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-bounce [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-bounce [animation-delay:300ms]" />
                </div>
                <p className="text-slate-500 text-xs font-mono mt-1">Connecting to workspace...</p>
            </div>

            {/* SignageHub watermark bottom */}
            <div className="absolute bottom-6 left-0 right-0 flex justify-center">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/5">
                    <div className="h-3.5 w-3.5 rounded bg-gradient-to-br from-blue-500 to-violet-600" />
                    <span className="text-slate-600 text-[10px] font-mono uppercase tracking-widest">SignageHub Display</span>
                </div>
            </div>
        </div>
    )
}
