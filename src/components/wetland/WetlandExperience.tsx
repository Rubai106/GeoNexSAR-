"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useWetlandStore, type DrawerKind, type ViewMode } from "@/lib/store";
import { daysBetween, fmtDate, opticalState } from "@/lib/story";
import { datesWithPatches, loadShowcaseRadar, nextAvailableIndex, type RadarPreview } from "@/lib/showcase";
import TimeMachine from "./TimeMachine";
import { Icon } from "./icons";
import { TierBadge } from "./ui";
import { AboutDrawer, ChainDrawer, CompareDrawer, DetectiveDrawer, InvestigationDrawer, OpticalDrawer, SensitivityDrawer, StoryDrawer, WhyRadarDrawer } from "./Drawers";
import "./experience.css";

const WetlandStage = dynamic(() => import("./WetlandStage"), { ssr: false, loading: () => <div className="wx-stage wx-stage--loading">Loading map…</div> });

const MODES: { id: ViewMode; label: string; icon: React.ReactNode; purpose: string }[] = [
  { id: "MOTION", label: "Motion", icon: Icon.motion, purpose: "Watch candidate change evolve across the real observations." },
  { id: "RADAR", label: "Radar", icon: Icon.radar, purpose: "See the radar imagery NISAR recorded, before the rules were applied." },
  { id: "DETECTION", label: "Detection", icon: Icon.detection, purpose: "See where the rules flagged candidates, by class." },
  { id: "EXPLAIN", label: "Explain", icon: Icon.explain, purpose: "Select a region to see why it was flagged and what limits it." },
];

type Tool = { id: DrawerKind; label: string; hint: string; icon: React.ReactNode; group: "investigate" | "evidence" | "learn" };
const TOOLS: Tool[] = [
  { id: "INVESTIGATE", label: "Why this region?", hint: "What the radar measured in the selected region", icon: Icon.region, group: "investigate" },
  { id: "DETECTIVE", label: "SAR Detective", hint: "Read the radar signal at any point", icon: Icon.probe, group: "investigate" },
  { id: "SENSITIVITY", label: "Does it survive?", hint: "Would a different cutoff change the result?", icon: Icon.survive, group: "investigate" },
  { id: "COMPARE", label: "Lock comparison", hint: "Compare two real observations side by side", icon: Icon.compare, group: "investigate" },
  { id: "OPTICAL", label: "Independent check", hint: "Does optical imagery agree?", icon: Icon.optical, group: "evidence" },
  { id: "STORY", label: "What happened?", hint: "A plain-language summary of the loaded data", icon: Icon.story, group: "evidence" },
  { id: "CHAIN", label: "Data chain", hint: "From NASA's radar to a candidate region", icon: Icon.chain, group: "learn" },
  { id: "RADAR_WHY", label: "Why radar?", hint: "What radar sees that optical cannot", icon: Icon.why, group: "learn" },
  { id: "ABOUT", label: "Provenance", hint: "Where this data came from and what is missing", icon: Icon.provenance, group: "learn" },
];

function Hatch() {
  return <svg className="wx-defs" width="0" height="0" aria-hidden="true"><defs><pattern id="wx-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="rgba(242,164,90,.10)" /><line x1="0" y1="0" x2="0" y2="6" stroke="rgba(242,164,90,.8)" strokeWidth="1.4" /></pattern></defs></svg>;
}

/** "Tanguar Haor mapped boundary" -> "Tanguar Haor". The suffix describes the mask, not the place. */
export const caseTitle = (name: string) => name.replace(/\s*·.*$/, "").replace(/\s+mapped boundary$/i, "");

function ModeSwitch() {
  const { viewMode, setViewMode } = useWetlandStore();
  const mode = MODES.find((m) => m.id === viewMode) ?? MODES[0];
  return (
    <div className="wx-modebar">
      <div className="wx-modes" role="radiogroup" aria-label="Map view">
        {MODES.map((m, i) => (
          <button key={m.id} role="radio" aria-checked={viewMode === m.id} tabIndex={viewMode === m.id ? 0 : -1} onClick={() => setViewMode(m.id)}
            onKeyDown={(e) => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); const n = MODES[(i + (e.key === "ArrowRight" ? 1 : MODES.length - 1)) % MODES.length]; setViewMode(n.id); (e.currentTarget.parentElement?.querySelector(`[data-mode="${n.id}"]`) as HTMLElement | null)?.focus(); } }}
            data-mode={m.id} title={m.purpose} aria-label={`${m.label}: ${m.purpose}`}>{m.icon}<span>{m.label}</span></button>
        ))}
      </div>
      <p className="wx-modecap" aria-live="polite"><span className="wx-micro">View</span> {mode.purpose}</p>
    </div>
  );
}

