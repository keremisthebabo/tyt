# Kişiye Özel Çok Kullanıcılı Maarif TYT & Spor Kamp Uygulaması — Tasarım Dokümanı

## 1. Amaç ve Neden (Intent & Why)
Mevcut `index.html` dosyası, tek bir 11. sınıf öğrencisinin sabit okul/dershane saatlerine (ör. Pazartesi 19:00 Fizik özel dersi), sabit Upper/Lower spor döngüsüne ve sabit 16 haftalık (112 günlük) Maarif TYT müfredatına göre kodlanmış, verilerini yalnızca o tarayıcının `localStorage` alanında tutan tek kişilik bir araçtır.

Bu projenin amacı; mevcut tek kişilik yapıyı **herkesin kendi hesabını açarak giriş yapabildiği**, kendi günlük/haftalık sabit düzenini ve spor programını elle girebildiği ve seçtiği çalışma yoğunluğuna göre **çakışmasız, kişiye özel bir Maarif TYT + Spor birleşik programının otomatik üretildiği** bulut tabanlı bir web ve mobil (PWA) uygulamasına dönüştürmektir.

---

## 2. Hedefler, Kapsam Dışı Olanlar ve Kaçınılacaklar (Goals, Non-Goals, Anti-Goals)

### Hedefler (Goals)
- **Çok Kullanıcılı Hesap Sistemi:** Her kullanıcının e-posta/şifre ile kayıt olup giriş yapması ve yalnızca kendine ait programı, ilerlemesini, domino kaydırmalarını ve yanlış defterini görmesi.
- **4 Adımlı Kişisel Kurulum (Onboarding) ve Birleştirme Motoru:**
  1. **Sabit Düzen Girişi:** Kullanıcının boş bir listeyle başlayıp kendi okul, dershane, özel ders veya kurs bloklarını; haftanın günlerini (`Pzt`–`Paz`) tek tek seçerek ve başlangıç-bitiş saatlerini (`HH:MM`) elle girerek tanımlaması.
  2. **Popüler Spor Programları & Elle Spor Saati Girişi:** Kullanıcının popüler antrenman sistemlerinden birini (**Push/Pull/Legs - PPL**, **Upper/Lower Split**, **Full Body 3 Gün**, **Bölgesel / Bro Split**, **Kardiyo & Kondisyon** veya **Spor Yapmıyorum**) seçmesi ve kendi spor başlangıç-bitiş saatini elle yazması.
  3. **Örnekli Çalışma Yoğunluğu (Tempo) Seçimi:** Bu adımda yalnızca çalışma yoğunluğunun somut örneklerle sorulması:
     - **Rahat & Esnek Tempo:** Günde ~1.5 - 2 saat (Örn: 30 soru + 1 konu videosu + 15 paragraf) — Toplam kamp süresi kullanıcının temposuna göre esnetilir (~22 hafta).
     - **Dengeli Tempo:** Günde ~3 saat (Örn: 50 soru + konu tekrarı + 20 paragraf) — Standart 16 haftalık Maarif kamp süresi.
     - **Sıkışık & Yoğun Tempo:** Günde ~4.5+ saat (Örn: 90 soru + 2 konu + branş denemesi) — Süre asla uzatılmaz (12 haftaya sıkıştırılır) ve kullanıcının boş saatleri maksimum verimle doldurulur.
  4. **Tek Programda Çakışmasız Birleştirme:** Kullanıcının girdiği sabit bloklar + spor programı/saatleri + seçtiği yoğunluktaki Maarif TYT derslerinin, boş saat bulma algoritmasıyla (çakışma olmadan) tek bir günlük ve haftalık akışta birleştirilmesi.
- **Mevcut Güçlü Özelliklerin Kullanıcı Bazlı Korunması:**
  - Domino etkisiyle zincirleme gün kaydırma ("🏖️ Dışarı Çıktım" tuşuyla derslerin üst üste binmeden 1 gün ileri ötelenmesi).
  - Dijital Yanlış Defteri ve soru analizi kayıtları.
  - Web Audio API tabanlı dahili sesli alarm ve canlı teşvik/motivasyon bildirimleri.
  - Doğrudan YouTube eğitmen aramaları/kanalları (Mert Hoca, Rüştü Hoca, Eyüp B., VIP Fizik, Görkem Şahin, Kenan Kara, Dr. Biyoloji vb.) ve Telegram paylaşım entegrasyonu.
- **Uygulama Deneyimi (PWA):** Telefon ve bilgisayarda ana ekrana kurulabilen (`manifest.json` + Service Worker) uygulama yapısı.

