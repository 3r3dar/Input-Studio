import { createKeyboardEditor } from './keyboard-editor.mjs';

const $ = id => document.getElementById(id);
const token = document.querySelector('meta[name="input-token"]').content;
const state = { mouse: null, mouseInfo: null, keyboard: null, unlocked: new Set(), selected: new Set(), tabs: { mouse: 'performance', keyboard: 'performance' }, page: 'overview' };
const pages = {
  overview: ['Мої пристрої', 'Уся периферія в одному місці.'],
  mouse: ['HATOR Pulsar 2 Pro', 'Wireless · PAW3335 · 2.4 GHz'],
  keyboard: ['MCHOSE Jet75-II', 'Hall Effect · USB · експериментальна підтримка'],
  support: ['Можливості та безпека', 'Тільки підтверджені можливості. Жодних прихованих змін.']
};
// Replace the legacy keyboard markup before binding any device controls.
const keyboardEditor = createKeyboardEditor($('keyboard'), { notify: message });

function message(text, error = false) {
  $('message').hidden = false;
  $('message').className = `notice ${error ? 'error' : 'success'}`;
  $('message').textContent = text;
}

async function api(url, input) {
  const response = await fetch('/api/' + url, {
    method: input ? 'POST' : 'GET',
    headers: { 'X-Input-Token': token, ...(input ? { 'Content-Type': 'application/json' } : {}) },
    ...(input ? { body: JSON.stringify(input) } : {})
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Не вдалося виконати запит.');
  return data;
}

function page(name) {
  if (!Object.hasOwn(pages, name)) return;
  state.page = name;
  document.body.dataset.page = name;
  history.replaceState(null, '', '#' + name);
  for (const section of document.querySelectorAll('.page')) section.hidden = section.id !== name;
  for (const button of document.querySelectorAll('.sidebar [data-page]')) {
    const active = button.dataset.page === name;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  $('heading').textContent = pages[name][0];
  $('caption').textContent = name==='mouse'?mouseCaption():pages[name][1];
  $('message').hidden = true;
  if (state[name]?.warning) message(state[name].warning, true);
  if (name === 'keyboard') keyboardEditor.activate();
  window.scrollTo({ top: 0, behavior: 'instant' });
}
function mouseCaption(){
  if(state.mouseInfo?.mode==='wired')return 'USB-кабель · налаштування цього режиму ще не перевірені';
  if(state.mouseInfo?.mode==='both')return 'USB-кабель і приймач підключені · активний канал не визначено';
  return pages.mouse[1];
}

function deviceTab(device, tab, focus = false) {
  state.tabs[device] = tab;
  for (const button of document.querySelectorAll(`[data-device-tab^="${device}:"]`)) {
    const active = button.dataset.deviceTab === `${device}:${tab}`;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
    if (active && focus) button.focus();
  }
  for (const panel of document.querySelectorAll(`[data-device-panel^="${device}:"]`)) panel.hidden = panel.dataset.devicePanel !== `${device}:${tab}`;
}

function syncChoices() {
  for (const button of document.querySelectorAll('[data-choice-target]')) {
    const selected = $(button.dataset.choiceTarget).value === button.dataset.value;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  }
  for (const group of document.querySelectorAll('[data-color-target]')) {
    for (const swatch of group.querySelectorAll('.swatch')) {
      const selected = swatch.dataset.color === $(group.dataset.colorTarget).value.toLowerCase();
      swatch.classList.toggle('selected', selected);
      swatch.setAttribute('aria-pressed', String(selected));
    }
  }
}

function modes() {
  for (const device of ['mouse', 'keyboard']) {
    const unsupported = device==='mouse'&&state.mouseInfo?.readSupported===false;
    const blocked = state[device]?.writeAllowed === false||unsupported;
    const enabled = state.unlocked.has(device) && !blocked;
    $(device + '-mode').textContent = blocked ? 'Запис заблоковано' : enabled ? 'Зміни дозволені' : 'Лише читання';
    $(device + '-mode').classList.toggle('locked', blocked);
    for (const button of document.querySelectorAll(`[data-write="${device}"]`)) button.disabled = blocked || !enabled || !state[device];
    if(device==='mouse'){
      $('read-mouse').disabled=unsupported;
      $('read-mouse').title=unsupported?state.mouseInfo.warning:'';
      for(const button of document.querySelectorAll('[data-unlock="mouse"]'))button.disabled=unsupported;
    }
  }
}

async function scan() {
  const data = await api('devices');
  const previousMode=state.mouseInfo?.mode;state.mouseInfo=data.devices.mouseInfo;
  for (const device of ['mouse', 'keyboard']) {
    const connected = data.devices[device];
    $(device + '-status').textContent = connected ? 'Підключено' : 'Не виявлено';
    if(device==='mouse'&&connected)$(device+'-status').textContent='Підключено · '+({wired:'USB',receiver:'приймач 2.4 ГГц',both:'USB + приймач'})[state.mouseInfo.mode];
    $(device + '-status').classList.toggle('connected', connected);
    $(device + '-dot').classList.toggle('connected', connected);
  }
  const count = Number(data.devices.mouse) + Number(data.devices.keyboard);
  $('device-count').textContent = `Підключено: ${count} / 2`;
  state.unlocked = new Set(data.unlocked);
  if(!state.mouseInfo.readSupported||previousMode!==state.mouseInfo.mode){
    state.mouse=null;state.unlocked.delete('mouse');
    for(const id of ['mouse-dpi-current','mouse-rate-current','mouse-battery-current','card-mouse-dpi','card-mouse-rate'])$(id).textContent='—';
    $('mouse-summary').textContent=state.mouseInfo.warning||'Приймач HATOR виявлено. Зчитай налаштування; наявність приймача не підтверджує, що миша зараз активна.';
  }
  $('data-path').textContent = data.dataDirectory + '\\backups';
  if(state.page==='mouse')$('caption').textContent=mouseCaption();
  modes();
}

function renderMouse(data) {
  state.mouse = data;
  const s = data.status;
  const battery = s.batteryPercent == null ? 'Невідомо' : `${s.batteryPercent}%`;
  $('mouse-summary').textContent = `${s.name} · ${s.connectionDetail}\n${s.dpi} DPI · ${s.pollingRateHz} Гц · Батарея: ${battery}\nПрочитано з пристрою. Кнопки, макроси й прошивка заблоковані.`;
  $('mouse-dpi-current').textContent = String(s.dpi);
  $('mouse-rate-current').textContent = `${s.pollingRateHz} Гц`;
  $('mouse-battery-current').textContent = battery;
  $('card-mouse-dpi').textContent = `${s.dpi} DPI`;
  $('card-mouse-rate').textContent = `${s.pollingRateHz} Гц`;
  $('dpi').value = s.dpi;
  $('rate').value = s.pollingRateHz;
  if (s.lighting) {
    $('mouse-effect').value = s.lighting.mode;
    if (s.lighting.color) $('mouse-color').value = s.lighting.color;
    if (s.lighting.speed) $('mouse-speed').value = s.lighting.speed;
  }
  const brightness = data.tabs.advanced.flatMap(section => section.controls).find(control => control.id === 'hator.brightness');
  if (brightness?.kind === 'choice') $('mouse-brightness').value = brightness.current;
  syncChoices();
  modes();
}

function renderKeyboard(data) {
  state.keyboard = data;
  $('card-keyboard-profile').textContent = `Профіль ${data.profile}`;
  keyboardEditor.setDevice(data);
  modes();
}

async function read(device) {
  message('Зчитую дані. Конфігурація не записується…');
  const data = await api('read', { device });
  (device === 'mouse' ? renderMouse : renderKeyboard)(data);
  message(data.warning || 'Дані зчитано. Налаштування пристрою не змінювалися.', !!data.warning);
}

async function write(device, action, value) {
  if (!confirm('Записати вибрані параметри у пристрій? Буде створено копію цільового банку й перевірено результат.')) return;
  message('Застосовую та перевіряю…');
  try {
    const result = await api('write', { device, action, value, revision: state.keyboard?.revision });
    (device === 'mouse' ? renderMouse : renderKeyboard)(result);
    message('Застосовано. Дані перевірено повторним зчитуванням.');
  } catch (error) {
    state.unlocked.delete(device);
    modes();
    throw error;
  }
}

function on(element, event, callback) {
  element.addEventListener(event, async e => {
    e.preventDefault();
    const button = e.currentTarget instanceof HTMLButtonElement ? e.currentTarget : null;
    if (button) button.disabled = true;
    try { await callback(e); }
    catch (error) { message(error.message, true); }
    finally { if (button) button.disabled = false; modes(); }
  });
}

for (const button of document.querySelectorAll('[data-page]')) on(button, 'click', () => page(button.dataset.page));
for (const button of document.querySelectorAll('[data-open]')) on(button, 'click', () => page(button.dataset.open));
for (const button of document.querySelectorAll('[data-device-tab]')) {
  const [device, tab] = button.dataset.deviceTab.split(':');
  on(button, 'click', () => deviceTab(device, tab));
  button.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const tabs = [...button.parentElement.querySelectorAll('[role="tab"]')];
    const index = tabs.indexOf(button);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    deviceTab(device, tabs[next].dataset.deviceTab.split(':')[1], true);
  });
}
for (const button of document.querySelectorAll('[data-choice-target]')) on(button, 'click', () => {
  $(button.dataset.choiceTarget).value = button.dataset.value;
  syncChoices(); // UI staging only: choosing a chip never calls the device API.
});
for (const button of document.querySelectorAll('[data-step-target]')) on(button, 'click', () => {
  const input = $(button.dataset.stepTarget);
  const next = Math.max(Number(input.min), Math.min(Number(input.max), Number(input.value) + Number(button.dataset.step)));
  input.value = String(next);
  syncChoices();
});
for (const input of document.querySelectorAll('input, select')) input.addEventListener('input', syncChoices);

for (const button of document.querySelectorAll('[data-unlock]')) on(button, 'click', async () => {
  const device = button.dataset.unlock;
  const confirmation = prompt('Експериментальний запис. Закрий інші програми керування цим пристроєм. Для дозволу на цю сесію введи ENABLE.');
  if (confirmation === null) return;
  await api('unlock', { device, confirmation });
  state.unlocked.add(device);
  modes();
  message('Зміни дозволено лише для цього пристрою й поточної сесії.');
});
for (const button of document.querySelectorAll('[data-lock]')) on(button, 'click', async () => {
  const device = button.dataset.lock;
  await api('lock', { device });
  state.unlocked.delete(device);
  modes();
  message('Режим лише читання.');
});

on($('sidebar-toggle'), 'click', () => {
  const collapsed = document.body.classList.toggle('sidebar-collapsed');
  $('sidebar-toggle').setAttribute('aria-expanded', String(!collapsed));
  $('sidebar-toggle').setAttribute('aria-label', collapsed ? 'Розгорнути бічну панель' : 'Згорнути бічну панель');
});
on($('scan'), 'click', scan);
on($('read-mouse'), 'click', () => read('mouse'));
on($('read-keyboard'), 'click', () => read('keyboard'));
$('kb-trigger-preview').addEventListener('click',async()=>{
  try{
    const request=keyboardEditor.triggerPreviewRequest();keyboardEditor.setPreviewBusy(true);
    const plan=await api('preview',{device:'keyboard',action:request.action,value:request.value,revision:state.keyboard?.revision});
    const shown=keyboardEditor.showTriggerPlan(plan,request.context);
    message(shown?'План розраховано за знімком. HID-запити й запис не виконувалися.':'Вибір або чернетка змінилися. Розрахуй план заново.');
  }catch(error){message(error.message,true);}finally{keyboardEditor.setPreviewBusy(false);}
});
$('kb-snapshot-plan-button').addEventListener('click',async()=>{
  const button=$('kb-snapshot-plan-button');
  try{
    const request=keyboardEditor.snapshotPlanRequest();
    if(!request){message('План не створено: є непідтримувані дані. Деталі у вкладці «Інше».',true);return;}
    button.disabled=true;
    const plan=await api('preview-batch',{device:'keyboard',operations:request.operations,revision:state.keyboard?.revision});
    const shown=keyboardEditor.showSnapshotPlan(plan,request.context);
    message(shown?'Груповий план розраховано за знімком. HID-запити й запис не виконувалися.':'Чернетка або вибір змінилися. Розрахуй план заново.',!shown);
  }catch(error){message(error.message,true);}
  finally{button.disabled=false;}
});

const mouseEffects = ['Static', 'Breathing single', 'Breathing rainbow', 'Wave', 'Colorful tail', 'Neon', 'Colorful steady', 'Flicker', 'Stars twinkle', 'Rainbow wave', 'Off'];
for (const effect of mouseEffects) { const option = document.createElement('option'); option.textContent = effect; $('mouse-effect').append(option); }

for (const art of document.querySelectorAll('[data-keyboard-art]')) {
  [15, 15, 14, 14, 13, 9].forEach((count, rowIndex) => {
    const row = document.createElement('div'); row.className = 'illustration-row';
    for (let index = 0; index < count; index++) {
      const key = document.createElement('i');
      key.className = 'illustration-key' + (rowIndex === 5 && index === 3 ? ' space' : rowIndex > 0 && index === count - 1 ? ' wide' : '');
      row.append(key);
    }
    art.append(row);
  });
}
for (const group of document.querySelectorAll('[data-color-target]')) {
  for (const color of ['#f2efef', '#b6a3ed', '#a3bbed', '#8ec9b0', '#e5c08d', '#df96a4']) {
    const swatch = document.createElement('button');
    swatch.type = 'button'; swatch.className = 'swatch'; swatch.dataset.color = color;
    swatch.style.setProperty('--swatch', color); swatch.setAttribute('aria-label', `Колір ${color}`);
    on(swatch, 'click', () => { $(group.dataset.colorTarget).value = color; syncChoices(); });
    group.append(swatch);
  }
}

on($('mouse-dpi'), 'submit', () => write('mouse', 'dpi', Number($('dpi').value)));
on($('mouse-rate'), 'submit', () => write('mouse', 'pollingRate', Number($('rate').value)));
on($('mouse-light'), 'submit', () => write('mouse', 'lighting', { mode: $('mouse-effect').value, color: $('mouse-color').value, speed: Number($('mouse-speed').value) }));
on($('mouse-bright'), 'submit', () => write('mouse', 'control:hator.brightness', Number($('mouse-brightness').value)));

syncChoices();
modes();
const [initialPage,initialTab] = location.hash.slice(1).split(':');
page(Object.hasOwn(pages, initialPage) ? initialPage : 'overview');
if(initialPage === 'keyboard' && initialTab) keyboardEditor.openTab(initialTab);
scan().catch(error => message(error.message, true));
