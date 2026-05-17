"use client";

import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { recommendedCourses, type RecommendedCourse } from "@/data/courses";
import { shrines, type Shrine, type ShrineCategory } from "@/data/shrines";
import { distanceKm, type LatLng } from "@/lib/geo";
import { saveVisitRecord, subscribeVisitRecords, uploadVisitPhoto, type VisitRecord } from "@/lib/storage";

const categoryStyle: Record<ShrineCategory, { color: string; bg: string }> = {
  성지: { color: "#9f6b00", bg: "#fff4cc" },
  순교사적지: { color: "#b42318", bg: "#ffe4df" },
  순례지: { color: "#175cd3", bg: "#dbeafe" }
};

const VERIFY_RADIUS_METERS = 500;
const MAX_VISIT_PHOTO_BYTES = 500 * 1024;
const MAX_VISIT_PHOTO_EDGE = 1280;
const SUPPORTED_VISIT_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
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
type CourseRoute = {
  id: string;
  title: string;
  color: string;
  shrines: Shrine[];
};
type RecordViewMode = "all" | "byShrine";
type RecordSortMode = "latest" | "shrine";

const courseColors = ["#2648bd", "#b7791f", "#b85c55", "#4f7fc4", "#6f7f5f"];

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

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString("ko-KR", {
    month: "2-digit",
    day: "2-digit"
  });
}

function formatDistanceLabel(distance: number) {
  return `${distance.toFixed(distance >= 10 ? 0 : 1)}km`;
}

function AnimatedMetric({ value, suffix }: { value: number; suffix: string }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setDisplayValue(value);
      return;
    }

    const duration = 720;
    const startTime = performance.now();
    const startValue = 0;

    function tick(now: number) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(startValue + (value - startValue) * eased));

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }

    const frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <strong>
      {displayValue}
      {suffix}
    </strong>
  );
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

function uniqueShrines(items: Shrine[]) {
  const seen = new Set<string>();
  return items.filter((shrine) => {
    if (seen.has(shrine.id)) {
      return false;
    }
    seen.add(shrine.id);
    return true;
  });
}

async function compressVisitPhoto(file: File) {
  const browserReadableFile = isHeicFile(file) ? await convertHeicToJpeg(file) : file;
  const image = await loadImage(browserReadableFile);
  const scale = Math.min(1, MAX_VISIT_PHOTO_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("이미지를 처리하지 못했습니다.");
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  for (const quality of [0.82, 0.72, 0.62, 0.52, 0.44]) {
    const blob = await canvasToBlob(canvas, quality);
    if (blob.size <= MAX_VISIT_PHOTO_BYTES || quality === 0.44) {
      return blob;
    }
  }

  throw new Error("이미지를 압축하지 못했습니다.");
}

function isHeicFile(file: File) {
  const normalizedName = file.name.toLowerCase();
  return file.type === "image/heic" || file.type === "image/heif" || normalizedName.endsWith(".heic") || normalizedName.endsWith(".heif");
}

async function convertHeicToJpeg(file: File) {
  const { default: heic2any } = await import("heic2any");
  const converted = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.86
  });
  const blob = Array.isArray(converted) ? converted[0] : converted;

  if (!blob) {
    throw new Error("HEIC 사진을 변환하지 못했습니다.");
  }

  return new File([blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" });
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("이미지 파일을 읽지 못했습니다."));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error("이미지를 압축하지 못했습니다."));
      },
      "image/jpeg",
      quality
    );
  });
}

function VisitRecordRow({
  visit,
  shrineLabel,
  onImageOpen
}: {
  visit: VisitRecord;
  shrineLabel?: string;
  onImageOpen: (url: string) => void;
}) {
  const visitedAt = formatDateTime(visit.visitedAt ?? visit.createdAt);

  return (
    <article className={`visit-row ${visit.photoUrl ? "has-photo" : ""}`}>
      {visit.photoUrl ? (
        <button className="visit-photo-button" type="button" onClick={() => onImageOpen(visit.photoUrl as string)}>
          <img src={visit.photoUrl} alt={`${visit.nickname} 인증 사진`} loading="lazy" />
        </button>
      ) : null}
      <div>
        <div className="visit-row-meta">
          <strong>
            {shrineLabel ? shrineLabel : ""}
            {shrineLabel && visit.verified ? " · " : ""}
            {visit.verified ? "GPS 인증" : ""}
          </strong>
          <span>{visitedAt}</span>
        </div>
        <p>{visit.comment}</p>
        <small>{visit.nickname}</small>
      </div>
    </article>
  );
}

