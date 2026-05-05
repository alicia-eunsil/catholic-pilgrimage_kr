"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { shrines, type Shrine, type ShrineCategory } from "@/data/shrines";
import { distanceKm, estimatedDriveMinutes, optimizeRoute, totalRouteDistanceKm, type LatLng } from "@/lib/geo";
import { loadVisitRecords, saveVisitRecords, type VisitRecord } from "@/lib/storage";

const categoryStyle: Record<ShrineCategory, { color: string; bg: string }> = {
  성지: { color: "#9f6b00", bg: "#fff4cc" },
  순교사적지: { color: "#b42318", bg: "#ffe4df" },
  순례지: { color: "#175cd3", bg: "#dbeafe" }
};

const VERIFY_RADIUS_METERS = 500;
const KAKAO_MAP_SDK_ID = "kakao-map-sdk";
const CATEGORY_FILTERS: ShrineCategory[] = ["성지", "순교사적지", "순례지"];
const ALL_RECORDS = "all";

declare global {
  interface Window {
    kakao?: {
      maps: {
        load: (callback: () => void) => void;
        LatLng: new (lat: number, lng: number) => KakaoLatLng;
        Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMap;
        Marker: new (options: { position: KakaoLatLng; map?: KakaoMap }) => KakaoMarker;
        InfoWindow: new (options: { content: string }) => KakaoInfoWindow;
        LatLngBounds: new () => KakaoLatLngBounds;
        event: {
          addListener: (target: KakaoMarker, type: "click" | "mouseover" | "mouseout", handler: () => void) => void;
        };
      };
    };
  }
}

