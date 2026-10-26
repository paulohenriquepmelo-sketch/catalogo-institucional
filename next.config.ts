import type { NextConfig } from 'next';

// Cabeçalhos de segurança. O editor e a área do compras não podem ser
// abertos dentro de outro site (clickjacking); todas as páginas recusam
// plugins, troca de <base> e envio de formulário para outro endereço.
const common = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
];
const restricted = [
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Content-Security-Policy',
    value:
      "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    // A primeira regra que define um cabeçalho vale: as específicas vêm antes.
    const general = [
      ...common,
      { key: 'Content-Security-Policy', value: "base-uri 'self'; object-src 'none'" },
    ];
    return [
      { source: '/editor', headers: [...common, ...restricted] },
      { source: '/editor/:path*', headers: [...common, ...restricted] },
      { source: '/compras', headers: [...common, ...restricted] },
      {
        source: '/api/:path*',
        headers: [...general, { key: 'X-Frame-Options', value: 'DENY' }],
      },
      { source: '/', headers: general },
      { source: '/:path*', headers: general },
    ];
  },
};

export default nextConfig;
