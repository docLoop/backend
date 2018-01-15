'use strict'

const	createApp 	=	require('github-app'),
		manageCalls	=	require('../../manage-calls.js')

class GithubApp {

	//TODO: Multiple pages!

	constructor(config){
		this.app = 	createApp(config)
		manageCalls.cache(this, 'getRepositories', 2000)
	}

	async getRepositories(installation_id){

		var github 	= await this.app.asInstallation(installation_id),
			result	= await github.apps.getInstallationRepositories({}),
			repos	= result.data.repositories || []


		return 	repos.map( repository => ({
					name:				repository.name,
					full_name:			repository.full_name,
					owner:				repository.owner,
					installation_id:	installation_id,
					html_url:			repository.html_url
				}))
	}

	async createOrUpdateIssue(target_identifier, issue){

		var params 			= 	{ 
									owner:	target_identifier.owner,
									repo:	target_identifier.repo,
									number:	issue.number,
									title:	issue.title,
									body:	issue.body,
									labels:	issue.labels
								},
			github 			= 	await this.app.asInstallation(target_identifier.installation_id),
			result 			=	issue.number 
								?	await github.issues.edit( params ) 
								:	await github.issues.create( params ) 

		return result.data.number
	}


	async createOrUpdateComment(target_identifier, comment){

		var params			=	{
									owner:		target_identifier.owner,
									repo:		target_identifier.repo,
									number:		comment.number,
									body:		comment.body,
									id:			comment.id
								},
			github 			= 	await this.app.asInstallation(target_identifier.installation_id),
			result			=	comment.id	
								?	await github.issues.editComment( params )
								:	await github.issues.createComment( params )
			
		return result.data.id //todo?		
	}

}


module.exports = GithubApp