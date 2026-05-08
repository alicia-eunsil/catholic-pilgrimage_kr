import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const missingConfig = Object.entries(firebaseConfig)
  .filter(([key, value]) => key !== "storageBucket" && !value)
  .map(([key]) => key);

export const firebaseReady = missingConfig.length === 0;

export const firebaseConfigError = firebaseReady
  ? ""
  : `Firebase 환경변수가 필요합니다: ${missingConfig.join(", ")}`;

export const firebaseApp = firebaseReady
  ? getApps()[0] ?? initializeApp(firebaseConfig)
  : undefined;

export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : undefined;
export const firestoreDb = firebaseApp ? getFirestore(firebaseApp) : undefined;
export const firebaseStorage = firebaseApp && firebaseConfig.storageBucket ? getStorage(firebaseApp) : undefined;
export const firebaseStorageError = firebaseConfig.storageBucket
  ? ""
  : "Firebase Storage 환경변수가 필요합니다: storageBucket";
