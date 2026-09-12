"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

import { AssessmentFunnel } from "@/components/assessment/assessment-funnel";

export default function AssessmentPage() {
  const router = useRouter();
  const resolvedOrderId = useRef<string | null>(null);

  const handleComplete = useCallback(() => {
    const orderId = resolvedOrderId.current;
    router.replace(orderId ? `/result?order=${encodeURIComponent(orderId)}` : "/result");
  }, [router]);

  const handleOrderResolved = useCallback(
    (orderId: string) => {
      // Only the order id returned for the cookie-owned session is allowed to
      // propagate through the client flow. The incoming URL is correlation
      // input, never an authority source.
      resolvedOrderId.current = orderId;

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
