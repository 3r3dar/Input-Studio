import {KEYBOARD,KEY_CODES,TRIGGER_DEFAULTS,TRIGGER_MIN,TRIGGER_MAX,createProfile,normalizeProfile,triggerFor,bindingFor,binding,labelFor} from './keyboard-model.mjs';

const usages={Escape:41,Enter:40,Backspace:42,Tab:43,Space:44,Minus:45,Equal:46,BracketLeft:47,BracketRight:48,Backslash:49,Semicolon:51,Quote:52,Backquote:53,Comma:54,Period:55,Slash:56,CapsLock:57,PrintScreen:70,ScrollLock:71,Pause:72,Insert:73,Home:74,PageUp:75,Delete:76,End:77,PageDown:78,ArrowRight:79,ArrowLeft:80,ArrowDown:81,ArrowUp:82,NumLock:83,NumpadDivide:84,NumpadMultiply:85,NumpadSubtract:86,NumpadAdd:87,NumpadEnter:88,Numpad0:98,NumpadDecimal:99,ControlLeft:224,ShiftLeft:225,AltLeft:226,MetaLeft:227,ControlRight:228,ShiftRight:229,AltRight:230,MetaRight:231};
for(let i=0;i<26;i++)usages['Key'+String.fromCharCode(65+i)]=4+i;
for(let i=1;i<=9;i++){usages['Digit'+i]=29+i;usages['Numpad'+i]=88+i;}
usages.Digit0=39;for(let i=1;i<=12;i++)usages['F'+i]=57+i;
const codes=Object.fromEntries(Object.entries(usages).map(([code,usage])=>[usage,code]));
const modifierNames=['Control','Shift','Alt','Meta'];

export function snapshotKeys(data){
  if(!data?.layoutMatched||!Array.isArray(data.keys)||data.keys.length!==KEYBOARD.length)throw new Error('Потрібен повний зіставлений знімок клавіатури.');
  const map=new Map(),ids=new Set();
  for(const key of data.keys){
    if(!KEY_CODES.has(key.code)||map.has(key.code)||!Number.isInteger(key.id)||key.id<0||key.id>=80||ids.has(key.id))throw new Error('Знімок має невірні або повторені клавіші.');
    map.set(key.code,key);ids.add(key.id);
  }
  return map;
}
export function encodeHardwareBinding(value){
  const v=binding(value),usage=usages[v.code];
  if(!usage||!['key','shortcut'].includes(v.kind))throw new Error('Це призначення ще не підтримується апаратним планом.');
  if(v.kind==='key')return usage>=224?[16,1<<(usage-224),0]:[16,0,usage];
  if(usage>=224)throw new Error('Комбінація з клавішею-модифікатором не підтримується.');
  return [16,v.modifiers.reduce((mask,name)=>mask|(1<<modifierNames.indexOf(name)),0),usage];
}
export function decodeHardwareBinding(raw){
  if(!Array.isArray(raw)||raw.length!==3||raw.some(b=>!Number.isInteger(b)||b<0||b>255)||raw[0]!==16)return null;
  const [,mask,usage]=raw;
  if(!usage&&mask&&(mask&(mask-1))===0)return {kind:'key',code:codes[224+Math.log2(mask)]};
  if(!codes[usage])return null;
  if(!mask)return {kind:'key',code:codes[usage]};
  if(mask&240||usage>=224)return null;
  return {kind:'shortcut',code:codes[usage],modifiers:modifierNames.filter((_,i)=>mask&(1<<i))};
}
function coreTrigger(key){
  const valid=value=>typeof value==='number'&&Number.isFinite(value)&&value>=TRIGGER_MIN&&value<=TRIGGER_MAX;
  if(typeof key.rapidTrigger!=='boolean'||!['actuation','press','release'].every(field=>valid(key[field])))return null;
  return {...TRIGGER_DEFAULTS,actuation:key.actuation,rapid:key.rapidTrigger,press:key.press,release:key.release};
}
export function profileFromSnapshot(data){
  const map=snapshotKeys(data),profile=createProfile(`Пристрій · профіль ${data.profile}`),skipped=[];
  let triggerCount=0,bindingCount=0,bindingOverrides=0;
  for(const {code}of KEYBOARD){
    if(code==='Fn')continue;
    const key=map.get(code),trigger=coreTrigger(key),action=decodeHardwareBinding(key.mapping);
    if(trigger){profile.trigger.perKey[code]=trigger;triggerCount++;}else skipped.push({code,section:'Trigger',reason:'Невідомі або непідтримувані відстані / режим.'});
    if(action){
      bindingCount++;
      // A device record equal to the editor default needs no explicit override.
      if(action.kind!=='key'||action.code!==code){profile.bindings.win[code]=action;bindingOverrides++;}
    }else skipped.push({code,section:'Key Config',reason:'Спеціальне призначення не перетворено.'});
  }
  return {profile:normalizeProfile(profile),triggerCount,bindingCount,bindingOverrides,skipped};
}
export function compareSnapshot(profile,data,selected=[],layer='win'){
  if(layer!=='win')throw new Error('Знімок містить лише Win Default. Інші шари не зчитані.');
  const map=snapshotKeys(data),wanted=new Set(selected),rows=[];
  for(const {code}of KEYBOARD){
    if(code==='Fn'||wanted.size&&!wanted.has(code))continue;
    const actual=map.get(code),draft=triggerFor(profile,code),fields=[],unknown=[];
    for(const [field,source]of [['actuation','actuation'],['rapid','rapidTrigger'],['press','press'],['release','release']]){
      if(actual[source]==null)unknown.push(field);else if(draft[field]!==actual[source])fields.push(field);
    }
    let encoded=null;try{encoded=encodeHardwareBinding(bindingFor(profile,'win',code));}catch{unknown.push('binding');}
    if(!decodeHardwareBinding(actual.mapping))unknown.push('device-binding');
    else if(encoded&&encoded.some((byte,i)=>byte!==actual.mapping[i]))fields.push('binding');
    rows.push({code,label:labelFor(code),id:actual.id,actual,draft,fields,unknown,changed:fields.length>0});
  }
  return rows;
}
export function draftPlanOperations(profile,data,selected,{triggers=true,keymap=false,layer='win'}={}){
  if(keymap&&layer!=='win')throw new Error('План призначень підтримує лише Win Default. Інші шари не зчитані.');
  const map=snapshotKeys(data),targets=[...new Set(selected)].filter(code=>KEY_CODES.has(code)&&code!=='Fn');
  if(!targets.length)throw new Error('Вибери клавіші: порожній вибір не означає всю клавіатуру.');
  if(!triggers&&!keymap)throw new Error('Вибери хоча б один розділ плану.');
  const operations=[],issues=[];
  for(const code of targets){
    const actual=map.get(code);
    if(triggers){
      const t=triggerFor(profile,code);
      if(actual.actuation==null||actual.rapidTrigger==null)issues.push({code,section:'Trigger',reason:'Режим пристрою невідомий.'});
      else operations.push({action:'trigger',value:{keyIds:[actual.id],actuation:t.actuation,rapidTrigger:t.rapid,...(t.rapid?{press:t.press,release:t.release}:{})}});
    }
    if(keymap){
      if(!decodeHardwareBinding(actual.mapping))issues.push({code,section:'Key Config',reason:'Спеціальне призначення пристрою захищене.'});
      else try{const [,modifiers,output]=encodeHardwareBinding(bindingFor(profile,'win',code));operations.push({action:'keymap',value:{keyId:actual.id,code:output,modifiers}});}catch(error){issues.push({code,section:'Key Config',reason:error.message});}
    }
  }
  return {operations,issues};
}
