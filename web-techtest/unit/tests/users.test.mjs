import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const jsonResponse = (status, body) => new Response(body == null ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

let mod, http
beforeEach(async () => {
  vi.resetModules()
  vi.stubGlobal('fetch', vi.fn())
  ;({ http } = await import('../mocks/fetch.js'))
  http._reset()
  mod = await import('../../app/users.js')
})
afterEach(() => vi.unstubAllGlobals())

describe('users API client', () => {
  it('sends credentials and the bearer, and maps every verb', async () => {
    http.setTokens({ access: 'tok' })
    fetch.mockResolvedValue(jsonResponse(200, []))
    await mod.usersApi.list()
    await mod.usersApi.me()
    await mod.usersApi.create({ email: 'a@b.cd' })
    await mod.usersApi.update(7, { roles: ['Admin'] })
    fetch.mockResolvedValueOnce(jsonResponse(204, null))
    await expect(mod.usersApi.remove(7)).resolves.toBeNull()

    const calls = fetch.mock.calls.map(([url, init]) => `${init.method || 'GET'} ${url}`)
    expect(calls).toEqual(['GET /api/users', 'GET /api/users/me', 'POST /api/users', 'PUT /api/users/7', 'DELETE /api/users/7'])
    for (const [, init] of fetch.mock.calls) {
      expect(init.credentials).toBe('include')
      expect(init.headers.Authorization).toBe('Bearer tok')
    }
    expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({ email: 'a@b.cd' })
  })

  it('a 403 is an error message, never a sign-out', async () => {
    http.setTokens({ access: 'tok' })
    fetch.mockResolvedValue(jsonResponse(403, { message: 'Admin role required' }))
    await expect(mod.usersApi.create({ email: 'a@b.cd' })).rejects.toThrow('Admin role required')
    expect(http.post).not.toHaveBeenCalled()
  })

  it('a 401 refreshes once and retries', async () => {
    http.setTokens({ access: 'stale' })
    fetch.mockResolvedValueOnce(jsonResponse(401, { message: 'Token Expired Error' })).mockResolvedValueOnce(jsonResponse(200, [{ id: 1 }]))
    http.post.mockResolvedValue({ data: { access_token: 'fresh' } })
    await expect(mod.usersApi.list()).resolves.toEqual([{ id: 1 }])
    expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer fresh')
  })
})

describe('isAdmin', () => {
  it('reads roles as an array or a comma string', () => {
    expect(mod.isAdmin({ roles: ['Admin'] })).toBe(true)
    expect(mod.isAdmin({ roles: 'TestGroup,Admin' })).toBe(true)
    expect(mod.isAdmin({ roles: ['Viewer'] })).toBe(false)
    expect(mod.isAdmin(null)).toBe(false)
  })
  it('lists the three roles', () => expect(mod.ROLES).toEqual(['Admin', 'TestGroup', 'Viewer']))
})
