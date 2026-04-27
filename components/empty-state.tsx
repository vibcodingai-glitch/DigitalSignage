import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

interface EmptyStateProps {
    icon: LucideIcon
    title: string
    description: string
    action?: {
        label: string
        onClick?: () => void
        href?: string
    }
    className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className = "" }: EmptyStateProps) {
    return (
        <div className={`flex flex-col items-center justify-center text-center py-16 px-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-white/50 dark:bg-slate-950/50 ${className}`}>
            {/* Icon halo */}
            <div className="relative mb-5">
                <div className="h-16 w-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <Icon className="h-8 w-8 text-slate-400 dark:text-slate-500" />
                </div>
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 blur-lg -z-10" />
            </div>

            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1.5">{title}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed mb-6">{description}</p>

            {action && (
                action.href ? (
                    <Button asChild>
                        <a href={action.href}>{action.label}</a>
                    </Button>
                ) : (
                    <Button onClick={action.onClick}>{action.label}</Button>
                )
            )}
        </div>
    )
}
