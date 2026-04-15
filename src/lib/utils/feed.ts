import { parseRssFeed, parseAtomFeed } from "feedsmith";
import { FEED_FORMAT, type FeedFormat } from "~/config/business";

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

  // TODO: Intricate response status handling

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

export function scrollToCenter(container: HTMLElement | null, btn: HTMLElement): void {
  if (!container) return;
  container.scrollTo({
    left: btn.offsetLeft - container.clientWidth / 2 + btn.clientWidth / 2,
    behavior: "smooth",
  });
}

export function validateFeed(
  xml: string,
  format: FeedFormat,
): { status: "success" } | { status: "failure"; error: string } {
  try {
    switch (format) {
      case FEED_FORMAT.RSS:
        parseRssFeed(xml);
        break;
      case FEED_FORMAT.ATOM:
        parseAtomFeed(xml);
        break;
      default:
        throw new Error(`Unhandled feed format: ${format satisfies never}`);
    }
    return { status: "success" };
  } catch (err: any) {
    return { status: "failure", error: "errors.feed.invalidFormat" };
  }
}
