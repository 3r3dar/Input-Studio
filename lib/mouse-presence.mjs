// Detection only. A wired identity is not authorization to reuse receiver commands.
export function mousePresence(devices,adapterAvailable=true) {
  const wired=devices.some(d=>d.vendorId===0x258a&&d.productId===0x002e);
  const receiver=devices.some(d=>d.vendorId===0x258a&&d.productId===0x002f);
  const mode=wired?(receiver?'both':'wired'):receiver?'receiver':'disconnected';
  return {connected:wired||receiver,mode,readSupported:receiver&&!wired&&adapterAvailable,
    warning:wired?'Мишу виявлено через USB-кабель (258A:002E). Читання та зміна налаштувань у цьому режимі ще не перевірені; команди приймача 002F не надсилаються.':receiver?(adapterAvailable?null:'Приймач HATOR виявлено. Адаптер налаштувань не входить до публічної збірки; доступне лише визначення пристрою. Докладніше — у README. Закрий і запусти сервер після підключення власного адаптера.'):'HATOR Pulsar не виявлено: підключи USB-кабель або приймач 2.4 ГГц.'};
}
