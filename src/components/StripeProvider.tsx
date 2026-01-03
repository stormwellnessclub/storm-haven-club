import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

// Use the Stripe publishable key
const stripePromise = loadStripe('pk_live_51ScjCYLyZrsSqLhsQu3CYIl3ufWrJWU8FQMjMXjZu3HXJm0cz9WMkPGQmQJNYLNRNp37YE4eV7ZfH8LMQXiN5Lwx00Y2b6T95l');

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
