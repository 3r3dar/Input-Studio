import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const source = await fs.readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const editor = await fs.readFile(new URL('../public/keyboard-editor.mjs', import.meta.url), 'utf8');
const trigger = await fs.readFile(new URL('../public/keyboard-trigger.mjs', import.meta.url), 'utf8');
const editorCss = await fs.readFile(new URL('../public/keyboard-editor.css', import.meta.url), 'utf8');
const triggerCss = await fs.readFile(new URL('../public/keyboard-trigger.css', import.meta.url), 'utf8');
// The keyboard component atomically replaces the legacy section on startup.
const html = source.replace(/<section id="keyboard" class="page" hidden>[\s\S]*?<\/section>/, '<section id="keyboard"></section>') + editor.match(/const template=`([\s\S]*?)`;/)[1] + trigger.match(/const template=`([\s\S]*?)`;/)[1] + trigger.match(/const previewMarkup=`([\s\S]*?)`;/)[1];
const script = await fs.readFile(new URL('../public/app.mjs', import.meta.url), 'utf8');

test('redesigned UI preserves the script element contract without duplicate ids', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size, 'duplicate id');
  for (const [, id] of (script+'\n'+editor+'\n'+trigger).matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.includes(id), `missing UI element: ${id}`);
  assert.ok(html.includes('content="__TOKEN__"'));
});

