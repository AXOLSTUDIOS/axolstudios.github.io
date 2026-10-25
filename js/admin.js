/* Axol Studio — panel de administración
 * Lee y guarda los archivos data/*.json del repositorio con la API de GitHub.
 * Al guardar noticias también regenera feed/noticias.xml, que es lo que lee
 * AXOL Launcher en su botón de NOTICIAS.
 */
(function () {
  'use strict'
  const A = window.Axol
  const $ = (s, el = document) => el.querySelector(s)
  const KEY = 'axol-panel'

  // ---------------------------------------------------------------- estado
  let cfg = null
  const files = {}   // path -> { data, sha }
  const DEFAULTS = {
    'data/noticias.json': [],
    'data/streamers.json': [],
    'data/voragos1.json': { intro: '', capitulos: [] },
    'data/donaciones.json': { mensaje: '', metodos: [] },
    'data/sitio.json': { discord: '', firebase: '', redes: {} },
    'data/encuestas.json': [],
  }

  function store(v) { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY) } catch { /* sin almacenamiento */ } }
  function restore() { try { return JSON.parse(localStorage.getItem(KEY)) } catch { return null } }

  function toast(msg, err) {
    const t = $('#toast')
    t.textContent = msg
    t.className = 'toast show' + (err ? ' err' : '')
    clearTimeout(toast.t)
    toast.t = setTimeout(() => { t.className = 'toast' + (err ? ' err' : '') }, err ? 6000 : 2600)
  }

  // ---------------------------------------------------------------- GitHub
  const b64enc = s => btoa(unescape(encodeURIComponent(s)))
  const b64dec = s => decodeURIComponent(escape(atob(s.replace(/\n/g, ''))))

  async function gh(path, opts = {}) {
    const r = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}${path ? "/" + path : ""}`, {
      ...opts,
      headers: { Authorization: `Bearer ${cfg.token}`, Accept: 'application/vnd.github+json', ...(opts.body ? { 'Content-Type': 'application/json' } : {}) },
    })
    if (r.status === 404) return null
    if (!r.ok) {
      let m = ''
      try { m = (await r.json()).message } catch { /* */ }
      if (r.status === 401) throw new Error('La llave no es válida o ya venció. Desconecta y vuelve a conectar con una nueva.')
      if (r.status === 403) throw new Error('La llave no tiene permiso de escritura (Contents: Read and write) en este repositorio.')
      throw new Error(`GitHub respondió ${r.status}: ${m}`)
    }
    return r.json()
  }

  async function readFile(path) {
    const j = await gh(`contents/${path}?ref=main&t=${Date.now()}`)
    if (!j) { files[path] = { data: structuredClone(DEFAULTS[path]), sha: null }; return files[path].data }
    files[path] = { data: JSON.parse(b64dec(j.content)), sha: j.sha }
    return files[path].data
  }

  async function putRaw(path, base64, message, sha) {
    const body = { message, content: base64, branch: 'main' }
    if (sha) body.sha = sha
    try {
      return await gh(`contents/${path}`, { method: 'PUT', body: JSON.stringify(body) })
    } catch (e) {
      if (/409|422|does not match/.test(e.message)) { // sha viejo: reintentar con el actual
        const cur = await gh(`contents/${path}?ref=main&t=${Date.now()}`)
        if (cur) body.sha = cur.sha; else delete body.sha
        return gh(`contents/${path}`, { method: 'PUT', body: JSON.stringify(body) })
      }
      throw e
    }
  }

  async function save(path, message) {
    const f = files[path]
    const res = await putRaw(path, b64enc(JSON.stringify(f.data, null, 2) + '\n'), message, f.sha)
    f.sha = res.content.sha
  }

  async function uploadImage(file) {
    if (file.size > 5 * 1024 * 1024) throw new Error('La imagen pesa más de 5 MB. Usa una más ligera.')
    const data = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(file) })
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '')
    const name = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'imagen'
    const path = `img/uploads/${Date.now()}-${name}.${ext}`
    await putRaw(path, String(data).split(',')[1], `Subir imagen ${file.name}`)
    return path
  }

  function siteBase() {
    const o = cfg.owner.toLowerCase()
    return cfg.repo.toLowerCase() === `${o}.github.io` ? `https://${o}.github.io/` : `https://${o}.github.io/${cfg.repo}/`
  }

  // RSS que lee AXOL Launcher (mismo formato que usa Helios)
  async function saveFeed() {
    const base = siteBase()
    const abs = u => !u ? '' : /^https?:\/\//.test(u) ? u : base + u.replace(/^\.?\//, '')
    const x = s => A.esc(s)
    const news = [...files['data/noticias.json'].data].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 30)
    const items = news.map(n => {
      let html = n.imagen ? `<p><img src="${x(abs(n.imagen))}" style="max-width:100%;border-radius:8px"/></p>` : ''
      html += A.rich(n.cuerpo)
      const page = n.proyecto === 'axol' ? '' : 'voragos2.html'
      return `    <item>
      <title>${x(n.titulo)}</title>
      <link>${x(base + page + '#noticia-' + n.id)}</link>
      <guid isPermaLink="false">axol-${x(n.id)}</guid>
      <pubDate>${new Date(n.fecha).toUTCString()}</pubDate>
      <dc:creator>${x(n.autor || 'Axol Studio')}</dc:creator>
      <slash:comments>0</slash:comments>
      <content:encoded><![CDATA[${html.replace(/]]>/g, ']]]]><![CDATA[>')}]]></content:encoded>
    </item>`
    }).join('\n')
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:slash="http://purl.org/rss/1.0/modules/slash/">
  <channel>
    <title>Noticias de Axol Studio</title>
    <link>${x(base)}</link>
    <description>Novedades de Axol Studio y sus series</description>
    <language>es</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`
    const cur = await gh(`contents/feed/noticias.xml?ref=main&t=${Date.now()}`)
    await putRaw('feed/noticias.xml', b64enc(xml), 'Actualizar feed de noticias', cur && cur.sha)
  }

  async function run(btn, fn, okMsg) {
    const old = btn && btn.textContent
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando…' }
    try { await fn(); toast(okMsg || 'Guardado. La página se actualiza en 1 o 2 minutos.') }
    catch (e) { toast(e.message, true) }
    finally { if (btn) { btn.disabled = false; btn.textContent = old } }
  }

  const uid = s => (s || 'x').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) + '-' + Date.now().toString(36)
  const pfOptions = sel => Object.entries(A.PLATFORMS).map(([k, p]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${p.name}</option>`).join('')

  // ---------------------------------------------------------------- EN VIVO
  function renderLive() {
    const list = files['data/streamers.json'].data
    const el = $('#tab-live')
    if (!list.length) { el.innerHTML = '<p class="note">Primero agrega a tus streamers en la pestaña «Streamers».</p>'; return }
    el.innerHTML = `<p class="note">Marca quién está transmitiendo. Se muestra en la página al momento de guardar (1–2 min) y se apaga solo tras 12 horas si lo olvidas.</p>` +
      list.map((s, i) => {
        const on = A.isLive(s)
        const pfs = (s.plataformas || []).filter(p => p.url)
        return `<div class="live-row ${on ? 'on' : ''}">
          <img src="${A.esc(A.skinFace(s, 56))}" alt="" width="56" height="56">
          <div>
            <div class="name">${A.esc(s.nombre)}</div>
            <div class="state">${on ? 'En vivo en ' + A.platform(s.envivo.plataforma).name : 'Sin transmitir'}</div>
            <div class="live-btns">
              ${pfs.map(p => `<button class="btn ${on && s.envivo.plataforma === p.tipo ? '' : 'ghost'}" data-i="${i}" data-pf="${p.tipo}">${A.icon(p.tipo)} ${A.platform(p.tipo).name}</button>`).join('')}
              ${on ? `<button class="btn danger" data-i="${i}" data-off>Terminar directo</button>` : ''}
              ${pfs.length ? '' : '<span class="note" style="margin:0">Agrega sus canales en «Streamers».</span>'}
            </div>
          </div>
        </div>`
      }).join('')
    el.querySelectorAll('button[data-i]').forEach(b => b.addEventListener('click', () => {
      const s = list[+b.dataset.i]
      s.envivo = b.hasAttribute('data-off') ? null : { plataforma: b.dataset.pf, desde: new Date().toISOString() }
      run(b, () => save('data/streamers.json', `${s.nombre}: ${s.envivo ? 'en vivo en ' + s.envivo.plataforma : 'fin del directo'}`),
        s.envivo ? `${s.nombre} aparece en vivo.` : `${s.nombre} ya no aparece en vivo.`).then(renderLive)
    }))
  }

  // ---------------------------------------------------------------- NOTICIAS
  let newsSel = null
  function renderNews() {
    const list = files['data/noticias.json'].data.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    const n = newsSel != null ? list.find(x => x.id === newsSel) : null
    $('#tab-news').innerHTML = `<div class="grid2">
      <div>
        <div class="inline" style="justify-content:space-between;margin-bottom:12px"><h2 style="margin:0">Noticias</h2><button class="btn sm" id="newsNew">Nueva noticia</button></div>
        <div class="list">${list.map(x => `<div class="item ${x.id === newsSel ? 'sel' : ''}">
          ${x.imagen ? `<img src="${A.esc(x.imagen)}" alt="">` : '<span></span>'}
          <div><div class="t">${A.esc(x.titulo)}</div><div class="s">${A.fecha(x.fecha)} · ${x.proyecto === 'axol' ? 'Axol Studio' : 'Voragos 2'}</div></div>
          <div class="acts"><button class="btn ghost sm" data-edit="${A.esc(x.id)}">Editar</button></div></div>`).join('') || '<p class="note">Aún no hay noticias.</p>'}</div>
      </div>
      <form class="form" id="newsForm">
        <h2>${n ? 'Editar noticia' : 'Nueva noticia'}</h2>
        <label>Título <input name="titulo" required value="${A.esc(n ? n.titulo : '')}"></label>
        <div class="row">
          <label>Dónde aparece <select name="proyecto"><option value="voragos2">Voragos 2</option><option value="axol" ${n && n.proyecto === 'axol' ? 'selected' : ''}>Axol Studio (general)</option></select></label>
          <label>Autor <input name="autor" value="${A.esc(n ? n.autor : 'Axol Studio')}"></label>
        </div>
        <label>Imagen <input type="file" name="file" accept="image/*"><small>O pega un enlace:</small><input name="imagen" value="${A.esc(n ? n.imagen || '' : '')}" placeholder="https://… (opcional)"></label>
        ${n && n.imagen ? `<img class="thumb" src="${A.esc(n.imagen)}" alt="">` : ''}
        <label>Texto <textarea name="cuerpo" required>${A.esc(n ? n.cuerpo : '')}</textarea><small>Cada línea es un párrafo. **texto** se ve en negrita. Los enlaces se activan solos.</small></label>
        <div class="inline">
          <button class="btn" type="submit">${n ? 'Guardar cambios' : 'Publicar noticia'}</button>
          ${n ? '<button class="btn danger" type="button" id="newsDel">Borrar</button>' : ''}
        </div>
        <p class="note">Al publicar se actualiza la página y el botón NOTICIAS de AXOL Launcher.</p>
      </form></div>`
    $('#newsNew').onclick = () => { newsSel = null; renderNews() }
    $('#tab-news').querySelectorAll('[data-edit]').forEach(b => b.onclick = () => { newsSel = b.dataset.edit; renderNews() })
    const f = $('#newsForm')
    f.onsubmit = e => {
      e.preventDefault()
      const btn = f.querySelector('[type=submit]')
      run(btn, async () => {
        let img = f.imagen.value.trim()
        if (f.file.files[0]) { btn.textContent = 'Subiendo imagen…'; img = await uploadImage(f.file.files[0]) }
        const v = { titulo: f.titulo.value.trim(), proyecto: f.proyecto.value, autor: f.autor.value.trim(), imagen: img, cuerpo: f.cuerpo.value.trim() }
        if (n) Object.assign(n, v)
        else { const nn = { id: uid(v.titulo), fecha: new Date().toISOString(), ...v }; list.unshift(nn); newsSel = nn.id }
        await save('data/noticias.json', `Noticia: ${v.titulo}`)
        await saveFeed()
      }, n ? 'Noticia actualizada.' : 'Noticia publicada. Aparece en la página y en el launcher en 1–2 minutos.').then(renderNews)
    }
    const del = $('#newsDel')
    if (del) del.onclick = () => {
      if (!confirm('¿Borrar esta noticia?')) return
      list.splice(list.indexOf(n), 1); newsSel = null
      run(del, async () => { await save('data/noticias.json', `Borrar noticia: ${n.titulo}`); await saveFeed() }, 'Noticia borrada.').then(renderNews)
    }
  }

  // ---------------------------------------------------------------- STREAMERS
  let stSel = null
  function renderStreamers() {
    const list = files['data/streamers.json'].data
    const s = stSel != null ? list.find(x => x.id === stSel) : null
    const pfs = s ? (s.plataformas || []) : [{ tipo: 'kick', url: '' }]
    $('#tab-streamers').innerHTML = `<div class="grid2">
      <div>
        <div class="inline" style="justify-content:space-between;margin-bottom:12px"><h2 style="margin:0">Streamers</h2><button class="btn sm" id="stNew">Agregar streamer</button></div>
        <div class="list">${list.map((x, i) => `<div class="item ${x.id === stSel ? 'sel' : ''}">
          <img src="${A.esc(A.skinFace(x, 36))}" alt="">
          <div><div class="t">${A.esc(x.nombre)}</div><div class="s">${A.esc(x.nick || '')}</div></div>
          <div class="acts">
            <button class="btn ghost sm" data-up="${i}" aria-label="Subir" ${i ? '' : 'disabled'}>▲</button>
            <button class="btn ghost sm" data-edit="${A.esc(x.id)}">Editar</button>
          </div></div>`).join('') || '<p class="note">Aún no hay streamers.</p>'}</div>
      </div>
      <form class="form" id="stForm">
        <h2>${s ? 'Editar streamer' : 'Nuevo streamer'}</h2>
        <div class="row">
          <label>Nombre <input name="nombre" required value="${A.esc(s ? s.nombre : '')}"></label>
          <label>Nombre en Minecraft <input name="nick" required value="${A.esc(s ? s.nick : '')}"></label>
        </div>
        <label>Skin para la cara (opcional) <input name="skin" value="${A.esc(s ? s.skin || '' : '')}" placeholder="Otro nombre premium o enlace a una imagen"><small>Si su skin no es la de su nombre de Minecraft, pon aquí el nombre de la cuenta que la tiene o un enlace a la imagen de la cara.</small></label>
        <label>Papel en la serie (opcional) <input name="rol" value="${A.esc(s ? s.rol || '' : '')}" placeholder="Paladín, Hechicera, Rey del norte…"></label>
        <div class="form" style="gap:8px"><span style="font:500 .9rem var(--display)">Canales</span>
          <div class="pf-rows" id="pfRows">${pfs.map(p => `<div class="inline"><select name="pft">${pfOptions(p.tipo)}</select><input name="pfu" value="${A.esc(p.url)}" placeholder="https://kick.com/usuario"><button class="btn ghost sm" type="button" data-rm>Quitar</button></div>`).join('')}</div>
          <button class="btn ghost sm" type="button" id="pfAdd" style="justify-self:start">Agregar canal</button>
        </div>
        <div class="inline">
          <button class="btn" type="submit">${s ? 'Guardar cambios' : 'Agregar streamer'}</button>
          ${s ? '<button class="btn danger" type="button" id="stDel">Quitar de la serie</button>' : ''}
        </div>
      </form></div>`
    const rows = $('#pfRows')
    const bindRm = () => rows.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => b.parentElement.remove())
    bindRm()
    $('#pfAdd').onclick = () => { rows.insertAdjacentHTML('beforeend', `<div class="inline"><select name="pft">${pfOptions('youtube')}</select><input name="pfu" placeholder="https://…"><button class="btn ghost sm" type="button" data-rm>Quitar</button></div>`); bindRm() }
    $('#stNew').onclick = () => { stSel = null; renderStreamers() }
    $('#tab-streamers').querySelectorAll('[data-edit]').forEach(b => b.onclick = () => { stSel = b.dataset.edit; renderStreamers() })
    $('#tab-streamers').querySelectorAll('[data-up]').forEach(b => b.onclick = () => {
      const i = +b.dataset.up; [list[i - 1], list[i]] = [list[i], list[i - 1]]
      run(b, () => save('data/streamers.json', 'Reordenar streamers'), 'Orden guardado.').then(renderStreamers)
    })
    const f = $('#stForm')
    f.onsubmit = e => {
      e.preventDefault()
      const plataformas = [...rows.children].map(r => ({ tipo: r.querySelector('select').value, url: r.querySelector('input').value.trim() })).filter(p => p.url)
      const v = { nombre: f.nombre.value.trim(), nick: f.nick.value.trim(), skin: f.skin.value.trim(), rol: f.rol.value.trim(), plataformas }
      let target = s
      if (s) Object.assign(s, v)
      else { target = { id: uid(v.nombre), ...v, envivo: null }; list.push(target); stSel = target.id }
      if (target.envivo && !plataformas.some(p => p.tipo === target.envivo.plataforma)) target.envivo = null
      run(f.querySelector('[type=submit]'), () => save('data/streamers.json', `Streamer: ${v.nombre}`), s ? 'Cambios guardados.' : `${v.nombre} agregado a la serie.`).then(() => { renderStreamers(); renderLive() })
    }
    const del = $('#stDel')
    if (del) del.onclick = () => {
      if (!confirm(`¿Quitar a ${s.nombre} de la página?`)) return
      list.splice(list.indexOf(s), 1); stSel = null
      run(del, () => save('data/streamers.json', `Quitar streamer: ${s.nombre}`), 'Streamer quitado.').then(() => { renderStreamers(); renderLive() })
    }
  }

  // ---------------------------------------------------------------- VORAGOS 1
  function renderV1() {
    const d = files['data/voragos1.json'].data
    d.capitulos = d.capitulos || []
    $('#tab-v1').innerHTML = `<form class="form" id="v1Form" style="max-width:760px">
      <h2>Voragos 1: la historia</h2>
      <label>Frase de portada <input name="intro" value="${A.esc(d.intro || '')}" placeholder="Antes de que cayeran las estrellas, hubo una primera historia."></label>
      <div id="caps" class="form">${d.capitulos.map((c, i) => capHtml(c, i)).join('')}</div>
      <button class="btn ghost sm" type="button" id="capAdd" style="justify-self:start">Agregar capítulo</button>
      <button class="btn" type="submit" style="justify-self:start">Guardar historia</button>
    </form>`
    const caps = $('#caps')
    $('#capAdd').onclick = () => { caps.insertAdjacentHTML('beforeend', capHtml({ titulo: '', texto: '', imagen: '' }, caps.children.length)); bindCaps() }
    function bindCaps() { caps.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { if (confirm('¿Quitar este capítulo?')) b.closest('fieldset').remove() }) }
    bindCaps()
    const f = $('#v1Form')
    f.onsubmit = e => {
      e.preventDefault()
      const btn = f.querySelector('[type=submit]')
      run(btn, async () => {
        const out = []
        for (const fs of caps.querySelectorAll('fieldset')) {
          let img = fs.querySelector('[name=cimg]').value.trim()
          const file = fs.querySelector('[name=cfile]').files[0]
          if (file) { btn.textContent = 'Subiendo imagen…'; img = await uploadImage(file) }
          out.push({ titulo: fs.querySelector('[name=ctit]').value.trim(), texto: fs.querySelector('[name=ctxt]').value.trim(), imagen: img })
        }
        d.intro = f.intro.value.trim()
        d.capitulos = out.filter(c => c.titulo || c.texto)
        await save('data/voragos1.json', 'Actualizar historia de Voragos 1')
      }, 'Historia guardada.').then(renderV1)
    }
  }
  function capHtml(c, i) {
    return `<fieldset class="form" style="border:1px solid var(--line);padding:16px">
      <legend style="font:500 .85rem var(--display);color:var(--muted)">Capítulo</legend>
      <label>Título <input name="ctit" value="${A.esc(c.titulo)}"></label>
      <label>Texto <textarea name="ctxt">${A.esc(c.texto)}</textarea></label>
      <label>Imagen (opcional) <input type="file" name="cfile" accept="image/*"><input name="cimg" value="${A.esc(c.imagen || '')}" placeholder="o enlace a una imagen"></label>
      <button class="btn danger sm" type="button" data-rm style="justify-self:start">Quitar capítulo</button>
    </fieldset>`
  }

  // ---------------------------------------------------------------- DONACIONES
  function renderDonate() {
    const d = files['data/donaciones.json'].data
    d.metodos = d.metodos || []
    $('#tab-donate').innerHTML = `<form class="form" id="dForm" style="max-width:760px">
      <h2>Página de donaciones</h2>
      <label>Mensaje <textarea name="mensaje">${A.esc(d.mensaje || '')}</textarea></label>
      <div id="mets" class="form" style="gap:10px">${d.metodos.map(metHtml).join('')}</div>
      <button class="btn ghost sm" type="button" id="mAdd" style="justify-self:start">Agregar forma de pago</button>
      <p class="note">Usa enlaces de cobro (PayPal.me, Ko-fi, Mercado Pago). No publiques números de tarjeta ni de cuenta completos.</p>
      <button class="btn" type="submit" style="justify-self:start">Guardar donaciones</button>
    </form>`
    const mets = $('#mets')
    const bind = () => mets.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => b.closest('.met').remove())
    bind()
    $('#mAdd').onclick = () => { mets.insertAdjacentHTML('beforeend', metHtml({})); bind() }
    const f = $('#dForm')
    f.onsubmit = e => {
      e.preventDefault()
      d.mensaje = f.mensaje.value.trim()
      d.metodos = [...mets.querySelectorAll('.met')].map(m => ({
        nombre: m.querySelector('[name=mn]').value.trim(), detalle: m.querySelector('[name=md]').value.trim(), url: m.querySelector('[name=mu]').value.trim(),
      })).filter(m => m.nombre)
      run(f.querySelector('[type=submit]'), () => save('data/donaciones.json', 'Actualizar donaciones'), 'Donaciones guardadas.').then(renderDonate)
    }
  }
  function metHtml(m) {
    return `<div class="met">
      <label>Nombre <input name="mn" value="${A.esc(m.nombre || '')}" placeholder="PayPal"></label>
      <label>Descripción <input name="md" value="${A.esc(m.detalle || '')}" placeholder="Desde cualquier país"></label>
      <label>Enlace <input name="mu" value="${A.esc(m.url || '')}" placeholder="https://paypal.me/…"></label>
      <button class="btn danger sm" type="button" data-rm>Quitar</button></div>`
  }

  // ---------------------------------------------------------------- ENCUESTAS
  let pollSel = null
  function fbUrl() { return (files['data/sitio.json'].data.firebase || '').replace(/\/+$/, '') }
  async function pollCounts(p) {
    const db = fbUrl()
    if (!db) return null
    try {
      const r = await fetch(`${db}/encuestas/${encodeURIComponent(p.id)}/votos.json?t=${Date.now()}`)
      const v = (await r.json()) || {}
      const c = {}; let t = 0
      for (const o of Object.values(v)) { c[o] = (c[o] || 0) + 1; t++ }
      return { c, t }
    } catch { return null }
  }
  function renderPolls() {
    const list = files['data/encuestas.json'].data
    const streamers = files['data/streamers.json'].data
    const p = pollSel ? list.find(x => x.id === pollSel) : null
    const el = $('#tab-polls')
    const db = fbUrl()
    el.innerHTML = `${db ? '' : `<p class="note" style="color:#ffb3c1">Para recibir votos falta conectar Firebase. Sigue los pasos de abajo y pega la dirección en la pestaña «Enlaces».</p>`}
    <div class="grid2">
      <div>
        <div class="inline" style="justify-content:space-between;margin-bottom:12px"><h2 style="margin:0">Encuestas</h2><button class="btn sm" id="pollNew">Nueva encuesta</button></div>
        <div class="list">${list.map(x => `<div class="item ${x.id === pollSel ? 'sel' : ''}">
          <span></span>
          <div><div class="t">${A.esc(x.pregunta)}</div><div class="s">${x.activa ? (x.abierta ? 'Visible · votación abierta' : 'Visible · votación cerrada') : 'Oculta'}</div></div>
          <div class="acts"><button class="btn ghost sm" data-edit="${A.esc(x.id)}">Abrir</button></div></div>`).join('') || '<p class="note">Aún no hay encuestas.</p>'}</div>
        <details class="help">
          <summary>Conectar Firebase para los votos (una sola vez)</summary>
          <ol>
            <li>Entra a <a href="https://console.firebase.google.com/" target="_blank" rel="noopener">console.firebase.google.com</a> con tu cuenta de Google y pulsa «Crear un proyecto» (por ejemplo «axol-votos»). Puedes desactivar Google Analytics.</li>
            <li>En el menú, abre «Compilación → Realtime Database» y pulsa «Crear base de datos». Elige la ubicación de Estados Unidos y empieza en «modo bloqueado».</li>
            <li>En la pestaña «Reglas», borra todo, pega esto y pulsa «Publicar»:
              <textarea readonly style="min-height:220px;font:.8rem monospace;margin-top:6px" onclick="this.select()">{
  "rules": {
    "encuestas": {
      "$encuesta": {
        "votos": {
          ".read": true,
          "$votante": {
            ".write": "!data.exists() && newData.isString() && newData.val().length <= 80 && $votante.length <= 40"
          }
        }
      }
    }
  }
}</textarea>
              Con estas reglas cada visitante vota una sola vez y nadie puede borrar ni cambiar votos.</li>
            <li>Copia la dirección que aparece arriba de los datos (algo como <b>https://axol-votos-default-rtdb.firebaseio.com</b>) y pégala en la pestaña «Enlaces».</li>
          </ol>
        </details>
      </div>
      <form class="form" id="pollForm">
        <h2>${p ? 'Editar encuesta' : 'Nueva encuesta'}</h2>
        <label>Pregunta <input name="pregunta" required value="${A.esc(p ? p.pregunta : '¿Quién crees que muera primero?')}"></label>
        <div class="form" style="gap:8px"><span style="font:500 .9rem var(--display)">Opciones</span>
          ${p ? `<p class="note" style="margin:0">Las opciones no se pueden cambiar una vez creada la encuesta.</p>` : ''}
          <div class="list">${(p ? p.opciones : streamers).map(o => `<label class="item check-item">
            <input type="checkbox" name="op" value="${A.esc(o.id)}" ${p ? 'checked disabled' : 'checked'} style="width:auto">
            <img src="${A.esc(A.skinFace(streamers.find(s => s.id === o.id) || o, 36))}" alt="">
            <span>${A.esc(o.nombre)}</span><span class="s" data-res="${A.esc(o.id)}"></span></label>`).join('') || '<p class="note">Primero agrega streamers.</p>'}</div>
        </div>
        <label class="check"><input type="checkbox" name="activa" ${!p || p.activa ? 'checked' : ''} style="width:auto"> Mostrar en la página de Voragos II</label>
        <label class="check"><input type="checkbox" name="abierta" ${!p || p.abierta ? 'checked' : ''} style="width:auto"> Votación abierta (si la cierras, solo se ven los resultados)</label>
        <p class="note" id="pollRes"></p>
        <div class="inline">
          <button class="btn" type="submit">${p ? 'Guardar cambios' : 'Crear encuesta'}</button>
          ${p ? '<button class="btn danger" type="button" id="pollDel">Borrar</button>' : ''}
        </div>
        <p class="note">Solo se muestra en la página la encuesta visible más reciente.</p>
      </form></div>`
    $('#pollNew').onclick = () => { pollSel = null; renderPolls() }
    el.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => { pollSel = b.dataset.edit; renderPolls() })
    if (p) pollCounts(p).then(r => {
      if (!r) return
      $('#pollRes').textContent = `${r.t} ${r.t === 1 ? 'voto' : 'votos'} en total.`
      for (const o of p.opciones) {
        const span = el.querySelector(`[data-res="${CSS.escape(o.id)}"]`)
        const n = r.c[o.id] || 0
        if (span) span.textContent = `${n} (${r.t ? Math.round(n * 100 / r.t) : 0}%)`
      }
    })
    const f = $('#pollForm')
    f.onsubmit = e => {
      e.preventDefault()
      const v = { pregunta: f.pregunta.value.trim(), activa: f.activa.checked, abierta: f.abierta.checked }
      if (p) Object.assign(p, v)
      else {
        const ids = [...f.querySelectorAll('[name=op]:checked')].map(c => c.value)
        if (ids.length < 2) { toast('Elige al menos dos opciones.', true); return }
        const opciones = ids.map(id => { const s = streamers.find(x => x.id === id); return { id, nombre: s.nombre, nick: s.nick, skin: s.skin || '' } })
        const np = { id: uid(v.pregunta), fecha: new Date().toISOString(), ...v, opciones }
        list.unshift(np); pollSel = np.id
      }
      run(f.querySelector('[type=submit]'), () => save('data/encuestas.json', `Encuesta: ${v.pregunta}`), p ? 'Encuesta guardada.' : 'Encuesta creada. Aparece en la página en 1–2 minutos.').then(renderPolls)
    }
    const del = $('#pollDel')
    if (del) del.onclick = () => {
      if (!confirm('¿Borrar esta encuesta de la página? Los votos se quedan guardados en Firebase.')) return
      list.splice(list.indexOf(p), 1); pollSel = null
      run(del, () => save('data/encuestas.json', `Borrar encuesta: ${p.pregunta}`), 'Encuesta borrada.').then(renderPolls)
    }
  }

  // ---------------------------------------------------------------- ENLACES
  function renderSite() {
    const d = files['data/sitio.json'].data
    d.redes = d.redes || {}
    const r = k => A.esc(d.redes[k] || '')
    $('#tab-site').innerHTML = `<form class="form" id="sForm" style="max-width:640px">
      <h2>Enlaces</h2>
      <label>Dirección de Firebase (para las encuestas) <input name="firebase" value="${A.esc(d.firebase || '')}" placeholder="https://…-default-rtdb.firebaseio.com"><small>Los pasos para conseguirla están en la pestaña «Encuestas».</small></label>
      <label>Invitación de Discord <input name="discord" value="${A.esc(d.discord || '')}" placeholder="https://discord.gg/…"></label>
      <h2 style="margin-top:12px">Redes de Axol Studio</h2>
      <div class="row">
        <label>YouTube <input name="youtube" value="${r('youtube')}"></label>
        <label>TikTok <input name="tiktok" value="${r('tiktok')}"></label>
        <label>Kick <input name="kick" value="${r('kick')}"></label>
        <label>X <input name="x" value="${r('x')}"></label>
        <label>Instagram <input name="instagram" value="${r('instagram')}"></label>
      </div>
      <button class="btn" type="submit" style="justify-self:start">Guardar enlaces</button>
    </form>`
    const f = $('#sForm')
    f.onsubmit = e => {
      e.preventDefault()
      d.discord = f.discord.value.trim()
      d.firebase = f.firebase.value.trim().replace(/\/+$/, '')
      for (const k of ['youtube', 'tiktok', 'kick', 'x', 'instagram']) d.redes[k] = f[k].value.trim()
      run(f.querySelector('[type=submit]'), () => save('data/sitio.json', 'Actualizar enlaces'), 'Enlaces guardados.').then(renderPolls)
    }
  }

  // ---------------------------------------------------------------- arranque
  function showTab(name) {
    document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === name)))
    document.querySelectorAll('.tab').forEach(t => { t.hidden = t.id !== 'tab-' + name })
  }

  async function start() {
    $('#login').hidden = true
    $('#app').hidden = false
    try {
      const repo = await gh('')
      if (!repo) throw new Error(`No encuentro el repositorio ${cfg.owner}/${cfg.repo}. Revisa el nombre.`)
      if (repo.permissions && !repo.permissions.push) throw new Error('La llave no tiene permiso de escritura en este repositorio.')
      await Promise.all(Object.keys(DEFAULTS).map(readFile))
    } catch (e) {
      toast(e.message, true)
      $('#app').hidden = true; $('#login').hidden = false
      return
    }
    renderLive(); renderNews(); renderStreamers(); renderV1(); renderDonate(); renderSite(); renderPolls()
    document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => showTab(b.dataset.tab))
  }

  $('#loginForm').onsubmit = e => {
    e.preventDefault()
    const f = e.target
    cfg = { owner: f.owner.value.trim(), repo: f.repo.value.trim(), token: f.token.value.trim() }
    store(cfg)
    start()
  }
  $('#logout').onclick = () => { store(null); cfg = null; location.reload() }

  cfg = restore()
  if (cfg && cfg.token) start(); else $('#login').hidden = false
})()
