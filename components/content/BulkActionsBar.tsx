"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"

interface BulkActionsBarProps {
    selectedCount: number
    onDeleteSelected: () => void
    onClearSelection: () => void
}

export const BulkActionsBar = React.memo(function BulkActionsBar({ selectedCount, onDeleteSelected }: BulkActionsBarProps) {
    if (selectedCount === 0) return null

    return (
        <div className="flex items-center justify-between p-3 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 rounded-lg border border-indigo-100 dark:border-indigo-800 animate-in slide-in-from-top-2">
            <div className="text-sm font-medium flex items-center">
                <span className="bg-indigo-200 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-200 h-6 w-6 flex items-center justify-center rounded-full mr-2 text-xs">
                    {selectedCount}
                </span>
                assets selected
            </div>
            <Button variant="outline" size="sm" className="border-indigo-200 hover:bg-indigo-100 text-red-600 border-red-200 hover:border-red-300 hover:text-red-700" onClick={onDeleteSelected}>
                <Trash2 className="h-4 w-4 mr-2" /> Delete Selected
            </Button>
        </div>
    )
})
