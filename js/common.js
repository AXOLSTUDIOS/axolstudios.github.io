/* Axol Studio — utilidades compartidas por todas las páginas públicas */
(function () {
  'use strict'

  const LIVE_MAX_HOURS = 12 // si olvidas apagar el "en vivo", se oculta solo tras 12 h

  const PLATFORMS = {
    kick:     { name: 'Kick',     color: '#53fc18', svg: '<path d="M3 3h6v5h2V6h2V4h2V3h6v6h-2v2h-2v2h2v2h2v6h-6v-1h-2v-2h-2v-2H9v5H3z"/>' },
    youtube:  { name: 'YouTube',  color: '#ff3d3d', svg: '<path d="M21.6 7.2a2.6 2.6 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.6 2.6 0 0 0 2.4 7.2 27 27 0 0 0 2 12a27 27 0 0 0 .4 4.8 2.6 2.6 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.6 2.6 0 0 0 1.8-1.8A27 27 0 0 0 22 12a27 27 0 0 0-.4-4.8zM10 15V9l5.2 3z"/>' },
    tiktok:   { name: 'TikTok',   color: '#f2f2f2', svg: '<path d="M16.6 3c.4 2.2 1.8 3.6 4 3.8v3.1a7 7 0 0 1-4-1.3v6.2A5.8 5.8 0 1 1 10.8 9v3.2a2.7 2.7 0 1 0 2.6 2.7V3z"/>' },
    twitch:   { name: 'Twitch',   color: '#a970ff', svg: '<path d="M4 3 3 6v13h4v3h3l3-3h4l5-5V3zm16 10-3 3h-4l-3 3v-3H6V5h14zM15 7h2v5h-2zm-5 0h2v5h-2z"/>' },
    facebook: { name: 'Facebook', color: '#4c8dff', svg: '<path d="M14 8h3V4h-3c-2.8 0-4.5 1.8-4.5 4.6V11H7v4h2.5v7h4v-7H17l.5-4h-4V8.8c0-.5.2-.8.5-.8z"/>' },
    x:        { name: 'X',        color: '#f2f2f2', svg: '<path d="M4 3h4.6l4 5.5L17.3 3H20l-6.1 7.1L21 21h-4.6l-4.4-6-5.2 6H4l6.8-7.8z"/>' },
    instagram:{ name: 'Instagram',color: '#ff6fae', svg: '<path d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v10c0 1.1.9 2 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm5 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm4.5-3.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>' },
    discord:  { name: 'Discord',  color: '#8c9eff', svg: '<path d="M19 5.5A16 16 0 0 0 15 4l-.5 1a14 14 0 0 0-5 0L9 4a16 16 0 0 0-4 1.5C2.5 9.3 2 13 2.2 16.6A16 16 0 0 0 7 19l1-1.6a10 10 0 0 1-1.6-.8l.4-.3a11.4 11.4 0 0 0 10.4 0l.4.3a10 10 0 0 1-1.6.8l1 1.6a16 16 0 0 0 4.8-2.4c.3-4.2-.6-7.8-2.8-11.1zM9 14.3c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2zm6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2z"/>' },
    otra:     { name: 'Canal',    color: '#cfd3da', svg: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 6h-3a15 15 0 0 0-1.3-3.6A8 8 0 0 1 18.9 8zM12 4c.8 1.1 1.5 2.5 1.9 4h-3.8c.4-1.5 1.1-2.9 1.9-4zM4.3 14a8 8 0 0 1 0-4h3.4a16 16 0 0 0 0 4zm.8 2h3a15 15 0 0 0 1.3 3.6A8 8 0 0 1 5.1 16zm3-8h-3a8 8 0 0 1 4.3-3.6A15 15 0 0 0 8.1 8zM12 20c-.8-1.1-1.5-2.5-1.9-4h3.8c-.4 1.5-1.1 2.9-1.9 4zm2.3-6H9.7a14 14 0 0 1 0-4h4.6a14 14 0 0 1 0 4zm.3 5.6a15 15 0 0 0 1.3-3.6h3a8 8 0 0 1-4.3 3.6zm1.7-5.6a16 16 0 0 0 0-4h3.4a8 8 0 0 1 0 4z"/>' }
  }

  function platform(tipo) { return PLATFORMS[tipo] || PLATFORMS.otra }

  function icon(tipo, cls) {
    const p = platform(tipo)
    return `<svg class="${cls || 'pf-icon'}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${p.svg}</svg>`
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  }

  // Texto sencillo -> HTML: párrafos por línea, **negritas** y enlaces
  function rich(text) {
    return String(text || '').split(/\n+/).map(l => l.trim()).filter(Boolean).map(l => {
      let h = esc(l)
      h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      h = h.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
      return `<p>${h}</p>`
    }).join('')
  }

  function skinFace(s, size) {
    const src = s.skin && /^https?:\/\//.test(s.skin) ? s.skin
      : `https://mc-heads.net/avatar/${encodeURIComponent(s.skin || s.nick || 'MHF_Steve')}/${size || 64}`
    return src
  }

  function isLive(s) {
    if (!s || !s.envivo || !s.envivo.desde) return false
    return Date.now() - new Date(s.envivo.desde).getTime() < LIVE_MAX_HOURS * 3600e3
  }

  function liveUrl(s) {
    if (!isLive(s)) return null
    const p = (s.plataformas || []).find(x => x.tipo === s.envivo.plataforma)
    return p ? p.url : null
  }

  async function load(name, fallback) {
    try {
      const r = await fetch(`data/${name}.json?v=${Math.floor(Date.now() / 60000)}`)
      if (!r.ok) throw new Error(r.status)
      return await r.json()
    } catch { return fallback }
  }

  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  function fecha(iso) {
    const d = new Date(iso)
    if (isNaN(d)) return ''
    return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`
  }

  // Si la cara no carga (nombre no premium, sin internet…), se muestra una cara genérica
  document.addEventListener('error', e => {
    const t = e.target
    if (t.tagName === 'IMG' && /mc-heads\.net/.test(t.src) && !t.dataset.fb) { t.dataset.fb = '1'; t.src = 'img/cara.png' }
  }, true)

  window.Axol = { PLATFORMS, platform, icon, esc, rich, skinFace, isLive, liveUrl, load, fecha }
})()
