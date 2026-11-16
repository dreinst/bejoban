import Link from 'next/link'

export function ChatbotTabs({ active }: { active: 'utama' | 'pengaturan' }) {
  const cls = (on: boolean) => `rounded-full px-4 py-2 text-sm font-semibold ${on ? 'bg-ink text-white' : 'bg-white text-ink'}`
  return (
    <div className="flex gap-2">
      <Link href="/admin/chatbot" className={cls(active === 'utama')}>Percakapan dan kotak uji</Link>
      <Link href="/admin/chatbot/pengaturan" className={cls(active === 'pengaturan')}>Pengaturan</Link>
    </div>
  )
}
