import Link from 'next/link'
import { ArrowLeft, FileText, Image as Gambar, MapPin, Mic, Smile, UserRound, Video } from 'lucide-react'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { tarikRiwayatCermin } from '../../../cermin-actions'
import { JENIS_LABEL, PENGIRIM, PENGIRIM_LABEL, nomorDari, type JenisPesan, type Pengirim } from '@/lib/cermin/baca'
import { bacaRetensi } from '@/lib/cermin/simpan'
import { MAKS_CHAT, MAKS_PESAN } from '@/lib/cermin/tarik'
import { waktuWib } from '@/lib/format'
import { Badge, Empty, PageBody, PageHeader } from '@/components/admin/ui'
import { DataTable, FilterChips, Halaman, ListToolbar, type Column } from '@/components/admin/data-table'
import type { WaChat } from '@/generated/prisma/client'
import { SaringHp } from '@/components/admin/saring-hp'
import { SubmitButton } from '@/components/admin/overlay'

// Cermin chat WhatsApp: salinan HANYA BACA semua chat di nomor bot (aturan di docs/PANDUAN-ADMIN.md).
// Khusus owner, dicek di server lewat requireOwner (admin cabang dialihkan, bukan hanya disembunyikan dari menu).
// Tidak ada tombol kirim, balas, atau hapus pesan WhatsApp di halaman ini.

const PER = 30
const MAKS_TAMPIL = 200 // pesan per chat yang ditampilkan, terbaru

type Cari = { chat: string; q: string; pengirim: Pengirim | ''; jenis: 'pribadi' | 'grup' | ''; hal: number }
const satu = (v: string | string[] | undefined) => String(Array.isArray(v) ? v[0] : (v ?? ''))

const IKON: Partial<Record<JenisPesan, typeof Gambar>> = { gambar: Gambar, video: Video, suara: Mic, dokumen: FileText, stiker: Smile, lokasi: MapPin, kontak: UserRound }

