'use strict'

const	Promise			=	require('bluebird'),
		fs				=	require('fs'),
		request			=	require('request-promise-native'),
		EventQueue		= 	require('../../event-queue.js'),
		DocLoopAdapter	=	require('../../adapter.js'),
		manageCalls		=	require('../../manage-calls.js'),
		GithubTarget	=	require('./github-target.js'),
		GithubApp		=	require('./github-app.js'),
		GithubUser		=	require('./github-user.js')




class GitHubAdapter extends DocLoopAdapter{

	constructor(core, config) {

		if(!config) throw ReferenceError('GitHubAdapter.constructor(): missing config')

		super(core, { 

			...config, 

			id: 					'github',
			type:					'target',
			endpointClass:			GithubTarget,
			extraEndpoints:			false,
			endpointDefaultConfig:	{
										label: 	'docloop',
									}
		} )

		this.config		= 	config
		this.githubUser	=	new GithubUser()
		this.githubApp 	= 	new GithubApp({	
								id:   config.appId,
								cert: config.appPrivateKey || fs.readFileSync(config.appPrivateKeyLocation)
							})


		manageCalls.serialize(this, [
			'handleQueuedAnnotationEvent',
			'handleQueuedReplyEvent'
		])

		this.core.on('annotation', 		this.queueAnnotationEvent.bind(this)	)
		this.core.on('reply', 			this.queueReplyEvent.bind(this)		)

		this.ready = 	this.ready
						.then( ()	=> {

							this.app.get('/oauth/callback',  	(req, res, next)	=> this.handleOAuthCallback(req,res,next))


							//eventQueue:

							const eventQueueConfigDefault = {
								delay:				[0, 1000, 5000],
								minDelay:			0,
								maxAttempts:		3,
								processInterval:	10*60*1000,
								spread:				100, //Todo , when frist added event are attempted ot once, without spread =/
							}


							this.events 	= 	this.core.db.collection(this.id+'_annotationEvents') 


							this.eventQueue 	= 	new EventQueue({
															collection:	this.events,
															...	{
																	...eventQueueConfigDefault,
																	...config.eventQueue
																}
														}) 

							this.eventQueue.on('annotation-fail', 		queued_event 	=> this.logAnnotationFailedEvent(queued_event) )
							this.eventQueue.on('annotation-done', 		queued_event 	=> this.logAnnotationDoneEvent(queued_event) )
							this.eventQueue.on('annotation-attempt', 	queued_event 	=> this.handleQueuedAnnotationEvent(queued_event) ) 

							// this.eventQueue.on('reply-fail', 			queued_event 	=> this.logReplyFailedEvent(reply) )
							// this.eventQueue.on('reply-done', 			queued_event 	=> this.logReplyDoneEvent(reply) )

							this.eventQueue.on('reply-attempt', 		queued_event 	=> this.handleQueuedReplyEvent(queued_event) ) 

						})

		//TODO:Add config to targets

		//TODO: this.eventQueue.on('fail', this.handleNewAnnotationEvent.bind(this))


		//TODO catch logout event!

		/* PLAN: Immer wenn User graucht wird auf login umleiten und aufgabe stacken, dann wenn der code und schließlich der token da ist, stack abarbeiten */
	
		//Api-calls mit demselben token stacken
		
		//throw user token away, if need be
	
		//TODO: separate meta data form target/sources

		//TODO: stack api calls 


		//TODO: rename controller for routes

		//TODO: add label to issues, no need for title addon

		//TODO: multipage!

		//TODO: check performacnce /how many api call at once?


	}

	queueAnnotationEvent(event){

		//check if event was relayed to this adapter, if not, ignore it:
		if(!event) 					return null 
		if(!event.target)			return null //maybe log error?
		if(!event.target.id)		return null //maybe log error?
		if(!event.target.adapter)	return null //maybe log error?

		if(event.target.adapter == this.id) this.eventQueue.add('annotation', event)
	}

	queueReplyEvent(event){

		//check if event was relayed to this adapter, if not, ignore it:
		if(!event) 					return null 
		if(!event.target)			return null //maybe log error?
		if(!event.target.id)		return null //maybe log error?
		if(!event.target.adapter)	return null //maybe log error?

		if(event.target.adapter == this.id) this.eventQueue.add('reply', event)
	}


	async handleOAuthCallback(req, res){

		var session_data	=	this._clearSessionData(req.session),
			json 			= 	{
									client_id: 		this.config.oAuth.clientId,
									client_secret: 	this.config.oAuth.clientSecret,
									code: 			req.query.code
								},
			uri				=	this.config.oAuth.accessTokenUrl


		return	Promise.resolve()
				.then( ()	=> request( {method: 'post', uri, json} ) )
				.then( data	=> session_data.access_token = data.access_token) 
				.then(
					//Todo: probably should redirect here
					() 	=> { res.redirect(this.core.frontEndUrl)},
					e	=> { res.status(500).send(e.toString()) }
				)	
		
	}

	async getAuthState(session_data){

		//it's alright if session data is missing

		var user 			= undefined,
			link			= this.config.authLink,
			access_token 	= session_data && session_data.access_token

		try {		user = await this.githubUser.get(access_token)	} 
		catch(e) {	console.log(e)	}

		return {user: user && user.login, link}
	}

	async getUserRepos(session_data){

		//TODO: if not logged in this should not throw:

		if(!session_data)				throw new ReferenceError("GithubAdapter.getUserRepos() missing session data")
		if(!session_data.access_token)	return []

		return 	Promise.map(
					this.githubUser.getInstallations(session_data.access_token),
					installation_id => this.githubApp.getRepositories(installation_id)
				)		
				.then(repository_arrays => Array.prototype.concat.apply([], repository_arrays))

	}

	async getEndpoints(session_data){

		var repos = await this.getUserRepos(session_data)

		//TODO: try not to invoke Githubtarget directly?
		return 	repos.map( repo => GithubTarget.fromRepo(this, repo) )
	} 	


	//return only endpoints the user has acces to!
	// add decor separately
	async getStoredEndpoints(session_data){

		var valid_endpoints				= await this.getEndpoints(session_data)

		if(valid_endpoints.length == 0)	return []

		var	query						= { $or : valid_endpoints.map( endpoint => ({ identifier: endpoint.identifier }) ) },
			stored_endpoint_data_array	= await this.endpoints.find(query).toArray(),
			stored_endpoints			= stored_endpoint_data_array.map( endpoint_data => this.newEndpoint(endpoint_data))

		return stored_endpoints
	}


	async handleQueuedAnnotationEvent(queued_event){

		//Todo: nur ztum testen:
		var event		= queued_event.event || queued_event,
			annotation	= event.annotation,
			target_id	= event.target.id

		//TODO: check event.link.target.id

		var target	= await this.getStoredEndpoint(target_id)


		await target.handleAnnotation(annotation)

		queued_event.settle()

	}


	async handleQueuedReplyEvent(queued_event){

		//Todo: nur ztum testen:
		var event		= queued_event.event || queued_event,
			reply		= event.reply,
			target_id	= event.target.id

		//TODO: check event.link.target.id

		var target	= await this.getStoredEndpoint(target_id)

		try{
			await target.handleReply(reply)
		}
		catch(e){
			console.error(e)
		}
		queued_event.settle()

	}


	//TODO
	async logAnnotationFailedEvent(queued_event){
		//console.log('this event failed', queued_event)
		return queued_event
	}

	async logAnnotationDoneEvent(queued_event){
		//console.log('this event was settled', queued_event)
		return queued_event
	}


}


module.exports = GitHubAdapter



	
