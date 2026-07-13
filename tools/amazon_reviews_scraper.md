# Amazon Reviews Scraper

This is a manual-cookie scraper for the review listing:

https://www.amazon.com/portal/customer-reviews/B0C86NMRVL/ref=cm_cr_arp_d_viewopt_srt?reviewerType=all_reviews&sortBy=recent&pageNumber=1#reviews-filter-bar

It does not automate Amazon login and it does not store your password. Use it only with an account/session you control and only where Amazon's terms and your use case allow it.

## Setup

Install dependencies:

```powershell
pip install -r requirements.txt
```

Copy the raw `Cookie` request header from your own logged-in Amazon browser session. Do not paste it into chat, commit it, or share it. Either set it as an environment variable:

```powershell
$env:AMAZON_COOKIE = "session-id=...; ubid-main=...; ..."
```

Or save it in a local ignored file and pass `--cookie-file`:

```powershell
python tools\amazon_reviews_scraper.py --cookie-file .\amazon_cookie.txt
```

## Run

JSON Lines output:

```powershell
python tools\amazon_reviews_scraper.py --output .\amazon_reviews_B0C86NMRVL.jsonl
```

CSV output:

```powershell
python tools\amazon_reviews_scraper.py --format csv --output .\amazon_reviews_B0C86NMRVL.csv
```

Useful options:

```powershell
python tools\amazon_reviews_scraper.py --max-pages 50 --delay 5
```

The scraper paginates by changing `pageNumber`, extracts review cards, deduplicates by review ID, and stops when Amazon returns no reviews, duplicate-only pages, or no next-page link. "All reviews" means all review pages Amazon exposes to that logged-in session and filter URL.

## Extracted Fields

- `asin`
- `review_id`
- `author`
- `author_profile_url`
- `rating`
- `title`
- `review_location`
- `review_date`
- `verified_purchase`
- `variant`
- `helpful_votes`
- `body`
- `image_urls`
- `page_url`
- `fetched_at`

If Amazon returns a sign-in page, captcha, or robot-check page, refresh the cookie from your own browser session and increase `--delay`.
