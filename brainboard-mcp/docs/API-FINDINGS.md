# Brainboard API findings

Notes from building [brainboard-mcp](../README.md), an unofficial MCP server for the Brainboard
public API, entirely from the published OpenAPI spec.

**Tested:** 2026-08-02 · **Host:** `https://api.us1.brainboard.co` · **Spec:** `BrainboardAPI.json`
(OpenAPI 3.0, Brainboard API v1.0) · **Account:** free tier, API key from organization settings

Every one of the 13 endpoints in the spec was wrapped as a tool and called against a live account.
**11 behave exactly as documented. Two do not.** Both gaps are in the spec rather than the API
itself, and both are invisible until you actually send a request — which is why they are written up
here.

---

## Summary

| # | Endpoint | Problem | Severity |
| --- | --- | --- | --- |
| 1 | `POST /projects` | An undocumented field is required, and its valid values are unpublished and narrower than expected | Works once known |
| 2 | `POST /variables/import/{architectureUUID}` | No request shape succeeds | Blocking |

---

## Finding 1 — `POST /projects` requires an undocumented `role` on every team

### What the spec says

`createOrUpdateProjectRequest` requires `name`, `environments` and `teams`. It says nothing about a
role. The referenced `Team` schema documents `role` like this:

```json
"role": {
  "description": "Only used and automatically populated when listing a Team within a Project to get the Team's role inside this project. See `func (p *Project) GetWithTeams(...)`",
  "type": "string"
}
```

Read plainly, that describes a **response-only** field: something the API populates when you list
teams, not something a client sends. So a client built from the spec omits it.

### What happens

```bash
curl -X POST https://api.us1.brainboard.co/projects \
  -H "Authorization: $KEY" -H "Content-Type: application/json" \
  -d '{"name":"Demo","environments":[{"name":"Development"}],"teams":[{"uuid":"<team-uuid>"}]}'
```

```json
400 {"error":"project role is invalid","details":{"message":"'' for team ''"}}
```

The empty string in the message shows the server looked for a role and found none. `role` is in
fact **required on every team object**.

### The second half of the problem

Once you know a role is needed, the spec gives no valid values, and Brainboard's own documentation
describes organization roles as Owner, Admin, Member and Guest. Only two of those work at project
level. Tested one value at a time against a live account:

| Role sent | Result |
| --- | --- |
| `admin` | **201 Created** |
| `guest` | **201 Created** |
| `owner` | `400 project role is invalid` |
| `member` | `400 project role is invalid` |
| `viewer` | `400 project role is invalid` |
| `editor` | `400 project role is invalid` |
| `reader` | `400 project role is invalid` |
| `contributor` | `400 project role is invalid` |
| `maintainer` | `400 project role is invalid` |

`owner` — the most natural guess for the person creating a project — is rejected. With no published
enum and no list in the error message, the only way to find `admin` is to brute-force it.

### Working request

```json
{
  "name": "Demo",
  "environments": [{ "name": "Development" }],
  "teams": [{ "uuid": "<team-uuid>", "role": "admin" }]
}
```

### Suggested fix

Move `role` into `createOrUpdateProjectRequest` as a required field, give it an enum of the accepted
values, and list the valid options in the error message.

---

## Finding 2 — `POST /variables/import/{architectureUUID}` rejects every request shape

Full write-up, including the 20-case attempt matrix and curl reproductions:
**[BUG-import-variables.md](BUG-import-variables.md)**

### Short version

Every request returns `400 {"error_code":"INVALID_BODY"}`, including ones that follow the spec
exactly. Two observations narrow it down without solving it:

- Sending a JSON body returns `FILE_UPLOAD_MAX_SIZE` on a 30-byte payload. The handler is running
  multipart parsing over a non-multipart body, so the spec's `multipart/form-data` is correct.
- The spec defines distinct `MISSING_FILE_UPLOAD` and `INVALID_CONTENT_TYPE` codes, and **neither
  is ever returned**. The file part is being found and the content type accepted; the rejection is
  about something else.

Twenty combinations were tried — seven file-field names, four content formats, and the
`override` / `import_type` flags — all returning an identical `INVALID_BODY`. A required element is
unpublished.

The spec also defines `model.ImportType` (`git` | `files` | `brainboard` | `cloud`) which no request
body references — a plausible loose thread, though sending `import_type=files` did not help.

### Questions

1. What is the multipart field name for the file part?
2. What file format is accepted — `.tfvars`, an HCL `variable` block, or a JSON export?
3. Are there required fields missing from `handler.ImportVariablesInput`?

---

## Everything that worked

For balance — these behaved exactly as specified, first try:

| Endpoint | Notes |
| --- | --- |
| `GET /projects` | bare JSON array |
| `GET /projects/{uuid}/environments` | bare JSON array |
| `GET /environments/{uuid}/architectures` | bare JSON array |
| `GET /architectures/templates` | 122 templates returned |
| `POST /architectures/templates` | |
| `POST /architectures/templates/{uuid}/clone` | architecture created and visible in the UI |
| `POST /architectures/{uuid}/clone` | including `variable_values` overrides |
| `POST /architectures/{uuid}/versions` | |
| `GET /architectures/{uuid}/workflows` | |
| `GET /workflow_templates` | |

`POST /architectures/{uuid}/workflows/{id}/trigger` was deliberately not called, since it can apply
real cloud infrastructure.

### Authentication

The spec declares `apiKey` in an `Authorization` header without stating whether a `Bearer ` prefix
is expected, and `docs.brainboard.co/automation/api` is an empty stub. Tested: **both forms are
accepted** and return `200`.

Documenting this would save every future integrator the same guess.
