# Portfolio

Sergio Simental Jr.'s resume and projects site. Built with [Eleventy](https://www.11ty.dev/) and published with GitHub Pages.

- **Resume & experience:** `/` (home page)
- **Projects:** `/projects/`

## Run it locally

Needs Node 22 or newer (the image tools require it).

```bash
npm install
npm start          # http://localhost:8080, reloads as you edit
npm run build      # writes the finished site to _site/
npm run check      # full build, then fails if any link, image, font or video is missing
```

## Updating content

Everything you'd normally change is data, not HTML.

| To change… | Edit |
| --- | --- |
| Name, intro, email, links, "what I'm looking for" | `src/_data/site.json` |
| Jobs, education, skills | `src/_data/resume.json` |
| A project | its file in `src/projects/` |
| Colors, fonts, spacing | the variables at the top of `src/assets/css/site.css` |

### Add a project

1. Put its screenshot (and optional demo video) in `src/assets/media/`. Any size JPG or PNG is fine: the build makes small AVIF/WebP/JPEG versions automatically. Keep demo videos short and compressed (under ~3 MB).
2. Copy one of the files in `src/projects/` to a new name, e.g. `src/projects/my-app.md`, and fill in the front matter:

```yaml
---
title: My App
order: 4                 # position on the Projects page (lower = earlier)
featured: false          # true = full-width card at the top
badge: Personal project  # small label over the image
summary: One or two sentences on what it does.
highlights:              # optional
  - Something worth knowing
tech: [Kotlin, Jetpack Compose]
links:
  - label: Open the app
    href: https://example.com
    primary: true        # filled button; leave out for a plain link
  - label: Source code
    href: https://github.com/SergioSimental/my-app
media:
  kind: image            # or "board" for the Connect 4 style preview
  src: /assets/media/my-app.jpg
  alt: Describe the screenshot for screen readers
  video: /assets/media/my-app-demo.mp4   # optional, adds a "Play demo" button
  duration: "0:30"
---
```

The card, the project count and the teaser on the home page all update by themselves.

### Add a job

Add an entry at the top of `jobs` in `src/_data/resume.json`. `metric` is optional and shows as a highlighted number.

### Resume PDF

Export your resume as PDF and save it as `src/resume.pdf`. The "Download resume" and "PDF" buttons link to it. You can also open the home page in a browser and print it: the print styles hide the menu and buttons and give a clean one-document layout.

**Keep your phone number out of the public PDF.**

## Publishing

`.github/workflows/deploy.yml` builds and publishes the site on every push to `main`.

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

The workflow sets the site's base path from the repo name, so links work in both places:

- In this repo (`portfolio`), the site is served at `https://sergiosimental.github.io/portfolio/`.
- In `SergioSimental.github.io`, it's served at `https://sergiosimental.github.io/`.

Always write site links from the root (`/projects/`, `/assets/media/x.jpg`). Eleventy adds the `/portfolio/` prefix when needed.

## Moving to SergioSimental.github.io

From a local clone of `SergioSimental.github.io`:

```bash
git tag v1-massively                     # bookmark the old site
git remote add portfolio https://github.com/SergioSimental/portfolio.git
git fetch portfolio
git checkout -b redesign portfolio/main
git push origin redesign
```

Open a pull request from `redesign` into `main`. In that repo, also set **Settings → Pages → Source: GitHub Actions**. After merging, the new site replaces the old one at the root address, and the history from this repo comes with it.
