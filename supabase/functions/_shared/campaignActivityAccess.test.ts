// @ts-nocheck -- isolated database test; never connects to production.
import { expect, it } from 'bun:test';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

it('activity access permits service timers and managers but denies clients and anonymous callers', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE SCHEMA auth; CREATE ROLE service_role; CREATE TYPE app_role AS ENUM ('super_admin','admin','manager','member');
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
      CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_setting('test.jwt_role',true) $$;
      CREATE FUNCTION public.has_any_role(uuid, app_role[]) RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.staff',true) = 'yes' $$;
      CREATE FUNCTION public.admin_person_activity() RETURNS TABLE(email text) LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN
        IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]) THEN RAISE EXCEPTION 'not authorized'; END IF;
        RETURN QUERY SELECT 'test@invalid.test'::text; END $$;`);
    await db.exec(readFileSync('drizzle/migrations/0218_campaign_activity_service_access.sql', 'utf8'));
    await db.exec(`SET test.jwt_role='authenticated'; SET test.staff='no';`);
    await expect(db.query('SELECT * FROM admin_person_activity()')).rejects.toThrow('not authorized');
    await db.exec(`SET test.jwt_role='anon';`);
    await expect(db.query('SELECT * FROM admin_person_activity()')).rejects.toThrow('not authorized');
    await db.exec(`SET test.jwt_role='service_role';`);
    expect((await db.query('SELECT * FROM admin_person_activity()')).rows.length).toBe(1);
    await db.exec(`SET test.jwt_role='authenticated'; SET test.staff='yes';`);
    expect((await db.query('SELECT * FROM admin_person_activity()')).rows.length).toBe(1);
  } finally { await db.close(); }
});
