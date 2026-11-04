import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {JET75_KEYS,KEY_IDS,FN_ID,layoutMismatch} from '../lib/jet75-layout.mjs';
import {keyboardView,keyboardWriteError,keyMapping} from '../lib/keyboard-codec.mjs';
import {KEYBOARD} from '../public/keyboard-model.mjs';

const fixture=JSON.parse(await fs.readFile(new URL('./fixtures/jet75-ii-fw116.json',import.meta.url),'utf8'));
const bytes=hex=>Uint8Array.from(Buffer.from(hex,'hex'));
function snapshot(){
  const defaults=bytes(fixture.defaults),keys=Uint8Array.from(defaults),triggers=new Uint8Array(1024);
  for(let id=0;id<128;id++)triggers.set(bytes(fixture.commonTrigger),id*8);
  for(const [id,hex]of Object.entries(fixture.triggerSamples))triggers.set(bytes(hex),Number(id)*8);
  for(const [id,record]of Object.entries(fixture.remaps))keys.set(record,Number(id)*3);
  return {info:Uint8Array.from([22,1]),profile:0,defaults,keys,triggers,function:bytes(fixture.function),revision:'offline',backup:'offline-fixture.json'};
}

test('all 80 actual factory records match the official physical usage set and editor positions',()=>{
  const s=snapshot();assert.equal(s.defaults.length,384);
  assert.equal(crypto.createHash('sha256').update(s.defaults).digest('hex'),'d2920e64c2684e712ecae53c31af6717ac183c7b98908d14d0bb3930958440d7');
  assert.equal(layoutMismatch(s.defaults),null);assert.equal(JET75_KEYS.length,80);
  assert.deepEqual([...KEY_IDS],Array.from({length:80},(_,i)=>i));
  assert.equal(new Set(JET75_KEYS.map(key=>key.code)).size,80);
  for(const [index,key]of KEYBOARD.entries()){
    const actual=JET75_KEYS.find(item=>item.code===key.code);
    assert.ok(actual,key.code);assert.equal(actual.usage,fixture.officialLayoutUsages[index],key.code);
  }
});

test('the complete factory guard rejects a mismatch in any active or inactive record',()=>{
  for(let id=0;id<128;id++){
    const s=snapshot();s.defaults[id*3]^=1;
    assert.match(layoutMismatch(s.defaults),/заблокований/,String(id));
  }
  assert.ok(layoutMismatch(new Uint8Array(383)));assert.ok(layoutMismatch(null));
});

test('matching the factory map never authorizes writes or experimental capabilities',()=>{
  const s=snapshot(),view=keyboardView(s);
  assert.equal(view.layoutMatched,true);assert.equal(view.writeAllowed,false);
  assert.ok(Object.values(view.capabilities).every(value=>value===false));
  assert.match(keyboardWriteError(s),/лише читання/);
  assert.match(keyboardWriteError(null),/Спочатку зчитай/);
  s.layoutError=null;s.writeAllowed=true;s.defaults[0]^=1;
  assert.match(keyboardWriteError(s),/заблокований/);
});

test('read-only decoding restores Fn, right bracket, left Shift and F2 without phantom keys',()=>{
  const view=keyboardView(snapshot()),byCode=Object.fromEntries(view.keys.map(key=>[key.code,key]));
  assert.equal(view.keys.length,80);assert.equal(FN_ID,37);
  assert.equal(byCode.Fn.id,37);assert.equal(byCode.Fn.protected,true);assert.equal(byCode.Fn.mappingLabel,'Fn');
  assert.equal(byCode.BracketRight.id,64);assert.equal(byCode.BracketRight.name,']');assert.equal(byCode.BracketRight.protected,false);
  assert.equal(byCode.ShiftLeft.id,66);assert.equal(byCode.F2.id,75);
  assert.ok(view.keys.every(key=>key.id<80));assert.equal(view.firmware,'1.16');
});

test('representative recorded actuation and RT settings belong to the correct logical key',()=>{
  const byCode=Object.fromEntries(keyboardView(snapshot()).keys.map(key=>[key.code,key]));
  const w=byCode.KeyW;
  assert.equal(w.id,71);assert.equal(w.actuation,1.2);assert.equal(w.rapidTrigger,true);assert.equal(w.press,.15);assert.equal(w.release,.1);
  assert.equal(byCode.KeyQ.actuation,2);
  for(const code of ['ShiftLeft','F2']){
    assert.equal(byCode[code].actuation,1.8);assert.equal(byCode[code].rapidTrigger,false);
    assert.equal(byCode[code].press,.3);assert.equal(byCode[code].release,.3);
  }
});

test('unknown PgUp action is preserved exactly and is not guessed to be a normal key',()=>{
  const s=snapshot(),before=JSON.stringify(s),key=keyboardView(s).keys.find(key=>key.code==='PageUp');
  assert.equal(key.id,14);assert.deepEqual(key.mapping,[240,250,0]);assert.equal(key.mappingKnown,false);
  assert.equal(key.mappingLabel,'Спеціальне [F0 FA 00]');assert.equal(JSON.stringify(s),before);
  key.mapping[0]=0;assert.equal(s.keys[42],240);
  assert.deepEqual(keyMapping([16,2,0]),{known:true,label:'L Shift'});
  assert.deepEqual(keyMapping([16,3,6]),{known:true,label:'L Ctrl + L Shift + C'});
});

test('unknown layouts do not attach physical labels to guessed record indices',()=>{
  const s=snapshot();s.defaults[50*3+2]=20;
  const view=keyboardView(s);assert.equal(view.layoutMatched,false);assert.deepEqual(view.keys,[]);
  assert.equal(view.writeAllowed,false);assert.match(view.warning,/50/);
});

test('unknown trigger modes, switches and precision remain unknown rather than becoming zero',()=>{
  for(const patch of [[0,0],[1,2]]){
    const s=snapshot();s.triggers[71*8+patch[0]]=patch[1];
    const key=keyboardView(s).keys.find(key=>key.code==='KeyW');
    for(const field of ['actuation','rapidTrigger','press','release'])assert.equal(key[field],null,field);
  }
  const s=snapshot();s.triggers[71*8+3]=30;
  const key=keyboardView(s).keys.find(key=>key.code==='KeyW');
  assert.equal(key.actuation,1.2);assert.equal(key.press,null);assert.equal(key.release,null);
});

test('incomplete editable banks cannot masquerade as a complete read-only snapshot',()=>{
  for(const bank of ['function','keys','triggers']){
    const s=snapshot();s[bank]=s[bank].slice(0,-1);assert.throws(()=>keyboardView(s),/Incomplete/);
  }
});

test('device authorization still enforces the independent write guard before opening a write session',async()=>{
  const devices=await fs.readFile(new URL('../lib/devices.mjs',import.meta.url),'utf8');
  assert.match(devices,/const error=keyboardWriteError\(keyboardState\);\s*if\(error\)throw new Error\(error\)/);
  assert.match(devices,/writeKeyboard\(action,input,revision\) \{\s*assertKeyboardWritable\(\)/);
  assert.match(devices,/readKeyboard\(\) \{\s*const other=await conflicts\('keyboard'\)/);
});
