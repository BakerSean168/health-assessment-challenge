"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

import { AssessmentFunnel } from "@/components/assessment/assessment-funnel";

export default function AssessmentPage() {
  const router = useRouter();
  const handleComplete = useCallback(() => {
    router.replace("/result");
  }, [router]);

  return <AssessmentFunnel onComplete={handleComplete} />;
}