type KakaoLatLng = object;
type KakaoMap = {
  setBounds: (bounds: KakaoLatLngBounds) => void;
  setCenter: (latLng: KakaoLatLng) => void;
};
type KakaoMarker = {
  setMap: (map: KakaoMap | null) => void;
};
type KakaoInfoWindow = {
  open: (map: KakaoMap, marker: KakaoMarker) => void;
  close: () => void;
};
type KakaoLatLngBounds = {
  extend: (latLng: KakaoLatLng) => void;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function PilgrimageApp() {
  const [activeTab, setActiveTab] = useState<"map" | "route" | "verify" | "records">("map");
  const [selectedCategories, setSelectedCategories] = useState<ShrineCategory[]>(CATEGORY_FILTERS);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [focusedShrineId, setFocusedShrineId] = useState(shrines[0].id);
  const [position, setPosition] = useState<LatLng | undefined>();
  const [locationError, setLocationError] = useState("");
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [verifyShrineId, setVerifyShrineId] = useState(shrines[0].id);
  const [nickname, setNickname] = useState("");
  const [comment, setComment] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | undefined>();
  const [recordShrineFilter, setRecordShrineFilter] = useState<string>(ALL_RECORDS);

  useEffect(() => {
    setVisits(loadVisitRecords());
  }, []);

  const filteredShrines = useMemo(() => {
    return shrines.filter((shrine) => {
      const matchesCategory = selectedCategories.includes(shrine.category);
      const normalizedQuery = query.trim().toLowerCase();
      const matchesQuery =
        normalizedQuery.length === 0 ||
        shrine.name.toLowerCase().includes(normalizedQuery) ||
        shrine.address.toLowerCase().includes(normalizedQuery) ||
        shrine.diocese.toLowerCase().includes(normalizedQuery);

      return matchesCategory && matchesQuery;
    });
  }, [selectedCategories, query]);

  const selectedShrines = useMemo(() => {
    return selectedIds
      .map((id) => shrines.find((shrine) => shrine.id === id))
      .filter((shrine): shrine is Shrine => Boolean(shrine));
  }, [selectedIds]);

  const route = useMemo(() => optimizeRoute(selectedShrines, position), [selectedShrines, position]);
  const routeDistance = totalRouteDistanceKm(route, position);
  const focusedShrine = shrines.find((shrine) => shrine.id === focusedShrineId) ?? shrines[0];
  const verifyShrine = shrines.find((shrine) => shrine.id === verifyShrineId) ?? shrines[0];
  const verifyDistanceMeters = position ? Math.round(distanceKm(position, verifyShrine) * 1000) : undefined;
  const canVerify = verifyDistanceMeters !== undefined && verifyDistanceMeters <= VERIFY_RADIUS_METERS;
  const visitedShrineIds = new Set(visits.map((visit) => visit.shrineId));
  const progress = Math.round((visitedShrineIds.size / shrines.length) * 100);
  const focusedVisits = visits.filter((visit) => visit.shrineId === focusedShrine.id);
  const focusedRegionShrines = shrines.filter((shrine) => shrine.region === focusedShrine.region);
  const focusedRegionVisitCount = visits.filter((visit) => {
    const shrine = shrines.find((item) => item.id === visit.shrineId);
    return shrine?.region === focusedShrine.region;
  }).length;
  const focusedRegionVisitedCount = new Set(
    visits
      .map((visit) => shrines.find((shrine) => shrine.id === visit.shrineId))
      .filter((shrine): shrine is Shrine => Boolean(shrine) && shrine.region === focusedShrine.region)
      .map((shrine) => shrine.id)
  ).size;
  const shrineVisitCounts = shrines
    .map((shrine) => ({
      shrine,
      count: visits.filter((visit) => visit.shrineId === shrine.id).length
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count || a.shrine.name.localeCompare(b.shrine.name, "ko"))
    .slice(0, 5);
  const filteredRecordVisits = recordShrineFilter === ALL_RECORDS
    ? visits
    : visits.filter((visit) => visit.shrineId === recordShrineFilter);
  const verifiedVisitCount = visits.filter((visit) => visit.verified).length;
  const handleSelectShrine = useCallback((shrine: Shrine) => {
    setFocusedShrineId(shrine.id);
    setVerifyShrineId(shrine.id);
    setActiveTab("map");
  }, []);

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      if (current.includes(id)) {
        return current.filter((selectedId) => selectedId !== id);
      }
      return [...current, id];
    });
  }

  function toggleCategory(category: ShrineCategory) {
    setSelectedCategories((current) => {
      if (current.includes(category)) {
        return current.filter((item) => item !== category);
      }
      return [...current, category];
    });
  }

  function toggleAllCategories() {
    setSelectedCategories((current) => (current.length === CATEGORY_FILTERS.length ? [] : CATEGORY_FILTERS));
  }

  function requestLocation() {
    setLocationError("");

    if (!navigator.geolocation) {
      setLocationError("이 브라우저에서는 위치 확인을 지원하지 않습니다.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (result) => {
        setPosition({
          lat: result.coords.latitude,
          lng: result.coords.longitude
        });
      },
      () => setLocationError("위치 권한을 허용해야 현재 위치 기반 인증과 코스 계산을 사용할 수 있습니다."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setImageDataUrl(undefined);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(String(reader.result));
    reader.readAsDataURL(file);
  }

  function submitVisit() {
    const trimmedNickname = nickname.trim();
    const trimmedComment = comment.trim();

    if (!trimmedNickname || !trimmedComment) {
      window.alert("닉네임과 한줄소감을 입력해 주세요.");
      return;
    }

    const visitedAt = new Date().toISOString();
    const nextVisit: VisitRecord = {
      id: `${Date.now()}-${verifyShrineId}`,
      shrineId: verifyShrineId,
      nickname: trimmedNickname,
      comment: trimmedComment,
      imageDataUrl,
      createdAt: visitedAt,
      visitedAt,
      userLat: position?.lat,
      userLng: position?.lng,
      distanceMeters: verifyDistanceMeters,
      verified: Boolean(canVerify)
    };

    const nextVisits = [nextVisit, ...visits];
    setVisits(nextVisits);
    saveVisitRecords(nextVisits);
    setComment("");
    setImageDataUrl(undefined);
    setActiveTab("records");
  }

  return (
    <main className="app-shell">
      <section className="map-side">
        <div className="map-toolbar">
          <div>
            <p className="eyebrow">Catholic Pilgrimage KR</p>
            <h1>성지순례 지도</h1>
          </div>
          <button className="location-button" onClick={requestLocation}>
            현재 위치
          </button>
        </div>

        <div className="filters">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="성지명, 교구, 주소 검색" />
          <div className="chips">
            <button className={selectedCategories.length === CATEGORY_FILTERS.length ? "selected" : ""} onClick={toggleAllCategories}>
              전체
            </button>
            {CATEGORY_FILTERS.map((item) => (
              <button key={item} className={selectedCategories.includes(item) ? "selected" : ""} onClick={() => toggleCategory(item)}>
                {item}
              </button>
            ))}
          </div>
        </div>

        {locationError ? <p className="notice">{locationError}</p> : null}
        {filteredShrines.length === 0 ? <div className="map-empty">선택한 조건에 맞는 성지가 없습니다.</div> : null}

        <KakaoMapPanel
          shrines={filteredShrines}
          selectedIds={selectedIds}
          focusedShrineId={focusedShrineId}
          onSelectShrine={handleSelectShrine}
        />
      </section>

      <aside className="info-side">
        <section className="tabbar" aria-label="주요 화면">
          <button className={activeTab === "map" ? "active" : ""} onClick={() => setActiveTab("map")}>소개</button>
          <button className={activeTab === "route" ? "active" : ""} onClick={() => setActiveTab("route")}>코스</button>
          <button className={activeTab === "verify" ? "active" : ""} onClick={() => setActiveTab("verify")}>인증</button>
          <button className={activeTab === "records" ? "active" : ""} onClick={() => setActiveTab("records")}>기록</button>
        </section>

        {activeTab === "map" ? (
          <section className="screen">
            <ShrineDetail
              shrine={focusedShrine}
              selected={selectedIds.includes(focusedShrine.id)}
              onToggle={() => toggleSelected(focusedShrine.id)}
              onVerify={() => {
                setVerifyShrineId(focusedShrine.id);
                setActiveTab("verify");
              }}
            />

            <div className="metric-grid shrine-stats">
              <div>
                <span>이 성지 인증</span>
                <strong>{focusedVisits.length}건</strong>
              </div>
              <div>
                <span>{focusedShrine.region} 성지</span>
                <strong>{focusedRegionShrines.length}곳</strong>
              </div>
              <div>
                <span>{focusedShrine.region} 방문</span>
                <strong>{focusedRegionVisitedCount}곳</strong>
              </div>
            </div>

            <section className="insight-card">
              <div className="panel-heading">
                <strong>{focusedShrine.region} 지역 통계</strong>
                <span>{focusedRegionVisitCount}개 인증 기록</span>
              </div>
              <div className="region-bars">
                {CATEGORY_FILTERS.map((category) => {
                  const total = focusedRegionShrines.filter((shrine) => shrine.category === category).length;
                  const width = focusedRegionShrines.length ? Math.round((total / focusedRegionShrines.length) * 100) : 0;
                  return (
                    <div key={category} className="region-bar">
                      <span>{category}</span>
                      <div><i style={{ width: `${width}%` }} /></div>
                      <strong>{total}</strong>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="insight-card">
              <div className="panel-heading">
                <strong>최근 인증 사진</strong>
                <span>{focusedVisits.length ? focusedShrine.name : "아직 없음"}</span>
              </div>
              {focusedVisits.length === 0 ? (
                <div className="empty-state compact">이 성지에는 아직 인증 기록이 없습니다.</div>
              ) : (
                <div className="visit-gallery">
                  {focusedVisits.slice(0, 3).map((visit) => (
                    <VisitCard key={visit.id} visit={visit} shrine={focusedShrine} compact />
                  ))}
                </div>
              )}
            </section>

            <section className="insight-card">
              <div className="panel-heading">
                <strong>많이 인증된 성지</strong>
                <span>상위 {shrineVisitCounts.length}곳</span>
              </div>
              {shrineVisitCounts.length === 0 ? (
                <div className="empty-state compact">아직 집계할 인증 기록이 없습니다.</div>
              ) : (
                <div className="popular-list">
                  {shrineVisitCounts.map(({ shrine, count }) => (
                    <button key={shrine.id} onClick={() => handleSelectShrine(shrine)}>
                      <span>{shrine.name}</span>
                      <strong>{count}건</strong>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <button
              className="primary-action sticky-action"
              onClick={() => {
                setVerifyShrineId(focusedShrine.id);
                setActiveTab("verify");
              }}
            >
              나도 인증하기
            </button>
          </section>
        ) : null}

        {activeTab === "route" ? (
          <section className="screen">
          <div className="metric-grid">
            <div>
              <span>선택 성지</span>
              <strong>{selectedShrines.length}곳</strong>
            </div>
            <div>
              <span>예상 거리</span>
              <strong>{routeDistance.toFixed(1)}km</strong>
            </div>
            <div>
              <span>예상 시간</span>
              <strong>{estimatedDriveMinutes(routeDistance)}분</strong>
            </div>
          </div>

          {route.length === 0 ? (
            <div className="empty-state">지도 탭에서 성지를 2곳 이상 선택하면 좌표 기반 추천 코스가 생성됩니다.</div>
          ) : (
            <ol className="route-list">
              {route.map((shrine, index) => {
                const previous = index === 0 ? position : route[index - 1];
                const segment = previous ? distanceKm(previous, shrine) : 0;
                return (
                  <li key={shrine.id}>
                    <span className="step">{index + 1}</span>
                    <div>
                      <strong>{shrine.name}</strong>
                      <p>{shrine.diocese} · {shrine.category}</p>
                      <small>{index === 0 && !position ? "출발지" : `${segment.toFixed(1)}km 이동`}</small>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          </section>
        ) : null}

        {activeTab === "verify" ? (
          <section className="screen">
          <div className="form-card">
            <label>
              방문 성지
              <select value={verifyShrineId} onChange={(event) => setVerifyShrineId(event.target.value)}>
                {shrines.map((shrine) => (
                  <option key={shrine.id} value={shrine.id}>{shrine.name}</option>
                ))}
              </select>
            </label>

            <div className={`verify-status ${canVerify ? "ok" : ""}`}>
              <strong>{canVerify ? "인증 가능" : "위치 확인 필요"}</strong>
              <span>
                {verifyDistanceMeters === undefined
                  ? "현재 위치를 확인하면 500m 이내 여부를 계산합니다."
                  : `현재 위치와 ${verifyDistanceMeters.toLocaleString()}m 거리입니다.`}
              </span>
            </div>

            <label>
              닉네임
              <input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="예: 순례자요한" />
            </label>

            <label>
              한줄소감
              <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="오늘 순례에서 남기고 싶은 한마디" />
            </label>

            <label>
              인증 사진
              <input type="file" accept="image/*" onChange={handleImageChange} />
            </label>

            {imageDataUrl ? <img className="preview" src={imageDataUrl} alt="인증 사진 미리보기" /> : null}

            <button className="primary-action" onClick={submitVisit}>방문 기록 남기기</button>
          </div>
          </section>
        ) : null}

        {activeTab === "records" ? (
          <section className="screen">
          <div className="progress-card">
            <span>나의 순례 진행률</span>
            <strong>{progress}%</strong>
            <div className="progress-track"><div style={{ width: `${progress}%` }} /></div>
            <p>{visitedShrineIds.size} / {shrines.length}곳 방문 기록 · GPS 인증 {verifiedVisitCount}건</p>
          </div>

          <div className="filter-card">
            <label>
              인증 보기
              <select value={recordShrineFilter} onChange={(event) => setRecordShrineFilter(event.target.value)}>
                <option value={ALL_RECORDS}>전체 성지</option>
                {shrines.map((shrine) => (
                  <option key={shrine.id} value={shrine.id}>{shrine.name}</option>
                ))}
              </select>
            </label>
          </div>

          {filteredRecordVisits.length === 0 ? (
            <div className="empty-state">아직 남긴 방문 기록이 없습니다.</div>
          ) : (
            <div className="record-list">
              {filteredRecordVisits.map((visit) => {
                const shrine = shrines.find((item) => item.id === visit.shrineId);
                return shrine ? <VisitCard key={visit.id} visit={visit} shrine={shrine} /> : null;
              })}
            </div>
          )}
          </section>
        ) : null}
      </aside>
    </main>
  );
}

function KakaoMapPanel({
  shrines: mapShrines,
  selectedIds,
  focusedShrineId,
  onSelectShrine
}: {
  shrines: Shrine[];
  selectedIds: string[];
  focusedShrineId: string;
  onSelectShrine: (shrine: Shrine) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const markersRef = useRef<KakaoMarker[]>([]);
  const infoWindowsRef = useRef<KakaoInfoWindow[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "missing-key" | "error">("loading");

  useEffect(() => {
    const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;

    if (!appKey) {
      setStatus("missing-key");
      return;
    }

    if (window.kakao?.maps) {
      window.kakao.maps.load(() => setStatus("ready"));
      return;
    }

    const existingScript = document.getElementById(KAKAO_MAP_SDK_ID) as HTMLScriptElement | null;
    const script = existingScript ?? document.createElement("script");

    if (!existingScript) {
      script.id = KAKAO_MAP_SDK_ID;
      script.async = true;
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;
      document.head.appendChild(script);
    }

    script.onload = () => {
      if (!window.kakao?.maps) {
        setStatus("error");
        return;
      }
      window.kakao.maps.load(() => setStatus("ready"));
    };
    script.onerror = () => setStatus("error");
  }, []);

  useEffect(() => {
    if (status !== "ready" || !containerRef.current || !window.kakao?.maps) {
      return;
    }

    const kakaoMaps = window.kakao.maps;
    const centerShrine = mapShrines.find((shrine) => shrine.id === focusedShrineId) ?? mapShrines[0] ?? shrines[0];
    const center = new kakaoMaps.LatLng(centerShrine.lat, centerShrine.lng);

    if (!mapRef.current) {
      mapRef.current = new kakaoMaps.Map(containerRef.current, {
        center,
        level: 12
      });
    } else {
      mapRef.current.setCenter(center);
    }

    const map = mapRef.current;
    if (!map) {
      return;
    }

    markersRef.current.forEach((marker) => marker.setMap(null));
    infoWindowsRef.current.forEach((infoWindow) => infoWindow.close());
    markersRef.current = [];
    infoWindowsRef.current = [];

    const bounds = new kakaoMaps.LatLngBounds();

    mapShrines.forEach((shrine) => {
      const position = new kakaoMaps.LatLng(shrine.lat, shrine.lng);
      bounds.extend(position);

      const marker = new kakaoMaps.Marker({
        map,
        position
      });
      const isSelected = selectedIds.includes(shrine.id);
      const infoWindow = new kakaoMaps.InfoWindow({
        content: `<div class="kakao-info-window"><strong>${escapeHtml(shrine.name)}</strong><span>${escapeHtml(shrine.category)}${isSelected ? " · 코스 선택됨" : ""}</span></div>`
      });

      marker.setMap(map);
      markersRef.current.push(marker);
      infoWindowsRef.current.push(infoWindow);

      kakaoMaps.event.addListener(marker, "click", () => onSelectShrine(shrine));
      kakaoMaps.event.addListener(marker, "mouseover", () => infoWindow.open(map, marker));
      kakaoMaps.event.addListener(marker, "mouseout", () => infoWindow.close());
    });

    if (mapShrines.length > 1) {
      map.setBounds(bounds);
    }

    return () => {
      markersRef.current.forEach((marker) => marker.setMap(null));
      infoWindowsRef.current.forEach((infoWindow) => infoWindow.close());
    };
  }, [focusedShrineId, mapShrines, onSelectShrine, selectedIds, status]);

  return (
    <div className="map-panel" aria-label="카카오 성지 지도">
      <div ref={containerRef} className="kakao-map" />
      {status === "loading" ? <div className="map-caption">Kakao Maps 로딩 중</div> : null}
      {status === "missing-key" ? <div className="map-caption warning">NEXT_PUBLIC_KAKAO_MAP_KEY 환경변수가 필요합니다.</div> : null}
      {status === "error" ? <div className="map-caption warning">Kakao Maps를 불러오지 못했습니다. 도메인 등록을 확인해 주세요.</div> : null}
    </div>
  );
}

function ShrineDetail({
  shrine,
  selected,
  onToggle,
  onVerify
}: {
  shrine: Shrine;
  selected: boolean;
  onToggle: () => void;
  onVerify: () => void;
}) {
  return (
    <article className="detail-card">
      <div>
        <span className="category-badge" style={{ color: categoryStyle[shrine.category].color, background: categoryStyle[shrine.category].bg }}>
          {shrine.category}
        </span>
        <h2>{shrine.name}</h2>
        <p>{shrine.description}</p>
        <small>{shrine.diocese} · {shrine.address}</small>
      </div>
      <div className="detail-actions">
        <a href={`https://search.naver.com/search.naver?query=${encodeURIComponent(`${shrine.name} 블로그`)}`} target="_blank" rel="noreferrer">
          블로그 후기
        </a>
        <button onClick={onToggle}>{selected ? "선택 해제" : "코스 선택"}</button>
        <button onClick={onVerify}>나도 인증하기</button>
      </div>
    </article>
  );
}

function VisitCard({ visit, shrine, compact = false }: { visit: VisitRecord; shrine: Shrine; compact?: boolean }) {
  const time = visit.visitedAt ?? visit.createdAt;
  return (
    <article className={`record-card ${compact ? "compact-record" : ""}`}>
      {visit.imageDataUrl ? <img src={visit.imageDataUrl} alt="" /> : <div className="photo-placeholder">사진 없음</div>}
      <div>
        <span className={`record-badge ${visit.verified ? "verified" : ""}`}>{visit.verified ? "GPS 인증" : "기록 저장"}</span>
        <h3>{shrine.name}</h3>
        <p>{visit.comment}</p>
        <small>{shrine.region} · {visit.nickname} · {formatDateTime(time)}</small>
      </div>
    </article>
  );
}
