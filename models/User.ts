import * as Joi from '@hapi/joi'
import * as bcrypt from 'bcryptjs'
import { Client, errors as FaunaDBErrors, query as q } from 'faunadb'
import { v4 as uuidV4 } from 'uuid'
import { Either, Left, Right } from '../utils/Either'
import { match } from '../utils/match'
import { ExtractType } from '../utils/types'

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

let dbClient: Client
function getDBClient(): Client {
  dbClient = dbClient || new Client({ secret: process.env.JWT_EXAMPLE_DB_KEY! })
  return dbClient
}

// TODO: Switch to argon2 once https://github.com/zeit/node-file-trace/pull/53 is merged
async function hashPassword(password: ExtractType<User, 'password'>): Promise<string> {
  const salt = await bcrypt.genSalt(12)

  return bcrypt.hash(password, salt)
}

// TODO: Figure out how to communicate error types so that we can set
// the correct HTTP response codes
// think objects tagged with enums as types more than custom errors
// for e.g., on NotFound error return an object of type ErrorObject
// that has a type field which is set to an enum that describes the
// type of error
export async function create({
  email,
  password,
  firstName,
  lastName
}: Omit<User, '_id'>): Promise<Either<Error, User>> {
  return match(await getUserByEmail(email), {
    left: async error => Left<Error, User>(error),
    right: async existingUser => {
      if (existingUser) {
        return Left<Error, User>(new Error('User already exists'))
      }

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
          return Left<Error, User>(userValidationResult.error)
        }

        const hashedPassword = await hashPassword(password)
        const db = getDBClient()
        const { data: createdUser } = (await db.query(
          q.Create(q.Collection(process.env.JWT_EXAMPLE_DB_USER_CLASS_NAME!), {
            data: { ...user, password: hashedPassword }
          })
        )) as FaunaDBQueryResponse<User>
        return Right<Error, User>(createdUser)
      } catch (err) {
        return Left<Error, User>(err)
      }
    }
  })
}

async function getUserByEmail(
  email: ExtractType<User, 'email'>
): Promise<Either<Error, User | null>> {
  try {
    const db = getDBClient()
    const { data: user } = (await db.query(
      q.Get(q.Match(q.Index(process.env.JWT_EXAMPLE_DB_USER_BY_EMAIL_INDEX_NAME!), email))
    )) as FaunaDBQueryResponse<User>

    console.log(`User with email ${email} found with id ->`, user._id) // tslint:disable-line:no-console
    return Right(user)
  } catch (err) {
    // no user with email found
    if (err instanceof FaunaDBErrors.NotFound) {
      console.log(`User with email ${email} not found.`) // tslint:disable-line:no-console
      return Right(null)
    }
    return Left(err)
  }
}
