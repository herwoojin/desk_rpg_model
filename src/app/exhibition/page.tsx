import type { Metadata } from 'next';
import { ExhibitionClient } from './ExhibitionClient';

export const metadata: Metadata = {
  title: '2027 GS25 상품전략공유회 온라인 전시장',
  description: '아바타로 전시장을 돌아다니며 11개 존을 둘러봅니다.',
  robots: { index: false, follow: false },
};

export default function ExhibitionPage() {
  return <ExhibitionClient />;
}
