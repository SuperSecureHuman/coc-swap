// Apply db/schema.sql via Neon HTTP driver
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL missing"); process.exit(1); }
const sql = neon(url);
const schema = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
const stmts = schema.split(";").map((s) => s.trim()).filter(Boolean);
for (const s of stmts) {
  console.log("→", s.split("\n")[0].slice(0, 80));
  await sql.query(s);
}
console.log("done");
