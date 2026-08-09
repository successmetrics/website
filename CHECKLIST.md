# SuccessMetrics Website Repositioning — Master Checklist
*Merged from: Completion Status Report (PDF) + Repositioning Plan (DOCX) — July 30, 2026*



## Items Needing Content Docs (Summary)

Provide these to unblock implementation:

1. **Customer testimonials** (2.2c) — Client name, role, company, quote with a named AI outcome *(deferred)*
2. **Homepage video/demo** (2.2d) — Video file (MP4) or motion design spec *(deferred)*
3. **Leadership bios** (2.5d) — Names, titles, headshots (JPG/PNG), 2-3 sentence bios *(deferred)*
4. **AI Research editorial plan** (2.5e) — 3-month calendar, first 2-3 article drafts or outlines *(deferred)*
5. **Visual language shift** (2.9) — Design brief, icon set, product screenshots *(no asset yet)*

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ Done / Implemented | Content documented, code updated |
| ⚠️ Pending decision | Needs client input before implementing |
| 🔴 Needs content | Can implement once content/assets provided |

---

## Part 1 — Messaging & Positioning Framework

| # | Section | Summary | Where on site | Status |
|---|---------|---------|---------------|--------|
| 1.1 | Strategic Shift | Messaging framework repositioning from "implementation consultancy" to "AI-powered engineering partner" documented and approved. | Reflected site-wide: all page `<title>` tags, every hero `<h1>`, nav CTA label ("Talk to an Engineer"), and JSON-LD `description` fields across all `.html` files | ✅ Done |
| 1.2 | Positioning Statement | Internal north star: AI-native engineering partner with focus on requirements-to-production compression. | `site/index.html` — hero eyebrow ("AI-Powered Engineering Partner") + lead copy; `site/about.html` — page hero `<p>` + "Who We Are" section `<p>`; `site/services.html` — page hero `<p>` ("from requirements to production") | ✅ Done |
| 1.3 | Hero Options | Option A ("Engineering the Future with AI") implemented with supporting copy and CTAs. | `site/index.html` — `<h1>` ("Engineering the Future with AI"), eyebrow div, lead `<p>`, two CTA buttons ("See How We Deliver →" / "Talk to an Engineer") | ✅ Done |
| 1.4 | Messaging Pillars | Four pillars: AI-Accelerated Product Development, AI-Powered Customer Implementations, Engineering Partner Not Vendor, Proof Not Promises. | **Pillar 1** → `site/index.html` "How We Engineer with AI" section (4-step pipeline); **Pillar 2** → `site/services.html` #implementation section; **Pillar 3** → `site/about.html` "Who We Are" H2 ("Engineering partner, not a vendor") + values cards; **Pillar 4** → `site/index.html` `.stats-bar` + `site/success-stories.html` | ✅ Done |
| 1.5 | Bold Claims | Five key claims mapped to proof points and validated against current capabilities. | `site/index.html` `.stats-bar` (40% faster, 75% of core solution pre-built, 30+ years, 24/7); `site/success-stories.html` case study outcomes; `site/accelerators.html` LPI card ("75% of core solution pre-built") | ✅ Done |
| 1.6 | Proof Metrics Band | 75% of core solution pre-built (LPI), 30+ years leadership, 24/7 global engineering, 40% faster delivery. | `site/index.html` — `.stats-bar` section (4 stat tiles, lines 119–122) | ✅ Done |
| 1.7 | Who We Are Boilerplate | AI-native engineering partnership, Salesforce expertise, global delivery, outcome-focused engagement. | `site/about.html` — page hero `<p>` + "Who We Are" section (two body paragraphs + 3 values cards); footer `.footer-about p` in every `.html` file (9 pages) | ✅ Done |
| 1.8 | Voice & Language Rules | Use engineer/ship/build/compress/prove; avoid leverage/synergy/best-in-class; use specific numbers; avoid unproven superlatives. | Applied across all pages. Key instances: "Talk to an Engineer" (all nav CTAs + CTA banners), "shipping" (index.html hero lead), "compress" (about.html hero + services.html hero), "proven" (accelerators.html hero H1) | ✅ Done |
| **1.9** | **Before/After Messaging Reference** | *From DOCX.* Three key messaging pivots: (1) Homepage hero leads with AI outcome + delivery proof. (2) About/mission removes "Salesforce and SaaS consulting" as the company definition. (3) Services page title drops "Salesforce" from the primary noun. | (1) `site/index.html` — `<h1>` + lead `<p>`; (2) `site/about.html` — page hero `<p>` + "Who We Are" H2; (3) `site/services.html` — `<title>` tag ("AI Solutions & Engineering Services") | ✅ Done |
| **1.10** | **Salesforce Positioning Risk Note** | *From DOCX.* Salesforce expertise stays — only what's named *first* changes. Platform certifications and compliance language moved to supporting position (checklists, body copy), not removed. | Salesforce demoted from `<title>`/`<h1>` on all pages but preserved in checklist bullets (`site/services.html`, `site/industries.html`, `site/accelerators.html`) and JSON-LD `knowsAbout` fields | ✅ Done |

