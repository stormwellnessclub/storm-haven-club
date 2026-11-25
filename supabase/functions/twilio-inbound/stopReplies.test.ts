// Mocked signed Twilio requests only. No real accounts, credentials or sends.
import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { smsPhoneChoice } from '../_shared/smsPhoneChoice';
async function request(body: string, carrier?: string, invalid=false, dbError=false) {
 let handler:any; const choices:any[]=[];
 const q:any={select:()=>q,ilike:()=>q,insert:()=>Promise.resolve({error:null}),then:(r:any)=>r({data:[]})};
 const db={from:()=>q,rpc:async(_name:string,args:any)=>{choices.push(args);return {error:dbError?new Error('isolated write failed'):null}}};
 const url='https://local.invalid/functions/v1/twilio-inbound';
 const env:Record<string,string>={SUPABASE_URL:'https://local.invalid',SUPABASE_SERVICE_ROLE_KEY:'isolated-key',TWILIO_AUTH_TOKEN:'isolated-signing-key'};
 const source=readFileSync('supabase/functions/twilio-inbound/index.ts','utf8').replace(/^import .*;\n/gm,'');
 new Function('createClient','Deno','encodeBase64','smsPhoneChoice',new Bun.Transpiler({loader:'ts'}).transformSync(source))(()=>db,{env:{get:(k:string)=>env[k]},serve:(h:any)=>handler=h},(a:Uint8Array)=>Buffer.from(a).toString('base64'),smsPhoneChoice);
 const params=new URLSearchParams({From:'+12485550123',Body:body,MessageSid:'isolated-sid',...(carrier?{OptOutType:carrier}:{})});
 let data=url;for(const key of [...params.keys()].sort()) data+=key+params.get(key);
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode('isolated-signing-key'),{name:'HMAC',hash:'SHA-1'},false,['sign']);
 const signature=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(data))).toString('base64');
 const r=await handler(new Request(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','X-Twilio-Signature':invalid?'invalid':signature},body:params.toString()}));
 return {status:r.status,text:await r.text(),choices};
}
test('valid signed STOP records opt-out',async()=>{const r=await request('STOP');expect(r.status).toBe(200);expect(r.choices[0]._opt_in).toBe(false);expect(r.choices[0]._source).toBe('sms_keyword')});
test('Advanced Opt-Out records STOP without a second confirmation',async()=>{const r=await request('custom stop','STOP');expect(r.choices[0]._opt_in).toBe(false);expect(r.text).toBe('<?xml version="1.0" encoding="UTF-8"?><Response/>')});
test('signed START records restart',async()=>{const r=await request('START');expect(r.choices[0]._opt_in).toBe(true)});
test('forged replies cannot change consent',async()=>{const r=await request('START',undefined,true);expect(r.status).toBe(403);expect(r.choices.length).toBe(0)});
test('failed consent writes ask Twilio to retry instead of silently succeeding',async()=>{const r=await request('STOP',undefined,false,true);expect(r.status).toBe(500)});
