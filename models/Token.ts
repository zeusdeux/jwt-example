import { sign as signJWT, SignOptions, verify as verifyJWT, VerifyOptions } from 'jsonwebtoken'
import { CustomError, ErrorType } from '../errors/CustomError'
import { Either, Left, Right } from '../utils/Either'
import { match } from '../utils/match'
import { getUserAndRefByEmail } from './User'

// const asyncVerify = promisify(verify)

type TokenCreateOptions = Pick<SignOptions, 'header' | 'notBefore' | 'expiresIn'> &
  Required<Pick<SignOptions, 'subject'>>

// function asyncSign(...args: ExtractArgTypes<typeof sign>): Promise<string> {
//   return new Promise((resolve, reject) => {
//     sign(...args, function(err, token) {
//       if (err) return reject(err)

//       resolve(token)
//     })
//   })
// }

// TODO: figure out if we should generate a new token for a user every
// time he or she logs in for e.g., say a user logs in and gets a
// token and then hits /login again immediately, do they get a new
// token? If they get a new token for each hit to /login, what happens
// on /logout for the same user?
// TODO: Maybe add interface for payload (?)
export async function create(
  payload: object,
  options: TokenCreateOptions
): Promise<Either<CustomError, string>> {
  try {
    const defaultOptions: SignOptions = {
      algorithm: 'RS256',
      expiresIn: '1h',
      audience: 'https://jwt-example.zdx.cat',
      issuer: 'https://jwt-example.zdx.cat'
    }

    // TODO: switch to an async sign function
    const token: string = signJWT(payload, process.env.JWT_SIGNING_RS256_PRIVATE_KEY!, {
      ...defaultOptions,
      ...options
    })
    return Right(token)
  } catch (err) {
    return Left(
      new CustomError({ type: ErrorType.InternalServerError, details: err.message, cause: err })
    )
  }
}

type TokenVerifyOptions = Pick<VerifyOptions, 'clockTolerance' | 'subject' | 'maxAge'>
// Algorithm:
// const token = verify(token, secret, ...) // this throws when it fails
// const isUserLoggedIn = lastLoggedInAt && lastLoggedOutAt && lastLoggedInAt > lastLoggedOutAt
// isValidToken = isUserLoggedIn &&
//                token.iat >= lastLoggedInAt
//
// With this algorithm, a token blacklist isn't necessary. Everything is based on timestamps.
// A logout anywhere automatically invalidates all existing tokens.
export async function verify(
  token: string,
  options: TokenVerifyOptions
): Promise<Either<CustomError, object>> {
  try {
    const defaultOptions: VerifyOptions = {
      algorithms: ['RS256'],
      audience: 'https://jwt-example.zdx.cat', // TODO: stick this in an env var
      issuer: 'https://jwt-example.zdx.cat' // TODO: stick this in an env var
    }

    // TODO: switch to async verify function
    const payload = verifyJWT(token, process.env.JWT_SIGNING_RS256_PUBLIC_KEY!, {
      ...defaultOptions,
      ...options
    }) as object & { sub: string; iat: number } // sub and iat come from JWT spec and sub is supplied in api/login.ts which is user.email

    return match(await getUserAndRefByEmail(payload.sub), {
      left: async error => Left<CustomError, object>(error),
      right: async maybeUserAndRef =>
        match(maybeUserAndRef, {
          nothing: () =>
            Left<CustomError, object>(new CustomError({ type: ErrorType.UserDoesNotExist })), // TODO: rethink this error. Maybe it's too much info
          just: async ([user]) => {
            // TODO: switch to date-fns for this maybe
            const lastLoggedInAt = user.lastLoggedInAt ? new Date(user.lastLoggedInAt).getTime() : 0
            const lastLoggedOutAt = user.lastLoggedOutAt
              ? new Date(user.lastLoggedOutAt).getTime()
              : 0
            const isUserLoggedIn = lastLoggedInAt > lastLoggedOutAt
            const isValidToken = isUserLoggedIn && payload.iat >= lastLoggedInAt

            if (isValidToken) {
              return Right<CustomError, object>(payload)
            }

            return Left<CustomError, object>(new CustomError({ type: ErrorType.Unauthorized }))
          }
        })
    })
  } catch (err) {
    return Left<CustomError, object>(new CustomError({ type: ErrorType.Unauthorized, cause: err }))
  }
}
