"use client"

import { useEffect, useRef, useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Monitor, RefreshCw, ExternalLink, Copy, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { getDisplayUrl } from "@/lib/app-url"

interface LiveScreenPreviewProps {
  displayKey: string
  screenName: string
  orientation: "landscape" | "portrait"
  isOnline: boolean
}

export function LiveScreenPreview({
  displayKey,
  screenName,
  orientation,
  isOnline,
}: LiveScreenPreviewProps) {
  const { toast } = useToast()
  const containerRef = useRef<HTMLDivElement>(null)
  const [scaleFactor, setScaleFactor] = useState(0.3)
  const [iframeKey, setIframeKey] = useState(0)

  const displayUrl = getDisplayUrl(displayKey)
  const previewUrl = `${displayUrl}?preview=true`

  // Native resolution based on orientation
  const nativeW = orientation === "landscape" ? 1920 : 1080
  const nativeH = orientation === "landscape" ? 1080 : 1920
  const aspectRatio = nativeH / nativeW

  // ResizeObserver to keep scale factor up to date
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect
        setScaleFactor(width / nativeW)
      }
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [nativeW])

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(displayUrl)
      toast({ title: "Display URL copied!" })
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" })
    }
  }

  const containerHeight = `calc(100% * ${aspectRatio})`

  return (
    <div className="space-y-3">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Monitor className="h-4 w-4 text-slate-500 shrink-0" />
          <span className="font-semibold text-sm truncate">{screenName}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Live badge */}
          {isOnline ? (
            <Badge
              variant="outline"
              className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-400 flex items-center gap-1.5"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400 flex items-center gap-1.5"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              OFFLINE
            </Badge>
          )}

          {/* Action buttons */}
          <div className="flex items-center">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setIframeKey((k) => k + 1)}
              title="Refresh preview"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => window.open(displayUrl, "_blank")}
              title="Open in new tab"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={copyUrl}
              title="Copy display URL"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Monitor frame + iframe */}
      <div className="rounded-xl overflow-hidden border-4 border-slate-800 dark:border-slate-600 shadow-2xl bg-black">
        {/* Bezel top bar */}
        <div className="h-2 bg-slate-800 dark:bg-slate-700 flex items-center justify-center">
          <div className="h-1 w-8 rounded-full bg-slate-700 dark:bg-slate-600" />
        </div>

        {/* iframe container */}
        <div
          ref={containerRef}
          className="relative w-full overflow-hidden bg-black"
          style={{ paddingBottom: `${aspectRatio * 100}%` }}
        >
          {!isOnline ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-center px-4">
              <WifiOff className="h-8 w-8 text-slate-600 mb-3" />
              <p className="text-slate-500 text-sm font-mono">Screen is offline or not responding</p>
            </div>
          ) : (
            <iframe
              key={iframeKey}
              src={previewUrl}
              title={`Live Preview — ${screenName}`}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: `${nativeW}px`,
                height: `${nativeH}px`,
                transform: `scale(${scaleFactor})`,
                transformOrigin: "top left",
                border: "none",
                pointerEvents: "none",
              }}
            />
          )}
        </div>

        {/* Bezel bottom bar */}
        <div className="h-3 bg-slate-800 dark:bg-slate-700" />
      </div>

      {/* QR Code section */}
      <div className="flex items-center gap-4 pt-1">
        <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm shrink-0">
          <QRCodeSVG value={displayUrl} size={80} level="M" />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-slate-500 font-medium">Scan to open on device</p>
          <button
            onClick={copyUrl}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-mono truncate max-w-[200px] block text-left"
          >
            {displayUrl.replace(/^https?:\/\//, "")}
          </button>
        </div>
      </div>
    </div>
  )
}
