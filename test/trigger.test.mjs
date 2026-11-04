import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createProfile,normalizeProfile,exportProfile,importProfile,
  TRIGGER_DEFAULTS,triggerValue,triggerFor,triggerSelection,applyTriggerPatch,resetTriggerKeys
} from '../public/keyboard-model.mjs';
import {triggerKeyPreview,triggerBoxSelection,createTriggerHistory} from '../public/keyboard-trigger.mjs';
const copy=value=>JSON.parse(JSON.stringify(value));

test('legacy trigger profiles retain their existing values and acquire optional defaults',()=>{
  const p=createProfile();p.trigger={actuation:1.25,rapid:true,press:.1,release:.25,perKey:{KeyW:{actuation:.15,rapid:true,press:.1,release:.3}}};
  const next=normalizeProfile(p);assert.equal(next.id,p.id);assert.equal(next.trigger.actuation,1.25);assert.equal(next.trigger.release,.25);
  assert.equal(next.trigger.separate,true);assert.equal(next.trigger.berserk,false);assert.equal(next.trigger.perKey.KeyW.actuation,.15);assert.equal(next.trigger.perKey.KeyW.release,.3);
});
test('selection exposes mixed values without presenting the first value as shared',()=>{
  const p=createProfile();applyTriggerPatch(p,['KeyW'],{actuation:.1});applyTriggerPatch(p,['KeyA'],{actuation:.3});
  const selected=triggerSelection(p,['KeyW','KeyA','Fn']);assert.equal(selected.count,2);assert.equal(selected.fields.actuation.mixed,true);assert.equal(selected.fields.actuation.value,null);assert.equal(selected.fields.press.value,.2);
  assert.equal(triggerSelection(p,[]).count,0);
});
test('bulk editing changes only the chosen field and preserves unrelated keys and features',()=>{
  const p=createProfile();p.lighting.color='#ff0000';p.bindings.win.KeyA={kind:'key',code:'KeyB'};
  applyTriggerPatch(p,['KeyW'],{actuation:.1,rapid:true,press:.11,release:.25});applyTriggerPatch(p,['KeyA'],{actuation:.4,press:.5,release:.7});
  const before=copy(p);applyTriggerPatch(p,['KeyW','KeyA'],{actuation:.33});
  assert.equal(triggerFor(p,'KeyW').press,.11);assert.equal(triggerFor(p,'KeyA').press,.5);assert.equal(triggerFor(p,'KeyW').release,.25);assert.equal(triggerFor(p,'KeyA').release,.7);
  assert.deepEqual(p.lighting,before.lighting);assert.deepEqual(p.bindings,before.bindings);assert.deepEqual(triggerFor(p,'KeyS'),triggerValue(TRIGGER_DEFAULTS));
});
test('linking uses each key own press sensitivity rather than copying the first key',()=>{
  const p=createProfile();applyTriggerPatch(p,['KeyW'],{press:.1,release:.3});applyTriggerPatch(p,['KeyA'],{press:.5,release:.7});
  applyTriggerPatch(p,['KeyW','KeyA'],{separate:false});assert.equal(triggerFor(p,'KeyW').release,.1);assert.equal(triggerFor(p,'KeyA').release,.5);
  applyTriggerPatch(p,['KeyW'],{press:.125});assert.equal(triggerFor(p,'KeyW').press,.13);assert.equal(triggerFor(p,'KeyW').release,.13);
  applyTriggerPatch(p,['KeyW'],{release:.175});assert.equal(triggerFor(p,'KeyW').press,.18);assert.equal(triggerFor(p,'KeyW').release,.18);
});
test('Berserk changes editing precision to .005 and normal mode deliberately rounds to .01',()=>{
  const p=createProfile();applyTriggerPatch(p,['KeyW'],{berserk:true,actuation:.125,press:.155});assert.equal(triggerFor(p,'KeyW').actuation,.125);assert.equal(triggerFor(p,'KeyW').press,.155);assert.equal(triggerSelection(p,['KeyW']).step,.005);
  applyTriggerPatch(p,['KeyA'],{berserk:false});assert.equal(triggerSelection(p,['KeyW','KeyA']).step,.01);
  applyTriggerPatch(p,['KeyW'],{berserk:false});assert.equal(triggerFor(p,'KeyW').actuation,.13);assert.equal(triggerFor(p,'KeyW').press,.16);
});
test('enabled deadzones constrain the point without erasing stored zones when disabled',()=>{
  const p=createProfile();applyTriggerPatch(p,['KeyW'],{actuation:.1,topDeadzone:.5,deadzoneEnabled:true});assert.equal(triggerFor(p,'KeyW').actuation,.5);
  applyTriggerPatch(p,['KeyW'],{actuation:3.3,bottomDeadzone:1});assert.equal(triggerFor(p,'KeyW').actuation,2.36);
  applyTriggerPatch(p,['KeyW'],{deadzoneEnabled:false});assert.equal(triggerFor(p,'KeyW').topDeadzone,.5);assert.equal(triggerFor(p,'KeyW').bottomDeadzone,1);
});
test('invalid patches and protected Fn fail atomically before updating any key',()=>{
  const p=createProfile(),before=copy(p);
  for(const [keys,patch]of [[[],{actuation:.1}],[['KeyW','Fn'],{rapid:true}],[['KeyW'],{actuation:9}],[['KeyW'],{switchType:'arbitrary'}],[['KeyW'],{firmware:'reset'}],[['KeyW'],{topDeadzone:2}]])assert.throws(()=>applyTriggerPatch(p,keys,patch));
  assert.deepEqual(p,before);
});
test('Trigger reset removes only selected overrides and retains other profile settings',()=>{
  const p=createProfile();applyTriggerPatch(p,['KeyW','KeyA'],{rapid:true,berserk:true,actuation:.125});p.lighting.color='#00ff00';const other=copy(p.trigger.perKey.KeyA);
  resetTriggerKeys(p,['KeyW']);assert.equal(p.trigger.perKey.KeyW,undefined);assert.deepEqual(p.trigger.perKey.KeyA,other);assert.equal(p.lighting.color,'#00ff00');assert.equal(triggerFor(p,'KeyW').actuation,1.5);
});
test('new switch, separate RT, deadzone and precision metadata roundtrip in version-1 JSON',()=>{
  const p=createProfile();applyTriggerPatch(p,['KeyW'],{switchType:'kailh-god',rapid:true,continuous:true,berserk:true,actuation:.125,press:.075,release:.095,deadzoneEnabled:true,topDeadzone:.05,bottomDeadzone:.1});
  const next=importProfile(exportProfile(p));assert.deepEqual(next.trigger,p.trigger);
  const bad=copy(p);bad.trigger.perKey.KeyW.separate=false;assert.throws(()=>normalizeProfile(bad));
});

