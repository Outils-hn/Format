import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Sous-dossier de publication (GitHub Pages : « /Format/ ») ; « / » partout ailleurs
    basepath: import.meta.env.BASE_URL.replace(/\/+$/, "") || "/",
    defaultPreloadStaleTime: 0,
  });

  return router;
};
