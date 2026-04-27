"use client"

import { Play, Pause } from "lucide-react"

interface NowPlayingBadgeProps {
  projectName: string | null
  contentName: string | null
  isPlaying: boolean
}

export function NowPlayingBadge({ projectName, contentName, isPlaying }: NowPlayingBadgeProps) {
  if (!isPlaying || !projectName) {
    return (
      <div className="flex items-center gap-2 text-slate-500 text-sm">
        <Pause className="h-3.5 w-3.5 text-slate-400" />
        <span className="font-mono text-xs">No content playing</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="relative flex items-center justify-center shrink-0">
        <div className="absolute h-4 w-4 rounded-full bg-emerald-500/20 animate-ping" />
        <Play className="h-3.5 w-3.5 text-emerald-500 fill-emerald-500 relative z-10" />
      </div>
      <div className="flex items-center gap-1 min-w-0">
        <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
          {projectName}
        </span>
        {contentName && (
          <>
            <span className="text-slate-400 shrink-0">—</span>
            <span className="text-slate-500 dark:text-slate-400 truncate text-xs">
              {contentName}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
