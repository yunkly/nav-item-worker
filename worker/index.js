import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'

const encoder = new TextEncoder()

// ====== 通用响应工具 ======
function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      ...extraHeaders,
    },
  })
}

function noContent() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

function getClientIp(request) {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    ''
  )
}

function getShanghaiTime() {
  const date = new Date()
  const shTime = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }))
  const pad = (n) => String(n).padStart(2, '0')
  const year = shTime.getFullYear()
  const month = pad(shTime.getMonth() + 1)
  const day = pad(shTime.getDate())
  const hours = pad(shTime.getHours())
  const minutes = pad(shTime.getMinutes())
  const seconds = pad(shTime.getSeconds())
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

// ====== D1 封装，模拟 sqlite3 的 all/get/run ======
async function dbAll(env, sql, params = []) {
  let stmt = env.DB.prepare(sql)
  if (params && params.length) {
    stmt = stmt.bind(...params)
  }
  const { results } = await stmt.all()
  return results || []
}

async function dbGet(env, sql, params = []) {
  const rows = await dbAll(env, sql, params)
  return rows[0] || null
}

async function dbRun(env, sql, params = []) {
  let stmt = env.DB.prepare(sql)
  if (params && params.length) {
    stmt = stmt.bind(...params)
  }
  const { meta } = await stmt.run()
  return {
    lastID: meta.last_row_id,
    changes: meta.changes,
  }
}

// ====== JWT 封装 ======
function getJwtKey(env) {
  const secret = env.JWT_SECRET || 'your_jwt_secret_key'
  return encoder.encode(secret)
}

async function createToken(env, payload, expiresIn = '2h') {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getJwtKey(env))
}

async function getAuthUser(request, env) {
  const auth = request.headers.get('Authorization') || ''
  if (!auth.startsWith('Bearer ')) {
    const err = new Error('未授权')
    err.status = 401
    throw err
  }
  const token = auth.slice(7)
  try {
    const { payload } = await jwtVerify(token, getJwtKey(env))
    return payload
  } catch (e) {
    const err = new Error('无效token')
    err.status = 401
    throw err
  }
}

// ====== 简单的路径匹配工具 ======
function match(pathname, pattern) {
  const pathParts = pathname.split('/').filter(Boolean)
  const patternParts = pattern.split('/').filter(Boolean)
  if (pathParts.length !== patternParts.length) return null
  const params = {}
  for (let i = 0; i < patternParts.length; i++) {
    const p = patternParts[i]
    const v = pathParts[i]
    if (p.startsWith(':')) {
      params[p.slice(1)] = v
    } else if (p !== v) {
      return null
    }
  }
  return params
}

// ====== 登录 /api/login ======
async function handleLogin(request, env) {
  const { username, password } = await request.json()
  if (!username || !password) {
    return json({ error: '用户名或密码错误' }, 401)
  }

  const user = await dbGet(env, 'SELECT * FROM users WHERE username=?', [username])
  if (!user) return json({ error: '用户名或密码错误' }, 401)

  const ok = await bcrypt.compare(password, user.password)
  if (!ok) return json({ error: '用户名或密码错误' }, 401)

  const lastLoginTime = user.last_login_time
  const lastLoginIp = user.last_login_ip

  const now = getShanghaiTime()
  const ip = getClientIp(request)
  await dbRun(env, 'UPDATE users SET last_login_time=?, last_login_ip=? WHERE id=?', [
    now,
    ip,
    user.id,
  ])

  const token = await createToken(env, { id: user.id, username: user.username }, '2h')
  return json({ token, lastLoginTime, lastLoginIp })
}

