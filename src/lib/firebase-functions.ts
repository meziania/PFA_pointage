import { Functions, connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { getFirebaseApp } from "@/lib/firebase";

export function getFirebaseFunctions(): Functions | null {
  const app = getFirebaseApp();
  if (!app) return null;

  const region = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION || "europe-west1";
  const functions = getFunctions(app, region);

  const host = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_HOST;
  const portRaw = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_PORT;
  if (host && portRaw) {
    const port = Number(portRaw);
    if (Number.isFinite(port)) {
      connectFunctionsEmulator(functions, host, port);
    }
  }

  return functions;
}
