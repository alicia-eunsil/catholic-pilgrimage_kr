export type VisitRecord = {
  id: string;
  shrineId: string;
  nickname: string;
  comment: string;
  imageDataUrl?: string;
  createdAt: string;
  visitedAt?: string;
  userLat?: number;
  userLng?: number;
  distanceMeters?: number;
  verified: boolean;
};

const STORAGE_KEY = "catholic-pilgrimage-kr-visits";

export function loadVisitRecords(): VisitRecord[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as VisitRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveVisitRecords(records: VisitRecord[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}
