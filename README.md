# wckbng-dashboard

(also known as: Web Compatibility Knowledge Base Next Generation Dashboard)

## Notes

- This project is an early WIP. More details and instruction will follow when we reached a more stable state.
- When running locally, **you are still connected to the production database**, so any mutations you make will affect everyone!

## Development environment

1. Make sure a current NodeJS is installed
2. Copy `.env.example` into `.env` and adjust as required
3. `npm install`
4. `npm run dev`

This will start a local development server on `http://localhost:3000`.

## BigQuery Authentication

For local development, [install the `gcloud` CLI](https://cloud.google.com/sdk/gcloud) and log in with `gcloud auth application-default login`.

For deployments, use [the `GOOGLE_APPLICATION_CREDENTIALS` environment variable](https://cloud.google.com/docs/authentication/application-default-credentials#GAC) to authenticate.

## License

MPL.
