# WorkSteady blog automation

The blog is stored in MongoDB, published by GitHub Actions, exposed through the
Express API, and server-rendered by Next.js. Generated files are not committed
for each article.

## Required configuration

Revoke any key that has been pasted into chat, source code, logs, or an issue.
Create replacement credentials and store them only in the deployment provider
and GitHub repository settings.

### GitHub Actions secrets

- `MONGODB_URI`: MongoDB connection string with read/write access to the blog collections.
- `GROQ_API_KEY`: Groq key used by the daily workflow and as the weekly fallback.
- `GROQ_WEEKLY_API_KEY`: optional separate Groq key for weekly research.
- `REPLICATE_API_TOKEN`: Replicate token used to generate featured images.
- `CLOUDINARY_URL`: signed Cloudinary URL in `cloudinary://key:secret@cloud` format.
- `BLOG_REVALIDATE_SECRET`: long random value shared with the Next.js deployment.

### GitHub Actions variables

- `SITE_BASE_URL`: production origin; default is `https://worksteady.app`.
- `MONGODB_DB`: optional database name when it is not included in `MONGODB_URI`.
- `GROQ_RESEARCH_MODEL`: defaults to `groq/compound` for cited web research.
- `GROQ_CONTENT_MODEL`: defaults to `openai/gpt-oss-120b`.
- `GROQ_FALLBACK_MODEL`: defaults to `openai/gpt-oss-20b`.
- `MAX_KEYWORD_OPPORTUNITIES`: maximum weekly suggestions; capped at 8 to keep research requests reliable.
- `BLOG_REVALIDATE_URL`: defaults to the production revalidation endpoint.

Configure the same applicable values in the backend deployment. Configure
`BACKEND_URL`, `NEXT_PUBLIC_BACKEND_URL`, `SITE_BASE_URL`, and
`BLOG_REVALIDATE_SECRET` in the Next.js deployment.

None of these values may use a `NEXT_PUBLIC_` name except the already-public
backend origin.

## Workflow behavior

`Research WorkSteady blog opportunities` runs Monday at 09:00 UTC. It compares
research with published posts and queued work, then stores only approved,
business-relevant opportunities. Its opportunity scores are editorial
heuristics, not claimed search-volume measurements.

`Publish WorkSteady blog posts` runs daily at 13:00 UTC. It claims no more than
three opportunities. Every candidate must pass the deterministic and AI
editorial checks and have a persisted featured image before its status becomes
`published`. Zero published posts is a valid successful run.

Both workflows can be started manually in dry-run mode. Dry runs call external
services but do not publish content.

## Local verification

From `backend/`:

```sh
npm run test:blog
DRY_RUN=1 CONTENT_COUNT=1 npm run agent:daily
DRY_RUN=1 npm run agent:weekly
```

From the repository root:

```sh
npm run build
```

Use replacement development credentials in `.env.local`; never copy production
keys into tracked files.

## Publishing and recovery

- Failed validation leaves an opportunity in `needs_review`; it is not visible publicly.
- Updating an existing article preserves its slug and stores a revision first.
- Previous slugs permanently redirect to the current canonical URL.
- Publication triggers the protected Next.js revalidation endpoint. If that
  request fails, pages refresh on their normal cache interval.
- To stop automation without deleting data, disable both workflows in GitHub.

## Search setup after deployment

1. Verify `https://worksteady.app` in Google Search Console using the production owner account.
2. Submit `https://worksteady.app/sitemap.xml`.
3. Test several deployed articles with Google's Rich Results Test and URL Inspection.
4. Confirm draft, authentication, admin, API, and private application pages are absent from the sitemap.
5. Monitor indexing, page experience, queries, impressions, clicks, positions, and crawl errors.

Search Console ownership and sitemap submission cannot be completed from this
repository without access to the production Google account.
