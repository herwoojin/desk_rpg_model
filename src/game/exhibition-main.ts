import Phaser from 'phaser';
import { ExhibitionScene, type ExhibitionSceneData } from './scenes/exhibition/ExhibitionScene';

/** 전시장 전용 Phaser 인스턴스 — 기존 GameScene 과 섞지 않는다. */
export function createExhibitionGame(parent: string, data: ExhibitionSceneData): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#0b1220',
    pixelArt: true,
    banner: false,
    disableContextMenu: true,
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
    scene: [ExhibitionScene],
    scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.NO_CENTER },
  });
  game.scene.start('ExhibitionScene', data);
  return game;
}
