import {KEYBOARD,KEY_CODES,OUTPUT_CODES,LABELS,LAYERS,RULE_TYPES,EFFECTS,labelFor,keycapLabel,keyboardNeighbor,binding,bindingFor,bindingLabel,bindingSignature,bindingSelection,applyBinding,resetBindingKeys,triggerSelection,createProfile,normalizeProfile,normalizeCollection,cloneProfile,exportProfile,importProfile,newRule,hsvToHex,hexToHsv,hex} from './keyboard-model.mjs';
import {createTriggerEditor} from './keyboard-trigger.mjs';
import {profileFromSnapshot,compareSnapshot,draftPlanOperations} from './keyboard-workflow.mjs';

const STORAGE='input-studio.keyboard-drafts.v1';
const RULE_NAMES={RS:['Rapid Trigger / RS','Пріоритет глибшого натискання двох клавіш. Без аналогових даних доступний лише опис правила.'],SOCD:['Snap Tap / SOCD','Чернетка обробки одночасно натиснутих протилежних клавіш.'],DKS:['Dynamic Keystroke','Чотири дії на різній глибині натискання однієї клавіші.'],MT:['Hold / Tap','Окремі дії для короткого натискання та утримання.'],TGL:['Toggle','Опис перемикання утримуваного стану однієї клавіші.']};
const template=`
<div class="kb-topbar"><div class="kb-draft-label"><span class="kb-local-dot"></span> Редактор локального профілю</div><div class="toolbar-actions"><span id="keyboard-mode" class="mode-badge">Лише читання</span><button id="read-keyboard" class="button secondary">Зчитати пристрій</button></div></div>
<div class="kb-workspace">
  <aside class="kb-profiles" aria-label="Профілі клавіатури">
    <div class="kb-model-name"><svg class="icon"><use href="#i-keyboard"/></svg><div><strong>Jet75-II</strong><small>MCHOSE · Wired</small></div></div>
    <button id="kb-profile-create" class="button secondary">＋ Створити профіль</button>
    <div class="kb-profile-io"><button id="kb-profile-import" class="button ghost">Імпорт</button><button id="kb-profile-export" class="button ghost">Експорт</button></div>
    <input id="kb-import-file" type="file" accept="application/json,.json" hidden>
    <div class="kb-section-title">На пристрої <span class="kb-read-tag">лише читання</span></div>
    <div class="kb-onboard"><svg class="icon"><use href="#i-lock"/></svg><div><strong id="keyboard-profile-current">Ще не зчитано</strong><small>Назви та перемикання слотів не підтримуються</small></div></div>
    <div class="kb-section-title">На комп’ютері <span id="kb-profile-count"></span></div>
    <div id="kb-profile-list" class="kb-profile-list"></div>
    <div class="kb-profile-tools"><button id="kb-profile-rename" class="text-button">Перейменувати</button><button id="kb-profile-clone" class="text-button">Копія</button><button id="kb-profile-delete" class="text-button">Видалити</button></div>
    <div class="kb-storage-note">Ці профілі зберігаються в браузері. Експортуй JSON, щоб мати окрему копію.</div>
  </aside>
  <div class="kb-main">
    <div class="kb-tabs" role="tablist" aria-label="Редактор Jet75-II">
      <button id="kb-tab-lighting" role="tab" data-kb-tab="lighting" aria-controls="kb-panel-lighting" aria-selected="true" class="active">◌ Підсвітка</button>
      <button id="kb-tab-trigger" role="tab" data-kb-tab="trigger" aria-controls="kb-panel-trigger" aria-selected="false" tabindex="-1">ϟ Trigger</button>
      <button id="kb-tab-keyconfig" role="tab" data-kb-tab="keyconfig" aria-controls="kb-panel-keyconfig" aria-selected="false" tabindex="-1">⌨ Key Config</button>
      <button id="kb-tab-advanced" role="tab" data-kb-tab="advanced" aria-controls="kb-panel-advanced" aria-selected="false" tabindex="-1">◇ Advanced Keys</button>
      <button id="kb-tab-performance" role="tab" data-kb-tab="performance" aria-controls="kb-panel-performance" aria-selected="false" tabindex="-1">☷ Performance</button>
      <button id="kb-tab-others" role="tab" data-kb-tab="others" aria-controls="kb-panel-others" aria-selected="false" tabindex="-1">⚙ Інше</button>
    </div>
    <div class="kb-board-toolbar">
      <div class="kb-board-view">
        <div id="kb-layer-controls" class="kb-layers" role="group" aria-label="Шар локального профілю"><span>Шар профілю</span><div class="kb-layer-options"><button data-kb-layer="win" class="active">Win Default</button><button data-kb-layer="winFn">Win Fn</button><button data-kb-layer="mac">Mac Default</button><button data-kb-layer="macFn">Mac Fn</button></div></div>
        <div id="kb-trigger-view" hidden></div>
      </div>
      <div class="kb-selection-tools" role="group" aria-label="Вибір клавіш"><button id="kb-select-wasd" type="button">WASD</button><button id="kb-select-all" type="button">Усі</button><button id="kb-select-invert" type="button">Інвертувати</button><button id="kb-select-none" type="button">Зняти вибір</button></div>
      <p id="kb-board-help" class="kb-board-help">Клік або стрілки — вибір · Ctrl / Shift — група · Рамка — у Trigger</p>
      <span id="kb-board-shortcuts" class="sr-only">Коли фокус на клавіші схеми: стрілки вибирають сусідню клавішу, Shift зі стрілкою додає до групи, Home та End переходять до країв ряду, Ctrl з Home або End — до країв клавіатури. Ctrl+A вибирає всі доступні клавіші, Escape очищує вибір. Fn захищена.</span>
    </div>
    <div class="kb-scene"><div class="kb-board-area"><div class="kb-board" id="kb-board" role="group" aria-describedby="kb-board-help kb-board-shortcuts" aria-label="Логічна схема Jet75-II; карту пристрою ще не зчитано"><div id="kb-keyfield" class="kb-keyfield"></div></div></div></div>
    <div class="kb-scene-footer"><span id="kb-selection-label">Обери клавіші на схемі</span><div class="kb-legend-slot"><span id="kb-board-caption">Jet75-II · Локальна чернетка</span><div id="kb-trigger-legend" hidden></div></div></div>
    <div class="kb-draft-banner"><svg class="icon"><use href="#i-info"/></svg><span>Схема показує локальну чернетку. Прочитані налаштування — окремо у вкладці «Інше»; вони не замінюють профіль і не передаються на пристрій.</span></div>

    <div id="kb-panel-stack" class="kb-panel-stack">
    <section id="kb-panel-lighting" role="tabpanel" aria-labelledby="kb-tab-lighting" data-kb-panel="lighting">
      <div class="kb-lighting-grid">
        <article class="kb-panel"><label class="kb-panel-head" for="kb-light-enabled"><h3>Світлові ефекти</h3><input id="kb-light-enabled" type="checkbox" role="switch"></label><p class="help">Програмний перегляд підсвітки схеми.</p><div id="kb-effects" class="kb-effects"></div></article>
        <article class="kb-panel"><h3>Швидкість і яскравість</h3><label for="kb-light-brightness">Яскравість <output id="kb-brightness-value">80%</output></label><input id="kb-light-brightness" type="range" min="0" max="100" step="1"><label for="kb-light-speed">Швидкість <output id="kb-speed-value">3 / 5</output></label><input id="kb-light-speed" type="range" min="1" max="5" step="1"><p class="help">Анімація є ілюстрацією ефекту, а не точною симуляцією прошивки.</p></article>
        <article class="kb-panel"><h3>Палітра кольорів</h3><div id="kb-color-wheel" class="kb-color-wheel" aria-label="Колірне коло: використай мишу або HEX-поле"><i id="kb-wheel-marker"></i></div><label class="kb-hex-row" for="kb-color-hex"><span>HEX</span><input id="kb-color-hex" maxlength="7" spellcheck="false" value="#b6a3ed"><input id="kb-color-native" type="color" aria-label="Системний вибір кольору"></label><div id="kb-swatches" class="kb-swatches"></div><button id="kb-paint-keys" class="button secondary">Колір вибраним клавішам</button><button id="kb-clear-colors" class="text-button">Очистити індивідуальні кольори</button></article>
      </div>
    </section>

    <section id="kb-panel-trigger" role="tabpanel" aria-labelledby="kb-tab-trigger" data-kb-panel="trigger" hidden>
      <div id="kb-trigger-editor"></div>
      <article class="kb-panel"><h3>План для пристрою · без застосування</h3><p class="help">Лише спрацювання та Quick Trigger вибраних клавіш із цієї чернетки. Тип перемикача, мертві зони, Berserk та інші параметри не входять до плану. Потрібен зчитаний пристрій; для групи ці значення мають бути однаковими.</p><button id="kb-trigger-preview" type="button" class="button secondary" disabled>Перевірити план вибраних</button><pre id="kb-trigger-plan" class="kb-readout" role="status" hidden></pre></article>
    </section>

    <section id="kb-panel-keyconfig" role="tabpanel" aria-labelledby="kb-tab-keyconfig" data-kb-panel="keyconfig" hidden>
      <article class="kb-panel kb-binding-panel">
        <div class="kb-binding-heading"><h3>Призначення клавіш</h3><span id="kb-binding-layer" class="kb-layer-tag">Win Default</span></div>
        <div class="kb-binding-selection"><strong id="kb-binding-summary">Вибери клавіші на схемі</strong><span id="kb-binding-count">Немає вибраних клавіш</span></div>
        <p class="help">Клік по команді призначає її всім вибраним клавішам лише в поточному шарі. Перетягування змінює тільки цільову клавішу, не всю групу.</p>
        <div class="kb-command-top"><div id="kb-command-categories" class="kb-command-categories"></div><input id="kb-command-search" type="search" placeholder="Пошук команди…" aria-label="Пошук команди"></div>
        <div id="kb-commands" class="kb-commands" role="group" aria-label="Команди для призначення"></div><p id="kb-commands-empty" class="help" hidden>Команд не знайдено. Зміни пошуковий запит.</p>
        <div id="kb-shortcut-area" hidden><div id="kb-shortcut-capture" class="kb-key-test" tabindex="0" role="group" aria-label="Захоплення комбінації тільки в цій області">Клацни тут і натисни комбінацію</div><button id="kb-shortcut-assign" class="button secondary" disabled>Призначити комбінацію вибраним</button></div>
        <details id="kb-binding-details" class="kb-binding-details" open hidden><summary>Дії вибраних клавіш</summary><div id="kb-binding-list" role="list" aria-label="Поточні призначення вибраних клавіш"></div></details>
        <div class="kb-binding-footer"><span id="kb-binding-status" role="status">Зміни зберігаються лише в локальному профілі.</span><button id="kb-binding-reset" class="button secondary small" disabled>Скинути призначення вибраних…</button></div>
      </article>
    </section>

    <section id="kb-panel-advanced" role="tabpanel" aria-labelledby="kb-tab-advanced" data-kb-panel="advanced" hidden>
      <div class="kb-advanced-grid"><article class="kb-panel"><h3>Advanced Keys</h3><p class="help">Конструктор локальних правил. Не виконує їх у Windows.</p><div id="kb-rule-types" class="kb-rule-types"></div></article><article class="kb-panel"><div class="kb-panel-head"><h3>Поточні правила</h3><span id="kb-rule-count">0 / 40</span></div><div id="kb-rule-list" class="kb-rule-list"></div><form id="kb-rule-form"><p id="kb-rule-description" class="help"></p><label for="kb-rule-mode">Пріоритет<select id="kb-rule-mode"><option value="depth">Глибше натискання (RS)</option><option value="last">Остання натиснута</option><option value="neutral">Нейтральний результат</option><option value="priority">Перша в парі</option></select></label><label for="kb-rule-delay">Поріг утримання, мс<input id="kb-rule-delay" type="number" min="50" max="2000" value="200"></label><div id="kb-rule-actions" class="kb-rule-actions"></div><p class="help" id="kb-rule-selection">Обери цільові клавіші на схемі.</p><button class="button secondary">Додати правило до чернетки</button></form></article><article class="kb-panel"><h3>Тест натискань</h3><p class="help">Лише події браузера в цій області. Аналогова глибина та реальна дія правила не вимірюються.</p><div id="kb-key-test" class="kb-key-test" tabindex="0" role="group" aria-label="Тест клавіш тільки в цій області">Клацни тут для тесту</div><div id="kb-test-pressed" class="kb-test-result">Натиснуто: —</div><div id="kb-test-released" class="kb-test-result">Відпущено: —</div></article></div>
    </section>

    <section id="kb-panel-performance" role="tabpanel" aria-labelledby="kb-tab-performance" data-kb-panel="performance" hidden>
      <div class="kb-performance-grid"><article class="kb-panel"><h3>Продуктивність і відгук</h3><p class="help">Бажана частота в локальній чернетці. Фактичне значення пристрою не визначається за цими кнопками.</p><div class="kb-polling"><button data-kb-hz="1000">1k</button><button data-kb-hz="2000">2k</button><button data-kb-hz="4000">4k</button><button data-kb-hz="8000">8k</button></div><div class="kb-device-value" id="kb-actual-polling">Пристрій: ще не зчитано</div></article><article class="kb-panel"><h3>Стабільність і калібрування</h3><label class="switch-row" for="kb-stability"><span><strong>Stability / Anti-Mistouch</strong><small>Бажане значення чернетки</small></span><input id="kb-stability" type="checkbox" role="switch"></label><label class="switch-row" for="kb-debounce"><span><strong>Debounce optimization</strong><small>Бажане значення чернетки</small></span><input id="kb-debounce" type="checkbox" role="switch"></label><label class="switch-row" for="kb-calibration"><span><strong>Adaptive calibration</strong><small>Лише прапорець профілю; не запускає калібрування</small></span><input id="kb-calibration" type="checkbox" role="switch"></label></article><article class="kb-panel"><h3>Система та клавіші</h3><label class="switch-row" for="kb-win-lock"><span><strong>Windows Key Lock</strong><small>Бажане блокування Win у профілі</small></span><input id="kb-win-lock" type="checkbox" role="switch"></label><label class="switch-row" for="kb-mac-mode"><span><strong>Mac Mode</strong><small>Параметр чернетки, не перемикання ОС пристрою</small></span><input id="kb-mac-mode" type="checkbox" role="switch"></label></article></div>
    </section>

    <section id="kb-panel-others" role="tabpanel" aria-labelledby="kb-tab-others" data-kb-panel="others" hidden>
      <div class="kb-others-grid"><article class="kb-panel"><h3>Версія прошивки</h3><strong id="keyboard-firmware-current" class="kb-firmware">Не зчитано</strong><p class="help">Показується зі службової відповіді клавіатури. Наявність нових версій не перевіряється.</p><button class="button secondary" disabled>Оновлення прошивки не підтримується</button></article><article class="kb-panel"><h3>Скидання</h3><p class="help">Можна скинути тільки поточну локальну чернетку. Заводське скидання клавіатури заблоковане.</p><button id="kb-reset-draft" class="button secondary">Скинути локальну чернетку…</button></article><article class="kb-panel"><h3>Прочитані дані пристрою</h3><p id="kb-device-warning" class="help">Зчитай пристрій для поточної інформації. Редактор не виконує автоматичних HID-запитів.</p><pre id="keyboard-summary" class="kb-readout">Дані ще не зчитані.</pre><button data-lock="keyboard" class="button secondary">Залишити API лише для читання</button></article></div>
      <article id="kb-device-values" class="kb-panel kb-device-values" hidden><h3>Знімок налаштувань клавіш · лише читання</h3><p class="help">Останнє ручне зчитування активного апаратного профілю, не локальна чернетка. «—» означає невідоме значення, а не нуль. Спеціальні призначення показано без припущень про їхню дію.</p><div class="kb-device-table-wrap" tabindex="0" role="region" aria-label="Прочитані налаштування всіх 80 клавіш"><table class="kb-device-table"><caption id="kb-device-map-status"></caption><thead><tr><th scope="col">Запис</th><th scope="col">Клавіша</th><th scope="col">Призначення</th><th scope="col">Спрацювання, мм</th><th scope="col">RT</th><th scope="col">Press, мм</th><th scope="col">Release, мм</th></tr></thead><tbody id="kb-device-keys"></tbody></table></div></article>
      <article id="kb-snapshot-tools" class="kb-panel" hidden>
        <h3>Робота зі знімком пристрою</h3>
        <p class="help">Знімок призначень містить лише Win Default. Створи окрему локальну чернетку, порівняй її з пристроєм або розрахуй план адрес і байтів. Спеціальні дії, підсвітка й продуктивність не переносяться. Запис на пристрій залишається заблокованим.</p>
        <div class="button-row">
          <button id="kb-snapshot-create" class="button secondary">Створити профіль зі знімка…</button>
          <button id="kb-snapshot-compare" class="button secondary">Порівняти вибране</button>
        </div>
        <div class="kb-snapshot-plan-options">
          <label><input id="kb-snapshot-plan-trigger" type="checkbox" checked> Спрацювання та RT</label>
          <label><input id="kb-snapshot-plan-keymap" type="checkbox"> Призначення клавіш</label>
          <button id="kb-snapshot-plan-button" class="button secondary">План вибраних для пристрою</button>
        </div>
        <p id="kb-snapshot-status" class="help" role="status">Зчитай пристрій, щоб працювати зі знімком.</p>
        <div id="kb-snapshot-compare-result" class="kb-snapshot-result" hidden></div>
        <pre id="kb-snapshot-plan-output" class="kb-readout" role="status" hidden></pre>
      </article>
    </section>
    </div>
    <div class="kb-savebar"><div><strong id="kb-active-profile">Default</strong><span id="kb-save-status">Локальна чернетка</span></div><div><button id="kb-profile-save" class="button secondary">Зберегти локально</button><button id="kb-hardware-apply" class="button" disabled title="Апаратний запис і адресація банків ще не перевірені; зіставлення заводської карти не дозволяє запис">На клавіатуру — недоступно</button></div></div>
  </div>
</div>`;

