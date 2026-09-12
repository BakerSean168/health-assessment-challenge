"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

import { AssessmentFunnel } from "@/components/assessment/assessment-funnel";

export default function AssessmentPage() {
  const router = useRouter();
  const handleComplete = useCallback(() => {
    const current = new URL(window.location.href);
    const orderId = current.searchParams.get("order");
    router.replace(orderId ? `/result?order=${encodeURIComponent(orderId)}` : "/result");
  }, [router]);

  const handleOrderResolved = useCallback(
    (orderId: string) => {
      const current = new URL(window.location.href);
      if (current.searchParams.get("order") === orderId) return;
      current.searchParams.set("order", orderId);
      router.replace(`${current.pathname}?${current.searchParams.toString()}`, {
        scroll: false,
      });
    },
    [router],
  );

  return (
    <AssessmentFunnel
      onComplete={handleComplete}
      onOrderResolved={handleOrderResolved}
    />
  );
}
