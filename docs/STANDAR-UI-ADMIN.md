# Standar UI admin

Acuan untuk semua halaman di `/admin`. Halaman baru dan perubahan halaman lama mengikuti aturan di sini dan memakai komponen bersama di `src/components/admin/`. Halaman tidak menata sendiri jarak, tombol, atau tabelnya.

Arah desain tetap hitam putih: hitam `#0a0a0a`, putih, abu (`soft`, `line`, `mute`), Rubik untuk judul, DM Sans untuk isi, sudut 5 sampai 10 px.

## Aturan

1. Daftar ditampilkan sebagai tabel. Merek, kategori, cabang, pengguna, tarif, harga jasa, kalender, produk, dan stok tampil satu baris per item dengan kolom penting, gambar kecil 40 sampai 56 px, dan aksi di ujung baris (Ubah, Hapus). Satu form penuh per item tidak boleh dipakai.
2. Tambah dan ubah memakai satu form yang sama di panel samping (`Drawer`). Form panjang seperti produk boleh punya halaman sendiri. Sunting cepat satu nilai (harga, stok, by order, aktif) boleh langsung di baris.
3. Hapus lewat dialog konfirmasi (`ConfirmDialog`) yang menyebut nama item dan akibatnya, mis. "Hankook dipakai 6 produk." Centang "Yakin" di halaman tidak dipakai lagi. Item yang masih dipakai tidak bisa dihapus, dialognya menawarkan Nonaktifkan.
4. Urutan diatur dengan tombol naik turun (`ReorderButtons`), tidak dengan mengetik angka.
5. Halaman daftar punya: judul, satu kalimat penjelas kalau perlu, tombol utama "Tambah ..." di kanan atas, jumlah item, pencarian atau saringan kalau item bisa lebih dari sepuluh, keadaan kosong yang menjelaskan langkah pertama, dan toast setelah simpan.
6. Lebar konten terpakai. Tabel melebar sampai 1200 px (`PageBody`). Satu form dibatasi 640 px. Halaman pengaturan dengan beberapa bagian memakai `SettingsGrid` (dua kolom di layar lebar) supaya tidak separuh kosong.
7. Hierarki tombol. Satu tombol utama hitam (`adm-btn`) per tampilan. Di halaman pengaturan tiap bagian adalah form sendiri, jadi tiap bagian boleh punya satu tombol simpan hitam. Aksi sekunder bergaris (`adm-btn-line`) atau polos (`adm-btn-ghost`). Merah (`adm-btn-danger`) hanya di dialog konfirmasi.
8. Unggah gambar ringkas (`ImageField`, `ImagesInput`): pratinjau 56 px, tombol Ganti dan Hapus, satu baris keterangan ukuran dengan tautan "Panduan ukuran".
9. Kepadatan seragam lewat komponen bersama. Jangan menulis kelas tabel, chip, atau kartu sendiri di halaman.
10. Lebar 390 px: tabel otomatis menjadi daftar kartu ringkas satu item per kartu. Aksi utama tidak boleh butuh gulir mendatar.
11. Aksesibilitas: label terhubung ke kolom, fokus terlihat, panel dan dialog tertutup dengan Escape lalu fokus kembali ke tombol pemicu, target sentuh minimal 44 px di layar kecil, gerak dimatikan saat `prefers-reduced-motion`.

## Komponen

| Komponen | Berkas | Jenis | Untuk |
| --- | --- | --- | --- |
| `PageHeader` | `ui.tsx` | server | Judul, penjelas, tombol utama kanan atas |
| `PageBody` | `ui.tsx` | server | Pembatas lebar: `list` 1200 px, `form` 640 px |
| `SettingsGrid`, `Section` | `ui.tsx` | server | Halaman pengaturan: kartu per bagian, dua kolom di layar lebar |
| `Badge`, `Empty`, `StatCard` | `ui.tsx` | server | Lencana status, keadaan kosong (tombol lewat prop `action`, jangan menulis "tombol di kanan atas"), angka ringkasan |
| `DataTable`, `Thumb` | `data-table.tsx` | server | Tabel responsif dan gambar kecil di baris |
| `ListToolbar`, `FilterChips`, `Halaman` | `data-table.tsx` | server | Jumlah item, pencarian `?q=`, saringan chip, navigasi `?hal=` untuk daftar panjang |
| `TextField`, `SelectField`, `TextAreaField`, `CheckField`, `FormGrid`, `FormActions` | `field.tsx` | server | Kolom form berlabel dengan bantuan dan galat |
| `Drawer`, `Modal`, `ConfirmDialog`, `CloseButton`, `SubmitButton` | `overlay.tsx` | klien | Panel samping, dialog, tombol batal dan simpan |
| `ReorderButtons`, `QuickToggle` | `row-controls.tsx` | klien | Urutan naik turun dan sakelar yang langsung menyimpan |
| `ImageField`, `ImagesInput`, `SizeHint` | `image-input.tsx` | klien | Unggah gambar ringkas |
| `Toast`, `toast()` | `toast.tsx`, `toast-bus.ts` | klien | Pesan singkat setelah simpan |
| `inputCls` | `form-cls.ts` | biasa | Kelas kolom isian untuk tabel yang bisa disunting langsung |

