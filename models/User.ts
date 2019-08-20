import * as Joi from '@hapi/joi'
import * as bcrypt from 'bcryptjs'
import { errors as FaunaDBErrors, query as q } from 'faunadb'
import { v4 as uuidV4 } from 'uuid'
import { CustomError, ErrorType } from '../errors/CustomError'
import { Either, Left, Right } from '../utils/Either'
import { match } from '../utils/match'
import { Just, Maybe, Nothing } from '../utils/Maybe'
import { ExtractType } from '../utils/types'
import { getDBClient } from './db'

interface FaunaDBQueryResponse<T> {
  ref: {
    id: string
  }
  data: T
  ts: number
}

export interface User {
  _id: string
  email: string
  password: string
  firstName: string
  lastName: string
}

const UserSchema = Joi.object().keys({
  _id: Joi.string()
    .uuid({ version: 'uuidv4' })
    .required(),
  email: Joi.string()
    .email()
    .required(),
  password: Joi.string()
    .min(8)
    .required(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required()
})

// TODO: Switch to argon2 once https://github.com/zeit/node-file-trace/pull/53 is merged
async function hashPassword(password: ExtractType<User, 'password'>): Promise<string> {
  const salt = await bcrypt.genSalt(12)

  return bcrypt.hash(password, salt)
}

async function verifyPassword(
  password: ExtractType<User, 'password'>,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

export async function login({
  email,
  password
}: Pick<User, 'email' | 'password'>): Promise<Either<CustomError, User>> {
  const EmailAndPasswordDerivedSchema = Joi.object().keys({
    email: Joi.reach(UserSchema, ['email']),
    password: Joi.reach(UserSchema, ['password'])
  })
  const { error: argsValidationError } = Joi.validate(
    { email, password },
    EmailAndPasswordDerivedSchema,
    { abortEarly: false }
  )

  if (argsValidationError) {
    return Left(
      new CustomError(
        ErrorType.ValidationError,
        argsValidationError.details.map(deet => deet.message),
        argsValidationError
      )
    )
  }

  return match(await getUserByEmail(email), {
    left: async error => Left<CustomError, User>(error),
    right: async maybeUser =>
      match(maybeUser, {
        nothing: () => Left<CustomError, User>(new CustomError(ErrorType.Unauthorized)),
        just: async user => {
          const passwordVerified = await verifyPassword(password, user.password)

          return passwordVerified
            ? Right<CustomError, User>(user)
            : Left<CustomError, User>(
                new CustomError(ErrorType.Unauthorized, 'Incorrect credentials')
              )
        }
      })
  })
}

export async function create({
  email,
  password,
  firstName,
  lastName
}: Omit<User, '_id'>): Promise<Either<CustomError, User>> {
  return match(await getUserByEmail(email), {
    left: async error => Left<CustomError, User>(error),
    right: async maybeUser =>
      match(maybeUser, {
        just: _ => Left<CustomError, User>(new CustomError(ErrorType.UserAlreadyExists)),
        nothing: async () => {
          try {
            const user: User = {
              _id: uuidV4(),
              email,
              password,
              firstName,
              lastName
            }

            const userValidationResult = Joi.validate(user, UserSchema, { abortEarly: false })

            if (userValidationResult.error) {
              return Left<CustomError, User>(
                new CustomError(
                  ErrorType.ValidationError,
                  userValidationResult.error.details.map(deet => deet.message),
                  userValidationResult.error
                )
              )
            }

            const hashedPassword = await hashPassword(userValidationResult.value.password)
            const db = getDBClient()
            const { data: createdUser } = (await db.query(
              q.Create(q.Collection(process.env.JWT_EXAMPLE_DB_USER_CLASS_NAME!), {
                data: { ...userValidationResult.value, password: hashedPassword }
              })
            )) as FaunaDBQueryResponse<User>

            return Right<CustomError, User>(createdUser)
          } catch (err) {
            return Left<CustomError, User>(
              new CustomError(ErrorType.InternalServerError, err.message, err)
            )
          }
        }
      })
  })
}

async function getUserByEmail(
  email: ExtractType<User, 'email'>
): Promise<Either<CustomError, Maybe<User>>> {
  try {
    const db = getDBClient()
    const { data: user } = (await db.query(
      q.Get(q.Match(q.Index(process.env.JWT_EXAMPLE_DB_USER_BY_EMAIL_INDEX_NAME!), email))
    )) as FaunaDBQueryResponse<User>

    console.log(`User found with id ->`, user._id) // tslint:disable-line:no-console
    return Right(Just(user))
  } catch (err) {
    // no user with email found
    if (err instanceof FaunaDBErrors.NotFound) {
      console.log(`User not found.`) // tslint:disable-line:no-console
      return Right(Nothing())
    }
    return Left(new CustomError(ErrorType.InternalServerError, err))
  }
}
