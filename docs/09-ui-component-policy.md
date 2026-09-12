# UI component policy

## 1. Decision

The project uses **Tailwind CSS v4 + shadcn/ui `base-nova` with Base UI primitives** as the shared UI foundation.

The default engineering rule is **library first, compose second, create a new primitive last**.

This keeps common interaction semantics, accessibility, focus behavior, states, spacing conventions, and visual tokens consistent across the funnel without preventing product-specific design.

## 2. Selection order

For every UI need:

```text
1. Is there an appropriate shadcn/ui component?
        |
        +-- yes -> add/use the Base UI-backed component
        |             |
        |             -> customize local variants/tokens if needed
        |
        +-- no  -> can existing primitives be composed?
                      |
                      +-- yes -> create a product composition
                      |
                      +-- no  -> implement a focused new primitive
```

Before creating a generic component such as `Button`, `Input`, `Dialog`, `RadioGroup`, `Progress`, `Alert`, or `Skeleton`, check shadcn/ui first.

## 3. What may be customized

shadcn/ui installs source into the repository, so local changes are part of the intended model. We may change:

- variants;
- spacing and typography tokens;
- radius and surface treatment;
- funnel-specific sizing;
- loading/disabled presentation;
- composition and supporting copy;
- icons;
- responsive behavior.

Customization should keep the underlying component semantics and accessible interaction behavior unless there is a concrete reason to change them.

## 4. Product components vs primitives

A product component is encouraged when it expresses challenge-specific meaning.

Examples:

```text
components/ui/button.tsx              # shadcn primitive
components/ui/progress.tsx            # shadcn primitive
components/ui/radio-group.tsx         # shadcn primitive

components/assessment/
  assessment-shell.tsx                # product composition
  assessment-option-card.tsx          # product composition
  save-status.tsx                     # product component
  wellness-profile.tsx                # product component
  projection-card.tsx                 # product component
```

`AssessmentOptionCard` may compose `RadioGroup`, `Card`, and typography styles. It should not independently reimplement roving focus, keyboard selection, or checked-state semantics that the primitive already provides.

## 5. Initial component shortlist

Do **not** install the entire shadcn registry up front. Add components only when a TDD/product slice needs them.

Likely components for this challenge:

| Need | Preferred shared component |
|---|---|
| Primary/back actions | `Button` |
| Numeric/text entry | `Input` |
| Single-choice answers | `RadioGroup` |
| Funnel progress | `Progress` |
| Result/paywall surfaces | `Card` |
| Payment/paywall modal if used | `Dialog` |
| Validation/server error | `Alert` |
| Loading result surfaces | `Skeleton` |
| Visual grouping | `Separator` |

This is a forecast, not a dependency checklist.

## 6. Consistency rules

- One shared primitive per semantic role; do not create parallel `PrimaryButton`, `ActionButton`, and `CTAButton` primitives when variants/composition are sufficient.
- Funnel-specific components may wrap primitives to encode product meaning.
- Prefer variant APIs and design tokens over repeated arbitrary class strings.
- Keep form semantics and labels accessible.
- Do not replace a library primitive merely to reproduce a visual detail that can be expressed through styling.
- Do not force a library component when its semantics are wrong for the interaction.

## 7. Testing boundary

Do not unit-test shadcn/Base UI internals. Test our behavior:

- user can choose an option by accessible role/label;
- disabled/loading states prevent incorrect progression;
- validation feedback is discoverable;
- paywall actions invoke the correct application behavior;
- keyboard-driven E2E paths work on the critical funnel.

The library is responsible for its primitive implementation; the project is responsible for correct composition and product behavior.

## 8. Review checklist

Before merging a new UI component, ask:

1. Did we check shadcn/ui for an existing semantic component?
2. Could this be a variant or composition instead of a new primitive?
3. Are focus, keyboard, disabled, loading, and error states preserved?
4. Does it reuse the same tokens/spacing conventions as the rest of the funnel?
5. Is the abstraction product-specific enough to justify existing?

## 9. Installed baseline

As of T15, the repository contains the shadcn/Base UI-backed `Button`, `Progress`, `RadioGroup`, `Input`, `Card`, `Alert`, `Skeleton`, `Separator`, `Dialog`, and `Label` primitives. They were selected because the next three product slices directly need assessment inputs, progress, feedback/loading, and paywall/result surfaces; this is still a focused subset rather than a registry-wide install.

`AssessmentShell` is the first product composition and imports shared primitives from `components/ui` rather than implementing equivalent keyboard/focus/progress behavior itself.

## 10. T16 product compositions

The persisted funnel adds two assessment-specific compositions rather than new generic primitives:

- `AssessmentOptionGroup` uses the shadcn/Base UI `RadioGroup` and `RadioGroupItem` for single-choice semantics, keyboard/focus behavior, and checked state;
- `NumericAnswer` uses shadcn `Input` and `Label`, adding the unit suffix and product sizing while runtime bounds stay shared with the assessment contract.

`AssessmentFunnel` composes these with the existing shared `Button`, `Alert`, `Card`, and `Skeleton`. Numeric input limits are imported from the same domain constant used by server validation so HTML input constraints cannot silently diverge from the runtime contract.


## 11. Product surface vs reviewer surface

The public application should read like a small real wellness product, not like an annotated engineering submission. Implementation proof such as optimistic concurrency, persistence timing, result snapshots, server-side projection, FREE/ACTIVE state, TDD, and database behavior belongs in README/docs/tests rather than explanatory UI copy.

Product copy may still disclose behavior that materially affects user trust, such as a general-wellness disclaimer or the fact that the checkout does not collect payment details. Those disclosures should be phrased in user terms rather than architecture terms.

This separation is deliberate: the application demonstrates product completion by behaving correctly, while the repository demonstrates how and why it is correct.

## 11. Live numeric feedback

Numeric assessment fields reuse the shared shadcn/Base UI `Input`; native browser stepper buttons are visually suppressed rather than introducing a parallel custom input primitive. The weight step composes the existing `Card` with the shared pure `calculateBmi()` function to provide an immediate BMI preview once the entered weight is valid and a saved height is available. The preview is transient UI feedback; the final result remains the server-created snapshot.

## 12. Landing prewarm and flow correlation

The product CTA is a small composition around Next.js `Link`: the route remains prefetchable, while a background `/api/session` bootstrap obtains the server-owned assessment state and its opaque `orderId`. The assessment screen consumes that short-lived prefetched response instead of immediately issuing the same bootstrap again. This reduces the initial skeleton window without moving session ownership into client storage or the query string.
