// Maybe monad using discriminated unions
export type Maybe<T> = { type: 'just'; value: T } | { type: 'nothing' }

export function Just<T>(a: T): Maybe<T> {
  return {
    type: 'just',
    value: a
  }
}

export function Nothing<T>(): Maybe<T> {
  return {
    type: 'nothing'
  }
}

export interface MaybeMatchers<T, U, V> {
  just: (v: T) => U
  nothing: () => V
}
