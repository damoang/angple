#!/usr/bin/env python3
"""Compare bug board posts with Google Spreadsheet to find untracked bugs."""

import json
import subprocess
import re
import math
from datetime import datetime

import gspread

# --- Step 1: Get spreadsheet data ---
print("=" * 80)
print("STEP 1: Reading Google Spreadsheet")
print("=" * 80)

gc = gspread.service_account(filename="/home/angple/.config/gspread/service_account.json")
spreadsheet = gc.open_by_url(
    "https://docs.google.com/spreadsheets/d/1zqUv_vKVqEeZhxpxrw2OVIUmUEAS8qONUUPVpNthYOU/edit"
)

tracked_wr_ids = set()
sheet_details = {}

for ws in spreadsheet.worksheets():
    title = ws.title
    try:
        all_values = ws.get_all_values()
    except Exception as e:
        print(f"  Sheet '{title}': Error reading - {e}")
        continue

    sheet_wr_ids = set()
    header = all_values[0] if all_values else []
    print(f"\n  Sheet '{title}': {len(all_values)} rows, headers: {header[:10]}")

    # Find wr_id-like columns
    wr_id_cols = []
    for i, h in enumerate(header):
        h_lower = h.strip().lower()
        if h_lower in ('wr_id', 'id', '글번호', '게시글id', '게시글 id', 'post_id', '번호'):
            wr_id_cols.append(i)

    for row_idx, row in enumerate(all_values):
        if row_idx == 0:
            continue
        for col_idx, cell in enumerate(row):
            cell = str(cell).strip()
            if col_idx in wr_id_cols and cell.isdigit() and 1 <= int(cell) <= 999999:
                sheet_wr_ids.add(int(cell))
            # Check for wr_id references in any cell
            matches = re.findall(r'(?:wr_id[=:]?\s*|#|/bug/)(\d{3,6})', cell)
            for m in matches:
                if 1 <= int(m) <= 999999:
                    sheet_wr_ids.add(int(m))

    if sheet_wr_ids:
        print(f"    Found {len(sheet_wr_ids)} wr_ids: {sorted(sheet_wr_ids)[:20]}{'...' if len(sheet_wr_ids) > 20 else ''}")
    tracked_wr_ids.update(sheet_wr_ids)
    sheet_details[title] = sheet_wr_ids

print(f"\n  TOTAL tracked wr_ids across all sheets: {len(tracked_wr_ids)}")

# --- Step 2: Get bug board posts from API ---
print("\n" + "=" * 80)
print("STEP 2: Fetching bug board posts from API")
print("=" * 80)

# API uses 'limit' param (max 20), 'page' for pagination, total=2657
# We only need non-완료 posts. Let's fetch all and filter.
# But 2657 posts / 20 per page = 133 pages. Let's be smart about it.
# Actually, let's check if there's a category filter.

# First test category filter
test = subprocess.run(
    ["curl", "-s", "http://localhost:8090/api/v1/boards/bug/posts?limit=1&page=1&category=%EB%B2%84%EA%B7%B8"],
    capture_output=True, text=True
)
test_data = json.loads(test.stdout)
test_total = test_data.get("meta", {}).get("total", 0)
print(f"  Category '버그' filter test: total={test_total}")

# Fetch posts for each relevant category
CATEGORIES_TO_FETCH = ["버그", "기능제안", "요청", "진행중"]
# Also fetch uncategorized
all_posts = []

for cat in CATEGORIES_TO_FETCH:
    page = 1
    cat_posts = []
    while True:
        result = subprocess.run(
            ["curl", "-s", f"http://localhost:8090/api/v1/boards/bug/posts?limit=20&page={page}&category={cat}"],
            capture_output=True, text=True
        )
        try:
            data = json.loads(result.stdout)
        except json.JSONDecodeError:
            break

        posts = data.get("data", [])
        meta = data.get("meta", {})
        total = meta.get("total", 0)

        if not posts:
            break

        cat_posts.extend(posts)

        if len(cat_posts) >= total or len(posts) < 20:
            break
        page += 1

    print(f"  Category '{cat}': {len(cat_posts)} posts (total in API: {total})")
    all_posts.extend(cat_posts)

# Also try empty category
result = subprocess.run(
    ["curl", "-s", "http://localhost:8090/api/v1/boards/bug/posts?limit=20&page=1&category="],
    capture_output=True, text=True
)
data = json.loads(result.stdout)
uncategorized_total = data.get("meta", {}).get("total", 0)
print(f"  Empty category filter: total={uncategorized_total}")

# Also fetch without category filter to compare
result = subprocess.run(
    ["curl", "-s", "http://localhost:8090/api/v1/boards/bug/posts?limit=1&page=1"],
    capture_output=True, text=True
)
data = json.loads(result.stdout)
overall_total = data.get("meta", {}).get("total", 0)
print(f"  Overall total (no filter): {overall_total}")

