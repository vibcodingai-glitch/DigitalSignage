"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/hooks/use-user"
import { format } from "date-fns"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { MapPin, Search, Plus, MoreVertical, Edit, Trash2, LayoutGrid, List as ListIcon, MonitorPlay } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Location {
    id: string;
    organization_id: string;
    name: string;
    address: string | null;
    city: string | null;
    country: string | null;
    timezone: string | null;
    created_at: string;
    screens?: { count: number }[];
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

export default function LocationsPage() {
    const { profile } = useUser()
    const supabase = createClient()
    const { toast } = useToast()

    const [locations, setLocations] = useState<Location[]>([])
    const [isFetching, setIsFetching] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [viewMode, setViewMode] = useState<"list" | "grid">("list")

    // Dialog states
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [editingLocation, setEditingLocation] = useState<Location | null>(null)

    // Delete states
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [locationToDelete, setLocationToDelete] = useState<Location | null>(null)

    // Form states
    const [formData, setFormData] = useState({
        name: "",
        address: "",
        city: "",
        country: "",
        timezone: "UTC"
    })

    const fetchLocations = useCallback(async () => {
        setIsFetching(true)
        try {
            const { data, error } = await supabase
                .from('locations')
                .select('id, name, address, city, country, timezone, created_at, screens(count)')
                .order('name')

            if (error) throw error
            setLocations(data as unknown as Location[])
        } catch (error) {
            // AbortError is thrown by GoTrue's Web Locks API when auth lock is stolen by another
            // request (common in React StrictMode dev or multiple tabs). It is non-fatal — ignore it.
            if ((error as Error).name === 'AbortError') return
            toast({
                title: "Error loading locations",
                description: (error as Error).message,
                variant: "destructive"
            })
        } finally {
            setIsFetching(false)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        fetchLocations()
    }, [fetchLocations])

    const filteredLocations = locations.filter(loc =>
        loc.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const handleOpenForm = (location?: Location) => {
        if (location) {
            setEditingLocation(location)
            setFormData({
                name: location.name,
                address: location.address || "",
                city: location.city || "",
                country: location.country || "",
                timezone: location.timezone || "UTC"
            })
        } else {
            setEditingLocation(null)
            setFormData({
                name: "",
                address: "",
                city: "",
                country: "",
                timezone: "UTC"
            })
        }
        setIsFormOpen(true)
    }

    const handleSaveLocation = async (e: React.FormEvent) => {
        e.preventDefault()

        // profile loads async after session — fetch org_id directly to avoid race condition
        let orgId = profile?.organization_id
        if (!orgId) {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('organization_id')
                    .eq('id', user.id)
                    .single()
                orgId = profileData?.organization_id
            }
        }
        if (!orgId) {
            toast({ title: "Not ready", description: "Your session is still loading. Please try again.", variant: "destructive" })
            return
        }

        setIsSaving(true)
        try {
            const payload = {
                organization_id: orgId,
                name: formData.name,
                address: formData.address || null,
                city: formData.city || null,
                country: formData.country || null,
                timezone: formData.timezone
            }

            if (editingLocation) {
                const { error } = await supabase
                    .from('locations')
                    .update(payload)
                    .eq('id', editingLocation.id)
                if (error) throw error
                toast({ title: "Location updated successfully" })
            } else {
                const { error } = await supabase
                    .from('locations')
                    .insert(payload)
                if (error) throw error
                toast({ title: "Location created successfully" })
            }

            setIsFormOpen(false)
            fetchLocations()
        } catch (error) {
            toast({
                title: "Failed to save location",
                description: (error as Error).message,
                variant: "destructive"
            })
        } finally {
            setIsSaving(false)
        }
    }


    const handleConfirmDelete = async () => {
        if (!locationToDelete) return

        try {
            const { error } = await supabase
                .from('locations')
                .delete()
                .eq('id', locationToDelete.id)

            if (error) throw error

            toast({ title: "Location deleted successfully" })
            fetchLocations()
        } catch (error) {
            toast({
                title: "Failed to delete location",
                description: (error as Error).message,
                variant: "destructive"
            })
        } finally {
            setIsDeleteDialogOpen(false)
            setLocationToDelete(null)
        }
    }

    const handleDeleteClick = (location: Location) => {
        setLocationToDelete(location)
        setIsDeleteDialogOpen(true)
    }

    const getScreenCount = (location: Location) => {
        if (location.screens && location.screens.length > 0) {
            // Depending on Supabase select count formatting, it might be an array with one object { count: number }
            return location.screens[0].count;
        }
        return 0;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-2">
                    <MapPin className="h-6 w-6 text-blue-500" />
                    <h1 className="text-2xl font-bold tracking-tight">Locations</h1>
                </div>
                <Button onClick={() => handleOpenForm()}>
                    <Plus className="mr-2 h-4 w-4" /> Add Location
                </Button>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                    <Input
                        placeholder="Search locations..."
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 bg-white dark:bg-slate-950 p-1 rounded-md border border-slate-200 dark:border-slate-800">
                    <Button
                        variant={viewMode === "list" ? "secondary" : "ghost"}
                        size="sm"
                        className="px-2"
                        onClick={() => setViewMode("list")}
                    >
                        <ListIcon className="h-4 w-4" />
                    </Button>
                    <Button
                        variant={viewMode === "grid" ? "secondary" : "ghost"}
                        size="sm"
                        className="px-2"
                        onClick={() => setViewMode("grid")}
                    >
                        <LayoutGrid className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {isFetching ? (
                <div className="space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                </div>
            ) : filteredLocations.length === 0 ? (
                <Card className="border-dashed flex flex-col items-center justify-center py-12">
                    <MapPin className="h-12 w-12 text-slate-300 mb-4" />
                    <CardTitle className="text-xl mb-2">No locations found</CardTitle>
                    <CardDescription className="text-center max-w-sm mb-6">
                        {searchQuery ? "Try adjusting your search query." : "You haven't added any physical locations yet. Locations help you organize where your screens are physically deployed."}
                    </CardDescription>
                    {!searchQuery && (
                        <Button onClick={() => handleOpenForm()}>
                            <Plus className="mr-2 h-4 w-4" /> Add your first location
                        </Button>
                    )}
                </Card>
            ) : viewMode === "list" ? (
                <Card className="overflow-hidden border-slate-200 dark:border-slate-800 shadow-sm">
                    <Table>
                        <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>City, Country</TableHead>
                                <TableHead>Timezone</TableHead>
                                <TableHead className="text-center">Screens</TableHead>
                                <TableHead>Added</TableHead>
                                <TableHead className="w-[80px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredLocations.map((location) => (
                                <TableRow key={location.id} className="group">
                                    <TableCell className="font-medium">
                                        <Link href={`/dashboard/locations/${location.id}`} className="hover:text-blue-600 dark:hover:text-blue-400 font-semibold">
                                            {location.name}
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span>{location.city || '-'}</span>
                                            <span className="text-xs text-slate-500">{location.country || '-'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-slate-500 text-sm">{location.timezone || '-'}</TableCell>
                                    <TableCell className="text-center">
                                        <div className="inline-flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-full h-8 w-8 text-sm font-medium">
                                            {getScreenCount(location)}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-slate-500 text-sm">
                                        {format(new Date(location.created_at), 'MMM d, yyyy')}
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <span className="sr-only">Open menu</span>
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleOpenForm(location)}>
                                                    <Edit className="mr-2 h-4 w-4" /> Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteClick(location)}>
                                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredLocations.map((location) => (
                        <Card key={location.id} className="flex flex-col border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700">
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start">
                                    <Link href={`/dashboard/locations/${location.id}`} className="hover:text-blue-600 dark:hover:text-blue-400">
                                        <CardTitle className="inline-flex items-center gap-2">
                                            {location.name}
                                        </CardTitle>
                                    </Link>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0 -mt-2 -mr-2">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handleOpenForm(location)}>
                                                <Edit className="mr-2 h-4 w-4" /> Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteClick(location)}>
                                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                                <CardDescription className="flex items-center gap-1 text-xs mt-1">
                                    <MapPin className="h-3 w-3" />
                                    {location.city && location.country ? `${location.city}, ${location.country}` : location.address || "No address provided"}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1 pb-3">
                                <div className="text-sm bg-slate-50 dark:bg-slate-900 rounded-lg p-3 grid grid-cols-2 gap-2">
                                    <div className="flex flex-col">
                                        <span className="text-slate-500 text-xs text-uppercase font-medium tracking-wider mb-1">Timezone</span>
                                        <span className="font-medium">{location.timezone || 'Not set'}</span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-slate-500 text-xs text-uppercase font-medium tracking-wider mb-1">Created</span>
                                        <span className="font-medium">{format(new Date(location.created_at), 'MMM yyyy')}</span>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="pt-0 border-t border-slate-100 dark:border-slate-800/50 mt-auto px-6 py-4 flex justify-between items-center">
                                <div className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300">
                                    <MonitorPlay className="h-4 w-4 mr-2 text-indigo-500" />
                                    {getScreenCount(location)} active screens
                                </div>
                                <Button variant="secondary" size="sm" asChild>
                                    <Link href={`/dashboard/locations/${location.id}`}>
                                        View Details
                                    </Link>
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}

            {/* Add/Edit Location Dialog */}
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{editingLocation ? 'Edit Location' : 'Add New Location'}</DialogTitle>
                        <DialogDescription>
                            Organize your screens by geographical locations.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSaveLocation}>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Location Name *</Label>
                                <Input
                                    id="name"
                                    placeholder="e.g. Downtown Branch"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="address">Street Address</Label>
                                <Input
                                    id="address"
                                    placeholder="123 Main St"
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="city">City</Label>
                                    <Input
                                        id="city"
                                        placeholder="New York"
                                        value={formData.city}
                                        onChange={e => setFormData({ ...formData, city: e.target.value })}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="country">Country</Label>
                                    <Input
                                        id="country"
                                        placeholder="USA"
                                        value={formData.country}
                                        onChange={e => setFormData({ ...formData, country: e.target.value })}
                                    />
                                </div>
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
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSaving || !formData.name}>
                                {isSaving ? "Saving..." : "Save Location"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Alert */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the <strong>{locationToDelete?.name}</strong> location.
                            {locationToDelete && getScreenCount(locationToDelete) > 0 && (
                                <div className="mt-2 text-amber-600 font-medium">
                                    Warning: This location currently has {getScreenCount(locationToDelete)} screen(s) assigned to it.
                                    Deleting it will leave these screens unassigned.
                                </div>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
