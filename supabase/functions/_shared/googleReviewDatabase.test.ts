// @ts-nocheck -- Isolated PostgreSQL tests run with Bun, never against the live club.
import { test, expect, beforeAll, afterAll } from 'bun:test';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
let db;
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE SCHEMA cron;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
    CREATE TYPE public.app_role AS ENUM ('super_admin','admin','manager','front_desk');
    CREATE FUNCTION public.has_any_role(uuid,public.app_role[]) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
    CREATE TABLE cron.job(jobid int,jobname text);
    CREATE FUNCTION cron.unschedule(int) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
    CREATE FUNCTION cron.schedule(text,text,text) RETURNS int LANGUAGE sql AS $$ SELECT 1 $$;
    CREATE TABLE profiles(user_id uuid,first_name text,email text,phone text);
    CREATE TABLE members(id uuid,user_id uuid,email text,status text);
    CREATE TABLE class_types(id uuid,name text);
    CREATE TABLE class_sessions(id uuid,class_type_id uuid,session_date date,end_time time,is_cancelled boolean);
    CREATE TABLE class_bookings(id uuid,session_id uuid,user_id uuid,member_id uuid,status text,is_admin_hold boolean,walk_in_email text,walk_in_phone text,walk_in_name text);
    CREATE TABLE spa_appointments(id uuid,user_id uuid,status text,completed_at timestamptz,appointment_date date,appointment_time time,duration_minutes int,guest_email text,guest_phone text,guest_name text);
    CREATE TABLE guest_passes(id uuid,user_id uuid,used_at timestamptz,status text,no_show boolean,guest_email text,phone_number text,guest_name text);
  `);
  await db.exec(readFileSync('drizzle/migrations/0130_google_review_automation.sql','utf8'));
});
afterAll(async () => { await db.close(); });
async function spa(n,status='completed',email=`person${n}@example.invalid`) {
  await db.query(`INSERT INTO spa_appointments VALUES($1,NULL,$2,now(),current_date,'10:00',60,$3,NULL,'Alex')`,[id(n),status,email]);
}
test('cancellations and no-shows do not create requests', async () => {
  await spa(1,'cancelled'); await spa(2,'no_show');
  expect((await db.query('SELECT count(*)::int n FROM google_review_requests')).rows[0].n).toBe(0);
});
test('completed spa visit queues exactly two channels at 24 and 48 hours', async () => {
  await spa(3);
  const rows=(await db.query(`SELECT channel,extract(epoch from (due_at-visit_at))/3600 AS hours FROM google_review_messages m JOIN google_review_requests r ON r.id=m.request_id WHERE visit_id=$1 ORDER BY channel`,[id(3)])).rows;
  expect(rows.length).toBe(2); expect(Number(rows[0].hours)).toBe(48); expect(Number(rows[1].hours)).toBe(24);
});
test('same email across visit types is suppressed for 90 days', async () => {
  await spa(4,'completed','same@example.invalid');
  await db.query(`INSERT INTO guest_passes(id,status,used_at,no_show,guest_email) VALUES($1,'exhausted',now(),false,'same@example.invalid')`,[id(5)]);
  await db.query('SELECT complete_guest_visit($1)',[id(5)]);
  expect((await db.query(`SELECT count(*)::int n FROM google_review_requests WHERE email='same@example.invalid'`)).rows[0].n).toBe(1);
});
test('guest check-in alone does not request a review', async () => {
  await db.query(`INSERT INTO guest_passes(id,status,used_at,no_show,guest_email) VALUES($1,'exhausted',now(),false,'guest@example.invalid')`,[id(6)]);
  expect((await db.query('SELECT count(*)::int n FROM google_review_requests WHERE visit_id=$1',[id(6)])).rows[0].n).toBe(0);
  await db.query('SELECT complete_guest_visit($1)',[id(6)]);
  expect((await db.query('SELECT count(*)::int n FROM google_review_requests WHERE visit_id=$1',[id(6)])).rows[0].n).toBe(1);
});
test('confirmed reviewers are excluded without regard to rating', async () => {
  await db.exec(`INSERT INTO google_review_people(email,reviewed_at) VALUES('reviewed@example.invalid',now())`);
  await spa(7,'completed','reviewed@example.invalid');
  expect((await db.query('SELECT count(*)::int n FROM google_review_requests WHERE visit_id=$1',[id(7)])).rows[0].n).toBe(0);
});
test('member class visits excluded and non-member classes included', async () => {
  await db.query(`INSERT INTO members VALUES($1,$2,'member@example.invalid','active')`,[id(10),id(11)]);
  await db.query(`INSERT INTO class_sessions VALUES($1,NULL,current_date,'19:00',false)`,[id(12)]);
  await db.query(`INSERT INTO class_bookings(id,session_id,user_id,status) VALUES($1,$2,$3,'completed')`,[id(13),id(12),id(11)]);
  await db.query(`INSERT INTO class_bookings(id,session_id,status,walk_in_email) VALUES($1,$2,'completed','class@example.invalid')`,[id(14),id(12)]);
  expect((await db.query('SELECT count(*)::int n FROM google_review_requests WHERE visit_id=$1',[id(13)])).rows[0].n).toBe(0);
  expect((await db.query('SELECT count(*)::int n FROM google_review_requests WHERE visit_id=$1',[id(14)])).rows[0].n).toBe(1);
});
test('Detroit pacing advances by 48 minutes and avoids overnight', async () => {
  const r=(await db.query(`SELECT google_review_slot('2026-11-04 14:01:00+00')::text slot,google_review_slot('2026-11-05 02:00:00+00')::text overnight`)).rows[0];
  expect(r.slot).toBe('2026-11-04 14:48:00+00'); expect(r.overnight).toBe('2026-11-05 14:00:00+00');
});
test('daily cap rejects a sixteenth attempt across both channels', async () => {
  const def=(await db.query(`SELECT pg_get_functiondef('claim_google_review_message'::regproc) AS sql`)).rows[0].sql;
  await db.exec(def.replaceAll('now()', "'2026-11-04 15:00:00+00'::timestamptz"));
  await db.exec(`UPDATE google_review_messages SET due_at='2026-11-04 14:00:00+00';
    INSERT INTO google_review_requests(id,source,visit_id,visit_at,visit_type) VALUES('${id(100)}','spa','${id(101)}',now(),'spa appointment');`);
  for(let i=0;i<15;i++) await db.query(`INSERT INTO google_review_messages(request_id,channel,due_at,status,attempted_at) VALUES($1,$2,now(),'sent','2026-11-04 14:00:00+00')`,[i<2?id(100):(await db.query(`INSERT INTO google_review_requests(source,visit_id,visit_at,visit_type) VALUES('spa',$1,now(),'spa appointment') RETURNING id`,[id(200+i)])).rows[0].id,i%2?'email':'sms']);
  expect((await db.query('SELECT claim_google_review_message() AS m')).rows[0].m).toBeNull();
});
test('one attempt is claimed at a time and a second cannot follow within 48 minutes', async () => {
  await db.exec(`UPDATE google_review_messages SET attempted_at=NULL WHERE status='sent'; UPDATE google_review_settings SET last_attempt_at=NULL;`);
  const first=(await db.query('SELECT claim_google_review_message() AS m')).rows[0].m;
  expect(first.message_id).toBeTruthy();
  expect((await db.query('SELECT claim_google_review_message() AS m')).rows[0].m).toBeNull();
});
test('marking a reviewer cancels the remaining email for that visit', async () => {
  await db.exec(`UPDATE google_review_settings SET last_attempt_at=NULL; UPDATE google_review_messages SET status='sent' WHERE status='pending';`);
  await spa(500,'completed','stop@example.invalid');
  await db.exec(`UPDATE google_review_messages SET due_at='2026-11-04 14:00:00+00' WHERE status='pending'; INSERT INTO google_review_people(email,reviewed_at) VALUES('stop@example.invalid',now());`);
  expect((await db.query('SELECT claim_google_review_message() AS m')).rows[0].m).toBeNull();
  expect((await db.query(`SELECT count(*)::int n FROM google_review_messages m JOIN google_review_requests r ON r.id=m.request_id WHERE r.email='stop@example.invalid' AND m.status='skipped'`)).rows[0].n).toBe(2);
});