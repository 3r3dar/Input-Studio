// Jet75-II firmware 1.16: actual factory-bank order, NOT the CDN's fallback indices.
// All 80 usages match the official physical layout; both saved reads have this order.
export const JET75_KEYS = Object.freeze([
  ['KeyQ',20],['KeyE',8],['KeyY',28],['Minus',45],['Enter',40],
  ['F6',63],['KeyC',6],['Period',55],['ArrowLeft',80],['Delete',76],
  ['KeyA',4],['KeyD',7],['KeyG',10],['KeyO',18],['PageUp',75],
  ['F5',62],['KeyX',27],['Comma',54],['ArrowUp',82],['Home',74],
  ['KeyZ',29],['KeyR',21],['KeyH',11],['KeyP',19],['PageDown',78],
  ['F4',61],['KeyB',5],['KeyK',14],['ShiftRight',229],['ArrowDown',81],
  ['Digit1',30],['Digit4',33],['Digit7',36],['Digit0',39],['Backslash',49],
  ['F7',64],['KeyV',25],['Fn',255],['ControlRight',228],['ArrowRight',79],
  ['Backquote',53],['Digit3',32],['KeyT',23],['KeyI',12],['Backspace',42],
  ['F8',65],['ControlLeft',224],['KeyJ',13],['KeyL',15],['F12',69],
  ['Escape',41],['Digit2',31],['Digit5',34],['Digit8',37],['Equal',46],
  ['F3',60],['AltLeft',226],['KeyM',16],['Slash',56],['F11',68],
  ['CapsLock',57],['KeyS',22],['KeyF',9],['KeyU',24],['BracketRight',48],
  ['F1',58],['ShiftLeft',225],['KeyN',17],['Semicolon',51],['F9',66],
  ['Tab',43],['KeyW',26],['Digit6',35],['Digit9',38],['BracketLeft',47],
  ['F2',59],['MetaLeft',227],['Space',44],['Quote',52],['F10',67]
].map(([code,usage],id)=>Object.freeze({code,usage,id})));
export const KEY_IDS = new Set(JET75_KEYS.map(key=>key.id));
export const FN_ID = JET75_KEYS.find(key=>key.code==='Fn').id;

// Check the entire bank, including all 48 inactive records, not just a few anchors.
// A match permits read-only labels; it is deliberately NOT write authorization.
export function layoutMismatch(defaults) {
  if(defaults?.length!==384)return 'Неповна заводська таблиця клавіш. Запис клавіатури заблокований.';
  const failed=[];
  for(let id=0;id<128;id++){
    const usage=JET75_KEYS[id]?.usage;
    const expected=usage===undefined?[255,255,255]:usage===255?[240,255,1]:usage>=224?[16,1<<(usage-224),0]:[16,0,usage];
    if(expected.some((value,i)=>defaults[id*3+i]!==value))failed.push(id);
  }
  return failed.length?`Заводська таблиця не збігається з перевіреним знімком Jet75-II 1.16 (записи ${failed.join(', ')}). Апаратне зіставлення недоступне; запис клавіатури заблокований.`:null;
}