Aturan Next yang pernah jadi bug: kelas dan konstanta yang dipakai halaman server jangan diekspor dari berkas `'use client'`. Yang sampai ke server hanya rujukan fungsi, bukan teksnya. Karena itu `inputCls` ada di `form-cls.ts` dan `toast()` di `toast-bus.ts`.

### Pola aksi server

- Form di Drawer dan ConfirmDialog: aksi menyimpan, mencatat `catatAktivitas`, lalu `redirect` ke halaman yang sama dengan `?ok=pesan` atau `?err=pesan`. Toast membaca pesan itu lalu menghapusnya dari alamat. Drawer yang terbuka menutup sendiri saat `?ok=` muncul, dan menampilkan galat di dalam panel saat `?err=` muncul.
- Sunting cepat (`QuickToggle`, `ReorderButtons`): aksi tidak redirect. Aksi memanggil `revalidatePath` lalu mengembalikan `{ ok }` atau `{ err }` untuk toast.
- Semua aksi tetap cek sesi dan peran di server (`requireOwner`, `requireUser`, `canEditBranch`) dan memvalidasi input sendiri. Aturan hapus dicek ulang di server, tidak hanya di dialog.
- Logika murni ada di `src/lib/admin/urutan.ts`: `geserUrutan` (tukar dengan tetangga dan rapikan nilai sort jadi 1, 2, 3), `urutanBerikut` (item baru di akhir), `aturanHapus` (boleh dihapus atau tidak, plus kalimat "X dipakai N produk.").

### Contoh singkat

Halaman daftar (komponen server):

```tsx
<PageBody>
  <PageHeader title="Merek" note="Urutan tabel sama dengan urutan di beranda." actions={
    <Drawer trigger="+ Tambah merek" triggerClassName="adm-btn" title="Tambah merek"><FormMerek /></Drawer>
  } />
  <ListToolbar count={list.length} noun="merek" search={{ placeholder: 'Cari merek', value: q }} />
  <DataTable
    caption="Daftar merek"
    rows={list}
    rowKey={(b) => b.id}
    thumb={(b) => <Thumb src={b.logo} variant="logo" />}
    muted={(b) => !b.aktif}
    columns={[
      { key: 'nama', header: 'Nama', cell: (b) => b.name },
      { key: 'produk', header: 'Produk', align: 'right', cell: (b) => b._count.products },
      { key: 'byorder', header: 'By order', cell: (b) => <QuickToggle action={setByOrder} fields={{ id: b.id }} checked={b.byOrder} label={`By order ${b.name}`} /> },
    ]}
    actions={(b) => (
      <>
        <Drawer trigger="Ubah" triggerLabel={`Ubah ${b.name}`} title={`Ubah ${b.name}`}><FormMerek b={b} /></Drawer>
        <ConfirmDialog triggerLabel={`Hapus ${b.name}`} title={`Hapus ${b.name}?`} message="..." confirm={{ action: deleteBrand, fields: { id: b.id }, label: 'Hapus merek' }} />
      </>
    )}
    empty={<Empty title="Belum ada merek">Tambah merek pertama lewat tombol di kanan atas.</Empty>}
  />
</PageBody>
```

Form di dalam Drawer:

```tsx
<form action={saveBrand}>
  <input type="hidden" name="id" value={b?.id ?? 0} />
  <FormGrid cols={1}>
    <TextField label="Nama merek" name="name" defaultValue={b?.name} required />
    <ImageField label="Logo" name="logo" value={b?.logo} preset="brand" />
    <CheckField label="By order" name="byOrder" defaultChecked={b?.byOrder} hint="Tidak distok, dipesan dulu." />
  </FormGrid>
  <FormActions><CloseButton /><SubmitButton>Simpan merek</SubmitButton></FormActions>
</form>
```

