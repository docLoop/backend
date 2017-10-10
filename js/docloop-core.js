"use strict";

const 	config			= require('../config.js').core,
		EventEmitter 	= require('events'),
		express 		= require('express'),
		MongoClient 	= require('mongodb').MongoClient,
		session 		= require('express-session'),
		MongoStore 		= require('connect-mongo')(session),
		bodyParser 		= require('body-parser')
		


class docLoopCore extends EventEmitter {

	constructor(){
		super()

		this.config		= 	config 
		this.adapters 	= 	{}

		// Databse
		this.dbPromise 	= 	MongoClient.connect('mongodb://localhost:'+this.config.db.port+'/'+this.config.db.name)
							.then( db => {
								this.db = db
								this.links = db.collection(config.linkCollection)
								return db
							})

		this.server		= 	express()

		//Sessions
		this.server.use(session({
			name:				'docloop.sid',
			secret:				config.sessionSecret,
			store:				new MongoStore( { dbPromise: this.dbPromise } ),
			resave:				false,
			saveUninitialized: 	true,
			cookie: 			{ 
									path: 		'/', 
									httpOnly: 	true, 
									secure: 	'auto', 
									maxAge: 	null
								}
		}))


		this.server.use(bodyParser.json())
		this.server.use(express.static('public'))

		this.server.post(this.config.linkingRoute, this.handleLinkRequest.bind(this))
		this.server.get(this.config.linkingRoute, this.getLinks.bind(this))


		this.ready	 = 	Promise.all([
							this.dbPromise
						])
						.catch(err => { throw err })

	
		//TODO: When insatllation gets removed clear links
		//
		//TODO: handle AnnotationRemovalEvent
		//TODO  handle AnnotationChangeEvent

	}


	use(AdapterClass){
		var adapter = new AdapterClass(this)

		if(this.adapters[adapter.id]){
			throw "docLoop.Core: cannot register two adapters with the same id: " + adapter.id
		}

		adapter.on('annotation', event => this.handleNewAnnotation(event, adapter) )
		
		this.adapters[adapter.id] = adapter
		
		return this
	}



	//Links:

	getLinks(req, res, next){
		this.links.find().toArray()
		.then( links =>{
			res.send(links)
		})
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


		return	Promise.all([
					source_adapter.validateSource(source, session),
					target_adapter.validateTarget(target, session)
				])
				.then( l => ({
								source: { 
									adapter: source_adapter.id, 
									id: l[0]
								},
								target: { 
									adapter: target_adapter.id,
									id: l[1]
								}
							})
				)
	}


	preventLinkDuplicate(link){
		return 	this.links.findOne(link)
				.then(duplicate =>	
					duplicate
					?	Promise.reject("docloopCore: link already exists") 
					:	Promise.resolve(link) 
				)

	}

	saveLink(link){
		console.log('saveLink:', link)
		return this.links.insertOne(link)
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
			return	this.saveLink(link)
					.catch(reason => { res.status(500).send(reason); return Promise.reject(reason) })
		})
		.then(	() 	=> res.sendStatus(200) )
		.catch(console.log)
	}


	handleNewAnnotation(event, source_adapter) {
		//Todo: Remove bad links!


		console.log('NEW ANNOTAION')
		console.log(event)

		var	annotation	= 	event.annotation,
			source 		= 	{
								adapter: 	source_adapter.id,
								id:			event.source_id,
							}

		this.links.find({source}).toArray()
		.then(links => Promise.all( 
			links.map( link => {
				var target_adapter 	= this.adapters[link.target.adapter],
					target_id		= link.target.id

				console.log('#')
				return target_adapter.handleNewAnnotation(annotation, target_id, link._id) 
			})
			
		))
		.catch(console.log)
	}




	run(){		
		this.ready
		.then( () => {
			console.log('docLoop running, db on port ' + this.config.db.port + ' ...')
			this.server.listen(this.config.port)
		})
	}

}

module.exports  = new docLoopCore()
