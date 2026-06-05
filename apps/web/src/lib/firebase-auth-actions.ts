import { loadFirebaseAuth } from "./firebase-auth-loader";

export async function preloadFirebaseAuth() {
  await loadFirebaseAuth();
}

export async function signInWithGoogle() {
  const firebaseAuth = await loadFirebaseAuth();
  return firebaseAuth.signInWithGoogle();
}

export async function signOutFromGoogle() {
  const firebaseAuth = await loadFirebaseAuth();
  await firebaseAuth.signOutFromGoogle();
}
