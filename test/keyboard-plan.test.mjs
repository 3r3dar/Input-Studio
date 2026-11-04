import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {keyboardBank} from '../lib/keyboard-codec.mjs';
import {planKeyboardEdit,planKeyboardBatch} from '../lib/keyboard-plan.mjs';

const fixture=JSON.parse(await fs.readFile(new URL('./fixtures/jet75-ii-fw116.json',import.meta.url),'utf8'));
const bytes=hex=>Uint8Array.from(Buffer.from(hex,'hex'));
function snapshot(profile=0){
  const defaults=bytes(fixture.defaults),keys=Uint8Array.from(defaults),triggers=new Uint8Array(1024);
  for(let id=0;id<128;id++)triggers.set(bytes(fixture.commonTrigger),id*8);
  for(const [id,hex]of Object.entries(fixture.triggerSamples))triggers.set(bytes(hex),Number(id)*8);
  for(const [id,record]of Object.entries(fixture.remaps))keys.set(record,Number(id)*3);
  return {info:[22,1],base:[profile,4,0,1,2,3],profile,defaults,keys,triggers,function:bytes(fixture.function),revision:'offline-plan'};
}
const plan=(s,action,input)=>planKeyboardEdit(s,action,input,s.revision);

test('official bank addresses cover four profiles and four key layers without overlap',()=>{
  for(let profile=0;profile<4;profile++){
    assert.equal(keyboardBank('function',profile).offset,64*profile);
    assert.equal(keyboardBank('triggers',profile).offset,1024*profile);
    assert.equal(keyboardBank('colors',profile).offset,512*profile);
    for(let layer=0;layer<4;layer++)for(const name of ['defaults','keys']){
      const b=keyboardBank(name,profile,layer);assert.equal(b.offset,2048*profile+512*layer);
      assert.equal(b.length,384);assert.ok(b.offset+b.length<=2048*profile+512*(layer+1));
    }
  }
  assert.equal(keyboardBank('keys',0).read,8);assert.equal(keyboardBank('keys',0).write,9);
  assert.equal(keyboardBank('triggers',0).read,160);assert.equal(keyboardBank('triggers',0).write,161);
  assert.equal(keyboardBank('function',0).read,5);assert.equal(keyboardBank('function',0).write,6);
});

test('invalid bank names, profiles and nonexistent layers are rejected',()=>{
  for(const args of [['constructor',0],['firmware',0],['keys',-1],['keys',4],['keys','1'],['keys',0,4],['triggers',0,1],['function',0,1]])assert.throws(()=>keyboardBank(...args));
  const b=keyboardBank('keys',0);b.offset=123;b.stride=0;assert.equal(keyboardBank('keys',1).offset,2048);
});

test('Trigger plan names the correct physical record and exact changed bytes without modifying the snapshot',()=>{
  const s=snapshot(),before=JSON.stringify(s),input={keyIds:[71],actuation:1.23},inputBefore=JSON.stringify(input),p=plan(s,'trigger',input);
  assert.equal(p.bank,'triggers');assert.equal(p.changedBytes,1);assert.equal(p.records.length,1);
  assert.deepEqual(p.records[0],{offset:568,keyCode:'KeyW',before:[160,1,119,0,14,0,9,0],after:[160,1,122,0,14,0,9,0]});
  assert.equal(JSON.stringify(s),before);assert.equal(JSON.stringify(input),inputBefore);
  assert.equal(p.writeAllowed,false);assert.equal(p.transportReady,false);assert.notEqual(p.baselineSha256,p.targetSha256);
  assert.equal(p.profile,1);assert.equal(p.revision,'offline-plan');assert.equal(p.writeCommand,161);
  assert.ok(!Object.hasOwn(p,'packets'));assert.ok(!Object.hasOwn(p,'identity'));
});

test('record addresses include the selected profile rather than silently targeting profile zero',()=>{
  for(let profile=0;profile<4;profile++){
    const s=snapshot(profile);
    assert.equal(plan(s,'trigger',{keyIds:[71],actuation:1.23}).records[0].offset,1024*profile+568);
    assert.equal(plan(s,'keymap',{keyId:71,code:4,modifiers:0}).records[0].offset,2048*profile+213);
    assert.equal(plan(s,'function',{brightness:50}).records[0].offset,64*profile+8);
  }
});

test('group plans include each changed key once and retain full original records',()=>{
  const s=snapshot(),p=plan(s,'trigger',{keyIds:[71,66,75,71],actuation:1.23});
  assert.equal(p.records.length,3);assert.deepEqual(p.records.map(record=>record.keyCode),['ShiftLeft','KeyW','F2']);
  assert.ok(p.records.every(record=>record.before.length===8&&record.after.length===8));
  for(const record of p.records)for(const i of [0,1,3,4,5,6,7])assert.equal(record.after[i],record.before[i]);
});

test('unchanged settings produce an empty plan, not synthetic writes',()=>{
  const p=plan(snapshot(),'trigger',{keyIds:[71],actuation:1.2,rapidTrigger:true,press:.15,release:.1});
  assert.equal(p.changedBytes,0);assert.deepEqual(p.records,[]);assert.equal(p.baselineSha256,p.targetSha256);
});

