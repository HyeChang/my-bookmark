import { describe, expect, it } from "vitest";
import type { Folder } from "@bookmark/shared";

import {
  buildFolderPathLabel,
  collectExpandedFolderIds,
  flattenFolderTreeRows
} from "./folders";

function createFolder(overrides: Partial<Folder> = {}): Folder {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    name: overrides.name ?? "폴더",
    color: overrides.color ?? null,
    icon: overrides.icon ?? null,
    isHidden: overrides.isHidden ?? false,
    parentFolderId: overrides.parentFolderId ?? null,
    sortOrder: overrides.sortOrder ?? 0,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    updatedAt: overrides.updatedAt ?? new Date().toISOString()
  };
}

describe("extension folder tree helpers", () => {
  const folders: Folder[] = [
    createFolder({ id: "root-projects", name: "Projects", sortOrder: 0 }),
    createFolder({ id: "root-reading", name: "Reading", sortOrder: 1 }),
    createFolder({
      id: "child-design",
      name: "Design",
      parentFolderId: "root-projects",
      sortOrder: 0
    }),
    createFolder({
      id: "child-ui",
      name: "UI",
      parentFolderId: "child-design",
      sortOrder: 0
    })
  ];

  it("builds a depth-aware flat tree for expanded branches", () => {
    expect(flattenFolderTreeRows(folders, new Set(["root-projects", "child-design"]))).toEqual([
      expect.objectContaining({ id: "root-projects", depth: 0, hasChildren: true }),
      expect.objectContaining({ id: "child-design", depth: 1, hasChildren: true }),
      expect.objectContaining({ id: "child-ui", depth: 2, hasChildren: false }),
      expect.objectContaining({ id: "root-reading", depth: 0, hasChildren: false })
    ]);
  });

  it("builds the visible path label for the selected folder", () => {
    expect(buildFolderPathLabel(folders, "child-ui")).toBe("Projects / Design / UI");
    expect(buildFolderPathLabel(folders, "")).toBe("미분류");
  });

  it("expands the selected folder ancestors and root folders", () => {
    expect(Array.from(collectExpandedFolderIds(folders, "child-ui")).sort()).toEqual([
      "child-design",
      "root-projects",
      "root-reading"
    ]);
  });
});
