import { NowRequest, NowResponse } from '@now/node'
import { STATUS_CODES } from 'http'
import { v4 as uuidV4 } from 'uuid'
import { getErrorHandler } from '../errors/CustomError'
import { create as createUser } from '../models/User'
import { User } from '../models/User.helpers'
import { match } from '../utils/match'

export default async function(req: NowRequest, res: NowResponse): Promise<void> {
  const {
    email,
    password,
    firstName,
    lastName
  }: Pick<User, 'email' | 'password' | 'firstName' | 'lastName'> = req.body
  const requestId = uuidV4()
  const handleError = getErrorHandler(res, requestId)

  console.log('Begin requestId ->', requestId) // tslint:disable-line:no-console

  match(await createUser({ email, password, firstName, lastName }), {
    left: handleError,
    right: user => {
      const status = 201
      const response = {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        requestId
      }

      console.log('User created', process.env.NODE_ENV !== 'production' ? response : '.') // tslint:disable-line:no-console

      const stringifiedResponse = JSON.stringify(response) + '\n'

      res.writeHead(status, STATUS_CODES[status], {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(stringifiedResponse)
      })
      res.end(stringifiedResponse)
    }
  })

  console.log('End requestId ->', requestId) // tslint:disable-line:no-console
}
