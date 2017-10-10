const 	config			=	require('../../config.js').github,
		GitHubApi		=	require('github'),
		createApp 		= 	require('github-app'),
		request			=	require('request-promise-native'),
		docLoopAdapter	=	require('../adapter.js')

class GitHubAdapter extends docLoopAdapter{

	constructor(core) {

		super(core, 'github')

		this.config	= 	config
		this.app 	= 	createApp({
							id:   config.appId,
							cert: require('fs').readFileSync(config.appPrivateKeyLocation)
						})

		this.core.server.get(this.config.oAuth.callbackRoute, this.handleOAuthCallback.bind(this))

		this.annotationChain = Promise.resolve()


		/* PLAN: Immer wenn User graucht wird auf login umleiten und aufgabe stacken, dann wenn der code und schließlich der token da ist, stack abarbeiten */
	
		//TODO: RETRY failed events!
		//
		//Test: repeated event
		//
		//Chain schöner machen. Pro target eine eigene chain? Retries hier oder besser im Core? Besser im Core

	}


	handleOAuthCallback(req, res, next){

		var session_data	=	this.clearSessionData(req.session),
			params 			= 	{
									client_id: 		this.config.oAuth.clientId,
									client_secret: 	this.config.oAuth.clientSecret,
									code: 			req.query.code,
								}
		


		request({
			uri: 	config.oAuth.accessTokenUrl+'?', 
			method: 'post', 
			json: 	params
		})
		.then(data => {
			if(!data || !data.access_token) return Promise.reject('GitHubAdapter.handleOAuthCallback: unable to retrieve acces token; '+ JSON.stringify(data))

			session_data.access_token = data.access_token
			
		})
		.then( () => { return this.getUser(session_data) })
		.then( () => { return this.getUserInstallation(session_data) })
		.then(
			//Todo: probably should redirect here
			() 	=> { res.status(200).send(session_data) },
			e	=> { res.status(500).send(e) }
		)
		
		
	}



	asUser(session_data){

		if(!session_data)				return Promise.reject("GitHubAdapter.asUser: Missing session data")
		if(!session_data.access_token)	return Promise.reject("GithubAdapter.asUser: missing access token")

		var github = new GitHubApi()

		github.authenticate({
			type: 	'oauth',
			token: 	session_data.access_token
		})

		return Promise.resolve(github)
	}


	getUser(session_data){

		if(!session_data)				return Promise.reject("GitHubAdapter.getUser: Missing session data")
		if(session_data.user)			return Promise.resolve(session_data.user)

		return	this.asUser(session_data)
				.then( github => { return github.users.get({}) })
				.then(
					result => {

						if(!result || !result.data || !result.data.id)
							return Promise.reject("GithubAdapter.asUser: unable to get user id")

						return session_data.user = result.data

					},
					reason => { return Promise.reject('GithubAdapter.asUser:' + reason)	}
				)
	}


	getUserInstallation(session_data){

		if(!session_data)				return Promise.reject("GitHubAdapter.getUserInstallation: Missing session data")
		if(session_data.installation)	return Promise.resolve(session_data.installation)

		return	this.asUser(session_data)
				.then(github => { return github.users.getInstallations({}) })
				.then(
					result	=> { 
						console.log(result.data)
						if(!result.data || !result.data.installations || !result.data.installations.length)
							Promise.reject('GithubAdapter.getUserInstallation: unable to get any installations')

						return 	(session_data.installation = result.data.installations[0])
								?	Promise.resolve(result.data.installations[0])
								:	Promise.reject('GithubAdapter.getUserInstallation: unable to get any matching installation')
					},
					reason 	=> { return Promise.reject('GithubAdapter.getUserInstallation: unable to get user Installations: '+ reason)}
				)
	}

	getUserRepos(session_data){
		//TODO: Multiple Pages!

		if(!session_data)			return Promise.reject("GitHubAdapter.getUserRepos: Missing session data")
		if(session_data.repos)		return Promise.resolve(session_data.repos)

		
		return 	this.getUserInstallation(session_data)
				.then(installation 	=> { return this.app.asInstallation(installation.id) })
				.then(github 		=> { return github.apps.getInstallationRepositories({}) })
				.then(result		=> { return session_data.repos = result.data.repositories})

	}


	preventDuplicateTarget(){
		return 	this.targes.findOne(target)
				.then(duplicate => { 
					return	dublicate
							?	Promise.reject("GithubAdapter: target already exists") 
							:	Promise.resolve(target) 
				})

	}

	saveTarget(target){
		return	this.targets.findOne(target)
				.then(duplicate =>
					duplicate
					?	duplicate._id
					:	this.targets.insertOne(target)
						.then(result => result.insertedId)
				)
				
	}

	url2Target(url) {

		this.this.getUserInstallation(session_data)
		.then( installation => {
			
			//https://github.com/rhotep/docLoop
			var matches = url.match(/github.com\/([^/]+)\/([^/]+)/)

			return	{
						adapter:		this.id,
						owner:			matches[1]
						repo:			matches[2],
					}
		))
	}

