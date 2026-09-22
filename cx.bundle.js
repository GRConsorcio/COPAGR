(function(){
'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   MOTOR DA COPA — funções puras (sem DOM, sem rede). Tudo que decide "quem joga com quem",
   "quem está na frente" e "quem avança" mora aqui, e a tela só desenha o resultado.
   ═══════════════════════════════════════════════════════════════════════ */
const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const FORMATOS = {
  grupos: 'Fase de grupos + mata-mata',
  mata: 'Mata-mata direto',
  pontos: 'Pontos corridos',
};
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const nextPow2 = n => { let p = 1; while (p < n) p *= 2; return p; };
const log2 = n => Math.round(Math.log2(n));
const clone = o => JSON.parse(JSON.stringify(o));
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
function shuffle(a, rnd) {
  rnd = rnd || Math.random;
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

/* ---------- cores e textos (tudo que vem do banco passa por aqui antes de virar HTML) ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isHex = c => /^#[0-9a-fA-F]{6}$/.test(c || '');
const safeColor = (c, fb) => (isHex(c) ? c : fb);
const safeUrl = u => (/^https:\/\/[^\s"'<>\\]+$/i.test(u || '') ? u : '');
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbToHex(r, g, b) { return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''); }
function luminancia(h) {
  const [r, g, b] = hexToRgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
// cor de texto que lê bem em cima de `h`
const textoSobre = h => (luminancia(h) > 0.36 ? '#0d0d12' : '#ffffff');
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}
// nome sem cor escolhida ganha uma cor estável (mesmo nome, mesma cor)
function corDoNome(nome) {
  let h = 0; for (const ch of String(nome || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return [hslToHex(h % 360, 62, 46), hslToHex((h + 28) % 360, 40, 92)];
}
function siglaDe(nome, s) {
  const limpa = String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  if (limpa) return limpa;
  const sem = String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const w = sem.split(/[\s\-]+/).filter(x => x && !/^(de|da|do|das|dos|e|fc|ec|sc|ac)$/i.test(x));
  const base = w.length >= 2 ? w.slice(0, 3).map(x => x[0]).join('') : (w[0] || '?').slice(0, 3);
  return base.toUpperCase().replace(/[^A-Z0-9]/g, '') || '?';
}

/* ---------- catálogo: clubes do Brasileirão (a lista é só ponto de partida: cada time pode ser editado) ---------- */
const CATALOGO = [
  // Série A (2025/26)
  { n: 'Flamengo', s: 'FLA', uf: 'RJ', c: ['#C8102E', '#111111'], ser: 'A' },
  { n: 'Palmeiras', s: 'PAL', uf: 'SP', c: ['#0B6B3A', '#FFFFFF'], ser: 'A' },
  { n: 'Corinthians', s: 'COR', uf: 'SP', c: ['#161616', '#FFFFFF'], ser: 'A' },
  { n: 'São Paulo', s: 'SAO', uf: 'SP', c: ['#E4002B', '#161616'], ser: 'A' },
  { n: 'Santos', s: 'SAN', uf: 'SP', c: ['#F2F2F2', '#161616'], ser: 'A' },
  { n: 'RB Bragantino', s: 'RBB', uf: 'SP', c: ['#E4002B', '#FFFFFF'], ser: 'A' },
  { n: 'Mirassol', s: 'MIR', uf: 'SP', c: ['#F5C400', '#0A7A33'], ser: 'A' },
  { n: 'Fluminense', s: 'FLU', uf: 'RJ', c: ['#7A1F3D', '#0B7A4B'], ser: 'A' },
  { n: 'Botafogo', s: 'BOT', uf: 'RJ', c: ['#161616', '#FFFFFF'], ser: 'A' },
  { n: 'Vasco da Gama', s: 'VAS', uf: 'RJ', c: ['#161616', '#FFFFFF'], ser: 'A' },
  { n: 'Atlético-MG', s: 'CAM', uf: 'MG', c: ['#161616', '#FFFFFF'], ser: 'A' },
  { n: 'Cruzeiro', s: 'CRU', uf: 'MG', c: ['#0033A0', '#FFFFFF'], ser: 'A' },
  { n: 'Grêmio', s: 'GRE', uf: 'RS', c: ['#0D80BF', '#161616'], ser: 'A' },
  { n: 'Internacional', s: 'INT', uf: 'RS', c: ['#E4002B', '#FFFFFF'], ser: 'A' },
  { n: 'Juventude', s: 'JUV', uf: 'RS', c: ['#0A7A33', '#FFFFFF'], ser: 'A' },
  { n: 'Athletico-PR', s: 'CAP', uf: 'PR', c: ['#E4002B', '#161616'], ser: 'A' },
  { n: 'Coritiba', s: 'CFC', uf: 'PR', c: ['#0A7A33', '#FFFFFF'], ser: 'A' },
  { n: 'Chapecoense', s: 'CHA', uf: 'SC', c: ['#0A7A33', '#FFFFFF'], ser: 'A' },
  { n: 'Bahia', s: 'BAH', uf: 'BA', c: ['#0057B8', '#E4002B'], ser: 'A' },
  { n: 'Vitória', s: 'VIT', uf: 'BA', c: ['#E4002B', '#161616'], ser: 'A' },
  { n: 'Fortaleza', s: 'FOR', uf: 'CE', c: ['#0033A0', '#E4002B'], ser: 'A' },
  { n: 'Ceará', s: 'CEA', uf: 'CE', c: ['#161616', '#FFFFFF'], ser: 'A' },
  { n: 'Sport', s: 'SPO', uf: 'PE', c: ['#E4002B', '#161616'], ser: 'A' },
  { n: 'Remo', s: 'REM', uf: 'PA', c: ['#0A2A6B', '#FFFFFF'], ser: 'A' },
  // Série B e outros tradicionais
  { n: 'Goiás', s: 'GOI', uf: 'GO', c: ['#0A7A33', '#FFFFFF'], ser: 'B' },
  { n: 'Vila Nova', s: 'VNO', uf: 'GO', c: ['#E4002B', '#FFFFFF'], ser: 'B' },
  { n: 'Cuiabá', s: 'CUI', uf: 'MT', c: ['#0A7A33', '#F5C400'], ser: 'B' },
  { n: 'Criciúma', s: 'CRI', uf: 'SC', c: ['#F5C400', '#161616'], ser: 'B' },
  { n: 'Avaí', s: 'AVA', uf: 'SC', c: ['#0057B8', '#FFFFFF'], ser: 'B' },
  { n: 'América-MG', s: 'AME', uf: 'MG', c: ['#0A7A33', '#FFFFFF'], ser: 'B' },
  { n: 'Athletic-MG', s: 'ATH', uf: 'MG', c: ['#161616', '#FFFFFF'], ser: 'B' },
  { n: 'Operário-PR', s: 'OPE', uf: 'PR', c: ['#161616', '#FFFFFF'], ser: 'B' },
  { n: 'Ponte Preta', s: 'PON', uf: 'SP', c: ['#161616', '#FFFFFF'], ser: 'B' },
  { n: 'Guarani', s: 'GUA', uf: 'SP', c: ['#0A7A33', '#FFFFFF'], ser: 'B' },
  { n: 'Novorizontino', s: 'NOV', uf: 'SP', c: ['#F5C400', '#161616'], ser: 'B' },
  { n: 'Botafogo-SP', s: 'BSP', uf: 'SP', c: ['#E4002B', '#161616'], ser: 'B' },
  { n: 'Ferroviária', s: 'FER', uf: 'SP', c: ['#7A1F3D', '#FFFFFF'], ser: 'B' },
  { n: 'CRB', s: 'CRB', uf: 'AL', c: ['#E4002B', '#FFFFFF'], ser: 'B' },
  { n: 'Náutico', s: 'NAU', uf: 'PE', c: ['#E4002B', '#FFFFFF'], ser: 'B' },
  { n: 'Santa Cruz', s: 'STC', uf: 'PE', c: ['#E4002B', '#161616'], ser: 'B' },
  { n: 'Paysandu', s: 'PAY', uf: 'PA', c: ['#0057B8', '#FFFFFF'], ser: 'B' },
  { n: 'Amazonas', s: 'AMA', uf: 'AM', c: ['#F5C400', '#161616'], ser: 'B' },
  { n: 'Volta Redonda', s: 'VRE', uf: 'RJ', c: ['#F5C400', '#161616'], ser: 'B' },
];

/* ---------- estado inicial ---------- */
const TEMA_PADRAO = { preset: 'ouro' };
function novoEstado(titulo) {
  return {
    v: 1,
    titulo: titulo || 'Copa GR',
    subtitulo: 'Temporada ' + new Date().getFullYear(),
    logo: '🏆', // emoji ou URL https de imagem
    cfg: { formato: 'grupos', nGrupos: 4, classificam: 2, terceiro: true },
    times: [],
    grupos: null, // [{ id:'A', ids:[idDoTime,...] }] depois do sorteio. Times ficam livres pra mover de grupo até a fase fechar
    gruposFechados: false, // true = classificação por cotas travada (mata-mata já sorteado, ou temporada de pontos corridos encerrada)
    bracketInicial: null, // só p/ formato 'grupos': ids (ou 'BYE') na ordem do 1º round, calculado ao fechar a fase de grupos
    seeds: null, // mata-mata direto: ids na ordem do chaveamento (cabeça de chave primeiro)
    jogos: [],
    tema: clone(TEMA_PADRAO),
  };
}
function novoTime(p) {
  const nome = String(p.n || '').trim().slice(0, 40);
  const [c1, c2] = corDoNome(nome);
  return {
    id: p.id || uid(),
    n: nome,
    s: siglaDe(nome, p.s),
    c: [safeColor(p.c1 || (p.c && p.c[0]), c1), safeColor(p.c2 || (p.c && p.c[1]), c2)],
    logo: safeUrl(p.logo),
    sub: String(p.sub || '').trim().slice(0, 40),
    cab: !!p.cab,
    ser: p.ser || '',
    // cotas vendidas (editadas pelo admin) e cartões: são do TIME, não da rodada — sobrevivem a mudar de grupo ou editar nome/cor
    cotas: clamp(Math.floor(Number(p.cotas) || 0), 0, 999999),
    camarelo: clamp(Math.floor(Number(p.camarelo) || 0), 0, 20),
    cvermelho: !!p.cvermelho,
  };
}
// cartão vermelho OU 3+ amarelos = fora da classificação, mesmo tendo mais cotas que os outros
const expulso = t => !!(t && (t.cvermelho || (t.camarelo || 0) >= 3));
// cada cartão amarelo tira 1 cota na hora de ranquear (nunca fica negativo)
const cotasLiquidas = t => Math.max(0, (t && t.cotas || 0) - (t && t.camarelo || 0));

/* ---------- validação da configuração ---------- */
function tamanhoMinGrupo(nTimes, nG) { return Math.floor(nTimes / Math.max(1, nG)); }
function sugerirGrupos(T) {
  if (T < 4) return 1;
  return Math.max(1, Math.min(Math.round(T / 4), Math.floor(T / 2)));
}
function validarCfg(E) {
  const cfg = E.cfg, T = E.times.length, erros = [];
  if (cfg.formato === 'grupos') {
    if (T < 4) erros.push('Adicione pelo menos 4 times para jogar com fase de grupos.');
    else {
      if (cfg.nGrupos < 1 || cfg.nGrupos > Math.floor(T / 2)) erros.push(`Com ${T} times dá para ter de 1 a ${Math.floor(T / 2)} grupos (mínimo de 2 times por grupo).`);
      else {
        const min = tamanhoMinGrupo(T, cfg.nGrupos);
        if (cfg.classificam < 1 || cfg.classificam > min) erros.push(`Cada grupo terá pelo menos ${min} times: classifique de 1 a ${min} por grupo.`);
        else if (cfg.nGrupos * cfg.classificam < 2) erros.push('É preciso classificar pelo menos 2 times para o mata-mata.');
      }
    }
  } else if (cfg.formato === 'mata') {
    if (T < 2) erros.push('Adicione pelo menos 2 times.');
  } else if (cfg.formato === 'pontos') {
    if (T < 2) erros.push('Adicione pelo menos 2 times.');
  }
  return erros;
}

/* ---------- sorteios ---------- */
// distribui os times pelos grupos: cabeças de chave primeiro (um por grupo), depois o resto, sempre no grupo mais vazio
function sortearGrupos(times, nG, rnd) {
  const cab = shuffle(times.filter(t => t.cab), rnd), resto = shuffle(times.filter(t => !t.cab), rnd);
  const grupos = Array.from({ length: nG }, (_, i) => ({ id: LETRAS[i], ids: [] }));
  for (const t of [...cab, ...resto]) {
    let alvo = grupos[0];
    for (const g of grupos) if (g.ids.length < alvo.ids.length) alvo = g;
    alvo.ids.push(t.id);
  }
  return grupos;
}
function sortearSeeds(times, rnd) {
  return [...shuffle(times.filter(t => t.cab), rnd), ...shuffle(times.filter(t => !t.cab), rnd)].map(t => t.id);
}

/* ---------- classificação de um grupo: por cotas líquidas (cotas − cartões amarelos), expulsos sempre por último ---------- */
function tabelaGrupo(E, gid) {
  const g = (E.grupos || []).find(x => x.id === gid);
  if (!g) return [];
  const tm = new Map(E.times.map(t => [t.id, t]));
  const linhas = g.ids.map((id, ord) => {
    const t = tm.get(id);
    const cotas = t ? (t.cotas || 0) : 0, camarelo = t ? (t.camarelo || 0) : 0, cvermelho = !!(t && t.cvermelho);
    return { id, ord, cotas, camarelo, cvermelho, expulso: expulso(t), net: cotasLiquidas(t) };
  });
  return linhas.sort((a, b) => (a.expulso - b.expulso) || (b.net - a.net) || (b.cotas - a.cotas) || (a.ord - b.ord));
}

/* ---------- mata-mata ---------- */
// ordem clássica de chaveamento: 1×N, 4×(N-3)... com os cabeças de chave só se encontrando no fim
function padraoSeeds(N) {
  let arr = [1, 2];
  for (let n = 4; n <= N; n *= 2) { const nx = []; for (const s of arr) nx.push(s, n + 1 - s); arr = nx; }
  return N === 1 ? [1] : arr;
}
// as N posições do 1º round, de cima para baixo (posições vizinhas formam um jogo). `bye` = folga.
// Formato 'grupos': só existe depois de fechar a fase de grupos (E.bracketInicial já vem calculado e fixo — cotas
// continuam editáveis depois disso só pra registro, sem efeito no chaveamento já sorteado).
function posicoesMata(E) {
  const cfg = E.cfg;
  if (cfg.formato === 'mata') {
    const T = (E.seeds || []).length, N = nextPow2(Math.max(T, 2));
    return padraoSeeds(N).map(s => (s <= T ? { t: 'time', id: E.seeds[s - 1] } : { t: 'bye' }));
  }
  if (cfg.formato === 'grupos' && E.gruposFechados && E.bracketInicial) {
    return E.bracketInicial.map(id => (id === 'BYE' ? { t: 'bye' } : { t: 'time', id }));
  }
  return [];
}
function idMata(rd, pos, terceiro) { return terceiro ? `m${rd}_t` : `m${rd}_${pos}`; }
function novoJogoMata(rd, pos, a, b, terceiro) {
  return { id: idMata(rd, pos, terceiro), fase: 'm', rd, pos, terceiro: !!terceiro, a, b, ga: null, gb: null, pa: null, pb: null, st: 'ag', snap: null, dt: '', loc: '' };
}
function jogosMata(E) {
  const pos = posicoesMata(E), N = pos.length, R = log2(N), out = [];
  for (let i = 0; i < N / 2; i++) out.push(novoJogoMata(0, i, pos[2 * i], pos[2 * i + 1]));
  for (let rd = 1; rd < R; rd++) {
    const cnt = N / Math.pow(2, rd + 1);
    for (let i = 0; i < cnt; i++) out.push(novoJogoMata(rd, i, { t: 'venc', j: idMata(rd - 1, 2 * i) }, { t: 'venc', j: idMata(rd - 1, 2 * i + 1) }));
  }
  if (E.cfg.terceiro && terceiroPossivel(pos)) out.push(novoJogoMata(R - 1, 1, { t: 'perd', j: idMata(R - 2, 0) }, { t: 'perd', j: idMata(R - 2, 1) }, true));
  return out;
}
// disputa de 3º lugar precisa de dois perdedores de semifinal; com folga na semifinal (ex.: 3 classificados) não existe
function terceiroPossivel(pos) {
  const N = pos.length, R = log2(N);
  return R >= 2 && !(R === 2 && pos.some(p => p.t === 'bye'));
}
function rodadasMata(E) {
  const js = E.jogos.filter(j => j.fase === 'm');
  return js.length ? Math.max(...js.map(j => j.rd)) + 1 : 0;
}
function nomeRodadaMata(rd, R) {
  const n = Math.pow(2, R - 1 - rd);
  return n === 1 ? 'Final' : n === 2 ? 'Semifinais' : n === 4 ? 'Quartas de final' : n === 8 ? 'Oitavas de final' : `${n} avos de final`;
}
function nomeCurtoRodada(rd, R) {
  const n = Math.pow(2, R - 1 - rd);
  return n === 1 ? 'Final' : n === 2 ? 'Semi' : n === 4 ? 'Quarta' : n === 8 ? 'Oitava' : `Rodada ${rd + 1}`;
}
// quem se classifica de cada grupo (não-expulsos, por cotas líquidas), numa lista única pronta pro chaveamento:
// 1ºs colocados primeiro (entre si por cotas), depois os 2ºs etc. — mesma lógica de prioridade de um ranking geral
function classificadosPorGrupo(E) {
  const k = E.cfg.classificam, out = [];
  E.grupos.forEach((g, gi) => {
    tabelaGrupo(E, g.id).filter(r => !r.expulso).slice(0, k)
      .forEach((r, pos) => out.push({ id: r.id, g: g.id, gi, pos, net: r.net, cotas: r.cotas }));
  });
  return out.sort((x, y) => (x.pos - y.pos) || (y.net - x.net) || (y.cotas - x.cotas) || (x.gi - y.gi));
}
// arruma o 1º round pra ninguém do mesmo grupo se enfrentar de cara, quando dá pra evitar trocando com outro confronto
function evitarMesmoGrupoNoPrimeiroJogo(rankComGrupo) {
  const Q = rankComGrupo.length, N = nextPow2(Math.max(Q, 2));
  const slots = padraoSeeds(N).map(s => (s <= Q ? rankComGrupo[s - 1] : null));
  const conflito = i => slots[2 * i] && slots[2 * i + 1] && slots[2 * i].g === slots[2 * i + 1].g;
  const npares = N / 2;
  for (let i = 0; i < npares; i++) {
    if (!conflito(i) || !slots[2 * i + 1]) continue;
    const cand = [...Array(npares).keys()].filter(j => j !== i).sort((a, b) => Math.abs(a - i) - Math.abs(b - i));
    for (const j of cand) {
      if (!slots[2 * j + 1]) continue; // não troca com folga
      const a = slots[2 * i + 1], b = slots[2 * j + 1];
      slots[2 * i + 1] = b; slots[2 * j + 1] = a;
      if (!conflito(i) && !conflito(j)) break;
      slots[2 * i + 1] = a; slots[2 * j + 1] = b; // desfaz e tenta a próxima
    }
  }
  return slots.map(s => (s ? s.id : 'BYE'));
}

/* ---------- visão calculada: tudo que a tela precisa, derivado do estado ---------- */
function computarView(E) {
  const V = { tabelas: {}, mata: new Map(), R: 0, campeao: null, fase: 'times', stats: { times: E.times.length, jogos: 0, feitos: 0, vivo: 0, gols: 0, cotas: 0, camarelo: 0, vermelho: 0 } };
  const temGrupos = Array.isArray(E.grupos) && E.grupos.length > 0;
  if (temGrupos) for (const g of E.grupos) V.tabelas[g.id] = tabelaGrupo(E, g.id);
  for (const t of E.times) { V.stats.cotas += t.cotas || 0; V.stats.camarelo += t.camarelo || 0; if (t.cvermelho) V.stats.vermelho++; }
  const mataJogos = E.jogos.filter(j => j.fase === 'm').sort((x, y) => (x.rd - y.rd) || (x.terceiro - y.terceiro) || (x.pos - y.pos));
  V.R = mataJogos.length ? Math.max(...mataJogos.map(j => j.rd)) + 1 : 0;
  const res = o => {
    if (!o) return null;
    switch (o.t) {
      case 'time': return o.id;
      case 'bye': return 'BYE';
      case 'venc': { const r = V.mata.get(o.j); return r && r.venc ? r.venc : null; }
      case 'perd': { const r = V.mata.get(o.j); return r && r.perd ? r.perd : null; }
      default: return null;
    }
  };
  for (const j of mataJogos) {
    const a = res(j.a), b = res(j.b), bye = a === 'BYE' || b === 'BYE';
    let venc = null, perd = null, done = false;
    if (bye) { const w = a === 'BYE' ? b : a; venc = w && w !== 'BYE' ? w : null; done = !!venc; }
    else if (a && b && j.st === 'fim' && isNum(j.ga) && isNum(j.gb)) {
      if (j.ga > j.gb) { venc = a; perd = b; done = true; }
      else if (j.gb > j.ga) { venc = b; perd = a; done = true; }
      else if (isNum(j.pa) && isNum(j.pb) && j.pa !== j.pb) { venc = j.pa > j.pb ? a : b; perd = venc === a ? b : a; done = true; }
    }
    V.mata.set(j.id, { a, b, bye, venc, perd, done });
  }
  for (const j of E.jogos) {
    if (j.fase === 'm' && V.mata.get(j.id) && V.mata.get(j.id).bye) continue;
    V.stats.jogos++;
    if (j.st === 'fim') V.stats.feitos++;
    if (j.st === 'vivo') V.stats.vivo++;
    if (j.st !== 'ag') V.stats.gols += (j.ga || 0) + (j.gb || 0);
  }
  // campeão e fase atual
  const fmt = E.cfg.formato;
  if (fmt === 'pontos') {
    if (temGrupos && E.gruposFechados) { const t = V.tabelas[E.grupos[0].id]; V.campeao = t && t[0] && !t[0].expulso ? t[0].id : null; }
  } else if (V.R) {
    const fin = mataJogos.find(j => j.rd === V.R - 1 && !j.terceiro);
    const r = fin && V.mata.get(fin.id);
    if (r && r.done && !r.bye) V.campeao = r.venc;
  }
  if (!E.times.length) V.fase = 'times';
  else if (!temGrupos && !(E.seeds && E.seeds.length)) V.fase = 'sorteio';
  else if (V.campeao) V.fase = 'campeao';
  else if (fmt === 'pontos') V.fase = 'grupos';
  else if (fmt === 'grupos' && !E.gruposFechados) V.fase = 'grupos';
  else {
    const aberta = mataJogos.find(j => !V.mata.get(j.id).done && !V.mata.get(j.id).bye && !j.terceiro) || mataJogos.find(j => !V.mata.get(j.id).done && !V.mata.get(j.id).bye);
    V.fase = aberta ? 'mata:' + aberta.rd : 'mata:' + Math.max(0, V.R - 1);
  }
  return V;
}
function rotuloFase(V, E) {
  const f = V.fase;
  if (f === 'times') return 'Times';
  if (f === 'sorteio') return 'Sorteio';
  if (f === 'grupos') return E.cfg.formato === 'pontos' ? 'Pontos corridos' : 'Grupos';
  if (f === 'campeao') return 'Campeã';
  if (f.startsWith('mata:')) return nomeRodadaMata(+f.slice(5), V.R);
  return '—';
}

/* ---------- limpeza de resultados que deixaram de fazer sentido ---------- */
function zerarJogo(j) { j.ga = j.gb = null; if (j.fase === 'm') { j.pa = j.pb = null; j.snap = null; } j.st = 'ag'; }
const temResultado = j => j.st !== 'ag' || isNum(j.ga) || isNum(j.gb) || isNum(j.pa) || isNum(j.pb);
// depois de qualquer mudança: confere se cada jogo do mata-mata ainda é entre os mesmos times de quando foi jogado.
// Se um resultado de cima mudou, o jogo de baixo (que dependia dele) é zerado. Devolve os ids zerados.
function sanear(E) {
  const zerados = [];
  for (let guard = 0; guard < 200; guard++) {
    const V = computarView(E);
    const js = E.jogos.filter(j => j.fase === 'm').sort((x, y) => (x.rd - y.rd) || (x.terceiro - y.terceiro) || (x.pos - y.pos));
    let alterou = false;
    for (const j of js) {
      if (!temResultado(j)) continue;
      const r = V.mata.get(j.id);
      const ok = !r.bye && r.a && r.b && j.snap && j.snap[0] === r.a && j.snap[1] === r.b;
      if (!ok) { zerarJogo(j); zerados.push(j.id); alterou = true; break; }
    }
    if (!alterou) break;
  }
  return zerados;
}

/* ---------- ações sobre o estado (todas recebem um estado clonado e o alteram no lugar) ---------- */
function construirEstrutura(E) {
  // grupos/pontos: jogos (mata-mata) só nascem quando a fase de grupos fecha (fecharFaseDeGrupos) — até lá é só cotas/cartões
  E.jogos = E.cfg.formato === 'mata' ? jogosMata(E) : [];
}
function aplicarSorteioGrupos(E, grupos) {
  E.grupos = grupos.map(g => ({ id: g.id, ids: g.ids.slice() }));
  E.seeds = null; E.gruposFechados = false; E.bracketInicial = null;
  construirEstrutura(E);
}
function aplicarSeeds(E, seeds) {
  E.grupos = null; E.seeds = seeds.slice(); E.gruposFechados = false; E.bracketInicial = null;
  construirEstrutura(E);
}
function aplicarPontosCorridos(E) {
  E.grupos = [{ id: 'A', ids: E.times.map(t => t.id) }];
  E.seeds = null; E.gruposFechados = false; E.bracketInicial = null;
  construirEstrutura(E);
}
function reiniciarSorteio(E) { E.grupos = null; E.seeds = null; E.gruposFechados = false; E.bracketInicial = null; E.jogos = []; }
function zerarResultados(E) { E.jogos.forEach(zerarJogo); }
function alternarTerceiro(E, ligado) {
  E.cfg.terceiro = !!ligado;
  E.jogos = E.jogos.filter(j => !j.terceiro);
  if (E.cfg.formato !== 'pontos') {
    const R = rodadasMata(E);
    if (ligado && R >= 2 && terceiroPossivel(posicoesMata(E))) E.jogos.push(novoJogoMata(R - 1, 1, { t: 'perd', j: idMata(R - 2, 0) }, { t: 'perd', j: idMata(R - 2, 1) }, true));
  }
}

/* ---------- cotas e cartões (fase de grupos) ---------- */
function definirCotas(E, timeId, valor) {
  const t = E.times.find(x => x.id === timeId);
  if (!t) return { ok: false, erro: 'Time não encontrado.' };
  t.cotas = clamp(Math.floor(Number(valor) || 0), 0, 999999);
  return { ok: true };
}
function ajustarCartaoAmarelo(E, timeId, delta) {
  const t = E.times.find(x => x.id === timeId);
  if (!t) return { ok: false, erro: 'Time não encontrado.' };
  t.camarelo = clamp((t.camarelo || 0) + delta, 0, 20);
  return { ok: true };
}
function alternarCartaoVermelho(E, timeId) {
  const t = E.times.find(x => x.id === timeId);
  if (!t) return { ok: false, erro: 'Time não encontrado.' };
  t.cvermelho = !t.cvermelho;
  return { ok: true };
}
// só pode mover enquanto a fase de grupos não fechou — depois disso o mata-mata já foi sorteado com base na posição anterior
function moverTimeDeGrupo(E, timeId, novoGrupoId) {
  if (!E.grupos) return { ok: false, erro: 'Ainda não há grupos.' };
  if (E.gruposFechados) return { ok: false, erro: 'A fase de grupos já foi fechada.' };
  const alvo = E.grupos.find(g => g.id === novoGrupoId);
  if (!alvo) return { ok: false, erro: 'Grupo não encontrado.' };
  E.grupos.forEach(g => { g.ids = g.ids.filter(id => id !== timeId); });
  alvo.ids.push(timeId);
  return { ok: true };
}
// fecha a classificação por cotas e trava. 'grupos': monta o mata-mata com quem se classificou. 'pontos': só define o campeão (o líder do grupo único)
function fecharFaseDeGrupos(E) {
  if (!E.grupos || !E.grupos.length) return { ok: false, erro: 'Ainda não há grupos.' };
  if (E.gruposFechados) return { ok: false, erro: 'A fase de grupos já está fechada.' };
  E.gruposFechados = true;
  if (E.cfg.formato === 'grupos') {
    E.bracketInicial = evitarMesmoGrupoNoPrimeiroJogo(classificadosPorGrupo(E));
    E.jogos = jogosMata(E);
  }
  return { ok: true };
}
// desfaz o fechamento (ex.: corrigir uma cota depois de fechar por engano). Cotas/cartões e os grupos continuam como estão;
// se já tinha mata-mata sorteado, ele é apagado (não dá pra "editar" um chaveamento que já saiu, só refazer)
function reabrirFaseDeGrupos(E) {
  E.gruposFechados = false; E.bracketInicial = null; E.jogos = [];
  return { ok: true };
}

// edita placar/estado de um jogo. Devolve { ok, erro? }
function definirJogo(E, id, patch) {
  const j = E.jogos.find(x => x.id === id);
  if (!j) return { ok: false, erro: 'Jogo não encontrado.' };
  const V = computarView(E);
  let a = j.a, b = j.b;
  if (j.fase === 'm') {
    const r = V.mata.get(j.id);
    if (r.bye) return { ok: false, erro: 'Este jogo é uma folga: o time avança direto.' };
    if (!r.a || !r.b) return { ok: false, erro: 'Aguardando a definição dos dois times.' };
    a = r.a; b = r.b;
  }
  const lim = v => (v == null || v === '' ? null : clamp(Math.floor(Number(v)), 0, 99));
  const novo = { ga: j.ga, gb: j.gb, pa: j.pa ?? null, pb: j.pb ?? null, st: j.st };
  if ('ga' in patch) novo.ga = lim(patch.ga);
  if ('gb' in patch) novo.gb = lim(patch.gb);
  if ('pa' in patch) novo.pa = lim(patch.pa);
  if ('pb' in patch) novo.pb = lim(patch.pb);
  if ('st' in patch) novo.st = patch.st;
  if (novo.st === 'vivo') { if (!isNum(novo.ga)) novo.ga = 0; if (!isNum(novo.gb)) novo.gb = 0; }
  if (novo.st === 'ag') { novo.ga = novo.gb = null; novo.pa = novo.pb = null; }
  if (novo.ga !== novo.gb) { novo.pa = novo.pb = null; } // pênaltis só existem em empate
  let reaberto = false;
  if (novo.st === 'fim') {
    const semPlacar = !isNum(novo.ga) || !isNum(novo.gb);
    const empateSemDesempate = j.fase === 'm' && novo.ga === novo.gb && !(isNum(novo.pa) && isNum(novo.pb) && novo.pa !== novo.pb);
    if (semPlacar || empateSemDesempate) {
      // pediu para encerrar: recusa. Só editou o placar de um jogo já encerrado: reabre em vez de perder a edição
      if ('st' in patch) return { ok: false, erro: semPlacar ? 'Informe o placar antes de encerrar.' : 'Empate no mata-mata: informe o resultado dos pênaltis para definir o vencedor.', pedirPenaltis: !semPlacar };
      novo.st = 'vivo'; reaberto = true;
    }
  }
  j.ga = novo.ga; j.gb = novo.gb; j.st = novo.st;
  if (j.fase === 'm') { j.pa = novo.pa; j.pb = novo.pb; j.snap = novo.st === 'ag' ? null : [a, b]; }
  if ('dt' in patch) j.dt = String(patch.dt || '').slice(0, 25);
  if ('loc' in patch) j.loc = String(patch.loc || '').slice(0, 60);
  return { ok: true, reaberto };
}

/* ═══════════════════════════════════════════════════════════════════════
   TEMA — presets + cores/estilo livres. O tema mora dentro do estado da copa (todo mundo vê o que o admin escolheu)
   e vira variáveis CSS na raiz da Copa e na camada de modais.
   ═══════════════════════════════════════════════════════════════════════ */
const PRESETS = {
  ouro: { n: 'Ouro noturno', bg: '#080810', surf: '#10101b', text: '#ede8d8', accent: '#d4a847', accent2: '#f0c75a' },
  gramado: { n: 'Gramado', bg: '#06110b', surf: '#0d1a12', text: '#e6f2ea', accent: '#22c55e', accent2: '#6ee7a0' },
  oceano: { n: 'Oceano', bg: '#060b14', surf: '#0d1524', text: '#e5eefb', accent: '#38bdf8', accent2: '#7dd3fc' },
  rubro: { n: 'Rubro-negro', bg: '#0a0708', surf: '#151011', text: '#f3ecec', accent: '#ef4444', accent2: '#fca5a5' },
  neon: { n: 'Neon', bg: '#0a0612', surf: '#140d22', text: '#efe8fb', accent: '#c084fc', accent2: '#67e8f9' },
  grafite: { n: 'Grafite', bg: '#0e0e10', surf: '#17171a', text: '#ececee', accent: '#e4e4e7', accent2: '#ffffff' },
  claro: { n: 'Claro', bg: '#f4f4f0', surf: '#ffffff', text: '#15171c', accent: '#111827', accent2: '#2563eb' },
  areia: { n: 'Areia', bg: '#f6efe4', surf: '#fffaf1', text: '#2a2118', accent: '#b45309', accent2: '#d97706' },
  portal: { n: 'Igual ao portal', follow: true },
};
const FUNDOS = { grid: 'Grade', dots: 'Pontos', aurora: 'Aurora', none: 'Liso' };
const FONTES = {
  portal: { n: 'Esportiva', f: "'DM Sans',system-ui,-apple-system,'Segoe UI',sans-serif", d: "'Barlow Condensed','DM Sans',system-ui,sans-serif" },
  sistema: { n: 'Sistema', f: "system-ui,-apple-system,'Segoe UI',sans-serif", d: "system-ui,-apple-system,'Segoe UI',sans-serif" },
  serif: { n: 'Clássica', f: "'DM Sans',system-ui,sans-serif", d: "Georgia,'Times New Roman',serif" },
  mono: { n: 'Técnica', f: "ui-monospace,Consolas,'Courier New',monospace", d: "ui-monospace,Consolas,'Courier New',monospace" },
};
const CORES_CHAVES = ['bg', 'surf', 'text', 'accent', 'accent2'];

// junta o que o admin escolheu com os padrões e descarta qualquer valor inválido
function resolverTema(t) {
  t = t || {};
  const chave = PRESETS[t.preset] ? t.preset : (t.preset === 'custom' ? 'custom' : 'ouro');
  const base = PRESETS[chave] && !PRESETS[chave].follow ? PRESETS[chave] : PRESETS.ouro;
  const cores = {};
  CORES_CHAVES.forEach(k => { cores[k] = safeColor(t.cores && t.cores[k], base[k]); });
  const nn = (v, fb) => (v === undefined || v === null || v === '' || !Number.isFinite(+v) ? fb : +v);
  return {
    preset: chave,
    cores,
    radius: clamp(nn(t.radius, 12), 0, 24),
    glow: clamp(nn(t.glow, 100), 0, 140),
    fundo: FUNDOS[t.fundo] ? t.fundo : 'grid',
    fx: t.fx === false ? false : true,
    fonte: FONTES[t.fonte] ? t.fonte : 'portal',
  };
}
function coresDoPreset(k) { const p = PRESETS[k]; return p && !p.follow ? { bg: p.bg, surf: p.surf, text: p.text, accent: p.accent, accent2: p.accent2 } : null; }

// lê as cores do próprio Portal (tema claro/escuro dele) para o preset "Igual ao portal"
function coresDoPortal() {
  const cs = getComputedStyle(document.documentElement), g = n => cs.getPropertyValue(n).trim();
  const pick = (n, fb) => (isHex(g(n)) ? g(n) : fb);
  return { bg: pick('--bg', PRESETS.ouro.bg), surf: pick('--s2', PRESETS.ouro.surf), text: pick('--text', PRESETS.ouro.text), accent: pick('--gold', PRESETS.ouro.accent), accent2: pick('--gold2', PRESETS.ouro.accent2) };
}
function coresEfetivas(T) { return T.preset === 'portal' ? coresDoPortal() : T.cores; }

function aplicarTema(tema, els) {
  const T = resolverTema(tema), c = coresEfetivas(T);
  const claro = luminancia(c.bg) > 0.5;
  const f = FONTES[T.fonte];
  const reduz = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  els.filter(Boolean).forEach(el => {
    const s = el.style;
    s.setProperty('--cx-bg', c.bg); s.setProperty('--cx-surf', c.surf); s.setProperty('--cx-text', c.text);
    s.setProperty('--cx-accent', c.accent); s.setProperty('--cx-accent2', c.accent2);
    s.setProperty('--cx-on-accent', textoSobre(c.accent));
    s.setProperty('--cx-radius', T.radius + 'px');
    s.setProperty('--cx-glow', String(T.glow / 100));
    s.setProperty('--cx-font', f.f); s.setProperty('--cx-font-d', f.d);
    el.dataset.bg = T.fundo; el.dataset.fx = T.fx && !reduz ? '1' : '0'; el.dataset.light = claro ? '1' : '0';
    // no claro, o verde/vermelho/amarelo de status precisam ser mais fechados para ter contraste
    s.setProperty('--cx-ok', claro ? '#0f9d6b' : '#34d399');
    s.setProperty('--cx-bad', claro ? '#d13b3b' : '#f87171');
    s.setProperty('--cx-warn', claro ? '#b7791f' : '#fbbf24');
  });
  return T;
}

/* ═══════════════════════════════════════════════════════════════════════
   PERSISTÊNCIA — Supabase (tabela portal_copa_torneios) ou memória (testes).
   Regras: leitura para todo mundo logado, escrita só admin (RLS). `rev` evita que duas abas se sobrescrevam.
   ═══════════════════════════════════════════════════════════════════════ */
const TABELA = 'portal_copa_torneios';
function erroSB(error) {
  const e = new Error(
    error && (error.code === 'PGRST205' || /Could not find the table/i.test(error.message || ''))
      ? 'A tabela da Copa ainda não existe no banco. Avise o administrador do sistema.'
      : (error && error.message) || 'Falha ao falar com o servidor.'
  );
  e.code = error && error.code; e.raw = error;
  return e;
}
const storeSB = {
  async listar() {
    const { data, error } = await sb.from(TABELA).select('id,titulo,ativo,criado_em,atualizado_em').order('criado_em', { ascending: false });
    if (error) throw erroSB(error);
    return data || [];
  },
  async abrir(id) {
    const { data, error } = await sb.from(TABELA).select('id,titulo,ativo,rev,estado').eq('id', id).maybeSingle();
    if (error) throw erroSB(error);
    return data;
  },
  async criar(titulo, estado, ativo) {
    const { data, error } = await sb.from(TABELA).insert({ titulo, estado, ativo: !!ativo }).select('id,titulo,ativo,rev,estado').single();
    if (error) throw erroSB(error);
    return data;
  },
  // grava só se a versão do servidor ainda for a que a tela conhece; senão { conflito:true }
  async salvar(id, rev, estado, titulo) {
    const { data, error } = await sb.from(TABELA).update({ estado, titulo, rev: rev + 1 }).eq('id', id).eq('rev', rev).select('rev').maybeSingle();
    if (error) throw erroSB(error);
    return data ? { rev: data.rev } : { conflito: true };
  },
  async definirAtivo(id) {
    let r = await sb.from(TABELA).update({ ativo: false }).eq('ativo', true);
    if (r.error) throw erroSB(r.error);
    r = await sb.from(TABELA).update({ ativo: true }).eq('id', id);
    if (r.error) throw erroSB(r.error);
  },
  async excluir(id) {
    const { error } = await sb.from(TABELA).delete().eq('id', id);
    if (error) throw erroSB(error);
  },
  _canal: null,
  // avisa a tela quando qualquer copa muda (a tela decide se é a que está aberta)
  assinar(cb) {
    this.desassinar();
    this._canal = sb.channel('portal-copa-torneios')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABELA }, p => cb(p.eventType, p.new || {}, p.old || {}))
      .subscribe();
  },
  desassinar() { if (this._canal) { sb.removeChannel(this._canal); this._canal = null; } },
};

// versão em memória: usada nos testes da interface (sem login e sem banco)
function criarStoreMem(opts) {
  opts = opts || {};
  const linhas = new Map();
  let seq = 1, cb = null;
  const pausa = () => new Promise(r => setTimeout(r, opts.latencia || 0));
  const meta = l => ({ id: l.id, titulo: l.titulo, ativo: l.ativo, criado_em: l.criado_em, atualizado_em: l.atualizado_em });
  const api = {
    linhas,
    falhar: false,
    async listar() { await pausa(); return [...linhas.values()].map(meta).sort((a, b) => b.criado_em.localeCompare(a.criado_em)); },
    async abrir(id) { await pausa(); const l = linhas.get(id); return l ? clone(l) : null; },
    async criar(titulo, estado, ativo) {
      await pausa();
      if (ativo) linhas.forEach(l => { l.ativo = false; });
      const l = { id: 'mem-' + seq++, titulo, estado: clone(estado), ativo: !!ativo, rev: 0, criado_em: new Date(Date.now() + seq).toISOString(), atualizado_em: new Date().toISOString() };
      linhas.set(l.id, l); return clone(l);
    },
    async salvar(id, rev, estado, titulo) {
      await pausa();
      if (api.falhar) throw new Error('Sem conexão (simulada)');
      const l = linhas.get(id);
      if (!l || l.rev !== rev) return { conflito: true };
      l.estado = clone(estado); l.titulo = titulo; l.rev = rev + 1; l.atualizado_em = new Date().toISOString();
      if (cb) setTimeout(() => cb('UPDATE', clone(l), {}), 0);
      return { rev: l.rev };
    },
    async definirAtivo(id) { await pausa(); linhas.forEach(l => { l.ativo = l.id === id; }); },
    async excluir(id) { await pausa(); linhas.delete(id); },
    assinar(fn) { cb = fn; },
    desassinar() { cb = null; },
    // simula OUTRA pessoa mexendo (para testar tempo real e conflito)
    _remoto(id, fn) { const l = linhas.get(id); const novo = clone(l.estado); fn(novo); l.estado = novo; l.rev++; if (cb) cb('UPDATE', clone(l), {}); },
  };
  return api;
}

/* ═══════════════════════════════════════════════════════════════════════
   INTERFACE — base: estado da tela, ícones, escudos, modais, gravação.
   ═══════════════════════════════════════════════════════════════════════ */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const ICONS = {
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  down: '<polyline points="6 9 12 15 18 9"/>',
  left: '<polyline points="15 18 9 12 15 6"/>',
  right: '<polyline points="9 18 15 12 9 6"/>',
  up: '<polyline points="18 15 12 9 6 15"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  undo: '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
  shuffle: '<polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  edit: '<path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  award: '<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  drop: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>',
  alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  play: '<polygon points="5 3 19 12 5 21 5 3"/>',
  list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
};
const ico = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;

/* ---------- escudos ---------- */
function escudoSvg(c1, c2, sigla) {
  const n = String(sigla).length, fs = n <= 2 ? 15 : n === 3 ? 13 : 10.5, tc = textoSobre(c1);
  return `<svg viewBox="0 0 40 46" aria-hidden="true"><path d="M20 1.5L37.5 7v15.5c0 10.5-7.6 18.3-17.5 22C10.1 40.8 2.5 33 2.5 22.5V7z" fill="${c2}"/><path d="M20 4.6L34.6 9.2v13.3c0 8.8-6.2 15.5-14.6 19C11.6 38 5.4 31.3 5.4 22.5V9.2z" fill="${c1}"/><path d="M20 4.6L34.6 9.2v6.1L5.4 22.4V9.2z" fill="#fff" opacity=".11"/><text x="20" y="27.4" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="${fs}" fill="${tc}" letter-spacing="-.3">${esc(sigla)}</text></svg>`;
}
function escudo(t) {
  if (!t) return `<span class="cx-crest tbd"><svg viewBox="0 0 40 46" aria-hidden="true"><path d="M20 3L36 8.5v14c0 9.6-6.8 16.4-16 20-9.2-3.6-16-10.4-16-20v-14z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="3.5 3"/><text x="20" y="28" text-anchor="middle" font-family="Arial,sans-serif" font-size="15" font-weight="700" fill="currentColor">?</text></svg></span>`;
  const c1 = safeColor(t.c && t.c[0], '#888888'), c2 = safeColor(t.c && t.c[1], '#ffffff'), url = safeUrl(t.logo);
  if (url) return `<span class="cx-crest"><img src="${esc(url)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-c1="${c1}" data-c2="${c2}" data-s="${esc(t.s)}"></span>`;
  return `<span class="cx-crest">${escudoSvg(c1, c2, t.s)}</span>`;
}
// imagem de logo que não carrega volta para o escudo desenhado
document.addEventListener('error', e => {
  const im = e.target;
  if (im && im.tagName === 'IMG' && im.closest && im.closest('.cx-crest') && im.dataset.c1) im.replaceWith(Object.assign(document.createElement('span'), { innerHTML: escudoSvg(im.dataset.c1, im.dataset.c2, im.dataset.s || '?') }).firstChild);
}, true);

/* ---------- estado da tela ---------- */
const S = {
  raiz: null, camada: null, admin: false, montado: false,
  id: null, rev: 0, meta: null, lista: [], E: null, V: null, tm: new Map(),
  aba: 'grupos', filtro: 'todos', rodadaSel: null, abertos: {},
  carregando: true, erro: '', salvo: 'ok',
  undo: [], coalKey: '', coalT: 0,
  pulse: new Set(), animar: true, campeaoVisto: undefined,
  modais: [], picker: null, jogoAberto: null,
  salvando: false, tSalvar: 0, tRetry: 0, remotoPendente: null, ix: 0, iw: 0,
  store: null,
};
const storeAtual = () => S.store || (window.CX_STORE_OVERRIDE) || storeSB;
function avisar(msg, tipo) {
  if (typeof toast === 'function') toast(msg, tipo === 'err' ? 'err' : 'ok');
  else console.log('[copa]', tipo || 'ok', msg);
}
const timePorId = id => S.tm.get(id) || null;
const jogoPorId = id => (S.E ? S.E.jogos.find(j => j.id === id) : null) || null;
const temEstrutura = E => !!(E && ((E.grupos && E.grupos.length) || (E.seeds && E.seeds.length)));
const corGrupo = i => ['#7c3aed', '#0d9488', '#ea580c', '#2563eb', '#be185d', '#047857', '#b45309', '#6b21a8', '#0891b2', '#c2410c'][i % 10];

function recomputar() {
  S.tm = new Map((S.E ? S.E.times : []).map(t => [t.id, t]));
  S.V = S.E ? computarView(S.E) : null;
}

/* ---------- rótulos ---------- */
function rotuloOrigem(o) {
  if (!o) return '—';
  switch (o.t) {
    case 'grupo': return `${o.pos}º do Grupo ${o.g}`;
    case 'slot': return `Classificado #${o.n}`;
    case 'bye': return 'Folga';
    case 'time': { const t = timePorId(o.id); return t ? t.n : '—'; }
    case 'venc': case 'perd': {
      const j = jogoPorId(o.j), pre = o.t === 'venc' ? 'Vencedor' : 'Perdedor';
      if (!j) return pre;
      const n = Math.pow(2, S.V.R - 1 - j.rd);
      return n === 1 ? `${pre} da Final` : `${pre} ${nomeCurtoRodada(j.rd, S.V.R)} ${j.pos + 1}`;
    }
    default: return '—';
  }
}
// os dois lados de um jogo, já resolvidos: { a:{time,rot,bye}, b:{...} }
function ladosDe(j) {
  if (j.fase === 'g') return { a: { time: timePorId(j.a), rot: '' }, b: { time: timePorId(j.b), rot: '' } };
  const r = S.V.mata.get(j.id) || {};
  const lado = (id, o) => (id === 'BYE' ? { time: null, rot: 'Folga', bye: true } : id ? { time: timePorId(id), rot: '' } : { time: null, rot: rotuloOrigem(o) });
  return { a: lado(r.a, j.a), b: lado(r.b, j.b) };
}
function vencedorDoJogo(j) {
  if (j.st !== 'fim') return null;
  if (j.fase === 'g') return j.ga > j.gb ? 'a' : j.gb > j.ga ? 'b' : 'e';
  const r = S.V.mata.get(j.id);
  if (!r || !r.done) return null;
  return r.venc === r.a ? 'a' : 'b';
}
const nomeRodadaJogo = j => (j.fase === 'g' ? `Grupo ${j.grupo} · Rodada ${j.rodada}` : (j.terceiro ? 'Disputa de 3º lugar' : nomeRodadaMata(j.rd, S.V.R)));
function dataCurta(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  if (isNaN(d)) return '';
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* ---------- modais ---------- */
function moldura({ titulo, sub, corpo, rodape, cls }) {
  return `<div class="cx-modal ${cls || ''}" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
    <div class="cx-mh"><div style="flex:1;min-width:0">${sub ? `<small>${esc(sub)}</small>` : ''}<h3>${esc(titulo)}</h3></div><button class="cx-ib" data-cx="fechar" aria-label="Fechar">${ico('x')}</button></div>
    <div class="cx-mb">${corpo}</div>${rodape ? `<div class="cx-mf">${rodape}</div>` : ''}</div>`;
}
function abrirModal(html, o) {
  o = o || {};
  const ovl = document.createElement('div');
  ovl.className = 'cx-ovl'; ovl.innerHTML = html; ovl._onClose = o.onClose || null; ovl.dataset.kind = o.kind || '';
  ovl.addEventListener('mousedown', e => { if (e.target === ovl && !o.fixo) fecharModal(ovl); });
  S.camada.appendChild(ovl); S.modais.push(ovl);
  const foco = $('[autofocus],.cx-in:not([type=color])', ovl);
  if (foco && o.foco !== false) setTimeout(() => foco.focus({ preventScroll: true }), 60);
  return ovl;
}
function fecharModal(ovl) {
  ovl = ovl || S.modais[S.modais.length - 1];
  if (!ovl) return;
  S.modais = S.modais.filter(m => m !== ovl);
  ovl.remove();
  if (ovl._onClose) ovl._onClose();
  if (ovl.dataset.kind === 'jogo') S.jogoAberto = null;
}
function fecharTodosModais() { while (S.modais.length) fecharModal(); const d = $('.cx-drawer', S.camada); if (d) d.remove(); }
function confirmar({ titulo, msg, ok, perigo, cancelar }) {
  return new Promise(res => {
    let feito = false;
    const fim = v => { if (feito) return; feito = true; res(v); };
    const ovl = abrirModal(moldura({
      titulo: titulo || 'Confirmar', cls: 'sm',
      corpo: `<p style="margin:0;color:var(--cx-mut2);line-height:1.55">${esc(msg || '')}</p>`,
      rodape: `<button class="cx-btn ghost" data-cx="conf-nao">${esc(cancelar || 'Cancelar')}</button><button class="cx-btn ${perigo ? 'bad' : 'pri'}" data-cx="conf-sim">${esc(ok || 'Confirmar')}</button>`,
    }), { kind: 'confirma', foco: false, onClose: () => fim(false) });
    ovl._sim = () => { fim(true); fecharModal(ovl); };
    ovl._nao = () => { fim(false); fecharModal(ovl); };
  });
}

/* ---------- gravação (autosave com versão) ---------- */
function marcarSync() {
  const el = $('.cx-sync', S.raiz);
  if (!el) return;
  const txt = { ok: S.admin ? 'Salvo' : 'Ao vivo', salvando: 'Salvando…', sujo: 'Alterações pendentes…', erro: 'Sem conexão. Tentando de novo…', conflito: 'Atualizado por outra pessoa', leitura: 'Somente leitura · ao vivo' }[S.salvo] || '';
  el.dataset.s = S.admin ? S.salvo : 'leitura';
  el.innerHTML = `<i></i>${esc(S.admin ? txt : 'Somente leitura · ao vivo')}`;
}
function agendarSalvar() {
  S.salvo = 'sujo'; marcarSync();
  clearTimeout(S.tSalvar);
  S.tSalvar = setTimeout(salvarAgora, 600);
}
async function salvarAgora() {
  clearTimeout(S.tSalvar); clearTimeout(S.tRetry);
  if (!S.admin || !S.id || !S.E) return;
  if (S.salvando) { S.repetir = true; return; }
  S.salvando = true; S.repetir = false; S.salvo = 'salvando'; marcarSync();
  const enviado = S.E, rev = S.rev;
  try {
    const r = await storeAtual().salvar(S.id, rev, enviado, enviado.titulo);
    if (r.conflito) {
      S.salvando = false;
      await recarregarDoServidor(true);
      return;
    }
    S.rev = r.rev; if (S.meta) S.meta.titulo = enviado.titulo;
    S.salvando = false;
    if (S.repetir || S.E !== enviado) { S.salvo = 'sujo'; return salvarAgora(); }
    S.salvo = 'ok'; marcarSync();
    if (S.remotoPendente) { const p = S.remotoPendente; S.remotoPendente = null; if (p.rev > S.rev) aplicarRemoto(p); }
  } catch (e) {
    S.salvando = false; S.salvo = 'erro'; marcarSync();
    S.tRetry = setTimeout(salvarAgora, 4000);
  }
}
async function recarregarDoServidor(porConflito) {
  try {
    const row = await storeAtual().abrir(S.id);
    if (!row) { S.salvo = 'erro'; marcarSync(); avisar('Esta copa não existe mais.', 'err'); return; }
    S.E = migrar(row.estado); S.rev = row.rev; S.meta = { id: row.id, titulo: row.titulo, ativo: row.ativo };
    S.undo = []; S.salvo = 'ok'; recomputar(); render(); atualizarJogoAberto();
    if (porConflito) avisar('Outra pessoa alterou a copa ao mesmo tempo. Carreguei a versão mais recente: refaça a sua última mudança.', 'err');
  } catch (e) { S.salvo = 'erro'; marcarSync(); S.tRetry = setTimeout(() => recarregarDoServidor(porConflito), 4000); }
}
// estados antigos/incompletos ganham os campos que faltam
function migrar(E) {
  const base = novoEstado(E && E.titulo);
  const out = Object.assign(base, E || {});
  out.cfg = Object.assign(base.cfg, (E && E.cfg) || {});
  delete out.cfg.turnos; delete out.cfg.pontos; // extintos: grupo não tem mais jogo, só cotas/cartões
  out.times = (Array.isArray(out.times) ? out.times : []).map(t => Object.assign({ cotas: 0, camarelo: 0, cvermelho: false }, t));
  out.jogos = Array.isArray(out.jogos) ? out.jogos : [];
  out.tema = Object.assign({}, out.tema || {});
  return out;
}

/* ---------- alterações ---------- */
function empilharUndo(rot, coal) {
  const agora = Date.now();
  if (coal && S.coalKey === coal && agora - S.coalT < 5000) { S.coalT = agora; return; }
  S.undo.push({ json: JSON.stringify(S.E), rot });
  if (S.undo.length > 40) S.undo.shift();
  S.coalKey = coal || ''; S.coalT = agora;
}
// aplica uma mudança no estado: clona, altera, limpa o que ficou sem sentido, pergunta se perder resultado, grava
async function mutar(fn, o) {
  o = o || {};
  if (!S.admin || !S.E) return { ok: false };
  const novo = clone(S.E);
  const r = fn(novo);
  if (r && r.ok === false) { if (r.erro && !o.silencioso) avisar(r.erro, 'err'); return r; }
  const zerados = sanear(novo);
  const perdidos = zerados.filter(id => { const j = S.E.jogos.find(x => x.id === id); return j && temResultado(j); });
  if (perdidos.length && o.perguntar !== false) {
    const nomes = perdidos.slice(0, 4).map(id => { const j = jogoPorId(id); return j ? nomeRodadaJogo(j) : id; }).join(', ');
    const ok = await confirmar({ titulo: 'Isso vai limpar resultados', msg: `Essa mudança altera ${perdidos.length} jogo(s) do mata-mata que já tinham resultado (${nomes}${perdidos.length > 4 ? '…' : ''}). Eles voltam para "agendado". Continuar?`, ok: 'Continuar', perigo: true });
    if (!ok) return { ok: false, cancelado: true };
  }
  empilharUndo(o.rot || 'Alteração', o.coal);
  const antes = S.V;
  S.E = novo; recomputar();
  S.campeaoAntes = antes ? antes.campeao : null;
  if (o.render !== false) render();
  atualizarJogoAberto();
  verCampeao();
  agendarSalvar();
  return { ok: true, zerados, reaberto: r && r.reaberto };
}
function desfazer() {
  if (!S.admin || !S.undo.length) return;
  const u = S.undo.pop();
  S.E = JSON.parse(u.json); recomputar(); S.coalKey = '';
  render(); atualizarJogoAberto(); agendarSalvar();
  avisar('Desfeito: ' + u.rot, 'ok');
}
// campeã nova? mostra a comemoração (uma vez por campeã)
function verCampeao() {
  const c = S.V && S.V.campeao;
  if (S.campeaoVisto === undefined) { S.campeaoVisto = c || null; return; }
  if (c && c !== S.campeaoVisto) { S.campeaoVisto = c; setTimeout(() => modalCampea(), 350); }
  else if (!c) S.campeaoVisto = null;
}

/* ---------- estilo/tema ---------- */
function aplicarTemaAtual() {
  const T = aplicarTema(S.E ? S.E.tema : TEMA_PADRAO, [S.raiz, S.camada]);
  return T;
}

/* ═══════════════════════════════════════════════════════════════════════
   TELAS — cabeçalho, etapas, abas, barra e as quatro visões (grupos, mata-mata, jogos, times)
   ═══════════════════════════════════════════════════════════════════════ */
function abasDaCopa() {
  const f = S.E.cfg.formato, out = [];
  if (f === 'grupos') out.push(['grupos', 'Grupos']);
  if (f === 'pontos') out.push(['grupos', 'Classificação']);
  if (f !== 'pontos') out.push(['mata', 'Mata-mata']);
  // pontos corridos não tem jogo nenhum (é só cotas/cartões): a aba "Jogos" nunca teria conteúdo
  if (f !== 'pontos') out.push(['jogos', 'Jogos']);
  out.push(['times', 'Times']);
  return out;
}
function abaPadrao() {
  const V = S.V, f = S.E.cfg.formato;
  if (!S.E.times.length || !temEstrutura(S.E)) return 'times';
  if (V.fase === 'campeao') return f === 'pontos' ? 'grupos' : 'mata';
  if (V.fase.startsWith('mata:')) return 'mata';
  return f === 'mata' ? 'mata' : 'grupos';
}

// enquanto a fase de grupos está aberta (cotas/cartões rolando, sem mata-mata ainda) os cards do meio mostram
// Cotas/Cartões em vez de Jogos/Gols — não tem "jogo" nenhum acontecendo nessa fase
const emFaseDeCotas = E => E.cfg.formato === 'pontos' || (E.cfg.formato === 'grupos' && !E.gruposFechados);
function htmlCabecalho() {
  const E = S.E, V = S.V, st = V.stats;
  const logo = E.logo || '🏆';
  const img = safeUrl(logo);
  const marca = img ? `<img src="${esc(img)}" alt="">` : `<span>${esc(String(logo).slice(0, 4))}</span>`;
  const cotas = emFaseDeCotas(E) && (E.grupos && E.grupos.length);
  const meio = cotas
    ? `<div class="cx-stat"><b>${st.cotas}</b><span>Cotas</span></div><div class="cx-stat"><b>${st.camarelo + st.vermelho ? `<span style="color:${st.vermelho ? 'var(--cx-bad)' : 'var(--cx-warn)'}">${st.camarelo}${st.vermelho ? '+' + st.vermelho + '🟥' : ''}</span>` : '0'}</b><span>Cartões</span></div>`
    : `<div class="cx-stat"><b>${st.feitos}<small style="font-size:14px;color:var(--cx-mut)">/${st.jogos}</small></b><span>Jogos</span></div><div class="cx-stat"><b>${st.vivo ? `<span style="color:var(--cx-bad)">${st.vivo}</span>` : st.gols}</b><span>${st.vivo ? 'Ao vivo' : 'Gols'}</span></div>`;
  return `<header class="cx-head">
      <div class="cx-mark">${marca}</div>
      <div class="cx-ttl"><h2>${esc(E.titulo)}</h2><p>${esc(E.subtitulo || '')}</p></div>
      <div class="cx-stats">
        <div class="cx-stat"><b>${st.times}</b><span>Times</span></div>
        ${meio}
        <div class="cx-stat"><b style="font-size:${rotuloFase(V, E).length > 9 ? 17 : 24}px;line-height:${rotuloFase(V, E).length > 9 ? '24px' : '1'}">${esc(rotuloFase(V, E))}</b><span>Fase</span></div>
      </div>
    </header>
    <div class="cx-sync" data-s="${S.admin ? S.salvo : 'leitura'}"><i></i>${S.admin ? 'Salvo' : 'Somente leitura · ao vivo'}</div>`;
}
function htmlEtapas() {
  const E = S.E, V = S.V, f = E.cfg.formato;
  const passos = f === 'grupos' ? [['times', 'Times'], ['sorteio', 'Sorteio'], ['grupos', 'Grupos'], ['mata', 'Mata-mata'], ['campeao', 'Campeã']]
    : f === 'mata' ? [['times', 'Times'], ['sorteio', 'Sorteio'], ['mata', 'Mata-mata'], ['campeao', 'Campeã']]
      : [['times', 'Times'], ['grupos', 'Pontos corridos'], ['campeao', 'Campeã']];
  const atual = V.fase.startsWith('mata') ? 'mata' : V.fase;
  const idx = Math.max(0, passos.findIndex(p => p[0] === atual));
  return `<div class="cx-steps" aria-label="Etapas da copa">${passos.map((p, i) => `<div class="cx-step ${i < idx || (atual === 'campeao' && i === idx) ? 'on' : ''} ${i === idx && atual !== 'campeao' ? 'now' : ''}"><i>${i < idx || (atual === 'campeao') ? '✓' : i + 1}</i>${esc(p[1])}</div>`).join('')}</div>`;
}
function htmlAbas() {
  const abas = abasDaCopa();
  return `<nav class="cx-tabs" role="tablist" id="cx-tabs">${abas.map(([k, n]) => `<button class="cx-tab ${S.aba === k ? 'on' : ''}" role="tab" aria-selected="${S.aba === k}" data-cx="aba" data-a="${k}">${esc(n)}${k === 'times' && S.E.times.length ? `<em>${S.E.times.length}</em>` : ''}</button>`).join('')}<i class="cx-ind" style="--ix:${S.ix}px;--iw:${S.iw}px"></i></nav>`;
}
function htmlBarra() {
  const E = S.E, V = S.V, est = temEstrutura(E), f = E.cfg.formato, b = [];
  if (S.admin) {
    if (!E.times.length) b.push(`<button class="cx-btn pri" data-cx="addTimes">${ico('plus')}Adicionar times</button>`);
    else if (!est) b.push(f === 'pontos'
      ? `<button class="cx-btn pri" data-cx="iniciarPontos">${ico('play')}Iniciar campeonato</button>`
      : `<button class="cx-btn pri" data-cx="sorteio">${ico('shuffle')}Sortear ${f === 'mata' ? 'chaveamento' : 'grupos'}</button>`);
    else if (f !== 'mata' && !E.gruposFechados) b.push(`<button class="cx-btn pri" data-cx="fecharGrupos">${ico('check')}${f === 'pontos' ? 'Encerrar temporada' : 'Fechar grupos e sortear mata-mata'}</button>`);
    if (est && (f === 'mata' || E.gruposFechados)) b.push(`<button class="cx-btn" data-cx="sorteio">${ico('shuffle')}Refazer sorteio</button>`);
    if (E.times.length && !est) b.push(`<button class="cx-btn" data-cx="addTimes">${ico('plus')}Times</button>`);
    b.push(`<button class="cx-btn" data-cx="config">${ico('gear')}Configurar</button>`);
    b.push(`<button class="cx-btn" data-cx="tema">${ico('drop')}Tema</button>`);
    b.push(`<button class="cx-btn ghost ${S.undo.length ? '' : 'off'}" data-cx="desfazer" title="${S.undo.length ? 'Desfazer: ' + esc(S.undo[S.undo.length - 1].rot) : 'Nada para desfazer'}">${ico('undo')}Desfazer</button>`);
    b.push('<span class="sp"></span>');
    b.push(`<button class="cx-btn ghost" data-cx="mais">${ico('more')}Mais</button>`);
  } else {
    b.push('<span class="sp"></span>');
    if (S.lista.length > 1) b.push(`<button class="cx-btn ghost" data-cx="copas">${ico('layers')}Outras copas</button>`);
  }
  return `<div class="cx-bar">${b.join('')}</div>`;
}
function htmlCampea() {
  const V = S.V, t = V.campeao && timePorId(V.campeao);
  if (!t) return '';
  return `<div class="cx-champ">${escudo(t)}<div><small>${S.E.cfg.formato === 'pontos' ? 'Campeã do campeonato' : 'Campeã da copa'}</small><b>${esc(t.n)}</b></div><span class="sp"></span>${S.admin ? `<button class="cx-btn sm" data-cx="historico">${ico('book')}Registrar no histórico</button>` : ''}<button class="cx-btn sm ghost" data-cx="celebrar">${ico('trophy')}Ver comemoração</button></div>`;
}

/* ---------- vazios ---------- */
function vazio(icone, titulo, texto, botoes) {
  return `<div class="cx-empty"><div class="ic">${ico(icone)}</div><h3>${esc(titulo)}</h3><p>${esc(texto)}</p>${botoes ? `<div class="row">${botoes}</div>` : ''}</div>`;
}
function vazioSemEstrutura() {
  const f = S.E.cfg.formato;
  if (!S.E.times.length) return vazio('users', 'Comece pelos times', S.admin ? 'Adicione clubes do Brasileirão ou qualquer outro nome para montar a copa.' : 'Os times ainda não foram cadastrados.', S.admin ? `<button class="cx-btn pri" data-cx="addTimes">${ico('plus')}Adicionar times</button>` : '');
  const txt = f === 'pontos' ? 'Um grupo só: acompanhe as cotas e cartões de cada time e encerre quando quiser definir a campeã.' : f === 'mata' ? 'O sorteio define o chaveamento do mata-mata.' : 'O sorteio distribui os times em grupos. Lá você acompanha cotas e cartões e, quando quiser, fecha a fase e sorteia o mata-mata.';
  return vazio('shuffle', 'Tudo pronto para começar', S.admin ? txt : 'A copa ainda não começou. Assim que o sorteio sair, ele aparece aqui.',
    S.admin ? `<button class="cx-btn pri" data-cx="${f === 'pontos' ? 'iniciarPontos' : 'sorteio'}">${ico(f === 'pontos' ? 'play' : 'shuffle')}${f === 'pontos' ? 'Iniciar campeonato' : 'Sortear'}</button><button class="cx-btn" data-cx="config">${ico('gear')}Configurar</button>` : '');
}

/* ---------- linha de jogo (grupos e agenda) ---------- */
function statusRotulo(j) {
  if (j.st === 'vivo') return 'Ao vivo';
  if (j.st === 'fim') return 'Fim';
  return dataCurta(j.dt) ? dataCurta(j.dt).slice(0, 5) : 'Em breve';
}
function htmlLinhaJogo(j, o) {
  o = o || {};
  const L = ladosDe(j), venc = vencedorDoJogo(j);
  const nome = (l, cls) => `<span class="t ${cls} ${l.time ? '' : 'tbd'}">${cls.includes('r') ? '' : escudo(l.time)}<span>${esc(l.time ? l.time.n : l.rot)}</span>${cls.includes('r') ? escudo(l.time) : ''}</span>`;
  const clsA = 'r ' + (venc === 'a' ? 'w' : venc === 'b' ? 'l' : '');
  const clsB = venc === 'b' ? 'w' : venc === 'a' ? 'l' : '';
  let mid;
  if (j.st === 'ag') mid = `<span class="vs">${dataCurta(j.dt) ? esc(dataCurta(j.dt)) : 'VS'}</span>`;
  else mid = `<b>${j.ga}</b><i>×</i><b>${j.gb}</b>${isNum(j.pa) && isNum(j.pb) ? `<small>(${j.pa}-${j.pb})</small>` : ''}`;
  const badge = o.badge ? `<span class="cx-tag g" style="--gc:${o.badge.cor};margin-right:2px">${esc(o.badge.txt)}</span>` : '';
  return `<button class="cx-mrow ${j.st} ${S.pulse.has(j.id) ? 'pulse' : ''}" data-cx="jogo" data-id="${esc(j.id)}" aria-label="Abrir jogo">${nome(L.a, clsA)}<span class="cx-msc">${mid}</span>${nome(L.b, clsB)}<span class="cx-mst">${badge}${esc(statusRotulo(j))}</span></button>`;
}

/* ---------- grupos / classificação: por Cotas (editadas pelo admin) e Cartões (amarelo tira 1 cota, 3 amarelos ou 1 vermelho = expulso) ---------- */
function htmlCartoes(r) {
  if (r.cvermelho) return `<span class="cx-cart verm" title="Cartão vermelho — expulso">🟥</span>`;
  if (r.camarelo >= 3) return `<span class="cx-cart verm" title="3 cartões amarelos — expulso">🟨×${r.camarelo}</span>`;
  if (r.camarelo > 0) return `<span class="cx-cart am" title="${r.camarelo} cartão(ões) amarelo(s) — tira ${r.camarelo} cota(s)">🟨×${r.camarelo}</span>`;
  return `<span class="cx-cart">—</span>`;
}
function htmlTabelaGrupo(g, gi) {
  const E = S.E, V = S.V, pontos = E.cfg.formato === 'pontos', tab = V.tabelas[g.id] || [], k = pontos ? 0 : E.cfg.classificam;
  const cor = corGrupo(gi);
  const linhas = tab.map((r, i) => {
    const t = timePorId(r.id) || { n: '?', s: '?', c: ['#888', '#fff'] };
    const cls = r.expulso ? 'exp' : i < k ? 'q' : '';
    const conteudo = `<td><span class="cx-rk">${r.expulso ? '×' : i + 1}</span></td><td class="nm"><div class="cx-tm">${escudo(t)}<span>${esc(t.n)}</span>${r.expulso ? '<small class="cx-exptag">EXPULSO</small>' : ''}</div></td><td><b>${r.cotas}</b></td><td>${htmlCartoes(r)}</td>`;
    // ícone sempre visível (não só no hover) pra ficar óbvio que dá pra tocar/clicar, inclusive no celular
    return S.admin
      ? `<tr class="${cls} clic" data-cx="editCotas" data-id="${esc(r.id)}" tabindex="0" role="button" aria-label="Editar cotas e cartões de ${esc(t.n)}">${conteudo}<td class="cx-editcol">${ico('edit')}</td></tr>`
      : `<tr class="${cls}">${conteudo}</tr>`;
  }).join('');
  return `<article class="cx-card cx-hov cx-gcard" style="--gc:${cor};--i:${gi}">
      <div class="cx-ghead"><span class="cx-gbadge">${pontos ? '★' : esc(g.id)}</span><b>${pontos ? 'Tabela do campeonato' : 'Grupo ' + esc(g.id)}</b><span class="pr">${tab.length} time${tab.length !== 1 ? 's' : ''}</span></div>
      <table class="cx-tbl"><thead><tr><th>#</th><th>Time</th><th>Cotas</th><th>Cartões</th>${S.admin ? '<th></th>' : ''}</tr></thead><tbody>${linhas}</tbody></table>
    </article>`;
}
function vGrupos() {
  const E = S.E;
  if (!E.grupos || !E.grupos.length) return vazioSemEstrutura();
  const pontos = E.cfg.formato === 'pontos';
  const info = pontos ? '' : `<div class="cx-sec">${E.grupos.length} grupo${E.grupos.length > 1 ? 's' : ''} · classificam ${E.cfg.classificam} por grupo</div>`;
  const comIcone = S.admin && !(!pontos && E.gruposFechados); // só quando o lápis de editar realmente aparece nas linhas
  const dica = S.admin
    ? (pontos ? 'Toque no lápis pra ajustar cotas e cartões de um time.' : (E.gruposFechados ? 'A fase de grupos está fechada: cotas e cartões continuam editáveis pra registro, mas não mudam mais o mata-mata já sorteado.' : 'Toque no lápis pra ajustar cotas, cartões, ou mover o time pra outro grupo.'))
    : (pontos ? 'Quem está na frente em cotas lidera.' : 'Faixa verde = posição que classifica para o mata-mata.');
  return `${info}<div class="cx-ggrid" style="${pontos ? 'grid-template-columns:minmax(0,760px)' : ''}">${E.grupos.map((g, i) => htmlTabelaGrupo(g, i)).join('')}</div><p class="cx-hint" style="margin-top:14px">${comIcone ? ico('edit') + ' ' : ''}${esc(dica)}</p>`;
}

/* ---------- mata-mata ---------- */
function htmlCartaoMata(j, i) {
  const r = S.V.mata.get(j.id), L = ladosDe(j), venc = vencedorDoJogo(j);
  const linha = (l, lado) => {
    const w = venc === lado, perd = venc && venc !== lado;
    const sc = j.st === 'ag' ? '' : (lado === 'a' ? j.ga : j.gb);
    const pen = isNum(j.pa) && isNum(j.pb) ? `<small>(${lado === 'a' ? j.pa : j.pb})</small>` : '';
    return `<div class="ln ${w ? 'w' : ''} ${perd ? 'l' : ''} ${l.time ? '' : 'tbd'}">${escudo(l.time)}<span class="nm">${esc(l.time ? l.time.n : l.rot)}</span>${sc !== '' ? `<span class="sc">${pen}${sc}</span>` : ''}</div>`;
  };
  if (r.bye) {
    const quem = r.a === 'BYE' ? L.b : L.a;
    return `<div class="cx-mc bye" style="--i:${i}"><div class="ln ${quem.time ? 'w' : 'tbd'}">${escudo(quem.time)}<span class="nm">${esc(quem.time ? quem.time.n : quem.rot)}</span></div><div class="ln tbd"><span class="nm">Folga · avança direto</span></div></div>`;
  }
  const rodape = j.st === 'vivo' ? 'Ao vivo' : j.st === 'fim' ? 'Encerrado' : (dataCurta(j.dt) || 'A definir');
  return `<button class="cx-mc ${j.st} ${S.pulse.has(j.id) ? 'pulse' : ''}" data-cx="jogo" data-id="${esc(j.id)}" style="--i:${i}" aria-label="Abrir jogo">${linha(L.a, 'a')}${linha(L.b, 'b')}<div class="ft"><span>${esc(rodape)}</span><span>${esc(j.loc || '')}</span></div></button>`;
}
function htmlPodio() {
  const V = S.V, E = S.E, R = V.R;
  const final = E.jogos.find(j => j.fase === 'm' && j.rd === R - 1 && !j.terceiro), rf = final && V.mata.get(final.id);
  if (!rf || !rf.done) return '';
  const terc = E.jogos.find(j => j.terceiro), rt = terc && V.mata.get(terc.id);
  const item = (cls, rot, id) => { const t = timePorId(id); return t ? `<div class="cx-card cx-pod ${cls}">${escudo(t)}<div><small>${rot}</small><b>${esc(t.n)}</b></div></div>` : ''; };
  return `<div class="cx-podio">${item('gold', '1º · Campeã', rf.venc)}${item('', '2º · Vice', rf.perd)}${rt && rt.done ? item('', '3º lugar', rt.venc) : ''}</div>`;
}
function vMata() {
  const E = S.E, V = S.V;
  if (!temEstrutura(E) || !V.R) return vazioSemEstrutura();
  const R = V.R, cols = [];
  for (let rd = 0; rd < R; rd++) {
    const js = E.jogos.filter(j => j.fase === 'm' && j.rd === rd && !j.terceiro).sort((a, b) => a.pos - b.pos);
    const ultima = rd === R - 1;
    cols.push(`<div class="cx-bcol ${ultima ? 'final' : ''}"><h4>${esc(nomeRodadaMata(rd, R))}</h4><div class="cx-slots">${js.map((j, i) => {
      const r = V.mata.get(j.id);
      return `<div class="cx-slot ${ultima ? '' : (i % 2 ? 'bot' : 'top')} ${r.done ? 'won' : ''}">${htmlCartaoMata(j, i)}${ultima ? '' : '<i class="rs"></i>'}</div>`;
    }).join('')}</div></div>`);
  }
  const terc = E.jogos.find(j => j.terceiro);
  const bloco3 = terc ? `<div class="cx-third"><h4>Disputa de 3º lugar</h4>${htmlCartaoMata(terc, 0)}</div>` : '';
  return `${htmlPodio()}<div class="cx-bwrap" id="cx-bwrap"><div class="cx-bracket" data-ctx>${cols.join('')}</div>${bloco3}</div>`;
}

/* ---------- jogos (agenda) ---------- */
function rodadasDisponiveis() {
  const E = S.E, out = [];
  const g = [...new Set(E.jogos.filter(j => j.fase === 'g').map(j => j.rodada))].sort((a, b) => a - b);
  g.forEach(r => out.push({ k: 'g' + r, n: `Rodada ${r}`, f: j => j.fase === 'g' && j.rodada === r }));
  for (let rd = 0; rd < S.V.R; rd++) out.push({ k: 'm' + rd, n: nomeRodadaMata(rd, S.V.R), f: j => j.fase === 'm' && j.rd === rd && !j.terceiro });
  if (E.jogos.some(j => j.terceiro)) out.push({ k: 'm3', n: 'Disputa de 3º lugar', f: j => j.terceiro });
  return out;
}
function rodadaAtual(rs) {
  for (const r of rs) {
    const js = S.E.jogos.filter(r.f);
    if (js.some(j => j.st !== 'fim' && !(j.fase === 'm' && S.V.mata.get(j.id).bye))) return r.k;
  }
  return rs.length ? rs[rs.length - 1].k : null;
}
function vJogos() {
  const E = S.E;
  if (!temEstrutura(E)) return vazioSemEstrutura();
  const rs = rodadasDisponiveis();
  if (!rs.length) return vazioSemEstrutura();
  if (!S.rodadaSel || (S.rodadaSel !== 'todas' && !rs.find(r => r.k === S.rodadaSel))) S.rodadaSel = rodadaAtual(rs);
  const sel = S.rodadaSel;
  const filtro = { todos: () => true, vivo: j => j.st === 'vivo', ag: j => j.st === 'ag', fim: j => j.st === 'fim' }[S.filtro] || (() => true);
  const usa = sel === 'todas' ? rs : rs.filter(r => r.k === sel);
  const multiGrupo = E.grupos && E.grupos.length > 1 && E.cfg.formato === 'grupos';
  const blocos = usa.map(r => {
    const js = E.jogos.filter(r.f).filter(j => !(j.fase === 'm' && S.V.mata.get(j.id).bye)).filter(filtro);
    if (!js.length) return '';
    const ord = js.slice().sort((a, b) => (a.dt || '9').localeCompare(b.dt || '9'));
    return `<div class="cx-sec">${esc(r.n)}</div><div class="cx-lgrid">${ord.map(j => htmlLinhaJogo(j, multiGrupo && j.fase === 'g' ? { badge: { txt: j.grupo, cor: corGrupo(E.grupos.findIndex(g => g.id === j.grupo)) } } : null)).join('')}</div>`;
  }).join('');
  const chip = (k, n) => `<button class="cx-chip ${S.filtro === k ? 'on' : ''}" data-cx="filtro" data-f="${k}">${n}</button>`;
  return `<div class="cx-row" style="align-items:flex-end;margin-bottom:6px;flex-wrap:wrap"><div class="cx-f" style="max-width:260px;margin:0"><label>Rodada</label><select class="cx-sel" data-cxi="rodada">${rs.map(r => `<option value="${r.k}" ${r.k === sel ? 'selected' : ''}>${esc(r.n)}</option>`).join('')}<option value="todas" ${sel === 'todas' ? 'selected' : ''}>Todas as rodadas</option></select></div>
    <div class="cx-chips" style="margin:0;flex:2 1 260px;justify-content:flex-end">${chip('todos', 'Todos')}${chip('vivo', 'Ao vivo')}${chip('ag', 'Agendados')}${chip('fim', 'Encerrados')}</div></div>
    <div data-ctx>${blocos || vazio('list', 'Nenhum jogo aqui', 'Nada corresponde a esse filtro.', '')}</div>`;
}

/* ---------- times ---------- */
function vTimes() {
  const E = S.E;
  if (!E.times.length) return vazioSemEstrutura();
  const grupoDe = id => { const i = (E.grupos || []).findIndex(g => g.ids.includes(id)); return i < 0 ? null : { id: E.grupos[i].id, i }; };
  const ord = E.times.slice().sort((a, b) => a.n.localeCompare(b.n, 'pt-BR'));
  const cards = ord.map((t, i) => {
    const g = E.cfg.formato === 'grupos' ? grupoDe(t.id) : null;
    const tags = `${t.cab ? `<span class="cx-tag">★ Cabeça</span>` : ''}${g ? `<span class="cx-tag g" style="--gc:${corGrupo(g.i)}">Grupo ${esc(g.id)}</span>` : ''}`;
    const conteudo = `${escudo(t)}<b>${esc(t.n)}</b><small>${esc([t.sub, t.ser ? 'Série ' + t.ser : ''].filter(Boolean).join(' · ') || t.s)}</small>${tags ? `<div class="tags">${tags}</div>` : ''}`;
    return S.admin
      ? `<button class="cx-card cx-hov cx-tcard" style="--i:${Math.min(i, 24)}" data-cx="editTime" data-id="${esc(t.id)}" aria-label="Editar ${esc(t.n)}">${conteudo}</button>`
      : `<div class="cx-card cx-hov cx-tcard" style="--i:${Math.min(i, 24)}">${conteudo}</div>`;
  }).join('');
  const add = S.admin && !temEstrutura(E) ? `<button class="cx-btn sm" data-cx="addTimes">${ico('plus')}Adicionar times</button>` : '';
  const aviso = S.admin && temEstrutura(E) ? '<div class="cx-warn">' + ico('alert') + '<div>O sorteio já foi feito: dá para editar nome, cores e escudo de cada time, mas incluir ou tirar times exige refazer o sorteio (menu Mais → Refazer sorteio).</div></div>' : '';
  return `${aviso}<div class="cx-sec">${E.times.length} time${E.times.length > 1 ? 's' : ''}<span style="flex:none">${add}</span></div><div class="cx-tgrid">${cards}</div>`;
}

/* ---------- montagem ---------- */
function corpoDaAba() {
  switch (S.aba) {
    case 'grupos': return vGrupos();
    case 'mata': return vMata();
    case 'jogos': return vJogos();
    case 'times': return vTimes();
    default: return '';
  }
}
function htmlSemCopa() {
  return `<div class="cx-body">${S.erro ? vazio('alert', 'Não foi possível abrir a copa', S.erro, `<button class="cx-btn" data-cx="recarregar">${ico('refresh')}Tentar de novo</button>`)
    : S.admin ? vazio('trophy', 'Nenhuma copa criada', 'Monte a primeira copa: escolha os times (do Brasileirão ou outros nomes), o formato e o tema.', `<button class="cx-btn pri" data-cx="novaCopa">${ico('plus')}Criar copa</button>${S.lista.length ? `<button class="cx-btn" data-cx="copas">${ico('layers')}Copas anteriores</button>` : ''}`)
      : vazio('trophy', 'Nenhuma copa em andamento', 'Quando o administrador abrir uma nova copa ela aparece aqui, com placares ao vivo.', S.lista.length ? `<button class="cx-btn" data-cx="copas">${ico('layers')}Ver copas anteriores</button>` : '')}</div>`;
}
function render() {
  if (!S.raiz) return;
  const inner = $('.cx-inner', S.raiz);
  aplicarTemaAtual();
  if (S.carregando) { inner.innerHTML = `<div class="cx-body"><div class="cx-empty"><div class="ic">${ico('trophy')}</div><p>Carregando a copa…</p></div></div>`; return; }
  if (!S.E) { inner.innerHTML = htmlSemCopa(); return; }
  const abas = abasDaCopa();
  if (!abas.find(a => a[0] === S.aba)) S.aba = abas[0][0];
  const scrollB = $('#cx-bwrap', S.raiz); const sl = scrollB ? scrollB.scrollLeft : 0;
  const scrollY = window.scrollY;
  inner.innerHTML = htmlCabecalho() + htmlCampea() + htmlEtapas() + htmlAbas() + htmlBarra() + `<div class="cx-body ${S.animar ? 'cx-anim' : ''}"><div class="cx-pane">${corpoDaAba()}</div></div>`;
  S.animar = false;
  const nb = $('#cx-bwrap', S.raiz); if (nb && sl) nb.scrollLeft = sl;
  posicionarIndicador();
  marcarSync();
  if (S.pulse.size) setTimeout(() => S.pulse.clear(), 1600);
  if (Math.abs(window.scrollY - scrollY) > 1) window.scrollTo(0, scrollY);
}
function posicionarIndicador() {
  const nav = $('#cx-tabs', S.raiz), on = nav && $('.cx-tab.on', nav), ind = nav && $('.cx-ind', nav);
  if (!on || !ind) return;
  const ix = on.offsetLeft, iw = on.offsetWidth;
  if (ix !== S.ix || iw !== S.iw) { void ind.offsetWidth; ind.style.setProperty('--ix', ix + 'px'); ind.style.setProperty('--iw', iw + 'px'); }
  S.ix = ix; S.iw = iw;
}

/* ═══════════════════════════════════════════════════════════════════════
   MODAIS — jogo, times, configuração, sorteio, copas, campeã
   ═══════════════════════════════════════════════════════════════════════ */

/* ---------- imagens (escudo próprio) ---------- */
function comprimirImagem(file, max) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const k = Math.min(1, max / Math.max(im.width, im.height)), w = Math.max(1, Math.round(im.width * k)), h = Math.max(1, Math.round(im.height * k));
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(im, 0, 0, w, h);
      URL.revokeObjectURL(url);
      cv.toBlob(b => (b ? res(b) : rej(new Error('Não foi possível converter a imagem.'))), 'image/webp', 0.86);
    };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Arquivo de imagem inválido.')); };
    im.src = url;
  });
}
async function enviarImagem(file, pasta) {
  if (!file) return '';
  if (!/^image\//.test(file.type)) throw new Error('Escolha um arquivo de imagem.');
  if (file.size > 8 * 1024 * 1024) throw new Error('Imagem muito grande (máx. 8 MB).');
  if (typeof sb === 'undefined' || !sb.storage) throw new Error('Envio de imagem indisponível aqui. Cole o endereço (https) da imagem.');
  const blob = await comprimirImagem(file, 320);
  const path = `${pasta}/${uid()}-${Date.now()}.webp`;
  const { error } = await sb.storage.from('portal-uploads').upload(path, blob, { upsert: true, contentType: 'image/webp' });
  if (error) throw new Error('Falha no envio: ' + error.message);
  return sb.storage.from('portal-uploads').getPublicUrl(path).data.publicUrl;
}
async function escolherArquivo() {
  return new Promise(res => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = () => res(inp.files && inp.files[0] ? inp.files[0] : null);
    inp.click();
  });
}
async function subirParaCampo(idCampo, pasta, btn) {
  const f = await escolherArquivo();
  if (!f) return;
  const campo = document.getElementById(idCampo);
  const rot = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando…'; }
  try { campo.value = await enviarImagem(f, pasta); campo.dispatchEvent(new Event('input', { bubbles: true })); avisar('Imagem enviada.'); }
  catch (e) { avisar(e.message, 'err'); }
  finally { if (btn) { btn.disabled = false; btn.innerHTML = rot; } }
}

