import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { useState, useEffect } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

// Stripe publishable key - must be set via environment variable
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

// Single cached stripe instance
let stripePromise: Promise<Stripe | null> | null = null;

const getStripePromise = () => {
  if (!stripePromise && STRIPE_PUBLISHABLE_KEY) {
    stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise;
};

interface StripeProviderProps {
  children: React.ReactNode;
  clientSecret: string;
}

export const StripeProvider = ({ children, clientSecret }: StripeProviderProps) => {
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initStripe = async () => {
      if (!STRIPE_PUBLISHABLE_KEY) {
        console.error('VITE_STRIPE_PUBLISHABLE_KEY environment variable is required');
        setError('Payment system is being configured. Please refresh the page in a moment.');
        setIsLoading(false);
        return;
      }

      if (!clientSecret) {
        setError('Payment session not initialized. Please try again.');
        setIsLoading(false);
        return;
      }

      try {
        const promise = getStripePromise();
        if (!promise) {
          setError('Unable to connect to payment provider. Please refresh the page.');
          setIsLoading(false);
          return;
        }

        const stripeInstance = await promise;
        if (stripeInstance) {
          setStripe(stripeInstance);
          setError(null);
        } else {
          setError('Failed to initialize payment system. Please refresh the page.');
        }
      } catch (err) {
        console.error('Stripe initialization error:', err);
        setError('Payment system temporarily unavailable. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    initStripe();
  }, [clientSecret]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-accent" />
          <p className="text-sm text-muted-foreground">Loading payment form...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-destructive/10 border border-destructive/20 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-destructive">Payment Form Error</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!stripe) {
    return (
      <div className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-700">Payment System Unavailable</p>
            <p className="text-sm text-muted-foreground mt-1">Please refresh the page and try again.</p>
          </div>
        </div>
      </div>
    );
  }

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
    <Elements stripe={stripe} options={options}>
      {children}
    </Elements>
  );
};

export { getStripePromise as stripePromise };
