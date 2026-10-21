import { InfiniteRegress } from './InfiniteRegress';
import { ContradictionGallery } from './ContradictionGallery';
import { RecursiveMachine } from './RecursiveMachine';
import { SunkenCathedral } from './SunkenCathedral';
import { InfiniteAscent } from './InfiniteAscent';
import { ObsidianCity } from './ObsidianCity';
import { ImpossibleHouse } from './ImpossibleHouse';
import { LastHorizon } from './LastHorizon';
import { RandomWorld } from './WorldGenerator';
import type { WorldDefinition } from './types';

export const WORLDS: WorldDefinition[] = [InfiniteRegress, ContradictionGallery, RecursiveMachine, SunkenCathedral, InfiniteAscent, ObsidianCity, ImpossibleHouse, LastHorizon];

export const MENU_WORLD = 'infinite-regress';

export function getWorld(id: string): WorldDefinition {
  if (id === RandomWorld.id) return RandomWorld;
  const w = WORLDS.find((x) => x.id === id);
  if (!w) throw new Error(`Unknown world ${id}`);
  return w;
}