test('Function plans preserve polling, calibration, side lighting and all unrelated bytes',()=>{
  const s=snapshot(),p=plan(s,'function',{brightness:50,lockWin:true}),after=Uint8Array.from(s.function);
  for(const r of p.records)after.set(r.after,r.offset-p.offset);
  for(let i=0;i<64;i++)assert.equal(after[i],i===6?s.function[6]|1:i===9?50:s.function[i]);
  assert.equal(p.changedBytes,2);assert.equal(p.recordSize,8);
});

test('keymap plans alter exactly one known action and refuse unknown special assignments',()=>{
  const s=snapshot(),p=plan(s,'keymap',{keyId:71,code:4,modifiers:2});
  assert.deepEqual(p.records,[{offset:213,keyCode:'KeyW',before:[16,0,26],after:[16,2,4]}]);
  assert.throws(()=>plan(s,'keymap',{keyId:14,code:4,modifiers:0}),/Спеціальне/);
  assert.deepEqual(Array.from(s.keys.slice(42,45)),[240,250,0]);
});

test('protected Fn, inactive keys and unsupported precision are rejected before producing any plan',()=>{
  const s=snapshot(),before=JSON.stringify(s);
  for(const input of [{keyIds:[37],actuation:1.23},{keyIds:[80],actuation:1.23},{keyIds:[71],actuation:.875},{keyIds:[71],polling:8000}])assert.throws(()=>plan(s,'trigger',input));
  assert.throws(()=>plan(s,'keymap',{keyId:37,code:4,modifiers:0}));assert.equal(JSON.stringify(s),before);
});

test('stale revisions, foreign firmware, mismatched profiles and malformed banks block planning',()=>{
  assert.throws(()=>planKeyboardEdit(null,'trigger',{},'old'),/знімок/);
  const s=snapshot();assert.throws(()=>planKeyboardEdit(s,'trigger',{},'other'),/знімок/);
  for(const change of [s=>{s.info=[23,1];},s=>{s.defaults[0]^=1;},s=>{s.base[0]=1;},s=>{s.triggers=s.triggers.slice(0,500);},s=>{s.triggers=Array.from(s.triggers);s.triggers[0]=300;}]){
    const altered=snapshot();change(altered);assert.throws(()=>plan(altered,'trigger',{keyIds:[71],actuation:1.23}));
  }
  for(const action of ['constructor','firmware','reset','polling'])assert.throws(()=>plan(s,action,{}));
});

test('preview calculation and API route do not call device readers, writers or authorization',async()=>{
  const source=await fs.readFile(new URL('../lib/keyboard-plan.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/from ['"](?:node-hid|\.\/devices)|\b(?:withKeyboard|readKeyboard|writeKeyboard|sendReport|sendFeatureReport)\s*\(/);
  const server=await fs.readFile(new URL('../server.mjs',import.meta.url),'utf8');
  const route=server.match(/if\(req.url==='\/api\/preview'\)\{[\s\S]*?\n    }/)[0];
  assert.match(route,/previewKeyboard\(input.action,input.value,input.revision\)/);
  assert.doesNotMatch(route,/unlocked|writeKeyboard|readKeyboard|conflicts/);
});

test('batch plan composes operations per bank, sorts records and never mutates the snapshot',()=>{
  const s=snapshot(),before=JSON.stringify(s);
  const plan=planKeyboardBatch(s,[
    {action:'trigger',value:{keyIds:[71],actuation:1.23}},
    {action:'trigger',value:{keyIds:[31],actuation:2.01}}
  ],s.revision);
  assert.equal(plan.kind,'keyboard-batch-preview');
  assert.equal(plan.operations,2);
  assert.equal(plan.banks.length,1);
  assert.equal(plan.banks[0].bank,'triggers');
  assert.equal(plan.changedBytes,2);
  assert.equal(plan.records.length,2);
  assert.deepEqual(plan.records.map(record=>record.bank),['triggers','triggers']);
  assert.deepEqual(plan.records.map(record=>record.offset),[...plan.records.map(record=>record.offset)].sort((a,b)=>a-b));
  assert.equal(plan.writeAllowed,false);
  assert.equal(plan.transportReady,false);
  assert.equal(JSON.stringify(s),before);
});

test('batch plan separates trigger and keymap banks while preventing duplicate physical targets',()=>{
  const s=snapshot();
  const mixed=planKeyboardBatch(s,[
    {action:'trigger',value:{keyIds:[71],actuation:1.23}},
    {action:'keymap',value:{keyId:71,code:4,modifiers:0}}
  ],s.revision);
  assert.equal(mixed.banks.length,2);
  assert.deepEqual(mixed.banks.map(bank=>bank.bank).sort(),['keys','triggers']);
  assert.throws(()=>planKeyboardBatch(s,[
    {action:'trigger',value:{keyIds:[71],actuation:1.23}},
    {action:'trigger',value:{keyIds:[71],actuation:1.23}}
  ],s.revision),/Повторена/);
  assert.throws(()=>planKeyboardBatch(s,[
    {action:'trigger',value:{keyIds:[71],actuation:1.23}}
  ],'stale'),/зчитай/);
  assert.throws(()=>planKeyboardBatch(s,Array.from({length:161},()=>({action:'trigger',value:{keyIds:[71],actuation:1.23}})),s.revision),/1–160/);
  assert.throws(()=>planKeyboardBatch(s,[{action:'trigger',value:{keyIds:[71],actuation:1.23},extra:true}],s.revision),/Невірна/);
});
