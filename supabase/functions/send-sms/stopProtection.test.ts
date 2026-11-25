// Local mocked request handler; never loads credentials or contacts any network.
import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
function harness(blocked: boolean, failLookup = false) {
 let handler: (req: Request) => Promise<Response>; let fetches=0; const calls: string[]=[];
 const query=(table:string)=> {
   const q:any={}; for(const name of ['select','eq','insert','not','limit']) q[name]=()=>q;
   q.maybeSingle=async()=>({data:table==='profiles'?{phone:'+12485550123',sms_opt_in:true}:null});
   q.single=async()=>({data:{id:'local'}});
   q.then=(resolve:any)=>resolve({data:null,error:null}); return q;
 };
 const admin={from:query,rpc:async(name:string)=>{calls.push(name); if(name==='sms_phone_is_blocked')return {data:blocked,error:failLookup?new Error('local consent lookup failure'):null}; if(name==='record_sms_phone_choice'){blocked=true;return {error:null}};return {data:true,error:null}}};
 const env:Record<string,string>={SUPABASE_URL:'https://local.invalid',SUPABASE_SERVICE_ROLE_KEY:'local-only-key',TWILIO_ACCOUNT_SID:'local',TWILIO_AUTH_TOKEN:'local',TWILIO_FROM_NUMBER:'+12485550111'};
 const Deno={env:{get:(k:string)=>env[k]},serve:(h:any)=>handler=h};
 const source=readFileSync('supabase/functions/send-sms/index.ts','utf8').replace(/^import .*;\n/gm,'');
 const js=new Bun.Transpiler({loader:'ts'}).transformSync(source);
 new Function('createClient','Deno','fetch','isValidInternalToken','presentedInternalToken',js)(()=>admin,Deno,async()=>{fetches++;return Response.json({code:21610,message:'local STOP refusal'},{status:400})},async()=>false,()=>null);
 const send=async()=>{
 const response=await handler(new Request('https://local.invalid/send-sms',{method:'POST',headers:{Authorization:'Bearer local-only-key','Content-Type':'application/json'},body:JSON.stringify({to:{phone:'+12485550123'},templateKey:'test-message',idempotencyKey:'local-test',bypassConsent:true})})); return response.json();};
 return {send,calls,fetches:()=>fetches};
}
test('carrier STOP blocks even a service-role consent bypass without a provider attempt',async()=>{const h=harness(true);expect((await h.send()).error).toBe('no_consent');expect(h.fetches()).toBe(0)});
test('21610 persists opt-out and the next attempt never reaches provider',async()=>{const h=harness(false);expect((await h.send()).success).toBe(false);expect(h.calls).toContain('record_sms_phone_choice');expect(h.fetches()).toBe(1);expect((await h.send()).error).toBe('no_consent');expect(h.fetches()).toBe(1)});
test('consent lookup failure fails closed without a provider attempt',async()=>{const h=harness(false,true);expect((await h.send()).success).toBe(false);expect(h.fetches()).toBe(0)});
