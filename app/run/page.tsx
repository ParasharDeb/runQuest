"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ChaseRunner from "@/components/ChaseRunner";

function RunGame() {
  const searchParams = useSearchParams();
  const mode = (searchParams.get("mode") || "normal") as "easy" | "normal" | "hard";
  const map = (searchParams.get("map") || "background") as "background";
  const control = (searchParams.get("control") || "keyboard_classic") as "keyboard_classic" | "treadmill";
  return <ChaseRunner mode={mode} map={map} control={control} />;
}

export default function Page() {
  return (
    <Suspense fallback={<div style={{ color: "#fff", display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "#0e1410" }}>Loading Chase...</div>}>
      <RunGame />
    </Suspense>
  );
}

