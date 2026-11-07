import {usageReader} from './usage.js';
export const name = 'dsh-plugin-chatgpt';
export const inject = ['webServer', 'authorization', 'credentials'];
const KEY = 'llm-pi-ai/openai-codex';
const ROUTE = '/__dsh/chatgpt';
export function allowed(ctx, req) {
  const ip = req.socket?.remoteAddress;
  return ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(ip)
    && req.headers['x-dsh-chatgpt'] === '1'
    && req.headers['sec-fetch-site'] !== 'cross-site'
    && (!req.headers.origin || [ctx.webServer.getOrigin(), 'dsh-app://app', 'file://', 'null'].includes(req.headers.origin));
}
export function apply(ctx) {
  const lifetime = new AbortController();
  const usage = usageReader(ctx.credentials,{signal:lifetime.signal});
  ctx.effect(() => () => lifetime.abort());
  let state = {status:'idle', notices:[]};
  let controller, answer;
  const snapshot = async () => ({...state, signedIn:(await ctx.credentials.listRecords()).some(r => r.key === KEY), available:!!ctx.authorization.describe(KEY)});
  ctx.effect(() => () => { controller?.abort(); answer?.reject(new Error('Plugin unloaded')); });
  ctx.effect(() => ctx.webServer.register({kind:'exact', path:ROUTE, handler: async (req,res) => {
    const send = (code, data) => { res.writeHead(code, {'Content-Type':'application/json','Cache-Control':'no-store'}); res.end(JSON.stringify(data)); };
    try {
      if (!allowed(ctx,req)) return send(403,{error:'Local Harness requests only'});
      if (req.method === 'GET') {
        const url=new URL(req.url || ROUTE,'http://localhost');
        if(url.searchParams.has('usage')) {try{return send(200,await usage(url.searchParams.has('refresh')))}catch{return send(200,{status:'unavailable',buckets:[]})}}
        return send(200,await snapshot());
      }
      if (req.method !== 'POST') return send(405,{error:'Unsupported method'});
      let raw=''; for await (const part of req) { raw += part; if(raw.length>16384) return send(413,{error:'Request too large'}); }
      const body = JSON.parse(raw || '{}');
      if(body.action === 'login') {
        if(state.status === 'pending') return send(409,{error:'Sign-in already running'});
        controller = new AbortController(); state = {status:'pending',notices:[]};
        void ctx.authorization.begin({key:KEY,method:'oauth',signal:controller.signal,interaction:{
          notify(notice) { state.notices = [...state.notices.slice(-9),notice]; },
          prompt(prompt) { return new Promise((resolve,reject) => {
            const abort = () => { if(answer?.resolve === resolve) {answer=undefined; delete state.prompt;} reject(new Error('Prompt cancelled')); };
            state.prompt = {kind:prompt.kind,message:prompt.message,options:prompt.options,placeholder:prompt.placeholder};
            answer={resolve,reject,cleanup:()=>prompt.signal?.removeEventListener('abort',abort)};
            prompt.signal?.addEventListener('abort',abort,{once:true}); if(prompt.signal?.aborted) abort();
          }); }
        }}).then(result => { state.status=result.status; },error => {state.status='failed';state.error=error.message;}).finally(()=>{answer?.cleanup();answer=undefined;delete state.prompt;});
      } else if(body.action === 'answer') {
        if(!answer) return send(409,{error:'No pending question'});
        const pending=answer;answer=undefined;delete state.prompt;pending.cleanup();pending.resolve(String(body.value ?? ''));
      } else if(body.action === 'cancel') {controller?.abort();}
      else if(body.action === 'logout') {controller?.abort();await ctx.credentials.deleteRecord(KEY);state={status:'idle',notices:[]};}
      else return send(400,{error:'Unknown action'});
      send(200,await snapshot());
    } catch(error) {if(!res.headersSent) send(500,{error:error.message});}
  }}));
}
