# Bozkurt Arcade

Android TV öncelikli, PS3 XMB tarzı retro emülatör arayüzü. Aynı kod tabanı
telefon/tablette de çalışır. NES, SNES, Game Boy Advance, Sega Genesis,
PlayStation, Nintendo 64, Atari 2600/7800 ve Neo Geo'yu destekler.

## Nasıl çalışıyor

- **Arayüz:** `www/index.html` + `www/app.js` — framework yok, tek dosya
  vanilla JS. Sistemler arası D-pad/gamepad ile yatay, oyun listesinde
  dikey gezinme (XMB mantığı).
- **Emülasyon:** [EmulatorJS](https://emulatorjs.org) (WebAssembly RetroArch
  çekirdekleri), CDN üzerinden `cdn.emulatorjs.org` — build zamanında internet
  gerekmez, yalnızca cihazda oyun başlatılırken.
- **Native köprü:** Capacitor. ROM dosyaları `@capacitor/filesystem` ile
  okunuyor, `Capacitor.convertFileSrc` ile EmulatorJS'in oynatabileceği bir
  URI'ye çevriliyor.

## ROM klasör yapısı

Uygulama ilk açılışta cihazda şu klasörleri oluşturur:

```
Android/data/com.androbilgic.bozkurtarcade/files/roms/
├── nes/
├── snes/
├── gba/
├── genesis/
├── ps1/
├── n64/
├── atari2600/
├── atari7800/
└── neogeo/
```

Kullanıcı sitenden indirdiği ROM dosyalarını ilgili klasöre kopyaladıktan
sonra Ayarlar → "Klasörleri yeniden tara" ile listeye eklenir.

**Düzeltme notu:** Erken tasarım aşamasında `Android/media/<paket>/roms`
yolu planlanmıştı, ama kod Capacitor Filesystem'in `Directory.External`
seçeneğini kullanıyor ve bu gerçekte `Android/data/<paket>/files` yoluna
karşılık geliyor — yukarıdaki yol gerçek/doğru olandır. Bu yol izin
istemeden okunup yazılabiliyor ama bazı stok dosya yöneticileri
(özellikle Android 11+ telefonlarda) `Android/data` altını gizleyebiliyor;
TV kutularındaki üçüncü parti dosya yöneticilerinin çoğunda bu kısıtlama
yok. Planlanan ayrı dosya yöneticisi uygulaması veya uygulama içi bir SAF
tabanlı "içe aktar" düğmesi bu sürtünmeyi tamamen ortadan kaldıracaktır.

## Eksik / bir sonraki adımlar

Bu ilk iskelet şunları **içermiyor**, birlikte sırayla ekleyebiliriz:

1. **Gerçek cihaz testi** — Gamepad buton index'leri (0=A/Cross, 1=B/Circle,
   2=X/Square, 3=Y/Triangle, 12-15=D-pad) standart mapping'e göre yazıldı;
   bazı Bluetooth TV kumandalarında index farklı çıkabilir, ilk cihaz
   testinde kalibre edilmeli.
2. **TV banner görseli** — `android-res/tv/drawable-xhdpi/tv_banner.png`
   (320×180) eklenmeden TV launcher'da ikon görünmez; `patch-android-tv.js`
   bu dosyayı referans alıyor ama görseli oluşturmuyor.
3. ~~Kumanda manuel eşleme ekranı~~ — eklendi (Ayarlar → "Kumanda tuş
   ataması"). D-pad/analog eksen ataması bu sürümde değiştirilemez, sadece
   Seç/Geri/Menü/Favori butonları yeniden atanabilir.
4. **İmzalama sırları** — GitHub Actions workflow'u `ANDROID_SIGNING_KEY`,
   `ANDROID_KEY_ALIAS`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD`
   repo secrets'larını bekliyor.
5. **ROM içe aktarma ekranı** — şu an kullanıcı dosyaları elle/USB ile
   kopyalıyor; ileride planladığınız dosya yöneticisi veya basit bir SAF
   dosya seçici burada devreye girebilir.
6. **Telif uyarısı metni** — giriş ekranına ROM'ların yasal sahiplik
   gerektirdiğine dair bir bilgilendirme eklenmesi önerilir.

## Yerel geliştirme

```bash
npm install
npx cap add android      # ilk kurulumda
npx cap sync android
node scripts/patch-android-tv.js
npx cap open android     # Android Studio ile aç, veya:
cd android && ./gradlew assembleDebug
```

`www/index.html` dosyasını doğrudan bir masaüstü tarayıcıda açarak da arayüz
akışını (gezinme, favoriler, geçmiş, alt menü, ipucu çubuğu) test
edebilirsiniz — Capacitor Filesystem bulunamadığında otomatik olarak demo
ROM listesine düşer.
