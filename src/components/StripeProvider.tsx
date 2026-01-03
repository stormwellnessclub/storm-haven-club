import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { useMemo } from 'react';

// Stripe publishable keys - test and live modes
const STRIPE_PUBLISHABLE_KEYS = {
  test: 'pk_test_51ScjCYLyZrsSqLhsVj2v99AJpk9o9EL4G0X8M2g4t6K6s9xN8JZ8s9F3D2W1P0Q9R8T7Y6U5I4O3P2A1S0D9F8G7H', // Replace with actual test key if needed
  live: 'pk_live_51ScjCYLyZrsSqLhsQu3CYIl3ufWrJWU8FQMjMXjZu3HXJm0cz9WMkPGQmQJNYLNRNp37YE4eV7ZfH8LMQXiN5Lwx00Y2b6T95l',
};

// Cache stripe instances by mode
const stripePromiseCache: { test?: Promise<Stripe | null>; live?: Promise<Stripe | null> } = {};

function getStripePromise(mode: 'test' | 'live'): Promise<Stripe | null> {
  if (!stripePromiseCache[mode]) {
    stripePromiseCache[mode] = loadStripe(STRIPE_PUBLISHABLE_KEYS[mode]);
  }
  return stripePromiseCache[mode]!;
}

interface StripeProviderProps {
  children: React.ReactNode;
  clientSecret: string;
  stripeMode?: 'test' | 'live';
}

export const StripeProvider = ({ children, clientSecret, stripeMode = 'live' }: StripeProviderProps) => {
  const stripePromise = useMemo(() => getStripePromise(stripeMode), [stripeMode]);

  const options = {
    clientSecret,
    appearance: {
      theme: 'stripe' as const,
      variables: {
        colorPrimary: '#c9a55c',
        colorBackground: '#ffffff',
        colorText: '#1a1a1a',
        colorDanger: '#ef4444',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        borderRadius: '8px',
      },
    },
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      {children}
    </Elements>
  );
};

// Export default live stripe promise for backward compatibility
export const stripePromise = getStripePromise('live');