/* ═════════ JOGO ═════════ */
function abrirJogo(id, ids) {
  if (!jogoPorId(id)) return;
  S.jogoAberto = { id, ids: ids && ids.length ? ids : [id], bump: '' };
  let ovl = S.modais.find(m => m.dataset.kind === 'jogo');
  if (!ovl) ovl = abrirModal('', { kind: 'jogo', foco: false });
  ovl.innerHTML = htmlJogo();
}
function atualizarJogoAberto() {
  if (!S.jogoAberto) return;
  const ovl = S.modais.find(m => m.dataset.kind === 'jogo');
  if (!ovl) { S.jogoAberto = null; return; }
  if (!jogoPorId(S.jogoAberto.id)) { fecharModal(ovl); return; }
  const mb = $('.cx-mb', ovl), y = mb ? mb.scrollTop : 0;
  ovl.innerHTML = htmlJogo();
  const nb = $('.cx-mb', ovl); if (nb) nb.scrollTop = y;
  S.jogoAberto.bump = '';
}
function htmlJogo() {
  const j = jogoPorId(S.jogoAberto.id), L = ladosDe(j), V = S.V;
  const r = j.fase === 'm' ? V.mata.get(j.id) : null;
  const definido = j.fase === 'g' || (r && r.a && r.b && !r.bye);
  const edita = S.admin && definido;
  const venc = vencedorDoJogo(j);
  const side = (l, lado) => `<div class="cx-side ${venc === lado ? 'w' : ''} ${l.time ? '' : 'tbd'}">${escudo(l.time)}<b>${esc(l.time ? l.time.n : l.rot)}</b>${l.time && l.time.sub ? `<small>${esc(l.time.sub)}</small>` : ''}</div>`;
  const num = lado => (j.st === 'ag' ? '–' : (lado === 'a' ? j.ga : j.gb));
  const adj = lado => (edita ? `<div class="cx-adj"><button data-cx="gol" data-l="${lado}" data-d="-1" aria-label="Menos um gol" ${j.st === 'ag' || !(lado === 'a' ? j.ga : j.gb) ? 'disabled' : ''}>−</button><button data-cx="gol" data-l="${lado}" data-d="1" aria-label="Mais um gol">+</button></div>` : '');
  const bump = l => (S.jogoAberto.bump === l ? 'bump' : '');
  const empateMata = j.fase === 'm' && j.st !== 'ag' && j.ga === j.gb;
  const pen = empateMata ? `<div class="cx-pen"><span class="cx-lbl">Pênaltis</span><input class="cx-in" type="number" min="0" max="99" inputmode="numeric" data-cxi="pen" data-l="a" value="${isNum(j.pa) ? j.pa : ''}" ${edita ? '' : 'disabled'} aria-label="Pênaltis do primeiro time"><span style="color:var(--cx-mut)">×</span><input class="cx-in" type="number" min="0" max="99" inputmode="numeric" data-cxi="pen" data-l="b" value="${isNum(j.pb) ? j.pb : ''}" ${edita ? '' : 'disabled'} aria-label="Pênaltis do segundo time"></div>` : '';
  const pill = `<span class="cx-pill ${j.st}">${j.st === 'vivo' ? 'Ao vivo' : j.st === 'fim' ? 'Encerrado' : 'Agendado'}</span>`;
  let acoes = '';
  if (edita) {
    acoes = j.st === 'ag' ? `<button class="cx-btn pri" data-cx="jogoSt" data-st="vivo">${ico('play')}Iniciar jogo</button>`
      : j.st === 'vivo' ? `<button class="cx-btn ok" data-cx="jogoSt" data-st="fim">${ico('check')}Encerrar jogo</button><button class="cx-btn ghost" data-cx="jogoSt" data-st="ag">Zerar</button>`
        : `<button class="cx-btn" data-cx="jogoSt" data-st="vivo">${ico('undo')}Reabrir</button><button class="cx-btn ghost" data-cx="jogoSt" data-st="ag">Zerar</button>`;
  }
  const info = edita
    ? `<div class="cx-row" style="margin-top:14px"><div class="cx-f" style="margin:0"><label>Data e hora</label><input class="cx-in" type="datetime-local" data-cxi="jdt" value="${esc(j.dt || '')}"></div><div class="cx-f" style="margin:0"><label>Local</label><input class="cx-in" maxlength="60" data-cxi="jloc" value="${esc(j.loc || '')}" placeholder="Estádio, sala…"></div></div>`
    : (j.dt || j.loc ? `<p class="cx-hint" style="text-align:center;margin:8px 0 0">${esc([dataCurta(j.dt), j.loc].filter(Boolean).join(' · '))}</p>` : '');
  const aviso = S.admin && !definido ? `<div class="cx-warn">${ico('alert')}<div>${r && r.bye ? 'Este jogo é uma folga: o time avança direto.' : 'Aguardando a definição dos dois times. Assim que os jogos anteriores terminarem, o placar poderá ser lançado.'}</div></div>` : '';
  const i = S.jogoAberto.ids.indexOf(j.id), tem = S.jogoAberto.ids.length > 1;
  const nav = tem ? `<div class="cx-nav"><button class="cx-ib" data-cx="jogoNav" data-d="-1" aria-label="Jogo anterior" ${i <= 0 ? 'disabled style="opacity:.35"' : ''}>${ico('left')}</button><button class="cx-ib" data-cx="jogoNav" data-d="1" aria-label="Próximo jogo" ${i >= S.jogoAberto.ids.length - 1 ? 'disabled style="opacity:.35"' : ''}>${ico('right')}</button></div><span class="cx-hint">${i + 1}/${S.jogoAberto.ids.length}</span>` : '';
  return `<div class="cx-modal" role="dialog" aria-modal="true" aria-label="Jogo">
    <div class="cx-mh"><div style="flex:1;min-width:0"><small>${esc(nomeRodadaJogo(j))}</small><h3>${esc((L.a.time ? L.a.time.n : L.a.rot) + ' × ' + (L.b.time ? L.b.time.n : L.b.rot))}</h3></div>${pill}<button class="cx-ib" data-cx="fechar" aria-label="Fechar">${ico('x')}</button></div>
    <div class="cx-mb">${aviso}<div class="cx-board">${side(L.a, 'a')}<div class="cx-score"><div><div class="n ${bump('a')}">${num('a')}</div>${adj('a')}</div><span class="x">×</span><div><div class="n ${bump('b')}">${num('b')}</div>${adj('b')}</div></div>${side(L.b, 'b')}</div>${pen}${acoes ? `<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">${acoes}</div>` : ''}${info}</div>
    <div class="cx-mf">${nav}<span class="sp"></span><button class="cx-btn" data-cx="fechar">Fechar</button></div></div>`;
}

/* ═════════ TIMES ═════════ */
const CORES_BASE = ['#c8102e', '#0b6b3a', '#0033a0', '#161616', '#e4002b', '#0d80bf', '#f5c400', '#7a1f3d'];
function htmlFormTime(t, idp) {
  t = t || { n: '', s: '', c: ['#d4a847', '#ffffff'], logo: '', sub: '', cab: false };
  return `<div class="cx-prev"><span id="${idp}-prev">${escudo(t)}</span><div style="min-width:0"><b id="${idp}-pn" style="font-size:15px">${esc(t.n || 'Nome do time')}</b><div class="cx-hint">Assim o time aparece nas tabelas e no chaveamento.</div></div></div>
    <div class="cx-row"><div class="cx-f" style="flex:2"><label for="${idp}-n">Nome</label><input class="cx-in" id="${idp}-n" maxlength="40" value="${esc(t.n)}" placeholder="Ex.: Fortaleza" data-cxi="tprev" data-p="${idp}" autocomplete="off"></div>
      <div class="cx-f"><label for="${idp}-s">Sigla</label><input class="cx-in" id="${idp}-s" maxlength="4" value="${esc(t.s || '')}" placeholder="Auto" data-cxi="tprev" data-p="${idp}" autocomplete="off" style="text-transform:uppercase"></div></div>
    <div class="cx-row"><div class="cx-f"><label>Cor principal</label><input class="cx-col" type="color" id="${idp}-c1" value="${esc(safeColor(t.c && t.c[0], '#d4a847'))}" data-cxi="tprev" data-p="${idp}" style="width:100%"></div>
      <div class="cx-f"><label>Cor do contorno</label><input class="cx-col" type="color" id="${idp}-c2" value="${esc(safeColor(t.c && t.c[1], '#ffffff'))}" data-cxi="tprev" data-p="${idp}" style="width:100%"></div></div>
    <div class="cx-f"><label for="${idp}-sub">Legenda (opcional)</label><input class="cx-in" id="${idp}-sub" maxlength="40" value="${esc(t.sub || '')}" placeholder="Cidade, setor, apelido…" autocomplete="off"></div>
    <div class="cx-f"><label for="${idp}-logo">Imagem do escudo (opcional)</label><div class="cx-photo"><input class="cx-in" id="${idp}-logo" value="${esc(t.logo || '')}" placeholder="https://… ou envie um arquivo" data-cxi="tprev" data-p="${idp}" autocomplete="off"><button class="cx-btn sm" type="button" data-cx="upload" data-alvo="${idp}-logo" data-pasta="copa-times">${ico('upload')}Enviar</button></div></div>
    <button type="button" class="cx-tog ${t.cab ? 'on' : ''}" data-cx="togCab" id="${idp}-cab" style="background:none;border:0;color:inherit;font:inherit;text-align:left;width:100%"><span class="sw"></span><span><b>Cabeça de chave</b><span class="d">No sorteio, cabeças de chave ficam em grupos diferentes (ou nas primeiras posições da chave).</span></span></button>`;
}
function lerFormTime(idp) {
  const v = id => { const e = document.getElementById(idp + '-' + id); return e ? e.value.trim() : ''; };
  const n = v('n');
  return { n, s: v('s'), c1: v('c1'), c2: v('c2'), sub: v('sub'), logo: v('logo'), cab: document.getElementById(idp + '-cab').classList.contains('on') };
}
function atualizarPreviaTime(idp) {
  const f = lerFormTime(idp);
  const t = novoTime({ n: f.n || 'Time', s: f.s, c1: f.c1, c2: f.c2, logo: f.logo });
  const el = document.getElementById(idp + '-prev'); if (el) el.innerHTML = escudo(t);
  const pn = document.getElementById(idp + '-pn'); if (pn) pn.textContent = f.n || 'Nome do time';
}

// seletor: Brasileirão | lista de nomes | um time
function abrirPicker() {
  if (!S.admin) return;
  if (temEstrutura(S.E)) return avisar('O sorteio já foi feito. Para incluir times, refaça o sorteio (menu Mais).', 'err');
  S.picker = { modo: 'br', sel: new Set(), busca: '', serie: 'todos' };
  abrirModal(htmlPicker(), { kind: 'picker' });
  renderCatalogo();
}
const jaTem = nome => S.E.times.some(t => t.n.toLowerCase() === String(nome).toLowerCase());
function htmlPicker() {
  const p = S.picker;
  const seg = `<div class="cx-seg" style="margin-bottom:16px"><button class="${p.modo === 'br' ? 'on' : ''}" data-cx="pickModo" data-m="br">Brasileirão</button><button class="${p.modo === 'lista' ? 'on' : ''}" data-cx="pickModo" data-m="lista">Lista de nomes</button><button class="${p.modo === 'um' ? 'on' : ''}" data-cx="pickModo" data-m="um">Um time</button></div>`;
  let corpo;
  if (p.modo === 'br') {
    corpo = `${seg}<div class="cx-row" style="align-items:flex-end"><div class="cx-f" style="margin:0;flex:2"><label for="cx-busca">Buscar</label><input class="cx-in" id="cx-busca" data-cxi="pickBusca" placeholder="Nome ou estado (ex.: SP)" value="${esc(p.busca)}" autocomplete="off"></div><div class="cx-chips" style="margin:0;flex:none">${[['todos', 'Todos'], ['A', 'Série A'], ['B', 'Série B']].map(([k, n]) => `<button class="cx-chip ${p.serie === k ? 'on' : ''}" data-cx="pickSerie" data-s="${k}">${n}</button>`).join('')}</div></div>
      <div style="display:flex;gap:8px;margin-top:12px;align-items:center;flex-wrap:wrap"><button class="cx-btn sm" data-cx="pickTodos">Selecionar os que aparecem</button><button class="cx-btn sm ghost" data-cx="pickLimpar">Limpar seleção</button><span class="cx-hint" id="cx-pick-n"></span></div>
      <div class="cx-cat" id="cx-cat"></div><p class="cx-hint" style="margin-top:14px">Os escudos são desenhados com as cores do clube (sem usar marcas oficiais). Dá para editar cor, sigla e imagem depois de adicionar.</p>`;
  } else if (p.modo === 'lista') {
    corpo = `${seg}<div class="cx-f"><label for="cx-lista">Um nome por linha</label><textarea class="cx-in" id="cx-lista" data-cxi="pickLista" rows="9" placeholder="Ana Souza&#10;Carlos Lima; CAR&#10;Equipe Alfa; ALF; #0d80bf; #ffffff" spellcheck="false"></textarea></div>
      <p class="cx-hint">Serve para pessoas, equipes ou qualquer outro nome. Opcional depois do nome, separado por <b>;</b>: sigla, cor principal e cor do contorno. Sem cor escolhida, cada nome ganha uma cor própria.</p><p class="cx-hint" id="cx-lista-n" style="margin-top:8px"></p>`;
  } else {
    corpo = `${seg}${htmlFormTime(null, 'cx-p')}`;
  }
  const rodape = `<button class="cx-btn ghost" data-cx="fechar">Cancelar</button><span class="sp"></span><button class="cx-btn pri" data-cx="pickAdd" id="cx-pick-add">${ico('plus')}Adicionar</button>`;
  return moldura({ titulo: 'Adicionar times', sub: `${S.E.times.length} na copa`, corpo, rodape, cls: 'wide' });
}
function repintarPicker() {
  const ovl = S.modais.find(m => m.dataset.kind === 'picker'); if (!ovl) return;
  ovl.innerHTML = htmlPicker();
  renderCatalogo();
}
function catalogoFiltrado() {
  const p = S.picker, q = p.busca.trim().toLowerCase();
  return CATALOGO.map((c, i) => ({ c, i })).filter(({ c }) => (p.serie === 'todos' || c.ser === p.serie) && (!q || (c.n + ' ' + c.uf + ' ' + c.s).toLowerCase().includes(q)));
}
function renderCatalogo() {
  const p = S.picker, box = $('#cx-cat'); if (!box) { atualizarBotaoPicker(); return; }
  const lista = catalogoFiltrado();
  box.innerHTML = lista.map(({ c, i }) => {
    const t = novoTime({ n: c.n, s: c.s, c1: c.c[0], c2: c.c[1] });
    return `<button class="cx-pick ${jaTem(c.n) ? 'has' : (p.sel.has(i) ? 'on' : '')}" data-cx="pickCat" data-i="${i}">${escudo(t)}<span><b>${esc(c.n)}</b><small>${esc(c.uf)} · Série ${esc(c.ser)}</small></span></button>`;
  }).join('') || '<p class="cx-hint">Nenhum clube encontrado. Use "Lista de nomes" ou "Um time" para digitar outro nome.</p>';
  atualizarBotaoPicker();
}
function parseLista(txt) {
  const out = [], vistos = new Set();
  String(txt || '').split(/\r?\n/).forEach(l => {
    const partes = l.split(';').map(x => x.trim());
    const n = (partes[0] || '').slice(0, 40); if (!n) return;
    const k = n.toLowerCase(); if (vistos.has(k)) return; vistos.add(k);
    out.push({ n, s: partes[1] || '', c1: partes[2] || '', c2: partes[3] || '' });
  });
  return out;
}
function atualizarBotaoPicker() {
  const p = S.picker; if (!p) return;
  const btn = $('#cx-pick-add'), cont = $('#cx-pick-n'), contL = $('#cx-lista-n');
  let n = 0;
  if (p.modo === 'br') n = p.sel.size;
  else if (p.modo === 'lista') { const l = parseLista(($('#cx-lista') || {}).value); n = l.filter(x => !jaTem(x.n)).length; if (contL) contL.textContent = l.length ? `${n} nome(s) novo(s) para adicionar${l.length - n ? ` · ${l.length - n} já estão na copa` : ''}` : ''; }
  else n = 1;
  if (cont) cont.textContent = p.sel.size ? `${p.sel.size} selecionado(s)` : '';
  if (btn) { btn.disabled = n === 0; btn.innerHTML = `${ico('plus')}${p.modo === 'um' ? 'Adicionar time' : `Adicionar ${n || ''} time${n === 1 ? '' : 's'}`}`; }
}
async function confirmarPicker() {
  const p = S.picker; let novos = [];
  if (p.modo === 'br') novos = [...p.sel].map(i => ({ n: CATALOGO[i].n, s: CATALOGO[i].s, c1: CATALOGO[i].c[0], c2: CATALOGO[i].c[1], ser: CATALOGO[i].ser, sub: CATALOGO[i].uf }));
  else if (p.modo === 'lista') novos = parseLista(($('#cx-lista') || {}).value);
  else { const f = lerFormTime('cx-p'); if (!f.n) return avisar('Digite o nome do time.', 'err'); novos = [f]; }
  novos = novos.filter(x => !jaTem(x.n));
  if (!novos.length) return avisar('Nada novo para adicionar.', 'err');
  if (S.E.times.length + novos.length > 64) return avisar('O limite é de 64 times por copa.', 'err');
  const r = await mutar(E => { novos.forEach(x => E.times.push(novoTime(x))); }, { rot: 'Adicionar times' });
  if (r && r.ok) {
    avisar(`${novos.length} time(s) adicionado(s).`);
    if (p.modo === 'um') { p.modo = 'um'; repintarPicker(); const f = $('#cx-p-n'); if (f) f.focus(); }
    else fecharModal(S.modais.find(m => m.dataset.kind === 'picker'));
    S.aba = 'times';
    render();
  }
}

function abrirEditTime(id) {
  const t = timePorId(id); if (!t || !S.admin) return;
  const trava = temEstrutura(S.E);
  abrirModal(moldura({
    titulo: 'Editar time', sub: t.n, cls: '',
    corpo: htmlFormTime(t, 'cx-e') + (trava ? `<div class="cx-hint">O sorteio já foi feito, então o time não pode ser excluído agora (refaça o sorteio pelo menu Mais).</div>` : ''),
    rodape: `<button class="cx-btn bad ${trava ? 'off' : ''}" data-cx="delTime" data-id="${esc(id)}">${ico('trash')}Excluir</button><span class="sp"></span><button class="cx-btn ghost" data-cx="fechar">Cancelar</button><button class="cx-btn pri" data-cx="saveTime" data-id="${esc(id)}">Salvar</button>`,
  }), { kind: 'time' });
}
async function salvarTime(id) {
  const f = lerFormTime('cx-e'); if (!f.n) return avisar('O time precisa de um nome.', 'err');
  if (S.E.times.some(t => t.id !== id && t.n.toLowerCase() === f.n.toLowerCase())) return avisar('Já existe um time com esse nome.', 'err');
  const r = await mutar(E => {
    const t = E.times.find(x => x.id === id); if (!t) return { ok: false, erro: 'Time não encontrado.' };
    // preserva cotas/cartões: editar nome/cor não pode apagar o que já foi apurado pro time
    const novo = novoTime({ id, n: f.n, s: f.s, c1: f.c1, c2: f.c2, logo: f.logo, sub: f.sub, cab: f.cab, ser: t.ser, cotas: t.cotas, camarelo: t.camarelo, cvermelho: t.cvermelho });
    Object.assign(t, novo);
  }, { rot: 'Editar time' });
  if (r && r.ok) fecharModal(S.modais.find(m => m.dataset.kind === 'time'));
}
async function excluirTime(id) {
  if (temEstrutura(S.E)) return;
  const t = timePorId(id);
  if (!await confirmar({ titulo: 'Excluir time', msg: `Excluir "${t ? t.n : ''}" da copa?`, ok: 'Excluir', perigo: true })) return;
  const r = await mutar(E => { E.times = E.times.filter(x => x.id !== id); }, { rot: 'Excluir time' });
  if (r && r.ok) fecharModal(S.modais.find(m => m.dataset.kind === 'time'));
}

/* ═════════ COTAS E CARTÕES (fase de grupos) ═════════ */
function abrirEditarCotas(timeId) {
  const t = timePorId(timeId); if (!t || !S.admin) return;
  S.cotasAlvo = timeId;
  abrirModal(htmlEditarCotas(), { kind: 'cotas', foco: false, onClose: () => { S.cotasAlvo = null; } });
}
function htmlEditarCotas() {
  const t = timePorId(S.cotasAlvo); if (!t) return '';
  const E = S.E, grupoAtual = (E.grupos || []).find(g => g.ids.includes(t.id));
  const podeMover = !E.gruposFechados && E.grupos && E.grupos.length > 1;
  const exp = expulso(t);
  const corpo = `<div class="cx-prev">${escudo(t)}<div style="min-width:0"><b style="font-size:15px">${esc(t.n)}</b>${grupoAtual ? `<div class="cx-hint">Grupo ${esc(grupoAtual.id)}</div>` : ''}</div></div>
    ${exp ? `<div class="cx-warn bad">${ico('alert')}<div>Expulso — não entra na classificação, mesmo tendo mais cotas que os outros.</div></div>` : ''}
    <div class="cx-f"><label for="cx-cot-n">Cotas</label><input class="cx-in" id="cx-cot-n" type="number" inputmode="numeric" min="0" step="1" value="${t.cotas}" data-cxi="cotasNum"></div>
    <div class="cx-lbl" style="margin:14px 0 8px">Cartões</div>
    <div class="cx-row" style="align-items:flex-end;flex-wrap:wrap">
      <div class="cx-f" style="margin:0;min-width:170px"><label>Amarelos <span class="cx-hint" style="font-weight:400">· cada um tira 1 cota, 3 expulsam</span></label>
        <div class="cx-step2"><button type="button" data-cx="cotCartaoAm" data-d="-1" aria-label="Menos um amarelo">−</button><output>${t.camarelo}</output><button type="button" data-cx="cotCartaoAm" data-d="1" aria-label="Mais um amarelo">+</button></div>
      </div>
      <button type="button" class="cx-btn ${t.cvermelho ? 'bad' : ''}" data-cx="cotCartaoVerm">🟥 ${t.cvermelho ? 'Remover cartão vermelho' : 'Aplicar cartão vermelho'}</button>
    </div>
    ${podeMover ? `<div class="cx-f" style="margin-top:16px"><label for="cx-cot-grp">Mover para o grupo</label><select class="cx-sel" id="cx-cot-grp" data-cxi="cotasGrupo">${E.grupos.map(g => `<option value="${esc(g.id)}" ${grupoAtual && grupoAtual.id === g.id ? 'selected' : ''}>Grupo ${esc(g.id)}</option>`).join('')}</select></div>` : ''}`;
  return moldura({ titulo: 'Cotas e cartões', sub: t.n, cls: 'sm', corpo, rodape: `<button class="cx-btn pri blk" data-cx="fechar">Pronto</button>` });
}
function repintarEditarCotas() {
  const ovl = S.modais.find(m => m.dataset.kind === 'cotas'); if (!ovl || !S.cotasAlvo) return;
  ovl.innerHTML = htmlEditarCotas();
}

/* ═════════ FECHAR A FASE DE GRUPOS ═════════ */
function abrirFecharGrupos() {
  if (!S.admin) return;
  const E = S.E, pontos = E.cfg.formato === 'pontos';
  if (pontos) {
    const t = tabelaGrupo(E, E.grupos[0].id), lider = t.find(r => !r.expulso);
    const nome = lider ? (timePorId(lider.id) || {}).n : null;
    confirmar({ titulo: 'Encerrar temporada?', msg: nome ? `"${nome}" está na liderança e vira campeã. Dá pra reabrir depois, se precisar corrigir algo.` : 'Ainda não há um líder definido (empate ou só times expulsos).', ok: 'Encerrar', perigo: true })
      .then(ok => { if (ok) mutar(E2 => fecharFaseDeGrupos(E2), { rot: 'Encerrar temporada', perguntar: false }); });
    return;
  }
  abrirModal(htmlFecharGrupos(), { kind: 'fecharGrupos', foco: false });
}
function htmlFecharGrupos() {
  const E = S.E;
  const porGrupo = E.grupos.map((g, gi) => ({ g, gi, fila: tabelaGrupo(E, g.id) }));
  const corpo = `<p class="cx-hint" style="margin:0 0 14px">Isso trava as cotas e cartões de agora e sorteia o mata-mata com quem se classificou. Dá pra reabrir depois (menu Mais) se precisar corrigir algo, mas o mata-mata já sorteado é apagado.</p>
    <div class="cx-draw">${porGrupo.map(({ g, gi, fila }) => `<div class="cx-dg" style="--gc:${corGrupo(gi)}"><h5><span class="cx-gbadge">${esc(g.id)}</span>Grupo ${esc(g.id)}</h5><ul>${fila.map((r, i) => {
    const t = timePorId(r.id) || { n: '?', s: '?', c: ['#888', '#fff'] }, vai = !r.expulso && i < E.cfg.classificam;
    return `<li style="--i:${gi * 4 + i};opacity:${r.expulso ? '.5' : '1'}">${escudo(t)}<span>${esc(t.n)}${r.expulso ? ' · expulso' : ''}</span><b style="color:${vai ? 'var(--cx-ok)' : 'var(--cx-mut)'};font-family:var(--cx-font-d);font-size:13px;flex:none">${r.cotas}</b></li>`;
  }).join('')}</ul></div>`).join('')}</div>
    <p class="cx-hint" style="margin-top:12px"><span style="color:var(--cx-ok)">▍</span> vai pro mata-mata (classificam ${E.cfg.classificam} por grupo).</p>`;
  return moldura({ titulo: 'Fechar fase de grupos', sub: 'Confira antes de sortear o mata-mata', corpo, cls: 'wide', rodape: `<button class="cx-btn ghost" data-cx="fechar">Cancelar</button><span class="sp"></span><button class="cx-btn pri" data-cx="fecharGruposOk">${ico('check')}Fechar e sortear mata-mata</button>` });
}
async function confirmarFecharGrupos() {
  const r = await mutar(E => fecharFaseDeGrupos(E), { rot: 'Fechar fase de grupos', perguntar: false });
  if (r && r.ok) { fecharModal(S.modais.find(m => m.dataset.kind === 'fecharGrupos')); S.aba = 'mata'; S.animar = true; render(); avisar('Mata-mata sorteado!'); }
}

/* ═════════ CONFIGURAÇÃO ═════════ */
function abrirConfig() {
  if (!S.admin) return;
  const E = S.E;
  S.cfgDraft = { titulo: E.titulo, subtitulo: E.subtitulo, logo: E.logo || '🏆', cfg: clone(E.cfg) };
  abrirModal(htmlConfig(), { kind: 'config', foco: false });
}
function estruturalMudou(d) {
  const a = S.E.cfg, b = d.cfg;
  return a.formato !== b.formato || (b.formato === 'grupos' && (a.nGrupos !== b.nGrupos || a.classificam !== b.classificam));
}
function resumoCfg(d) {
  const c = d.cfg, T = S.E.times.length;
  if (!T) return 'Depois de adicionar os times, aqui aparece o resumo do formato.';
  if (c.formato === 'pontos') return `${T} times, todos no mesmo grupo. Cotas e cartões definem quem lidera; você encerra a temporada quando quiser.`;
  if (c.formato === 'mata') { const N = nextPow2(Math.max(T, 2)); return `${T} times em chave de ${N} vagas${N > T ? ` (${N - T} folga${N - T > 1 ? 's' : ''} para os cabeças de chave)` : ''}: ${nomeRodadaMata(0, log2(N))} até a final.`; }
  const q = c.nGrupos * c.classificam, N = nextPow2(Math.max(q, 2));
  const tam = Math.floor(T / c.nGrupos), extra = T % c.nGrupos;
  return `${c.nGrupos} grupo${c.nGrupos > 1 ? 's' : ''} de ${tam}${extra ? ` ou ${tam + 1}` : ''} times, por cotas e cartões. Classificam ${c.classificam} por grupo (${q}) → ${nomeRodadaMata(0, log2(N))}${N > q ? ` (${N - q} folga${N - q > 1 ? 's' : ''})` : ''} quando você fechar a fase de grupos.`;
}
function htmlConfig() {
  const d = S.cfgDraft, c = d.cfg, T = S.E.times.length;
  const fmt = (k, n, desc) => `<button class="cx-opt ${c.formato === k ? 'on' : ''}" data-cx="cfgFormato" data-f="${k}"><span class="dot"></span><div><b>${n}</b><span>${desc}</span></div></button>`;
  const stepper = (k, min, max) => `<div class="cx-step2"><button data-cx="cfgStep" data-k="${k}" data-d="-1" aria-label="Diminuir">−</button><output>${c[k]}</output><button data-cx="cfgStep" data-k="${k}" data-d="1" aria-label="Aumentar">+</button></div>`;
  const tog = (k, nome, desc) => `<button type="button" class="cx-tog ${c[k] === true || c[k] === 2 ? 'on' : ''}" data-cx="cfgTog" data-k="${k}" style="background:none;border:0;color:inherit;font:inherit;text-align:left;width:100%"><span class="sw"></span><span><b>${nome}</b><span class="d">${desc}</span></span></button>`;
  const estr = estruturalMudou(d) && temEstrutura(S.E);
  const erros = T ? validarCfg({ ...S.E, cfg: c }) : [];
  const corpo = `<div class="cx-f"><label for="cx-c-titulo">Nome da copa</label><input class="cx-in" id="cx-c-titulo" maxlength="60" value="${esc(d.titulo)}" data-cxi="cfgTexto" data-k="titulo"></div>
    <div class="cx-row"><div class="cx-f"><label for="cx-c-sub">Subtítulo</label><input class="cx-in" id="cx-c-sub" maxlength="60" value="${esc(d.subtitulo)}" data-cxi="cfgTexto" data-k="subtitulo"></div>
    <div class="cx-f"><label for="cx-c-logo">Ícone (emoji ou imagem)</label><div class="cx-photo"><input class="cx-in" id="cx-c-logo" maxlength="300" value="${esc(d.logo)}" data-cxi="cfgTexto" data-k="logo" placeholder="🏆"><button class="cx-btn sm" type="button" data-cx="upload" data-alvo="cx-c-logo" data-pasta="copa-logos">${ico('upload')}</button></div></div></div>
    <div class="cx-lbl" style="margin-bottom:8px">Formato</div><div class="cx-opts">${fmt('grupos', 'Fase de grupos + mata-mata', 'Estilo Copa do Mundo: grupos, depois eliminatórias até a final.')}${fmt('mata', 'Mata-mata direto', 'Chave eliminatória desde o começo (com folga se o número de times não for potência de 2).')}${fmt('pontos', 'Pontos corridos', 'Estilo Brasileirão: todos contra todos, o líder é o campeão.')}</div>
    ${c.formato === 'grupos' ? `<div class="cx-row"><div class="cx-f"><label>Quantidade de grupos</label>${stepper('nGrupos')}</div><div class="cx-f"><label>Classificam por grupo</label>${stepper('classificam')}</div></div>` : ''}
    ${c.formato !== 'pontos' ? tog('terceiro', 'Disputa de 3º lugar', 'Os perdedores das semifinais jogam entre si.') : ''}
    <div class="cx-prev" style="margin-bottom:0"><div class="cx-hint" style="color:var(--cx-text)" id="cx-cfg-res">${esc(resumoCfg(d))}</div></div>
    ${erros.length ? `<div class="cx-warn" style="margin-top:14px">${ico('alert')}<div>${esc(erros[0])}</div></div>` : ''}
    ${estr ? `<div class="cx-warn bad" style="margin-top:14px">${ico('alert')}<div>Mudar o formato ou os grupos <b>refaz o sorteio</b> (volta pra fase de times/cotas). Os times continuam na copa, com as cotas e cartões que já tiverem.</div></div>` : ''}`;
  return moldura({ titulo: 'Configurar copa', sub: 'Formato e regras', corpo, rodape: `<button class="cx-btn ghost" data-cx="fechar">Cancelar</button><span class="sp"></span><button class="cx-btn pri" data-cx="cfgSalvar">Salvar</button>`, cls: '' });
}
function repintarConfig() {
  const ovl = S.modais.find(m => m.dataset.kind === 'config'); if (!ovl) return;
  const mb = $('.cx-mb', ovl), y = mb ? mb.scrollTop : 0;
  ovl.innerHTML = htmlConfig();
  const nb = $('.cx-mb', ovl); if (nb) nb.scrollTop = y;
}
async function salvarConfig() {
  const d = S.cfgDraft, E0 = S.E;
  const titulo = d.titulo.trim() || 'Copa GR';
  const estr = estruturalMudou(d) && temEstrutura(E0);
  if (estr) {
    const tem = E0.jogos.some(temResultado);
    if (!await confirmar({ titulo: 'Refazer o sorteio?', msg: tem ? 'O sorteio será desfeito e todos os jogos e resultados serão apagados.' : 'O sorteio será desfeito e você precisará sortear de novo.', ok: 'Refazer', perigo: true })) return;
  }
  const r = await mutar(E => {
    E.titulo = titulo; E.subtitulo = d.subtitulo.trim(); E.logo = d.logo.trim() || '🏆';
    const terceiroAntes = E.cfg.terceiro;
    E.cfg = clone(d.cfg);
    if (E.cfg.formato === 'pontos') E.cfg.nGrupos = 1;
    if (estr) reiniciarSorteio(E);
    else if (temEstrutura(E) && terceiroAntes !== E.cfg.terceiro) alternarTerceiro(E, E.cfg.terceiro);
  }, { rot: 'Configuração', perguntar: false });
  if (r && r.ok) { fecharModal(S.modais.find(m => m.dataset.kind === 'config')); S.aba = abasDaCopa().find(a => a[0] === S.aba) ? S.aba : abasDaCopa()[0][0]; render(); }
}

/* ═════════ SORTEIO ═════════ */
function abrirSorteio() {
  if (!S.admin) return;
  const E = S.E, f = E.cfg.formato;
  if (f === 'pontos') return iniciarPontos();
  const erros = validarCfg(E);
  if (erros.length) { avisar(erros[0], 'err'); return abrirConfig(); }
  const rodar = async () => {
    S.sorteio = f === 'grupos' ? { tipo: 'g', grupos: sortearGrupos(E.times, E.cfg.nGrupos) } : { tipo: 'm', seeds: sortearSeeds(E.times) };
    abrirModal(htmlSorteio(), { kind: 'sorteio', foco: false });
  };
  if (temEstrutura(E) && E.jogos.some(temResultado)) {
    confirmar({ titulo: 'Refazer o sorteio?', msg: 'Todos os jogos e resultados atuais serão apagados.', ok: 'Refazer', perigo: true }).then(ok => { if (ok) rodar(); });
  } else rodar();
}
function htmlSorteio() {
  const E = S.E, s = S.sorteio;
  let corpo, sub;
  if (s.tipo === 'g') {
    sub = `${E.cfg.nGrupos} grupos`;
    corpo = `<p class="cx-hint" style="margin:0 0 14px">Cabeças de chave (★) ficam em grupos diferentes. Se quiser trocar alguém de grupo, use o seletor ao lado do nome.</p><div class="cx-draw">${s.grupos.map((g, gi) => `<div class="cx-dg" style="--gc:${corGrupo(gi)}"><h5><span class="cx-gbadge">${esc(g.id)}</span>Grupo ${esc(g.id)}<span class="cx-hint" style="margin-left:auto">${g.ids.length}</span></h5><ul>${g.ids.map((id, i) => { const t = timePorId(id); return `<li style="--i:${gi * 4 + i}">${escudo(t)}<span>${t.cab ? '★ ' : ''}${esc(t.n)}</span><select aria-label="Mover ${esc(t.n)} de grupo" data-cxi="sortMove" data-id="${esc(id)}">${s.grupos.map(x => `<option ${x.id === g.id ? 'selected' : ''}>${esc(x.id)}</option>`).join('')}</select></li>`; }).join('')}</ul></div>`).join('')}</div>`;
  } else {
    const T = s.seeds.length, N = nextPow2(Math.max(T, 2));
    sub = 'Chaveamento';
    corpo = `<p class="cx-hint" style="margin:0 0 14px">A ordem abaixo é a posição na chave (1 = cabeça de chave). ${N > T ? `Com ${T} times numa chave de ${N}, os ${N - T} primeiros ganham folga na 1ª rodada.` : ''} Use as setas para ajustar.</p><ol class="cx-seeds">${s.seeds.map((id, i) => { const t = timePorId(id); return `<li style="--i:${i}"><span class="n">${i + 1}</span>${escudo(t)}<span class="t">${t.cab ? '★ ' : ''}${esc(t.n)}</span>${i < N - T ? '<span class="cx-tag">Folga</span>' : ''}<button class="cx-ib" data-cx="seedMove" data-i="${i}" data-d="-1" ${i === 0 ? 'disabled style="opacity:.3"' : ''} aria-label="Subir">${ico('up')}</button><button class="cx-ib" data-cx="seedMove" data-i="${i}" data-d="1" ${i === s.seeds.length - 1 ? 'disabled style="opacity:.3"' : ''} aria-label="Descer">${ico('down')}</button></li>`; }).join('')}</ol>`;
  }
  return moldura({ titulo: 'Sorteio', sub, corpo, cls: 'wide', rodape: `<button class="cx-btn ghost" data-cx="fechar">Cancelar</button><button class="cx-btn" data-cx="sorteioDeNovo">${ico('shuffle')}Sortear de novo</button><span class="sp"></span><button class="cx-btn pri" data-cx="sorteioOk">${ico('check')}Confirmar</button>` });
}
function repintarSorteio() { const ovl = S.modais.find(m => m.dataset.kind === 'sorteio'); if (ovl) ovl.innerHTML = htmlSorteio(); }
async function confirmarSorteio() {
  const E = S.E, s = S.sorteio;
  if (s.tipo === 'g') {
    const min = Math.max(2, E.cfg.classificam), ruim = s.grupos.find(g => g.ids.length < min);
    if (ruim) return avisar(`O Grupo ${ruim.id} ficou com ${ruim.ids.length} time(s). Cada grupo precisa de pelo menos ${min}.`, 'err');
  }
  const r = await mutar(X => { if (s.tipo === 'g') aplicarSorteioGrupos(X, s.grupos); else aplicarSeeds(X, s.seeds); }, { rot: 'Sorteio', perguntar: false });
  if (r && r.ok) { fecharModal(S.modais.find(m => m.dataset.kind === 'sorteio')); S.aba = s.tipo === 'g' ? 'grupos' : 'mata'; S.animar = true; render(); avisar('Sorteio confirmado!'); }
}
async function iniciarPontos() {
  if (S.E.times.length < 2) return avisar('Adicione pelo menos 2 times.', 'err');
  const r = await mutar(X => aplicarPontosCorridos(X), { rot: 'Iniciar campeonato', perguntar: false });
  if (r && r.ok) { S.aba = 'grupos'; S.animar = true; render(); }
}

/* ═════════ TEMA ═════════ */
function abrirTema() {
  if (!S.admin) return;
  fecharTema();
  const d = document.createElement('aside'); d.className = 'cx-drawer'; d.setAttribute('aria-label', 'Tema'); d.innerHTML = htmlTema();
  S.camada.appendChild(d);
}
function fecharTema() { const d = $('.cx-drawer', S.camada); if (d) d.remove(); }
function htmlTema() {
  const T = resolverTema(S.E.tema), c = coresEfetivas(T);
  const nomes = { bg: 'Fundo', surf: 'Cartões', text: 'Texto', accent: 'Destaque', accent2: 'Destaque 2' };
  const presets = Object.entries(PRESETS).map(([k, p]) => {
    const cor = p.follow ? coresDoPortal() : p;
    return `<button class="cx-preset ${T.preset === k ? 'on' : ''}" data-cx="temaPreset" data-k="${k}"><div class="sw"><i style="background:${cor.bg}"></i><i style="background:${cor.surf}"></i><i style="background:${cor.accent}"></i><i style="background:${cor.accent2}"></i></div><span>${esc(p.n)}</span></button>`;
  }).join('');
  const cores = T.preset === 'portal' ? '<p class="cx-hint">Este tema usa as cores do próprio Portal (claro/escuro). Para escolher cores livres, selecione outro tema ou mexa em uma cor abaixo.</p>' : '';
  const seg = (k, opts, atual) => `<div class="cx-seg">${Object.entries(opts).map(([v, n]) => `<button class="${atual === v ? 'on' : ''}" data-cx="temaSeg" data-k="${k}" data-v="${v}">${typeof n === 'string' ? n : n.n}</button>`).join('')}</div>`;
  return `<div class="cx-mh"><div style="flex:1"><small>Personalizar</small><h3>Tema da copa</h3></div><button class="cx-ib" data-cx="temaFechar" aria-label="Fechar">${ico('x')}</button></div>
    <div class="cx-mb"><div class="cx-lbl" style="margin-bottom:8px">Modelos</div><div class="cx-presets">${presets}</div>
    <div class="cx-lbl" style="margin:18px 0 10px">Cores</div>${cores}<div class="cx-colors">${CORES_CHAVES.map(k => `<div class="cx-cf"><div style="flex:none"><label>${nomes[k]}</label><input class="cx-col" type="color" data-cxi="temaCor" data-k="${k}" value="${esc(c[k])}"></div><input class="cx-in" data-cxi="temaHex" data-k="${k}" value="${esc(c[k])}" maxlength="7" aria-label="${nomes[k]} em hexadecimal" style="margin-top:18px"></div>`).join('')}</div>
    <div class="cx-f" style="margin-top:18px"><label>Fundo</label>${seg('fundo', FUNDOS, T.fundo)}</div>
    <div class="cx-f"><label>Fonte</label>${seg('fonte', FONTES, T.fonte)}</div>
    <div class="cx-f"><label>Cantos arredondados · <span id="cx-v-radius">${T.radius}px</span></label><input class="cx-range" type="range" min="0" max="24" step="1" value="${T.radius}" data-cxi="temaRange" data-k="radius"></div>
    <div class="cx-f"><label>Brilho dos efeitos · <span id="cx-v-glow">${T.glow}%</span></label><input class="cx-range" type="range" min="0" max="140" step="5" value="${T.glow}" data-cxi="temaRange" data-k="glow"></div>
    <button type="button" class="cx-tog ${T.fx ? 'on' : ''}" data-cx="temaFx" style="background:none;border:0;color:inherit;font:inherit;text-align:left;width:100%"><span class="sw"></span><span><b>Animações</b><span class="d">Transições, brilho e confete. Desligue se preferir tudo parado.</span></span></button>
    <button class="cx-btn blk" style="margin-top:14px" data-cx="temaPadrao">${ico('undo')}Restaurar padrão</button></div>
    <div class="cx-mf"><span class="cx-hint" style="flex:1">As mudanças são salvas sozinhas e todo mundo vê o mesmo tema.</span><button class="cx-btn pri" data-cx="temaFechar">Pronto</button></div>`;
}
function repintarTema() { const d = $('.cx-drawer', S.camada); if (!d) return; const mb = $('.cx-mb', d), y = mb ? mb.scrollTop : 0; d.innerHTML = htmlTema(); const nb = $('.cx-mb', d); if (nb) nb.scrollTop = y; }
// muda o tema sem redesenhar a tela toda (arrastar cor/controle deslizante precisa ser fluido)
function alterarTema(fn, redesenhar) {
  mutar(E => { const T = resolverTema(E.tema); fn(T); E.tema = T; }, { render: false, coal: 'tema', rot: 'Tema', perguntar: false, silencioso: true }).then(() => {
    aplicarTemaAtual();
    if (redesenhar) repintarTema();
  });
}

/* ═════════ COPAS, MENU, CAMPEÃ ═════════ */
function abrirCopas() {
  const item = c => `<div class="cx-copa ${c.id === S.id ? 'on' : ''}"><div class="i"><b>${esc(c.titulo)}</b><small>${c.ativo ? 'Vigente' : 'Arquivada'} · atualizada ${esc(dataCurta(c.atualizado_em) || '—')}</small></div>${c.id === S.id ? '<span class="cx-tag">Aberta</span>' : `<button class="cx-btn sm" data-cx="abrirCopa" data-id="${esc(c.id)}">Abrir</button>`}${S.admin && !c.ativo ? `<button class="cx-btn sm ghost" data-cx="tornarAtiva" data-id="${esc(c.id)}">Tornar vigente</button>` : ''}${S.admin ? `<button class="cx-ib" data-cx="excluirCopa" data-id="${esc(c.id)}" aria-label="Excluir" title="Excluir">${ico('trash')}</button>` : ''}</div>`;
  abrirModal(moldura({ titulo: 'Copas', sub: 'Vigente e anteriores', corpo: `<div class="cx-copas">${S.lista.map(item).join('') || '<p class="cx-hint">Nenhuma copa criada.</p>'}</div>`, rodape: `<button class="cx-btn ghost" data-cx="fechar">Fechar</button>${S.admin ? `<span class="sp"></span><button class="cx-btn pri" data-cx="novaCopa">${ico('plus')}Nova copa</button>` : ''}` }), { kind: 'copas', foco: false });
}
function abrirMais() {
  const E = S.E, V = S.V, f = E.cfg.formato;
  const it = (a, i, t, d, cls) => `<button class="${cls || ''}" data-cx="${a}">${ico(i)}<span>${t}${d ? `<small>${d}</small>` : ''}</span></button>`;
  const itens = [
    it('copas', 'layers', 'Copas', 'Abrir outra copa ou criar uma nova'),
    !S.meta.ativo ? it('tornarAtivaAtual', 'star', 'Tornar esta a copa vigente', 'É a que aparece para todo mundo') : '',
    V.campeao ? it('historico', 'book', 'Registrar campeã no histórico', 'Adiciona em "Campeões por edição"') : '',
    E.gruposFechados ? it('reabrirGrupos', 'undo', f === 'pontos' ? 'Reabrir temporada' : 'Reabrir fase de grupos', f === 'pontos' ? 'Tira a campeã, volta a aceitar cotas/cartões' : 'Apaga o mata-mata sorteado; cotas e grupos continuam') : '',
    E.jogos.length ? it('zerar', 'refresh', 'Zerar resultados do mata-mata', 'Mantém o chaveamento, limpa os placares') : '',
    temEstrutura(E) ? it('resetSorteio', 'shuffle', f === 'pontos' ? 'Reiniciar temporada' : 'Refazer sorteio', 'Apaga tudo isso e volta pra fase de times') : '',
    it('excluirAtual', 'trash', 'Excluir esta copa', 'Não dá para desfazer', 'bad'),
  ].filter(Boolean).join('');
  abrirModal(moldura({ titulo: 'Mais opções', cls: 'sm', corpo: `<div class="cx-menu">${itens}</div>` }), { kind: 'mais', foco: false });
}
function modalCampea() {
  const t = S.V && S.V.campeao && timePorId(S.V.campeao);
  if (!t) return;
  const cores = ['#f0c75a', '#ffffff', c0(), c1_()], conf = Array.from({ length: 70 }, () => `<i style="--x:${Math.random() * 100}%;--c:${cores[Math.floor(Math.random() * cores.length)]};--t:${(2.6 + Math.random() * 2.4).toFixed(2)}s;--d:${(Math.random() * 3).toFixed(2)}s;--r:${Math.round(180 + Math.random() * 540)}deg"></i>`).join('');
  function c0() { return safeColor(t.c[0], '#d4a847'); }
  function c1_() { return safeColor(t.c[1], '#ffffff'); }
  abrirModal(`<div class="cx-modal sm"><div class="cx-win"><div class="cx-conf">${conf}</div>${escudo(t)}<small>${S.E.cfg.formato === 'pontos' ? 'Campeã do campeonato' : 'Campeã da copa'}</small><h3>${esc(t.n)}</h3><p>${esc(S.E.titulo)}</p><div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;position:relative"><button class="cx-btn" data-cx="fechar">Fechar</button>${S.admin ? `<button class="cx-btn pri" data-cx="historico">${ico('book')}Registrar no histórico</button>` : ''}</div></div></div>`, { kind: 'campea', foco: false });
}
async function registrarHistorico() {
  const t = S.V.campeao && timePorId(S.V.campeao); if (!t) return;
  if (typeof sb === 'undefined') return avisar('Indisponível neste ambiente.', 'err');
  const ano = (String(S.E.subtitulo).match(/(20\d{2})/) || [])[1] ? +String(S.E.subtitulo).match(/(20\d{2})/)[1] : new Date().getFullYear();
  if (typeof allCopaEdicoes !== 'undefined' && allCopaEdicoes.some(e => (e.tipo || 'copa') === 'copa' && e.ano === ano && e.equipe_campea === t.n && e.titulo === S.E.titulo)) return avisar('Esta campeã já está no histórico.', 'err');
  if (!await confirmar({ titulo: 'Registrar no histórico', msg: `Adicionar "${t.n}" em "Campeões por edição" (${ano})?`, ok: 'Registrar' })) return;
  const { error } = await sb.from('portal_copa_edicoes').insert({ ano, titulo: S.E.titulo, equipe_campea: t.n, tipo: 'copa', ordem: 0, descricao: S.E.subtitulo || null });
  if (error) return avisar('Não foi possível registrar: ' + error.message, 'err');
  avisar('Campeã registrada no histórico.');
  try { const r = await sb.from('portal_copa_edicoes').select('*').order('ano', { ascending: false }); if (r.data && typeof allCopaEdicoes !== 'undefined') { allCopaEdicoes.length = 0; r.data.forEach(x => allCopaEdicoes.push(x)); } if (typeof renderCopaTimeline === 'function') renderCopaTimeline(); } catch (e) { /* atualizar a lista é opcional */ }
}

