import crypto from 'node:crypto';
import {JET75_KEYS} from './jet75-layout.mjs';
import {keyboardBank,layoutMismatch,activeProfile,keyMapping,editFunction,editTrigger,editKeymap} from './keyboard-codec.mjs';

const EDITS={function:['function',editFunction],trigger:['triggers',editTrigger],keymap:['keys',editKeymap]};
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

// Snapshot-only calculation. No HID import, sendable packets or authorization change.
export function planKeyboardEdit(state,action,input,revision) {
  if(!state||!revision||state.revision!==revision)throw new Error('Спочатку зчитай клавіатуру: знімок відсутній або застарілий.');
  const mismatch=layoutMismatch(state.defaults);if(mismatch)throw new Error(mismatch);
  if(state.info?.[0]!==22||state.info?.[1]!==1)throw new Error('План підтримує лише перевірену прошивку 1.16.');
  if(activeProfile(state.base)!==state.profile)throw new Error('Профіль знімка не відповідає BASE. Зчитай пристрій знову.');
  if(!Object.hasOwn(EDITS,action))throw new Error('Непідтримувана операція плану.');
  const [name,edit]=EDITS[action],bank=keyboardBank(name,state.profile),source=state[name];
  if(source?.length!==bank.length||Array.from(source).some(b=>!Number.isInteger(b)||b<0||b>255))throw new Error('Неповний або пошкоджений банк знімка.');
  if(action==='keymap'&&Number.isInteger(input?.keyId)&&!keyMapping(source.slice(input.keyId*3,input.keyId*3+3)).known)throw new Error('Спеціальне призначення не можна замінити цим планом.');
  const before=Uint8Array.from(source),after=edit(before,input),records=[];
  let changedBytes=0;
  for(let start=0;start<before.length;start+=bank.record){
    let changed=0;for(let i=start;i<start+bank.record;i++)if(before[i]!==after[i])changed++;
    if(!changed)continue;
    changedBytes+=changed;
    records.push({offset:bank.offset+start,keyCode:name==='function'?null:JET75_KEYS[start/bank.record]?.code,
      before:Array.from(before.slice(start,start+bank.record)),after:Array.from(after.slice(start,start+bank.record))});
  }
  return {kind:'keyboard-edit-preview',revision:state.revision,profile:state.profile+1,bank:name,offset:bank.offset,
    readCommand:bank.read,writeCommand:bank.write,recordSize:bank.record,baselineSha256:hash(before),targetSha256:hash(after),changedBytes,records,
    writeAllowed:false,transportReady:false,warning:'Це план за збереженим знімком, не HID-пакети й не дозвіл запису. Пристрій міг змінитися після зчитування; перед майбутнім застосуванням потрібна повторна перевірка.'};
}

// Atomic validation and composition in memory. Duplicate targets are rejected even for no-ops.
export function planKeyboardBatch(state,operations,revision){
  if(!Array.isArray(operations)||operations.length<1||operations.length>160)throw new Error('План потребує 1–160 операцій.');
  const working={...state},banks=new Map(),targets=new Set();
  for(const operation of operations){
    if(!operation||Object.keys(operation).some(key=>!['action','value'].includes(key)))throw new Error('Невірна операція групового плану.');
    const p=planKeyboardEdit(working,operation.action,operation.value,revision);
    const ids=operation.action==='trigger'?operation.value.keyIds:operation.action==='keymap'?[operation.value.keyId]:['function'];
    for(const id of new Set(ids)){const target=p.bank+':'+id;if(targets.has(target))throw new Error('Повторена ціль у груповому плані.');targets.add(target);}
    if(!banks.has(p.bank))banks.set(p.bank,{...p,records:[],changedBytes:0});
    const combined=banks.get(p.bank),after=Uint8Array.from(working[p.bank]);
    for(const record of p.records){after.set(record.after,record.offset-p.offset);combined.records.push(record);}
    combined.changedBytes+=p.changedBytes;combined.targetSha256=hash(after);working[p.bank]=after;
  }
  const plans=[...banks.values()];for(const p of plans)p.records.sort((a,b)=>a.offset-b.offset);
  return {kind:'keyboard-batch-preview',revision,profile:plans[0].profile,operations:operations.length,banks:plans,
    changedBytes:plans.reduce((n,p)=>n+p.changedBytes,0),records:plans.flatMap(p=>p.records.map(record=>({...record,bank:p.bank}))),
    writeAllowed:false,transportReady:false,warning:plans[0].warning};
}
