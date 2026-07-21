import type { VercelRequest, VercelResponse } from '@vercel/node';

// Prompt-to-background generation, proxied server-side so the Replicate API
// token never reaches the client bundle. Using Flux 2 Pro — like flux-1.1-pro
// before it, it's part of Replicate's "try for free" collection (replicate.
// com/collections/try-for-free, confirmed at time of writing), so it runs on
// the account's free quota with no billing required. Swap to a paid model
// once billing's on and the free quota matters less.

const MODEL = 'black-forest-labs/flux-2-pro';
const MAX_PROMPT_LENGTH = 500;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    res.status(500).json({ error: 'Image generation is not configured on this server.' });
    return;
  }

  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
  if (!prompt) {
    res.status(400).json({ error: 'A prompt is required.' });
    return;
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    res.status(400).json({ error: `Prompt is too long (max ${MAX_PROMPT_LENGTH} characters).` });
    return;
  }

  try {
    const create = await fetch(`https://api.replicate.com/v1/models/${MODEL}/predictions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        // Blocks the request until the (fast) model finishes instead of
        // requiring a separate poll round-trip from the client.
        Prefer: 'wait',
      },
      body: JSON.stringify({
        input: { prompt, aspect_ratio: '16:9', output_format: 'jpg', output_quality: 90 },
      }),
    });

    let prediction = await create.json();
    if (!create.ok) {
      res.status(502).json({ error: prediction?.detail || 'Generation request failed.' });
      return;
    }

    // Prefer: wait usually resolves synchronously for Schnell, but fall back
    // to a short poll loop in case the model queue was busy.
    let attempts = 0;
    while (!['succeeded', 'failed', 'canceled'].includes(prediction.status) && attempts < 30) {
      await new Promise(r => setTimeout(r, 1000));
      const poll = await fetch(prediction.urls.get, { headers: { Authorization: `Bearer ${token}` } });
      prediction = await poll.json();
      attempts++;
    }

    if (prediction.status !== 'succeeded') {
      res.status(502).json({ error: 'Generation did not complete in time — try again.' });
      return;
    }

    const outputUrl: string = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;

    // Replicate's output URL expires (~1hr) — fetch the bytes now and hand
    // back a data URL so the frontend can drop it straight into imageUrl
    // (and save it into a Look) without depending on a link that dies later.
    const imgRes = await fetch(outputUrl);
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const contentType = imgRes.headers.get('content-type') || 'image/jpeg';

    res.status(200).json({ imageUrl: `data:${contentType};base64,${buf.toString('base64')}` });
  } catch (err) {
    console.error('generate error:', err);
    res.status(500).json({ error: 'Something went wrong generating the image.' });
  }
}