/* ═══════════════════════════════════════════════════════════════════════
   AÇÕES, EVENTOS, TEMPO REAL E ENTRADA (montar)
   ═══════════════════════════════════════════════════════════════════════ */
const jogoAtual = () => (S.jogoAberto ? jogoPorId(S.jogoAberto.id) : null);
const ehAdminAgora = () => (typeof isAdmin === 'function' ? !!isAdmin() : !!window.__cxAdmin);

const ACOES = {
  aba(el) { S.aba = el.dataset.a; S.animar = true; render(); },
  jogo(el) {
    const cont = el.closest('[data-ctx]');
    const ids = cont ? $$('[data-cx="jogo"]', cont).map(x => x.dataset.id) : [el.dataset.id];
    abrirJogo(el.dataset.id, ids);
  },
  filtro(el) { S.filtro = el.dataset.f; render(); },
  addTimes: () => abrirPicker(),
  sorteio: () => abrirSorteio(),
  iniciarPontos: () => iniciarPontos(),
  config: () => abrirConfig(),
  tema: () => abrirTema(),
  desfazer: () => desfazer(),
  mais: () => abrirMais(),
  copas: () => abrirCopas(),
  novaCopa: () => abrirNovaCopa(),
  recarregar: () => montar(),
  historico: () => registrarHistorico(),
  celebrar: () => modalCampea(),
  editTime(el) { abrirEditTime(el.dataset.id); },
  fechar(el) { fecharModal(el.closest('.cx-ovl')); },
  'conf-sim'(el) { const o = el.closest('.cx-ovl'); if (o && o._sim) o._sim(); },
  'conf-nao'(el) { const o = el.closest('.cx-ovl'); if (o && o._nao) o._nao(); },

  /* jogo */
  async gol(el) {
    const id = S.jogoAberto.id, l = el.dataset.l, d = +el.dataset.d, j = jogoPorId(id);
    if (!j) return;
    const cur = isNum(l === 'a' ? j.ga : j.gb) ? (l === 'a' ? j.ga : j.gb) : 0;
    const patch = l === 'a' ? { ga: Math.max(0, cur + d) } : { gb: Math.max(0, cur + d) };
    if (j.st === 'ag') { patch.st = 'vivo'; if (l === 'a') patch.gb = 0; else patch.ga = 0; }
    S.jogoAberto.bump = d > 0 ? l : ''; S.pulse.add(id);
    const r = await mutar(E => definirJogo(E, id, patch), { coal: 'placar:' + id, rot: 'Placar' });
    if (r && r.reaberto) avisar('Jogo reaberto: informe os pênaltis para encerrar de novo.');
  },
  async jogoSt(el) {
    const id = S.jogoAberto.id, st = el.dataset.st;
    S.pulse.add(id);
    const r = await mutar(E => definirJogo(E, id, { st }), { rot: st === 'vivo' ? 'Iniciar jogo' : st === 'fim' ? 'Encerrar jogo' : 'Zerar jogo' });
    if (r && r.ok && st === 'fim') avisar('Jogo encerrado.');
  },
  jogoNav(el) {
    const { ids, id } = S.jogoAberto, i = ids.indexOf(id) + (+el.dataset.d);
    if (i >= 0 && i < ids.length) { S.jogoAberto.id = ids[i]; atualizarJogoAberto(); }
  },

  /* times */
  pickModo(el) { S.picker.modo = el.dataset.m; repintarPicker(); },
  pickSerie(el) { S.picker.serie = el.dataset.s; $$('.cx-chip[data-cx="pickSerie"]').forEach(b => b.classList.toggle('on', b === el)); renderCatalogo(); },
  pickTodos() { catalogoFiltrado().forEach(({ c, i }) => { if (!jaTem(c.n)) S.picker.sel.add(i); }); renderCatalogo(); },
  pickLimpar() { S.picker.sel.clear(); renderCatalogo(); },
  pickCat(el) { const i = +el.dataset.i; if (S.picker.sel.has(i)) S.picker.sel.delete(i); else S.picker.sel.add(i); el.classList.toggle('on', S.picker.sel.has(i)); atualizarBotaoPicker(); },
  pickAdd: () => confirmarPicker(),
  togCab(el) { el.classList.toggle('on'); },
  saveTime(el) { salvarTime(el.dataset.id); },
  delTime(el) { excluirTime(el.dataset.id); },
  upload(el) { subirParaCampo(el.dataset.alvo, el.dataset.pasta, el); },

  /* configuração */
  cfgFormato(el) {
    const d = S.cfgDraft, f = el.dataset.f, T = S.E.times.length;
    d.cfg.formato = f;
    if (f === 'pontos') d.cfg.nGrupos = 1;
    if (f === 'grupos') { d.cfg.nGrupos = T >= 4 ? sugerirGrupos(T) : (d.cfg.nGrupos > 1 ? d.cfg.nGrupos : 4); d.cfg.classificam = clamp(d.cfg.classificam, 1, T ? Math.max(1, tamanhoMinGrupo(T, d.cfg.nGrupos)) : 8); }
    repintarConfig();
  },
  cfgStep(el) {
    const c = S.cfgDraft.cfg, k = el.dataset.k, d = +el.dataset.d, T = S.E.times.length;
    if (k === 'nGrupos') { c.nGrupos = clamp(c.nGrupos + d, 1, T ? Math.max(1, Math.floor(T / 2)) : 16); if (T) c.classificam = clamp(c.classificam, 1, Math.max(1, tamanhoMinGrupo(T, c.nGrupos))); }
    else c.classificam = clamp(c.classificam + d, 1, T ? Math.max(1, tamanhoMinGrupo(T, c.nGrupos)) : 8);
    repintarConfig();
  },
  cfgTog(el) { const c = S.cfgDraft.cfg, k = el.dataset.k; c[k] = !c[k]; repintarConfig(); },
  cfgSalvar: () => salvarConfig(),

  /* sorteio */
  sorteioDeNovo() { const E = S.E; S.sorteio = S.sorteio.tipo === 'g' ? { tipo: 'g', grupos: sortearGrupos(E.times, E.cfg.nGrupos) } : { tipo: 'm', seeds: sortearSeeds(E.times) }; repintarSorteio(); },
  sorteioOk: () => confirmarSorteio(),
  seedMove(el) {
    const i = +el.dataset.i, j = i + (+el.dataset.d), a = S.sorteio.seeds;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]]; repintarSorteio();
  },

  /* fase de grupos: cotas, cartões, mover de grupo, fechar/reabrir */
  editCotas(el) { abrirEditarCotas(el.dataset.id); },
  cotCartaoAm(el) {
    const id = S.cotasAlvo; if (!id) return;
    mutar(E => ajustarCartaoAmarelo(E, id, +el.dataset.d), { rot: 'Cartão amarelo', coal: 'am:' + id, perguntar: false }).then(() => repintarEditarCotas());
  },
  cotCartaoVerm() {
    const id = S.cotasAlvo; if (!id) return;
    mutar(E => alternarCartaoVermelho(E, id), { rot: 'Cartão vermelho', perguntar: false }).then(() => repintarEditarCotas());
  },
  fecharGrupos: () => abrirFecharGrupos(),
  fecharGruposOk: () => confirmarFecharGrupos(),
  reabrirGrupos() {
    fecharModal(S.modais.find(m => m.dataset.kind === 'mais'));
    confirmar({ titulo: S.E.cfg.formato === 'pontos' ? 'Reabrir temporada?' : 'Reabrir fase de grupos?', msg: S.E.cfg.formato === 'pontos' ? 'Volta a aceitar ajustes de cotas/cartões sem campeã definida. Você encerra de novo quando quiser.' : 'O mata-mata já sorteado é apagado. Cotas, cartões e os grupos continuam como estão.', ok: 'Reabrir', perigo: true })
      .then(ok => { if (ok) mutar(E => reabrirFaseDeGrupos(E), { rot: 'Reabrir fase de grupos', perguntar: false }); });
  },

  /* tema */
  temaPreset(el) { const k = el.dataset.k; alterarTema(T => { T.preset = k; const c = coresDoPreset(k); if (c) T.cores = c; }, true); },
  temaSeg(el) { const k = el.dataset.k, v = el.dataset.v; alterarTema(T => { T[k] = v; }, true); },
  temaFx() { alterarTema(T => { T.fx = !T.fx; }, true); },
  temaPadrao() { mutar(E => { E.tema = clone(TEMA_PADRAO); }, { render: false, rot: 'Tema', perguntar: false }).then(() => { aplicarTemaAtual(); repintarTema(); }); },
  temaFechar: () => fecharTema(),

  /* copas */
  async abrirCopa(el) {
    try { await abrirCopa(el.dataset.id); fecharModal(S.modais.find(m => m.dataset.kind === 'copas')); render(); assinar(); }
    catch (e) { avisar(e.message, 'err'); }
  },
  async tornarAtiva(el) { await tornarAtiva(el.dataset.id); },
  tornarAtivaAtual: async () => { fecharModal(S.modais.find(m => m.dataset.kind === 'mais')); await tornarAtiva(S.id); },
  async excluirCopa(el) { await excluirCopa(el.dataset.id); },
  async zerar() {
    fecharModal(S.modais.find(m => m.dataset.kind === 'mais'));
    if (!await confirmar({ titulo: 'Zerar resultados', msg: 'Todos os placares voltam para "agendado". Times e sorteio continuam.', ok: 'Zerar', perigo: true })) return;
    await mutar(E => zerarResultados(E), { rot: 'Zerar resultados', perguntar: false });
  },
  async resetSorteio() {
    fecharModal(S.modais.find(m => m.dataset.kind === 'mais'));
    if (!await confirmar({ titulo: S.E.cfg.formato === 'pontos' ? 'Reiniciar campeonato' : 'Refazer sorteio', msg: 'O sorteio e todos os jogos e resultados serão apagados. Os times continuam na copa.', ok: 'Apagar e refazer', perigo: true })) return;
    const r = await mutar(E => reiniciarSorteio(E), { rot: 'Refazer sorteio', perguntar: false });
    if (r && r.ok) { S.aba = 'times'; S.animar = true; render(); }
  },
  async excluirAtual() {
    fecharModal(S.modais.find(m => m.dataset.kind === 'mais'));
    await excluirCopa(S.id);
  },
};

