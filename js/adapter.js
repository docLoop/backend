'use strict'

var	EventEmitter 	= 	require('events'),
	Promise			= 	require('bluebird'),
	ObjectId 		= 	require('mongodb').ObjectID,
	express 		= 	require('express'),
	Target			=	require('./endpoint.js').Target,
	Endpoint		=	require('./endpoint.js')


class AdapterTypeError extends Error{}

class DocLoopAdapter extends EventEmitter {


	//Todo, put EventQueue config into adapter config
	//TODO: Endpoint class into cinstructor

	//TODO: DO not store decoration
	//custom getDecoration function needed

	constructor(core, config){

		if(!config)							throw new ReferenceError("docLoopAdapter.constructor() missing config")
		if(typeof config.id != 'string')	throw new TypeError("docLoopAdapter.constructor() invalid or missing config.id; config.id must be a string, got: "+ (typeof config.id) )

		super()

		this.core 					= core
		this.id						= config.id + (config.extraId ? '-' + config.extraId :'')
		this.name					= config.name
		this.type					= config.type
		this.endpointClass			= config.endpointClass || Endpoint
		this.extraEndpoints 		= !!config.extraEndpoints
		this.endpointDefaultConfig	= config.endpointDefaultConfig || {}
		this.app					= express()

		this.ready = 	this.core.ready
						.then( ()  => {
							this.endpoints 	= this.core.db.collection(this.id+'_endpoints')

							this.core.app.use('/adapters/'+this.id, this.app)
							
							this.app.get('/', 					this._handleGetRequest.bind(this) )

							this.app.get('/endpoints',			this._handleGetEndpointsRequest.bind(this) )

							this.app.get('/guessEndpoint/:str',	this._handleGetGuessEndpointRequest.bind(this) )
						})

	}


	//Session data:

	_getSessionData(session){
		if(!session) 								throw new Error("DocLoopAdapter._getSessionData() missing session")
		if(!session.constructor.name == "Session") 	throw new TypeError("DocLoopAdapter._getSessionData() session must be instance of Session; got: "+session.constructor.name)

		session.adapters 			= session.adapters 			|| {}
		session.adapters[this.id]	= session.adapters[this.id]	|| {}

		return session.adapters[this.id]
	}

	_clearSessionData(session){
		if(!session) return null

		session.adapters 			= session.adapters 			|| {}
		session.adapters[this.id]	= {}

		return session.adapters[this.id]
	}


	newEndpoint(data){
		return new this.endpointClass(this, data)
	}

	async _getEndpoints(session){
		return this.getEndpoints(this._getSessionData(session)).catch( e => console.log(e) || [])
	}

	async _getStoredEndpoints(session){
		return this.getStoredEndpoints(this._getSessionData(session))
	}

	async _getAuthState(session){
		return this.getAuthState(this._getSessionData(session))
	}

	async _getData(session){
		return Promise.props({
			id:						this.id,
			name:					this.name,
			type:					this.type,
			extraEndpoints:			this.extraEndpoints,
			endpointDefaultConfig:	this.endpointDefaultConfig,
			auth:					this._getAuthState(session).catch( e => console.log(e) || null),
		})
	}

	async _handleGetRequest(req, res){
		return 	this._getData(req.session)
				.then(
					result	=>	res.status(200).send(result),
					reason  => 	res.status(500).send(reason.toString() )
				)
	}

	async _handleGetEndpointsRequest(req, res){

		return 	Promise.map(
					this._getEndpoints(req.session),
					endpoint => endpoint.export
				)
				.then(
					endpoints => 	res.status(200).send(endpoints),
					reason  => 	{
									if(reason instanceof AdapterTypeError) return res.status(404).send(reason.toString())
									res.status(500).send(reason.toString() )
									console.error(reason)
								}
				)
	}



	async _handleGetGuessEndpointRequest(req,res){
		
		var endpoint	= undefined, 
			input		= req.params.str


		if(!input) return res.status(400).send("Missing input")

		try {	endpoint = await this.endpointClass.guess(this, input, req.session) }
		catch(e){
			console.error(e)
			res.status(404).send(e.toString())
		}

		res.status(200).send(endpoint.export)

	}


	//TODO: check authorization:

	async getStoredEndpoint(id){
		if(!id) throw ReferenceError("DocLoopAdapter.getStoredEndpoint() missing id")
		if(id._bsontype != 'ObjectId') id = ObjectId(id)

		var endpoint_data = await this.endpoints.findOne({'_id': id})
	
		if(!endpoint_data) throw new Error("DocLoopAdapter.getStoredEndpoint() unable to find Endpoint")

		return this.newEndpoint(endpoint_data)
	}



	async guessEndpoint(str, session_data){
		throw new AdapterTypeError("DocLoopAdapter.guessEndpoint() this adapter cannot guess endpoints: "+ this.id)
	}

	async getEndpoints(session_data){

		//TODO throw not-implemented
		return []
	}


	// this should be replaced with a filter for only the endpoints the current user has access to
	// maybe default should be []
	async getStoredEndpoints(session_data){
		return []
	}

	
	async getAuthState(session_data){
		return {
			link:	null,
			user:	null
		}
	}

}

module.exports = DocLoopAdapter