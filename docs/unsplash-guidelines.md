# Unsplash API — implementation guidelines

Reference notes for adding Unsplash as a third source alongside Curated and
Pexels. Written up before implementation so the integration is compliant from
day one — production access (higher rate limit) is only granted to apps
already following these rules, so there's no "build it loose, tidy it up
later" path here.

Source pages:
- https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines
- https://unsplash.com/documentation

## Key must stay server-side (unlike Pexels today)

Pexels' key (`VITE_PEXELS_API_KEY`) is exposed to the client on purpose — the
`VITE_` prefix tells Vite to bake it into the public bundle at build time, so
it's readable in devtools/Network today. Unsplash's guidelines explicitly
forbid this:

> "Your application's Access Key and Secret Key must remain confidential.
> This may require using a proxy if accessing the API client-side."

So the Unsplash key must be added in Vercel **without** a `VITE_` prefix
(e.g. `UNSPLASH_ACCESS_KEY`), read only via `process.env.UNSPLASH_ACCESS_KEY`
inside a new serverless function, and never imported into client code. Model
this on `api/generate.ts` (which already proxies the Replicate token the same
way) rather than on how Pexels is wired — the client should call something
like `/api/unsplash-search?query=...`, and the function makes the real
`api.unsplash.com` request server-side.

## Compliance checklist

- **Attribution (mandatory).** Credit both Unsplash and the individual
  photographer, with a link to the photographer's Unsplash profile.
- **UTM parameters on every link back to Unsplash.** Append
  `?utm_source=herokit&utm_medium=referral`.
- **Hotlink only — never re-host.**
  > "All API uses must use the hotlinked image URLs returned by the API
  > under the `photo.urls` properties. This applies to all uses of the image
  > and not just search results."
  Always serve `photo.urls.*` directly from Unsplash's CDN; never download
  and store a copy on our own storage.
- **Download tracking (mandatory, not optional analytics).** The moment a
  user actually picks a photo to use as their background (same moment as
  Pexels' current `onPick`/`onChange`), fire a `GET` request to
  `photo.links.download_location`. This is a required trigger per the
  guidelines, separate from just displaying the photo.
- **Don't put "Unsplash" in the app name or use their logo as an app icon.**
- **Don't sell the unaltered photos** or put them on physical products.
- **Don't replicate Unsplash's own core browsing experience** (e.g. an
  unofficial Unsplash client or wallpaper app) — fine here since Unsplash is
  one source among several inside a background-generator tool, not the
  product itself.

## API reference (for implementation)

- **Auth:** `Authorization: Client-ID YOUR_ACCESS_KEY` header (or
  `client_id` query param — header is preferred so it doesn't leak into logs
  as easily, though both live server-side either way here).
- **Search endpoint:** `GET /search/photos`
  - Required: `query`
  - Optional: `page` (default 1), `per_page` (default 10, max 30),
    `order_by` (`latest` | `relevant`, default `relevant`), `collections`,
    `content_filter` (`low` | `high`, default `low`), `color`, `orientation`
    (`landscape` | `portrait` | `squarish`).
- **Photo object fields we need:**
  - `photo.urls.raw` / `full` / `regular` (1080px) / `small` (400px) / `thumb` (200px)
  - `photo.links.download_location` — hit this on selection, per above
  - `photo.user.name`, `photo.user.username`, `photo.user.links.html` —
    for attribution + profile link
- **Download tracking:** `GET /photos/:id/download` (this is what
  `photo.links.download_location` points to — just request it, response
  body isn't needed)

## Rate limits

- **Demo mode:** 50 requests/hour
- **Production mode:** 1000 requests/hour
- Image file requests to `images.unsplash.com` itself don't count against
  the limit — only calls to the API (search, download-tracking, etc.) do.

## Applying for the increase

Production access is requested from the app's dashboard once the app
exists in Unsplash's system. Approval is conditioned on already meeting the
guidelines above — so ship attribution + UTM links + hotlinking + download
tracking + the server-side proxy as the initial build, not as a follow-up
pass, and the increase request should be straightforward.
