import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

// Regression tests for the blur -> change -> rerender focus-loss bug.
// Execute the current handlers, rather than maintaining a separate copy.
const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'inline module is present');
function between(start,end){
 const i=script.indexOf(start),j=script.indexOf(end,i);
 assert.ok(i>=0&&j>i,'Cannot find application code boundary: '+start);
 return script.slice(i,j);
}
const update=between('function update(fn,','function options(');
const bind=between('function refreshFieldFeedback(el){','function refreshPairwiseFeedback(el,');
const matrix=between('function bindPairwiseInputs(){','\nbindPairwiseInputs();');

function environment(){
 const titleField={value:'Updated criterion',handlers:{},matches:sel=>sel.includes('input:not'),addEventListener(type,fn){this.handlers[type]=fn;}};
 const pairField={value:'3',handlers:{},attributes:[{name:'data-criterion-pair',value:'c1|c2'}],nextElementSibling:{textContent:''},setCustomValidity(){},setAttribute(){},addEventListener(type,fn){this.handlers[type]=fn;}};
 const document={querySelectorAll(selector){return selector==='#title'?[titleField]:selector==='.pairwise-field'?[pairField]:[];}};
 const ctx={document,parseJudgement:Number,refreshPairwiseFeedback(){ctx.refreshes++;},refreshes:0};
 const prelude=[
  "let p={title:'Original',criteriaComparisons:{},weightAdjustment:null};",
  "let analyticsWeights=null,undoStack=[],renders=0,saves=0,step=0;",
  "const persist=()=>{saves++};",
  "const render=()=>{renders++};",
  "const alert=()=>{};",
  "const renderFrontier=()=>{};"
 ].join('\n');
 runInNewContext(prelude+'\n'+update+'\n'+bind+'\n'+matrix+
 '\nfunction getState(){return {title:p.title,comparison:p.criteriaComparisons["c1|c2"],renders,saves,undo:undoStack.length};}'+
 '\nglobalThis.actions={bindTitle:()=>bind("#title","change",el=>p.title=el.value),bindMatrix:()=>bindPairwiseInputs(),getState};',
 ctx);
 return {ctx,titleField,pairField};
}

test('committing a text field saves without rerendering or replacing next input',()=>{
 const {ctx,titleField}=environment();
 ctx.actions.bindTitle();
 titleField.handlers.change();
 const state=ctx.actions.getState();
 assert.equal(state.title,'Updated criterion');
 assert.equal(state.saves,1);
 assert.equal(state.renders,0);
 assert.equal(state.undo,1);
});

test('committing a pairwise cell saves and refreshes feedback without rerendering',()=>{
 const {ctx,pairField}=environment();
 ctx.actions.bindMatrix();
 pairField.handlers.change();
 const state=ctx.actions.getState();
 assert.equal(state.comparison,3);
 assert.equal(state.saves,1);
 assert.equal(state.renders,0);
 assert.equal(ctx.refreshes,1);
});
