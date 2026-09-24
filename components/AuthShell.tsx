export function AuthShell({
  title,
  subtitle,
  children,
}: Readonly<{
  title: string;
  subtitle: string;
  children: React.ReactNode;
}>) {
  return (
    <main className="min-h-screen bg-stable-paper">
      <section className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 lg:grid-cols-[1fr_440px]">
        <div className="flex flex-col justify-between px-6 py-8 sm:px-10">
          <div className="text-sm font-semibold uppercase tracking-wide text-stable-green">
            Racehorse Training & Management
          </div>
          <div className="max-w-2xl py-16">
            <h1 className="text-4xl font-semibold text-stable-ink sm:text-5xl">
              Stable operations, training, and care in one controlled system.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-stable-ink/70">
              Manage trainers, veterinarians, grooms, owners, and club managers
              with role-based access from day one.
            </p>
          </div>
          <div className="text-sm text-stable-ink/55">
            SWP391 backend connected at localhost:8080
          </div>
        </div>
        <div className="flex items-center px-6 py-8 sm:px-10">
          <div className="w-full rounded-lg border border-black/10 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-stable-ink">{title}</h2>
            <p className="mt-2 text-sm text-stable-ink/60">{subtitle}</p>
            <div className="mt-6">{children}</div>
          </div>
        </div>
      </section>
    </main>
  );
}
