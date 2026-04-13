import assert from "node:assert/strict";
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

  assert(
    response.status === 304 || response.ok,
    `[fetchFeedXml] unexpected HTTP status ${response.status} for URL: ${url}`,
  );

  if (response.status === 304)
    return { status: "success", statusCode: 304, xml: "", etag: null };

  const xml = await response.text();
  assert(xml.length > 0, "[fetchFeedXml] response body is empty");

  return {
    status: "success",
    statusCode: response.status,
    xml,
    etag: response.headers.get("ETag"),
  };
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
        format satisfies never;
    }
    return { status: "success" };
  } catch (err: any) {
    return { status: "failure", error: "errors.feed.invalidFormat" };
  }
}
