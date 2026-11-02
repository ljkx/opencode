import { Location } from "@opencode/schema/location"
import { Context, Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, HttpApiMiddleware, HttpApiSchema, OpenApi } from "effect/http-api"
import { ServiceUnavailableError } from "../errors.js"

export const LocationQuery = Schema.Struct({
  location: Schema.optional(
    Schema.Struct({
      directory: Schema.optional(Schema.String),
    }),
  ),
}).annotate({ identifier: "LocationQuery" })

// Annotates the whole API document: OpenAPI keeps one transform per endpoint, so a per-endpoint
// one is silently replaced by any endpoint that also sets its own transform.
export const locationQueryOpenApi = OpenApi.annotations({
  transform: (spec) => ({
    ...spec,
    paths: Object.fromEntries(
      Object.entries<Record<string, Record<string, unknown>>>(spec.paths).map(([path, item]) => [
        path,
        Object.fromEntries(Object.entries(item).map(([method, operation]) => [method, locationQueryStyle(operation)])),
      ]),
    ),
  }),
})

function locationQueryStyle(operation: Record<string, unknown>) {
  const parameters = operation.parameters
  if (!Array.isArray(parameters)) return operation
  return {
    ...operation,
    parameters: parameters.map((parameter) =>
      parameter?.name === "location" && parameter?.in === "query"
        ? { ...parameter, style: "deepObject", explode: true }
        : parameter,
    ),
  }
}

// Middleware is applied per endpoint: reload acts on every loaded location and
// must not boot the caller's location first.
export const makeLocationGroup = <LocationId extends HttpApiMiddleware.AnyId, LocationService>(
  locationMiddleware: Context.Key<LocationId, LocationService>,
) =>
  HttpApiGroup.make("server.location")
    .add(
      HttpApiEndpoint.get("location.get", "/api/location", {
        query: LocationQuery,
        success: Location.PublicInfo,
      })
        .middleware(locationMiddleware)
        .annotateMerge(
          OpenApi.annotations({
            identifier: "location.get",
            summary: "Get location",
            description: "Resolve the requested location or the server default location.",
          }),
        ),
    )
    .add(
      HttpApiEndpoint.post("location.reload", "/api/location/reload", {
        success: HttpApiSchema.NoContent,
        error: ServiceUnavailableError,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "location.reload",
          summary: "Reload configuration",
          description:
            "Shut down and rebuild every loaded location. Pending permissions and forms are cancelled; running sessions continue with fresh services at the next step boundary. Emits location.shutdown for client recovery and responds once all replacement builds settle.",
        }),
      ),
    )
    .annotateMerge(OpenApi.annotations({ title: "location" }))
