# rachel rates

Static review site for Rachel Li — coffee shops and restaurants. Plain HTML/CSS +
one small script (`app.js`). **No build step, no package.json, no framework.**

```
index.html              coffee page      → /             (tab 1)
restaurants/index.html  restaurant page  → /restaurants  (tab 2)
style.css               both pages
app.js                  both pages: stars, price, photo fade-in, tab transition
vercel.json             clean URLs + redirect from the old /restaurants.html
images/coffee/       images/restaurants/       served, committed
images/*/originals/                            full-res, gitignored
```

**Every path in the HTML is root-absolute** (`/style.css`, `/images/...`) because
the restaurant page lives one directory down and its markup is also swapped
into the coffee page at runtime.

## Run & deploy

```bash
python3 -m http.server 8000     # must be a server; favicon/manifest paths are root-absolute
```

Deploy = `git push` to `main`; Vercel builds from the GitHub repo. Framework preset
"Other", no build command, no output dir. `vercel.json` sets `cleanUrls` +
`trailingSlash: false` so the URLs are `/` and `/restaurants`. Locally,
`http.server` answers `/restaurants` with a 301 to `/restaurants/` — same page.

## Tabs

The two pages are the two tabs, linked by the `.tabs` nav in each `<header>`.
Hrefs are `/` and `/restaurants`; each tab has `data-section` and its text in a
`.tab-label` span. The current page's link carries `aria-current="page"`, which
is what styles the active pill.

**Switching tabs doesn't reload.** `app.js` fetches the other page in the
background (on idle, or on hover), and on click swaps `<main>`, the body theme
class, `.tagline`, `<title>` and `theme-color`, then `pushState`s the URL.
The swap runs inside a View Transition: the new page is clipped to a circle
growing from the click, a soft glow (`.vt-ring`, `--vt-glow`) rides its edge,
the old page dims (→ restaurants) or brightens (→ coffee), and the pill slides
between tabs. Anything that must differ between the pages has to live in one
of those swapped pieces. No View Transitions / reduced motion → instant swap.
Fetch failure → normal navigation.

## Theming

`style.css` is token-driven. `body.theme-coffee` and `body.theme-restaurants`
each declare the full palette; every rule below reads `var(--…)`. Adding a
section means adding one token block, not new component CSS.

- coffee — morning: cream ground, warm brown, warm-paper cards
- restaurants — evening: deep forest ground, ivory cards, copper accent

## Cards

Both pages share `.coffee-grid` / `article.coffee-card`. Interiors differ:

- **coffee** (`.cup`, centred): `.name` → `.location` (tracked caps) →
  `.rating` pill → `.flourish` → `.dish-label` "the order" → `.dish` →
  `dl.notes` (2×2 hairline grid: study-ability, aesthetic, price, flavor).
  Stars are 5 spans; `app.js` reads `data-rating` on `.stars` and adds
  `.filled` / `.partial` (partial uses `--fill-percentage`). Price is
  `<dd class="price" data-price="2">$$</dd>`; `app.js` pads it to `$$$` with
  the unused marks faded.
- **restaurants** (`.plate`): `.place` (tracked caps), `.flourish`
  (hairlines + `.pip` diamond), `.dish-label`, `.dish`. No ratings yet; the
  rating CSS is already themed and ready if they get added.

With JS, every `img` starts at `opacity: 0` until `app.js` adds `.loaded`
(the inline `<script>` in `<head>` sets `html.js`; without JS photos just
show). **Any new page must load `/app.js`.** Cards rise in with a staggered
`card-rise` animation on load and after each tab switch.

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

- coffee: 600×800 portrait (one 800×800), frame `height: 300px` — deliberately
  cropped, see the height budget below
- restaurants: 660×880 portrait, frame `aspect-ratio: 3/4`, uncropped
- first card(s) per page: `fetchpriority="high"` + `<link rel="preload">` in
  `<head>`; everything else `loading="lazy"`
- filenames may contain spaces and `'`, but **never `&`** (HTML entity in `src`)

## Height budget

Ben wants a full row of cards to fit on a MacBook viewport (~780px). Coffee
cards land ~642px, restaurants ~545px (4 across). Knobs: `.coffee-card img`
height, and `.restaurant-grid`'s `minmax()`. The coffee photos are portrait in a
short landscape frame, so they crop — showing them whole would mean ~1030px
cards. That trade-off was made knowingly; leave it unless Ben says otherwise.
