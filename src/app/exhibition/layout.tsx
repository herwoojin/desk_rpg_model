import type { ReactNode } from 'react';

/** 전시장은 새 창에서 전체 화면으로 쓴다 — 헤더·푸터를 두지 않는다. */
export default function ExhibitionLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-[#0b1220]">{children}</div>;
}
