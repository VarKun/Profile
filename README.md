# Interactive Solar System Portfolio


## Overview (English)

This repository contains an interactive, Three.js-powered solar system that doubles as a personal coursework portfolio. Each planet links to a dedicated project page with narrative write-ups, visualizations, and supporting assets. The site is designed for static hosting (for example, GitHub Pages) and all runtime assets live inside the `profile/` directory.

### Key Features

- Real-time 3D scene featuring physically inspired lighting, bloom post-processing, lens flares, and orbit/rotation animation.
- Immersive loading experience backed by the custom Galaxy Loader (`galaxy_loader.js`) with progress feedback and skip controls.
- Planet-to-project mapping is defined in the `PROJECT_TIMELINE` object, enabling fully customizable labels, summaries, tech stacks, and call-to-action buttons.
- Built-in search, control panel, and performance monitor for fast navigation and simulation tuning.
- Stand-alone HTML pages under `profile/` provide in-depth narratives for each showcased project.

### Project Layout

- `profile/solar_system_cinematic_fixed.html`: Main portfolio entry point that imports `realistic_solar_cinematic_fixed.js`.
- `profile/realistic_solar_cinematic_fixed.js`: Core logic creating the sun, planets, comets, particle field, interactions, and project metadata.
- `profile/galaxy_loader.js`: Shared loader utilities and global state helpers.
- `profile/advanced_solar_css.css`: Styling for the portfolio shell, loader, control panel, and info cards.
- `profile/assets/`: Local textures, lens flare elements, and supporting static files.
- `profile/*.html`: Stand-alone pages for each showcased project (for example `capstone.html`, `ad_auction_dashboard.html`).
- `profile/reports/`: Supporting PDF or HTML reports linked from the project pages.

### Run Locally

Serve the repository with any static web server (Python, Node.js, etc.) and open `profile/solar_system_cinematic_fixed.html`. Direct `file://` access is not recommended because ES Module imports and texture requests can be blocked by the browser’s CORS policy.

### Customize

Update `PROJECT_TIMELINE` in `realistic_solar_cinematic_fixed.js` to add, remove, or reorder planets/projects. Swap textures in `assets/textures/`, edit `advanced_solar_css.css` for appearance tweaks, and adjust loader messaging in `galaxy_loader.js`.

## TODO

- [ ] Extend the `PROJECT_TIMELINE` with additional star markers that highlight open-source contributions, published papers, and other notable milestones alongside existing coursework planets.
- [ ] Design distinctive iconography and metadata blocks for these research- and community-focused stars so visitors can quickly differentiate them from class projects.
- [ ] Curate supporting assets (PDFs, repositories, demo links) for each new star entry to ensure visitors can explore the underlying work.

### Deployment

Push the repository to GitHub and enable GitHub Pages for instant hosting. Ensure that the `assets/` directory travels with the build so texture lookups succeed in production.

To point GitHub Pages at this project:

1. Open your repository on GitHub and go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Choose the `main` branch and the `/ (root)` folder, then click **Save**.
4. Wait for the Pages deployment workflow to finish (a check mark will appear near the latest commit once complete).

After GitHub finishes the deployment, your live portfolio will be available at:

[`https://<your-username>.github.io/<repository-name>/profile/solar_system_cinematic_fixed.html`](https://<your-username>.github.io/<repository-name>/profile/solar_system_cinematic_fixed.html)

Replace `<your-username>` and `<repository-name>` with your actual GitHub account and repository name, then share that link so visitors can open the complete interactive portfolio in their browser.

### Credits and License

High-resolution planetary textures come from Solar System Scope and Three.js demos; observe their reuse policies. Add an explicit license file when you decide how you want others to use this work.

