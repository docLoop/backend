"use strict";

var docLoopCore 		= require('./docloop-core.js'),
	GitHubAdapter		= require('./adapters/github-adapter.js'),
	PaperHiveAdapter	= require('./adapters/paperhive-adapter.js'),
	config				= require('../config.js')
		

docLoopCore
.use(GitHubAdapter, 	config.github)
.use(PaperHiveAdapter, 	config.paperhive)

docLoopCore.run()