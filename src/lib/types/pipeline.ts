import { getTranslations } from "next-intl/server";
import type z from "zod";
import type {
  ClassificationSchema,
  DigestsIntermediarySchema,
} from "~/lib/validators/news";
import type { ArticleWithCategories } from "~/server/db/types";

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
