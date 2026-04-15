import { getTranslations } from "next-intl/server";
import type z from "zod";
import type {
  BaseArticleSchema,
  ArticleWithCatsSchema,
  ClassificationSchema,
  DigestsIntermediarySchema,
} from "~/lib/validators/news";
import type { Agents, Sources } from "./gen_types";

export type { DB } from "./gen_types";

export type Article = z.infer<typeof BaseArticleSchema>;

export type ArticleWithCategories = z.infer<
  typeof ArticleWithCatsSchema
>[number];

export type ArticleWithCategory = Article & {
  category: string | null;
};

export type Agent = Pick<Agents, "provider" | "model" | "api_key">;

export type Source = Pick<
  Sources,
  "id" | "slug" | "url" | "date_filter_param" | "date_format" | "previous_etag"
>;

export type Classified = z.infer<typeof ClassificationSchema>["classifications"];

export type DigestsIntermediary = z.infer<typeof DigestsIntermediarySchema>["routings"];

export type PrevDigestHeader = { id: string; title: string };

export type PrevDigest = PrevDigestHeader & {
  digest: string;
  revision: number;
};

export type PrevDigestWithCategories = PrevDigest & {
  categories: string[];
};

export type DigestRequest = {
  article: ArticleWithCategories;
  digest: PrevDigest | "new";
};

export type DigestRoutingResult =
  | { status: "success"; routed: DigestsIntermediary }
  | { status: "failure"; error: { code: string; message: string } };

export type ClassifyArticlesResult =
  | {
      status: "success";
      classified: Classified;
    }
  | {
      status: "failure";
      error: {
        code: string;
        message: string;
      };
    };

export type Translator = Awaited<ReturnType<typeof getTranslations>>;
