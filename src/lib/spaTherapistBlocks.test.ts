// @ts-nocheck
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

let db;
const therapist = '85fae30e-efae-4a3d-86dd-5101ba4bc25c';
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE TABLE public.spa_therapist_blocks(therapist_id uuid,block_date date,start_time time,end_time time);
  CREATE TABLE public.spa_appointments(staff_id uuid,appointment_date date,appointment_time time,duration_minutes integer,cleanup_minutes integer,status text);`);
  const sql = readFileSync('drizzle/migrations/0133_spa_therapist_time_blocks.sql','utf8');
  const from = sql.indexOf('CREATE FUNCTION public.enforce_spa_therapist_block()');
  const to = sql.indexOf('REVOKE ALL ON FUNCTION public.enforce_spa_therapist_block()');
  await db.exec(sql.slice(from,to));
  await db.exec(`INSERT INTO spa_therapist_blocks VALUES('${therapist}','2026-11-06','10:30','12:30');`);
});
afterAll(async () => { await db.close(); });
const book = (time, duration = 60, cleanup = 15, staff = therapist, date = '2026-11-06', status = 'confirmed') => db.exec(`INSERT INTO spa_appointments VALUES('${staff}','${date}','${time}',${duration},${cleanup},'${status}');`);
describe('therapist training blocks', () => {
  it('blocks Teresa Friday November 6 at 10:30 AM', async () => {
    await expect(book('10:30')).rejects.toThrow('unavailable');
  });
  it('blocks an earlier appointment whose cleanup overlaps training', async () => {
    await expect(book('09:30')).rejects.toThrow('unavailable');
  });
  it('allows an appointment starting at 12:30 PM when training ends', async () => {
    await book('12:30');
    expect((await db.query(`SELECT count(*)::int AS n FROM spa_appointments WHERE appointment_time='12:30'`)).rows[0].n).toBe(1);
  });
  it('leaves other therapists and dates available', async () => {
    await book('10:30',60,15,'00000000-0000-0000-0000-000000000001');
    await book('10:30',60,15,therapist,'2026-11-07');
    expect((await db.query(`SELECT count(*)::int AS n FROM spa_appointments WHERE appointment_time='10:30'`)).rows[0].n).toBe(2);
  });
  it('rejects a time block overlapping an existing booking', async () => {
    await expect(db.exec(`INSERT INTO spa_therapist_blocks VALUES('${therapist}','2026-11-06','13:00','14:00');`)).rejects.toThrow('existing appointment');
  });
  it('rejects moving a booked appointment into the blocked time', async () => {
    await expect(db.exec(`UPDATE spa_appointments SET appointment_time='11:00' WHERE staff_id='${therapist}' AND appointment_date='2026-11-06';`)).rejects.toThrow('unavailable');
  });
});