	validateTarget(target, session){

		var session_data = this.getSessionData(session)

		if(target.adapter != this.id)								return Promise.reject("GithubAdapter.validateTarget: Adapter mismatch")
		if(!target.repo)											return Promise.reject("GithubAdapter.validateTarget: Missing repo_id")
		if(!target.installation_id)									return Promise.reject("GithubAdapter.validateTarget: Missing installation_id")
		if(!target.owner)											return Promise.reject("GithubAdapter.validateTarget: Missing owner")
		if(!session_data)											return Promise.reject("GithubAdapter.validateTarget: Missing session data")
		if(!session_data.access_token)								return Promise.reject('GithubAdapter.validateTarget: Not logged in with github')
		

		return	Promise.resolve()
				.then( () 	=> { return this.getUser(session_data) })
				.then( user => {
					if(target.owner != user.login) 		 			
						return Promise.reject("GithubAdapter.validateTarget: User mismatch")

				})
				.then( () => { return this.getUserInstallation(session_data) })
				.then( installation => {

					if(target.installation_id != installation.id) 	
						return Promise.reject("GithubAdapter.validateTarget: Installation mismatch")

				})
				.then( () => { return this.getUserRepos(session_data) })
				.then( repos => {
					if( repos.every( repo => { return repo.name != target.repo }) )
						return Promise.reject("GithubAdapter.validateTarget: Repo inaccessible")
				})
				.then( () => this.saveTarget(target))
	}




	saveIssueNumber(target_id, link_id, annotation_id, issue_number){
		if(!target_id)		return Promise.reject("GithubAdapter.saveIssueNumber: missing traget_id")
		if(!link_id)		return Promise.reject("GithubAdapter.saveIssueNumber: missing link_id")
		if(!annotation_id)	return Promise.reject("GithubAdapter.saveIssueNumber: missing annotation_id")
		if(!issue_number)	return Promise.reject("GithubAdapter.saveIssueNumber: missing issue_number")

		return	this.targets.findOneAndUpdate({_id: target_id}, {$set : {['issueMap.'+link_id+'.'+annotation_id] : issue_number} })
				.then( () => issue_number )
	}


	getIssueNumber(target_id, link_id, annotation_id){
		if(!target_id)		return Promise.reject("GithubAdapter.getIssueNumber: missing traget_id")
		if(!link_id)		return Promise.reject("GithubAdapter.getIssueNumber: missing link_id")
		if(!annotation_id)	return Promise.reject("GithubAdapter.getIssueNumber: missing annotation_id")

		return 	Promise.resolve()
				.then( ()		=> this.targets.findOne({_id: target_id}) )
				.then( target 	=> {
					if(!target) 								return undefined
					if(!target.issueMap) 						return undefined
					if(!target.issueMap[link_id])				return undefined
					if(!target.issueMap[link_id][annotation_id])return undefined

					return target.issueMap[link_id][annotation_id]
				})
	}

	ensureIssueNumber(target_id, link_id, annotation_id){
		return	Promise.resolve()
				.then( ()			=> 	this.getIssueNumber(target_id, link_id, annotation_id) )
				.then( issue_number => 	issue_number || 
										Promise.resolve()
										.then( ()			=> this.createIssue(target_id, this.config.dummy.body, this.config.dummy.title) )
										.then( issue_number => this.saveIssueNumber(target_id, link_id, annotation_id, issue_number) )
				)
	}


	saveCommentId(target_id, link_id, annotation_id, comment_id){
		if(!target_id)		return Promise.reject("GithubAdapter.saveCommentId: missing traget_id")
		if(!link_id)		return Promise.reject("GithubAdapter.saveCommentId: missing link_id")
		if(!annotation_id)	return Promise.reject("GithubAdapter.saveCommentId: missing annotation_id")
		if(!comment_id)		return Promise.reject("GithubAdapter.saveCommentId: missing comment_id")

		return	this.targets.findOneAndUpdate({_id: target_id}, {$set : {['commentMap.'+link_id+'.'+annotation_id] : comment_id} })
				.then( () => comment_id )
	}


	getCommentId(target_id, link_id, annotation_id){
		if(!target_id)		return Promise.reject("GithubAdapter.getCommentId: missing traget_id")
		if(!link_id)		return Promise.reject("GithubAdapter.getCommentId: missing link_id")
		if(!annotation_id)	return Promise.reject("GithubAdapter.getCommentId: missing annotation_id")

		return 	Promise.resolve()
				.then( ()			=> this.targets.findOne({_id: target_id}) )
				.then( target 		=> {
					if(!target) 									return undefined
					if(!target.commentMap) 							return undefined
					if(!target.commentMap[link_id])					return undefined
					if(!target.commentMap[link_id][annotation_id])	return undefined

					return target.commentMap[link_id][annotation_id]
				})
	}


	//TODO explicite book keeping
	//TODO: Store failed attemps, and make them accessible, also build call to rerun them
	//TODO: Stats Call
	//TODO: Doch besser un den Core, weil für alle Adapter gleich!

	handleNewAnnotation(annotation, target_id, link_id){
		//Todo: Pending?
		this.annotationChain = 	this.annotationChain
								.then(
									() => this.fowardNewAnnotation(annotation, target_id, link_id),
									() => this.fowardNewAnnotation(annotation, target_id, link_id)
								)

		return this.annotationChain
	}

