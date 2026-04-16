#!/usr/bin/env node
// T6 cycle 2 — Bootstrap admin CLI.
//
// Creates the first cockpit admin by invoking the compiled route
//   apps/web/.next/server/app/api/cockpit/bootstrap-admin/route.js
// via Next's routeModule. The route itself self-disables once any active
// admin exists, so this CLI is naturally idempotent: the second run
// returns a clear error and does not modify the DB.
//
// Usage:
//   node --experimental-strip-types scripts/bootstrap-admin.ts \
//     --email bruno@example.com --name "Bruno Savastano" --password "S3cret!pw"
//
// If any of --email, --name, --password are missing, the CLI prompts on stdin.
//
// Before first run, the Next.js build must be up to date. The CLI will
// build it if the route module is absent.

import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

type BootstrapArgs = { email?: string; name?: string; password?: string };

function parseArgs(argv: string[]): BootstrapArgs {
  const out: BootstrapArgs = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (!next && arg.startsWith('--')) continue;
    switch (arg) {
      case '--email':
        out.email = next;
        i += 1;
        break;
      case '--name':
      case '--display-name':
        out.name = next;
        i += 1;
        break;
      case '--password':
        out.password = next;
        i += 1;
        break;
      default:
        // ignore unknown
        break;
    }
  }
  return out;
}

async function prompt(rl: readline.Interface, question: string, silent = false): Promise<string> {
  if (!silent) {
    return new Promise((resolve) => rl.question(question, resolve));
  }
  // Silent prompt: disable terminal echo for passwords.
  process.stdout.write(question);
  const stdin = process.stdin;
  stdin.resume();
  if ((stdin as { isTTY?: boolean }).isTTY && typeof (stdin as { setRawMode?: (on: boolean) => void }).setRawMode === 'function') {
    (stdin as { setRawMode: (on: boolean) => void }).setRawMode(true);
  }
  return new Promise((resolve) => {
    let buf = '';
    const onData = (chunk: Buffer) => {
      const str = chunk.toString('utf8');
      for (const ch of str) {
        if (ch === '\n' || ch === '\r') {
          if ((stdin as { isTTY?: boolean }).isTTY && typeof (stdin as { setRawMode?: (on: boolean) => void }).setRawMode === 'function') {
            (stdin as { setRawMode: (on: boolean) => void }).setRawMode(false);
          }
          stdin.off('data', onData);
          process.stdout.write('\n');
          resolve(buf);
          return;
        }
        if (ch === '\u0003') { // ctrl-c
          process.exit(130);
        }
        if (ch === '\u0008' || ch === '\u007f') {
          buf = buf.slice(0, -1);
        } else {
          buf += ch;
        }
      }
    };
    stdin.on('data', onData);
  });
}

function findRepoRoot(startDir: string): string {
  let current = path.resolve(startDir);
  while (true) {
    if (
      fs.existsSync(path.join(current, 'project.yaml')) &&
      fs.existsSync(path.join(current, 'apps', 'web')) &&
      fs.existsSync(path.join(current, 'packages', 'core'))
    ) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(`Could not find repo root from ${startDir}`);
    }
    current = parent;
  }
}

async function main() {
  const repoRoot = findRepoRoot(path.dirname(fileURLToPath(import.meta.url)));
  const webDir = path.join(repoRoot, 'apps', 'web');
  const routePath = path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'bootstrap-admin', 'route.js');

  if (!fs.existsSync(routePath)) {
    process.stdout.write('[bootstrap-admin] Building Next.js app so the compiled route is available...\n');
    execSync('npm run build -w @savastano-advisory/web', { cwd: repoRoot, stdio: 'inherit' });
  }

  const requireFromRoot = createRequire(path.join(repoRoot, 'package.json'));
  const mod = requireFromRoot(routePath);
  const handlers = mod.routeModule.userland as {
    GET: () => Promise<Response>;
    POST: (req: Request) => Promise<Response>;
  };

  const status = await (await handlers.GET()).json();
  if (!status.needsBootstrap) {
    process.stderr.write(
      `[bootstrap-admin] Cockpit already has ${status.adminCount} active admin(s). ` +
        `Bootstrap is disabled. Aborting without changes.\n`
    );
    process.exit(2);
  }

  const args = parseArgs(process.argv.slice(2));
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });

  const email = args.email && args.email.length > 0
    ? args.email
    : (await prompt(rl, 'Admin email: ')).trim();
  const displayName = args.name && args.name.length > 0
    ? args.name
    : (await prompt(rl, 'Display name: ')).trim();
  const password = args.password && args.password.length > 0
    ? args.password
    : await prompt(rl, 'Password (at least 8 chars): ', true);

  rl.close();

  if (!email || !email.includes('@')) {
    process.stderr.write('[bootstrap-admin] Invalid email.\n');
    process.exit(3);
  }
  if (!displayName) {
    process.stderr.write('[bootstrap-admin] Display name is required.\n');
    process.exit(3);
  }
  if (password.length < 8) {
    process.stderr.write('[bootstrap-admin] Password must be at least 8 characters.\n');
    process.exit(3);
  }

  const req = new Request('http://localhost/api/cockpit/bootstrap-admin', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, displayName, password })
  });

  const response = await handlers.POST(req);
  const body = (await response.json()) as {
    ok: boolean;
    user?: { userId: string; email: string; displayName: string; role: string };
    error?: { code: string; message: string };
  };

  if (response.status === 201 && body.ok && body.user) {
    process.stdout.write(
      `[bootstrap-admin] Created admin ${body.user.email} (${body.user.userId}). Cockpit bootstrap is now locked.\n`
    );
    return;
  }

  process.stderr.write(
    `[bootstrap-admin] FAILED (HTTP ${response.status}): ${body.error?.code ?? 'unknown'} — ${body.error?.message ?? JSON.stringify(body)}\n`
  );
  process.exit(response.status === 409 ? 2 : 4);
}

main().catch((err: unknown) => {
  process.stderr.write(`[bootstrap-admin] unexpected error: ${(err as Error).stack ?? String(err)}\n`);
  process.exit(1);
});
