import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SeulementNavigateur } from "../components/SeulementNavigateur";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page introuvable</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La page recherchée n’existe pas ou a été déplacée.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Retour à l’accueil
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Cette page n’a pas pu être chargée
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Une erreur est survenue. Vous pouvez réessayer ou revenir à l’accueil.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Réessayer
          </button>
          <a
            href={import.meta.env.BASE_URL}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Retour à l’accueil
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { name: "theme-color", content: "#FF4D00" },
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Format — Optimisation de découpe 2D" },
      { name: "description", content: "Optimisation de débit de panneaux." },
    ],
    links: [
      { rel: "icon", href: `${import.meta.env.BASE_URL}favicon.ico`, sizes: "48x48" },
      { rel: "icon", href: `${import.meta.env.BASE_URL}favicon.svg`, type: "image/svg+xml" },
      { rel: "manifest", href: `${import.meta.env.BASE_URL}manifest.webmanifest` },
      { rel: "apple-touch-icon", href: `${import.meta.env.BASE_URL}icone-192.png` },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

// Applique le mode sombre avant l'affichage (evite un flash blanc au chargement).
const themeInitScript = `(function(){try{if((localStorage.getItem('outils-theme')||localStorage.getItem('format.theme'))==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`;

// Hors ligne : la copie de l'appli est gardee sur le poste (voir public/sw.js). Pas de copie pendant les tests automatiques.
const horsLigneScript = `(function(){try{if(!("serviceWorker" in navigator)||location.protocol==="file:")return;if(navigator.webdriver&&!localStorage.getItem("test-hors-ligne"))return;addEventListener("load",function(){navigator.serviceWorker.register("${import.meta.env.BASE_URL}sw.js").then(function(){return navigator.serviceWorker.ready}).then(function(r){var v=performance.getEntriesByType("resource").map(function(x){return x.name}).filter(function(u){return u.indexOf(location.origin)===0||/fonts\\.(googleapis|gstatic)\\.com/.test(u)});if(r.active)r.active.postMessage({precache:v})}).catch(function(){})})}catch(e){}})();`;

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* Compte obligatoire : sans compte valide, renvoi vers l'Accueil (garde commune a toutes les applis) */}
        <script src="https://outils-hn.github.io/garde.js" />
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: horsLigneScript }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <SeulementNavigateur>
        <Outlet />
      </SeulementNavigateur>
      <Toaster position="bottom-right" />
    </QueryClientProvider>
  );
}
