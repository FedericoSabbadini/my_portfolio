# Digital Mind — Portfolio

Interactive portfolio of **Federico Sabbadini** (M.Sc. Computer Engineering — AI · Data,
University of Brescia). The hero is a living, per-pixel-shaded **3D brain** rendered with
Three.js: six cortical regions map to content sections — About, Education, Work, Projects,
Certifications and Contacts. Hover (or tour) a region to explore it, click to dive in.

🔗 **Live:** https://federicosabbadini.github.io/my_portfolio/

## Stack

- **Vanilla JS (ES modules)** — no build step, no framework.
- **Three.js 0.160** (custom GLSL: wrapped diffuse + fake SSS + fresnel rim, per-pixel
  gyral field with derivative bump-mapping) and **GSAP** for the dive animation — loaded
  via `importmap` from a CDN.
- Hash router (`#/region/:id`) so it runs on GitHub Pages with no server config.
- Content is data-driven: JSON files under `data/` are the single source of truth.

## Structure

```
index.html            # shell: header, home (brain) view, region view, boot loader
css/                  # tokens.css · base.css · brain.css · region.css
js/
  main.js             # bootstrap + routing orchestration
  router.js           # minimal hash router
  brain/              # brain-scene · brain-geometry · brain-regions · synapses
  ui/                 # region-view (catalog renderer) · transitions
  data/               # store (fetch + cache) · taxonomy (subject grouping)
data/
  graph/domains.json  # the six regions (label, anatomy, accent, 3D position)
  personal · education · work · projects · certifications · courses .json
assets/               # images, CV/cover-letter PDFs, favicon, og-image
```

### Content model

Each region reads from its JSON file. `projects.json` and `certifications.json` items
carry an explicit `subject` (`ai` · `security` · `data` · `software` · `business`) that
[`js/data/taxonomy.js`](js/data/taxonomy.js) uses to group cards; a keyword heuristic is
only a fallback for items without one. To add an entry, append an object to the relevant
array — no code changes needed.

## Run locally

```bash
npx serve .
```

Then open http://localhost:3000. Any static file server works. A WebGL-capable browser is
needed for the brain; there are graceful fallbacks (a static contact card) when WebGL or
the CDN modules are unavailable, and reduced-motion is respected.

## License

[MIT](LICENSE) © 2026 Federico Sabbadini.
