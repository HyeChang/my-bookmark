import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";
import { createSessionValue } from "../src/lib/auth/session";
import {
  aggregateMemoCounts,
  type MemoRecord,
  type MemoRepository
} from "../src/lib/repositories/memos";

const sessionSecret = "memo-test-secret";
const fakeUser = {
  uid: "firebase-user-1",
  email: "keygenerator25@gmail.com",
  name: "Memo Tester",
  picture: "https://example.com/avatar.png"
};

function createMemoRecord(input: {
  id: string;
  userId?: string;
  folderId?: string | null;
  isFavorite?: boolean;
  isHidden?: boolean;
}): MemoRecord {
  const now = "2026-05-15T10:00:00.000Z";

  return {
    id: input.id,
    userId: input.userId ?? fakeUser.uid,
    folderId: input.folderId ?? null,
    tagIds: [],
    title: input.id,
    contentJson: {
      type: "doc",
      content: []
    },
    contentText: input.id,
    isFavorite: input.isFavorite ?? false,
    isHidden: input.isHidden ?? false,
    isLocked: false,
    memoColor: null,
    assetCount: 0,
    coverAsset: null,
    createdAt: now,
    updatedAt: now
  };
}

function createInMemoryMemoRepository(records: MemoRecord[]): MemoRepository {
  return {
    async pageByUser(userId) {
      const memos = records.filter((memo) => memo.userId === userId);
      return {
        memos,
        total: memos.length
      };
    },
    async countByUser(userId) {
      return aggregateMemoCounts(records.filter((memo) => memo.userId === userId));
    },
    async getByUserAndId() {
      return null;
    },
    async create() {
      throw new Error("Not implemented in test repository.");
    },
    async update() {
      return null;
    },
    async delete() {
      return false;
    }
  };
}

async function authenticatedRequest(
  app: ReturnType<typeof createApp>,
  path: string,
  init?: RequestInit
) {
  const sessionValue = await createSessionValue(fakeUser, sessionSecret);

  return app.request(`http://example.com${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
      cookie: `bookmark_session=${sessionValue}`
    }
  });
}

describe("memo routes", () => {
  it("returns stable memo counts by folder independent of selected folder pages", async () => {
    const app = createApp({
      sessionSecret,
      memoRepository: createInMemoryMemoRepository([
        createMemoRecord({ id: "unfiled-visible" }),
        createMemoRecord({ id: "unfiled-hidden", isHidden: true }),
        createMemoRecord({ id: "work-visible", folderId: "folder-work" }),
        createMemoRecord({
          id: "work-hidden-favorite",
          folderId: "folder-work",
          isFavorite: true,
          isHidden: true
        }),
        createMemoRecord({
          id: "other-visible-favorite",
          folderId: "folder-other",
          isFavorite: true
        }),
        createMemoRecord({
          id: "other-user-visible",
          userId: "another-user",
          folderId: "folder-work"
        })
      ])
    });

    const res = await authenticatedRequest(app, "/api/memos/counts");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.counts).toEqual({
      active: {
        total: 5,
        visible: 3
      },
      favorite: {
        total: 2,
        visible: 1
      },
      unfiled: {
        total: 2,
        visible: 1
      },
      byFolderId: {
        "folder-work": {
          total: 2,
          visible: 1
        },
        "folder-other": {
          total: 1,
          visible: 1
        }
      }
    });
  });
});