test('reference actuation labels use two decimals without hiding .005-mm precision',()=>{
  for(const [value,expected]of [[1.5,'1.50'],[.04,'0.04'],[.125,'0.125'],[3.36,'3.36']]){
    const preview=triggerKeyPreview('KeyW',{...TRIGGER_DEFAULTS,actuation:value});
    assert.equal(preview.top,expected);assert.equal(preview.bottom,'');assert.equal(preview.enabled,true);
  }
});
test('RT and deadzone previews keep independent three-decimal badges and explicit off states',()=>{
  const trigger={...TRIGGER_DEFAULTS,rapid:true,press:.125,release:.5,deadzoneEnabled:true,topDeadzone:.05,bottomDeadzone:.1};
  const rt=triggerKeyPreview('KeyW',trigger,'rt');assert.equal(rt.top,'0.125');assert.equal(rt.bottom,'0.500');
  const zones=triggerKeyPreview('KeyW',trigger,'deadzone');assert.equal(zones.top,'0.050');assert.equal(zones.bottom,'0.100');
  for(const mode of ['rt','deadzone']){
    const off=triggerKeyPreview('KeyW',TRIGGER_DEFAULTS,mode);assert.equal(off.top,'—');assert.equal(off.bottom,'—');assert.equal(off.enabled,false);
  }
});
test('reference legends remain physical labels and protected Fn never displays fabricated values',()=>{
  assert.equal(triggerKeyPreview('Digit1',TRIGGER_DEFAULTS).label,'1 !');
  assert.equal(triggerKeyPreview('Delete',TRIGGER_DEFAULTS).label,'Delete');
  assert.equal(triggerKeyPreview('Quote',TRIGGER_DEFAULTS).label,"' \"");
  for(const mode of ['actuation','rt','deadzone'])assert.deepEqual(triggerKeyPreview('Fn',null,mode),{label:'Fn',top:'',bottom:'',enabled:false});
});

const selectionRects=[
  {code:'KeyW',left:0,top:0,right:40,bottom:40},
  {code:'KeyE',left:45,top:0,right:85,bottom:40},
  {code:'KeyS',left:0,top:45,right:40,bottom:85},
  {code:'KeyD',left:45,top:45,right:85,bottom:85},
  {code:'Fn',left:90,top:45,right:130,bottom:85}
];
test('rectangle selection works in both drag directions and never selects protected Fn',()=>{
  const expected=['KeyW','KeyE','KeyS','KeyD'];
  assert.deepEqual(triggerBoxSelection(selectionRects,{x:10,y:10},{x:125,y:75}),expected);
  assert.deepEqual(triggerBoxSelection(selectionRects,{x:125,y:75},{x:10,y:10}),expected);
});
test('straight drags select a row or column without selecting keys in the gaps',()=>{
  assert.deepEqual(triggerBoxSelection(selectionRects,{x:10,y:20},{x:80,y:20}),['KeyW','KeyE']);
  assert.deepEqual(triggerBoxSelection(selectionRects,{x:20,y:10},{x:20,y:80}),['KeyW','KeyS']);
  assert.deepEqual(triggerBoxSelection(selectionRects,{x:41,y:41},{x:44,y:44}),[]);
});
test('additive rectangle selection keeps the existing set once and rejects invalid base codes',()=>{
  const base=['KeyW','KeyA','Fn','NotAKey','KeyA'];
  assert.deepEqual(triggerBoxSelection(selectionRects,{x:50,y:50},{x:60,y:60},base),['KeyW','KeyA','KeyD']);
  assert.deepEqual(base,['KeyW','KeyA','Fn','NotAKey','KeyA']);
});

