"use strict";

var docLoopCore 			= require('./docloop-core.js'),
	WebhookAdapter			= require('./adapters/webhook-adapter.js'),
	GitHubAdapter			= require('./adapters/github-adapter.js'),
	PaperHiveAdapter		= require('./adapters/paperhive-adapter.js')

docLoopCore
.use(WebhookAdapter)
.use(GitHubAdapter)
.use(PaperHiveAdapter)

docLoopCore.run()