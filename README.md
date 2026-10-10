# Rate My Creator

A responsive React prototype for discovering, evaluating, and rating content creators. This website is designed to help parents and children make informed choices about YouTube creators and their content. Many content creators on YouTube are known to spread hate and bring inappropriate content to the platform. Users can search for creators, review information and ratings, and give their own review and rate them on specific metrics. These reviews can help families identify creators whose content may be inappropriate and decide whom to avoid. The goal is to help parents feel more confident about who their children is watching on YouTube.

# ERD
![Our website's Entity Relationship Diagram](YTcreatorERD.png)

## Run locally

```bash
npm install
npm run dev
```

Open the local address shown by Vite (normally `http://localhost:5173`).

The site works without database credentials, so contributors can browse the
prototype immediately. To load and submit reviews, create `.env.local` with:

```bash
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Restart `npm run dev` after adding or changing these values. Do not commit
`.env.local`; it is intentionally ignored by Git.

## Prototype features

- Creator discovery, live search, and multi-category filtering
- Detailed creator profiles with scores, audience guidance, and rating breakdowns
- Rating form with required fields and 150-word limit
- Sign-up and login prototypes with validation
- User dashboard and editable account settings
- Issue-reporting modal
- Responsive desktop and mobile layouts

All creator and account data is fictional. Creator profiles are included in the
app, while community reviews can be loaded from Supabase when configured.
