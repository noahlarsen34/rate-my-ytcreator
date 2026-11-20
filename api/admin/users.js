import { createClient } from '@supabase/supabase-js';

const json = (response, status, body) => response.status(status).json(body);
const clean = value => typeof value === 'string' ? value.trim() : '';
const allowedGenders = new Set(['M', 'F', 'other']);

// Server-side Supabase access is required here for Auth administration and
// private account records. These credentials must never be sent to the browser.
function serverClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error('Admin API environment variables are not configured.');
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

function adminEmails() {
  // The allowlist is configured as comma-separated email addresses in the server environment.
  return new Set((process.env.ADMIN_EMAILS || '').split(',').map(email => email.trim().toLowerCase()).filter(Boolean));
}

// Every API request verifies the caller's session and then checks the admin allowlist.
async function authenticate(request, client) {
  const authorization = request.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return { error: 'Sign in to access the admin dashboard.', status: 401 };
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return { error: 'Your session is invalid or expired.', status: 401 };
  if (!adminEmails().has((data.user.email || '').toLowerCase())) return { error: 'This account is not an administrator.', status: 403 };
  return { user: data.user };
}

function profilePayload(body, userId, email) {
  // Normalize and validate editable profile fields before writing them to public.users.
  const username = clean(body.username);
  if (!/^[A-Za-z0-9_-]{3,30}$/.test(username)) throw new Error('Username must be 3–30 characters using letters, numbers, underscores, or hyphens.');
  const firstName = clean(body.firstName);
  const lastName = clean(body.lastName);
  const birthdate = clean(body.birthdate);
  if (!firstName || !lastName || !birthdate) throw new Error('First name, last name, and birthdate are required.');
  return {
    user_id: userId,
    email,
    username,
    first_name: firstName,
    last_name: lastName,
    birthdate,
    phone_number: clean(body.phoneNumber) || null,
    gender: allowedGenders.has(body.gender) ? body.gender : null
  };
}

async function listUsers(client) {
  // Auth Admin paginates separately from public.users, so combine both sources by user ID.
  const users = [];
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 100) break;
  }
  const ids = users.map(user => user.id);
  const { data: profiles, error: profileError } = ids.length
    ? await client.from('users').select('user_id, first_name, last_name, birthdate, phone_number, email, gender, username, avatar_url').in('user_id', ids)
    : { data: [], error: null };
  if (profileError) throw profileError;
  const profileById = new Map((profiles || []).map(profile => [profile.user_id, profile]));
  return users.map(user => {
    const profile = profileById.get(user.id) || {};
    return {
      id: user.id,
      email: user.email || profile.email || '',
      username: profile.username || user.user_metadata?.username || '',
      firstName: profile.first_name || '',
      lastName: profile.last_name || '',
      birthdate: profile.birthdate || '',
      phoneNumber: profile.phone_number || '',
      gender: profile.gender || '',
      avatarUrl: profile.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at || null
    };
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function loadOkrMetrics(client) {
  // Fetch all dashboard totals together; any failed source invalidates the metrics response.
  const [likesResult, followsResult, searchesResult, usersResult, reviewsResult] = await Promise.all([
    client.from('review_votes').select('review_id', { count: 'exact', head: true }),
    client.rpc('get_followed_creator_count'),
    client.from('user_search_history').select('search_id', { count: 'exact', head: true }),
    client.from('users').select('user_id', { count: 'exact', head: true }),
    client.from('reviews').select('review_id', { count: 'exact', head: true })
  ]);
  const metricError = [likesResult, followsResult, searchesResult, usersResult, reviewsResult].find(result => result.error)?.error;
  if (metricError) throw metricError;
  return {
    reviewLikes: likesResult.count || 0,
    creatorsFollowed: Number(followsResult.data) || 0,
    searches: searchesResult.count || 0,
    signups: usersResult.count || 0,
    reviews: reviewsResult.count || 0
  };
}

export default async function handler(request, response) {
  // This route supports account reads, creation, profile updates, and deletion only.
  response.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    return json(response, 405, { error: 'Method not allowed.' });
  }

  try {
    const client = serverClient();
    const authentication = await authenticate(request, client);
    if (authentication.error) return json(response, authentication.status, { error: authentication.error });

    if (request.method === 'GET' && request.query?.check === '1') return json(response, 200, { admin: true });
    if (request.method === 'GET') {
      // The account tab and OKR cards share this response to avoid separate page requests.
      const [users, metrics] = await Promise.all([listUsers(client), loadOkrMetrics(client)]);
      return json(response, 200, { users, metrics });
    }

    if (request.method === 'POST') {
      // Create the Auth account first, then its profile; roll the account back if profile setup fails.
      const email = clean(request.body?.email).toLowerCase();
      const password = String(request.body?.password || '');
      if (!/^\S+@\S+\.\S+$/.test(email)) return json(response, 400, { error: 'Enter a valid email address.' });
      if (password.length < 8) return json(response, 400, { error: 'Temporary password must be at least 8 characters.' });
      const { data, error } = await client.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username: clean(request.body?.username) } });
      if (error) throw error;
      try {
        const payload = profilePayload(request.body || {}, data.user.id, email);
        const { error: profileError } = await client.from('users').upsert(payload, { onConflict: 'user_id' });
        if (profileError) throw profileError;
      } catch (profileError) {
        await client.auth.admin.deleteUser(data.user.id);
        throw profileError;
      }
      return json(response, 201, { user: { id: data.user.id }, message: 'User created.' });
    }

    const userId = clean(request.body?.id);
    if (!userId) return json(response, 400, { error: 'A user ID is required.' });

    if (request.method === 'PATCH') {
      // Email remains Auth-managed; this action updates the user's editable profile details.
      const { data: authData, error: authError } = await client.auth.admin.getUserById(userId);
      if (authError || !authData.user) return json(response, 404, { error: 'User not found.' });
      const payload = profilePayload(request.body || {}, userId, authData.user.email || clean(request.body?.email));
      const { error } = await client.from('users').upsert(payload, { onConflict: 'user_id' });
      if (error) throw error;
      await client.auth.admin.updateUserById(userId, { user_metadata: { ...authData.user.user_metadata, username: payload.username } });
      return json(response, 200, { message: 'User updated.' });
    }

    // Prevent an admin from removing the same account currently authorizing this request.
    if (userId === authentication.user.id) return json(response, 400, { error: 'You cannot delete your own administrator account.' });
    const { error } = await client.auth.admin.deleteUser(userId);
    if (error) throw error;
    await client.from('users').delete().eq('user_id', userId);
    return json(response, 200, { message: 'User deleted.' });
  } catch (error) {
    const duplicate = error?.code === '23505' || /already|duplicate|registered|unique/i.test(error?.message || '');
    return json(response, duplicate ? 409 : 500, { error: duplicate ? 'That email or username is already in use.' : error?.message || 'The admin request failed.' });
  }
}
