import { Functions, connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { getFirebaseApp } from "@/lib/firebase";

export function getFirebaseFunctions(): Functions | null {
  const app = getFirebaseApp();
  if (!app) return null;

  const region = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION || "europe-west1";
  const functions = getFunctions(app, region);

  // Only use the emulator in local development (or when explicitly forced).
  // On Vercel/production, having these env vars set would incorrectly point to 127.0.0.1.
  const useEmulator =
    process.env.NEXT_PUBLIC_USE_FUNCTIONS_EMULATOR === "true" || process.env.NODE_ENV === "development";

  const host = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_HOST;
  const portRaw = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_PORT;
  if (useEmulator && host && portRaw) {
    const port = Number(portRaw);
    if (Number.isFinite(port)) {
      connectFunctionsEmulator(functions, host, port);
    }
  }

  return functions;
}
