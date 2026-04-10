import { z } from "zod";
import type { TFn } from "./types";

export const ClassificationSchema = z.array(
  z.object({
    article_id: z.string().uuid(),
    categories: z.array(z.string().max(100)),
  }),
);

export const BaseArticleSchema = z.object({
  id: z.string(),
  title: z.string(),
  link: z.string().url(),
  author: z.string(),
  published_at: z.coerce.date(),
  fetch_id: z.string(),
  used: z.number(),
});

export const ArticleWithCatsSchema = z.array(
  BaseArticleSchema.extend({
    categories: z.array(z.string().max(100)).nullable(),
  }),
);

export const ArticleWithCatsSchemaFactory = (t: TFn) =>
  ArticleWithCatsSchema.min(0, t("validation.agent.content.schemaMismatch"));

export const DigestsIntermediarySchema = z.array(
  z.object({
    article_id: z.string().uuid(),
    digests: z.array(z.union([z.string().uuid(), z.literal("new")])).min(1),
  }),
);

export const DigestRevisionSchema = z.object({
  article_id: z.string(),
  title: z.string(),
  digest: z.string(),
});
