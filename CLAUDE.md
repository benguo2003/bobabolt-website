# rachel rates

Static review site for Rachel Li — coffee shops and restaurants. Plain HTML/CSS +
a little inline JS. **No build step, no package.json, no framework.**

```
index.html        coffee page   (tab 1)
restaurants.html  restaurant page (tab 2)
style.css         both pages
images/coffee/       images/restaurants/       served, committed
images/*/originals/                            full-res, gitignored
```

## Run & deploy

```bash
python3 -m http.server 8000     # must be a server; favicon/manifest paths are root-absolute
```

Deploy = `git push` to `main`; Vercel builds from the GitHub repo. Framework preset
"Other", no build command, no output dir, no `vercel.json`.

## Tabs

The two pages are the two tabs, linked by the `.tabs` nav in each `<header>`.
Hrefs are `index.html` / `restaurants.html` — **not** `/restaurants` — so they
resolve identically under `http.server` and on Vercel. The current page's link
carries `aria-current="page"`, which is what styles the active pill.

## Theming

`style.css` is token-driven. `body.theme-coffee` and `body.theme-restaurants`
each declare the full palette; every rule below reads `var(--…)`. Adding a
section means adding one token block, not new component CSS.

- coffee — morning: cream ground, warm brown, white cards
- restaurants — evening: deep forest ground, ivory cards, copper accent

## Cards

Both pages share `.coffee-grid` / `.coffee-card`. Interiors differ:

- **coffee**: `.header-info` → `.rating` → `.order-section` → `.criteria`.
  Stars are 5 spans; the inline script reads `data-rating` on `.stars` and adds
  `.filled` / `.partial` (partial uses `--fill-percentage`).
- **restaurants**: `.plate` menu layout — `.place` (tracked caps), `.flourish`
  (hairlines + `.pip` diamond), `.dish-label`, `.dish`. No ratings yet; the
  rating CSS is already themed and ready if they get added.

Every `img` starts at `opacity: 0` and needs `.loaded` from the inline
DOMContentLoaded script — **any new page must include that script** or the
photos stay invisible.

## Images — read this before adding any

⚠️ **`sips` reports the stored buffer and ignores EXIF orientation.** Phone photos
are often stored landscape with orientation 6 (= display portrait). Trusting
`sips` here once produced restaurant cards that cropped ~30% off every photo.
Always go through PIL, bake the rotation into the pixels, and drop the EXIF:

```python
from PIL import Image, ImageOps
im = ImageOps.exif_transpose(Image.open(src))      # bake orientation
w, h = im.size
im = im.resize((TARGET_W, round(TARGET_W * h / w)), Image.LANCZOS)
im.save(dst, "JPEG", quality=76, optimize=True, progressive=True)   # no exif
```

Then set the frame's `aspect-ratio` to the photo's **true** ratio so nothing
crops, and put the real pixel dims in `width`/`height`.

- coffee: 600×800 portrait (one 800×800), frame `height: 210px` — deliberately
  cropped, see the height budget below
- restaurants: 660×880 portrait, frame `aspect-ratio: 3/4`, uncropped
- first card(s) per page: `fetchpriority="high"` + `<link rel="preload">` in
  `<head>`; everything else `loading="lazy"`
- filenames may contain spaces and `'`, but **never `&`** (HTML entity in `src`)

## Height budget

Ben wants a full row of cards to fit on a MacBook viewport (~780px). Coffee
cards land ~670px, restaurants ~605px (4 across). Knobs: `.coffee-card img`
height, and `.restaurant-grid`'s `minmax()`. The coffee photos are portrait in a
short landscape frame, so they crop — showing them whole would mean ~1030px
cards. That trade-off was made knowingly; leave it unless Ben says otherwise.
