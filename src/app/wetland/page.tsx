"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import WetlandExperience from "@/components/wetland/WetlandExperience";

function Inner() {
  const params = useSearchParams();
  return <WetlandExperience preferLocalRun={params.get("source") === "raster"} />;
}

export default function WetlandPage() {
  return <Suspense fallback={null}><Inner /></Suspense>;
}
