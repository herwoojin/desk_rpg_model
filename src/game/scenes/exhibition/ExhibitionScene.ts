import Phaser from 'phaser';
import { EventBus } from '@/game/EventBus';
import {
  AREA_COLOR,
  AREA_LABEL,
  ENTRANCE,
  EXIT,
  MAP_H,
  MAP_W,
  PX_PER_M,
  ZONES,
  zoneRectPx,
  type ExhibitionZone,
} from '@/lib/exhibition/zones';

/**
 * 온라인 전시장 — 아바타로 돌아다니며 존을 방문한다.
 *
 * 시점은 **탑다운**이다. 가이드맵은 아이소메트릭이지만, 여기서는 이동과 충돌이
 * 훨씬 안정적인 탑다운을 택했다. 아이소메트릭은 깊이 정렬·대각 충돌·좌표 변환이
 * 전부 따라와, 1단계에서 그쪽에 힘을 쓰면 정작 '돌아다니는 느낌'을 다듬을 여유가 없다.
 * 존 배치·크기·색은 가이드맵과 같은 데이터를 쓰므로 위치 감각은 그대로다.
 *
 * React 와는 EventBus 로만 이야기한다 (Phaser 가 React 를 직접 모른다).
 *   exhibition:ready      씬 준비 완료
 *   exhibition:zone:enter 존에 들어감
 *   exhibition:zone:leave 존에서 나옴
 */

const PLAYER_SPEED = 190;
const PLAYER_BODY = { w: 20, h: 16, offX: 22, offY: 44 };

export interface ExhibitionSceneData {
  /** compositeCharacter 로 만든 576x256 워크 시트 — React 에서 디코딩까지 마친 이미지 */
  avatar: HTMLImageElement;
  nickname: string;
  /** 이미 획득한 존 번호 */
  earned: number[];
}