### Kapsam Dışı (Non-Goals)
- Uygulama içi canlı video oynatıcı/barındırma (videolar doğrudan YouTube üzerinden açılmaya devam edecektir).
- Öğretmen-öğrenci mesajlaşma veya sosyal medya akışı.
- Ücretli abonelik / ödeme altyapısı.

### Kaçınılacaklar (Anti-Goals)
- **Sabit/Ön Tanımlı Kişisel Veri Dayatması:** Yeni kayıt olan bir kullanıcıya başka birinin özel dersinin (ör. "Pazartesi 19:00 Fizik Özel Dersi") veya sabit saatlerinin varsayılan olarak gösterilmesi. Her yeni hesap sıfır sabit blokla başlar.
- **Saat Çakışması:** Kullanıcının "okuldayım", "özel dersteyim" veya "spordayım" dediği saat diliminin üzerine TYT ders bloğu yazılması.
- **Sıkışık Program İsteyenin Süresini Uzatmak / Rahat İsteyeni Sıkıştırmak:** Yoğunluk seçimi hem günlük çalışma bloğu sayısını/soru hedefini hem de toplam hafta sayısını doğrudan belirlemelidir.

---

## 3. Kısıtlar (Constraints)
- Proje mevcut durumda harici derleme (build) adımı gerektirmeyen statik web dosyalarından (`index.html`) oluşmaktadır; geliştirme ve dağıtım kolaylığı için saf HTML/CSS (Tailwind) ve modüler ES JavaScript yapısı korunmalıdır.
- Kullanıcı henüz kendi Supabase proje anahtarlarını (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) girmemiş olsa bile uygulamanın kayıt, giriş, çoklu hesap izole verisi ve program oluşturma özellikleri kesintisiz çalışmalı; Supabase anahtarları girildiği anda bulut veritabanı senkronizasyonu devreye girmelidir (Hibrit Bulut + Yerel Çoklu Hesap Yedekliliği).

---

## 4. Değerlendirilen Yaklaşımlar (Approaches)

1. **Yaklaşım 1 (Seçilen): Bulut Hesaplı Web Uygulaması + PWA (Supabase + Hibrit Senkronizasyon)**
   - **Nasıl çalışır:** Uygulama PWA (`manifest.json`, `sw.js`) olarak paketlenir; kimlik doğrulama ve veri saklama katmanı Supabase (Auth + PostgreSQL RLS) üzerine kurulur. Ayrıca sıfır kurulumla anında test edilebilmesi için yerel çoklu hesap adaptörü içerir; bulut bilgileri tanımlandığında doğrudan bulutla senkronize çalışır.
   - **Ödünleşim:** Sunucu bakımı gerektirmez, hem telefondan hem bilgisayardan erişim sağlar. Kullanıcı tarafından bu yaklaşım seçilmiştir.
2. **Yaklaşım 2: Özel Sunuculu (Node.js / Python API + Veritabanı) Uygulama**
   - **Ödünleşim:** Tam sunucu kontrolü sağlar ancak 7/24 açık bir sunucu kiralama ve bakım maliyeti doğurur.
3. **Yaklaşım 3: Yalnızca Cihaz İçi Çoklu Profil Sistemi**
   - **Ödünleşim:** Kurulum gerektirmez ancak cihazlar arası canlı bulut senkronizasyonu sunmaz.

---

## 5. Kararlaştırılan Mimari ve İşleyiş Detayları

