"use strict";

const 	config			= require('../config.js'),
		EventEmitter 	= require('events'),
		express 		= require('express'),
		MongoClient 	= require('mongodb').MongoClient,
		session 		= require('express-session'),
		MongoStore 		= require('connect-mongo')(session),
		bodyParser 		= require('body-parser'),
		ObjectId 		= require('mongodb').ObjectID
		
Promise.hash 	= Promise.hash 	|| require('./utils.js').promiseHash
Promise.any		= Promise.any	|| require('./utils.js').promiseAny


class docLoopCore extends EventEmitter {

	constructor(config){
		super()

		this.config		= 	config
		this.adapters 	= 	{}

		// Databse
		this.dbPromise 	= 	MongoClient.connect('mongodb://localhost:'+this.config.db.port+'/'+this.config.db.name)
							.then( db => {
								this.db 	= db
								this.links 	= db.collection(config.linkCollection)
								return db
							})

		this.app		= 	express()

		//Sessions
		this.app.use(session({
			name:				'docloop.sid',
			secret:				config.sessionSecret,
			store:				new MongoStore( { dbPromise: this.dbPromise } ),
			resave:				false,
			saveUninitialized: 	true,
			cookie: 			{ 
									path: 		'/', 
									httpOnly: 	true,  //TODO!
									secure: 	'auto', 
									maxAge: 	null
								}
		}))

		this.app.use(function(req, res, next) {
			res.header('Access-Control-Allow-Credentials', 	true)
			res.header('Access-Control-Allow-Origin', 		req.headers.origin)
			res.header('Access-Control-Allow-Methods', 		'GET,PUT,POST,DELETE')
			res.header('Access-Control-Allow-Headers', 		'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept')
			next()		
		})


		this.app.use(bodyParser.json())
		this.app.use(express.static('public'))

		this.app.post(this.config.linkingRoute, this.handleLinkRequest.bind(this))
		this.app.get(this.config.linkingRoute, this.getLinks.bind(this))
		this.app.delete(this.config.linkingRoute+'/:id', this.deleteLink.bind(this))


		//TODO: Put into function!
		this.app.get('/adapters', (req, res, next) => {
			res.status(200).send(Object.keys(this.adapters))
		})

		//TODO: Put into function! Let adapeters handle this
		this.app.get('/adapters/:adapter', (req, res, next) => {

			console.log('getting adapter data...')

			var adapter_id = req.params.adapter

			if(!adapter_id || !this.adapters[adapter_id]) return res.sendStatus(404)


			Promise.hash({
				// availableSources:	this.adapters[adapter_id].getAvailableSources(req),
				// availableTargets: 	this.adapters[adapter_id].getAvailableTargets(req),
				// linkedSources:		this.adapters[adapter_id].getLinkedSources($req),
				// linkedTargets:		this.adapters[adapter_id].getLinkedTargets($req),
				data:					this.adapters[adapter_id]._getData(req)
			})
			.then(
				stats	=> res.status(200).send(stats),
				reason  => res.status(500).send(reason)
			)
			.catch(console.log)
		})


		this.app.get('/drop-session', function(req, res){
			req.session.destroy( err => err ? res.status(500).send() : res.status(200).send())
		})

		this.ready	 = 	Promise.all([
							this.dbPromise
						])
						.catch(err => { throw err })


		//TODO: Only call underscore_ methods of adapters

	
		//TODO: When insatllation gets removed clear links
		//
		//TODO: handle AnnotationRemovalEvent
		//TODO  handle AnnotationChangeEvent
		//
		//
		

		//TODO: in order to get all relevant links, adapter has to get all relevant targets/sources, then match

		//TODO: Maybe create Link Class? -> adapter_is zu adapter und methodes draufbauen

		//TODO: new-link event!

	}


	use(AdapterClass, config){
		var adapter = new AdapterClass(this, config)

		if(this.adapters[adapter.id]) throw "docLoop.Core: cannot register two adapters with the same id: " + adapter.id

		adapter.on('annotation', event => this.handleNewAnnotation(event, adapter) )
	
		this.adapters[adapter.id] = adapter
		
		return this
	}



