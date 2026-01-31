/**
 * Vite Plugin: Server-Only Module Stubbing
 *
 * This plugin intercepts imports of .server.ts files when building for the client
 * and replaces them with empty stubs. This prevents server-only code
 * (Prisma, Node.js crypto, etc.) from being bundled into the client.
 *
 * IMPORTANT: This plugin only activates during PRODUCTION CLIENT BUILDS.
 * During development, TanStack Start's compiler handles server function
 * transformation, but server-only dependencies must use dynamic imports
 * inside handler functions to avoid being loaded in the browser.
 */

import type { Plugin, ResolvedId } from 'vite'
import path from 'node:path'
import { readFile } from 'node:fs/promises'

const VIRTUAL_PREFIX = '\0virtual:server-only:'
const SERVER_FN_PATTERN = /\b(createServerFn|createMiddleware)\b/

async function moduleUsesCreateServerFn(
  id: string,
  importer: string | undefined,
  resolve: (
    id: string,
    importer?: string,
    options?: { skipSelf?: boolean },
  ) => Promise<ResolvedId | null>,
): Promise<boolean> {
  const resolved = await resolve(id, importer, { skipSelf: true })
  const resolvedId = resolved?.id ?? id

  if (resolvedId.startsWith('\0') || resolvedId.startsWith(VIRTUAL_PREFIX)) {
    return false
  }

  const cleanId = resolvedId.split('?')[0].split('#')[0]
  let filePath = cleanId

  if (!path.isAbsolute(filePath)) {
    if (!importer) {
      return false
    }
    filePath = path.resolve(path.dirname(importer), filePath)
  }

  const candidatePaths = [filePath]
  if (!path.extname(filePath)) {
    candidatePaths.push(
      `${filePath}.ts`,
      `${filePath}.tsx`,
      `${filePath}.js`,
      `${filePath}.jsx`,
    )
  }

  for (const candidate of candidatePaths) {
    try {
      const contents = await readFile(candidate, 'utf8')
      return SERVER_FN_PATTERN.test(contents)
    } catch {
      // Ignore missing/unreadable candidates and try the next one.
    }
  }

  return false
}

export function serverOnlyPlugin(): Plugin {
  let mode = 'development'
  let isBuild = false

  return {
    name: 'server-only',
    enforce: 'pre',

    // Capture the mode and command
    config(_config, env) {
      mode = env.mode
      isBuild = env.command === 'build'
    },

    async resolveId(id, importer, options) {
      // Only apply during production builds for the client
      // Skip during dev mode - TanStack Start handles transformation,
      // but server-only deps must use dynamic imports inside handlers
      if (mode === 'development' || !isBuild) {
        return null
      }

      // Only apply to client builds (SSR should have access to server code)
      // Check if this is an SSR build via the options
      if (options?.ssr) {
        return null
      }

      // Check if this is a .server.ts import (but not already virtualized)
      if (
        id.includes('.server') &&
        !id.startsWith(VIRTUAL_PREFIX) &&
        !id.includes('node_modules')
      ) {
        const usesServerFn = await moduleUsesCreateServerFn(
          id,
          importer,
          this.resolve.bind(this),
        )

        if (usesServerFn) {
          return null
        }

        // Return a virtual module ID
        return {
          id: `${VIRTUAL_PREFIX}${id}`,
          moduleSideEffects: false,
        }
      }

      return null
    },

    load(id) {
      // Handle virtual server-only modules
      if (id.startsWith(VIRTUAL_PREFIX)) {
        const originalId = id.slice(VIRTUAL_PREFIX.length)

        // Return a stub module with proxy that creates callable stubs
        // The server functions created by createServerFn are automatically
        // transformed into RPC calls by TanStack Start, but during the
        // bundling phase we need to provide something that looks like
        // a module with exported functions.
        return `
// Stub for server-only module: ${originalId}
// This module's exports are replaced with RPC stubs at runtime.

const createServerFnStub = (name) => {
  const fn = async (...args) => {
    // This will be replaced by TanStack Start's RPC mechanism
    // If you see this error, something is wrong with the server function setup
    console.warn(\`[Server Stub] Calling \${name} - this should be handled by TanStack Start RPC\`);
    throw new Error(\`Server function "\${name}" was called but TanStack Start RPC is not set up correctly.\`);
  };
  // Mark as server function for TanStack Start
  fn.__serverFn = true;
  return fn;
};

// Export a proxy that returns stubs for any export
const handler = {
  get(target, prop) {
    if (prop === '__esModule') return true;
    if (prop === 'default') return createServerFnStub('default');
    if (typeof prop === 'string') return createServerFnStub(prop);
    return undefined;
  }
};

const moduleProxy = new Proxy({}, handler);

export default moduleProxy;
export const __serverStub = true;

// Re-export all properties from the proxy
// This allows named imports like: import { getSessionFn } from './auth.server'
${Array.from({ length: 50 }, (_, i) => `export const fn${i} = createServerFnStub('fn${i}');`).join('\n')}
`
      }

      return null
    },
  }
}

export default serverOnlyPlugin
