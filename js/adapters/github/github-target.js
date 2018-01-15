'use strict'

const	Endpoint		=	require('../../endpoint.js'),
		Promise			=	require('bluebird')

class GithubTarget extends Endpoint{

	constructor(adapter, {id, _id, identifier, config, decor, data}){

		if(arguments[1] instanceof GithubTarget) return arguments[1]

		super(adapter, {
			id,
			_id, 
			identifier, 
			config, 
			data,
			decor: 		decor || {
								image:		null,
								title:		'Github Repository',
								details:	'unknown'
						}, 
		})		

		if(!identifier.repo)					throw new ReferenceError("GithubTarget.constructor() missing identifier.repo")
		if(!identifier.installation_id)			throw new ReferenceError("GithubTarget.constructor() missing identifier.installation_id")
		if(!identifier.owner)					throw new ReferenceError("GithubTarget.constructor() missing identifier.owner")							
		
		if(adapter.id != identifier.adapter)	throw new Error("GithubTarget.constructor() adapter mismatch")							
	}


	static fromRepo(adapter, repo){
		if(!repo)								throw new ReferenceError("GithubTarget.fromRepo() missing repo")
		if(!repo.name)							throw new ReferenceError("GithubTarget.fromRepo() missing repo.name")
		if(!repo.installation_id)				throw new ReferenceError("GithubTarget.fromRepo() missing repo.installation_id")
		if(!repo.owner)							throw new ReferenceError("GithubTarget.fromRepo() missing repo.owner")
		if(!repo.owner.login)					throw new ReferenceError("GithubTarget.fromRepo() missing repo.owner.login")

		var identifier = 	{
								adapter:			adapter.id, 
								repo:				repo.name,
								installation_id:	repo.installation_id,
								owner:				repo.owner.login
							},
			decor		=	GithubTarget.repoToDecor(repo)	

		return new GithubTarget(adapter, {identifier, decor})
	}

	static repoToDecor(repo){
		return {
			image: 				repo.owner.avatar_url,
			title:				repo.name,
			details:			repo.owner.login
		}
	}

	async validate(session){
		var session_data 	= 		this.adapter._getSessionData(session),
			valid_endpoints	= await this.adapter.getStoredEndpoints(session_data),
			match			= 		valid_endpoints.some( endpoint => this.match(endpoint) )

		if(!match)	throw new Error('GithubTarget.validate() no valid endpoint match')
	}

	async updateDecor(session){
		var session_data	= this.adapter._getSessionData(session)

		var session_data 	= this.adapter._getSessionData(session),
			valid_endpoints	= await this.adapter.getEndpoints(session_data)
		
		valid_endpoints.forEach( endpoint => {
			if(this.match(endpoint)) this.decor = endpoint.decor
		})
	}


	annotation2Issue(annotation){
		var title 				= 	annotation.title + ' [via '+annotation.sourceName+'@'+this.adapter.core.config.name+']',
			import_line			=	'_Annotation imported from <a href ="'+annotation.sourceHome+'">'+annotation.sourceName+'</a>._'+'\n\n',
			target_block		=	annotation.respectiveContent
									?	  'Regarding this part:\n'
										+ '<blockquote>'
										+ annotation.respectiveContent
										+ '</blockquote>\n\n'
									:	'',
			annotation_block	=	  annotation.author+' wrote:'+'\n'
									+ '<blockquote>\n'
									+ annotation.body+'\n'
									+ '</blockquote>'+'\n\n',
			footer_line			=	'_Link to <a href = "'+annotation.original+'">orginial comment</a>. About <a href ="'+this.adapter.core.config.home+'">docLoop</a>._',
			
			body				=	  import_line 
									+ target_block 
									+ annotation_block
									+ footer_line,

			labels				=	this.config.label && [this.config.label]


		return {title, body, labels}
	}




	async handleAnnotation(annotation){

		var issue_number 	= 	await this.getIssueNumber(annotation.id),
			issue			= 	{
									...this.annotation2Issue(annotation),
									number: issue_number
							 	}


		issue_number		=	await this.adapter.githubApp.createOrUpdateIssue(this.identifier, issue)


		await 	this.storeIssueNumber(annotation.id, issue_number)
	}


	async storeIssueNumber(annotation_id, issue_number){
		return	this.setData('issueMap.'+annotation_id, issue_number)
	}

	async getIssueNumber(annotation_id){
		return 	await this.getData('issueMap.'+annotation_id)
	}


	async ensureIssueNumber(annotation_id){


		var issue_number	=		await 	this.getIssueNumber(annotation_id)
								||	await 	this.adapter.githubApp.createOrUpdateIssue(
												this.identifier,
												{ 
													title: 	this.adapter.config.dummy.title, 
													body: 	this.adapter.config.body,

												}
											)

		await this.storeIssueNumber(annotation_id, issue_number)


		return issue_number
	}


	reply2Comment(reply){
		return 	{ body:	this.annotation2Issue(reply).body }
	}

	async handleReply(reply){

		console.log('parentId', reply.parentId)

		var issue_number 	= 	await this.ensureIssueNumber(reply.parentId),
			comment			= 	{
									...this.reply2Comment(reply),
									id:		await this.getCommentId(reply.id),
									number: issue_number
							 	},
			comment_id		=	await this.adapter.githubApp.createOrUpdateComment(this.identifier, comment)

		await this.storeCommentId(reply.id, comment_id)
	}


	async storeCommentId(reply_id, comment_id){
		return	this.setData('commentMap.'+reply_id, comment_id)
	}

	async getCommentId(reply_id){
		return await this.getData('commentMap.'+reply_id)
	}

}

module.exports = GithubTarget