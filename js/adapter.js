var		EventEmitter 	= 	require('events')

class docLoopAdapter extends EventEmitter {

	constructor(core, id){
		if(!core) throw "WebhookAnnotator: missing core."

		super()

		this.core 	= core
		this.id		= id

		this.core.ready
		.then( ()  => {
			this.targets = this.core.db.collection(this.id+'_targets')
			this.sources = this.core.db.collection(this.id+'_sources')
		})
	}


//Session data:


	getSessionData(session){
		if(!session) return null

		session.adapters 			= session.adapters 			|| {}
		session.adapters[this.id]	= session.adapters[this.id]	|| {}

		return session.adapters[this.id]
	}

	clearSessionData(session){
		if(!session) return null

		session.adapters 			= session.adapters 		|| {}
		session.adapters[this.id]	= {}

		return session.adapters[this.id]
	}

	validateSource(){
		return Promise.reject(this.constructor.name+".validateSource: not a source adapter")
	}

	validateTarget(){
		return Promise.reject(this.constructor.name+".validateTarget: not a target adapter")
	}

}

module.exports = docLoopAdapter