# Interactive Solar System Portfolio


## Overview (English)

This repository contains an interactive, Three.js-powered solar system that doubles as a personal coursework portfolio. Each planet links to a dedicated project page with narrative write-ups, visualizations, and supporting assets. The site is designed for static hosting (for example, GitHub Pages).

### Key Features

- Real-time 3D scene featuring physically inspired lighting, bloom post-processing, lens flares, and orbit/rotation animation.
- Immersive loading experience backed by the custom Galaxy Loader (`galaxy_loader.js`) with progress feedback and skip controls.
- Planet-to-project mapping is defined in the `PROJECT_TIMELINE` object, enabling fully customizable labels, summaries, tech stacks, and call-to-action buttons.
- Built-in search, control panel, and performance monitor for fast navigation and simulation tuning.
- Stand-alone HTML pages under `profile/` provide in-depth narratives for each showcased project.

### Project Layout

- `solar_system_cinematic_fixed.html`: Main portfolio entry point that imports `realistic_solar_cinematic_fixed.js`.
- `realistic_solar_cinematic_fixed.js`: Core logic creating the sun, planets, comets, particle field, interactions, and project metadata.
- `galaxy_loader.js`: Shared loader utilities and global state helpers.
- `advanced_solar_css.css`: Styling for the portfolio shell, loader, control panel, and info cards.
- `assets/`: Local textures, lens flare elements, and supporting static files.
- `profile/`: Mirrors the main experience and stores individual project pages (for example `capstone.html`, `ad_auction_dashboard.html`).
- `new/`: Experimental or backup copies of the same assets; keep or remove as needed.

### Run Locally

Serve the repository with any static web server (Python, Node.js, etc.) and open `solar_system_cinematic_fixed.html`. Direct `file://` access is not recommended because ES Module imports and texture requests can be blocked by the browser’s CORS policy.

### Customize

Update `PROJECT_TIMELINE` in `realistic_solar_cinematic_fixed.js` to add, remove, or reorder planets/projects. Swap textures in `assets/textures/`, edit `advanced_solar_css.css` for appearance tweaks, and adjust loader messaging in `galaxy_loader.js`.

### Deployment

Push the repository to GitHub and enable GitHub Pages for instant hosting. Ensure that the `assets/` directory travels with the build so texture lookups succeed in production.

### Credits and License

High-resolution planetary textures come from Solar System Scope and Three.js demos; observe their reuse policies. Add an explicit license file when you decide how you want others to use this work.

