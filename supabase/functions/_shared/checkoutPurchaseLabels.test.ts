// @ts-nocheck
import { describe, expect, it } from 'bun:test';
import { labelCheckoutPurchases } from './checkoutPurchaseLabels';

function catalog() {
  const calls: any[] = [];
  const stripe = {
    checkout: { sessions: { create: async (params: any, options: any) => {
      calls.push({ params, options }); return { id: 'mock_session' };
    } } },
    prices: { retrieve: async (id: string) => ({ product: {
      name: id === 'pack' ? 'Pilates/Cycling 10-Pack - Non-Member' : 'Processing Fee',
    } }) },
    products: { retrieve: async () => ({ name: 'Red Light Therapy — 20 minutes' }) },
  };
  labelCheckoutPurchases(stripe);
  return { stripe, calls };
}

describe('actual item names on Stripe payments', () => {
  it('labels Rhylie’s ten-pack and fee without changing pricing or saved-card options', async () => {
    const { stripe, calls } = catalog();
    const items = [{ price: 'pack', quantity: 1 }, { price: 'fee', quantity: 1 }];
    await stripe.checkout.sessions.create({ mode: 'payment', line_items: items,
      payment_intent_data: { setup_future_usage: 'off_session' }, metadata: { type: 'class_pass' },
    }, { idempotencyKey: 'mock-only' });
    expect(calls[0].params.payment_intent_data).toEqual({ setup_future_usage: 'off_session',
      description: 'Pilates/Cycling 10-Pack - Non-Member + Processing Fee' });
    expect(calls[0].params.line_items).toEqual(items);
    expect(calls[0].params.metadata).toEqual({ type: 'class_pass' });
    expect(calls[0].options.idempotencyKey).toBe('mock-only');
  });
  it('labels inline treatments and catalog bundles with their quantities', async () => {
    const { stripe, calls } = catalog();
    await stripe.checkout.sessions.create({ mode: 'payment', ui_mode: 'embedded', line_items: [
      { price_data: { product_data: { name: 'Storm Signature Massage — 60 minutes' } }, quantity: 1 },
      { price_data: { product: 'recovery' }, quantity: 6 },
    ] });
    expect(calls[0].params.payment_intent_data.description).toBe(
      'Storm Signature Massage — 60 minutes + 6 × Red Light Therapy — 20 minutes');
  });
  it('preserves existing specific descriptions and subscription sessions', async () => {
    const { stripe, calls } = catalog();
    const explicit = { mode: 'payment', payment_intent_data: { description: 'Custom treatment upgrade' } };
    const subscription = { mode: 'subscription', line_items: [{ price: 'dues' }] };
    await stripe.checkout.sessions.create(explicit);
    await stripe.checkout.sessions.create(subscription);
    expect(calls[0].params).toBe(explicit);
    expect(calls[1].params).toBe(subscription);
  });
  it('does not create an unlabeled checkout when catalog lookup fails', async () => {
    const { stripe, calls } = catalog();
    stripe.prices.retrieve = async () => ({ product: { deleted: true } });
    await expect(stripe.checkout.sessions.create({ mode: 'payment', line_items: [{ price: 'missing' }] }))
      .rejects.toThrow('Unable to identify');
    expect(calls).toHaveLength(0);
  });
});