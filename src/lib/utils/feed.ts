export async function fetchFeedXml(
  url: string,
  etag?: string | null,
): Promise<{
  status: "success";
  statusCode: number;
  xml: string;
  etag: string | null;
}> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/rss+xml, application/atom+xml, text/xml, */*",
      ...(etag && { "If-None-Match": etag }),
    },
  });

  // TODO: Intricate, closer to exhaustive response status handling

  if (response.status === 304)
    return { status: "success", statusCode: 304, xml: "", etag: null };

  const xml = await response.text();

  return {
    status: "success",
    statusCode: response.status,
    xml,
    etag: response.headers.get("ETag"),
  };
}

export function PushToPages<T>(
  pages: T[][],
  items: T[],
  pageSize: number,
): T[][] {
  const result = pages.map((p) => [...p]);
  for (const item of items) {
    if (result.length === 0 || result[result.length - 1]!.length >= pageSize)
      result.push([item]);
    else result[result.length - 1]!.push(item);
  }
  return result;
}

export function StripCategories<T extends { categories: unknown }>(
  articles: T[],
): Omit<T, "categories">[] {
  return articles.map(({ categories: _categories, ...rest }) => rest as Omit<T, "categories">);
}
