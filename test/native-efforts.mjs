import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {Config,apply}=await import(pathToFileURL(process.env.DSH_ADAPTER_MODULE));
const path=new URL('..',import.meta.url).pathname;
const raw=JSON.parse(await readFile(path+'/model-config.json','utf8'));
let adapter;
const ctx={fiber:{entry:{options:{id:'llm-pi-ai'}}},inject(){},get(){},on(){},logger:{warn(){},error(){}},llm:{registerConfigurableProviders(){return {replace(){}}},registerModelDiscovery(){},registerAdapter(routes,a){adapter=a;return {replace(){}}}}};
apply(ctx,Config(raw));
for(const [id,override] of Object.entries(raw.providers['openai-codex'].modelOverrides)) {
 const result=await adapter.resolveModel('openai-codex',id);
 const expected=Object.keys(override.reasoningEfforts);
 assert.deepEqual(result.reasoning.efforts.map(x=>x.id),expected,id);
 const native=adapter.modelOf(adapter.current(),'openai-codex',id);
 for(const [level,wire] of Object.entries(override.reasoningEfforts)) assert.equal(native.thinkingLevelMap[level],wire);
 assert.equal(native.thinkingLevelMap.minimal,null);
 console.log(id,expected.join(', '));
}
for (const bad of ['minimal','off']) {
 const stream=adapter.stream({provider:'openai-codex',model:'gpt-6.1-sol',reasoningEffort:bad,messages:[]});
 await assert.rejects(async()=>{for await(const c of stream) {}},e=>e.code==='UNSUPPORTED_REASONING_EFFORT');
}
console.log('Native adapter capabilities, wire mappings and unsupported-effort rejection passed.');
