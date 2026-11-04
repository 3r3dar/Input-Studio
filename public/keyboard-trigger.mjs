import {
  KEYBOARD, SWITCH_TYPES, TRIGGER_DEFAULTS, TRIGGER_MIN, TRIGGER_MAX,
  triggerFor, triggerSelection, applyTriggerPatch, resetTriggerKeys, labelFor, keycapLabel
} from './keyboard-model.mjs';

const template=`
<div class="tr-selection-summary"><div><strong id="tr-selection-title">Вибери клавіші на схемі</strong><p id="tr-selection-description">WASD, Усі або Ctrl / Shift + клік для групового вибору.</p></div><span id="tr-precision" class="tr-precision">Крок 0,010 мм</span></div>
<div id="tr-empty-hint" class="tr-empty-hint">Вибери клавішу або групу, щоб змінити її параметри. Ctrl / Shift + клік — додати до вибору.</div>
<div class="tr-cards">
  <article class="tr-card tr-actuation-card">
    <h3>Actuation Distance</h3><p class="tr-description">Точка спрацювання вибраних клавіш.</p>
    <div class="tr-switch-row"><label for="tr-switch">Switch</label><select id="tr-switch"><option value="" disabled>Різні / не вибрано</option></select><button class="tr-calibration" type="button" disabled title="Апаратний протокол калібрування ще не підключений. Імітація не виконується.">Калібрування<br>недоступне</button></div>
    <p class="tr-switch-note">Тип перемикача — параметр чернетки, не автоматичне визначення.</p>
    <div class="tr-actuation-editor">
      <div class="tr-switch-art" aria-hidden="true"><div class="tr-switch-cap"></div><div class="tr-switch-body"><div class="tr-switch-stem"></div><div class="tr-switch-spring"></div></div><div class="tr-switch-base"></div></div>
      <div class="tr-ruler"><span>0,00</span><span>0,50</span><span>1,00</span><span>1,50</span><span>2,00</span><span>2,50</span><span>3,00</span><span>3,36</span></div>
      <label class="tr-vertical-wrap" for="tr-actuation-range"><span class="sr-only">Точка спрацювання, вертикальний регулятор</span><div class="tr-track-fill"></div><input id="tr-actuation-range" data-tr-range="actuation" type="range" min="0.04" max="3.36" step="0.01"></label>
      <div class="tr-actuation-number"><label for="kb-actuation">Спрацювання</label><div class="tr-number-wrap"><input id="kb-actuation" data-tr-number="actuation" type="number" min="0.04" max="3.36" step="0.01" placeholder="—"><span>мм</span></div><div class="tr-step-controls"><button type="button" data-tr-step="actuation:-1" aria-label="Зменшити точку спрацювання на один крок">−</button><button type="button" data-tr-step="actuation:1" aria-label="Збільшити точку спрацювання на один крок">+</button></div></div>
    </div>
    <p id="tr-actuation-bounds" class="tr-footnote">Діапазон чернетки: 0,040–3,360 мм.</p>
  </article>

  <article class="tr-card">
    <div class="tr-card-heading"><label for="kb-rt-enabled">Quick Trigger (RT)</label><input id="kb-rt-enabled" data-tr-toggle="rapid" type="checkbox"></div>
    <p class="tr-description">Окремі відстані натискання та скидання у локальному профілі.</p>
    <div class="tr-sensitivity tr-press"><label for="kb-rt-press">Press Sensitivity <span>натискання</span></label><div class="tr-sensitivity-row"><span>High</span><input id="tr-press-range" data-tr-range="press" type="range" min="0.04" max="3.36" step="0.01" aria-label="Чутливість натискання"><span>Low</span><div class="tr-number-wrap"><input id="kb-rt-press" data-tr-number="press" type="number" min="0.04" max="3.36" step="0.01" placeholder="—"><span>мм</span></div></div></div>
    <div class="tr-sensitivity tr-release"><label for="kb-rt-release">Release Sensitivity <span>відпускання</span></label><div class="tr-sensitivity-row"><span>High</span><input id="tr-release-range" data-tr-range="release" type="range" min="0.04" max="3.36" step="0.01" aria-label="Чутливість відпускання"><span>Low</span><div class="tr-number-wrap"><input id="kb-rt-release" data-tr-number="release" type="number" min="0.04" max="3.36" step="0.01" placeholder="—"><span>мм</span></div></div></div>
    <label class="tr-toggle-row" for="tr-separate"><span><strong>Натискання й відпускання окремо</strong><small>Вимкни, щоб змінювати обидві чутливості разом.</small></span><input id="tr-separate" data-tr-toggle="separate" type="checkbox"></label>
    <div id="tr-linked-note" class="tr-linked-note" hidden>Чутливості зв’язані. Регулятор натискання змінює обидва значення.</div>
    <label class="tr-toggle-row" for="tr-continuous"><span><strong>Rapid trigger</strong><small>Окремий додатковий прапорець режиму. Апаратна поведінка не перевірена.</small></span><input id="tr-continuous" data-tr-toggle="continuous" type="checkbox"></label>
    <p class="tr-footnote">Менша відстань — вища чутливість. Вимкнений RT зберігає налаштовані значення.</p>
  </article>

  <article class="tr-card">
    <h3>Advanced Settings</h3><p class="tr-description">Точність налаштування та мертві зони.</p>
    <label class="tr-toggle-row" for="tr-berserk"><span><strong>Berserk Mode 3.0</strong><small>Крок регуляторів 0,005 мм замість 0,010 мм. Це точність редактора, не вимірювання датчика.</small></span><input id="tr-berserk" data-tr-toggle="berserk" type="checkbox"></label>
    <label class="tr-toggle-row" for="tr-deadzone-enabled"><span><strong>Key Deadzone</strong><small>Верхня та нижня неактивні ділянки у чернетці.</small></span><input id="tr-deadzone-enabled" data-tr-toggle="deadzoneEnabled" type="checkbox"></label>
    <div class="tr-deadzone-row"><label for="tr-top-deadzone">Top</label><input id="tr-top-range" data-tr-range="topDeadzone" type="range" min="0" max="1" step="0.01" aria-label="Верхня мертва зона"><div class="tr-number-wrap"><input id="tr-top-deadzone" data-tr-number="topDeadzone" type="number" min="0" max="1" step="0.01" placeholder="—"><span>мм</span></div></div>
    <div class="tr-deadzone-row"><label for="tr-bottom-deadzone">Bottom</label><input id="tr-bottom-range" data-tr-range="bottomDeadzone" type="range" min="0" max="1" step="0.01" aria-label="Нижня мертва зона"><div class="tr-number-wrap"><input id="tr-bottom-deadzone" data-tr-number="bottomDeadzone" type="number" min="0" max="1" step="0.01" placeholder="—"><span>мм</span></div></div>
    <p class="tr-footnote">Увімкнені мертві зони обмежують діапазон спрацювання. Скидання нижче змінює лише Trigger вибраних клавіш, не весь профіль.</p>
  </article>
</div>
<div class="tr-bottom-bar"><span id="tr-edit-status">Змінюється лише вибране поле у вибраних клавішах.</span><div><button id="tr-undo" type="button" class="button secondary small" title="Скасувати зміну Trigger · Ctrl+Z" disabled>Скасувати зміну</button><button id="tr-redo" type="button" class="button secondary small" title="Повторити зміну Trigger · Ctrl+Y / Ctrl+Shift+Z" disabled>Повторити</button><button id="tr-reset" type="button" class="button secondary small">Скинути Trigger вибраних…</button></div></div>`;

