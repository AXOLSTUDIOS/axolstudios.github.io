/* Registro de streamers: guarda la solicitud en Firebase (registros/<id>).
 * Las reglas de Firebase solo aceptan registros si el registro está abierto
 * y el código de invitación es correcto. Tú los apruebas en el panel. */
(async function () {
  'use strict'
  const A = window.Axol
  const $ = id => document.getElementById(id)
  const sitio = await A.load('sitio', {})
  const db = (sitio.firebase || '').replace(/\/+$/, '')
  if (!db || !sitio.registroAbierto) { $('closed').hidden = false; return }

  const f = $('form')
  f.hidden = false
  const code = new URLSearchParams(location.search).get('c')
  if (code) { f.codigo.value = code; $('codeLabel').hidden = true }

  const opts = sel => Object.entries(A.PLATFORMS).filter(([k]) => k !== 'discord')
    .map(([k, p]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${p.name}</option>`).join('')
  const addRow = (tipo = 'kick') => {
    const d = document.createElement('div')
    d.className = 'pf'
    d.innerHTML = `<select>${opts(tipo)}</select><input type="url" placeholder="https://… enlace a tu canal"><button type="button" aria-label="Quitar">✕</button>`
    d.querySelector('button').onclick = () => d.remove()
    $('pfs').appendChild(d)
  }
  addRow('kick')
  $('addPf').onclick = () => addRow('youtube')

  let t
  f.nick.addEventListener('input', () => {
    clearTimeout(t)
    t = setTimeout(() => {
      const n = f.nick.value.trim()
      $('face').src = /^[A-Za-z0-9_]{3,16}$/.test(n) ? A.skinFace({ nick: n }, 72) : 'img/cara.png'
    }, 400)
  })

  f.onsubmit = async e => {
    e.preventDefault()
    const msg = $('msg')
    msg.className = 'msg'
    const plataformas = [...$('pfs').children].map(r => ({ tipo: r.querySelector('select').value, url: r.querySelector('input').value.trim() }))
      .filter(p => /^https?:\/\//i.test(p.url)).slice(0, 8)
    if (!plataformas.length) { msg.className = 'msg err'; msg.textContent = 'Agrega al menos el enlace de un canal.'; return }
    const data = {
      nombre: f.nombre.value.trim().slice(0, 40),
      nick: f.nick.value.trim(),
      rol: f.rol.value.trim().slice(0, 40),
      plataformas: JSON.stringify(plataformas).slice(0, 2000),
      codigo: f.codigo.value.trim(),
      fecha: new Date().toISOString(),
    }
    const btn = f.querySelector('[type=submit]')
    btn.disabled = true; btn.textContent = 'Enviando…'
    const id = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)
    try {
      const r = await fetch(`${db}/registros/${id}.json`, { method: 'PUT', body: JSON.stringify(data) })
      if (r.ok) { f.hidden = true; $('done').hidden = false; return }
      msg.className = 'msg err'
      msg.textContent = r.status === 401
        ? 'No se pudo enviar: el código de invitación no es correcto o el registro ya se cerró.'
        : 'No se pudo enviar. Revisa tus datos e inténtalo otra vez.'
    } catch {
      msg.className = 'msg err'; msg.textContent = 'Sin conexión. Inténtalo otra vez en un momento.'
    }
    btn.disabled = false; btn.textContent = 'Enviar registro'
  }
})()