Halaman pengaturan:

```tsx
<PageHeader title="Pengaturan ongkir" note="..." />
<SettingsGrid>
  <Section id="asal" title="Asal kirim" description="...">
    <form action={saveShipSettings}>...<FormActions><SubmitButton>Simpan asal kirim</SubmitButton></FormActions></form>
  </Section>
  <Section id="kemasan" title="Kemasan ban per ring" wide>...</Section>
</SettingsGrid>
```

## Status halaman

Diperbarui tiap kali halaman disesuaikan. "Ya" berarti sudah memakai komponen bersama dan lolos aturan di atas.

| Menu, tab | Alamat | Status | Catatan |
| --- | --- | --- | --- |
| Ringkasan | `/admin` | ya | Kartu angka hanya untuk yang perlu ditindaklanjuti. Owner dan admin cabang. |
| Stok dan harga, Stok ban | `/admin/stok-ban` | ya | Impor dan sinkron jadi dua kartu form. Tetapkan cabang lewat dialog. Daftar stok tabel baca dengan panel Ubah. |
| Stok dan harga, Harga jasa | `/admin/harga-jasa` | ya | Urutan naik turun, form lengkap di panel. |
| Stok dan harga, Produk situs | `/admin/harga` | ya | Sunting cepat banyak baris lalu satu tombol Simpan. Tambah produk bergaris karena tombol utamanya Simpan. |
| Form produk | `/admin/produk/[id]` | ya | Halaman sendiri karena panjang. Hapus lewat dialog. |
| Stok dan harga, Perlu dicek | `/admin/peringatan` | ya | Owner dan admin cabang. |
| Chatbot, Percakapan | `/admin/chatbot` | ya | "Selesai, tidak tersedia" lewat dialog karena bot mengirim kalimat penutup. |
| Chatbot, Kotak uji | `/admin/chatbot/uji` | ya | Hapus riwayat lewat dialog. |
| Chatbot, Templat pesan | `/admin/chatbot/templat` | ya | Tabel 12 baris (Ke pelanggan, Ke admin), Ubah per templat di panel samping dengan pratinjau. Kembalikan satu atau semua ke bawaan. |
| Ongkir, Hitung | `/admin/ongkir` | ya | Setelah dihitung, hasil di atas (total dan estimasi besar, rincian dilipat) dan form dilipat jadi "Ubah perhitungan". Kolom yang tidak dipakai mode terpilih disembunyikan. |
| Ongkir, Tarif | `/admin/ongkir/tarif` | ya | Tempel banyak tarif di panel kedua. `?kota=` membuka panel tambah. |
| Situs, Tampilan beranda | `/admin/konten`, `/admin/konten/[key]` | ya | Urutan bagian ditentukan kode beranda, jadi tanpa tombol urutan. Editor punya halaman sendiri. |
| Situs, Merek | `/admin/merek` | ya | Halaman acuan. |
| Situs, Kategori | `/admin/kategori` | ya | Kategori nonaktif tidak tampil di situs. |
| Situs, Tautan WhatsApp | `/admin/situs` | ya | |
| Pengaturan, Cabang | `/admin/cabang` | ya | Tanpa hapus. Admin cabang hanya melihat cabangnya. |
| Pengaturan, Pengguna | `/admin/pengguna` | ya | Reset kata sandi di panel terpisah. Akun sendiri tidak bisa dihapus atau dinonaktifkan. |
| Chatbot, Pengaturan bot | `/admin/chatbot/pengaturan` | ya | Khusus owner. |
| Ongkir, Pengaturan | `/admin/ongkir/pengaturan` | ya | Khusus owner. |
| Kalender (tanpa tab) | `/admin/kalender` | ya | Disembunyikan dari menu, datanya belum dipakai. Saringan Akan datang, Sudah lewat, Semua. |
| Akun saya | `/admin/akun` | ya | |
| Panduan ukuran foto | `/admin/panduan-foto` | ya | |
| Login | `/admin/login` | ya | Label terlihat. |

Pemeriksaan terakhir (16 November 2026, Playwright, lebar 1440 dan 390, owner dan admin cabang): tidak ada gulir mendatar di 390, tidak ada centang "Yakin", tidak ada isian urutan, tidak ada tombol merah di luar dialog, semua kolom berlabel, panel pertama tiap halaman tertutup dengan Escape dan fokus kembali ke pemicunya, tidak ada tautan internal yang mati. Tangkapan layar ada di `~/ndru/bejoban-aset/fitur-internal/v4/std-*.png`.
