import { errors as FaunaDBErrors, query as q } from 'faunadb'
import { CustomError, ErrorType } from '../errors/CustomError'
import { Either, Left, Right } from '../utils/Either'
import { Just, Maybe, Nothing } from '../utils/Maybe'
import { ExtractType } from '../utils/types'
import { FaunaDBQueryResponse, getDBClient } from './db'

export interface User {
  _id: string
  email: string
  password: string
  firstName: string
  lastName: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
  lastLoggedInAt?: string
  lastLoggedOutAt?: string
}

export async function updateUser(
  user: Omit<User, 'deletedAt' | 'lastLoggedInAt' | 'lastLoggedOutAt'> & {
    deletedAt?: string | null // null signifies deleting this key from object in db
    lastLoggedInAt?: string | null // null signifies deleting this key from object in db
    lastLoggedOutAt?: string | null // null signifies deleting this key from object in db
  },
  dbReference: string
): Promise<Either<CustomError, User>> {
  // tslint:disable-next-line:no-console
  console.log(
    `Updating user with id ${user._id}${
      process.env.NODE_ENV === 'production'
        ? '.'
        : ' -> ' + JSON.stringify(user, null, 2) + ' REF:' + dbReference
    }`
  )
  try {
    const updatedAt = new Date().toISOString()
    const db = getDBClient()
    const { data: updatedUser } = (await db.query(
      q.Update(q.Ref(q.Collection(process.env.JWT_EXAMPLE_DB_USER_CLASS_NAME!), dbReference), {
        data: { ...user, updatedAt }
      })
    )) as FaunaDBQueryResponse<User>

    // tslint:disable-next-line:no-console
    console.log(
      `User with id ${updatedUser._id} updated${
        process.env.NODE_ENV === 'production' ? '.' : ' -> ' + JSON.stringify(updatedUser, null, 2)
      }`
    )
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

interface GetUserOptions {
  fetchEvenDeleted: boolean
}
export async function getUserAndRefByEmail(
  email: ExtractType<User, 'email'>,
  options: GetUserOptions = { fetchEvenDeleted: false }
): Promise<Either<CustomError, Maybe<[User, string]>>> {
  // tslint:disable-next-line:no-console
  console.log(
    `Fetching user and ref${process.env.NODE_ENV === 'production' ? '.' : ' -> ' + email}`
  )
  try {
    const db = getDBClient()
    const {
      data: user,
      ref: { id: ref }
    } = (await db.query(
      q.Get(q.Match(q.Index(process.env.JWT_EXAMPLE_DB_USER_BY_EMAIL_INDEX_NAME!), email))
    )) as FaunaDBQueryResponse<User>

    // tslint:disable-next-line:no-console
    console.log(
      `User found with id ${user._id}${
        process.env.NODE_ENV === 'production' ? '.' : ' -> ' + JSON.stringify(user, null, 2)
      }`
    )

    // if the user is deleted, and we aren't asked to fetch deleted users, return nothing.
    if (!options.fetchEvenDeleted && new Date(user.deletedAt || '').getTime()) {
      console.log(`User is a deleted user, returning nothing.`) // tslint:disable-line:no-console
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
