"use client";

import React, { useEffect, useMemo, useState } from "react";
import { showcaseUrl, type ShowcaseReference } from "@/lib/showcase";
import { useWetlandStore } from "@/lib/store";
import { challenge, changeStory, evidenceStack, fmtDate, fmtDateLong, interpret, interpretationOfClass, opticalLabel, opticalState, type StackStatus } from "@/lib/story";
import { Section, TierBadge } from "./ui";

const STATUS_WORD: Record<StackStatus, string> = { PASS: "Supported", PARTIAL: "Partial", FAIL: "Not shown", UNAVAILABLE: "Unavailable" };

/* ── Evidence Stack: what evidence exists, never a confidence score ── */
export function EvidenceStack() {
  const { selectedPatch: p, dataTier, pulseData } = useWetlandStore();
  if (!p) return null;
  const rows = evidenceStack(p, opticalState(dataTier, pulseData));
  return (
    <ul className="wx-stack" aria-label="Evidence stack">
      {rows.map((r) => (
        <li key={r.key} data-status={r.status}>
          <div className="wx-stack__head"><span>{r.label}</span><em>{STATUS_WORD[r.status]}</em></div>
          <div className="wx-stack__bar" aria-hidden="true"><i style={{ width: r.status === "UNAVAILABLE" ? "0%" : r.magnitude != null ? `${Math.max(6, r.magnitude * 100)}%` : r.status === "PASS" ? "100%" : r.status === "PARTIAL" ? "50%" : "8%" }} /></div>
          <small>{r.detail}</small>
        </li>
      ))}
      <li className="wx-stack__note">HH and HV bars show the size of the measured change on a ±10 dB scale. Other bars show whether a test passed — not a probability.</li>
    </ul>
  );
}

/* ── WHY THIS REGION? ── */
export function InvestigationDrawer() {
  const { selectedPatch: p, dataTier, pulseData, challengeOpen, setChallengeOpen, showcase } = useWetlandStore();
  if (!p) return <p className="wx-hint">Click any candidate region on the map. Hover shows its id; click starts the investigation.</p>;
  const optical = opticalState(dataTier, pulseData);
  const it = interpret(p, optical); const ch = challenge(p, optical);
  const sim = p.data_source === "SIMULATED_DEMO";
  return (
    <div className="wx-investigate">
      <p className="wx-eyebrow">WHY THIS REGION?</p>
      <h2>Region {p.id.split("_").pop()}<small> · {fmtDateLong(p.date)}</small></h2>
      {sim && <p className="wx-note wx-note--sim">Simulation. Every value below is fictional; no satellite observation supports it.</p>}
      <div className="wx-interp"><span>Interpretation</span><strong>{it.headline}</strong><p>{it.note}</p></div>

      <Section eyebrow="WHAT DO WE ACTUALLY KNOW?" title="Evidence stack"><EvidenceStack /></Section>

      <Section eyebrow="RAW → DERIVED → CONTEXT → INTERPRETATION" title="How this was built">
        <ol className="wx-flow">
          <li data-k="observed"><b>OBSERVED</b><span>{sim ? "Simulated HH / HV responses" : "NISAR L2 GCOV HH & HV power"} · acquired {p.date}</span><span>HH {p.hh_before.toFixed(1)} → {p.hh_after.toFixed(1)} dB · HV {p.hv_before.toFixed(1)} → {p.hv_after.toFixed(1)} dB</span></li>
          <li data-k="derived"><b>DERIVED</b><span>ΔHH {p.delta_hh.toFixed(1)} dB · ΔHV {p.delta_hv.toFixed(1)} dB</span><span>{p.area_km2.toFixed(2)} km² candidate area · {(p.valid_fraction * 100).toFixed(0)}% valid · threshold {p.threshold_stability.toLowerCase()}</span></li>
          <li data-k="contextual"><b>CONTEXTUAL</b><span>{opticalLabel(optical, showcase?.reference)}</span><span>{sim ? "Fictional boundary" : "Reference study mask — not an official wetland boundary"}</span></li>
          <li data-k="potential"><b>POTENTIAL INTERPRETATION</b><span>{interpretationOfClass(p.classification)}</span><span>Other scattering explanations remain possible.</span></li>
        </ol>
      </Section>

      <button className="wx-challenge" onClick={() => setChallengeOpen(!challengeOpen)} aria-expanded={challengeOpen}>
        {challengeOpen ? "HIDE THE CHALLENGE" : "CHALLENGE THIS DETECTION"}
      </button>
      {challengeOpen && (
        <div className="wx-challenge-panel" role="region" aria-label="Challenge this detection">
          <p className="wx-eyebrow">WHAT COULD WE BE MISSING?</p>
          <h3>Can we trust this change?</h3>
          <ul className="wx-checks">
            {ch.passes.map((t) => <li key={t} data-k="ok"><i>✓</i>{t}</li>)}
            {ch.warnings.map((t) => <li key={t} data-k="warn"><i>⚠</i>{t}</li>)}
          </ul>
          <dl className="wx-status">
            <div><dt>Current status</dt><dd>{ch.status}</dd></div>
            <div><dt>Interpretation</dt><dd>{ch.interpretation}</dd></div>
            <div><dt>Independent support</dt><dd>{ch.independent}</dd></div>
            <div><dt>Validation</dt><dd>{ch.validation}</dd></div>
            <div><dt>Recommendation</dt><dd>{ch.recommendation}</dd></div>
          </dl>
        </div>
      )}
    </div>
  );
}

