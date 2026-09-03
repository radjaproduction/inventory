# Arsitektur Radja Production

Dokumen ini menjadi acuan refactor bertahap aplikasi vanilla JavaScript. Refactor tidak
mengubah skema database atau perilaku bisnis tanpa keputusan terpisah.

## Kondisi saat ini

`index.html` masih menjadi shell UI, tempat seluruh fungsi aplikasi, state global, query
Supabase, realtime, notifikasi, backup, dan print hidup bersamaan. Tab yang tidak aktif
disembunyikan dari tampilan, tetapi markup dan sebagian besar kode tetap ikut dimuat.

State utama saat ini:

- `masterData`: vendor, brand, model, warna, ukuran.
- `appData`: riwayat input, riwayat transaksi, pelunasan.
- state form dan navigasi tersebar di banyak fungsi global.

Alur startup saat ini mengambil data master, riwayat input beserta item, transaksi beserta
item, pelunasan, dan data beban sebelum loading awal ditutup. Ini adalah titik yang paling
berpengaruh terhadap waktu buka aplikasi.

## Target arsitektur tanpa React

Kode akan dipisahkan berdasarkan tanggung jawab, bukan berdasarkan jenis file HTML:

```text
core/
  app-state.js          # state aplikasi dan invalidasi cache
  app-router.js         # perpindahan tab dan lifecycle tab
  loading-controller.js # status loading startup

data/
  supabase-client.js    # pembuatan client dan konfigurasi
  repositories/         # query dan mapping database
    master-repository.js
    inventory-repository.js
    transaction-repository.js
    payment-repository.js
    expense-repository.js

domain/
  stock-calculator.js   # aturan hitung stok, tanpa DOM dan tanpa Supabase
  transaction-rules.js  # validasi transaksi dan perubahan qty
  payment-rules.js      # aturan pelunasan

features/
  stock/
  input/
  transaction/
  history/
  profit-loss/
  master-data/

integrations/
  realtime.js
  notifications.js
  backup.js
  printing.js

ui/
  dom.js
  modal.js
  toast.js
```

## Aturan dependensi

1. `domain/` tidak boleh mengimpor atau memanggil DOM, Supabase, `localStorage`, atau
   `window`.
2. `data/repositories/` menjadi satu-satunya tempat query tabel database.
3. `features/` mengorkestrasi use case dan memanggil repository/domain; fitur tidak boleh
   mengulang query tabel secara langsung.
4. `ui/` hanya menangani elemen tampilan dan event UI.
5. `core/app-state.js` menjadi sumber state bersama; akses langsung ke variabel global baru
   tidak boleh ditambah.
6. Realtime memperbarui state atau meminta refresh repository, lalu mengirim satu event
   perubahan fitur. Realtime tidak boleh merender banyak tab secara langsung.
7. Data list besar wajib memiliki batas query, pagination, atau aggregate server-side.

## Urutan refactor

### Fase 1 — fondasi dan pengukuran

- Pertahankan perilaku aplikasi.
- Dokumentasikan kontrak state, query, dan render.
- Tambahkan logging waktu startup, waktu query, dan jumlah baris yang dirender.

### Fase 2 — data access

- Ekstrak client Supabase dan helper query.
- Pindahkan query master, inventory, transaksi, pelunasan, dan beban ke repository.
- Pertahankan fungsi global lama sebagai adapter sementara agar UI tidak langsung berubah.

### Fase 3 — domain stok

- Pindahkan `hitungStokBrand`, `hitungStokItem`, dan perhitungan agregat ke modul murni.
- Uji dengan data fixture sebelum fungsi lama dihapus.

### Fase 4 — lifecycle tab dan UI

- Pisahkan render tiap fitur.
- Muat data fitur ketika tab dibuka jika data tersebut tidak dibutuhkan dashboard.
- Kurangi ketergantungan antar-tab dan render ulang yang tidak perlu.

