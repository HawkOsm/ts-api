
# Address Book API

SE4458 Assignment 2, Group 1 (Address Book). A REST API to create, edit, delete, search, sort
and favorite contacts, built with TypeScript and Express and deployed on Azure App Service.

- **Source code:** https://github.com/HawkOsm/ts-api
- **Live API:** https://se4458osm-dtajd2epetech2d4.austriaeast-01.azurewebsites.net
- **Swagger page:** https://se4458osm-dtajd2epetech2d4.austriaeast-01.azurewebsites.net/api-docs/

The app is on a free hosting plan, so the first request after a pause can take about a minute.
Please retry once if it is slow. The data is stored in memory and is lost when the app restarts.

Run locally: `npm install`, then `npm run dev` (Swagger at http://localhost:3000/api-docs/).
Tests: `npm test`.

## Design

Layers, each talking only to the one below: route (`src/index.ts`) -> DTO (`src/dto`, validates
requests and shapes responses) -> service (`src/services`, rules such as "not found", merging a
PATCH, search and sort) -> store (`src/db`, the only place with SQL).

- **Storage:** SQLite in memory (`node:sqlite`, as the assignment requires), with prepared
  statements and named parameters.
- **PUT replaces, PATCH changes some fields**, so a client can favorite a contact with
  `PATCH { "isStarred": true }`.
- **Errors:** invalid input gives a 400 with a clear JSON message, a duplicate email gives 409,
  an unknown id gives 404.
- **Swagger:** a hand-written OpenAPI file served with `swagger-ui-express`; I checked that every
  status code the API returns is documented.
- **Tests:** the store and every endpoint (success and error cases), run in the deployment pipeline
  before each deploy.

## Assumptions

- Only first and last name are required; email (unique) and phone are optional.
- Tags are free text, compared ignoring case. Search looks in names, email and tags. Sorting
  follows Turkish alphabet rules.
- No authentication (not requested). `PUT` on an unknown id gives 404 instead of creating a contact.
- Not implemented: contact pictures (the database layer supports them, but there are no endpoints),
  tag management endpoints, pagination.

## Issues encountered

- Creating the app in Italy North was blocked by a region policy; I read the allowed regions from
- the subscription policy and used Austria East.
- The portal's passwordless GitHub deployment setup failed, so deployment uses basic
  authentication; the first pipeline runs also failed because the source was not pushed yet.
- SQLite sorts Turkish letters (Ç, Ö, İ, Ş) after Z, so sorting is done in code with
  `Intl.Collator("tr")`. Turkish lowercasing also broke case-insensitive search (`I` becomes `ı`),
  so plain `toLowerCase()` is used.
- **Picture upload (one endpoint or two):** a picture can be sent in the same request as the
  contact (a multipart form) or on its own route. I tested the single-endpoint version, and in a
  multipart form every field arrives as text: `isStarred` becomes the string `"true"`, and one tag
  arrives as a string while several tags arrive as a list, so the contact fields lose their types.
  To keep the contact endpoints as plain JSON, the picture has its own route,
  `PUT /contacts/:id/picture` (with `GET` and `DELETE` on the same path), and `multer` is used only
  there, with the file kept in memory and limited to 1 MB and png, jpeg or webp.
