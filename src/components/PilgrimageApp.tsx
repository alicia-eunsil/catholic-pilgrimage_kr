"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { shrines, type Shrine, type ShrineCategory } from "@/data/shrines";
import { distanceKm, type LatLng } from "@/lib/geo";
import { loadVisitRecords, saveVisitRecords, type VisitRecord } from "@/lib/storage";

const categoryStyle: Record<ShrineCategory, { color: string; bg: string }> = {
  성지: { color: "#9f6b00", bg: "#fff4cc" },
  순교사적지: { color: "#b42318", bg: "#ffe4df" },
  순례지: { color: "#175cd3", bg: "#dbeafe" }
};

const VERIFY_RADIUS_METERS = 500;
const KAKAO_MAP_SDK_ID = "kakao-map-sdk";
const CATEGORY_FILTERS: ShrineCategory[] = ["성지", "순교사적지", "순례지"];
const VISITS_PER_PAGE = 10;
const CATEGORY_ORDER: Record<ShrineCategory, number> = {
  성지: 0,
  순교사적지: 1,
  순례지: 2
};

declare global {
  interface Window {
    kakao?: {
      maps: {
        load: (callback: () => void) => void;
        LatLng: new (lat: number, lng: number) => KakaoLatLng;
        Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMap;
        Marker: new (options: { image?: KakaoMarkerImage; position: KakaoLatLng; map?: KakaoMap }) => KakaoMarker;
        MarkerImage: new (
          src: string,
          size: KakaoSize,
          options?: { offset?: KakaoPoint }
        ) => KakaoMarkerImage;
        Point: new (x: number, y: number) => KakaoPoint;
        Size: new (width: number, height: number) => KakaoSize;
        InfoWindow: new (options: { content: string }) => KakaoInfoWindow;
        Polyline: new (options: {
          path: KakaoLatLng[];
          strokeColor: string;
          strokeOpacity: number;
          strokeStyle: string;
          strokeWeight: number;
          map?: KakaoMap;
        }) => KakaoPolyline;
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
type KakaoMarkerImage = object;
type KakaoPoint = object;
type KakaoSize = object;
type KakaoPolyline = {
  setMap: (map: KakaoMap | null) => void;
};
type KakaoInfoWindow = {
  open: (map: KakaoMap, marker: KakaoMarker) => void;
  close: () => void;
};
type KakaoLatLngBounds = {
  extend: (latLng: KakaoLatLng) => void;
};
const EMPTY_ROUTE_SHRINES: Shrine[] = [];
const markerColors: Record<ShrineCategory, { fill: string; stroke: string }> = {
  성지: { fill: "#d9a441", stroke: "#9f6b00" },
  순교사적지: { fill: "#d45b4f", stroke: "#b42318" },
  순례지: { fill: "#5d8edc", stroke: "#175cd3" }
};
type ShrineSortKey = "diocese" | "category" | "name" | "address";
type SortDirection = "asc" | "desc";
type RecommendedCourse = {
  id: string;
  title: string;
  theme: string;
  region: string;
  duration: string;
  description: string;
  shrineIds: string[];
};

const recommendedCourses: RecommendedCourse[] = [
  {
    id: "seoul-martyr-core",
    title: "서울 도심 순교 코스",
    theme: "도심 순교 성지",
    region: "서울",
    duration: "반나절-1일",
    description: "대중교통으로 이동하기 좋은 서울 중심 순례 코스입니다. 처음 성지순례를 시작하는 사람에게 적합합니다.",
    shrineIds: [
      "명동대성당-순교성지",
      "서소문-밖-네거리-순교성지-순교성지",
      "중림동-약현성당-순례지",
      "당고개-순교성지-순교성지",
      "새남터-순교성지-순교성지",
      "절두산-순교성지-순교성지"
    ]
  },
  {
    id: "naepo-pilgrimage",
    title: "충남 내포 신앙의 길",
    theme: "김대건 신부와 내포 교회",
    region: "충남 당진-서산",
    duration: "1일",
    description: "솔뫼, 합덕, 신리, 해미를 잇는 대표 내포 순례 코스입니다. 자동차 이동 기준으로 구성했습니다.",
    shrineIds: ["솔뫼성지", "합덕성당", "신리성지", "해미순교자국제성지"]
  },
  {
    id: "jeonbuk-martyr",
    title: "전주 전북 순교 코스",
    theme: "호남 순교 신앙",
    region: "전북 전주-완주-익산",
    duration: "1일-1박 2일",
    description: "전주 도심 성지와 전북 주요 순교 성지를 함께 보는 코스입니다. 여유 있게 이동하는 일정에 맞습니다.",
    shrineIds: ["전동성당", "전주숲정이성지", "치명자산성지", "초남이성지", "천호성지"]
  },
  {
    id: "jeju-faith-route",
    title: "제주 신앙의 길",
    theme: "제주 순교와 표착",
    region: "제주",
    duration: "1박 2일",
    description: "제주의 순교 터와 김대건 신부 표착 기념지를 연결한 코스입니다. 제주 여행 일정과 함께 보기 좋습니다.",
    shrineIds: [
      "관덕정-순교-터",
      "황사평-성지",
      "김기량-순교-기념관",
      "대정-성지-정난주-마리아의-묘",
      "용수-성지-성-김대건-신부-표착기념관"
    ]
  },
  {
    id: "suwon-gyeonggi",
    title: "수원교구 경기 성지 코스",
    theme: "수도권 자동차 순례",
    region: "경기",
    duration: "1일-1박 2일",
    description: "경기 남부와 광주권 성지를 묶은 코스입니다. 이동 거리가 있어 자동차 순례에 적합합니다.",
    shrineIds: ["남양성모성지", "미리내성지", "어농성지", "은이골배마실성지", "천진암성지"]
  }
];

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
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function markerSvgDataUrl(category: ShrineCategory) {
  const color = markerColors[category];
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="34" height="42" viewBox="0 0 34 42">
      <path d="M17 41C13.2 35.7 4 25.6 4 16.6C4 9.1 9.8 3 17 3s13 6.1 13 13.6c0 9-9.2 19.1-13 24.4Z" fill="${color.fill}" stroke="${color.stroke}" stroke-width="2"/>
      <circle cx="17" cy="16.5" r="6.2" fill="#fff" fill-opacity=".96"/>
      <path d="M17 10.4v12.2M11.8 15.2h10.4" stroke="${color.stroke}" stroke-width="1.8" stroke-linecap="round"/>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function resolveCourseShrines(course: RecommendedCourse) {
  return course.shrineIds
    .map((id) => shrines.find((shrine) => shrine.id === id))
    .filter((shrine): shrine is Shrine => Boolean(shrine));
}

export default function PilgrimageApp() {
  const [activeTab, setActiveTab] = useState<"map" | "route" | "verify" | "records">("map");
  const [selectedCategories, setSelectedCategories] = useState<ShrineCategory[]>(CATEGORY_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [focusedShrineId, setFocusedShrineId] = useState(shrines[0].id);
  const [position, setPosition] = useState<LatLng | undefined>();
  const [locationError, setLocationError] = useState("");
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [verifyShrineId, setVerifyShrineId] = useState(shrines[0].id);
  const [nickname, setNickname] = useState("");
  const [comment, setComment] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | undefined>();
  const [introVisitPage, setIntroVisitPage] = useState(1);
  const [expandedImage, setExpandedImage] = useState<{ src: string; alt: string } | undefined>();
  const [showShrineList, setShowShrineList] = useState(false);
  const [shrineSortKey, setShrineSortKey] = useState<ShrineSortKey>("diocese");
  const [shrineSortDirection, setShrineSortDirection] = useState<SortDirection>("asc");
  const [activeCourseId, setActiveCourseId] = useState<string | undefined>();

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

  const activeCourse = recommendedCourses.find((course) => course.id === activeCourseId);
  const activeCourseShrines = useMemo(() => (activeCourse ? resolveCourseShrines(activeCourse) : EMPTY_ROUTE_SHRINES), [activeCourse]);
  const courseMapActive = activeCourseShrines.length > 1;
  const visibleMapShrines = courseMapActive ? activeCourseShrines : filteredShrines;
  const visibleRouteShrines = courseMapActive ? activeCourseShrines : EMPTY_ROUTE_SHRINES;
  const focusedShrine = shrines.find((shrine) => shrine.id === focusedShrineId) ?? shrines[0];
  const verifyShrine = shrines.find((shrine) => shrine.id === verifyShrineId) ?? shrines[0];
  const verifyDistanceMeters = position ? Math.round(distanceKm(position, verifyShrine) * 1000) : undefined;
  const canVerify = verifyDistanceMeters !== undefined && verifyDistanceMeters <= VERIFY_RADIUS_METERS;
  const focusedVisits = visits
    .filter((visit) => visit.shrineId === focusedShrine.id)
    .sort((a, b) => new Date(b.visitedAt ?? b.createdAt).getTime() - new Date(a.visitedAt ?? a.createdAt).getTime());
  const focusedVerifiedVisitCount = focusedVisits.filter((visit) => visit.verified).length;
  const introVisitPageCount = Math.max(1, Math.ceil(focusedVisits.length / VISITS_PER_PAGE));
  const introVisitPageSafe = Math.min(introVisitPage, introVisitPageCount);
  const pagedFocusedVisits = focusedVisits.slice(
    (introVisitPageSafe - 1) * VISITS_PER_PAGE,
    introVisitPageSafe * VISITS_PER_PAGE
  );
  const visitedShrineCount = new Set(visits.map((visit) => visit.shrineId)).size;
  const verifiedVisitCount = visits.filter((visit) => visit.verified).length;
  const shrineRecordStats = shrines
    .map((shrine) => ({
      shrine,
      count: visits.filter((visit) => visit.shrineId === shrine.id).length,
      verifiedCount: visits.filter((visit) => visit.shrineId === shrine.id && visit.verified).length
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count || a.shrine.name.localeCompare(b.shrine.name, "ko"));
  const sortedShrineList = useMemo(() => {
    return [...shrines].sort((a, b) => {
      const direction = shrineSortDirection === "asc" ? 1 : -1;
      let result: number;
      if (shrineSortKey === "category") {
        result = CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category] || a.name.localeCompare(b.name, "ko");
      } else {
        result = a[shrineSortKey].localeCompare(b[shrineSortKey], "ko") || a.name.localeCompare(b.name, "ko");
      }
      return result * direction;
    });
  }, [shrineSortDirection, shrineSortKey]);
  const handleSelectShrine = useCallback((shrine: Shrine) => {
    setFocusedShrineId(shrine.id);
    setVerifyShrineId(shrine.id);
    setIntroVisitPage(1);
    setActiveTab("map");
  }, []);

  function toggleCategory(category: ShrineCategory) {
    setActiveCourseId(undefined);
    setSelectedCategories((current) => {
      if (current.includes(category)) {
        return current.filter((item) => item !== category);
      }
      return [...current, category];
    });
  }

  function toggleAllCategories() {
    setActiveCourseId(undefined);
    setSelectedCategories((current) => (current.length === CATEGORY_FILTERS.length ? [] : CATEGORY_FILTERS));
  }

  function runSearch() {
    setActiveCourseId(undefined);
    setQuery(searchInput);
  }

  function resetSearch() {
    setActiveCourseId(undefined);
    setSearchInput("");
    setQuery("");
  }

  function sortShrineList(nextKey: ShrineSortKey) {
    if (nextKey === shrineSortKey) {
      setShrineSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setShrineSortKey(nextKey);
    setShrineSortDirection("asc");
  }

  function sortIndicator(key: ShrineSortKey) {
    if (key !== shrineSortKey) {
      return "";
    }
    return shrineSortDirection === "asc" ? " ▲" : " ▼";
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
          <button className="list-button" onClick={() => setShowShrineList(true)}>
            성지목록보기
          </button>
        </div>

        <div className="filters">
          <div className="search-row">
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  runSearch();
                }
              }}
              placeholder="성지명, 교구, 주소 검색"
            />
            <button className="search-button" onClick={runSearch} aria-label="검색">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="6" />
                <path d="m16 16 4 4" />
              </svg>
            </button>
            <button className="reset-button" onClick={resetSearch} aria-label="검색 초기화">
              ↺
            </button>
          </div>
          <div className="chips">
            <button className={selectedCategories.length === CATEGORY_FILTERS.length ? "selected" : ""} onClick={toggleAllCategories}>
              전체
            </button>
            {CATEGORY_FILTERS.map((item) => (
              <button key={item} className={selectedCategories.includes(item) ? "selected" : ""} onClick={() => toggleCategory(item)}>
                <span
                  className="category-filter-dot"
                  style={{ backgroundColor: markerColors[item].fill, borderColor: markerColors[item].stroke }}
                  aria-hidden="true"
                />
                {item}
              </button>
            ))}
          </div>
        </div>

        {locationError ? <p className="notice">{locationError}</p> : null}
        {visibleMapShrines.length === 0 ? <div className="map-empty">선택한 조건에 맞는 성지가 없습니다.</div> : null}

        <KakaoMapPanel
          shrines={visibleMapShrines}
          routeShrines={visibleRouteShrines}
          routeActive={courseMapActive}
          focusedShrineId={focusedShrineId}
          onClearRoute={() => setActiveCourseId(undefined)}
          onSelectShrine={handleSelectShrine}
        />
      </section>

      <aside className="info-side">
        <section className="tabbar" aria-label="주요 화면">
          <button className={activeTab === "map" ? "active" : ""} onClick={() => setActiveTab("map")}>소개</button>
          <button className={activeTab === "route" ? "active" : ""} onClick={() => setActiveTab("route")}>추천코스</button>
          <button className={activeTab === "records" ? "active" : ""} onClick={() => setActiveTab("records")}>기록</button>
          <button className={activeTab === "verify" ? "active" : ""} onClick={() => setActiveTab("verify")}>인증</button>
        </section>

        {activeTab === "map" ? (
          <section className="screen">
            <ShrineDetail
              shrine={focusedShrine}
              onVerify={() => {
                setVerifyShrineId(focusedShrine.id);
                setActiveTab("verify");
              }}
            />
            <section className="insight-card">
              <div className="panel-heading">
                <strong>인증 기록</strong>
                <span>{focusedVisits.length}건 · GPS {focusedVerifiedVisitCount}건</span>
              </div>

              {focusedVisits.length === 0 ? (
                <div className="empty-state compact">아직 이 성지에 남긴 인증 기록이 없습니다.</div>
              ) : (
                <>
                  <div className="visit-table">
                    {pagedFocusedVisits.map((visit) => (
                      <article key={visit.id} className="visit-row">
                        {visit.imageDataUrl ? (
                          <button
                            className="visit-photo-button"
                            onClick={() => setExpandedImage({ src: visit.imageDataUrl!, alt: `${focusedShrine.name} 인증 사진` })}
                            aria-label={`${focusedShrine.name} 인증 사진 크게 보기`}
                          >
                            <img src={visit.imageDataUrl} alt="" />
                          </button>
                        ) : (
                          <div className="visit-photo-placeholder">사진 없음</div>
                        )}
                        <div>
                          <div>
                            <span>{formatDateTime(visit.visitedAt ?? visit.createdAt)}</span>
                          </div>
                          <p>{visit.comment}</p>
                          <small>{visit.nickname}{visit.verified ? " · GPS 인증" : ""}</small>
                        </div>
                      </article>
                    ))}
                  </div>

                  {introVisitPageCount > 1 ? (
                    <nav className="pagination" aria-label="인증 기록 페이지">
                      {Array.from({ length: introVisitPageCount }, (_, index) => index + 1).map((page) => (
                        <button
                          key={page}
                          className={page === introVisitPageSafe ? "active" : ""}
                          onClick={() => setIntroVisitPage(page)}
                        >
                          {page}
                        </button>
                      ))}
                    </nav>
                  ) : null}
                </>
              )}
            </section>
          </section>
        ) : null}

        {activeTab === "route" ? (
          <section className="screen">
            <section className="insight-card">
              <div className="panel-heading">
                <strong>추천코스</strong>
                <span>{recommendedCourses.length}개</span>
              </div>
              <p className="course-guide">
                추천코스는 사용자가 직접 선택하는 경로가 아니라 지역, 신앙 주제, 이동 난이도를 기준으로 미리 구성한 순례 일정입니다.
                지금은 대표 코스를 코드에 넣어 보여주고, 이후 엑셀이나 관리자 화면에서 코스를 관리하는 구조로 확장하면 됩니다.
              </p>
            </section>

            <div className="course-list">
              {recommendedCourses.map((course) => {
                const courseShrines = resolveCourseShrines(course);
                const isActive = activeCourseId === course.id;
                return (
                  <article key={course.id} className={isActive ? "course-card active" : "course-card"}>
                    <div>
                      <span className="course-kicker">{course.theme}</span>
                      <h3>{course.title}</h3>
                      <p>{course.description}</p>
                      <div className="course-meta">
                        <span>{course.region}</span>
                        <span>{course.duration}</span>
                        <span>{courseShrines.length}곳</span>
                      </div>
                    </div>

                    <ol className="route-list compact">
                      {courseShrines.map((shrine, index) => (
                        <li key={shrine.id}>
                          <span className="step">{index + 1}</span>
                          <div>
                            <strong>{shrine.name}</strong>
                            <p>{shrine.diocese} · {shrine.address}</p>
                          </div>
                        </li>
                      ))}
                    </ol>

                    <div className="route-actions">
                      <button className={isActive ? "primary-action" : "secondary-action"} onClick={() => setActiveCourseId(course.id)}>
                        {isActive ? "지도 표시 중" : "지도에서 보기"}
                      </button>
                      {isActive ? (
                        <button className="secondary-action" onClick={() => setActiveCourseId(undefined)}>
                          전체 지도
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
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

            <button className="secondary-action" onClick={requestLocation}>현재 위치 확인</button>

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
            <div className="metric-grid">
              <div>
                <span>전체 인증</span>
                <strong>{visits.length}건</strong>
              </div>
              <div>
                <span>GPS 인증</span>
                <strong>{verifiedVisitCount}건</strong>
              </div>
              <div>
                <span>인증된 성지</span>
                <strong>{visitedShrineCount}곳</strong>
              </div>
            </div>

            <section className="insight-card">
              <div className="panel-heading">
                <strong>성지별 인증 통계</strong>
                <span>{shrineRecordStats.length}곳</span>
              </div>
              {shrineRecordStats.length === 0 ? (
                <div className="empty-state compact">아직 집계할 인증 기록이 없습니다.</div>
              ) : (
                <div className="stat-list">
                  {shrineRecordStats.map(({ shrine, count, verifiedCount }) => (
                    <button
                      key={shrine.id}
                      onClick={() => {
                        setActiveCourseId(undefined);
                        handleSelectShrine(shrine);
                      }}
                    >
                      <span>
                        <strong>{shrine.name}</strong>
                        <small>{shrine.region} · GPS {verifiedCount}건</small>
                      </span>
                      <b>{count}건</b>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </section>
        ) : null}
      </aside>

      {expandedImage ? (
        <div className="image-modal" role="dialog" aria-modal="true" onClick={() => setExpandedImage(undefined)}>
          <button className="image-modal-close" onClick={() => setExpandedImage(undefined)} aria-label="사진 닫기">
            닫기
          </button>
          <img src={expandedImage.src} alt={expandedImage.alt} onClick={(event) => event.stopPropagation()} />
        </div>
      ) : null}

      {showShrineList ? (
        <div className="list-modal" role="dialog" aria-modal="true" aria-label="성지 목록" onClick={() => setShowShrineList(false)}>
          <section className="list-modal-panel" onClick={(event) => event.stopPropagation()}>
            <div className="list-modal-header">
              <div>
                <strong>성지 목록</strong>
                <span>{shrines.length}곳</span>
              </div>
              <button onClick={() => setShowShrineList(false)}>닫기</button>
            </div>

            <div className="shrine-table-wrap">
              <table className="shrine-table">
                <thead>
                  <tr>
                    <th>
                      <button onClick={() => sortShrineList("diocese")}>교구{sortIndicator("diocese")}</button>
                    </th>
                    <th>
                      <button onClick={() => sortShrineList("category")}>성지구분{sortIndicator("category")}</button>
                    </th>
                    <th>
                      <button onClick={() => sortShrineList("name")}>성지명{sortIndicator("name")}</button>
                    </th>
                    <th>
                      <button onClick={() => sortShrineList("address")}>주소{sortIndicator("address")}</button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedShrineList.map((shrine) => (
                    <tr
                      key={shrine.id}
                      onClick={() => {
                        setActiveCourseId(undefined);
                        handleSelectShrine(shrine);
                        setShowShrineList(false);
                      }}
                    >
                      <td>{shrine.diocese}</td>
                      <td>{shrine.category}</td>
                      <td>{shrine.name}</td>
                      <td>{shrine.address}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function KakaoMapPanel({
  shrines: mapShrines,
  routeShrines,
  routeActive,
  focusedShrineId,
  onClearRoute,
  onSelectShrine
}: {
  shrines: Shrine[];
  routeShrines: Shrine[];
  routeActive: boolean;
  focusedShrineId: string;
  onClearRoute: () => void;
  onSelectShrine: (shrine: Shrine) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const markersRef = useRef<KakaoMarker[]>([]);
  const infoWindowsRef = useRef<KakaoInfoWindow[]>([]);
  const polylineRef = useRef<KakaoPolyline | null>(null);
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
    const centerShrine = mapShrines[0] ?? shrines[0];
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
    polylineRef.current?.setMap(null);
    markersRef.current = [];
    infoWindowsRef.current = [];
    polylineRef.current = null;

    const bounds = new kakaoMaps.LatLngBounds();
    const markerImages = CATEGORY_FILTERS.reduce((images, category) => {
      images[category] = new kakaoMaps.MarkerImage(
        markerSvgDataUrl(category),
        new kakaoMaps.Size(34, 42),
        { offset: new kakaoMaps.Point(17, 42) }
      );
      return images;
    }, {} as Record<ShrineCategory, KakaoMarkerImage>);

    mapShrines.forEach((shrine) => {
      const position = new kakaoMaps.LatLng(shrine.lat, shrine.lng);
      bounds.extend(position);

      const marker = new kakaoMaps.Marker({
        image: markerImages[shrine.category],
        map,
        position
      });
      const infoWindow = new kakaoMaps.InfoWindow({
        content: `<div class="kakao-info-window"><strong>${escapeHtml(shrine.name)}</strong><span>${escapeHtml(shrine.category)}</span></div>`
      });

      marker.setMap(map);
      markersRef.current.push(marker);
      infoWindowsRef.current.push(infoWindow);

      kakaoMaps.event.addListener(marker, "click", () => onSelectShrine(shrine));
      kakaoMaps.event.addListener(marker, "mouseover", () => infoWindow.open(map, marker));
      kakaoMaps.event.addListener(marker, "mouseout", () => infoWindow.close());
    });

    if (routeShrines.length > 1) {
      const routePath = routeShrines.map((shrine) => new kakaoMaps.LatLng(shrine.lat, shrine.lng));
      polylineRef.current = new kakaoMaps.Polyline({
        map,
        path: routePath,
        strokeColor: "#7c8794",
        strokeOpacity: 0.88,
        strokeStyle: "solid",
        strokeWeight: 5
      });
    }

    if (mapShrines.length > 1) {
      map.setBounds(bounds);
    }

    return () => {
      markersRef.current.forEach((marker) => marker.setMap(null));
      infoWindowsRef.current.forEach((infoWindow) => infoWindow.close());
      polylineRef.current?.setMap(null);
    };
  }, [mapShrines, onSelectShrine, routeShrines, status]);

  useEffect(() => {
    if (status !== "ready" || !mapRef.current || !window.kakao?.maps) {
      return;
    }

    const shrine = shrines.find((item) => item.id === focusedShrineId);
    if (!shrine) {
      return;
    }

    mapRef.current.setCenter(new window.kakao.maps.LatLng(shrine.lat, shrine.lng));
  }, [focusedShrineId, status]);

  return (
    <div className="map-panel" aria-label="카카오 성지 지도">
      <div ref={containerRef} className="kakao-map" />
      {routeActive ? (
        <div className="route-map-badge">
          <span>추천코스 표시 중</span>
          <button onClick={onClearRoute}>전체 지도</button>
        </div>
      ) : null}
      {status === "loading" ? <div className="map-caption">Kakao Maps 로딩 중</div> : null}
      {status === "missing-key" ? <div className="map-caption warning">NEXT_PUBLIC_KAKAO_MAP_KEY 환경변수가 필요합니다.</div> : null}
      {status === "error" ? <div className="map-caption warning">Kakao Maps를 불러오지 못했습니다. 도메인 등록을 확인해 주세요.</div> : null}
    </div>
  );
}

function ShrineDetail({
  shrine,
  onVerify
}: {
  shrine: Shrine;
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
        <button onClick={onVerify}>나도 인증하기</button>
      </div>
    </article>
  );
}
