// Testes sem rede para os mapeadores do cliente Cloudflare.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const window = {};
vm.runInNewContext(fs.readFileSync('cloudflare-api-client.js', 'utf8'), {
  window,
  Headers,
  FormData,
  fetch: async () => { throw new Error('fetch não deveria ser chamado neste teste'); }
});

const files = window.EntreLinhasCloudflare.files;
const library = window.EntreLinhasCloudflare.library;
assert.equal(typeof library.listFiles, 'function');
assert.equal(typeof library.attachFile, 'function');
assert.throws(() => library.attachFile('book-1', 'file-1', 'avatar'), /Função do arquivo inválida/);

assert.equal(files.validate({ size: 1024, type: 'application/epub+zip' }, 'epub'), 'epub');
assert.equal(files.validate({ size: 1024, type: 'image/jpeg' }, 'capa'), 'cover');
assert.equal(files.validate({ size: 1024, type: 'application/pdf' }, 'comprovante'), 'receipt');
assert.throws(() => files.validate({ size: 0, type: 'image/png' }, 'avatar'), /Tamanho/);
assert.throws(() => files.validate({ size: 1024, type: 'text/html' }, 'avatar'), /Tipo/);
assert.throws(() => files.validate({ size: 6 * 1024 * 1024, type: 'image/png' }, 'club-photo'), /Tamanho/);
assert.throws(() => files.validate({ size: 1024, type: 'image/png' }, 'categoria-desconhecida'), /categoria/);

const map = window.EntreLinhasCloudflare.mapping;
const appBook = {
  id: 'book-1', onlinePersonalId: 'personal-1', title: 'A Travessia',
  author: 'Autora', genre: 'Fantasia', pages: 320, currentPage: 87, status: 'pending_finish',
  epubCfi: 'epubcfi(/6/4)', cover: 'https://example.invalid/cover.jpg'
};
const api = map.toApiBook(appBook);
assert.equal(api.id, 'personal-1');
assert.equal(api.title, 'A Travessia');
assert.equal(api.current_page, 87);
assert.equal(api.status, 'pending_finish');
assert.equal(api.epub_cfi, 'epubcfi(/6/4)');
const newBook = map.toApiBook({ title: 'Novo', author: 'Pessoa', pages: 100, currentPage: 12, status: 'reading' });
assert.equal(newBook.current_page, 12);
assert.equal(newBook.status, 'reading');

const partialPatch = map.toApiBookPatch({ author: 'Novo nome' });
assert.deepEqual(JSON.parse(JSON.stringify(partialPatch)), { author: 'Novo nome' });
const progressPatch = map.toApiBookPatch({ currentPage: 44, epubCfi: 'epubcfi(/6/8)', status: 'reading' });
assert.deepEqual(JSON.parse(JSON.stringify(progressPatch)), { current_page: 44, epub_cfi: 'epubcfi(/6/8)', status: 'reading' });
assert.deepEqual(JSON.parse(JSON.stringify(map.toApiBookPatch({ pages: 410, cover: '' }))), {
  pages: 410, cover_url: ''
});

const roundTrip = map.fromApiBook({
  id: 'personal-1', usuario_id: 'user-1', livro_id: 'fingerprint-1',
  titulo: 'A Travessia', autor: 'Autora', genero: 'Fantasia',
  paginas: 320, pagina_atual: 87, progresso: 27, epub_cfi: 'epubcfi(/6/4)',
  capa_url: 'https://example.invalid/cover.jpg', status: 'reading',
  dados: JSON.stringify({ fingerprint: 'fingerprint-1', epubFileName: 'travessia.epub' })
});
assert.equal(roundTrip.id, 'personal-1');
assert.equal(roundTrip.title, 'A Travessia');
assert.equal(roundTrip.currentPage, 87);
assert.equal(roundTrip.personalFingerprint, 'fingerprint-1');
assert.equal(roundTrip.epubFileName, 'travessia.epub');

const rewards = window.EntreLinhasCloudflare.rewards;
assert.equal(typeof rewards.awardDailyEpub, 'function');
assert.throws(() => rewards.awardDailyEpub('09/11/2026'), /Data inválida/);
assert.throws(() => rewards.awardDailyEpub('2026-99-99'), /Data inválida/);

const progress = window.EntreLinhasCloudflare.progress;
assert.equal(typeof progress.monthly, 'function');
assert.throws(() => progress.monthly('2026-13'), /Período mensal inválido/);
assert.throws(() => progress.monthly('2026-02-30'), /Período mensal inválido/);

console.log('OK: mapeamento de livro e validação local de arquivos ↔ API');

const admin = window.EntreLinhasCloudflare.admin;
assert.equal(typeof admin.listRequests, 'function');
assert.equal(typeof admin.rejectRequest, 'function');
assert.equal(typeof admin.approveBookFinish, 'function');
assert.equal(typeof admin.approveClubFinish, 'function');
assert.throws(() => admin.approveClubFinish('', 'motivo'), /ID da solicitação obrigatório/);
assert.throws(() => admin.rejectRequest('', 'motivo'), /ID da solicitação obrigatório/);
assert.throws(() => admin.approveBookFinish('', 'motivo'), /ID da solicitação obrigatório/);
