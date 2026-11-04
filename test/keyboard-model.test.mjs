import test from 'node:test';
import assert from 'node:assert/strict';
import {KEYBOARD,KEY_CODES,labelFor,keycapLabel,keyboardNeighbor,createProfile,normalizeProfile,normalizeCollection,cloneProfile,exportProfile,importProfile,binding,bindingFor,bindingSelection,bindingSignature,applyBinding,resetBindingKeys,newRule,hsvToHex,hexToHsv} from '../public/keyboard-model.mjs';

test('Jet75 logical layout has unique keys within its physical drawing bounds',()=>{assert.equal(KEYBOARD.length,80);assert.equal(KEY_CODES.size,80);for(const k of KEYBOARD){assert.ok(k.x>=0&&k.x+k.w<=16);assert.ok(k.y>=0&&k.y+k.h<=6.25);}assert.ok(KEY_CODES.has('Fn'));});
test('physical key slots do not overlap and the outer rows span the complete grid',()=>{
  for(let i=0;i<KEYBOARD.length;i++)for(const b of KEYBOARD.slice(i+1)){
    const a=KEYBOARD[i];
    const overlapX=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x);
    const overlapY=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);
    assert.ok(overlapX<1e-8||overlapY<1e-8,`${a.code} overlaps ${b.code}`);
  }
  for(const y of [0,5.25]){
    const row=KEYBOARD.filter(key=>key.y===y);
    assert.equal(Math.min(...row.map(key=>key.x)),0);
    assert.equal(Math.max(...row.map(key=>key.x+key.w)),16);
  }
});
test('function-key groups and Delete have equal separator spacing',()=>{
  const byCode=Object.fromEntries(KEYBOARD.map(key=>[key.code,key]));
  for(const [left,right]of [['F4','F5'],['F8','F9'],['F12','Delete']]){
    assert.ok(Math.abs(byCode[right].x-byCode[left].x-byCode[left].w-1/3)<1e-8);
  }
});
test('all diagram modes share physical keycap legends without renaming output commands',()=>{
  assert.equal(keycapLabel('Digit1'),'1 !');assert.equal(keycapLabel('Delete'),'Delete');
  assert.equal(keycapLabel('KeyW'),'W');assert.equal(keycapLabel('Fn'),'Fn');
  assert.equal(labelFor('Digit1'),'1');assert.equal(labelFor('Delete'),'Del');
  for(const key of KEYBOARD)assert.ok(keycapLabel(key.code).length>0);
});
test('horizontal keyboard navigation respects physical rows, group gaps and protected Fn',()=>{
  assert.equal(keyboardNeighbor('KeyW','ArrowLeft'),'KeyQ');
  assert.equal(keyboardNeighbor('KeyW','ArrowRight'),'KeyE');
  assert.equal(keyboardNeighbor('F4','ArrowRight'),'F5');
  assert.equal(keyboardNeighbor('ControlRight','ArrowLeft'),'Space');
  assert.equal(keyboardNeighbor('Escape','ArrowLeft'),'Escape');
  assert.equal(keyboardNeighbor('ArrowRight','ArrowRight'),'ArrowRight');
});
test('vertical keyboard navigation follows adjacent rows and wide physical keys',()=>{
  assert.equal(keyboardNeighbor('KeyW','ArrowDown'),'KeyS');
  assert.equal(keyboardNeighbor('KeyB','ArrowDown'),'Space');
  assert.equal(keyboardNeighbor('Space','ArrowUp'),'KeyB');
  assert.equal(keyboardNeighbor('Escape','ArrowDown'),'Backquote');
  assert.equal(keyboardNeighbor('ArrowUp','ArrowDown'),'ArrowDown');
  assert.equal(keyboardNeighbor('Escape','ArrowUp'),'Escape');
});
test('Home and End navigate row edges or the whole board without changing layout',()=>{
  const before=JSON.stringify(KEYBOARD);
  assert.equal(keyboardNeighbor('KeyW','Home'),'Tab');assert.equal(keyboardNeighbor('KeyW','End'),'PageUp');
  assert.equal(keyboardNeighbor('KeyW','Home',{wholeBoard:true}),'Escape');
  assert.equal(keyboardNeighbor('KeyW','End',{wholeBoard:true}),'ArrowRight');
  assert.equal(JSON.stringify(KEYBOARD),before);
});
test('navigation always returns an editable physical key and safely handles unknown targets',()=>{
  for(const key of KEYBOARD)for(const direction of ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End']){
    const next=keyboardNeighbor(key.code,direction);assert.ok(KEY_CODES.has(next));assert.notEqual(next,'Fn');
  }
  assert.equal(keyboardNeighbor('Fn','ArrowDown'),'Escape');
  assert.equal(keyboardNeighbor('Unknown','ArrowRight'),'Escape');
  assert.equal(keyboardNeighbor('KeyW','Enter'),'KeyW');
});
test('binding selection distinguishes empty, default and mixed physical outputs',()=>{
  const p=createProfile(),empty=bindingSelection(p,'win',[]);
  assert.equal(empty.count,0);assert.equal(empty.common,null);assert.equal(empty.allDefault,false);
  const defaults=bindingSelection(p,'win',['KeyW','KeyA','Fn']);
  assert.equal(defaults.count,2);assert.equal(defaults.allDefault,true);assert.equal(defaults.mixed,true);assert.equal(defaults.common,null);
  applyBinding(p,'win',['KeyW'],{kind:'key',code:'KeyB'});
  const mixed=bindingSelection(p,'win',['KeyW','KeyA']);assert.equal(mixed.mixed,true);assert.equal(mixed.overriddenCount,1);assert.equal(mixed.common,null);
});
test('binding summaries compare effective actions and canonical modifier sets without changing stored order',()=>{
  const p=createProfile();applyBinding(p,'win',['KeyW'],{kind:'key',code:'KeyA'});
  const same=bindingSelection(p,'win',['KeyW','KeyA']);assert.equal(same.mixed,false);assert.deepEqual(same.common,{kind:'key',code:'KeyA'});
  p.bindings.win.KeyW={kind:'shortcut',code:'KeyC',modifiers:['Shift','Control']};
  p.bindings.win.KeyA={kind:'shortcut',code:'KeyC',modifiers:['Control','Shift']};
  assert.equal(bindingSelection(p,'win',['KeyW','KeyA']).mixed,false);
  assert.equal(bindingSignature(p.bindings.win.KeyW),bindingSignature(p.bindings.win.KeyA));
  assert.deepEqual(p.bindings.win.KeyW.modifiers,['Shift','Control']);
});
test('bulk assignment changes only target keys and layer and never aliases command objects',()=>{
  const p=createProfile(),before=JSON.parse(JSON.stringify(p));
  const command={kind:'shortcut',code:'KeyC',modifiers:['Control']};
  assert.equal(applyBinding(p,'winFn',['KeyW','KeyA','KeyW'],command),2);
  assert.notEqual(p.bindings.winFn.KeyW,p.bindings.winFn.KeyA);assert.notEqual(p.bindings.winFn.KeyW.modifiers,p.bindings.winFn.KeyA.modifiers);
  command.modifiers.push('Shift');assert.deepEqual(p.bindings.winFn.KeyW.modifiers,['Control']);
  assert.deepEqual(p.bindings.win,before.bindings.win);assert.deepEqual(p.bindings.mac,before.bindings.mac);assert.deepEqual(p.trigger,before.trigger);assert.deepEqual(p.lighting,before.lighting);
  assert.deepEqual(bindingFor(p,'winFn','KeyS'),{kind:'key',code:'KeyS'});
});
test('invalid binding groups, layers and commands fail before changing any key',()=>{
  const p=createProfile(),before=JSON.parse(JSON.stringify(p));
  for(const [layer,codes,command]of [['win',[],{kind:'key',code:'KeyA'}],['win',['KeyW','Fn'],{kind:'key',code:'KeyA'}],['win',['KeyW','Unknown'],{kind:'key',code:'KeyA'}],['other',['KeyW'],{kind:'key',code:'KeyA'}],['win',['KeyW'],{kind:'firmware',code:'reset'}],['win',['KeyW'],{kind:'shortcut',code:'KeyC',modifiers:['Unsafe']}]] )assert.throws(()=>applyBinding(p,layer,codes,command));
  assert.deepEqual(p,before);
});
test('selected binding reset preserves other keys, layers and features and rejects protected groups',()=>{
  const p=createProfile();applyBinding(p,'win',['KeyW','KeyA'],{kind:'media',action:'mute'});applyBinding(p,'mac',['KeyW'],{kind:'key',code:'KeyB'});
  const before=JSON.parse(JSON.stringify(p));assert.throws(()=>resetBindingKeys(p,'win',['KeyW','Fn']));assert.deepEqual(p,before);
  assert.equal(resetBindingKeys(p,'win',['KeyW','KeyS']),1);assert.equal(p.bindings.win.KeyW,undefined);assert.deepEqual(p.bindings.win.KeyA,before.bindings.win.KeyA);assert.deepEqual(p.bindings.mac,before.bindings.mac);assert.deepEqual(p.trigger,before.trigger);
});
test('equivalent repeated assignments are no-ops and retain existing modifier ordering',()=>{
  const p=createProfile();p.bindings.win.KeyW={kind:'shortcut',code:'KeyC',modifiers:['Shift','Control']};
  assert.equal(applyBinding(p,'win',['KeyW'],{kind:'shortcut',code:'KeyC',modifiers:['Control','Shift']}),0);
  assert.deepEqual(p.bindings.win.KeyW.modifiers,['Shift','Control']);
  const state=bindingSelection(p,'win',['KeyW']);state.common.modifiers.push('Alt');assert.deepEqual(p.bindings.win.KeyW.modifiers,['Shift','Control']);
});
test('draft profile export/import is a validated local roundtrip with a new identity',()=>{const p=createProfile('Мій профіль');p.lighting.perKey.KeyW='#ff00ff';p.bindings.win.KeyA={kind:'key',code:'KeyB'};p.trigger.perKey.KeyW={actuation:.1,rapid:true,press:.1,release:.2};const next=importProfile(exportProfile(p));assert.notEqual(next.id,p.id);assert.deepEqual({...next,id:p.id},normalizeProfile(p));});
test('clone and collection validation preserve identities without sharing nested state',()=>{const p=createProfile(),q=cloneProfile(p);q.lighting.color='#ffffff';assert.notEqual(p.lighting.color,q.lighting.color);assert.equal(normalizeCollection({version:1,active:q.id,profiles:[p,q]}).profiles.length,2);assert.throws(()=>normalizeCollection({version:1,active:p.id,profiles:[p,p]}));});
test('unsafe or foreign import formats, oversized files and arbitrary device commands are rejected',()=>{assert.throws(()=>importProfile('{"firmware":"erase"}'));assert.throws(()=>importProfile('x'.repeat(262145)));const p=createProfile();p.firmware='reset';assert.throws(()=>normalizeProfile(p));const q=createProfile();q.bindings.win.Fn={kind:'key',code:'KeyA'};assert.throws(()=>normalizeProfile(q));});
test('invalid local effects, units, keys, bindings and layers are rejected',()=>{for(const edit of [p=>p.lighting.effect='unknown',p=>p.trigger.actuation=99,p=>p.performance.pollingHz=9999,p=>p.bindings.win.KeyA={kind:'script',code:'alert(1)'},p=>p.lighting.perKey.__unknown__='#fff']){const p=createProfile();edit(p);assert.throws(()=>normalizeProfile(p));}assert.throws(()=>binding({kind:'key',code:'__proto__'}));});
test('all five advanced key draft types validate; physical Fn and invalid pairs are protected',()=>{const p=createProfile();for(const kind of ['RS','SOCD','DKS','MT','TGL'])p.advanced.push(newRule(kind,kind==='RS'||kind==='SOCD'?['KeyA','KeyD']:['KeyW']));assert.equal(normalizeProfile(p).advanced.length,5);assert.throws(()=>newRule('RS',['KeyA']));assert.throws(()=>newRule('SOCD',['KeyA','KeyA']));assert.throws(()=>newRule('MT',['Fn']));const q=createProfile();const r=newRule('DKS',['KeyA']);r.actions[2].at=.2;q.advanced.push(r);assert.throws(()=>normalizeProfile(q));});
test('color wheel conversions roundtrip representative RGB values',()=>{for(const color of ['#ff0000','#00ff00','#0000ff','#b6a3ed','#000000','#ffffff','#23a4cc']){const hsv=hexToHsv(color);assert.equal(hsvToHex(hsv.h,hsv.s,hsv.v),color);}});
