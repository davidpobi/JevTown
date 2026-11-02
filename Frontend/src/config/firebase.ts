"use client";

import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_PUBLIC_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_PUBLIC_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PUBLIC_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_PUBLIC_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_PUBLIC_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_PUBLIC_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_PUBLIC_MEASUREMENT_ID,
};

const firebaseOptions = (): FirebaseOptions => {
  const missing = Object.entries(firebaseConfig)
    .filter(([, value]) => !value?.trim())
    .map(([key]) => key);

  if (missing.length) {
    throw new Error("Firebase public configuration is incomplete.");
  }

  return firebaseConfig;
};

const databaseUrl = () => {
  const value = process.env.NEXT_PUBLIC_FIREBASE_PUBLIC_DATABASE_URL?.trim();

  if (!value) {
    throw new Error("NEXT_PUBLIC_FIREBASE_PUBLIC_DATABASE_URL is not configured.");
  }

  return value;
};

export const getFirebaseApp = () =>
  getApps().length ? getApp() : initializeApp(firebaseOptions());

export const getFirebaseRealtimeDatabase = () =>
  getDatabase(getFirebaseApp(), databaseUrl());

