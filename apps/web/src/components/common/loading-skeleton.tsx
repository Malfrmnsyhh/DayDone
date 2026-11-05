export function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <div className="h-4 w-32 bg-slate-200 rounded-md" />
        <div className="h-5 w-16 bg-slate-100 rounded-full" />
      </div>
      <div className="space-y-2">
        <div className="h-3.5 w-full bg-slate-100 rounded-sm" />
        <div className="h-3.5 w-4/5 bg-slate-100 rounded-sm" />
      </div>
    </div>
  );
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="h-6 w-48 bg-slate-200 rounded-md" />
        <div className="flex gap-2">
          <div className="h-8 w-16 bg-slate-100 rounded-lg" />
          <div className="h-8 w-16 bg-slate-100 rounded-lg" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="h-4 w-full bg-slate-100 rounded-sm" />
        <div className="h-4 w-full bg-slate-100 rounded-sm" />
        <div className="h-4 w-3/4 bg-slate-100 rounded-sm" />
      </div>
    </div>
  );
}

