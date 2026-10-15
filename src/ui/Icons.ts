import type { Resource } from '../data/definitions';
// Original, code-drawn pixel items. All silhouettes use the same 26 × 26 grid.
const items: Record<Resource, string> = {
  wood: '<path fill="#463127" d="M3 8h4V5h10v3h5v12h-5v3H7v-3H3z"/><path fill="#93633e" d="M5 8h12v12H5z"/><path fill="#c99459" d="M5 7h12v4H5z"/><path fill="#63412e" d="M5 15h12v4H5z"/><path fill="#e5bc7a" d="M17 9h4v10h-4z"/><path fill="#ad7c48" d="M18 12h2v4h-2z"/>',
  stone: '<path fill="#3e535f" d="M2 13h2V8h5V5h9v4h3v5h2v7H4v-3H2z"/><path fill="#92aab6" d="M4 12h3V8h10v3h4v8H4z"/><path fill="#c4d4d8" d="M7 8h9v3H7zm-3 4h6v3H4z"/><path fill="#657e8d" d="M11 13h10v7H6v-3h5z"/>',
  meat: '<path fill="#52352f" d="M6 4h10v3h5v10h-4v3H6v-3H3V8h3z"/><path fill="#b9614f" d="M7 6h8v3h4v7h-4v3H7v-3H5V9h2z"/><path fill="#e69b7b" d="M8 7h6v3H8zm-2 4h3v5H6z"/><path fill="#ebcda5" d="M14 13h4v3h-4zm-3 3h4v3h-4z"/>',
  fish: '<path fill="#35575b" d="M1 9h5V6h9v3h3V6h5v14h-5v-3h-3v3H6v-3H1z"/><path fill="#78a9a3" d="M3 10h4V8h7v3h4v5h-4v2H7v-2H3z"/><path fill="#c8d5b6" d="M4 14h10v3H6v-1H4z"/><path fill="#a7cebc" d="M18 11h3v5h-3z"/><path fill="#203942" d="M6 10h2v2H6z"/>',
  metal: '<path fill="#354d5a" d="M5 6h14l4 12v4H1v-4z"/><path fill="#c4d5da" d="M6 8h12l2 7H4z"/><path fill="#819da9" d="M3 16h18v4H3z"/><path fill="#f3f6e7" d="M7 9h9v2H7z"/><path fill="#637f91" d="M17 9h2l2 6h-4z"/>',
  gold: '<path fill="#6f4f2d" d="M5 5h13v3h3v13H3V9h2z"/><path fill="#d4a04a" d="M7 7h9v3h3v9H5v-8h2z"/><path fill="#f4d587" d="M7 8h8v3H7zm-2 4h4v6H5z"/><path fill="#a76e34" d="M12 13h7v6h-7z"/>'
};
export const itemIcon = (type: Resource) => `<svg class="item-icon" viewBox="0 0 26 26" shape-rendering="crispEdges" aria-hidden="true">${items[type]}</svg>`;
const symbols: Record<string, string> = {
  pack: '<rect x="6" y="6" width="12" height="15" rx="1"/><path d="M9 6V3h6v3M6 13h12m-8 3h4"/>',
  build: '<path d="m3 11 9-8 9 8M6 9v12h12V9M10 21v-7h4v7"/>',
  map: '<path d="m3 5 6-2 6 3 6-2v16l-6 2-6-3-6 2V5Zm6-2v16m6-13v16"/>',
  save: '<path d="M5 3h12l3 3v15H4V3Zm3 0v6h8V3M8 21v-8h8v8"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="m9 3-1 3-3 1-2 3 2 3-1 3 3 2 3-1 3 2 3-2v-3l3-2-1-4-3-1-1-3z"/>',
  flame: '<path d="M13 2c2 5-6 7-3 12 1-3 4-3 5-7 6 6 6 11 1 14-6 3-13-1-11-7 1-3 3-5 3-7 0 4 3 4 5-5Z"/>',
  arrow: '<path d="M3 12h17m-6-6 6 6-6 6"/>',
  mountain: '<path d="m2 20 7-15 5 9 3-6 6 12H2ZM6 12l3 2 3-2"/>'
};
export const uiIcon = (name: string) => `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">${symbols[name] ?? symbols.pack}</svg>`;
export const survivorPortrait = `<svg class="survivor-portrait" viewBox="0 0 64 96" shape-rendering="crispEdges" aria-label="Your survivor in a winter parka" role="img"><path fill="#30414b" d="M20 61h10v29H18v-8h2zm14 0h10v21h2v8H34z"/><path fill="#a76634" d="M14 35h34v31H14z"/><path fill="#dba459" d="M18 31h26v32H18z"/><path fill="#e5bd77" d="M18 35h8v22h-8z"/><path fill="#4a675f" d="M24 41h18v24H24z"/><path fill="#6e8b72" d="M26 45h14v5H26z"/><path fill="#ac9e81" d="M12 12h8V6h24v6h8v24h-8v6H20v-6h-8z"/><path fill="#e0cda2" d="M16 13h8V9h16v4h8v19h-8v6H24v-6h-8z"/><path fill="#bb813f" d="M21 15h22v17H21z"/><path fill="#efcf99" d="M23 24h17v9H23z"/><path fill="#2f4650" d="M21 20h22v7H21z"/><path fill="#95b5b4" d="M24 21h7v3h-7z"/></svg>`;
