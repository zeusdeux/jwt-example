# jwt-example

This is an example codebase that implements user registration and
supports authorization using [JWTs](https://jwt.io) using serverless
functions and the wonderful [FaunaDB](https://fauna.com).

## Motivation

I wrote this to teach myself how JWTs work and also implement user
registration done correctly<sup>\*</sup>.

> <sup>\*</sup>Waiting on https://github.com/zeit/node-file-trace/pull/53 to switch to argon2

## Implemented functionality

- sign up as new user (or re-sign up as a deleted user which is transparent to the user)
- login and get JWT with 1 hour expiry (multiple logged in sessions supported)
- access protected route with only with a valid token
- logout (kills _all_ logged in sessions and invalidates all tokens for the user)
- delete user

## Code structure

- `api/*` holds the lambdas that map to each supported route
- `models/*` holds the models for the entities in the system (User & Token) and some helpers
- `errors/*` holds the custom error tooling for the codebase
- `utils/*` hold code structure and type level utilties
