const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3';

function json(response, status, body) {
  return response.status(status).json(body);
}

async function youtubeList(resource, params, apiKey) {
  const url = new URL(`${YOUTUBE_API}/${resource}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, { headers: { 'x-goog-api-key': apiKey } });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || 'YouTube video data is unavailable.');
  return data;
}

export default async function handler(request, response) {
  if (request.method !== 'GET') return json(response, 405, { error: 'Method not allowed.' });
  const channelId = typeof request.query.channelId === 'string' ? request.query.channelId : '';
  if (!/^UC[A-Za-z0-9_-]{22}$/.test(channelId)) return json(response, 400, { error: 'A valid YouTube channel ID is required.' });
  const apiKey = process.env.YOUTUBE_DATA_API_KEY;
  if (!apiKey) return json(response, 503, { error: 'YouTube video data is not configured.' });

  try {
    const channelData = await youtubeList('channels', { part: 'contentDetails', id: channelId }, apiKey);
    const uploadsId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsId) return json(response, 404, { error: 'This channel has no public uploads playlist.' });

    // Scan up to 1,000 recent public uploads, the maximum pageable playlist window.
    const uploadItems = [];
    let pageToken = '';
    for (let page = 0; page < 20; page += 1) {
      const params = { part: 'snippet,contentDetails', playlistId: uploadsId, maxResults: '50' };
      if (pageToken) params.pageToken = pageToken;
      const data = await youtubeList('playlistItems', params, apiKey);
      uploadItems.push(...(data.items || []));
      pageToken = data.nextPageToken || '';
      if (!pageToken) break;
    }

    const validUploads = uploadItems
      .map(item => ({ id: item.contentDetails?.videoId, snippet: item.snippet }))
      .filter(item => item.id && item.snippet?.title && item.snippet.title !== 'Private video' && item.snippet.title !== 'Deleted video');
    const recent = validUploads.slice(0, 2);
    const viewCounts = new Map();
    for (let index = 0; index < validUploads.length; index += 50) {
      const ids = validUploads.slice(index, index + 50).map(item => item.id).join(',');
      const data = await youtubeList('videos', { part: 'statistics', id: ids, maxResults: '50' }, apiKey);
      for (const item of data.items || []) viewCounts.set(item.id, Number(item.statistics?.viewCount || 0));
    }

    const toVideo = item => ({
      id: item.id,
      title: item.snippet.title,
      publishedAt: item.snippet.publishedAt || null,
      thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || null,
      viewCount: viewCounts.get(item.id) ?? 0,
    });
    const mostPopular = [...validUploads].sort((first, second) => (viewCounts.get(second.id) || 0) - (viewCounts.get(first.id) || 0))[0];
    response.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
    return json(response, 200, { mostPopular: mostPopular ? toVideo(mostPopular) : null, recent: recent.map(toVideo) });
  } catch (error) {
    console.error('Creator video lookup failed:', error);
    return json(response, 502, { error: 'YouTube video data could not be loaded.' });
  }
}
