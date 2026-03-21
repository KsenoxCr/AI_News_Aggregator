import { z } from "zod";
import { MAX } from "~/config/business";

export const editPreferencesInput = z.string()
    .min(0, "Preferences cannot be empty")
    .max(MAX.preferences_chars, `Preferences must be ${MAX.preferences_chars} characters or less`);
