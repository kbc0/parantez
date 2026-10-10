// Sitenin hangi commit'ten derlendiği. Panel, kaydedilen yazının yayına çıkıp
// çıkmadığını bu dosyaya bakarak anlar. Cloudflare Workers Builds commit'i
// WORKERS_CI_COMMIT_SHA ile verir; yerelde git'e sorulur.
import { execSync } from 'node:child_process';

export function GET() {
  let sha = process.env.WORKERS_CI_COMMIT_SHA ?? '';
  if (!sha) {
    try { sha = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { /* git yok */ }
  }
  return new Response(sha || 'bilinmiyor', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
