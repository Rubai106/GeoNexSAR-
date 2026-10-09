/* Evidence-derived language. Everything here is computed from loaded data;
   nothing is generated, estimated or invented. */
import type { WetlandPatch, WetlandPulseData } from "./types";
import type { DataTier } from "./store";
import type { ShowcaseReference } from "./showcase";

export const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
};
export const fmtDateLong = (iso: string) => fmtDate(iso, { month: "long", day: "numeric", year: "numeric" });
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

export type OpticalState = "SUPPORT_LIMITED" | "INCONCLUSIVE" | "NOT_RUN" | "SIMULATED";

/** Optical (HLS) context level for the whole run, from recorded status only. */
export function opticalState(tier: DataTier, pulse: WetlandPulseData | null): OpticalState {
  if (tier === "SANDBOX" || pulse?.data_source === "SIMULATED_DEMO") return "SIMULATED";
  const status = pulse?.reference_check_status ?? "NOT_RUN";
  if (status === "CROSS_SENSOR_CHECK") return "SUPPORT_LIMITED"; // a comparison ran; it is never field validation
  if (status === "INCONCLUSIVE") return "INCONCLUSIVE";
  return "NOT_RUN";
}

export function opticalLabel(state: OpticalState, reference?: ShowcaseReference | null) {
  const clear = reference?.evidence?.coverage?.common_clear_fraction;
  switch (state) {
    case "SUPPORT_LIMITED": return `Cross-sensor comparison completed${clear != null ? ` · ${(clear * 100).toFixed(0)}% common clear area` : ""} · not field validation`;
    case "INCONCLUSIVE": return "Cross-sensor evidence inconclusive";
    case "SIMULATED": return "No optical data · simulation";
    default: return "No optical comparison available";
  }
}

export type Interpretation = { headline: string; note: string };

/** Carefully worded interpretation. Never a score; never "confirmed". */
export function interpret(patch: WetlandPatch, optical: OpticalState): Interpretation {
  const strong = patch.evidence_state === "SUPPORTED";
  const uncertain = patch.evidence_state === "UNCERTAIN" || patch.evidence_state === "REJECTED";
  if (optical === "INCONCLUSIVE") return { headline: "Inconclusive due to insufficient optical coverage", note: "The radar change is recorded, but the independent optical check could not assess this area." };
  if (uncertain) return { headline: "Needs further investigation", note: "The detector rules did not agree on this region. Treat it as a weak radar change candidate." };
  if (strong && optical === "SUPPORT_LIMITED") return { headline: "Strong radar response, limited contextual support", note: "Radar tests agree; the optical comparison covers only part of the area and is not ground truth." };
  if (strong) return { headline: "Possible inundation-related change", note: "Radar tests agree. No independent sensor has assessed this region." };
  return { headline: "Radar change candidate", note: "Some radar tests agree and others are partial. Needs further investigation." };
}

export const interpretationOfClass = (c: WetlandPatch["classification"]) =>
  c === "OPEN_WATER" ? "HH-darkening candidate (consistent with open water, among other causes)"
    : c === "VEGETATED_INUNDATION" ? "HH-increase / HV-stable candidate (consistent with flooded vegetation, among other causes)"
      : "Uncertain radar change candidate";

export type StackStatus = "PASS" | "PARTIAL" | "FAIL" | "UNAVAILABLE";
export interface StackRow { key: string; label: string; status: StackStatus; detail: string; magnitude?: number }

/** What evidence exists — not how confident anyone is. */
export function evidenceStack(patch: WetlandPatch, optical: OpticalState): StackRow[] {
  const mag = (db: number) => Math.min(1, Math.abs(db) / 10);
  const opticalRow: StackRow = optical === "SUPPORT_LIMITED"
    ? { key: "optical", label: "Optical context (HLS)", status: "PARTIAL", detail: "Comparison ran on shared clear pixels only" }
    : optical === "INCONCLUSIVE" ? { key: "optical", label: "Optical context (HLS)", status: "UNAVAILABLE", detail: "Inconclusive — too little common clear area" }
      : { key: "optical", label: "Optical context (HLS)", status: "UNAVAILABLE", detail: optical === "SIMULATED" ? "Not part of the simulation" : "Not run for this study" };
  return [
    { key: "hh", label: "NISAR HH", status: Math.abs(patch.delta_hh) >= 1 ? "PASS" : "PARTIAL", detail: `${patch.hh_before.toFixed(1)} → ${patch.hh_after.toFixed(1)} dB (Δ ${patch.delta_hh.toFixed(1)})`, magnitude: mag(patch.delta_hh) },
    { key: "hv", label: "NISAR HV", status: Math.abs(patch.delta_hv) >= 1 ? "PASS" : "PARTIAL", detail: `${patch.hv_before.toFixed(1)} → ${patch.hv_after.toFixed(1)} dB (Δ ${patch.delta_hv.toFixed(1)})`, magnitude: mag(patch.delta_hv) },
    { key: "temporal", label: "Seen on multiple dates", status: patch.temporal_status, detail: patch.temporal_status === "PASS" ? "Persistence test passed" : patch.temporal_status === "PARTIAL" ? "Partly persistent" : "Not persistent" },
    { key: "spatial", label: "Persists across nearby pixels", status: patch.spatial_status, detail: patch.spatial_status === "PASS" ? "Local consistency test passed" : patch.spatial_status === "PARTIAL" ? "Partly consistent" : "Not locally consistent" },
    { key: "quality", label: "Data quality", status: patch.quality_status, detail: `${(patch.valid_fraction * 100).toFixed(0)}% valid coverage` },
    opticalRow,
    { key: "truth", label: "Ground truth", status: "UNAVAILABLE", detail: "No field observations in this study" },
  ];
}