/* ── SAR DETECTIVE ── */
export function DetectiveDrawer() {
  const { probeResult: r, probeActive, dataTier, selectedPatch } = useWetlandStore();
  if (!r) return <div className="wx-detective-empty"><p className="wx-eyebrow">SAR DETECTIVE</p><h2>Sample the Earth.</h2><p className="wx-hint">{probeActive ? "Click anywhere on the map to read the radar signal at that location." : "Activate the detective, then click the map."}</p>
    <p className="wx-note">{dataTier === "LOCAL_RUN" ? "Local run: samples a measured raster cell." : "This build samples the region-average of the candidate polygon under the cursor (no per-pixel raster is published)."}</p></div>;
  const v = (n: number | null) => (n == null ? "—" : n.toFixed(1));
  const sim = r.data_source === "SIMULATED";
  const darkening = (r.delta_hh ?? 0) <= -1; const brightening = (r.delta_hh ?? 0) >= 1;
  return (
    <div className="wx-detective">
      <p className="wx-eyebrow">SAR DETECTIVE</p>
      {sim && <p className="wx-note wx-note--sim">Simulation — values are fictional.</p>}
      <dl className="wx-loc"><dt>LOCATION</dt><dd>{Math.abs(r.lat).toFixed(4)}° {r.lat >= 0 ? "N" : "S"}<br />{Math.abs(r.lng).toFixed(4)}° {r.lng >= 0 ? "E" : "W"}</dd></dl>
      {r.valid ? <>
        {(["HH", "HV"] as const).map((ch) => { const b = ch === "HH" ? r.hh_before : r.hv_before; const a = ch === "HH" ? r.hh_after : r.hv_after; const d = ch === "HH" ? r.delta_hh : r.delta_hv;
          return <div key={ch} className="wx-sig"><h4>NISAR {ch}</h4><table><tbody><tr><td>Before</td><td>{v(b)} dB</td></tr><tr><td>After</td><td>{v(a)} dB</td></tr><tr className="is-delta"><td>Change</td><td>{d != null && d > 0 ? "+" : ""}{v(d)} dB</td></tr></tbody></table></div>; })}
        <div className="wx-sig"><h4>TEMPORAL SIGNAL</h4><p>{selectedPatch?.temporal_status === "PASS" ? "Observed across multiple dates" : "Persistence across dates not fully shown"}</p></div>
        <div className="wx-sig"><h4>SPATIAL SIGNAL</h4><p>{selectedPatch?.spatial_status === "PASS" ? "Strong local consistency" : "Select this region for its spatial test"}</p></div>
        <div className="wx-sig"><h4>INTERPRETATION</h4><p>{darkening ? "HH-darkening candidate" : brightening ? "HH-increase candidate" : "No clear HH change here"}</p></div>
      </> : <p className="wx-note">No detector result at this location. That means <b>no candidate here</b> — not that the surface is unchanged.</p>}
      <p className="wx-limit"><b>LIMITATION</b> Radar change does not by itself prove flooding. {r.resolution === "REGION" ? "Values are region averages, not a single pixel." : "Values come from a single raster cell."}</p>
    </div>
  );
}

