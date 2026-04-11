import { z } from "zod";
import type { TFn } from "./types";

export const EmailSchemaFactory = (t: TFn) =>
  z
    .string()
    .min(1, t("validation.user.emailEmpty"))
    .email(t("validation.user.emailInvalid"));
