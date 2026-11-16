import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fitur keranjang sudah dihapus. Tautan lama diarahkan ke daftar produk supaya tidak rusak.
  async redirects() {
    return [{ source: "/keranjang", destination: "/produk", permanent: true }];
  },
};

export default nextConfig;