function ContextRail() {
  const { pulseData, selectedDateIndex, dataTier, showcase, selectedPatch, lock } = useWetlandStore();
  if (!pulseData) return null;
  const d = pulseData.dates; const cur = d[Math.min(selectedDateIndex, d.length - 1)];
  const isPeak = cur.date === pulseData.peak.date; const sim = dataTier === "SANDBOX";
  const optical = opticalState(dataTier, pulseData);
  const name = caseTitle(pulseData.site);
  const note = optical === "INCONCLUSIVE" ? "The independent optical check was inconclusive, so nothing here has been corroborated."
    : optical === "SUPPORT_LIMITED" ? "An optical comparison covered only part of the area." : optical === "SIMULATED" ? "This is a fictional simulation." : "No independent check has been run.";
  return (
    <aside className="wx-rail" aria-label="Study area and selected observation">
      <p className="wx-micro">{sim ? "Simulated scenario" : "Study area"}</p>
      <h1>{name}</h1>
      <p className="wx-sub">{/hakaluki|tanguar/i.test(name) ? "Bangladesh · " : ""}{sim ? "fictional scenario" : "mapped haor boundary"}</p>
      <p className="wx-mono wx-meta">{sim ? "SIMULATION" : "NISAR L-band"} · {d.length} dates · {fmtDate(d[0].date)} – {fmtDate(d[d.length - 1].date, { month: "short", day: "numeric", year: "numeric" })}</p>
      <div className={`wx-obsbox${isPeak ? " is-peak" : ""}`} aria-live="polite">
        <p className="wx-micro">{isPeak ? "Peak observation" : "Selected observation"}</p>
        <p className="wx-date">{fmtDate(cur.date, { month: "long", day: "numeric", year: "numeric" })}</p>
        <p className="wx-big"><strong>{cur.area_km2.toFixed(2)}</strong> km²</p>
        <p className="wx-bigcap" title="The radar-change rules compare each pixel with its baseline and flag pixels that changed by more than the cutoff. A flagged area is a candidate, not confirmed flooding.">Area flagged by the radar-change rules</p>
        <p className="wx-mono wx-count">{cur.patches.toLocaleString()} regions</p>
      </div>
      <p className="wx-read">Radar returns changed across {cur.patches.toLocaleString()} regions on {fmtDate(cur.date)}. They are candidates for investigation, not confirmed flooding. {note}</p>
      {lock && <p className="wx-read wx-read--lock">Comparison locked: {fmtDate(d[lock.beforeIndex].date)} and {fmtDate(d[lock.afterIndex].date)}.</p>}
      {!selectedPatch && <div className="wx-hint"><span className="wx-micro">Start here</span><p>Press <b>Play change</b>, or click a region on the map to ask why it was flagged.</p></div>}
      <p className="wx-src">{showcase ? <>Source: {showcase.manifest.product ?? "NISAR L2 GCOV"}, provisional.</> : sim ? "Not satellite data." : "Provisional NISAR product."}</p>
    </aside>
  );
}

function RadarControls() {
  const { radarChannel, radarStage, setRadarLayer, dataTier, pulseData, selectedDateIndex, showcase } = useWetlandStore();
  const date = pulseData?.dates[selectedDateIndex]?.date;
  const [loaded, setLoaded] = useState<{ date: string; preview: RadarPreview | null } | null>(null);
  useEffect(() => { let live = true; if (date && dataTier === "SHOWCASE") void loadShowcaseRadar(date).then((p) => { if (live) setLoaded({ date, preview: p }); }); return () => { live = false; }; }, [date, dataTier]);
  const preview = loaded && loaded.date === date ? loaded.preview : null;
  const noPreview = dataTier === "SHOWCASE" && !!date && !(showcase?.manifest.radar_dates ?? []).includes(date);
  if (dataTier === "SANDBOX") return <div className="wx-radar"><p>The sandbox has no radar rasters. Open the packaged case to see actual NISAR imagery.</p></div>;
  if (noPreview) return <div className="wx-radar"><p>No radar preview was exported for {date}. Only candidate regions are shown.</p></div>;
  const scale = radarStage === "change" ? [-10, 10] : preview?.layers[radarChannel]?.scale_db;
  const stageWord = radarStage === "change" ? "Change (after minus baseline)" : radarStage === "before" ? "Baseline" : "After";
  return (
    <div className="wx-radar" role="group" aria-label="Radar layer">
      <p className="wx-radar__now" aria-live="polite"><span className="wx-micro">Showing</span> <strong>{radarChannel.toUpperCase()} · {stageWord}</strong> <span className="wx-mono">{date}</span></p>
      {(["hh", "hv"] as const).map((c) => <div key={c} className="wx-radar__row"><span className="wx-micro">{c.toUpperCase()}</span>{(["before", "after", "change"] as const).map((s) =>
        <button key={s} aria-pressed={radarChannel === c && radarStage === s} onClick={() => setRadarLayer(c, s)}>{s === "change" ? "Change" : s === "before" ? "Baseline" : "After"}</button>)}</div>)}
      {scale && <div className="wx-ramp"><i className={radarStage === "change" ? "is-div" : "is-gray"} /><span className="wx-mono">{scale[0]} dB</span><span className="wx-mono">{scale[1]} dB</span></div>}
      <small>{radarStage === "change" ? "Blue: weaker return. Red: stronger return. Transparent: no valid data." : "Grey: backscatter power. Transparent: no valid data."} {preview?.baseline_observation_dates && radarStage !== "after" ? `Baseline is the per-pixel median of ${preview.baseline_observation_dates.length} earlier observations.` : ""}</small>
    </div>
  );
}