function RecordPagination({
  label,
  page,
  pageCount,
  onPageChange
}: {
  label: string;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  if (pageCount <= 1) {
    return null;
  }

  return (
    <nav className="pagination" aria-label={label}>
      {Array.from({ length: pageCount }, (_, index) => index + 1).map((item) => (
        <button key={item} className={item === page ? "active" : ""} onClick={() => onPageChange(item)}>
          {item}
        </button>
      ))}
    </nav>
  );
}

export default function PilgrimageApp() {
  const [activeTab, setActiveTab] = useState<"route" | "map" | "records" | "verify">("route");
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
  const [visitPhotoFile, setVisitPhotoFile] = useState<File | undefined>();
  const [visitPhotoPreview, setVisitPhotoPreview] = useState("");
  const [photoInputKey, setPhotoInputKey] = useState(0);
  const [expandedImage, setExpandedImage] = useState<string | undefined>();
  const [introVisitPage, setIntroVisitPage] = useState(1);
  const [showShrineList, setShowShrineList] = useState(false);
  const [shrineSortKey, setShrineSortKey] = useState<ShrineSortKey>("diocese");
  const [shrineSortDirection, setShrineSortDirection] = useState<SortDirection>("asc");
  const [activeCourseId, setActiveCourseId] = useState<string | undefined>();
  const [recordViewMode, setRecordViewMode] = useState<RecordViewMode>("all");
  const [recordSortMode, setRecordSortMode] = useState<RecordSortMode>("latest");
  const [selectedRecordShrineId, setSelectedRecordShrineId] = useState<string | undefined>();
  const [allRecordPage, setAllRecordPage] = useState(1);
  const [selectedShrineRecordPage, setSelectedShrineRecordPage] = useState(1);
  const [visitSaveStatus, setVisitSaveStatus] = useState<"idle" | "saving">("idle");
  const [visitSyncError, setVisitSyncError] = useState("");
  const selectedRecordSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return subscribeVisitRecords(
      (records) => {
        setVisits(records);
        setVisitSyncError("");
      },
      (message) => setVisitSyncError(`인증 기록을 불러오지 못했습니다. ${message}`)
    );
  }, []);

  useEffect(() => {
    if (!visitPhotoFile) {
      setVisitPhotoPreview("");
      return;
    }

    const objectUrl = URL.createObjectURL(visitPhotoFile);
    setVisitPhotoPreview(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [visitPhotoFile]);

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
  const allRecentVisits = useMemo(
    () =>
      [...visits].sort(
        (a, b) => new Date(b.visitedAt ?? b.createdAt).getTime() - new Date(a.visitedAt ?? a.createdAt).getTime()
      ),
    [visits]
  );
  const sortedAllVisits = useMemo(() => {
    if (recordSortMode === "latest") {
      return allRecentVisits;
    }

    return [...allRecentVisits].sort((a, b) => {
      const shrineA = shrines.find((item) => item.id === a.shrineId);
      const shrineB = shrines.find((item) => item.id === b.shrineId);
      return (
        (shrineA?.name ?? "성지").localeCompare(shrineB?.name ?? "성지", "ko") ||
        new Date(b.visitedAt ?? b.createdAt).getTime() - new Date(a.visitedAt ?? a.createdAt).getTime()
      );
    });
  }, [allRecentVisits, recordSortMode]);
  const allRecordPageCount = Math.max(1, Math.ceil(sortedAllVisits.length / VISITS_PER_PAGE));
  const allRecordPageSafe = Math.min(allRecordPage, allRecordPageCount);
  const pagedAllVisits = sortedAllVisits.slice(
    (allRecordPageSafe - 1) * VISITS_PER_PAGE,
    allRecordPageSafe * VISITS_PER_PAGE
  );
  const courseRoutes = useMemo(
    () =>
      recommendedCourses.map((course, index) => ({
        id: course.id,
        title: course.title,
        color: courseColors[index % courseColors.length],
        shrines: resolveCourseShrines(course)
      })),
    []
  );
  const shownCourseRoutes = activeCourseId ? courseRoutes.filter((course) => course.id === activeCourseId) : courseRoutes;
  const courseMapShrines = uniqueShrines(shownCourseRoutes.flatMap((course) => course.shrines));
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
    .map((shrine) => {
      const shrineVisits = allRecentVisits.filter((visit) => visit.shrineId === shrine.id);
      const latestVisit = shrineVisits[0];

      return {
        shrine,
        count: shrineVisits.length,
        verifiedCount: shrineVisits.filter((visit) => visit.verified).length,
        latestVisit,
        latestTime: latestVisit ? new Date(latestVisit.visitedAt ?? latestVisit.createdAt).getTime() : 0
      };
    })
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count || a.shrine.name.localeCompare(b.shrine.name, "ko"));
  const topShrineRecordStats = shrineRecordStats.slice(0, 5);
  const topShrineDashboardStats = shrineRecordStats.slice(0, 10);
  const recentThreshold = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentShrineRecordStats = shrineRecordStats
    .map((item) => ({
      ...item,
      recentCount: allRecentVisits.filter(
        (visit) =>
          visit.shrineId === item.shrine.id &&
          new Date(visit.visitedAt ?? visit.createdAt).getTime() >= recentThreshold
      ).length
    }))
    .filter((item) => item.recentCount > 0)
    .sort((a, b) => b.recentCount - a.recentCount || b.latestTime - a.latestTime)
    .slice(0, 3);
  const trendingShrineRecordStats =
    recentShrineRecordStats.length > 0
      ? recentShrineRecordStats
      : shrineRecordStats
          .slice()
          .sort((a, b) => b.latestTime - a.latestTime)
          .slice(0, 3)
          .map((item) => ({ ...item, recentCount: 0 }));
  const dioceseRecordStats = Array.from(new Set(shrines.map((shrine) => shrine.diocese)))
    .map((diocese) => {
      const items = shrineRecordStats.filter((item) => item.shrine.diocese === diocese);
      const count = items.reduce((sum, item) => sum + item.count, 0);
      const verifiedCount = items.reduce((sum, item) => sum + item.verifiedCount, 0);
      const topShrine = items.slice().sort((a, b) => b.count - a.count || a.shrine.name.localeCompare(b.shrine.name, "ko"))[0]?.shrine;

      return { diocese, count, verifiedCount, topShrine };
    })
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count || a.diocese.localeCompare(b.diocese, "ko"))
    .slice(0, 5);
  const maxDioceseRecordCount = Math.max(...dioceseRecordStats.map((item) => item.count), 1);
  const selectedRecordShrine = selectedRecordShrineId
    ? shrines.find((shrine) => shrine.id === selectedRecordShrineId)
    : undefined;
  const selectedShrineRecords = selectedRecordShrine
    ? allRecentVisits.filter((visit) => visit.shrineId === selectedRecordShrine.id)
    : [];
  const selectedShrineRecordPageCount = Math.max(1, Math.ceil(selectedShrineRecords.length / VISITS_PER_PAGE));
  const selectedShrineRecordPageSafe = Math.min(selectedShrineRecordPage, selectedShrineRecordPageCount);
  const pagedSelectedShrineRecords = selectedShrineRecords.slice(
    (selectedShrineRecordPageSafe - 1) * VISITS_PER_PAGE,
    selectedShrineRecordPageSafe * VISITS_PER_PAGE
  );
  const recordShrineOptions = useMemo(() => [...shrines].sort((a, b) => a.name.localeCompare(b.name, "ko")), []);
  const activeCourseShrineIds = useMemo(() => new Set(activeCourseShrines.map((shrine) => shrine.id)), [activeCourseShrines]);
  const activeCourseTotalDistance = useMemo(() => {
    if (activeCourseShrines.length < 2) {
      return 0;
    }

    return activeCourseShrines.slice(0, -1).reduce((sum, shrine, index) => {
      return sum + distanceKm(shrine, activeCourseShrines[index + 1]);
    }, 0);
  }, [activeCourseShrines]);
  const activeCourseSegments = useMemo(() => {
    return activeCourseShrines.map((shrine, index) => ({
      shrine,
      visitCount: allRecentVisits.filter((visit) => visit.shrineId === shrine.id).length,
      nextDistanceKm:
        index < activeCourseShrines.length - 1 ? distanceKm(shrine, activeCourseShrines[index + 1]) : undefined
    }));
  }, [activeCourseShrines, allRecentVisits]);
  const activeCourseVisits = useMemo(
    () => allRecentVisits.filter((visit) => activeCourseShrineIds.has(visit.shrineId)),
    [activeCourseShrineIds, allRecentVisits]
  );
  const activeCourseVisitedShrineCount = new Set(activeCourseVisits.map((visit) => visit.shrineId)).size;
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

  function selectRecordShrine(shrineId?: string, shouldScroll = false) {
    setSelectedRecordShrineId(shrineId || undefined);
    setSelectedShrineRecordPage(1);

    if (shouldScroll && shrineId) {
      window.setTimeout(() => {
        selectedRecordSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    }
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

  async function handleVisitPhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      setVisitPhotoFile(undefined);
      return;
    }

    if (!SUPPORTED_VISIT_PHOTO_TYPES.includes(file.type) && !isHeicFile(file)) {
      window.alert("JPG, PNG, WebP, HEIC 이미지만 등록할 수 있습니다.");
      event.target.value = "";
      setVisitPhotoFile(undefined);
      return;
    }

    try {
      setVisitSaveStatus("saving");
      setVisitSyncError("");
      setVisitPhotoFile(isHeicFile(file) ? await convertHeicToJpeg(file) : file);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "사진 파일을 읽지 못했습니다.");
      event.target.value = "";
      setVisitPhotoFile(undefined);
    } finally {
      setVisitSaveStatus("idle");
    }
  }

  function clearVisitPhoto() {
    setVisitPhotoFile(undefined);
    setPhotoInputKey((current) => current + 1);
  }

  async function submitVisit() {
    const trimmedNickname = nickname.trim();
    const trimmedComment = comment.trim();

    if (!trimmedNickname || !trimmedComment) {
      window.alert("닉네임과 한줄소감을 입력해 주세요.");
      return;
    }

    const visitedAt = new Date().toISOString();
    setVisitSaveStatus("saving");
    setVisitSyncError("");

    try {
      const photoUrl = visitPhotoFile
        ? await uploadVisitPhoto(await compressVisitPhoto(visitPhotoFile), verifyShrineId)
        : undefined;

      await saveVisitRecord({
        shrineId: verifyShrineId,
        nickname: trimmedNickname,
        comment: trimmedComment,
        visitedAt,
        userLat: position?.lat,
        userLng: position?.lng,
        distanceMeters: verifyDistanceMeters,
        photoUrl,
        verified: Boolean(canVerify)
      });
      setComment("");
      clearVisitPhoto();
      setActiveTab("records");
    } catch (error) {
      setVisitSyncError(error instanceof Error ? error.message : "방문 기록 저장 중 오류가 발생했습니다.");
    } finally {
      setVisitSaveStatus("idle");
    }
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">✝️ 한국 천주교 성지순례</p>
          <h1>성지GO</h1>
          <p>전국 성지 코스를 살펴보고 방문기록을 쌓아보세요.</p>
        </div>
        <nav className="app-nav" aria-label="주요 화면">
          <button className={activeTab === "route" ? "active" : ""} onClick={() => setActiveTab("route")}>추천코스</button>
          <button className={activeTab === "map" ? "active" : ""} onClick={() => setActiveTab("map")}>성지지도</button>
          <button className={activeTab === "records" ? "active" : ""} onClick={() => setActiveTab("records")}>인증기록</button>
          <button className={activeTab === "verify" ? "active" : ""} onClick={() => setActiveTab("verify")}>방문인증</button>
        </nav>
      </header>

      {activeTab === "map" ? (
        <>
      <section className="map-side">
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
        <section className="screen">
          <div className="detail-topbar">
            <button className="list-button subtle-list-button" onClick={() => setShowShrineList(true)}>
              성지목록보기
            </button>
          </div>
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
                    <VisitRecordRow key={visit.id} visit={visit} onImageOpen={setExpandedImage} />
                  ))}
                </div>

                {introVisitPageCount > 1 ? (
                  <RecordPagination
                    label="인증 기록 페이지"
                    page={introVisitPageSafe}
                    pageCount={introVisitPageCount}
                    onPageChange={setIntroVisitPage}
                  />
                ) : null}
              </>
            )}
          </section>
        </section>
      </aside>
        </>
      ) : null}

      {activeTab === "route" ? (
        <section className="course-dashboard">
          <section className="course-map-workspace">
            <div className="course-map-card">
              <div className="course-map-shell">
                <aside className="course-map-sidebar">
                  <div className="course-map-overlay">
                    <div>
                      <strong>추천코스 지도</strong>
                    </div>
                    <div className="course-filter-list">
                      <button className={!activeCourseId ? "active" : ""} onClick={() => setActiveCourseId(undefined)}>
                        <i style={{ backgroundColor: "#9aa3af" }} />
                        전체 코스
                      </button>
                      {courseRoutes.map((course) => (
                        <button
                          key={course.id}
                          className={activeCourseId === course.id ? "active" : ""}
                          onClick={() => setActiveCourseId(course.id)}
                        >
                          <i style={{ backgroundColor: course.color }} />
                          {course.title}
                        </button>
                      ))}
                    </div>
                  </div>
                </aside>
                <div className="course-map-canvas">
                  <KakaoMapPanel
                    shrines={courseMapShrines}
                    routeShrines={EMPTY_ROUTE_SHRINES}
                    routeActive={Boolean(activeCourseId)}
                    courseRoutes={shownCourseRoutes}
                    focusedShrineId={focusedShrineId}
                    onClearRoute={() => setActiveCourseId(undefined)}
                    onSelectShrine={handleSelectShrine}
                  />
                </div>
              </div>
            </div>
          </section>

          <aside className="records-workspace">
            <section className="course-detail-panel">
              {activeCourse ? (
                <>
                  <section className="insight-card">
                    <div className="record-section-title">
                      <div>
                        <strong>{activeCourse.title}</strong>
                      </div>
                      <span>{activeCourse.region}</span>
                    </div>
                    <div className="course-meta-row">
                      <span>{activeCourse.theme}</span>
                      <span>{activeCourse.duration}</span>
                      <span>{activeCourse.transport}</span>
                    </div>
                    <div className="course-summary-grid">
                      <div>
                        <span>성지 수</span>
                        <strong>{activeCourseShrines.length}곳</strong>
                      </div>
                      <div>
                        <span>총 거리</span>
                        <strong>{formatDistanceLabel(activeCourseTotalDistance)}</strong>
                      </div>
                      <div>
                        <span>인증 건수</span>
                        <strong>{activeCourseVisits.length}건</strong>
                      </div>
                      <div>
                        <span>인증 성지</span>
                        <strong>{activeCourseVisitedShrineCount}곳</strong>
                      </div>
                    </div>
                    <p className="course-description">{activeCourse.description}</p>
                  </section>

                  <section className="insight-card">
                    <div className="record-section-title">
                      <div>
                        <strong>코스 순서</strong>
                      </div>
                      <span>{activeCourseShrines.length}개 성지</span>
                    </div>
                    <div className="course-stop-list">
                      {activeCourseSegments.map(({ shrine, visitCount, nextDistanceKm }, index) => (
                        <article key={shrine.id} className="course-stop-card">
                          <div className="course-stop-index">{index + 1}</div>
                          <div className="course-stop-body">
                            <div className="course-stop-heading">
                              <strong>{shrine.name}</strong>
                              <b>{visitCount}건</b>
                            </div>
                            <span>{shrine.diocese}</span>
                            <p>{shrine.address}</p>
                            <div className="course-stop-meta">
                              {nextDistanceKm !== undefined ? (
                                <small>다음 성지까지 {formatDistanceLabel(nextDistanceKm)}</small>
                              ) : (
                                <small>마지막 성지</small>
                              )}
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                </>
              ) : (
                <section className="insight-card">
                  <div className="record-section-title">
                    <div>
                      <strong>추천코스 안내</strong>
                    </div>
                    <span>{recommendedCourses.length}개 코스</span>
                  </div>
                  <p className="course-description">
                    지도에서 코스를 선택하면 코스 설명, 성지 순서, 구간 거리와 간단한 인증 요약을 볼 수 있습니다.
                  </p>
                  <div className="course-summary-grid compact">
                    <div>
                      <span>전체 코스</span>
                      <strong>{recommendedCourses.length}개</strong>
                    </div>
                    <div>
                      <span>전체 인증</span>
                      <strong>{visits.length}건</strong>
                    </div>
                    <div>
                      <span>인증 성지</span>
                      <strong>{visitedShrineCount}곳</strong>
                    </div>
                  </div>
                </section>
              )}
            </section>
          </aside>
        </section>
      ) : null}

      {activeTab === "verify" ? (
        <section className="content-screen narrow">
          <div className="form-card">
            <label>
              방문 성지
              <select value={verifyShrineId} onChange={(event) => setVerifyShrineId(event.target.value)}>
                {recordShrineOptions.map((shrine) => (
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
              인증 사진 <span className="field-hint">(JPG, PNG, WebP, HEIC · 500KB 내외로 자동 변환/압축)</span>
              <input key={photoInputKey} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" onChange={handleVisitPhotoChange} />
            </label>

            {visitPhotoPreview ? (
              <div className="visit-photo-preview">
                <img src={visitPhotoPreview} alt="선택한 인증 사진 미리보기" />
                <button type="button" onClick={clearVisitPhoto}>
                  사진 지우기
                </button>
              </div>
            ) : null}

            {visitSyncError ? <p className="notice compact">{visitSyncError}</p> : null}

            <button className="primary-action" onClick={submitVisit} disabled={visitSaveStatus === "saving"}>
              {visitSaveStatus === "saving" ? "저장 중" : "방문 기록 남기기"}
            </button>
          </div>
        </section>
      ) : null}

      {activeTab === "records" ? (
        <section className="content-screen">
          <div className="metric-grid">
            <div>
              <span>전체 인증</span>
              <AnimatedMetric value={visits.length} suffix="건" />
            </div>
            <div>
              <span>GPS 인증</span>
              <AnimatedMetric value={verifiedVisitCount} suffix="건" />
            </div>
            <div>
              <span>인증된 성지</span>
              <AnimatedMetric value={visitedShrineCount} suffix="곳" />
            </div>
          </div>

          <section className="insight-card">
            <div className="record-section-title">
              <div>
                <strong>성지별 인증 통계</strong>
              </div>
              <span>상위 {topShrineDashboardStats.length}곳</span>
            </div>
            {shrineRecordStats.length === 0 ? (
              <div className="empty-state compact">아직 집계할 인증 기록이 없습니다.</div>
            ) : (
              <>
                <div className="record-stat-grid">
                  {topShrineDashboardStats.map(({ shrine, count }) => (
                    <button
                      key={shrine.id}
                      className={`record-stat-card ${selectedRecordShrine?.id === shrine.id ? "active" : ""}`}
                      onClick={() => selectRecordShrine(shrine.id, true)}
                    >
                      <strong>{shrine.name}</strong>
                      <span>{shrine.diocese}</span>
                      <b>{count}건</b>
                    </button>
                  ))}
                </div>

                <section className="record-mini-section">
                  <div className="record-section-title compact">
                    <div>
                      <strong>최근 뜨는 성지</strong>
                    </div>
                    <span>{recentShrineRecordStats.length > 0 ? "최근 7일" : "최근 인증순"}</span>
                  </div>
                  <div className="trend-grid">
                    {trendingShrineRecordStats.map(({ shrine, recentCount, latestVisit }) => (
                      <button
                        key={shrine.id}
                        className={selectedRecordShrine?.id === shrine.id ? "active" : ""}
                        onClick={() => selectRecordShrine(shrine.id, true)}
                      >
                        <strong>{shrine.name}</strong>
                        <span>
                          {recentCount > 0
                            ? `최근 7일 ${recentCount}건`
                            : `최근 ${latestVisit ? formatShortDate(latestVisit.visitedAt ?? latestVisit.createdAt) : "-"}`}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="record-mini-section">
                  <div className="record-section-title compact">
                    <div>
                      <strong>교구별 인증 현황</strong>
                    </div>
                    <span>{dioceseRecordStats.length}개 교구</span>
                  </div>
                  <div className="diocese-bars">
                    {dioceseRecordStats.map(({ diocese, count, verifiedCount, topShrine }) => (
                      <div key={diocese} className="diocese-bar-row">
                        <div>
                          <strong>{diocese}</strong>
                          <span>{topShrine ? `대표 ${topShrine.name}` : `GPS ${verifiedCount}건`}</span>
                        </div>
                        <div className="diocese-bar-track" aria-hidden="true">
                          <i style={{ width: `${Math.max(8, (count / maxDioceseRecordCount) * 100)}%` }} />
                        </div>
                        <b>{count}건</b>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="record-pick-section">
                  <div className="record-section-title compact">
                    <div>
                      <strong>전체 성지 선택</strong>
                    </div>
                    <span>직접 선택</span>
                  </div>
                  <label className="record-shrine-picker">
                    <select
                      value={selectedRecordShrineId ?? ""}
                      onChange={(event) => selectRecordShrine(event.target.value)}
                    >
                      <option value="">전체</option>
                      {recordShrineOptions.map((shrine) => (
                        <option key={shrine.id} value={shrine.id}>
                          {shrine.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </section>

                {selectedRecordShrine ? (
                  <>
                    <div className="panel-heading sub" ref={selectedRecordSectionRef}>
                      <strong>{selectedRecordShrine.name} 인증</strong>
                      <span>{selectedShrineRecords.length}건</span>
                    </div>
                    <div className="visit-table">
                      {pagedSelectedShrineRecords.map((visit) => (
                        <VisitRecordRow key={visit.id} visit={visit} onImageOpen={setExpandedImage} />
                      ))}
                    </div>
                    <RecordPagination
                      label={`${selectedRecordShrine.name} 인증 페이지`}
                      page={selectedShrineRecordPageSafe}
                      pageCount={selectedShrineRecordPageCount}
                      onPageChange={setSelectedShrineRecordPage}
                    />
                  </>
                ) : (
                  <div className="empty-state compact">성지를 선택하면 해당 인증 기록을 볼 수 있습니다.</div>
                )}
              </>
            )}
          </section>
        </section>
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

      {expandedImage ? (
        <div className="image-modal" role="dialog" aria-modal="true" aria-label="인증 사진 크게 보기" onClick={() => setExpandedImage(undefined)}>
          <button className="image-modal-close" type="button" onClick={() => setExpandedImage(undefined)}>
            닫기
          </button>
          <img src={expandedImage} alt="인증 사진 확대" onClick={(event) => event.stopPropagation()} />
        </div>
      ) : null}

      <footer className="site-credit">-created by alicia (pilgrimage.alicia@gmail.com)-</footer>
    </main>
  );
}

function KakaoMapPanel({
  shrines: mapShrines,
  routeShrines,
  routeActive,
  courseRoutes = [],
  focusedShrineId,
  onClearRoute,
  onSelectShrine
}: {
  shrines: Shrine[];
  routeShrines: Shrine[];
  routeActive: boolean;
  courseRoutes?: CourseRoute[];
  focusedShrineId: string;
  onClearRoute: () => void;
  onSelectShrine: (shrine: Shrine) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const markersRef = useRef<KakaoMarker[]>([]);
  const infoWindowsRef = useRef<KakaoInfoWindow[]>([]);
  const polylineRefs = useRef<KakaoPolyline[]>([]);
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
    polylineRefs.current.forEach((polyline) => polyline.setMap(null));
    markersRef.current = [];
    infoWindowsRef.current = [];
    polylineRefs.current = [];

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
      const polyline = new kakaoMaps.Polyline({
        map,
        path: routePath,
        strokeColor: "#7c8794",
        strokeOpacity: 0.88,
        strokeStyle: "solid",
        strokeWeight: 5
      });
      polylineRefs.current.push(polyline);
    }

    courseRoutes.forEach((course) => {
      if (course.shrines.length < 2) {
        return;
      }

      const routePath = course.shrines.map((shrine) => new kakaoMaps.LatLng(shrine.lat, shrine.lng));
      const polyline = new kakaoMaps.Polyline({
        map,
        path: routePath,
        strokeColor: course.color,
        strokeOpacity: 0.86,
        strokeStyle: "solid",
        strokeWeight: 5
      });
      polylineRefs.current.push(polyline);
    });

    if (mapShrines.length > 1) {
      map.setBounds(bounds);
    }

    return () => {
      markersRef.current.forEach((marker) => marker.setMap(null));
      infoWindowsRef.current.forEach((infoWindow) => infoWindow.close());
      polylineRefs.current.forEach((polyline) => polyline.setMap(null));
    };
  }, [courseRoutes, mapShrines, onSelectShrine, routeShrines, status]);

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
