// GitHub ile konuşan küçük istemci. Panel içerikleri buradan okur ve kaydeder;
// her kayıt `main` dalına tek bir commit olarak gider, Cloudflare da siteyi yeniden derler.
//
// Gerekenler (Cloudflare → Worker → Ayarlar → Değişkenler):
//   GITHUB_TOKEN  — yalnızca bu depoya "Contents: Read and write" izni olan anahtar (gizli)
//   GITHUB_REPO   — "sahip/depo" (wrangler.jsonc'de)
//   GITHUB_DAL    — yayın dalı, varsayılan "main"
//   GITHUB_API    — yalnızca yerel denemelerde sahte sunucu için

const SAYILAR = 'src/content/sayilar';
const YAZILAR = 'src/content/yazilar';
const EKIP = 'src/data/ekip.json';

export class GithubHatasi extends Error {
  constructor(status, mesaj, ek = {}) {
    super(mesaj);
    this.status = status;
    Object.assign(this, ek);
  }
}

const utf8 = (base64) => new TextDecoder().decode(Uint8Array.from(atob(base64.replace(/\s/g, '')), (c) => c.charCodeAt(0)));

export function github(env, f = fetch) {
  const [sahip, depo] = String(env.GITHUB_REPO || 'kbc0/parantez').split('/');
  const dal = env.GITHUB_DAL || 'main';
  const api = (env.GITHUB_API || 'https://api.github.com').replace(/\/$/, '');
  const kok = `/repos/${sahip}/${depo}`;

  async function istek(yol, { method = 'GET', govde } = {}) {
    const r = await f(api + yol, {
      method,
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'parantez-panel',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(govde ? { 'Content-Type': 'application/json' } : {}),
      },
      body: govde ? JSON.stringify(govde) : undefined,
    });
    if (!r.ok) {
      const metin = await r.text().catch(() => '');
      throw new GithubHatasi(r.status, `GitHub ${r.status}: ${metin.slice(0, 300)}`);
    }
    return r.status === 204 ? null : r.json();
  }

  // Bir dosyanın verilen commit'teki blob sha'sı; dosya yoksa null
  async function blobSha(yol, ref) {
    try {
      const j = await istek(`${kok}/contents/${yol}?ref=${ref}`);
      return Array.isArray(j) ? null : j.sha;
    } catch (e) {
      if (e.status === 404) return null;
      throw e;
    }
  }

  // Tüm içerik tek GraphQL isteğiyle (sayılar, yazılar, ekip). Olmazsa REST'e düşer.
  async function icerikGraphql() {
    const parca = `entries { name oid object { ... on Blob { text } } }`;
    const query = `query($o: String!, $r: String!, $s: String!, $y: String!, $e: String!) {
      repository(owner: $o, name: $r) {
        s: object(expression: $s) { ... on Tree { ${parca} } }
        y: object(expression: $y) { ... on Tree { ${parca} } }
        e: object(expression: $e) { ... on Blob { oid text } }
      }
    }`;
    const j = await istek('/graphql', {
      method: 'POST',
      govde: { query, variables: { o: sahip, r: depo, s: `${dal}:${SAYILAR}`, y: `${dal}:${YAZILAR}`, e: `${dal}:${EKIP}` } },
    });
    if (j.errors?.length || !j.data?.repository) throw new GithubHatasi(502, `GraphQL: ${(j.errors ?? []).map((e) => e.message).join('; ')}`);
    const r = j.data.repository;
    const liste = (t, klasor) => (t?.entries ?? [])
      .filter((e) => e.name.endsWith('.md'))
      .map((e) => ({ yol: `${klasor}/${e.name}`, sha: e.oid, metin: e.object?.text ?? '' }));
    return {
      sayilar: liste(r.s, SAYILAR),
      yazilar: liste(r.y, YAZILAR),
      ekip: r.e ? { yol: EKIP, sha: r.e.oid, metin: r.e.text ?? '[]' } : null,
    };
  }

  return {
    dal,

    // Tüm içerik tek istekte (GraphQL). Olmazsa panel `agac` + `bloblar` ile parça parça okur.
    icerik: icerikGraphql,

    // İçerik dosyalarının listesi ve sürümleri (sha), metinleri olmadan
    async agac() {
      const a = await istek(`${kok}/git/trees/${dal}?recursive=1`);
      return a.tree
        .filter((d) => d.type === 'blob' && ((d.path.startsWith(`${SAYILAR}/`) || d.path.startsWith(`${YAZILAR}/`)) && d.path.endsWith('.md') || d.path === EKIP))
        .map((d) => ({ yol: d.path, sha: d.sha }));
    },

    // Verilen sürümlerin metinleri (Workers'ın istek sınırı yüzünden en fazla 40)
    async bloblar(liste) {
      return Promise.all(liste.slice(0, 40).map(async (d) => {
        const b = await istek(`${kok}/git/blobs/${d.sha}`);
        return { yol: d.yol, sha: d.sha, metin: utf8(b.content) };
      }));
    },

    async dosya(yol) {
      const j = await istek(`${kok}/contents/${yol}?ref=${dal}`);
      return { yol, sha: j.sha, metin: utf8(j.content) };
    },

    // Birden çok dosyayı tek commit'te yazar ya da siler.
    // beklenen: { yol: sha | null } — okur dosyayı açtığından beri biri değiştirdiyse 409 döner.
    async yaz({ mesaj, yazar, dosyalar = [], sil = [], beklenen = {} }) {
      // Görseller önce blob olarak yüklenir (base64 olduğu gibi gider)
      const bloblar = {};
      for (const d of dosyalar.filter((x) => x.base64)) {
        const b = await istek(`${kok}/git/blobs`, { method: 'POST', govde: { content: d.base64, encoding: 'base64' } });
        bloblar[d.yol] = b.sha;
      }

      for (let deneme = 0; deneme < 3; deneme++) {
        const ref = await istek(`${kok}/git/ref/heads/${dal}`);
        const tepe = ref.object.sha;

        for (const [yol, sha] of Object.entries(beklenen)) {
          const simdiki = await blobSha(yol, tepe);
          if (simdiki !== sha) throw new GithubHatasi(409, 'çakışma', { yol, simdiki });
        }

        const commit = await istek(`${kok}/git/commits/${tepe}`);
        const agac = [
          ...dosyalar.map((d) => d.base64
            ? { path: d.yol, mode: '100644', type: 'blob', sha: bloblar[d.yol] }
            : { path: d.yol, mode: '100644', type: 'blob', content: d.metin }),
          ...sil.map((yol) => ({ path: yol, mode: '100644', type: 'blob', sha: null })),
        ];
        const yeniAgac = await istek(`${kok}/git/trees`, { method: 'POST', govde: { base_tree: commit.tree.sha, tree: agac } });
        const yeni = await istek(`${kok}/git/commits`, {
          method: 'POST',
          govde: {
            message: mesaj,
            tree: yeniAgac.sha,
            parents: [tepe],
            ...(yazar ? { author: { name: yazar.ad, email: yazar.eposta, date: new Date().toISOString() } } : {}),
          },
        });
        try {
          await istek(`${kok}/git/refs/heads/${dal}`, { method: 'PATCH', govde: { sha: yeni.sha, force: false } });
          return yeni.sha;
        } catch (e) {
          // Bu sırada başka bir kayıt geldiyse baştan dene
          if (e.status === 422 && deneme < 2) continue;
          throw e;
        }
      }
      throw new GithubHatasi(409, 'kaydedilemedi');
    },
  };
}
