// Single source of truth for the world: renderer, audio, panel and storage all read this list.
export const GAME_TITLE = 'The Horse Below';   // change the title here
export const WORLD = { w: 1800, h: 1200 };
export const SPAWN = { x: 520, y: 430 };

// Base audio settings. mode: 'spatial' (HRTF mono) | 'stereo' (image preserved)
// behavior: 'loop' (while nearby) | 'oneshot' (once on entry). radius = audible distance in px.
const A = (o = {}) => ({ mode: 'spatial', behavior: 'loop', volume: 0.8, radius: 380, fade: 1.5,
  offsetX: 0, pan: 0, proximity: true, continueAfterLeave: false, useDemo: true, fileName: null, ...o });

// obstacle: [dx, dy, w, h] collision rect relative to the location centre. demo: built-in synthesized placeholder.
export const LOCATIONS = [
  { id: 'phone', name: 'The Sunken Telephone Booth', x: 260, y: 230, r: 90, obstacle: [-9, -15, 18, 30],
    ground: ['#0c3340', '#124456'], demo: { type: 'ring' }, defaults: A() },
  { id: 'forest', name: 'The Upside-Down Forest', x: 700, y: 200, r: 100, obstacle: [-40, -24, 80, 52],
    ground: ['#1b1238', '#2a1c52'], demo: { type: 'blips', f: 420 }, defaults: A({ radius: 420 }) },
  { id: 'cathedral', name: 'The Cathedral of Whales', x: 1250, y: 260, r: 110, obstacle: [-52, -22, 104, 44],
    ground: ['#10243f', '#173458'], demo: { type: 'glide', f: 110, stereo: true }, defaults: A({ mode: 'stereo', radius: 480, volume: 0.7 }) },
  { id: 'moon', name: 'The Drowning Moon', x: 1620, y: 230, r: 90, obstacle: [-16, -16, 32, 32],
    ground: ['#0d2c3a', '#16445a'], demo: { type: 'drone', f: 196 }, defaults: A({ radius: 360 }) },
  { id: 'radio', name: 'The Coral Radio Station', x: 300, y: 620, r: 95, obstacle: [-30, -14, 60, 36],
    ground: ['#2c1230', '#44204a'], demo: { type: 'static' }, defaults: A({ radius: 400, volume: 0.6 }) },
  { id: 'bedroom', name: 'The Floating Bedroom', x: 850, y: 600, r: 95, obstacle: [-15, -11, 30, 22],
    ground: ['#2a2040', '#3d3060'], demo: { type: 'bell', f: 392, len: 7.2 }, defaults: A({ volume: 0.7 }) },
  { id: 'glass', name: 'The Glass Desert', x: 1400, y: 640, r: 110, obstacle: [-8, -8, 16, 16],
    ground: ['#12384a', '#1c566b'], demo: { type: 'chime' }, defaults: A({ behavior: 'oneshot', radius: 420, volume: 0.7 }) },
  { id: 'eyes', name: 'The Eyeball Garden', x: 250, y: 1000, r: 100, obstacle: [-10, -6, 20, 16],
    ground: ['#16301a', '#234a26'], demo: { type: 'blips', f: 260 }, defaults: A({ radius: 380 }) },
  { id: 'playground', name: 'The Sunken Playground', x: 800, y: 1020, r: 100, obstacle: [-26, -22, 62, 14],
    ground: ['#3a2a1a', '#54401f'], demo: { type: 'creak', f: 380, len: 3 }, defaults: A({ behavior: 'oneshot', volume: 0.6 }) },
  { id: 'giant', name: 'The Sleeping Giant', x: 1400, y: 1000, r: 120, obstacle: [-44, -26, 88, 52],
    ground: ['#12301f', '#1c4a30'], demo: { type: 'pulse', f: 42 }, defaults: A({ radius: 560, volume: 0.9 }) },
];
export const byId = (id) => LOCATIONS.find((l) => l.id === id);
