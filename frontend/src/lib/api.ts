import {
  type MediaType,
  type RecommendRequest,
  type RecommendResponse,
  recommendResponseSchema,
  type SearchResponse,
  searchResponseSchema,
} from "./schemas";

const BASE = "/api";

async function jsonOrThrow<T>(resp: Response, schema: { parse: (v: unknown) => T }): Promise<T> {
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`${resp.status} ${resp.statusText}: ${text.slice(0, 200)}`);
  }
  const data = await resp.json();
  return schema.parse(data);
}

export async function search(
  type: MediaType,
  q: string,
  signal?: AbortSignal,
): Promise<SearchResponse> {
  const url = `${BASE}/search?type=${encodeURIComponent(type)}&q=${encodeURIComponent(q)}`;
  const resp = await fetch(url, { signal });
  return jsonOrThrow(resp, searchResponseSchema);
}

export async function recommend(
  req: RecommendRequest,
  signal?: AbortSignal,
): Promise<RecommendResponse> {
  const resp = await fetch(`${BASE}/recommend`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  return jsonOrThrow(resp, recommendResponseSchema);
}
