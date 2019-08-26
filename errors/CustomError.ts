import { NowResponse } from '@now/node'
import { ExtractType } from '../utils/types'

export const enum ErrorType {
  UserAlreadyExists = 'UserAlreadyExists',
  InternalServerError = 'InternalServerError',
  ValidationError = 'ValidationError',
  Unauthorized = 'Unauthorized',
  UserDoesNotExist = 'UserDoesNotExist'
}

const enum HttpStatusCode {
  BAD_REQUEST = 400,
  INTERNAL_SERVER_ERROR = 500,
  UNPROCESSABLE_ENTITY = 422,
  UNAUTHORIZED = 401
}

interface ErrorMetadata {
  message: string
  statusCode: HttpStatusCode
}

const ErrorMetadataRecord: Record<ErrorType, ErrorMetadata> = {
  [ErrorType.UserAlreadyExists]: {
    message: 'User already exists',
    statusCode: HttpStatusCode.BAD_REQUEST
  },
  [ErrorType.InternalServerError]: {
    message: 'Internal server error',
    statusCode: HttpStatusCode.INTERNAL_SERVER_ERROR
  },
  [ErrorType.ValidationError]: {
    message: 'Payload failed validation',
    statusCode: HttpStatusCode.UNPROCESSABLE_ENTITY
  },
  [ErrorType.Unauthorized]: {
    message: 'Unauthorized access',
    statusCode: HttpStatusCode.UNAUTHORIZED
  },
  [ErrorType.UserDoesNotExist]: {
    message: 'User does not exist',
    statusCode: HttpStatusCode.BAD_REQUEST
  }
} as const

interface CustomErrorOptions {
  type: ErrorType
  details?: string | Array<string | object> | object
  cause?: Error | CustomError
}

export class CustomError extends Error {
  public readonly statusCode: number
  public readonly type: ExtractType<CustomErrorOptions, 'type'>
  public readonly details: ExtractType<CustomErrorOptions, 'details'>
  public readonly cause: ExtractType<CustomErrorOptions, 'cause'>

  constructor(args: CustomErrorOptions) {
    super(ErrorMetadataRecord[args.type].message)

    const { type, details, cause } = args

    this.statusCode = ErrorMetadataRecord[type].statusCode
    this.type = type
    this.details = details
    this.cause = cause
  }
}

export function prettyPrintError(err?: CustomError | Error): string {
  let result: string = ''

  if (!err) {
    return result
  }

  if (err instanceof CustomError) {
    result = `
message: ${err.message}
errorType: ${err.type}
statusCode: ${err.statusCode}
stack: ${err.stack}
${err.details ? 'details: ' + JSON.stringify(err.details, null, 4) : ''}
${err.cause ? 'cause: ' + prettyPrintError(err.cause) : ''}
`
  } else {
    result = `
message: ${err.message}
stack: ${err.stack}
`
  }
  return (
    result
      .split('\n')
      // we only ever need to repeat \t once since due to the recursive call, the \t's accumulate
      // as by the time this code is run, the recursive call to prettyPrintError has already appended
      // one level of \t's to the result
      .map(line => `${'\t'.repeat(1)}${line}`)
      .join('\n')
  )
}

export function getErrorHandler(res: NowResponse, requestId: string) {
  return (error: CustomError | Error) => {
    const statusCode = 'statusCode' in error ? error.statusCode : 500
    const details = 'details' in error ? error.details : undefined

    console.log('Error occurred ->', prettyPrintError(error)) // tslint:disable-line:no-console
    res.status(statusCode).json({ statusCode, message: error.message, details, requestId })
  }
}
