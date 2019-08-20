import { NowRequest, NowResponse } from '@now/node'
import { STATUS_CODES } from 'http'
import { v4 as uuidV4 } from 'uuid'
import { prettyPrintError } from '../errors/CustomError'
import { login as loginUser, User } from '../models/User'
import { match } from '../utils/match'

export default async function(req: NowRequest, res: NowResponse) {
  const { email, password }: Omit<User, '_id'> = req.body
  const requestId = uuidV4()

  console.log('Begin requestId ->', requestId) // tslint:disable-line:no-console

  match(await loginUser({ email, password }), {
    left: error => {
      const statusCode = error.statusCode || 500

      console.log('Error occurred ->', prettyPrintError(error)) // tslint:disable-line:no-console
      res
        .status(statusCode)
        .json({ statusCode, message: error.message, details: error.details, requestId })
    },
    // TODO: Generate JWT for user and respond with it
    // @ts-ignore suppress unused var since it'll be used to generate JWT for user
    right: user => {
      const status = 200
      const response = {
        requestId,
        token: '<generate a JWT and send it here>'
      }

      console.log('User logged in', process.env.NODE_ENV !== 'production' ? response : '.') // tslint:disable-line:no-console

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
