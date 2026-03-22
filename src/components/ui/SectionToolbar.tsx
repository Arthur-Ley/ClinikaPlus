import type { ComponentType, ReactNode } from 'react';
import { Search } from 'lucide-react';

type SectionToolbarProps = {
  title: string;
  icon: ComponentType<{ className?: string }>;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  searchWidthClass?: string;
  rightControls?: ReactNode;
  className?: string;
};

export default function SectionToolbar({
  title,
  icon: Icon,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  searchWidthClass = 'w-full md:w-[360px]',
  rightControls,
  className = '',
}: SectionToolbarProps) {
  return (
    <div className={className}>
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-5 w-5 text-gray-500" />
        <h2 className="text-xl font-semibold text-gray-700">{title}</h2>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className={`relative block ${searchWidthClass}`}>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-10 w-full rounded-lg border border-gray-300 bg-gray-100 pl-9 pr-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {rightControls}
        </div>
      </div>
    </div>
  );
}
