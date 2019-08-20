export const enum ErrorType {
  UserAlreadyExists = 'UserAlreadyExists',
  InternalServerError = 'InternalServerError',
  ValidationError = 'ValidationError'
}

const enum HttpStatusCode {
  BAD_REQUEST = 400,
  INTERNAL_SERVER_ERROR = 500,
  UNPROCESSABLE_ENTITY = 422
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
  }
} as const

export class CustomError extends Error {
  public readonly statusCode: number
  constructor(
    readonly errorType: ErrorType,
    readonly cause?: Error | CustomError,
    readonly details?: string | Array<string | object> | object
  ) {
    super(ErrorMetadataRecord[errorType].message)
    this.statusCode = ErrorMetadataRecord[errorType].statusCode
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
errorType: ${err.errorType}
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