function rememberPatch(history,profile,patch,group=null,codes=['KeyW']) {
  const before=copy(profile);applyTriggerPatch(profile,codes,patch);return history.record(before,profile,group);
}
const restoreInto=profile=>trigger=>{profile.trigger=trigger;};

test('one slider gesture occupies one undo entry and redo restores its final value',()=>{
  const p=createProfile(),history=createTriggerHistory(),before=copy(p.trigger),group=Symbol('drag');
  for(const actuation of [.1,.2,.3,.4])rememberPatch(history,p,{actuation},group);
  assert.equal(history.undoCount,1);assert.equal(history.redoCount,0);
  assert.equal(history.undo(p,restoreInto(p)),true);assert.deepEqual(p.trigger,before);assert.equal(history.redoCount,1);
  assert.equal(history.redo(p,restoreInto(p)),true);assert.equal(triggerFor(p,'KeyW').actuation,.4);assert.equal(history.undoCount,1);
});
test('ending a gesture separates later edits even if a caller reuses the same token',()=>{
  const p=createProfile(),history=createTriggerHistory();
  rememberPatch(history,p,{actuation:.1},'range');history.endGroup();
  rememberPatch(history,p,{actuation:.2},'range');assert.equal(history.undoCount,2);
  history.undo(p,restoreInto(p));assert.equal(triggerFor(p,'KeyW').actuation,.1);
});
test('unchanged edits and a gesture returning to its start retain the redo branch',()=>{
  const p=createProfile();applyTriggerPatch(p,['KeyW'],{actuation:.5});
  const history=createTriggerHistory();rememberPatch(history,p,{actuation:.6});history.undo(p,restoreInto(p));
  assert.equal(rememberPatch(history,p,{actuation:.5}),false);assert.equal(history.canRedo,true);
  rememberPatch(history,p,{actuation:.7},'back-and-forth');rememberPatch(history,p,{actuation:.8},'back-and-forth');rememberPatch(history,p,{actuation:.5},'back-and-forth');
  assert.equal(history.undoCount,0);assert.equal(history.redoCount,1);
  history.redo(p,restoreInto(p));assert.equal(triggerFor(p,'KeyW').actuation,.6);
});
test('a new edit clears redo while Trigger undo preserves unrelated profile settings',()=>{
  const p=createProfile(),history=createTriggerHistory();rememberPatch(history,p,{actuation:.1});history.undo(p,restoreInto(p));
  rememberPatch(history,p,{actuation:.2});assert.equal(history.canRedo,false);
  p.lighting.color='#ff0000';p.bindings.win.KeyA={kind:'key',code:'KeyB'};p.performance.winLock=true;
  assert.equal(history.synchronize(p),false);history.undo(p,restoreInto(p));
  assert.equal(p.lighting.color,'#ff0000');assert.equal(p.bindings.win.KeyA.code,'KeyB');assert.equal(p.performance.winLock,true);
});
test('profile switches and external Trigger replacement invalidate stale history',()=>{
  const p=createProfile(),q=createProfile(),history=createTriggerHistory();rememberPatch(history,p,{actuation:.1});
  assert.equal(history.synchronize(q),true);assert.equal(history.canUndo,false);
  assert.equal(history.undo(q,()=>{throw new Error('unexpected restore');}),false);
  rememberPatch(history,q,{actuation:.2});q.trigger=copy(p.trigger);assert.equal(history.synchronize(q),true);assert.equal(history.canUndo,false);
  assert.throws(()=>history.record(p,q),/cross profiles/);
});
test('history retains only the configured number of complete operations',()=>{
  const p=createProfile(),history=createTriggerHistory(2);
  for(const actuation of [.1,.2,.3])rememberPatch(history,p,{actuation});
  assert.equal(history.undoCount,2);history.undo(p,restoreInto(p));history.undo(p,restoreInto(p));
  assert.equal(triggerFor(p,'KeyW').actuation,.1);assert.equal(history.canUndo,false);assert.equal(history.redoCount,2);
  assert.throws(()=>createTriggerHistory(0),RangeError);
});
test('failed restore validation leaves undo and redo stacks intact',()=>{
  const p=createProfile(),history=createTriggerHistory();rememberPatch(history,p,{actuation:.1});
  assert.throws(()=>history.undo(p,()=>{throw new Error('validation failed');}),/validation failed/);
  assert.equal(history.undoCount,1);assert.equal(history.redoCount,0);assert.equal(triggerFor(p,'KeyW').actuation,.1);
  assert.equal(history.undo(p,restoreInto(p)),true);
});
