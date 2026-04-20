import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";
import { createSessionValue } from "../src/lib/auth/session";

const sessionSecret = "folder-tag-test-secret";
const fakeUser = {
  uid: "firebase-user-1",
  email: "keygenerator25@gmail.com",
  name: "Bookmark Tester",
  picture: "https://example.com/avatar.png"
};

type FolderRecord = {
  id: string;
  userId: string;
  name: string;
  color: string | null;
  icon: string | null;
  isHidden: boolean;
  parentFolderId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type TagRecord = {
  id: string;
  userId: string;
  name: string;
  color: string | null;
  createdAt: string;
  updatedAt: string;
};

function createInMemoryFolderRepository() {
  const folders = new Map<string, FolderRecord>();

  return {
    async listByUser(userId: string) {
      return Array.from(folders.values())
        .filter((folder) => folder.userId === userId)
        .sort(
          (leftFolder, rightFolder) =>
            leftFolder.sortOrder - rightFolder.sortOrder ||
            leftFolder.createdAt.localeCompare(rightFolder.createdAt)
        );
    },
    async create(input: {
      userId: string;
      name: string;
      color?: string | null;
      icon?: string | null;
      isHidden?: boolean;
      parentFolderId?: string | null;
    }) {
      const now = "2026-04-13T10:00:00.000Z";
      const folder: FolderRecord = {
        id: `folder-${folders.size + 1}`,
        userId: input.userId,
        name: input.name,
        color: input.color ?? null,
        icon: input.icon ?? null,
        isHidden: input.isHidden ?? false,
        parentFolderId: input.parentFolderId ?? null,
        sortOrder: folders.size,
        createdAt: now,
        updatedAt: now
      };

      folders.set(folder.id, folder);
      return folder;
    },
    async update(
      folderId: string,
      userId: string,
      input: {
        name?: string;
        color?: string | null;
        icon?: string | null;
        isHidden?: boolean;
        parentFolderId?: string | null;
      }
    ) {
      const folder = folders.get(folderId);
      if (!folder || folder.userId !== userId) {
        return null;
      }

      const updated: FolderRecord = {
        ...folder,
        name: input.name ?? folder.name,
        color: input.color === undefined ? folder.color : input.color,
        icon: input.icon === undefined ? folder.icon : input.icon,
        isHidden: input.isHidden === undefined ? folder.isHidden : input.isHidden,
        parentFolderId:
          input.parentFolderId === undefined ? folder.parentFolderId : input.parentFolderId,
        updatedAt: "2026-04-13T11:00:00.000Z"
      };

      folders.set(folderId, updated);
      return updated;
    },
    async delete(folderId: string, userId: string) {
      const folder = folders.get(folderId);
      if (!folder || folder.userId !== userId) {
        return false;
      }

      folders.delete(folderId);
      return true;
    },
    async reorder(userId: string, input: { folderIds: string[] }) {
      input.folderIds.forEach((folderId, index) => {
        const folder = folders.get(folderId);
        if (!folder || folder.userId !== userId) {
          return;
        }

        folders.set(folderId, {
          ...folder,
          sortOrder: index,
          updatedAt: "2026-04-13T12:00:00.000Z"
        });
      });

      return Array.from(folders.values())
        .filter((folder) => folder.userId === userId)
        .sort(
          (leftFolder, rightFolder) =>
            leftFolder.sortOrder - rightFolder.sortOrder ||
            leftFolder.createdAt.localeCompare(rightFolder.createdAt)
        );
    },
    async move(
      folderId: string,
      userId: string,
      input: {
        parentFolderId?: string | null;
      }
    ) {
      const folder = folders.get(folderId);
      if (!folder || folder.userId !== userId) {
        return null;
      }

      const nextParentFolderId = input.parentFolderId ?? null;
      const previousSiblings = Array.from(folders.values())
        .filter(
          (currentFolder) =>
            currentFolder.userId === userId &&
            currentFolder.parentFolderId === folder.parentFolderId &&
            currentFolder.id !== folderId
        )
        .sort((leftFolder, rightFolder) => leftFolder.sortOrder - rightFolder.sortOrder);
      const nextSiblings = Array.from(folders.values())
        .filter(
          (currentFolder) =>
            currentFolder.userId === userId &&
            currentFolder.parentFolderId === nextParentFolderId &&
            currentFolder.id !== folderId
        )
        .sort((leftFolder, rightFolder) => leftFolder.sortOrder - rightFolder.sortOrder);

      previousSiblings.forEach((currentFolder, index) => {
        folders.set(currentFolder.id, {
          ...currentFolder,
          sortOrder: index,
          updatedAt: "2026-04-13T12:00:00.000Z"
        });
      });
      nextSiblings.forEach((currentFolder, index) => {
        folders.set(currentFolder.id, {
          ...currentFolder,
          parentFolderId: nextParentFolderId,
          sortOrder: index,
          updatedAt: "2026-04-13T12:00:00.000Z"
        });
      });
      folders.set(folderId, {
        ...folder,
        parentFolderId: nextParentFolderId,
        sortOrder: nextSiblings.length,
        updatedAt: "2026-04-13T12:00:00.000Z"
      });

      return Array.from(folders.values())
        .filter((currentFolder) => currentFolder.userId === userId)
        .sort(
          (leftFolder, rightFolder) =>
            leftFolder.sortOrder - rightFolder.sortOrder ||
            leftFolder.createdAt.localeCompare(rightFolder.createdAt)
        );
    }
  };
}

function createInMemoryTagRepository() {
  const tags = new Map<string, TagRecord>();

  return {
    async listByUser(userId: string) {
      return Array.from(tags.values()).filter((tag) => tag.userId === userId);
    },
    async create(input: { userId: string; name: string; color?: string | null }) {
      const now = "2026-04-13T10:00:00.000Z";
      const tag: TagRecord = {
        id: `tag-${tags.size + 1}`,
        userId: input.userId,
        name: input.name,
        color: input.color ?? null,
        createdAt: now,
        updatedAt: now
      };

      tags.set(tag.id, tag);
      return tag;
    },
    async update(
      tagId: string,
      userId: string,
      input: {
        name?: string;
        color?: string | null;
      }
    ) {
      const tag = tags.get(tagId);
      if (!tag || tag.userId !== userId) {
        return null;
      }

      const updated: TagRecord = {
        ...tag,
        name: input.name ?? tag.name,
        color: input.color === undefined ? tag.color : input.color,
        updatedAt: "2026-04-13T11:00:00.000Z"
      };

      tags.set(tagId, updated);
      return updated;
    },
    async delete(tagId: string, userId: string) {
      const tag = tags.get(tagId);
      if (!tag || tag.userId !== userId) {
        return false;
      }

      tags.delete(tagId);
      return true;
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

describe("folder and tag routes", () => {
  it("rejects anonymous folder listing requests", async () => {
    const app = createApp();

    const res = await app.request("http://example.com/api/folders");

    expect(res.status).toBe(401);
  });

  it("creates and lists folders for the authenticated user", async () => {
    const app = createApp({
      sessionSecret,
      folderRepository: createInMemoryFolderRepository()
    } as Parameters<typeof createApp>[0]);

    const createRes = await authenticatedRequest(app, "/api/folders", {
      method: "POST",
      body: JSON.stringify({
        name: "Reading",
        color: "#f97316",
        icon: "book-open"
      })
    });

    expect(createRes.status).toBe(201);
    await expect(createRes.json()).resolves.toMatchObject({
      folder: {
        name: "Reading",
        color: "#f97316",
        icon: "book-open"
      }
    });

    const listRes = await authenticatedRequest(app, "/api/folders");

    expect(listRes.status).toBe(200);
    await expect(listRes.json()).resolves.toMatchObject({
      folders: [
        {
          name: "Reading"
        }
      ]
    });
  });

  it("updates an existing folder", async () => {
    const repository = createInMemoryFolderRepository();
    const app = createApp({
      sessionSecret,
      folderRepository: repository
    } as Parameters<typeof createApp>[0]);

    const createRes = await authenticatedRequest(app, "/api/folders", {
      method: "POST",
      body: JSON.stringify({
        name: "Reading",
        color: "#f97316"
      })
    });
    const created = (await createRes.json()) as {
      folder: FolderRecord;
    };

    const updateRes = await authenticatedRequest(
      app,
      `/api/folders/${created.folder.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          name: "Articles",
          color: "#0f766e"
        })
      }
    );

    expect(updateRes.status).toBe(200);
    await expect(updateRes.json()).resolves.toMatchObject({
      folder: {
        id: created.folder.id,
        name: "Articles",
        color: "#0f766e"
      }
    });
  });

  it("creates and updates a hidden folder", async () => {
    const repository = createInMemoryFolderRepository();
    const app = createApp({
      sessionSecret,
      folderRepository: repository
    } as Parameters<typeof createApp>[0]);

    const createRes = await authenticatedRequest(app, "/api/folders", {
      method: "POST",
      body: JSON.stringify({
        name: "Private",
        isHidden: true
      })
    });

    expect(createRes.status).toBe(201);
    await expect(createRes.json()).resolves.toMatchObject({
      folder: {
        name: "Private",
        isHidden: true
      }
    });

    const updateRes = await authenticatedRequest(app, "/api/folders/folder-1", {
      method: "PATCH",
      body: JSON.stringify({
        isHidden: false
      })
    });

    expect(updateRes.status).toBe(200);
    await expect(updateRes.json()).resolves.toMatchObject({
      folder: {
        id: "folder-1",
        isHidden: false
      }
    });
  });

  it("creates a child folder with a parent folder id", async () => {
    const repository = createInMemoryFolderRepository();
    const app = createApp({
      sessionSecret,
      folderRepository: repository
    } as Parameters<typeof createApp>[0]);

    const parentRes = await authenticatedRequest(app, "/api/folders", {
      method: "POST",
      body: JSON.stringify({
        name: "Reading"
      })
    });
    const parent = (await parentRes.json()) as {
      folder: FolderRecord;
    };

    const childRes = await authenticatedRequest(app, "/api/folders", {
      method: "POST",
      body: JSON.stringify({
        name: "Papers",
        parentFolderId: parent.folder.id
      })
    });

    expect(childRes.status).toBe(201);
    await expect(childRes.json()).resolves.toMatchObject({
      folder: {
        name: "Papers",
        parentFolderId: parent.folder.id
      }
    });
  });

  it("rejects folder self-parent and descendant-parent cycles", async () => {
    const repository = createInMemoryFolderRepository();
    const app = createApp({
      sessionSecret,
      folderRepository: repository
    } as Parameters<typeof createApp>[0]);

    const parentRes = await authenticatedRequest(app, "/api/folders", {
      method: "POST",
      body: JSON.stringify({
        name: "Reading"
      })
    });
    const parent = (await parentRes.json()) as {
      folder: FolderRecord;
    };

    const childRes = await authenticatedRequest(app, "/api/folders", {
      method: "POST",
      body: JSON.stringify({
        name: "Papers",
        parentFolderId: parent.folder.id
      })
    });
    const child = (await childRes.json()) as {
      folder: FolderRecord;
    };

    const selfCycleRes = await authenticatedRequest(app, `/api/folders/${child.folder.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        parentFolderId: child.folder.id
      })
    });

    expect(selfCycleRes.status).toBe(400);
    await expect(selfCycleRes.json()).resolves.toMatchObject({
      error: "invalid_parent_folder_cycle"
    });

    const descendantCycleRes = await authenticatedRequest(app, `/api/folders/${parent.folder.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        parentFolderId: child.folder.id
      })
    });

    expect(descendantCycleRes.status).toBe(400);
    await expect(descendantCycleRes.json()).resolves.toMatchObject({
      error: "invalid_parent_folder_cycle"
    });
  });

  it("deletes an existing folder", async () => {
    const repository = createInMemoryFolderRepository();
    const app = createApp({
      sessionSecret,
      folderRepository: repository
    } as Parameters<typeof createApp>[0]);

    const createRes = await authenticatedRequest(app, "/api/folders", {
      method: "POST",
      body: JSON.stringify({
        name: "Reading"
      })
    });
    const created = (await createRes.json()) as {
      folder: FolderRecord;
    };

    const deleteRes = await authenticatedRequest(app, `/api/folders/${created.folder.id}`, {
      method: "DELETE"
    });

    expect(deleteRes.status).toBe(200);
    await expect(deleteRes.json()).resolves.toMatchObject({
      ok: true
    });

    const listRes = await authenticatedRequest(app, "/api/folders");
    await expect(listRes.json()).resolves.toMatchObject({
      folders: []
    });
  });

  it("reorders sibling folders within the same parent", async () => {
    const repository = createInMemoryFolderRepository();
    const app = createApp({
      sessionSecret,
      folderRepository: repository
    } as Parameters<typeof createApp>[0]);

    await authenticatedRequest(app, "/api/folders", {
      method: "POST",
      body: JSON.stringify({
        name: "Reading"
      })
    });
    await authenticatedRequest(app, "/api/folders", {
      method: "POST",
      body: JSON.stringify({
        name: "Articles"
      })
    });
    await authenticatedRequest(app, "/api/folders", {
      method: "POST",
      body: JSON.stringify({
        name: "Videos"
      })
    });

    const reorderRes = await authenticatedRequest(app, "/api/folders/reorder", {
      method: "POST",
      body: JSON.stringify({
        parentFolderId: null,
        folderIds: ["folder-3", "folder-1", "folder-2"]
      })
    });

    expect(reorderRes.status).toBe(200);
    await expect(reorderRes.json()).resolves.toMatchObject({
      folders: [
        { id: "folder-3", sortOrder: 0 },
        { id: "folder-1", sortOrder: 1 },
        { id: "folder-2", sortOrder: 2 }
      ]
    });
  });

  it("rejects folder reorder requests that mix different parents", async () => {
    const repository = createInMemoryFolderRepository();
    const app = createApp({
      sessionSecret,
      folderRepository: repository
    } as Parameters<typeof createApp>[0]);

    const parentRes = await authenticatedRequest(app, "/api/folders", {
      method: "POST",
      body: JSON.stringify({
        name: "Reading"
      })
    });
    const parent = (await parentRes.json()) as {
      folder: FolderRecord;
    };

    await authenticatedRequest(app, "/api/folders", {
      method: "POST",
      body: JSON.stringify({
        name: "Articles"
      })
    });
    await authenticatedRequest(app, "/api/folders", {
      method: "POST",
      body: JSON.stringify({
        name: "Papers",
        parentFolderId: parent.folder.id
      })
    });

    const reorderRes = await authenticatedRequest(app, "/api/folders/reorder", {
      method: "POST",
      body: JSON.stringify({
        parentFolderId: null,
        folderIds: ["folder-1", "folder-3", "folder-2"]
      })
    });

    expect(reorderRes.status).toBe(400);
    await expect(reorderRes.json()).resolves.toMatchObject({
      error: "invalid_folder_reorder"
    });
  });

  it("moves a folder under a different parent", async () => {
    const repository = createInMemoryFolderRepository();
    const app = createApp({
      sessionSecret,
      folderRepository: repository
    } as Parameters<typeof createApp>[0]);

    const readingRes = await authenticatedRequest(app, "/api/folders", {
      method: "POST",
      body: JSON.stringify({
        name: "Reading"
      })
    });
    const reading = (await readingRes.json()) as {
      folder: FolderRecord;
    };

    await authenticatedRequest(app, "/api/folders", {
      method: "POST",
      body: JSON.stringify({
        name: "Articles"
      })
    });

    const moveRes = await authenticatedRequest(app, "/api/folders/folder-2/move", {
      method: "POST",
      body: JSON.stringify({
        parentFolderId: reading.folder.id
      })
    });

    expect(moveRes.status).toBe(200);
    await expect(moveRes.json()).resolves.toMatchObject({
      folders: [
        {
          id: "folder-1",
          parentFolderId: null
        },
        {
          id: "folder-2",
          parentFolderId: "folder-1",
          sortOrder: 0
        }
      ]
    });
  });

  it("rejects moving a folder under its descendant", async () => {
    const repository = createInMemoryFolderRepository();
    const app = createApp({
      sessionSecret,
      folderRepository: repository
    } as Parameters<typeof createApp>[0]);

    const parentRes = await authenticatedRequest(app, "/api/folders", {
      method: "POST",
      body: JSON.stringify({
        name: "Reading"
      })
    });
    const parent = (await parentRes.json()) as {
      folder: FolderRecord;
    };

    const childRes = await authenticatedRequest(app, "/api/folders", {
      method: "POST",
      body: JSON.stringify({
        name: "Papers",
        parentFolderId: parent.folder.id
      })
    });
    const child = (await childRes.json()) as {
      folder: FolderRecord;
    };

    const moveRes = await authenticatedRequest(app, `/api/folders/${parent.folder.id}/move`, {
      method: "POST",
      body: JSON.stringify({
        parentFolderId: child.folder.id
      })
    });

    expect(moveRes.status).toBe(400);
    await expect(moveRes.json()).resolves.toMatchObject({
      error: "invalid_parent_folder_cycle"
    });
  });

  it("moves a child folder back to the root level", async () => {
    const repository = createInMemoryFolderRepository();
    const app = createApp({
      sessionSecret,
      folderRepository: repository
    } as Parameters<typeof createApp>[0]);

    const parentRes = await authenticatedRequest(app, "/api/folders", {
      method: "POST",
      body: JSON.stringify({
        name: "Reading"
      })
    });
    const parent = (await parentRes.json()) as {
      folder: FolderRecord;
    };

    const childRes = await authenticatedRequest(app, "/api/folders", {
      method: "POST",
      body: JSON.stringify({
        name: "Papers",
        parentFolderId: parent.folder.id
      })
    });
    const child = (await childRes.json()) as {
      folder: FolderRecord;
    };

    const moveRes = await authenticatedRequest(app, `/api/folders/${child.folder.id}/move`, {
      method: "POST",
      body: JSON.stringify({
        parentFolderId: null
      })
    });

    expect(moveRes.status).toBe(200);
    await expect(moveRes.json()).resolves.toMatchObject({
      folders: [
        {
          id: parent.folder.id,
          parentFolderId: null
        },
        {
          id: child.folder.id,
          parentFolderId: null
        }
      ]
    });
  });

  it("creates and lists tags for the authenticated user", async () => {
    const app = createApp({
      sessionSecret,
      tagRepository: createInMemoryTagRepository()
    } as Parameters<typeof createApp>[0]);

    const createRes = await authenticatedRequest(app, "/api/tags", {
      method: "POST",
      body: JSON.stringify({
        name: "research",
        color: "#2563eb"
      })
    });

    expect(createRes.status).toBe(201);
    await expect(createRes.json()).resolves.toMatchObject({
      tag: {
        name: "research",
        color: "#2563eb"
      }
    });

    const listRes = await authenticatedRequest(app, "/api/tags");

    expect(listRes.status).toBe(200);
    await expect(listRes.json()).resolves.toMatchObject({
      tags: [
        {
          name: "research"
        }
      ]
    });
  });

  it("updates an existing tag", async () => {
    const repository = createInMemoryTagRepository();
    const app = createApp({
      sessionSecret,
      tagRepository: repository
    } as Parameters<typeof createApp>[0]);

    const createRes = await authenticatedRequest(app, "/api/tags", {
      method: "POST",
      body: JSON.stringify({
        name: "research",
        color: "#2563eb"
      })
    });
    const created = (await createRes.json()) as {
      tag: TagRecord;
    };

    const updateRes = await authenticatedRequest(app, `/api/tags/${created.tag.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: "reference",
        color: "#0f766e"
      })
    });

    expect(updateRes.status).toBe(200);
    await expect(updateRes.json()).resolves.toMatchObject({
      tag: {
        id: created.tag.id,
        name: "reference",
        color: "#0f766e"
      }
    });
  });

  it("deletes an existing tag", async () => {
    const repository = createInMemoryTagRepository();
    const app = createApp({
      sessionSecret,
      tagRepository: repository
    } as Parameters<typeof createApp>[0]);

    const createRes = await authenticatedRequest(app, "/api/tags", {
      method: "POST",
      body: JSON.stringify({
        name: "research"
      })
    });
    const created = (await createRes.json()) as {
      tag: TagRecord;
    };

    const deleteRes = await authenticatedRequest(app, `/api/tags/${created.tag.id}`, {
      method: "DELETE"
    });

    expect(deleteRes.status).toBe(200);
    await expect(deleteRes.json()).resolves.toMatchObject({
      ok: true
    });

    const listRes = await authenticatedRequest(app, "/api/tags");
    await expect(listRes.json()).resolves.toMatchObject({
      tags: []
    });
  });
});