// ====== 菜单相关 /api/menus... ======
async function handleGetMenus(request, env) {
  const url = new URL(request.url)
  const page = url.searchParams.get('page')
  const pageSize = url.searchParams.get('pageSize')

  if (!page && !pageSize) {
    const menus = await dbAll(env, 'SELECT * FROM menus ORDER BY "order"')
    const result = []
    for (const menu of menus) {
      const subMenus = await dbAll(
        env,
        'SELECT * FROM sub_menus WHERE parent_id = ? ORDER BY "order"',
        [menu.id],
      )
      result.push({ ...menu, subMenus })
    }
    return json(result)
  } else {
    const pageNum = parseInt(page) || 1
    const size = parseInt(pageSize) || 10
    const offset = (pageNum - 1) * size
    const countRow = await dbGet(env, 'SELECT COUNT(*) as total FROM menus')
    const data = await dbAll(
      env,
      'SELECT * FROM menus ORDER BY "order" LIMIT ? OFFSET ?',
      [size, offset],
    )
    return json({
      total: countRow?.total || 0,
      page: pageNum,
      pageSize: size,
      data,
    })
  }
}

// GET /api/menus/:id/submenus
async function handleGetSubMenus(request, env, menuId) {
  const rows = await dbAll(
    env,
    'SELECT * FROM sub_menus WHERE parent_id = ? ORDER BY "order"',
    [menuId],
  )
  return json(rows)
}

// POST /api/menus（需登录）
async function handleAddMenu(request, env) {
  await getAuthUser(request, env)
  const { name, order } = await request.json()
  const info = await dbRun(
    env,
    'INSERT INTO menus (name, "order") VALUES (?, ?)',
    [name, order || 0],
  )
  return json({ id: info.lastID })
}

// PUT /api/menus/:id
async function handleUpdateMenu(request, env, id) {
  await getAuthUser(request, env)
  const { name, order } = await request.json()
  const info = await dbRun(
    env,
    'UPDATE menus SET name=?, "order"=? WHERE id=?',
    [name, order || 0, id],
  )
  return json({ changed: info.changes })
}

// DELETE /api/menus/:id
async function handleDeleteMenu(request, env, id) {
  await getAuthUser(request, env)
  const info = await dbRun(env, 'DELETE FROM menus WHERE id=?', [id])
  return json({ deleted: info.changes })
}

// POST /api/menus/:id/submenus
async function handleAddSubMenu(request, env, menuId) {
  await getAuthUser(request, env)
  const { name, order } = await request.json()
  const info = await dbRun(
    env,
    'INSERT INTO sub_menus (parent_id, name, "order") VALUES (?, ?, ?)',
    [menuId, name, order || 0],
  )
  return json({ id: info.lastID })
}

// PUT /api/menus/submenus/:id
async function handleUpdateSubMenu(request, env, subMenuId) {
  await getAuthUser(request, env)
  const { name, order } = await request.json()
  const info = await dbRun(
    env,
    'UPDATE sub_menus SET name=?, "order"=? WHERE id=?',
    [name, order || 0, subMenuId],
  )
  return json({ changed: info.changes })
}

// DELETE /api/menus/submenus/:id
async function handleDeleteSubMenu(request, env, subMenuId) {
  await getAuthUser(request, env)
  const info = await dbRun(env, 'DELETE FROM sub_menus WHERE id=?', [subMenuId])
  return json({ deleted: info.changes })
}

// ====== 卡片相关 /api/cards... ======
async function handleGetCards(request, env, menuId) {
  const url = new URL(request.url)
  const subMenuId = url.searchParams.get('subMenuId')

  let sql, params
  if (subMenuId) {
    sql = 'SELECT * FROM cards WHERE sub_menu_id = ? ORDER BY "order"'
    params = [subMenuId]
  } else {
    sql = 'SELECT * FROM cards WHERE menu_id = ? AND sub_menu_id IS NULL ORDER BY "order"'
    params = [menuId]
  }

  const rows = await dbAll(env, sql, params)
  const baseUrl = env.UPLOAD_PUBLIC_URL || ''
  for (const card of rows) {
    if (!card.custom_logo_path) {
      card.display_logo =
        card.logo_url ||
        (card.url ? card.url.replace(/\/+$/, '') + '/favicon.ico' : '/default-favicon.png')
    } else {
      card.display_logo = baseUrl + card.custom_logo_path
    }
  }
  return json(rows)
}

