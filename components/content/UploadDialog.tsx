"use client"

import React, { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import {
    UploadCloud, Image as ImageIcon,
    Video as VideoIcon, File as FileIcon, X, ArrowUpCircle
} from "lucide-react"
import type { ContentItem } from "@/components/dashboard/ContentClient"

interface UploadFileItem {
    file: File
    progress: number
    status: 'pending' | 'uploading' | 'success' | 'error'
    error?: string
    duration: number
    name: string
}

interface UploadDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onUploadComplete: () => void
}

export const UploadDialog = React.memo(function UploadDialog({ open, onOpenChange, onUploadComplete }: UploadDialogProps) {
    const { toast } = useToast()

    const [uploadFiles, setUploadFiles] = useState<UploadFileItem[]>([])
    const [isUploading, setIsUploading] = useState(false)

    // Reset state when dialog opens
    const handleOpenChange = (v: boolean) => {
        if (!isUploading) {
            if (v) setUploadFiles([])
            onOpenChange(v)
        }
    }

    const onDrop = useCallback((acceptedFiles: File[]) => {
        const newFiles = acceptedFiles.map(file => ({
            file,
            progress: 0,
            status: 'pending' as const,
            duration: 10,
            name: file.name
        }))
        setUploadFiles(prev => [...prev, ...newFiles])
    }, [])

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp', '.svg'],
            'video/*': ['.mp4', '.webm', '.ogg', '.mov'],
            'audio/*': ['.mp3', '.wav', '.ogg']
        }
    })

    const updateUploadState = (index: number, updates: Partial<UploadFileItem>) => {
        setUploadFiles(prev => {
            const clone = [...prev]
            clone[index] = { ...clone[index], ...updates }
            return clone
        })
    }

    const removeFileFromQueue = (index: number) => {
        setUploadFiles(prev => prev.filter((_, i) => i !== index))
    }

    const startUploads = async () => {
        setIsUploading(true)

        for (let i = 0; i < uploadFiles.length; i++) {
            if (uploadFiles[i].status === 'success') continue;

            const fileItem = uploadFiles[i]
            updateUploadState(i, { status: 'uploading', progress: 10 })

            // Progress Simulator
            const progressTimer = setInterval(() => {
                setUploadFiles(prev => {
                    const clone = [...prev]
                    if (clone[i].progress < 90) {
                        clone[i].progress += 5
                    }
                    return clone
                })
            }, 300)

            try {
                // Upload entirely via server-side API to bypass Web Locks deadlock
                const formData = new FormData()
                formData.append('file', fileItem.file)
                formData.append('name', fileItem.name)
                formData.append('duration', String(fileItem.duration))

                const res = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                })

                clearInterval(progressTimer)

                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}))
                    throw new Error(errData.error || 'Upload failed')
                }

                updateUploadState(i, { status: 'success', progress: 100 })
            } catch (error) {
                clearInterval(progressTimer)
                updateUploadState(i, { status: 'error', error: (error as Error).message })
            }
        }

        setIsUploading(false)
        onUploadComplete()
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Upload Media Library Assets</DialogTitle>
                    <DialogDescription>
                        Drag native static media (JPG, MP4, MP3) into this bucket workspace.
                    </DialogDescription>
                </DialogHeader>

                <div className="overflow-y-auto pr-2 pb-2">
                    {/* Dropzone */}
                    <div
                        {...getRootProps()}
                        className={`border-2 border-dashed rounded-xl p-8 transition-colors flex flex-col items-center justify-center cursor-pointer text-center bg-slate-50/50 dark:bg-slate-900/20
                            ${isDragActive ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900'}
                            ${isUploading ? 'pointer-events-none opacity-50' : ''}`
                        }
                    >
                        <input {...getInputProps()} />
                        <div className="bg-white dark:bg-slate-950 p-3 rounded-full shadow-sm border border-slate-100 dark:border-slate-800 mb-3">
                            <UploadCloud className={`h-6 w-6 ${isDragActive ? 'text-indigo-500' : 'text-slate-400'}`} />
                        </div>
                        <h4 className="font-semibold text-slate-800 dark:text-slate-200">
                            {isDragActive ? "Drop files now..." : "Drag files here to queue uploads"}
                        </h4>
                        <p className="text-sm text-slate-500 mt-1">Or click to manually browse your machine.</p>
                    </div>

                    {/* Queue List */}
                    {uploadFiles.length > 0 && (
                        <div className="mt-6 space-y-3">
                            <Label className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 dark:border-slate-800 pb-2">
                                <span>Upload Queue</span>
                                <span>{uploadFiles.length} files</span>
                            </Label>

                            {uploadFiles.map((uf, i) => (
                                <div key={i} className={`p-3 rounded-lg border flex gap-3 ${uf.status === 'success' ? 'bg-emerald-50/50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/30' : uf.status === 'error' ? 'bg-red-50/50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30' : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800'}`}>
                                    <div className="h-10 w-10 shrink-0 bg-slate-100 dark:bg-slate-900 rounded-md flex items-center justify-center">
                                        {uf.file.type.startsWith('image') ? <ImageIcon className="h-4 w-4 text-slate-400" /> :
                                            uf.file.type.startsWith('video') ? <VideoIcon className="h-4 w-4 text-slate-400" /> :
                                                <FileIcon className="h-4 w-4 text-slate-400" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <Input
                                                value={uf.name}
                                                onChange={(e) => updateUploadState(i, { name: e.target.value })}
                                                className="h-6 text-xs px-2 w-[55%] border-transparent hover:border-slate-200 focus:border-indigo-500 bg-transparent font-medium"
                                                disabled={isUploading || uf.status === 'success'}
                                            />
                                            {!uf.file.type.startsWith('video/') && (
                                                <div className="flex items-center gap-2">
                                                    <Label className="text-[10px] text-slate-500">Dur.(s)</Label>
                                                    <Input
                                                        type="number"
                                                        value={uf.duration}
                                                        onChange={(e) => updateUploadState(i, { duration: parseInt(e.target.value) || 0 })}
                                                        className="h-6 w-16 text-xs px-2 p-0 text-center"
                                                        disabled={isUploading || uf.status === 'success'}
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-3">
                                            {uf.status === 'error' ? (
                                                <p className="text-[10px] text-red-500 truncate flex-1">{uf.error}</p>
                                            ) : uf.status === 'success' ? (
                                                <p className="text-[10px] text-emerald-500 font-medium">Uploaded Successfully</p>
                                            ) : (
                                                <>
                                                    <Progress value={uf.progress} className="h-1 flex-1" />
                                                    <span className="text-[10px] text-slate-400 shrink-0 w-8">{uf.progress}%</span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {!isUploading && uf.status !== 'success' && (
                                        <Button size="icon" variant="ghost" className="h-6 w-6 self-start text-slate-400 hover:text-red-500" onClick={() => removeFileFromQueue(i)}>
                                            <X className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                </div>
                <DialogFooter className="pt-4 border-t border-slate-100 dark:border-slate-800">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>Close Window</Button>
                    <Button
                        onClick={startUploads}
                        disabled={isUploading || uploadFiles.length === 0 || uploadFiles.every(u => u.status === 'success')}
                    >
                        {isUploading ? (
                            <>Uploading in Progress...</>
                        ) : (
                            <>
                                <ArrowUpCircle className="h-4 w-4 mr-2" />
                                Push {uploadFiles.filter(u => u.status !== 'success').length} files to Cloud
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
})
