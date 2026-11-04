# Input Studio · experimental local build 0.1

**Експериментальна програма для Windows. Це не заміна офіційних драйверів.**

### Швидкий запуск

1. Встановіть [Node.js LTS](https://nodejs.org/) (версія 20 або новіша; перевірено на 24).
2. Клонуйте репозиторій (`git clone https://github.com/3r3dar/Input-Studio.git`) або завантажте й розпакуйте ZIP.
3. У папці програми виконайте:

   ```console
   npm ci
   npm start
   ```

4. Відкрийте **http://127.0.0.1:17849/**. Для наступних запусків можна використовувати `Start.cmd`.

Інтерфейс українською. Профілі можна редагувати без підключеної клавіатури. Для зчитування закрийте MCHOSE HUB.
Запис налаштувань Jet75-II **заблокований**: доступні читання, локальні профілі, порівняння та попередній план.
HATOR у публічній збірці визначається, але для налаштувань через приймач потрібен окремий локальний адаптер;
кабельний протокол ще не підтверджений. Не вважайте схожі VID/PID або назви доказом сумісності.

Перевірка коду: `npm test`. Зупинка сервера: `Ctrl+C` у його консолі. Налаштування безпеки Windows змінювати не потрібно.
Якщо PowerShell не дозволяє запуск `Start.ps1`, використовуйте `npm start` у Git Bash або командному рядку.

---

One local interface for the user's HATOR Pulsar 2 Pro Wireless (258a:002f receiver, identity 2610; 258a:002e wired detection) and MCHOSE Jet75-II (41e4:211a).
This is **not full feature parity with either manufacturer's application**. Unverified features are explicitly unavailable.
No firmware, reset, pairing, calibration, driver installation, autostart changes or automatic device writes.
The retired FCC project is neither executed nor modified.

## Launch

Requires Windows and Node.js 20+. Run `npm ci` once to install the pinned `node-hid` dependency from the lockfile,
then `npm start` or `Start.cmd`. There are no hardcoded drive paths and no packages are downloaded at launch.
The UI runs only on `127.0.0.1:17849`. The initial mode is read-only. Closing the server ends the session.

### Optional local HATOR adapter

The unit-specific OpenMouse HATOR adapter is **not redistributed** in this repository. Without one, receiver
detection still works but settings reads/writes are disabled with an explanation. Keyboard features do not need it.
If you already have the compatible, trusted adapter for `258a:002f / identity 2610`, set the
`INPUT_STUDIO_HATOR_ADAPTER` environment variable to its absolute path, or create `.local/config.json`:

```json
{ "hatorAdapterPath": "C:/path/to/your/hator-adapter.js" }
```

Restart the server after configuring it. This loads executable JavaScript: only use code you trust and have the
right to use. Other adapters are not supported. `.local/` is excluded from Git; never commit your local paths,
serial numbers, browser profile exports or device backups. Installing an adapter does not enable wired support
and does not bypass any write guards.

## Support / verification status

| Function | Implementation | Verification |
| --- | --- | --- |
| Discover both exact USB identities | Implemented | Uses HID enumeration, not inferred connection states |
| Mouse DPI, polling, RGB effects/brightness | Optional external unit-specific HATOR adapter (not bundled) | Public build defaults to detection only; compatible local adapter retains identity and read-back checks |
| Mouse battery | Optional external adapter | Unknown while asleep is not replaced with a made-up value |
| Mouse USB cable (258a:002e) | Detected and labeled USB | Settings reads/writes are blocked until this transport is verified; receiver commands are not reused |
| Mouse buttons/macros, LOD, debounce | Blocked | No safe read-back on this unit established |
| Keyboard firmware, active profile, RGB, keymap, actuation/RT display | Read-only snapshot | Fresh firmware-1.16 read and browser checks passed on 2026-11-04; all 80 factory records matched |
| Keyboard snapshot → local profile, comparison and grouped plan | Implemented; HID-free preview only | Fresh 80/80 read, browser comparison and two-bank plan verified on 2026-11-04; no device write |
| Keyboard RGB / Win lock | Offline codec only; device writes blocked | Not physically write-tested |
| Keyboard per-key actuation / RT | Offline codec only; device writes blocked | Bank addressing and physical behavior not write-tested |
| Keyboard simple key remapping | Offline codec only; device writes blocked | Unknown special mappings are preserved, never guessed |
| Keyboard polling, DKS, SOCD, calibration, macros, mod-tap/toggle | Blocked in this build | No claim of full support |
| Combined profiles / game automation | Not implemented | Existing OpenMouse automation is not changed |

## Safety

* Device discovery does not open input collections. Mouse/keyboard standard input interfaces are never opened.
* Connecting to the keyboard sends only allowlisted **read requests**, using output reports on its vendor configuration interface.
  This is not a passive USB monitor, but no configuration-write commands are sent by Connect.
* Keyboard records are decoded from the currently active onboard profile. Unknown modes and unit mismatches block edits.
* Before every supported write, the target bank is re-read, compared to the connected baseline, backed up, patched and read back.
  Another program's changes cause a conflict, not a silent overwrite. A mismatch disables writes; it is not retried blindly.
* Mouse backup captures the raw bank used by the existing adapter, not merely the displayed fields.
* Close MCHOSE HUB before reading the keyboard; the application checks for it before opening HID.
  Close other device-control software before enabling supported writes. The application checks controller processes before writes.
  It does not stop them itself. Only one writer should run at a time; an external program could still start later.
* Settings and raw backups live under `%LOCALAPPDATA%\InputStudio`. No automatic raw-backup restore is provided.
  Backups must not be replayed on another device, firmware or profile.
* The HTTP API is loopback-only, checks Host/Origin, requires a random per-launch token, and does not expose arbitrary commands,
  file paths, firmware operations, raw HID writes or an unrestricted profile import endpoint.

## Protocol sources

Keyboard framing, memory offsets and trigger bitfields were cross-checked against the public FCC protocol documentation:
https://github.com/shybruh/FightingControlCenter-FCC/blob/main/docs/PROTOCOL-MC.md
Model: `mc-jet75-211a`, step 100/mm, maximum travel 3.4 mm, 128 records; keyboard support is experimental upstream too.
This implementation does not execute, copy or rebuild the user's retired FCC installation.
The optional HATOR adapter is an external local OpenMouse extension and is not covered by this repository's license.
No manufacturer driver, firmware, minified vendor bundle or downloaded manufacturer artwork is redistributed.
The public mouse SVG is an original generic illustration, not a photograph or exact product rendering.

## Real-device read check, 2026-11-03

Mouse read through the UI succeeded: 800 DPI / 1000 Hz; receiver reported the mouse asleep, so battery was unknown.
Jet75-II read succeeded after handling the documented short INFO/BASE replies (INFO returned 22 bytes, firmware 1.16).
Active profile was 1; its raw configuration snapshot was saved locally. No configuration writes were sent.
**The actual factory key order differs from the published mc-jet75-211a layout** (including the Fn record).
For this unit, **all keyboard configuration writes and API unlocking remain blocked**, including RGB.
The write guard is independent of the factory-map check; matching every factory record does not enable writes.
Bank addressing and physical behavior still require verification before claiming keyboard editing support.

## Read-only factory mapping, 2026-11-04

The official Cizhou Jet75-II files alias the shared Jet75-I layout/default tables. All 80 physical HID usages match
the saved device factory bank, but the CDN fallback record indices do not. `lib/jet75-layout.mjs` therefore uses the
actual firmware-1.16 order: Fn 37, right bracket 64, left Shift 66 and F2 75; physical records are 0–79.
Every byte of the 384-byte factory bank, including inactive records 80–127, must match before physical labels appear.
Factory SHA-256: `d2920e64c2684e712ecae53c31af6717ac183c7b98908d14d0bb3930958440d7`.
Sources under `https://cdn.mchose.com.cn/customPage/prod/cizhou/CZ_SHARED_DATA/`:
`main.b1d3fb6f68d495cc5961.js`, `layout-jet75_ii.3c0e9a31376d74a47d15.js`,
`default-keys-jet75_ii.0fb420461c071b4a963c.js`, `layout-jet75_i.3f2bebb9c9a991b7ee8b.js`,
`default-keys-jet75_i.a04eb4438477dc396351.js`. These files were inspected as text, not executed or included in the app.
This is factory-record correspondence, not a live per-key physical test or confirmation of every bank's addressing.

A fresh manual read on 2026-11-04 succeeded with MCHOSE HUB closed: firmware 1.16, onboard profile 1, all 80
factory records matched. Snapshot: `2026-11-04T11-14-41.446Z-97e101-jet75-read.json`. The factory, function,
keymap and color banks matched the previous saved read; Trigger records for I, W and F2 differed, so historical
dumps must not be treated as current configuration. W read as 1.200 mm with RT press/release 0.500/0.500 mm.
Browser checks confirmed 80 table rows, correct hardware labels, unknown-value handling, no duplicated rows,
stationary keyboard geometry and unchanged local profiles. No configuration writes were sent; writes remain blocked.

## Official bank addressing and offline preview

The same official `main.b1d3fb6f68d495cc5961.js` confirms Function commands 5/6 at `64 * profile`,
Trigger 160/161 at `1024 * profile`, keymap 8/9 and defaults 7 at `2048 * profile + 512 * layer`,
and key colors 10 at `512 * profile`. Header flags 0x55/0xAA, the eight-byte header and additive checksum agree.
`keyboardBank()` is shared by reads, the blocked write adapter and the pure plan calculator to prevent address drift.
These are source-verified addresses, not physical write validation. In particular, the official bulk sender pads or
overlaps short trailing chunks; matching addresses does not prove that every short write packet is safe on this unit.

Trigger's **Check selected plan** button previews only actuation and Quick Trigger for the selected keys, using the
last manually read snapshot. Mixed core values require a narrower selection or explicit common values. The plan
shows exact record offsets and before/after bytes; it contains no sendable HID packets and never opens HID, changes
authorization, backs up or saves drafts. Editing the draft, switching selection/profile/tab or re-reading invalidates
the displayed result; stale asynchronous results are discarded. Unknown special mappings cannot be overwritten by
the keymap planner. Unsupported precision/firmware, Fn and inactive records are rejected. `POST /api/preview`
uses the usual token/origin checks and snapshot revision but is not an alternative to `/api/write` or `/api/unlock`.

## Snapshot workspace and grouped preview

The Others tab separates the read-only device snapshot from the local draft and adds three HID-free actions:

* **Create profile from snapshot** creates a new local draft from the verified Trigger records and simple key
  assignments. Special mappings, lighting, performance flags and unknown values are not guessed; the count of
  skipped records is shown. Existing drafts are never replaced.
* **Compare** reports Trigger, RT and binding differences for the selected keys, or all editable keys when the
  selection is empty. The device side remains the last manual read; the draft and device are never modified.
* **Plan selected for device** sends only in-memory operations to `POST /api/preview-batch`. Trigger/RT and key
  assignments are independent options. The response lists bank names, exact offsets and before/after bytes.
  Unsupported special mappings, Fn and stale revisions block the affected plan instead of being guessed.

The batch planner validates every operation against the same `keyboardBank()` addresses and snapshot revision as the
single-operation planner, rejects duplicate physical targets even for no-ops, and composes multiple operations per
bank in memory. It emits no sendable HID packets, does not open HID, does not change write authorization and does not
save drafts. A successful preview is not permission to write; keyboard writes remain blocked.

## Jet75 editor workspace

`http://127.0.0.1:17849/#keyboard` opens a keyboard-specific editor inspired by the supplied MCHOSE HUB references.
It has an 80-key logical diagram, multi-selection, four draft layers, lighting previews/color wheel/per-key colors,
per-key Trigger/RT drafts, command click/drag assignment, a focused shortcut capture and key test, and constructors
for RS/SOCD/DKS/Hold-Tap/Toggle rules. The Performance tab stores desired 1k/2k/4k/8k and other flags **in the draft only**.
Logical key codes stay independent of vendor IDs; only an exact factory-bank match attaches hardware record labels.
The Others tab shows the read-only snapshot's mappings, actuation and RT distances separately from local profiles.
Diagram tooltips include the matching hardware record and snapshot value, but keycaps and editable controls remain
the local draft. Reading never replaces or saves a draft. Unknown modes/precision display as unknown, not zero;
PgUp's special `[F0 FA 00]` assignment is shown without guessing its action. The table updates only on a manual read.

The Trigger editor has three panels, per-key diagram overlays, WASD/all/invert/clear selection, mixed-value indicators,
independent or linked press/reset distances, switch-type draft metadata, deadzones, .005-mm editor precision,
per-selection reset and Trigger undo/redo. Editing patches only the changed field on selected keys; no selection never
implicitly edits the whole board. Existing version-1 profiles migrate optional fields without resetting old values.
Mouse/pen dragging selects a rectangle of keys; Ctrl/Shift adds it to the existing selection and Escape cancels it.
Fn is excluded. Touch gestures keep normal diagram scrolling. Selection itself never changes profile values.
Every keyboard tab also supports arrow-key selection, Shift+arrows for groups, Home/End for row edges,
Ctrl+Home/End for board edges, Ctrl+A for all editable keys and Escape to clear. These shortcuts apply only
while a diagram key has focus; text fields and shortcut capture are unaffected. The diagram is one Tab stop,
horizontal scrolling follows the focused key without moving the page, and protected Fn is disabled in every tab.
Trigger history keeps 30 complete operations: a slider drag or held adjustment key is one operation. Undo/redo
restores Trigger only, ignores unchanged values and resets on profile switches or external Trigger replacement.
Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z work in the active Trigger workspace without intercepting native text-field undo.
Switch types, the additional Rapid-trigger flag and Berserk labels are local editor settings, not detected hardware
capabilities. Physical switch calibration is explicitly unavailable; neither it nor a device write is simulated.

Key Config shows the active layer, mixed/effective group actions and a per-key assignment list. A command click
applies to the selected group; dragging changes one target only. Empty selection never means the whole board.
Bulk reset confirms before removing only selected overrides in the active layer. Other layers and features remain
unchanged; shortcut capture hides the old command palette and enables assignment only after a valid capture.

Create/rename/copy/delete and validated JSON import/export work with local browser profiles (up to 50).
They auto-save under the `input-studio.keyboard-drafts.v1` localStorage key on this browser/origin; they are not onboard
slots and are not a backup of the whole device. Export a JSON copy before changing browser/profile or clearing site data.
Only Input Studio's versioned draft format is accepted, not native MCHOSE HUB exports. Advanced rules are descriptions,
not a Windows input injector, and the focused tester cannot measure analog travel. Hardware Apply remains disabled;
the editor module has no network/device writer and does not start calibration, firmware updates or factory resets.

## Tests

`npm test`
Tests are offline. Passing tests is **not** physical validation of writes to the keyboard.

## License and affiliation

Input Studio source code and its original illustration are available under the [MIT License](LICENSE).
Third-party dependencies retain their own licenses. MCHOSE and HATOR names are used only to identify tested devices;
this project is not affiliated with or endorsed by either manufacturer. Hardware access is experimental, not universal.
Do not publish raw device snapshots or serial numbers in issues. Describe your model, firmware, connection mode and error instead.
