"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useWetlandStore, type DrawerKind, type ViewMode } from "@/lib/store";
import { fmtDate, opticalState, daysBetween } from "@/lib/story";
import { datesWithPatches, nextAvailableIndex } from "@/lib/showcase";
import TimeMachine from "./TimeMachine";
import { TierBadge } from "./ui";
import { AboutDrawer, ChainDrawer, CompareDrawer, DetectiveDrawer, InvestigationDrawer, OpticalDrawer, SensitivityDrawer, StoryDrawer, WhyRadarDrawer } from "./Drawers";
import "./experience.css";

const WetlandStage = dynamic(() => import("./WetlandStage"), { ssr: false, loading: () => <div className="wx-stage wx-stage--loading">Loading map…</div> });

const MODES: { id: ViewMode; label: string; hint: string }[] = [
  { id: "MOTION", label: "Motion", hint: "Watch the wetland change through time" },
  { id: "RADAR", label: "Radar", hint: "See what NISAR actually observed" },
  { id: "DETECTION", label: "Detection", hint: "Where the algorithm flagged change" },
  { id: "EXPLAIN", label: "Explain", hint: "Why was this region flagged?" },
];
const TOOLS: { id: DrawerKind; label: string }[] = [
  { id: "DETECTIVE", label: "SAR Detective" }, { id: "SENSITIVITY", label: "Does it survive?" }, { id: "COMPARE", label: "Lock comparison" },
  { id: "OPTICAL", label: "Independent check" }, { id: "STORY", label: "What happened?" }, { id: "CHAIN", label: "Data chain" }, { id: "RADAR_WHY", label: "Why radar?" }, { id: "ABOUT", label: "Provenance" },
];
const DRAWER_TITLE: Record<DrawerKind, string> = { NONE: "", INVESTIGATE: "Investigate region", DETECTIVE: "SAR Detective", SENSITIVITY: "Detection sensitivity", STORY: "Change story", CHAIN: "NASA data chain", RADAR_WHY: "Why radar?", COMPARE: "Comparison workspace", OPTICAL: "Independent sensor check", ABOUT: "Provenance" };

function Hatch() {
  return <svg className="wx-defs" width="0" height="0" aria-hidden="true"><defs><pattern id="wx-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="rgba(242,166,90,.10)" /><line x1="0" y1="0" x2="0" y2="6" stroke="rgba(242,166,90,.75)" strokeWidth="1.4" /></pattern></defs></svg>;
}

function SiteHeader() {
  const { pulseData, selectedDateIndex, dataTier } = useWetlandStore();
  if (!pulseData) return null;
  const d = pulseData.dates; const cur = d[Math.min(selectedDateIndex, d.length - 1)];
  const isPeak = cur.date === pulseData.peak.date;
  const country = /hakaluki|tanguar/i.test(pulseData.site) ? "Bangladesh" : null;
  const name = pulseData.site.replace(/\s*·.*$/, "");
  const sim = dataTier === "SANDBOX";
  const range = `${fmtDate(d[0].date).toUpperCase()} — ${fmtDate(d[d.length - 1].date, { month: "short", day: "numeric", year: "numeric" }).toUpperCase()}`;
  return (
    <header className="wx-site">
      <p className="wx-eyebrow">{sim ? "SIMULATED SCENARIO" : "RADAR CHANGE STUDY"}</p>
      <h1>{name.toUpperCase()}</h1>
      {country && <p className="wx-country">{country}</p>}
      <p className="wx-meta">{sim ? "SIMULATION" : "NISAR / L-BAND"} · {range}</p>
      <div className={`wx-big${isPeak ? " is-peak" : ""}`} aria-live="polite">
        {isPeak && <span className="wx-peak-tag">PEAK OBSERVATION · {fmtDate(cur.date, { month: "short", day: "numeric", year: "numeric" }).toUpperCase()}</span>}
        <strong>{cur.area_km2.toFixed(2)}<small> km²</small></strong>
        <span>candidate radar-change area{!isPeak && ` · ${fmtDate(cur.date)}`}</span>
        <span>{cur.patches} regions</span>
      </div>
    </header>
  );
}