/** Legacy run whose derived results could not be verified: only real boundary + acquisition dates. */
function AcquisitionsOnly() {
  const showcase = useWetlandStore((x) => x.showcase);
  if (!showcase) return null;
  const m = showcase.manifest; const dates = m.observation_dates;
  const t0 = Date.parse(`${dates[0]}T00:00:00Z`); const span = Math.max(Date.parse(`${dates[dates.length - 1]}T00:00:00Z`) - t0, 1);
  return (
    <>
      <aside className="wx-rail" aria-label="Study area">
        <p className="wx-micro">Study area</p><h1>{caseTitle(m.site_display_name ?? m.site_name)}</h1><p className="wx-sub">Bangladesh · mapped haor boundary</p>
        <p className="wx-mono wx-meta">NISAR L-band · {dates.length} dates · {fmtDate(dates[0])} – {fmtDate(dates[dates.length - 1], { month: "short", day: "numeric", year: "numeric" })}</p>
        <div className="wx-obsbox"><p className="wx-micro">Acquisitions only</p><p className="wx-big"><strong>{dates.length}</strong> NISAR observations</p><p className="wx-bigcap">Real acquisition dates recorded for this run</p></div>
        <p className="wx-read"><b>Derived change results are not included in this export.</b> The boundary and dates are real. Open Provenance for what is missing and why. Nothing is interpolated.</p>
      </aside>
      <section className="wx-acq" aria-label="Real NISAR acquisition dates">
        <div className="wx-track" role="list"><div className="wx-track__axis" />
          {dates.map((d, i) => { const x = 4 + ((Date.parse(`${d}T00:00:00Z`) - t0) / span) * 92; const gap = i > 0 ? daysBetween(dates[i - 1], d) : 0;
            return <div key={d} role="listitem" className="wx-obs is-off" style={{ left: `${x}%` }} title="Acquired by NISAR; results not exported"><i className="wx-obs__dot" /><span className="wx-obs__date">{fmtDate(d)}</span>{gap > 14 ? <span className="wx-obs__phase">{gap}d gap</span> : null}</div>; })}
        </div>
      </section>
    </>
  );
}

