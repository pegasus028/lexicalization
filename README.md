# Lexicalization: new-word tracker

Search a word and see where it is being used (TikTok, Instagram, Facebook, YouTube, X/Threads/Reddit, the rest of the web), then track up to 10 terms automatically on a schedule and watch their uptake on a dashboard.

Built for EN30202 Sociolinguistics ("Make Fetch Happen"), Satriwittaya School English Program. It applies the course's Weekly Uptake Tracker rules: counted uses, observed FUDGE (0 to 10), Evidence Levels, new-meaning share and an instrument check.

- **App:** `https://pegasus028.github.io/lexicalization/` (after GitHub Pages is switched on)
- **Demo mode:** with no backend connected, the app runs on simulated data so every screen can be tried.
- **Setup:** see [SETUP.md](SETUP.md).

## How the search works, and what it costs

TikTok, Instagram and Facebook offer no free public search API, and their pages cannot be scraped reliably or within their terms. The app therefore asks a web-search API for pages **on each platform** that contain the word (`"word" site:tiktok.com`, and so on). This is real-time and cheap, but it sees only public posts that the search engine has indexed: captions and titles, not speech inside videos, and nothing from private accounts. Those uses are added by hand as logged sightings (Review tab).

Kept cheap by design:

| Saving | How |
|---|---|
| 6 queries per term, whatever its forms | Every form (`kettling`, `kettled`, `kettler`) is OR-ed into one query per setting |
| Only new material | Scheduled runs ask for the past week and store only addresses not seen before |
| No AI cost by default | Meaning, marking and ownership are coded by rules in the script |
| Optional AI, tightly limited | If an Anthropic key is added, one small call per term per run codes only the hits the rules left "unclear" |
| Free repeats | The same search within 6 hours is answered from a cache |
| Hard stop | A monthly query cap (default 900) blocks searching when reached |

**Budget for 10 terms, twice a week:** 10 x 6 x 2 = 120 queries a week, about 520 a month. Each search typed by hand adds 6.

Search providers supported (set one key; see SETUP.md). Prices checked 11 Nov 2026 and may change:

- **Serper** (Google results): 2,500 free queries once, then about US$1 per 1,000. Covers roughly 4 to 5 months of this schedule before any payment.
- **Brave Search API**: US$5 per 1,000 queries with US$5 of free credit each month, so about 1,000 free queries a month.
- Google's own Custom Search JSON API is closed to new customers and stops on 1 Jan 2027, so it is not used.

## What counts

A **counted use** carries the new meaning, comes from someone who is not the coiner, a classmate or the teacher, was not asked for, and was not already online at the baseline run. One user adds at most 3 a week.

**Observed FUDGE**, each part 0 to 2 (a class adaptation of Metcalf, 2002):

| | Measured by | 1 | 2 |
|---|---|---|---|
| F Frequency | Counted uses in the last 7 days | 1 to 4 | 5 or more |
| U Unobtrusiveness | Share of those that are unmarked | 25% | 60%, with at least 3 uses |
| D Diversity | Different users in the last 28 days | 2 to 5 | 6 or more, in 2+ settings, with an outside user |
| G Generation | New forms made by other people | 1 | 2 or more |
| E Endurance | Weeks with a counted use, of the last 4 | 2 or 3 | all 4 |

Bands: 7+ Likely, 5 to 6 Fringe, 4 or less Doomed. The score is evidence for the student's analysis, never a mark.

Automatic coding of each hit:

- **Meaning.** New word: any hit that really contains the word is the new meaning. Existing word: "new meaning" if a clue word appears, "other" if an older-meaning word appears, otherwise "unclear" (shown in Review).
- **Who.** Posts from the coiner's project accounts are "owned"; class accounts are "classmate"; everyone else found online is "outside her network". Change this in Review when you know better.
- **Marked.** Defined, quoted, hashtag-only or carrying the project tag.
- The **first run** of a term is its baseline: stored, never counted.

Limits to keep in mind: counts are a comparable index, not a census; one account posting from addresses that hide its name can look like several users; the rules can miscode irony or unusual phrasing, which is why Review exists.

## Files

```
index.html, app.css, app.js   front end (GitHub Pages)
config.js                     the backend URL (empty = demo mode)
js/core.js                    query building, hit coding, scoring (shared with the backend)
js/demo.js                    simulated data and an in-browser stand-in for the backend
gs-src/main.gs                backend source
Code.gs                       GENERATED: paste this into Apps Script (node tools/build.js)
tests/                        core, backend (mocked Apps Script) and browser tests
```

Edit `gs-src/main.gs` or `js/core.js`, never `Code.gs`. Then:

```
npm test                 # builds Code.gs, runs core + backend tests
npm run test:browser     # needs Playwright
```

After any change to `Code.gs`, paste it into Apps Script and deploy a **new version** (Deploy, Manage deployments, edit, New version); saving alone does not update the live web app.

## Privacy and safety

The tracker only reads public search results. It never signs in to a platform, follows, likes, comments or messages. The public dashboard shows scores and counts only; account names and links are visible only after the teacher PIN, and live in the teacher's Google Sheet. Students are never asked to make an account public.
