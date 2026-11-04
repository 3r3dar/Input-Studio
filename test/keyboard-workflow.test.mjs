import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {keyboardView} from '../lib/keyboard-codec.mjs';
import {profileFromSnapshot,compareSnapshot,draftPlanOperations,encodeHardwareBinding,decodeHardwareBinding} from '../public/keyboard-workflow.mjs';
import {OUTPUT_CODES,exportProfile,importProfile} from '../public/keyboard-model.mjs';

const fixture=JSON.parse(await fs.readFile(new URL('./fixtures/jet75-ii-fw116.json',import.meta.url),'utf8'));
const bytes=hex=>Uint8Array.from(Buffer.from(hex,'hex'));
function state(extra={}){
  const defaults=bytes(fixture.defaults),keys=Uint8Array.from(defaults),triggers=new Uint8Array(1024);
  for(let id=0;id<128;id++)triggers.set(bytes(fixture.commonTrigger),id*8);
  for(const [id,hex]of Object.entries(fixture.triggerSamples))triggers.set(bytes(hex),Number(id)*8);
  for(const [id,record]of Object.entries({...fixture.remaps,...extra}))keys.set(record,Number(id)*3);
  return {info:Uint8Array.from([22,1]),base:[0,4,0,1,2,3],profile:0,defaults,keys,triggers,
    function:bytes(fixture.function),revision:'offline-workflow',backup:'offline-fixture.json'};
}
const view=extra=>keyboardView(state(extra));

test('snapshot profile imports verified trigger values and only non-default bindings',()=>{
  const result=profileFromSnapshot(view());
  assert.equal(result.triggerCount,79);
  assert.equal(result.bindingCount,78);
  assert.equal(result.bindingOverrides,0);
  assert.equal(Object.hasOwn(result.profile.bindings.win,'KeyW'),false);
  assert.equal(Object.hasOwn(result.profile.bindings.win,'PageUp'),false);
  assert.equal(result.skipped.filter(item=>item.section==='Key Config').length,1);
  assert.equal(result.profile.trigger.perKey.KeyW.actuation,1.2);
  assert.equal(result.profile.trigger.perKey.KeyW.rapid,true);
  assert.equal(result.profile.trigger.perKey.KeyW.press,.15);
  assert.equal(result.profile.trigger.perKey.KeyW.release,.1);
  assert.equal(result.profile.bindings.win.Fn,undefined);
});

test('a snapshot remap becomes one explicit local binding without touching other keys',()=>{
  const result=profileFromSnapshot(view({'71':[16,0,4]}));
  assert.equal(result.bindingOverrides,1);
  assert.deepEqual(result.profile.bindings.win.KeyW,{kind:'key',code:'KeyA'});
  assert.equal(Object.hasOwn(result.profile.bindings.win,'KeyQ'),false);
});

test('comparison reports changed trigger fields, bindings and unknown device actions',()=>{
  const result=profileFromSnapshot(view()),profile=result.profile;
  const unchanged=compareSnapshot(profile,view(),[]);
  assert.equal(unchanged.length,79);
  assert.equal(unchanged.filter(row=>row.fields.length).length,0);
  assert.deepEqual(unchanged.find(row=>row.code==='PageUp').unknown,['device-binding']);
  profile.trigger.perKey.KeyW={...profile.trigger.perKey.KeyW,actuation:1.9};
  const trigger=compareSnapshot(profile,view(),['KeyW'])[0];
  assert.deepEqual(trigger.fields,['actuation']);
  assert.equal(trigger.actual.actuation,1.2);
  assert.equal(trigger.draft.actuation,1.9);
  profile.bindings.win.KeyA={kind:'key',code:'KeyB'};
  const binding=compareSnapshot(profile,view(),['KeyA'])[0];
  assert.deepEqual(binding.fields,['binding']);
});

test('draft plan is section-selectable and blocks unknown device bindings without guessing',()=>{
  const profile=profileFromSnapshot(view()).profile;
  const trigger=draftPlanOperations(profile,view(),['KeyW'],{triggers:true,keymap:false});
  assert.equal(trigger.issues.length,0);
  assert.equal(trigger.operations.length,1);
  assert.equal(trigger.operations[0].action,'trigger');
  assert.deepEqual(trigger.operations[0].value.keyIds,[71]);
  const both=draftPlanOperations(profile,view(),['KeyW'],{triggers:false,keymap:true});
  assert.equal(both.operations.length,1);
  assert.equal(both.operations[0].action,'keymap');
  const special=draftPlanOperations(profile,view(),['PageUp'],{triggers:true,keymap:true});
  assert.equal(special.issues.length,1);
  assert.equal(special.issues[0].section,'Key Config');
  assert.equal(special.operations.length,1);
  assert.throws(()=>draftPlanOperations(profile,view(),['Fn'],{triggers:true,keymap:true}),/Вибери/);
  assert.throws(()=>draftPlanOperations(profile,view(),['KeyW'],{triggers:false,keymap:false}),/хоча б один/);
});

test('snapshot comparison and keymap preview reject unrecorded layers rather than silently using Win',()=>{
  const data=view(),profile=profileFromSnapshot(data).profile;
  profile.bindings.mac.KeyW={kind:'key',code:'KeyB'};
  for(const layer of ['mac','macFn','winFn']){
    assert.throws(()=>compareSnapshot(profile,data,['KeyW'],layer),/Win Default/);
    assert.throws(()=>draftPlanOperations(profile,data,['KeyW'],{triggers:false,keymap:true,layer}),/Win Default/);
    // Trigger is shared across draft layers, and does not write a keymap bank.
    const result=draftPlanOperations(profile,data,['KeyW'],{triggers:true,keymap:false,layer});
    assert.deepEqual(result.operations.map(operation=>operation.action),['trigger']);
  }
});

test('all supported output keys and left-modifier shortcuts roundtrip without changing mask bits',()=>{
  for(const code of OUTPUT_CODES){
    const value={kind:'key',code};
    assert.deepEqual(decodeHardwareBinding(encodeHardwareBinding(value)),value,code);
  }
  for(let mask=0;mask<16;mask++){
    const value={kind:'shortcut',code:'KeyW',modifiers:['Control','Shift','Alt','Meta'].filter((_,i)=>mask&(1<<i))};
    const bytes=encodeHardwareBinding(value);
    assert.equal(bytes[1],mask);
    assert.deepEqual(encodeHardwareBinding(decodeHardwareBinding(bytes)),bytes);
  }
  assert.equal(decodeHardwareBinding([16,128,4]),null); // right-modifier chord cannot be guessed as a left chord
  assert.equal(decodeHardwareBinding([240,250,0]),null);
});

test('a snapshot-derived draft exports and imports without losing values or altering the source',()=>{
  const data=view({'71':[16,3,6]}),before=JSON.stringify(data);
  const original=profileFromSnapshot(data).profile,originalBefore=JSON.stringify(original);
  const text=exportProfile(original),imported=importProfile(text);
  assert.notEqual(imported.id,original.id);
  assert.deepEqual({...imported,id:original.id},original);
  assert.equal(JSON.stringify(original),originalBefore);
  assert.equal(JSON.stringify(data),before);
  assert.deepEqual(imported.bindings.win.KeyW,{kind:'shortcut',code:'KeyC',modifiers:['Control','Shift']});
});
