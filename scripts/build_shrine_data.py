import csv
from pathlib import Path

from geocode_shrines import VALID_CATEGORIES, extract_region, slugify


INPUT_PATH = Path("data/korean_catholic_holy_sites.geocoded.csv")
OUTPUT_PATH = Path("src/data/shrines.ts")


def read_geocoded_rows():
    if not INPUT_PATH.exists():
        raise SystemExit(f"{INPUT_PATH} 파일이 없습니다. 먼저 npm run geocode를 실행하세요.")

    with INPUT_PATH.open(newline="", encoding="utf-8-sig") as input_file:
        return list(csv.DictReader(input_file))


def normalize_id(raw_id, name, used_ids):
    base = raw_id or slugify(name)
    candidate = base
    index = 2
    while candidate in used_ids:
        candidate = f"{base}-{index}"
        index += 1
    used_ids.add(candidate)
    return candidate


def clean_rows(rows):
    used_ids = set()
    cleaned = []

    for row in rows:
        name = row.get("name", "").strip()
        category = row.get("category", "").strip()
        diocese = row.get("diocese", "").strip()
        address = row.get("address", "").strip()
        region = row.get("region", "").strip() or extract_region(address)
        lat = row.get("lat", "").strip()
        lng = row.get("lng", "").strip()

        if not name or category not in VALID_CATEGORIES or not diocese or not address or not lat or not lng:
            continue

        shrine = {
            "id": normalize_id(row.get("id", "").strip(), name, used_ids),
            "name": name,
            "category": category,
            "diocese": diocese,
            "address": address,
            "region": region,
            "lat": float(lat),
            "lng": float(lng)
        }
        cleaned.append(shrine)

    return cleaned


def ts_string(value):
    return value.replace("\\", "\\\\").replace('"', '\\"')


def write_ts(shrines):
    lines = [
        'export type ShrineCategory = "성지" | "순교사적지" | "순례지";',
        "",
        "export type Shrine = {",
        "  id: string;",
        "  name: string;",
        "  category: ShrineCategory;",
        "  diocese: string;",
        "  address: string;",
        "  region: string;",
        "  lat: number;",
        "  lng: number;",
        "};",
        "",
        "export const shrines: Shrine[] = ["
    ]

    for shrine in shrines:
        lines.extend([
            "  {",
            f'    id: "{ts_string(shrine["id"])}",',
            f'    name: "{ts_string(shrine["name"])}",',
            f'    category: "{ts_string(shrine["category"])}",',
            f'    diocese: "{ts_string(shrine["diocese"])}",',
            f'    address: "{ts_string(shrine["address"])}",',
            f'    region: "{ts_string(shrine["region"])}",',
            f'    lat: {shrine["lat"]:.7f},',
            f'    lng: {shrine["lng"]:.7f}',
            "  },"
        ])

    if shrines:
        lines[-1] = "  }"

    lines.extend([
        "];",
        ""
    ])
    OUTPUT_PATH.write_text("\n".join(lines), encoding="utf-8")


def main():
    rows = read_geocoded_rows()
    shrines = clean_rows(rows)
    write_ts(shrines)
    print(f"{len(shrines)}개 성지를 {OUTPUT_PATH}에 반영했습니다.")


if __name__ == "__main__":
    raise SystemExit(main())
