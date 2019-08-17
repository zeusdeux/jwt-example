import { NowRequest, NowResponse } from '@now/node'
import { STATUS_CODES } from 'http'
import { v4 as uuidV4 } from 'uuid'
import { create as createUser, User } from '../models/User'
import { match } from '../utils/match'

export default async function(req: NowRequest, res: NowResponse) {
  const { email, password, firstName, lastName }: Omit<User, '_id'> = req.body
  const requestId = uuidV4()

  console.log(`Request with id ${requestId} received to create user with email ->`, email) // tslint:disable-line:no-console

  match(await createUser({ email, password, firstName, lastName }), {
    left: error => {
      console.log('Error occurred ->', error) // tslint:disable-line:no-console
      res.status(500).json({ message: error.message, requestId })
    },
    right: user => {
      const status = 201
      const response = {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        requestId
      }

      console.log('User created ->', response) // tslint:disable-line:no-console

      const stringifiedResponse = JSON.stringify(response) + '\n'

      res.writeHead(status, STATUS_CODES[status], {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(stringifiedResponse)
      })
      return res.end(stringifiedResponse)
    }
  })
}
