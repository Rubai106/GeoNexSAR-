/* ──────────────────────────────────────────────────────
   Featured Case (showcase) loader
   Static, credential-free derived assets produced by
   `pipeline/export_showcase.py` and served from /showcase/<id>/.
   ────────────────────────────────────────────────────── */

import type { SiteBoundary, WetlandGeometry, WetlandPatch, WetlandPulseData, SensitivityData } from "./types";

export const SHOWCASE_ID = "featured";
export const showcaseUrl = (path: string, id = SHOWCASE_ID) => `/showcase/${id}/${path}`;

export interface ShowcaseManifest {
  showcase_version: number;
  case_id: string;
  label: string;
  run_id: string;
  site_name: string;
  /** Verified display name (e.g. from the committed boundary file). */
  site_display_name?: string;
  /** FULL = modern run; PARTIAL / METADATA_ONLY = legacy run with missing derived assets. */
  completeness?: "FULL" | "PARTIAL" | "METADATA_ONLY";
  legacy_format?: boolean;
  availability?: { acquisition_dates: boolean; boundary: boolean; pulse: boolean; sensitivity: boolean; patch_dates: string[]; radar_dates: string[]; reference: boolean };
  legacy?: { source_manifest: string; skipped: { artifact: string; reason: string }[]; note: string };
  observation_scenes?: string[];
  baseline_date?: string;
  baseline_method?: string;
  baseline_observation_dates?: string[];
  selected_date?: string;
  observation_count?: number;
  product?: string;
  product_maturity?: string;
  frequency?: string;
  reference_check_status?: string;
  reference_validated?: boolean;
  cross_sensor_check_completed?: boolean;
  wetland_boundary_source?: string | null;
  site_bounds?: [number, number, number, number] | null;
  quality_mask_method?: string | null;
  completed_at?: string;
  exported_at: string;
  observation_dates: string[];
  radar_dates: string[];
  has_reference: boolean;
  limitations: string[];
  source: string;
}

export interface ShowcaseObservation { date: string; index: number; patches_file: string | null; scene_name?: string | null }

export interface RadarLayer { images: Record<string, string>; scale_db: number[]; change_scale_db: number[]; bounds: number[][]; width: number; height: number }
export interface RadarPreview { run_id: string; date: string; baseline_date?: string; baseline_observation_dates?: string[]; note?: string; layers: Record<string, RadarLayer> }

export interface ShowcaseReference {
  available: boolean;
  validation?: Record<string, unknown>;
  evidence?: {
    coverage?: { common_clear_fraction?: number; common_clear_area_km2?: number };
    metrics?: { precision: number | null; recall: number | null; f1: number | null; matching_pixels: number; radar_only_pixels: number; optical_only_pixels: number };
    reference_status?: string;
    comparison?: { baseline?: { hls_date?: string }; event?: { hls_date?: string } };
    limitations?: string[];
    showcase_images?: Record<string, string>;
  };
}

export interface ShowcaseBundle {
  manifest: ShowcaseManifest;
  /** null for a legacy run whose pulse could not be verified: only acquisition dates are known. */
  pulse: WetlandPulseData | null;
  boundary: SiteBoundary | null;
  sensitivity: SensitivityData | null;
  observations: ShowcaseObservation[];
  reference: ShowcaseReference;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(showcaseUrl(path));
  if (!response.ok) throw new Error(`Showcase asset missing: ${path}`);
  return response.json() as Promise<T>;
}

