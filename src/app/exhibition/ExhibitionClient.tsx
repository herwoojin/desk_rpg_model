'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { EventBus } from '@/game/EventBus';
import { TOTAL_MINUTES, ZONES, type ExhibitionZone } from '@/lib/exhibition/zones';
import { CharacterSelect } from './CharacterSelect';

/**
 * 전시장 화면 — 캐릭터 선택 → 게임 → 존 안내.
 *
 * Phaser 는 window 가 있어야 하므로 반드시 동적 import 한다.
 * React 는 게임 내부를 직접 건드리지 않고 EventBus 로만 주고받는다.
 *
 * 1단계 범위: 새 창 진입 · 아바타 선택 · 전시장 이동 · 존 진입 인식까지.
 * 존 콘텐츠와 퀴즈·스탬프는 다음 단계에서 붙인다.
 */

const CONTENT_READY = false; // 2단계에서 켠다

// Phaser 는 브라우저 전용이라 서버 렌더에서 제외한다.
const ExhibitionGame = dynamic(() => import('@/components/ExhibitionGame'), {
  ssr: false,
  loading: () => null,
});

export function ExhibitionClient() {
  const [entered, setEntered] = useState(false);
  const [nickname, setNickname] = useState('');
  const [zone, setZone] = useState<ExhibitionZone | null>(null);
  const [loading, setLoading] = useState(false);
  const [sheet, setSheet] = useState<string | null>(null);

  const start = useCallback((v: { nickname: string; sheet: string }) => {
    setLoading(true);
    setNickname(v.nickname);
    setSheet(v.sheet);
    setEntered(true);
  }, []);

  useEffect(() => {
    const onReady = () => setLoading(false);
    const onEnter = (p: { zone: ExhibitionZone }) => setZone(p.zone);
    const onLeave = () => setZone(null);

    EventBus.on('exhibition:ready', onReady);
    EventBus.on('exhibition:zone:enter', onEnter);
    EventBus.on('exhibition:zone:leave', onLeave);
    return () => {
      EventBus.off('exhibition:ready', onReady);
      EventBus.off('exhibition:zone:enter', onEnter);
      EventBus.off('exhibition:zone:leave', onLeave);
    };
  }, []);

  if (!entered) return <CharacterSelect onEnter={start} />;

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#0b1220]">
      {sheet && <ExhibitionGame avatarSheet={sheet} nickname={nickname} earned={[]} />}

      {loading && (
        <div className="absolute inset-0 grid place-items-center bg-[#0b1220]">
          <p className="text-white/70">전시장을 준비하고 있습니다…</p>
        </div>
      )}

      {/* 상단 바 */}
      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-4 py-3">
        <span className="rounded-pill bg-[#17233f]/90 px-3 py-1.5 text-sm font-bold text-white">
          2027 GS25 상품전략공유회
        </span>
        <span className="rounded-pill bg-[#17233f]/90 px-3 py-1.5 text-sm text-white/80">
          {nickname} · 전체 관람 약 {TOTAL_MINUTES}분
        </span>
      </header>

      {/* 존 안내 패널 */}
      {zone && (
        <aside className="absolute right-4 top-16 w-[min(23rem,85vw)] rounded-2xl border border-white/10 bg-[#0b1220]/95 p-5 text-white shadow-xl">
          <p className="text-xs font-bold tracking-widest text-[#00c2a8]">
            ZONE {String(zone.no).padStart(2, '0')}
          </p>
          <h2 className="mt-1 text-xl font-black">{zone.name}</h2>
          <p className="mt-0.5 text-xs text-white/45">{zone.nameEn}</p>
          <p className="mt-3 text-sm text-white/60">예상 관람 {zone.estimatedMinutes}분</p>

          {CONTENT_READY ? null : (
            <p className="mt-4 rounded-xl bg-white/[0.06] px-3 py-2.5 text-sm leading-relaxed text-white/60">
              이 존의 설명·사진과 퀴즈는 <b className="text-white/85">다음 단계</b>에서 열립니다.
              지금은 전시장을 걸어 다니며 배치를 살펴봐 주세요.
            </p>
          )}
        </aside>
      )}

      {/* 하단 존 진행 바 */}
      <footer className="pointer-events-none absolute inset-x-0 bottom-0 px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center gap-1.5 rounded-pill bg-[#17233f]/90 px-4 py-2">
          {ZONES.map((z) => (
            <span
              key={z.no}
              className={`h-2 flex-1 rounded-pill transition-all ${
                zone?.no === z.no ? 'bg-[#00c2a8]' : 'bg-white/20'
              }`}
              title={z.name}
            />
          ))}
          <span className="ml-2 shrink-0 text-xs font-bold text-white/70">
            {zone ? `${zone.no}/11` : '0/11'}
          </span>
        </div>
      </footer>

      {/* 조작 안내 — 처음 들어왔을 때만 */}
      {!zone && !loading && (
        <p className="pointer-events-none absolute bottom-16 left-1/2 -translate-x-1/2 rounded-pill bg-[#17233f]/85 px-4 py-2 text-sm text-white/75">
          방향키 · WASD · 화면 클릭으로 이동 / 휠로 확대·축소
        </p>
      )}
    </div>
  );
}
