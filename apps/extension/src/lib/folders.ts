import type { Folder } from "@bookmark/shared";

export type FolderTreeRow = {
  id: string;
  name: string;
  depth: number;
  hasChildren: boolean;
  folder: Folder;
};

function sortFolders(left: Folder, right: Folder) {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder;
  }

  return left.name.localeCompare(right.name, "ko");
}

function buildChildrenMap(folders: Folder[]) {
  const childrenMap = new Map<string | null, Folder[]>();

  for (const folder of folders) {
    const siblings = childrenMap.get(folder.parentFolderId) ?? [];
    siblings.push(folder);
    childrenMap.set(folder.parentFolderId, siblings);
  }

  for (const siblings of childrenMap.values()) {
    siblings.sort(sortFolders);
  }

  return childrenMap;
}

export function flattenFolderTreeRows(folders: Folder[], expandedFolderIds: Set<string>) {
  const rows: FolderTreeRow[] = [];
  const childrenMap = buildChildrenMap(folders);

  function visit(parentFolderId: string | null, depth: number) {
    for (const folder of childrenMap.get(parentFolderId) ?? []) {
      const hasChildren = (childrenMap.get(folder.id)?.length ?? 0) > 0;
      rows.push({
        id: folder.id,
        name: folder.name,
        depth,
        hasChildren,
        folder
      });

      if (hasChildren && expandedFolderIds.has(folder.id)) {
        visit(folder.id, depth + 1);
      }
    }
  }

  visit(null, 0);
  return rows;
}

export function buildFolderPathLabel(folders: Folder[], selectedFolderId: string) {
  if (!selectedFolderId) {
    return "미분류";
  }

  const folderById = new Map(folders.map((folder) => [folder.id, folder]));
  const segments: string[] = [];
  let currentFolder = folderById.get(selectedFolderId) ?? null;

  while (currentFolder) {
    segments.unshift(currentFolder.name);
    currentFolder = currentFolder.parentFolderId
      ? (folderById.get(currentFolder.parentFolderId) ?? null)
      : null;
  }

  return segments.length > 0 ? segments.join(" / ") : "미분류";
}

export function collectExpandedFolderIds(folders: Folder[], selectedFolderId: string) {
  const expandedFolderIds = new Set(
    folders.filter((folder) => folder.parentFolderId === null).map((folder) => folder.id)
  );

  if (!selectedFolderId) {
    return expandedFolderIds;
  }

  const folderById = new Map(folders.map((folder) => [folder.id, folder]));
  let currentFolder = folderById.get(selectedFolderId) ?? null;

  while (currentFolder?.parentFolderId) {
    expandedFolderIds.add(currentFolder.parentFolderId);
    currentFolder = folderById.get(currentFolder.parentFolderId) ?? null;
  }

  return expandedFolderIds;
}
