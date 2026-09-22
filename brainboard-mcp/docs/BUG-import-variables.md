# Bug report: `POST /variables/import/{architectureUUID}` rejects every documented request shape

**Status:** open · **Filed:** 2026-08-02 · **Endpoint:** `POST /variables/import/{architectureUUID}`
**Host:** `https://api.us1.brainboard.co` · **Spec:** [`BrainboardAPI.json`](BrainboardAPI.json) (OpenAPI 3.0, Brainboard API v1.0)

## Summary

Every request to the variable-import endpoint returns `400 {"error_code":"INVALID_BODY"}`, including
requests that follow the OpenAPI spec exactly. The endpoint appears to require a field or format
that is not published in the spec, and the API documentation page
(`docs.brainboard.co/automation/api`) is an empty stub, so there is no other reference to check.

## What the spec says

```json
"/variables/import/{architectureUUID}": {
  "post": {
    "requestBody": {
      "content": {
        "multipart/form-data": {
          "schema": { "$ref": "#/components/schemas/handler.ImportVariablesInput" }
        }
      },
      "required": true
    }
  }
}
```

```json
"handler.ImportVariablesInput": {
  "type": "object",
  "properties": {
    "override": { "type": "boolean", "description": "set to true to override existing variables" }
  }
}
```

The schema documents `override` and nothing else. The name of the file part is never given, even
though the content type is `multipart/form-data` and the error enum contains file-upload codes.

## Expected vs actual

**Expected:** a multipart request carrying a variables file and `override` imports the variables and
returns `200`.

**Actual:** `400 {"error_code":"INVALID_BODY"}` for all 20 combinations tried.

## Evidence

### 1. The server does attempt a multipart parse

Sending a JSON body produces a *different* error:

```
Content-Type: application/json   ->  400 {"error_code":"FILE_UPLOAD_MAX_SIZE"}
Content-Type: multipart/form-data ->  400 {"error_code":"INVALID_BODY"}
```

`FILE_UPLOAD_MAX_SIZE` on a 30-byte JSON body indicates the handler is running multipart parsing
over a non-multipart body and failing on the resulting garbage length. This confirms the spec's
declared content type is correct — multipart is what the endpoint wants.

### 2. The failure is not a missing file part

The spec's `errors.ErrorCode` enum contains a dedicated code for that case:

```
"FILE_UPLOAD_FAILED", "FILE_UPLOAD_MAX_SIZE", "MISSING_FILE_UPLOAD", "INVALID_CONTENT_TYPE", ...
```

No request returned `MISSING_FILE_UPLOAD` or `INVALID_CONTENT_TYPE`. The file part is being found
and the content type accepted; something else in the body is judged invalid.

### 3. Full attempt matrix — all `INVALID_BODY`

File field names tried: `file`, `variables`, `tfvars`, `varfile`, `files`, `files[]`, `data`.

| File content | `file` + `override=true` | `file` only | `override=false` | `+ import_type=files` | `files[]` |
| --- | --- | --- | --- | --- | --- |
| `region = "us-east-1"` (tfvars) | `INVALID_BODY` | `INVALID_BODY` | `INVALID_BODY` | `INVALID_BODY` | `INVALID_BODY` |
| `variable "region" { ... }` (HCL block) | `INVALID_BODY` | `INVALID_BODY` | `INVALID_BODY` | `INVALID_BODY` | `INVALID_BODY` |
| `{"region":"us-east-1"}` (JSON map) | `INVALID_BODY` | `INVALID_BODY` | `INVALID_BODY` | `INVALID_BODY` | `INVALID_BODY` |
| `[{"name":"region","value":"us-east-1"}]` (JSON array) | `INVALID_BODY` | `INVALID_BODY` | `INVALID_BODY` | `INVALID_BODY` | `INVALID_BODY` |

Filenames were varied to match content (`terraform.tfvars`, `variables.tf`, `terraform.tfvars.json`,
`variables.json`) with part MIME types `text/plain` and `application/json`. `import_type=files` was
tried because `model.ImportType` (`git` | `files` | `brainboard` | `cloud`) is defined in the spec
but referenced by no request body.

## Ruled out

- **Auth** — the same key returns `200` on `/projects`, `/architectures/templates`,
  `/workflow_templates`, `/projects/{uuid}/environments`, `/environments/{uuid}/architectures`,
  `/architectures/{uuid}/workflows`, and `POST /architectures/templates/{uuid}/clone`.
- **Architecture UUID** — the target was created moments earlier via `clone_from_template` and is
  readable through `GET /environments/{uuid}/architectures`. An invalid UUID returns
  `INVALID_UUID`, a distinct code, so the path parameter is being accepted.
- **Content type** — `INVALID_CONTENT_TYPE` exists and was never returned.
- **Missing file** — `MISSING_FILE_UPLOAD` exists and was never returned.
- **Payload size** — contents were 20–60 bytes.

## Reproduce

```bash
curl -i -X POST "https://api.us1.brainboard.co/variables/import/<architectureUUID>" \
  -H "Authorization: $BRAINBOARD_API_KEY" \
  -F "file=@terraform.tfvars" \
  -F "override=true"
# -> 400 {"error_code":"INVALID_BODY"}
```

Contrast with the JSON probe that reveals the multipart parse:

```bash
curl -i -X POST "https://api.us1.brainboard.co/variables/import/<architectureUUID>" \
  -H "Authorization: $BRAINBOARD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"override":true}'
# -> 400 {"error_code":"FILE_UPLOAD_MAX_SIZE"}
```

## The question for Brainboard

What does this endpoint actually expect? Specifically:

1. What is the multipart **field name** for the file part?
2. What **file format** is accepted — `.tfvars`, an HCL `variable` block, or a JSON export?
3. Are there **additional required fields** (for example `import_type`) missing from
   `handler.ImportVariablesInput` in the published spec?

## Impact and workaround

One of fourteen tools in [brainboard-mcp](../README.md) is blocked. Everything else works,
including template cloning and pipeline triggering.

**Workaround:** set variables at clone time via `variable_values` on
`POST /architectures/{uuid}/clone` and `POST /architectures/templates/{uuid}/clone`, which works
correctly. This covers the common case; it does not cover importing variables into an architecture
that already exists.

## Suggested spec fix

Document the file part in `handler.ImportVariablesInput`, for example:

```json
"handler.ImportVariablesInput": {
  "type": "object",
  "required": ["<file-field-name>"],
  "properties": {
    "<file-field-name>": { "type": "string", "format": "binary", "description": "..." },
    "override": { "type": "boolean", "description": "set to true to override existing variables" }
  }
}
```
