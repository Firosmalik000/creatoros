---
name: CreatorOS
description: An editorial Southeast Asian creator contact sheet with agency-managed trust.
colors:
  canvas: "#f4f0e7"
  ink: "#161714"
  surface: "#fffdf7"
  surface-muted: "#e8e1d3"
  signal: "#ff6b4a"
  signal-hover: "#e95637"
  fresh: "#c8f25b"
  cool: "#7d9cff"
  success: "#1f7a55"
  success-surface: "#d8eee2"
  success-ink: "#17553d"
  danger: "#b83b33"
  danger-surface: "#f2d8d3"
  danger-ink: "#6e211c"
  border: "#292a25"
  border-soft: "#cfc7b9"
typography:
  display:
    fontFamily: "Manrope Variable, sans-serif"
    fontSize: "clamp(3.2rem, 5vw, 4.8rem)"
    fontWeight: 790
    lineHeight: 1.04
    letterSpacing: "-0.04em"
  editorial:
    fontFamily: "Newsreader Variable, serif"
    fontWeight: 540
    lineHeight: 1.04
  body:
    fontFamily: "Manrope Variable, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Manrope Variable, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 760
    letterSpacing: "0.08em"
rounded:
  sm: "12px"
  md: "16px"
  pill: "999px"
spacing:
  shell-gutter: "16px"
  section-mobile: "90px"
  section-desktop: "126px"
breakpoints:
  xs: "max-width: 479px"
  sm: "min-width: 640px"
  md: "min-width: 768px"
  lg: "min-width: 1024px"
  xl: "min-width: 1280px"
  2xl: "min-width: 1536px"
dark-mode:
  canvas: "#070a10"
  surface: "#0e1424"
  surface-muted: "#131b2e"
  ink: "#f8fafc"
  border: "rgba(255, 255, 255, 0.12)"
  border-soft: "rgba(255, 255, 255, 0.08)"
components:
  button-signal:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "11px 20px"
    height: "46px"
  creator-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
  form-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "11px 14px"
    height: "50px"
  status-success:
    backgroundColor: "{colors.success-surface}"
    textColor: "{colors.success-ink}"
    rounded: "{rounded.sm}"
    padding: "14px"
  status-error:
    backgroundColor: "{colors.danger-surface}"
    textColor: "{colors.danger-ink}"
    rounded: "{rounded.sm}"
    padding: "14px"
---

# CreatorOS Design System

## Overview

**Creative North Star: “The Southeast Asian Talent Contact Sheet”**

CreatorOS should feel curated by a sharp creative agency: warm paper-like surfaces, decisive ink typography, authored creator photography, production annotations, and a few high-energy signals. The visual hierarchy sells a managed marketplace through talent and process rather than resembling corporate procurement software or an open gig bazaar.

Operational surfaces extend the same world in **Operate mode**: task completion and state clarity lead, while brand character comes from editorial headings, warm materials, creator proof imagery, and precise accent use. Authentication and account settings must feel trustworthy and calm rather than decorative or conversion-heavy.

**Key characteristics:** editorial type-and-image tension; documentary creator work; generous public-page rhythm; compact agency annotations; visible, human quality-control cues.

## Colors

Warm ivory and cream carry most of the page; near-black provides structure. Coral is the primary action signal, acid lime marks fresh agency interventions, verification moments, and selected account roles, while cornflower labels illustrative or informational content. Keep accents small and purposeful so the imagery remains dominant. Success and danger use paired pale surfaces and dark ink for accessible form feedback; neither is decoration.

## Typography

Manrope Variable carries navigation, controls, labels, body copy, metrics, and the decisive sans half of display headlines. Newsreader Variable is a selective editorial countervoice for hero phrases, workflow titles, creator niches, and quotations. Headlines are compact and tightly tracked; body copy stays near 62–64 characters wide. Never use gradient text or turn the serif into the default body face.

