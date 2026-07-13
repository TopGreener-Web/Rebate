"""Extract Amazon review pages using a manually supplied logged-in cookie.

This script does not automate login. Provide the Cookie request header from
your own logged-in browser session with the AMAZON_COOKIE environment variable
or a local cookie file that is not committed.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import random
import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import requests
from bs4 import BeautifulSoup, Tag


DEFAULT_URL = (
    "https://www.amazon.com/portal/customer-reviews/B0C86NMRVL/"
    "ref=cm_cr_arp_d_viewopt_srt?reviewerType=all_reviews&sortBy=recent&pageNumber=1"
)


@dataclass(frozen=True)
class ScrapeConfig:
    url: str
    output: Path
    output_format: str
    cookie: str
    max_pages: int
    start_page: int
    delay_seconds: float
    timeout_seconds: float


class AmazonChallengeError(RuntimeError):
    """Raised when Amazon returns a sign-in, robot check, or blocked page."""


def normalize_space(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def extract_asin(url: str) -> str | None:
    match = re.search(r"/(?:portal/)?customer-reviews/([A-Z0-9]{10})", url)
    if match:
        return match.group(1)

    match = re.search(r"/product-reviews/([A-Z0-9]{10})", url)
    return match.group(1) if match else None


def set_page_number(url: str, page_number: int) -> str:
    parsed = urlparse(url)
    query_items = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query_items["pageNumber"] = str(page_number)
    return urlunparse(parsed._replace(query=urlencode(query_items), fragment=""))


def load_cookie(cookie_env: str, cookie_file: Path | None) -> str:
    if cookie_file:
        cookie = cookie_file.read_text(encoding="utf-8").strip()
        if cookie:
            return cookie

    cookie = os.environ.get(cookie_env, "").strip()
    if cookie:
        return cookie

    raise SystemExit(
        f"Missing cookie. Set {cookie_env} to the raw Cookie header, or pass --cookie-file."
    )


def make_session(cookie: str) -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Cache-Control": "no-cache",
            "Cookie": cookie,
            "Pragma": "no-cache",
            "Referer": "https://www.amazon.com/",
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/125.0.0.0 Safari/537.36"
            ),
        }
    )
    return session


def fetch_page(session: requests.Session, url: str, timeout: float) -> str:
    response = session.get(url, timeout=timeout)
    response.raise_for_status()
    html = response.text
    lower_html = html.lower()

    challenge_markers = (
        "enter the characters you see below",
        "robot check",
        "/errors/validatecaptcha",
        "sign in",
        "ap/signin",
    )
    if any(marker in lower_html for marker in challenge_markers) and (
        "data-hook=\"review\"" not in lower_html
    ):
        raise AmazonChallengeError(
            "Amazon returned a sign-in, captcha, or blocked page. Refresh the cookie "
            "from your own browser session and slow the request rate."
        )

    return html


def first_text(root: Tag, selector: str) -> str:
    element = root.select_one(selector)
    return normalize_space(element.get_text(" ", strip=True)) if element else ""


def first_attr(root: Tag, selector: str, attr: str) -> str:
    element = root.select_one(selector)
    if not element:
        return ""
    value = element.get(attr)
    return normalize_space(str(value)) if value else ""


def extract_rating(review: Tag) -> float | None:
    selectors = (
        '[data-hook="review-star-rating"] .a-icon-alt',
        '[data-hook="cmps-review-star-rating"] .a-icon-alt',
        '[data-hook="review-title"] .a-icon-alt',
        ".review-rating .a-icon-alt",
    )
    rating_text = ""
    for selector in selectors:
        rating_text = first_text(review, selector)
        if rating_text:
            break

    match = re.search(r"([0-5](?:\.\d+)?)\s*out of\s*5", rating_text, flags=re.I)
    return float(match.group(1)) if match else None


def extract_title(review: Tag) -> str:
    title = review.select_one('[data-hook="review-title"]')
    if not title:
        return ""

    span_texts = [
        normalize_space(span.get_text(" ", strip=True))
        for span in title.select("span")
        if normalize_space(span.get_text(" ", strip=True))
    ]
    cleaned = [text for text in span_texts if "out of 5 stars" not in text.lower()]
    if cleaned:
        return cleaned[-1]

    raw_title = normalize_space(title.get_text(" ", strip=True))
    return normalize_space(re.sub(r"^[0-5](?:\.\d+)? out of 5 stars", "", raw_title, flags=re.I))


def extract_review_date(raw_date: str) -> tuple[str, str]:
    raw_date = normalize_space(raw_date)
    match = re.match(r"Reviewed in (.+?) on (.+)", raw_date)
    if not match:
        return "", raw_date
    return normalize_space(match.group(1)), normalize_space(match.group(2))


def extract_helpful_votes(raw_helpful: str) -> int:
    raw_helpful = raw_helpful.lower()
    if raw_helpful.startswith("one person"):
        return 1

    match = re.search(r"([\d,]+)\s+people", raw_helpful)
    return int(match.group(1).replace(",", "")) if match else 0


def extract_review_id(review: Tag) -> str:
    for attr in ("id", "data-review-id", "data-csa-c-id"):
        value = review.get(attr)
        if value:
            return normalize_space(str(value))
    return ""


def fallback_review_key(review: dict[str, object]) -> str:
    parts = [
        str(review.get("author", "")),
        str(review.get("title", "")),
        str(review.get("review_date", "")),
        str(review.get("body", ""))[:120],
    ]
    return "|".join(parts)


def parse_reviews(html: str, page_url: str, asin: str | None) -> list[dict[str, object]]:
    soup = BeautifulSoup(html, "html.parser")
    fetched_at = datetime.now(timezone.utc).isoformat()
    reviews: list[dict[str, object]] = []

    for review in soup.select('[data-hook="review"]'):
        raw_date = first_text(review, '[data-hook="review-date"]')
        country, review_date = extract_review_date(raw_date)
        raw_helpful = first_text(review, '[data-hook="helpful-vote-statement"]')
        image_urls = [
            normalize_space(src)
            for image in review.select(".review-image-tile-section img, img.review-image-tile")
            for src in [image.get("data-src") or image.get("src")]
            if src
        ]

        reviews.append(
            {
                "asin": asin or "",
                "review_id": extract_review_id(review),
                "author": first_text(review, ".a-profile-name"),
                "author_profile_url": first_attr(review, "a.a-profile", "href"),
                "rating": extract_rating(review),
                "title": extract_title(review),
                "review_location": country,
                "review_date": review_date,
                "review_date_raw": raw_date,
                "verified_purchase": bool(review.select_one('[data-hook="avp-badge"]')),
                "variant": first_text(review, '[data-hook="format-strip"]'),
                "helpful_votes": extract_helpful_votes(raw_helpful),
                "helpful_votes_raw": raw_helpful,
                "body": first_text(review, '[data-hook="review-body"]'),
                "image_urls": image_urls,
                "page_url": page_url,
                "fetched_at": fetched_at,
            }
        )

    return reviews


def has_next_page(html: str) -> bool:
    soup = BeautifulSoup(html, "html.parser")
    next_item = soup.select_one("li.a-last")
    if not next_item:
        return False
    return bool(next_item.select_one("a")) and "a-disabled" not in next_item.get("class", [])


def open_writer(path: Path, output_format: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    handle = path.open("w", encoding="utf-8", newline="")
    if output_format == "jsonl":
        return handle, None

    fieldnames = [
        "asin",
        "review_id",
        "author",
        "author_profile_url",
        "rating",
        "title",
        "review_location",
        "review_date",
        "review_date_raw",
        "verified_purchase",
        "variant",
        "helpful_votes",
        "helpful_votes_raw",
        "body",
        "image_urls",
        "page_url",
        "fetched_at",
    ]
    writer = csv.DictWriter(handle, fieldnames=fieldnames)
    writer.writeheader()
    return handle, writer


def write_reviews(handle, csv_writer, output_format: str, reviews: Iterable[dict[str, object]]) -> None:
    for review in reviews:
        row = dict(review)
        if output_format == "jsonl":
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")
            continue

        row["image_urls"] = json.dumps(row["image_urls"], ensure_ascii=False)
        csv_writer.writerow(row)


def scrape(config: ScrapeConfig) -> int:
    session = make_session(config.cookie)
    asin = extract_asin(config.url)
    seen_keys: set[str] = set()
    written = 0

    handle, csv_writer = open_writer(config.output, config.output_format)
    with handle:
        for page_number in range(config.start_page, config.start_page + config.max_pages):
            page_url = set_page_number(config.url, page_number)
            html = fetch_page(session, page_url, config.timeout_seconds)
            reviews = parse_reviews(html, page_url, asin)
            if not reviews:
                print(f"page {page_number}: no reviews found; stopping", file=sys.stderr)
                break

            new_reviews = []
            for review in reviews:
                review_key = str(review.get("review_id")) or fallback_review_key(review)
                if review_key in seen_keys:
                    continue
                seen_keys.add(review_key)
                new_reviews.append(review)

            if not new_reviews:
                print(f"page {page_number}: only duplicate reviews found; stopping", file=sys.stderr)
                break

            write_reviews(handle, csv_writer, config.output_format, new_reviews)
            written += len(new_reviews)
            print(
                f"page {page_number}: wrote {len(new_reviews)} reviews "
                f"({written} total)",
                file=sys.stderr,
            )

            if not has_next_page(html):
                print(f"page {page_number}: no next-page link; stopping", file=sys.stderr)
                break

            sleep_for = config.delay_seconds + random.uniform(0, config.delay_seconds * 0.35)
            time.sleep(sleep_for)

    return written


def parse_args(argv: list[str]) -> ScrapeConfig:
    parser = argparse.ArgumentParser(description="Extract Amazon reviews with a manual cookie.")
    parser.add_argument("--url", default=DEFAULT_URL, help="Amazon review listing URL.")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("amazon_reviews_B0C86NMRVL.jsonl"),
        help="Output file path.",
    )
    parser.add_argument("--format", choices=("jsonl", "csv"), default="jsonl")
    parser.add_argument("--cookie-env", default="AMAZON_COOKIE")
    parser.add_argument("--cookie-file", type=Path)
    parser.add_argument("--max-pages", type=int, default=500)
    parser.add_argument("--start-page", type=int, default=1)
    parser.add_argument("--delay", type=float, default=3.0, help="Base delay between pages.")
    parser.add_argument("--timeout", type=float, default=30.0, help="HTTP timeout per page.")
    args = parser.parse_args(argv)

    if args.max_pages < 1:
        raise SystemExit("--max-pages must be at least 1")
    if args.start_page < 1:
        raise SystemExit("--start-page must be at least 1")
    if args.delay < 0:
        raise SystemExit("--delay cannot be negative")

    return ScrapeConfig(
        url=args.url,
        output=args.output,
        output_format=args.format,
        cookie=load_cookie(args.cookie_env, args.cookie_file),
        max_pages=args.max_pages,
        start_page=args.start_page,
        delay_seconds=args.delay,
        timeout_seconds=args.timeout,
    )


def main(argv: list[str] | None = None) -> int:
    config = parse_args(argv or sys.argv[1:])
    try:
        written = scrape(config)
    except AmazonChallengeError as exc:
        print(f"Blocked: {exc}", file=sys.stderr)
        return 2
    except requests.HTTPError as exc:
        print(f"HTTP error: {exc}", file=sys.stderr)
        return 3

    print(f"Done. Wrote {written} reviews to {config.output}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
