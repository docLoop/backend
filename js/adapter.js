'use strict';

var		EventEmitter 	= 	require('events'),
		express 		= 	require('express')


class docLoopAdapter extends EventEmitter {

	constructor(core, id){
		if(!core) throw "WebhookAnnotator: missing core."

		super()

		this.core 	= core
		this.id		= id

		this.app	= express()

		this.core.ready
		.then( ()  => {
			this.targets = this.core.db.collection(this.id+'_targets')
			this.sources = this.core.db.collection(this.id+'_sources')

			this.core.app.use('/'+this.id, this.app)
		})
	}


//Session data:

	//Todo:

	_getSources(session){
		return this.getSources(this._getSessionData(session))
	}

	_getTargets(session){
		return this.getTargets(this._getSessionData(session))
	}

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

	_validateSource(source, session){
		return this.validateSource(source, this._getSessionData(session))
	}

	_validateTarget(target, session){
		return this.validateTarget(target, this._getSessionData(session))
	}

	_getData(req){ //Todo session insetad of req!
		return this.getData(this._getSessionData(req.session))
	}



	_processAnnotation(annotation, target_id, link_id){

	}




	//Meant to be overwritten:
	validateSource(){
		return Promise.reject(this.constructor.name+".validateSource: not a source adapter")
	}

	validateTarget(){
		return Promise.reject(this.constructor.name+".validateTarget: not a target adapter")
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