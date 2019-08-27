import * as Joi from '@hapi/joi'
import * as bcrypt from 'bcryptjs'
import { query as q } from 'faunadb'
import { v4 as uuidV4 } from 'uuid'
import { CustomError, ErrorType } from '../errors/CustomError'
import { Either, Left, Right } from '../utils/Either'
import { match } from '../utils/match'
import { Just, Maybe, Nothing } from '../utils/Maybe'
import { ExtractType } from '../utils/types'
import { FaunaDBQueryResponse, getDBClient } from './db'
import { verify as verifyToken } from './Token'
import { getUserAndRefByEmail, updateUser, User } from './User.helpers'

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
  lastName: Joi.string().required(),
  createdAt: Joi.date()
    .iso()
    .required(),
  updatedAt: Joi.date()
    .iso()
    .required(),
  deleteAt: Joi.date()
    .iso()
    .optional(),
  lastLoggedInAt: Joi.date()
    .iso()
    .optional(),
  lastLoggedOutAt: Joi.date()
    .iso()
    .optional()
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
  const lastLoggedInAt = new Date().toISOString()

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
      new CustomError({
        type: ErrorType.ValidationError,
        details: argsValidationError.details.map(deet => deet.message),
        cause: argsValidationError
      })
    )
  }

  return match(await getUserAndRefByEmail(email), {
    left: async error => Left<CustomError, User>(error),
    right: async maybeUserAndRef =>
      match(maybeUserAndRef, {
        nothing: () => Left<CustomError, User>(new CustomError({ type: ErrorType.Unauthorized })),
        just: async ([user, ref]) => {
          const passwordVerified = await verifyPassword(password, user.password)

          if (passwordVerified) {
            // update lastLoggedInAt
            return match(await updateUser({ ...user, lastLoggedInAt }, ref), {
              left: error => Left<CustomError, User>(error),
              right: updatedUser => Right<CustomError, User>(updatedUser)
            })
          }

          return Left<CustomError, User>(
            new CustomError({ type: ErrorType.Unauthorized, details: 'Incorrect credentials' })
          )
        }
      })
  })
}

export async function logout(token: string): Promise<Maybe<CustomError>> {
  const lastLoggedOutAt = new Date().toISOString()

  return match(await verifyToken(token), {
    left: error => Just(error),
    right: async tokenPayload => {
      const { sub: email } = tokenPayload

      return match(await getUserAndRefByEmail(email), {
        left: error => Just(error),
        right: maybeUserAndRef =>
          match(maybeUserAndRef, {
            nothing: () =>
              Just(
                new CustomError({
                  type: ErrorType.Unauthorized,
                  cause: new CustomError({ type: ErrorType.UserDoesNotExist })
                })
              ),
            just: async ([user, ref]) => {
              const updatedUser: User = {
                ...user,
                lastLoggedOutAt
              }

              return match(await updateUser(updatedUser, ref), {
                left: error => Just(error),
                right: () => Nothing<CustomError>()
              })
            }
          })
      })
    }
  })
}

export async function create({
  email,
  password,
  firstName,
  lastName
}: Pick<User, 'email' | 'password' | 'firstName' | 'lastName'>): Promise<
  Either<CustomError, User>
> {
  return match(await getUserAndRefByEmail(email), {
    left: async error => Left<CustomError, User>(error),
    right: async maybeUserAndRef =>
      match(maybeUserAndRef, {
        // TODO: if the user already exists but is deleted, update the
        // user with new data and set deleteAt, lastLoggedInAt, etc to
        // null (thus deleting em) and set createdAt to a timestamp from now
        just: _ => Left<CustomError, User>(new CustomError({ type: ErrorType.UserAlreadyExists })),
        nothing: async () => {
          try {
            const createdAt = new Date().toISOString()
            const user: User = {
              _id: uuidV4(),
              email,
              password,
              firstName,
              lastName,
              createdAt,
              updatedAt: createdAt
            }

            const userValidationResult = Joi.validate(user, UserSchema, { abortEarly: false })

            if (userValidationResult.error) {
              return Left<CustomError, User>(
                new CustomError({
                  type: ErrorType.ValidationError,
                  details: userValidationResult.error.details.map(deet => deet.message),
                  cause: userValidationResult.error
                })
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
              new CustomError({
                type: ErrorType.InternalServerError,
                cause: err
              })
            )
          }
        }
      })
  })
}

async function updateUser(user: User, dbReference: string): Promise<Either<CustomError, User>> {
  try {
    const db = getDBClient()

    const { data: updatedUser } = (await db.query(
      q.Update(q.Ref(q.Collection(process.env.JWT_EXAMPLE_DB_USER_CLASS_NAME!), dbReference), {
        data: { ...user, updatedAt: new Date().toISOString() }
      })
    )) as FaunaDBQueryResponse<User>

    return Right<CustomError, User>(updatedUser)
  } catch (err) {
    return Left<CustomError, User>(
      new CustomError({
        type: ErrorType.InternalServerError,
        cause: err
      })
    )
  }
}

export async function getUserAndRefByEmail(
  email: ExtractType<User, 'email'>
): Promise<Either<CustomError, Maybe<[User, string]>>> {
  try {
    const db = getDBClient()
    const {
      data: user,
      ref: { id: ref }
    } = (await db.query(
      q.Get(q.Match(q.Index(process.env.JWT_EXAMPLE_DB_USER_BY_EMAIL_INDEX_NAME!), email))
    )) as FaunaDBQueryResponse<User>

    console.log(`User found with id ->`, user._id) // tslint:disable-line:no-console

    // if the user is deleted, return nothing
    // TODO: figure out a better thing to return here
    if (user.deletedAt) {
      return Right(Nothing())
    }

    return Right(Just([user, ref]))
  } catch (err) {
    // no user with email found
    if (err instanceof FaunaDBErrors.NotFound) {
      console.log(`User not found.`) // tslint:disable-line:no-console
      return Right(Nothing())
    }
    return Left(new CustomError({ type: ErrorType.InternalServerError, cause: err }))
  }
}
