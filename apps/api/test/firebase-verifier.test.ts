import { describe, expect, it } from "vitest";

import { payloadToAuthenticatedUser } from "../src/lib/auth/firebase";

describe("payloadToAuthenticatedUser", () => {
  it("maps a valid Firebase token payload to the app user shape", () => {
    const user = payloadToAuthenticatedUser(
      {
        aud: "bookmark-test-project",
        iss: "https://securetoken.google.com/bookmark-test-project",
        sub: "firebase-user-1",
        email: "keygenerator25@gmail.com",
        name: "Bookmark Tester",
        picture: "https://example.com/avatar.png"
      },
      "bookmark-test-project"
    );

    expect(user).toEqual({
      uid: "firebase-user-1",
      email: "keygenerator25@gmail.com",
      name: "Bookmark Tester",
      picture: "https://example.com/avatar.png"
    });
  });

  it("rejects a payload with the wrong audience", () => {
    expect(() =>
      payloadToAuthenticatedUser(
        {
          aud: "wrong-project",
          iss: "https://securetoken.google.com/wrong-project",
          sub: "firebase-user-1",
          email: "keygenerator25@gmail.com"
        },
        "bookmark-test-project"
      )
    ).toThrowError("invalid_firebase_audience");
  });

  it("rejects a payload with a missing subject", () => {
    expect(() =>
      payloadToAuthenticatedUser(
        {
          aud: "bookmark-test-project",
          iss: "https://securetoken.google.com/bookmark-test-project",
          sub: "",
          email: "keygenerator25@gmail.com"
        },
        "bookmark-test-project"
      )
    ).toThrowError("invalid_firebase_subject");
  });
});
