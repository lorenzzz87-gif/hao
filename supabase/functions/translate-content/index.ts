import { createClient } from 'npm:@supabase/supabase-js@2.115.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const allowedContentTypes = new Set(['plan_title', 'plan_note', 'message']);
const allowedLanguages = new Set(['en', 'it', 'zh']);
const model = Deno.env.get('OPENAI_TRANSLATION_MODEL') ?? 'gpt-5-mini';

type TranslationRequest = { contentType?: string; contentId?: string; targetLanguage?: string };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function translatedText(response: Record<string, unknown>) {
  if (typeof response.output_text === 'string') return response.output_text.trim();
  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    if (!item || typeof item !== 'object' || !Array.isArray((item as { content?: unknown }).content)) continue;
    for (const content of (item as { content: unknown[] }).content) {
      if (content && typeof content === 'object' && typeof (content as { text?: unknown }).text === 'string') return (content as { text: string }).text.trim();
    }
  }
  return '';
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ error: 'authentication_required' }, 401);
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: 'server_not_configured' }, 503);

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: 'authentication_required' }, 401);

  let body: TranslationRequest;
  try { body = await request.json(); } catch { return json({ error: 'invalid_request' }, 400); }
  if (!body.contentType || !allowedContentTypes.has(body.contentType) || !body.contentId || !body.targetLanguage || !allowedLanguages.has(body.targetLanguage)) return json({ error: 'invalid_request' }, 400);

  let sourceText: string | null = null;
  let planId: string | null = null;
  if (body.contentType === 'message') {
    const source = await userClient.from('plan_messages').select('body,plan_id').eq('id', body.contentId).is('deleted_at', null).single();
    if (source.error) return json({ error: 'content_not_found' }, 404);
    sourceText = source.data.body;
    planId = source.data.plan_id;
  } else {
    const source = await userClient.from('plans').select('title,note').eq('id', body.contentId).single();
    if (source.error) return json({ error: 'content_not_found' }, 404);
    sourceText = body.contentType === 'plan_title' ? source.data.title : source.data.note;
    planId = body.contentId;
  }
  if (!sourceText?.trim()) return json({ error: 'content_not_found' }, 404);

  const sourceHash = await sha256(sourceText);
  const cached = await admin.from('content_translations').select('translated_text').eq('content_type', body.contentType).eq('content_id', body.contentId).eq('target_language', body.targetLanguage).eq('source_hash', sourceHash).maybeSingle();
  if (cached.error) return json({ error: 'translation_unavailable' }, 503);
  if (cached.data) {
    await admin.from('ai_usage_logs').insert({ user_id: userData.user.id, plan_id: planId, feature: 'translation', provider: 'cache', model, cache_hit: true });
    return json({ translatedText: cached.data.translated_text, cached: true, targetLanguage: body.targetLanguage });
  }

  const { data: limit } = await admin.from('ai_feature_limits').select('enabled,daily_budget_usd,monthly_budget_usd,max_calls_per_user_per_day').eq('feature', 'translation').single();
  if (!limit?.enabled) return json({ error: 'translation_unavailable' }, 503);
  const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
  const monthStart = new Date(Date.UTC(dayStart.getUTCFullYear(), dayStart.getUTCMonth(), 1));
  const [dailyUsage, monthlyUsage, userCalls] = await Promise.all([
    admin.from('ai_usage_logs').select('estimated_cost_usd').eq('feature', 'translation').gte('created_at', dayStart.toISOString()).eq('success', true).eq('cache_hit', false),
    admin.from('ai_usage_logs').select('estimated_cost_usd').eq('feature', 'translation').gte('created_at', monthStart.toISOString()).eq('success', true).eq('cache_hit', false),
    admin.from('ai_usage_logs').select('id', { count: 'exact', head: true }).eq('feature', 'translation').eq('user_id', userData.user.id).gte('created_at', dayStart.toISOString()).eq('cache_hit', false),
  ]);
  if (dailyUsage.error || monthlyUsage.error || userCalls.error) return json({ error: 'translation_unavailable' }, 503);
  const spentToday = (dailyUsage.data ?? []).reduce((sum, row) => sum + Number(row.estimated_cost_usd), 0);
  const spentMonth = (monthlyUsage.data ?? []).reduce((sum, row) => sum + Number(row.estimated_cost_usd), 0);
  if ((limit.daily_budget_usd != null && spentToday >= Number(limit.daily_budget_usd)) || (limit.monthly_budget_usd != null && spentMonth >= Number(limit.monthly_budget_usd)) || (limit.max_calls_per_user_per_day != null && (userCalls.count ?? 0) >= limit.max_calls_per_user_per_day)) return json({ error: 'translation_budget_reached' }, 429);
  if (!openaiKey) return json({ error: 'translation_unavailable' }, 503);

  const startedAt = Date.now();
  let providerResponse: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    providerResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        store: false,
        instructions: `Translate the input into ${body.targetLanguage}. Preserve meaning, names, tone, emojis, and formatting. Return only the translation.`,
        input: sourceText,
        max_output_tokens: 1200,
      }),
      signal: AbortSignal.timeout(12_000),
    }).catch(() => null);
    if (providerResponse?.ok || (providerResponse && providerResponse.status < 500 && providerResponse.status !== 429)) break;
  }

  if (!providerResponse?.ok) {
    await admin.from('ai_usage_logs').insert({ user_id: userData.user.id, plan_id: planId, feature: 'translation', provider: 'openai', model, latency_ms: Date.now() - startedAt, success: false, error_code: providerResponse ? `openai_${providerResponse.status}` : 'openai_timeout' });
    return json({ error: 'translation_unavailable' }, 503);
  }

  const response = await providerResponse.json() as Record<string, unknown>;
  const translation = translatedText(response);
  if (!translation) {
    await admin.from('ai_usage_logs').insert({ user_id: userData.user.id, plan_id: planId, feature: 'translation', provider: 'openai', model, latency_ms: Date.now() - startedAt, success: false, error_code: 'empty_translation' });
    return json({ error: 'translation_unavailable' }, 503);
  }
  const usage = response.usage as { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number } } | undefined;
  const inputTokens = usage?.input_tokens ?? 0;
  const outputTokens = usage?.output_tokens ?? 0;
  const cachedTokens = usage?.input_tokens_details?.cached_tokens ?? 0;
  const estimatedCost = ((inputTokens - cachedTokens) * 0.25 + cachedTokens * 0.025 + outputTokens * 2) / 1_000_000;

  const saved = await admin.from('content_translations').upsert({ content_type: body.contentType, content_id: body.contentId, source_language: null, target_language: body.targetLanguage, source_hash: sourceHash, translated_text: translation, provider: 'openai', model }, { onConflict: 'content_type,content_id,target_language,source_hash', ignoreDuplicates: true }).select('translated_text').maybeSingle();
  await admin.from('ai_usage_logs').insert({ user_id: userData.user.id, plan_id: planId, feature: 'translation', provider: 'openai', model, request_id: typeof response.id === 'string' ? response.id : null, input_tokens: inputTokens, output_tokens: outputTokens, cached_input_tokens: cachedTokens, estimated_cost_usd: estimatedCost, latency_ms: Date.now() - startedAt, cache_hit: false, success: true });
  return json({ translatedText: saved.data?.translated_text ?? translation, cached: false, targetLanguage: body.targetLanguage });
});
