import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { VID, PID, packet, replyMatches, activeProfile, layoutMismatch, keyboardBank, keyboardView, keyboardWriteError, editFunction, editTrigger, editKeymap } from './keyboard-codec.mjs';
import {planKeyboardEdit,planKeyboardBatch} from './keyboard-plan.mjs';
import {mousePresence} from './mouse-presence.mjs';
const require = createRequire(import.meta.url);
const HID = require('node-hid');
const exec = promisify(execFile);
// Optional, user-supplied adapter. Never download or redistribute third-party code at launch.
let localConfig={};
try{localConfig=JSON.parse(await fs.readFile(new URL('../.local/config.json',import.meta.url),'utf8'));}
catch(error){if(error.code!=='ENOENT')throw new Error('Invalid .local/config.json: '+error.message);}
const ADAPTER=process.env.INPUT_STUDIO_HATOR_ADAPTER||localConfig.hatorAdapterPath||null;
if(ADAPTER!==null&&(typeof ADAPTER!=='string'||!path.isAbsolute(ADAPTER)))throw new Error('HATOR adapter path must be an absolute local path');
export const dataDirectory = path.join(process.env.LOCALAPPDATA || process.env.TEMP, 'InputStudio');
let queue = Promise.resolve();
export function serialized(action) { const next = queue.then(action); queue = next.catch(() => {}); return next; }
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
async function backup(device, content) {
  const directory = path.join(dataDirectory, 'backups'); await fs.mkdir(directory, {recursive:true});
  const filename = `${new Date().toISOString().replaceAll(':','-')}-${crypto.randomBytes(3).toString('hex')}-${device}.json`;
  await fs.writeFile(path.join(directory,filename), JSON.stringify({version:1,device,created:new Date().toISOString(),content},null,2), {flag:'wx'});
  return filename;
}
export function discover() {
  const devices = HID.devices();
  const mouseInfo=mousePresence(devices,!!ADAPTER);
  return { mouse:mouseInfo.connected, keyboard: devices.some(d => d.vendorId === VID && d.productId === PID),mouseInfo };
}
export function assertMouseReadable() {
  const info=mousePresence(HID.devices(),!!ADAPTER);
  if(!info.readSupported)throw new Error(info.warning);
}
export async function conflicts(device) {
  const query = "Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'openmouse-gpui|openmouse-bridge|MCHOSE HUB.exe' -or ($_.Name -eq 'node.exe' -and $_.CommandLine -match 'OpenMouse-HATOR.*companion') } | Select-Object Name,CommandLine | ConvertTo-Json -Compress";
  const {stdout} = await exec('powershell.exe', ['-NoProfile','-NonInteractive','-Command',query], {windowsHide:true,timeout:10000});
  const all = stdout.trim() ? [JSON.parse(stdout)].flat() : [];
  return all.filter(p => device === 'mouse' ? /openmouse/i.test(p.Name) || /companion/i.test(p.CommandLine || '') : /MCHOSE/i.test(p.Name)).map(p => p.Name);
}
async function withKeyboard(action) {
  const info = HID.devices().find(d => d.vendorId === VID && d.productId === PID && d.usagePage === 1 && (d.usage === 0 || d.usage === undefined) && d.interface === 1);
  if (!info) throw new Error('Jet75-II configuration interface is unavailable. Standard keyboard collections are not opened.');
  const handle = new HID.HID(info.path);
  let dead = false;
  const link = {
    identity: {vendorId:VID,productId:PID,serial:info.serialNumber,release:info.release},
    async request(cmd, offset, payload) {
      if (dead) throw new Error('Connection closed');
      const bytes = packet(cmd,offset,payload), length = bytes[4];
      const response = new Promise((resolve,reject) => {
        const reports = [];
        const timer = setTimeout(() => {
          dead=true;try{handle.close();}catch{}
          const details = reports.length ? ` Отримані заголовки: ${reports.join('; ')}` : ' Жодного вхідного пакета не отримано.';
          const outcome=typeof payload==='number'?'Це був запит читання; автоматичного повтору немає.':'Результат запису не підтверджений; подальший запис заблокований.';
          reject(new Error(`Клавіатура не відповіла на команду ${cmd} (offset ${offset}, ${length} байт).${details} ${outcome}`));
        },1500);
        const read = () => handle.read((error,data) => {
          if (dead) return;
          if(error){clearTimeout(timer);reject(error);return;}
          const raw = Uint8Array.from(data.length === 65 && data[0] === 0 ? data.slice(1) : data);
          if(reports.length < 4)reports.push(`${data.length}B [${Array.from(raw.slice(0,8),v=>v.toString(16).padStart(2,'0')).join(' ')}]`);
          if(!replyMatches(raw,cmd,offset,length)){read();return;}
          clearTimeout(timer);resolve(raw.slice(8,8+raw[4]));
        });
        read();
        try { handle.write([0,...bytes]); } catch(error) {
          clearTimeout(timer);dead=true;try{handle.close();}catch{}reject(error);
        }
      });
      return response;
    },
    async get(cmd,offset,length) {
      const result = new Uint8Array(length);
      for(let p=0;p<length;p+=56) {
        const requested=Math.min(56,length-p), data=await this.request(cmd,offset+p,requested);
        if(!data.length)throw new Error(`Empty reply to read command ${cmd}; no settings were written.`);
        result.set(data,p);
        if(data.length!==requested) {
          // INFO and BASE are variable-length metadata, not editable banks.
          if(p===0 && offset===0 && (cmd===3 || cmd===4))return result.slice(0,data.length);
          throw new Error(`Incomplete configuration bank ${cmd}: expected ${requested} bytes at ${offset+p}, received ${data.length}. Writes blocked.`);
        }
      }
      return result;
    },
    async changed(cmd,offset,before,after,record) {
      for(let p=0;p<after.length;p+=record) if(!Buffer.from(before.slice(p,p+record)).equals(Buffer.from(after.slice(p,p+record)))) await this.request(cmd,offset+p,after.slice(p,p+record));
    }
  };
  try{return await action(link);}finally{if(!dead){dead=true;handle.close();}}
}
let keyboardState = null;
export function assertKeyboardWritable() {
  const error=keyboardWriteError(keyboardState);
  if(error)throw new Error(error);
}
export async function readKeyboard() {
  const other=await conflicts('keyboard');
  if(other.length)throw new Error('Закрий MCHOSE HUB перед зчитуванням, щоб уникнути одночасного доступу. HID-запити не надсилалися.');
  return withKeyboard(async link => {
    const info=await link.get(3,0,56),base=await link.get(4,0,56),profile=activeProfile(base);
    const readBank=name=>{const b=keyboardBank(name,profile);return link.get(b.read,b.offset,b.length);};
    const state={identity:link.identity,info,base,profile,function:await readBank('function'),defaults:await readBank('defaults'),keys:await readBank('keys'),triggers:await readBank('triggers'),colors:await readBank('colors')};
    state.layoutError=layoutMismatch(state.defaults);
    state.revision=crypto.randomBytes(16).toString('hex');
    state.backup=await backup('jet75-read',JSON.parse(JSON.stringify(state,(_,v)=>v instanceof Uint8Array?Array.from(v):v)));
    keyboardState=state;return keyboardView(state);
  });
}
export function previewKeyboard(action,input,revision) {
  return planKeyboardEdit(keyboardState,action,input,revision);
}
export function previewKeyboardBatch(operations,revision){return planKeyboardBatch(keyboardState,operations,revision);}
export async function writeKeyboard(action,input,revision) {
  assertKeyboardWritable();
  if(!keyboardState || keyboardState.revision !== revision) throw new Error('Read the keyboard again: stale or missing snapshot.');
  const target = {function:['function',editFunction],trigger:['triggers',editTrigger],keymap:['keys',editKeymap]}[action];
  if(!target) throw new Error('Unsupported keyboard operation');
  const [name,edit]=target;
  const state=keyboardState,bank=keyboardBank(name,state.profile),after=edit(state[name],input);
  return withKeyboard(async link => {
    if(JSON.stringify(link.identity)!==JSON.stringify(state.identity)) throw new Error('Different keyboard identity');
    const info=await link.get(3,0,56),base=await link.get(4,0,56);
    if(activeProfile(base)!==state.profile || hash(info)!==hash(state.info)) throw new Error('Profile / firmware changed. Read again.');
    const factory=keyboardBank('defaults',state.profile),defaults=await link.get(factory.read,factory.offset,factory.length);
    if(hash(defaults)!==hash(state.defaults))throw new Error('Factory layout changed. Keyboard writes blocked; read again.');
    const offset=bank.offset,before=await link.get(bank.read,offset,state[name].length);
    if(hash(before)!==hash(state[name])) throw new Error('Another controller changed this bank. Read again; nothing was overwritten.');
    if(hash(before)===hash(after)) return keyboardView(state);
    const saved=await backup('jet75-before-write',{identity:state.identity,profile:state.profile,bank:name,raw:Array.from(before),sha256:hash(before)});
    try {
      await link.changed(bank.write,offset,before,after,bank.record);
      const actual=await link.get(bank.read,offset,after.length);
      if(hash(actual)!==hash(after)) throw new Error(`Read-back mismatch. Writes disabled; backup: ${saved}`);
    } catch(error) {keyboardState=null;throw error;}
    state[name]=after;state.revision=crypto.randomBytes(16).toString('hex');state.backup=saved;
    return keyboardView(state);
  });
}
async function mouseSession(allowWrites,task) {
  assertMouseReadable();
  const handles=new Map();let bank=null;
  const context=vm.createContext({__api:{},__host:{sleep:delay,invoke:async(command,json)=>{
    const a=JSON.parse(json);
    if(a.vendorId!==0x258a || a.productId!==0x2f) throw new Error('Wrong mouse target');
    if(command==='hid_open') {
      const devices=HID.devices().filter(d=>d.vendorId===0x258a&&d.productId===0x2f&&d.usagePage===0xff00);
      try {for(const [id,col] of [[5,'col05'],[8,'col03']]){const info=devices.find(d=>d.path.toLowerCase().includes(col));if(!info)throw new Error('HATOR configuration interface is unavailable');handles.set(id,new HID.HID(info.path));}}catch(error){for(const h of handles.values())h.close();handles.clear();throw error;}
      return '';
    }
    if(command==='hid_close'){for(const h of handles.values())h.close();handles.clear();return '';}
    if(command==='hid_get_feature_report') {
      if(!((a.reportId===5&&a.length===7)||(a.reportId===8&&a.length===519)))throw new Error('Unexpected feature read');
      const bytes=handles.get(a.reportId).getFeatureReport(a.reportId,a.length+1);
      if(a.reportId===8&&bytes[1]===0x21)bank=Array.from(bytes);
      return JSON.stringify(bytes.slice(1));
    }
    if(command==='hid_send_feature_report') {
      if(a.reportId===5){if(a.data.length!==7||![1,0x80,0x90,0x21].includes(a.data[0])||a.data.slice(1).some(Boolean))throw new Error('Read selector blocked');}
      else if(a.reportId===8){if(!allowWrites||a.data.length!==519||a.data[0]!==0x21||a.data[2]!==0x92||!bank)throw new Error('Configuration write blocked');await backup('hator-before-write',{identity:'258a:002f/2610',raw:bank});}
      else throw new Error('Unknown report');
      handles.get(a.reportId).sendFeatureReport([a.reportId,...a.data]);return '';
    }
    throw new Error('Unsupported HID operation');
  }}});
  try{vm.runInContext(await fs.readFile(ADAPTER,'utf8'),context);return await task(context.__api);}finally{for(const h of handles.values())try{h.close();}catch{}}
}
export async function readMouse(){return mouseSession(false,async api=>JSON.parse(await api.connect('258a:002f')));}
export async function writeMouse(action,value){
  if(!['dpi','pollingRate','lighting','control:hator.brightness','control:hator.palette','control:hator.direction'].includes(action))throw new Error('Unsupported mouse feature');
  await mouseSession(true,async api=>api.write(JSON.stringify({key:'258a:002f',action,value})));
  return readMouse();
}
