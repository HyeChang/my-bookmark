import { describe, expect, it } from "vitest";

import { payloadToAuthenticatedUser } from "../src/lib/auth/firebase";

describe("payloadToAuthenticatedUser", () => {
  it("maps a valid Firebase token payload to the app user shape", () => {
    const user = payloadToAuthenticatedUser(
      {
        aud: "bookmark-web-e76c7",
        iss: "https://securetoken.google.com/bookmark-web-e76c7",
        sub: "firebase-user-1",
        email: "keygenerator25@gmail.com",
        name: "Bookmark Tester",
        picture: "https://example.com/avatar.png"
      },
      "bookmark-web-e76c7"
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
        "bookmark-web-e76c7"
      )
    ).toThrowError("invalid_firebase_audience");
  });

  it("rejects a payload with a missing subject", () => {
    expect(() =>
      payloadToAuthenticatedUser(
        {
          aud: "bookmark-web-e76c7",
          iss: "https://securetoken.google.com/bookmark-web-e76c7",
          sub: "",
          email: "keygenerator25@gmail.com"
        },
        "bookmark-web-e76c7"
      )
    ).toThrowError("invalid_firebase_subject");
  });
});