/** Legacy run whose derived results could not be verified: show only what is real (boundary + acquisition dates). */
function AcquisitionsOnly() {
  const showcase = useWetlandStore((x) => x.showcase);
  if (!showcase) return null;
  const m = showcase.manifest; const dates = m.observation_dates;
  const t0 = Date.parse(`${dates[0]}T00:00:00Z`); const span = Math.max(Date.parse(`${dates[dates.length - 1]}T00:00:00Z`) - t0, 1);
  const name = (m.site_display_name ?? m.site_name).toUpperCase();
  return (
    <>
      <header className="wx-site">
        <p className="wx-eyebrow">NISAR ACQUISITIONS · STUDY AREA</p>
        <h1>{name}</h1>
        <p className="wx-country">Bangladesh</p>
        <p className="wx-meta">NISAR / L-BAND · {fmtDate(dates[0]).toUpperCase()} — {fmtDate(dates[dates.length - 1], { month: "short", day: "numeric", year: "numeric" }).toUpperCase()}</p>
        <div className="wx-big"><strong>{dates.length}<small> NISAR observations</small></strong><span>real acquisition dates recorded for this run</span></div>
      </header>
      <section className="wx-acq" aria-label="Real NISAR acquisition dates">
        <p className="wx-acq__note"><b>Derived change results are not included in this export.</b> The study boundary and acquisition dates are real; candidate regions, areas and radar layers for this run were not exported, so none are shown and nothing is interpolated. Open <b>Provenance</b> for the reasons.</p>
        <div className="wx-track" role="list">
          <div className="wx-track__axis" />
          {dates.map((d, i) => { const x = 4 + ((Date.parse(`${d}T00:00:00Z`) - t0) / span) * 92; const gap = i > 0 ? daysBetween(dates[i - 1], d) : 0;
            return <div key={d} role="listitem" className="wx-obs is-off" style={{ left: `${x}%` }} title="Acquired by NISAR; results not exported"><i className="wx-obs__dot" /><span className="wx-obs__date">{fmtDate(d)}</span>{gap > 14 ? <span className="wx-obs__phase">{gap}d gap</span> : null}</div>; })}
        </div>
      </section>
    </>
  );
}

function RadarControls() {
  const { radarChannel, radarStage, setRadarLayer, dataTier, pulseData, selectedDateIndex } = useWetlandStore();
  const showcase = useWetlandStore((x) => x.showcase);
  const date = pulseData?.dates[selectedDateIndex]?.date;
  const noPreview = dataTier === "SHOWCASE" && !!date && !(showcase?.manifest.radar_dates ?? []).includes(date);
  return (
    <div className="wx-radar" role="group" aria-label="Radar layer">
      {noPreview ? <p>No NISAR radar preview was exported for {date}. Only the candidate regions (if any) are shown.</p> : dataTier === "SANDBOX" ? <p>Radar rasters are not part of the simulation. Open the featured case or a local run to see real NISAR layers.</p> : <>
        <p className="wx-eyebrow">NISAR · {date}</p>
        {(["hh", "hv"] as const).map((c) => <div key={c}>{(["before", "after", "change"] as const).map((s) =>
          <button key={s} aria-pressed={radarChannel === c && radarStage === s} onClick={() => setRadarLayer(c, s)}>{s === "change" ? `Δ${c.toUpperCase()}` : `${c.toUpperCase()} ${s}`}</button>)}</div>)}
        <small>Before = baseline. Blue = weaker return, red = stronger. Dates without a published preview show candidates only.</small></>}
    </div>
  );
}

