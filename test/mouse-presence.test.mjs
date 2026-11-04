import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {mousePresence} from '../lib/mouse-presence.mjs';

const wired={vendorId:0x258a,productId:0x002e},receiver={vendorId:0x258a,productId:0x002f};
test('wired HATOR is detected without declaring receiver protocol support',()=>{
  const info=mousePresence([wired]);assert.equal(info.connected,true);assert.equal(info.mode,'wired');
  assert.equal(info.readSupported,false);assert.match(info.warning,/USB-кабель/);
});
test('receiver detection retains existing verified adapter availability',()=>{
  const info=mousePresence([receiver]);assert.equal(info.connected,true);assert.equal(info.mode,'receiver');
  assert.equal(info.readSupported,true);assert.equal(info.warning,null);
});
test('both USB identities are reported without guessing the active transport',()=>{
  const info=mousePresence([wired,receiver,wired]);assert.equal(info.connected,true);assert.equal(info.mode,'both');
  assert.equal(info.readSupported,false);
});
test('public builds detect a receiver without pretending its optional adapter is installed',()=>{
  const info=mousePresence([receiver],false);
  assert.equal(info.connected,true);assert.equal(info.mode,'receiver');assert.equal(info.readSupported,false);
  assert.match(info.warning,/не входить до публічної збірки/);
  assert.equal(mousePresence([wired],false).readSupported,false);
});
test('unrelated mice and devices cannot masquerade as a HATOR connection',()=>{
  for(const devices of [[],[{vendorId:0x258a,productId:1}],[{vendorId:1,productId:0x002e}]]){
    const info=mousePresence(devices);assert.equal(info.connected,false);assert.equal(info.mode,'disconnected');assert.equal(info.readSupported,false);
  }
});
test('wired support does not broaden feature-report targets or reuse receiver writes',async()=>{
  const source=await fs.readFile(new URL('../lib/devices.mjs',import.meta.url),'utf8');
  assert.match(source,/mouseSession\(allowWrites,task\) \{\s*assertMouseReadable\(\)/);
  assert.match(source,/a.vendorId!==0x258a \|\| a.productId!==0x2f/);
  assert.match(source,/productId===0x2f&&d.usagePage===0xff00/);
});
