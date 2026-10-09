/* Earth Change: one conceptual backbone, several phenomena modules.
   Only wetlands is built. Forest and volcano are declared, not faked. */
export type PhenomenonStatus = "AVAILABLE" | "PLANNED";
export interface Phenomenon {
  id: "wetland" | "forest" | "volcano";
  name: string;
  tagline: string;
  status: PhenomenonStatus;
  href?: string;
  /** Every module exposes the same five capabilities. */
  contract: readonly ["time", "change", "evidence", "investigation", "uncertainty"];
}
const CONTRACT = ["time", "change", "evidence", "investigation", "uncertainty"] as const;
export const PHENOMENA: Phenomenon[] = [
  { id: "wetland", name: "Wetlands", tagline: "Water moves.", status: "AVAILABLE", href: "/wetland", contract: CONTRACT },
  { id: "forest", name: "Forests", tagline: "Vegetation changes.", status: "PLANNED", contract: CONTRACT },
  { id: "volcano", name: "Volcanoes", tagline: "The surface transforms.", status: "PLANNED", contract: CONTRACT },
];
