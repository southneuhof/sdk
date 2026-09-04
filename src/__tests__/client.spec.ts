import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import type { InferRequestType, InferResponseType } from 'hono/client'
import { createRpcClient, type RpcClient } from '../client'

describe('sdk createRpcClient', () => {
  it('keeps model and bare Hono client paths', () => {
    const client = createRpcClient('http://localhost:8787')

    expect(client.health.$get).toBeTypeOf('function')
    expect(client.me.$get).toBeTypeOf('function')
    expect(client.users.list.$get).toBeTypeOf('function')
    expect(client.roles.detail[':id'].$get).toBeTypeOf('function')
    expect(client.api.auth['sign-out'].$post).toBeTypeOf('function')
    expect(client.files.object.$delete).toBeTypeOf('function')
  })

  it('keeps the public request and response types honest', () => {
    const client = createRpcClient('http://localhost:8787')
    const typedClient: RpcClient = client

    function proofCalls(proofClient: RpcClient) {
      proofClient.users.list.$get({ query: { page: '1', limit: '20' } })
      proofClient.users.detail[':id'].$get({ param: { id: 'user-1' } })
      proofClient.users.create.$post({ json: { name: 'Ada', email: 'ada@example.test', password: 'password-123', roleIds: ['role-1'] } })
      proofClient.users.update[':id'].$patch({ param: { id: 'user-1' }, json: { name: 'Ada' } })
      proofClient.roles.detail[':id'].$get({ param: { id: 'role-1' } })
      proofClient.me.$get()
      proofClient.api.auth['sign-out'].$post()
      proofClient.files.$get({ query: { prefix: 'uploads/' } })

      // @ts-expect-error missing root route must stay absent
      proofClient.missing.$get()
      // @ts-expect-error removed sample route must stay absent
      proofClient.products.list.$get()
      // @ts-expect-error id param is required
      proofClient.users.detail[':id'].$get()
      // @ts-expect-error list does not support POST
      proofClient.users.list.$post({ query: { page: '1' } })
      // @ts-expect-error create requires its JSON body
      proofClient.users.create.$post({})
      // @ts-expect-error auth sign-out does not support GET
      proofClient.api.auth['sign-out'].$get()

      return proofClient
    }

    expect(proofCalls).toBeTypeOf('function')

    type ListResponse = InferResponseType<RpcClient['users']['list']['$get'], 200>
    type CreateRequest = InferRequestType<RpcClient['users']['create']['$post']>
    type UpdateRequest = InferRequestType<RpcClient['users']['update'][':id']['$patch']>

    expectTypeOf<ListResponse>().toMatchTypeOf<{ data: unknown[] }>()
    expectTypeOf<CreateRequest>().toMatchTypeOf<{ json: { name: string; email: string } }>()
    expectTypeOf<UpdateRequest>().toMatchTypeOf<{ param: { id: string } }>()
  })

  it('keeps runtime URLs, nested paths, and credentials unchanged', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    try {
      const client = createRpcClient('http://localhost:8787', { headers: { 'x-test': 'sdk' } })
      await client.users.list.$get({ query: { page: '1', limit: '20' } })
      await client.api.auth['sign-out'].$post()
      await client.files.object.$get()

      expect(fetchMock).toHaveBeenCalledTimes(3)
      const requests = fetchMock.mock.calls.map(([input, init]) => ({ url: String(input), init }))
      expect(requests.map(({ url }) => url)).toEqual([
        'http://localhost:8787/users/list?page=1&limit=20',
        'http://localhost:8787/api/auth/sign-out',
        'http://localhost:8787/files/object',
      ])
      expect(requests.every(({ init }) => init?.credentials === 'include')).toBe(true)
      expect(requests.every(({ init }) => new Headers(init?.headers).get('x-test') === 'sdk')).toBe(true)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
