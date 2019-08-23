export type ExtractType<T, U extends keyof T> = T[U]
export type ExtractArgTypes<T> = T extends (...args: infer U) => any ? U : never
