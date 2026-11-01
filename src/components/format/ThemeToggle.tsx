import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

// Meme bouton que Linear et Trame. Le choix est retenu dans le navigateur
// (cle « format.theme », comprise dans la sauvegarde complete).
const STORAGE_KEY = "format.theme";
// Reglage commun a toutes les applis (meme site) : le choix clair / sombre suit d'une appli a l'autre.
const SHARED_KEY = "outils-theme";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
      window.localStorage.setItem(SHARED_KEY, next ? "dark" : "light");
    } catch {
      /* navigateur qui bloque le stockage : le choix vaut pour cette page */
    }
  };

  return (
    <button type="button" className="bandeau-icone" onClick={toggle} aria-label="Basculer le thème" title={dark ? "Passer en mode clair" : "Passer en mode sombre"}>
      {dark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
