"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { YearningPlayer } from "@/components/YearningPlayer";

export default function PlayerPage() {
  const router = useRouter();
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    void (async () => {
      const r = await fetch("/api/auth/session", { cache: "no-store" });
      const j = (await r.json()) as { authenticated?: boolean };
      if (!j.authenticated) {
        router.replace("/");
        return;
      }
      setOk(true);
    })();
  }, [router]);

  if (ok !== true) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#08060c] font-sans text-sm text-white/40">
        Crossing the threshold…
      </div>
    );
  }

  return <YearningPlayer />;
}
