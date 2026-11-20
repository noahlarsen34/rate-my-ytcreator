import { createClient } from '@supabase/supabase-js';

const json = (response, status, body) => response.status(status).json(body);
const clean = value => typeof value === 'string' ? value.trim() : '';
const ageLevels = new Set(['Under 8', '8+', '13+', '16+', '18+', 'All ages']);
const aiChoices = new Set(['Yes', 'No', 'Unsure']);

function serverClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error('Admin API environment variables are not configured.');
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

function adminEmails() {
  return new Set((process.env.ADMIN_EMAILS || '').split(',').map(email => email.trim().toLowerCase()).filter(Boolean));
}

async function authenticate(request, client) {
  const authorization = request.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return { error: 'Sign in to access the admin dashboard.', status: 401 };
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return { error: 'Your session is invalid or expired.', status: 401 };
  if (!adminEmails().has((data.user.email || '').toLowerCase())) return { error: 'This account is not an administrator.', status: 403 };
  return { user: data.user };
}

async function listReviews(client) {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client.from('reviews')
      .select('review_id, user_id, creator_id, overall_rating, profanity, substance_use, age_level, review_text, bias_text, uses_ai, review_source, seed_author_name, created_at')
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if ((data || []).length < pageSize) break;
  }

  const creatorIds = [...new Set(rows.map(row => row.creator_id).filter(Boolean))];
  const reviewerIds = [...new Set(rows.map(row => row.user_id).filter(Boolean))];
  const [creatorResult, reviewerResult] = await Promise.all([
    creatorIds.length
      ? client.from('content_creators').select('creator_id, first_name, last_name').in('creator_id', creatorIds)
      : Promise.resolve({ data: [], error: null }),
    reviewerIds.length
      ? client.from('users').select('user_id, first_name, last_name, username, email, reviews_public').in('user_id', reviewerIds)
      : Promise.resolve({ data: [], error: null })
  ]);
  if (creatorResult.error) throw creatorResult.error;
  if (reviewerResult.error) throw reviewerResult.error;

  const creators = new Map((creatorResult.data || []).map(row => [String(row.creator_id), row]));
  const reviewers = new Map((reviewerResult.data || []).map(row => [row.user_id, row]));
  return rows.map(row => {
    const creator = creators.get(String(row.creator_id));
    const reviewer = row.user_id ? reviewers.get(row.user_id) : null;
    const username = clean(reviewer?.username);
    const fullName = [clean(reviewer?.first_name), clean(reviewer?.last_name)].filter(Boolean).join(' ');
    return {
      id: String(row.review_id),
      creatorId: row.creator_id,
      creatorName: [clean(creator?.first_name), clean(creator?.last_name)].filter(Boolean).join(' ') || 'Unknown creator',
      reviewerUserId: row.user_id || null,
      reviewerProfileVisible: Boolean(reviewer) && reviewer.reviews_public !== false,
      reviewerName: row.review_source === 'synthetic_demo' ? row.seed_author_name || 'Demo reviewer' : fullName || (username ? `@${username}` : 'Unknown user'),
      reviewerDetail: row.review_source === 'synthetic_demo' ? 'Synthetic demo review' : username ? `@${username}` : clean(reviewer?.email) || 'Account profile unavailable',
      overallRating: Number(row.overall_rating),
      profanity: row.profanity === null ? null : Number(row.profanity),
      substanceUse: row.substance_use === null ? null : Number(row.substance_use),
      ageLevel: row.age_level || '',
      reviewText: row.review_text || '',
      biasText: row.bias_text || '',
      usesAi: row.uses_ai || '',
      reviewSource: row.review_source || 'community',
      createdAt: row.created_at
    };
  });
}