	//Links, TODO: restrict to links the user has access to

	getLinks(req, res, next){

		Promise.hash({
			sources:	Promise.all(Object.keys(this.adapters).map(adapter_id => this.adapters[adapter_id]._getSources(req.session)))
						.then(source_arrays => Array.prototype.concat.apply([], source_arrays)),

			targets:	Promise.all(Object.keys(this.adapters).map(adapter_id => this.adapters[adapter_id]._getTargets(req.session)))
						.then(target_arrays => Array.prototype.concat.apply([], target_arrays))
		})
		.then( result	=> 	console.log(result.targets) || result)

		.then( result 	=> 	this.links.find({
								$or: [ 
									{'source.id': {$in: result.sources} }, 
									{'target.id' :{$in: result.targets} }
								] 
							}).toArray())

		.then( links	=> 	Promise.all(links.map(link => Promise.hash({
								_id:	link._id,
								source:	this.adapters[link.source.adapter].sources.findOne({_id: link.source.id}),
								target:	this.adapters[link.target.adapter].targets.findOne({_id: link.target.id})
							}))))

		.then( 
			links 	=> 	res.status(200).send(links),
			reason	=>	res.status(500).send(reason)
		)

	
	}

	deleteLink(req, res){
		var id = ObjectId(req.params.id)

		this.links.removeOne({_id: id})
		.then(
			result		=> res.status(200).send(result),
			reason		=> res.status(500).send(reason)
		)
		.catch(console.log)
	}


	validateLink(link, session){
		var source = link.source,
			target = link.target

		if(!source) 		return Promise.reject("docloopCore.validateLink: missing source") 
		if(!target)			return Promise.reject("docloopCore.validateLink: missing target") 

			
		if(!source.adapter) return Promise.reject("docloopCore.validateLink: missing source.adapter") 
		if(!target.adapter) return Promise.reject("docloopCore.validateLink: missing target.adapter") 


		var source_adapter 	= this.adapters[source.adapter],
			target_adapter	= this.adapters[target.adapter]

		if(!source_adapter)	return Promise.reject("docloopCore.validateLink: no matching source adpater found.") 
		if(!target_adapter)	return Promise.reject("docloopCore.validateLink: no matching target adpater found.") 


		return	Promise.hash({
					source_id: source_adapter._validateSource(source, session),
					target_id: target_adapter._validateTarget(target, session)
				})
				.then( pre_link => ({
					source: { 
						adapter: 	source_adapter.id, 
						id: 		pre_link.source_id
					},
					target: { 
						adapter: 	target_adapter.id,
						id: 		pre_link.target_id
					}
				}))
	}


	preventLinkDuplicate(link){
		return 	this.links.findOne(link)
				.then( duplicate =>	
					duplicate
					?	Promise.reject("docloopCore.preventLinkDuplicate: link already exists") 
					:	Promise.resolve(link) 
				)

	}


	handleLinkRequest(req, res, next){

		var source 	= req.body.source,
			target 	= req.body.target,
			link	= {target, source} 

		Promise.resolve(link)
		.then(link	=> { 
			return	this.validateLink(link, req.session) 
					.catch(reason => { res.status(400).send(reason); return Promise.reject(reason) })
		})
		.then(link	=> { 
			return 	this.preventLinkDuplicate(link) 
					.catch(reason => { res.status(409).send(reason); return Promise.reject(reason) })
		})
		.then(link	=> {
			return	this.links.insertOne(link)
					.catch(reason => { res.status(500).send(reason); return Promise.reject(reason) })
		})
		.then( ()	=> this.emit('new-link', link) )
		.then( () 	=> res.sendStatus(200) )
		.catch(console.log)
	}


	handleNewAnnotation(event, source_adapter) {
		//Todo: Remove bad links! -> in adapter

		var	annotation	= 	event.annotation,
			source 		= 	{
								adapter: 	source_adapter.id,
								id:			event.source_id,
							}


		this.links.find({source}).toArray()
		.then(links => Promise.all( links.map( link => {

				var target_adapter 	= this.adapters[link.target.adapter],
					target_id		= link.target.id

				return target_adapter.handleNewAnnotation(annotation, target_id, link._id) 

		})))
		.catch(console.log)
	}




