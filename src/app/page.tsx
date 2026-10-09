import Link from "next/link";
import { PHENOMENA } from "@/phenomena/registry";
import "./landing.css";

export default function Home() {
  return (
    <main className="ld">
      <header className="ld-top"><span>BEYONDERS</span><span>NASA SPACE APPS 2026 · DANCING WITH THE SARs</span></header>
      <section className="ld-hero">
        <p className="ld-eyebrow">NISAR-POWERED EXPLORATION OF CHANGING EARTH</p>
        <h1>See Earth&rsquo;s surface move.</h1>
        <p className="ld-lede">Radar sees through cloud and, at L-band, around vegetation. Beyonders turns NISAR observations into something you can watch, investigate, and challenge.</p>
        <div className="ld-actions">
          <Link href="/wetland/global" className="ld-cta">EXPLORE THE WORLD</Link>
          <Link href="/wetland" className="ld-cta ld-cta--ghost">ENTER WETLAND STORY →</Link>
        </div>
      </section>
      <section className="ld-phen" aria-label="Phenomena">
        {PHENOMENA.map((p) => (
          <article key={p.id} className={p.status === "AVAILABLE" ? "is-live" : ""}>
            <h2>{p.name}</h2><p>{p.tagline}</p>
            {p.status === "AVAILABLE" && p.href ? <Link href={p.href}>Open the first story →</Link> : <span>Planned module</span>}
          </article>
        ))}
      </section>
      <section className="ld-path" aria-label="How exploration works">
        <p>EARTH</p><i>→</i><p>REGION</p><i>→</i><p>SITE</p><i>→</i><p>OBSERVATION</p><i>→</i><p>CANDIDATE</p><i>→</i><p>EVIDENCE</p>
      </section>
      <footer className="ld-foot">A radar change candidate is not confirmed flooding. Every screen labels whether data are real NISAR-derived assets or a deterministic simulation.</footer>
    </main>
  );
}
