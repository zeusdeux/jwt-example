import { errors as FaunaDBErrors, query as q } from 'faunadb'
import { sign as signJWT, SignOptions, verify as verifyJWT, VerifyOptions } from 'jsonwebtoken'
import { CustomError, ErrorType } from '../errors/CustomError'
import { Either, Left, Right } from '../utils/Either'
import { match } from '../utils/match'
import { Just, Maybe, Nothing } from '../utils/Maybe'
import { FaunaDBQueryResponse, getDBClient } from './db'

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
export async function verify(
  token: string,
  options: TokenVerifyOptions
): Promise<Either<CustomError, object>> {
  return match(await getBlacklistedToken(token), {
    left: async error => Left<CustomError, object>(error),
    right: async maybeBlacklistedToken =>
      match(maybeBlacklistedToken, {
        just: blacklistedToken => {
          console.log('Blacklisted token found ->', blacklistedToken) // tslint:disable-line:no-console
          return Left<CustomError, object>(
            new CustomError({ type: ErrorType.Unauthorized, details: 'Invalid token' })
          )
        },
        nothing: async () => {
          try {
            const defaultOptions: VerifyOptions = {
              algorithms: ['RS256'],
              audience: 'https://jwt-example.zdx.cat',
              issuer: 'https://jwt-example.zdx.cat'
            }

            // TODO: switch to async verify function
            const payload = verifyJWT(token, process.env.JWT_SIGNING_RS256_PUBLIC_KEY!, {
              ...defaultOptions,
              ...options
            }) as object
            return Right<CustomError, object>(payload)
          } catch (err) {
            return Left<CustomError, object>(
              new CustomError({ type: ErrorType.Unauthorized, cause: err })
            )
          }
        }
      })
  })
}

interface BlacklistedToken {
  token: string
  blacklistedAt: string
}
async function getBlacklistedToken(
  token: string
): Promise<Either<CustomError, Maybe<BlacklistedToken>>> {
  try {
    const db = getDBClient()
    const { data: blacklistedToken } = (await db.query(
      q.Get(
        q.Match(q.Index(process.env.JWT_EXAMPLE_DB_JWT_BY_TOKEN_FROM_BLACKLIST_INDEX_NAME!), token)
      )
    )) as FaunaDBQueryResponse<BlacklistedToken>

    return Right(Just(blacklistedToken))
  } catch (err) {
    // token not found in blacklist
    if (err instanceof FaunaDBErrors.NotFound) {
      console.log(`User not found.`) // tslint:disable-line:no-console
      return Right(Nothing())
    }

    return Left(new CustomError({ type: ErrorType.InternalServerError, cause: err }))
  }
}
