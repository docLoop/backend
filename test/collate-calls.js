'use strict'

console.log('TODO: throw errorrs')

//TODO: Test calls with arguments
//Todo: Test cleanUp

var chai			=	require('chai'),
	chaiAsPromised 	= 	require("chai-as-promised"),
	should 			= 	chai.should(),
	sinon			=	require('sinon'),
	sinonChai 		= 	require("sinon-chai"),
	collateCalls	= 	require('../js/collate-calls.js'),
	Promise			= 	require('bluebird')

chai.use(chaiAsPromised)
chai.use(sinonChai)

var	delay			= 	160,
	timeout			=	delay/2,
	testObj			=	{
							nonFunction:	"this is not a function",
							testAsync:		sinon.stub().callsFake(function(){ 
												return 	Promise.delay(delay).then( () => ({}) )
											})
						},
	originalAsync 	= 	testObj.testAsync


describe('collateCalls', function(){

	it('should throw an error if argument yields no function', function(){
		should.Throw( () => collateCalls(testObj, 'x') )
		should.Throw( () => collateCalls(testObj, 'nonFunction') )
	})


	it('should replace the original method', function(){

		collateCalls(testObj, 'testAsync', timeout)

		testObj.testAsync.should.not.equal(originalAsync)
	})


	describe('replacement method', function(){

		// it('should throw an error if called with any arguments', function(){
		// 	should.Throw( () => testObj.testAsync(1) )
		// 	should.Throw( () => testObj.testAsync('test') )
		// 	should.Throw( () => testObj.testAsync(false) )
		// 	should.Throw( () => testObj.testAsync(undefined) )
		// })



		before(function(){
		})

		after(function(){
		})

		beforeEach(function(){
			originalAsync.resetHistory()
		})



		

		it('should return a promise', function(){
			var p = testObj.testAsync()

			p.should.be.an.instanceof(Promise)
			
			return p
		})


		it('should collate multiple calls', function(){
			var results = [] 

			return 	Promise.all([
						Promise.delay(0*delay/10).then( () => testObj.testAsync()).then( r => results.push(r) ),
						Promise.delay(1*delay/10).then( () => testObj.testAsync()).then( r => results.push(r) ),
						Promise.delay(2*delay/10).then( () => testObj.testAsync()).then( r => results.push(r) ),
						Promise.delay(3*delay/10).then( () => testObj.testAsync()).then( r => results.push(r) ),
						Promise.delay(4*delay/10).then( () => testObj.testAsync()).then( r => results.push(r) )
					])
					.then( () => originalAsync.should.have.been.calledOnce )
					.then( () => testObj.testAsync().then( r => results.push(r) ) )
					.then( () => {

						originalAsync.should.have.been.calledTwice

						results[0].should.equal(results[1])
						results[1].should.equal(results[2])
						results[2].should.equal(results[3])
						results[3].should.equal(results[4])
						
						results[4].should.not.equal(results[5])
					})
			
		})

		it('should call original method again after timeout', function(){

			return 	Promise.resolve()
					.then( ()	=> testObj.testAsync() )
					.delay( timeout )
					.then( ()	=> testObj.testAsync() )
					.then( ()	=> originalAsync.should.have.been.calledTwice)
		})




		describe('.restore', function(){
			it('should restore the original method', function(){
				testObj.testAsync.restore()
				testObj.testAsync.should.equal(originalAsync)
			})
			
		})

	})


})