const previewMarkup=`
<div class="tr-preview-choice"><span>Показ на схемі</span><div role="radiogroup" aria-label="Показ значень Trigger"><button type="button" role="radio" data-tr-preview="actuation" aria-checked="true" class="active">Спрацювання</button><button type="button" role="radio" data-tr-preview="rt" aria-checked="false">Quick Trigger</button><button type="button" role="radio" data-tr-preview="deadzone" aria-checked="false">Мертві зони</button></div></div>`;

const LEGENDS={
  actuation:[['actuation','Точка спрацювання, мм']],
  rt:[['press','Натискання, мм'],['release','Відпускання, мм'],['off','— RT вимкнено']],
  deadzone:[['press','Верхня зона, мм'],['release','Нижня зона, мм'],['off','— Мертві зони вимкнено']]
};
const EDITABLE_CODES=new Set(KEYBOARD.map(key=>key.code).filter(code=>code!=='Fn'));

export function triggerBoxSelection(rectangles,start,end,base=[]) {
  const selected=new Set(base.filter(code=>EDITABLE_CODES.has(code)));
  const left=Math.min(start.x,end.x),top=Math.min(start.y,end.y);
  // A horizontal or vertical drag still intersects a row or column of keys.
  const right=Math.max(left+1,start.x,end.x),bottom=Math.max(top+1,start.y,end.y);
  for(const key of rectangles)if(EDITABLE_CODES.has(key.code)&&key.left<right&&key.right>left&&key.top<bottom&&key.bottom>top)selected.add(key.code);
  return [...selected];
}

