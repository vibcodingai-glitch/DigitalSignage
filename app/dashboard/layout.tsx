"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { Monitor, MapPin, FolderOpen, Layers, Bell, Settings, LayoutDashboard, Menu, Plus, Users, Activity } from "lucide-react"

import { SidebarProvider, SidebarTrigger, Sidebar, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter, useSidebar } from "@/components/ui/sidebar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LogoutButton } from "@/components/logout-button"
import { useUser } from "@/hooks/use-user"
import { ThemeToggle } from "@/components/theme-toggle"
import { SWRConfig } from "swr"

const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Locations", href: "/dashboard/locations", icon: MapPin },
    { name: "Screens", href: "/dashboard/screens", icon: Monitor },
    { name: "Content Library", href: "/dashboard/content", icon: FolderOpen },
    { name: "Projects", href: "/dashboard/projects", icon: Layers },
    { name: "Push Events", href: "/dashboard/push-events", icon: Bell },
    { name: "Monitoring", href: "/dashboard/monitoring", icon: Activity },
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
    { name: "Team Settings", href: "/dashboard/settings/team", icon: Users },
]

const navGroups = [
    {
        label: "Overview",
        items: [
            { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        ]
    },
    {
        label: "Network",
        items: [
            { name: "Screens", href: "/dashboard/screens", icon: Monitor },
            { name: "Locations", href: "/dashboard/locations", icon: MapPin },
        ]
    },
    {
        label: "Content",
        items: [
            { name: "Content Library", href: "/dashboard/content", icon: FolderOpen },
            { name: "Projects", href: "/dashboard/projects", icon: Layers },
        ]
    },
    {
        label: "Control",
        items: [
            { name: "Push Events", href: "/dashboard/push-events", icon: Bell },
            { name: "Monitoring", href: "/dashboard/monitoring", icon: Activity },
        ]
    },
    {
        label: "Admin",
        items: [
            { name: "Settings", href: "/dashboard/settings", icon: Settings },
            { name: "Team", href: "/dashboard/settings/team", icon: Users },
        ]
    },
]

function AppSidebar() {
    const pathname = usePathname()
    const { user, profile } = useUser()

    const getInitials = (name?: string) => {
        if (!name) return "U"
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    }

    return (
        <Sidebar className="border-r-0 bg-[#0a0a12] text-slate-50">
            {/* Brand Header */}
            <SidebarHeader className="h-16 flex items-center px-5 border-b border-white/5">
                <Link href="/dashboard" className="flex items-center gap-2.5 font-bold text-xl tracking-tight hover:opacity-90 transition-opacity">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-500/30">
                        <Monitor className="h-4 w-4 text-white" />
                    </div>
                    <span className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                        SignageHub
                    </span>
                </Link>
            </SidebarHeader>

            <SidebarContent className="px-3 py-3">
                {navGroups.map((group) => (
                    <div key={group.label} className="mb-1">
                        <p className="px-3 mb-1 mt-4 text-[10px] font-semibold uppercase tracking-widest text-slate-600 select-none first:mt-2">
                            {group.label}
                        </p>
                        <SidebarMenu>
                            {group.items.map((item) => {
                                const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                                return (
                                    <SidebarMenuItem key={item.name}>
                                        <SidebarMenuButton
                                            asChild
                                            isActive={isActive}
                                            className={`mb-0.5 transition-all rounded-lg ${
                                                isActive
                                                    ? 'bg-gradient-to-r from-blue-600/20 to-violet-600/10 text-white border border-blue-500/20 shadow-sm shadow-blue-500/10'
                                                    : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
                                            }`}
                                        >
                                            <Link href={item.href} className="flex items-center gap-3 px-3 py-2">
                                                <item.icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-blue-400' : ''}`} />
                                                <span className="font-medium text-sm">{item.name}</span>
                                                {isActive && (
                                                    <div className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-400 shadow-sm shadow-blue-400/50" />
                                                )}
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                )
                            })}
                        </SidebarMenu>
                    </div>
                ))}
            </SidebarContent>

            {/* User Footer */}
            <SidebarFooter className="p-3 border-t border-white/5">
                {user ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                className="w-full justify-start gap-3 px-3 py-5 rounded-lg hover:bg-white/5 text-slate-300"
                            >
                                <Avatar className="h-8 w-8 border border-white/10 shrink-0">
                                    <AvatarImage src={profile?.avatar_url || ""} />
                                    <AvatarFallback className="bg-gradient-to-br from-blue-600 to-violet-700 text-white text-xs font-bold">
                                        {getInitials(profile?.full_name)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col items-start text-sm truncate">
                                    <span className="font-semibold text-white text-sm leading-tight">{profile?.full_name || user.email}</span>
                                    <span className="text-[11px] text-slate-500 capitalize leading-tight mt-0.5">{profile?.role || "user"}</span>
                                </div>
                                <Badge className="ml-auto shrink-0 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] px-1.5 py-0 h-5 capitalize">
                                    {profile?.role || "user"}
                                </Badge>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" side="top" className="w-56 bg-[#0e0e1a] border-white/10 text-slate-200">
                            <DropdownMenuLabel className="text-slate-400 text-xs">My Account</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-white/5" />
                            <DropdownMenuItem asChild className="cursor-pointer hover:bg-white/5 focus:bg-white/5">
                                <Link href="/dashboard/settings/profile">Profile</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild className="cursor-pointer hover:bg-white/5 focus:bg-white/5">
                                <Link href="/dashboard/settings">Settings</Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-white/5" />
                            <div className="p-1">
                                <LogoutButton />
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : (
                    <div className="flex items-center gap-3 px-3 py-2">
                        <div className="h-8 w-8 rounded-full bg-white/5 animate-pulse shrink-0" />
                        <div className="space-y-1.5 flex-1">
                            <div className="h-3.5 bg-white/5 rounded animate-pulse w-3/4" />
                            <div className="h-2.5 bg-white/5 rounded animate-pulse w-1/2" />
                        </div>
                    </div>
                )}
            </SidebarFooter>
        </Sidebar>
    )
}

function Topbar() {
    const pathname = usePathname()
    const { profile, user, isLoading } = useUser()
    const { toggleSidebar, isMobile } = useSidebar()

    const currentNavItem = navItems.find(item => item.href === pathname)
    const pageTitle = currentNavItem ? currentNavItem.name : "Overview"

    const orgName = profile?.organizations?.name
        || (user?.email ? user.email.split('@')[1]?.split('.')[0] : null)
        || (isLoading ? '...' : 'My Workspace')

    return (
        <header className="sticky top-0 z-10 flex h-14 w-full items-center justify-between border-b border-slate-200/80 bg-white/80 backdrop-blur-md px-4 dark:border-white/5 dark:bg-[#070710]/80 sm:px-6">
            <div className="flex items-center gap-3">
                {isMobile ? (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleSidebar}>
                        <Menu className="h-4 w-4" />
                    </Button>
                ) : (
                    <SidebarTrigger className="h-8 w-8 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white" />
                )}

                <div className="flex items-center gap-2">
                    <Badge className="hidden border-0 bg-gradient-to-r from-blue-500/10 to-violet-500/10 text-blue-600 dark:text-blue-400 sm:flex px-2.5 py-0.5 text-xs font-medium">
                        {String(orgName)}
                    </Badge>
                    <span className="hidden text-slate-300 dark:text-slate-700 sm:block text-sm">/</span>
                    <h1 className="text-sm font-semibold text-slate-800 dark:text-white sm:text-base">
                        {pageTitle}
                    </h1>
                </div>
            </div>

            <div className="flex items-center gap-1.5">
                <ThemeToggle />
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                >
                    <Bell className="h-4 w-4" />
                    <span className="sr-only">Notifications</span>
                </Button>
                <Button
                    size="sm"
                    className="hidden sm:flex gap-1.5 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 border-0 shadow-md shadow-blue-500/20 text-white text-xs h-8 px-3"
                    asChild
                >
                    <Link href="/dashboard/screens/new">
                        <Plus className="h-3.5 w-3.5" /> New Screen
                    </Link>
                </Button>
                <Button size="icon" className="sm:hidden h-8 w-8 bg-gradient-to-r from-blue-600 to-violet-600 border-0" asChild>
                    <Link href="/dashboard/screens/new">
                        <Plus className="h-4 w-4" />
                        <span className="sr-only">New Screen</span>
                    </Link>
                </Button>
            </div>
        </header>
    )
}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <SWRConfig value={{
            revalidateOnFocus: false,
            revalidateOnReconnect: true,
            dedupingInterval: 30_000,
            keepPreviousData: true,
        }}>
            <SidebarProvider>
                <div className="flex min-h-screen w-full bg-slate-50 dark:bg-[#070710]">
                    <AppSidebar />
                    <main className="flex w-0 flex-1 flex-col overflow-hidden">
                        <Topbar />
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                            {children}
                        </div>
                    </main>
                </div>
            </SidebarProvider>
        </SWRConfig>
    )
}
