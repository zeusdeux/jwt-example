import { NowRequest, NowResponse } from '@now/node'

export default function(req: NowRequest, res: NowResponse) {
  res.status(200).send(req.body)
}