async function listCreators(client) {
  const creators = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client.from('content_creators')
      .select('creator_id, first_name, last_name')
      .order('first_name', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    creators.push(...(data || []).map(row => ({
      id: String(row.creator_id),
      name: [clean(row.first_name), clean(row.last_name)].filter(Boolean).join(' ') || 'YouTube creator'
    })));
    if ((data || []).length < pageSize) break;
  }
  return creators;
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    return json(response, 405, { error: 'Method not allowed.' });
  }

  try {
    const client = serverClient();
    const authentication = await authenticate(request, client);
    if (authentication.error) return json(response, authentication.status, { error: authentication.error });

    if (request.method === 'GET') {
      const [reviews, creators] = await Promise.all([listReviews(client), listCreators(client)]);
      return json(response, 200, { reviews, creators });
    }

    if (request.method === 'POST') {
      const userId = clean(request.body?.userId);
      const creatorId = clean(String(request.body?.creatorId || ''));
      const rating = Number(request.body?.overallRating);
      const reviewText = clean(request.body?.reviewText);
      const ageLevel = clean(request.body?.ageLevel);
      const profanity = Number(request.body?.profanity);
      const substanceUse = Number(request.body?.substanceUse);
      const usesAi = clean(request.body?.usesAi);
      const biasText = clean(request.body?.biasText);

      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
        return json(response, 400, { error: 'Select a valid account for this review.' });
      }
      if (!/^\d+$/.test(creatorId)) return json(response, 400, { error: 'Select a valid creator for this review.' });
      if (!Number.isFinite(rating) || rating < 0.5 || rating > 5 || Math.round(rating * 2) !== rating * 2) {
        return json(response, 400, { error: 'Overall rating must be between 0.5 and 5 in half-star increments.' });
      }
      if (!reviewText || reviewText.length > 10000) return json(response, 400, { error: 'Review description is required and must be 10,000 characters or fewer.' });
      if (reviewText.split(/\s+/).filter(Boolean).length > 150) return json(response, 400, { error: 'Review descriptions must be 150 words or fewer.' });
      if (!ageLevels.has(ageLevel)) return json(response, 400, { error: 'Select a valid recommended age level.' });
      if (!Number.isInteger(profanity) || profanity < 1 || profanity > 5 || !Number.isInteger(substanceUse) || substanceUse < 1 || substanceUse > 5) {
        return json(response, 400, { error: 'Select valid profanity and substance-use ratings.' });
      }
      if (!aiChoices.has(usesAi)) return json(response, 400, { error: 'Select whether the creator uses AI.' });

      const { data: existingReview, error: existingError } = await client.from('reviews').select('review_id')
        .eq('user_id', userId).eq('creator_id', creatorId).limit(1).maybeSingle();
      if (existingError) throw existingError;
      if (existingReview) return json(response, 409, { error: 'That user already has a review for this creator.' });

      const { data, error } = await client.from('reviews').insert({
        user_id: userId,
        creator_id: creatorId,
        overall_rating: rating,
        profanity,
        substance_use: substanceUse,
        age_level: ageLevel,
        review_text: reviewText,
        bias_text: biasText,
        uses_ai: usesAi
      }).select('review_id').single();
      if (error) {
        if (error.code === '23505') return json(response, 409, { error: 'That user already has a review for this creator.' });
        throw error;
      }
      return json(response, 201, { id: String(data.review_id), message: 'Review created.' });
    }

    const reviewId = clean(String(request.body?.id || ''));
    if (!/^\d+$/.test(reviewId)) return json(response, 400, { error: 'A valid review ID is required.' });

    if (request.method === 'PATCH') {
      const rating = Number(request.body?.overallRating);
      const profanity = request.body?.profanity === null || request.body?.profanity === '' ? null : Number(request.body?.profanity);
      const substanceUse = request.body?.substanceUse === null || request.body?.substanceUse === '' ? null : Number(request.body?.substanceUse);
      const ageLevel = clean(request.body?.ageLevel);
      const reviewText = clean(request.body?.reviewText);
      const biasText = clean(request.body?.biasText);
      const usesAi = clean(request.body?.usesAi) || null;
      if (!Number.isFinite(rating) || rating < 0.5 || rating > 5 || Math.round(rating * 2) !== rating * 2) {
        return json(response, 400, { error: 'Overall rating must be between 0.5 and 5 in half-star increments.' });
      }
      if (!reviewText || reviewText.length > 10000) return json(response, 400, { error: 'Review description is required and must be 10,000 characters or fewer.' });
      if (profanity !== null && (!Number.isInteger(profanity) || profanity < 0 || profanity > 5)) return json(response, 400, { error: 'Profanity frequency must be between 0 and 5, or not evaluated.' });
      if (substanceUse !== null && (!Number.isInteger(substanceUse) || substanceUse < 0 || substanceUse > 5)) return json(response, 400, { error: 'Substance use frequency must be between 0 and 5, or not evaluated.' });
      if (!ageLevels.has(ageLevel)) return json(response, 400, { error: 'Select a valid recommended age level.' });
      if (biasText.length > 10000) return json(response, 400, { error: 'Sponsors or viewpoints must be 10,000 characters or fewer.' });
      if (usesAi !== null && !aiChoices.has(usesAi)) return json(response, 400, { error: 'Select a valid AI use value.' });
      const { data, error } = await client.from('reviews').update({
        overall_rating: rating,
        profanity,
        substance_use: substanceUse,
        age_level: ageLevel,
        review_text: reviewText,
        bias_text: biasText,
        uses_ai: usesAi
      })
        .eq('review_id', reviewId).select('review_id').maybeSingle();
      if (error) throw error;
      if (!data) return json(response, 404, { error: 'Review not found.' });
      return json(response, 200, { message: 'Review updated.' });
    }

    const { data: existingReview, error: lookupError } = await client.from('reviews').select('review_id').eq('review_id', reviewId).maybeSingle();
    if (lookupError) throw lookupError;
    if (!existingReview) return json(response, 404, { error: 'Review not found.' });
    const { error: votesError } = await client.from('review_votes').delete().eq('review_id', reviewId);
    if (votesError) throw votesError;
    const { data, error } = await client.from('reviews').delete().eq('review_id', reviewId).select('review_id').maybeSingle();
    if (error) throw error;
    if (!data) return json(response, 404, { error: 'Review not found.' });
    return json(response, 200, { message: 'Review deleted.' });
  } catch (error) {
    return json(response, 500, { error: error?.message || 'The review admin request failed.' });
  }
}
