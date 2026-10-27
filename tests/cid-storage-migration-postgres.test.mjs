import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { SQL } from "bun";

const databaseUrl = process.env.PAPERBOY_TEST_DATABASE_URL;
const tables = ["message_attachments", "received_email_attachments"];
const unicodeSpaces = [0xa0, 0x1680, ...Array.from({ length: 11 }, (_, i) => 0x2000 + i), 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff];
const legacyLabels = [
  null, "logo", "a".repeat(256), "📨".repeat(256), "logo;part", "\u0001", "\u007f",
  "\u0080", "\u0085", "\u009f", "é", "e\u0301", "\u200b", "\ufffd", "\uffff",
  ...unicodeSpaces.map((code) => `a${String.fromCodePoint(code)}b`),
];

test("CID migration preserves legacy rows and structural checks across collations", {
  skip: databaseUrl ? false : "PAPERBOY_TEST_DATABASE_URL is not configured",
}, async () => {
  const sql = new SQL(databaseUrl);
  const [previous, migration] = await Promise.all([
    readFile(new URL("../drizzle/meta/0042_snapshot.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../drizzle/0043_cid_storage_locale.sql", import.meta.url), "utf8"),
  ]);
  try {
    // C is always available. Exercise the database default and ICU as well,
    // even on hosts whose libc does not classify U+0085 as whitespace.
    const icu = await sql`select quote_ident(n.nspname) || '.' || quote_ident(c.collname) as name
      from pg_collation c join pg_namespace n on n.oid = c.collnamespace
      where c.collprovider = 'i' and c.collisdeterministic
      order by (c.collname = 'en-US-x-icu') desc, c.oid limit 1`;
    const collations = ['"C"', '"default"', ...icu.map(({ name }) => name)];
    for (const collation of collations) {
      for (const populated of [false, true]) {
        await sql.begin(async (tx) => {
          // Only transaction-local tables are altered by the real migration.
          await tx`set local search_path = pg_temp`;
          const before = new Map();
          for (const table of tables) {
            const constraint = `${table}_content_id_check`;
            const oldCheck = previous.tables[`public.${table}`].checkConstraints[constraint].value;
            await tx.unsafe(`create temporary table "${table}" (
              id integer generated always as identity, content_id text collate ${collation},
              constraint "${constraint}" check (${oldCheck})
            ) on commit drop`);
            if (populated) {
              for (const value of legacyLabels) {
                // Only seed labels the old constraint accepted in this locale.
                await tx.unsafe(`insert into "${table}" (content_id)
                  select content_id from (select $1::text collate ${collation} as content_id) "${table}"
                  where ${oldCheck}`, [value]);
              }
            }
            const rows = await tx.unsafe(`select * from "${table}" order by id`);
            assert.equal(rows.length > 0, populated);
            if (populated && collation === '"C"') assert.equal(rows.length, legacyLabels.length);
            before.set(table, rows);
          }
          for (const statement of migration.split("--> statement-breakpoint").filter((part) => part.trim())) {
            await tx.unsafe(statement);
          }
          for (const table of tables) {
            assert.deepEqual(await tx.unsafe(`select * from "${table}" order by id`), before.get(table), `${table} ${collation} retains every legacy row`);
            // The portable storage contract is deliberately broader than the
            // outbound parser, including existing C-locale non-ASCII spaces.
            for (const value of legacyLabels) {
              const [row] = await tx.unsafe(`insert into "${table}" (content_id) values ($1) returning content_id`, [value]);
              assert.equal(row.content_id, value);
            }
            for (const value of ["", "a".repeat(257), "📨".repeat(257), ...["\t", "\n", "\v", "\f", "\r", " ", "<", ">", ","].flatMap((char) => [char, `a${char}b`, `a${char}`])]) {
              await assert.rejects(
                tx.savepoint((sp) => sp.unsafe(`insert into "${table}" (content_id) values ($1)`, [value])),
                (error) => error.errno === "23514" && error.constraint === `${table}_content_id_check`,
                `${table} ${collation} rejects ${JSON.stringify(value)}`,
              );
            }
          }
        });
      }
    }
  } finally {
    await sql.close();
  }
});