/* ── DETECTION SENSITIVITY: does the signal survive? ── */
export function SensitivityDrawer() {
  const { sensitivityData: s, dataTier, threshold, setThreshold, demoMode } = useWetlandStore();
  const [shown, setShown] = useState(threshold);
  if (!s) return <p className="wx-hint">No sensitivity sweep is available.</p>;
  const cur = demoMode ? threshold : shown;
  const max = Math.max(...s.thresholds.map((t) => t.area_km2), 0.0001);
  const row = s.thresholds.find((t) => Math.abs(t.delta_db - cur) < 0.01);
  return (
    <div className="wx-sens">
      <p className="wx-eyebrow">DOES THE SIGNAL SURVIVE?</p>
      <h2>Does the story survive a stricter threshold?</h2>
      <p className={`wx-note ${demoMode ? "wx-note--sim" : ""}`}>{demoMode ? "SIMULATED INTERACTION — moving the slider re-runs the demonstration rule and the map updates."
        : dataTier === "SHOWCASE" ? "STORED SENSITIVITY SWEEP — computed when this case was processed. The slider highlights a stored row; the map keeps showing the stored result and is not recomputed here."
          : "STORED SENSITIVITY SWEEP — read from the saved run. The slider highlights a stored row; the map is not recomputed."}</p>
      <label className="wx-slider">Threshold <b>{cur.toFixed(1)} dB</b>
        <input type="range" min={0.5} max={5} step={0.5} value={cur} onChange={(e) => demoMode ? setThreshold(Number(e.target.value)) : setShown(Number(e.target.value))} aria-label="Detection threshold in dB" /></label>
      <ul className="wx-bars">{s.thresholds.map((t) => (
        <li key={t.delta_db} className={Math.abs(t.delta_db - cur) < 0.01 ? "is-current" : ""}>
          <span>{t.delta_db.toFixed(1)} dB</span><div><i style={{ width: `${(t.area_km2 / max) * 100}%` }} /></div><em>{t.area_km2.toFixed(1)} km² · {t.patches}</em></li>))}</ul>
      {row && <p className="wx-readout">At {row.delta_db.toFixed(1)} dB: <b>{row.area_km2.toFixed(2)} km²</b> across <b>{row.patches}</b> regions.</p>}
      <p className={`wx-verdict wx-verdict--${s.stability_verdict.toLowerCase()}`}><b>{s.stability_verdict === "STABLE" ? "STABLE" : "SENSITIVE"}</b> {s.sensitivity_note}</p>
    </div>
  );
}

/* ── CHANGE STORY ── */
export function StoryDrawer() {
  const { pulseData, dataTier, showcase } = useWetlandStore();
  if (!pulseData) return null;
  const paras = changeStory(pulseData, dataTier, opticalState(dataTier, pulseData), showcase?.reference);
  return <div className="wx-story"><p className="wx-eyebrow">WHAT HAPPENED?</p>{paras.map((t, i) => <p key={i}>{t}</p>)}<p className="wx-note">Generated from the loaded values only. It names no causes.</p></div>;
}

/* ── NASA DATA CHAIN ── */
const CHAIN = [
  ["NASA NISAR", "L-band radar observes the same ground repeatedly, day or night, through cloud."],
  ["GCOV", "Level-2 geocoded covariance: calibrated backscatter on a map grid."],
  ["HH + HV", "Two polarizations. HH reacts strongly to smooth water; HV to vegetation structure."],
  ["Temporal baseline", "An earlier observation (or per-pixel median of earlier ones) is the 'before'."],
  ["Radar change", "After minus before, in dB, only where data are valid."],
  ["Candidate regions", "Contiguous changed pixels become polygons with area and statistics."],
  ["Evidence tests", "Quality, local consistency, multi-date persistence, threshold stability."],
  ["Contextual comparison", "Optical (HLS) agreement on shared clear pixels — context, not truth."],
  ["Human interpretation", "You decide what the evidence supports."],
];
export function ChainDrawer() {
  const [open, setOpen] = useState<number | null>(null);
  return <div className="wx-chain"><p className="wx-eyebrow">NASA DATA CHAIN</p><h2>We are not drawing polygons. We are turning observations into evidence.</h2>
    <ol>{CHAIN.map(([t, d], i) => <li key={t}><button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}><span>{i + 1}</span>{t}</button>{open === i && <p>{d}</p>}</li>)}</ol></div>;
}

