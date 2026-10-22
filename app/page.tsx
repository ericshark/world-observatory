import Dashboard from "./components/Dashboard";
import StatsGrid from "./components/StatsGrid";
import { SOURCE_NOTE } from "./data/countries";

export default function Home() {
  return (
    <main className="mx-auto min-h-screen max-w-[1600px] px-4 pb-12 pt-10 md:px-6 md:pt-16">
      <Dashboard />

      <section aria-label="Population flows" className="mt-8">
        <StatsGrid />
      </section>

      <footer className="mt-8 flex flex-col gap-1 text-xs text-ink-muted sm:flex-row sm:justify-between">
        <p className="m-0">{SOURCE_NOTE}</p>
        <p className="m-0">
          Live figures are modelled estimates, not a real-time census.
        </p>
      </footer>
    </main>
  );
}
