import { hc } from 'hono/client'
import type { ClientRequestOptions, Hono, Schema } from 'hono'
import type { BundleModels, DefinedModel, ModelRoute } from '@southneuhof/sprindle/model'
import type { SprindleInstallSchema } from '@southneuhof/sprindle/hono'
import type { modules } from '@southneuhof/api/routes'

type HcOf<T extends Hono<any, any, any>> = ReturnType<typeof hc<T>>
type RegisteredInstallable = BundleModels<typeof modules>
type RegisteredModel = Extract<RegisteredInstallable, DefinedModel>
type RegisteredBareRoute = Extract<RegisteredInstallable, ModelRoute>

type StripLeadingSlash<TPath extends string> = TPath extends `/${infer TName}` ? TName : TPath

type ModelClients<TModels extends DefinedModel> = {
  [TPath in TModels['path'] as StripLeadingSlash<TPath>]: HcOf<Extract<TModels, { path: TPath }>['route']>
}

type BareRouteSchema<TRoute extends ModelRoute> = SprindleInstallSchema<readonly [TRoute]> extends infer TSchema extends Schema ? TSchema : never
type BareRouteClient<TRoute extends ModelRoute> = HcOf<Hono<any, BareRouteSchema<TRoute>>>
type BareRouteClients<TRoutes extends ModelRoute> = TRoutes extends ModelRoute ? BareRouteClient<TRoutes> : never
type UnionToIntersection<T> = (T extends unknown ? (value: T) => void : never) extends (value: infer U) => void ? U : never
type BareClient = UnionToIntersection<BareRouteClients<RegisteredBareRoute>>

export type RpcClient = ModelClients<RegisteredModel> & BareClient

export function createRpcClient(baseUrl: string, options: ClientRequestOptions = {}): RpcClient {
  return hc(baseUrl, {
    ...options,
    init: {
      credentials: 'include',
      ...options.init,
    },
  }) as unknown as RpcClient
}
