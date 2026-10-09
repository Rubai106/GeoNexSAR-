import React from "react";
import type { DataTier } from "@/lib/store";

export const TIER_COPY: Record<DataTier, { label: string; sub: string; tone: "real" | "sim" | "local" }> = {
  SHOWCASE: { label: "REAL NISAR SHOWCASE", sub: "Actual NISAR-derived processed assets", tone: "real" },
  LOCAL_RUN: { label: "LOCAL NISAR RUN", sub: "Saved pipeline run on this machine", tone: "local" },
  SANDBOX: { label: "INTERACTIVE SANDBOX", sub: "Deterministic simulation — not measured", tone: "sim" },
};

const COMPLETENESS: Record<string, string> = { METADATA_ONLY: "ACQUISITIONS ONLY", PARTIAL: "PARTIAL EXPORT" };
export function TierBadge({ tier, completeness }: { tier: DataTier; completeness?: string }) {
  const c = TIER_COPY[tier]; const extra = completeness ? COMPLETENESS[completeness] : undefined;
  return <span className={`wx-tier wx-tier--${c.tone}`} title={extra ? `${c.sub}. ${extra === "PARTIAL EXPORT" ? "Candidate regions exist for only some dates." : "Derived change results are not included in this export."}` : c.sub}><i aria-hidden="true" />{c.label}{extra ? ` · ${extra}` : ""}</span>;
}

export function Section({ eyebrow, title, children }: { eyebrow?: string; title: string; children: React.ReactNode }) {
  return <section className="wx-sec">{eyebrow && <p className="wx-eyebrow">{eyebrow}</p>}<h3>{title}</h3>{children}</section>;
}
