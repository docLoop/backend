"use strict"

const 	DocloopCore 		= require('docloop').DocloopCore,
		GithubAdapter		= require('docloop-github-adapter').GithubAdapter,
		PaperHiveAdapter	= require('docloop-paperhive-adapter').PaperhiveAdapter,
		config				= require('./config.js'),
		docLoopCore			= new DocloopCore(config.core)



docLoopCore
.use(GithubAdapter, 	config.github)
.use(PaperHiveAdapter, 	config.paperhive)
.run()

