// Public: returns a short-lived signed URL for a café review photo,
// but only when that photo belongs to an approved review.
// Storage reads are owner-bound, so this is the only public path to approved photos.
import { createClient } from 'npm:@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Content-Type': 'application/json',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const path = typeof body.path === 'string' ? body.path.trim() : '';
    if (!path || path.length > 300 || path.includes('..')) {
      return new Response(JSON.stringify({ error: 'Invalid photo reference.' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: review } = await supabase
      .from('cafe_reviews')
      .select('id')
      .eq('photo_path', path)
      .eq('moderation_status', 'approved')
      .maybeSingle();

    if (!review) {
      return new Response(JSON.stringify({ error: 'Photo not available.' }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    const { data, error } = await supabase.storage
      .from('cafe-review-photos')
      .createSignedUrl(path, 60 * 60);

    if (error || !data?.signedUrl) {
      console.error('[cafe-review-photo] sign failed', error?.message);
      return new Response(JSON.stringify({ error: 'Photo not available.' }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({ url: data.signedUrl }), { headers: corsHeaders });
  } catch (e) {
    console.error('[cafe-review-photo] error', e);
    return new Response(JSON.stringify({ error: 'Photo not available.' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
