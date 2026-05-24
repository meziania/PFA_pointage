import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { updateProfile, type User } from "firebase/auth";
import { getFirebaseStorage } from "@/lib/firebase-storage";
import { updateUserDoc } from "@/lib/firestore-helpers";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const UPLOAD_TIMEOUT_MS = 25_000;
/** Firestore field limit ~1 Mo — garde une marge pour le base64. */
const MAX_DATA_URL_LENGTH = 900_000;

export function validateProfileImage(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
    return "Format accepté : JPG, PNG ou WebP.";
  }
  if (file.size > MAX_BYTES) {
    return "La photo ne doit pas dépasser 2 Mo.";
  }
  return null;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

/** Redimensionne et compresse l'image côté navigateur (upload plus rapide). */
export function compressProfileImage(file: File, maxPx = 512, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const scale = Math.min(1, maxPx / Math.max(w, h));
      const cw = Math.max(1, Math.round(w * scale));
      const ch = Math.max(1, Math.round(h * scale));

      const canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Impossible de traiter l'image"));
        return;
      }
      ctx.drawImage(img, 0, 0, cw, ch);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Compression échouée"));
            return;
          }
          resolve(blob);
        },
        "image/jpeg",
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Fichier image invalide"));
    };

    img.src = url;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Lecture du fichier impossible"));
    };
    reader.onerror = () => reject(new Error("Lecture du fichier impossible"));
    reader.readAsDataURL(blob);
  });
}

async function uploadToStorage(uid: string, blob: Blob): Promise<string> {
  const storage = getFirebaseStorage();
  if (!storage) {
    throw new Error("STORAGE_NOT_CONFIGURED");
  }

  const path = `avatars/${uid}/profile.jpg`;
  const storageRef = ref(storage, path);

  await withTimeout(
    uploadBytes(storageRef, blob, { contentType: "image/jpeg" }),
    UPLOAD_TIMEOUT_MS,
    "Délai dépassé : vérifiez Firebase Storage et les règles (storage.rules).",
  );

  return getDownloadURL(storageRef);
}

async function savePhotoUrl(uid: string, url: string, authUser?: User | null): Promise<void> {
  await updateUserDoc(uid, { photoURL: url });

  // Auth profile : URL http(s) uniquement (limite ~2 Ko pour data: URLs)
  if (authUser && url.startsWith("http")) {
    try {
      await updateProfile(authUser, { photoURL: url });
    } catch {
      /* Firestore suffit */
    }
  }
}

export type UploadProfilePhotoResult = {
  url: string;
  /** true si Storage indisponible et photo stockée dans Firestore (base64) */
  usedFirestoreFallback?: boolean;
};

export async function uploadProfilePhoto(
  uid: string,
  file: File,
  authUser?: User | null,
): Promise<UploadProfilePhotoResult> {
  const err = validateProfileImage(file);
  if (err) throw new Error(err);

  const compressed = await compressProfileImage(file);

  try {
    const url = await uploadToStorage(uid, compressed);
    await savePhotoUrl(uid, url, authUser);
    return { url };
  } catch (storageErr) {
    const dataUrl = await blobToDataUrl(compressed);
    if (dataUrl.length > MAX_DATA_URL_LENGTH) {
      if (storageErr instanceof Error && storageErr.message === "STORAGE_NOT_CONFIGURED") {
        throw new Error(
          "Ajoutez NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET dans .env.local et activez Firebase Storage.",
        );
      }
      throw storageErr instanceof Error
        ? storageErr
        : new Error("Échec upload. Exécutez : firebase deploy --only storage");
    }

    await savePhotoUrl(uid, dataUrl, authUser);
    return { url: dataUrl, usedFirestoreFallback: true };
  }
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
