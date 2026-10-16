/** Static catalogue so the journal can list every secret without building worlds. */
export interface DiscoveryInfo {
  id: string;
  world: string;
  title: string;
  description: string;
  hint: string;
}

export const DISCOVERIES: DiscoveryInfo[] = [
  {
    id: 'cathedral-reveal',
    world: 'sunken-cathedral',
    title: 'The Narrow Way',
    description: 'A corridor no wider than outstretched arms opens into a nave that the fog cannot finish.',
    hint: 'Walk to the end of the first corridor.',
  },
  {
    id: 'cathedral-sunstone',
    world: 'sunken-cathedral',
    title: 'The Sun Stone',
    description: 'A floating stone at the crossing. When touched, the light through the broken vault deepens to gold.',
    hint: 'Something hovers above the water at the heart of the nave.',
  },
  {
    id: 'cathedral-chapel',
    world: 'sunken-cathedral',
    title: 'Larger Within',
    description: 'A chapel the size of a garden shed, standing alone in the shallows. Its door opens onto a hall too vast for it.',
    hint: 'A small building stands in the water beyond the eastern columns.',
  },
  {
    id: 'cathedral-hollow-pillar',
    world: 'sunken-cathedral',
    title: 'The Hollow Pillar',
    description: 'One of the outer columns is a doorway. Inside, a passage to a city of black glass.',
    hint: 'Count the outer columns on the western side.',
  },
  {
    id: 'ascent-loop',
    world: 'infinite-ascent',
    title: 'The Stair That Returns',
    description: 'You climbed. You arrived at the bottom of the same stair.',
    hint: 'Climb the long white stair to its top landing.',
  },
  {
    id: 'ascent-inverted',
    world: 'infinite-ascent',
    title: 'Underside of the Sky',
    description: 'Through the high arch, the stair continues into a district built upside down.',
    hint: 'A stair rises through an arch on the northern platform.',
  },
  {
    id: 'ascent-rings',
    world: 'infinite-ascent',
    title: 'Concord of Rings',
    description: 'The great rings answered a single tone and came, briefly, into alignment.',
    hint: 'A resonant lectern faces the central tower.',
  },
  {
    id: 'obsidian-anamorph',
    world: 'obsidian-city',
    title: 'The Shifting Monolith',
    description: 'Scattered fragments resolve into a perfect ring from exactly one place in the city.',
    hint: 'Some structures only make sense from the right spot. Look for a marked stone in the eastern plaza.',
  },
  {
    id: 'obsidian-pool',
    world: 'obsidian-city',
    title: 'Pool of Stillness',
    description: 'The luminous pool woke the lines in the walls, one by one, out to the edge of the city.',
    hint: 'Stand in the luminous water.',
  },
  {
    id: 'obsidian-hidden-room',
    world: 'obsidian-city',
    title: 'The Unreachable Room',
    description: 'A lit room high in the monolith, seen from below. A dark panel at ground level was a door all along.',
    hint: 'A portal hides in plain sight on a plaza wall.',
  },
  {
    id: 'house-larger',
    world: 'impossible-house',
    title: 'The Door to the Nave',
    description: 'An ordinary door in an ordinary hallway, opening into a hall the size of a cathedral.',
    hint: 'Try the door at the end of the hallway.',
  },
  {
    id: 'house-turned',
    world: 'impossible-house',
    title: 'The Turned Room',
    description: 'Seen through the doorway, the room lay on its side. Stepping in, gravity quietly agreed with it.',
    hint: 'Look through the side door in the parlour.',
  },
  {
    id: 'house-window',
    world: 'impossible-house',
    title: 'A Window Too Wide',
    description: 'A window the size of a picture frame, and beyond it an entire sunset.',
    hint: 'The study has a window that shows the wrong weather.',
  },
  {
    id: 'house-stair',
    world: 'impossible-house',
    title: 'The Stair Below the Attic',
    description: 'The stair up to the attic delivered you to the cellar.',
    hint: 'Climb the stair in the hallway.',
  },
  {
    id: 'horizon-reveal',
    world: 'last-horizon',
    title: 'The Horizon Reveal',
    description: 'From the end of the observation platform, the far structure finally showed its true size.',
    hint: 'Walk to the very end of the long platform.',
  },
  {
    id: 'horizon-inscription',
    world: 'last-horizon',
    title: 'The Hidden Inscription',
    description: 'Beneath the great arch, a glyph in the stone. When read, the inverted city answered.',
    hint: 'Look beneath the largest arch.',
  },
];

export function discoveryInfo(id: string): DiscoveryInfo | undefined {
  return DISCOVERIES.find((d) => d.id === id);
}