// POST /api/cards
async function handleAddCard(request, env) {
  await getAuthUser(request, env)
  const body = await request.json()
  const {
    menu_id,
    sub_menu_id,
    title,
    url,
    logo_url,
    custom_logo_path,
    desc,
    order,
  } = body
  const safeLogoUrl = logo_url ?? null
  const safeCustomLogoPath = custom_logo_path ?? null
  const safeDesc = desc ?? null
  const info = await dbRun(
    env,
    'INSERT INTO cards (menu_id, sub_menu_id, title, url, logo_url, custom_logo_path, desc, "order") VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      menu_id,
      sub_menu_id || null,
      title,
      url,
      safeLogoUrl,
      safeCustomLogoPath,
      safeDesc,
      order || 0,
    ],
  )
  return json({ id: info.lastID })
}

// PUT /api/cards/:id
async function handleUpdateCard(request, env, id) {
  await getAuthUser(request, env)
  const body = await request.json()
  const {
    menu_id,
    sub_menu_id,
    title,
    url,
    logo_url,
    custom_logo_path,
    desc,
    order,
  } = body
  const safeLogoUrl = logo_url ?? null
  const safeCustomLogoPath = custom_logo_path ?? null
  const safeDesc = desc ?? null
  const info = await dbRun(
    env,
    'UPDATE cards SET menu_id=?, sub_menu_id=?, title=?, url=?, logo_url=?, custom_logo_path=?, desc=?, "order"=? WHERE id=?',
    [
      menu_id,
      sub_menu_id || null,
      title,
      url,
      safeLogoUrl,
      safeCustomLogoPath,
      safeDesc,
      order || 0,
      id,
    ],
  )
  return json({ changed: info.changes })
}

// DELETE /api/cards/:id
async function handleDeleteCard(request, env, id) {
  await getAuthUser(request, env)
  const info = await dbRun(env, 'DELETE FROM cards WHERE id=?', [id])
  return json({ deleted: info.changes })
}

// ====== 广告 /api/ads... ======
async function handleAds(request, env) {
  const url = new URL(request.url)
  const { method } = request

  if (method === 'GET') {
    const page = url.searchParams.get('page')
    const pageSize = url.searchParams.get('pageSize')
    if (!page && !pageSize) {
      const rows = await dbAll(env, 'SELECT * FROM ads', [])
      return json(rows)
    } else {
      const pageNum = parseInt(page) || 1
      const size = parseInt(pageSize) || 10
      const offset = (pageNum - 1) * size
      const countRow = await dbGet(env, 'SELECT COUNT(*) as total FROM ads')
      const rows = await dbAll(
        env,
        'SELECT * FROM ads LIMIT ? OFFSET ?',
        [size, offset],
      )
      return json({
        total: countRow?.total || 0,
        page: pageNum,
        pageSize: size,
        data: rows,
      })
    }
  }

  if (method === 'POST') {
    await getAuthUser(request, env)
    const { position, img, url: link } = await request.json()
    const info = await dbRun(
      env,
      'INSERT INTO ads (position, img, url) VALUES (?, ?, ?)',
      [position, img, link],
    )
    return json({ id: info.lastID })
  }

  if (method === 'PUT') {
    await getAuthUser(request, env)
    const { pathname } = new URL(request.url)
    const params = match(pathname, '/api/ads/:id')
    const { img, url: link } = await request.json()
    const info = await dbRun(
      env,
      'UPDATE ads SET img=?, url=? WHERE id=?',
      [img, link, params.id],
    )
    return json({ changed: info.changes })
  }

  if (method === 'DELETE') {
    await getAuthUser(request, env)
    const { pathname } = new URL(request.url)
    const params = match(pathname, '/api/ads/:id')
    const info = await dbRun(env, 'DELETE FROM ads WHERE id=?', [params.id])
    return json({ deleted: info.changes })
  }

  return json({ error: 'Method Not Allowed' }, 405)
}

