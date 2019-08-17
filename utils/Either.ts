// Either monad using discriminated unions
export type Either<L, R> = { type: 'left'; value: L } | { type: 'right'; value: R }

export function Left<L, R>(a: L): Either<L, R> {
  return {
    type: 'left',
    value: a
  }
}

export function Right<L, R>(b: R): Either<L, R> {
  return {
    type: 'right',
    value: b
  }
}

export interface EitherMatchers<L, R, U, V> {
  left: (v: L) => U
  right: (v: R) => V
}
