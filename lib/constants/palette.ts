/**
 * Shared color palette for schedule visualizations.
 * Single source of truth — previously duplicated in:
 * - screens/[id]/page.tsx
 * - WeeklyScheduleTimeline.tsx
 * - schedule-panel.tsx
 */
export const SCHEDULE_PALETTE = [
    { bg: 'bg-indigo-500', text: 'text-indigo-100', ring: 'ring-indigo-300', dot: 'bg-indigo-500' },
    { bg: 'bg-violet-500', text: 'text-violet-100', ring: 'ring-violet-300', dot: 'bg-violet-500' },
    { bg: 'bg-emerald-500', text: 'text-emerald-100', ring: 'ring-emerald-300', dot: 'bg-emerald-500' },
    { bg: 'bg-amber-500', text: 'text-amber-100', ring: 'ring-amber-300', dot: 'bg-amber-500' },
    { bg: 'bg-rose-500', text: 'text-rose-100', ring: 'ring-rose-300', dot: 'bg-rose-500' },
    { bg: 'bg-cyan-500', text: 'text-cyan-100', ring: 'ring-cyan-300', dot: 'bg-cyan-500' },
    { bg: 'bg-pink-500', text: 'text-pink-100', ring: 'ring-pink-300', dot: 'bg-pink-500' },
    { bg: 'bg-teal-500', text: 'text-teal-100', ring: 'ring-teal-300', dot: 'bg-teal-500' },
] as const;

export type PaletteEntry = typeof SCHEDULE_PALETTE[number];

export function getPaletteColor(index: number): PaletteEntry {
    return SCHEDULE_PALETTE[index % SCHEDULE_PALETTE.length];
}
