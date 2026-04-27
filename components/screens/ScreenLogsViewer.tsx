"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { formatDistanceToNow } from "date-fns"
import { Activity, Radio } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface ScreenLog {
  id: string
  screen_id: string
  event: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details: any
  created_at: string
}

export function ScreenLogsViewer({ screenId }: { screenId: string }) {
  const supabase = createClient()
  const [logs, setLogs] = useState<ScreenLog[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchLogs = useCallback(async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('screen_logs')
      .select('*')
      .eq('screen_id', screenId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (!error && data) setLogs(data as ScreenLog[])
    setIsLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenId])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Realtime subscription for live log updates
  useEffect(() => {
    const channel = supabase
      .channel(`screen-logs-${screenId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'screen_logs',
        filter: `screen_id=eq.${screenId}`
      }, (payload) => {
        setLogs(prev => [payload.new as ScreenLog, ...prev].slice(0, 50))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenId])

  const getEventBadge = (event: string) => {
    switch (event) {
      case 'connect':
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-none">Connect</Badge>
      case 'disconnect':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-200 border-none">Disconnect</Badge>
      case 'heartbeat':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-none">Heartbeat</Badge>
      case 'status_change':
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-none">Status Change</Badge>
      case 'error':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-200 border-none">Error</Badge>
      default:
        return <Badge variant="secondary">{event}</Badge>
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Activity Logs
        </h3>
        <Badge variant="outline" className="flex items-center gap-1.5 animate-in fade-in bg-slate-50">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Live
        </Badge>
      </div>

      <div className="border rounded-md bg-white dark:bg-slate-950">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Time</TableHead>
              <TableHead className="w-[150px]">Event</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center">
                  <div className="flex items-center justify-center text-slate-500">
                    Loading logs...
                  </div>
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center text-slate-500">
                    <Radio className="h-8 w-8 text-slate-300 mb-2" />
                    No activity logged yet
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm text-slate-500 whitespace-nowrap">
                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    {getEventBadge(log.event)}
                  </TableCell>
                  <TableCell>
                    {!log.details || Object.keys(log.details).length === 0 ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 text-xs font-medium">
                            View JSON
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                          <DialogHeader>
                            <DialogTitle>Event Details</DialogTitle>
                          </DialogHeader>
                          <div className="bg-slate-950 rounded-md p-4 overflow-auto max-h-[400px]">
                            <pre className="text-xs text-emerald-400 font-mono whitespace-pre-wrap">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
