import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

// HeroKit Pro is a single one-time unlock — no subscription tiers, so
// Checkout mode is always 'payment'. See api/stripe-webhook.ts for the
// other half (grants the entitlement once Stripe confirms payment).
const PRICE_ID = 'price_1TwRQKRnRYLDY5vDRWWgFBSw';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    res.status(500).json({ error: 'Checkout is not configured on this server.' });
    return;
  }

  const userId = typeof req.body?.userId === 'string' ? req.body.userId : '';
  const email = typeof req.body?.email === 'string' ? req.body.email : undefined;
  const returnUrl = typeof req.body?.returnUrl === 'string' ? req.body.returnUrl : '';
  if (!userId || !returnUrl) {
    res.status(400).json({ error: 'userId and returnUrl are required.' });
    return;
  }

  const sep = returnUrl.includes('?') ? '&' : '?';

  try {
    const stripe = new Stripe(secretKey);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      client_reference_id: userId,
      customer_email: email,
      success_url: `${returnUrl}${sep}checkout=success`,
      cancel_url: `${returnUrl}${sep}checkout=cancel`,
    });
    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('stripe-checkout error:', err);
    res.status(500).json({ error: 'Could not start checkout.' });
  }
}
