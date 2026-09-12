"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  browserAssessmentApi,
  type AssessmentBrowserApi,
} from "@/modules/assessment/client/assessment-api";

interface AssessmentStartLinkProps {
  api?: Pick<AssessmentBrowserApi, "prewarmSession">;
}

export function AssessmentStartLink({
  api = browserAssessmentApi,
}: AssessmentStartLinkProps) {
  const [href, setHref] = useState("/assessment");

  useEffect(() => {
    let cancelled = false;

    void api
      .prewarmSession()
      .then((bootstrap) => {
        if (cancelled) return;
        setHref(`/assessment?order=${bootstrap.orderId}`);
      })
      .catch(() => {
        // The assessment page can still bootstrap on demand if prewarming fails.
      });

    return () => {
      cancelled = true;
    };
  }, [api]);

  return (
    <Link
      href={href}
      prefetch
      className={buttonVariants({ size: "lg", className: "h-11 px-5" })}
    >
      Start my assessment
      <ArrowRight data-icon="inline-end" aria-hidden="true" />
    </Link>
  );
}
