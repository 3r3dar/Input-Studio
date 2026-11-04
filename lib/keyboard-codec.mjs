// Independent implementation of the documented MCHOSE first-generation memory protocol.
import {JET75_KEYS,KEY_IDS,FN_ID,layoutMismatch} from './jet75-layout.mjs';
export {KEY_IDS,layoutMismatch};
export const VID = 0x41e4, PID = 0x211a;
export const READS = new Set([3, 4, 5, 7, 8, 10, 160]);
export const WRITES = new Set([6, 9, 11, 161]);
export const EFFECTS = [0, 6, 7, 8, 9, 4, 1, 5, 3, 2, 11, 12, 10, 18, 19, 20, 21, 22, 14, 13, 15, 16, 17];
// Official GLW channel: 4 key layers per profile, 512 bytes per layer.
// Record sizes describe data boundaries, NOT physically validated write-packet sizes.
const BANKS = {
  function:{read:5,write:6,stride:64,length:64,record:8},
  defaults:{read:7,write:null,stride:2048,layerStride:512,length:384,record:3},
  keys:{read:8,write:9,stride:2048,layerStride:512,length:384,record:3},
  triggers:{read:160,write:161,stride:1024,length:1024,record:8},
  colors:{read:10,write:null,stride:512,length:384,record:3}
};
export function keyboardBank(name,profile,layer=0) {
  if(!Object.hasOwn(BANKS,name))throw new Error('Unsupported keyboard bank');
  integer(profile,0,3,'profile');integer(layer,0,3,'layer');
  const bank=BANKS[name];
  if(layer&&!bank.layerStride)throw new Error('This bank has no key layers');
  return {...bank,offset:profile*bank.stride+layer*(bank.layerStride||0)};
}
export function keyboardWriteError(state) {
  if(!state)return 'Спочатку зчитай клавіатуру.';
  return layoutMismatch(state.defaults)||'Запис Jet75-II заблокований: адреси банків звірено з офіційним кодом, але апаратний запис ще не перевірений. Доступне лише читання та попередній план.';
}
export function integer(value, lo, hi, name) {
  if (!Number.isInteger(value) || value < lo || value > hi) throw new Error(`Invalid ${name}: ${lo}..${hi}`);
  return value;
}
export function packet(cmd, offset, sizeOrBytes) {
  integer(cmd, 0, 255, 'command'); integer(offset, 0, 65535, 'offset');
  const reading = typeof sizeOrBytes === 'number';
  if (!(reading ? READS : WRITES).has(cmd)) throw new Error('Command is blocked');
  const bytes = reading ? [] : Array.from(sizeOrBytes);
  const length = reading ? integer(sizeOrBytes, 1, 56, 'read size') : integer(bytes.length, 1, 56, 'write size');
  bytes.forEach(b => integer(b, 0, 255, 'byte'));
  if (offset + length > 65536) throw new Error('Offset overflow');
  const result = new Uint8Array(64);
  result.set([0x55, cmd, 0, 0, length, offset & 255, offset >> 8, 0, ...bytes]);
  result[3] = result.slice(4).reduce((sum, b) => sum + b, 0) & 255;
  return result;
}
export function replyMatches(data, cmd, offset, length) {
  return data.length === 64 && data[0] === 0xaa && data[1] === cmd && data[4] <= length &&
    data[5] === (offset & 255) && data[6] === (offset >> 8);
}
export function activeProfile(base) {
  if (base.length < 6 || base.length > 56 || base[0] > 3 || base[1] < 1 || base[1] > 4) throw new Error('Unrecognized profile table');
  const order = Array.from(base.slice(2, 6));
  return [...order].sort().join(',') === '0,1,2,3' ? order[base[0]] : base[0];
}
export function trigger(bytes, id) {
  const o = integer(id, 0, 127, 'key') * 8;
  if (bytes.length !== 1024) throw new Error('Invalid trigger bank');
  const base = code => code === 0 ? 100 : code === 1 ? 200 : code === 2 ? 1000 : null;
  const pressBase = base((bytes[o + 3] >> 3) & 3), releaseBase = base((bytes[o + 3] >> 1) & 3);
  return { id, mode: bytes[o + 1] & 15, actuation: ((bytes[o + 2] | ((bytes[o + 3] & 1) << 8)) + 1) / 100,
    press: pressBase ? ((bytes[o + 4] | ((bytes[o + 5] & 1) << 8)) + 1) / pressBase : null,
    release: releaseBase ? ((bytes[o + 6] | ((bytes[o + 7] & 1) << 8)) + 1) / releaseBase : null,
    knownSwitch: (bytes[o] & 0xf0) === 0xa0 };
}
function only(object, fields) {
  if (!object || typeof object !== 'object' || Array.isArray(object) || Object.keys(object).some(k => !fields.includes(k))) throw new Error('Unexpected setting');
}
function bool(value) { if (typeof value !== 'boolean') throw new Error('Expected boolean'); return value; }
function mm(value, max = 3.36) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0.04 || value > max || Math.abs(value * 100 - Math.round(value * 100)) > 1e-6) throw new Error(`Expected 0.04..${max} mm in 0.01 mm steps`);
  return value;
}
export function editFunction(before, input) {
  if (before.length !== 64) throw new Error('Invalid function bank');
  only(input, ['effect', 'brightness', 'speed', 'color', 'lockWin']);
  const after = Uint8Array.from(before);
  if (input.effect !== undefined) { if (!EFFECTS.includes(input.effect)) throw new Error('Unsupported RGB effect'); after[8] = input.effect; }
  if (input.brightness !== undefined) after[9] = integer(input.brightness, 0, 100, 'brightness');
  if (input.speed !== undefined) after[10] = 4 - integer(input.speed, 0, 4, 'speed');
  if (input.color !== undefined) {
    if (!/^#[0-9a-f]{6}$/i.test(input.color)) throw new Error('Invalid RGB color');
    after.set([1, 3, 5].map(o => parseInt(input.color.slice(o, o + 2), 16)), 14);
  }
  if (input.lockWin !== undefined) after[6] = (after[6] & ~1) | Number(bool(input.lockWin));
  return after;
}
export function editTrigger(before, input) {
  only(input, ['keyIds', 'actuation', 'rapidTrigger', 'press', 'release']);
  if (!Array.isArray(input.keyIds) || input.keyIds.length < 1 || input.keyIds.length > KEY_IDS.size) throw new Error('Select keys');
  const ids = [...new Set(input.keyIds)];
  if (ids.some(id => !KEY_IDS.has(id) || id === FN_ID)) throw new Error('Unknown key / protected Fn key');
  const after = Uint8Array.from(before);
  for (const id of ids) {
    const old = trigger(before, id), o = id * 8;
    if (!old.knownSwitch || ![0, 1].includes(old.mode) || old.actuation < 0.01 || old.actuation > 3.4) throw new Error('Unknown trigger mode / travel units; write blocked');
    if (input.actuation !== undefined) {
      const raw = Math.round(mm(input.actuation) * 100) - 1;
      after[o + 2] = raw & 255; after[o + 3] = (after[o + 3] & ~1) | ((raw >> 8) & 1);
    }
    if (input.rapidTrigger !== undefined) {
      after[o + 1] = (after[o + 1] & 0xf0) | Number(bool(input.rapidTrigger));
      if (input.rapidTrigger) {
        for (const [name, index, shift] of [['press', 4, 3], ['release', 6, 1]]) {
          const code = (before[o + 3] >> shift) & 3;
          const base = [100, 200, 1000][code];
          if (!base) throw new Error('Unknown RT precision');
          const value = mm(input[name], Math.min(3.36, 512 / base));
          const raw = Math.round(value * base) - 1;
          if (raw < 1 || raw > 511) throw new Error('RT value cannot be represented');
          after[o + index] = raw & 255; after[o + index + 1] = (after[o + index + 1] & ~1) | ((raw >> 8) & 1);
        }
      }
    } else if (input.press !== undefined || input.release !== undefined) throw new Error('Explicit RT mode is required');
  }
  return after;
}
export function editKeymap(before, input) {
  only(input, ['keyId', 'code', 'modifiers']);
  if (before.length !== 384 || !KEY_IDS.has(input.keyId) || input.keyId === FN_ID) throw new Error('Unknown key / protected Fn key');
  integer(input.code, 0, 231, 'HID key code'); integer(input.modifiers, 0, 255, 'modifiers');
  if(input.code<4&&!(input.code===0&&input.modifiers>0))throw new Error('Expected a HID key or modifier');
  const after = Uint8Array.from(before); after.set([16, input.modifiers, input.code], input.keyId * 3); return after;
}
export function keyName(code) {
  if (code >= 4 && code <= 29) return String.fromCharCode(65 + code - 4);
  if (code >= 30 && code <= 38) return String(code - 29);
  if (code >= 58 && code <= 69) return `F${code - 57}`;
  return ({39:'0',40:'Enter',41:'Esc',42:'Backspace',43:'Tab',44:'Space',45:'-',46:'=',47:'[',48:']',49:'\\',51:';',52:"'",53:'`',54:',',55:'.',56:'/',57:'Caps',74:'Home',75:'PgUp',76:'Del',78:'PgDn',79:'→',80:'←',81:'↓',82:'↑',224:'L Ctrl',225:'L Shift',226:'L Alt',227:'Win',228:'R Ctrl',229:'R Shift',230:'R Alt',231:'R Win'})[code] || `HID ${code}`;
}
export function keyMapping(bytes) {
  if(bytes.length!==3)throw new Error('Invalid key record');
  const [type,modifiers,code]=bytes;
  if(type===240&&modifiers===255&&code===1)return {known:true,label:'Fn'};
  if(type===16&&((code>=4&&code<=231)||(code===0&&modifiers>0))){
    const parts=Array.from({length:8},(_,i)=>modifiers&(1<<i)?keyName(224+i):null).filter(Boolean);
    if(code)parts.push(keyName(code));
    return {known:true,label:parts.join(' + ')};
  }
  return {known:false,label:`Спеціальне [${Array.from(bytes,b=>b.toString(16).padStart(2,'0').toUpperCase()).join(' ')}]`};
}

// Pure snapshot decoding: no HID, filesystem, profile mutations or write permission.
export function keyboardView(state) {
  const layoutError=layoutMismatch(state.defaults),f=state.function;
  if(f?.length!==64||state.keys?.length!==384||state.triggers?.length!==1024||state.info?.length<2)throw new Error('Incomplete keyboard snapshot');
  const keys=layoutError?[]:JET75_KEYS.map(({code,usage,id})=>{
    const decoded=trigger(state.triggers,id),mapping=Array.from(state.keys.slice(id*3,id*3+3)),action=keyMapping(mapping);
    const known=decoded.knownSwitch&&[0,1].includes(decoded.mode)&&decoded.actuation>=.01&&decoded.actuation<=3.4;
    return {...decoded,code,name:code==='Fn'?'Fn':keyName(usage),usage,protected:id===FN_ID,
      actuation:known?decoded.actuation:null,rapidTrigger:known?decoded.mode===1:null,
      press:known?decoded.press:null,release:known?decoded.release:null,
      mapping,mappingKnown:action.known,mappingLabel:action.label};
  });
  return {name:'MCHOSE Jet75-II',firmware:`${state.info[1].toString(16)}.${state.info[0].toString(16).padStart(2,'0')}`,profile:state.profile+1,revision:state.revision,
    lighting:{effect:f[8],brightness:f[9],speed:4-f[10],color:'#'+Array.from(f.slice(14,17),n=>n.toString(16).padStart(2,'0')).join('')},lockWin:!!(f[6]&1),pollingCode:f[4]&15,
    keys,layoutMatched:!layoutError,writeAllowed:false,warning:keyboardWriteError(state),
    capabilities:{lighting:false,triggers:false,keymap:false,polling:false,macros:false,dks:false,socd:false,firmware:false},backup:state.backup};
}
