import { hc } from 'hono/client'
import type { ClientRequestOptions, Hono, Schema, TypedResponse } from 'hono'
import type { FileRouteDefinition } from '@southneuhof/sprindle'
import type { RouteContract } from '@southneuhof/api/routes-contract'

type RpcError = { error: string; message?: string; issues?: Array<{ field?: string; message: string }> }
type Endpoint<TInput, TOutput, TStatus extends number> = { input: TInput; output: TOutput; outputFormat: 'json'; status: TStatus }
type Result<TInput, TOutput, TKind extends string> = Awaited<TOutput> extends infer TResponse
  ? TResponse extends TypedResponse<infer TData, infer TStatus, infer TFormat>
    ? { input: TInput; output: TData; outputFormat: TFormat; status: TStatus } | Endpoint<TInput, RpcError, ErrorStatus<TKind>>
    : Endpoint<TInput, TResponse, TKind extends 'create' ? 201 : 200> | Endpoint<TInput, RpcError, ErrorStatus<TKind>>
  : never
type ErrorStatus<TKind extends string> = TKind extends 'create' ? 400 | 401 | 403 | 409 | 422 | 500 : TKind extends 'detail' | 'update' | 'delete' ? 400 | 401 | 403 | 404 | 500 : 400 | 401 | 403 | 500
type Params<TPath extends string> = TPath extends `${string}:${infer TParam}/${infer TRest}` ? { [K in TParam]: string } & Params<`/${TRest}`> : TPath extends `${string}:${infer TParam}` ? { [K in TParam]: string } : {}
type DefaultInput<TKind extends string> = TKind extends 'list' ? { query: { page?: string; limit?: string; search?: string; sort?: string; order?: string } & Record<string, string | undefined> } : { query?: Record<string, string | undefined> }
type KnownInput<TInput, TKind extends string> = TKind extends 'create' | 'update' ? { json: TInput } : unknown extends TInput ? DefaultInput<TKind> : TInput
type Input<TPath extends string, TInput, TKind extends string> = keyof Params<TPath> extends never ? KnownInput<TInput, TKind> : KnownInput<TInput, TKind> & { param: Params<TPath> }
type ContractEntry<TContract> = TContract extends { path: infer TPath extends string; method: infer TMethod extends string; definition: infer TDefinition }
  ? TDefinition extends FileRouteDefinition<infer TInput, infer TOutput, infer TKind>
    ? { [P in TPath]: { [M in `$${TMethod}`]: Result<Input<TPath, TInput, TKind>, TOutput, TKind> } }
    : never
  : never
type UnionToIntersection<T> = (T extends unknown ? (value: T) => void : never) extends (value: infer U) => void ? U : never
type AppSchema = UnionToIntersection<ContractEntry<RouteContract>> extends infer TSchema extends Schema ? TSchema : never

export type RpcClient = ReturnType<typeof hc<Hono<any, AppSchema>>>

export function createRpcClient(baseUrl: string, options: ClientRequestOptions = {}): RpcClient {
  return hc<Hono<any, AppSchema>>(baseUrl, { ...options, init: { credentials: 'include', ...options.init } })
}
