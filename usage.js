import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {existsSync} from 'node:fs';
import {createInterface} from 'node:readline';
export function normalizeUsage(data) {
 const buckets=data.rateLimitsByLimitId ?? {codex:data.rateLimits};
 const output=[];
 for(const [id,bucket] of Object.entries(buckets)) {
  if(!bucket)continue;
  const windows=[bucket.primary,bucket.secondary].filter(w=>w && Number.isFinite(w.usedPercent) && Number.isFinite(w.windowDurationMins)).map(w=>({remainingPercent:Math.max(0,Math.min(100,100-w.usedPercent)),durationMinutes:w.windowDurationMins,resetsAt:Number.isFinite(w.resetsAt)?w.resetsAt:null}));
  if(windows.length)output.push({id,name:bucket.limitName || (id==='codex'?'ChatGPT':id),plan:bucket.planType ?? null,windows,credits:bucket.credits?{balance:bucket.credits.balance ?? null,unlimited:bucket.credits.unlimited===true}:null});
 }
 return {status:'ready',buckets:output,fetchedAt:Date.now()};
}
export async function readUsage(grant,{signal,executable}={}) {
 if(!grant?.access || !grant?.accountId)return {status:'signed-out',buckets:[]};
 const home=await mkdtemp(join(tmpdir(),'dsh-chatgpt-usage-'));
 const binary=executable || ['/Applications/Codex.app/Contents/Resources/codex','/opt/homebrew/bin/codex'].find(existsSync) || 'codex';
 let child,lines;
 try {
  child=spawn(binary,['app-server'],{env:{...process.env,CODEX_HOME:home},stdio:['pipe','pipe','ignore']});
  const pending=new Map();let next=0;
  const fail=()=>{for(const {reject} of pending.values())reject(Error('ChatGPT usage service unavailable'));pending.clear();};
  child.on('error',fail);child.on('exit',fail);
  const abort=()=>{fail();child.kill();};
  const timer=setTimeout(abort,20000);timer.unref();
  signal?.addEventListener('abort',abort,{once:true});
  lines=createInterface({input:child.stdout});
  lines.on('line',line=>{let msg;try{msg=JSON.parse(line)}catch{return}
   const request=pending.get(msg.id);if(!request)return;pending.delete(msg.id);
   if(msg.error)request.reject(Error('Unable to read ChatGPT usage. Refresh your ChatGPT sign-in if this persists.'));else request.resolve(msg.result);
  });
  const rpc=(method,params={})=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});child.stdin.write(JSON.stringify({id,method,params})+'\n',e=>{if(e){pending.delete(id);reject(Error('ChatGPT usage service unavailable'))}})});
  child.stdin.on('error',fail);
  try {
   await rpc('initialize',{clientInfo:{name:'dsh-plugin-chatgpt',version:'1.1.0'},capabilities:{experimentalApi:true}});
   child.stdin.write(JSON.stringify({method:'initialized',params:{}})+'\n');
   await rpc('account/login/start',{type:'chatgptAuthTokens',accessToken:grant.access,chatgptAccountId:grant.accountId});
   return normalizeUsage(await rpc('account/rateLimits/read'));
  } finally {clearTimeout(timer);signal?.removeEventListener('abort',abort);}
 } finally {lines?.close();child?.stdin.destroy();child?.kill();await rm(home,{recursive:true,force:true});}
}
export function usageReader(credentials,{signal}={}) {
 let cached,pending,account;
 return async(force=false)=>{
  const record=await credentials.readRecord('llm-pi-ai/openai-codex');
  if(record?.kind!=='grant') {cached=undefined;account=undefined;return {status:'signed-out',buckets:[]};}
  if(account!==record.payload.accountId){cached=undefined;account=record.payload.accountId;}
  if(!force && cached && Date.now()-cached.fetchedAt<60000)return cached;
  if(pending)return pending;
  pending=readUsage(record.payload,{signal}).then(result=>{cached=result;return result}).finally(()=>pending=undefined);
  return pending;
 };
}
