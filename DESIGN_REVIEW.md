# FlowForge redesign review

## Direction and scope

The existing application already had a functioning local engine, editor, persistence, templates, and history. Its visual weaknesses were tiny text, repeated numbered labels, a decorative hero symbol, feature previews competing for attention, and scroll choreography that obscured text. Baseline source lint reported 10 failures; baseline rendered inspection reported 17 failures, including horizontal overflow and a three-line mobile headline.

Subject inventory: the FlowForge name, six-node starter graph, high-value/standard branching, amount threshold of 100, sample amount of 149, deterministic latency, local-only execution, inspectable step outputs, browser storage, and editable templates.

Idea: FlowForge's order-routing graph becomes a working engineering drawing. Visitors can change the amount and inspect the routing result from the actual engine.

The Taste draw offered type-only-statement, dense-tiles, and product-performs. Product-performs was selected because the application has working UI to demonstrate. Its palette and typography were kept from the brand. No redraws were used. Section geometry was adapted to the actual product and the explicit requirements for branching nodes, inspector panels, integrations, FAQ, and a dashboard.

Claims and proof: visual logic is understandable (interactive branching graph); execution is inspectable (node output and JSON fragment); work has a home (live browser workspace data); templates provide useful starting points (use-case links); integrations are bounded honestly (building-block list labels simulations); local behavior is explicit (data handling and reliability section); common questions have answers (FAQ); starting is immediate (workspace CTA).

## Skills applied

- `design-taste-frontend`: public-page direction draw, copy hierarchy, varied composition, source gate, three-width screenshot inspection, critique/fix loop.
- `gpt-taste`: selectively applied GSAP coordination, desktop story pinning, and short headline measures. Randomized fonts, palette, mandatory cinematic effects, and stock photos were not applied because the explicit brief preserves identity and calls for selective use.
- `minimalist-ui`: workspace density, flat panels, clear information hierarchy, restrained feedback. Its light palette and replacement-icon preferences were overridden by the product brief.
- `premium-frontend`, `responsive-design`, `motion-design`, `ui-component-library`, and `frontend-audit`: reusable existing controls, responsive layouts, scoped animation cleanup, reduced motion, official component verification, build and browser review.
- `vercel:react-best-practices` and `vercel:verification`: React hook/state review and the full local UI → engine → browser storage → history journey.

No agent delegation was used. No packages were added. Existing Magic UI Animated Beam was verified through the connected registry. The official Vengeance CLI page was inaccessible, so no unverified component was introduced.

## Critique rounds

### Round 1

Seen in one second: pale blue “flow together” and the branching product canvas.

Live thing: sample amount routing and selectable step output.

Layout words: hero=editorial/product / story=pinned-margin / use-cases=tabs / integrations=matrix / reliability=statement-and-notes / FAQ=accordion / CTA=split.

Scores: design 7.5 · usability 6.5 · creativity 7 · content 8 → overall 7.1.

Top problems: tablet CTAs wrapped within their labels (tablet-fold); mobile editor shrank all nodes into an unreadable overview (390-editor); mobile dashboard overflowed from an absolute hidden label (390-dashboard). Fixed with nonwrapping actions, responsive graph geometry, readable canvas framing, and a positioned table scroll region. Also corrected the reduced-motion hydration mismatch caught during browser verification.

### Round 2

Seen in one second: the workflow itself, with a two-line headline at every target width.

Idea and live thing: unchanged; real engine routing remains the focal interaction.

Layout words: hero=editorial/product / story=pinned-margin / use-cases=tabs / integrations=capability-list / reliability=statement-and-notes / FAQ=filled-controls / CTA=split.

Scores: design 7.5 · usability 8 · creativity 7 · content 8 → overall 7.6.

Caps: a product graph is a familiar software concept, so creativity is capped at 7. Interface fragments are the intentional visual material for this software direction; stock photography would not prove the product's behavior.

Top problems: integration matrix repeated the graph's card language; FAQ rules added unnecessary visual repetition; tablet final heading wrapped to three lines. Fixed using an icon-and-text capability list, filled disclosure controls, and wrapping the final CTA layout. The tablet hero's top alignment was subsequently refined. Readable initial framing and the pan hint complete the phone editor.

## Inspector exceptions and remaining warnings

The final rendered gate reports zero failures with `--allow icon-cards`. This exception applies to the six working workflow nodes expressly required by the brief, rather than six marketing feature cards. Interface fragments carry `data-ui` so real ports, form fields, tables, code, and structural borders retain their own geometry.

Five warnings remain intentionally:

1. Three fonts: the brief preserves the existing brand; IBM Plex Mono is used for literal code output.
2. More than five measured sizes: embedded product controls and marketing typography have separate readable scales.
3. No photography: the product interface is the subject and proof.
4. No footage: a live interactive graph demonstrates the process more accurately than a decorative video.
5. One small text block: the existing registered-mark glyph beside the logo remains at its brand size.

Manual visual review covered desktop, tablet, phone, dashboard, and editor captures. No decorative photography, customer logos, testimonials, uptime claims, security certifications, or fabricated service connections were added.
