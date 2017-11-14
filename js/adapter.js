'use strict'

var	EventEmitter 	= 	require('events'),
	Promise			= 	require('bluebird'),
	EventQueue		= 	require('./event-queue.js'),
	express 		= 	require('express'),
	docLoopCore		=	require('./docloop-core.js')

class docLoopAdapter extends EventEmitter {


	//Todo, put EventQueue config into adapter config


	constructor(core, config){
		if(!(core instanceof docLoopCore)) 	throw new TypeError("docLoopAdapter.constructor() invalid or missing core. Core must be instance of docLoopCore. "+core)
		if(typeof config.id != 'string')	throw new TypeError("docLoopAdapter.constructor() invalid or missing config.id; config.id must be a string. "+core)

		super()

		this.core 	= core
		this.id		= config.id
		this.app	= express()


		this.app.get('/', (req, res) => {


			Promise.hash({
				// availableSources:	this.adapters[adapter_id].getAvailableSources(req),
				// availableTargets: 	this.adapters[adapter_id].getAvailableTargets(req),
				// linkedSources:		this.adapters[adapter_id].getLinkedSources($req),
				// linkedTargets:		this.adapters[adapter_id].getLinkedTargets($req),
				data:					this._getData(req.session)
			})
				.then(
					stats	=> res.status(200).send(stats),
					reason  => res.status(500).send(reason) 
				)
		})



		this.ready = 	this.core.ready
						.then( ()  => {
							this.targets 			= 	this.core.db.collection(this.id+'_targets')
							this.sources 			= 	this.core.db.collection(this.id+'_sources')
							this.annotationEvents 	= 	this.core.db.collection(this.id+'_annotationEvents') 


							this.annotationQueue 	= 	new EventQueue({
															collection:	this.annotationEvents,
															...config.annotationQueue
														}) 

							this.annotationQueue.on('fail', 	queued_event 	=> this._logAnnotationFailedEvent(queued_event) )
							this.annotationQueue.on('done', 	queued_event 	=> this._logAnnotationDoneEvent(queued_event) )

							this.core.on('new-annotation', 		event 			=> this._handleNewAnnotationEvent(event))

							this.core.app.use('/adapters/'+this.id, this.app)

						})
	}


	//Session data:

	_getSessionData(session){
		if(!session) return null

		session.adapters 			= session.adapters 			|| {}
		session.adapters[this.id]	= session.adapters[this.id]	|| {}

		return session.adapters[this.id]
	}

	_clearSessionData(session){
		if(!session) return null

		session.adapters 			= session.adapters 		|| {}
		session.adapters[this.id]	= {}

		return session.adapters[this.id]
	}

	_getSources(session){
		return this.getSources(this._getSessionData(session))
	}

	_getTargets(session){
		return this.getTargets(this._getSessionData(session))
	}


	_validateSourceIdentifier(source_identifier, session){
		return 	this.validateSourceIdentifier(source_identifier, this._getSessionData(session))

	}

	_validateTargetIdentifier(target_identifier, session){
		return this.validateTargetIdentifier(target_identifier, this._getSessionData(session))
	}

	_getData(session){
		return this.getData(this._getSessionData(session))
	}


	//annotation events:

	_handleNewAnnotationEvent(event){
		if(event.targetIdentifier.adapter == this.id) this.annotationQueue.add(event)
	}

	_logAnnotationFailedEvent(queued_event){
		//console.log('this event failed', queued_event)
		return queued_event
	}

	_logAnnotationDoneEvent(queued_event){
		//console.log('this event was settled', queued_event)
		return queued_event
	}

	_getFailedEvents(){}

	_getSettleEvents(){}



	//Meant to be overwritten:
	validateSourceIdentifier(){
		return Promise.reject(this.constructor.name+".validateSource: not a source adapter")
	}

	validateTargetIdentifiersysys(){
		return Promise.reject(this.constructor.name+".validateTarget: not a target adapter")
	}

	getSourceIdentifier(){
		return Promise.reject(this.constructor.name+".getSourceIdentifier: not a source adapter")
	}

	getTargetIdentifier(){
		return Promise.reject(this.constructor.name+".getTargetIdentifier: not a target adapter")
	}

	


	getData(){
		return 	Promise.resolve( {adapter:		this.id} )
	}

	getTargets(){
		return []
	}

	getSources(){
		return []
	}


}

module.exports = docLoopAdapter