// Short actuation labels match the reference without rounding away .005-mm steps.
export function triggerKeyPreview(code,trigger,mode='actuation') {
  const label=keycapLabel(code);
  if(code==='Fn')return {label,top:'',bottom:'',enabled:false};
  if(mode==='actuation'){
    const decimals=Math.abs(trigger.actuation*100-Math.round(trigger.actuation*100))<1e-7?2:3;
    return {label,top:trigger.actuation.toFixed(decimals),bottom:'',enabled:true};
  }
  const enabled=mode==='rt'?trigger.rapid:trigger.deadzoneEnabled;
  const top=mode==='rt'?trigger.press:trigger.topDeadzone;
  const bottom=mode==='rt'?trigger.release:trigger.bottomDeadzone;
  return {label,top:enabled?top.toFixed(3):'—',bottom:enabled?bottom.toFixed(3):'—',enabled};
}

// Trigger-only snapshots; restoring them never replaces lighting, bindings or performance.
export function createTriggerHistory(limit=30) {
  if(!Number.isInteger(limit)||limit<1)throw new RangeError('Invalid history limit');
  let id=null,snapshot=null,past=[],future=[],openGroup=null,groupRedo=null;
  const encode=profile=>JSON.stringify(profile.trigger);
  function endGroup(){openGroup=null;groupRedo=null;}
  function synchronize(profile) {
    const next=encode(profile);
    if(profile.id===id&&next===snapshot)return false;
    id=profile.id;snapshot=next;past=[];future=[];endGroup();return true;
  }
  function record(before,after,group=null) {
    if(before.id!==after.id)throw new Error('Trigger history cannot cross profiles');
    synchronize(before);
    const from=encode(before),to=encode(after);
    if(from===to)return false;
    const last=past.at(-1);
    if(group!==null&&openGroup===group&&last?.group===group&&last.after===from){
      last.after=to;
      if(last.before===to){past.pop();future=groupRedo||[];}
    }else{
      groupRedo=group!==null?future:null;future=[];
      past.push({before:from,after:to,group});if(past.length>limit)past.shift();
    }
    snapshot=to;openGroup=group;return true;
  }
  function restore(profile,apply,undo) {
    synchronize(profile);endGroup();
    const source=undo?past:future,target=undo?future:past,entry=source.at(-1);
    if(!entry)return false;
    const value=undo?entry.before:entry.after;
    // Keep both stacks intact if profile validation or the UI mutation fails.
    apply(JSON.parse(value));
    source.pop();target.push(entry);snapshot=value;return true;
  }
  return {
    synchronize,record,endGroup,
    undo:(profile,apply)=>restore(profile,apply,true),
    redo:(profile,apply)=>restore(profile,apply,false),
    get canUndo(){return past.length>0;},get canRedo(){return future.length>0;},
    get undoCount(){return past.length;},get redoCount(){return future.length;}
  };
}

