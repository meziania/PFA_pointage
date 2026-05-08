import { Functions, connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { getFirebaseApp } from "@/lib/firebase";

export function getFirebaseFunctions(): Functions | null {
  const app = getFirebaseApp();
  if (!app) return null;

  const region = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION || "europe-west1";
  const functions = getFunctions(app, region);

  // Never connect to the emulator in production builds (e.g. Vercel) unless explicitly enabled.
  const allowEmulator =
    process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_USE_FUNCTIONS_EMULATOR === "true";

  const host = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_HOST;
  const portRaw = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_PORT;
  if (allowEmulator && host && portRaw) {
    const port = Number(portRaw);
    if (Number.isFinite(port)) connectFunctionsEmulator(functions, host, port);
  }

  return functions;
}
