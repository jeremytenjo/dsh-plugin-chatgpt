import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allowed,apply} from '../index.js';
const ctx={webServer:{getOrigin:()=> 'http://127.0.0.1:3080'}};
test('rejects external and cross-origin login requests',()=>{
 const req={socket:{remoteAddress:'127.0.0.1'},headers:{'x-dsh-chatgpt':'1'}};
 assert.equal(allowed(ctx,req),true);
 assert.equal(allowed(ctx,{...req,headers:{}}),false);
 assert.equal(allowed(ctx,{...req,headers:{...req.headers,origin:'https://evil.example'}}),false);
 assert.equal(allowed(ctx,{...req,socket:{remoteAddress:'10.0.0.1'}}),false);
 assert.equal(allowed(ctx,{...req,headers:{...req.headers,'sec-fetch-site':'cross-site'}}),false);
});
test('uses native OAuth and exposes status without credential values',async()=>{
 let handler, request;
 const host={...ctx,webServer:{...ctx.webServer,register:r=>{handler=r.handler;return()=>{}}},effect:f=>f(),credentials:{listRecords:async()=>[{key:'llm-pi-ai/openai-codex',kind:'grant'}]},authorization:{describe:()=>({}),begin:async r=>{request=r;return {status:'authorized'}}}};
 apply(host);
 const call=async(body)=>{let result;const req={method:body?'POST':'GET',socket:{remoteAddress:'127.0.0.1'},headers:{'x-dsh-chatgpt':'1'},async *[Symbol.asyncIterator](){yield JSON.stringify(body)}};await handler(req,{writeHead(){},end(s){result=JSON.parse(s)}});return result};
 assert.equal((await call()).signedIn,true);
 await call({action:'login'});
 assert.equal(request.key,'llm-pi-ai/openai-codex');assert.equal(request.method,'oauth');
 assert.equal('token' in await call(),false);
});
