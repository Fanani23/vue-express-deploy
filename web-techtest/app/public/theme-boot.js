// Applies the saved (or OS) colour theme before the first paint so the sign-in page never flashes the wrong one.
// Lives in its own file so the Content Security Policy can forbid inline scripts.
(function () {
  var t = null
  try { t = localStorage.getItem('theme') } catch (e) { }
  if (t !== 'light' && t !== 'dark') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  document.documentElement.dataset.theme = t
  document.documentElement.style.colorScheme = t
})()
