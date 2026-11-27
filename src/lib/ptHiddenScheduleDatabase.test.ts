// @ts-nocheck -- Isolated database only; never touches clients or production.
import { beforeAll, afterAll, beforeEach, it, expect } from 'bun:test';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

let db;
const id = '00000000-0000-0000-0000-000000000001';
const future = '2099-11-27T15:00:00Z';
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '${id}'::uuid $$;
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE pt_trainer_availability(instructor_id uuid,weekday int,start_time time,end_time time,effective_start date,effective_end date,is_public bool);
    CREATE TABLE pt_trainer_overrides(instructor_id uuid,date date,end_date date,kind text,start_time time,end_time time,is_public bool);
    CREATE TABLE pt_session_types(id uuid,is_active bool,client_requestable bool,duration_minutes int,default_location_id uuid,format text);
    CREATE TABLE pt_trainer_services(instructor_id uuid,session_type_id uuid);
    CREATE TABLE instructors(id uuid,first_name text,last_name text,is_active bool);
    CREATE TABLE class_sessions(instructor_id uuid,is_cancelled bool,session_date date,start_time time,end_time time);
    CREATE TABLE pt_appointments(instructor_id uuid,status text,starts_at timestamptz,ends_at timestamptz);
    CREATE TABLE training_requests(client_user_id uuid,request_kind text,request_status text,confirmed_trainer_id uuid,requested_trainer_id uuid,preferred_date date,preferred_time time);
    CREATE TABLE pt_waitlist(client_user_id uuid,status text,preferred_trainer_id uuid,session_type_id uuid,preferred_date date,preferred_time time);
    CREATE FUNCTION pt_assert_client_request_allowed(uuid) RETURNS void LANGUAGE plpgsql AS $$ BEGIN RETURN; END $$;
    CREATE FUNCTION pt_effective_client_booking_mode(uuid) RETURNS text LANGUAGE sql AS $$ SELECT 'request' $$;
    CREATE FUNCTION pt_check_slot_core(timestamptz,timestamptz,uuid,uuid,uuid,text,uuid,uuid) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{"has_conflict":false,"availability":"available","confirmed":0,"pending_requests":0,"capacity":1}'::jsonb $$;
    INSERT INTO pt_session_types VALUES('${id}',true,true,60,NULL,'semi_private');
    INSERT INTO pt_trainer_services VALUES('${id}','${id}');
    INSERT INTO instructors VALUES('${id}','Isolated','Trainer',true);
  `);
  const migration = readFileSync('drizzle/migrations/0226_pt_client_times_respect_hidden_schedules.sql','utf8');
  // Same unchanged engine serves staff; only the public variant filters visibility.
  const staff = migration.slice(0, migration.indexOf('REVOKE ALL')).replaceAll('pt_trainer_day_windows_public','pt_trainer_day_windows').replace('AND v.is_public = true','').replace('AND coalesce(o.is_public, true) = true','');
  await db.exec(staff);
  await db.exec(migration);
});
beforeEach(async () => {
  await db.exec(`TRUNCATE pt_trainer_availability,pt_trainer_overrides;
    INSERT INTO pt_trainer_availability VALUES('${id}',extract(dow from date '2099-11-27'),'10:00','12:00',NULL,NULL,true);`);
});
afterAll(async () => db.close());
it('hidden recurring hours disappear from both client lists and direct checks, while staff retain them', async () => {
  await db.exec('UPDATE pt_trainer_availability SET is_public=false;');
  for (const fn of [`pt_client_request_times('${id}','${id}','2099-11-27',1)`,`pt_client_request_times_all('${id}','2099-11-27',1)`]) {
    expect((await db.query(`SELECT ${fn} result`)).rows[0].result).toEqual([]);
  }
  expect((await db.query(`SELECT pt_client_slot_is_open('${future}','${id}','${id}','${id}') result`)).rows[0].result).toBe(false);
  expect((await db.query(`SELECT pt_client_slot_is_full('${future}','${id}','${id}','${id}') result`)).rows[0].result).toBe(false);
  expect((await db.query(`SELECT * FROM pt_trainer_day_windows('${id}','2099-11-27')`)).rows.length).toBe(1);
});
it('hidden one-off extra hours stay staff-only', async () => {
  await db.exec(`TRUNCATE pt_trainer_availability; INSERT INTO pt_trainer_overrides VALUES('${id}','2099-11-27',NULL,'extra','10:00','12:00',false);`);
  expect((await db.query(`SELECT * FROM pt_trainer_day_windows_public('${id}','2099-11-27')`)).rows).toEqual([]);
  expect((await db.query(`SELECT * FROM pt_trainer_day_windows('${id}','2099-11-27')`)).rows.length).toBe(1);
});
it('visible hours remain requestable as two one-hour blocks', async () => {
  const slots = (await db.query(`SELECT pt_client_request_times_all('${id}','2099-11-27',1) result`)).rows[0].result;
  expect(slots.length).toBe(2);
  expect(slots[0].starts_at).toBe('2099-11-27T15:00:00+00:00');
});