test('device tabs are wired to real panels and local presets cannot submit forms', () => {
  const tabs = [...html.matchAll(/<button\b[^>]*\brole="tab"[^>]*>/g)].map(match => match[0]);
  assert.equal(tabs.length, 10);
  for (const tab of tabs) {
    const target = tab.match(/aria-controls="([^"]+)"/)[1];
    assert.ok(html.includes(`id="${target}"`));
  }
  const presets = [...html.matchAll(/<button\b[^>]*\bdata-choice-target="[^"]+"[^>]*>/g)].map(match => match[0]);
  assert.ok(presets.length >= 10);
  for (const button of presets) assert.ok(button.includes('type="button"'));
  assert.doesNotMatch(html, /\bonclick\s*=/i);
  assert.doesNotMatch(html, /(?:src|href)="https?:\/\//i);
});

test('keyboard drafts have no network or HID writer, and hardware apply stays disabled', () => {
  assert.doesNotMatch(editor, /\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/);
  assert.match(html, /id="kb-hardware-apply"[^>]*\bdisabled/);
  assert.doesNotMatch(editor, /data-write="keyboard"/);
  assert.match(editor, /storage\.setItem/);
  assert.match(editor, /storage\?\?=globalThis\.localStorage/);
  assert.doesNotMatch(trigger, /\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/);
  assert.match(html, /class="tr-calibration"[^>]*\bdisabled/);
});

test('key slots use a dedicated inset field and the same centered pixel gap on both axes',()=>{
  assert.match(html,/id="kb-board"[^>]*><div id="kb-keyfield" class="kb-keyfield"><\/div><\/div>/);
  assert.match(editor,/\$\('kb-keyfield'\)\.append\(button\)/);
  for(const property of ['left','top'])assert.match(editor,new RegExp('button\\.style\\.'+property+'=`calc\\([^`]*var\\(--kb-key-gap\\) / 2\\)'));
  for(const property of ['width','height'])assert.match(editor,new RegExp('button\\.style\\.'+property+'=`calc\\([^`]*- var\\(--kb-key-gap\\)\\)'));
});

test('every keyboard tab shares the same frame, spacing and board width',()=>{
  assert.match(editorCss,/\.kb-board\{--kb-key-inset:8px;--kb-key-gap:4px;--kb-board-min-width:800px;/);
  assert.match(editorCss,/\.kb-scene\{[^}]*grid-template-columns:minmax\(0,1fr\)/);
  assert.match(editorCss,/\.kb-key-label\{font-size:clamp\(12px,1\.4cqw,14px\)\}/);
  assert.doesNotMatch(triggerCss,/\.trigger-active \.kb-board\{[^}]*--kb-key-(?:inset|gap):/);
  assert.match(triggerCss,/\.trigger-active \.kb-board\{min-width:var\(--kb-board-min-width\)\}/);
});

test('Trigger controls occupy permanent slots instead of pushing the keyboard down',()=>{
  for(const id of ['kb-board-toolbar','kb-layer-controls','kb-trigger-view','kb-trigger-legend','kb-board-caption','kb-panel-stack'])assert.ok(html.includes(`id="${id}"`)||html.includes(`class="${id}"`));
  assert.ok(html.indexOf('class="kb-board-toolbar"')<html.indexOf('class="kb-scene"'));
  assert.match(editorCss,/\.kb-board-view\{[^}]*height:62px/);
  assert.doesNotMatch(trigger,/scene\.(?:before|after)\(/);
  assert.doesNotMatch(triggerCss,/\.trigger-active \.kb-tabs>button/);
  assert.match(editor,/\$\('kb-layer-controls'\)\.hidden=name==='trigger'/);
});

test('tab activation is immediate with only a cancellable 100-ms opacity reveal',()=>{
  const switcher=editor.match(/function switchTab\([\s\S]*?\n  }/)[0];
  assert.match(switcher,/panelAnimation\?\.cancel\(\)/);
  assert.match(switcher,/minBlockSize/);
  assert.match(switcher,/focus\(\{preventScroll:true\}\)/);
  assert.match(switcher,/!reducedMotion\.matches/);
  assert.match(switcher,/animate\(\[\{opacity:\.65\},\{opacity:1\}\],\{duration:100/);
  assert.doesNotMatch(switcher,/setTimeout|requestAnimationFrame|translate|transform/);
});

test('diagram keyboard shortcuts stay local, use a single Tab stop and keep Fn disabled',()=>{
  assert.match(editor,/button\.tabIndex=key\.code==='Escape'\?0:-1;button\.disabled=key\.code==='Fn'/);
  assert.match(editor,/\$\('kb-board'\)\.addEventListener\('keydown'/);
  assert.doesNotMatch(editor,/document\.addEventListener\('keydown'/);
  assert.match(editor,/event\.code==='KeyA'/);
  assert.match(editor,/keyboardNeighbor\(code,event\.key/);
  assert.match(editor,/button\.focus\(\{preventScroll:true\}\)/);
  assert.doesNotMatch(trigger,/fn\.disabled=value/);
  assert.match(html,/aria-describedby="kb-board-help kb-board-shortcuts"/);
});

test('Trigger provides grouped slider history and local redo without hijacking text undo',()=>{
  assert.match(html,/id="tr-redo"[^>]*\bdisabled/);
  assert.match(trigger,/createTriggerHistory\(limit=30\)/);
  assert.match(trigger,/beginRangeGesture\(input,'pointer'/);
  assert.match(trigger,/beginRangeGesture\(input,'keyboard'/);
  assert.match(trigger,/on\(keyboard,'keydown'/);
  assert.match(trigger,/target\.tagName==='INPUT'&&target\.type!=='range'/);
  assert.match(trigger,/history\.synchronize\(profile\)/);
});

test('Key Config displays group state and resets only validated selected bindings',()=>{
  for(const id of ['kb-binding-layer','kb-binding-summary','kb-binding-count','kb-binding-list','kb-binding-status','kb-commands-empty'])assert.ok(html.includes(`id="${id}"`));
  assert.match(html,/id="kb-binding-reset"[^>]*\bdisabled/);
  assert.match(editor,/summary\.mixed\?'Різні призначення'/);
  assert.match(editor,/changed=applyBinding\(profile,layer,codes,command\)/);
  assert.match(editor,/resetBindingKeys\(profile,layer,summary\.codes\)/);
  assert.match(editor,/summary\.count>1&&!confirmAction/);
  assert.match(editor,/if\(category==='shortcut'\)\{renderBindingSelection\(\);return;\}/);
});

test('editor storage can be isolated and pending work is cleaned up on disposal',()=>{
  assert.match(editor,/createKeyboardEditor\(root,\{notify=\(\)=>\{\},storage,confirmAction/);
  assert.match(editor,/dispose\(\)\{clearTimeout\(timer\);panelAnimation\?\.cancel\(\);panelObserver\.disconnect\(\);triggerEditor\.dispose\(\);\}/);
  assert.match(trigger,/dispose\(\)\{finishDrag\(true\);endRangeGesture\(\);\}/);
});

test('device snapshot has a separate read-only table and never replaces a local draft',()=>{
  for(const id of ['kb-device-values','kb-device-keys','kb-device-map-status'])assert.ok(html.includes(`id="${id}"`));
  const setter=editor.match(/setDevice\(data\)\{[\s\S]*?\n    },/)[0];
  assert.match(setter,/if\(data\.layoutMatched\)/);
  assert.match(setter,/deviceKeys\.clear\(\);\$\('kb-device-keys'\)\.replaceChildren\(\)/);
  assert.match(setter,/value\.toFixed\(3\):'—'/);
  assert.doesNotMatch(setter,/\b(?:mutate|save|applyBinding|applyTriggerPatch)\s*\(|storage\.setItem/);
  assert.match(editor,/button\.dataset\.hardwareId=String\(actual\.id\)/);
  assert.match(editor,/else delete button\.dataset\.hardwareId/);
});

test('Trigger preview is separate from Apply and invalidates results after editor changes',()=>{
  assert.match(html,/id="kb-trigger-preview"[^>]*\bdisabled/);
  assert.match(html,/id="kb-trigger-plan"[^>]*\bhidden/);
  assert.match(editor,/previewVersion\+\+;\$\('kb-trigger-plan'\)\.hidden=true/);
  assert.match(editor,/context!==previewVersion\|\|tab!=='trigger'/);
  assert.match(editor,/names\.some\(name=>fields\[name\]\.mixed\)/);
  assert.match(script,/api\('preview',\{device:'keyboard'/);
  const handler=script.match(/\$\('kb-trigger-preview'\)\.addEventListener[\s\S]*?\n}\);/)[0];
  assert.doesNotMatch(handler,/\bwrite\s*\(|api\('(?:write|unlock)'/);
});

test('mouse discovery shows wired identity honestly and clears stale receiver values',()=>{
  assert.match(script,/wired:'USB',receiver:'приймач 2.4 ГГц',both:'USB \+ приймач'/);
  assert.match(script,/\$\('read-mouse'\)\.disabled=unsupported/);
  assert.match(script,/!state\.mouseInfo\.readSupported\|\|previousMode!==state\.mouseInfo\.mode/);
  assert.match(script,/state\.mouse=null;state\.unlocked\.delete\('mouse'\)/);
});

test('snapshot workspace creates profiles, compares and previews batches without write controls',()=>{
  assert.match(html,/id="kb-snapshot-tools"[^>]*hidden/);
  assert.match(html,/id="kb-snapshot-create"/);
  assert.match(html,/id="kb-snapshot-compare"/);
  assert.match(html,/id="kb-snapshot-plan-button"/);
  assert.match(html,/id="kb-snapshot-plan-trigger"[^>]*checked/);
  assert.match(html,/id="kb-snapshot-plan-keymap"/);
  assert.match(editor,/profileFromSnapshot,compareSnapshot,draftPlanOperations/);
  assert.match(editor,/snapshotPlanRequest,/);
  assert.match(editor,/showSnapshotPlan,/);
  assert.match(editor,/\$\('kb-snapshot-tools'\)\.hidden=!full/);
  assert.match(script,/api\('preview-batch',\{device:'keyboard'/);
  const handler=script.match(/\$\('kb-snapshot-plan-button'\)\.addEventListener[\s\S]*?\n}\);/)[0];
  assert.doesNotMatch(handler,/\bwrite\s*\(|api\('(?:write|unlock)'/);
});

test('snapshot UI reads the RT field correctly, respects the layer and invalidates option changes',()=>{
  assert.match(editor,/row\.actual\[field==='rapid'\?'rapidTrigger':field\]/);
  assert.match(editor,/const draft=isBinding\?bindingLabel/);
  assert.match(editor,/compareSnapshot\(current\(\),data,targets,layer\)/);
  assert.match(editor,/draftPlanOperations\(current\(\),data,\[\.\.\.selected\],\{triggers,keymap,layer\}\)/);
  assert.match(editor,/for\(const id of \['kb-snapshot-plan-trigger','kb-snapshot-plan-keymap'\]\)on\(\$\(id\),'change',[\s\S]*?previewVersion\+\+;\$\('kb-snapshot-plan-output'\)\.hidden=true/);
  assert.doesNotMatch(editor,/(?<![.\w])confirm\(/); // every confirmation uses the injectable confirmAction
});
