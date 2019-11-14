import { createCipheriv, createDecipheriv, scryptSync } from 'crypto'
import { createReadStream, createWriteStream, promises as fsPromise } from 'fs'
import { tmpdir as getOSTmpdir } from 'os'
import { parse as parsePath, resolve as resolvePath } from 'path'
import { pipeline as pipelineWithCb } from 'stream'
import { promisify } from 'util'

const pipeline = promisify(pipelineWithCb)

const algorithm = 'aes-256-cbc'
const password = process.env.JWT_CIPHER_PASSWORD
const salt = Buffer.from(process.env.JWT_CIPHER_SALT!, 'base64') // 64 bytes salt
const key = scryptSync(password!, salt, 32)
const iv = Buffer.from(process.env.JWT_CIPHER_IV!, 'base64') // 16 bytes IV for aes-256-cbc

// encrypt incoming file and write to disk
export function encryptFile(path: string): Promise<void> {
  const cipher = createCipheriv(algorithm, key, iv)
  const absolutePath = resolvePath(__dirname, path)
  const input = createReadStream(absolutePath)
  const output = createWriteStream(`${absolutePath}.encrypted`)

  return pipeline(input, cipher, output)
}

// decrypt incoming file and return contents as string
export async function decryptFile(path: string): Promise<string> {
  const decipher = createDecipheriv(algorithm, key, iv)
  const absolutePath = resolvePath(__dirname, path)
  const { name } = parsePath(absolutePath)
  const input = createReadStream(absolutePath)
  // write to os tmp dir so that we can re-read from there
  // when the lambda is hot instead of decrypting file
  // on every call to the lambda
  const outputFileName = resolvePath(getOSTmpdir(), name)
  const output = createWriteStream(outputFileName)

  // TODO: check if output file already exists
  // if so, it probably means the container running
  // the lambda is hot and the file can be reused
  // without having to decrypt it again.

  await pipeline(input, decipher, output)
  const fileHandle = await fsPromise.open(outputFileName, 'r')
  return fileHandle.readFile('utf8')
}
