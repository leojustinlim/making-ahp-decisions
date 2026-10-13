import assert from 'node:assert/strict';
import {scoreBreakdown,weightsAt,sensitivityThresholds,compareScenarios,robustness,projectionFront} from './advanced-analytics.mjs';
let total=0;function test(name,fn){fn();total++;console.log('PASS',name)}
const close=(a,b,eps=1e-10)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
const cols=[[0.8,0.2],[0.2,0.8]],ids=['A','B'];
test('weighted contributions and scores',()=>{const a=scoreBreakdown([.75,.25],cols,ids);close(a[0].score,.65);close(a[1].score,.35);close(a[0].contributions.reduce((x,y)=>x+y,0),a[0].score)});
test('weight redistribution',()=>{const x=weightsAt([.3,.3,.4],0,.5);close(x[0],.5);close(x[1],.2142857142857143);close(x.reduce((a,b)=>a+b,0),1)});
test('zero remainder uses equal distribution',()=>{const x=weightsAt([1,0,0],0,.25);close(x[0],.25);close(x[1],.375);close(x[2],.375)});
test('single criterion stays 1',()=>assert.deepEqual(weightsAt([1],0,.25),[1]));
test('analytical boundary at 50%',()=>{const s=sensitivityThresholds([.8,.2],cols,0,ids);assert.equal(s.intervals.length,2);close(s.intervals[0].to,.5);assert.deepEqual(s.intervals[0].winners,['B']);assert.deepEqual(s.intervals[1].winners,['A']);assert.deepEqual(s.boundaries[1].winners,['A','B'])});
test('no crossing in strictly ordered alternatives',()=>{const s=sensitivityThresholds([.4,.6],[[.9,.1],[.8,.2]],0,ids);assert.equal(s.intervals.length,1);assert.deepEqual(s.intervals[0].winners,['A'])});
test('scenario scores and ranks',()=>{const s=compareScenarios([{name:'Cost',weights:[.9,.1]},{name:'Quality',weights:[.1,.9]}],cols,ids);assert.equal(s[0].results[0].id,'A');assert.equal(s[1].results[0].id,'B')});
test('robustness deterministic',()=>{const a=robustness([.5,.5],cols,ids,{samples:1000,seed:99}),b=robustness([.5,.5],cols,ids,{samples:1000,seed:99});assert.deepEqual(a,b);close(a.results.reduce((s,x)=>s+x.firstShare,0),1)});
test('zero variation yields fixed winner',()=>{const a=robustness([.8,.2],cols,ids,{relativeRange:0,samples:100});close(a.results[0].firstShare,1)});
test('projection differs from global Pareto when third dimension rescues point',()=>{const pts=[{id:'A',objectives:{x:2,y:2,z:0}},{id:'B',objectives:{x:1,y:1,z:3}}];const r=projectionFront(pts,{x:'maximize',y:'maximize',z:'maximize'},'x','y');assert.equal(r[1].efficientAll,true);assert.equal(r[1].efficient2D,false)});
test('reject malformed inputs',()=>{assert.throws(()=>scoreBreakdown([1],[[NaN]],['A']));assert.throws(()=>weightsAt([1,1],3,.5));assert.throws(()=>robustness([1,1],cols,ids,{samples:0}));assert.throws(()=>projectionFront([{id:'a',objectives:{x:1}}],{x:'maximize'},'x','x'))});
console.log(`${total} phase 4 tests passed`);
