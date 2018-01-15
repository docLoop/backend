'use strict'

var		docLoopAdapter 	= 	require('../../adapter.js'),
		config			=	require('../../../config.js').paperhive,
		PaperhiveSource	=	require('./paperhive-source.js'),
		request			=	require('request-promise-native').defaults({json:true}),
		Promise			=	require('bluebird')
		

class PaperhiveAdapter extends docLoopAdapter {

	constructor(core, config){

		super(core, {

			...config, 

			id:						'paperhive',
			type:					'source',
			endpointClass:			PaperhiveSource,
			endpointDefaultConfig:	{
										includePastAnnotations: 	true,
									}
		})

		this.id 	= 'paperhive'
		this.config = config

		this.core.on('link-established', this.handleLinkEstablishedEvent.bind(this) )

		this.core.on('link-removed', link => {
			console.log('### link removed', link.id)
		})

		this.core.ready
		.then( () => {
			setInterval(this.scanSources.bind(this), this.config.scanningInterval || 6*60*60*1000) 
		})

	}

	async getStoredEndpoints(){
		var endpoint_data_array = await this.endpoints.find({}).toArray()

		return endpoint_data_array.map( endpoint_data => this.newEndpoint(endpoint_data) )
	}

	handleDiscussion(source, discussion){
		this.core.pipe('annotation', source, this.discussion2Annotation(discussion) )

		discussion.replies.forEach( reply => {
			this.core.pipe('annotation', source, this.reply2Annotation(reply))
		})

	}

	async handleLinkEstablishedEvent(link){

		if(!link || !link.source || !link.source.adapter == this.id) return null

		var source = await this.getStoredEndpoint(link.source.id)

		source.scan()
	}

	async scanSources(){
		//TODO check for Errors!
		//TOSO spread events? Dont handle all of them at the same time...

		var sources = await this.getStoredEndpoints()

		console.log('scanning...')

		sources.forEach( source => source.scan() )
	}

}

module.exports = PaperhiveAdapter