"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { categories, shrines, type Shrine, type ShrineCategory } from "@/data/shrines";
import { distanceKm, estimatedDriveMinutes, optimizeRoute, totalRouteDistanceKm, type LatLng } from "@/lib/geo";
import { loadVisitRecords, saveVisitRecords, type VisitRecord } from "@/lib/storage";

const categoryStyle: Record<ShrineCategory, { color: string; bg: string }> = {
  성지: { color: "#9f6b00", bg: "#fff4cc" },
  순교사적지: { color: "#b42318", bg: "#ffe4df" },
  순례지: { color: "#175cd3", bg: "#dbeafe" }
};

const VERIFY_RADIUS_METERS = 500;

export default function PilgrimageApp() {
  const [activeTab, setActiveTab] = useState<"map" | "route" | "verify" | "records">("map");
  const [category, setCategory] = useState<(typeof categories)[number]>("전체");
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

  useEffect(() => {
    setVisits(loadVisitRecords());
  }, []);

  const filteredShrines = useMemo(() => {
    return shrines.filter((shrine) => {
      const matchesCategory = category === "전체" || shrine.category === category;
      const normalizedQuery = query.trim().toLowerCase();
      const matchesQuery =
        normalizedQuery.length === 0 ||
        shrine.name.toLowerCase().includes(normalizedQuery) ||
        shrine.address.toLowerCase().includes(normalizedQuery) ||
        shrine.diocese.toLowerCase().includes(normalizedQuery);

      return matchesCategory && matchesQuery;
    });
  }, [category, query]);

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

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      if (current.includes(id)) {
        return current.filter((selectedId) => selectedId !== id);
      }
      return [...current, id];
    });
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

    const nextVisit: VisitRecord = {
      id: `${Date.now()}-${verifyShrineId}`,
      shrineId: verifyShrineId,
      nickname: trimmedNickname,
      comment: trimmedComment,
      imageDataUrl,
      createdAt: new Date().toISOString(),
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
      <section className="topbar">
        <div>
          <p className="eyebrow">Catholic Pilgrimage KR</p>
          <h1>성지순례 지도</h1>
        </div>
        <button className="location-button" onClick={requestLocation}>
          현재 위치
        </button>
      </section>

      {locationError ? <p className="notice">{locationError}</p> : null}

      <section className="tabbar" aria-label="주요 화면">
        <button className={activeTab === "map" ? "active" : ""} onClick={() => setActiveTab("map")}>지도</button>
        <button className={activeTab === "route" ? "active" : ""} onClick={() => setActiveTab("route")}>코스</button>
        <button className={activeTab === "verify" ? "active" : ""} onClick={() => setActiveTab("verify")}>인증</button>
        <button className={activeTab === "records" ? "active" : ""} onClick={() => setActiveTab("records")}>기록</button>
      </section>

      {activeTab === "map" ? (
        <section className="screen">
          <div className="filters">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="성지명, 교구, 주소 검색" />
            <div className="chips">
              {categories.map((item) => (
                <button key={item} className={category === item ? "selected" : ""} onClick={() => setCategory(item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="map-panel" aria-label="성지 지도 미리보기">
            {filteredShrines.map((shrine, index) => {
              const selected = selectedIds.includes(shrine.id);
              const left = 12 + ((index * 23) % 74);
              const top = 16 + ((index * 31) % 64);
              return (
                <button
                  key={shrine.id}
                  className={`map-marker ${selected ? "picked" : ""}`}
                  style={{ left: `${left}%`, top: `${top}%`, background: categoryStyle[shrine.category].color }}
                  onClick={() => {
                    setFocusedShrineId(shrine.id);
                    toggleSelected(shrine.id);
                  }}
                  title={shrine.name}
                >
                  {index + 1}
                </button>
              );
            })}
            <div className="map-caption">Kakao Maps API 연동 전 임시 지도 화면</div>
          </div>

          <ShrineDetail shrine={focusedShrine} selected={selectedIds.includes(focusedShrine.id)} onToggle={() => toggleSelected(focusedShrine.id)} />

          <div className="list">
            {filteredShrines.map((shrine) => (
              <ShrineRow
                key={shrine.id}
                shrine={shrine}
                selected={selectedIds.includes(shrine.id)}
                visited={visitedShrineIds.has(shrine.id)}
                onFocus={() => setFocusedShrineId(shrine.id)}
                onToggle={() => toggleSelected(shrine.id)}
              />
            ))}
          </div>
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
            <p>{visitedShrineIds.size} / {shrines.length}곳 방문 기록</p>
          </div>

          {visits.length === 0 ? (
            <div className="empty-state">아직 남긴 방문 기록이 없습니다.</div>
          ) : (
            <div className="record-list">
              {visits.map((visit) => {
                const shrine = shrines.find((item) => item.id === visit.shrineId);
                return (
                  <article key={visit.id} className="record-card">
                    {visit.imageDataUrl ? <img src={visit.imageDataUrl} alt="" /> : null}
                    <div>
                      <span className={`record-badge ${visit.verified ? "verified" : ""}`}>{visit.verified ? "GPS 인증" : "기록 저장"}</span>
                      <h3>{shrine?.name ?? "알 수 없는 성지"}</h3>
                      <p>{visit.comment}</p>
                      <small>{visit.nickname} · {new Date(visit.createdAt).toLocaleString("ko-KR")}</small>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}

function ShrineDetail({ shrine, selected, onToggle }: { shrine: Shrine; selected: boolean; onToggle: () => void }) {
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
      </div>
    </article>
  );
}

function ShrineRow({
  shrine,
  selected,
  visited,
  onFocus,
  onToggle
}: {
  shrine: Shrine;
  selected: boolean;
  visited: boolean;
  onFocus: () => void;
  onToggle: () => void;
}) {
  return (
    <article className="shrine-row" onClick={onFocus}>
      <div>
        <span className="category-badge" style={{ color: categoryStyle[shrine.category].color, background: categoryStyle[shrine.category].bg }}>
          {shrine.category}
        </span>
        {visited ? <span className="visited-badge">방문</span> : null}
        <h3>{shrine.name}</h3>
        <p>{shrine.diocese} · {shrine.region}</p>
      </div>
      <button onClick={(event) => { event.stopPropagation(); onToggle(); }}>{selected ? "해제" : "선택"}</button>
    </article>
  );
}
