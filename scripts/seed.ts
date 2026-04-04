import { v4 as uuidv4 } from "uuid";
import { db } from "~/server/db/db";

const TEST_USER_ID = process.env.TEST_USER_ID;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!TEST_USER_ID) {
  console.error("[seed] ERROR: TEST_USER_ID env var is not set");
  process.exit(1);
}

if (!OPENROUTER_API_KEY) {
  console.error("[seed] ERROR: OPENROUTER_API_KEY env var is not set");
  process.exit(1);
}

const sourceId = uuidv4();
const fetchId = uuidv4();
const agentId = uuidv4();

async function seed() {
  console.log("[seed] inserting source...");
  await db
    .insertInto("sources")
    .values({
      id: sourceId,
      slug: "test-source",
      url: "https://feeds.bbci.co.uk/news/rss.xml",
      enabled: 1,
      auth_type: "none",
      auth_credential: null,
      date_filter_param: null,
      date_format: null,
      is_metered: 0,
      user_id: TEST_USER_ID!,
    })
    .execute();
  console.log(`[seed] source inserted — id: ${sourceId}`);

  console.log("[seed] inserting fetch...");
  await db
    .insertInto("fetches")
    .values({
      id: fetchId,
      source_id: sourceId,
      previous_etag: null,
    })
    .execute();
  console.log(`[seed] fetch inserted — id: ${fetchId}`);

  console.log("[seed] inserting agent...");
  await db
    .insertInto("agents")
    .values({
      id: agentId,
      slug: "openrouter-test",
      url: "https://openrouter.ai/api/v1",
      api_key: OPENROUTER_API_KEY!,
      model: "openai/gpt-4o-mini",
      enabled: 1,
      user_id: TEST_USER_ID!,
    })
    .execute();
  console.log(`[seed] agent inserted — id: ${agentId}`);

  console.log("[seed] done.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("[seed] fatal error:", err);
  process.exit(1);
});
