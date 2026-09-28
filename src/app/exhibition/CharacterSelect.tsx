'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CharacterAppearance } from '@/lib/lpc-registry';
import { compositeCharacter } from '@/lib/sprite-compositor';

/**
 * 전시장 입장 전 아바타를 고른다.
 *
 * DeskRPG 의 전체 LPC 편집기는 항목이 수십 개라 전시장 입장에는 과하다.
 * 체형·피부·머리·복장 네 가지로 줄이고, 나머지는 기본값으로 둔다.
 * 경영주님이 게임을 하러 오신 게 아니라 전시를 보러 오신 것이기 때문이다.
 */

interface Option {
  key: string;
  variant: string;
  label: string;
}

/** 레지스트리에서 실제로 존재하는 항목만 추려 온다 */
interface Registry {
  bodyTypes: string[];
  categories: Array<{
    id: string;
    type_name: string;
    label: string;
    items: Array<{ key: string; name: string; variants?: string[] }>;
  }>;
}

const STEP_DEFS = [
  { id: 'body', label: '피부' },
  { id: 'hair', label: '머리' },
  { id: 'torso', label: '상의' },
  { id: 'legs', label: '하의' },
] as const;

export function CharacterSelect({
  onEnter,
}: {
  onEnter: (v: { appearance: CharacterAppearance; nickname: string; sheet: string }) => void;
}) {
  const [registry, setRegistry] = useState<Registry | null>(null);
  const [bodyType, setBodyType] = useState('male');
  const [picks, setPicks] = useState<Record<string, Option | null>>({});
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetch('/assets/lpc-registry.json')
      .then((r) => r.json())
      .then((r: Registry) => setRegistry(r))
      .catch(() => setError('아바타 자료를 불러오지 못했습니다.'));
  }, []);

  /** 카테고리별 선택지 — 변형(variant)이 있는 항목만 쓴다 */
  const options = useMemo(() => {
    const out: Record<string, Option[]> = {};
    if (!registry) return out;
    for (const def of STEP_DEFS) {
      const cat = registry.categories.find((c) => c.id === def.id || c.type_name === def.id);
      if (!cat) continue;
      const list: Option[] = [];
      for (const item of cat.items) {
        for (const v of item.variants ?? []) {
          list.push({ key: item.key, variant: v, label: `${item.name} · ${v}` });
        }
      }
      out[def.id] = list.slice(0, 24); // 너무 많으면 고르기 어렵다
    }
    return out;
  }, [registry]);

  // 처음 열릴 때 기본 조합을 채운다
  useEffect(() => {
    if (!registry || Object.keys(picks).length > 0) return;
    const init: Record<string, Option | null> = {};
    for (const def of STEP_DEFS) {
      init[def.id] = options[def.id]?.[0] ?? null;
    }
    setPicks(init);
  }, [registry, options, picks]);

  const appearance: CharacterAppearance = useMemo(
    () => ({
      bodyType,
      layers: Object.fromEntries(
        Object.entries(picks).map(([k, v]) => [k, v ? { itemKey: v.key, variant: v.variant } : null]),
      ),
    }),
    [bodyType, picks],
  );

  // 미리보기 — 첫 프레임만 크게 보여 준다
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || Object.keys(picks).length === 0) return;
    let cancelled = false;
    const off = document.createElement('canvas');
    compositeCharacter(off, appearance)
      .then(() => {
        if (cancelled) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // 2행(아래 보기) 0열 = 정면 정지
        ctx.drawImage(off, 0, 128, 64, 64, 0, 0, canvas.width, canvas.height);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [appearance, picks]);

  const enter = useCallback(async () => {
    const name = nickname.trim();
    if (name.length < 2) {
      setError('닉네임을 2자 이상 입력해 주세요.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const off = document.createElement('canvas');
      await compositeCharacter(off, appearance);
      onEnter({ appearance, nickname: name, sheet: off.toDataURL('image/png') });
    } catch {
      setError('아바타를 만들지 못했습니다. 다시 시도해 주세요.');
      setBusy(false);
    }
  }, [appearance, nickname, onEnter]);

  const cycle = (id: string, dir: 1 | -1) => {
    const list = options[id] ?? [];
    if (list.length === 0) return;
    const cur = picks[id];
    const idx = cur ? list.findIndex((o) => o.key === cur.key && o.variant === cur.variant) : -1;
    const next = (idx + dir + list.length) % list.length;
    setPicks((p) => ({ ...p, [id]: list[next] }));
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#0b1220] px-5 py-10 text-white">
      <div className="w-full max-w-3xl">
        <p className="text-sm font-bold tracking-widest text-[#00c2a8]">2027 GS25 PRODUCT SHOW</p>
        <h1 className="mt-1 text-3xl font-black sm:text-4xl">온라인 전시장에 오신 것을 환영합니다</h1>
        <p className="mt-2 text-white/60">
          아바타를 고르고 입장하시면, 전시장을 직접 걸어 다니며 11개 존을 둘러보실 수 있습니다.
        </p>

        <div className="mt-8 grid gap-6 sm:grid-cols-[220px_1fr]">
          {/* 미리보기 */}
          <div className="flex flex-col items-center gap-3">
            <div className="grid h-[220px] w-[220px] place-items-center rounded-2xl border border-white/10 bg-white/[0.04]">
              <canvas
                ref={canvasRef}
                width={160}
                height={160}
                className="[image-rendering:pixelated]"
              />
            </div>
            <div className="flex gap-2">
              {['male', 'female'].map((b) => (
                <button
                  key={b}
                  onClick={() => setBodyType(b)}
                  className={`rounded-pill px-4 py-1.5 text-sm font-bold transition ${
                    bodyType === b ? 'bg-[#00c2a8] text-[#0b1220]' : 'border border-white/20 text-white/70'
                  }`}
                >
                  {b === 'male' ? '남성' : '여성'}
                </button>
              ))}
            </div>
          </div>

          {/* 선택 */}
          <div className="space-y-3">
            {STEP_DEFS.map((def) => (
              <div
                key={def.id}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
              >
                <span className="w-12 shrink-0 text-sm font-bold text-white/70">{def.label}</span>
                <button
                  aria-label={`${def.label} 이전`}
                  onClick={() => cycle(def.id, -1)}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-white/20 text-white/70"
                >
                  ‹
                </button>
                <span className="min-w-0 flex-1 truncate text-center text-sm text-white/80">
                  {picks[def.id]?.label ?? '없음'}
                </span>
                <button
                  aria-label={`${def.label} 다음`}
                  onClick={() => cycle(def.id, 1)}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-white/20 text-white/70"
                >
                  ›
                </button>
              </div>
            ))}

            <label className="block">
              <span className="block text-sm font-bold text-white/70">닉네임</span>
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value.slice(0, 8))}
                maxLength={8}
                placeholder="2~8자"
                className="mt-1 h-11 w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 text-white outline-none focus:border-[#00c2a8]"
              />
            </label>

            {error && (
              <p className="rounded-xl bg-red-500/15 px-3 py-2 text-sm font-semibold text-red-300">
                {error}
              </p>
            )}

            <button
              onClick={enter}
              disabled={busy || !registry}
              className="h-12 w-full rounded-xl bg-[#00c2a8] font-black text-[#0b1220] transition hover:brightness-110 disabled:opacity-40"
            >
              {busy ? '입장하는 중…' : '전시장 입장'}
            </button>
          </div>
        </div>

        <p className="mt-6 text-xs leading-relaxed text-white/40">
          아바타 그래픽: Liberated Pixel Cup (LPC) · 이동은 방향키 · WASD · 화면 클릭 모두 됩니다.
        </p>
      </div>
    </div>
  );
}
