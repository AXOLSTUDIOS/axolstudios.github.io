/* Panel: pestaña Registros (los streamers se registran solos en registro.html). */
(function () {
  'use strict'
  const A = window.Axol
  const KEY = 'axol-fb-clave'
  let ctx = null

  const getKey = () => { try { return localStorage.getItem(KEY) || '' } catch { return '' } }
  const setKey = v => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY) } catch { /* */ } }
  const db = () => (ctx.files['data/sitio.json'].data.firebase || '').replace(/\/+$/, '')
  const siteUrl = () => location.origin + location.pathname.replace(/admin\.html.*$/, '')
  const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('')

  async function fb(path, opts = {}) {
    const r = await fetch(`${db()}/${path}.json?auth=${encodeURIComponent(getKey())}`, opts)
    if (r.status === 401) throw new Error('La clave de Firebase no es correcta.')
    if (!r.ok) throw new Error('Firebase respondió ' + r.status)
    return r.json()
  }

  async function render() {
    const el = document.getElementById('tab-regs')
    const sitio = ctx.files['data/sitio.json'].data
    if (!db()) { el.innerHTML = '<p class="note">Primero conecta Firebase en la pestaña «Encuestas».</p>'; return }
    if (!getKey()) {
      el.innerHTML = `<form class="form" id="fbKeyForm" style="max-width:560px">
        <h2>Conectar los registros</h2>
        <p class="note">Para ver y aprobar registros, el panel necesita la clave secreta de tu base de datos (solo se guarda en este navegador).</p>
        <ol class="note" style="padding-left:18px">
          <li>Abre <a href="https://console.firebase.google.com/project/axol-votos/settings/serviceaccounts/databasesecrets" target="_blank" rel="noopener">Firebase → Configuración → Cuentas de servicio → Secretos de la base de datos</a>.</li>
          <li>Pasa el mouse sobre los puntos del secreto, pulsa <b>Mostrar</b> y cópialo.</li>
          <li>Pégalo aquí. No lo compartas ni lo muestres en directo.</li>
        </ol>
        <label>Clave secreta de Firebase <input name="k" type="password" required autocomplete="off"></label>
        <button class="btn" type="submit">Conectar</button>
      </form>`
      document.getElementById('fbKeyForm').onsubmit = async e => {
        e.preventDefault()
        setKey(e.target.k.value.trim())
        try { await fb('ajustes'); ctx.toast('Registros conectados.'); render() }
        catch (err) { setKey(''); ctx.toast(err.message, true) }
      }
      return
    }

    let ajustes = null, regs = {}
    try {
      ajustes = (await fb('ajustes/registro')) || { abierto: false, codigo: newCode() }
      regs = (await fb('registros')) || {}
    } catch (err) {
      el.innerHTML = `<p class="note" style="color:#ffb3c1">${A.esc(err.message)}</p><button class="btn ghost sm" id="fbReset">Cambiar la clave</button>`
      document.getElementById('fbReset').onclick = () => { setKey(''); render() }
      return
    }
    if (!ajustes.codigo) ajustes.codigo = newCode()
    const link = `${siteUrl()}registro.html?c=${ajustes.codigo}`
    const list = Object.entries(regs).sort((a, b) => String(a[1].fecha).localeCompare(String(b[1].fecha)))

    el.innerHTML = `<div class="grid2">
      <div class="form">
        <h2>Registro de streamers</h2>
        <div class="live-row ${ajustes.abierto ? 'on' : ''}" style="grid-template-columns:1fr">
          <div>
            <div class="name">${ajustes.abierto ? 'Registro ABIERTO' : 'Registro cerrado'}</div>
            <div class="state">${ajustes.abierto ? 'Quien tenga el enlace puede registrarse.' : 'Nadie puede registrarse ahora.'}</div>
            <div class="live-btns"><button class="btn ${ajustes.abierto ? 'danger' : ''}" id="regToggle">${ajustes.abierto ? 'Cerrar registro' : 'Abrir registro'}</button></div>
          </div>
        </div>
        <label>Enlace para tus streamers
          <input readonly value="${A.esc(link)}" onclick="this.select()">
          <small>Mándalo solo a tus participantes (por ejemplo, por Discord privado). Incluye el código de invitación.</small>
        </label>
        <div class="inline">
          <button class="btn ghost sm" type="button" id="regCopy">Copiar enlace</button>
          <button class="btn ghost sm" type="button" id="regNewCode">Cambiar código</button>
        </div>
        <p class="note">Si alguien que no debía consiguió el enlace, pulsa «Cambiar código»: el enlace anterior deja de funcionar.</p>
        <button class="link" type="button" id="fbForget" style="justify-self:start">Olvidar la clave de Firebase en este navegador</button>
      </div>
      <div>
        <div class="inline" style="justify-content:space-between;margin-bottom:12px"><h2 style="margin:0">Por aprobar (${list.length})</h2><button class="btn ghost sm" id="regRefresh">Actualizar</button></div>
        <div class="list">${list.map(([id, r]) => {
          let pfs = []
          try { pfs = JSON.parse(r.plataformas || '[]') } catch { /* */ }
          return `<div class="item" style="grid-template-columns:auto 1fr;align-items:start">
            <img src="${A.esc(A.skinFace({ nick: r.nick }, 36))}" alt="">
            <div>
              <div class="t">${A.esc(r.nombre)} <span class="s">· ${A.esc(r.nick)}${r.rol ? ' · ' + A.esc(r.rol) : ''}</span></div>
              <div class="s" style="margin:4px 0 8px">${pfs.map(p => `<a href="${A.esc(p.url)}" target="_blank" rel="noopener">${A.esc(A.platform(p.tipo).name)}</a>`).join(' · ') || 'Sin canales'}</div>
              <div class="inline"><button class="btn sm" data-ok="${A.esc(id)}">Aprobar</button><button class="btn danger sm" data-no="${A.esc(id)}">Rechazar</button></div>
            </div></div>`
        }).join('') || '<p class="note">No hay registros nuevos.</p>'}</div>
      </div></div>`

    const saveAjustes = async v => {
      await fb('ajustes/registro', { method: 'PUT', body: JSON.stringify(v) })
      sitio.registroAbierto = !!v.abierto
      await ctx.save('data/sitio.json', v.abierto ? 'Abrir registro de streamers' : 'Cerrar registro de streamers')
    }
    document.getElementById('regToggle').onclick = e => ctx.run(e.target, () => saveAjustes({ ...ajustes, abierto: !ajustes.abierto }), !ajustes.abierto ? 'Registro abierto. La página lo muestra en 1–2 minutos.' : 'Registro cerrado.').then(render)
    document.getElementById('regNewCode').onclick = e => ctx.run(e.target, () => saveAjustes({ ...ajustes, codigo: newCode() }), 'Código nuevo. Manda el enlace nuevo a tus streamers.').then(render)
    document.getElementById('regCopy').onclick = async () => { try { await navigator.clipboard.writeText(link); ctx.toast('Enlace copiado.') } catch { ctx.toast('Selecciona el enlace y cópialo con Ctrl + C.') } }
    document.getElementById('regRefresh').onclick = render
    document.getElementById('fbForget').onclick = () => { setKey(''); render() }

    el.querySelectorAll('[data-ok]').forEach(b => b.onclick = () => ctx.run(b, async () => {
      const r = regs[b.dataset.ok]
      let pfs = []
      try { pfs = JSON.parse(r.plataformas || '[]').filter(p => /^https?:\/\//i.test(p.url)) } catch { /* */ }
      const streamers = ctx.files['data/streamers.json'].data
      const prev = streamers.find(s => (s.nick || '').toLowerCase() === String(r.nick).toLowerCase())
      const v = { nombre: r.nombre, nick: r.nick, rol: r.rol || '', plataformas: pfs }
      if (prev) Object.assign(prev, v)
      else streamers.push({ id: ctx.uid(r.nombre), skin: '', envivo: null, ...v })
      await ctx.save('data/streamers.json', `Aprobar registro: ${r.nombre}`)
      await fb('registros/' + b.dataset.ok, { method: 'DELETE' })
    }, `${r_name(regs, b.dataset.ok)} aparece en la página en 1–2 minutos.`).then(() => { render(); ctx.refresh() }))
    el.querySelectorAll('[data-no]').forEach(b => b.onclick = () => {
      if (!confirm('¿Rechazar este registro? Se borra y no aparece en la página.')) return
      ctx.run(b, () => fb('registros/' + b.dataset.no, { method: 'DELETE' }), 'Registro rechazado.').then(render)
    })
  }
  const r_name = (regs, id) => (regs[id] && regs[id].nombre) || 'El streamer'

  window.AxolRegistros = {
    init(c) { ctx = c; render() },
    render: () => ctx && render(),
  }
})()
