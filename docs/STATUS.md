# Status — Tue 20 Oct 2026

## Done
- **Mon 19 Oct:** core MVP wireframes agreed; design system signed off (D14.11) with 10 components; docs updated (D8.6 why-sell line, D8.7 one reasoning view, D16.9 rank lookup in the core).
- **Accounts:** GitHub repo created, Supabase project created, Vercel account ready.
- **Domain (D11.12):** `finalball.manavpkothari.dev`. Root domain `manavpkothari.dev` verified in Google Search Console; DNS is on Vercel. The subdomain is not attached to a Vercel project yet.
- **Google OAuth (D11.12):** External, Testing, family added as test users, scopes openid/email/profile only, redirect to the Supabase callback.
- **Supabase auth:** Google provider on; Site URL `https://finalball.manavpkothari.dev`; redirect URLs `http://localhost:3000/**` and `https://finalball.manavpkothari.dev/**`.

## Not yet
- Sign-in has never been tested (no app yet).
- Google app not published to production. Before publishing: landing page and `/privacy` live on the subdomain (brand verification needs them).
- Anthropic API key with a spend limit (needed Thursday for the agent).

## Owner's test data for the lookup (fill in)
| Who | Team ID | Country | Country rank today | Team name |
|---|---|---|---|---|
| Manav | | | | |
| | | | | |
| | | | | |

## Open items (non-blocking)
- FPL app tab names in the guide panels ("Leagues", "Points", "Pick Team") to confirm during UI work.
- What weak spots are ranked by (shown to users in "Why sell"): decide Thursday.
