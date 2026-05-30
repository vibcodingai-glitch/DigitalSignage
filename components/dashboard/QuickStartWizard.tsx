import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Circle, MonitorPlay, Layers, Library, ChevronRight } from "lucide-react"

export function QuickStartWizard({ stats }: { stats: any }) {
    const hasContent = (stats?.contentItems || 0) > 0
    const hasProject = (stats?.projects || 0) > 0
    const hasScreen = (stats?.screens?.total || 0) > 0

    return (
        <Card className="border-indigo-100 bg-indigo-50/50 dark:border-indigo-900/50 dark:bg-indigo-950/20 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-500">
            <div className="bg-indigo-600 px-6 py-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    👋 Welcome to Asra Signage
                </h3>
                <p className="text-indigo-100 text-sm mt-1">Let's get your first display up and running in 3 simple steps.</p>
            </div>
            <CardContent className="p-6">
                <div className="space-y-4">
                    {/* Step 1 */}
                    <div className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${hasContent ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-60' : 'bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-800 shadow-sm'}`}>
                        <div className="mt-1 shrink-0">
                            {hasContent ? <CheckCircle2 className="h-6 w-6 text-emerald-500" /> : <Circle className="h-6 w-6 text-indigo-300" />}
                        </div>
                        <div className="flex-1">
                            <h4 className={`text-base font-semibold ${hasContent ? 'text-slate-500' : 'text-slate-900 dark:text-slate-100'}`}>1. Upload Media Assets</h4>
                            <p className="text-sm text-slate-500 mt-1">Add images, videos, or web links to your Content Library.</p>
                        </div>
                        {!hasContent && (
                            <Button size="sm" asChild className="shrink-0 mt-2">
                                <Link href="/dashboard/content">Go to Library <ChevronRight className="ml-1 h-4 w-4" /></Link>
                            </Button>
                        )}
                    </div>

                    {/* Step 2 */}
                    <div className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${hasProject ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-60' : hasContent ? 'bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-800 shadow-sm' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 opacity-50 grayscale'}`}>
                        <div className="mt-1 shrink-0">
                            {hasProject ? <CheckCircle2 className="h-6 w-6 text-emerald-500" /> : <Circle className="h-6 w-6 text-indigo-300" />}
                        </div>
                        <div className="flex-1">
                            <h4 className={`text-base font-semibold ${hasProject ? 'text-slate-500' : 'text-slate-900 dark:text-slate-100'}`}>2. Create a Timeline</h4>
                            <p className="text-sm text-slate-500 mt-1">Build a playlist project and drag your content into a sequence.</p>
                        </div>
                        {hasContent && !hasProject && (
                            <Button size="sm" asChild className="shrink-0 mt-2">
                                <Link href="/dashboard/projects">Create Project <ChevronRight className="ml-1 h-4 w-4" /></Link>
                            </Button>
                        )}
                    </div>

                    {/* Step 3 */}
                    <div className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${hasScreen ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-60' : hasProject ? 'bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-800 shadow-sm' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 opacity-50 grayscale'}`}>
                        <div className="mt-1 shrink-0">
                            {hasScreen ? <CheckCircle2 className="h-6 w-6 text-emerald-500" /> : <Circle className="h-6 w-6 text-indigo-300" />}
                        </div>
                        <div className="flex-1">
                            <h4 className={`text-base font-semibold ${hasScreen ? 'text-slate-500' : 'text-slate-900 dark:text-slate-100'}`}>3. Register a Screen</h4>
                            <p className="text-sm text-slate-500 mt-1">Add a physical display and bind it to your active project.</p>
                        </div>
                        {hasProject && !hasScreen && (
                            <Button size="sm" asChild className="shrink-0 mt-2">
                                <Link href="/dashboard/screens">Add Screen <ChevronRight className="ml-1 h-4 w-4" /></Link>
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
