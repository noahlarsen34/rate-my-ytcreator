import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const requiredEnv = (name: string) => { const value = Deno.env.get(name); if (!value) throw new Error(`The ${name} Edge Function secret is not configured.`); return value; };
const toBytes = (value: string) => Uint8Array.from(atob(value), character => character.charCodeAt(0));
const toBase64 = (value: Uint8Array) => { let binary = ''; value.forEach(byte => { binary += String.fromCharCode(byte); }); return btoa(binary); };

async function getEncryptionKey() {
  const keyBytes = toBytes(requiredEnv('YOUTUBE_TOKEN_ENCRYPTION_KEY'));
  if (keyBytes.byteLength !== 32) throw new Error('YOUTUBE_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  return crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function encryptToken(token: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await getEncryptionKey(), new TextEncoder().encode(token));
  return `v1:${toBase64(iv)}:${toBase64(new Uint8Array(ciphertext))}`;
}
async function decryptToken(stored: string) {
  const [version, iv, ciphertext] = stored.split(':');
  if (version !== 'v1' || !iv || !ciphertext) throw new Error('The saved YouTube connection has an invalid token format.');
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: toBytes(iv) }, await getEncryptionKey(), toBytes(ciphertext));
  return new TextDecoder().decode(plaintext);
}
async function refreshAccessToken(refreshToken: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: requiredEnv('GOOGLE_CLIENT_ID'), client_secret: requiredEnv('GOOGLE_CLIENT_SECRET'), refresh_token: refreshToken, grant_type: 'refresh_token' }) });
  const result = await response.json();
  if (!response.ok || !result.access_token) throw new Error(result.error === 'invalid_grant' ? 'Your YouTube permission expired or was revoked. Please reconnect YouTube.' : 'Google could not refresh the YouTube connection.');
  return String(result.access_token);
}
async function fetchSubscriptions(accessToken: string) {
  const subscriptions = new Set<string>();
  let pageToken = '', pageCount = 0;
  do {
    const url = new URL('https://www.googleapis.com/youtube/v3/subscriptions');
    url.searchParams.set('part', 'snippet'); url.searchParams.set('mine', 'true'); url.searchParams.set('maxResults', '50');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const result = await response.json();
    if (!response.ok) throw new Error(result?.error?.message || 'YouTube subscriptions could not be loaded.');
    for (const item of result.items || []) { const channelId = item?.snippet?.resourceId?.channelId; if (channelId) subscriptions.add(channelId); }
    pageToken = result.nextPageToken || ''; pageCount += 1;
    if (pageCount >= 100) throw new Error('The YouTube account has too many subscription pages to sync safely in one request.');
  } while (pageToken);
  return [...subscriptions];
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  try {
    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return json({ error: 'You must be signed in.' }, 401);
    const userClient = createClient(supabaseUrl, requiredEnv('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: userData, error: userError } = await userClient.auth.getUser(authorization.slice(7));
    if (userError || !userData.user) return json({ error: 'Your session is invalid or expired. Please sign in again.' }, 401);
    const admin = createClient(supabaseUrl, requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });
    const userId = userData.user.id;
    const body = await request.json().catch(() => ({}));

    if (body.action === 'status') {
      const [{ data: connection, error: connectionError }, { count, error: countError }] = await Promise.all([
        admin.from('youtube_connections').select('last_synced_at').eq('user_id', userId).maybeSingle(),
        admin.from('creator_follows').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('source', 'youtube')
      ]);
      if (connectionError) throw connectionError; if (countError) throw countError;
      return json({ connected: Boolean(connection), lastSyncedAt: connection?.last_synced_at || null, followedCreators: count || 0 });
    }
    if (body.action === 'disconnect') {
      const { error: followsError } = await admin.from('creator_follows').delete().eq('user_id', userId).eq('source', 'youtube'); if (followsError) throw followsError;
      const { error: connectionError } = await admin.from('youtube_connections').delete().eq('user_id', userId); if (connectionError) throw connectionError;
      return json({ connected: false, lastSyncedAt: null, followedCreators: 0 });
    }
    if (body.action !== 'sync') return json({ error: 'Unknown action.' }, 400);

    let accessToken = typeof body.providerToken === 'string' ? body.providerToken : '';
    const providerRefreshToken = typeof body.providerRefreshToken === 'string' ? body.providerRefreshToken : '';
    if (providerRefreshToken) {
      const { error } = await admin.from('youtube_connections').upsert({ user_id: userId, encrypted_refresh_token: await encryptToken(providerRefreshToken), updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (error) throw error;
    }
    if (accessToken && !providerRefreshToken) {
      const { data: savedConnection, error } = await admin.from('youtube_connections').select('user_id').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      if (!savedConnection) return json({ error: 'Google did not provide a long-lived YouTube token. Please reconnect and approve access again.' }, 409);
    }
    if (!accessToken) {
      const { data: connection, error } = await admin.from('youtube_connections').select('encrypted_refresh_token').eq('user_id', userId).maybeSingle();
      if (error) throw error; if (!connection) return json({ error: 'YouTube is not connected. Connect it before syncing.' }, 409);
      accessToken = await refreshAccessToken(await decryptToken(connection.encrypted_refresh_token));
    }

    const channelIds = await fetchSubscriptions(accessToken);
    const matchedCreators: Array<{ creator_id: string; youtube_channel_id: string }> = [];
    for (let index = 0; index < channelIds.length; index += 100) {
      const { data, error } = await admin.from('content_creators').select('creator_id, youtube_channel_id').in('youtube_channel_id', channelIds.slice(index, index + 100));
      if (error) throw error; matchedCreators.push(...(data || []));
    }
    if (matchedCreators.length) {
      const follows = matchedCreators.map(creator => ({ user_id: userId, creator_id: creator.creator_id, source: 'youtube' }));
      const { error } = await admin.from('creator_follows').upsert(follows, { onConflict: 'user_id,creator_id,source', ignoreDuplicates: true }); if (error) throw error;
    }
    const syncedAt = new Date().toISOString();
    const { error: syncError } = await admin.from('youtube_connections').update({ last_synced_at: syncedAt, updated_at: syncedAt }).eq('user_id', userId); if (syncError) throw syncError;
    return json({ connected: true, lastSyncedAt: syncedAt, followedCreators: matchedCreators.length, totalSubscriptions: channelIds.length, matchedCreators: matchedCreators.length, unmatchedCreators: channelIds.length - matchedCreators.length });
  } catch (error) {
    console.error('youtube-sync failed:', error instanceof Error ? error.message : 'Unknown error');
    return json({ error: error instanceof Error ? error.message : 'The YouTube request failed.' }, 500);
  }
});
