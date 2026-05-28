export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="h-6 w-48 animate-pulse rounded bg-muted" />
        <div className="h-4 w-72 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-xl border bg-muted/40" />
        ))}
      </div>
    </div>
  );
}
