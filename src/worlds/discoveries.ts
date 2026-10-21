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
    id: 'regress-inward',
    world: 'infinite-regress',
    title: "Zeno's Descent",
    description: 'Three times smaller, three times over. The vanishing point is exactly as far away as when you started.',
    hint: 'Fly toward the vanishing point, and keep going.',
  },
  {
    id: 'regress-outward',
    world: 'infinite-regress',
    title: 'The Same, Larger',
    description: 'You flew outward until the halls were dust beneath you, and found the same halls waiting.',
    hint: 'Fly away from the vanishing point for long enough.',
  },
  {
    id: 'gallery-penrose',
    world: 'contradiction-gallery',
    title: 'The Closed Triangle',
    description: 'Three straight bars at right angles to each other, meeting in a loop. From one stone on the floor, and only from there.',
    hint: 'A glowing mark on the floor faces something floating near the west wall.',
  },
  {
    id: 'gallery-stairs-view',
    world: 'contradiction-gallery',
    title: 'Ascending and Ascending',
    description: 'Seen from the balcony, four flights climb forever around a square and never get any higher.',
    hint: 'Stand at the tip of the balcony over the pit and look down.',
  },
  {
    id: 'gallery-endless',
    world: 'contradiction-gallery',
    title: 'The Stair That Never Tops Out',
    description: 'You climbed the square stair three times round and are exactly where you began, only higher.',
    hint: 'Step down onto the stairs and keep climbing.',
  },
  {
    id: 'gallery-ames',
    world: 'contradiction-gallery',
    title: 'Giants and Children',
    description: 'Two identical figures in a perfectly square room: one twice the size of the other. The room is the liar.',
    hint: 'Look through the peephole of the small room in the north-east.',
  },
  {
    id: 'gallery-droste',
    world: 'contradiction-gallery',
    title: 'The Painting of Itself',
    description: 'A painting of the gallery, including the painting, including the painting… You stepped inside and found yourself in front of it.',
    hint: 'The gold frame on the north wall is not a picture.',
  },
  {
    id: 'gallery-tesseract',
    world: 'contradiction-gallery',
    title: 'A Fourth Direction',
    description: 'A cube of cubes, turning in a direction you have no word for. Its inside became its outside and back.',
    hint: 'Something hovers above the floor that never ends.',
  },
  {
    id: 'machine-core',
    world: 'recursive-machine',
    title: 'The Core',
    description: 'At the centre of a machine made of copies of itself, a cube from the fourth dimension keeps turning.',
    hint: 'Fly toward the light at the heart of the machine.',
  },
  {
    id: 'machine-rewire',
    world: 'recursive-machine',
    title: 'The Machine Rewires Itself',
    description: 'You pushed the slice along the fourth axis. Walls dissolved into slits, slits into halls, and the machine rebuilt itself around you.',
    hint: 'At the core, touch the hypercube.',
  },
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