export default function WetlandExperience({ preferLocalRun }: { preferLocalRun: boolean }) {
  const s = useWetlandStore();
  const { dataTier, drawer, setDrawer, viewMode, returnToOverview, isLoadingData, dataError, satelliteBasemap, setSatelliteBasemap, pulseData, showcaseChecked, probeActive } = s;

  useEffect(() => { void useWetlandStore.getState().initExperience(preferLocalRun); setSatelliteBasemap(true); }, [preferLocalRun, setSatelliteBasemap]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement; if (/INPUT|SELECT|TEXTAREA/.test(t.tagName) || t.getAttribute("role") === "slider" || t.getAttribute("role") === "radio") return;
      const st = useWetlandStore.getState(); const n = st.pulseData?.dates.length ?? 0;
      if (e.key === " " && t.tagName !== "BUTTON") { e.preventDefault(); if (n) st.setIsPlaying(!st.isPlaying); }
      const avail = st.dataTier === "SHOWCASE" && st.showcase ? datesWithPatches(st.showcase) : null; const dates = st.pulseData?.dates ?? [];
      if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && n && t.tagName !== "BUTTON") { const to = nextAvailableIndex(dates, avail, st.selectedDateIndex, e.key === "ArrowRight" ? 1 : -1); if (to >= 0) { st.setIsPlaying(false); st.setSelectedDateIndex(to); } }
      if (e.key === "Escape") { if (st.drawer !== "NONE") st.setDrawer("NONE"); else st.returnToOverview(); }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, []);

  const acquisitionsOnly = dataTier === "SHOWCASE" && !pulseData && !!s.showcase;
  const activeDrawer: DrawerKind = drawer; // regions open their own drawer on click; closing a tool must not reopen another
  const tools = TOOLS.filter((t) => !acquisitionsOnly || ["CHAIN", "RADAR_WHY", "ABOUT"].includes(t.id));
  const title = pulseData ? caseTitle(pulseData.site) : s.showcase ? caseTitle(s.showcase.manifest.site_display_name ?? s.showcase.manifest.site_name) : "";
  const cur = pulseData?.dates[Math.min(s.selectedDateIndex, (pulseData?.dates.length ?? 1) - 1)];

  return (
    <div className="wx-root" data-tier={dataTier} data-detective={probeActive ? "true" : "false"} data-drawer={activeDrawer !== "NONE" ? "open" : "closed"}>
      <Hatch />
      <header className="wx-mast">
        <Link href="/" className="wx-brand" aria-label="Beyonders home">Beyonders</Link>
        <span className="wx-case"><span className="wx-micro">Case</span>{title || "Loading…"}{cur ? <span className="wx-mono"> · {cur.date}</span> : null}</span>
        <TierBadge tier={dataTier} completeness={s.showcase?.manifest.completeness} />
        <nav className="wx-nav" aria-label="Beyonders">
          <Link href="/wetland/global" aria-label="Explore NISAR worldwide">{Icon.globe}<span>Explore NISAR worldwide</span></Link>
          <Link href="/wetland/classic" className="wx-nav__classic" title="The earlier tabular dashboard">Classic view</Link>
          <button onClick={() => setSatelliteBasemap(!satelliteBasemap)} aria-pressed={satelliteBasemap} aria-label="Satellite basemap" title="Toggle the satellite basemap">{Icon.layers}<span>Basemap</span></button>
          <button onClick={returnToOverview} title="Clear selection, comparison and filters (Esc)">Return<span className="wx-nav__long"> to overview</span></button>
        </nav>
      </header>

      {acquisitionsOnly ? <AcquisitionsOnly /> : <ContextRail />}

      <main className="wx-map" aria-label="Map">
        <WetlandStage />
        {!acquisitionsOnly && <ModeSwitch />}
        {viewMode === "RADAR" && !acquisitionsOnly && <RadarControls />}
        {!acquisitionsOnly && <div className="wx-legend" aria-label="Map legend">
          <span><i className="lg lg--strong" />Rules agree</span><span><i className="lg lg--moderate" />Partly agree</span><span><i className="lg lg--uncertain" />Uncertain</span>
          <span><i className="lg lg--none" />No candidate (not &ldquo;unchanged&rdquo;)</span>
        </div>}
        <div className="wx-dock" role="toolbar" aria-label="Investigation tools" aria-orientation="vertical">
          {tools.map((t, i) => (
            <React.Fragment key={t.id}>
              {i > 0 && tools[i - 1].group !== t.group && <hr />}
              <button className="wx-dock__btn" aria-label={t.label} aria-pressed={activeDrawer === t.id} data-tip={`${t.label}: ${t.hint}`} onClick={() => setDrawer(activeDrawer === t.id ? "NONE" : t.id)}>{t.icon}</button>
            </React.Fragment>
          ))}
        </div>
        {(isLoadingData || !showcaseChecked) && <div className="wx-toast" role="status">Loading observations…</div>}
        {dataError && <div className="wx-toast wx-toast--err" role="alert">{dataError}</div>}
        {dataTier === "SANDBOX" && showcaseChecked && <div className="wx-sandbox-note" role="note"><b>Interactive sandbox.</b> Fictional, deterministic simulation, not measured data. The packaged case built from actual NISAR observations is not included in this build (<code>public/showcase/featured</code>).</div>}
      </main>

      {activeDrawer !== "NONE" && (
        <aside className="wx-drawer" aria-label={tools.find((t) => t.id === activeDrawer)?.label ?? "Investigation"}>
          <div className="wx-drawer__bar"><span className="wx-micro">Investigation</span><button onClick={() => { if (activeDrawer === "INVESTIGATE") s.setSelectedPatch(null); setDrawer("NONE"); }} aria-label="Close panel">{Icon.close}</button></div>
          <div className="wx-drawer__body">
            {activeDrawer === "INVESTIGATE" && <InvestigationDrawer />}{activeDrawer === "DETECTIVE" && <DetectiveDrawer />}
            {activeDrawer === "SENSITIVITY" && <SensitivityDrawer />}{activeDrawer === "STORY" && <StoryDrawer />}{activeDrawer === "CHAIN" && <ChainDrawer />}
            {activeDrawer === "RADAR_WHY" && <WhyRadarDrawer />}{activeDrawer === "COMPARE" && <CompareDrawer />}{activeDrawer === "OPTICAL" && <OpticalDrawer />}{activeDrawer === "ABOUT" && <AboutDrawer />}
          </div>
        </aside>
      )}

      {!acquisitionsOnly && <TimeMachine />}
    </div>
  );
}
