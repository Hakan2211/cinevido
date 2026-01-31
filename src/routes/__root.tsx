import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { Toaster } from 'sonner'
import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'

// Define User type inline to avoid importing from lib/auth which chains to Prisma
// This must match the user structure from Better-Auth
interface User {
  id: string
  email: string
  name: string | null
  image?: string | null
  emailVerified: boolean
  role?: string
}

interface MyRouterContext {
  queryClient: QueryClient
  user?: User | null
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Cinevido - AI Creative Studio',
      },
    ],
    links: [
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: '/favicon.svg',
      },
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),

  component: RootComponent,
  shellComponent: RootDocument,
})

function RootComponent() {
  return <Outlet />
}

// Inline script to detect stale assets after deployment and auto-reload
// Catches both static asset errors (link/script tags) and dynamic import failures (client-side navigation)
const staleAssetReloadScript = `
(function() {
  var reloadKey = '__asset_reload__';
  var hasReloaded = sessionStorage.getItem(reloadKey);

  // Clear flag on successful page load
  window.addEventListener('load', function() {
    sessionStorage.removeItem(reloadKey);
  });

  // Catch static asset errors (link/script tags)
  window.addEventListener('error', function(e) {
    var target = e.target;
    if (!target) return;

    var isLink = target.tagName === 'LINK';
    var isScript = target.tagName === 'SCRIPT';

    if ((isLink || isScript) && !hasReloaded) {
      var src = target.href || target.src || '';
      if (/[\\\\/]assets[\\\\/].*-[a-zA-Z0-9]{6,}\\.(css|js)/.test(src)) {
        console.log('[Stale Asset] Reloading due to failed asset:', src);
        sessionStorage.setItem(reloadKey, 'true');
        window.location.reload();
      }
    }
  }, true);

  // Catch dynamic import failures (client-side navigation)
  window.addEventListener('unhandledrejection', function(e) {
    if (hasReloaded) return;

    var reason = e.reason;
    var message = (reason && (reason.message || String(reason))) || '';

    // Check for chunk/module load failures
    if (
      message.indexOf('Failed to fetch dynamically imported module') !== -1 ||
      message.indexOf('error loading dynamically imported module') !== -1 ||
      message.indexOf('Importing a module script failed') !== -1 ||
      (message.indexOf('Load failed') !== -1 && message.indexOf('.js') !== -1)
    ) {
      console.log('[Stale Chunk] Reloading due to failed dynamic import:', message);
      sessionStorage.setItem(reloadKey, 'true');
      window.location.reload();
    }
  });

  // Catch Vite preload errors (stale assets after deploy)
  window.addEventListener('vite:preloadError', function(e) {
    if (hasReloaded) return;
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    console.log('[Stale Chunk] Reloading due to vite:preloadError');
    sessionStorage.setItem(reloadKey, 'true');
    window.location.reload();
  });
})();
`

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: staleAssetReloadScript }} />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
        <Toaster position="bottom-right" richColors />
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
