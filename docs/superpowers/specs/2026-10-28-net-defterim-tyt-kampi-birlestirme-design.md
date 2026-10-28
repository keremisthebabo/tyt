# Tasarım Dokümanı: Net Defterim & Kişisel Maarif TYT Kampı Birleşik Uygulaması

## 1. Amaç ve Kapsam
`https://github.com/yusufkaya5482/net-defterim` deposundaki **Net Defterim** uygulaması ile **Kişisel Maarif TYT & Spor Kampı** uygulamasını tek bir çatı altında birleştirmek.
- **Görsel Tasarım Bazı:** %100 **Net Defterim** tasarım dili (`#0f2b29` koyu zümrüt sol menü, `#1b1f23` koyu arduvaz çalışma alanı, `#24292e` kart yüzeyleri, `#2fb597` / `#5fd0b6` nane yeşili vurgular, `/public/logo-white.png` marka logosu, üst bilgi çubuğu ve mobil alt gezinme çubuğu).
- **Kimlik Doğrulama & Hesap Sistemi:** **TYT Kampı** projesindeki çok kullanıcılı E-posta/Şifre ile Kayıt & Giriş, Hızlı Hesap Değiştirme, hesaplar arası tam veri izolasyonu ve **Supabase Bulut (`tyt-user-states`)** otomatik senkronizasyonu.

## 2. Birleştirilen Modüller ve Gezinme Menüsü (`ÇALIŞMA ALANIM`)
Sol menüde (`app-sidebar`) ve mobil alt çubukta (`mobile-bar`) yer alan 7 ana bölüm:
1. **Genel bakış (`home`):**
   - 4 İstatistik Kartı (`Arşivdeki soru`, `Çalışılacak konu`, `Bugün tekrar`, `Öğrenildi`)
   - Deneme Sonrası Yanlış Soru Fotoğrafı / Metni Yükleme Alanı (`dropzone`)
   - Ayın Odağı & YKS Geri Sayım Kartı (`focus-card`) + Bugünün Kişisel TYT & Spor Kamp Özeti
   - Aralıklı Tekrar Sırası (`1 → 3 → 7 → 14 → 30 → 60 gün` `DueList`)
   - Son Eklenen Sorular Tablosu
2. **TYT Kamp & Spor Programım (`camp`):**
   - 4 Adımlı Kişisel Program Kurulum Sihirbazı (Hafta içi okul saatleri `08:00-16:00`, özel ders blokları, 6 popüler spor programı + özel spor saatleri, 3 çalışma yoğunluğu: Rahat 22H / Dengeli 16H / Sıkışık 12H)
   - Çakışmasız Birleşik Günlük/Haftalık Ders & Spor Akışı
   - Domino Kaydırma ("🏖️ Dışarı Çıktım") ve Dahili Sesli Alarm
3. **Yanlış arşivim (`archive`):**
   - Ders, Sınav Türü (`TYT`, `AYT`, `9-12. Sınıf`), Tekrar Durumu, Hata Türü (`Yanlış işaretledim`, `Boş bıraktım`, `Doğru ama emin değildim`) ve Ay filtreli soru tablosu
   - Liste ve Ders › Konu Gruplu görünüm, CSV/JSON/Yazdır (PDF) çıktı
4. **Aylık raporum (`report`):**
   - Seçilen ayda en çok yanlış yapılan konuların ilerleme çubuklu sıralaması
   - Kişisel aylık tekrar notları ve gelecek ay hedefleri (`goals`)
5. **Denemelerim (`exams`):**
   - Deneme adı, türü (`TYT`, `AYT`, `9-12. Sınıf`), tarih, doğru/yanlış/boş ve otomatik net hesaplama (`Doğru - Yanlış / 4`)
   - Net gelişim grafiği ve deneme geçmişi listesi
6. **Ders notlarım (`notes`):**
   - MEB Türkiye Yüzyılı Maarif Modeli `9, 10, 11, 12. Sınıf` ünite ve konu ağacından (`js/meb-topics.js`) konu seçerek sınav odaklı ders notu oluşturma ve düzenleme
7. **Ayarlar (`settings`):**
   - Öğrenci Profili (`Ad Soyad`, `Sınıf`, `Hedef Sınav Yılı`, `Sınav Tarihi`, `Hedef Bölüm`, `Okul`, `Günlük Soru Hedefi`, `Motto`)
   - Tüm verileri (Yanlış Arşivi + Denemeler + Notlar + TYT Kamp Programı) tek JSON olarak yedekleme ve geri yükleme
   - Supabase Bulut durumu ve Oturumu Kapat / Hesap Değiştir
