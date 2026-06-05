import type { AuthenticatedUser } from "../auth/types";

export async function syncAuthenticatedUser(
  db: D1Database,
  user: AuthenticatedUser
) {
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO users (
        id,
        firebase_uid,
        email,
        name,
        avatar_url,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(firebase_uid) DO UPDATE SET
        email = excluded.email,
        name = excluded.name,
        avatar_url = excluded.avatar_url,
        updated_at = excluded.updated_at`
    )
    .bind(
      user.uid,
      user.uid,
      user.email,
      user.name ?? null,
      user.picture ?? null,
      now,
      now
    )
    .run();
}
