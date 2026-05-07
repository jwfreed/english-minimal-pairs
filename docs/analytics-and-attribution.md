# Soundwise Analytics and Attribution

## Purpose

Lightweight analytics governance for a solo-founder product. Defines what to measure, how to name things, and how to review results without building unnecessary infrastructure.

This document assumes no enterprise analytics stack. Optimize for clarity and low overhead.

## Last Updated

2026-05-07

---

## Analytics Philosophy

Measure what informs decisions. Ignore what doesn't.

At early stage, the highest-value signals are:
1. Are people finding the product through organic channels?
2. Are they downloading and opening it?
3. Are they coming back?

Everything else is secondary until the core loop is confirmed.

Do not let analytics setup become a project. A spreadsheet and App Store Connect are sufficient to start.

---

## KPI Definitions

These are the metrics that matter most at current stage. Do not add more until these are understood.

| KPI | Definition | Where to Measure |
| --- | --- | --- |
| **App Store downloads** | Installs from App Store, any source | App Store Connect |
| **Day-7 retention** | % of users who open the app at least once in the first 7 days | App Store Connect (if enabled) |
| **Sessions per user (7-day)** | Average number of sessions per active user in 7 days | App analytics (when provider is selected) |
| **Community engagement rate** | Ratio of engaged replies (upvotes, follow-up comments) to total replies posted | Manual tracking in Google Sheets |
| **Organic traffic (landing page)** | Visitors to getsoundwise.co from search | GitHub Pages + Google Search Console |
| **Search Console impressions** | Impressions from organic search per URL | Google Search Console |
| **UTM-tagged clicks** | Clicks from external placements with UTM parameters | Google Analytics (when added to landing page) |

---

## Attribution Assumptions

**Important limitation:** App Store attribution is opaque. Apple's SKAdNetwork provides limited, delayed, and aggregated signals. Direct source-to-install attribution is not reliably available without a paid mobile measurement partner (not warranted at this stage).

**Working assumption for early stage:**
- Attribute installs directionally, not precisely.
- Use UTM data on the landing page (pre-install clicks) as a proxy for channel performance.
- Do not over-interpret day-to-day install variance.

**Workable attribution model:**
1. Track landing page visits by source using UTMs.
2. Track App Store referrer data where available (App Store Connect Referrals).
3. Correlate Reddit/YouTube activity spikes with install spikes in App Store Connect.
4. Log community engagement dates in a sheet alongside install-count snapshots.

This is directional, not causal. That is fine for early-stage decisions.

---

## UTM Naming Conventions

Use lowercase, hyphens only (no underscores, no spaces, no camelCase).

### Structure

```
https://getsoundwise.co?utm_source=SOURCE&utm_medium=MEDIUM&utm_campaign=CAMPAIGN&utm_content=CONTENT
```

`utm_content` is optional. Use it when testing multiple variants of the same placement.

### Source (`utm_source`)

| Context | Value |
| --- | --- |
| Reddit | `reddit` |
| YouTube comment | `youtube` |
| Email | `email` |
| Twitter/X | `twitter` |
| Direct / manual share | `direct` |
| App Store product page | `app-store` |

### Medium (`utm_medium`)

| Context | Value |
| --- | --- |
| Organic community reply | `community` |
| Organic search | `organic` (do not add UTMs to organic links; this is set by GA automatically) |
| Email | `email` |
| Paid ad (if ever used) | `cpc` |
| Social post | `social` |

### Campaign (`utm_campaign`)

Use a descriptive slug that identifies the context.

| Context | Example value |
| --- | --- |
| r/EnglishLearning thread | `r-englishlearning` |
| r/LearnJapanese thread | `r-learnjapanese` |
| YouTube ship/sheep video comment | `yt-ship-sheep` |
| IELTS Reddit thread | `r-ielts` |
| General community outreach (no specific thread) | `community-general` |

---

## Campaign Naming Standards

Campaign names should be readable at a glance in a spreadsheet.

Format: `CHANNEL-TOPIC-YYYY-MM`

Examples:
- `reddit-r-l-confusion-2026-05`
- `youtube-vowels-2026-05`
- `reddit-ielts-2026-06`

If you run multiple community replies in the same topic/month, differentiate by thread slug in `utm_content`:
- `utm_content=thread-cant-hear-difference`

---

## Source Naming Standards

For tracking community engagement in a Google Sheet (separate from UTMs):

| Column | Example |
| --- | --- |
| Date | 2026-05-07 |
| Platform | Reddit |
| Channel / Subreddit | r/EnglishLearning |
| Thread title (truncated) | "Why do ship and sheep sound the same?" |
| Reply type | Helpful / Product mention / Link included |
| UTM used (y/n) | y |
| UTM campaign | r-englishlearning |
| Engagement (upvotes, replies, etc.) | +12 upvotes, 1 follow-up |
| Notes | Led with explanation, soft Soundwise mention |