export interface ChallengeResult { passes: string[]; warnings: string[]; status: string; interpretation: string; independent: string; validation: string; recommendation: string }

export function challenge(patch: WetlandPatch, optical: OpticalState): ChallengeResult {
  const passes: string[] = []; const warnings: string[] = [];
  (patch.temporal_status === "PASS" ? passes : warnings).push(patch.temporal_status === "PASS" ? "Multi-date persistence" : "Persistence across dates is not fully shown");
  (patch.spatial_status === "PASS" ? passes : warnings).push(patch.spatial_status === "PASS" ? "Spatial consistency" : "Local spatial consistency is not fully shown");
  (Math.abs(patch.delta_hh) >= 1 ? passes : warnings).push(Math.abs(patch.delta_hh) >= 1 ? "HH response" : "HH response is small");
  (Math.abs(patch.delta_hv) >= 1 ? passes : warnings).push(Math.abs(patch.delta_hv) >= 1 ? "HV response" : "HV response is small");
  if (patch.threshold_stability === "STABLE") passes.push("Survives nearby detection thresholds"); else warnings.push("Sensitive to the detection threshold");
  if (patch.quality_status !== "PASS") warnings.push("Data quality is not fully passing");
  warnings.push(optical === "SUPPORT_LIMITED" ? "Optical coverage limited" : optical === "INCONCLUSIVE" ? "Optical comparison inconclusive" : "No optical comparison");
  warnings.push("No field truth", "Radar response may have multiple causes");
  const it = interpret(patch, optical);
  return { passes, warnings, status: "RADAR CHANGE DETECTED", interpretation: it.headline,
    independent: optical === "SUPPORT_LIMITED" ? "Limited" : "None available", validation: "Incomplete", recommendation: "Needs investigation" };
}

/** WHAT HAPPENED? — assembled strictly from loaded values. */
export function changeStory(pulse: WetlandPulseData, tier: DataTier, optical: OpticalState, reference?: ShowcaseReference | null): string[] {
  const d = pulse.dates; if (!d.length) return [];
  const first = d[0].date; const last = d[d.length - 1].date; const peak = d.find((o) => o.date === pulse.peak.date) ?? d[0];
  const sim = tier === "SANDBOX";
  const paras = [
    `${sim ? "In this simulation, between" : "Between"} ${fmtDateLong(first)} and ${fmtDateLong(last)}, the ${sim ? "simulated " : ""}radar signal changed across detected candidate regions within the study area (${d.length} observation dates).`,
    `Peak candidate activity ${sim ? "in the scenario " : ""}occurred on ${fmtDateLong(peak.date)}: ${peak.patches} candidate regions covering ${peak.area_km2.toFixed(2)} km².`,
  ];
  const gaps = d.slice(1).map((o, i) => ({ days: daysBetween(d[i].date, o.date), from: d[i].date, to: o.date })).filter((g) => g.days > 14);
  if (gaps.length) paras.push(`Acquisition gaps are real and left unfilled: ${gaps.map((g) => `${g.days} days between ${fmtDate(g.from)} and ${fmtDate(g.to)}`).join("; ")}.`);
  if (sim) paras.push("All values are deterministic simulation. No satellite observation supports this story.");
  else {
    paras.push("Multi-date radar evidence is recorded per region; see each region's evidence tests.");
    const clear = reference?.evidence?.coverage?.common_clear_fraction;
    paras.push(optical === "SUPPORT_LIMITED"
      ? `A cross-sensor optical comparison was completed${clear != null ? ` over ${(clear * 100).toFixed(0)}% common clear area` : ""}. It is not field validation, so treat this as exploratory radar evidence rather than confirmed flooding.`
      : optical === "INCONCLUSIVE" ? "The optical comparison was inconclusive, so this should be treated as exploratory radar evidence rather than confirmed flooding."
        : "Independent optical coverage is not available, so this should be treated as exploratory radar evidence rather than confirmed flooding.");
  }
  return paras;
}

export interface Phase { key: "baseline" | "onset" | "peak" | "recession"; label: string; date: string }
export function phases(pulse: WetlandPulseData): Phase[] {
  const out: Phase[] = [];
  if (pulse.baseline_date) out.push({ key: "baseline", label: "Baseline", date: pulse.baseline_date });
  if (pulse.onset) out.push({ key: "onset", label: "Onset", date: pulse.onset });
  out.push({ key: "peak", label: "Peak", date: pulse.peak.date });
  if (pulse.recession_start) out.push({ key: "recession", label: "Recession", date: pulse.recession_start });
  return out;
}
