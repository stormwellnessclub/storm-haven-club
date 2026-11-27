// @ts-nocheck -- Isolated local database; no real RSVPs or messages.
import { beforeAll, afterAll, beforeEach, it, expect } from 'bun:test';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
const event = '5b4fd70a-84ef-4993-8ba5-d5d7c084386b';
let db;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE SCHEMA auth;
    CREATE TYPE app_role AS ENUM('super_admin','admin','manager','front_desk');
    CREATE TABLE test_identity(role text, clock timestamptz);
    INSERT INTO test_identity VALUES('member','2026-11-29T04:59:58Z');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT CASE WHEN role='service_role' THEN role ELSE 'authenticated' END FROM test_identity $$;
    CREATE FUNCTION has_any_role(uuid,app_role[]) RETURNS bool LANGUAGE sql AS $$ SELECT role = ANY($2::text[]) FROM test_identity $$;
    CREATE FUNCTION test_now() RETURNS timestamptz LANGUAGE sql AS $$ SELECT clock FROM test_identity $$;
    CREATE TABLE events(id uuid PRIMARY KEY);
    CREATE TABLE society_meeting_rsvps(event_id uuid, response text);
    INSERT INTO events VALUES('${event}');
  `);
  await db.exec(readFileSync('drizzle/migrations/0227_society_rsvp_close_time.sql','utf8'));
  await db.exec(readFileSync('drizzle/migrations/0228_society_deadline_admin_exception.sql','utf8').replace('now()', 'test_now()'));
});
beforeEach(async () => db.exec(`TRUNCATE society_meeting_rsvps; UPDATE test_identity SET role='member',clock='2026-11-29T04:59:58Z';`));
afterAll(async () => db.close());
it('Dec 3 replies close November 28 at 11:59:59 PM Detroit', async () => {
  expect((await db.query(`SELECT (rsvp_closes_at AT TIME ZONE 'America/Detroit')::text AS local FROM events`)).rows[0].local).toBe('2026-11-28 23:59:59');
  await db.exec(`INSERT INTO society_meeting_rsvps VALUES('${event}','yes'); UPDATE test_identity SET clock='2026-11-29T05:00:00Z';`);
  await expect(db.exec(`INSERT INTO society_meeting_rsvps VALUES('${event}','maybe');`)).rejects.toThrow('RSVPs are closed');
});
it('late changes are blocked and existing replies retained', async () => {
  await db.exec(`INSERT INTO society_meeting_rsvps VALUES('${event}','yes'); UPDATE test_identity SET clock='2026-11-29T05:00:00Z';`);
  await expect(db.exec(`UPDATE society_meeting_rsvps SET response='no';`)).rejects.toThrow('RSVPs are closed');
  expect((await db.query('SELECT response FROM society_meeting_rsvps')).rows[0].response).toBe('yes');
});
it('only administrators and trusted operations can amend a closed reply', async () => {
  await db.exec(`UPDATE test_identity SET clock='2026-11-29T05:00:00Z',role='front_desk';`);
  await expect(db.exec(`INSERT INTO society_meeting_rsvps VALUES('${event}','yes');`)).rejects.toThrow('RSVPs are closed');
  await db.exec(`UPDATE test_identity SET role='admin'; INSERT INTO society_meeting_rsvps VALUES('${event}','yes');`);
  expect((await db.query('SELECT count(*)::int n FROM society_meeting_rsvps')).rows[0].n).toBe(1);
});