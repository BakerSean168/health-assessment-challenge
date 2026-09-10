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
