# Address Book API

SE4458 Assignment 2, Group 1 (Address Book). A REST API to create, edit, delete, search, sort and
favorite contacts, with tags and a profile picture for each contact. Built with TypeScript and
Express and deployed on Azure App Service.

- **Source code:** https://github.com/HawkOsm/ts-api
- **Live API:** https://se4458osm-dtajd2epetech2d4.austriaeast-01.azurewebsites.net
- **Swagger page:** https://se4458osm-dtajd2epetech2d4.austriaeast-01.azurewebsites.net/api-docs/

The app is on a free hosting plan, so the first request after a pause can take about a minute.
Please retry once if it is slow. The data is stored in memory and is lost when the app restarts.

Run locally (Node 24): `npm install`, then `npm run dev` (Swagger at http://localhost:3000/api-docs/).
Other commands: `npm test`, `npm run build` and `npm start` (the compiled app, as on Azure).

## Design

Layers, each talking only to the one below: route (`src/index.ts`) -> DTO (`src/dto`, checks and
cleans what a request sends) -> service (`src/services`, rules such as "not found", merging a
PATCH, search, sort and tags) -> store (`src/db`, the only place with SQL).

- **Storage:** SQLite in memory (`node:sqlite`, as the assignment requires), with prepared
  statements and named parameters.
- **Pictures:** kept as a binary column in the same in-memory database. Lists never load the picture
  bytes, only a `hasPicture` flag, and a picture is served from its own route.
- **Search and sort** run in the service on the list from the store (the data is small and in
  memory), so characters such as `%` and `_` typed by the user are plain text.
- **PUT replaces, PATCH changes some fields**, so a client can favorite a contact with
  `PATCH { "isStarred": true }`.
- **Errors:** every error is JSON, `{ "error": "message" }`: 400 for invalid input, 404 for an unknown
  id or route, 409 for a duplicate email, phone or tag (or a full address book), 413 and 415 for a
  picture that is too big or not an image.
- **Swagger:** a hand-written OpenAPI file served with `swagger-ui-express`; I checked that every
  status code the API returns is documented.
- **Tests:** the database layer (store) has automated tests, which run in the deployment pipeline
  before each deploy. The endpoints were checked by hand through Swagger and `curl`.

## Assumptions

- Only first and last name are required. Email and phone are optional and unique: emails are saved
  in lower case, and phones without spaces, dashes or brackets (7 to 15 digits), so the same number
  typed in a different format counts as a duplicate.
- **Tags:** free text, kept with the contact as a list (for example `["Work", "Gym"]`). A tag cannot
  be empty or contain a comma, duplicates inside one contact (ignoring case) are dropped, and a
  contact may have no tags. There is also a list of known tags with its own endpoints: `GET /tags`
  (optionally `?search=text`), `POST /tags` and `DELETE /tags/{name}`; there is no rename. Upper and
  lower case count as the same tag (also for letters like Ü and ü). A tag first used on a contact is
  added to the list automatically and takes the spelling of the known tag, and deleting a tag also
  removes it from every contact.
- **Profile picture:** optional, at most one per contact, png, jpeg or webp up to 1 MB. The first
  bytes of the file are checked, not only the type the client declares. It is kept in memory with the
  contact (lost on restart) and uploaded on its own route. A contact without a picture has
  `hasPicture: false`, and a client is expected to show the initials of the first and last name
  instead.
- Search ignores case and looks in names, email, phone and tags; a phone number can be typed with
  spaces, dashes or brackets. `GET /contacts` returns the contacts oldest first.
- **Sorting** is its own endpoint, `GET /contacts/sort?by=...`, like search: `name` (A to Z by first
  name, then last name), `name_desc`, or `tags` (by each contact's first tag in alphabetical order,
  contacts without tags last, ties by name). Sorting ignores case and uses plain English letter order;
  there is no special handling for Turkish letters.
- No authentication (not requested), so any website may call the API (CORS is open). `PUT` on an
  unknown id gives 404 instead of creating a contact.
- The data lives in memory on a small free plan and the API is public, so it is capped at 300 contacts
  and 200 tags (more gives a 409); a contact and its new tags are saved together or not at all.
- Not implemented: a tag filter, pagination, rate limiting.

## Issues encountered

- The university Azure account had no subscription at first, so there was nothing to deploy into;
  this was fixed by activating the Azure for Students subscription.
- Creating the app in Italy North was blocked by a region policy; I read the allowed regions from
  the subscription policy and used Austria East.
- The portal's passwordless GitHub deployment setup failed, so deployment uses basic
  authentication; the first pipeline runs also failed because the source was not pushed yet.
- The OpenAPI file is a `.json` file, and the build only copies a JSON file into `dist/` when it is
  imported from code under `src/`, so the file lives in `src/docs/`.
- **Picture upload:** sending the picture in the same multipart request as the contact turns every
  field into text (`isStarred` becomes `"true"`, one tag arrives as a string and several as a list).
  So the picture has its own route, `PUT /contacts/:id/picture`, and the contact endpoints stay
  plain JSON.
- **Placeholders in SQL:** I wanted to avoid positional `?`, because the values must follow the column
  order and a wrong order silently stored them in the wrong columns when I tested it, but at first I
  could not find how to name them in `node:sqlite`. It is `:first_name` in the SQL and an object
  (`{ first_name: ... }`) when running the statement. Both styles are bound parameters, so both
  protect against SQL injection; the named one is just clearer.
- **Error handler position:** Express only sends an error to a handler registered after the failing
  route. With the handler above the picture routes, their errors came back as HTML pages and a too
  big picture as a 500, so the handlers are now the last thing in `src/index.ts`. Errors that already
  carry a status, such as a broken URL or a too big JSON body, keep it instead of becoming a 500.
- **Same tag in different case:** the database compared tag names in a way that only knew English
  letters, while the code knew all letters, so `Ürün` and `ürün` became two tags. Both now use one
  shared definition of "same tag".
