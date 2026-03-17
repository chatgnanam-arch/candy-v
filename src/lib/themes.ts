import type { CandyThemeId, NormalTileColor } from '../game/types';

export type CandyTheme = {
  id: CandyThemeId;
  name: string;
  tagline: string;
  mood: string;
  feature: string;
  collectionName: string;
  prismLabel: string;
  notes: [string, string, string];
  candyLabels: Record<NormalTileColor, string>;
  swatches: [string, string, string, string];
};

export const DEFAULT_THEME_ID: CandyThemeId = 'sugar-sunrise';

export const CANDY_THEMES: CandyTheme[] = [
  {
    id: 'sugar-sunrise',
    name: 'Sugar Sunrise',
    tagline: 'Festival fruit chews with peach-soda glow.',
    mood: 'Warm, bright, and glossy.',
    feature: 'Caramel-framed candies with parade-day warmth.',
    collectionName: 'Sunrise Sweet Stall',
    prismLabel: 'Parade Prism',
    notes: ['soft caramel edge', 'festival fruit gloss', 'sunlit soda sparkle'],
    candyLabels: {
      strawberry: 'Sunberry Chew',
      tangerine: 'Citrus Taffy',
      blueberry: 'Skyberry Drop',
      mint: 'Mint Ripple',
      grape: 'Velvet Grape',
      peach: 'Peach Soda Bite',
    },
    swatches: ['#ff8f7e', '#ffcc68', '#71c6ff', '#90f2d7'],
  },
  {
    id: 'citrus-splash',
    name: 'Citrus Splash',
    tagline: 'Sherbet wedges and mint-market sparkle.',
    mood: 'Zesty, breezy, and juicy.',
    feature: 'Crisp sherbet tones with a fizzy board shimmer.',
    collectionName: 'Splash Market Mix',
    prismLabel: 'Fizz Prism',
    notes: ['icy citrus snap', 'mint-market lift', 'bright sherbet finish'],
    candyLabels: {
      strawberry: 'Orange Burst',
      tangerine: 'Lemon Slice',
      blueberry: 'Blue Fizz',
      mint: 'Mint Cooler',
      grape: 'Lagoon Pop',
      peach: 'Golden Sherbet',
    },
    swatches: ['#ff9258', '#ffd95c', '#42d5b7', '#4e9dff'],
  },
  {
    id: 'berry-parade',
    name: 'Berry Parade',
    tagline: 'Carnival berries with fizzy cream trim.',
    mood: 'Punchy, playful, and bold.',
    feature: 'Fairground berry tones with soda-pop contrast.',
    collectionName: 'Carnival Berry Cart',
    prismLabel: 'Spotlight Prism',
    notes: ['berry soda pop', 'carnival jam glow', 'cream-fizz contrast'],
    candyLabels: {
      strawberry: 'Confetti Berry',
      tangerine: 'Golden Cream Pop',
      blueberry: 'Electric Berry',
      mint: 'Soda Splash',
      grape: 'Velvet Jam Drop',
      peach: 'Rosy Float',
    },
    swatches: ['#ff5f7a', '#f6a3ff', '#6cb7ff', '#ffd178'],
  },
  {
    id: 'frosted-market',
    name: 'Frosted Market',
    tagline: 'Pastel chews and chilled cream soda shine.',
    mood: 'Cool, airy, and polished.',
    feature: 'Creamy pastel sweets with a crisp glassy finish.',
    collectionName: 'Frosted Counter Set',
    prismLabel: 'Glass Prism',
    notes: ['pastel cream layers', 'frosted market shine', 'clean soda chill'],
    candyLabels: {
      strawberry: 'Rose Nougat',
      tangerine: 'Honey Cream',
      blueberry: 'Cloud Berry',
      mint: 'Cool Mint Mallow',
      grape: 'Lavender Fudge',
      peach: 'Apricot Glaze',
    },
    swatches: ['#ff9eb3', '#ffcfa5', '#92d2ff', '#9eead2'],
  },
];
