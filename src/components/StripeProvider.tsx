import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { useState, useEffect, useCallback } from 'react';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

// Cache Stripe instances per publishable key
const stripePromiseByKey = new Map<string, Promise<Stripe | null>>();

const getStripePromise = (publishableKey: string) => {
  const key = publishableKey?.trim();
  if (!key) return null;

  const existing = stripePromiseByKey.get(key);
  if (existing) return existing;

  const created = loadStripe(key);
  stripePromiseByKey.set(key, created);
  return created;
};

interface StripeProviderProps {
  children: React.ReactNode;
  clientSecret: string;
}

export const StripeProvider = ({ children, clientSecret }: StripeProviderProps) => {
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  const initStripe = useCallback(async () => {
    console.log('[StripeProvider] Initializing... (attempt:', retryCount + 1, ')');
    setIsLoading(true);
    setError(null);

    if (!clientSecret) {
      console.error('[StripeProvider] No client secret provided');
      setError('Payment session not initialized. Please try again.');
      setIsLoading(false);
      return;
    }

    const getPublishableKey = async (): Promise<string | null> => {
      const isValidPublishableKey = (key: string) => key.trim().startsWith('pk_');

      // Prefer build-time env when available (but only if it looks like a real Stripe publishable key)
      const envKey = (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined) || '';
      console.log('[StripeProvider] Checking env key...', envKey ? 'found' : 'not found');
      
      if (envKey.trim()) {
        if (isValidPublishableKey(envKey)) {
          console.log('[StripeProvider] Using env key (pk_...)');
          return envKey.trim();
        }
        console.warn('[StripeProvider] Ignoring invalid VITE_STRIPE_PUBLISHABLE_KEY (expected pk_*)');
      }

      // Fallback: fetch from backend at runtime (publishable key is safe to expose)
      console.log('[StripeProvider] Falling back to stripe-config edge function...');
      try {
        const { data, error } = await supabase.functions.invoke('stripe-config', {
          body: {},
        });

        if (error) {
          console.error('[StripeProvider] stripe-config invoke error:', error);
          return null;
        }

        const keyFromBackend = (data as { publishableKey?: string } | null)?.publishableKey;
        if (!keyFromBackend?.trim()) {
          console.error('[StripeProvider] stripe-config returned empty key');
          return null;
        }

        if (!isValidPublishableKey(keyFromBackend)) {
          console.error('[StripeProvider] stripe-config returned invalid publishable key');
          return null;
        }

        console.log('[StripeProvider] Using key from stripe-config edge function');
        return keyFromBackend.trim();
      } catch (err) {
        console.error('[StripeProvider] stripe-config fetch error:', err);
        return null;
      }
    };

    const publishableKey = await getPublishableKey();
    if (!publishableKey) {
      console.error('[StripeProvider] Stripe publishable key is missing');
      setError('Payment system is not configured. Please try again in a moment.');
      setIsLoading(false);
      return;
    }

    try {
      const promise = getStripePromise(publishableKey);
      if (!promise) {
        setError('Unable to connect to payment provider. Please refresh the page.');
        setIsLoading(false);
        return;
      }

      const stripeInstance = await promise;
      if (stripeInstance) {
        console.log('[StripeProvider] Stripe initialized successfully');
        setStripe(stripeInstance);
        setError(null);
      } else {
        setError('Failed to initialize payment system. Please refresh the page.');
      }
    } catch (err) {
      console.error('[StripeProvider] Stripe initialization error:', err);
      setError('Payment system temporarily unavailable. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, [clientSecret, retryCount]);

  useEffect(() => {
    initStripe();
  }, [initStripe]);

  const handleRetry = () => {
    console.log('[StripeProvider] User triggered retry');
    setRetryCount(c => c + 1);
  };

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
          <div className="flex-1">
            <p className="font-medium text-destructive">Payment Form Error</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRetry}
              className="mt-3"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
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
          <div className="flex-1">
            <p className="font-medium text-amber-700">Payment System Unavailable</p>
            <p className="text-sm text-muted-foreground mt-1">Please refresh the page and try again.</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRetry}
              className="mt-3"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
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

  return <Elements stripe={stripe} options={options}>{children}</Elements>;
};

export { getStripePromise as stripePromise };
