import type { AuthenticatedUser, SessionResponse } from "@bookmark/shared";

export async function loadSession() {
  const res = await fetch("/api/auth/session", {
    credentials: "include"
  });

  if (res.status === 401) {
    return null;
  }

  const data = (await res.json()) as SessionResponse;
  return data.authenticated ? data.user : null;
}

export async function exchangeIdTokenForSession(idToken: string) {
  const res = await fetch("/api/auth/session", {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      idToken
    })
  });

  if (!res.ok) {
    throw new Error("Failed to create app session");
  }

  const data = (await res.json()) as {
    authenticated: true;
    user: AuthenticatedUser;
  };

  return data.user;
}

export async function logoutSession() {
  const res = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include"
  });

  if (!res.ok) {
    throw new Error("Failed to logout");
  }
}
