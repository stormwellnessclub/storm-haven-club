// @ts-nocheck -- PGlite runs this migration against isolated records only.
import { expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
test("restart intent is stable, scheduled future freezes cannot end, and completion is atomic and once-only", async () => {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT 'service_role'::text $$;
    CREATE TABLE public.members(id uuid primary key,status text,stripe_subscription_id text,next_billing_date date);
    CREATE TABLE public.member_freezes(id uuid primary key,member_id uuid,status text,actual_start_date date,requested_start_date date,actual_end_date date,requested_end_date date,billing_resume_error text);
  `);
  await db.exec(readFileSync("drizzle/migrations/0134_freeze_billing_resume_atomic.sql", "utf8"));
  const mid = "11111111-1111-1111-1111-111111111111";
  const fid = "22222222-2222-2222-2222-222222222222";
  await db.query(`INSERT INTO members VALUES ($1,'frozen','sub_fixture',NULL)`, [mid]);
  await db.query(`INSERT INTO member_freezes(id,member_id,status,actual_start_date,requested_start_date,actual_end_date,requested_end_date) VALUES ($1,$2,'active',CURRENT_DATE-30,CURRENT_DATE-30,CURRENT_DATE+1,CURRENT_DATE+1)`, [fid, mid]);
  await expect(db.query(`SELECT prepare_freeze_billing_resume($1,false)`, [fid])).rejects.toThrow("has not ended");
  const first = await db.query(`SELECT prepare_freeze_billing_resume($1,true) AS intent`, [fid]);
  const again = await db.query(`SELECT prepare_freeze_billing_resume($1,true) AS intent`, [fid]);
  expect(first.rows[0].intent).toEqual(again.rows[0].intent);
  expect((await db.query(`SELECT status FROM members WHERE id=$1`, [mid])).rows[0].status).toBe("frozen");
  const finished = await db.query(`SELECT finish_freeze_billing_resume($1,CURRENT_DATE+30) AS done`, [fid]);
  expect(finished.rows[0].done).toBe(true);
  expect((await db.query(`SELECT status FROM members WHERE id=$1`, [mid])).rows[0].status).toBe("active");
  expect((await db.query(`SELECT status FROM member_freezes WHERE id=$1`, [fid])).rows[0].status).toBe("completed");
  expect((await db.query(`SELECT finish_freeze_billing_resume($1,CURRENT_DATE+30) AS done`, [fid])).rows[0].done).toBe(false);
  await db.close();
});