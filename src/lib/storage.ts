import { signInAnonymously } from "firebase/auth";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  type DocumentData,
  type FirestoreError,
  type QueryDocumentSnapshot,
  type Unsubscribe
} from "firebase/firestore";
import { firebaseAuth, firebaseConfigError, firestoreDb } from "@/lib/firebase";

export type VisitRecord = {
  id: string;
  shrineId: string;
  nickname: string;
  comment: string;
  createdAt: string;
  visitedAt?: string;
  userLat?: number;
  userLng?: number;
  distanceMeters?: number;
  verified: boolean;
};

export type NewVisitRecord = Omit<VisitRecord, "id" | "createdAt">;

function visitsCollection() {
  if (!firestoreDb) {
    throw new Error(firebaseConfigError || "Firebase가 초기화되지 않았습니다.");
  }

  return collection(firestoreDb, "visits");
}

function timestampToIso(value: unknown) {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  if (typeof value === "string") {
    return value;
  }

  return new Date().toISOString();
}

function snapshotToVisit(doc: QueryDocumentSnapshot<DocumentData>): VisitRecord {
  const data = doc.data();

  return {
    id: doc.id,
    shrineId: String(data.shrineId ?? ""),
    nickname: String(data.nickname ?? "순례자"),
    comment: String(data.comment ?? ""),
    createdAt: timestampToIso(data.createdAt),
    visitedAt: timestampToIso(data.visitedAt),
    userLat: typeof data.userLat === "number" ? data.userLat : undefined,
    userLng: typeof data.userLng === "number" ? data.userLng : undefined,
    distanceMeters: typeof data.distanceMeters === "number" ? data.distanceMeters : undefined,
    verified: Boolean(data.verified)
  };
}

export function subscribeVisitRecords(
  onRecords: (records: VisitRecord[]) => void,
  onError: (message: string) => void
): Unsubscribe {
  if (!firestoreDb) {
    onError(firebaseConfigError || "Firebase 설정을 확인해 주세요.");
    return () => {};
  }

  const visitsQuery = query(visitsCollection(), orderBy("createdAt", "desc"));

  return onSnapshot(
    visitsQuery,
    (snapshot) => onRecords(snapshot.docs.map(snapshotToVisit)),
    (error: FirestoreError) => onError(error.message)
  );
}

export async function saveVisitRecord(record: NewVisitRecord) {
  if (!firebaseAuth) {
    throw new Error(firebaseConfigError || "Firebase 인증 설정을 확인해 주세요.");
  }

  if (!firebaseAuth.currentUser) {
    await signInAnonymously(firebaseAuth);
  }

  const payload: Record<string, unknown> = {
    shrineId: record.shrineId,
    nickname: record.nickname,
    comment: record.comment,
    verified: record.verified,
    createdAt: serverTimestamp(),
    visitedAt: record.visitedAt ? Timestamp.fromDate(new Date(record.visitedAt)) : serverTimestamp()
  };

  if (typeof record.userLat === "number") {
    payload.userLat = record.userLat;
  }

  if (typeof record.userLng === "number") {
    payload.userLng = record.userLng;
  }

  if (typeof record.distanceMeters === "number") {
    payload.distanceMeters = record.distanceMeters;
  }

  await addDoc(visitsCollection(), payload);
}
