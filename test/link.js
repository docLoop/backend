'use strict'

const	chai			= 	require('chai'),
		chaiAsPromised 	= 	require("chai-as-promised"),
		should 			= 	chai.should(),
		sinon			= 	require('sinon'),
		sinonChai 		= 	require("sinon-chai"),
		DocLoopAdapter	=	require('../js/adapter.js'),
		DocLoopCore 	= 	require('../js/docloop-core.js'),
		Link			=	require('../js/link.js'),
		Promise			= 	require('bluebird'),
		MongoClient 	= 	require('mongodb').MongoClient
		

chai.use(chaiAsPromised)
chai.use(sinonChai)


const	core			= 	new DocLoopCore({
								sessionSecret:		'abc',
								db:					{
														name:	'test',
														port:	'27777'
													}
							}),
		sound_source	=	{
								identifier: {
									adapter:	'test-1',
									someprop:	'source-123'
								},
								config: {
									data: 		'source-abc'
								}
							},
		sound_target	=	{
								identifier: {
									adapter:	'test-1',
									someprop:	'target-123'
								},
								config: {
									data: 		'target-abc'
								}
							}



core.use(DocLoopAdapter, {id: 'test-1'})


core.ready
.then(function(){

	describe("Link", function(){

		describe(".constructor()", function(){


			before(function(){
				sinon.stub(Link.prototype, 'importData')
			})


			afterEach(function(){
				Link.prototype.importData.resetHistory()
			})


			after(function(){
				Link.prototype.importData.restore()
			})

			it("should throw a reference error, if no core is passed", function(){
				should.Throw( () => new Link(),  ReferenceError)
			})


			it("should throw a type error, if core is not an instance of DocLoopCore", function(){
				should.Throw( () => new Link('abc'),  TypeError)
			})

			it("should create empty link, if second parameter is undefined", function(){
				var link = new Link(core)

				link.should.not.have.a.property('id')
				link.importData.should.not.have.been.called

			})	

			it("should set id and not call .importData(), if the frist paramter can be used as id", function(){
				var link = new Link(core, 'ffffffffffffffffffffffff')

				link.should.have.a.property('id')
				link.importData.should.not.have.been.called

			})		

			it("should not set id but call .importData() instead, if second parameter is an object", function(){
				var link = new Link(core, {})

				link.should.not.have.a.property('id')
				link.importData.should.have.been.calledOnce
			})	

		})

		describe(".importData()", function(){

			it("should throw a reference error if source is missing", function(){
				var link = new Link(core)

				should.Throw( () => {
					link.importData({
						target: {
							identifier: {
								adapter:	'test-1'
							},
						}
					})
				}, ReferenceError)
			})

			it("should throw a reference error if target is missing", function(){
				var link = new Link(core)

				should.Throw( () => {
					link.importData({
						source: {
							identifier: {
								adapter:	'test-1'
							},
						}
					})
				}, ReferenceError)

			})

			it("should throw a reference error if source.identifier is missing", function(){
				var link = new Link(core)

				should.Throw( () => {
					link.importData({
						source: {
						},
						target: {
							identifier: {
								adapter:	'test-1'
							},
						}
					})
				})
				
			})


			it("should throw a reference error if target.identifier is missing", function(){
				var link = new Link(core)

				should.Throw( () => {
					link.importData({
						source: {
							identifier: {
								adapter:	'test-1'
							},
						},
						target: {
						}
					})
				}, ReferenceError)
				
			})

			it("should throw an error if no matching source adpter can be found", function(){
				var link = new Link(core)

				should.Throw( () => {
					link.importData({
						source: {
							identifier: {
								adapter:	'test-2'
							},
						},
						target: {
							identifier: {
								adapter:	'test-1'
							},
						}
					})
				})
				
			})

			it("should throw an error if no matching target adpter can be found", function(){
				var link = new Link(core)

				should.Throw( () => {
					link.importData({
						source: {
							identifier: {
								adapter:	'test-1'
							},
						},
						target: {
							identifier: {
								adapter:	'test-2'
							},
						}
					})
				})
				
			})



			it("should import specific data", function(){
				var link = new Link(core)

				link.importData({
					source: sound_source,
					target: sound_target,
				})

				should.exist(link.source)
				should.exist(link.source.identifier)
				should.exist(link.source.identifier.adapter)
				should.exist(link.source.identifier.someprop)
				should.exist(link.source.config)
				should.exist(link.source.config.data)
				should.exist(link.source.adapter)

				link.source.identifier.adapter.should.equal('test-1')
				link.source.identifier.someprop.should.equal('source-123')
				link.source.config.data.should.equal('source-abc')
				link.source.adapter.should.be.instanceof(DocLoopAdapter)
				link.source.adapter.id.should.equal('test-1')

				should.exist(link.target)
				should.exist(link.target.identifier)
				should.exist(link.target.identifier.adapter)
				should.exist(link.target.identifier.someprop)
				should.exist(link.target.config)
				should.exist(link.target.config.data)
				should.exist(link.target.adapter)

				link.target.identifier.adapter.should.equal('test-1')
				link.target.identifier.someprop.should.equal('target-123')
				link.target.config.data.should.equal('target-abc')
				link.target.adapter.should.be.instanceof(DocLoopAdapter)
				link.target.adapter.id.should.equal('test-1')


			})


		})

		// describe("get:data", function(){

		// 	it("should throw a reference error if source is missing", function(){
		// 		var link = new Link(core)

		// 		should.Throw( () => link.data, ReferenceError)
		// 	})

		// 	it("should throw a reference error if target is missing", function(){
		// 		var link = new Link(core)

		// 		link.source = {}

		// 		should.Throw( () => link.data, ReferenceError)
		// 	})

		// 	it("should return link's source and target", function(){
		// 		var data = {source: sound_source, target: sound_target},
		// 			link = new Link(core, data)

		// 		link.data.should.deep.equal({
		// 			target: { identifier: link.target.identifier, config: link.target.config},
		// 			source: { identifier: link.source.identifier, config: link.source.config}
		// 		})

		// 	})

		// })


		describe(".store()", function(){

			before(function(){
				core.links.remove({})


			})

			it("should store a link to te database and return an objectId", function(){
				var link = new Link(core, {source: sound_source, target: sound_target})

				return	Promise.resolve()
						.then( () 		=> 	link.store() )
						.then( id		=>	{
												should.exist(id)
												id.should.have.a.property('_bsontype', "ObjectID")

												link.should.have.a.property('id')
												link.should.have.a.property('source')
												link.should.have.a.property('target')

												link.source.should.have.a.property('id')
												link.target.should.have.a.property('id')


												link.id.should.have.a.property('_bsontype', "ObjectID")
												link.source.id.should.have.a.property('_bsontype', "ObjectID")
												link.target.id.should.have.a.property('_bsontype', "ObjectID")
											}
						)
						.then( ()		=> 	core.links.findOne(link.data) )
						.then( result	=> 	{
												result.should.have.a.property('source')
												result.should.have.a.property('target')


												result.source.adapter.should.equal(sound_source.identifier.adapter) 
												result.target.adapter.should.equal(sound_target.identifier.adapter) 

												result.source.id.should.deep.equal(link.source.id) 
												result.target.id.should.deep.equal(link.target.id) 

											}
						)

			})

		})

		describe(".get()", function(){

			before(function(){
				core.links.remove({})
			})


			it("should be rejected with a reference error if id is missing", function(){
				new Link(core).get().should.eventually.be.rejected.with.an.instanceof(ReferenceError)
			})

			it("should retrieve a link from te database", function(){
				var link = new Link(core, {source: sound_source, target: sound_target})

				return	Promise.resolve()
						.then( () 		=> 	link.store() )
						.then( id		=>	new Link(core, id).get() )
						.then( new_link	=> 	{
												new_link.source.identifier.should.deep.equal(sound_source.identifier)
												new_link.target.identifier.should.deep.equal(sound_target.identifier)

												new_link.source.config.should.deep.equal(sound_source.config)
												new_link.target.config.should.deep.equal(sound_target.config)


											}
						)

			})

		})

		describe(".remove()", function(){

			before(function(){
				core.links.remove({})
			})


			it("should be rejected with a reference error if id is missing", function(){
				new Link(core).get().should.eventually.be.rejected.with.an.instanceof(ReferenceError)
			})

			it("should be rejected with an error if link cannot be removed", function(){
				var link = new Link(core, "abababababababababababab")

				return	link.remove().should.eventually.be.rejected.with.an.instanceof(Error)

			})

			it("should remove a previously stored link from te database", function(){
				var link = new Link(core, {source: sound_source, target: sound_target})

				return	Promise.resolve()
						.then( () 		=> 	link.store() )
						.then( id		=>	new Link(core, id).remove())
						.then( ()		=> 	core.links.findOne(link.data) )
						.then( result	=> 	should.not.exist(result) )
						.should.eventually.be.fulfilled

			})

		})

		//no longer makes sense:

		// describe(".preventDuplicate()", function(){

		// 	before(function(){
		// 		core.links.remove({})
		// 	})


		// 	it("should be fulfilled if link has not yet been saved", function(){
		// 		var link = new Link(core, {source: sound_source, target: sound_target})

		// 		return	link.preventDuplicate().should.eventually.be.fulfilled
		// 	})

		// 	it("should be rejected if link has been saved already", function(){
		// 		var link = new Link(core, {source: sound_source, target: sound_target})

		// 		return	Promise.resolve()
		// 				.then( () => link.store() )
		// 				.then( () => link.preventDuplicate() )
		// 				.should.eventually.be.rejected
		// 	})


		// })


		describe(".validate()", function(){

			beforeEach(function(){	
				sinon.stub(core.adapters['test-1'], '_validateSource')			
				sinon.stub(core.adapters['test-1'], '_validateTarget')			
			})

			afterEach(function(){
				core.adapters['test-1']._validateSource.restore()
				core.adapters['test-1']._validateTarget.restore()
			})

			it("should call validation methods of source and target", function(){
				var link = new Link(core,  {source: sound_source, target: sound_target})

				return	 Promise.resolve()
						.then( () => 	link.validate())
						.then( () => 	{
											link.source.adapter._validateSource.should.have.been.calledOnce
											link.target.adapter._validateTarget.should.have.been.calledOnce
										}
						)
			})

			it("should be rejected if source validation fails", function(){
				var link = new Link(core,  {source: sound_source, target: sound_target})

				core.adapters['test-1']._validateSource.returns(Promise.reject())

				return	link.validate()
						.should.eventually.be.rejected
			})


			it("should be rejected if target validation fails", function(){
				var link = new Link(core,  {source: sound_source, target: sound_target})

				core.adapters['test-1']._validateTarget.returns(Promise.reject())

				return	link.validate()
						.should.eventually.be.rejected
			})

		})


		describe(".pipe()", function(){


			it("should be rejected with a reference error if data.source is missing", function(){
				var link = new Link(core, {source: sound_source, target: sound_target})

				return	link.pipe('test', {})
						.should.eventually.be.rejected.with.instanceof(ReferenceError)
			})


			it("should be rejected with an error if identifiers don't match", function(){
				var link = new Link(core, {source: sound_source, target: sound_target})

				return	link.pipe('test', {source: { identifier: { adapter: 'somethingsomething'}}})
						.should.eventually.be.rejected.with.instanceof(Error)
			})



			it("should convert a source event into a target event along the link", function(done){
				var link = new Link(core, {source: sound_source, target: sound_target})

				core.on('my-test-event', data => {
					should.exist(data)
					should.exist(data.target)
					data.target.config.should.deep.equal(sound_target.config)
					data.target.identifier.should.deep.equal(sound_target.identifier)
					done()
				})

				link.pipe('my-test-event', {source:sound_source})
			})

		})







	})

})
.catch( () => {throw "core failed to start"}) 