async function atualizarLista() {
  try {
    S.lista = await storeAtual().listar();
    const m = S.lista.find(c => c.id === S.id);
    if (m && S.meta) S.meta.ativo = m.ativo;
    const aberto = S.modais.find(x => x.dataset.kind === 'copas');
    if (aberto) { fecharModal(aberto); abrirCopas(); }
    if (S.raiz) render();
  } catch (e) { /* lista é secundária */ }
}
async function tornarAtiva(id) {
  try { await storeAtual().definirAtivo(id); await atualizarLista(); avisar('Copa vigente atualizada: todo mundo passa a ver esta.'); }
  catch (e) { avisar(e.message, 'err'); }
}
async function excluirCopa(id) {
  const c = S.lista.find(x => x.id === id);
  if (!await confirmar({ titulo: 'Excluir copa', msg: `Excluir "${c ? c.titulo : 'esta copa'}" com todos os times, jogos e resultados? Não dá para desfazer.`, ok: 'Excluir', perigo: true })) return;
  try {
    await storeAtual().excluir(id);
    fecharModal(S.modais.find(m => m.dataset.kind === 'copas'));
    if (id === S.id) await montar(); else await atualizarLista();
    avisar('Copa excluída.');
  } catch (e) { avisar(e.message, 'err'); }
}
function abrirNovaCopa() {
  fecharModal(S.modais.find(m => m.dataset.kind === 'copas'));
  const ovl = abrirModal(moldura({ titulo: 'Nova copa', cls: 'sm', corpo: `<div class="cx-f"><label for="cx-nc">Nome da copa</label><input class="cx-in" id="cx-nc" maxlength="60" value="Copa GR ${new Date().getFullYear()}" autocomplete="off"></div><p class="cx-hint">Você escolhe times, formato e tema logo em seguida. A copa só aparece para os colaboradores quando for a vigente${S.lista.some(c => c.ativo) ? ' (hoje já existe uma vigente: a nova fica como rascunho até você trocar)' : ''}.</p>`, rodape: `<button class="cx-btn ghost" data-cx="fechar">Cancelar</button><button class="cx-btn pri" data-cx="criarCopa">Criar</button>` }), { kind: 'nova' });
  ovl.addEventListener('keydown', e => { if (e.key === 'Enter') ACOES.criarCopa(); });
}
ACOES.criarCopa = async function () {
  const inp = $('#cx-nc'); const nome = (inp ? inp.value : '').trim() || 'Copa GR';
  try {
    const row = await storeAtual().criar(nome, novoEstado(nome), !S.lista.some(c => c.ativo));
    fecharModal(S.modais.find(m => m.dataset.kind === 'nova'));
    S.lista = await storeAtual().listar();
    await abrirCopa(row.id); S.carregando = false; render(); assinar();
    avisar('Copa criada. Comece adicionando os times.');
  } catch (e) { avisar(e.message, 'err'); }
};

