import { expect, test } from "bun:test"
import { OpenApi } from "effect/http-api"
import { ClientApi } from "../src/client.js"

const methods = ["get", "put", "post", "delete", "patch", "head", "options", "trace"] as const

test("every location query parameter is documented as a deepObject", () => {
  const parameters = Object.values(OpenApi.fromApi(ClientApi).paths)
    .flatMap((item) => methods.flatMap((method) => item[method] ?? []))
    .flatMap((operation) =>
      operation.parameters
        .filter((parameter) => parameter.name === "location" && parameter.in === "query")
        .map((parameter) => ({ operation: operation.operationId, ...parameter })),
    )

  expect(parameters.length).toBeGreaterThan(50)
  expect(parameters).toEqual(parameters.map((parameter) => ({ ...parameter, style: "deepObject", explode: true })))
})