// ====== 友链 /api/friends... ======
async function handleFriends(request, env) {
  const url = new URL(request.url)
  const { method } = request

  if (method === 'GET') {
    const page = url.searchParams.get('page')
    const pageSize = url.searchParams.get('pageSize')
    if (!page && !pageSize) {
      const rows = await dbAll(env, 'SELECT * FROM friends', [])
      return json(rows)
    } else {
      const pageNum = parseInt(page) || 1
      const size = parseInt(pageSize) || 10
      const offset = (pageNum - 1) * size
      const countRow = await dbGet(env, 'SELECT COUNT(*) as total FROM friends')
      const rows = await dbAll(
        env,
        'SELECT * FROM friends LIMIT ? OFFSET ?',
        [size, offset],
      )
      return json({
        total: countRow?.total || 0,
        page: pageNum,
        pageSize: size,
        data: rows,
      })
    }
  }

  if (method === 'POST') {
    await getAuthUser(request, env)
    const { title, url: link, logo } = await request.json()
    const info = await dbRun(
      env,
      'INSERT INTO friends (title, url, logo) VALUES (?, ?, ?)',
      [title, link, logo],
    )
    return json({ id: info.lastID })
  }

  if (method === 'PUT') {
    await getAuthUser(request, env)
    const { pathname } = new URL(request.url)
    const params = match(pathname, '/api/friends/:id')
    const { title, url: link, logo } = await request.json()
    const info = await dbRun(
      env,
      'UPDATE friends SET title=?, url=?, logo=? WHERE id=?',
      [title, link, logo, params.id],
    )
    return json({ changed: info.changes })
  }

  if (method === 'DELETE') {
    await getAuthUser(request, env)
    const { pathname } = new URL(request.url)
    const params = match(pathname, '/api/friends/:id')
    const info = await dbRun(env, 'DELETE FROM friends WHERE id=?', [params.id])
    return json({ deleted: info.changes })
  }

  return json({ error: 'Method Not Allowed' }, 405)
}

// ====== 用户 /api/users... ======
async function handleUsers(request, env) {
  const url = new URL(request.url)
  const { pathname } = url
  const { method } = request

  if (method === 'GET' && pathname === '/api/users/profile') {
    const user = await getAuthUser(request, env)
    const row = await dbGet(
      env,
      'SELECT id, username FROM users WHERE id = ?',
      [user.id],
    )
    if (!row) return json({ message: '用户不存在' }, 404)
    return json({ data: row })
  }

  if (method === 'GET' && pathname === '/api/users/me') {
    const user = await getAuthUser(request, env)
    const row = await dbGet(
      env,
      'SELECT id, username, last_login_time, last_login_ip FROM users WHERE id = ?',
      [user.id],
    )
    if (!row) return json({ message: '用户不存在' }, 404)
    return json({
      last_login_time: row.last_login_time,
      last_login_ip: row.last_login_ip,
    })
  }

  if (method === 'PUT' && pathname === '/api/users/password') {
    const user = await getAuthUser(request, env)
    const { oldPassword, newPassword } = await request.json()
    if (!oldPassword || !newPassword) {
      return json({ message: '请提供旧密码和新密码' }, 400)
    }
    if (newPassword.length < 6) {
      return json({ message: '新密码长度至少6位' }, 400)
    }
    const row = await dbGet(env, 'SELECT password FROM users WHERE id = ?', [user.id])
    if (!row) return json({ message: '用户不存在' }, 404)

    const validOld = await bcrypt.compare(oldPassword, row.password)
    if (!validOld) return json({ message: '旧密码错误' }, 400)

    const newHash = await bcrypt.hash(newPassword, 10)
    await dbRun(env, 'UPDATE users SET password = ? WHERE id = ?', [newHash, user.id])
    return json({ message: '密码修改成功' })
  }

  if (method === 'GET' && pathname === '/api/users') {
    await getAuthUser(request, env)
    const page = url.searchParams.get('page')
    const pageSize = url.searchParams.get('pageSize')
    if (!page && !pageSize) {
      const users = await dbAll(env, 'SELECT id, username FROM users', [])
      return json({ data: users })
    } else {
      const pageNum = parseInt(page) || 1
      const size = parseInt(pageSize) || 10
      const offset = (pageNum - 1) * size
      const countRow = await dbGet(env, 'SELECT COUNT(*) as total FROM users')
      const users = await dbAll(
        env,
        'SELECT id, username FROM users LIMIT ? OFFSET ?',
        [size, offset],
      )
      return json({
        total: countRow?.total || 0,
        page: pageNum,
        pageSize: size,
        data: users,
      })
    }
  }

  return json({ error: 'Not Found' }, 404)
}

