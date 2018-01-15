'use strict'

const	Endpoint		=	require('../../endpoint.js'),
		request			=	require('request-promise-native').defaults({json:true}),
		Promise			=	require('bluebird')

class PaperhiveSource extends Endpoint{

	constructor(adapter, {id, _id, identifier, config, decor, data}){

		super(adapter, {
			id,
			_id, 
			identifier, 
			config, 
			decor:	decor || {
						image:		null,
						title:		'Paperhive Document',
						details:	'unknown'
					}, 
			data
		})		


		if(!identifier.document_id)				throw new ReferenceError("PaperhiveSource.constructor() missing identifier.document_id")
		if(adapter.id != identifier.adapter)	throw new Error("PaperhiveSource.constructor() adapter mismatch")
	}

	static async getDocument(document_id){
		return request.get('https://paperhive.org/api/documents/'+document_id)
	}

	static fromDocument(adapter, ph_document){

		if(!adapter || !ph_document)	throw new ReferenceError("PaperhiveSource.fromDocument() missing adapter or paperhive document")
		if(!adapter.id)					throw new ReferenceError("PaperhiveSource.fromDocument() missing adapter id")
		if(!ph_document.id)				throw new ReferenceError("PaperhiveSource.fromDocument() missing document id")

		return 	new PaperhiveSource(adapter, {
						identifier : 	{
											adapter:		adapter.id,
											document_id:	ph_document.id
										},
						decor:			PaperhiveSource.documentToDecor(ph_document)
				})
	}

	static documentToDecor(ph_document){
		return {
					title: 			ph_document.title,
					details: 		ph_document.authors[0].name || ph_document.publisher
				} 
	}


	static async guess(adapter, str){
		var matches, ph_document, document_id, endpoint

		if(!adapter) throw new Error("PaperhiveSource.guess() missing adapter")

		if(typeof str != 'string') throw new TypeError("PaperhiveSource.guess() only works on strings")

		try {	
			matches 	= 	str.match(/documents\/([^/]+)/) || str.match(/^([^/]+)$/)
			document_id	= 	matches[1]
		}
		catch(e){ throw new RangeError(`PaperhiveSource.guess() unable to guess document id from input string ${str}: ${e}`) }


		try{
			ph_document	=	await this.getDocument(document_id)
		} 
		catch(e){ throw new Error("PaperhiveSource.guess() unable to get document: "+ e) }

		try{
			endpoint	=	PaperhiveSource.fromDocument(adapter, ph_document),
			await endpoint.validate()
		}
		catch(e){ throw new Error("PaperhiveSource.guess() unable to find matching valid endpoint: " +e)	}

		return endpoint
	}


	async getDiscussions(getAllAnnotations){
		var result = await request.get('https://paperhive.org/api/documents/'+this.identifier.document_id+'/discussions')
		return result.discussions
	}


	phDiscussion2Annotation(discussion){
		return {
			id:						discussion.id,
			sourceName:				this.adapter.config.name,
			sourceHome:				this.adapter.config.home,
			title:					discussion.title,
			author:					discussion.author.displayName,
			body:					discussion.body,
			respectiveContent:		discussion.target.selectors.textQuote.content,
			original:				this.adapter.config.contentLink.replace(/%s/, discussion.target.document),
		}
	}

	phReply2Reply(reply){
		return {
			parentId:				reply.discussion,
			id:						reply.id,
			sourceName:				this.adapter.config.name,
			sourceHome:				this.adapter.config.home,
			author:					reply.author.displayName,
			body:					reply.body,
			original:				this.adapter.config.contentLink.replace(/%s/, reply.document),
		}
	}


	async scan(){
		var		now			=		Date.now(),
		 		last_scan 	= 		await this.getData('lastScan'),							
				discussions = 		await this.getDiscussions()

		if(!last_scan)	last_scan = 	this.config.includePastAnnotations
										?	0
										:	new Date()

		try {	
			discussions.forEach( discussion => {

				var updated = new Date(discussion.updatedAt)

				if(updated >= last_scan){			
					this.adapter.emit(
						'annotation', 
						{
							annotation: this.phDiscussion2Annotation(discussion),
							source:		this.skeleton
						} 
					)
				} 

				discussion.replies && discussion.replies.forEach( reply => {
					var updated = new Date(reply.updatedAt)

					if(updated >= last_scan){			
						this.adapter.emit(
							'reply',
							{
								reply:	this.phReply2Reply(reply),
								source:	this.skeleton
							}
						)
					}
				})
			})

			this.setData('lastScan', now)
		}

		catch(e){	console.error(e) }

	}


	async validate(session){
		try		{	await this.getDiscussions()}
		catch(e){	throw new Error("PaperhiveSource.validate() unable to read discussions " +e)}
	}

	async updateDecor(){
		var ph_document = await PaperhiveSource.getDocument(this.identifier.document_id)

		this.decor = PaperhiveSource.documentToDecor(ph_document)
	}


}

module.exports = PaperhiveSource