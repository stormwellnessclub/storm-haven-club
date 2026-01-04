import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

// Live Stripe publishable key
const STRIPE_PUBLISHABLE_KEY = 'pk_live_51Se7DULyZrsSqLhsrs55WIACkSQNKMKTZ6hOKUWtIymBa05ZHrpDigyFYZyj5MGZUvfasUrRpUFDCZCtJzPnElPv00UZnFfqy4';

// Single cached stripe instance
const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

interface StripeProviderProps {
  children: React.ReactNode;
  clientSecret: string;
}

export const StripeProvider = ({ children, clientSecret }: StripeProviderProps) => {

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

export { stripePromise };
