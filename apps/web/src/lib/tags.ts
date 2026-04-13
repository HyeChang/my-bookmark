import type { CreateTagRequest, Tag, TagListResponse, TagResponse } from "@bookmark/shared";

export async function loadTags() {
  const res = await fetch("/api/tags", {
    credentials: "include"
  });

  if (!res.ok) {
    throw new Error("Failed to load tags");
  }

  const data = (await res.json()) as Partial<TagListResponse>;
  return Array.isArray(data.tags) ? (data.tags as Tag[]) : [];
}

export async function createTag(input: CreateTagRequest) {
  const res = await fetch("/api/tags", {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });

  if (!res.ok) {
    throw new Error("Failed to create tag");
  }

  const data = (await res.json()) as TagResponse;
  return data.tag;
}