export default async function CerminChat({ searchParams }: PageProps<'/admin/chatbot/cermin'>) {
  await requireOwner()
  const sp = await searchParams
  const c: Cari = {
    chat: satu(sp.chat).slice(0, 120),
    q: satu(sp.q).trim().slice(0, 80),
    pengirim: PENGIRIM.find((p) => p === satu(sp.pengirim)) ?? '',
    jenis: satu(sp.jenis) === 'grup' ? 'grup' : satu(sp.jenis) === 'pribadi' ? 'pribadi' : '',
    hal: Math.max(1, Math.floor(Number(satu(sp.hal)) || 1)),
  }
  const href = (ubah: Partial<Cari>) => {
    const n = { ...c, hal: 1, ...ubah }
    const p = new URLSearchParams(Object.entries({ chat: n.chat, q: n.q, pengirim: n.pengirim, jenis: n.jenis, hal: n.hal > 1 ? String(n.hal) : '' }).filter(([, v]) => v))
    return `/admin/chatbot/cermin${p.size ? `?${p}` : ''}`
  }

  // Saringan pesan (pencarian teks dan pengirim) juga menyaring daftar chat: hanya chat yang punya pesan cocok.
  const saringPesan = { ...(c.pengirim && { pengirim: c.pengirim }), ...(c.q && { isi: { contains: c.q, mode: 'insensitive' as const } }) }
  const adaSaringPesan = !!(c.pengirim || c.q)
  const idCocok = adaSaringPesan ? (await db.waPesan.findMany({ where: saringPesan, distinct: ['chatId'], select: { chatId: true }, take: 2000 })).map((r) => r.chatId) : []
  const saringChat = {
    ...(c.jenis && { grup: c.jenis === 'grup' }),
    ...(adaSaringPesan && {
      OR: [
        { chatId: { in: idCocok } },
        // Nama atau nomor yang cocok dengan pencarian ikut tampil, kecuali saringan pengirim sedang dipakai.
        ...(c.q && !c.pengirim ? [{ nama: { contains: c.q, mode: 'insensitive' as const } }, { chatId: { contains: c.q.replace(/^0/, '62'), mode: 'insensitive' as const } }] : []),
      ],
    }),
  }
  const [chats, cocok, total, retensi, terbuka] = await Promise.all([
    db.waChat.findMany({ where: saringChat, orderBy: [{ waktuTerakhir: { sort: 'desc', nulls: 'last' } }, { chatId: 'asc' }], skip: (c.hal - 1) * PER, take: PER }),
    db.waChat.count({ where: saringChat }),
    db.waChat.count(),
    bacaRetensi(),
    c.chat ? db.waChat.findUnique({ where: { chatId: c.chat } }) : null,
  ])
  const ids = chats.map((x) => x.chatId)
  const belum = new Map(
    ids.length
      ? (
          await db.$queryRaw<{ chat_id: string; n: number }[]>`
            SELECT p."chat_id", count(*)::int AS n FROM "wa_pesan" p JOIN "wa_chat" c ON c."chat_id" = p."chat_id"
            WHERE p."chat_id" = ANY(${ids}) AND NOT p."dari_saya" AND (c."dilihat" IS NULL OR p."waktu" > c."dilihat")
            GROUP BY p."chat_id"`
        ).map((r) => [r.chat_id, r.n])
      : [],
  )

  let pesan: Awaited<ReturnType<typeof bacaPesanChat>> = { list: [], jumlah: 0, semua: 0 }
  if (terbuka) {
    pesan = await bacaPesanChat(terbuka.chatId, saringPesan)
    // Dibuka owner: hitungan "belum dilihat" chat ini kembali nol.
    await db.waChat.update({ where: { chatId: terbuka.chatId }, data: { dilihat: new Date() } })
    belum.set(terbuka.chatId, 0)
  }

  // Chat LID yang nomornya belum diketahui tidak punya nomor untuk ditampilkan.
  const judulChat = (x: { nama: string; chatId: string }) => x.nama || nomorDari(x.chatId) || 'Nomor belum diketahui'
  const saringan = (
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 max-md:hidden">
        <FilterChips label="Saring pengirim" items={[{ href: href({ pengirim: '' }), label: 'Semua pengirim', active: !c.pengirim }, ...PENGIRIM.map((p) => ({ href: href({ pengirim: p }), label: PENGIRIM_LABEL[p], active: c.pengirim === p }))]} />
        <FilterChips
          label="Saring jenis chat"
          items={[
            { href: href({ jenis: '' }), label: 'Semua chat', active: !c.jenis },
            { href: href({ jenis: 'pribadi' }), label: 'Pribadi', active: c.jenis === 'pribadi' },
            { href: href({ jenis: 'grup' }), label: 'Grup', active: c.jenis === 'grup' },
          ]}
        />
      </div>
      <SaringHp
        kelompok={[
          { label: 'Pengirim', options: [{ href: href({ pengirim: '' }), label: 'Semua', active: !c.pengirim }, ...PENGIRIM.map((p) => ({ href: href({ pengirim: p }), label: PENGIRIM_LABEL[p], active: c.pengirim === p }))] },
          {
            label: 'Chat',
            options: [
              { href: href({ jenis: '' }), label: 'Semua', active: !c.jenis },
              { href: href({ jenis: 'pribadi' }), label: 'Pribadi', active: c.jenis === 'pribadi' },
              { href: href({ jenis: 'grup' }), label: 'Grup', active: c.jenis === 'grup' },
            ],
          },
        ]}
      />
    </>
  )

  const daftar = (
    <DataTable
      caption="Daftar chat WhatsApp"
      rows={chats}
      rowKey={(x) => x.chatId}
      columns={([
        {
          key: 'chat',
          header: 'Chat',
          mobile: 'title',
          cell: (x) => {
            const isi = (
              <>
                {judulChat(x)}
                {x.grup && <> <Badge tone="outline">Grup</Badge></>}
                {x.nama && !x.grup && nomorDari(x.chatId) && <span className="block text-xs font-normal text-mute">{nomorDari(x.chatId)}</span>}
              </>
            )
            // Di HP judul kartu teks biasa: sasaran sentuhnya tombol Buka (44 px) di kanan kartu.
            return (
              <>
                <Link href={href({ chat: x.chatId, hal: c.hal })} aria-current={terbuka?.chatId === x.chatId ? 'true' : undefined} className="font-semibold text-ink underline-offset-2 hover:underline aria-[current=true]:underline max-md:hidden">
                  {isi}
                </Link>
                <span className="font-semibold text-ink md:hidden">{isi}</span>
              </>
            )
          },
        },
        { key: 'terakhir', header: 'Pesan terakhir', mobileLabel: false, className: 'max-w-[420px] text-mute', cell: (x) => <span className="line-clamp-2">{x.pesanTerakhir || '-'}</span> },
        { key: 'waktu', header: 'Waktu', mobile: 'hide', className: 'whitespace-nowrap text-xs text-mute', cell: (x) => (x.waktuTerakhir ? waktuWib(x.waktuTerakhir) : '-') },
        { key: 'belum', header: 'Belum dilihat', mobile: 'hide', align: 'right', cell: (x) => <Belum n={belum.get(x.chatId) ?? 0} /> },
        {
          key: 'hp',
          header: 'Waktu dan belum dilihat',
          hanyaHp: true,
          mobileLabel: false,
          cell: (x) => (
            <span className="text-xs text-mute">
              {x.waktuTerakhir ? waktuWib(x.waktuTerakhir) : '-'}
              {(belum.get(x.chatId) ?? 0) > 0 && <> · <b className="text-ink">{belum.get(x.chatId)} belum dilihat</b></>}
            </span>
          ),
        },
      ] satisfies Column<WaChat>[]).filter((k) => !terbuka || !['terakhir', 'waktu'].includes(k.key))}
      actions={(x) => (
        <Link href={href({ chat: x.chatId, hal: c.hal })} aria-label={`Buka chat ${judulChat(x)}`} className="adm-btn-line adm-btn-sm">
          Buka
        </Link>
      )}
      empty={
        total === 0 ? (
          <Empty title="Belum ada chat">Chat muncul di sini begitu webhook WAHA terpasang. Untuk mengisi chat yang sudah ada, pakai tombol Tarik riwayat.</Empty>
        ) : (
          <Empty title="Tidak ketemu">Tidak ada chat dengan saringan ini. <Link href="/admin/chatbot/cermin" className="font-semibold underline">Tampilkan semua chat</Link>.</Empty>
        )
      }
    />
  )

  return (
    <PageBody>
      <PageHeader
        title="Cermin chat"
        note={`Salinan hanya baca semua chat di nomor bot: pesan pelanggan, balasan bot, dan balasan admin dari HP. Membalas tetap dari HP. Disimpan ${retensi} hari.`}
        actions={
          <form action={tarikRiwayatCermin}>
            <SubmitButton pending="Menarik riwayat...">Tarik riwayat</SubmitButton>
          </form>
        }
      />
      {/* Di HP, saat satu chat dibuka, pencarian dan saringan disembunyikan supaya isi chat langsung terlihat. */}
      <div className={`space-y-5 ${terbuka ? 'max-lg:hidden' : ''}`}>
        <p className="-mt-3 text-xs text-mute">Tarik riwayat mengambil {MAKS_CHAT} chat terbaru, paling banyak {MAKS_PESAN} pesan per chat. Pesan yang sudah ada tidak digandakan.</p>
        <ListToolbar
          count={cocok}
          total={total}
          noun="chat"
          search={{ placeholder: 'Cari isi pesan, nama, atau nomor', label: 'Cari chat', value: c.q, keep: { chat: c.chat, pengirim: c.pengirim, jenis: c.jenis } }}
        />
        {saringan}
      </div>
      {terbuka ? (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <div className="max-lg:hidden">
            {daftar}
            <div className="mt-3"><Halaman hal={c.hal} total={cocok} per={PER} href={(n) => href({ hal: n })} /></div>
          </div>
          <IsiChat chat={terbuka} pesan={pesan} kembali={href({ chat: '', hal: c.hal })} adaSaring={adaSaringPesan} semuaHref={href({ q: '', pengirim: '' })} />
        </div>
      ) : (
        <>
          {daftar}
          <Halaman hal={c.hal} total={cocok} per={PER} href={(n) => href({ hal: n })} />
        </>
      )}
    </PageBody>
  )
}