export class ExhibitionScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private nameTag!: Phaser.GameObjects.Text;
  private zoneBodies = new Map<number, Phaser.GameObjects.Rectangle>();
  private zoneGlow = new Map<number, Phaser.GameObjects.Rectangle>();
  private currentZone: number | null = null;
  private moveTarget: Phaser.Math.Vector2 | null = null;
  private earned = new Set<number>();
  private sceneData!: ExhibitionSceneData;

  constructor() {
    super('ExhibitionScene');
  }

  init(data: ExhibitionSceneData) {
    this.sceneData = data;
    this.earned = new Set(data.earned ?? []);
  }

  preload() {
    // 아바타는 React 쪽에서 합성·디코딩까지 끝내 이미지로 넘겨 준다.
    // addBase64 를 쓰면 image.onload 로 한 박자 늦게 들어오는데, 그 사이 창을 닫으면
    // Phaser 가 이미 사라진 renderer 를 건드려 터진다. 동기 등록으로 그 틈을 없앤다.
    if (!this.textures.exists('avatar')) this.textures.addImage('avatar', this.sceneData.avatar);
  }

  create() {
    this.build();
  }

  private build() {
    this.buildFloor();
    this.buildGates();
    this.buildZones();
    // 벽을 먼저 세워 두고, 플레이어가 생긴 뒤에 충돌을 건다.
    const walls = this.buildWalls();
    this.buildPlayer(walls);
    this.buildCamera();
    this.buildInput();

    EventBus.emit('exhibition:ready', { zones: ZONES.length });
  }

  // ── 바닥 ────────────────────────────────────────────────────────
  private buildFloor() {
    const g = this.add.graphics().setDepth(-100);
    g.fillStyle(0xf3e7b8);
    g.fillRect(0, 0, MAP_W, MAP_H);

    // 1m 격자 — 거리 감각을 준다. 너무 진하면 눈이 아프니 아주 옅게.
    g.lineStyle(1, 0xd9c98f, 0.45);
    for (let x = 0; x <= MAP_W; x += PX_PER_M) {
      g.lineBetween(x, 0, x, MAP_H);
    }
    for (let y = 0; y <= MAP_H; y += PX_PER_M) {
      g.lineBetween(0, y, MAP_W, y);
    }
  }

  private buildGates() {
    const gate = (x: number, y: number, label: string, color: number) => {
      this.add.rectangle(x, y, 84, 40, color, 0.9).setStrokeStyle(3, 0x17233f).setDepth(-45);
      this.add
        .text(x, y, label, {
          fontFamily: 'sans-serif',
          fontSize: '15px',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(-44);
    };
    gate(ENTRANCE.x, ENTRANCE.y, '입구', 0x2e8c5c);
    gate(EXIT.x, EXIT.y, '출구', 0xc4482a);
  }

  // ── 존 ──────────────────────────────────────────────────────────
  private buildZones() {
    for (const z of ZONES) {
      const r = zoneRectPx(z);
      const color = AREA_COLOR[z.area];

      // 바닥 블록
      this.add
        .rectangle(r.cx, r.cy, r.w, r.h, color, 0.55)
        .setStrokeStyle(3, 0x17233f, 0.9)
        .setDepth(-50);

      // 진입 시 켜지는 하이라이트
      const glow = this.add
        .rectangle(r.cx, r.cy, r.w, r.h, 0xffffff, 0)
        .setDepth(-49);
      this.zoneGlow.set(z.no, glow);

      // 번호 핀
      const pin = this.add.circle(r.cx, r.cy - r.h / 2 + 26, 18, 0xf5d14b).setDepth(-40);
      pin.setStrokeStyle(3, 0x17233f);
      this.add
        .text(r.cx, r.cy - r.h / 2 + 26, String(z.no), {
          fontFamily: 'monospace',
          fontSize: '20px',
          color: '#17233f',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(-39);

      // 존 이름
      this.add
        .text(r.cx, r.cy + 6, z.name, {
          fontFamily: 'sans-serif',
          fontSize: '18px',
          color: '#0d1626',
          fontStyle: 'bold',
          align: 'center',
          wordWrap: { width: r.w - 24 },
        })
        .setOrigin(0.5)
        .setDepth(-38);

      this.add
        .text(r.cx, r.cy + 32, z.nameEn, {
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#0d1626',
        })
        .setOrigin(0.5)
        .setAlpha(0.55)
        .setDepth(-38);

      // 획득 표시
      if (this.earned.has(z.no)) this.markEarned(z.no);

      // 겹침 판정용 (보이지 않는 사각형)
      const body = this.add.rectangle(r.cx, r.cy, r.w, r.h);
      this.physics.add.existing(body, true);
      this.zoneBodies.set(z.no, body);
    }

    // 구역 이름 배너 — 세 덩어리 위쪽에 하나씩
    for (const area of ['green', 'blue', 'orange'] as const) {
      const list = ZONES.filter((z) => z.area === area);
      const cx = list.reduce((a, z) => a + zoneRectPx(z).cx, 0) / list.length;
      const top = Math.min(...list.map((z) => zoneRectPx(z).y));
      this.add
        .text(cx, top - 26, AREA_LABEL[area], {
          fontFamily: 'monospace',
          fontSize: '15px',
          color: '#ffffff',
          backgroundColor: '#17233f',
          padding: { x: 12, y: 5 },
        })
        .setOrigin(0.5)
        .setDepth(-37);
    }
  }

  private markEarned(no: number) {
    const r = zoneRectPx(ZONES[no - 1]);
    this.add
      .text(r.cx + r.w / 2 - 22, r.cy - r.h / 2 + 22, '★', {
        fontFamily: 'sans-serif',
        fontSize: '26px',
        color: '#f5d14b',
      })
      .setOrigin(0.5)
      .setDepth(-37);
  }

  // ── 벽 ──────────────────────────────────────────────────────────
  private buildWalls(): Phaser.Physics.Arcade.StaticGroup {
    const t = 16;
    const walls = this.physics.add.staticGroup();
    const add = (x: number, y: number, w: number, h: number) => {
      const r = this.add.rectangle(x, y, w, h, 0x17233f, 1).setDepth(-60);
      walls.add(r);
    };
    add(MAP_W / 2, t / 2, MAP_W, t);
    add(MAP_W / 2, MAP_H - t / 2, MAP_W, t);
    add(t / 2, MAP_H / 2, t, MAP_H);
    add(MAP_W - t / 2, MAP_H / 2, t, MAP_H);
    return walls;
  }

  // ── 아바타 ──────────────────────────────────────────────────────
  private buildPlayer(walls: Phaser.Physics.Arcade.StaticGroup) {
    // LPC 워크 시트는 576x256, 64px 프레임이 9열 4행이다.
    // 0열은 정지 자세, 1~8열이 걷기 동작이다.
    if (!this.textures.exists('avatarSheet')) {
      const src = this.textures.get('avatar').getSourceImage() as HTMLImageElement;
      this.textures.addSpriteSheet('avatarSheet', src, {
        frameWidth: 64,
        frameHeight: 64,
      });
    }

    const dirs: Array<[string, number]> = [
      ['up', 0],
      ['left', 1],
      ['down', 2],
      ['right', 3],
    ];
    for (const [name, row] of dirs) {
      if (this.anims.exists(`walk-${name}`)) continue;
      this.anims.create({
        key: `walk-${name}`,
        frames: Array.from({ length: 8 }, (_, i) => ({
          key: 'avatarSheet',
          frame: row * 9 + i + 1,
        })),
        frameRate: 10,
        repeat: -1,
      });
      this.anims.create({
        key: `idle-${name}`,
        frames: [{ key: 'avatarSheet', frame: row * 9 }],
        frameRate: 1,
      });
    }

    this.player = this.physics.add.sprite(ENTRANCE.x, ENTRANCE.y, 'avatarSheet', 18);
    this.player.setDepth(10);
    this.player.body!.setSize(PLAYER_BODY.w, PLAYER_BODY.h);
    (this.player.body as Phaser.Physics.Arcade.Body).setOffset(PLAYER_BODY.offX, PLAYER_BODY.offY);
    this.player.setCollideWorldBounds(true);

    this.physics.add.collider(this.player, walls);

    this.nameTag = this.add
      .text(ENTRANCE.x, ENTRANCE.y - 34, this.sceneData.nickname, {
        fontFamily: 'sans-serif',
        fontSize: '13px',
        color: '#ffffff',
        backgroundColor: '#17233fcc',
        padding: { x: 6, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(11);

    // 존 겹침 판정
    for (const [no, body] of this.zoneBodies) {
      this.physics.add.overlap(this.player, body, () => this.onZoneTouch(no));
    }
  }

  private buildCamera() {
    this.physics.world.setBounds(0, 0, MAP_W, MAP_H);
    this.cameras.main.setBounds(0, 0, MAP_W, MAP_H);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setZoom(1.15);
    this.cameras.main.setBackgroundColor('#0b1220');

    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      const z = Phaser.Math.Clamp(this.cameras.main.zoom - dy * 0.0012, 0.6, 2.2);
      this.cameras.main.setZoom(z);
    });
  }

  private buildInput() {
    this.cursors = this.input.keyboard!.createCursorKeys();
    // addKeys('W,A,S,D') 는 W/A/S/D 라는 이름으로 준다.
    // 방향 이름으로 쓰려면 매핑을 명시해야 한다.
    this.wasd = this.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as typeof this.wasd;

    // 클릭 이동 — 키보드가 어려운 분도 돌아다닐 수 있어야 한다
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const w = this.cameras.main.getWorldPoint(p.x, p.y);
      this.moveTarget = new Phaser.Math.Vector2(w.x, w.y);
    });
  }

  // ── 존 판정 ─────────────────────────────────────────────────────
  private touchedThisFrame: number | null = null;

  private onZoneTouch(no: number) {
    this.touchedThisFrame = no;
  }

  private setZone(no: number | null) {
    if (this.currentZone === no) return;

    if (this.currentZone !== null) {
      this.zoneGlow.get(this.currentZone)?.setFillStyle(0xffffff, 0);
      EventBus.emit('exhibition:zone:leave', { no: this.currentZone });
    }
    this.currentZone = no;
    if (no !== null) {
      this.zoneGlow.get(no)?.setFillStyle(0xffffff, 0.18);
      EventBus.emit('exhibition:zone:enter', { no, zone: ZONES[no - 1] });
    }
  }

  /** 스탬프를 얻었을 때 React 가 불러 준다 */
  public awardStamp(no: number) {
    if (this.earned.has(no)) return;
    this.earned.add(no);
    this.markEarned(no);
    const r = zoneRectPx(ZONES[no - 1]);
    const burst = this.add.particles(r.cx, r.cy, 'avatarSheet', {
      frame: 0,
      lifespan: 700,
      speed: { min: 80, max: 220 },
      scale: { start: 0.5, end: 0 },
      quantity: 16,
      emitting: false,
    });
    burst.explode(16);
    this.time.delayedCall(900, () => burst.destroy());
  }

  update() {
    if (!this.player?.body || !this.cursors || !this.wasd?.left) return;

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    let vx = 0;
    let vy = 0;

    const left = this.cursors.left.isDown || this.wasd.left.isDown;
    const right = this.cursors.right.isDown || this.wasd.right.isDown;
    const up = this.cursors.up.isDown || this.wasd.up.isDown;
    const down = this.cursors.down.isDown || this.wasd.down.isDown;

    if (left) vx = -1;
    else if (right) vx = 1;
    if (up) vy = -1;
    else if (down) vy = 1;

    // 키 입력이 있으면 클릭 이동은 취소한다 — 서로 싸우면 안 된다
    if (vx || vy) this.moveTarget = null;

    if (!vx && !vy && this.moveTarget) {
      const d = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        this.moveTarget.x,
        this.moveTarget.y,
      );
      if (d < 6) {
        this.moveTarget = null;
      } else {
        vx = this.moveTarget.x - this.player.x;
        vy = this.moveTarget.y - this.player.y;
        const len = Math.hypot(vx, vy) || 1;
        vx /= len;
        vy /= len;
      }
    }

    const len = Math.hypot(vx, vy);
    if (len > 0) {
      body.setVelocity((vx / len) * PLAYER_SPEED, (vy / len) * PLAYER_SPEED);
      const dir =
        Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'right' : 'left') : vy > 0 ? 'down' : 'up';
      this.player.anims.play(`walk-${dir}`, true);
      this.player.setData('dir', dir);
    } else {
      body.setVelocity(0, 0);
      const dir = (this.player.getData('dir') as string) ?? 'down';
      this.player.anims.play(`idle-${dir}`, true);
    }

    this.nameTag.setPosition(this.player.x, this.player.y - 34);

    // overlap 콜백은 프레임마다 불리므로, 프레임 끝에서 한 번만 반영한다
    this.setZone(this.touchedThisFrame);
    this.touchedThisFrame = null;
  }
}
