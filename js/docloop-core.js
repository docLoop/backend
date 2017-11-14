'use strict'

const 	EventEmitter 	= require('events'),
		express 		= require('express'),
		MongoClient 	= require('mongodb').MongoClient,
		session 		= require('express-session'),
		MongoStore 		= require('connect-mongo')(session),
		bodyParser 		= require('body-parser'),
		Promise			= require('bluebird'),
		Link			= require('./link.js')



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

		this.app.post(	this.config.linkingRoute, 				this.handlePostLinkRequest.bind(this))
		this.app.delete(this.config.linkingRoute+'/:id', 		this.handleDeleteLinkRequest.bind(this))
		
		this.app.get(	this.config.linkingRoute, 				this.handleGetLinksRequest.bind(this))
		this.app.get(	'/adapters', 							this.handleGetAdaptersRequest.bind(this))
		this.app.get(	'/drop-session', 						this.handleDropSessionRequest.bind(this))


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
		

		//TODO: new-link event!

		//Use ErrorObjects

	}


	use(AdapterClass, config){
		var adapter = new AdapterClass(this, config)

		if(this.adapters[adapter.id]) throw "docLoop.Core: cannot register two adapters with the same id: " + adapter.id

		adapter.on('annotation', event => this.handleNewAnnotation(event, adapter) )
	
		this.adapters[adapter.id] = adapter

		return this
	}


	handleDropSessionRequest(req, res){
		req.session.destroy( err => 
			!err 
			? 	res.status(200).send('Session dropped.')
			:	res.status(500).send(err) 
		)
	}


	handleGetAdaptersRequest(req, res){
		res.status(200).send(Object.keys(this.adapters))
	}


	handleGetLinksRequest(req, res){

		Promise.resolve( Object.keys(this.adapters).map(adapter_id => this.adapters[adapter_id] ) )
		.then( adapters	=> Promise.props({
			sourceIdentifiers:	Promise.reduce(
									adapters, 
									adapter 		=> adapter._getSources(req.session),
									(total, sub) 	=> total.conact(sub)
								),

			targetIdentifiers:	Promise.reduce(
									adapters, 
									adapter 		=> adapter._getTargets(req.session),
									(total, sub) 	=> total.conact(sub)
								)
		}))
		.then( result	=>	[
								...result.sourceIdentifiers.map(sourceIdentifier => ({sourceIdentifier}) ),
								...result.targetIdentifiers.map(targetIdentifier => ({targetIdentifier}) )
							]
		)
		.then( queries	=> 	({$or: queries}) )
		.then( or_query	=> 	Promise.map(

								or_query.$or.length 
								?	this.links.find(or_query).toArray() 
								: 	[],

								link_data	=> this.link(link_data) 
							)
		)
		.then( 
			links 	=> 	res.status(200).send(links),
			reason	=>	res.status(500).send(reason) && Promise.reject(reason)
		)
		.catch(console.log)	
	}


	handleDeleteLinkRequest(req, res){
		//TODO: Needs auth check!
		return "STOP needs auth check"|| this.Link(req.params.id).remove()
				.then(
					result		=> res.status(200).send(result),
					reason		=> res.status(500).send(reason)
				)
	}



	handlePostLinkRequest(req, res){

		var sourceIdentifier 	= req.body.source,
			targetIdentifier 	= req.body.target,
			link				= this.Link({sourceIdentifier, targetIdentifier})

		return	Promise.resolve()
				.then( () => 	link.validate(req.session) 
								.catch( reason => res.status(400).send(reason) && Promise.reject(reason) )
				)
				.then( () => 	link.preventDuplicate() 
								.catch( reason => res.status(409).send(reason) && Promise.reject(reason) )
				)
				.then( () => 	link.store() 
								.catch( reason => res.status(500).send(reason) && Promise.reject(reason) )
				)
				.then( () => 	res.sendStatus(200) )

				.catch(console.log)
	}


	handleNewAnnotation(event) {
		//Todo: Remove bad links! -> in adapter

		var	annotation			= 	event.annotation,
			sourceIdentifier 	= 	event.sourceIdentifier


		Promise.resolve()
		.then( ()		=> 	Promise.map(
								this.links.find({sourceIdentifier}).toArray(), 
								link_data 	=> 	this.Link(link_data) 
							)
		)
		.then( links 	=> 	Promise.map(
								links,
								link 		=> 	this.emit('new-annotation', {
													annotation:			annotation,
													targetIdentifier :  link.targetIdentifier,
													linkId:				link.id,
												})
							)
		)
		.catch(console.log)
	}

	Link(data){
		return new Link(this, data)
	}



	run(){		
		this.ready
		.then( () => {
			console.log('docLoop running, db on port ' + this.config.db.port + ' ...')
			this.app.listen(this.config.port)
		})
	}

}












module.exports  = docLoopCore