export default function WetlandExperience({ preferLocalRun }: { preferLocalRun: boolean }) {
  const s = useWetlandStore();
  const { dataTier, drawer, setDrawer, viewMode, setViewMode, selectedPatch, returnToOverview, isLoadingData, dataError, satelliteBasemap, setSatelliteBasemap, pulseData, showcaseChecked } = s;

  useEffect(() => { void useWetlandStore.getState().initExperience(preferLocalRun); setSatelliteBasemap(true); }, [preferLocalRun, setSatelliteBasemap]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement; if (/INPUT|SELECT|TEXTAREA/.test(t.tagName) || t.getAttribute("role") === "slider") return;
      const st = useWetlandStore.getState(); const n = st.pulseData?.dates.length ?? 0;
      if (e.key === " ") { e.preventDefault(); if (n) st.setIsPlaying(!st.isPlaying); }
      const avail = st.dataTier === "SHOWCASE" && st.showcase ? datesWithPatches(st.showcase) : null;
      const dates = st.pulseData?.dates ?? [];
      if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && n) { const to = nextAvailableIndex(dates, avail, st.selectedDateIndex, e.key === "ArrowRight" ? 1 : -1); if (to >= 0) { st.setIsPlaying(false); st.setSelectedDateIndex(to); } }
      if (e.key === "Escape") { if (st.drawer !== "NONE") st.setDrawer("NONE"); else st.returnToOverview(); }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, []);

  const activeDrawer: DrawerKind = drawer === "NONE" && selectedPatch ? "INVESTIGATE" : drawer;
  const optical = opticalState(dataTier, pulseData);
  const acquisitionsOnly = dataTier === "SHOWCASE" && !pulseData && !!s.showcase;

  return (
    <div className="wx-root" data-tier={dataTier} data-detective={s.probeActive ? "true" : "false"}>
      <Hatch />
      <nav className="wx-top" aria-label="Beyonders">
        <Link href="/" className="wx-brand">BEYONDERS</Link>
        {!acquisitionsOnly && <div className="wx-modes" role="tablist" aria-label="Map mode">
          {MODES.map((m) => <button key={m.id} role="tab" aria-selected={viewMode === m.id} title={m.hint} onClick={() => setViewMode(m.id)}>{m.label}</button>)}
        </div>}
        <div className="wx-top__right">
          <TierBadge tier={dataTier} completeness={s.showcase?.manifest.completeness} />
          <button className="wx-link" onClick={() => setSatelliteBasemap(!satelliteBasemap)} aria-pressed={satelliteBasemap}>{satelliteBasemap ? "Imagery on" : "Imagery off"}</button>
          <button className="wx-link" onClick={returnToOverview}>Return to overview</button>
          <Link className="wx-link" href="/wetland/global">Explore another place →</Link>
        </div>
      </nav>

      <WetlandStage />
      {acquisitionsOnly ? <AcquisitionsOnly /> : <SiteHeader />}
      {viewMode === "RADAR" && !acquisitionsOnly && <RadarControls />}

      {!acquisitionsOnly && <div className="wx-legend" aria-label="Map legend">
        <span><i className="lg lg--strong" />Radar tests agree</span><span><i className="lg lg--moderate" />Partly agree</span><span><i className="lg lg--uncertain" />Uncertain</span>
        <span><i className="lg lg--none" />No candidate ≠ unchanged</span>{optical !== "SUPPORT_LIMITED" && <span><i className="lg lg--gap" />No optical comparison</span>}
      </div>}

      <div className="wx-tools" role="toolbar" aria-label="Investigation tools">
        {TOOLS.filter((t) => !acquisitionsOnly || ["CHAIN", "RADAR_WHY", "ABOUT"].includes(t.id)).map((t) => <button key={t.id} aria-pressed={activeDrawer === t.id} onClick={() => setDrawer(activeDrawer === t.id ? "NONE" : t.id)}>{t.label}</button>)}
        <Link href="/wetland/classic" className="wx-tools__adv">Advanced dashboard</Link>
      </div>

      {activeDrawer !== "NONE" && (
        <aside className="wx-drawer" aria-label={DRAWER_TITLE[activeDrawer]}>
          <div className="wx-drawer__bar"><span>{DRAWER_TITLE[activeDrawer]}</span><button onClick={() => { if (activeDrawer === "INVESTIGATE") s.setSelectedPatch(null); setDrawer("NONE"); }} aria-label="Close panel">✕</button></div>
          <div className="wx-drawer__body">
            {activeDrawer === "INVESTIGATE" && <InvestigationDrawer />}{activeDrawer === "DETECTIVE" && <DetectiveDrawer />}
            {activeDrawer === "SENSITIVITY" && <SensitivityDrawer />}{activeDrawer === "STORY" && <StoryDrawer />}{activeDrawer === "CHAIN" && <ChainDrawer />}
            {activeDrawer === "RADAR_WHY" && <WhyRadarDrawer />}{activeDrawer === "COMPARE" && <CompareDrawer />}{activeDrawer === "OPTICAL" && <OpticalDrawer />}{activeDrawer === "ABOUT" && <AboutDrawer />}
          </div>
        </aside>
      )}

      {!acquisitionsOnly && <TimeMachine />}

      {(isLoadingData || !showcaseChecked) && <div className="wx-toast" role="status">Loading observations…</div>}
      {dataError && <div className="wx-toast wx-toast--err" role="alert">{dataError}</div>}
      {dataTier === "SANDBOX" && showcaseChecked && <div className="wx-sandbox-note" role="note"><b>INTERACTIVE SANDBOX</b> — deterministic simulation, not measured data. The real NISAR featured case appears here once exported with <code>pipeline/export_showcase.py</code>.</div>}
    </div>
  );
}
