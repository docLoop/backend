'use strict';



//TODO test links with source and target config!



const	DocLoopCore 	= 	require('../js/docloop-core.js'),
		DocLoopAdapter	= 	require('../js/adapter.js'),
		EventEmitter	=	require('events'),
		chai			= 	require('chai'),
		chaiAsPromised 	= 	require("chai-as-promised"),
		should 			= 	chai.should(),
		sinon			= 	require('sinon')


var		config			=	{
								sessionSecret:		'abc',
								linkCollection:		'links',
								db:					{
														name:	'test',
														port:	'27777'
													}
							},
		docLoopCore		=	new DocLoopCore(config),

		req				=	{
								session:{}
							},
		res				=	{}



		res.status	= 	sinon.stub().returns(res),
		res.send	=	sinon.stub().returns(res)


class TestSourceAdapter extends DocLoopAdapter{

	constructor(core, config){
		super(core, { ...config, id: 'test-source-adapter'})		
	}

	async getsources(){
		return [{adapter: this.id, name: 'my-test-source'}]
	}
}

class TestTargetAdapter extends DocLoopAdapter{

	constructor(core, config){
		super(core, { ...config, id: 'test-target-adapter'})
	}

	async getTargets(){
		return [{adapter: this.id, name: 'my-test-target'}]
	}
}

class BogusAdapter extends DocLoopAdapter{
	constructor(core, config){
		super(core, { ...config, id: 'bogus-adapter'})
	}

	async _getData(){ throw Error('Test Error') }
}




describe("DocLoopCore", function(){

	describe(".constructor()", function(){

		it("should setup the app", function(){

			docLoopCore.should.be.an.instanceof(EventEmitter)

			docLoopCore.should.have.deep.property('config', config)
			docLoopCore.should.have.property('app')
			docLoopCore.should.have.property('ready')
			docLoopCore.should.have.property('adapters')

			var actual_routes 	=	[],
				expected_routes =	[
										[ 'POST', 	'/link' ],
										[ 'DELETE',	'/link/:id' ],
										[ 'GET', 	'/link' ],
										[ 'GET', 	'/adapters' ],
										[ 'GET', 	'/drop-session' ]
									]

			docLoopCore.app._router.stack
			.filter( 	item => item.route)
			.forEach( 	item => {
									Object.keys(item.route.methods).forEach( key => {
										if(item.route.methods[key]) actual_routes.push([key.toUpperCase(), item.route.path])
									})
								}
			)

			actual_routes.should.deep.equal(expected_routes)

			

			return	docLoopCore.ready 
					.then( () => {
						docLoopCore.should.have.property('db')
						docLoopCore.should.have.property('links')
					})
					.should.eventually.be.fulfilled

		})

	})


	describe(".use()", function(){

		it("should throw a type error if adapter is not an instance of DocLoopAdapter", function(){
			should.Throw( () => DocLoopCore.use({}))
		})
		
		it("should throw an error if another adapter with the same id is already in use", function(){
			docLoopCore.use(DocLoopAdapter, {id: 'test-1'})
			should.Throw( () => docLoopCore.use(DocLoopAdapter, {id: 'test-1'}), Error)
		})

		it("should register a new adapter", function(){
			docLoopCore.use(DocLoopAdapter, {id: 'my-test-adapter'})
			docLoopCore.adapters.should.have.a.property('my-test-adapter')
			docLoopCore.adapters['my-test-adapter'].should.be.an.instanceOf(DocLoopAdapter)
		})

	})

	describe(".handleDropSessionRequest", function(){

		beforeEach(function(){
			docLoopCore.adapters = {}

			docLoopCore.use(TestTargetAdapter)
			docLoopCore.use(TestSourceAdapter)

			res.status.resetHistory()
			res.send.resetHistory()

		})

		it("should destroy current session and resolve request with status 200 on success", function(){

			req.session.destroy = callback => callback(null)

			
			docLoopCore.handleDropSessionRequest(req,res)

			res.status.should.have.been.calledWith(200)
			res.send.should.have.been.calledOnce


		})

		it("should destroy current session and reject request with status 500 and a reason on failure", function(){

			req.session.destroy = callback => callback(true)

			docLoopCore.handleDropSessionRequest(req,res)

			res.status.should.have.been.calledWith(500)
			res.send.should.have.been.calledOnce


		})
	})

	describe("handleGetAdaptersRequest", function(){

		beforeEach(function(){
			docLoopCore.adapters = {}

			docLoopCore.use(TestTargetAdapter)
			docLoopCore.use(TestSourceAdapter)

			res.status.resetHistory()
			res.send.resetHistory()

		})

		it("should resolve the request with status 200 and a list of all adapters on success", function(){
			
			return 	docLoopCore.handleGetAdaptersRequest(req,res)
					.then( () => {
						res.status.should.have.been.calledWith(200)
						res.send.should.have.been.calledOnce
						res.send.firstCall.args[0].should.have.lengthOf(2)
					})
					.should.eventually.be.fulfilled
		})

		it("should reject the request with status 500 and a reason on failure", function(){
			
			docLoopCore.use(BogusAdapter)

			return 	docLoopCore.handleGetAdaptersRequest(req,res)
					.then( () => {
						res.status.should.have.been.calledWith(500)
						res.send.should.have.been.calledOnce
					})
					.should.eventually.be.fulfilled
		})

	})


	describe("handleGetLinksRequest", function(){

		beforeEach(function(){
			docLoopCore.adapters = {}

			docLoopCore.use(TestTargetAdapter)
			docLoopCore.use(TestSourceAdapter)

			res.status.resetHistory()
			res.send.resetHistory()

			sinon.stub(TestSourceAdapter.prototype, '_getStoredSources').returns([
				{id:"source-1"},
				{id:"source-2"}
			])


			sinon.stub(TestTargetAdapter.prototype, '_getStoredTargets').returns([
				{id:"target-1"},
				{id:"target-2"}
			])

			sinon.stub(docLoopCore.links,'find').returns({toArray: () => Array(23) })
			sinon.stub(docLoopCore,'Link').returns(9)

		})

		afterEach(function(){
			docLoopCore.links.find.restore()
			docLoopCore.Link.restore()

			TestSourceAdapter.prototype._getStoredSources.restore()
			TestTargetAdapter.prototype._getStoredTargets.restore()
		})


		it("should resolve the request with status 200 and a list of links on success", function(){

			return 	docLoopCore.handleGetLinksRequest(req, res)
					.then( () => {
						docLoopCore.links.find.should.have.been.calledOnce
						should.exist(docLoopCore.links.find.firstCall.args[0].$or)
						docLoopCore.links.find.firstCall.args[0].$or.should.have.lengthOf(4)

						res.status.should.have.been.calledWith(200)
						res.send.should.have.been.calledOnce
						res.send.firstCall.args[0].should.have.lengthOf(23)
					})
					.should.eventually.be.fulfilled

		})

		it("should reject the request with status 500 and a reason on failure", function(){
			docLoopCore.links.find.returns('BAD')

			return 	docLoopCore.handleGetLinksRequest(req, res)
					.then( () => {
						res.status.should.have.been.calledWith(500)
						res.send.should.have.been.calledOnce
					})
					.should.eventually.be.fulfilled

		})

	})



})

