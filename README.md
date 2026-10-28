# martinsitar.com

Personal website for Martin Sitar — pure static HTML & CSS, zero build step.

## Structure
- `index.html` — Single-page site content and layout
- `css/style.css` — Stylesheet (responsive layout, typography, dark mode)
- `img/` — Site images (`img/roll/nyc-dec.jpg`, logos, social thumbnail)
- `netlify.toml` — Publishes root directory (`.`) directly with no build command

## Local Preview
Open `index.html` directly in a browser, or serve locally:
```bash
python3 -m http.server 1313
```
Then visit `http://localhost:1313/`.
