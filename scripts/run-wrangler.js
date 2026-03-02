/**
 * 在清空代理环境变量后执行 wrangler，避免 HTTP_PROXY=127.0.0.1:10808 等导致 Invalid URL。
 * 用法: node scripts/run-wrangler.js <wrangler 子命令...>
 * 例: node scripts/run-wrangler.js dev --local
 *     node scripts/run-wrangler.js deploy
 */
const proc = require('child_process');

const vars = ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy'];
vars.forEach((k) => {
  if (k in process.env) delete process.env[k];
});

const args = process.argv.slice(2);
const result = proc.spawnSync('npx', ['wrangler', ...args], {
  stdio: 'inherit',
  shell: true,
  cwd: process.cwd(),
  env: { ...process.env },
});
process.exit(result.status ?? 1);
