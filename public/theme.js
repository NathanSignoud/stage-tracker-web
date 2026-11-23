// Même clé que next-themes : "light", "dark" ou "system" (par défaut).
try {
  var saved = localStorage.getItem("theme");
  var dark = saved === "dark" || (saved !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  if (dark) document.documentElement.classList.add("dark");
} catch (e) {}
