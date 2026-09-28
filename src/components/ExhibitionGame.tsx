'use client';

import { useEffect, useRef } from 'react';
import { createExhibitionGame } from '@/game/exhibition-main';

/**
 * Phaser 를 실제로 띄우는 곳.
 *
 * Phaser 는 window 가 있어야 하므로 이 컴포넌트는 반드시
 * `dynamic(..., { ssr: false })` 로만 불러야 한다. 콜백 안의 await import 만으로는
 * 번들러가 서버 쪽에도 끌어와 'Export default doesn't exist' 로 터진다.
 */

export interface ExhibitionGameProps {
  /** compositeCharacter 가 만든 576x256 워크 시트의 dataURL */
  avatarSheet: string;
  nickname: string;
  /** 이미 획득한 존 번호 */
  earned: number[];
}

export default function ExhibitionGame(props: ExhibitionGameProps) {
  const gameRef = useRef<ReturnType<typeof createExhibitionGame> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef(props);
  dataRef.current = props;

  useEffect(() => {
    if (gameRef.current || !boxRef.current) return;
    let cancelled = false;

    // 아바타 디코딩을 Phaser 밖에서 먼저 끝낸다. 게임이 뜬 뒤에 텍스처가 들어오면
    // 그 사이 창을 닫았을 때 Phaser 가 사라진 renderer 를 건드려 터진다.
    const img = new Image();
    img.src = dataRef.current.avatarSheet;
    const boot = () => {
      if (cancelled) return;
      gameRef.current = createExhibitionGame('exhibition-root', {
        avatar: img,
        nickname: dataRef.current.nickname,
        earned: dataRef.current.earned,
      });
    };
    // 디코딩이 실패해도 전시장 자체는 열어 준다(아바타만 빈 칸). 멈춰 있는 것보다 낫다.
    img.decode().then(boot, boot);

    return () => {
      cancelled = true;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
    // 게임은 한 번만 만든다. 닉네임·아바타가 바뀌면 화면을 새로 여는 흐름이다.
  }, []);

  return <div id="exhibition-root" ref={boxRef} className="absolute inset-0" />;
}
