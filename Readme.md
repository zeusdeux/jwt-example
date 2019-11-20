# jwt-example

This is an example codebase that implements user registration and supports authorization using
[JWTs](https://jwt.io) using serverless functions and the wonderful [FaunaDB](https://fauna.com).

## Motivation

I wrote this to teach myself how JWTs work and also implement user registration and login/logout,
etc flows serverlessly.

## Implemented functionality

- sign up as new user (or re-sign up as a deleted user which is transparent to the user)
- login and get JWT with 1 hour expiry (multiple logged in sessions supported)
- access protected route with only with a valid token
- logout (kills _all_ logged in sessions and invalidates all tokens for the user)
- delete user
- In-situ encrypted JWT signing/validation key pair to overcome
  [AWS Lambda having a hard limit of 4kb on env vars when JSON-stringified](https://github.com/zeusdeux/jwt-example/commit/4f09c2e56df2d95ac9df0082fad4bfc4e22fbddd#comments)

## TODOs

- todos in code
- switch to `argon2` from `bcrypt`
  > Waiting on https://github.com/zeit/node-file-trace/pull/53 to switch to argon2

## Code structure

- `api/*` holds the lambdas that map to each supported route
- `models/*` holds the models for the entities in the system (User & Token) and some helpers
- `errors/*` holds the custom error tooling for the codebase
- `utils/*` hold code structure and type level utilties

### A note on `Maybe`, `Either` and `match` over traditional code structure

I wanted to play with a different way of approaching authoring the code in this repository. Instead
of messing with `try/catch`-es and lots of error handling madness, I have instead opted to push
those to the edges as you can see in [models/User.helpers.ts](./models/User.helpers.ts) and instead
wrap those values in `Maybe`s and/or `Either`s. These values are then accessed in a declarative
manner using `match`. Their usage, imho, has greatly simplified the code as you can see in the
`api/*.ts`. It's not everyone's ☕and I get that.

More info can be found in files with the same names under they `utils/` directory.
