import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateProject} from './project-validation.mjs';
import {manualWeights,calculateComparisons,paretoFront,synthesize} from './ahp-engine.mjs';
const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
const source=html.match(/const newProject=\(\)=>\((\{.*?\})\);\nlet p/s)?.[1];
const sample=Function('return ('+source+')')();
const clone=x=>structuredClone(x);
test('sample project schema validates',()=>assert.equal(validateProject(clone(sample)).version,1));
test('reject malformed / imported project structures',()=>{
 for(const mutation of [p=>p.criteria=[],p=>p.criteria[0].id='__proto__',p=>p.alternatives[1].id=p.alternatives[0].id,p=>p.criteriaComparisons['other|c1']=2,p=>p.scores.c1.a1='oops',p=>p.objectives[0].direction='up',p=>p.weightAdjustment=[2,0,0],p=>p.altComparisons.c1={'a1|fake':3}]){
   const p=clone(sample);mutation(p);assert.throws(()=>validateProject(p));
 }
});
test('blank unfinished scores can persist as null and cannot calculate',()=>{const p=clone(sample);p.scores.c1.a1=null;validateProject(p);assert.throws(()=>manualWeights([p.scores.c1.a1,8]),/finite/)});
test('permutation invariance in synthesis',()=>{const base=synthesize(['a','b','c'],[.4,.6],[[.2,.3,.5],[.5,.4,.1]]);const other=synthesize(['c','a','b'],[.4,.6],[[.5,.2,.3],[.1,.5,.4]]);for(const x of base)assert.ok(Math.abs(x.score-other.find(y=>x.id===y.id).score)<1e-12)});
test('pairwise scale extremes are stable',()=>{for(let n=1;n<=10;n++){const comparisons=[];for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)comparisons.push([i,j,(i+j)%2?9:1/9]);const r=calculateComparisons(n,comparisons);assert.ok(r.weights.every(Number.isFinite));assert.ok(Math.abs(r.weights.reduce((a,b)=>a+b,0)-1)<1e-12);assert.ok(Number.isFinite(r.consistencyRatio))}});
test('Pareto invariance to positive affine objective scale transformations',()=>{const pts=[{id:'a',objectives:{x:2,y:3}},{id:'b',objectives:{x:3,y:2}},{id:'c',objectives:{x:4,y:4}}];const a=paretoFront(pts,{x:'minimize',y:'maximize'},{epsilon:0});const b=paretoFront(pts.map(p=>({id:p.id,objectives:{x:p.objectives.x*100+11,y:p.objectives.y*100+19}})),{x:'minimize',y:'maximize'},{epsilon:0});assert.deepEqual(a.map(x=>x.efficient),b.map(x=>x.efficient))});
