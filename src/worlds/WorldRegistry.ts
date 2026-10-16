import { SunkenCathedral } from './SunkenCathedral';
import { InfiniteAscent } from './InfiniteAscent';
import { ObsidianCity } from './ObsidianCity';
import { ImpossibleHouse } from './ImpossibleHouse';
import { LastHorizon } from './LastHorizon';
import { RandomWorld } from './WorldGenerator';
import type { WorldDefinition } from './types';

export const WORLDS: WorldDefinition[] = [SunkenCathedral, InfiniteAscent, ObsidianCity, ImpossibleHouse, LastHorizon];

export const MENU_WORLD = 'sunken-cathedral';

export function getWorld(id: string): WorldDefinition {
  if (id === RandomWorld.id) return RandomWorld;
  const w = WORLDS.find((x) => x.id === id);
  if (!w) throw new Error(`Unknown world ${id}`);
  return w;
}
