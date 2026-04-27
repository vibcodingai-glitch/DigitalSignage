"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/hooks/use-user"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { MapPin, ArrowLeft, Monitor, Plus, Edit, Image as ImageIcon, CheckCircle2, XCircle, AlertCircle, Save, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Location {
    id: string;
    organization_id: string;
    name: string;
    address: string | null;
    city: string | null;
    country: string | null;
    timezone: string | null;
}

interface Screen {
    id: string;
    name: string;
    status: string;
    project?: { name: string } | null;
}

const timezones = [
    "UTC",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Paris",
    "Asia/Tokyo",
    "Asia/Dubai",
    "Australia/Sydney"
];

export default function LocationDetailPage({ params }: { params: { id: string } }) {
    const { profile } = useUser()
    const supabase = createClient()
    const { toast } = useToast()
    const router = useRouter()

    const [location, setLocation] = useState<Location | null>(null)
    const [screens, setScreens] = useState<Screen[]>([])
    const [isLoading, setIsLoading] = useState(true)

    // Edit state
    const [isEditing, setIsEditing] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [formData, setFormData] = useState({
        name: "",
        address: "",
        city: "",
        country: "",
        timezone: "UTC"
    })

    const fetchLocationData = useCallback(async () => {
        setIsLoading(true)
        try {
            const [{ data: locData, error: locError }, { data: screensData, error: screensError }] = await Promise.all([
                supabase
                    .from('locations')
                    .select('*')
                    .eq('id', params.id)
                    .single(),
                supabase
                    .from('screens')
                    .select('id, name, status, project:projects(name)')
                    .eq('location_id', params.id)
                    .order('name')
            ])

            if (locError) throw locError
            if (screensError) throw screensError

            setLocation(locData as Location)
            setFormData({
                name: locData.name,
                address: locData.address || "",
                city: locData.city || "",
                country: locData.country || "",
                timezone: locData.timezone || "UTC"
            })
            setScreens(screensData as unknown as Screen[])

        } catch (error) {
            toast({
                title: "Error loading location details",
                description: (error as Error).message,
                variant: "destructive"
            })
            router.push('/dashboard/locations')
        } finally {
            setIsLoading(false)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.id])

    useEffect(() => {
        fetchLocationData()
    }, [fetchLocationData])

    const handleSaveLocation = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!location) return

        setIsSaving(true)
        try {
            const { error } = await supabase
                .from('locations')
                .update({
                    name: formData.name,
                    address: formData.address,
                    city: formData.city,
                    country: formData.country,
                    timezone: formData.timezone
                })
                .eq('id', location.id)

            if (error) throw error

            toast({ title: "Location details updated" })
            setLocation({ ...location, ...formData })
            setIsEditing(false)
        } catch (error) {
            toast({
                title: "Failed to update location",
                description: (error as Error).message,
                variant: "destructive"
            })
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-8 w-64" />
                </div>
                <Card className="border-slate-200 dark:border-slate-800">
                    <CardHeader>
                        <Skeleton className="h-6 w-48 mb-2" />
                        <Skeleton className="h-4 w-96" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-40 w-full" />
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (!location) return null;

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center gap-4 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors w-fit">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" asChild>
                    <Link href="/dashboard/locations">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div className="flex items-center gap-2 font-medium">
                    Back to Locations
                </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 rounded-lg">
                        <MapPin className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{location.name}</h1>
                        <p className="text-slate-500 text-sm">
                            {location.city && location.country ? `${location.city}, ${location.country}` : location.address || "No address provided"}
                        </p>
                    </div>
                </div>
                {!isEditing && (
                    <Button variant="outline" onClick={() => setIsEditing(true)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit Location
                    </Button>
                )}
            </div>

            <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="h-2 w-full bg-blue-500"></div>
                <CardHeader>
                    <CardTitle className="text-lg">Location Details</CardTitle>
                    <CardDescription>Manage the physical address and timezone for this location.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isEditing ? (
                        <form onSubmit={handleSaveLocation} className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Location Name *</Label>
                                    <Input
                                        id="name"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="timezone">Timezone</Label>
                                    <Select
                                        value={formData.timezone}
                                        onValueChange={v => setFormData({ ...formData, timezone: v })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select timezone" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {timezones.map(tz => (
                                                <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2 sm:col-span-2">
                                    <Label htmlFor="address">Street Address</Label>
                                    <Input
                                        id="address"
                                        value={formData.address}
                                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="city">City</Label>
                                    <Input
                                        id="city"
                                        value={formData.city}
                                        onChange={e => setFormData({ ...formData, city: e.target.value })}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="country">Country</Label>
                                    <Input
                                        id="country"
                                        value={formData.country}
                                        onChange={e => setFormData({ ...formData, country: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="pt-4 flex items-center gap-2 justify-end border-t border-slate-100 dark:border-slate-800 mt-6">
                                <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>
                                    <X className="mr-2 h-4 w-4" /> Cancel
                                </Button>
                                <Button type="submit" disabled={isSaving || !formData.name}>
                                    {isSaving ? "Saving..." : <><Save className="mr-2 h-4 w-4" /> Save Changes</>}
                                </Button>
                            </div>
                        </form>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-lg border border-slate-100 dark:border-slate-800">
                            <div>
                                <h4 className="text-sm font-medium text-slate-500 mb-1 tracking-wide uppercase">Street Address</h4>
                                <p className="text-slate-900 dark:text-slate-100">{location.address || "—"}</p>
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-slate-500 mb-1 tracking-wide uppercase">City</h4>
                                <p className="text-slate-900 dark:text-slate-100">{location.city || "—"}</p>
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-slate-500 mb-1 tracking-wide uppercase">Country</h4>
                                <p className="text-slate-900 dark:text-slate-100">{location.country || "—"}</p>
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-slate-500 mb-1 tracking-wide uppercase">Timezone</h4>
                                <p className="text-slate-900 dark:text-slate-100 font-medium">{location.timezone || "UTC"}</p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="space-y-4 pt-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Monitor className="h-5 w-5 text-indigo-500" />
                            Screens at this Location
                        </h2>
                        <p className="text-slate-500 text-sm">Manage hardware endpoints deployed here.</p>
                    </div>
                    <Button asChild>
                        {/* We will build /dashboard/screens/new later. For now link to it and prefill location via query params */}
                        <Link href={`/dashboard/screens/new?location_id=${location.id}`}>
                            <Plus className="mr-2 h-4 w-4" /> Add Screen
                        </Link>
                    </Button>
                </div>

                {screens.length === 0 ? (
                    <Card className="border-dashed flex flex-col items-center justify-center py-16">
                        <Monitor className="h-12 w-12 text-slate-300 mb-4" />
                        <CardTitle className="text-xl mb-2">No screens deployed here</CardTitle>
                        <CardDescription className="text-center max-w-sm mb-6">
                            You haven&apos;t assigned any digital signage screens to {location.name} yet.
                        </CardDescription>
                        <Button asChild variant="outline">
                            <Link href={`/dashboard/screens/new?location_id=${location.id}`}>
                                <Plus className="mr-2 h-4 w-4" /> Deploy a Screen
                            </Link>
                        </Button>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {screens.map((screen) => (
                            <Link key={screen.id} href={`/dashboard/screens/${screen.id}`} className="group block h-full">
                                <Card className="h-full overflow-hidden transition-all hover:shadow-md border-slate-200 hover:border-indigo-400 dark:border-slate-800 dark:hover:border-indigo-500 bg-white dark:bg-slate-900">
                                    <div className="aspect-video bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden group-hover:bg-slate-200 dark:group-hover:bg-slate-900 transition-colors">
                                        <ImageIcon className="h-8 w-8 text-slate-300 dark:text-slate-700" />
                                    </div>
                                    <div className="p-4 border-t border-slate-100 dark:border-slate-800">
                                        <div className="flex items-center justify-between mb-1">
                                            <h3 className="font-semibold text-sm truncate pr-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{screen.name}</h3>
                                            {screen.status === 'online' ? (
                                                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                            ) : screen.status === 'offline' ? (
                                                <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                                            ) : (
                                                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-500 truncate">
                                            {screen.project?.name ? `Playing: ${screen.project.name}` : 'No active project'}
                                        </div>
                                    </div>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
