export function formatReview(review, creatorId, creatorName) {
  return {
    id: review.review_id,
    userId: review.user_id ?? null,
    creatorId,
    createdAt: review.created_at,
    creator: creatorName ?? 'Unknown creator',
    score: review.overall_rating,
    profanity: review.profanity,
    substance: review.substance_use,
    ageLevel: review.age_level,
    usesAi: review.uses_ai,
    text: review.review_text,
    bias: review.bias_text,
    date: new Date(review.created_at).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  };
}

export function generatedUsernameFor(user) {
  const metadata = user?.user_metadata || {};
  const source = metadata.full_name || metadata.name || user?.email?.split('@')[0] || 'creator';
  const base = source.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20).replace(/-+$/g, '') || 'creator';
  const suffix = user.id.replace(/-/g, '').slice(-8).toLowerCase();
  return `${base}-${suffix}`;
}


export function isProfileComplete(profile) {
  return Boolean(profile?.first_name?.trim() && profile?.last_name?.trim() && profile?.birthdate && profile?.username?.trim());
}

export function profileDefaults(user, profile = {}) {
  const metadata = user?.user_metadata || {};
  const metadataName = metadata.full_name || metadata.name || '';
  return {
    firstName: profile.first_name ?? metadata.given_name ?? metadataName.split(/\s+/)[0] ?? '',
    lastName: profile.last_name ?? metadata.family_name ?? metadataName.split(/\s+/).slice(1).join(' '),
    birthdate: profile.birthdate ?? metadata.birthdate ?? metadata.birthday ?? '',
    username: profile.username ?? metadata.username ?? generatedUsernameFor(user),
    phoneNumber: profile.phone_number ?? '',
    gender: ['M', 'F', 'other'].includes(profile.gender) ? profile.gender : '',
  };
}

export function pageFromPathname() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/discover') return 'creators';
  if (path.startsWith('/creators/')) return 'profile';
  if (path === '/privacy') return 'privacy';
  if (path === '/terms') return 'terms';
  if (path === '/login') return 'login';
  if (path === '/signup') return 'signup';
  if (path === '/dashboard') return 'dashboard';
  if (path === '/settings') return 'settings';
  if (path === '/rate') return 'rate';
  if (path === '/complete-profile') return 'complete-profile';
  return 'home';
}

export function selectedIdFromPathname() {
  const match = window.location.pathname.match(/^\/creators\/([^/]+)\/?$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

export function pathForPage(page, id = null) {
  if (page === 'creators') return '/discover';
  if (page === 'profile') return id ? `/creators/${encodeURIComponent(id)}` : '/discover';
  if (page === 'privacy' || page === 'terms') return `/${page}`;
  if (['login', 'signup', 'dashboard', 'settings', 'rate', 'complete-profile'].includes(page)) return `/${page}`;
  return '/';
}
