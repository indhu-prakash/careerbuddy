export const THEME_STORAGE_KEY = "cb-theme";

// Inlined in <head> so the theme class is set before first paint (no light→dark flash).
// A saved choice wins; otherwise follow the OS setting.
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;
