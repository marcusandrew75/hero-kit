import type { VercelRequest, VercelResponse } from '@vercel/node';

// Proxies Unsplash's search endpoint so the Access Key never reaches the
// client bundle (unlike Pexels' key, which Pexels' own docs don't require to
// be kept confidential — Unsplash's guidelines explicitly do). Trims the
// response down to just what the picker UI needs, including the fields
// required for mandatory attribution + download tracking.
const MAX_QUERY_LENGTH = 100;
const PER_PAGE = 20;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) {
    res.status(500).json({ error: 'Unsplash search is not configured on this server.' });
    return;
  }

  const rawQuery = req.query.query;
  const query = typeof rawQuery === 'string' ? rawQuery.trim() : '';
  if (!query) {
    res.status(400).json({ error: 'A query is required.' });
    return;
  }
  if (query.length > MAX_QUERY_LENGTH) {
    res.status(400).json({ error: `Query is too long (max ${MAX_QUERY_LENGTH} characters).` });
    return;
  }

  const rawPage = req.query.page;
  const page = typeof rawPage === 'string' && /^\d+$/.test(rawPage) ? parseInt(rawPage, 10) : 1;

  try {
    const url = new URL('https://api.unsplash.com/search/photos');
    url.searchParams.set('query', query);
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', String(PER_PAGE));
    url.searchParams.set('orientation', 'landscape');
    url.searchParams.set('content_filter', 'low');

    const upstream = await fetch(url, {
      headers: { Authorization: `Client-ID ${key}` },
    });
    const data = await upstream.json();

    if (!upstream.ok) {
      res.status(502).json({ error: data?.errors?.[0] || 'Unsplash search failed.' });
      return;
    }

    const results = (data.results ?? []).map((photo: any) => ({
      id: photo.id,
      alt: photo.alt_description || photo.description || '',
      urls: { small: photo.urls.small, regular: photo.urls.regular },
      user: { name: photo.user.name, profileUrl: photo.user.links.html },
      downloadLocation: photo.links.download_location,
    }));

    res.status(200).json({ results, hasMore: page < (data.total_pages ?? 0) });
  } catch (err) {
    console.error('unsplash-search error:', err);
    res.status(500).json({ error: 'Something went wrong searching Unsplash.' });
  }
}
