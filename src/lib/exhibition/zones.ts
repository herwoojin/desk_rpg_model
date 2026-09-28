/**
 * 2027 GS25 상품전략공유회 온라인 전시장 — 존 배치.
 *
 * 좌표는 본 사이트 가이드맵(`SECTIONS[].hallPosition`)과 같은 값이다.
 * 미터 단위이고 전시장은 49m × 35m. 중심이 (0,0) 이며 x 는 오른쪽, z 는 위쪽이 양수다.
 * 게임 좌표로는 `toGame()` 이 좌상단 기준 픽셀로 바꿔 준다.
 */

export type ZoneArea = 'green' | 'blue' | 'orange';

export interface ExhibitionZone {
  /** 1~11 */
  no: number;
  id: string;
  name: string;
  nameEn: string;
  area: ZoneArea;
  /** 전시장 좌표(m) — 가이드맵과 동일 */
  x: number;
  z: number;
  w: number;
  d: number;
  estimatedMinutes: number;
}

/** 전시장 크기 (m) */
export const HALL_W = 49;
export const HALL_D = 35;

/** 1m 당 픽셀 */
export const PX_PER_M = 32;

export const AREA_COLOR: Record<ZoneArea, number> = {
  green: 0x3aa76d,
  blue: 0x2b6fd4,
  orange: 0xee6640,
};

export const AREA_LABEL: Record<ZoneArea, string> = {
  green: 'WELCOME STAGE',
  blue: 'PRODUCT ADVENTURE',
  orange: 'STRATEGY PLAYGROUND',
};

export const ZONES: ExhibitionZone[] = [
  { no: 1, id: 'welcome', name: '웰컴존', nameEn: 'WELCOME ZONE', area: 'green', x: -19, z: 13, w: 11, d: 9, estimatedMinutes: 5 },
  { no: 2, id: 'media', name: '미디어 시청', nameEn: 'MEDIA THEATER', area: 'green', x: -6.5, z: 13, w: 11, d: 9, estimatedMinutes: 7 },
  { no: 3, id: 'standard-store', name: '표준매장 둘러보기', nameEn: 'STANDARD STORE', area: 'green', x: 9, z: 12.5, w: 17, d: 10, estimatedMinutes: 12 },
  { no: 4, id: 'counter-ff', name: '카운터 FF 상품', nameEn: 'COUNTER FF', area: 'blue', x: -19, z: 0, w: 11, d: 9, estimatedMinutes: 10 },
  { no: 5, id: 'fresh', name: '신선강화점', nameEn: 'FRESH STORE', area: 'blue', x: -6.5, z: 0, w: 11, d: 9, estimatedMinutes: 10 },
  { no: 6, id: 'new-format', name: '뉴포맷 운영컨셉', nameEn: 'NEW FORMAT', area: 'blue', x: 6.5, z: 0, w: 11, d: 9, estimatedMinutes: 8 },
  { no: 7, id: 'education', name: '교육지원팀 교육내용', nameEn: 'EDUCATION', area: 'blue', x: 19, z: 0, w: 11, d: 9, estimatedMinutes: 7 },
  { no: 8, id: 'ax-auto-order', name: 'AX부문 자동발주', nameEn: 'AX AUTO ORDER', area: 'orange', x: -19, z: -13, w: 11, d: 9, estimatedMinutes: 9 },
  { no: 9, id: 'win-win', name: '상생협력팀 경영주 협의회', nameEn: 'WIN-WIN COUNCIL', area: 'orange', x: -6.5, z: -13, w: 11, d: 9, estimatedMinutes: 7 },
  { no: 10, id: 'souvenir', name: '기념품존', nameEn: 'SOUVENIR ZONE', area: 'orange', x: 6.5, z: -13, w: 11, d: 9, estimatedMinutes: 4 },
  { no: 11, id: 'exit', name: '퇴점', nameEn: 'EXIT', area: 'orange', x: 19, z: -13, w: 11, d: 9, estimatedMinutes: 4 },
];

export const TOTAL_MINUTES = ZONES.reduce((a, z) => a + z.estimatedMinutes, 0);

/** 전시장 좌표(m) → 게임 픽셀(좌상단 원점). z 는 위가 양수라 뒤집는다. */
export function toGame(x: number, z: number): { x: number; y: number } {
  return {
    x: (x + HALL_W / 2) * PX_PER_M,
    y: (HALL_D / 2 - z) * PX_PER_M,
  };
}

export const MAP_W = HALL_W * PX_PER_M;
export const MAP_H = HALL_D * PX_PER_M;

/**
 * 입구·출구.
 *
 * 존이 전시장 위아래 끝까지 차 있어 가장자리에는 설 자리가 없다.
 * 2번째 줄(z −4.5~4.5)과 3번째 줄(z −17.5~−8.5) 사이 통로에 둔다.
 */
const CORRIDOR_Z = -6.5;
export const ENTRANCE = toGame(-21.5, CORRIDOR_Z);
export const EXIT = toGame(21.5, CORRIDOR_Z);

export function zoneRectPx(z: ExhibitionZone) {
  const c = toGame(z.x, z.z);
  return {
    x: c.x - (z.w * PX_PER_M) / 2,
    y: c.y - (z.d * PX_PER_M) / 2,
    w: z.w * PX_PER_M,
    h: z.d * PX_PER_M,
    cx: c.x,
    cy: c.y,
  };
}
