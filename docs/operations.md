# Soundwise Operations Reference

## Purpose

This document is the early operational source of truth for Soundwise infrastructure, repositories, community operations, and automation direction.

It is intentionally lightweight. Use it to reduce coordination loss before operational systems expand.

## Last Updated

2026-05-07

## Do Not Store Here

This document is not a secrets store.

Secrets, API keys, passwords, tokens, forwarding destinations, private account recovery details, and production credentials must never be committed to this repository.

## Core Products

| Product | Notes |
| --- | --- |
| Soundwise iOS app | Primary English minimal pairs application. |
| Soundwise landing page | Public marketing and product information site. |

## Repositories

| Repository | Purpose |
| --- | --- |
| `jwfreed/english-minimal-pairs` | Primary iOS application repository. |
| `jwfreed/english-minimal-pairs-landing` | Landing page repository. |

## Public URLs

| URL | Purpose |
| --- | --- |
| `https://getsoundwise.co` | Production landing page. |
| `https://apps.apple.com/us/app/soundwise-english/id6753882308` | App Store listing. |

## Hosting & Infrastructure

| Area | Current Decision | Notes |
| --- | --- | --- |
| Landing page hosting | GitHub Pages | Hosts `https://getsoundwise.co`. |
| iOS app distribution | App Store | Public listing is linked above. |
| Analytics | TBD | Do not add a provider here until selected. |
| Backend services | TBD | No backend service is documented yet. |

## Email Infrastructure

| Area | Current Decision |
| --- | --- |
| Email provider | ImprovMX |

Operational aliases:

| Alias | Purpose |
| --- | --- |
| `support@getsoundwise.co` | User support. |
| `reddit@getsoundwise.co` | Reddit-related operations. |
| `youtube@getsoundwise.co` | YouTube-related operations. |
| `hello@getsoundwise.co` | General contact. |

Forwarding destinations are intentionally not documented here.

## Community Accounts

| Channel | Direction | Notes |
| --- | --- | --- |
| Reddit | Founder/operator account | Use a human account style, not an anonymous brand account. |
| Reddit username | `JonFromSoundwise` likely | Confirm final username before relying on it operationally. |
| YouTube | TBD | Community engagement should be human-reviewed. |

## Community Monitoring Direction

Community monitoring should operate as a human-approved opportunity engine.

AI may:

- Monitor relevant communities and channels.
- Score opportunities for fit and usefulness.
- Draft possible replies.
- Summarize threads, comments, and creator context.

AI must not:

- Auto-post to Reddit.
- Auto-comment on YouTube.
- Bypass human review for public engagement.

## Planned Automation Stack

These are planned components only. Do not treat them as implemented until code, credentials, and operations are explicitly added.

| Function | Planned Tool |
| --- | --- |
| Reddit monitoring | PRAW |
| YouTube monitoring | YouTube Data API |
| Scheduling | GitHub Actions |
| Queue/storage | Google Sheets initially |
| AI drafting | OpenAI API or equivalent |

## Environment Variables (names only)

Names are placeholders until implementation exists. Do not commit values.

| Name | Purpose |
| --- | --- |
| `REDDIT_CLIENT_ID` | Planned Reddit API client identifier. |
| `REDDIT_CLIENT_SECRET` | Planned Reddit API client secret. |
| `REDDIT_USER_AGENT` | Planned Reddit API user agent. |
| `YOUTUBE_API_KEY` | Planned YouTube Data API access. |
| `OPENAI_API_KEY` | Planned AI drafting access. |
| `GOOGLE_SHEETS_ID` | Planned opportunity queue/storage target. |

## Operational Principles

- Help first.
- Teach before mentioning Soundwise.
- Focus on listening and perception, not "accent fixing."
- Mention Soundwise only when contextually relevant.
- Avoid repetitive promotional replies.
- Avoid creator hijacking.
- Keep public engagement human-reviewed.

## Open Questions

- What is the final Reddit username?
- What YouTube account, if any, will be used for community engagement?
- What Google Sheet will hold the initial opportunity queue?
- What review process should approve drafted community replies?
- What analytics provider, if any, will be selected?
- Will Soundwise need backend services beyond the iOS app and landing page?
