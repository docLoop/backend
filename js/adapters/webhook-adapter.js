var		docLoopAdapter 	= 	require('../adapter.js')

class WebhookAdapter extends docLoopAdapter {

	constructor(core){

		if(!core) throw "WebhookAnnotator: missing core."
		super(core)

		this.id 	= 'webhook'

		this.app('/', this.handlePost.bind(this))


	}

	getSourceObject(secret){
		return {
			adapter:	this.id,
			secret:		secret
		}
	}


	validateSource(source, session_data){
		if(source.adapter != this.id) 	return Promise.reject('WebhookAdapter.verifyTarget: Adapter mismatch')
		if(!source.secret)				return Promise.reject('WebhookAdapter.verifyTarget: Secret missing')


		return Promise.resolve(source)
	}

	normalizeAnnotation(data){
		return {
			author:		data.author,
			body:		data.body,
			title:		data.title //type? Comment?reaction
		}
	}


	handlePost(req, res, next){
		var data	= 	req.body

		if(!data.secret) 		return res.status(400).send({error: 'missing secret'})
		if(!data.annotation) 	return res.status(400).send({error: 'missing annotation'})


		this.emit('annotation', {
			source:		this.getSourceObject(data.secret),
			annotation:	this.normalizeAnnotation(data.annotation) //maybe create Annotation object
		})

		res.sendStatus(200)
	}



}

module.exports = WebhookAdapter