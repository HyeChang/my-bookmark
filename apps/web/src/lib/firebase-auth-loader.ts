type FirebaseAuthModule = typeof import("./firebase");

let firebaseAuthModulePromise: Promise<FirebaseAuthModule> | null = null;

export function loadFirebaseAuth() {
  firebaseAuthModulePromise ??= import("./firebase");
  return firebaseAuthModulePromise;
}

export function preloadFirebaseAuth() {
  return loadFirebaseAuth();
}

export function resetFirebaseAuthLoaderForTest() {
  firebaseAuthModulePromise = null;
}