---

## Reddit Attribution Examples

A reply in r/EnglishLearning includes a link:

```
https://getsoundwise.co?utm_source=reddit&utm_medium=community&utm_campaign=r-englishlearning&utm_content=ship-sheep-thread
```

A reply in r/LearnJapanese about /r/ vs /l/:

```
https://getsoundwise.co?utm_source=reddit&utm_medium=community&utm_campaign=r-learnjapanese&utm_content=r-l-confusion-thread
```

A reply in r/IELTS:

```
https://getsoundwise.co?utm_source=reddit&utm_medium=community&utm_campaign=r-ielts
```

**When to include UTM links in Reddit replies:**
Only when a link is contextually appropriate (someone asked for a resource, or the thread is specifically about tools). Do not include UTM links in every reply — it looks promotional and violates community norms.

---

## YouTube Attribution Examples

A comment on a ship/sheep pronunciation video:

```
https://getsoundwise.co?utm_source=youtube&utm_medium=community&utm_campaign=yt-ship-sheep
```

A comment on a general English pronunciation channel:

```
https://getsoundwise.co?utm_source=youtube&utm_medium=community&utm_campaign=yt-pronunciation-general
```

---

## App Store Attribution Limitations

- Apple does not provide referrer URLs for App Store downloads by default.
- App Store Connect > Analytics > Acquisition shows top referrers aggregated, with delay.
- SKAdNetwork conversion values are available but require development instrumentation to use meaningfully.
- At early stage: do not build around App Store attribution. Use landing page click data and install-count snapshots as a proxy.

**Practical approach:**
- Check App Store Connect once per week.
- Note weekly installs, sources, and impressions.
- Log in the same sheet as community engagement.
- Look for correlation patterns over 2–4 week windows, not day-to-day noise.

---

## Event Naming Suggestions

If and when an in-app analytics provider is added, use the following naming conventions. These are suggestions only — do not implement until a provider is selected.

Use snake_case for all event names.

| Event | Name | Notes |
| --- | --- | --- |
| App opened | `app_opened` | With session ID |
| Language category selected | `category_selected` | Include category name |
| Audio played | `audio_played` | Include pair ID, speed tier |
| Answer submitted | `answer_submitted` | Include correct/incorrect, pair ID, response time |
| Mastery tier promoted | `mastery_promoted` | Include group, new tier |
| Placement test completed | `placement_test_completed` | Include recommended tier |
| Settings opened | `settings_opened` | |
| Voice toggled | `voice_toggled` | Include voice name if useful |

Do not log PII. Do not log the content of user inputs.

---

## Weekly Review Process

Keep this to under 15 minutes.

1. **App Store Connect** — note weekly installs, impressions, product page views.
2. **Google Search Console** (once landing page is indexed) — note top queries, impressions, clicks.
3. **Community log (Google Sheet)** — note replies posted, engagement received, links clicked (from UTM data).
4. **One-line summary** — what worked, what did not, one question to answer next week.

Do this every Monday or whenever the week resets. Write the summary in the sheet, not in a separate doc.

---

## Metrics to Ignore Early

These are real metrics that are not useful until the product has reached a stable, growing user base.

| Metric | Reason to ignore early |
| --- | --- |
| DAU/MAU ratio | Meaningful only with 500+ active users |
| Average session length | Requires instrumented analytics; volatile at small N |
| Funnel conversion rate | Not enough data points to be meaningful |
| Social follower count | Vanity — does not correlate with downloads or retention at this stage |
| App Store rating count | Useful for social proof, not for learning signals |
| Reddit post karma | Vanity — focus on reply quality, not score |

---

## Qualitative Signals to Track

These are not quantifiable but are high-signal indicators of whether the product is resonating.

- **Direct questions** in reply threads ("does this app cover [X] language?") — indicates interest and content gap awareness.
- **Unsolicited recommendations** — someone else in a thread mentions Soundwise without being prompted.
- **Teacher and educator inquiries** to `support@getsoundwise.co` — indicates institutional fit.
- **Repeat engagement** from the same Reddit or YouTube account — indicates the product left an impression.
- **Negative feedback** about specific features or gaps — high-signal for product improvement priorities.

Log qualitative signals in a short "signals" column in the weekly review sheet.

---

## Anti-Vanity-Metric Guidance

It is easy to optimize for metrics that feel good but do not correlate with product health.

| Vanity metric | What to measure instead |
| --- | --- |
| Reddit upvotes on a reply | Did the reply generate a follow-up question or a link click? |
| Total app reviews | Day-7 retention and repeat session rate |
| Landing page pageviews | Unique visitors from organic search (quality signal) |
| Number of community replies posted | Engagement rate per reply (quality over volume) |
| Social impressions | Attributed landing page clicks from social sources |

**Rule of thumb:** If a metric can increase while the product is getting worse, it is a vanity metric. Do not optimize for it.
