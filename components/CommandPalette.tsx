"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Command } from "cmdk"
import { Search, MonitorPlay, Layers, Library, Megaphone, Settings, Users, Activity, FileVideo, LayoutDashboard } from "lucide-react"

export function CommandPalette() {
    const [open, setOpen] = React.useState(false)
    const router = useRouter()

    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setOpen((open) => !open)
            }
        }
        document.addEventListener("keydown", down)
        return () => document.removeEventListener("keydown", down)
    }, [])

    const runCommand = React.useCallback((command: () => void) => {
        setOpen(false)
        command()
    }, [])

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
            
            {/* Command Dialog */}
            <div className="relative z-50 w-full max-w-xl rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden dark:border-slate-800 dark:bg-slate-950 animate-in fade-in zoom-in-95 duration-200">
                <Command className="flex h-full w-full flex-col bg-transparent">
                    <div className="flex items-center border-b border-slate-200 dark:border-slate-800 px-3">
                        <Search className="mr-2 h-4 w-4 shrink-0 text-slate-500 opacity-50" />
                        <Command.Input 
                            autoFocus
                            placeholder="Type a command or search..." 
                            className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-50" 
                        />
                    </div>
                    
                    <Command.List className="max-h-[300px] overflow-y-auto overflow-x-hidden p-2">
                        <Command.Empty className="py-6 text-center text-sm text-slate-500">No results found.</Command.Empty>
                        
                        <Command.Group heading={<div className="px-2 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">Navigation</div>}>
                            <Command.Item
                                onSelect={() => runCommand(() => router.push("/dashboard"))}
                                className="relative flex cursor-pointer select-none items-center rounded-md px-2 py-2 text-sm outline-none aria-selected:bg-slate-100 aria-selected:text-slate-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 dark:aria-selected:bg-slate-800 dark:aria-selected:text-slate-50"
                            >
                                <LayoutDashboard className="mr-2 h-4 w-4" />
                                <span>Overview</span>
                            </Command.Item>
                            <Command.Item
                                onSelect={() => runCommand(() => router.push("/dashboard/screens"))}
                                className="relative flex cursor-pointer select-none items-center rounded-md px-2 py-2 text-sm outline-none aria-selected:bg-slate-100 aria-selected:text-slate-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 dark:aria-selected:bg-slate-800 dark:aria-selected:text-slate-50"
                            >
                                <MonitorPlay className="mr-2 h-4 w-4" />
                                <span>Screens & Endpoints</span>
                            </Command.Item>
                            <Command.Item
                                onSelect={() => runCommand(() => router.push("/dashboard/projects"))}
                                className="relative flex cursor-pointer select-none items-center rounded-md px-2 py-2 text-sm outline-none aria-selected:bg-slate-100 aria-selected:text-slate-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 dark:aria-selected:bg-slate-800 dark:aria-selected:text-slate-50"
                            >
                                <Layers className="mr-2 h-4 w-4" />
                                <span>Projects & Timelines</span>
                            </Command.Item>
                            <Command.Item
                                onSelect={() => runCommand(() => router.push("/dashboard/content"))}
                                className="relative flex cursor-pointer select-none items-center rounded-md px-2 py-2 text-sm outline-none aria-selected:bg-slate-100 aria-selected:text-slate-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 dark:aria-selected:bg-slate-800 dark:aria-selected:text-slate-50"
                            >
                                <Library className="mr-2 h-4 w-4" />
                                <span>Content Library</span>
                            </Command.Item>
                        </Command.Group>

                        <Command.Group heading={<div className="px-2 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 mt-2">Actions</div>}>
                            <Command.Item
                                onSelect={() => runCommand(() => router.push("/dashboard/events"))}
                                className="relative flex cursor-pointer select-none items-center rounded-md px-2 py-2 text-sm outline-none aria-selected:bg-slate-100 aria-selected:text-slate-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 dark:aria-selected:bg-slate-800 dark:aria-selected:text-slate-50 text-indigo-600 dark:text-indigo-400"
                            >
                                <Megaphone className="mr-2 h-4 w-4" />
                                <span>Trigger Push Event...</span>
                            </Command.Item>
                            <Command.Item
                                onSelect={() => runCommand(() => router.push("/dashboard/content"))}
                                className="relative flex cursor-pointer select-none items-center rounded-md px-2 py-2 text-sm outline-none aria-selected:bg-slate-100 aria-selected:text-slate-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 dark:aria-selected:bg-slate-800 dark:aria-selected:text-slate-50 text-blue-600 dark:text-blue-400"
                            >
                                <FileVideo className="mr-2 h-4 w-4" />
                                <span>Upload New Asset...</span>
                            </Command.Item>
                        </Command.Group>
                        
                        <Command.Group heading={<div className="px-2 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 mt-2">System</div>}>
                            <Command.Item
                                onSelect={() => runCommand(() => router.push("/dashboard/monitoring"))}
                                className="relative flex cursor-pointer select-none items-center rounded-md px-2 py-2 text-sm outline-none aria-selected:bg-slate-100 aria-selected:text-slate-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 dark:aria-selected:bg-slate-800 dark:aria-selected:text-slate-50"
                            >
                                <Activity className="mr-2 h-4 w-4" />
                                <span>System Monitoring</span>
                            </Command.Item>
                            <Command.Item
                                onSelect={() => runCommand(() => router.push("/dashboard/settings/team"))}
                                className="relative flex cursor-pointer select-none items-center rounded-md px-2 py-2 text-sm outline-none aria-selected:bg-slate-100 aria-selected:text-slate-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 dark:aria-selected:bg-slate-800 dark:aria-selected:text-slate-50"
                            >
                                <Users className="mr-2 h-4 w-4" />
                                <span>Team Management</span>
                            </Command.Item>
                            <Command.Item
                                onSelect={() => runCommand(() => router.push("/dashboard/settings"))}
                                className="relative flex cursor-pointer select-none items-center rounded-md px-2 py-2 text-sm outline-none aria-selected:bg-slate-100 aria-selected:text-slate-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 dark:aria-selected:bg-slate-800 dark:aria-selected:text-slate-50"
                            >
                                <Settings className="mr-2 h-4 w-4" />
                                <span>Settings</span>
                            </Command.Item>
                        </Command.Group>
                    </Command.List>
                    
                    <div className="flex items-center border-t border-slate-200 dark:border-slate-800 px-4 py-3 text-xs text-slate-500">
                        <kbd className="mr-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">↑↓</kbd> to navigate
                        <kbd className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">↵</kbd> to select
                        <kbd className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">Esc</kbd> to close
                    </div>
                </Command>
            </div>
        </div>
    )
}
