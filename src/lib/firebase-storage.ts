import { FirebaseStorage, getStorage } from "firebase/storage";
import { getFirebaseApp } from "@/lib/firebase";

export function getFirebaseStorageBucket(): string | null {
  const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim();
  return bucket || null;
}

export function getFirebaseStorage(): FirebaseStorage | null {
  const app = getFirebaseApp();
  const bucket = getFirebaseStorageBucket();
  if (!app || !bucket) return null;
  try {
    return getStorage(app, bucket);
  } catch {
    return null;
  }
}
