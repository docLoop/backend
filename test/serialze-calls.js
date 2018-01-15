'use strict'

console.log('TODO: hrow errorrs')

var chai			=	require('chai'),
	chaiAsPromised 	= 	require("chai-as-promised"),
	sinon			=	require('sinon'),
	sinonChai 		= 	require("sinon-chai"),
	should 			= 	chai.should(),
	serializeCalls	= 	require('../js/serialize-calls.js'),
	Promise			= 	require('bluebird')


chai.use(chaiAsPromised)
chai.use(sinonChai)


var testObj			=	{
							nonFunction:	"this is not a function",
							testAsync:		function(x, delay){
												return Promise.delay(delay).then( () => x)
											}
						},
	originalAsync 	= 	testObj.testAsync

describe('serializeCalls', function(){

	it('should throw an error if argument yields no function', function(){
		should.Throw( () => serializeCalls(testObj, 'x') )
		should.Throw( () => serializeCalls(testObj, 'nonFunction') )
	})



	it('should replace the original method', function(){
		serializeCalls(testObj, 'testAsync')
		testObj.testAsync.should.not.equal(originalAsync)
	})


	describe('replacement method', function(){

		var clock

		before(function(){
			clock = sinon.useFakeTimers()
		})

		after(function(){
			clock.restore()
		})


		it('should return a promise', function(){
			testObj.testAsync(123).should.be.an.instanceof(Promise)
			clock.runAll() 
		})


		it('should resolve in call order', function(){
			Promise.all([
				testObj.testAsync(1, 200),
				testObj.testAsync(2, 100),
				testObj.testAsync(3, 50),
			])
			.should.eventually.eql([1,2,3])

			clock.runAll() 
		})


		describe('.restore', function(){

			it('should restore the original method', function(){
				testObj.testAsync.restore()
				testObj.testAsync.should.equal(originalAsync)
			})
			
		})


	})


})
