# ts-api

SE4458 Assignment 2: a REST API for an address book (Group 1), built with TypeScript and
Express, deployed on Azure App Service.

## Links
- Source code: https://github.com/HawkOsm/ts-api
- Live API: _TODO: paste the exact `.azurewebsites.net` URL from the Azure portal_
- Swagger page: _TODO: live URL + `/api-docs`_

## Tech stack
- Node.js and Express
- TypeScript (compiled with `tsc` into `dist/`)
- `swagger-ui-express` for the Swagger page
- All data is kept in memory (as the assignment requires), so it resets whenever the
  app restarts.

## Run locally
```
npm install
npm run dev      # runs src/index.ts directly
npm run build    # compiles to dist/
npm start        # runs the compiled app
```
The port comes from the `PORT` environment variable and defaults to 3000.

## Hosting note for the instructor
The app is deployed on the **Free (F1) App Service plan** to save the student credit.
Because of that:
- The app goes to sleep after a period of inactivity, so the **first request after a pause
  can take 30 to 60 seconds**. Later requests are fast. If the first request seems slow or
  times out, please retry it once.
- There is no "Always On" option on this plan, and the in-memory data is lost when the app
  restarts.

This is a hosting-plan setting, not a code problem. It can be changed by scaling the plan
up to a paid tier (for example Basic B1, which has Always On). The student is happy to do
that if requested.

## Design
_TODO_

## Assumptions
_TODO_

## Issues encountered
- The university Azure account had no subscription at first, so `az login` found nothing to
  deploy into. This was fixed by activating the Azure for Students subscription.
