/* ==========================================================================
   BOZKURT ARCADE — app.js
   XMB tarzı (PS3 referanslı) retro emülatör arayüzü.
   Capacitor WebView içinde çalışır; tarayıcıda da demo veriyle önizlenebilir.
   ========================================================================== */

(function(){
"use strict";

/* --------------------------------------------------------------------
   0. SABİTLER / AYARLAR
   -------------------------------------------------------------------- */

// Uygulama paket adı — capacitor.config.json içindeki appId ile aynı olmalı.
const APP_ID = "com.androbilgic.bozkurtarcade";

// ROM klasörlerinin taban yolu (cihazın harici depolamasında).
// ÖNEMLİ: Capacitor Filesystem'in Directory.External'ı gerçekte
// Android/data/<paket>/files yoluna karşılık gelir (Android/media'ya DEĞİL —
// önceki bir sürümde bu yanlış yazılmıştı, koddaki gerçek davranışla burada
// eşitlendi). Bu yol izin istemeden okunup yazılabiliyor ama bazı stok dosya
// yöneticileri (özellikle Android 11+ telefonlarda) Android/data altını
// gizleyebiliyor; TV kutularındaki üçüncü parti dosya yöneticilerinin
// çoğunda bu kısıtlama yok.
const ROOT_HINT_PATH = `Android/data/${APP_ID}/files/roms`;

// EmulatorJS CDN — build zamanında internet gerekmez, sadece cihazda çalışırken.
const EJS_CDN = "https://cdn.emulatorjs.org/stable/data/";

// Capacitor Filesystem'in "Directory" enum'ı normalde npm paketinden import
// edilir; window.Capacitor.Plugins altında hazır gelmez (script-tag/bundlersız
// kurulumda Directory tanımsız kalıyordu — bu hataya yol açan asıl sebep buydu).
// Native tarafın beklediği ham string değeri burada elle veriyoruz.
const CAP_DIR_EXTERNAL = "EXTERNAL";

/* --------------------------------------------------------------------
   1. SİSTEM TANIMLARI
   -------------------------------------------------------------------- */
// core: EmulatorJS'in beklediği "system" kısa kodu (bkz. emulatorjs.org/docs4devs/cores)
// heavy: cihaza göre performans değişebilir uyarısı gösterilsin mi
// exts: bu sistem için beklenen ROM uzantıları (bilgi amaçlı / dosya filtreleme)

const SYSTEMS = [
  { id:"nes",       name:"NES",              folder:"nes",       core:"nes",     heavy:false, exts:[".nes"] },
  { id:"snes",      name:"SNES",             folder:"snes",      core:"snes",    heavy:false, exts:[".sfc",".smc"] },
  { id:"gba",       name:"Game Boy Advance", folder:"gba",       core:"gba",     heavy:false, exts:[".gba"] },
  { id:"genesis",   name:"Sega Genesis",     folder:"genesis",   core:"segaMD",  heavy:false, exts:[".md",".gen",".bin"] },
  { id:"ps1",       name:"PlayStation",      folder:"ps1",       core:"psx",     heavy:true,  exts:[".cue",".bin",".chd",".pbp"] },
  { id:"n64",       name:"Nintendo 64",      folder:"n64",       core:"n64",     heavy:true,  exts:[".n64",".z64",".v64"] },
  { id:"atari2600", name:"Atari 2600",       folder:"atari2600", core:"atari2600", heavy:false, exts:[".a26",".bin"] },
  { id:"atari7800", name:"Atari 7800",       folder:"atari7800", core:"atari7800", heavy:false, exts:[".a78",".bin"] },
  // Neo Geo, EmulatorJS'te ayrı bir "system" değil — arcade/fbneo çekirdeği
  // üzerinden MVS romset zip'leri ile çalışır.
  { id:"neogeo",    name:"Neo Geo",          folder:"neogeo",    core:"arcade",  heavy:true,  exts:[".zip"] },
];

const PERF_WARNING_TEXT = "Bu sistem cihazınıza göre yavaş çalışabilir. Performans, TV kutunuzun donanımına bağlıdır.";

// Varsayılan kumanda buton index'leri (standart Gamepad API mapping'i).
// Kullanıcı Ayarlar > Kumanda tuş ataması ile bunları değiştirebilir;
// özel eşleme localStorage'a kaydedilir ve bunun yerine kullanılır.
const DEFAULT_GAMEPAD_MAPPING = { confirm:0, back:1, menu:3, quickFav:2 };


/* --------------------------------------------------------------------
   2. İKONLAR (orijinal, sade çizgi ikonlar — marka logosu kullanılmaz)
   -------------------------------------------------------------------- */

const ICON = {
  cart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M9 3v6"/><path d="M13 3v6"/><path d="M6 13h12"/></svg>`,
  disc: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.6"/></svg>`,
  arcade: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M8 9V6a4 4 0 0 1 8 0v3"/><circle cx="9" cy="14.5" r="1.4"/><circle cx="15" cy="14.5" r="1.4"/></svg>`,
  star: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.8Z"/></svg>`,
  starFilled: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.8Z"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/></svg>`,
  gear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2.1 2.1 0 1 1-2.97 2.97l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V20a2.1 2.1 0 0 1-4.2 0v-.1a1.7 1.7 0 0 0-1.1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2.1 2.1 0 1 1-2.97-2.97l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H4a2.1 2.1 0 0 1 0-4.2h.1a1.7 1.7 0 0 0 1.55-1.1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2.1 2.1 0 1 1 2.97-2.97l.06.06a1.7 1.7 0 0 0 1.87.34H10a1.7 1.7 0 0 0 1-1.55V4a2.1 2.1 0 0 1 4.2 0v.1a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2.1 2.1 0 1 1 2.97 2.97l-.06.06a1.7 1.7 0 0 0-.34 1.87V10c.1.45.5.85 1.55 1H20a2.1 2.1 0 0 1 0 4.2h-.1a1.7 1.7 0 0 0-1.5 1.1Z"/></svg>`,
  play: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5-11-6.5Z"/></svg>`,
  resume: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v6h6"/><path d="M4.6 15a8 8 0 1 0 2-8.4L4 10"/></svg>`,
  info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><path d="M12 7.6v.1"/></svg>`,
  folder: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4l2 2.2H19.5A1.5 1.5 0 0 1 21 8.7v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5Z"/></svg>`,
  warn: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5 21.5 20h-19Z"/><path d="M12 9.5v4.5"/><path d="M12 17v.1"/></svg>`,
  gamepad: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 9h10l2.4 6.4a2 2 0 0 1-1.9 2.7 2 2 0 0 1-1.6-.8L14.5 15h-5l-1.4 2.3a2 2 0 0 1-1.6.8 2 2 0 0 1-1.9-2.7Z"/><path d="M8.2 12h2M9.2 11v2"/><circle cx="15" cy="11.6" r=".6" fill="currentColor" stroke="none"/><circle cx="16.6" cy="13" r=".6" fill="currentColor" stroke="none"/></svg>`,
  cross: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 6l12 12M18 6 6 18"/></svg>`,
  circle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="7.5"/></svg>`,
  triangle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 5.5 20 18H4Z"/></svg>`,
  square: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5.5" y="5.5" width="13" height="13" rx="1.2"/></svg>`,
  btnA: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.5"/><text x="12" y="15.6" font-size="9.5" text-anchor="middle" fill="currentColor" stroke="none" font-family="system-ui">A</text></svg>`,
  btnB: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.5"/><text x="12" y="15.6" font-size="9.5" text-anchor="middle" fill="currentColor" stroke="none" font-family="system-ui">B</text></svg>`,
  btnX: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.5"/><text x="12" y="15.6" font-size="9.5" text-anchor="middle" fill="currentColor" stroke="none" font-family="system-ui">X</text></svg>`,
  btnY: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.5"/><text x="12" y="15.6" font-size="9.5" text-anchor="middle" fill="currentColor" stroke="none" font-family="system-ui">Y</text></svg>`,
  tvBack: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H6"/><path d="M11 6l-6 6 6 6"/></svg>`,
  tvOk: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4.5" y="4.5" width="15" height="15" rx="3"/><path d="M9 12.2l2 2 4-4.4"/></svg>`,
};

/* --------------------------------------------------------------------
   3. DEPOLAMA (favoriler / geçmiş / ayarlar) — localStorage tabanlı
   -------------------------------------------------------------------- */

const Store = {
  KEY: "bozkurt_arcade_v1",

  _read(){
    try{
      const raw = localStorage.getItem(this.KEY);
      return raw ? JSON.parse(raw) : { favorites:[], history:[], settings:{} };
    }catch(e){
      return { favorites:[], history:[], settings:{} };
    }
  },
  _write(data){
    try{ localStorage.setItem(this.KEY, JSON.stringify(data)); }catch(e){ /* depolama dolu/erişilemez olabilir, sessizce geç */ }
  },

  romKey(systemId, romPath){ return `${systemId}::${romPath}`; },

  isFavorite(systemId, romPath){
    const data = this._read();
    const key = this.romKey(systemId, romPath);
    return data.favorites.some(f => this.romKey(f.systemId, f.romPath) === key);
  },
  // rom: { systemId, romPath, name }
  toggleFavorite(rom){
    const data = this._read();
    const key = this.romKey(rom.systemId, rom.romPath);
    const idx = data.favorites.findIndex(f => this.romKey(f.systemId, f.romPath) === key);
    if(idx >= 0) data.favorites.splice(idx,1);
    else data.favorites.push({ systemId: rom.systemId, romPath: rom.romPath, name: rom.name });
    this._write(data);
    return idx < 0; // true => artık favori
  },
  getFavorites(){ return this._read().favorites; },

  addHistory(entry){
    // entry: { systemId, romPath, name, ts, hasSave }
    const data = this._read();
    const key = this.romKey(entry.systemId, entry.romPath);
    data.history = data.history.filter(h => this.romKey(h.systemId, h.romPath) !== key);
    data.history.unshift(Object.assign({}, entry, { ts: Date.now() }));
    data.history = data.history.slice(0, 40);
    this._write(data);
  },
  getHistory(){ return this._read().history; },

  markSave(systemId, romPath, has){
    const data = this._read();
    const key = this.romKey(systemId, romPath);
    const h = data.history.find(x => this.romKey(x.systemId, x.romPath) === key);
    if(h){ h.hasSave = has; this._write(data); }
  },

  getGamepadMapping(){
    const data = this._read();
    return data.gamepadMapping || null;
  },
  setGamepadMapping(map){
    const data = this._read();
    data.gamepadMapping = map;
    this._write(data);
  },
  clearGamepadMapping(){
    const data = this._read();
    delete data.gamepadMapping;
    this._write(data);
  },
};

/* --------------------------------------------------------------------
   4. ROM TARAYICI
   Gerçek cihazda Capacitor Filesystem eklentisi ile ROOT_HINT_PATH altındaki
   sistem klasörlerini tarar. Tarayıcı önizlemesinde (Capacitor yoksa) demo
   verisiyle çalışır ki arayüz geliştirme sırasında test edilebilsin.
   -------------------------------------------------------------------- */

const RomScanner = {

  lastErrors: [], // { systemId, message } — tarama sırasında oluşan gerçek hatalar (klasör-yok dışında)

  hasCapacitorFilesystem(){
    return !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem);
  },

  async scanSystem(system){
    if(this.hasCapacitorFilesystem()){
      return this._scanNative(system);
    }
    return this._scanDemo(system);
  },

  async _scanNative(system){
    const { Filesystem } = window.Capacitor.Plugins;
    const path = `roms/${system.folder}`;
    try{
      const res = await Filesystem.readdir({ path, directory: CAP_DIR_EXTERNAL });
      const files = (res.files || [])
        .filter(f => {
          const nm = (f.name || f).toLowerCase();
          return system.exts.some(ext => nm.endsWith(ext));
        })
        .map(f => {
          const name = f.name || f;
          return {
            name: this._prettyName(name),
            path: `${path}/${name}`,
            raw: name,
          };
        });
      files.sort((a,b) => a.name.localeCompare(b.name, "tr"));
      return files;
    }catch(e){
      // "Klasör yok" hatası normaldir (henüz ROM eklenmemiş olabilir), sessiz geç.
      // Başka bir hata ise (izin, okuma hatası vb.) kullanıcıya göstermek üzere kaydet.
      const msg = (e && e.message) || String(e);
      if(!/does not exist|not found|ENOENT/i.test(msg)){
        this.lastErrors.push({ systemId: system.id, message: msg });
      }
      return [];
    }
  },

  async _ensureFolders(){
    if(!this.hasCapacitorFilesystem()) return;
    const { Filesystem } = window.Capacitor.Plugins;
    for(const sys of SYSTEMS){
      try{
        await Filesystem.mkdir({ path:`roms/${sys.folder}`, directory:CAP_DIR_EXTERNAL, recursive:true });
      }catch(e){
        // "Zaten var" hatası beklenir ve normaldir; başka bir şeyse kaydet.
        const msg = (e && e.message) || String(e);
        if(!/already exists|EEXIST/i.test(msg)){
          this.lastErrors.push({ systemId: sys.id, message: msg });
        }
      }
    }
  },

  _prettyName(filename){
    return filename.replace(/\.[^/.]+$/, "").replace(/[._]+/g," ").trim();
  },

  // Tarayıcıda XMB navigasyonunu ve alt menüyü test edebilmek için örnek veri.
  _scanDemo(system){
    const demo = {
      nes:   ["Super Mario Bros (World)", "Contra (USA)", "Mega Man 2 (USA)"],
      snes:  ["Super Mario World (Europe) (Rev 1)", "Chrono Trigger (USA)"],
      gba:   ["Pokemon Emerald (USA)", "Metroid Fusion (USA)"],
      genesis:["Sonic The Hedgehog 2 (World)", "Streets of Rage 2 (World)"],
      ps1:   ["Crash Bandicoot (USA)", "Final Fantasy VII (Disc 1) (USA)"],
      n64:   ["Super Mario 64 (USA)", "Mario Kart 64 (USA)"],
      atari2600:["Pitfall (USA)", "Space Invaders (USA)"],
      atari7800:["Ninja Golf (USA)"],
      neogeo:["Metal Slug (NGM-2410)"],
    };
    return Promise.resolve((demo[system.id] || []).map(n => ({
      name: n, path: `roms/${system.folder}/${n}`, raw:n,
    })));
  },
};

/* --------------------------------------------------------------------
   5. KUMANDA YÖNETİMİ (Web Gamepad API)
   - Bağlan/kopma bildirimleri
   - Marka algılama (PlayStation / Xbox / jenerik) -> ipucu ikon seti
   - Çoklu kumanda: oyuncu slotu atama (index sırasına göre)
   -------------------------------------------------------------------- */

const GamepadManager = {
  players: new Map(),   // gamepadIndex -> { slot, kind, name }
  nextSlot: 1,
  _rafId: null,
  _prevButtons: new Map(), // gamepadIndex -> bool[] (önceki basılı durum, debounce için)
  _lastMoveTs: 0,
  MOVE_REPEAT_MS: 170,
  _captureCallback: null, // tuş ataması sırasında bir sonraki basılan tuşu yakalamak için

  // Bir sonraki gamepad buton basışını normal navigasyona göndermek yerine
  // callback'e iletir. Tuş ataması ekranı bunu kullanır.
  captureNextButton(callback){
    this._captureCallback = callback;
  },
  cancelCapture(){
    this._captureCallback = null;
  },

  mapping(){
    return Store.getGamepadMapping() || DEFAULT_GAMEPAD_MAPPING;
  },

  detectKind(id){
    const s = (id || "").toLowerCase();
    if(/(dualsense|dualshock|playstation|sony|wireless controller)/.test(s)) return "playstation";
    if(/(xbox|xinput)/.test(s)) return "xbox";
    return "generic"; // jenerik kumandalarda Xbox düzeni varsayılan
  },

  init(onConnect, onDisconnect, onAction){
    this.onAction = onAction;
    window.addEventListener("gamepadconnected", (e) => {
      const gp = e.gamepad;
      const slot = this.nextSlot++;
      const kind = this.detectKind(gp.id);
      this.players.set(gp.index, { slot, kind, name: gp.id });
      onConnect({ slot, kind, name: gp.id });
      this._ensureLoop();
    });
    window.addEventListener("gamepaddisconnected", (e) => {
      const info = this.players.get(e.gamepad.index);
      this.players.delete(e.gamepad.index);
      this._prevButtons.delete(e.gamepad.index);
      if(info) onDisconnect(info);
    });
  },

  activeKind(){
    // İpucu çubuğunda gösterilecek birincil kumanda tipi: en düşük slotlu (1. oyuncu).
    let best = null;
    for(const info of this.players.values()){
      if(!best || info.slot < best.slot) best = info;
    }
    return best ? best.kind : null;
  },

  hasAny(){ return this.players.size > 0; },

  _ensureLoop(){
    if(this._rafId) return;
    const step = () => {
      this._poll();
      this._rafId = requestAnimationFrame(step);
    };
    this._rafId = requestAnimationFrame(step);
  },

  _poll(){
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const now = performance.now();
    for(const gp of pads){
      if(!gp) continue;
      const info = this.players.get(gp.index);
      if(!info) continue;
      const prev = this._prevButtons.get(gp.index) || [];
      const cur = gp.buttons.map(b => b.pressed || b.value > 0.5);
      const pressedNow = (i) => cur[i] && !prev[i];

      // Tuş ataması modu: bir sonraki basılan butonu callback'e ilet, normal
      // navigasyonu bu karede atla (sadece 1. oyuncu kumandasından okunur).
      if(this._captureCallback && info.slot === 1){
        for(let i = 0; i < cur.length; i++){
          if(pressedNow(i)){
            const cb = this._captureCallback;
            this._captureCallback = null;
            this._prevButtons.set(gp.index, cur);
            cb(i);
            return;
          }
        }
        this._prevButtons.set(gp.index, cur);
        continue;
      }

      // D-pad standart mapping: 12 yukarı, 13 aşağı, 14 sol, 15 sağ
      const axisX = gp.axes[0] || 0, axisY = gp.axes[1] || 0;
      const dirs = {
        up:    cur[12] || axisY < -0.55,
        down:  cur[13] || axisY > 0.55,
        left:  cur[14] || axisX < -0.55,
        right: cur[15] || axisX > 0.55,
      };
      const anyDir = dirs.up || dirs.down || dirs.left || dirs.right;
      if(anyDir && now - this._lastMoveTs > this.MOVE_REPEAT_MS && info.slot === 1){
        this._lastMoveTs = now;
        if(dirs.up) this.onAction("up", info);
        else if(dirs.down) this.onAction("down", info);
        else if(dirs.left) this.onAction("left", info);
        else if(dirs.right) this.onAction("right", info);
      }

      // Kenar tetiklemeli butonlar (basılı tutmada tekrar etmesin) — kullanıcının
      // özel tuş ataması varsa onu, yoksa varsayılan mapping'i kullan.
      if(info.slot === 1){
        const m = this.mapping();
        if(pressedNow(m.confirm)) this.onAction("confirm", info);
        if(pressedNow(m.back)) this.onAction("back", info);
        if(pressedNow(m.menu)) this.onAction("menu", info);
        if(pressedNow(m.quickFav)) this.onAction("quickFav", info);
        if(pressedNow(9)) this.onAction("confirm", info); // Start/Options (bazı jenerik kumandalar)
      }
      this._prevButtons.set(gp.index, cur);
    }
  },
};

/* --------------------------------------------------------------------
   6. KLAVYE / ANDROID TV UZAKTAN KUMANDA
   Android TV'nin sistem uzaktan kumandası tarayıcıya klavye event'i olarak
   düşer (ok tuşları, Enter=seç, Backspace/Escape=geri).
   -------------------------------------------------------------------- */

const KeyboardManager = {
  init(onAction, onInputTypeChange){
    window.addEventListener("keydown", (e) => {
      let handled = true;
      switch(e.key){
        case "ArrowUp": onAction("up"); break;
        case "ArrowDown": onAction("down"); break;
        case "ArrowLeft": onAction("left"); break;
        case "ArrowRight": onAction("right"); break;
        case "Enter": onAction("confirm"); break;
        case "Backspace":
        case "Escape": onAction("back"); break;
        case "ContextMenu": onAction("menu"); break;
        default: handled = false;
      }
      if(handled){
        onInputTypeChange("tv");
        e.preventDefault();
      }
    });
  },
};

/* --------------------------------------------------------------------
   7. UYGULAMA DURUMU + XMB GİRİŞLERİ
   -------------------------------------------------------------------- */

const App = {
  entries: [],      // { id, name, kind:'favorites'|'history'|'system'|'settings', icon, system?, roms:[] }
  rowIndex: 0,
  listIndex: 0,
  zone: "row",       // 'row' | 'list' | 'submenu'
  submenuItems: [],
  submenuIndex: 0,
  submenuRom: null,
  activeInputType: "generic", // 'generic' | 'xbox' | 'playstation' | 'tv'
  clockTimer: null,
};

function buildEntries(){
  const favEntry = { id:"favorites", name:"Sık Kullanılanlar", kind:"favorites", icon:"star", roms:[] };
  const histEntry = { id:"history", name:"Son Oynananlar", kind:"history", icon:"clock", roms:[] };
  const settingsEntry = { id:"settings", name:"Ayarlar", kind:"settings", icon:"gear", roms:[] };

  const systemEntries = SYSTEMS.map(sys => ({
    id: sys.id, name: sys.name, kind:"system", icon: sys.core === "arcade" ? "arcade" : (sys.core === "psx" ? "disc" : "cart"),
    system: sys, roms: [],
  }));

  App.entries = [favEntry, histEntry, ...systemEntries, settingsEntry];
}

async function refreshScans(){
  RomScanner.lastErrors = [];
  await RomScanner._ensureFolders();
  for(const entry of App.entries){
    if(entry.kind === "system"){
      entry.roms = await RomScanner.scanSystem(entry.system);
    }
  }
  refreshVirtualLists();

  if(RomScanner.lastErrors.length){
    const first = RomScanner.lastErrors[0];
    showToast("warn", `Tarama hatası (${systemNameOf(first.systemId)}): ${first.message}`);
  }
}

function refreshVirtualLists(){
  const favs = Store.getFavorites();
  const favEntry = App.entries.find(e => e.id === "favorites");
  favEntry.roms = favs.map(f => ({ name:f.name, path:f.romPath, raw:f.name, systemId:f.systemId }));

  const hist = Store.getHistory();
  const histEntry = App.entries.find(e => e.id === "history");
  histEntry.roms = hist.map(h => ({
    name:h.name, path:h.romPath, raw:h.name, systemId:h.systemId,
    sub: formatHistorySub(h),
  }));
}

function formatHistorySub(h){
  const d = new Date(h.ts);
  const dateStr = d.toLocaleDateString("tr-TR");
  const sysName = systemNameOf(h.systemId);
  return `${sysName} • ${dateStr}`;
}

function systemNameOf(systemId){
  const s = SYSTEMS.find(x => x.id === systemId);
  return s ? s.name : systemId;
}

function systemOf(systemId){
  return SYSTEMS.find(x => x.id === systemId);
}

/* --------------------------------------------------------------------
   8. RENDER
   -------------------------------------------------------------------- */

const el = {
  row: document.getElementById("xmb-row"),
  headingIcon: document.getElementById("heading-icon"),
  headingName: document.getElementById("heading-name"),
  headingDesc: document.getElementById("heading-desc"),
  list: document.getElementById("list-items"),
  listEmpty: document.getElementById("list-empty"),
  perfBanner: document.getElementById("perf-banner"),
  submenuOverlay: document.getElementById("submenu-overlay"),
  submenuTitle: document.getElementById("submenu-title"),
  submenuSub: document.getElementById("submenu-sub"),
  submenuList: document.getElementById("submenu-list"),
  hintbar: document.getElementById("hintbar"),
  bg: document.getElementById("bg"),
  playersIndicator: document.getElementById("players-indicator"),
  clock: document.getElementById("clock"),
  toastStack: document.getElementById("toast-stack"),
  pageTitle: document.getElementById("page-title"),
};

function renderRow(){
  el.row.innerHTML = "";
  App.entries.forEach((entry, i) => {
    const div = document.createElement("div");
    div.className = "xmb-icon" + (i === App.rowIndex ? " current" : "") + (i === App.rowIndex && App.zone === "row" ? " focused" : "");
    div.innerHTML = ICON[entry.icon] || ICON.cart;
    el.row.appendChild(div);
  });
  // Seçili ikonu görünür alana kaydır
  const current = el.row.children[App.rowIndex];
  if(current) current.scrollIntoView({ inline:"center", block:"nearest", behavior:"instant" in document.documentElement.style ? "auto":"auto" });
}

function currentEntry(){ return App.entries[App.rowIndex]; }

function renderHeading(){
  const entry = currentEntry();
  el.headingIcon.innerHTML = ICON[entry.icon] || "";
  el.headingName.textContent = entry.name;
  if(entry.kind === "system"){
    el.headingDesc.textContent = `${entry.roms.length} oyun`;
  }else if(entry.kind === "favorites"){
    el.headingDesc.textContent = entry.roms.length ? `${entry.roms.length} favori` : "";
  }else if(entry.kind === "history"){
    el.headingDesc.textContent = entry.roms.length ? "en son oynananlar" : "";
  }else{
    el.headingDesc.textContent = "";
  }
  el.pageTitle.textContent = entry.kind === "settings" ? "Ayarlar" : "Bozkurt Arcade";
}

function renderList(){
  const entry = currentEntry();
  el.list.innerHTML = "";

  if(entry.kind === "settings"){
    renderSettingsList(entry);
    return;
  }

  if(!entry.roms.length){
    el.listEmpty.hidden = false;
    el.list.hidden = true;
    if(entry.kind === "system"){
      el.listEmpty.innerHTML = `${ICON.folder} <span>ROM bulunamadı. Dosyaları şu klasöre kopyalayın: ${ROOT_HINT_PATH}/${entry.system.folder}/</span>`;
    }else if(entry.kind === "favorites"){
      el.listEmpty.innerHTML = `${ICON.star} <span>Henüz favori eklenmedi. Bir oyunda menüden "Favorilere Ekle" seçin.</span>`;
    }else if(entry.kind === "history"){
      el.listEmpty.innerHTML = `${ICON.clock} <span>Henüz oynanan oyun yok.</span>`;
    }
    renderPerfBanner(null);
    return;
  }

  el.listEmpty.hidden = true;
  el.list.hidden = false;

  entry.roms.forEach((rom, i) => {
    const sysId = rom.systemId || entry.system.id;
    const isFav = Store.isFavorite(sysId, rom.path);
    const row = document.createElement("div");
    row.className = "list-item" + (i === App.listIndex && App.zone === "list" ? " focused" : "");
    row.innerHTML = `
      <span class="file-icon">${ICON.cart}</span>
      <span class="meta">
        <span class="title">${escapeHtml(rom.name)}</span>
        <span class="sub">${escapeHtml(rom.sub || systemNameOf(sysId))}</span>
      </span>
      ${isFav ? `<span class="fav-mark">${ICON.starFilled}</span>` : ""}
    `;
    el.list.appendChild(row);
  });

  const focusedEl = el.list.children[App.listIndex];
  if(focusedEl) focusedEl.scrollIntoView({ block:"nearest" });

  renderPerfBanner(entry.kind === "system" ? entry.system : null);
}

function renderSettingsList(entry){
  el.listEmpty.hidden = true;
  el.list.hidden = false;
  const items = [
    { label:"Klasörleri yeniden tara", sub:"Yeni eklediğiniz ROM'ları listeye al", action:"rescan" },
    { label:"ROM klasör yolu", sub:ROOT_HINT_PATH, action:"info" },
    {
      label:"Kumanda tuş ataması",
      sub: GamepadManager.hasAny()
        ? (Store.getGamepadMapping() ? "Özel eşleme kayıtlı — değiştirmek için seçin" : "Varsayılan eşleme kullanılıyor — değiştirmek için seçin")
        : "Önce bir kumanda bağlayın",
      action:"remap",
      disabled: !GamepadManager.hasAny(),
    },
  ];
  items.forEach((it, i) => {
    const row = document.createElement("div");
    row.className = "list-item"
      + (i === App.listIndex && App.zone === "list" ? " focused" : "")
      + (it.disabled ? " disabled" : "");
    if(it.disabled) row.style.opacity = "0.4";
    row.innerHTML = `
      <span class="file-icon">${ICON.gear}</span>
      <span class="meta">
        <span class="title">${escapeHtml(it.label)}</span>
        <span class="sub">${escapeHtml(it.sub)}</span>
      </span>`;
    el.list.appendChild(row);
  });
  entry.roms = items; // basit yeniden kullanım: confirm() bu diziden okuyacak
  renderPerfBanner(null);
}

function renderPerfBanner(system){
  if(system && system.heavy){
    el.perfBanner.hidden = false;
    el.perfBanner.innerHTML = `${ICON.warn} <span>${PERF_WARNING_TEXT}</span>`;
  }else{
    el.perfBanner.hidden = true;
  }
}

function renderHints(){
  const t = App.activeInputType;
  const map = {
    generic: { back:"btnB", confirm:"btnA", menu:"btnY", fav:"btnX" },
    xbox:    { back:"btnB", confirm:"btnA", menu:"btnY", fav:"btnX" },
    playstation: { back:"circle", confirm:"cross", menu:"triangle", fav:"square" },
    tv:      { back:"tvBack", confirm:"tvOk", menu:null, fav:null },
  };
  const set = map[t] || map.generic;

  let hints = "";
  if(App.zone === "submenu"){
    hints += hint(set.confirm, "Seç");
    hints += hint(set.back, "Kapat");
  }else if(App.zone === "list"){
    hints += hint(set.confirm, "Aç");
    hints += hint(set.back, "Geri");
    if(set.fav) hints += hint(set.fav, "Favori");
  }else{
    hints += hint(set.confirm, "Gir");
    if(set.back) hints += hint(set.back, "Çıkış");
  }
  el.hintbar.innerHTML = hints;
}

function hint(iconKey, label){
  if(!iconKey) return "";
  return `<span class="hint">${ICON[iconKey]}<span>${label}</span></span>`;
}

function renderPlayers(){
  el.playersIndicator.innerHTML = GamepadManager.hasAny()
    ? `${ICON.gamepad}<span>${GamepadManager.players.size}</span>` : "";
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

function renderAll(){
  renderRow();
  renderHeading();
  renderList();
  renderHints();
  renderPlayers();
}

/* --------------------------------------------------------------------
   9. NAVİGASYON
   -------------------------------------------------------------------- */

function handleAction(action){
  if(App.zone === "row") return handleRowAction(action);
  if(App.zone === "list") return handleListAction(action);
  if(App.zone === "submenu") return handleSubmenuAction(action);
  if(App.zone === "remap"){
    if(action === "back") closeRemap(); // yalnızca klavye/TV Escape ile iptal edilebilir
    return;
  }
}

function handleRowAction(action){
  if(action === "left"){
    App.rowIndex = Math.max(0, App.rowIndex - 1);
    App.listIndex = 0;
    renderAll();
  }else if(action === "right"){
    App.rowIndex = Math.min(App.entries.length - 1, App.rowIndex + 1);
    App.listIndex = 0;
    renderAll();
  }else if(action === "down" || action === "confirm"){
    // Liste boş olsa bile içeri gir — "ROM bulunamadı" mesajı gösterilsin,
    // aksi halde tuşun hiçbir şey yapmadığı izlenimi oluşuyordu.
    App.zone = "list";
    renderAll();
  }
}

function handleListAction(action){
  const entry = currentEntry();
  const count = entry.roms.length;
  if(!count){
    // Boş liste: yukarı veya geri ile satıra dön, başka bir şey yapma.
    if(action === "up" || action === "back"){ App.zone = "row"; renderAll(); }
    return;
  }
  if(action === "up"){
    if(App.listIndex === 0){ App.zone = "row"; renderAll(); return; }
    App.listIndex = Math.max(0, App.listIndex - 1);
    renderAll();
  }else if(action === "down"){
    App.listIndex = Math.min(count - 1, App.listIndex + 1);
    renderAll();
  }else if(action === "back"){
    App.zone = "row";
    renderAll();
  }else if(action === "confirm" || action === "menu"){
    if(entry.kind === "settings"){
      handleSettingsConfirm(entry.roms[App.listIndex]);
    }else{
      openSubmenu(entry, entry.roms[App.listIndex]);
    }
  }else if(action === "quickFav"){
    if(entry.kind !== "settings"){
      const rom = entry.roms[App.listIndex];
      const sysId = rom.systemId || entry.system.id;
      const nowFav = Store.toggleFavorite({ systemId:sysId, romPath:rom.path, name:rom.name });
      refreshVirtualLists();
      showToast(nowFav ? "star" : "star", nowFav ? "Favorilere eklendi" : "Favorilerden çıkarıldı");
      renderList();
    }
  }
}

function handleSettingsConfirm(item){
  if(!item || item.disabled) return;
  if(item.action === "rescan"){
    showToast("folder", "Klasörler yeniden taranıyor…");
    refreshScans().then(() => { renderAll(); showToast("tvOk", "Tarama tamamlandı"); });
  }else if(item.action === "remap"){
    startRemap();
  }
  // 'info' aksiyonu şimdilik bilgi amaçlı, ek işlem gerekmiyor.
}

/* --------------------------------------------------------------------
   10b. KUMANDA TUŞ ATAMASI (Ayarlar > Kumanda tuş ataması)
   Kullanıcıyı sırayla "Seç/Onayla", "Geri", "Menü Aç", "Hızlı Favori"
   için bir tuşa basmaya yönlendirir, basılan buton index'lerini kaydeder.
   D-pad/analog eksen ataması bu sürümde değiştirilemez (kapsam dışı).
   -------------------------------------------------------------------- */

const REMAP_STEPS = [
  { action:"confirm",  label:"Seç / Onayla" },
  { action:"back",     label:"Geri" },
  { action:"menu",     label:"Menü Aç (oyun alt menüsü)" },
  { action:"quickFav", label:"Hızlı Favori Ekle/Çıkar" },
];

function startRemap(){
  App._remapResult = {};
  App._remapIndex = 0;
  App.zone = "remap";
  showRemapOverlay();
  runRemapStep();
}

function runRemapStep(){
  if(App._remapIndex >= REMAP_STEPS.length){
    Store.setGamepadMapping(App._remapResult);
    closeRemap();
    showToast("gamepad", "Tuş ataması kaydedildi");
    renderAll();
    return;
  }
  const step = REMAP_STEPS[App._remapIndex];
  el.submenuTitle.textContent = "Kumanda Tuş Ataması";
  el.submenuSub.textContent = `${App._remapIndex + 1}/${REMAP_STEPS.length} — "${step.label}" için kumandanızda bir tuşa basın`;
  el.submenuList.innerHTML = `<li class="submenu-item disabled">${ICON.gamepad}<span>Bekleniyor… (İptal için Esc)</span></li>`;

  GamepadManager.captureNextButton((buttonIndex) => {
    App._remapResult[step.action] = buttonIndex;
    App._remapIndex++;
    runRemapStep();
  });
}

function showRemapOverlay(){
  el.submenuOverlay.hidden = false;
  el.bg.classList.add("dim");
}

function closeRemap(){
  GamepadManager.cancelCapture();
  el.submenuOverlay.hidden = true;
  el.bg.classList.remove("dim");
  App.zone = "list";
  renderHints();
}

/* --------------------------------------------------------------------
   10. ALT MENÜ (oyuna basınca açılan bağlam menüsü)
   -------------------------------------------------------------------- */

function openSubmenu(entry, rom){
  const sysId = rom.systemId || entry.system.id;
  const system = systemOf(sysId);
  const hasSave = !!(Store.getHistory().find(h => h.systemId === sysId && h.romPath === rom.path && h.hasSave));
  const isFav = Store.isFavorite(sysId, rom.path);

  App.submenuRom = { systemId: sysId, romPath: rom.path, name: rom.name, system };
  App.submenuItems = [
    { key:"play", label:"Oyunu Başlat", icon:"play" },
    { key:"resume", label:"Son Kaydı Yükle", icon:"resume", disabled: !hasSave },
    { key:"fav", label: isFav ? "Favorilerden Çıkar" : "Favorilere Ekle", icon: isFav ? "starFilled" : "star" },
    { key:"info", label:"Bilgi", icon:"info" },
  ];
  App.submenuIndex = 0;
  App.zone = "submenu";

  el.submenuTitle.textContent = rom.name;
  el.submenuSub.textContent = system ? system.name : systemNameOf(sysId);
  renderSubmenu();
  el.submenuOverlay.hidden = false;
  el.bg.classList.add("dim");
  renderHints();
}

function closeSubmenu(){
  el.submenuOverlay.hidden = true;
  el.bg.classList.remove("dim");
  App.zone = "list";
  renderHints();
}

function renderSubmenu(){
  el.submenuList.innerHTML = "";
  App.submenuItems.forEach((item, i) => {
    const li = document.createElement("li");
    li.className = "submenu-item"
      + (i === App.submenuIndex ? " focused" : "")
      + (item.disabled ? " disabled" : "");
    li.innerHTML = `${ICON[item.icon]}<span>${escapeHtml(item.label)}</span>`;
    el.submenuList.appendChild(li);
  });
}

function handleSubmenuAction(action){
  if(action === "up"){
    App.submenuIndex = (App.submenuIndex - 1 + App.submenuItems.length) % App.submenuItems.length;
    renderSubmenu();
  }else if(action === "down"){
    App.submenuIndex = (App.submenuIndex + 1) % App.submenuItems.length;
    renderSubmenu();
  }else if(action === "back" || action === "menu"){
    closeSubmenu();
  }else if(action === "confirm"){
    const item = App.submenuItems[App.submenuIndex];
    if(item.disabled) return;
    runSubmenuItem(item.key);
  }
}

function runSubmenuItem(key){
  const rom = App.submenuRom;
  if(key === "play"){
    closeSubmenu();
    launchEmulator(rom, { resume:false });
  }else if(key === "resume"){
    closeSubmenu();
    launchEmulator(rom, { resume:true });
  }else if(key === "fav"){
    const nowFav = Store.toggleFavorite({ systemId:rom.systemId, romPath:rom.romPath, name:rom.name });
    refreshVirtualLists();
    showToast("star", nowFav ? "Favorilere eklendi" : "Favorilerden çıkarıldı");
    closeSubmenu();
    renderList();
  }else if(key === "info"){
    showToast("info", `${rom.system ? rom.system.name : ""} • ${rom.name}`);
    closeSubmenu();
  }
}

/* --------------------------------------------------------------------
   11. TOAST BİLDİRİMLERİ
   -------------------------------------------------------------------- */

function showToast(iconKey, message){
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = `${ICON[iconKey] || ICON.info}<span>${escapeHtml(message)}</span>`;
  el.toastStack.appendChild(t);
  setTimeout(() => {
    t.classList.add("leaving");
    setTimeout(() => t.remove(), 220);
  }, 3200);
}

/* --------------------------------------------------------------------
   12. EMÜLATÖR BAŞLATMA (EmulatorJS)
   -------------------------------------------------------------------- */

function launchEmulator(rom, opts){
  const overlay = document.getElementById("emulator-overlay");
  const gameDiv = document.getElementById("game");
  const nameEl = document.getElementById("emu-game-name");
  gameDiv.innerHTML = "";
  nameEl.textContent = rom.name;
  overlay.hidden = false;

  window.EJS_player = "#game";
  window.EJS_core = rom.system.core;
  window.EJS_pathToData = EJS_CDN;
  window.EJS_gameUrl = resolveRomUrl(rom);
  window.EJS_gameName = rom.name;
  window.EJS_startOnLoaded = true;
  window.EJS_backgroundColor = "#000000";
  window.EJS_language = "tr-TR";
  window.EJS_loadStateOnStart = !!opts.resume;

  window.EJS_onGameStart = function(){
    Store.addHistory({ systemId: rom.systemId, romPath: rom.romPath, name: rom.name });
  };
  window.EJS_onSaveState = function(){
    Store.markSave(rom.systemId, rom.romPath, true);
  };

  const script = document.createElement("script");
  script.src = EJS_CDN + "loader.js";
  document.body.appendChild(script);

  // Çıkış: EmulatorJS kendi menüsünde "Exit" seçeneği sunar; burada ayrıca
  // donanım geri tuşu / Escape ile XMB'ye dönüşü de destekliyoruz.
  App._emuEscHandler = (e) => {
    if(e.key === "Escape"){ exitEmulator(); }
  };
  window.addEventListener("keydown", App._emuEscHandler);
}

function exitEmulator(){
  const overlay = document.getElementById("emulator-overlay");
  overlay.hidden = true;
  document.getElementById("game").innerHTML = "";
  window.removeEventListener("keydown", App._emuEscHandler);
  refreshVirtualLists();
  renderAll();
}

function resolveRomUrl(rom){
  // Native ortamda Capacitor Filesystem yolunu EmulatorJS'in okuyabileceği
  // bir dosya URI'sine çeviriyoruz (Capacitor.convertFileSrc).
  if(window.Capacitor && window.Capacitor.convertFileSrc){
    return window.Capacitor.convertFileSrc(rom.romPath);
  }
  // Tarayıcı önizlemesinde gerçek ROM verisi yok; bu yalnızca arayüz akışını
  // test etmek içindir, dosya bulunamayacağı için EmulatorJS hata gösterecektir.
  return rom.romPath;
}

/* --------------------------------------------------------------------
   13. BAŞLATMA
   -------------------------------------------------------------------- */

function updateClock(){
  const d = new Date();
  const hh = String(d.getHours()).padStart(2,"0");
  const mm = String(d.getMinutes()).padStart(2,"0");
  el.clock.textContent = `${hh}:${mm}`;
}

function initInputs(){
  GamepadManager.init(
    (info) => {
      App.activeInputType = GamepadManager.activeKind() || App.activeInputType;
      renderHints();
      renderPlayers();
      const kindLabel = { playstation:"PlayStation tarzı", xbox:"Xbox tarzı", generic:"Jenerik" }[info.kind] || "Kumanda";
      showToast("gamepad", `Kumanda bağlandı — ${info.slot}. Oyuncu (${kindLabel})`);
    },
    (info) => {
      App.activeInputType = GamepadManager.activeKind() || "generic";
      renderHints();
      renderPlayers();
      showToast("gamepad", `Kumanda bağlantısı kesildi — ${info.slot}. Oyuncu`);
    },
    (action) => {
      if(!document.getElementById("emulator-overlay").hidden) return; // oyun içindeyken XMB navigasyonu pasif
      handleAction(action);
    }
  );

  KeyboardManager.init(
    (action) => {
      if(!document.getElementById("emulator-overlay").hidden) return;
      handleAction(action);
    },
    (type) => {
      if(App.activeInputType !== type){
        App.activeInputType = type;
        renderHints();
      }
    }
  );
}

async function init(){
  buildEntries();
  renderAll();
  updateClock();
  App.clockTimer = setInterval(updateClock, 15000);
  initInputs();

  await refreshScans();
  renderAll();
}

document.addEventListener("DOMContentLoaded", init);

})();