/* ── WHY RADAR? ── */
export function WhyRadarDrawer() {
  const [clouds, setClouds] = useState(true);
  return <div className="wx-why"><p className="wx-eyebrow">WHY RADAR?</p><h2>Some places are hard to see.</h2>
    <label className="wx-toggle"><input type="checkbox" checked={clouds} onChange={(e) => setClouds(e.target.checked)} /> Cloud cover during the monsoon</label>
    <div className="wx-why-grid">
      <div data-blocked={clouds}><b>Optical</b><span>{clouds ? "Cloud blocks the view — no usable image." : "Clear sky — usable image."}</span></div>
      <div><b>NISAR L-band radar</b><span>Microwaves pass through cloud — still observable.</span></div>
      <div><b>Vegetation</b><span>Long L-band waves can interact with water beneath and around canopy, which optical cannot see.</span></div>
    </div><p className="wx-note">A radar signal change can have several causes. That is why this app asks you to challenge every detection.</p></div>;
}

/* ── LOCK COMPARISON ── */
export function CompareDrawer() {
  const { pulseData, lock, lockComparison, clearLock, selectedDateIndex, radarOpacity, setRadarOpacity } = useWetlandStore();
  const dates = useMemo(() => pulseData?.dates ?? [], [pulseData]);
  const [b, setB] = useState(0); const [a, setA] = useState(Math.max(0, selectedDateIndex));
  if (dates.length < 2) return <p className="wx-hint">At least two observation dates are needed.</p>;
  return <div className="wx-compare"><p className="wx-eyebrow">COMPARISON WORKSPACE</p><h2>Lock two dates.</h2>
    <label>BEFORE<select value={b} onChange={(e) => setB(Number(e.target.value))}>{dates.map((d, i) => <option key={d.date} value={i}>{fmtDate(d.date)}</option>)}</select></label>
    <label>AFTER<select value={a} onChange={(e) => setA(Number(e.target.value))}>{dates.map((d, i) => <option key={d.date} value={i}>{fmtDate(d.date)}</option>)}</select></label>
    {lock ? <button className="wx-btn" onClick={clearLock}>UNLOCK</button> : <button className="wx-btn wx-btn--primary" disabled={a === b} onClick={() => void lockComparison(b, a)}>LOCK</button>}
    {lock && <p className="wx-note">Locked: {fmtDate(dates[lock.beforeIndex].date)} ⟷ {fmtDate(dates[lock.afterIndex].date)}. Drag or use arrow keys on the divider. Candidate regions are the stored detections for each date.</p>}
    <label>Radar layer opacity <b>{Math.round(radarOpacity * 100)}%</b><input type="range" min={0.2} max={1} step={0.05} value={radarOpacity} onChange={(e) => setRadarOpacity(Number(e.target.value))} /></label>
    <p className="wx-note">Locking pauses playback. Both sides show real stored detections for the chosen dates; nothing is interpolated.</p></div>;
}

export function AboutDrawer() {
  const { dataTier, showcase, pulseData, switchToSandbox, loadShowcase } = useWetlandStore();
  return <div className="wx-about"><p className="wx-eyebrow">PROVENANCE</p><TierBadge tier={dataTier} />
    {dataTier === "SHOWCASE" && showcase && <ul><li>Source: {showcase.manifest.source}</li><li>Product: {showcase.manifest.product} ({showcase.manifest.product_maturity ?? "provisional"})</li><li>Baseline: {showcase.manifest.baseline_date}{showcase.manifest.baseline_method === "PER_PIXEL_MEDIAN" && showcase.manifest.baseline_observation_dates ? ` (per-pixel median of ${showcase.manifest.baseline_observation_dates.length} earlier observations)` : ""}</li><li>Exported: {fmtDate(showcase.manifest.exported_at.slice(0, 10), { month: "short", day: "numeric", year: "numeric" })}</li>{showcase.manifest.limitations.map((l) => <li key={l}>{l}</li>)}</ul>}
    {dataTier === "SHOWCASE" && showcase?.manifest.legacy && <div className="wx-legacy">
      <p className="wx-note"><b>Legacy NISAR run — {showcase.manifest.completeness === "METADATA_ONLY" ? "acquisition dates and boundary only" : "partial export"}.</b> {showcase.manifest.legacy.note}</p>
      <p className="wx-eyebrow">NOT IN THIS EXPORT</p>
      <ul>{showcase.manifest.legacy.skipped.map((x) => <li key={x.artifact}><b>{x.artifact}</b> — {x.reason}</li>)}</ul></div>}
    {dataTier === "SANDBOX" && <p className="wx-note wx-note--sim">All dates, signals and geometry are a fictional, deterministic simulation for demonstrating interactions. No satellite data are used.</p>}
    {dataTier === "LOCAL_RUN" && <p className="wx-note">Saved pipeline run {pulseData?.site}. Provisional NISAR product; not validated.</p>}
    <div className="wx-row"><button className="wx-btn" onClick={() => void loadShowcase()}>Open featured case</button><button className="wx-btn" onClick={switchToSandbox}>Open sandbox</button></div></div>;
}

