"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { assignProjectToScreen } from "@/lib/screen-projects"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Monitor, MapPin, Search, CheckCircle2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"

interface Screen {
  id: string
  name: string
  status: string
  location?: { name: string }
}

interface AssignToScreenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  organizationId: string
  onSuccess: () => void
}

export function AssignToScreenDialog({
  open,
  onOpenChange,
  projectId,
  organizationId,
  onSuccess,
}: AssignToScreenDialogProps) {
  const supabase = createClient()
  const { toast } = useToast()

  const [screens, setScreens] = useState<Screen[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedScreenId, setSelectedScreenId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const loadScreens = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from("screens")
          .select("id, name, status, location:locations(name)")
          .eq("organization_id", organizationId)
          .order("name")

        if (error) throw error
        setScreens(data as any[])
      } catch (err) {
        console.error("Failed to load screens:", err)
      } finally {
        setLoading(false)
      }
    }
    loadScreens()
  }, [open, organizationId, supabase])

  const filteredScreens = screens.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleAssign = async () => {
    if (!selectedScreenId) return

    setIsSaving(true)
    try {
      // 1. Update project.screen_id for legacy/primary association
      await supabase
        .from("projects")
        .update({ screen_id: selectedScreenId })
        .eq("id", projectId)

      // 2. Create a screen_projects assignment (Always On)
      // Check if already assigned first to avoid unique constraint error
      const { data: existing } = await supabase
        .from("screen_projects")
        .select("id")
        .eq("screen_id", selectedScreenId)
        .eq("project_id", projectId)
        .single()

      if (!existing) {
        await assignProjectToScreen({
          screen_id: selectedScreenId,
          project_id: projectId,
          organization_id: organizationId,
          schedule_type: "always",
          priority: 0,
        })
      }

      // 3. Send FORCE_RELOAD broadcast
      const channel = supabase.channel(`screen-${selectedScreenId}`)
      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.send({
            type: "broadcast",
            event: "command",
            payload: { command: "FORCE_RELOAD" },
          })
          supabase.removeChannel(channel)
        }
      })

      toast({
        title: "Project Bound Successfully",
        description: "The screen has been instructed to start broadcasting this project.",
      })
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      toast({
        title: "Assignment Failed",
        description: (err as Error).message,
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bind Project to Screen</DialogTitle>
          <DialogDescription>
            Select a target screen to broadcast this project. This will set it as the primary feed for that screen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search screens..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <ScrollArea className="h-64 rounded-md border border-slate-200 dark:border-slate-800 p-2">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="h-6 w-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              </div>
            ) : filteredScreens.length === 0 ? (
              <div className="text-center py-10 text-sm text-slate-500">
                No screens found.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredScreens.map((screen) => (
                  <button
                    key={screen.id}
                    onClick={() => setSelectedScreenId(screen.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left ${
                      selectedScreenId === screen.id
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 dark:border-indigo-400"
                        : "border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-md ${
                        screen.status === 'online' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'
                      }`}>
                        <Monitor className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{screen.name}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {screen.location?.name || 'No Location'}
                        </div>
                      </div>
                    </div>
                    {selectedScreenId === screen.id && (
                      <CheckCircle2 className="h-5 w-5 text-indigo-500" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedScreenId || isSaving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {isSaving ? "Binding..." : "Confirm Binding"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
