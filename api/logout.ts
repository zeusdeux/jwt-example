import { NowRequest, NowResponse } from '@now/node'
import { STATUS_CODES } from 'http'
import { v4 as uuidV4 } from 'uuid'
import { CustomError, ErrorType, getErrorHandler } from '../errors/CustomError'
import { create as createToken } from '../models/Token'
import { logout as logoutUser, User } from '../models/User'
import { match } from '../utils/match'

function getToken(req: NowRequest): string {
  const token = (req.header.authorization || '').trim().split(/^(?:b|B)earer +/)[1]

  return token ? token : req.query.token
}

export default async function(req: NowRequest, res: NowResponse) {
  const token = getToken(req)
  const requestId = uuidV4()
  const handleError = getErrorHandler(res, requestId)

  console.log('Begin requestId ->', requestId) // tslint:disable-line:no-console

  if (!token) {
    handleError(new CustomError({ type: ErrorType.Unauthorized }))
  } else {
    match(await logoutUser(token), {
      just: handleError,
      nothing: async _ => {
        const status = 200
        const response = {
          requestId,
          message: 'Successfully logged out'
        }

        console.log('User logged out', process.env.NODE_ENV !== 'production' ? response : '.') // tslint:disable-line:no-console

        const stringifiedResponse = JSON.stringify(response) + '\n'

        res.writeHead(status, STATUS_CODES[status], {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(stringifiedResponse)
        })
        res.end(stringifiedResponse)
      }
    })
  }

  console.log('End requestId ->', requestId) // tslint:disable-line:no-console
}