/* ---------- entradas de formulário ---------- */
const EIN = { // evento "input" (a cada tecla / arraste)
  pickBusca(el) { S.picker.busca = el.value; renderCatalogo(); },
  pickLista() { atualizarBotaoPicker(); },
  tprev(el) { atualizarPreviaTime(el.dataset.p); },
  cfgTexto(el) { S.cfgDraft[el.dataset.k] = el.value; },
  temaCor(el) {
    const k = el.dataset.k, v = el.value;
    alterarTema(T => { if (T.preset === 'portal') T.cores = { ...coresDoPortal() }; T.cores[k] = v; T.preset = 'custom'; }, false);
    const hex = $(`[data-cxi="temaHex"][data-k="${k}"]`, S.camada); if (hex) hex.value = v;
    $$('.cx-preset.on', S.camada).forEach(p => p.classList.remove('on'));
  },
  temaRange(el) {
    const k = el.dataset.k, v = +el.value;
    alterarTema(T => { T[k] = v; }, false);
    const l = document.getElementById('cx-v-' + k); if (l) l.textContent = v + (k === 'radius' ? 'px' : '%');
  },
  cotasNum(el) {
    const id = S.cotasAlvo; if (!id) return;
    mutar(E => definirCotas(E, id, el.value), { rot: 'Cotas', coal: 'cotas:' + id, perguntar: false });
  },
};
const ECH = { // evento "change" (ao confirmar)
  rodada(el) { S.rodadaSel = el.value; render(); },
  pen(el) {
    const id = S.jogoAberto && S.jogoAberto.id; if (!id) return;
    const l = el.dataset.l, v = el.value === '' ? null : +el.value;
    mutar(E => definirJogo(E, id, l === 'a' ? { pa: v } : { pb: v }), { rot: 'Pênaltis', coal: 'pen:' + id });
  },
  jdt(el) { const id = S.jogoAberto.id; mutar(E => definirJogo(E, id, { dt: el.value }), { rot: 'Data do jogo', perguntar: false }); },
  jloc(el) { const id = S.jogoAberto.id; mutar(E => definirJogo(E, id, { loc: el.value }), { rot: 'Local do jogo', perguntar: false }); },
  sortMove(el) {
    const s = S.sorteio, id = el.dataset.id, dest = s.grupos.find(g => g.id === el.value);
    if (!dest) return;
    s.grupos.forEach(g => { g.ids = g.ids.filter(x => x !== id); });
    dest.ids.push(id); repintarSorteio();
  },
  cotasGrupo(el) {
    const id = S.cotasAlvo; if (!id) return;
    mutar(E => moverTimeDeGrupo(E, id, el.value), { rot: 'Mover de grupo', perguntar: false }).then(r => { if (r && r.ok) repintarEditarCotas(); });
  },
  temaHex(el) {
    const k = el.dataset.k; let v = el.value.trim(); if (v && v[0] !== '#') v = '#' + v;
    if (!isHex(v)) { avisar('Use uma cor no formato #RRGGBB.', 'err'); return repintarTema(); }
    alterarTema(T => { if (T.preset === 'portal') T.cores = { ...coresDoPortal() }; T.cores[k] = v.toLowerCase(); T.preset = 'custom'; }, true);
  },
};