async function bacaPesanChat(chatId: string, saring: object) {
  const where = { chatId, ...saring }
  const [list, jumlah, semua] = await Promise.all([
    db.waPesan.findMany({ where, orderBy: [{ waktu: 'desc' }, { id: 'desc' }], take: MAKS_TAMPIL }),
    db.waPesan.count({ where }),
    db.waPesan.count({ where: { chatId } }),
  ])
  return { list: list.reverse(), jumlah, semua }
}

function Belum({ n }: { n: number }) {
  if (!n) return <span className="text-xs text-mute">-</span>
  return (
    <span className="inline-grid min-w-6 place-items-center rounded-full bg-ink px-1.5 py-0.5 text-[11px] font-bold text-white">
      {n}
      <span className="sr-only"> pesan belum dilihat</span>
    </span>
  )
}

type Chat = { chatId: string; nama: string; grup: boolean }
type Baris = Awaited<ReturnType<typeof bacaPesanChat>>

function IsiChat({ chat, pesan, kembali, adaSaring, semuaHref }: { chat: Chat; pesan: Baris; kembali: string; adaSaring: boolean; semuaHref: string }) {
  const judul = chat.nama || nomorDari(chat.chatId) || 'Nomor belum diketahui'
  const hariDari = (d: Date) => waktuWib(d).split(',')[0]
  return (
    <section aria-labelledby="judul-chat" className="adm-card min-w-0 overflow-hidden">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3">
        <Link href={kembali} className="adm-btn-ghost adm-btn-sm -ml-2 inline-flex items-center gap-1 lg:hidden">
          <ArrowLeft aria-hidden className="size-4" /> Daftar chat
        </Link>
        <div className="min-w-0 flex-1 basis-48">
          <h2 id="judul-chat" className="truncate font-display text-base font-extrabold text-ink">
            {judul} {chat.grup && <Badge tone="outline">Grup</Badge>}
          </h2>
          <p className="text-xs text-mute">
            {chat.nama && !chat.grup && nomorDari(chat.chatId) ? `${nomorDari(chat.chatId)} · ` : ''}
            {adaSaring ? `${pesan.jumlah} dari ${pesan.semua} pesan cocok dengan saringan` : `${pesan.semua} pesan`}
            {pesan.jumlah > pesan.list.length && `, ${pesan.list.length} terbaru ditampilkan`}
          </p>
        </div>
        <p className="text-xs text-mute">Hanya baca. Balas dari HP.</p>
      </header>
      {adaSaring && (
        <p className="border-b border-line bg-soft px-4 py-2 text-xs text-mute">
          Hanya pesan yang cocok yang tampil. <Link href={semuaHref} className="font-semibold text-ink underline">Tampilkan semua pesan</Link>
        </p>
      )}
      <ol aria-label={`Isi chat ${judul}`} className="space-y-2 bg-soft/60 px-3 py-4 sm:px-4">
        {pesan.list.length === 0 && <li className="py-8 text-center text-sm text-mute">Tidak ada pesan{adaSaring ? ' yang cocok' : ''}.</li>}
        {pesan.list.map((m, i) => {
          const hari = hariDari(m.waktu)
          const pemisah = i === 0 || hari !== hariDari(pesan.list[i - 1].waktu)
          const keluar = m.dariSaya
          const pengirim = m.pengirim as Pengirim
          const Ikon = IKON[m.jenis as JenisPesan]
          const label = pengirim === 'pelanggan' ? (chat.grup ? m.namaPengirim || nomorDari(m.peserta) || 'Peserta' : m.namaPengirim || 'Pelanggan') : PENGIRIM_LABEL[pengirim] ?? 'Admin'
          return (
            <li key={m.id} className="contents">
              {pemisah && <p className="py-1 text-center text-[11px] font-semibold text-mute" role="presentation">{hari}</p>}
              <div className={`flex ${keluar ? 'justify-end' : 'justify-start'}`}>
                <div
                  data-pengirim={pengirim}
                  className={`max-w-[85%] rounded-[10px] px-3 py-2 text-sm shadow-sm sm:max-w-[75%] ${
                    pengirim === 'bot' ? 'bg-ink text-white' : pengirim === 'admin' ? 'border border-[#cfcfcf] bg-[#e9e9e9] text-ink' : 'border border-line bg-white text-ink'
                  } ${m.dihapus ? 'opacity-70' : ''}`}
                >
                  <p className={`mb-0.5 flex flex-wrap items-center gap-1.5 text-[11px] font-bold ${pengirim === 'bot' ? 'text-white/75' : 'text-mute'}`}>
                    <span>{label}</span>
                    {pengirim === 'pelanggan' && chat.grup && m.namaPengirim && m.peserta && <span className="font-normal">{nomorDari(m.peserta)}</span>}
                  </p>
                  {m.jenis !== 'teks' && (
                    <p className={`flex items-center gap-1.5 text-xs font-semibold ${pengirim === 'bot' ? 'text-white/85' : 'text-ink'}`}>
                      {Ikon && <Ikon aria-hidden className="size-3.5 shrink-0" />}
                      {JENIS_LABEL[m.jenis as JenisPesan] ?? 'Media'}
                      {m.namaBerkas && <span className="min-w-0 truncate font-normal">{m.namaBerkas}</span>}
                    </p>
                  )}
                  {m.isi ? <p className={`whitespace-pre-wrap break-words ${m.dihapus ? 'line-through' : ''}`}>{m.isi}</p> : m.dihapus && m.jenis === 'teks' ? <p className="italic">Isi pesan tidak tercatat.</p> : null}
                  <p className={`mt-1 flex flex-wrap justify-end gap-x-2 text-[11px] ${pengirim === 'bot' ? 'text-white/70' : 'text-mute'}`}>
                    {m.dihapus && <b>dihapus</b>}
                    {m.diedit && <b>diedit</b>}
                    <time dateTime={m.waktu.toISOString()}>{waktuWib(m.waktu).split(', ')[1]}</time>
                  </p>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
