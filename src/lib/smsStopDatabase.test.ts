// @ts-nocheck -- Local-only database: no network, accounts, or client messages.
import { beforeAll, afterAll, beforeEach, test, expect } from 'bun:test';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { smsPhoneChoice } from '../../supabase/functions/_shared/smsPhoneChoice';
let db;
const phone='+12485550123';
const choice=async (opt,source='sms_keyword',at='2026-11-25T16:00:00Z',id='event')=>db.query('SELECT record_sms_phone_choice($1,$2,$3,$4,$5)',[phone,opt,source,at,id]);
const blocked=async()=> (await db.query('SELECT sms_phone_is_blocked($1) b',[phone])).rows[0].b;
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
 CREATE TYPE app_role AS ENUM('admin','super_admin','manager');
 CREATE FUNCTION has_any_role(uuid,app_role[]) RETURNS bool LANGUAGE sql AS $$ SELECT false $$;
 CREATE FUNCTION phone_tail(text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT right(regexp_replace($1,'[^0-9]','','g'),10) $$;
 CREATE TABLE profiles(phone text,sms_opt_in bool,sms_opt_in_at timestamptz,sms_opt_in_source text,sms_opt_out_at timestamptz,sms_opt_out_source text);
 CREATE TABLE non_member_profiles(LIKE profiles);
 CREATE TABLE marketing_contacts(phone text,opted_in_sms bool);
 CREATE TABLE spa_guest_sms_consent(phone text,opted_in bool);
 CREATE TABLE sms_consent_log(phone text,action text,source text,disclosure_version text,created_at timestamptz,metadata jsonb);
 CREATE TABLE sms_messages(phone text,error_code text,created_at timestamptz);
 `);
 await db.exec(readFileSync('drizzle/migrations/0223_sms_phone_stop_protection.sql','utf8'));
});
afterAll(async()=>{await db.close();});
beforeEach(async()=>{
 await db.exec(`TRUNCATE profiles,non_member_profiles,marketing_contacts,spa_guest_sms_consent,sms_consent_log,sms_messages;
 INSERT INTO profiles(phone,sms_opt_in) VALUES('(248) 555-0123',true);
 INSERT INTO non_member_profiles(phone,sms_opt_in) VALUES('248-555-0123',true);
 INSERT INTO marketing_contacts VALUES('12485550123',true); INSERT INTO spa_guest_sms_consent VALUES('${phone}',true);`);
});
test('STOP turns consent off in all four sources despite phone formatting',async()=>{
 await choice(false);
 for(const [table,col] of [['profiles','sms_opt_in'],['non_member_profiles','sms_opt_in'],['marketing_contacts','opted_in_sms'],['spa_guest_sms_consent','opted_in']]) expect((await db.query(`SELECT ${col} v FROM ${table}`)).rows[0].v).toBe(false);
 expect(await blocked()).toBe(true);
});
test('21610 blocks later sends even before flags are repaired',async()=>{
 await db.query('INSERT INTO sms_messages VALUES($1,$2,$3)',[phone,'21610','2026-11-25T15:00Z']); expect(await blocked()).toBe(true);
 await choice(false,'twilio_21610'); expect((await db.query('SELECT sms_opt_in FROM profiles')).rows[0].sms_opt_in).toBe(false);
});
test('only verified START clears an existing carrier block',async()=>{
 await choice(false,'twilio_21610');
 await db.exec(`UPDATE profiles SET sms_opt_in=true; UPDATE non_member_profiles SET sms_opt_in=true;`);
 expect(await blocked()).toBe(true);
 await choice(true,'sms_keyword','2026-11-25T17:00Z','start'); expect(await blocked()).toBe(false);
 expect((await db.query('SELECT sms_opt_out_at FROM profiles')).rows[0].sms_opt_out_at).toBe(null);
});
test('late STOP backfill does not override later START',async()=>{
 await choice(true,'sms_keyword','2026-11-25T17:00Z','start'); await choice(false,'twilio_21610','2026-11-25T16:00Z','old'); expect(await blocked()).toBe(false);
});
test('retries record each carrier event once',async()=>{
 await choice(false); await choice(false); expect((await db.query('SELECT count(*)::int n FROM sms_consent_log')).rows[0].n).toBe(1);
});
test('failed numbers and ordinary opt-in cannot opt others in',async()=>{
 await expect(choice(true,'twilio_21610')).rejects.toThrow('Invalid consent source');
});
test('all STOP aliases and Advanced Opt-Out become opt-outs; HELP does not',()=>{
 for(const word of ['STOP','STOPALL','UNSUBSCRIBE','CANCEL','END','QUIT']) expect(smsPhoneChoice(word,null)).toBe(false);
 expect(smsPhoneChoice('custom text','STOP')).toBe(false); expect(smsPhoneChoice('custom text','START')).toBe(true); expect(smsPhoneChoice('HELP','HELP')).toBe(null);
});
