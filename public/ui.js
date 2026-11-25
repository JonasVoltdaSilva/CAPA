const glyphs = {
  compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-2.7 5.3L8 16l2.7-5.3z"/>',
  users:'<path d="M3 20v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2m2-7a5 5 0 0 1 4 5v2"/><circle cx="9" cy="6.5" r="3.5"/><path d="M16 3.2a3.5 3.5 0 0 1 0 6.6"/>',
  book:'<path d="M5 4h14v16H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2m-2 13c1-1 2-1 3-1h12M8 4v9"/>',
  disc:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M6.5 11a6 6 0 0 1 4.5-5m6.5 7a6 6 0 0 1-4.5 5"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  plus:'<path d="M12 5v14M5 12h14"/>', close:'<path d="m6 6 12 12M18 6 6 18"/>',
  arrow:'<path d="M4 12h15m-7-7 7 7-7 7"/>', external:'<path d="M6 18 18 6M7 6h11v11"/>',
  left:'<path d="m14.5 5-7 7 7 7"/>', right:'<path d="m9.5 5 7 7-7 7"/>',
  sliders:'<path d="M4 7h7m5 0h4M4 17h3m5 0h8"/><circle cx="13.5" cy="7" r="2.5"/><circle cx="9.5" cy="17" r="2.5"/>',
  user:'<circle cx="12" cy="7" r="3.5"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  music:'<path d="M9 18V5l12-2v13M9 8l12-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="18" cy="16" rx="3" ry="2"/>',
  layers:'<path d="m3 9 9-5 9 5-9 5zm0 4 9 5 9-5M3 17l9 5 9-5"/>',
  studio:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="m7 16 4-5 3 3 2-2 3 4"/><circle cx="15.5" cy="8.5" r="1"/>',
  star:'<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  bars:'<path d="M5 20v-6m7 6V4m7 16V9"/>', list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.1M3 12h.1M3 18h.1"/>',
  heart:'<path d="M20 5a5.3 5.3 0 0 0-8 1.4A5.3 5.3 0 0 0 4 5c-5 4.5 1 10 8 16 7-6 13-11.5 8-16z"/>',
  comment:'<path d="M21 11a9 9 0 0 1-9 9c-1.5 0-2.8-.3-4-.8L3 21l1.3-5A9 9 0 1 1 21 11z"/>',
  headphones:'<path d="M4 15v-3a8 8 0 1 1 16 0v3"/><rect x="3" y="12" width="4" height="8" rx="2"/><rect x="17" y="12" width="4" height="8" rx="2"/>',
  more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  bookmark:'<path d="M6 3h12v18l-6-4-6 4z"/>', check:'<path d="m4 12 5 5L20 6"/>', down:'<path d="m5 9 7 7 7-7"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  share:'<path d="M12 16V3m-5 5 5-5 5 5M5 12v8h14v-8"/>',
  edit:'<path d="m5 15 11-11 4 4L9 19l-5 1z"/>', trash:'<path d="M3 6h18M8 6V3h8v3m-11 0 1 15h12l1-15"/>',
  menu:'<path d="M3 6h18M3 12h18M3 18h18"/>', award:'<circle cx="12" cy="9" r="6"/><path d="m8 14-2 7 6-3 6 3-2-7"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v5m10-5v5M3 11h18"/>',
  settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  shuffle:'<path d="m3 6 4 0c4 0 6 12 10 12h4m-3-3 3 3-3 3M3 18h4c2 0 3-2 4-4m2-5c1-2 3-3 4-3h4m-3-3 3 3-3 3"/>'
};
const aliases = {chevronRight:'right','chevron-right':'right','arrow-right':'arrow',activity:'bars', chart:'bars', profile:'user', feed:'users',pen:'edit',message:'comment',image:'studio',grid:'layers',albums:'disc',logout:'external',flag:'bookmark',filter:'sliders',trophy:'award',calendarDays:'calendar',headphone:'headphones',login:'user'};
export function icon(name,size=20) {
  return '<svg class="icon" aria-hidden="true" width="'+Number(size)+'" height="'+Number(size)+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">'+(glyphs[name]||glyphs[aliases[name]]||glyphs.disc)+'</svg>';
}
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
export function safeImage(url) {
  return /^(\/assets\/(?!\/)|https:\/\/)/i.test(url||'') ? url : '';
}
export function normalize(text) {
  return String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
}
export function cover(album,className='') {
  if (!album) return '';
  const palettes=[['#426b5e','#e1d8a4'],['#913e29','#e8bf85'],['#465372','#e0c2aa'],['#49626d','#d9e0b0'],['#785345','#e9c587']];
  const num=[...String(album.id)].reduce((n,c)=>n+c.charCodeAt(0),0)%palettes.length;
  const url=safeImage(album.cover);
  return `<div class="cover tone-${num} ${esc(className)}"><div class="type-sleeve" aria-hidden="true"><i></i><b>${esc(album.title)}</b><small>${esc(album.artist)}</small></div>${url?`<img src="${esc(url)}" alt="Capa de ${esc(album.title)}" loading="lazy" width="500" height="500">`:''}</div>`;
}
export function brand() {
  return '<span class="wordmark"><svg aria-hidden="true" width="35" height="35" viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="3.6"><path d="M25 6a16 16 0 1 0 0 32"/><path d="M30 9a13 13 0 1 0 0 26"/><path d="M35 13a9 9 0 1 0 0 18"/></svg>CAPA<span class="brand-dot">.</span></span>';
}

export function ratingStars(rating) {
  if (!Number.isFinite(rating) || rating < .5 || rating > 5) return '';
  return '<span class="rating-stars" role="img" aria-label="'+esc(rating.toLocaleString('pt-BR'))+' de 5 estrelas">'+[1,2,3,4,5].map(i=>'<span aria-hidden="true" class="'+(rating>=i?'full':rating===i-.5?'half':'empty')+'">★</span>').join('')+'</span>';
}
export const nota = value => Number(value).toLocaleString('pt-BR',{maximumFractionDigits:1})+'/5';
export function ratingBlock(rating,{compact=false,label=''}={}) {
  if (!Number.isFinite(rating) || rating < .5 || rating > 5) return '';
  return '<span class="rating-block'+(compact?' compact':'')+'">'+(label?'<span class="rating-label">'+esc(label)+'</span>':'')+ratingStars(rating)+'<span class="rating-value">'+esc(nota(rating))+'</span></span>';
}
