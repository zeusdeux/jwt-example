import { sign, SignOptions, verify } from 'jsonwebtoken'
import { CustomError, ErrorType } from '../errors/CustomError'
import { Either, Left, Right } from '../utils/Either'

// const asyncVerify = promisify(verify)

type TokenCreateOptions = Omit<
  SignOptions,
  | 'algorithm'
  | 'encoding'
  | 'audience'
  | 'issuer'
  | 'keyid'
  | 'subject'
  | 'jwtid'
  | 'mutatePayload'
  | 'noTimestamp'
> &
  Required<Pick<SignOptions, 'subject'>>

// function asyncSign(...args: ExtractArgTypes<typeof sign>): Promise<string> {
//   return new Promise((resolve, reject) => {
//     sign(...args, function(err, token) {
//       if (err) return reject(err)

//       resolve(token)
//     })
//   })
// }

export async function create(
  payload: object = {},
  options: TokenCreateOptions
): Promise<Either<CustomError, string>> {
  try {
    const defaultOptions: SignOptions = {
      algorithm: 'RS256',
      expiresIn: '1h',
      audience: 'https://jwt-example.zdx.cat',
      issuer: 'https://jwt-example.zdx.cat'
    }

    // TODO: switch to an async sign
    const token: string = sign(payload, process.env.JWT_SIGNING_RS256_PRIVATE_KEY!, {
      ...defaultOptions,
      ...options
    })
    return Right(token)
  } catch (err) {
    return Left(new CustomError(ErrorType.InternalServerError, err.message, err))
  }
}
