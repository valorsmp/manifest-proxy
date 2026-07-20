// Worker Cloudflare : proxy pour mods-manifest.json (repo GitHub prive)
// Le token GitHub reste cote serveur (Secret Cloudflare), jamais expose au client.
const GITHUB_OWNER = "valorsmp";                     // <-- adapte si besoin
const GITHUB_REPO = "manifest-private";                // <-- nom du repo prive (corrige)
const GITHUB_BRANCH = "main";                          // <-- adapte si besoin (ou "master")
const GITHUB_FILE_PATH = "mods-manifest.json";
const GITHUB_FILE_PATH_LIGHT = "mods-manifest-light.json";
export default {
  async fetch(request, env) {
    // Petite securite : n'accepte que GET (evite d'exposer le proxy a d'autres usages)
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }
    // Choix du fichier manifest selon ?pack=light ou ?pack=full (full par defaut)
    const requestUrl = new URL(request.url);
    const pack = requestUrl.searchParams.get("pack");
    const filePath = pack === "light" ? GITHUB_FILE_PATH_LIGHT : GITHUB_FILE_PATH;
    // Verifie la cle secrete envoyee par le launcher. Ne bloque pas un attaquant
    // tres motive qui decompile le binaire (la cle y est forcement, en clair ou
    // obfusquee), mais elimine tous les acces "au hasard" a l'URL du Worker.
    const providedKey = request.headers.get("X-Launcher-Key");
    if (!providedKey || providedKey !== env.LAUNCHER_KEY) {
      return new Response("Forbidden", { status: 403 });
    }
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}?ref=${GITHUB_BRANCH}`;
    const ghRes = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
        "Accept": "application/vnd.github.raw+json", // demande directement le contenu brut (pas de base64 a decoder)
        "User-Agent": "valorsmp-manifest-proxy",
      },
    });
    if (!ghRes.ok) {
      // On ne renvoie jamais le detail de l'erreur GitHub (pourrait leaker des infos sur le repo/token)
      return new Response("Manifest unavailable", { status: 502 });
    }
    const body = await ghRes.text();
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store", // toujours la derniere version, pas de cache intermediaire
        // CORS pas necessaire ici car appele depuis Rust (Tauri backend), pas depuis un navigateur
      },
    });
  },
};
