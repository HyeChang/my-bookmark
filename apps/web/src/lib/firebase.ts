import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";

type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  messagingSenderId: string;
};

function readRequiredEnv(name: keyof ImportMetaEnv) {
  const value = import.meta.env[name];
  if (!value) {
    throw new Error(`Missing Firebase env: ${name}`);
  }

  return value;
}

function getFirebaseConfig(): FirebaseConfig {
  return {
    apiKey: readRequiredEnv("VITE_FIREBASE_API_KEY"),
    authDomain: readRequiredEnv("VITE_FIREBASE_AUTH_DOMAIN"),
    projectId: readRequiredEnv("VITE_FIREBASE_PROJECT_ID"),
    appId: readRequiredEnv("VITE_FIREBASE_APP_ID"),
    messagingSenderId: readRequiredEnv("VITE_FIREBASE_MESSAGING_SENDER_ID")
  };
}

export function getFirebaseApp() {
  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp(getFirebaseConfig());
}

export async function signInWithGoogle() {
  const auth = getAuth(getFirebaseApp());
  const provider = new GoogleAuthProvider();
  const credential = await signInWithPopup(auth, provider);

  return credential.user.getIdToken();
}

export async function signOutFromGoogle() {
  const auth = getAuth(getFirebaseApp());
  await signOut(auth);
}
