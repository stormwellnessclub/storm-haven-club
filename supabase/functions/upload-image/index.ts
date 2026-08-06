import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2.57.2';

const ALLOWED_BUCKETS = ['cafe-menu-images', 'merch-images', 'equipment-images'];
const STAFF_ROLES = ['super_admin', 'admin', 'manager', 'cafe_staff', 'front_desk'];
const SHOP_ROLES = ['super_admin', 'admin', 'manager'];

const jsonResponse = (body: Record<string, unknown>, status = 200) => new Response(
  JSON.stringify(body),
  { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) return jsonResponse({ error: 'Not authenticated' }, 401);

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (userErr || !user) {
      return jsonResponse({ error: 'Your login has expired. Please sign in again.' }, 401);
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    const roleNames = (roles ?? []).map((r: { role: string }) => r.role);
    const isStaff = roleNames.some((role: string) => STAFF_ROLES.includes(role));
    if (!isStaff) {
      return jsonResponse({ error: 'Staff access is required to upload images.' }, 403);
    }

    const form = await req.formData();
    const file = form.get('file');
    const bucket = String(form.get('bucket') ?? '');
    const targetType = String(form.get('targetType') ?? '');
    const targetId = String(form.get('targetId') ?? '');
    if (!(file instanceof File)) {
      return jsonResponse({ error: 'Choose an image to upload.' }, 400);
    }
    if (!ALLOWED_BUCKETS.includes(bucket)) {
      return jsonResponse({ error: 'This image destination is not allowed.' }, 400);
    }
    if (targetType && !targetId) {
      return jsonResponse({ error: 'The item to attach this image to is missing.' }, 400);
    }
    if (targetType === 'cafe_menu_item' && bucket !== 'cafe-menu-images') {
      return jsonResponse({ error: 'The image destination does not match this menu item.' }, 400);
    }
    if (targetType === 'merch_product' && bucket !== 'merch-images') {
      return jsonResponse({ error: 'The image destination does not match this product.' }, 400);
    }
    if (targetType === 'merch_product' && !roleNames.some((role: string) => SHOP_ROLES.includes(role))) {
      return jsonResponse({ error: 'Admin or manager access is required to edit shop products.' }, 403);
    }
    if (targetType && !['cafe_menu_item', 'merch_product'].includes(targetType)) {
      return jsonResponse({ error: 'This image attachment type is not allowed.' }, 400);
    }
    if (!file.type.startsWith('image/')) {
      return jsonResponse({ error: 'Only image files can be uploaded.' }, 400);
    }
    if (file.size > 15 * 1024 * 1024) {
      return jsonResponse({ error: 'The image is too large. The maximum is 15 MB.' }, 400);
    }

    const rawExt = (file.name.split('.').pop() ?? '').toLowerCase();
    const ext = /^[a-z0-9]{1,5}$/.test(rawExt) ? rawExt : (file.type.split('/')[1] || 'jpg');
    const path = `${crypto.randomUUID()}.${ext}`;

    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: upErr } = await supabase.storage.from(bucket).upload(path, bytes, {
      contentType: file.type || 'image/jpeg',
      cacheControl: '3600',
      upsert: true,
    });
    if (upErr) {
      console.error('[upload-image] storage error', upErr.message);
      return jsonResponse({ error: `Storage upload failed: ${upErr.message}` }, 500);
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);

    if (targetType) {
      const table = targetType === 'cafe_menu_item' ? 'cafe_menu_items' : 'merch_products';
      const { data: record, error: readErr } = await supabase
        .from(table)
        .select('image_urls')
        .eq('id', targetId)
        .maybeSingle();
      if (readErr || !record) {
        await supabase.storage.from(bucket).remove([path]);
        return jsonResponse({ error: 'The image uploaded, but the item could not be found.' }, 404);
      }

      const currentUrls = Array.isArray(record.image_urls) ? record.image_urls : [];
      const nextUrls = [...currentUrls, urlData.publicUrl];
      const updates = targetType === 'cafe_menu_item'
        ? { image_urls: nextUrls, image_url: nextUrls[0] }
        : { image_urls: nextUrls, updated_at: new Date().toISOString() };
      const { data: attachedRows, error: attachErr } = await supabase
        .from(table)
        .update(updates)
        .eq('id', targetId)
        .select('id');
      if (attachErr || !attachedRows?.length) {
        await supabase.storage.from(bucket).remove([path]);
        const reason = attachErr?.message ?? 'No item was updated';
        console.error('[upload-image] attachment error', reason);
        return jsonResponse({ error: `The image could not be attached to the item: ${reason}` }, 500);
      }
    }

    return jsonResponse({ url: urlData.publicUrl, path, attached: Boolean(targetType) });
  } catch (e) {
    console.error('[upload-image] error', e);
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
