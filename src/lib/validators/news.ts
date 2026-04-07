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

export const DigestSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  agent_id: z.string().uuid(),
  title: z.string(),
  summary: z.string().nullable(),
  updated_at: z.coerce.date(),
  created_at: z.coerce.date(),
  expires_at: z.coerce.date(),
  sources: z.array(
    z.object({
      id: z.string().uuid(),
      url: z.string().url().max(2048),
      url_hash: z.string().max(64),
      title: z.string().max(500).nullable(),
      source_id: z.string().uuid().nullable(),
      published_at: z.coerce.date().nullable(),
    }),
  ),
  categories: z.array(z.string().max(100)),
});
