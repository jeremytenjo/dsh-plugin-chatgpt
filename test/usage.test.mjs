import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeUsage,readUsage} from '../usage.js';
test('normalizes actual window durations, percentages and optional credits',()=>{
 const result=normalizeUsage({rateLimitsByLimitId:{codex:{planType:'plus',primary:{usedPercent:32,windowDurationMins:300,resetsAt:123},secondary:{usedPercent:17,windowDurationMins:10080,resetsAt:456},credits:{balance:'0',unlimited:false}}}});
 assert.equal(result.buckets[0].windows[0].remainingPercent,68);
 assert.equal(result.buckets[0].windows[1].remainingPercent,83);
 assert.equal(result.buckets[0].credits.balance,'0');
 assert.equal(JSON.stringify(result).includes('accessToken'),false);
});
test('handles absent windows and clamps percentages',()=>{
 const result=normalizeUsage({rateLimits:{primary:null,secondary:{usedPercent:110,windowDurationMins:10080}}});
 assert.equal(result.buckets[0].windows.length,1);assert.equal(result.buckets[0].windows[0].remainingPercent,0);
 assert.deepEqual(normalizeUsage({}).buckets,[]);
});
test('does not launch a process when signed out',async()=>assert.equal((await readUsage(null)).status,'signed-out'));