### 5.1. Kimlik Doğrulama ve Kullanıcı Verisi İzolasyonu
- Uygulama açılışında oturum yoksa **Giriş Yap / Hesap Oluştur** ekranı karşılar.
- Her kullanıcının verisi (`userId` bazında) tamamen izoledir:
  - `profile`: Ad, e-posta, kurulum tamamlandı mı (`onboardingCompleted`), seçilen tempo (`relaxed` | `balanced` | `intense`), alarm saati ve durumu.
  - `fixedBlocks`: Kullanıcının elle eklediği sabit meşguliyetler (`[{ id, title, days: ['Pzt', ...], start: '08:30', end: '16:00', category }]`).
  - `sportConfig`: Seçilen spor programı (`ppl` | `ul` | `fb` | `bro` | `cardio` | `none`), kullanıcının elle yazdığı başlangıç saati (`start`), bitiş saati (`end`) ve isteğe bağlı özel notu.
  - `generatedWeeks`: Seçilen tempoya göre 112 temel Maarif TYT ders biriminin (`linearCurriculum`) kullanıcıya özel haftalara dağıtılmış yapısı:
    - **Rahat (`relaxed`):** ~22 Hafta (haftada ~5 ana konu birimi + 2 esnek tekrar/pekiştirme günü; günlük 1 çalışma bloğu ~90 dk, 30 soru + 15 paragraf).
    - **Dengeli (`balanced`):** 16 Hafta (haftada 7 birim; günlük 2 çalışma bloğu toplam ~180 dk, 50 soru + 20 paragraf).
    - **Sıkışık (`intense`):** 12 Hafta (günde ~1.5 - 2 konu birimi birleştirilerek 112 birim 84 günde tamamlanır, süre uzatılmaz; günlük 3 çalışma bloğu toplam ~270 dk, 90 soru + 2 konu + branş denemesi).
  - `progress`: Tamamlanan gün/slot işaretleri (`slot_<index>: true`).
  - `offDays`: Domino sistemiyle kaydırılan günler (`slot_<index>: { weekNum, dayIndex, dayName, shiftedDate, originalTopic }`).
  - `notes`: Kullanıcının kişisel Dijital Yanlış Defteri kayıtları.

### 5.2. Boş Saat Hesaplama ve Birleştirme Algoritması (`buildUnifiedDailySchedule`)
Her gün (`Pzt`–`Paz`) için saatlik çizelge şu sırayla oluşturulur:
1. Kullanıcının uyanış/gün başlangıç saati (varsayılan `08:00`, ayarlanabilir) ile uyku saati (`23:30`) arasındaki zaman çizelgesi açılır.
2. O güne ait `fixedBlocks` (kullanıcının eklediği okul, özel ders, dershane vb.) zaman çizelgesine sabitlenir ve bu aralıklar "dolu" işaretlenir (her bloğun sonrasına 15 dk geçiş/mola payı eklenir).
3. Kullanıcının seçtiği `sportConfig` şablonunda o gün antrenman varsa, kullanıcının elle girdiği `sportConfig.start - sportConfig.end` aralığına spor bloğu yerleştirilir ve sonrasında 30 dk duş/dinlenme payı "dolu" işaretlenir. Dinlenme (Off) günlerinde saat bloğu işgal edilmez, gün kartında "🛌 Spor: Dinlenme (Off Day)" rozeti gösterilir.
4. Seçilen çalışma yoğunluğunun (`relaxed`: 1 blok, `balanced`: 2 blok, `intense`: 3 blok) gerektirdiği Maarif TYT çalışma blokları, o günün kalan boş zaman dilimlerine (`allocateFreeSlot`) kronolojik olarak yerleştirilir. Eğer bir günde kullanıcının sabit blokları çok fazlaysa ve yeterli boşluk kalmıyorsa, algoritma mevcut en geniş boş aralıklara blokları sığdırır ve kullanıcıyı bilgilendirir.
5. Tüm bloklar (Sabit Düzen + Spor + Maarif TYT Dersleri) başlangıç saatine göre sıralanarak hem ana ekrandaki günlük kartlarda hem de **"Birleşik Saatlik Rutin"** modalında tek bir bütünsel program olarak gösterilir.

### 5.3. Sonradan Düzenleme (Programı Güncelleme)
- Kullanıcı dilediği zaman üst menüdeki **"⚙️ Düzenimi & Sporumu Güncelle"** butonuna basarak 4 adımlı kurulum sihirbazını tekrar açabilir, yeni bir özel ders ekleyebilir, spor saatini veya çalışma yoğunluğunu değiştirebilir.
- Program güncellendiğinde mevcut yanlış defteri notları ve tamamladığı konular korunur.

---

## 6. İnşa Ediciye Bırakılan Teknik Kararlar (Builder's Calls)
- **Modüler Dosya Yapısı:** Bakım kolaylığı ve temiz kod için uygulama; `index.html`, `manifest.json`, `sw.js`, `sql/supabase_schema.sql` ve `js/` altındaki modüller (`curriculum.js`, `scheduler.js`, `auth-storage.js`, `app.js`) şeklinde yapılandırılabilir veya tek sayfadan sorunsuz yüklenecek şekilde organize edilir.
- **Hibrit Veri Katmanı (`auth-storage.js`):** Uygulama içinde hem hazır yerel çoklu hesap sistemi (şifreli hash + `localStorage` izole alanları) hem de Supabase Cloud bağlantısı birlikte sunulur; üst menüdeki "☁️ Bulut Bağlantısı" ayarından Supabase URL ve Anon Key girildiğinde tüm hesaplar bulut veritabanı üzerinden çalışır.
