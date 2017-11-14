"use strict"

const 	DocLoopCore 		= require('./docloop-core.js'),
		GitHubAdapter		= require('./adapters/github-adapter.js'),
		PaperHiveAdapter	= require('./adapters/paperhive-adapter.js'),
		config				= require('../config.js'),
		core				= new DocLoopCore(config)



core
.use(GitHubAdapter, 	config.github)
//.use(PaperHiveAdapter, 	config.paperhive)


docLoopCore.emit('new-annotation')