The homepage hero uses the display token above; large section headings scale from roughly `2.55rem` to `5rem`. Auth headings stay decisive in Manrope (`clamp(2.6rem, 5vw, 4.7rem)`), while the account-settings title uses Newsreader as a quieter editorial anchor. Form labels are compact and bold; helper text and descriptions stay subdued and limited to about `58ch`. Small production labels are bold, often uppercase, and may use tabular numerals for indexes and metrics.

## Layout

The public shell is centered at a maximum width of `1240px` with `16px` side gutters, tightening to `14px` below `820px` and `12px` below `560px`. Desktop sections use generous vertical rhythm around `126–140px`; mobile sections compress to roughly `88–96px` without becoming dense.

The homepage opens as a split proposition/contact-sheet composition, then alternates full-width bands, a three-card roster, a sticky two-column workflow, an asymmetric agency statement, and a decisive coral close. At `820px`, the hero and workflow stack, the roster becomes two columns, and navigation collapses. At `560px`, cards and calls to action become single-column/full-width. The complete proposition, all three creator subjects, and both hero actions must remain visible and usable from `320px` upward without horizontal clipping.

### Responsive Breakpoint Matrix

The application layout standardizes across 6 core viewport tiers:

- **`xs` (< 480px / 320px–479px, compact mobile)**: Single-column core flow, touch targets $\ge 44\text{px}$, stats stack in 1 or 2 columns, compact padding (`12px–16px`), zero horizontal scroll.
- **`sm` (≥ 640px, large mobile / phablets)**: 2-column cards, flexible filter rows, horizontal swipe tabs with indicator.
- **`md` (≥ 768px, tablets)**: Mobile hamburger drawer triggers below `lg`; modal dialogs center with maximum width; 2-3 column grids.
- **`lg` (≥ 1024px, laptops / desktop)**: Permanent desktop sidebar (`288px` / `w-72`), expanded workspace shell.
- **`xl` (≥ 1280px, standard desktop)**: Maximum width capped container (`1280px` / `max-w-7xl`).
- **`2xl` (≥ 1536px, ultra-wide)**: Proportional padding, capped line lengths (60–75ch) for readable editorial content.

Public pages are server-rendered and content-first. Preserve localized metadata, canonical URLs, `hreflang` alternates, Open Graph imagery, robots rules, and valid structured data; index only intentional public routes.

Authentication uses a full-height desktop split: a task column slightly wider than the sticky creator-image panel, with form content capped at `590px`. At `820px` and below, remove the proof image and give the task the full viewport width. At `560px`, use `18px` page padding, stack account-role choices and settings actions, and keep every control full-width where it improves completion. Settings use a `280px`-minimum account summary beside a wider form, collapsing to one column at `820px`.

Auth and settings routes are private operational surfaces and must remain `noindex, nofollow`; they do not inherit public-page canonical, social, or structured-data obligations.

## Elevation & Depth

Depth is editorial rather than glossy. Large imagery and creator cards use warm, diffuse shadows; ruled workflow rows, navigation, form fields, account summaries, and quiet controls use borders. The auth proof annotation may float over photography with a compact dark shadow, but the form column itself stays flat. A card uses either a border or a shadow at rest, never both. Hover may increase an existing shadow and lift the surface slightly; avoid glass effects and generic floating SaaS panels.

## Shapes

Cards and image frames use restrained `12–16px` rounding, keeping the contact sheet comparatively square. Inputs, selects, role choices, and feedback panels use the smaller `12px` radius; operational account containers use `16px`. Compact controls, labels, and locale switching may be pill-shaped. The circular, slightly rotated agency stamp is a deliberate proof-of-management motif, not a general container pattern.

## Components

### Buttons and links

Buttons are compact pills with a `46px` minimum height. Primary actions use coral or ink; quiet actions use a transparent bordered treatment. Hover lifts by `2px` over `180ms`; text and arrow links underline rather than becoming card-like. Links navigate and buttons perform actions.

