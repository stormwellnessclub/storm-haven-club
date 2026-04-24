import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { email, password, secret } = await req.json();
    const expected = Deno.env.get('SUPER_ADMIN_BOOTSTRAP_SECRET');
    if (!expected || secret !== expected) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'email and password required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Find or create auth user
    let userId: string | null = null;
    const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (listErr) throw listErr;
    const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

    if (existing) {
      userId = existing.id;
      const { error: updErr } = await supabase.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
      });
      if (updErr) throw updErr;
    } else {
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createErr) throw createErr;
      userId = created.user!.id;
    }

    // Assign super_admin role
    const { error: roleErr } = await supabase
      .from('user_roles')
      .upsert({ user_id: userId, role: 'super_admin' }, { onConflict: 'user_id,role' });
    if (roleErr) throw roleErr;

    return new Response(
      JSON.stringify({ success: true, user_id: userId, email, action: existing ? 'updated' : 'created' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('create-super-admin error', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
