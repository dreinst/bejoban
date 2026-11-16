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
7. Hierarki tombol. Satu tombol utama hitam (`adm-btn`) per tampilan. Aksi sekunder bergaris (`adm-btn-line`) atau polos (`adm-btn-ghost`). Merah (`adm-btn-danger`) hanya di dialog konfirmasi.
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
| `Badge`, `Empty`, `StatCard` | `ui.tsx` | server | Lencana status, keadaan kosong, angka ringkasan |
| `DataTable`, `Thumb` | `data-table.tsx` | server | Tabel responsif dan gambar kecil di baris |
| `ListToolbar`, `FilterChips` | `data-table.tsx` | server | Jumlah item, pencarian `?q=`, saringan chip |
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
| Ringkasan | `/admin` | belum | |
| Stok dan Harga, Stok ban | `/admin/stok-ban` | belum | |
| Stok dan Harga, Harga jasa | `/admin/harga-jasa` | belum | |
| Stok dan Harga, Produk situs | `/admin/harga` | belum | |
| Form produk | `/admin/produk/[id]` | belum | |
| Stok dan Harga, Perlu dicek | `/admin/peringatan` | belum | |
| Chatbot, Percakapan | `/admin/chatbot` | belum | |
| Chatbot, Kotak uji | `/admin/chatbot/uji` | belum | |
| Chatbot, Templat pesan | `/admin/chatbot/templat` | belum | |
| Ongkir, Hitung | `/admin/ongkir` | belum | |
| Ongkir, Tarif | `/admin/ongkir/tarif` | belum | |
| Situs, Tampilan beranda | `/admin/konten`, `/admin/konten/[key]` | belum | |
| Situs, Merek | `/admin/merek` | ya | Halaman acuan. Merek nonaktif tetap tampil di tabel dengan lencana Nonaktif dan tombol Aktifkan. |
| Situs, Kategori | `/admin/kategori` | belum | |
| Situs, Tautan WhatsApp | `/admin/situs` | belum | |
| Pengaturan, Cabang | `/admin/cabang` | belum | |
| Pengaturan, Pengguna | `/admin/pengguna` | belum | |
| Pengaturan, WhatsApp dan chatbot | `/admin/pengaturan/whatsapp` | belum | |
| Pengaturan, Ongkir | `/admin/pengaturan/ongkir` | belum | |
| Pengaturan, Kalender | `/admin/kalender` | belum | |
| Akun saya | `/admin/akun` | belum | |
| Panduan ukuran foto | `/admin/panduan-foto` | belum | |
| Login | `/admin/login` | belum | |
