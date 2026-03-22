type SkeletonTableColumn = {
  headerWidthClass: string;
  cellWidthClass: string;
  align?: 'left' | 'center' | 'right';
};

function alignClassName(align: SkeletonTableColumn['align']) {
  if (align === 'center') return 'mx-auto';
  if (align === 'right') return 'ml-auto';
  return '';
}

export function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className}`} />;
}

export function BillingToolbarSkeleton({
  showPrimaryAction,
  trailingControlCount = 2,
}: {
  showPrimaryAction: boolean;
  trailingControlCount?: number;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <SkeletonBlock className="h-10 w-full lg:max-w-xl" />
      <div className="flex gap-2">
        {showPrimaryAction && <SkeletonBlock className="h-10 w-[168px]" />}
        {Array.from({ length: trailingControlCount }).map((_, index) => (
          <SkeletonBlock key={`toolbar-skeleton-control-${index}`} className={index === 0 ? 'h-10 w-[132px]' : 'h-10 w-[136px]'} />
        ))}
      </div>
    </div>
  );
}

export function BillingTableSkeleton({
  columns,
  rowCount,
}: {
  columns: SkeletonTableColumn[];
  rowCount: number;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto rounded-xl">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-200/90">
          <tr>
            {columns.map((column, index) => (
              <th key={`skeleton-head-${index}`} className="px-3 py-2">
                <SkeletonBlock className={`h-4 ${column.headerWidthClass} ${alignClassName(column.align)}`} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }).map((_, rowIndex) => (
            <tr key={`skeleton-row-${rowIndex}`} className="border-t border-gray-200">
              {columns.map((column, colIndex) => (
                <td key={`skeleton-cell-${rowIndex}-${colIndex}`} className="px-3 py-2">
                  <SkeletonBlock className={`h-4 ${column.cellWidthClass} ${alignClassName(column.align)}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BillingPaginationSkeleton() {
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-gray-200/70 p-1">
      <SkeletonBlock className="h-7 w-[52px]" />
      <SkeletonBlock className="h-7 w-7" />
      <SkeletonBlock className="h-7 w-7" />
      <SkeletonBlock className="h-7 w-7" />
      <SkeletonBlock className="h-7 w-[52px]" />
    </div>
  );
}
