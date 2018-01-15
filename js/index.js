"use strict"

const 	DocLoopCore 		= require('./docloop-core.js'),
		GitHubAdapter		= require('./adapters/github/github-adapter.js'),
		PaperHiveAdapter	= require('./adapters/paperhive/paperhive-adapter.js'),
		config				= require('../config.js'),
		docLoopCore			= new DocLoopCore(config.core)



docLoopCore
.use(GitHubAdapter, 	config.github)
.use(PaperHiveAdapter, 	config.paperhive)
.run()

// docLoopCore.emit('new-annotation')

