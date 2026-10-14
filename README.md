
# Address Book API

SE4458 Assignment 2, Group 1 (Address Book). A REST API to create, edit, delete, search
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
PATCH, search) -> store (`src/db`, the only place with SQL).

- **Storage:** SQLite in memory (`node:sqlite`, as the assignment requires), with prepared
  statements and named parameters.
- **PUT replaces, PATCH changes some fields**, so a client can favorite a contact with
  `PATCH { "isStarred": true }`.
- **Errors:** invalid input gives a 400 with a clear JSON message, a duplicate email gives 409,
  an unknown id gives 404.
- **Swagger:** a hand-written OpenAPI file served with `swagger-ui-express`; I checked that every
  status code the API returns is documented.
- **Tests:** the database layer (store) has automated tests, which run in the deployment pipeline
  before each deploy. The endpoints were checked by hand through Swagger and `curl`.

## Assumptions

- Only first and last name are required; email (unique) and phone are optional.
- **Tags:** free text, kept with the contact as a list (for example `["Work", "Gym"]`). A tag cannot
  be empty or contain a comma, duplicates inside one contact (ignoring case) are dropped, and a
  contact may have no tags. A tag exists only while a contact uses it, so there are no endpoints to
  create, list or delete tags on their own.
- **Profile picture:** optional, at most one per contact, png, jpeg or webp up to 1 MB. It is kept in
  memory with the contact (lost on restart) and uploaded on its own route. A contact without a
  picture has `hasPicture: false`, and a client is expected to show the initials of the first and
  last name instead.
- Search ignores case and looks in names, email, phone and tags. Lists come back oldest first;
  there is no sort option.
- No authentication (not requested). `PUT` on an unknown id gives 404 instead of creating a contact.
- Not implemented: sort options, a tag filter, pagination.

## Issues encountered

- Creating the app in Italy North was blocked by a region policy; I read the allowed regions from
  the subscription policy and used Austria East.
- The portal's passwordless GitHub deployment setup failed, so deployment uses basic
  authentication; the first pipeline runs also failed because the source was not pushed yet.
- **Picture upload:** sending the picture in the same multipart request as the contact turns every
  field into text (`isStarred` becomes `"true"`, one tag arrives as a string and several as a list).
  So the picture has its own route, `PUT /contacts/:id/picture`, and the contact endpoints stay
  plain JSON.
- **Placeholders in SQL:** I wanted to avoid positional `?`, because the values must follow the column
  order and a wrong order silently stored them in the wrong columns when I tested it, but at first I
  could not find how to name them in `node:sqlite`. It is `:first_name` in the SQL and an object
  (`{ first_name: ... }`) when running the statement. Both styles are bound parameters, so both
  protect against SQL injection; the named one is just clearer.