function element(tag,cls,text) {const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}

export function createKeyboardEditor(root,{notify=()=>{},storage,confirmAction=message=>globalThis.confirm(message)}={}) {
  root.innerHTML=template; // Trusted static markup; user strings are always assigned through textContent.
  const $=id=>root.querySelector('#'+id),selected=new Set(),boardButtons=new Map(),deviceKeys=new Map();
  let collection,stored=null,layer='win',tab='lighting',category='basic',ruleKind='RS',shortcut=null,pressed=new Set(),timer;
  let triggerEditor=null,deviceSnapshot=null;
  let focusedCode='Escape';
  let bindingContext=null;
  let previewVersion=0,previewBusy=false;
  let panelAnimation=null,panelWidth=0;
  const panelStack=$('kb-panel-stack'),reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const panelObserver=new ResizeObserver(([entry])=>{
    if(entry.contentRect.width>0&&Math.abs(entry.contentRect.width-panelWidth)>1){panelWidth=entry.contentRect.width;panelStack.style.minBlockSize='';}
  });panelObserver.observe(panelStack);
  try {storage??=globalThis.localStorage;stored=storage.getItem(STORAGE);if(stored)collection=normalizeCollection(JSON.parse(stored));}
  catch(error){notify('Локальні профілі не завантажені. Старий запис не перезаписується: '+error.message,true);}
  let preserveInvalidStorage=!collection&&!!stored;
  if(!collection){const p=createProfile();collection={version:1,active:p.id,profiles:[p]};}
  const current=()=>collection.profiles.find(p=>p.id===collection.active);
  function report(error) {notify(error.message||String(error),true);}
  function save(explicit=false) {
    clearTimeout(timer);
    try {
      if(preserveInvalidStorage&&!explicit){$('kb-save-status').textContent='Збереження призупинено: старі дані не перезаписані';return;}
      if(preserveInvalidStorage&&explicit&&!confirmAction('Старі локальні дані не прочитані. Заміна видалить їхній запис у браузері. Спочатку можна експортувати нову чернетку. Замінити?'))return;
      storage.setItem(STORAGE,JSON.stringify(normalizeCollection(collection)));preserveInvalidStorage=false;
      $('kb-save-status').textContent='Збережено лише на цьому комп’ютері';
    }catch(error){$('kb-save-status').textContent='Не збережено — експортуй JSON';report(error);}
  }
  function mutate(edit) {
    const value=JSON.parse(JSON.stringify(current()));if(edit(value)===false)return false;const checked=normalizeProfile(value);
    collection.profiles[collection.profiles.findIndex(p=>p.id===collection.active)]=checked;
    $('kb-save-status').textContent='Незбережена локальна зміна';clearTimeout(timer);timer=setTimeout(()=>save(),350);render();
    return true;
  }
  function on(node,event,fn) {node.addEventListener(event,e=>{if(event==='click'||event==='submit')e.preventDefault();try{Promise.resolve(fn(e)).catch(report);}catch(error){report(error);}});}
  function renderProfiles() {
    $('kb-profile-list').replaceChildren();
    for(const profile of collection.profiles){const button=element('button','kb-profile-item'+(profile.id===collection.active?' active':''));button.type='button';button.append(element('span','kb-profile-symbol','◇'),element('span','',profile.name));button.setAttribute('aria-pressed',String(profile.id===collection.active));on(button,'click',()=>{save();collection.active=profile.id;selected.clear();render();save();});$('kb-profile-list').append(button);}
    $('kb-profile-count').textContent=String(collection.profiles.length);
    $('kb-active-profile').textContent=current().name;
  }
  function setSelection(codes) {selected.clear();for(const code of codes)if(KEY_CODES.has(code)&&code!=='Fn')selected.add(code);render();}
  function focusKey(code,moveFocus=false) {
    const button=boardButtons.get(code);if(!button||button.disabled)return;
    boardButtons.get(focusedCode).tabIndex=-1;button.tabIndex=0;focusedCode=code;
    if(!moveFocus)return;
    button.focus({preventScroll:true});
    const area=button.closest('.kb-board-area'),keyRect=button.getBoundingClientRect(),areaRect=area.getBoundingClientRect();
    // Reveal clipped keys horizontally without scrolling the page or moving the keyboard stage.
    if(keyRect.left<areaRect.left+8)area.scrollLeft-=areaRect.left+8-keyRect.left;
    else if(keyRect.right>areaRect.right-8)area.scrollLeft+=keyRect.right-areaRect.right+8;
  }
  function selectKey(code,multiple=false) {if(!KEY_CODES.has(code)||code==='Fn')return;focusKey(code);if(!multiple)selected.clear();if(multiple&&selected.has(code))selected.delete(code);else selected.add(code);render();}
  for(const key of KEYBOARD){
    const button=element('button','kb-key');button.type='button';button.dataset.key=key.code;button.setAttribute('aria-label',key.label);button.title=key.code+' · логічна клавіша';
    button.tabIndex=key.code==='Escape'?0:-1;button.disabled=key.code==='Fn';
    // Center each key in its physical slot: the same pixel gap on both axes and both edges.
    button.style.left=`calc(${key.x/16*100}% + var(--kb-key-gap) / 2)`;
    button.style.top=`calc(${key.y/6.25*100}% + var(--kb-key-gap) / 2)`;
    button.style.width=`calc(${key.w/16*100}% - var(--kb-key-gap))`;
    button.style.height=`calc(${key.h/6.25*100}% - var(--kb-key-gap))`;
    button.style.setProperty('--key-delay',(key.x*.09+key.y*.05)+'s');
    button.append(element('span','kb-key-label',key.label),element('small','kb-key-subtitle',''));
    on(button,'click',e=>selectKey(key.code,e.ctrlKey||e.metaKey||e.shiftKey));
    button.addEventListener('dragover',e=>{if(tab==='keyconfig'&&key.code!=='Fn'&&e.dataTransfer.types.includes('application/x-inputstudio-binding')){e.preventDefault();button.classList.add('drop-target');}});
    button.addEventListener('dragleave',()=>button.classList.remove('drop-target'));
    on(button,'drop',e=>{button.classList.remove('drop-target');if(tab!=='keyconfig'||!e.dataTransfer.types.includes('application/x-inputstudio-binding'))return;e.preventDefault();const payload=e.dataTransfer.getData('application/x-inputstudio-binding');if(payload.length>2048)throw new Error('Завелика команда');assign(binding(JSON.parse(payload)),[key.code],true);});
    boardButtons.set(key.code,button);$('kb-keyfield').append(button);
  }
  $('kb-board').addEventListener('focusin',event=>{const code=event.target.closest('.kb-key')?.dataset.key;if(code)focusKey(code);});
  $('kb-board').addEventListener('keydown',event=>{
    const code=event.target.closest('.kb-key')?.dataset.key;
    if(!code||code==='Fn'||event.altKey)return;
    if((event.ctrlKey||event.metaKey)&&(event.key.toLowerCase()==='a'||event.code==='KeyA')){
      event.preventDefault();event.stopPropagation();setSelection(KEYBOARD.map(key=>key.code));return;
    }
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setSelection([]);return;}
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
    event.preventDefault();event.stopPropagation();
    const next=keyboardNeighbor(code,event.key,{wholeBoard:event.ctrlKey||event.metaKey});
    if(next===code)return;
    focusKey(next,true);
    if(event.shiftKey)setSelection([...selected,code,next]);else selectKey(next);
  });
  triggerEditor=createTriggerEditor({
    host:$('kb-trigger-editor'),viewHost:$('kb-trigger-view'),legendHost:$('kb-trigger-legend'),board:$('kb-board'),buttons:boardButtons,
    getProfile:current,getSelected:()=>[...selected],
    setSelected:setSelection,
    mutate,notify
  });
  function renderBoard() {
    previewVersion++;$('kb-trigger-plan').hidden=true;refreshTriggerPreview();
    $('kb-snapshot-compare-result').hidden=true;$('kb-snapshot-compare-result').replaceChildren();$('kb-snapshot-plan-output').hidden=true;
    if(deviceSnapshot)setSnapshotStatus('Результати анульовано. Порівняй або розрахуй план заново за останнім знімком.');
    $('kb-snapshot-compare').textContent=selected.size?'Порівняти вибране':'Порівняти всі';
    const p=current();$('kb-board').dataset.effect=p.lighting.enabled?p.lighting.effect:'off';$('kb-board').style.setProperty('--kb-duration',(8-p.lighting.speed*1.15)+'s');
    for(const key of KEYBOARD){const button=boardButtons.get(key.code),mapped=p.bindings[layer][key.code];
      button.classList.toggle('selected',selected.has(key.code));button.setAttribute('aria-pressed',String(selected.has(key.code)));
      let color=p.lighting.perKey[key.code]||p.lighting.color;
      if(['rainbow','wave-h','wave-v','gradient','disco'].includes(p.lighting.effect)&&!p.lighting.perKey[key.code])color=hsvToHex((key.x*20+key.y*24)%360,.7,.95);
      button.style.setProperty('--key-light',color);button.style.setProperty('--key-strength',p.lighting.enabled&&p.lighting.effect!=='off'?p.lighting.brightness/100:0);
      const showBinding=tab==='keyconfig'&&!!mapped;
      button.classList.toggle('remapped',showBinding);
      button.querySelector('.kb-key-label').textContent=showBinding?bindingLabel(mapped):keycapLabel(key.code);
      button.querySelector('.kb-key-subtitle').textContent=showBinding?keycapLabel(key.code):'';
      button.title=key.code==='Fn'?'Fn — захищена клавіша; налаштування недоступні':key.label+' · '+(mapped?bindingLabel(mapped):'За замовчуванням')+' · чернетка';
      const actual=deviceKeys.get(key.code);
      if(actual){button.dataset.hardwareId=String(actual.id);button.title+=` · Знімок пристрою: #${actual.id} · ${actual.mappingLabel} · ${actual.actuation===null?'спрацювання невідоме':actual.actuation.toFixed(3)+' мм'}`;}
      else delete button.dataset.hardwareId;
      button.setAttribute('aria-label',button.title);
    }
    $('kb-selection-label').textContent=selected.size?`Вибрано ${selected.size}: ${[...selected].slice(0,6).map(labelFor).join(', ')}${selected.size>6?'…':''}`:'Обери клавіші · Ctrl / Shift — кілька';
    $('kb-rule-selection').textContent=selected.size?'Цільові клавіші: '+[...selected].map(labelFor).join(' + '):'Обери цільові клавіші на схемі.';
    renderBindingSelection();
    triggerEditor?.render();
  }
  function refreshTriggerPreview(){ $('kb-trigger-preview').disabled=previewBusy||tab!=='trigger'||!selected.size||deviceKeys.size!==KEYBOARD.length; }
  function layerName(){return root.querySelector('[data-kb-layer="'+layer+'"]').textContent;}
  function renderBindingSelection() {
    if(tab!=='keyconfig')return;
    const summary=bindingSelection(current(),layer,[...selected]),context=current().id+':'+layer;
    if(bindingContext!==context){bindingContext=context;$('kb-binding-status').textContent='Зміни зберігаються лише в цьому шарі локального профілю.';}
    $('kb-binding-layer').textContent=layerName();
    $('kb-binding-summary').textContent=!summary.count?'Вибери клавіші на схемі':summary.allDefault?'За замовчуванням':summary.mixed?'Різні призначення':bindingLabel(summary.common);
    $('kb-binding-summary').classList.toggle('mixed',summary.mixed&&!summary.allDefault);
    $('kb-binding-count').textContent=summary.count?`Вибрано: ${summary.count} · Перепризначено: ${summary.overriddenCount}`:'Немає вибраних клавіш. Команду можна перетягнути на одну клавішу.';
    $('kb-binding-reset').disabled=!summary.overriddenCount;
    $('kb-shortcut-assign').disabled=!summary.count||!shortcut;
    $('kb-binding-details').hidden=!summary.count;
    const list=$('kb-binding-list');list.replaceChildren();
    for(const entry of summary.entries){const row=element('div','kb-binding-row');row.setAttribute('role','listitem');row.append(element('strong','',keycapLabel(entry.code)),element('span','',bindingLabel(entry.value)),element('small','',entry.overridden?'Змінено':'Базова дія'));list.append(row);}
    const common=summary.common?bindingSignature(summary.common):null;
    for(const button of $('kb-commands').querySelectorAll('[data-binding-signature]')){
      const active=common!==null&&button.dataset.bindingSignature===common;
      button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));button.setAttribute('aria-disabled',String(!summary.count));
    }
  }
  function assign(command,codes=[...selected],singleDrop=false) {
    if(tab!=='keyconfig')return false;
    if(!codes.length){$('kb-binding-status').textContent='Спочатку вибери клавіші або перетягни команду на одну клавішу схеми.';return false;}
    let changed=0;
    mutate(profile=>{changed=applyBinding(profile,layer,codes,command);return changed>0;});
    $('kb-binding-status').textContent=changed?`${singleDrop?'Перетягування:':'Призначено:'} ${changed} клавіш · ${bindingLabel(binding(command))} · ${layerName()}. Лише локально.`:'Ці клавіші вже мають таке призначення. Нічого не змінено.';
    return changed>0;
  }
  function resetSelectedBindings() {
    if(tab!=='keyconfig')return;
    const summary=bindingSelection(current(),layer,[...selected]);
    if(!summary.overriddenCount)return;
    if(summary.count>1&&!confirmAction(`Скинути ${summary.overriddenCount} призначень серед ${summary.count} вибраних клавіш у шарі ${layerName()}? Інші клавіші, шари та пристрій не зміняться.`))return;
    let changed=0;mutate(profile=>{changed=resetBindingKeys(profile,layer,summary.codes);return changed>0;});
    $('kb-binding-status').textContent=`Скинуто ${changed} призначень у шарі ${layerName()}. Інші шари та параметри збережені.`;
  }
  function commands() {
    if(category==='basic')return [...OUTPUT_CODES].map(code=>({label:labelFor(code),value:{kind:'key',code}}));
    const options=category==='mouse'?['left','right','middle','back','forward','wheel-up','wheel-down']:category==='media'?['play-pause','next','previous','mute','volume-up','volume-down']:['toggle','next-effect','brightness-up','brightness-down'];
    return options.map(action=>({label:bindingLabel({kind:category,action}),value:{kind:category,action}}));
  }
  function renderCommands() {
    $('kb-commands').replaceChildren();$('kb-shortcut-area').hidden=category!=='shortcut';
    $('kb-command-search').disabled=category==='shortcut';$('kb-commands').hidden=category==='shortcut';$('kb-commands-empty').hidden=true;
    if(category==='shortcut'){renderBindingSelection();return;}
    const search=$('kb-command-search').value.trim().toLowerCase();
    const matches=commands().filter(c=>(c.label+' '+JSON.stringify(c.value)).toLowerCase().includes(search));
    for(const command of matches){const button=element('button','kb-command',command.label);button.type='button';button.draggable=true;button.dataset.bindingSignature=bindingSignature(command.value);button.title=command.label+' · Клік: вибраним клавішам. Перетягування: лише цільовій клавіші.';on(button,'click',()=>assign(command.value));button.addEventListener('dragstart',e=>{e.dataTransfer.setData('application/x-inputstudio-binding',JSON.stringify(command.value));e.dataTransfer.effectAllowed='copy';});$('kb-commands').append(button);}
    $('kb-commands-empty').hidden=matches.length>0;renderBindingSelection();
  }
  function renderRules() {
    const p=current();$('kb-rule-count').textContent=`${p.advanced.length} / 40`;$('kb-rule-list').replaceChildren();
    if(!p.advanced.length)$('kb-rule-list').append(element('p','help','Правил ще немає.'));
    for(const rule of p.advanced){const row=element('div','kb-rule-item'),text=element('div');text.append(element('strong','',rule.kind+' · '+rule.keys.map(labelFor).join(' + ')),element('small','',rule.kind==='MT'?`Tap / Hold · ${rule.holdMs} мс`:rule.actions.length?rule.actions.map(a=>`${a.at} мм → ${labelFor(a.code)}`).join(' · '):rule.mode));const remove=element('button','text-button','×');remove.type='button';remove.setAttribute('aria-label','Видалити правило '+rule.kind);on(remove,'click',()=>mutate(profile=>{profile.advanced=profile.advanced.filter(r=>r.id!==rule.id);}));row.append(text,remove);$('kb-rule-list').append(row);}
  }
  function ruleForm() {
    $('kb-rule-description').textContent=RULE_NAMES[ruleKind][1];$('kb-rule-mode').closest('label').hidden=!['RS','SOCD'].includes(ruleKind);$('kb-rule-delay').closest('label').hidden=ruleKind!=='MT';$('kb-rule-mode').value=ruleKind==='RS'?'depth':'last';
    $('kb-rule-actions').replaceChildren();
    const count=ruleKind==='DKS'?4:ruleKind==='MT'?2:ruleKind==='TGL'?1:0;
    for(let i=0;i<count;i++){const row=element('div','kb-rule-action-row');if(ruleKind==='DKS'){const label=element('label','',`Поріг ${i+1}, мм`),input=element('input');input.type='number';input.min='.04';input.max='3.36';input.step='.01';input.value=String((i+1)*.5);input.dataset.ruleThreshold=String(i);label.append(input);row.append(label);}const label=element('label','',ruleKind==='MT'?(i===0?'Tap':'Hold'):'Дія'),select=element('select');select.dataset.ruleAction=String(i);for(const code of OUTPUT_CODES){const option=element('option','',labelFor(code));option.value=code;select.append(option);}select.value=ruleKind==='MT'?(i===0?'Space':'ControlLeft'):['KeyW','KeyA','KeyS','KeyD'][i];label.append(select);row.append(label);$('kb-rule-actions').append(row);}
  }
  function render() {
    const p=current();renderProfiles();renderBoard();renderRules();
    $('kb-light-enabled').checked=p.lighting.enabled;$('kb-light-brightness').value=p.lighting.brightness;$('kb-light-speed').value=p.lighting.speed;$('kb-brightness-value').textContent=p.lighting.brightness+'%';$('kb-speed-value').textContent=p.lighting.speed+' / 5';$('kb-color-hex').value=p.lighting.color;$('kb-color-native').value=p.lighting.color;
    const hsv=hexToHsv(p.lighting.color),r=hsv.s*43,angle=hsv.h*Math.PI/180;$('kb-wheel-marker').style.left=(50+Math.cos(angle)*r)+'%';$('kb-wheel-marker').style.top=(50+Math.sin(angle)*r)+'%';
    for(const b of root.querySelectorAll('[data-kb-effect]'))b.classList.toggle('active',b.dataset.kbEffect===p.lighting.effect);
    for(const b of root.querySelectorAll('[data-kb-layer]')){const active=b.dataset.kbLayer===layer;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));}
    for(const b of root.querySelectorAll('[data-kb-hz]')){const active=Number(b.dataset.kbHz)===p.performance.pollingHz;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));}
    for(const [id,field]of [['kb-win-lock','winLock'],['kb-mac-mode','macMode'],['kb-stability','stability'],['kb-debounce','debounce'],['kb-calibration','adaptiveCalibration']])$(id).checked=p.performance[field];
  }
  function switchTab(name,focus=false) {
    const changed=tab!==name;
    if(changed){panelAnimation?.cancel();panelAnimation=null;panelStack.style.minBlockSize=panelStack.getBoundingClientRect().height+'px';}
    tab=name;
    if(!root.hidden)history.replaceState(null,'','#keyboard:'+name);
    for(const button of root.querySelectorAll('[data-kb-tab]')){const active=button.dataset.kbTab===name;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;if(active&&focus)button.focus({preventScroll:true});}
    for(const panel of root.querySelectorAll('[data-kb-panel]'))panel.hidden=panel.dataset.kbPanel!==name;
    $('kb-board').classList.toggle('binding-view',name==='keyconfig');
    $('kb-layer-controls').hidden=name==='trigger';$('kb-board-caption').hidden=name==='trigger';
    triggerEditor.setActive(name==='trigger');
    renderBoard();
    if(changed&&!reducedMotion.matches)panelAnimation=$('kb-panel-'+name).animate([{opacity:.65},{opacity:1}],{duration:100,easing:'ease-out'});
  }
  for(const b of root.querySelectorAll('[data-kb-tab]')){on(b,'click',()=>switchTab(b.dataset.kbTab));b.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const tabs=[...root.querySelectorAll('[data-kb-tab]')],i=tabs.indexOf(b),next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;switchTab(tabs[next].dataset.kbTab,true);});}
  for(const b of root.querySelectorAll('[data-kb-layer]'))on(b,'click',()=>{layer=b.dataset.kbLayer;render();});
  for(const [value,label]of EFFECTS){const b=element('button','kb-effect',label);b.type='button';b.dataset.kbEffect=value;on(b,'click',()=>mutate(p=>{p.lighting.effect=value;}));$('kb-effects').append(b);}
  for(const color of ['#ff4242','#ff9e26','#f4e642','#71e76d','#3cd6dc','#547aff','#bd77f5','#ef8ae0','#ffffff','#141418']){const b=element('button','kb-color-swatch');b.type='button';b.style.setProperty('--swatch',color);b.setAttribute('aria-label','Колір '+color);on(b,'click',()=>mutate(p=>{p.lighting.color=color;}));$('kb-swatches').append(b);}
  on($('kb-light-enabled'),'change',e=>mutate(p=>{p.lighting.enabled=e.target.checked;}));
  on($('kb-light-brightness'),'input',e=>mutate(p=>{p.lighting.brightness=Number(e.target.value);}));
  on($('kb-light-speed'),'input',e=>mutate(p=>{p.lighting.speed=Number(e.target.value);}));
  on($('kb-color-hex'),'change',e=>mutate(p=>{p.lighting.color=hex(e.target.value);}));
  on($('kb-color-native'),'input',e=>mutate(p=>{p.lighting.color=e.target.value;}));
  const wheel=$('kb-color-wheel');
  function wheelColor(e){const rect=wheel.getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width-.5,y=(e.clientY-rect.top)/rect.height-.5;mutate(p=>{p.lighting.color=hsvToHex(Math.atan2(y,x)*180/Math.PI,Math.min(1,Math.hypot(x,y)*2),1);});}
  wheel.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();wheel.setPointerCapture(e.pointerId);try{wheelColor(e);}catch(error){report(error);}});
  wheel.addEventListener('pointermove',e=>{if(!wheel.hasPointerCapture(e.pointerId))return;try{wheelColor(e);}catch(error){report(error);}});
  wheel.addEventListener('pointerup',e=>{if(wheel.hasPointerCapture(e.pointerId))wheel.releasePointerCapture(e.pointerId);});
  on($('kb-paint-keys'),'click',()=>{const codes=[...selected].filter(code=>code!=='Fn');if(!codes.length)throw new Error('Обери клавіші для індивідуального кольору');mutate(p=>{for(const code of codes)p.lighting.perKey[code]=p.lighting.color;p.lighting.effect='custom';});});
  on($('kb-clear-colors'),'click',()=>mutate(p=>{p.lighting.perKey={};}));
  on($('kb-select-wasd'),'click',()=>setSelection(['KeyW','KeyA','KeyS','KeyD']));
  on($('kb-select-all'),'click',()=>setSelection(KEYBOARD.map(key=>key.code)));
  on($('kb-select-invert'),'click',()=>{const previous=new Set(selected);setSelection(KEYBOARD.map(key=>key.code).filter(code=>!previous.has(code)));});
  on($('kb-select-none'),'click',()=>setSelection([]));
  for(const [value,label]of [['basic','Базові'],['mouse','Миша'],['media','Медіа'],['lighting','Підсвітка'],['shortcut','Комбінація']]){const b=element('button','kb-command-category'+(value==='basic'?' active':''),label);b.type='button';b.dataset.kbCategory=value;b.setAttribute('aria-pressed',String(value==='basic'));on(b,'click',()=>{category=value;for(const item of $('kb-command-categories').children){const active=item===b;item.classList.toggle('active',active);item.setAttribute('aria-pressed',String(active));}renderCommands();});$('kb-command-categories').append(b);}
  on($('kb-command-search'),'input',renderCommands);
  on($('kb-binding-reset'),'click',resetSelectedBindings);
  $('kb-shortcut-capture').addEventListener('keydown',e=>{if(e.code==='Tab'||e.code==='Escape')return;e.preventDefault();if(!OUTPUT_CODES.has(e.code)||/^(Control|Alt|Shift|Meta)/.test(e.code))return;shortcut=binding({kind:'shortcut',code:e.code,modifiers:[...(e.ctrlKey?['Control']:[]),...(e.altKey?['Alt']:[]),...(e.shiftKey?['Shift']:[]),...(e.metaKey?['Meta']:[])]});$('kb-shortcut-capture').textContent=bindingLabel(shortcut);renderBindingSelection();});
  on($('kb-shortcut-assign'),'click',()=>{if(!shortcut)throw new Error('Спочатку натисни комбінацію в області захоплення');assign(shortcut);});
  for(const kind of RULE_TYPES){const b=element('button','kb-rule-type'+(kind==='RS'?' active':''));b.type='button';b.append(element('span','kb-rule-type-icon',kind),element('span','',RULE_NAMES[kind][0]));on(b,'click',()=>{ruleKind=kind;for(const item of $('kb-rule-types').children)item.classList.toggle('active',item===b);ruleForm();});$('kb-rule-types').append(b);}
  on($('kb-rule-form'),'submit',()=>{const rule=newRule(ruleKind,[...selected]);rule.mode=$('kb-rule-mode').value;rule.holdMs=Number($('kb-rule-delay').value);if(rule.actions.length){rule.actions=rule.actions.map((action,i)=>({at:ruleKind==='DKS'?Number(root.querySelector(`[data-rule-threshold="${i}"]`).value):action.at,code:root.querySelector(`[data-rule-action="${i}"]`).value}));}mutate(p=>{p.advanced.push(rule);});});
  const tester=$('kb-key-test');
  tester.addEventListener('keydown',e=>{if(e.code==='Tab'||e.code==='Escape')return;e.preventDefault();if(KEY_CODES.has(e.code)){pressed.add(e.code);boardButtons.get(e.code)?.classList.add('test-pressed');$('kb-test-pressed').textContent='Натиснуто: '+[...pressed].map(labelFor).join(' + ');tester.textContent='Подія: '+labelFor(e.code);}});
  tester.addEventListener('keyup',e=>{if(e.code==='Tab'||e.code==='Escape')return;e.preventDefault();pressed.delete(e.code);boardButtons.get(e.code)?.classList.remove('test-pressed');$('kb-test-released').textContent='Відпущено: '+labelFor(e.code);$('kb-test-pressed').textContent='Натиснуто: '+([...pressed].map(labelFor).join(' + ')||'—');});
  tester.addEventListener('blur',()=>{pressed.clear();for(const b of boardButtons.values())b.classList.remove('test-pressed');$('kb-test-pressed').textContent='Натиснуто: —';});
  for(const b of root.querySelectorAll('[data-kb-hz]'))on(b,'click',()=>mutate(p=>{p.performance.pollingHz=Number(b.dataset.kbHz);}));
  for(const [id,field]of [['kb-win-lock','winLock'],['kb-mac-mode','macMode'],['kb-stability','stability'],['kb-debounce','debounce'],['kb-calibration','adaptiveCalibration']])on($(id),'change',e=>mutate(p=>{p.performance[field]=e.target.checked;}));
  on($('kb-profile-create'),'click',()=>{if(collection.profiles.length>=50)throw new Error('Максимум 50 локальних профілів');const name=prompt('Назва нового локального профілю',`Профіль ${collection.profiles.length+1}`);if(name===null)return;const p=normalizeProfile(createProfile(name));collection.profiles.push(p);collection.active=p.id;selected.clear();render();save();});
  on($('kb-profile-clone'),'click',()=>{if(collection.profiles.length>=50)throw new Error('Максимум 50 профілів');const p=cloneProfile(current());collection.profiles.push(p);collection.active=p.id;render();save();});
  on($('kb-profile-rename'),'click',()=>{const name=prompt('Нова назва локального профілю',current().name);if(name===null)return;mutate(p=>{p.name=name;});save();});
  on($('kb-profile-delete'),'click',()=>{if(collection.profiles.length===1)throw new Error('Залиш хоча б один локальний профіль');if(!confirmAction(`Видалити локальну чернетку «${current().name}»? Пристрій не зміниться.`))return;collection.profiles=collection.profiles.filter(p=>p.id!==collection.active);collection.active=collection.profiles[0].id;selected.clear();render();save();});
  on($('kb-profile-save'),'click',()=>save(true));
  on($('kb-profile-export'),'click',()=>{const blob=new Blob([exportProfile(current())],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='InputStudio-'+current().name.replace(/[^\p{L}\p{N}_.-]/gu,'_')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  on($('kb-profile-import'),'click',()=>$('kb-import-file').click());
  on($('kb-import-file'),'change',async()=>{const file=$('kb-import-file').files[0];try{if(!file)return;if(collection.profiles.length>=50)throw new Error('Максимум 50 профілів');if(file.size>262144)throw new Error('Максимум 256 КБ');const profile=importProfile(await file.text());collection.profiles.push(profile);collection.active=profile.id;selected.clear();render();save();notify('Локальний JSON-профіль імпортовано. Пристрій не змінювався.');}finally{$('kb-import-file').value='';}});
  on($('kb-reset-draft'),'click',()=>{if(!confirmAction('Скинути лише поточну локальну чернетку? Клавіатура не зміниться.'))return;const before=current(),profile=createProfile(before.name);profile.id=before.id;collection.profiles[collection.profiles.findIndex(p=>p.id===before.id)]=profile;selected.clear();render();save();});

  function setSnapshotStatus(text,error=false){
    const node=$('kb-snapshot-status');node.textContent=text;node.classList.toggle('error',error);
  }
  function fullSnapshot(data=deviceSnapshot){
    if(!data||deviceKeys.size!==KEYBOARD.length)throw new Error('Спочатку зчитай повний знімок пристрою із зіставленою заводською картою.');
    return data;
  }
  function snapshotTargets(){
    return selected.size?[...selected]:KEYBOARD.map(key=>key.code).filter(code=>code!=='Fn');
  }
  function snapshotValue(field,value){
    if(value===null||value===undefined)return '—';
    if(typeof value==='number')return Number.isFinite(value)?value.toFixed(3)+' мм':'—';
    if(typeof value==='boolean')return value?'Увімкнено':'Вимкнено';
    return String(value);
  }
  function renderSnapshotCompare(){
    const data=fullSnapshot(),targets=snapshotTargets(),rows=compareSnapshot(current(),data,targets,layer);
    const changed=rows.filter(row=>row.fields.length),unknown=rows.filter(row=>row.unknown.length);
    const host=$('kb-snapshot-compare-result');host.replaceChildren();host.hidden=false;
    const summary=element('p','kb-snapshot-summary',`Порівняно ${rows.length} клавіш${selected.size?' (вибір)':' (усі доступні)'} · відмінностей: ${changed.length} · невідомо: ${unknown.length}`);
    host.append(summary);
    if(!changed.length&&!unknown.length){host.append(element('p','help','Чернетка збігається зі знімком для вибраних клавіш. Це порівняння не змінює ні чернетку, ні пристрій.'));setSnapshotStatus('Порівняння завершено: відмінностей немає.');return;}
    const wrap=element('div','kb-device-table-wrap');wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','Відмінності чернетки від знімка пристрою');
    const table=element('table','kb-device-table kb-compare-table');
    table.append(element('caption','',`Профіль пристрою ${data.profile} · Win Default · «—» означає невідоме значення; знімок не змінюється`));
    const head=element('tr');
    for(const title of ['Клавіша','Параметр','Чернетка','Пристрій'])head.append(element('th','',title));
    const thead=element('thead');thead.append(head);table.append(thead);
    const body=element('tbody');
    const names={actuation:'Спрацювання',rapid:'Rapid Trigger',press:'Press',release:'Release',binding:'Призначення','device-binding':'Призначення пристрою'};
    for(const row of rows){
      if(!row.fields.length&&!row.unknown.length)continue;
      for(const field of [...row.fields,...row.unknown]){
        const tr=element('tr');tr.dataset.compareKey=row.code;tr.dataset.compareField=field;
        const isBinding=field==='binding'||field==='device-binding';
        const draft=isBinding?bindingLabel(bindingFor(current(),'win',row.code)):snapshotValue(field,row.draft[field]);
        const actual=isBinding?(row.actual.mappingLabel||'—'):snapshotValue(field,row.actual[field==='rapid'?'rapidTrigger':field]);
        for(const value of [labelFor(row.code),names[field]||field,draft,actual])tr.append(element('td','',value));
        body.append(tr);
      }
    }
    table.append(body);wrap.append(table);host.append(wrap);
    setSnapshotStatus(`Порівняно ${rows.length} клавіш: відмінностей ${changed.length}, невідомих ${unknown.length}. HID і запис не виконувалися.`);
  }
  function createSnapshotProfile(){
    const data=fullSnapshot();
    if(collection.profiles.length>=50)throw new Error('Максимум 50 локальних профілів');
    const result=profileFromSnapshot(data);
    const fallback=`Jet75 · профіль ${data.profile} зі знімка`;
    const name=prompt('Назва локального профілю зі знімка',fallback);if(name===null)return;
    const profile=normalizeProfile({...result.profile,name:name.trim()||fallback});
    collection.profiles.push(profile);collection.active=profile.id;layer='win';selected.clear();render();save();
    const skipped=result.skipped.length?` Не перенесено записів: ${result.skipped.length}.`:'';
    const summary=`Створено локальний профіль «${profile.name}» зі знімка. Trigger: ${result.triggerCount}; простих призначень: ${result.bindingCount}, змінених: ${result.bindingOverrides}.${skipped}`;
    setSnapshotStatus(summary);notify(summary+' Пристрій не змінювався.');
  }
  function snapshotPlanRequest(){
    const data=fullSnapshot();
    if(!selected.size)throw new Error('Вибери клавіші на схемі для плану зі знімка.');
    const triggers=$('kb-snapshot-plan-trigger').checked,keymap=$('kb-snapshot-plan-keymap').checked;
    const result=draftPlanOperations(current(),data,[...selected],{triggers,keymap,layer});
    if(result.issues.length){
      const lines=result.issues.map(issue=>`${labelFor(issue.code)} · ${issue.section}: ${issue.reason}`);
      $('kb-snapshot-plan-output').textContent='План не створено: вибрані клавіші містять непідтримувані або невідомі дані.\n'+lines.join('\n');
      $('kb-snapshot-plan-output').hidden=false;
      setSnapshotStatus(`План не створено: ${result.issues.length} проблем(и). Пристрій не змінювався.`,true);
      return null;
    }
    if(!result.operations.length)throw new Error('Немає операцій для плану.');
    return {operations:result.operations,context:previewVersion};
  }
  function showSnapshotPlan(plan,context){
    if(context!==previewVersion||tab!=='others')return false;
    const hex=bytes=>bytes.map(value=>value.toString(16).padStart(2,'0').toUpperCase()).join(' ');
    const lines=[`Лише план · Профіль пристрою ${plan.profile} · Операцій: ${plan.operations} · Змінено байтів: ${plan.changedBytes}`];
    for(const bank of plan.banks)lines.push(`Банк ${bank.bank} · ${bank.records.length} запис(ів) · змінено ${bank.changedBytes} байтів`);
    if(!plan.records.length)lines.push('Змін немає: вибрані значення чернетки вже збігаються зі знімком.');
    for(const record of plan.records)lines.push(`${record.bank} · ${record.keyCode||'function'} · адреса ${record.offset}: ${hex(record.before)} → ${hex(record.after)}`);
    lines.push(plan.warning);$('kb-snapshot-plan-output').textContent=lines.join('\n');$('kb-snapshot-plan-output').hidden=false;
    setSnapshotStatus(`План розраховано за знімком: ${plan.operations} операцій, ${plan.records.length} записів. HID-запити й запис не виконувалися.`);
    return true;
  }
  on($('kb-snapshot-compare'),'click',renderSnapshotCompare);
  on($('kb-snapshot-create'),'click',createSnapshotProfile);
  for(const id of ['kb-snapshot-plan-trigger','kb-snapshot-plan-keymap'])on($(id),'change',()=>{
    previewVersion++;$('kb-snapshot-plan-output').hidden=true;
    setSnapshotStatus('Склад плану змінено. Розрахуй його заново.');
  });
  render();renderCommands();ruleForm();
  return {
    triggerPreviewRequest(){
      if(tab!=='trigger'||!selected.size)throw new Error('Вибери клавіші у вкладці Trigger.');
      if(deviceKeys.size!==KEYBOARD.length)throw new Error('Спочатку зчитай пристрій із відповідною заводською картою.');
      const summary=triggerSelection(current(),[...selected]),fields=summary.fields;
      const names=['actuation','rapid'];
      if(fields.rapid.value)names.push('press','release');
      if(names.some(name=>fields[name].mixed))throw new Error('Значення групи різні. Обери одну клавішу або задай спільні спрацювання та RT.');
      const value={keyIds:summary.codes.map(code=>deviceKeys.get(code).id),actuation:fields.actuation.value,rapidTrigger:fields.rapid.value};
      if(value.rapidTrigger){value.press=fields.press.value;value.release=fields.release.value;}
      return {action:'trigger',value,context:previewVersion};
    },
    setPreviewBusy(value){previewBusy=value;refreshTriggerPreview();},
    snapshotPlanRequest,
    showSnapshotPlan,
    showTriggerPlan(plan,context){
      if(context!==previewVersion||tab!=='trigger')return false;
      const hex=bytes=>bytes.map(value=>value.toString(16).padStart(2,'0').toUpperCase()).join(' ');
      const lines=[`Лише план · Профіль пристрою ${plan.profile} · Змінено байтів: ${plan.changedBytes}`,plan.records.length?`Записів: ${plan.records.length}`:'Змін немає.'];
      for(const record of plan.records)lines.push(`${record.keyCode||plan.bank} · адреса ${record.offset}: ${hex(record.before)} → ${hex(record.after)}`);
      lines.push(plan.warning);$('kb-trigger-plan').textContent=lines.join('\n');$('kb-trigger-plan').hidden=false;return true;
    },
    setDevice(data){
      deviceSnapshot=data;
      $('keyboard-firmware-current').textContent=data.firmware;$('keyboard-profile-current').textContent='Активний профіль '+data.profile;
      const light=data.lighting;
      $('keyboard-summary').textContent=`${data.name}\nПрошивка: ${data.firmware}\nПрофіль: ${data.profile}\nКопія: ${data.backup}`+(light?`\nRGB: ефект ${light.effect}, ${light.brightness}%, ${light.color}\nWin Lock: ${data.lockWin?'увімкнено':'вимкнено'}`:'');
      $('kb-actual-polling').textContent=`Пристрій повернув код ${data.pollingCode}; відповідність Гц не підтверджена.`;
      $('kb-device-warning').textContent=data.warning||'Знімок лише для читання. Локальні профілі не змінені.';
      deviceKeys.clear();$('kb-device-keys').replaceChildren();
      if(data.layoutMatched)for(const key of data.keys)if(KEY_CODES.has(key.code))deviceKeys.set(key.code,key);
      $('kb-device-values').hidden=deviceKeys.size!==KEYBOARD.length;
      $('kb-device-map-status').textContent=`Профіль ${data.profile} · Зіставлено ${deviceKeys.size} / ${KEYBOARD.length} заводських записів · Не оновлюється автоматично`;
      const distance=value=>typeof value==='number'&&Number.isFinite(value)?value.toFixed(3):'—';
      for(const key of KEYBOARD){
        const actual=deviceKeys.get(key.code);if(!actual)continue;
        const row=element('tr');row.dataset.deviceKey=key.code;
        for(const value of [actual.id,actual.name,actual.mappingLabel,distance(actual.actuation),actual.rapidTrigger===null?'—':actual.rapidTrigger?'Увімкнено':'Вимкнено',distance(actual.press),distance(actual.release)])row.append(element('td','',String(value)));
        row.title=key.code+(actual.protected?' · захищена Fn':'');$('kb-device-keys').append(row);
      }
      $('kb-board').setAttribute('aria-label',deviceKeys.size===KEYBOARD.length?'Локальна чернетка Jet75-II; апаратні записи зіставлено за заводським знімком':'Локальна чернетка Jet75-II; апаратну карту не зіставлено');
      renderBoard();
      const full=deviceKeys.size===KEYBOARD.length;
      $('kb-snapshot-tools').hidden=!full;
      $('kb-snapshot-status').classList.remove('error');
      $('kb-snapshot-status').textContent=full?`Знімок профілю ${data.profile} готовий. Створи локальний профіль, порівняй чернетку або розрахуй план; пристрій не змінюється.`:'Потрібен повний знімок 80 заводських записів, щоб працювати з профілем, порівнянням і планом.';
    },
    activate(){switchTab(tab);},
    dispose(){clearTimeout(timer);panelAnimation?.cancel();panelObserver.disconnect();triggerEditor.dispose();},
    openTab(name){if([...root.querySelectorAll('[data-kb-tab]')].some(button=>button.dataset.kbTab===name))switchTab(name);}
  };
}