print(f"\n  Total relevant posts fetched: {len(all_posts)}")

# Analyze categories
if all_posts:
    categories = {}
    for p in all_posts:
        cat = p.get("category", "")
        if cat is None:
            cat = ""
        categories[cat] = categories.get(cat, 0) + 1
    print(f"  Fetched categories breakdown: {dict(sorted(categories.items(), key=lambda x: -x[1]))}")

# --- Step 3: Cross-reference ---
print("\n" + "=" * 80)
print("STEP 3: Cross-referencing with spreadsheet")
print("=" * 80)

untracked = []
tracked = []
for p in all_posts:
    wr_id = p.get("id")
    if wr_id is None:
        continue
    wr_id = int(wr_id)
    if wr_id in tracked_wr_ids:
        tracked.append(p)
    else:
        untracked.append(p)

print(f"  Tracked (in spreadsheet): {len(tracked)}")
print(f"  Untracked (NOT in spreadsheet): {len(untracked)}")
if tracked:
    print(f"  Tracked IDs: {sorted([int(p.get('id')) for p in tracked])}")

# --- Step 4: Output ---
print("\n" + "=" * 80)
print("STEP 4: UNTRACKED BUG POSTS")
print("=" * 80)

def get_date(p):
    d = p.get("created_at", "")
    if d is None:
        d = ""
    return str(d)

untracked.sort(key=get_date, reverse=True)

# Group by category
by_category = {}
for p in untracked:
    cat = p.get("category", "")
    if cat is None or str(cat).strip() == "":
        cat = "(미분류)"
    cat = str(cat).strip()
    by_category.setdefault(cat, []).append(p)

cutoff = "2026-01-01"
recent_untracked = [p for p in untracked if get_date(p) >= cutoff]
older_untracked = [p for p in untracked if get_date(p) < cutoff]

def print_post(p):
    wr_id = p.get("id", "?")
    title = p.get("title", "?")
    cat = p.get("category", "")
    if cat is None or str(cat).strip() == "":
        cat = "(미분류)"
    date = get_date(p)[:10]
    comments = p.get("comments_count", 0)
    views = p.get("views", 0)
    likes = p.get("likes", 0)
    author = p.get("author", "")
    print(f"  {wr_id:>6} | {str(title)[:60]:<60} | {str(cat):<8} | {date} | 댓글:{comments:<3} 조회:{views:<5} 추천:{likes:<3} | {author}")

# Print recent
print(f"\n--- RECENT (2026-01 ~ now): {len(recent_untracked)} posts ---")
for cat_name in sorted(by_category.keys()):
    posts = by_category[cat_name]
    recent_in_cat = [p for p in posts if get_date(p) >= cutoff]
    if not recent_in_cat:
        continue
    print(f"\n  [{cat_name}] ({len(recent_in_cat)} posts)")
    print(f"  {'ID':>6} | {'제목':<60} | {'분류':<8} | {'날짜':<10} | {'댓글/조회/추천':<25} | 작성자")
    print(f"  {'-'*6}-+-{'-'*60}-+-{'-'*8}-+-{'-'*10}-+-{'-'*25}-+-{'-'*10}")
    for p in sorted(recent_in_cat, key=get_date, reverse=True):
        print_post(p)

# Print older
if older_untracked:
    print(f"\n--- OLDER (before 2026-01): {len(older_untracked)} posts ---")
    for cat_name in sorted(by_category.keys()):
        posts = by_category[cat_name]
        older_in_cat = [p for p in posts if get_date(p) < cutoff]
        if not older_in_cat:
            continue
        print(f"\n  [{cat_name}] ({len(older_in_cat)} posts)")
        print(f"  {'ID':>6} | {'제목':<60} | {'분류':<8} | {'날짜':<10} | {'댓글/조회/추천':<25} | 작성자")
        print(f"  {'-'*6}-+-{'-'*60}-+-{'-'*8}-+-{'-'*10}-+-{'-'*25}-+-{'-'*10}")
        for p in sorted(older_in_cat, key=get_date, reverse=True):
            print_post(p)

# Summary
print("\n" + "=" * 80)
print("SUMMARY")
print("=" * 80)
print(f"\n  Total bug board posts fetched (relevant categories): {len(all_posts)}")
print(f"  Already tracked in spreadsheet: {len(tracked)}")
print(f"  UNTRACKED total: {len(untracked)}")
print(f"    - Recent (2026-01~): {len(recent_untracked)}")
print(f"    - Older (before 2026-01): {len(older_untracked)}")
print(f"\n  Breakdown by category:")
for cat_name in sorted(by_category.keys()):
    posts = by_category[cat_name]
    recent_count = len([p for p in posts if get_date(p) >= cutoff])
    older_count = len(posts) - recent_count
    print(f"    {cat_name:<12}: {len(posts):>3} total ({recent_count} recent, {older_count} older)")

print("\n" + "=" * 80)
print("DONE")
print("=" * 80)