	run(){		
		this.ready
		.then( () => {
			console.log('docLoop running, db on port ' + this.config.db.port + ' ...')
			this.app.listen(this.config.port)
		})
	}

}




class Link {
	constructor(core, data){
		this.core			= 	core
		this.reset()

		if(!data) return true

		data._id
		?	this.importSkeleton(data)
		:	this.importData(data)
	}

	reset(){
		this.id				= 	null

		this.sourceId		=	undefined
		this.targetId		=	undefined
		
		this.source			=	null
		this.target			=	null

		this.sourceAdapter 	= 	null
		this.targetAdapter 	= 	null
		
		this.validated		=	false
	}

	importData(link_data){

		this.reset()

		if(!link_data) 					return Promise.reject("Link.importData: missing link data") 
		if(!link_data.source.adapter) 	return Promise.reject("Link.importData: missing source.adapter") 
		if(!link_data.target.adapter) 	return Promise.reject("Link.importData: missing target.adapter") 

		
		this.sourceAdapter 	= this.core.adapters[link_data.source.adapter]
		if(!this.sourceAdapter)			return Promise.reject("Link.importData: no matching source adpater found.") 


		this.targetAdapter	= this.core.adapters[link_data.target.adapter]
		if(!this.targetAdapter)			return Promise.reject("Link.importData: no matching target adpater found.") 


		this.source 		= link_data.source
		this.target			= link_dara.target



		return Promise.resolve()
	}


	importSkeleton(link_skeleton){

		this.reset()

		if(!link_skeleton)				return Promise.reject("Link.importSkeleton: missing skeleton") 
		if(!link_skeleton._id)			return Promise.reject("Link.importSkeleton: missing id") 
		if(!link_skeleton.source_id) 	return Promise.reject("Link.importSkeleton: missing source id") 
		if(!link_skeleton.target_id) 	return Promise.reject("Link.importSkeleton: missing target id") 


		this.sourceAdapter 	= this.core.adapters[skeleton.source.adapter]
		if(!this.sourceAdapter)			return Promise.reject("Link.importSkeleton: no matching source adpater found.") 


		this.targetAdapter	= this.core.adapters[skeleton.target.adapter]
		if(!this.targetAdapter)			return Promise.reject("Link.importSkeleton: no matching target adpater found.") 
		
		
		return Promise.hash({
			source:	this.sourceAdapter.sources.findOne({_id: this.sourceId}),
			target:	this.targetAdapter.sources.findOne({_id: this.targetId})
		})
		.then( result => {
			this.id				=	link_skeleton._id

			this.sourceId		=	link_skeleton.source.id
			this.targetId		=	link_skeleton.target.id

			this.source			=	result.source
			this.target			=	result.target

			this.validated		=	true
		})

	}



	validate(session){
		if(this.validated && this.sourceId && this.targetId) 
								return Promise.resolve({source_id: this.sourceId, target_id: this.targetId})

		this.validated 	= false
		this.sourceId	= null
		this.targetId	= null 

		if(!this.source)		return Promise.reject('Link.validate: Missing source')
		if(!this.target)		return Promise.reject('Link.validate: Missing target')


		if(!this.sourceAdapter)	return Promise.reject("Link.validate: missing source adpater") 
		if(!this.targetAdapter)	return Promise.reject("Link.validate: missing target adpater") 


		return	Promise.hash({
					source_id:	this.sourceAdapter._validateSource(this.source, session),
					target_id:	this.targetAdapter._validateTarget(this.source, session)
				})
				.then(result 	=> (this.sourceId = result.source_id) && (this.targetId = result.target_id) )
				.then( ()		=> this.validated = true )
	}




	store(){
		if(!validated) return Promise.reject("Link.store: validation required")
		
		return 	this.core.links.insertOne({
					source : {
						adapter: 	this.sourceAdapter.id,
						id:			this.sourceId
					},
					target: {
						adapter:	this.targetAdapter.id,
						id:			this.targetId
					}
				})
				.then( result => this.id = result._id )
	}

}




module.exports  = new docLoopCore(config.core)
