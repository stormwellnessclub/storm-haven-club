import { Resend } from 'https://esm.sh/resend@2.0.0';
import { sendMarketingEmail, isSuppressed } from './marketingEmail.ts';
import { renderCampaignHtml } from './campaignRender.ts';
import { REVIEW_LINK, reviewSms, reviewEmail } from './googleReviewPolicy.ts';

/** Claim and attempt exactly one message. No automatic retry after an uncertain provider response. */
export async function runGoogleReviewTick(sb: any) {
  const { data: r, error } = await sb.rpc('claim_google_review_message');
  if (error) throw error;
  if (!r) return { ok: true, skipped: 'Nothing eligible' };
  let status = 'skipped', detail = 'Missing contact information';
  try {
    if (r.email && await isSuppressed(sb, r.email)) {
      detail = 'Marketing opt-out or blocked';
    } else if (r.channel === 'sms' && (r.phone || r.user_id)) {
      const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (!url || !key) throw new Error('Messaging service unavailable');
      const response = await fetch(`${url}/functions/v1/send-sms`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ templateKey: 'admin-custom', to: { ...(r.user_id ? { userId: r.user_id } : {}), ...(r.phone ? { phone: r.phone } : {}) },
          variables: { customBody: reviewSms(r.first_name, r.visit_type) }, idempotencyKey: `google-review:${r.id}:sms`, metadata: { review_request_id: r.id } }),
      });
      const raw = await response.text();
      if (!response.ok) throw new Error(`[${response.status}]: ${raw}`);
      const result = JSON.parse(raw);
      status = result.success && !result.error ? 'sent' : ['no_consent', 'blocked', 'No phone for recipient'].includes(result.error) ? 'skipped' : 'failed';
      detail = result.error || '';
    } else if (r.channel === 'email' && r.email) {
      const key = Deno.env.get('RESEND_API_KEY');
      if (!key) throw new Error('Email service unavailable');
      const text = reviewEmail(r.first_name, r.visit_type);
      const html = renderCampaignHtml([{ type: 'text', text }], { preheader: 'Thank you for visiting Storm Wellness Club.' });
      const result = await sendMarketingEmail(sb, new Resend(key), { from: 'Storm Wellness Club <admin@stormwellnessclub.com>', to: r.email,
        subject: 'How was your visit?', html, text, reply_to: 'admin@stormwellnessclub.com' });
      status = result.skipped ? 'skipped' : result.error ? 'failed' : 'sent';
      detail = result.error?.message || '';
    }
  } catch (e) { status = 'failed'; detail = String((e as Error).message); console.error('Google review message failed', detail); }
  const { error: finishError } = await sb.from('google_review_messages').update({ status, detail, ...(status === 'sent' ? { sent_at: new Date().toISOString() } : {}) }).eq('id', r.message_id);
  if (finishError) throw finishError;
  return { ok: true, status };
}

let reviewCache: { at: number; data: any } | null = null;
export async function readGoogleReviews() {
  if (reviewCache && Date.now() - reviewCache.at < 300_000) return reviewCache.data;
  const key = Deno.env.get('LOVABLE_API_KEY'), connectionKey = Deno.env.get('GOOGLE_BUSINESS_PROFILE_API_KEY');
  if (!key || !connectionKey) throw new Error('Google Business Profile is not linked');
  const reviews: any[] = []; let token = '', total = 0;
  do {
    const query = new URLSearchParams({ pageSize: '50', ...(token ? { pageToken: token } : {}) });
    const response = await fetch(`https://connector-gateway.lovable.dev/google_business_profile/my_business/v4/accounts/110477231507673186332/locations/16676707961712654716/reviews?${query}`, {
      headers: { Authorization: `Bearer ${key}`, 'X-Connection-Api-Key': connectionKey },
    });
    const raw = await response.text();
    if (!response.ok) { console.error(`Google reviews [${response.status}]: ${raw}`); throw new Error(`Google reviews [${response.status}]: ${raw}`); }
    const result = JSON.parse(raw); total = result.totalReviewCount;
    reviews.push(...(result.reviews || []).map((r: any) => ({ id: r.reviewId, name: r.reviewer?.displayName || 'Anonymous', date: r.createTime, comment: r.comment || '' })));
    token = result.nextPageToken || '';
  } while (token);
  const data = { ok: true, reviews, total, reviewLink: REVIEW_LINK };
  reviewCache = { at: Date.now(), data }; return data;
}