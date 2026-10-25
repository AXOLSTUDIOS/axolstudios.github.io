/* Encuesta de Voragos II
 * Las preguntas y opciones vienen de data/encuestas.json (las creas en el panel).
 * Los votos se guardan en Firebase Realtime Database (sitio.json -> "firebase").
 * Un voto por navegador; las reglas de Firebase impiden cambiar o borrar votos.
 */
(function () {
  'use strict'
  const A = window.Axol
  const $ = id => document.getElementById(id)

  function voterId() {
    let id = null
    try { id = localStorage.getItem('axol-votante') } catch { /* sin almacenamiento */ }
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 32)
      try { localStorage.setItem('axol-votante', id) } catch { /* */ }
    }
    return id
  }
  const myVoteKey = p => 'axol-voto-' + p.id
  function getMyVote(p) { try { return localStorage.getItem(myVoteKey(p)) } catch { return null } }
  function setMyVote(p, v) { try { localStorage.setItem(myVoteKey(p), v) } catch { /* */ } }

  async function init(streamers) {
    const [polls, sitio] = await Promise.all([A.load('encuestas', []), A.load('sitio', {})])
    const poll = (polls || []).filter(p => p.activa).sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0]
    const db = (sitio.firebase || '').replace(/\/+$/, '')
    if (!poll || !db) return

    const byId = Object.fromEntries((streamers || []).map(s => [s.id, s]))
    const options = (poll.opciones || []).map(o => ({ ...o, s: byId[o.id] || { nombre: o.nombre, nick: o.nick } }))
    const url = `${db}/encuestas/${encodeURIComponent(poll.id)}/votos`
    const me = voterId()
    let counts = {}, total = 0, mine = getMyVote(poll), busy = false

    $('encuesta').hidden = false
    $('navPoll').hidden = false
    $('heroPoll').hidden = false
    $('pollQ').textContent = poll.pregunta
    $('pollSub').textContent = !poll.abierta ? 'La votación terminó. Estos son los resultados.'
      : mine ? 'Tu voto quedó registrado. Los resultados se actualizan solos.'
      : 'Elige con cuidado: solo tienes un voto.'

    async function refresh() {
      try {
        const r = await fetch(`${url}.json?t=${Date.now()}`)
        const votes = (await r.json()) || {}
        counts = {}; total = 0
        for (const [vid, opt] of Object.entries(votes)) {
          if (!options.some(o => o.id === opt)) continue
          counts[opt] = (counts[opt] || 0) + 1; total++
          if (vid === me && !mine) { mine = opt; setMyVote(poll, opt) }
        }
      } catch { /* sin conexión: se muestra lo último */ }
      render()
    }

    function render() {
      const showResults = !!mine || !poll.abierta
      const max = Math.max(0, ...Object.values(counts))
      $('poll').innerHTML = options.map(o => {
        const n = counts[o.id] || 0
        const pct = total ? Math.round(n * 100 / total) : 0
        const lead = showResults && n > 0 && n === max
        const tag = showResults ? 'div' : 'button'
        return `<${tag} class="poll-opt frame ${o.id === mine ? 'is-mine' : ''} ${lead ? 'is-lead' : ''}" ${showResults ? '' : `type="button" data-vote="${A.esc(o.id)}"`}>
          <img src="${A.esc(A.skinFace(o.s, 64))}" alt="" width="56" height="56">
          <span class="poll-name">${A.esc(o.s.nombre || o.nombre)}</span>
          ${showResults
            ? `<span class="poll-pct">${pct}%</span>
               <span class="poll-bar" aria-hidden="true"><span style="width:${pct}%"></span></span>
               <span class="poll-n">${n} ${n === 1 ? 'voto' : 'votos'}${o.id === mine ? ' · tu voto' : ''}</span>`
            : '<span class="poll-cta">Votar</span>'}
        </${tag}>`
      }).join('')
      $('pollTotal').textContent = showResults && total ? `${total} ${total === 1 ? 'voto' : 'votos'} en total` : ''
      $('poll').querySelectorAll('[data-vote]').forEach(b => b.addEventListener('click', () => vote(b.dataset.vote, b)))
    }

    async function vote(opt, btn) {
      if (busy || mine) return
      const o = options.find(x => x.id === opt)
      if (!confirm(`¿Votar por ${o.s.nombre || o.nombre}? No se puede cambiar después.`)) return
      busy = true
      btn.querySelector('.poll-cta').textContent = 'Enviando…'
      try {
        const r = await fetch(`${url}/${me}.json`, { method: 'PUT', body: JSON.stringify(opt) })
        if (!r.ok && r.status !== 401) throw new Error(r.status)
        if (r.ok) { mine = opt; setMyVote(poll, opt) }
        $('pollSub').textContent = 'Tu voto quedó registrado. Los resultados se actualizan solos.'
      } catch {
        $('pollSub').textContent = 'No se pudo enviar tu voto. Revisa tu conexión e inténtalo otra vez.'
      }
      busy = false
      await refresh()
    }

    await refresh()
    setInterval(refresh, 20000)
  }

  window.AxolPoll = { init }
})()
