/*
 * `cap add android` her çalıştığında telefon odaklı standart bir
 * AndroidManifest.xml üretir. Android TV'de Play Store/oyun rafında
 * görünmesi ve dokunmatik ekran zorunluluğu aramaması için birkaç
 * düzenleme gerekiyor. Bu script GitHub Actions içinde `cap sync`
 * sonrasında çalışır ve manifesti idempotent şekilde yamalar.
 */
const fs = require("fs");
const path = require("path");

const manifestPath = path.join(__dirname, "..", "android", "app", "src", "main", "AndroidManifest.xml");

if(!fs.existsSync(manifestPath)){
  console.error("AndroidManifest.xml bulunamadı, önce `cap add android` çalıştırılmalı.");
  process.exit(1);
}

let xml = fs.readFileSync(manifestPath, "utf8");

// 1) Dokunmatik ekran zorunlu olmasın (Android TV'de dokunmatik yok)
if(!xml.includes('android.hardware.touchscreen')){
  xml = xml.replace(
    "<application",
    `<uses-feature android:name="android.hardware.touchscreen" android:required="false" />
    <uses-feature android:name="android.software.leanback" android:required="false" />
    <uses-feature android:name="android.hardware.gamepad" android:required="false" />

    <application`
  );
}

// 2) Ana Activity'ye LEANBACK_LAUNCHER kategorisi ekle (TV ana ekranında görünmesi için)
if(!xml.includes("LEANBACK_LAUNCHER")){
  xml = xml.replace(
    /(<intent-filter>\s*<action android:name="android.intent.action.MAIN"\s*\/>\s*<category android:name="android.intent.category.LAUNCHER"\s*\/>\s*<\/intent-filter>)/,
    `$1
        <intent-filter>
            <action android:name="android.intent.action.MAIN" />
            <category android:name="android.intent.category.LEANBACK_LAUNCHER" />
        </intent-filter>`
  );
}

// 3) TV banner (320x180) referansı — android-res/tv/drawable-xhdpi/tv_banner.png
//    olarak yerleştirilmeli, banner varlığı olmadan TV mağazada listelenemez.
if(!xml.includes('android:banner')){
  xml = xml.replace('<application', '<application\n        android:banner="@drawable/tv_banner"');
}

fs.writeFileSync(manifestPath, xml, "utf8");
console.log("AndroidManifest.xml Android TV için güncellendi.");
// 4) TV banner drawable'ını üretilen Android projesine kopyala.
// `cap add android` her seferinde projeyi sıfırdan oluşturduğu için bu
// dosya repo kökünde (android-res/) tutuluyor ve build sırasında buraya
// kopyalanıyor; android/ klasörünün kendisi repoya commit edilmiyor.
const bannerSrc = path.join(__dirname, "..", "android-res", "tv", "drawable", "tv_banner.xml");
const drawableDir = path.join(__dirname, "..", "android", "app", "src", "main", "res", "drawable");
const bannerDest = path.join(drawableDir, "tv_banner.xml");

if(fs.existsSync(bannerSrc)){
  fs.mkdirSync(drawableDir, { recursive: true });
  fs.copyFileSync(bannerSrc, bannerDest);
  console.log("TV banner drawable kopyalandı: " + bannerDest);
}else{
  console.warn("Uyarı: android-res/tv/drawable/tv_banner.xml bulunamadı, banner eklenemedi.");
}
