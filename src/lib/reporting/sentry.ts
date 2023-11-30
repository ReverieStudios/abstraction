import * as Sentry from '@sentry/browser';
import { BrowserTracing } from '@sentry/tracing';

const dsn = import.meta.env.VITE_SENTRY_DSN;
if (typeof dsn === 'string') {
	Sentry.init({
		dsn,
		integrations: [new BrowserTracing()],
		tracesSampleRate: 1.0
	});
}