/* ── DOES AN INDEPENDENT SENSOR AGREE? ── */
const pct = (v: number | null | undefined) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);
export function OpticalDrawer() {
  const { dataTier, showcase, pipelineRunId, pulseData } = useWetlandStore();
  const [local, setLocal] = useState<{ id: string; ref: ShowcaseReference | null } | null>(null);
  useEffect(() => {
    if (dataTier !== "LOCAL_RUN" || !pipelineRunId) return;
    let live = true;
    fetch(`/api/wetland/reference-evidence?run=${pipelineRunId}`).then((r) => (r.ok ? r.json() : null))
      .then((evidence) => { if (live) setLocal({ id: pipelineRunId, ref: evidence ? { available: true, evidence } : { available: false } }); })
      .catch(() => { if (live) setLocal({ id: pipelineRunId, ref: { available: false } }); });
    return () => { live = false; };
  }, [dataTier, pipelineRunId]);
  const state = opticalState(dataTier, pulseData);
  const ref = dataTier === "SHOWCASE" ? showcase?.reference : local?.id === pipelineRunId ? local.ref : null;
  const ev = ref?.evidence; const m = ev?.metrics;
  return (
    <div className="wx-optical">
      <p className="wx-eyebrow">DOES AN INDEPENDENT SENSOR AGREE?</p>
      <h2>{opticalLabel(state, showcase?.reference)}</h2>
      {state === "SIMULATED" && <p className="wx-note wx-note--sim">The sandbox has no optical data. Nothing here supports or contradicts the simulated candidates.</p>}
      {state !== "SIMULATED" && !ev && <p className="wx-note">{dataTier === "LOCAL_RUN" && !local ? "Loading saved comparison…" : "No optical comparison was saved with this run. Absence of a check is not disagreement."}</p>}
      {ev && <>
        <dl className="wx-status">
          <div><dt>Common clear area</dt><dd>{pct(ev.coverage?.common_clear_fraction)}</dd></div>
          {ev.comparison?.baseline?.hls_date && <div><dt>HLS dates</dt><dd>{ev.comparison.baseline.hls_date} → {ev.comparison.event?.hls_date}</dd></div>}
          {m && <><div><dt>Agree (radar + optical)</dt><dd>{m.matching_pixels.toLocaleString()} cells</dd></div>
            <div><dt>Radar only</dt><dd>{m.radar_only_pixels.toLocaleString()} cells</dd></div>
            <div><dt>Optical only</dt><dd>{m.optical_only_pixels.toLocaleString()} cells</dd></div>
            <div><dt>Precision · recall · F1</dt><dd>{pct(m.precision)} · {pct(m.recall)} · {pct(m.f1)}</dd></div></>}
        </dl>
        {ev.showcase_images && Object.keys(ev.showcase_images).length > 0 && <div className="wx-optical-imgs">
          {Object.entries(ev.showcase_images).slice(0, 4).map(([name, path]) => (
            // eslint-disable-next-line @next/next/no-img-element
            <figure key={name}><img loading="lazy" src={showcaseUrl(path)} alt={`Optical evidence ${name.replace(/_/g, " ")}`} /><figcaption>{name.replace(/^reference_|\.png$/g, "").replace(/_/g, " ")}</figcaption></figure>))}
        </div>}
        <p className="wx-limit"><b>LIMITATION</b> This is a cross-sensor agreement check on shared clear pixels. It is not field truth and does not validate flooded vegetation. Low agreement can mean water was already present on both optical dates.</p>
        {ev.limitations?.map((l) => <p key={l} className="wx-note">{l}</p>)}
      </>}
    </div>
  );
}
