import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

// HeroKit Pro is a single one-time unlock — no subscription tiers, so
// Checkout mode is always 'payment'. See api/stripe-webhook.ts for the
// other half (grants the entitlement once Stripe confirms payment).
//
// ui_mode 'embedded' + redirect_on_completion 'never' keeps Stripe's card
// form inside our own modal (an iframe) and returns control to the client
// via the SDK's onComplete callback instead of navigating the page away —
// so the whole flow stays in the paywall modal. The client then polls the
// entitlement (the webhook is the source of truth) and shows its own
// success state.
//
// The Price ID comes from STRIPE_PRICE_ID so test/live can differ per
// environment (a live secret key can't use a test price and vice-versa).
// Falls back to the test price for local dev convenience — PRODUCTION MUST
// set STRIPE_PRICE_ID to the live price ID.
const PRICE_ID = process.env.STRIPE_PRICE_ID || 'price_1TwRQKRnRYLDY5vDRWWgFBSw';

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
  if (!userId) {
    res.status(400).json({ error: 'userId is required.' });
    return;
  }

  try {
    const stripe = new Stripe(secretKey);
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded_page',
      mode: 'payment',
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      client_reference_id: userId,
      customer_email: email,
      redirect_on_completion: 'never',
    });
    res.status(200).json({ clientSecret: session.client_secret });
  } catch (err) {
    console.error('stripe-checkout error:', err);
    res.status(500).json({ error: 'Could not start checkout.' });
  }
}
