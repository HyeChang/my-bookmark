export type AppBindings = {
  SESSION_SECRET?: string;
  FIREBASE_PROJECT_ID?: string;
  bookmark?: D1Database;
  bookmark_assets?: R2Bucket;
  ASSETS?: Fetcher;
};
