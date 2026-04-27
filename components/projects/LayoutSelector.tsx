import React from 'react';
import { Card } from '@/components/ui/card';
import { Check } from 'lucide-react';

export type LayoutType = 'fullscreen' | 'split_horizontal' | 'split_vertical' | 'l_shape' | 'grid_2x2' | 'main_ticker';

interface LayoutSelectorProps {
  currentLayout: LayoutType;
  onSelect: (layout: LayoutType) => void;
}

const layouts: { id: LayoutType; name: string; renderIcon: () => React.ReactNode }[] = [
  {
    id: 'fullscreen',
    name: 'Full Screen',
    renderIcon: () => (
      <svg viewBox="0 0 100 100" className="w-full h-full text-indigo-500">
        <rect x="5" y="5" width="90" height="90" rx="4" fill="currentColor" opacity="0.3" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
  {
    id: 'split_horizontal',
    name: 'Split Horizontal',
    renderIcon: () => (
      <svg viewBox="0 0 100 100" className="w-full h-full text-indigo-500">
        <rect x="5" y="5" width="90" height="42" rx="4" fill="currentColor" opacity="0.3" stroke="currentColor" strokeWidth="2" />
        <rect x="5" y="53" width="90" height="42" rx="4" fill="currentColor" opacity="0.3" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
  {
    id: 'split_vertical',
    name: 'Split Vertical',
    renderIcon: () => (
      <svg viewBox="0 0 100 100" className="w-full h-full text-indigo-500">
        <rect x="5" y="5" width="42" height="90" rx="4" fill="currentColor" opacity="0.3" stroke="currentColor" strokeWidth="2" />
        <rect x="53" y="5" width="42" height="90" rx="4" fill="currentColor" opacity="0.3" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
  {
    id: 'l_shape',
    name: 'L-Shape (Main + Sidebar)',
    renderIcon: () => (
      <svg viewBox="0 0 100 100" className="w-full h-full text-indigo-500">
        <rect x="5" y="5" width="60" height="90" rx="4" fill="currentColor" opacity="0.3" stroke="currentColor" strokeWidth="2" />
        <rect x="71" y="5" width="24" height="42" rx="4" fill="currentColor" opacity="0.3" stroke="currentColor" strokeWidth="2" />
        <rect x="71" y="53" width="24" height="42" rx="4" fill="currentColor" opacity="0.3" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
  {
    id: 'grid_2x2',
    name: '2x2 Grid',
    renderIcon: () => (
      <svg viewBox="0 0 100 100" className="w-full h-full text-indigo-500">
        <rect x="5" y="5" width="42" height="42" rx="4" fill="currentColor" opacity="0.3" stroke="currentColor" strokeWidth="2" />
        <rect x="53" y="5" width="42" height="42" rx="4" fill="currentColor" opacity="0.3" stroke="currentColor" strokeWidth="2" />
        <rect x="5" y="53" width="42" height="42" rx="4" fill="currentColor" opacity="0.3" stroke="currentColor" strokeWidth="2" />
        <rect x="53" y="53" width="42" height="42" rx="4" fill="currentColor" opacity="0.3" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
  {
    id: 'main_ticker',
    name: 'Main + Ticker',
    renderIcon: () => (
      <svg viewBox="0 0 100 100" className="w-full h-full text-indigo-500">
        <rect x="5" y="5" width="90" height="70" rx="4" fill="currentColor" opacity="0.3" stroke="currentColor" strokeWidth="2" />
        <rect x="5" y="81" width="90" height="14" rx="4" fill="currentColor" opacity="0.3" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
];

export default function LayoutSelector({ currentLayout, onSelect }: LayoutSelectorProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {layouts.map((layout) => {
        const isSelected = currentLayout === layout.id;
        return (
          <Card
            key={layout.id}
            className={`relative overflow-hidden cursor-pointer transition-all hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-slate-50 dark:hover:bg-slate-900/50 ${
              isSelected 
                ? 'border-indigo-600 dark:border-indigo-500 ring-1 ring-indigo-600 dark:ring-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/10' 
                : 'border-slate-200 dark:border-slate-800'
            }`}
            onClick={() => onSelect(layout.id)}
          >
            {isSelected && (
              <div className="absolute top-2 right-2 h-5 w-5 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-sm">
                <Check className="h-3 w-3" strokeWidth={3} />
              </div>
            )}
            <div className="p-4 flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                {layout.renderIcon()}
              </div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 text-center">
                {layout.name}
              </span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