/** Returns null when no featured case has been exported/committed (the normal state of a fresh clone). */
export async function loadShowcaseBundle(): Promise<ShowcaseBundle | null> {
  let manifest: ShowcaseManifest;
  try {
    const probe = await fetch(showcaseUrl("manifest.json"));
    if (!probe.ok) return null;
    manifest = await probe.json() as ShowcaseManifest;
  } catch { return null; }
  if (manifest.showcase_version !== 1 || !manifest.run_id) return null;
  const has = manifest.availability ?? { acquisition_dates: true, boundary: true, pulse: true, sensitivity: true, patch_dates: [], radar_dates: [], reference: manifest.has_reference };
  const optional = <T,>(path: string, on: boolean) => (on ? getJson<T>(path).catch(() => null) : Promise.resolve(null));
  const [pulse, boundary, sensitivity, observations, reference] = await Promise.all([
    optional<WetlandPulseData>("pulse.json", has.pulse), optional<SiteBoundary>("boundary.geojson", has.boundary),
    optional<SensitivityData>("sensitivity.json", has.sensitivity), getJson<ShowcaseObservation[]>("observations.json"),
    getJson<ShowcaseReference>("reference.json").catch(() => ({ available: false }) as ShowcaseReference),
  ]);
  if (has.pulse && (!pulse || !Array.isArray(pulse.dates) || !pulse.dates.length)) throw new Error("Showcase pulse is empty.");
  const pulseData: WetlandPulseData | null = pulse ? { ...pulse, data_source: "NISAR", product: manifest.product,
    product_maturity: manifest.product_maturity, reference_validated: manifest.reference_validated === true,
    cross_sensor_check_completed: manifest.cross_sensor_check_completed === true,
    reference_check_status: manifest.reference_check_status ?? "NOT_RUN", baseline_date: manifest.baseline_date,
    quality_mask_method: manifest.quality_mask_method, site_bounds: manifest.site_bounds,
    wetland_boundary_source: manifest.wetland_boundary_source, site: manifest.site_display_name || manifest.site_name || pulse.site } : null;
  return { manifest, pulse: pulseData, boundary, sensitivity: sensitivity ? { ...sensitivity, data_source: "NISAR" } : null, observations, reference };
}

/** Dates that have candidate-region files in this export. Modern runs: every date. */
export function datesWithPatches(bundle: ShowcaseBundle): Set<string> {
  return new Set(bundle.observations.filter((o) => !!o.patches_file).map((o) => o.date));
}

/** Next index in direction `dir` whose date has exported results; -1 if none. `available` null means every date is available. */
export function nextAvailableIndex(dates: { date: string }[], available: Set<string> | null, from: number, dir: 1 | -1): number {
  for (let i = from + dir; i >= 0 && i < dates.length; i += dir) if (!available || available.has(dates[i].date)) return i;
  return -1;
}

const patchCache = new Map<string, WetlandPatch[]>();

export async function loadShowcasePatches(bundle: ShowcaseBundle, date: string): Promise<WetlandPatch[]> {
  const key = `${bundle.manifest.run_id}:${date}`;
  const cached = patchCache.get(key);
  if (cached) return cached;
  const observation = bundle.observations.find((item) => item.date === date);
  if (!observation) throw new Error("Date is not part of the featured case.");
  if (!observation.patches_file) return [];
  const collection = await getJson<{ features: { geometry: WetlandGeometry; properties: Record<string, unknown> }[] }>(observation.patches_file);
  const patches = collection.features.map((feature) => ({ ...(feature.properties as unknown as WetlandPatch),
    geometry: feature.geometry, run_id: bundle.manifest.run_id, data_source: "NISAR" as const }));
  patchCache.set(key, patches);
  return patches;
}

export async function loadShowcaseRadar(date: string): Promise<RadarPreview | null> {
  try {
    const response = await fetch(showcaseUrl(`radar/preview_${date}.json`));
    if (!response.ok) return null;
    const preview = await response.json() as RadarPreview;
    for (const layer of Object.values(preview.layers)) {
      layer.images = Object.fromEntries(Object.entries(layer.images).map(([stage, file]) => [stage, showcaseUrl(file)]));
    }
    return preview;
  } catch { return null; }
}

/* ── Geometry helpers (lng/lat GeoJSON coordinates) ── */

function ringContains(ring: number[][], lng: number, lat: number) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function polygonContains(rings: number[][][], lng: number, lat: number) {
  if (!rings.length || !ringContains(rings[0], lng, lat)) return false;
  return !rings.slice(1).some((hole) => ringContains(hole, lng, lat));
}

export function geometryContains(geometry: WetlandGeometry | undefined, lng: number, lat: number) {
  if (!geometry) return false;
  if (geometry.type === "Polygon") return polygonContains(geometry.coordinates, lng, lat);
  return geometry.coordinates.some((polygon) => polygonContains(polygon, lng, lat));
}

export function featureCollectionContains(collection: SiteBoundary | null, lng: number, lat: number) {
  return !!collection?.features.some((feature) => geometryContains(feature.geometry, lng, lat));
}
