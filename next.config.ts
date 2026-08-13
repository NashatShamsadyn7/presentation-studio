import type { NextConfig } from 'next';

// ═══════════ ڕێکخستنی بەستن ═══════════
//
// دەرهێنانی ساکار (`output: 'export'`) — واتە `next build` کۆمەڵێک
// فایلی HTML و JS ی ڕەق دەردەکات، بەبێ هیچ سێرڤەرێکی Node.
//
// ئەمە هەڵبژاردنێکی سلیقەیی نییە: C1 دەڵێت هیچ باکئێندێک نییە.
// ئەپەکە هیچ ڕێڕەوێکی API، هیچ کرداری سێرڤەر و هیچ next/image ـێکی
// نییە — بۆیە هیچ شتێک لەدەست نادرێت.
const nextConfig: NextConfig = {
  output: 'export',

  // هەموو بەستەرەکان بە `/` کۆتاییان دێت. زۆربەی میوانداریە
  // ساکارەکان (GitHub Pages، Firebase، S3) بەم شێوەیە
  // `/page/index.html` دەدۆزنەوە بەبێ ڕێکخستنی زیادە.
  trailingSlash: true,
};

export default nextConfig;
