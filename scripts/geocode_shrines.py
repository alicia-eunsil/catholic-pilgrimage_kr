import csv
import json
import os
import sys
import time
import urllib.parse
import urllib.request


INPUT_PATH = "data/shrines_template.csv"
OUTPUT_PATH = "data/shrines.geocoded.csv"
VALID_CATEGORIES = {"성지", "순교사적지", "순례지"}


def slugify(value):
    encoded = value.strip().lower().replace(" ", "-")
    return "".join(ch for ch in encoded if ch.isalnum() or ch in "-_")


def extract_region(address):
    first = address.split()[0] if address.split() else ""
    return first.replace("특별시", "").replace("광역시", "").replace("특별자치시", "").replace("특별자치도", "").replace("도", "")


def geocode(address, api_key):
    query = urllib.parse.urlencode({"query": address})
    request = urllib.request.Request(f"https://dapi.kakao.com/v2/local/search/address.json?{query}")
    request.add_header("Authorization", f"KakaoAK {api_key}")

    with urllib.request.urlopen(request, timeout=15) as response:
        payload = json.loads(response.read().decode("utf-8"))

    documents = payload.get("documents", [])
    if not documents:
        return None

    first = documents[0]
    return {
        "lat": first.get("y", ""),
        "lng": first.get("x", "")
    }


def main():
    api_key = os.environ.get("KAKAO_REST_API_KEY")
    if not api_key:
        print("KAKAO_REST_API_KEY 환경변수를 설정해 주세요.", file=sys.stderr)
        return 1

    with open(INPUT_PATH, newline="", encoding="utf-8-sig") as input_file:
        rows = list(csv.DictReader(input_file))

    output_rows = []
    for index, row in enumerate(rows, start=1):
        name = row.get("성지명", "").strip()
        category = row.get("구분", "").strip()
        diocese = row.get("소속교구", "").strip()
        address = row.get("주소", "").strip()

        if not name or not category or not diocese or not address:
            print(f"{index}행: 필수 값이 비어 있어 건너뜁니다.", file=sys.stderr)
            continue

        if category not in VALID_CATEGORIES:
            print(f"{index}행: 구분은 성지/순교사적지/순례지 중 하나여야 합니다: {category}", file=sys.stderr)
            continue

        coords = geocode(address, api_key)
        if not coords:
            print(f"{index}행: 주소 좌표를 찾지 못했습니다: {address}", file=sys.stderr)
            coords = {"lat": "", "lng": ""}

        output_rows.append({
            "id": slugify(name),
            "name": name,
            "category": category,
            "diocese": diocese,
            "address": address,
            "region": extract_region(address),
            "lat": coords["lat"],
            "lng": coords["lng"]
        })
        time.sleep(0.15)

    with open(OUTPUT_PATH, "w", newline="", encoding="utf-8-sig") as output_file:
        writer = csv.DictWriter(output_file, fieldnames=["id", "name", "category", "diocese", "address", "region", "lat", "lng"])
        writer.writeheader()
        writer.writerows(output_rows)

    print(f"{len(output_rows)}개 성지 좌표 변환 완료: {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