let eventosLigados = false;
function ligarEventos() {
  if (eventosLigados) return; eventosLigados = true;
  const dentro = t => (S.raiz && S.raiz.contains(t)) || (S.camada && S.camada.contains(t));
  document.addEventListener('click', e => {
    const el = e.target.closest && e.target.closest('[data-cx]');
    if (!el || !dentro(el)) return;
    const f = ACOES[el.dataset.cx];
    if (f) { e.preventDefault(); f(el, e); }
  });
  document.addEventListener('input', e => { const el = e.target; if (!el.dataset || !el.dataset.cxi || !dentro(el)) return; const f = EIN[el.dataset.cxi]; if (f) f(el, e); });
  document.addEventListener('change', e => { const el = e.target; if (!el.dataset || !el.dataset.cxi || !dentro(el)) return; const f = ECH[el.dataset.cxi]; if (f) f(el, e); });
  document.addEventListener('keydown', e => {
    if (!S.camada || !S.raiz || !document.body.contains(S.raiz)) return;
    if (e.key === 'Escape') {
      if (S.modais.length) { fecharModal(); e.preventDefault(); }
      else if ($('.cx-drawer', S.camada)) { fecharTema(); e.preventDefault(); }
    } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && S.jogoAberto && S.modais[S.modais.length - 1] && S.modais[S.modais.length - 1].dataset.kind === 'jogo' && !/INPUT|SELECT|TEXTAREA/.test((e.target.tagName || ''))) {
      const b = $(`[data-cx="jogoNav"][data-d="${e.key === 'ArrowLeft' ? -1 : 1}"]`, S.camada); if (b && !b.disabled) b.click();
    }
  });
  // brilho que acompanha o mouse nos cartões
  document.addEventListener('pointermove', e => {
    if (!S.raiz || S.raiz.dataset.fx !== '1') return;
    const c = e.target.closest && e.target.closest('.cx-hov'); if (!c || !S.raiz.contains(c)) return;
    const r = c.getBoundingClientRect(); c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });
  window.addEventListener('resize', () => { clearTimeout(ligarEventos._t); ligarEventos._t = setTimeout(() => { if (S.raiz && S.E) posicionarIndicador(); }, 120); });
  // tema "Igual ao portal" acompanha o claro/escuro do Portal
  new MutationObserver(() => { if (S.E && S.E.tema && S.E.tema.preset === 'portal') aplicarTemaAtual(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

/* ---------- tempo real ---------- */
function marcarPulsos(a, b) {
  const ant = new Map((a ? a.jogos : []).map(j => [j.id, j]));
  (b ? b.jogos : []).forEach(j => { const o = ant.get(j.id); if (o && (o.ga !== j.ga || o.gb !== j.gb || o.st !== j.st)) S.pulse.add(j.id); });
}
function aplicarRemoto(row) {
  const antigo = S.E;
  S.E = migrar(row.estado); S.rev = row.rev;
  if (S.meta) { S.meta.titulo = row.titulo; S.meta.ativo = row.ativo; }
  marcarPulsos(antigo, S.E);
  recomputar(); render(); atualizarJogoAberto(); verCampeao();
}
function assinar() {
  storeAtual().assinar((ev, novo, antigo) => {
    if (!S.raiz) return;
    if (ev === 'DELETE') { if (antigo && antigo.id === S.id) { avisar('Esta copa foi excluída por outra pessoa.', 'err'); montar(); } else atualizarLista(); return; }
    if (!novo || novo.id !== S.id) {
      // outra copa mudou; se virou a vigente e sou só espectador, troca para ela
      if (novo && novo.ativo && !S.admin) montar(); else atualizarLista();
      return;
    }
    if (novo.estado === undefined) { recarregarDoServidor(false); return; }
    if (novo.rev <= S.rev) return; // eco da minha própria gravação
    if (S.salvando || S.salvo === 'sujo') { S.remotoPendente = novo; return; }
    aplicarRemoto(novo);
  });
}

/* ---------- entrada ---------- */
function garantirDom() {
  if (!S.raiz) {
    S.raiz = document.getElementById('cx-root');
    if (!S.raiz) return false;
    if (!$('.cx-inner', S.raiz)) S.raiz.innerHTML = '<div class="cx-bgfx"></div><div class="cx-inner"></div>';
  }
  if (!S.camada || !document.body.contains(S.camada)) {
    S.camada = document.createElement('div'); S.camada.className = 'cx-layer'; S.camada.id = 'cx-layer';
    document.body.appendChild(S.camada);
  }
  ligarEventos();
  return true;
}
async function abrirCopa(id) {
  const row = await storeAtual().abrir(id);
  if (!row) throw new Error('Copa não encontrada.');
  S.id = row.id; S.rev = row.rev; S.meta = { id: row.id, titulo: row.titulo, ativo: row.ativo };
  S.E = migrar(row.estado); S.undo = []; S.salvo = 'ok'; S.coalKey = '';
  recomputar(); S.campeaoVisto = S.V.campeao || null; S.aba = abaPadrao(); S.rodadaSel = null; S.animar = true; S.abertos = {};
}
async function montar() {
  if (!garantirDom()) return;
  S.admin = ehAdminAgora();
  S.carregando = true; S.erro = ''; render();
  try {
    S.lista = await storeAtual().listar();
    const alvo = S.lista.find(c => c.ativo) || (S.admin ? S.lista[0] : null);
    if (alvo) await abrirCopa(alvo.id); else { S.E = null; S.id = null; S.meta = null; S.V = null; }
  } catch (e) { S.erro = e.message || 'Falha ao carregar.'; S.E = null; }
  S.carregando = false; render(); assinar();
}
function sair() {
  clearTimeout(S.tSalvar);
  if (S.admin && S.salvo === 'sujo') salvarAgora(); // não perde a última alteração ao trocar de aba
  try { storeAtual().desassinar(); } catch (e) { /* já solto */ }
  if (S.camada) fecharTodosModais();
}
window.addEventListener('beforeunload', () => { if (S.admin && (S.salvo === 'sujo' || S.salvando)) { try { salvarAgora(); } catch (e) { /* sem chance de esperar */ } } });

window.CX = {
  abrir: montar, sair,
  // ganchos usados só nos testes
  _S: S, _acoes: ACOES, _abrirCopa: abrirCopa, _montar: montar, _render: render, _salvarAgora: salvarAgora,
  _engine: { computarView, definirJogo, sanear, tabelaGrupo, aplicarSorteioGrupos, aplicarSeeds, aplicarPontosCorridos, novoEstado, novoTime, validarCfg, sortearGrupos, sortearSeeds, clone,
    CATALOGO, definirCotas, ajustarCartaoAmarelo, alternarCartaoVermelho, moverTimeDeGrupo, fecharFaseDeGrupos, reabrirFaseDeGrupos, classificadosPorGrupo, expulso, cotasLiquidas, reiniciarSorteio },
};
})();