// ====== 上传 /api/upload（使用 R2） ======
async function handleUpload(request, env) {
  const form = await request.formData()
  const file = form.get('logo')
  if (!(file instanceof File)) {
    return json({ error: 'No file uploaded' }, 400)
  }

  if (!env.UPLOAD_BUCKET) {
    return json({ error: 'R2 未配置，无法上传文件' }, 500)
  }

  const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : ''
  const key = `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`

  await env.UPLOAD_BUCKET.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
  })

  const baseUrl = env.UPLOAD_PUBLIC_URL || ''
  const url = baseUrl + key

  return json({ filename: key, url })
}

// ====== 主入口 ======
export default {
  async fetch(request, env, ctx) {
    const { method } = request
    const url = new URL(request.url)
    const { pathname } = url

    // 处理 CORS 预检
    if (method === 'OPTIONS') {
      return noContent()
    }

    if (!pathname.startsWith('/api')) {
      if (env.ASSETS) {
        let res = await env.ASSETS.fetch(request)
        if (res.status === 404 && !pathname.includes('.')) {
          const indexUrl = new URL('/', request.url)
          res = await env.ASSETS.fetch(new Request(indexUrl))
        }
        return res
      }
      return new Response('Not Found', { status: 404 })
    }

    try {
      // 登录
      if (method === 'POST' && pathname === '/api/login') {
        return await handleLogin(request, env)
      }

      // 菜单
      if (method === 'GET' && pathname === '/api/menus') {
        return await handleGetMenus(request, env)
      }
      let params
      if ((params = match(pathname, '/api/menus/:id/submenus'))) {
        if (method === 'GET') return await handleGetSubMenus(request, env, params.id)
        if (method === 'POST') return await handleAddSubMenu(request, env, params.id)
      }
      if ((params = match(pathname, '/api/menus/:id'))) {
        if (method === 'PUT') return await handleUpdateMenu(request, env, params.id)
        if (method === 'DELETE') return await handleDeleteMenu(request, env, params.id)
      }
      if (method === 'POST' && pathname === '/api/menus') {
        return await handleAddMenu(request, env)
      }
      if ((params = match(pathname, '/api/menus/submenus/:id'))) {
        if (method === 'PUT') return await handleUpdateSubMenu(request, env, params.id)
        if (method === 'DELETE') return await handleDeleteSubMenu(request, env, params.id)
      }

      // 卡片
      if ((params = match(pathname, '/api/cards/:menuId'))) {
        if (method === 'GET') return await handleGetCards(request, env, params.menuId)
        if (method === 'PUT') return await handleUpdateCard(request, env, params.menuId)
        if (method === 'DELETE') return await handleDeleteCard(request, env, params.menuId)
      }
      if (method === 'POST' && pathname === '/api/cards') {
        return await handleAddCard(request, env)
      }

      // 广告
      if (pathname === '/api/ads' || match(pathname, '/api/ads/:id')) {
        return await handleAds(request, env)
      }

      // 友链
      if (pathname === '/api/friends' || match(pathname, '/api/friends/:id')) {
        return await handleFriends(request, env)
      }

      // 用户
      if (pathname.startsWith('/api/users')) {
        return await handleUsers(request, env)
      }

      // 上传
      if (method === 'POST' && pathname === '/api/upload') {
        return await handleUpload(request, env)
      }

      return json({ error: 'Not Found' }, 404)
    } catch (e) {
      const status = e.status || 500
      return json({ error: e.message || '服务器错误' }, status)
    }
  },
}
