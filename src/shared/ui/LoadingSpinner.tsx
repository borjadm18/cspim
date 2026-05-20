export function LoadingSpinner() {
  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
        <div className="h-14 animate-pulse rounded-2xl bg-slate-100" />
        <div className="mt-4 flex gap-2">
          <div className="h-8 w-28 animate-pulse rounded-full bg-slate-100" />
          <div className="h-8 w-32 animate-pulse rounded-full bg-slate-100" />
          <div className="h-8 w-24 animate-pulse rounded-full bg-slate-100" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="hidden rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)] lg:block">
          <div className="h-6 w-24 animate-pulse rounded bg-slate-100" />
          <div className="mt-5 space-y-4">
            <div className="h-12 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-12 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />
          </div>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
              >
                <div className="aspect-[4/3] animate-pulse bg-slate-100" />
                <div className="space-y-3 p-4">
                  <div className="h-5 w-4/5 animate-pulse rounded bg-slate-100" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
                  <div className="flex gap-2">
                    <div className="h-6 w-20 animate-pulse rounded-full bg-slate-100" />
                    <div className="h-6 w-24 animate-pulse rounded-full bg-slate-100" />
                  </div>
                  <div className="h-10 animate-pulse rounded-full bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
