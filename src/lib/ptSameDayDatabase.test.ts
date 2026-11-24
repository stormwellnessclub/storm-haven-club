// @ts-nocheck -- Isolated Bun/PGlite tests; never connect to the live database.
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'bun:test';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
let db;
const id = '00000000-0000-0000-0000-000000000001';
const future = '2026-11-24T15:00:00Z'; // 10 AM Detroit, same day as fixed 3:54 AM clock.
const check = async (fn, at = future) => (await db.query(`SELECT ${fn}('${at}', '${id}', '${id}', '${id}') AS result`)).rows[0].result;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '${id}'::uuid $$;
    CREATE FUNCTION current_user_email() RETURNS text LANGUAGE sql AS $$ SELECT 'isolated@example.test' $$;
    CREATE FUNCTION pt_assert_client_request_allowed(uuid) RETURNS void LANGUAGE plpgsql AS $$ BEGIN RETURN; END $$;
    CREATE FUNCTION pt_effective_client_booking_mode(uuid) RETURNS text LANGUAGE sql AS $$ SELECT 'request' $$;
    CREATE TABLE pt_session_types(id uuid, name text, is_active bool, client_requestable bool, duration_minutes int, default_location_id uuid, format text);
    CREATE TABLE pt_trainer_services(instructor_id uuid, session_type_id uuid);
    CREATE TABLE instructors(id uuid,first_name text,last_name text,is_active bool);
    CREATE TABLE class_sessions(instructor_id uuid,is_cancelled bool,session_date date,start_time time,end_time time);
    CREATE TABLE pt_appointments(instructor_id uuid,status text,starts_at timestamptz,ends_at timestamptz);
    CREATE TABLE training_requests(id uuid DEFAULT gen_random_uuid(), service text,full_name text,email text,phone text,is_member bool,status text,submitted_by_user_id uuid,client_user_id uuid,requested_trainer_id uuid,confirmed_trainer_id uuid,pt_session_type_id uuid,preferred_date date,preferred_time time,flexibility_note text,client_note text,request_status text,earliest_time time,latest_time time,flexibility text,requested_slot_at timestamptz,request_kind text,origin text);
    ALTER TABLE training_requests ADD COLUMN alt_date date, ADD COLUMN alt_time time, ADD COLUMN alt_trainer_id uuid, ADD COLUMN alt_note text, ADD COLUMN offered_at timestamptz, ADD COLUMN offered_by uuid, ADD COLUMN updated_at timestamptz;
    CREATE TABLE profiles(user_id uuid,first_name text,last_name text,email text,phone text);
    CREATE TABLE members(user_id uuid,status text);
    CREATE TABLE pt_waitlist(id uuid DEFAULT gen_random_uuid(),client_user_id uuid,status text,preferred_trainer_id uuid,session_type_id uuid,preferred_date date,preferred_time time,flexibility text,notes text,created_by uuid);
    CREATE TABLE test_conflicts(has_conflict bool);
    INSERT INTO test_conflicts VALUES(false);
    CREATE FUNCTION pt_trainer_day_windows(uuid,date) RETURNS TABLE(win_start timestamptz,win_end timestamptz) LANGUAGE sql AS $$ SELECT ($2::timestamp AT TIME ZONE 'America/Detroit'), (($2+1)::timestamp AT TIME ZONE 'America/Detroit') $$;
    CREATE FUNCTION pt_check_slot_core(timestamptz,timestamptz,uuid,uuid,uuid,text,uuid,uuid) RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('has_conflict',has_conflict,'availability','available','confirmed',0,'pending_requests',0,'capacity',1) FROM test_conflicts $$;
    INSERT INTO pt_session_types VALUES('${id}','Semi Private',true,true,60,NULL,'semi_private');
    INSERT INTO pt_trainer_services VALUES('${id}','${id}');
    INSERT INTO instructors VALUES('${id}','Trainer','Test',true);
    INSERT INTO profiles VALUES('${id}','Isolated','Test','isolated@example.test','');
  `);
  await db.exec(readFileSync('src/lib/test-fixtures/ptSameDayBaseline.sql','utf8'));
  await db.exec(readFileSync('drizzle/migrations/0219_pt_same_day_request_times.sql','utf8'));
  // Freeze time only after applying the unchanged real migration to real baseline definitions.
  await db.exec(`CREATE FUNCTION pt_test_now() RETURNS timestamptz LANGUAGE sql AS $$ SELECT '2026-11-24T08:54:00Z'::timestamptz $$;`);
  const defs = await db.query(`SELECT pg_get_functiondef(oid) AS definition FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('pt_client_slot_is_open','pt_client_slot_is_full','pt_client_request_times','pt_client_request_times_all','pt_request_create')`);
  for (const row of defs.rows) await db.exec(row.definition.replaceAll('now()', 'public.pt_test_now()'));
});
afterAll(async () => { await db.close(); });
beforeEach(async () => { await db.exec('TRUNCATE training_requests,pt_appointments,class_sessions,pt_waitlist; UPDATE test_conflicts SET has_conflict=false;'); });
describe('same-day PT requests', () => {
  it('allows an open PT hour today', async () => expect(await check('pt_client_slot_is_open')).toBe(true));
  it('rejects elapsed starts including exactly now', async () => {
    expect(await check('pt_client_slot_is_open','2026-11-24T08:00:00Z')).toBe(false);
    expect(await check('pt_client_slot_is_open','2026-11-24T08:54:00Z')).toBe(false);
    expect(await check('pt_client_slot_is_full','2026-11-24T08:00:00Z')).toBe(false);
  });
  it('lists today for both all-trainer and single-trainer views, with no elapsed times', async () => {
    for (const args of [`pt_client_request_times_all('${id}',NULL,1)`,`pt_client_request_times('${id}','${id}',NULL,1)`]) {
      const slots=(await db.query(`SELECT ${args} AS slots`)).rows[0].slots;
      expect(slots.length).toBe(20);
      expect(slots[0].starts_at).toBe('2026-11-24T09:00:00+00:00');
      expect(slots.some(s=>new Date(s.starts_at).getTime()===new Date(future).getTime())).toBe(true);
      expect(slots.every(s=>new Date(s.starts_at)>new Date('2026-11-24T08:54:00Z'))).toBe(true);
    }
  });
  it('saves a same-day request without creating an appointment', async () => {
    await db.query(`SELECT pt_request_create('${id}','${id}',p_slot_starts_at=>'${future}')`);
    const rows=(await db.query('SELECT preferred_date::text,preferred_time::text,request_status FROM training_requests')).rows;
    expect(rows).toEqual([{preferred_date:'2026-11-24',preferred_time:'10:00:00',request_status:'requested'}]);
    expect((await db.query('SELECT count(*)::int AS n FROM pt_appointments')).rows[0].n).toBe(0);
  });
  it('also allows future same-day legacy date/time requests and rejects past ones',async()=>{
    await db.query(`SELECT pt_request_create('${id}','${id}','2026-11-24','10:00')`);
    expect((await db.query('SELECT count(*)::int AS n FROM training_requests')).rows[0].n).toBe(1);
    await expect(db.query(`SELECT pt_request_create('${id}','${id}','2026-11-24','03:00')`)).rejects.toThrow('not started yet');
  });
  it('changes a pending request to today while rejecting an elapsed replacement', async () => {
    const request=(await db.query(`SELECT pt_request_create('${id}','${id}',p_slot_starts_at=>'2026-11-25T15:00:00Z') AS id`)).rows[0].id;
    await db.query(`SELECT pt_request_client_change('${request}','${id}','${future}')`);
    expect((await db.query(`SELECT preferred_date::text,preferred_time::text,request_status FROM training_requests WHERE id='${request}'`)).rows).toEqual([{preferred_date:'2026-11-24',preferred_time:'10:00:00',request_status:'requested'}]);
    await expect(db.query(`SELECT pt_request_client_change('${request}','${id}','2026-11-24T08:00:00Z')`)).rejects.toThrow('SLOT_TAKEN');
    expect((await db.query('SELECT count(*)::int AS n FROM pt_appointments')).rows[0].n).toBe(0);
  });
  it('keeps genuine class clashes and core conflicts unavailable today', async () => {
    await db.exec(`INSERT INTO class_sessions VALUES('${id}',false,'2026-11-24','10:00','11:00');`);
    expect(await check('pt_client_slot_is_open')).toBe(false);
    await expect(db.query(`SELECT pt_request_create('${id}','${id}',p_slot_starts_at=>'${future}')`)).rejects.toThrow('SLOT_TAKEN');
    await db.exec('TRUNCATE class_sessions; UPDATE test_conflicts SET has_conflict=true;');
    expect(await check('pt_client_slot_is_open')).toBe(false);
  });
  it('permits a same-day full hour on the waitlist without booking it',async()=>{
    await db.exec(`INSERT INTO pt_appointments VALUES('${id}','scheduled','${future}','2026-11-24T16:00:00Z'); UPDATE test_conflicts SET has_conflict=true;`);
    expect(await check('pt_client_slot_is_full')).toBe(true);
    await db.query(`SELECT pt_waitlist_join('${id}','${id}','${future}')`);
    expect((await db.query('SELECT preferred_date::text,preferred_time::text FROM pt_waitlist')).rows).toEqual([{preferred_date:'2026-11-24',preferred_time:'10:00:00'}]);
    expect((await db.query('SELECT count(*)::int AS n FROM pt_appointments')).rows[0].n).toBe(1);
  });
});
