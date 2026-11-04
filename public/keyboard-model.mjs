// Local editor model only. These logical key codes are NOT vendor record IDs.
export const LAYERS = ['win', 'winFn', 'mac', 'macFn'];
export const RULE_TYPES = ['RS', 'SOCD', 'DKS', 'MT', 'TGL'];
export const SWITCH_TYPES = [
  ['default','Default Option'],['ttc-uranus-s','TTC Uranus Magnetic · S'],
  ['ttc-uranus-r','TTC Uranus Magnetic · R'],['ttc-magneto','TTC Magneto'],
  ['ice-rhino','Ice Rhino Magnetic'],['star-hunt','Star Hunt Magnetic'],
  ['starburst','Starburst Magnetic'],['kailh-god','Kailh Magnetic God']
];
export const TRIGGER_DEFAULTS = Object.freeze({
  actuation:1.5,rapid:false,press:.2,release:.2,switchType:'default',separate:true,
  continuous:false,berserk:false,deadzoneEnabled:false,topDeadzone:0,bottomDeadzone:0
});
export const TRIGGER_FIELDS = Object.keys(TRIGGER_DEFAULTS);
export const TRIGGER_NUMBERS = ['actuation','press','release','topDeadzone','bottomDeadzone'];
export const TRIGGER_MIN = .04, TRIGGER_MAX = 3.36;
export const EFFECTS = [
  ['static','Постійне світло'],['breathing','Дихання'],['rainbow','Веселка'],
  ['wave-h','Горизонтальна хвиля'],['wave-v','Вертикальна хвиля'],['spread','Із центру'],
  ['stars','Зорі'],['disco','Диско'],['gradient','Градієнт'],['tail','Світловий слід'],
  ['rebound','Відскок'],['spin','Обертання'],['twinkle','Мерехтіння'],['reactive','Реактивний'],
  ['pillars','Світлові стовпи'],['laser','Лазерний дощ'],['custom','Колір клавіш'],['off','Вимкнено']
];
const keys = [];
function row(y, entries) { for(const [code,label,x,w=1] of entries)keys.push({code,label,x,y,w,h:1}); }
row(0,[['Escape','Esc',0],...Array.from({length:12},(_,i)=>[`F${i+1}`,`F${i+1}`,i+2+Math.floor(i/4)/3]),['Delete','Del',15]]);
row(1.25,[['Backquote','` ~',0],...Array.from({length:10},(_,i)=>[`Digit${(i+1)%10}`,String((i+1)%10),i+1]),['Minus','−',11],['Equal','=',12],['Backspace','Backspace',13,2],['Home','Home',15]]);
row(2.25,[['Tab','Tab',0,1.5],...['Q','W','E','R','T','Y','U','I','O','P'].map((k,i)=>[`Key${k}`,k,1.5+i]),['BracketLeft','[',11.5],['BracketRight',']',12.5],['Backslash','\\',13.5,1.5],['PageUp','PgUp',15]]);
row(3.25,[['CapsLock','Caps',0,1.75],...['A','S','D','F','G','H','J','K','L'].map((k,i)=>[`Key${k}`,k,1.75+i]),['Semicolon',';',10.75],['Quote',"'",11.75],['Enter','Enter',12.75,2.25],['PageDown','PgDn',15]]);
row(4.25,[['ShiftLeft','Shift',0,2.25],...['Z','X','C','V','B','N','M'].map((k,i)=>[`Key${k}`,k,2.25+i]),['Comma',',',9.25],['Period','.',10.25],['Slash','/',11.25],['ShiftRight','Shift',12.25,1.75],['ArrowUp','↑',14]]);
row(5.25,[['ControlLeft','Ctrl',0,1.25],['MetaLeft','Win',1.25,1.25],['AltLeft','Alt',2.5,1.25],['Space','Space',3.75,6.5],['Fn','Fn',10.25,1.25],['ControlRight','Ctrl',11.5,1.25],['ArrowLeft','←',13],['ArrowDown','↓',14],['ArrowRight','→',15]]);
export const KEYBOARD = keys;
export const KEY_CODES = new Set(keys.map(k=>k.code));
export const LABELS = Object.fromEntries(keys.map(k=>[k.code,k.label]));
const OTHER_CODES = ['Insert','End','PrintScreen','ScrollLock','Pause','NumLock',...Array.from({length:10},(_,i)=>`Numpad${i}`),'NumpadAdd','NumpadSubtract','NumpadMultiply','NumpadDivide','NumpadEnter','NumpadDecimal','AltRight','MetaRight'];
export const OUTPUT_CODES = new Set([...KEY_CODES,...OTHER_CODES].filter(code=>code!=='Fn'));
export const labelFor = code => LABELS[code] || code.replace('Numpad','Num ');
const KEYCAP_LABELS={
  Backquote:'~ `',Digit1:'1 !',Digit2:'2 @',Digit3:'3 #',Digit4:'4 $',Digit5:'5 %',
  Digit6:'6 ^',Digit7:'7 &',Digit8:'8 *',Digit9:'9 (',Digit0:'0 )',Minus:'− _',Equal:'= +',
  BracketLeft:'[ {',BracketRight:'] }',Backslash:'\\ |',Semicolon:'; :',Quote:"' \"",
  Comma:', <',Period:'. >',Slash:'/ ?',Delete:'Delete'
};
export const keycapLabel = code => KEYCAP_LABELS[code] || labelFor(code);
const NAVIGATION_KEYS=KEYBOARD.filter(key=>key.code!=='Fn');
export function keyboardNeighbor(code,direction,{wholeBoard=false}={}) {
  const current=NAVIGATION_KEYS.find(key=>key.code===code);
  if(!current)return 'Escape';
  const row=NAVIGATION_KEYS.filter(key=>key.y===current.y).sort((a,b)=>a.x-b.x);
  if(direction==='Home')return (wholeBoard?NAVIGATION_KEYS:row)[0].code;
  if(direction==='End')return (wholeBoard?NAVIGATION_KEYS:row).at(-1).code;
  if(direction==='ArrowLeft'||direction==='ArrowRight'){
    return row[row.indexOf(current)+(direction==='ArrowRight'?1:-1)]?.code||code;
  }
  if(direction!=='ArrowUp'&&direction!=='ArrowDown')return code;
  const rows=NAVIGATION_KEYS.filter(key=>direction==='ArrowUp'?key.y<current.y:key.y>current.y);
  if(!rows.length)return code;
  const y=direction==='ArrowUp'?Math.max(...rows.map(key=>key.y)):Math.min(...rows.map(key=>key.y));
  const center=current.x+current.w/2;
  const gap=key=>Math.max(key.x-center,center-key.x-key.w,0);
  const distance=key=>Math.abs(key.x+key.w/2-center);
  return rows.filter(key=>key.y===y).sort((a,b)=>gap(a)-gap(b)||distance(a)-distance(b)||a.x-b.x)[0].code;
}
const uid=()=>globalThis.crypto.randomUUID();
const copy=value=>JSON.parse(JSON.stringify(value));
function object(value,allowed,label) {
  if(!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).some(k=>!allowed.includes(k)))throw new Error(`Невірний формат: ${label}`);
  return value;
}
function string(value,max,label) {if(typeof value!=='string'||!value.trim()||value.length>max)throw new Error(`Невірне поле: ${label}`);return value;}
function bool(value) {if(typeof value!=='boolean')throw new Error('Очікується перемикач true/false');return value;}
function number(value,min,max,label) {if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new Error(`Невірне поле ${label}: ${min}–${max}`);return value;}
function choice(value,values,label) {if(!values.includes(value))throw new Error(`Невідоме значення: ${label}`);return value;}
export function hex(value) {if(typeof value!=='string'||!/^#[0-9a-f]{6}$/i.test(value))throw new Error('Колір має бути #RRGGBB');return value.toLowerCase();}
function id(value) {if(typeof value!=='string'||!/^[a-z0-9-]{4,64}$/i.test(value))throw new Error('Невірний ідентифікатор');return value;}
function physical(code) {if(!KEY_CODES.has(code)||code==='Fn')throw new Error('Невідома або захищена клавіша');return code;}
function output(code) {if(!OUTPUT_CODES.has(code))throw new Error('Невідомий код призначення');return code;}
function boundedMap(value,validate,max=128) {
  object(value,Object.keys(value||{}),'таблиця');if(Object.keys(value).length>max)throw new Error('Забагато записів');
  return Object.fromEntries(Object.entries(value).map(([code,v])=>[physical(code),validate(v)]));
}
export function triggerValue(value) {
  object(value,TRIGGER_FIELDS,'Trigger');
  // Optional fields migrate version-1 drafts without changing their old values.
  const v={...TRIGGER_DEFAULTS,...value};
  const result={
    actuation:number(v.actuation,TRIGGER_MIN,TRIGGER_MAX,'спрацювання'),rapid:bool(v.rapid),
    press:number(v.press,TRIGGER_MIN,TRIGGER_MAX,'RT press'),release:number(v.release,TRIGGER_MIN,TRIGGER_MAX,'RT release'),
    switchType:choice(v.switchType,SWITCH_TYPES.map(s=>s[0]),'тип перемикача'),separate:bool(v.separate),
    continuous:bool(v.continuous),berserk:bool(v.berserk),deadzoneEnabled:bool(v.deadzoneEnabled),
    topDeadzone:number(v.topDeadzone,0,1,'верхня мертва зона'),bottomDeadzone:number(v.bottomDeadzone,0,1,'нижня мертва зона')
  };
  if(!result.separate&&Math.abs(result.press-result.release)>1e-8)throw new Error('Зв’язані чутливості мають бути однаковими');
  if(result.deadzoneEnabled&&(result.actuation<result.topDeadzone-1e-8||result.actuation>TRIGGER_MAX-result.bottomDeadzone+1e-8))throw new Error('Точка спрацювання потрапила в мертву зону');
  return result;
}
export function triggerFor(profile,code) {
  physical(code);
  const {perKey,...base}=profile.trigger;
  return triggerValue(perKey[code]||base);
}
function editableTargets(codes) {
  if(!Array.isArray(codes))throw new Error('Вибери клавіші');
  const targets=[...new Set(codes)].map(physical);
  if(!targets.length)throw new Error('Спочатку вибери клавіші або натисни WASD / Усі');
  return targets;
}
export function triggerSelection(profile,codes) {
  const targets=[...new Set(codes)].filter(code=>KEY_CODES.has(code)&&code!=='Fn');
  const values=targets.map(code=>triggerFor(profile,code));
  const fields=Object.fromEntries(TRIGGER_FIELDS.map(field=>{
    const mixed=values.length>1&&values.some(value=>value[field]!==values[0][field]);
    return [field,{mixed,value:values.length&&!mixed?values[0][field]:null}];
  }));
  return {codes:targets,count:targets.length,fields,step:values.length&&values.every(v=>v.berserk)?.005:.01};
}
export function snapTrigger(value,step,min=0,max=TRIGGER_MAX) {
  number(value,min,max,'значення');
  return Math.max(min,Math.min(max,Math.round(Math.round(value/step)*step*1000)/1000));
}
export function applyTriggerPatch(profile,codes,patch) {
  object(patch,TRIGGER_FIELDS,'зміна Trigger');
  if(!Object.keys(patch).length)throw new Error('Порожня зміна Trigger');
  const updates=editableTargets(codes).map(code=>{
    const next={...triggerFor(profile,code),...patch};
    const changed=new Set(Object.keys(patch));
    if(!next.separate) {
      if(changed.has('release')&&!changed.has('press'))next.press=next.release;
      else next.release=next.press;
      if(changed.has('press')||changed.has('release')||patch.separate===false){changed.add('press');changed.add('release');}
    }
    const step=next.berserk?.005:.01;
    for(const field of TRIGGER_NUMBERS)if(changed.has(field)||patch.berserk===false){
      const deadzone=field.endsWith('Deadzone');
      next[field]=snapTrigger(next[field],step,deadzone?0:TRIGGER_MIN,deadzone?1:TRIGGER_MAX);
    }
    if(!next.separate)next.release=next.press;
    if(next.deadzoneEnabled)next.actuation=Math.max(TRIGGER_MIN,next.topDeadzone,Math.min(TRIGGER_MAX-next.bottomDeadzone,next.actuation));
    return [code,triggerValue(next)];
  });
  for(const [code,value]of updates)profile.trigger.perKey[code]=value;
  return updates.length;
}
export function resetTriggerKeys(profile,codes) {
  const targets=editableTargets(codes);
  for(const code of targets)delete profile.trigger.perKey[code];
  return targets.length;
}
export function binding(value) {
  if(!value||typeof value!=='object')throw new Error('Невірне призначення');
  switch(value.kind) {
    case 'key':object(value,['kind','code'],'клавіша');return {kind:'key',code:output(value.code)};
    case 'shortcut':object(value,['kind','code','modifiers'],'комбінація');if(!Array.isArray(value.modifiers)||value.modifiers.length>4)throw new Error('Невірні модифікатори');return {kind:'shortcut',code:output(value.code),modifiers:[...new Set(value.modifiers.map(m=>choice(m,['Control','Alt','Shift','Meta'],'модифікатор')))]};
    case 'mouse':object(value,['kind','action'],'миша');return {kind:'mouse',action:choice(value.action,['left','right','middle','back','forward','wheel-up','wheel-down'],'кнопка миші')};
    case 'media':object(value,['kind','action'],'медіа');return {kind:'media',action:choice(value.action,['play-pause','next','previous','mute','volume-up','volume-down'],'медіа')};
    case 'lighting':object(value,['kind','action'],'підсвітка');return {kind:'lighting',action:choice(value.action,['toggle','next-effect','brightness-up','brightness-down'],'підсвітка')};
    default:throw new Error('Непідтримуване призначення');
  }
}
export function bindingLabel(value) {
  if(!value)return 'За замовчуванням';
  if(value.kind==='key')return labelFor(value.code);
  if(value.kind==='shortcut')return [...value.modifiers.map(m=>({Control:'Ctrl',Meta:'Win'})[m]||m),labelFor(value.code)].join(' + ');
  return ({left:'Ліва кнопка',right:'Права кнопка',middle:'Середня кнопка',back:'Назад',forward:'Вперед','wheel-up':'Колесо ↑','wheel-down':'Колесо ↓','play-pause':'Play / Pause',next:'Наступний трек',previous:'Попередній трек',mute:'Mute','volume-up':'Гучність +','volume-down':'Гучність −',toggle:'Світло: on/off','next-effect':'Наступний ефект','brightness-up':'Яскравість +','brightness-down':'Яскравість −'})[value.action]||value.action;
}
export function bindingSignature(value) {
  const checked=binding(value);
  if(checked.kind==='shortcut'){
    const order=['Control','Alt','Shift','Meta'];
    checked.modifiers.sort((a,b)=>order.indexOf(a)-order.indexOf(b));
  }
  return JSON.stringify(checked);
}
export function bindingFor(profile,layer,code) {
  choice(layer,LAYERS,'шар');physical(code);
  return profile.bindings[layer][code]?binding(profile.bindings[layer][code]):{kind:'key',code};
}
export function bindingSelection(profile,layer,codes) {
  choice(layer,LAYERS,'шар');
  if(!Array.isArray(codes))throw new Error('Вибери клавіші');
  const targets=[...new Set(codes)].filter(code=>KEY_CODES.has(code)&&code!=='Fn');
  const entries=targets.map(code=>({code,value:bindingFor(profile,layer,code),overridden:Object.hasOwn(profile.bindings[layer],code)}));
  const mixed=entries.length>1&&entries.some(entry=>bindingSignature(entry.value)!==bindingSignature(entries[0].value));
  const overriddenCount=entries.filter(entry=>entry.overridden).length;
  return {layer,codes:targets,count:targets.length,entries,mixed,allDefault:targets.length>0&&!overriddenCount,overriddenCount,common:entries.length&&!mixed?copy(entries[0].value):null};
}
export function applyBinding(profile,layer,codes,command) {
  choice(layer,LAYERS,'шар');
  const targets=editableTargets(codes),checked=binding(command),signature=bindingSignature(checked);
  const updates=targets.filter(code=>!Object.hasOwn(profile.bindings[layer],code)||bindingSignature(profile.bindings[layer][code])!==signature);
  // Resolve and validate the complete group before changing any key.
  for(const code of updates)profile.bindings[layer][code]=copy(checked);
  return updates.length;
}
export function resetBindingKeys(profile,layer,codes) {
  choice(layer,LAYERS,'шар');
  const targets=editableTargets(codes),changed=targets.filter(code=>Object.hasOwn(profile.bindings[layer],code));
  for(const code of changed)delete profile.bindings[layer][code];
  return changed.length;
}
function rule(value) {
  object(value,['id','kind','keys','mode','holdMs','actions'],'Advanced key');
  const kind=choice(value.kind,RULE_TYPES,'advanced key');
  if(!Array.isArray(value.keys)||value.keys.length!==(kind==='RS'||kind==='SOCD'?2:1)||new Set(value.keys).size!==value.keys.length)throw new Error('Для правила оберіть правильну кількість різних клавіш');
  if(!Array.isArray(value.actions)||value.actions.length>4)throw new Error('Забагато дій DKS');
  const actions=value.actions.map(a=>{object(a,['at','code'],'дія');return {at:number(a.at,.04,3.36,'поріг'),code:output(a.code)};});
  if(kind==='DKS' && (actions.length!==4 || actions.some((a,i)=>i&&a.at<=actions[i-1].at)))throw new Error('DKS потребує 4 послідовних порогів');
  if(kind==='MT'&&actions.length!==2)throw new Error('Hold/Tap потребує двох дій');
  if(kind==='TGL'&&actions.length!==1)throw new Error('Toggle потребує однієї дії');
  return {id:id(value.id),kind,keys:value.keys.map(physical),mode:choice(value.mode,['depth','last','neutral','priority'],'правило'),holdMs:number(value.holdMs,50,2000,'затримка Hold/Tap'),actions};
}
export function createProfile(name='Default') {
  return {id:uid(),name,lighting:{enabled:true,effect:'static',brightness:80,speed:3,color:'#b6a3ed',perKey:{}},trigger:{...triggerValue({actuation:1.5,rapid:false,press:.2,release:.2}),perKey:{}},bindings:{win:{},winFn:{},mac:{},macFn:{}},advanced:[],performance:{pollingHz:1000,winLock:false,macMode:false,stability:false,debounce:false,adaptiveCalibration:false}};
}
export function normalizeProfile(value) {
  object(value,['id','name','lighting','trigger','bindings','advanced','performance'],'профіль');
  const l=object(value.lighting,['enabled','effect','brightness','speed','color','perKey'],'підсвітка');
  const t=object(value.trigger,[...TRIGGER_FIELDS,'perKey'],'Trigger');
  const {perKey,...triggerBase}=t;
  object(value.bindings,LAYERS,'шари');
  const p=object(value.performance,['pollingHz','winLock','macMode','stability','debounce','adaptiveCalibration'],'Performance');
  if(!Array.isArray(value.advanced)||value.advanced.length>40)throw new Error('Максимум 40 advanced rules');
  const advanced=value.advanced.map(rule);if(new Set(advanced.map(r=>r.id)).size!==advanced.length)throw new Error('Повторені ідентифікатори правил');
  return {id:id(value.id),name:string(value.name,60,'назва').trim(),lighting:{enabled:bool(l.enabled),effect:choice(l.effect,EFFECTS.map(e=>e[0]),'ефект'),brightness:number(l.brightness,0,100,'яскравість'),speed:number(l.speed,1,5,'швидкість'),color:hex(l.color),perKey:boundedMap(l.perKey,hex)},trigger:{...triggerValue(triggerBase),perKey:boundedMap(perKey,triggerValue)},bindings:Object.fromEntries(LAYERS.map(layer=>[layer,boundedMap(value.bindings[layer],binding)])),advanced,performance:{pollingHz:choice(p.pollingHz,[1000,2000,4000,8000],'частота'),winLock:bool(p.winLock),macMode:bool(p.macMode),stability:bool(p.stability),debounce:bool(p.debounce),adaptiveCalibration:bool(p.adaptiveCalibration)}};
}
export function cloneProfile(profile,name=`${profile.name} — копія`) {const next=normalizeProfile(copy(profile));next.id=uid();next.name=name.slice(0,60);return next;}
export function exportProfile(profile) {return JSON.stringify({format:'input-studio-keyboard-draft',version:1,profile:normalizeProfile(profile)},null,2);}
export function importProfile(text) {
  if(typeof text!=='string'||new TextEncoder().encode(text).length>262144)throw new Error('Файл має бути меншим за 256 КБ');
  const data=object(JSON.parse(text),['format','version','profile'],'JSON профілю');
  if(data.format!=='input-studio-keyboard-draft'||data.version!==1)throw new Error('Потрібен JSON-профіль Input Studio, не файл MCHOSE HUB');
  const profile=normalizeProfile(data.profile);profile.id=uid();return profile;
}
export function normalizeCollection(value) {
  object(value,['version','active','profiles'],'локальні профілі');
  if(value.version!==1||!Array.isArray(value.profiles)||value.profiles.length<1||value.profiles.length>50)throw new Error('Невірний список локальних профілів');
  const profiles=value.profiles.map(normalizeProfile),ids=new Set(profiles.map(p=>p.id));
  if(ids.size!==profiles.length||!ids.has(value.active))throw new Error('Невірний активний профіль');
  return {version:1,active:value.active,profiles};
}
export function newRule(kind,selected) {
  const keys=selected.filter(k=>k!=='Fn').slice(0,kind==='RS'||kind==='SOCD'?2:1);
  const actions=kind==='DKS'?[.5,1,1.5,2].map((at,i)=>({at,code:['KeyW','KeyA','KeyS','KeyD'][i]})):kind==='MT'?[{at:.04,code:'Space'},{at:.04,code:'ControlLeft'}]:kind==='TGL'?[{at:.04,code:keys[0]||'KeyA'}]:[];
  return rule({id:uid(),kind,keys,mode:kind==='RS'?'depth':'last',holdMs:200,actions});
}
export function hsvToHex(h,s,v=1) {
  h=((h%360)+360)%360;s=Math.max(0,Math.min(1,s));v=Math.max(0,Math.min(1,v));
  const f=n=>{const k=(n+h/60)%6;return Math.round((v-v*s*Math.max(0,Math.min(k,4-k,1)))*255).toString(16).padStart(2,'0');};
  return '#'+f(5)+f(3)+f(1);
}
export function hexToHsv(value) {
  const c=hex(value),[r,g,b]=[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
  let h=0;if(d)h=max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4;
  return {h:(h*60+360)%360,s:max===0?0:d/max,v:max};
}
