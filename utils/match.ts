// match/caseOf on Maybe and Either types

import { Either, EitherMatchers } from './Either'
import { Maybe, MaybeMatchers } from './Maybe'

export function match<T, U, V>(v: Maybe<T>, matchers: MaybeMatchers<T, U, V>): U | V

export function match<L, R, U, V>(v: Either<L, R>, matchers: EitherMatchers<L, R, U, V>): U | V

export function match(v: any, matchers: any) {
  if (v.type === 'left') {
    return matchers.left(v.value)
  } else if (v.type === 'right') {
    return matchers.right(v.value)
  } else if (v.type === 'just') {
    return matchers.just(v.value)
  } else if (v.type === 'nothing') {
    return matchers.nothing()
  }
}