### Creator cards

Creator cards pair a `4:5` documentary portrait with concise identity, niche, location, verification, and tabular metrics. They lift by `6px` on hover. Demonstration rosters must carry an explicit localized illustrative-data label.

### Contact sheet and imagery

The signature hero asset is a genuine three-subject editorial contact sheet with thin warm gutters, production labels, and an agency-verification note. Photography must feel natural, authored, and work-in-progress: real skin texture, daylight, subtle grain, believable tools, and no logos, watermarks, fake UI, glossy stock-photo posing, or generic corporate scenes.

Creator imagery must express distinct Southeast Asian identities, not a generic “Asian” shorthand. Across a set, preserve visibly different Indonesian, Malaysian Chinese, and Malay Muslim subjects through face shape, complexion, hair or hijab, wardrobe, city/workspace, niche, and creative practice. Do not reuse near-identical faces or erase culturally specific representation.

### Navigation and locale controls

Desktop navigation is lean and text-led. At tablet sizes it collapses to a semantic menu control while the `ID`, `EN`, and `MY` locale choices remain available. The active locale uses a coral underline and must not rely on color alone.

### Authentication shell and fields

Desktop auth pages pair a warm-ivory task panel with sticky creator photography, a dark wash, and a lime agency-proof annotation. The image is supportive and decorative; use empty alternative text while the proof copy labels the region. Mobile removes the image entirely so the form remains first.

Fields are explicit label/control/helper stacks with a `50px` minimum control height, cream surface, visible neutral border, and coral caret/focus border. Use browser-appropriate autocomplete and constraints. Submit actions span the form width; pending actions replace the directional icon with a spinner, expose localized progress text, disable repeat submission, and do not lift on hover.

### Role choices and form status

Account type is a semantic fieldset with two large radio-card choices. Selection uses lime plus an ink border; keyboard focus uses the system coral ring and ivory separator. On narrow screens the choices stack.

Errors and successes are compact icon-and-copy status panels with semantic pale/dark color pairs and `role="status"`. Keep recovery copy adjacent to the failed task. Registration, verification, password recovery, and settings must each provide localized loading, error, and success outcomes without exposing raw backend messages.

### Account settings

Settings use a bordered cream account summary beside the active form. The summary combines a cornflower circular monogram with identity, role, and permission facts; long addresses must wrap safely. Loading is a centered labeled status, unavailable-account recovery leads back to login, and save/logout actions have independent pending labels. Locale persistence may redirect to the newly selected locale after success.

## Do's and Don'ts

### Do

- **Do** keep coral focus rings visible with an ivory separator, semantic controls, a skip link, localized alternative text, and WCAG 2.2 AA contrast.
- **Do** respect `prefers-reduced-motion`; the contact-sheet reveal and all transitions must resolve immediately for reduced-motion users.
- **Do** use translation keys for interface copy and locale-aware formatting; keep illustrative claims clearly labeled.
- **Do** preserve the contact-sheet reveal as the signature motion: a short settle, slight desaturation-to-color shift, and restrained easing.
- **Do** keep auth and settings task-first, with semantic labels, fieldsets, status regions, disabled pending controls, and explicit recovery paths.
- **Do** hide auth/settings routes from indexing and keep creator imagery subordinate to the form below tablet width.

### Don't

- **Don't** replace the editorial composition with a generic grid of same-sized feature cards, gradients, glassmorphism, or playful decoration.
- **Don't** let accent colors compete with creator photography or use semantic colors decoratively.
- **Don't** crop out the three-subject story, hide a primary path, or introduce horizontal scrolling on small screens.
- **Don't** ship an indexable public page without localized title and description, canonical, language alternates, social metadata, and appropriate structured data.
- **Don't** use placeholder-only fields, color-only role selection, raw API errors, or silent loading and save states.
- **Don't** retain the desktop image split on mobile when it delays access to the primary task.