### Fase 5 — optimasi performa

- Pagination riwayat.
- Virtualisasi list jika jumlah kartu besar.
- Lazy-load aset dan modul fitur.
- Ukur ulang dengan perangkat nyata sebelum memutuskan perlu bundler atau migrasi framework.

## Keputusan awal

- React belum digunakan.
- Database dan nama tabel tetap dipertahankan.
- Migrasi dilakukan bertahap dan dapat dibatalkan per fase.
- Artefak runtime tetap self-contained: `index.html` meng-inline modul aplikasi yang
  diperlukan. File di folder `js/` menjadi source modular untuk pemeliharaan, bukan dependency
  `<script src>` yang wajib tersedia saat aplikasi dibuka.
- Sinkronisasi source ke artefak runtime dilakukan dengan `node tools/sync-inline-modules.js`
  sebelum deploy. Script ini bersifat idempotent dan akan gagal jika marker inline hilang.
- Dependency eksternal hanya boleh ditambahkan setelah jalur CDN, fallback, dan strategi cache
  service worker diuji pada URL deployment sebenarnya.
- Perubahan visual dan perubahan aturan bisnis berada di luar refactor arsitektur kecuali
  diperlukan untuk menjaga kontrak modul.

## Progres implementasi

- [x] Kontrak arsitektur dan aturan dependensi didokumentasikan.
- [x] Repository Supabase dibuat sebagai seam data access.
- [x] Query startup dan realtime untuk data master dipindahkan ke repository.
- [x] Query riwayat input, transaksi, pelunasan, dan bayar sebagian dipindahkan ke repository.
- [x] Mapping row database ke bentuk state dipusatkan di data mapper.
- [x] Kalkulator stok dipisahkan ke modul domain tanpa ketergantungan DOM/database.
- [x] Data beban dikeluarkan dari jalur startup dan dimuat on-demand di tab-nya.
- [x] Operasi tambah/hapus/edit master mulai memakai adapter repository.
- [x] Insert header dan item untuk Input Stok serta Transaksi memakai adapter repository.
- [x] Update/delete satu record untuk input item, transaksi item, transaksi, dan pelunasan memakai adapter repository.
- [x] Insert/delete satu record untuk pelunasan dan biaya operasional memakai adapter repository.
- [x] Update multi-kondisi dan delete batch memakai adapter repository.
- [x] Repository aplikasi dibuat sekali setelah koneksi Supabase dan dipakai bersama.
- [x] Penyimpanan pengaturan memakai adapter repository.
- [x] Operasi delete massal dan insert batch restore memakai adapter repository.
- [x] Rollback insert input dan penghapusan riwayat retur memakai adapter repository.
- [x] Instrumentasi durasi startup data dan render awal ditambahkan.
- [x] Query foto/data ringkas beban dan koreksi stok memakai repository.
- [x] RPC aggregate dashboard dan stok varian dipanggil melalui repository.
- [x] RPC beban, cleanup transaksi, dan sinkronisasi sequence dipanggil melalui repository.
- [x] Startup memakai ringkasan dashboard/stok; ledger riwayat lengkap dimuat saat dibutuhkan.
- [x] Guard deduplikasi ID untuk patch realtime transaksi dan refresh cache aggregate setelah mutasi.
- [x] Fallback update/delete item transaksi memakai repository.
- [x] Backup/restore pengaturan memakai repository.
- [x] Pemanggilan langsung ke tabel inventory utama sudah dipusatkan.
- [x] Integrasi Pesanan dan FCM dipisahkan ke external repository.
- [x] Modul repository/domain di-inline ke `index.html` agar kegagalan path file lokal tidak
  dapat menghentikan startup runtime.
- [x] Script sinkronisasi source modular ke blok inline dibuat dan diuji idempotent.
- [ ] Query riwayat besar diubah menjadi pagination sesuai kebutuhan layar.
