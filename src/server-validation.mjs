import { crc32, deflateSync, inflateSync } from 'node:zlib';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function insist(condition, message, status = 400) {
  if (!condition) throw new HttpError(status, message);
}

export function string(value, label, max, min = 0) {
  insist(typeof value === 'string', `${label} inválido.`);
  const clean = value.trim();
  insist(clean.length >= min && clean.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(clean),
    `${label} deve ter entre ${min} e ${max} caracteres.`);
  return clean;
}

export function usernameValue(value) {
  const name = string(value, 'Nome de usuário', 30, 3).toLowerCase();
  insist(/^[a-z0-9_][a-z0-9_.-]*$/.test(name), 'Use letras sem acento, números, ponto, traço ou sublinhado no nome de usuário.');
  return name;
}

export function passwordValue(value) {
  insist(typeof value === 'string' && value.length >= 10 && Buffer.byteLength(value) <= 512,
    'Use uma senha com pelo menos 10 caracteres e até 512 bytes.');
  return value;
}

export function visibility(value) {
  insist(['public', 'private'].includes(value), 'Escolha a visibilidade do registro.');
  return value;
}

export function validDate(value) {
  insist(typeof value === 'string' && /^\d{4}-\d\d-\d\d$/.test(value), 'Informe uma data válida.');
  const parsed = new Date(value + 'T12:00:00Z');
  insist(Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value,
    'Informe uma data válida.');
  return value;
}

export function target(catalog, albumId, trackId) {
  const album = catalog.get(albumId);
  insist(album, 'Disco ausente no catálogo.', 400);
  const track = trackId || null;
  insist(!track || album.tracks?.some(t => t.id === track), 'Faixa ausente neste disco.');
  return { albumId, trackId: track };
}

export function stringList(value, label, limit) {
  insist(Array.isArray(value) && value.length <= limit, `${label} permite até ${limit} itens.`);
  const items = value.map(v => string(v, label, 200, 1));
  insist(new Set(items).size === items.length, `${label} contém itens repetidos.`);
  return items;
}

// Decode only simple RGB/RGBA PNGs that a browser canvas can produce. Rebuild the
// PNG from validated scanlines so ancillary chunks and trailing bytes never survive.
export function avatarValue(value) {
  if (!value) return '';
  const match = typeof value === 'string' && /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  const help = 'Escolha uma foto PNG RGB ou RGBA com até 512 por 512 pixels e 350 KB.';
  insist(match && match[1].length <= 480000, help);
  const source = Buffer.from(match[1], 'base64');
  const signature = Buffer.from('89504e470d0a1a0a', 'hex');
  insist(source.length >= 45 && source.length <= 358400 && source.subarray(0, 8).equals(signature), help);
  let pos = 8;
  let header;
  let scanBytes;
  let rows;
  let ended = false;
  const data = [];
  while (pos + 12 <= source.length) {
    const n = source.readUInt32BE(pos);
    insist(n <= source.length - pos - 12, help);
    const tag = source.toString('ascii', pos + 4, pos + 8);
    const contents = source.subarray(pos + 8, pos + 8 + n);
    insist(crc32(source.subarray(pos + 4, pos + 8 + n)) === source.readUInt32BE(pos + 8 + n), help);
    if (tag === 'IHDR') {
      insist(!header && pos === 8 && n === 13, help);
      header = contents;
      const width = header.readUInt32BE(0);
      rows = header.readUInt32BE(4);
      insist(width && rows && width <= 512 && rows <= 512 && header[8] === 8 &&
        [2,6].includes(header[9]) && header.subarray(10).every(x => x === 0), help);
      scanBytes = 1 + width * (header[9] === 6 ? 4 : 3);
    } else if (tag === 'IDAT') {
      insist(header, help);
      data.push(contents);
    } else if (tag === 'IEND') {
      insist(!n && pos + 12 === source.length, help);
      ended = true;
      break;
    } else {
      insist(header && /^[a-z][A-Za-z]{3}$/.test(tag), help);
    }
    pos += n + 12;
  }
  insist(ended && header && data.length, help);
  let raw;
  try { raw = inflateSync(Buffer.concat(data), { maxOutputLength: rows * scanBytes }); }
  catch { throw new HttpError(400, help); }
  insist(raw.length === rows * scanBytes, help);
  for (let y = 0; y < rows; y++) insist(raw[y * scanBytes] <= 4, help);
  function chunk(tag, bytes) {
    const result = Buffer.alloc(bytes.length + 12);
    result.writeUInt32BE(bytes.length);
    result.write(tag, 4);
    bytes.copy(result, 8);
    result.writeUInt32BE(crc32(result.subarray(4, -4)), result.length - 4);
    return result;
  }
  const sanitized = Buffer.concat([signature, chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
  return 'data:image/png;base64,' + sanitized.toString('base64');
}

