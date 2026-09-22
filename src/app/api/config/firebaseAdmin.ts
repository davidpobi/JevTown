import "server-only";

import {
  cert,
  getApp,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

interface FirebaseAdminCredential {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  databaseURL: string;
}

const parseCredential = (): FirebaseAdminCredential => {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PUBLIC_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_PUBLIC_DATABASE_URL?.trim();

  if (!projectId) {
    throw new Error("NEXT_PUBLIC_FIREBASE_PUBLIC_PROJECT_ID is not configured.");
  }

  if (!clientEmail || !/^[^@\s]+@[^@\s]+\.iam\.gserviceaccount\.com$/.test(clientEmail)) {
    throw new Error("FIREBASE_CLIENT_EMAIL is not a valid service-account email.");
  }

  if (!privateKey?.startsWith("-----BEGIN PRIVATE KEY-----") || !privateKey.endsWith("-----END PRIVATE KEY-----")) {
    throw new Error("FIREBASE_PRIVATE_KEY is not a valid PEM private key.");
  }

  if (!databaseURL) {
    throw new Error("NEXT_PUBLIC_FIREBASE_PUBLIC_DATABASE_URL is not configured.");
  }

  return { projectId, clientEmail, privateKey, databaseURL };
};

export const getFirebaseAdminApp = (): App => {
  if (getApps().length) {
    return getApp();
  }

  const credential = parseCredential();

  return initializeApp({
    credential: cert({
      projectId: credential.projectId,
      clientEmail: credential.clientEmail,
      privateKey: credential.privateKey,
    }),
    databaseURL: credential.databaseURL,
    projectId: credential.projectId,
  });
};

export const getFirebaseAdminRealtimeDatabase = () =>
  getDatabase(getFirebaseAdminApp());

