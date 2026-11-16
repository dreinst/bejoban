import type { NextConfig } from "next";
import { LEGACY_REDIRECTS } from "./src/lib/admin-menu";

const nextConfig: NextConfig = {
  // Fitur keranjang sudah dihapus. Tautan lama diarahkan ke daftar produk supaya tidak rusak.
  // Alamat admin lama dialihkan ke tempat barunya; daftarnya di src/lib/admin-menu.ts.
  // Sementara (307), supaya browser tidak menyimpan pengalihan selamanya kalau susunan menu berubah lagi.
  async redirects() {
    return [
      { source: "/keranjang", destination: "/produk", permanent: true },
      ...LEGACY_REDIRECTS.map((r) => ({ ...r, permanent: false })),
    ];
  },
};

export default nextConfig;
