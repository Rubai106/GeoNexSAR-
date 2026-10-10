import Link from "next/link";
import { PHENOMENA } from "@/phenomena/registry";
import "./landing.css";

const STEPS = [
  ["Watch", "Play the real NISAR observations of a wetland in time order. Dates are never invented or smoothed over."],
  ["Investigate", "Select a region the radar-change rules flagged and see what was measured, what was calculated, and what is missing."],
  ["Challenge", "Ask whether the result survives a different cutoff, appears on other dates, or is supported by an independent satellite."],
];

export default function Home() {
  return (
    <main className="ld">
      <header className="ld-top">
        <span className="ld-brand">Beyonders</span>
        <nav aria-label="Primary"><Link href="/wetland">Processed case</Link><Link href="/wetland/global">Explore NISAR worldwide</Link></nav>
      </header>

      <section className="ld-hero" aria-labelledby="ld-title">
        <p className="ld-micro">NASA Space Apps 2026 · Dancing with the SARs</p>
        <h1 id="ld-title">See Earth&rsquo;s surface move.</h1>
        <p className="ld-lede">NISAR is a NASA radar satellite that sees through cloud, day and night. Beyonders turns its observations of a Bangladesh haor into something you can watch, investigate and question.</p>
        <div className="ld-actions">
          <Link href="/wetland" className="ld-primary">Open the Tanguar Haor case</Link>
          <Link href="/wetland/global" className="ld-secondary">Explore NISAR worldwide</Link>
        </div>
        <p className="ld-note">A radar-change candidate is not a confirmed flood. Every screen says whether data are real NISAR-derived assets or a fictional simulation.</p>
      </section>

      <section className="ld-steps" aria-label="What you can do">
        {STEPS.map(([title, text], i) => (
          <div key={title}><span className="ld-n">{i + 1}</span><h2>{title}</h2><p>{text}</p></div>
        ))}
      </section>

      <section className="ld-phen" aria-labelledby="ld-phen-title">
        <h2 id="ld-phen-title" className="ld-micro">Earth Change: phenomena</h2>
        <ul>
          {PHENOMENA.map((p) => (
            <li key={p.id} className={p.status === "AVAILABLE" ? "is-live" : ""}>
              <strong>{p.name}</strong><span>{p.tagline}</span>
              {p.status === "AVAILABLE" && p.href ? <Link href={p.href}>Available now</Link> : <em>Planned</em>}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
