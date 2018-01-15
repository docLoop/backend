'use strict'

const 	EventEmitter 	= require('events'),
		DocLoopAdapter	= require('./adapter.js'),
		express 		= require('express'),
		MongoClient 	= require('mongodb').MongoClient,
		session 		= require('express-session'),
		MongoStore 		= require('connect-mongo')(session),
		bodyParser 		= require('body-parser'),
		Promise			= require('bluebird'),
		Link			= require('./link.js'),
		ObjectId 		= require('mongodb').ObjectID



class DocLoopCore extends EventEmitter {

	constructor(config){
		super()

		this.config		= 	config
		this.adapters 	= 	{}

		// Databse
		this.dbPromise 	= 	MongoClient.connect('mongodb://localhost:'+this.config.db.port+'/'+this.config.db.name)
							.then( db => {
								this.db 	= db
								this.links 	= db.collection('links')
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

		//Routes


		this.app.use(bodyParser.json())
		this.app.use(express.static('public'))

		this.app.get(	'/links/:id', 		this.handleGetLinkRequest.bind(this))
		this.app.post(	'/links', 			this.handlePostLinkRequest.bind(this))
		this.app.delete('/links/:id', 		this.handleDeleteLinkRequest.bind(this))
		this.app.put(	'/links/:id', 		this.handlePutLinkRequest.bind(this))

		this.app.get(	'/links', 			this.handleGetLinksRequest.bind(this))
		this.app.get(	'/adapters', 		this.handleGetAdaptersRequest.bind(this))
		this.app.get(	'/dropSession', 	this.handleDropSessionRequest.bind(this))

		//Events

		this.preventRelayEventNames = [

			'newListener', 
			'removeListener', 

			'link-established',
			'link-removed',
			'link-updated'
		],


		//Ready:

		this.ready	 = 	Promise.join(
							this.dbPromise
						)
						.catch(err => { throw err }) //doesnt do anything, does it? Add to log

		//TODO; All objects can be manifested as  id_data or data or full object 

		//TODO: Log Errors, resp. have core log errors, add ErrorEvent listener!

		//TODO: Get AuthorizedEndpoints

		//TODO: Separate events for annotation and reply!

		//TODO: separate adapters for sources and targets, only use endpoints

		//TODO: get abstract handle request


		//TODO: rethink validation and authentication: what makes a link valid? Who can delete it?

		//TODO: Only call underscore_ methods of adapters

	
		//TODO: When insatllation gets removed clear links
		//
		//TODO: handle AnnotationRemovalEvent
		//TODO  handle AnnotationChangeEvent
		

		//TODO: Relay auslagern
		

		//TODO: new-link event!

		//Use ErrorObjects

		//TODO: There should never be a public target!

		//TODO: In packages aufstpalten

		//TODO: Separate handle function for error handling

		//TODO: Error Handling -> Add DocloopError object



	}


	use(AdapterClass, config){


		// if( !DocLoopAdapter.prototype.isPrototypeOf(AdapterClass.prototype) ) throw new TypeError("DocLoopCore.use() AdapterClass must inherit from DocLoopAdapter")

		var adapter = new AdapterClass(this, config)

		if(this.adapters[adapter.id]) throw new Error("DocLoopCore.use() cannot register two adapters with the same id: " + adapter.id)

		this.adapters[adapter.id] = adapter

		this.syncRelayListeners(adapter)




		//TODO: keep track of bound realy functions. listen to 'newlistener', dont sync all adpazters all the time.

		return this
	}

	syncRelayListeners(adapter) {

		var ignore_events_array		= this.preventRelayEventNames,
			core_event_names_array  = this.eventNames().filter( event_name => ignore_events_array.indexOf(event_name) == -1)

		core_event_names_array.forEach( event_name => {
			adapter.addListener(event_name, this.relayEvent.bind(this, event_name) ) 
		})

		this.on('newListener', 	event_name => adapter.addListener(event_name, this.relayEvent.bind(this, event_name) ))
	}


	async handleDropSessionRequest(req, res){
		req.session.destroy( err => 
			!err 
			? 	res.status(200).send('Session dropped.')
			:	res.status(500).send(err.toString()) 
		)
	}


	async handleGetAdaptersRequest(req, res){
		return	Promise.map(
					Object.keys(this.adapters).map( id => this.adapters[id]),
					adapter => 	adapter._getData(req.session)
				)
				.then(
					result 	=> 	res.status(200).send(result),
					reason	=> 	res.status(500).send(reason.toString())
				)
	}

	//single Link!
	async handleGetLinkRequest(req, res){
		
		try { 
			var link = await this.getStoredLink(req.params.id) 

			res.status(200).send(link.export)
		} 
		catch(reason){ 
			console.error(reason)
			res.status(500).send(reason.toString())
		}

	}



	async handleGetLinksRequest(req, res){

		try {

			var sources			=	[].concat.apply([], await Promise.map(this.sourceAdapters, adapter => adapter._getStoredEndpoints(req.session) ) ),
				targets			=	[].concat.apply([], await Promise.map(this.targetAdapters, adapter => adapter._getStoredEndpoints(req.session) ) )



			if(sources.length == 0) return res.status(200).send([])
			if(targets.length == 0) return res.status(200).send([])


			var	source_queries 	= 	sources.map( source => ({'source.id' : source.id, 'source.adapter': source.identifier.adapter}) ),
				target_queries 	= 	targets.map( target => ({'target.id' : target.id, 'target.adapter': target.identifier.adapter}) )

			var	raw_links		=	await	this.links.find({
												"$and": [
													{ "$or": source_queries },
													{ "$or": target_queries }
												]
											}).toArray()

			var links			= 	raw_links
									.map( raw_link 	=> this.newLink({
										id:			raw_link._id,
										source : 	sources.filter( source => source.adapter.id == raw_link.source.adapter && source.id.equals(raw_link.source.id) )[0],
										target : 	targets.filter( target => target.adapter.id == raw_link.target.adapter && target.id.equals(raw_link.target.id) )[0],
									}))


			await	Promise.map( 
						links,
						link	=> Promise.join(link.source.updateDecor(req.session), link.target.updateDecor(req.session)) 
					)						

					
			res.status(200).send(links.map( link => link.export ))


		} catch (e) {
			res.status(500).send(e.toString())
			console.error(e)
		}

	}
	

	//TODO: Tests

	async handleDeleteLinkRequest(req, res){

		try { 
			var link = await this.getStoredLink(req.params.id) 
			if(!link) return res.status(404).send()
		}
		catch(e){ 
			console.error(e)
			res.status(500).send(e.toString()) 
			return null 
		}

		return 	Promise.resolve()
				.then( () => link.validate(req.session) )
				.then( () => link.remove() )
				.then( () => this.emit('link-removed', link))
				.then(
					result		=> res.status(200).send(result),
					reason		=> res.status(500).send(reason.toString())
				)
	}



	async handlePostLinkRequest(req, res){


		var source	= req.body.source,
			target	= req.body.target


		//TODO: throw errors:

		if(!source) return res.status(400).send('missing source')
		if(!target) return res.status(400).send('missing target')


		try	{	var link = await this.newLink({source, target}) }

		catch(e){	
				console.error(e)
				return res.status(400).send(e.toString()) 
		}



		try{	await link.validate(req.session) }	

		catch(e){	
				console.error(e)
				return res.status(400).send(e.toString())
		}


		try{	await link.preventDuplicate() }

		catch(e){	
				console.error(e)
				return res.status(409).send(e.toString())
		}


		try{	await link.store() }
		catch(e){	
				console.error(e)
				return res.status(500).send(e.toString())
		}

		res.status(200).send(link.export)
		this.emit('link-established', link.skeleton)
	}


	async handlePutLinkRequest(req, res){

		var id		= req.params.id,
			source	= req.body.source,
			target	= req.body.target


		//TODO: throw errors:

		if(!id) 	return res.status(400).send('missing id')
		if(!source) return res.status(400).send('missing source')
		if(!target) return res.status(400).send('missing target')


		try		{ var link = await this.getStoredLink(id) }
		catch(e){ 
			console.error(e)
			return res.status(404).send('unable to find link: '+e)
		} 


		try	{ 
			link.source.identifier 	= source.identifier
			link.source.config 		= source.config

			link.target.identifier 	= target.identifier
			link.target.config 		= target.config

			await link.validate(req.session)
			await link.source.update()			
			await link.target.update()
		}
		catch(e){ 
			console.error(e)
			return res.status(500).send('unable to update link: '+e)
		} 


		res.status(200).send("link updated")
	}




	get sourceAdapters(){
		return Object.values(this.adapters).filter( adapter => adapter.type == 'source')
	}

	get targetAdapters(){
		return Object.values(this.adapters).filter( adapter => adapter.type == 'target')
	}




	async relayEvent(event_name, data) {

		//If the event wasn't meant to be relayed:
		if(!data || !data.source)	return null

		var source 	= data.source

		delete data.source

		//If it was meant to be relayed but, crucial data is missing: 
		if(!source.id) 			throw new ReferenceError('docLoopCore.relayEvent()) missing source id')
		if(!source.adapter) 	throw new ReferenceError('docLoopCore.relayEvent()) missing source adapter')


		var links	= await this.links.find({source}).toArray()


		links
		.map( 		link 	=> link.target)
		.forEach( 	target 	=> this.emit(event_name, { ...data, target, relayed: true} ) )
	}


	// this is useful in case other Classes use their referece to core, same with endpoints
	newLink(data){
		return new Link(this, data)
	}


	async getStoredLink(id){

		if(!id) throw ReferenceError("docLoopCore.getStoredLink() missing id")
		if(id._bsontype != 'ObjectId') id = ObjectId(id)


		var link_skeleton 		= 	await this.links.findOne({'_id': id})

		if(!link_skeleton)					throw new Error("docLoopCore.getStoredLink() unable to find link in db")

		if(!link_skeleton.source) 			throw new Error("docLoopCore.getStoredLink() unable to read source from db")
		if(!link_skeleton.target) 			throw new Error("docLoopCore.getStoredLink() unable to read target from db")

		if(!link_skeleton.source.adapter) 	throw new Error("docLoopCore.getStoredLink() unable to read source.adapter from db")
		if(!link_skeleton.target.adapter) 	throw new Error("docLoopCore.getStoredLink() unable to read target.adapter from db")

		if(!link_skeleton.source.id) 		throw new Error("docLoopCore.getStoredLink() unable to read source.id from db")
		if(!link_skeleton.target.id) 		throw new Error("docLoopCore.getStoredLink() unable to read target.id from db")

		var source_adapter 		= 	this.adapters[link_skeleton.source.adapter],
			target_adapter		= 	this.adapters[link_skeleton.target.adapter]

		if(!source_adapter)					throw new Error("docLoopCore.getStoredLink() unable find matching source adapter")	
		if(!target_adapter)					throw new Error("docLoopCore.getStoredLink() unable find matching target adapter")	

		var	[source, target] 	=  	await	Promise.all([
												source_adapter.getStoredEndpoint(link_skeleton.source.id),
												target_adapter.getStoredEndpoint(link_skeleton.target.id)
											])

		if(!source)							throw new Error("docLoopCore.getStoredLink() unable to find matching source")
		if(!target)							throw new Error("docLoopCore.getStoredLink() unable to find matching target")

		return this.newLink({id, source, target})
	}




	run(){		
		this.ready
		.then( () => {
			console.log('docLoop running, db on port ' + this.config.db.port + ' ...')
			this.app.listen(this.config.port)
		})
	}

}

module.exports  = DocLoopCore
