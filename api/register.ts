import { NowRequest, NowResponse } from '@now/node'
import { create as createUser, User } from '../models/User'
import { match } from '../utils/match'

export default async function(req: NowRequest, res: NowResponse) {
  const { email, password, firstName, lastName }: Omit<User, '_id'> = req.body

  match(await createUser({ email, password, firstName, lastName }), {
    left: error => res.status(500).send(error),
    right: user =>
      res.status(201).send({
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      })
  })
}
