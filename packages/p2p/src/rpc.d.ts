import type { Peer, CallOptions } from './peer.js'

export interface StandardSchema<Input = unknown, Output = Input> {
  readonly '~standard': {
    readonly version: 1
    readonly vendor: string
    readonly validate: (value: unknown) => { readonly value: Output; readonly issues?: undefined } | { readonly issues: ReadonlyArray<unknown> } | Promise<{ readonly value: Output; readonly issues?: undefined } | { readonly issues: ReadonlyArray<unknown> }>
    readonly types?: { readonly input: Input; readonly output: Output }
  }
}
export type Parser<T = unknown> = ((value: unknown) => T | Promise<T>) | { parse(value: unknown): T | Promise<T> } | StandardSchema<unknown, T>
export type ParserOutput<S> = S extends StandardSchema<unknown, infer O> ? O
  : S extends (...args: never[]) => infer O ? Awaited<O>
  : S extends { parse(...args: never[]): infer O } ? Awaited<O> : never
export type ParserInput<S> = S extends StandardSchema<infer I, unknown> ? I : ParserOutput<S>
export interface ProcedureContext<I = unknown> {
  input: I
  peer: Peer
  appId: string | null
  grants: import('./index.js').Grants
  signal: AbortSignal
}
export type Kind = 'unary' | 'stream'
export interface Procedure<I = unknown, O = unknown, K extends Kind = Kind> {
  (params: unknown, context: Omit<ProcedureContext<I>, 'input'>): K extends 'stream' ? AsyncIterable<unknown> : Promise<unknown>
  /** Type-only inference marker, absent at runtime. */
  readonly __procedureTypes?: { input: I; output: O; kind: K }
}
export type JsonResult<T> = T extends string | number | boolean | null ? T
  : T extends (...args: any[]) => unknown ? never
  : T extends readonly (infer V)[] ? readonly JsonResult<V>[]
  : T extends object ? { [P in keyof T]: JsonResult<T[P]> } : never
export interface ProcedureBuilder<I = unknown, WireOutput = unknown, O = never, Input = I> {
  input<S extends Parser>(schema: S): ProcedureBuilder<ParserOutput<S>, WireOutput, O, ParserInput<S>>
  output<S extends Parser>(schema: S & (ParserOutput<S> extends JsonResult<ParserOutput<S>> ? unknown : never) & (ParserOutput<S> extends ParserInput<S> ? unknown : never)): ProcedureBuilder<I, ParserInput<S>, ParserOutput<S>, Input>
  query<R extends WireOutput>(handler: (context: ProcedureContext<I>) => (R & JsonResult<R>) | Promise<R & JsonResult<R>>): Procedure<Input, [O] extends [never] ? Awaited<R> : O, 'unary'>
  mutation<R extends WireOutput>(handler: (context: ProcedureContext<I>) => (R & JsonResult<R>) | Promise<R & JsonResult<R>>): Procedure<Input, [O] extends [never] ? Awaited<R> : O, 'unary'>
  stream<R extends WireOutput>(handler: (context: ProcedureContext<I>) => AsyncIterable<R & JsonResult<R>> | Iterable<R & JsonResult<R>>): Procedure<Input, [O] extends [never] ? R : O, 'stream'>
}
export const procedure: ProcedureBuilder
export interface MethodDescriptor { readonly kind: Kind; readonly operation: 'query' | 'mutation' | 'stream'; readonly input?: Parser; readonly output?: Parser }
export interface Contract<M = Record<string, Procedure>> {
  readonly name: string
  readonly version: number
  readonly methods: { readonly [P in keyof M]: MethodDescriptor }
  /** Type-only inference marker, absent at runtime. */
  readonly __methods?: M
}
export interface Capability<M = Record<string, Procedure>> {
  readonly name: string
  readonly version: number
  readonly methods: M
  readonly defaultGrants: readonly (keyof M & string)[]
  readonly contract: Contract<M>
  onAttach?(node: import('./index.js').UnstoppableNode): void | Promise<void>
  onPeer?(peer: Peer): void | Promise<void>
  onDetach?(): void | Promise<void>
}
export type InputArgs<I> = undefined extends I ? [input?: I, options?: CallOptions] : [input: I, options?: CallOptions]
export type Client<M> = {
  readonly [P in keyof M]: M[P] extends Procedure<infer I, infer O, infer K>
    ? (...args: InputArgs<I>) => K extends 'stream' ? AsyncIterable<O> : Promise<O>
    : never
}
export function defineCapability<M extends Record<string, Procedure>>(options: {
  name: string; version: number; methods: M; defaultGrants?: readonly (keyof M & string)[]
  onAttach?: Capability<M>['onAttach']; onPeer?: Capability<M>['onPeer']; onDetach?: Capability<M>['onDetach']
}): Capability<M>
export function createClient<M>(peer: Peer, contract: Contract<M> | Capability<M>): Client<M>
export function procedureMetadata(handler: Function): MethodDescriptor | undefined
