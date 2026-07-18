export default function AdminLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="flex min-h-[560px] overflow-hidden rounded-xl border border-border bg-card">
        <aside className="w-56 shrink-0 border-r border-border bg-muted/20 p-4">
          <div className="mb-3 h-3 w-12 animate-pulse rounded bg-muted" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-9 animate-pulse rounded-lg bg-muted"
              />
            ))}
          </div>
        </aside>
        <section className="flex-1 p-6">
          <div className="h-6 w-40 animate-pulse rounded-md bg-muted" />
          <div className="mt-4 h-64 animate-pulse rounded-xl bg-muted/60" />
        </section>
      </div>
    </div>
  );
}
