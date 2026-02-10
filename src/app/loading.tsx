export default function Loading() {
  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div>
        <div className="h-8 w-48 rounded animate-shimmer" />
        <div className="h-4 w-72 rounded animate-shimmer mt-2" />
      </div>

      {/* Stats row skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-4">
            <div className="h-4 w-24 rounded animate-shimmer" />
            <div className="h-8 w-16 rounded animate-shimmer mt-2" />
          </div>
        ))}
      </div>

      {/* Client grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <div className="h-5 w-32 rounded animate-shimmer" />
                <div className="h-3 w-48 rounded animate-shimmer" />
              </div>
              <div className="w-16 h-16 rounded-full animate-shimmer" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