	fowardNewAnnotation(annotation, target_id, link_id){

		console.log('github: hndleNEW...', annotation.author)
		//TODO use template
		//check if annotation is okay, including ID, ode eigenes format/klasse?

		var title 				= 	annotation.title + ' [via '+annotation.sourceName+'@'+this.core.config.name+']',
			import_line			=	'_Annotation imported from <a href ="'+annotation.sourceHome+'">'+annotation.sourceName+'</a>._'+'\n\n',
			target_block		=	annotation.respectiveContent
									?	'Regarding this part:\n'+
										'<blockquote>'+
										annotation.respectiveContent+						
										'</blockquote>\n\n'
									:	'',
			annotation_block	=	annotation.author+' wrote:'+'\n'+						
									'<blockquote>\n'+
									annotation.body+'\n'+
									'</blockquote>'+'\n\n',
			footer_line			=	'_Link to <a href = "'+annotation.original+'">orginial comment</a>. About <a href ="'+this.core.config.home+'">docLoop</a>._',
			body				=	import_line +
									target_block +
									annotation_block +
									footer_line
						
						
						
		//Comment
		if(annotation.parentId)
			return	Promise.resolve()
					.then( ()			=> this.getCommentId(target_id, link_id, annotation.id) )
					.then( comment_id 	=> 
						comment_id
						?	Promise.resolve()
							.then( ()			=> this.updateComment(target_id, body, comment_id) )

						:	Promise.resolve()
							.then( ()			=> this.ensureIssueNumber(target_id, link_id, annotation.parentId) )
							.then( issue_number	=> this.createComment(target_id, body, issue_number) )
							.then( comment_id 	=> this.saveCommentId(target_id, link_id, annotation.id, comment_id) )
					)


		//Issue
		if(!annotation.parentId)
			return	Promise.resolve()
					.then( ()			=> this.getIssueNumber(target_id, link_id, annotation.id) )
					.then( issue_number	=> 
						issue_number
						?	Promise.resolve()
							.then( ()			=> this.updateIssue(target_id, body, title, issue_number) )

						:	Promise.resolve()
							.then( ()			=> this.createIssue(target_id, body, title) )
							.then( issue_number => this.saveIssueNumber(target_id, link_id, annotation.id, issue_number) )
					)

	}

	createIssue(target_id, body, title){
		if(!target_id)		return Promise.reject("GithubAdapter.createIssue: missing traget_id")
		if(!body)			return Promise.reject("GithubAdapter.createIssue: missing body")
		if(!title)			return Promise.reject("GithubAdapter.createIssue: missing title")

		return this.createOrUpdateIssue(target_id, body, title)
	}

	updateIssue(target_id, body, title, issue_number){
		if(!target_id)		return Promise.reject("GithubAdapter.updateIssue: missing traget_id")
		if(!body)			return Promise.reject("GithubAdapter.updateIssue: missing body")
		if(!title)			return Promise.reject("GithubAdapter.updateIssue: missing title")

		return this.createOrUpdateIssue(target_id, body, title, issue_number)

	}

	createOrUpdateIssue(target_id, body, title, issue_number){

		return	this.targets.findOne({_id: target_id})
				.then( target =>{
					return	this.app.asInstallation(target.installation_id)
							.then(github => 
								issue_number
								?	github.issues.edit({	
										owner:	target.owner,
										repo:	target.repo,
										number: issue_number,
										title:	title,
										body:	body,
									})
								:	github.issues.create({	
										owner:	target.owner,
										repo:	target.repo,
										title:	title,
										body:	body,
									})
							)
				})
				.then( result => result.data.number)
	}



	createComment(target_id, body, issue_number){		
		if(!target_id)		return Promise.reject("GithubAdapter.createComment: missing traget_id")
		if(!body)			return Promise.reject("GithubAdapter.createComment: missing body")
		if(!issue_number)	return Promise.reject("GithubAdapter.createComment: missing issue_number")
		return this.createOrUpdateComment(target_id, body, issue_number)
	}

	updateComment(target_id, body, comment_id){
		if(!target_id)		return Promise.reject("GithubAdapter.updateComment: missing traget_id")
		if(!body)			return Promise.reject("GithubAdapter.updateComment: missing body")
		if(!comment_id)		return Promise.reject("GithubAdapter.updateComment: missing comment_id")
		return this.createOrUpdateComment(target_id, body, null, comment_id)
	}


	createOrUpdateComment(target_id, body, issue_number, comment_id){

		return	this.targets.findOne({_id: target_id})
				.then( target =>{
					return	this.app.asInstallation(target.installation_id)
							.then(github => 
								comment_id
								?	github.issues.editComment({	
										owner:	target.owner,
										repo:	target.repo,
										body:	body,
										id:		comment_id
									})
								:	github.issues.createComment({	
										owner:	target.owner,
										repo:	target.repo,
										body:	body,
										number:	issue_number,
									})
							)
				})
				.then( result => result.data.id)
	}


}


module.exports = GitHubAdapter



	
