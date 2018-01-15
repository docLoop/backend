'use strict'

const	chai			= 	require('chai'),
		chaiAsPromised 	= 	require("chai-as-promised"),
		should 			= 	chai.should(),
		sinon			= 	require('sinon'),
		sinonChai 		= 	require("sinon-chai"),
		GithubAdapter 	= 	require('../js/adapters/github/github-adapter.js'),
		DocLoopCore 	= 	require('../js/docloop-core.js'),
		Promise			= 	require('bluebird'),
		GithubApp		=	require('../js/adapters/github/github-app.js'),
		GithubUser		=	require('../js/adapters/github/github-user.js')
		

chai.use(chaiAsPromised)
chai.use(sinonChai)



//TODO More Tests


const	core			= 	new DocLoopCore({
								sessionSecret:		'abc',
								linkingRoute:		'/link',
								linkCollection:		'links',
								db:					{
														name:	'test',
														port:	'27777'
													}
							})
		


const	githubAdapter			=	new GithubAdapter(
										core,
										{
											extraId: 			'test',
											appPrivateKey: 		'someKey',
											annotationQueue:	{
																	delay:				[0, 1000, 5000],
																	minDelay:			0,
																	maxAttempts:		3,
																	processInterval:	10000,//10*60*1000,
																	spread:				100, //Todo
																},
										}
									),
		good_target_identifier = 	{
										adapter:				"github-test",
										repo:					"my_repo",
										installation_id:		"1234",
										owner:					"someone"

									}, 
		bad_target_identifier	=	{
										adapter:				"github-test",
										repo:					"bad-blub",
										installation_id:		"bad-1234",
										owner:					"bad-someone"
									},
		event					=	{
										annotation:{
											id:						"discussion.id",
											sourceName:				"Test",
											sourceHome:				"Test - Home",
											title:					"discussion.title",
											author:					"discussion.author.displayName",
											body:					"discussion.body",
											respectiveContent:		"discussion.target.selectors.textQuote.content",
											original:				"this.config.contentLink.replace(/%s/, discussion.target.document)"
										},
										target:{
											identifier: good_target_identifier
										},
										link_id: '123abc'
									},
		repos					=	[
										{
											name:				'my_repo',
											full_name:			'docloop/my_repo',
											owner:				{login:'someone'},
											installation_id:	'1234',
											html_url:			'https://github.com/someone/my_repo'
										},
										{
											name:				'my_other_repo',
											full_name:			'docloop/my_other_repo',
											owner:				{login:'someone'},
											installation_id:	'1234',
											html_url:			'https://github.com/someone/my_other_repo'
										},
									],									
		access_token			=	'123456789'







// Preliminary Tests

describe('GithubAdapter', function(){

	describe('.constructor()', function(){

		it('should throw an error, when no config is provided', function(){
			should.Throw( () => new GithubAdapter(core) )
		})


	})

	describe('.handleNewAnnotationEvent()', function(){

		before(function(){
		})

		beforeEach(function(){
		})

		before(function(){
		})


		it('should eventually be called when core emits new-annotation events', function(done){

			sinon.stub(githubAdapter, 'handleNewAnnotationEvent')
			.callsFake( () => {
				githubAdapter.handleNewAnnotationEvent.restore()
				done()
			})

			core.emit('new-annotation', event)
			
		})

		it('should eventually try to post an issue, when core emits annotation event', function(done){
			sinon.stub(GithubApp.prototype, 'createOrUpdateIssue')
			.callsFake( () => {
				GithubApp.prototype.createOrUpdateIssue.restore()
				done()
				return 1
			})

			core.emit('new-annotation', event)
		})
	})


	describe('validateTarget', function(){


		before(function(){
			sinon.stub(GithubUser.prototype, 'getInstallations')
			.callsFake( async () => {
				return ['1234']
			})


			sinon.stub(GithubApp.prototype, 'getRepositories')
			.callsFake( async () => {
				return repos
			})
		})



		after(function(){
			GithubUser.prototype.getInstallations.restore()
			GithubApp.prototype.getRepositories.restore()
		})

		it('should return rejected promise if target is missing', function(){
			return 	githubAdapter.validateTarget()
					.should.eventually.be.rejected.with.an.instanceOf(ReferenceError)
		})	


		it('should return rejected promise if session data is missing', function(){
			return 	githubAdapter.validateTarget({good_target_identifier})
					.should.eventually.be.rejected.with.an.instanceOf(ReferenceError)
		})	

		it('should return rejected promise if access_token is missing', function(){
			return	githubAdapter.validateTarget({good_target_identifier}, {})
					.should.eventually.be.rejected.with.an.instanceOf(ReferenceError)
		})

		it('should not validate an invalid target identifier', function(){
			return	githubAdapter.validateTarget({bad_target_identifier}, {access_token})
					.should.eventually.be.rejected.with.an.instanceof(Error)
		})


		it('should validate a valid target identifier', function(){
			return	githubAdapter.validateTarget({good_target_identifier}, {access_token})
					.catch(console.log)
					.should.eventually.be.fulfilled
		})

	})



})
