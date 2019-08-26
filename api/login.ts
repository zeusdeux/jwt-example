import { NowRequest, NowResponse } from '@now/node'
import { STATUS_CODES } from 'http'
import { v4 as uuidV4 } from 'uuid'
import { getErrorHandler } from '../errors/CustomError'
import { create as createToken } from '../models/Token'
import { login as loginUser, User } from '../models/User'
import { match } from '../utils/match'

export default async function(req: NowRequest, res: NowResponse) {
  const { email, password }: Omit<User, '_id'> = req.body
  const requestId = uuidV4()
  const handleError = getErrorHandler(res, requestId)

  console.log('Begin requestId ->', requestId) // tslint:disable-line:no-console

  match(await loginUser({ email, password }), {
    left: handleError,
    right: async user => {
      const subject = user.email

      match(await createToken({ wat: 'dude' + (Math.random() % 10000) }, { subject }), {
        left: handleError,
        right: token => {
          const status = 200
          const response = {
            requestId,
            token
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
    }
  })

  console.log('End requestId ->', requestId) // tslint:disable-line:no-console
}