const format=value=>value.toFixed(3);
const BOOLEAN_FIELDS=['rapid','separate','continuous','berserk','deadzoneEnabled'];
const RANGE_KEYS=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','PageUp','PageDown','Home','End'];

export function createTriggerEditor({host,viewHost,legendHost,board,buttons,getProfile,getSelected,setSelected,mutate,notify}) {
  host.innerHTML=template;
  const keyboard=host.closest('#keyboard');
  const preview=viewHost;
  preview.className='tr-preview-toolbar';preview.hidden=true;preview.innerHTML=previewMarkup;
  const legend=legendHost;
  legend.className='tr-board-legend';legend.hidden=true;legend.setAttribute('aria-label','Позначення на клавішах');
  const marquee=document.createElement('div');
  marquee.className='tr-selection-box';marquee.hidden=true;marquee.setAttribute('aria-hidden','true');board.append(marquee);
  const $=id=>host.querySelector('#'+id)||preview.querySelector('#'+id);
  let active=false,mode='actuation',ownMutation=false,rangeGesture=null;
  const history=createTriggerHistory();
  let drag=null,dragFrame=0,suppressDragClick=false;

  function on(node,event,callback) {
    node.addEventListener(event,e=>{
      if(event==='click')e.preventDefault();
      try{callback(e);}catch(error){endRangeGesture();notify(error.message,true);render();}
    });
  }
  function selection(){return triggerSelection(getProfile(),getSelected());}
  function editableCodes(){return [...EDITABLE_CODES];}
  function contextKey(){return getProfile().id+':'+selection().codes.slice().sort().join(',');}
  function editProfile(edit) {ownMutation=true;try{mutate(edit);}finally{ownMutation=false;}}
  function endRangeGesture() {
    rangeGesture=null;history.endGroup();
    document.removeEventListener('pointerup',rangePointerEnd);
    document.removeEventListener('pointercancel',rangePointerEnd);
    window.removeEventListener('blur',endRangeGesture);
  }
  function rangePointerEnd(event) {if(rangeGesture?.kind==='pointer'&&rangeGesture.pointerId===event.pointerId)endRangeGesture();}
  function beginRangeGesture(input,kind,event) {
    if(input.disabled)return;
    if(kind==='keyboard'&&rangeGesture?.node===input&&rangeGesture.kind===kind&&rangeGesture.context===contextKey())return;
    endRangeGesture();
    rangeGesture={node:input,kind,context:contextKey(),pointerId:event.pointerId,token:Symbol('range')};
    document.addEventListener('pointerup',rangePointerEnd);
    document.addEventListener('pointercancel',rangePointerEnd);
    window.addEventListener('blur',endRangeGesture);
  }
  function commit(patch,source=null) {
    if(rangeGesture&&(rangeGesture.node!==source||rangeGesture.context!==contextKey()))endRangeGesture();
    const before=getProfile(),codes=selection().codes,group=rangeGesture?.token??null;
    editProfile(profile=>applyTriggerPatch(profile,codes,patch));
    const changed=history.record(before,getProfile(),group);
    $('tr-edit-status').textContent=changed?`Локально змінено ${codes.length} клавіш. Інші поля та клавіші збережені.`:'Значення не змінились. Історія збережена.';
    render();
  }
  function changeNumber(field,value,source=null) {
    if(value==='')throw new Error('Введи відстань у міліметрах');
    const number=Number(value);
    if(!Number.isFinite(number))throw new Error('Потрібне числове значення');
    commit({[field]:number},source);
  }
  function rememberReset() {
    endRangeGesture();
    const selected=selection();
    if(!selected.count)throw new Error('Спочатку вибери клавіші');
    if(!confirm(`Скинути тільки Trigger для ${selected.count} вибраних клавіш до базових значень локального профілю? Клавіатура не зміниться.`))return;
    const before=getProfile();
    editProfile(profile=>resetTriggerKeys(profile,selected.codes));
    history.record(before,getProfile());
    $('tr-edit-status').textContent='Trigger вибраних клавіш скинуто локально. Решта профілю не змінена.';render();
  }

  for(const [id,label]of SWITCH_TYPES){const option=document.createElement('option');option.value=id;option.textContent=label;$('tr-switch').append(option);}
  on($('tr-switch'),'change',event=>commit({switchType:event.target.value}));
  for(const input of host.querySelectorAll('[data-tr-number]'))on(input,'change',event=>changeNumber(input.dataset.trNumber,event.target.value));
  for(const input of host.querySelectorAll('[data-tr-range]')){
    on(input,'pointerdown',event=>{if(event.button===0&&event.isPrimary!==false)beginRangeGesture(input,'pointer',event);});
    on(input,'keydown',event=>{if(RANGE_KEYS.includes(event.key)&&!event.ctrlKey&&!event.metaKey&&!event.altKey)beginRangeGesture(input,'keyboard',event);});
    on(input,'keyup',event=>{if(RANGE_KEYS.includes(event.key)&&rangeGesture?.node===input)endRangeGesture();});
    on(input,'blur',()=>{if(rangeGesture?.node===input)endRangeGesture();});
    on(input,'change',()=>{if(rangeGesture?.node===input&&rangeGesture.kind!=='keyboard')endRangeGesture();});
    on(input,'input',event=>changeNumber(input.dataset.trRange,event.target.value,input));
  }
  for(const input of host.querySelectorAll('[data-tr-toggle]'))on(input,'change',event=>commit({[input.dataset.trToggle]:event.target.checked}));
  for(const button of host.querySelectorAll('[data-tr-step]'))on(button,'click',()=>{
    const [field,direction]=button.dataset.trStep.split(':'),summary=selection();
    if(!summary.count)throw new Error('Вибери клавіші');
    const value=summary.fields[field].value;
    if(value===null)throw new Error('Значення різні. Спочатку введи спільне значення або вибери одну клавішу.');
    const min=field==='actuation'?actuationBounds(summary).min:TRIGGER_MIN;
    const max=field==='actuation'?actuationBounds(summary).max:TRIGGER_MAX;
    const next=Math.min(max,Math.max(min,Math.round((value+Number(direction)*summary.step)*1000)/1000));
    changeNumber(field,next);
  });
  function restoreHistory(undo) {
    endRangeGesture();
    const changed=history[undo?'undo':'redo'](getProfile(),trigger=>editProfile(profile=>{profile.trigger=trigger;}));
    if(changed)$('tr-edit-status').textContent=undo?'Останню зміну Trigger скасовано локально.':'Зміну Trigger повторено локально.';
    render();
  }
  on($('tr-undo'),'click',()=>restoreHistory(true));
  on($('tr-redo'),'click',()=>restoreHistory(false));
  on(keyboard,'keydown',event=>{
    if(!active||event.altKey||(!event.ctrlKey&&!event.metaKey))return;
    const target=event.target;
    if(target.isContentEditable||target.closest('textarea,select')||(target.tagName==='INPUT'&&target.type!=='range'))return;
    const z=event.code==='KeyZ'||event.key.toLowerCase()==='z',y=event.code==='KeyY'||event.key.toLowerCase()==='y';
    if(!z&&!y)return;
    event.preventDefault();event.stopPropagation();restoreHistory(z&&!event.shiftKey);
  });
  on($('tr-reset'),'click',rememberReset);

  function boardPoint(event) {
    const rect=board.getBoundingClientRect();
    return {
      x:Math.max(0,Math.min(board.clientWidth,event.clientX-rect.left-board.clientLeft)),
      y:Math.max(0,Math.min(board.clientHeight,event.clientY-rect.top-board.clientTop))
    };
  }
  function selectCodes(codes) {if(codes.join('|')!==getSelected().join('|'))setSelected(codes);}
  function updateDrag() {
    if(!drag?.started)return;
    const {start,point,rectangles,base,additive}=drag;
    marquee.style.left=Math.min(start.x,point.x)+'px';marquee.style.top=Math.min(start.y,point.y)+'px';
    marquee.style.width=Math.max(1,Math.abs(point.x-start.x))+'px';marquee.style.height=Math.max(1,Math.abs(point.y-start.y))+'px';
    selectCodes(triggerBoxSelection(rectangles,start,point,additive?base:[]));
  }
  function finishDrag(cancel=false) {
    if(!drag)return;
    const previous=drag;
    cancelAnimationFrame(dragFrame);dragFrame=0;
    if(previous.started&&!cancel)updateDrag();
    drag=null;marquee.hidden=true;board.classList.remove('tr-dragging');
    document.removeEventListener('pointermove',moveDrag);
    document.removeEventListener('pointerup',endDrag);
    document.removeEventListener('pointercancel',cancelDrag);
    document.removeEventListener('keydown',dragKey,true);
    window.removeEventListener('blur',cancelDrag);
    if(board.hasPointerCapture(previous.pointerId))board.releasePointerCapture(previous.pointerId);
    if(previous.started){suppressDragClick=true;if(cancel)selectCodes(previous.base);}
  }
  function cancelDrag(event) {if(!event||event.pointerId===undefined||event.pointerId===drag?.pointerId)finishDrag(true);}
  function dragKey(event) {if(event.key==='Escape'){event.preventDefault();event.stopPropagation();finishDrag(true);}}
  function moveDrag(event) {
    if(!drag||event.pointerId!==drag.pointerId)return;
    if(!drag.started){
      if(Math.hypot(event.clientX-drag.clientX,event.clientY-drag.clientY)<5)return;
      drag.started=true;marquee.hidden=false;board.classList.add('tr-dragging');
      // Synthetic browser tests have no native pointer to capture.
      if(event.isTrusted)board.setPointerCapture(event.pointerId);
    }
    event.preventDefault();drag.point=boardPoint(event);
    if(!dragFrame)dragFrame=requestAnimationFrame(()=>{dragFrame=0;updateDrag();});
  }
  function endDrag(event) {if(event.pointerId===drag?.pointerId){drag.point=boardPoint(event);finishDrag();}}
  board.addEventListener('pointerdown',event=>{
    suppressDragClick=false;
    if(!active||event.button!==0||event.isPrimary===false||event.pointerType==='touch'||event.target.closest('[data-trigger-protected]'))return;
    const rect=board.getBoundingClientRect(),origin={x:rect.left+board.clientLeft,y:rect.top+board.clientTop};
    drag={pointerId:event.pointerId,clientX:event.clientX,clientY:event.clientY,start:boardPoint(event),point:boardPoint(event),
      base:getSelected().filter(code=>EDITABLE_CODES.has(code)),additive:event.ctrlKey||event.metaKey||event.shiftKey,started:false,
      rectangles:editableCodes().map(code=>{const key=buttons.get(code).getBoundingClientRect();return {code,left:key.left-origin.x,right:key.right-origin.x,top:key.top-origin.y,bottom:key.bottom-origin.y};})};
    document.addEventListener('pointermove',moveDrag,{passive:false});
    document.addEventListener('pointerup',endDrag);
    document.addEventListener('pointercancel',cancelDrag);
    document.addEventListener('keydown',dragKey,true);
    window.addEventListener('blur',cancelDrag);
  });
  board.addEventListener('click',event=>{if(suppressDragClick){suppressDragClick=false;event.preventDefault();event.stopImmediatePropagation();}},true);

  const previewButtons=[...preview.querySelectorAll('[data-tr-preview]')];
  function chooseMode(value,focus=false) {
    mode=value;
    for(const button of previewButtons){const checked=button.dataset.trPreview===value;button.classList.toggle('active',checked);button.setAttribute('aria-checked',String(checked));button.tabIndex=checked?0:-1;if(checked&&focus)button.focus({preventScroll:true});}
    render();
  }
  for(const button of previewButtons){
    on(button,'click',()=>chooseMode(button.dataset.trPreview));
    on(button,'keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();const index=previewButtons.indexOf(button),next=event.key==='Home'?0:event.key==='End'?previewButtons.length-1:(index+(event.key==='ArrowRight'?1:-1)+previewButtons.length)%previewButtons.length;
      chooseMode(previewButtons[next].dataset.trPreview,true);
    });
  }
  for(const [code,button]of buttons){
    const top=document.createElement('span'),bottom=document.createElement('span');
    top.className='tr-key-top';bottom.className='tr-key-bottom';button.append(top,bottom);
    if(code==='Fn')button.dataset.triggerProtected='true';
  }

  function actuationBounds(summary) {
    const states=summary.codes.map(code=>triggerFor(getProfile(),code));
    return {
      min:Math.max(TRIGGER_MIN,...states.map(t=>t.deadzoneEnabled?t.topDeadzone:TRIGGER_MIN)),
      max:Math.min(TRIGGER_MAX,...states.map(t=>t.deadzoneEnabled?TRIGGER_MAX-t.bottomDeadzone:TRIGGER_MAX))
    };
  }
  function overlay() {
    board.classList.toggle('trigger-preview',active);
    if(!active)return;
    board.dataset.triggerView=mode;
    legend.replaceChildren();
    for(const [kind,text]of LEGENDS[mode]){
      const item=document.createElement('span');item.className='tr-legend-'+kind;item.textContent=text;legend.append(item);
    }
    for(const key of KEYBOARD){
      const button=buttons.get(key.code),top=button.querySelector('.tr-key-top'),bottom=button.querySelector('.tr-key-bottom');
      const t=key.code==='Fn'?null:triggerFor(getProfile(),key.code),view=triggerKeyPreview(key.code,t,mode);
      button.querySelector('.kb-key-label').textContent=view.label;
      button.querySelector('.kb-key-subtitle').textContent='';
      top.textContent=view.top;bottom.textContent=view.bottom;button.dataset.triggerEnabled=String(view.enabled);
      if(key.code==='Fn'){button.title='Fn — захищена, редагування Trigger недоступне';button.setAttribute('aria-label',button.title);continue;}
      const switchName=SWITCH_TYPES.find(s=>s[0]===t.switchType)?.[1]||t.switchType;
      button.title=`${labelFor(key.code)} · локальна чернетка\nSwitch: ${switchName}\nActuation: ${format(t.actuation)} мм\nQuick Trigger: ${t.rapid?'ON':'OFF'}\nPress / Reset: ${format(t.press)} / ${format(t.release)} мм\nTop / Bottom Deadzone: ${format(t.topDeadzone)} / ${format(t.bottomDeadzone)} мм (${t.deadzoneEnabled?'ON':'OFF'})\nBerserk: ${t.berserk?'0,005':'0,010'} мм\nRapid trigger: ${t.continuous?'ON':'OFF'}`;
      button.setAttribute('aria-label',button.title.replaceAll('\n',', '));
    }
  }
  function render() {
    const profile=getProfile();
    if(rangeGesture&&rangeGesture.context!==contextKey())endRangeGesture();
    if(!ownMutation&&history.synchronize(profile))endRangeGesture();
    const summary=selection(),empty=!summary.count,bounds=actuationBounds(summary),f=summary.fields;
    $('tr-selection-title').textContent=empty?'Вибери клавіші на схемі':`Вибрано клавіш: ${summary.count}`;
    const selectedNames=summary.codes.map(labelFor);
    $('tr-selection-description').textContent=empty?'WASD, Усі або Ctrl / Shift + клік для групового вибору.':selectedNames.slice(0,8).join(' · ')+(summary.count>8?` · … ще ${summary.count-8}`:'');
    $('tr-selection-description').title=selectedNames.join(' · ');
    $('tr-empty-hint').hidden=!empty;
    $('tr-precision').textContent=f.berserk.mixed?'Різна точність: 0,005 / 0,010 мм':`Крок ${summary.step.toFixed(3).replace('.',',')} мм`;
    $('tr-switch').disabled=empty;$('tr-switch').value=f.switchType.value||'';
    $('tr-switch').classList.toggle('tr-mixed',f.switchType.mixed);
    for(const input of host.querySelectorAll('[data-tr-number],[data-tr-range]')){
      const field=input.dataset.trNumber||input.dataset.trRange,entry=f[field];
      const isDeadzone=field.endsWith('Deadzone');
      const disabled=empty||(isDeadzone&&f.deadzoneEnabled.value===false)||(['press','release'].includes(field)&&f.rapid.value===false)||(field==='release'&&f.separate.value===false);
      input.disabled=disabled;input.step=String(summary.step);
      input.min=String(field==='actuation'?bounds.min:isDeadzone?0:TRIGGER_MIN);
      input.max=String(field==='actuation'?bounds.max:isDeadzone?1:TRIGGER_MAX);
      input.classList.toggle('tr-mixed',entry.mixed);
      if(input.type==='number'){input.value=entry.value===null?'':format(entry.value);input.placeholder=entry.mixed?'Різне':'—';}
      else{input.value=String(entry.value??TRIGGER_DEFAULTS[field]);input.setAttribute('aria-valuetext',entry.mixed?'Різні значення вибраних клавіш':entry.value===null?'Немає вибраних клавіш':`${format(entry.value)} мм`);}
      input.title=entry.mixed?'Вибрані клавіші мають різні значення. Зміна застосує лише цей параметр.':'';
    }
    for(const field of BOOLEAN_FIELDS){const input=host.querySelector(`[data-tr-toggle="${field}"]`);input.disabled=empty||(['separate','continuous'].includes(field)&&f.rapid.value===false);input.checked=f[field].value===true;input.indeterminate=f[field].mixed;(input.closest('label')||input.closest('.tr-card-heading')).classList.toggle('tr-is-mixed',f[field].mixed);}
    $('tr-linked-note').hidden=empty||f.separate.value!==false;
    $('tr-actuation-bounds').textContent=`Діапазон для вибору: ${format(bounds.min)}–${format(bounds.max)} мм. Мертві зони враховано.`;
    const position=f.actuation.value===null?50:(f.actuation.value-TRIGGER_MIN)/(TRIGGER_MAX-TRIGGER_MIN)*100;
    host.style.setProperty('--tr-actuation-position',position+'%');
    $('tr-undo').disabled=!history.canUndo;$('tr-redo').disabled=!history.canRedo;$('tr-reset').disabled=empty;
    for(const button of host.querySelectorAll('[data-tr-step]'))button.disabled=empty||f.actuation.mixed;
    overlay();
  }
  return {
    render,
    dispose(){finishDrag(true);endRangeGesture();},
    setActive(value){if(!value){finishDrag(true);endRangeGesture();}active=value;preview.hidden=!value;legend.hidden=!value;keyboard.classList.toggle('trigger-active',value);board.classList.toggle('trigger-preview',value);if(!value)for(const key of KEYBOARD)buttons.get(key.code).setAttribute('aria-label',key.label);}
  };
}
