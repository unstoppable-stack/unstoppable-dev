// Navigation enhances real in-page anchors; no feature UI is unmounted.
export function setupNavigation() {
  const links = [...document.querySelectorAll('.sidebar .nav-link')]
  const content = document.querySelector('main.content')
  for (const section of document.querySelectorAll('main section[data-testid]')) section.id ||= section.dataset.testid
  function select(link) {
    for (const item of links) {
      if (item === link) item.setAttribute('aria-current', 'location')
      else item.removeAttribute('aria-current')
    }
  }
  function updateFromScroll() {
    if (!content) return
    const bounds = content.getBoundingClientRect()
    const atEnd = content.scrollTop > 0 && content.scrollTop + content.clientHeight >= content.scrollHeight - 2
    let current = links[0]
    for (const link of links) {
      const section = document.getElementById(link.hash.slice(1))
      if (section && section.getBoundingClientRect().top <= (atEnd ? bounds.bottom - 1 : bounds.top + 32)) current = link
    }
    select(current)
  }
  for (const link of links) link.addEventListener('click', () => select(link))
  content?.addEventListener('scroll', updateFromScroll)
  updateFromScroll()
}