---

## Part 2 — Website Improvements

| # | Section | Summary | Where on site | Status |
|---|---------|---------|---------------|--------|
| 2.1 | P1 — Bugs & Credibility Fixes | Six critical fixes: email link, phone link, Twitter icon, copyright year, address formatting, Nonprofit Accelerator card link. | Footer of every page; `site/accelerators.html` Nonprofit section | ✅ Implemented |
| 2.2 | P2 — Homepage Re-theme | Seven homepage updates: hero headline, proof metrics band, AI engineering pipeline visual (4-step), Who We Are boilerplate, accelerators promotion, services retitle, and meta/SEO. | `site/index.html` — hero, stats bar, How We Deliver section, page `<title>` | ✅ Implemented |
| **2.2a** | **Homepage "What We Do" Copy** | *From DOCX.* "Full-lifecycle Salesforce services, engineered for outcomes" → "AI-powered engineering, full lifecycle". | `site/index.html` — "What We Do" section H2 | ✅ Implemented |
| **2.2b** | **Homepage CTA specificity** | *From DOCX (Quick Win).* Generic CTAs updated to outcome-specific language. "Talk to an Expert" → "Talk to an Engineer"; "Get in Touch" → "Talk to an Engineer". | `site/index.html` hero buttons; `site/about.html` CTA banner; `site/contact.html` H1 | ✅ Implemented |
| **2.2c** | **Homepage testimonials/social proof** | *From DOCX (Near-Term).* Add customer quotes with named AI outcomes. Deferred — needs client quotes with named outcomes. | `site/index.html` — new section to be added after client marquee | ⚠️ Deferred |
| **2.2d** | **Homepage video/animated demo** | *From DOCX (Near-Term).* Short video or animated demo of the Discover/Design/Build/Prove delivery process. Deferred — needs video asset or motion design spec. | `site/index.html` — "How We Engineer with AI" section | ⚠️ Deferred |
| 2.3 | P2 — Services Page | Six service improvements: intro block, AI-Powered Delivery pipeline (5 stages), AI angles for Advisory/Consulting, Implementation Services elevation, Managed Services reframe, outcome-based engagement model. | `site/services.html` — all service sections (#advisory, #roadmap, #implementation, #managed) | ✅ Implemented |
| **2.3a** | **Services page title/SEO — Salesforce demotion** | *From DOCX (Quick Win).* Page title "AI-Powered Salesforce Services" → "AI Solutions & Engineering Services". JSON-LD serviceType updated. | `site/services.html` — `<title>`, all OG/Twitter tags, JSON-LD `serviceType` | ✅ Implemented |
| **2.3b** | **Services nav label** | *From DOCX (Near-Term).* Renamed "Services" → "AI Solutions" in nav and footer across all pages. | Nav `<ul>` and footer link in all 9 `.html` files (bulk sed applied) | ✅ Implemented |
| 2.4 | P2 — Accelerators Page | Three accelerator updates: reframe intro with "60% done" messaging, add metrics to cards, fix Nonprofit Accelerator link. | `site/accelerators.html` — page hero, all accelerator cards | ✅ Implemented |
| **2.4a** | **Accelerators page title/SEO** | *From DOCX.* Title "Salesforce Accelerators" → "AI Tools & Accelerators \| Start at 60% Done". JSON-LD updated. | `site/accelerators.html` — `<title>`, all OG/Twitter tags, JSON-LD | ✅ Implemented |
| **2.4b** | **Org Insights — full product page** | Standalone page built: 24 analyzers / 6 domains, problem framing, how-it-works 4-step, domain coverage grid, 5 deliverables, comparison vs free tools, 2-week engagement model, pricing (contact us). Section on accelerators.html updated with rich content + "Full details →" link. | `site/org-insights.html` (new); `site/accelerators.html` — #insights section updated | ✅ Done |
| **2.4c** | **EasyMask — full product page** | Renamed "Data Masking Tool" → EasyMask. Standalone page built: trust pillars, overview, how-it-works 4 steps, 4 product screenshots (from zip), use cases, security posture, deployment table, pricing (contact us). Section on accelerators.html updated with hero image + "Full details →" link. | `site/easymask.html` (new); `site/assets/images/easymask/` (5 images); `site/accelerators.html` — #masking section updated | ✅ Done |
| 2.5 | P3 — Supporting Changes | Five updates: About Us (AI-native origin story), Blog (3 post titles), Case Studies (AMP: 40% faster/30% less QA; Cal OES: 72-hour deployment), Careers (AI-First/Fast Growth), favicon refresh. | `site/about.html`, `site/resources.html`, `site/success-stories.html`, `site/careers.html` | ✅ Documented |
| **2.5a** | **About page mission statement** | *From DOCX (Quick Win).* "Salesforce and SaaS consulting services" removed as the definitional phrase. Hero and Who We Are copy are AI-first. | `site/about.html` — page hero `<h1>` and Who We Are section | ✅ Implemented |
| **2.5b** | **About page CTA** | *From DOCX.* "Get in Touch →" → "Talk to an Engineer →". | `site/about.html` — CTA banner at bottom of page | ✅ Implemented |
| **2.5c** | **About founding story** | *From DOCX (Near-Term).* "Our Story" section added — 4-paragraph founding narrative (2013 origin, AI pivot, "customer zero" proof, outcomes philosophy). | `site/about.html` — new `<section class="block">` between "Who We Are" and "Global Delivery" sections (lines 74–89) | ✅ Implemented |
| **2.5d** | **About leadership bios** | *From DOCX (Near-Term).* Leadership section with bios and photos. **Needs content doc: names, titles, headshots, 2-3 sentence bios.** | `site/about.html` — new section to be added | 🔴 Needs content |
| **2.5e** | **AI Research expansion** | *From DOCX (Strategic).* Real content hub: 1 piece/month cadence, previews, categories, downloadable format. **Needs content doc: 3-month editorial calendar, first 2-3 articles.** | `site/ai-research.html` — full page restructure | 🔴 Needs content |
| **2.5f** | **Case studies with metrics** | *From DOCX (Near-Term).* Three new case study pages added with quantified metrics: EasyMask (62% less testing time), State Licensing Modernization (40%+ lower cost/timeline, 17 weeks), City Permitting (14 permit types, 3 weeks). Three matching carousel cards added. | `site/success-stories.html` — 3 new story cards; `site/content/success-stories/` — 3 new case study pages | ✅ Implemented |
| **2.5g** | **Industries page — AI-first leads** | *From DOCX (Near-Term).* "The AI use case:" lead paragraph added to all 5 industry verticals before Salesforce product details. | `site/industries.html` — #govt, #finserv, #healthcare, #tech, #nonprofit sections | ✅ Implemented |
| **2.5h** | **Industries page title/SEO** | *From DOCX (Quick Win — SEO audit).* Title "Salesforce by Industry" → "AI Solutions by Industry \| Gov, Health, FinServ & SaaS". H1 updated. All OG/Twitter/JSON-LD updated. | `site/industries.html` — `<title>`, `<h1>`, all meta tags | ✅ Implemented |
| **2.6** | Suggested Sequence | Three-week implementation timeline: Week 1 (P1 fixes + hero/metrics), Week 2 (How We Engineer + services), Week 3 (Accelerators + supporting content). | Reference only — no code change | ✅ Done |
| **2.7** | **"How We Work" / AI Methodology Page** | *From DOCX (Near-Term).* Standalone page built: 4-stage framework (Discover/Design/Build/Prove), stage stepper hero, 3-col breakdowns per stage, oversight band, customer zero callout, stats bar, FAQ, CTA. Adapted to site dark theme. Wired to footer Expertise nav on all 14 root pages. | `site/how-we-work.html` (new page); footer on all root pages | ✅ Implemented |
| **2.8** | **"Why AI + Salesforce" Page** | *From DOCX (Strategic).* Standalone page built: thesis + pull quote, 4 reasons for Salesforce, 3-layer engine architecture, honest platform expansion section, benefits, stats, FAQ, CTA. Adapted to site dark theme. Wired to footer Expertise nav on all 14 root pages. | `site/why-ai-salesforce.html` (new page); footer on all root pages | ✅ Implemented |
| **2.9** | **Visual Language Shift** | *From DOCX (Strategic).* AI-forward iconography, product screenshots, less generic stock imagery. **Needs asset: design brief, icon set, product screenshots.** | `site/assets/images/` — new assets; all pages that use imagery | 🔴 Needs asset |
| **2.10** | **Site-wide positive language audit** | All negative constructions ("We're not…", "not just a help desk", "without compliance risk", "not quarters") rewritten to positive framing. | `site/index.html` — hero lead, Managed Services card, Data Masking card, footer boilerplate | ✅ Implemented |

---
