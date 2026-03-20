(() => {
  const savedTheme = localStorage.getItem("theme");
  const theme = savedTheme === "light" ? "light" : "dark";
  if (theme === "dark") document.documentElement.classList.add("dark");
  else document.documentElement.classList.remove("dark");
  document.documentElement.style.colorScheme = theme;

  const params = new URLSearchParams(location.search);
  const ab = params.get("ab");
  if (ab) localStorage.setItem("ab:variant", ab);
  const storedAb = localStorage.getItem("ab:variant");
  if (storedAb) document.documentElement.dataset.ab = storedAb;
})();
