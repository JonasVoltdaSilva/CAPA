// Biblioteca de identidades visuais por álbum.
// Registro entregue pelo servidor em /api/identidades (fonte: references/album-identities/identities.json).
// Nível 1: identidade personalizada do álbum. Nível 2: cor extraída da capa + preset licenciado.
// Nível 3: tema padrão do design system do CAPA.

const FONTES_CANVAS = {
  'Instrument Sans': { titulo: 'Instrument, Arial, sans-serif', texto: 'Instrument, Arial, sans-serif', carregar: [['700 42px Instrument'],['400 24px Instrument']] },
  'Instrument Serif': { titulo: 'InstrumentSerif, Georgia, serif', texto: 'Instrument, Arial, sans-serif', carregar: [['400 42px InstrumentSerif']] },
  'Libre Baskerville': { titulo: 'Baskerville, Georgia, serif', texto: 'Instrument, Arial, sans-serif', carregar: [['400 42px Baskerville']] },
  Bricolage: { titulo: 'Bricolage, Arial, sans-serif', texto: 'Instrument, Arial, sans-serif', carregar: [['700 42px Bricolage'],['400 24px Instrument']] },
};

const TEMA_PADRAO = {
  nivel: 3,
  rotulo: 'Tema do CAPA',
  identidade: null,
  cores: { fundo: null, tinta: null, destaque: null, sobreDestaque: null },
  fontes: FONTES_CANVAS.Bricolage,
  composicao: { alinhamento: 'esquerda', caixaTitulo: 'normal', desfoqueTitulo: false, inverterComposicao: false },
};

let registry = null;
let pending = null;

export function carregarIdentidades() {
  if (registry) return Promise.resolve(registry);
  if (pending) return pending;
  pending = fetch('/api/identidades', { headers: { Accept: 'application/json' } })
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (data?.atualizadoEm && Array.isArray(data.identidades)) registry = data;
      return registry;
    })
    .catch(() => null)
    .finally(() => { pending = null; });
  return pending;
}

export function identidadeDoAlbum(albumId) {
  if (!registry || !albumId) return null;
  const list = registry.identidades || [];
  return list.find(x => x.albumId === albumId) || null;
}

export function presetDoEstilo(estilo) {
  return registry?.presetsNivel2?.[estilo] || null;
}

function fontesDe(nome) {
  return FONTES_CANVAS[nome] || FONTES_CANVAS.Bricolage;
}

// Tema de uma identidade personalizada (nível 1).
export function temaDaIdentidade(identidade) {
  const t = identidade?.tipografia || {};
  return {
    nivel: 1,
    rotulo: 'Estética de ' + (identidade.titulo || 'álbum'),
    identidade,
    cores: { ...identidade.paleta },
    fontes: fontesDe(t.fonteTitulo),
    composicao: {
      alinhamento: identidade.composicao?.alinhamento || 'centro',
      caixaTitulo: t.caixaTitulo || 'normal',
      desfoqueTitulo: Boolean(identidade.composicao?.desfoqueTitulo),
      inverterComposicao: Boolean(identidade.composicao?.inverterComposicao),
      registra: t.fonteTitulo,
      pesoTitulo: t.pesoTitulo || 700,
    },
  };
}

// Nível 2: cor dominante extraída da capa + preset tipográfico do estilo do álbum.
export function temaSemiautomatico(corHex, estilo) {
  const preset = presetDoEstilo(estilo) || presetDoEstilo('editorial');
  const base = preset || { fonteTitulo: 'Instrument Serif', pesoTitulo: 400, caixaTitulo: 'minusculas', alinhamento: 'centro' };
  return {
    nivel: 2,
    rotulo: 'Paleta da capa · ' + (base.rotulo || estilo || 'editorial'),
    identidade: null,
    cores: { fundo: corHex, tinta: null, destaque: corHex, sobreDestaque: null },
    fontes: fontesDe(base.fonteTitulo),
    composicao: {
      alinhamento: base.alinhamento || 'centro',
      caixaTitulo: base.caixaTitulo || 'normal',
      desfoqueTitulo: false,
      inverterComposicao: false,
      registra: base.fonteTitulo,
      pesoTitulo: base.pesoTitulo || 700,
    },
  };
}

// Decide o tema de um álbum sem cor extraída (níveis 1 e 3).
export function temaDoAlbum(album) {
  if (!album) return TEMA_PADRAO;
  const identidade = identidadeDoAlbum(album.id);
  if (identidade) return temaDaIdentidade(identidade);
  return TEMA_PADRAO;
}

export async function garantirFontes(tema) {
  const stacks = [tema.fontes, TEMA_PADRAO.fontes];
  const jobs = [];
  for (const stack of stacks) {
    for (const spec of stack.carregar || []) {
      jobs.push(document.fonts.load(spec[0]).catch(() => {}));
    }
  }
  await Promise.all(jobs);
  try { await document.fonts.ready; } catch { /* navegador sem FontFaceSet */ }
}

export function cssDoTema(tema) {
  const c = tema.cores || {};
  const estilo = c.fundo ? ' style="--identidade-fundo:' + c.fundo + ';--identidade-tinta:' + (c.tinta || '') + ';--identidade-destaque:' + (c.destaque || c.fundo) + '"' : '';
  return estilo;
}

// Aplica variáveis escopadas para a faixa de identidade na página do álbum.
export function aplicarFaixaDeIdentidade(elemento, tema) {
  if (!elemento) return;
  if (tema?.nivel === 1 || tema?.nivel === 2) {
    elemento.dataset.identidade = String(tema.nivel);
    elemento.style.setProperty('--identidade-fundo', tema.cores.fundo || 'transparent');
    if (tema.cores.tinta) elemento.style.setProperty('--identidade-tinta', tema.cores.tinta);
    if (tema.cores.destaque) elemento.style.setProperty('--identidade-destaque', tema.cores.destaque);
  } else {
    delete elemento.dataset.identidade;
    elemento.style.removeProperty('--identidade-fundo');
    elemento.style.removeProperty('--identidade-tinta');
    elemento.style.removeProperty('--identidade-destaque');
  }
}