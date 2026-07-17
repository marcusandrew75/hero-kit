import type { VercelRequest, VercelResponse } from '@vercel/node';

// Fires Unsplash's mandatory "download" tracking ping whenever a user
// actually selects a photo (not just browses it) — required by Unsplash's
// API guidelines, separate from displaying search results. The URL comes
// from the client (photo.links.download_location, passed through unchanged
// by unsplash-search.ts), so it's validated tightly before this server
// attaches its secret Access Key and fetches it — otherwise this endpoint
// would be an open proxy for arbitrary requests with that key attached.
const DOWNLOAD_PATH = /^\/photos\/[^/]+\/download$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) {
    res.status(500).json({ error: 'Unsplash is not configured on this server.' });
    return;
  }

  const raw = req.query.url;
  if (typeof raw !== 'string') {
    res.status(400).json({ error: 'A url is required.' });
    return;
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    res.status(400).json({ error: 'Invalid url.' });
    return;
  }

  if (target.protocol !== 'https:' || target.hostname !== 'api.unsplash.com' || !DOWNLOAD_PATH.test(target.pathname)) {
    res.status(400).json({ error: 'Url is not a valid Unsplash download location.' });
    return;
  }

  try {
    await fetch(target, { headers: { Authorization: `Client-ID ${key}` } });
    res.status(204).end();
  } catch (err) {
    console.error('unsplash-download error:', err);
    res.status(500).json({ error: 'Something went wrong tracking the download.' });
  }
}
