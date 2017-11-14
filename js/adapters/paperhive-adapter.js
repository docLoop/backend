'use strict'

var		docLoopAdapter 	= 	require('../adapter.js'),
		config			=	require('../../config.js').paperhive,
		request			=	require('request-promise-native').defaults({json:true}),
		Promise			=	require('bluebird')
		

class PaperHiveAdapter extends docLoopAdapter {

	constructor(core){

		super(core)

		this.id 	= 'paperhive'
		this.config = config

		this.core.ready
		.then( () => setInterval(this.lookForNewAnnotations.bind(this), 6*60*60*1000) )


		this.core.on('new-link', link => {
			//console.log('NEW LINK', link)
			if(link.source.adapter == this.id) this.lookForNewAnnotations()
		})

		//TODO: Scrape Route
		//TODO: Interval ceck
		//TODO: Bookkeeping

	}

	getSourceObject(document_id){
		this.sources.findOne({document_id: document_id})
	}


	saveSource(source){
		return	this.sources.findOne(source)
				.then(
					duplicate	=>	duplicate 
									?	duplicate._id 
									:	this.sources.insertOne(source)
										.then(result => result.insertedId)									
				)
	}

	getDiscussions(source){
		return 	request.get('https://paperhive.org/api/documents/'+source.document_id+'/discussions')
				.then( result => result.discussions)
	}

	validateSource(source){
		if(!source)						return Promise.reject('PaperHiveAdapter.validateSource: missing source')
		if(!source.document_id)			return Promise.reject('PaperHiveAdapter.validateSource: missing document_id')

		return 	this.getDiscussions(source)
				.then( () 		=> this.saveSource(source) )
				.catch( reason 	=> Promise.reject('PaperHiveAdapter.validateSource: unable to read discussions ' +reason))
					
	}


	discussion2Annotation(discussion){
		return {
			id:						discussion.id,
			sourceName:				this.config.name,
			sourceHome:				this.config.home,
			title:					discussion.title,
			author:					discussion.author.displayName,
			body:					discussion.body,
			respectiveContent:		discussion.target.selectors.textQuote.content,
			original:				this.config.contentLink.replace(/%s/, discussion.target.document),
		}
	}

	reply2Annotation(reply){
		return {
			parentId:				reply.discussion,
			id:						reply.id,
			sourceName:				this.config.name,
			sourceHome:				this.config.home,
			author:					reply.author.displayName,
			body:					reply.body,
			original:				this.config.contentLink.replace(/%s/, reply.document),
		}
	}

	handleDiscussion(source, discussion){
		this.emit('annotation', {
			source_id:	source._id,
			annotation:	this.discussion2Annotation(discussion)
		})

		discussion.replies.forEach( reply => {
			this.emit('annotation',{
				source_id:	source._id,
				annotation:	this.reply2Annotation(reply)
			})
		})

	}

	lookForNewAnnotations(){
		//TODO check for Errors!

		this.sources.find({}).toArray()
		.then( sources => {
			return	Promise.all(sources.map( source => {
						return 	Promise.resolve()
								.then( () 			=> this.getDiscussions(source) )
								.then( discussions	=> Promise.all(discussions.map(discussion => this.handleDiscussion(source, discussion))) )
					}))
		})
	}

}

module.exports = PaperHiveAdapter