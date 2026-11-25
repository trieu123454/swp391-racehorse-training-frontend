"use client";

export function AppShellSkeleton({ label = "Đang xác thực quyền truy cập…" }: { label?: string }) {
  return (
    <div className="min-h-screen bg-slate-50 flex" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      <aside className="hidden lg:flex w-60 shrink-0 flex-col gap-3 border-r border-slate-200 bg-white p-4 animate-pulse motion-reduce:animate-none">
        <div className="h-9 w-36 rounded-lg bg-slate-200/70" />
        <div className="mt-4 space-y-2.5">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-9 rounded-lg bg-slate-100" />
          ))}
        </div>
        <div className="mt-auto h-12 rounded-lg bg-slate-100" />
      </aside>
      <div className="flex-1 flex flex-col min-w-0 animate-pulse motion-reduce:animate-none">
        <header className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between gap-4">
          <div className="h-6 w-44 rounded bg-slate-200/70" />
          <div className="flex items-center gap-3">
            <div className="h-8 w-28 rounded-full bg-slate-100" />
            <div className="h-9 w-9 rounded-full bg-slate-100" />
            <div className="h-9 w-36 rounded-lg bg-slate-100" />
          </div>
        </header>
        <main className="p-6 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-24 rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                <div className="h-3.5 w-24 rounded bg-slate-200/70" />
                <div className="h-6 w-16 rounded bg-slate-100" />
              </div>
            ))}
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            {Array.from({ length: 2 }, (_, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
                <div className="h-5 w-40 rounded bg-slate-200/70" />
                <div className="h-12 rounded-lg bg-slate-100" />
                <div className="h-12 rounded-lg bg-slate-100" />
                <div className="h-12 rounded-lg bg-slate-100" />
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

export function HorseCardsSkeleton({ count = 6, label = "Đang tải danh sách hồ sơ ngựa…" }: { count?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 animate-pulse motion-reduce:animate-none">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="h-48 w-full bg-slate-200/70" />
            <div className="space-y-3.5 p-4">
              <div className="flex items-start justify-between gap-2.5">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-5 w-2/3 rounded bg-slate-200/70" />
                  <div className="h-3.5 w-1/2 rounded bg-slate-100" />
                </div>
                <div className="h-6 w-20 shrink-0 rounded-full bg-slate-100" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 4 }, (_, j) => (
                  <div key={j} className="h-12 rounded-lg bg-slate-100" />
                ))}
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="h-9 w-28 rounded-lg bg-slate-100" />
                <div className="h-9 w-20 rounded-lg bg-slate-100" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FormSkeleton({ label = "Đang tải hồ sơ ngựa..." }: { label?: string }) {
  return (
    <main className="min-h-screen bg-slate-50 p-6" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div className="mx-auto max-w-[800px] rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-5 animate-pulse motion-reduce:animate-none">
        <div className="space-y-2">
          <div className="h-7 w-1/3 rounded bg-slate-200/70" />
          <div className="h-4 w-1/2 rounded bg-slate-100" />
        </div>
        <div className="h-40 rounded-xl bg-slate-100" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-11 rounded-lg bg-slate-100" />
          ))}
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <div className="h-10 w-24 rounded-lg bg-slate-100" />
          <div className="h-10 w-32 rounded-lg bg-slate-200/70" />
        </div>
      </div>
    </main>
  );
}

export function WorkspaceSkeleton({ label = "Đang tải dữ liệu…" }: { label?: string }) {
  return (
    <div className="mt-5 space-y-5" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div className="space-y-5 animate-pulse motion-reduce:animate-none">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-24 rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <div className="h-3.5 w-24 rounded bg-slate-200/70" />
              <div className="h-6 w-20 rounded bg-slate-100" />
            </div>
          ))}
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <div className="h-5 w-44 rounded bg-slate-200/70" />
              <div className="h-14 rounded-lg bg-slate-100" />
              <div className="h-14 rounded-lg bg-slate-100" />
              <div className="h-14 rounded-lg bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PanelListSkeleton({ rows = 3, label = "Đang tải dữ liệu…" }: { rows?: number; label?: string }) {
  return (
    <div className="space-y-2.5" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div className="space-y-2.5 animate-pulse motion-reduce:animate-none">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-1/3 rounded bg-slate-200/70" />
              <div className="h-3.5 w-2/3 rounded bg-slate-100" />
            </div>
            <div className="h-6 w-20 shrink-0 rounded-full bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
