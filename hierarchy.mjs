import {manualWeights,calculateComparisons} from './ahp-engine.mjs';

export function hierarchyWeights(project){
  const h=project.hierarchy;
  if(!h?.enabled) throw Error('Hierarchy is not enabled');
  const groups=h.groups;
  if(!Array.isArray(groups)||groups.length<1||groups.length>10)throw Error('Add between 1 and 10 groups');
  const derive=(items,method,comparisons,label)=>{
    if(method==='manual')return manualWeights(items.map(x=>x.weight),{percent:true});
    if(method!=='pairwise')throw Error(`Invalid weighting method for ${label}`);
    const edges=[];
    for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
      const v=comparisons?.[`${items[i].id}|${items[j].id}`];
      if(v===undefined)throw Error(`Complete comparisons for ${label}: ${items[i].name} vs ${items[j].name}`);
      edges.push([i,j,v]);
    }
    return calculateComparisons(items.length,edges).weights;
  };
  const root=derive(groups,h.method,h.groupComparisons,'groups');
  const byId=new Map();const diagnostics=[];
  if(h.method==='pairwise')diagnostics.push({name:'Groups',cr:calcCR(groups,h.groupComparisons)});
  groups.forEach((g,i)=>{
    const children=project.criteria.filter(c=>c.groupId===g.id);
    if(children.length<1)throw Error(`Group ${g.name} has no criteria`);
    const local=derive(children,h.method,h.childComparisons?.[g.id],`group ${g.name}`);
    if(h.method==='pairwise')diagnostics.push({name:g.name,cr:calcCR(children,h.childComparisons?.[g.id])});
    children.forEach((c,j)=>byId.set(c.id,root[i]*local[j]));
  });
  if(byId.size!==project.criteria.length)throw Error('Assign every criterion to exactly one group');
  return {weights:project.criteria.map(c=>byId.get(c.id)),diagnostics};
}
function calcCR(items,comparisons){
  const edges=[];for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++)edges.push([i,j,comparisons[`${items[i].id}|${items[j].id}`]]);
  return calculateComparisons(items.length,edges).consistencyRatio;
}
export function validateHierarchy(project){
  const h=project.hierarchy;if(h===undefined)return true;
  const fail=s=>{throw Error('Invalid hierarchy: '+s)};
  if(!h||typeof h!=='object'||Array.isArray(h)||typeof h.enabled!=='boolean'||!['manual','pairwise'].includes(h.method))fail('configuration');
  if(!Array.isArray(h.groups)||h.groups.length<1||h.groups.length>10)fail('group count');
  const ids=new Set();for(const g of h.groups){if(!g||typeof g.id!=='string'||!g.id||g.id.includes('|')||['__proto__','constructor','prototype'].includes(g.id)||ids.has(g.id)||typeof g.name!=='string'||g.name.length>200||!(g.weight===null||typeof g.weight==='number'&&Number.isFinite(g.weight)&&g.weight>=0))fail('group');ids.add(g.id)}
  if(h.enabled){for(const c of project.criteria)if(!ids.has(c.groupId))fail('unassigned criterion');for(const g of h.groups)if(!project.criteria.some(c=>c.groupId===g.id))fail('empty group')}
  for(const [record,validIds] of [[h.groupComparisons,ids]]){if(!record||typeof record!=='object'||Array.isArray(record))fail('group comparisons');checkPairs(record,validIds,fail)}
  if(!h.childComparisons||typeof h.childComparisons!=='object'||Array.isArray(h.childComparisons))fail('child comparisons');
  for(const [gid,pairs] of Object.entries(h.childComparisons)){if(!ids.has(gid))fail('unknown child group');checkPairs(pairs,new Set(project.criteria.filter(c=>c.groupId===gid).map(c=>c.id)),fail)}
  return true;
}
function checkPairs(record,ids,fail){if(!record||typeof record!=='object'||Array.isArray(record))fail('comparison record');for(const [k,v] of Object.entries(record)){const [a,b,...extra]=k.split('|');if(extra.length||!ids.has(a)||!ids.has(b)||a===b||typeof v!=='number'||!Number.isFinite(v)||v<1/9-1e-12||v>9+1e-12)fail('comparison judgment')}}
export function resetHierarchyComparisons(p){if(p.hierarchy){p.hierarchy.groupComparisons={};p.hierarchy.childComparisons={};}p.weightAdjustment=null;p.scenarios=[];}
