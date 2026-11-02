// Copy Checkout's real catalog/inline item names to the main Stripe payment.
// Keep all payment, pricing, metadata and fulfillment options unchanged.
export function labelCheckoutPurchases(stripe: any): void {
  const createSession = stripe.checkout.sessions.create.bind(stripe.checkout.sessions);
  stripe.checkout.sessions.create = async (params: any, options?: any) => {
    if (params.mode !== 'payment' || params.payment_intent_data?.description?.trim()) {
      return createSession(params, options);
    }

    const labels: string[] = [];
    for (const item of params.line_items ?? []) {
      let product = item.price_data?.product_data ?? item.price_data?.product;
      if (!product && item.price) {
        const price = typeof item.price === 'string'
          ? await stripe.prices.retrieve(item.price, { expand: ['product'] })
          : item.price;
        product = price.product;
      }
      if (typeof product === 'string') product = await stripe.products.retrieve(product);
      if (!product?.name || product.deleted) {
        throw new Error('Unable to identify the purchased item. Please try again.');
      }
      const quantity = item.quantity ?? 1;
      labels.push(quantity > 1 ? `${quantity} × ${product.name}` : product.name);
    }
    if (labels.length === 0) throw new Error('A purchased item is required.');

    return createSession({
      ...params,
      payment_intent_data: {
        ...params.payment_intent_data,
        description: labels.join(' + ').slice(0, 1000),
      },
    }, options);
  };
}