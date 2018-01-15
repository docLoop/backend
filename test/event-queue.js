'use strict'

console.log('TODO: hrow errorrs')

//TODO: QUEUED_EVENT testen
//TODO: reason for abandon

var chai			=	require('chai'),
	chaiAsPromised 	= 	require("chai-as-promised"),
	should 			= 	chai.should(),
	sinon			=	require('sinon'),
	sinonChai 		= 	require("sinon-chai"),
	EventQueue		= 	require('../js/event-queue.js'),
	Promise			= 	require('bluebird'),
	MongoClient 	= 	require('mongodb').MongoClient,
	collection		= 	undefined


chai.use(chaiAsPromised)
chai.use(sinonChai)


function testEventQueueWithConfig(config){

	var testQueue 		= new EventQueue(config),
		attemptListener = sinon.spy(),
		failListener	= sinon.spy()

	testQueue.on('attempt', attemptListener)
	testQueue.on('fail', 	failListener)

	return function(){

		describe('methods', function(){
			it('should include .add', 			function(){ testQueue.should.respondTo('add') })
			it('should include .attempt', 		function(){ testQueue.should.respondTo('attempt') })
			it('should include .abandon', 		function(){ testQueue.should.respondTo('abandon') })
			it('should include .process', 		function(){ testQueue.should.respondTo('process') })
			it('should include .start', 		function(){ testQueue.should.respondTo('start') })
			it('should include .stop', 			function(){ testQueue.should.respondTo('stop') })
			it('should include .clear', 		function(){ testQueue.should.respondTo('clear') })
			it('should include ._getDelay', 	function(){ testQueue.should.respondTo('_getDelay') })
		})

		describe('._getDelay', function(){

			it('should map 0 to 0', function(){
				testQueue._getDelay(0).should.equal(0)
			})

			it('should map 1 to >0', function(){
				testQueue._getDelay(1).should.be.greaterThan(0)
			})

		})

		describe('.start/.stop', function(){

			before(function(){
				sinon.spy(testQueue, 'process')				
			})

			after(function(){
				testQueue.process.restore()
			})

			it('should start/stop interval for .process', function(){
				testQueue.start()

				return 	Promise.resolve()
						.delay(testQueue.processInterval*2.5)
						.then( () => testQueue.stop() )
						.delay(testQueue.processInterval*2.5)
						.then( () => testQueue.process.should.have.been.calledTwice)
			})
		})

		describe('.add', function(){


			before(function(){
				testQueue.clear()
			})

			beforeEach(function(){
				attemptListener.reset()
			})

			after(function(){				
				testQueue.clear()
			})


			it('should add an event to the queue and trigger attempt event', function(){
				
				return 	testQueue.add('test-event-1')
						.then( () => {
							attemptListener.should.have.been.calledOnce
							return collection.find({event:'test-event-1'}).toArray().should.eventually.have.property('length', 1)
						})

			})

			it('should not add an event twice, but reset the original one, and trigger .attempt twice', function(){
				
				return 	Promise.resolve()
						.then( ()	=>	testQueue.add('test-event-2') )
						.then( ()	=>	testQueue.add('test-event-2') )
						.then( () 	=>	{
							attemptListener.should.have.been.calledTwice
							return collection.find({event:'test-event-2'}).toArray().should.eventually.have.property('length', 1)
						})						
			})



		})



		describe('attempt', function(){

			beforeEach(function(){

				return 	Promise.resolve()
						.then( () => testQueue.clear() )
						.then( () => testQueue.add('test-event-1') )
						.then( () => attemptListener.reset() )
			})

			after(function(){
				return testQueue.clear()
			})



			it('should trigger an attempt event ', function(){
				return	Promise.resolve()
						.then( () => testQueue.attempt('test-event-1') )
						.then( () => attemptListener.should.have.been.calledOnce )
			})	

			it('should increase number of attempts ', function(){
				return	Promise.resolve()
						.then( ()	=> collection.findOne({event:'test-event-1'}) )
						.then( item => item.attempts.should.equal(1) )
						.then( ()	=> testQueue.attempt('test-event-1') )
						.then( ()	=> collection.findOne({event:'test-event-1'}) )
						.then( item => item.attempts.should.equal(2) )
						.then( ()	=> testQueue.attempt('test-event-1') )
						.then( ()	=> collection.findOne({event:'test-event-1'}) )
						.then( item => item.attempts.should.equal(3) )
			})	


		})




		describe('abandon', function(){

			beforeEach(function(){
				return 	Promise.resolve()
						.then( () => testQueue.clear() )
						.then( () => testQueue.add('test-event-1') )
						.then( () => failListener.reset() )
			})

			after(function(){
				return testQueue.clear()
			})



			it('should trigger a fail event ', function(){				
				return 	Promise.resolve()
						.then( () => testQueue.abandon('test-event-1') )
						.then( () => failListener.should.have.been.calledOnce )
			})	

			it('should remove the event from the queue', function(){
				return	Promise.resolve()
						.then( item => testQueue.abandon('test-event-1') ) 
						.then( ()	=> collection.findOne({event:'test-event-1'}) )
						.then( item	=> should.not.exist(item))
			})

		})






		describe('.process', function(){

			before(function(){
			})

			beforeEach(function(){

				return 	Promise.resolve()
						.then( () => testQueue.clear())
						.then( () => Promise.all([
							testQueue.add('test-event-1'),	
							testQueue.add('test-event-2'),	
							testQueue.add('test-event-3')
						]))
						.then(() => attemptListener.reset() )
						.then(() => failListener.reset() )
			})

			after(function(){
				testQueue.clear()
			})


			it('should not trigger attempt event if events are not yet due', function(){
				return 	Promise.resolve()
						.then( ()	=> testQueue.process() )
						.delay(testQueue._getDelay(1)/2)
						.then( ()	=> attemptListener.should.not.have.been.called)

			})


			it('should trigger attempt event for every stored event that is due', function(){
				
				return 	Promise.resolve()
						.delay(testQueue._getDelay(1))
						.then( ()	=> testQueue.process() )
						.then( ()	=> attemptListener.should.have.been.calledThrice)

			})

			it('should trigger fail event for every event that had too many attempts', function(){	

				var chain = Promise.resolve()

				Array(testQueue.maxRetries+1).fill(0).forEach( (item, index) => {
					chain = chain
							.delay(testQueue._getDelay(index+1)) 
							.then( () => testQueue.process() )
							.then( () => testQueue.add('test-event-4'))
				})


				return chain.then( () => failListener.should.have.been.calledThrice )

			})

		})


	}

}






MongoClient.connect('mongodb://localhost:27777/test')
.then( db => {
	collection 	= db.collection('event-queue')
})
.then(function(){

	describe('EventQueue', function(){

		it('should throw an error if no config is present', function(){
			should.throw( () => new EventQueue())
		})

		it('should throw an error if collection not present on config', function(){
			should.throw( () => new EventQueue( {} ))
		})


		describe('(config with fixed delay)',	testEventQueueWithConfig({
			collection:			collection,
			delay:				50,
			maxRetries:			3,
			spread:				10,
			processInterval:	60,
		}))

		describe('(config with delay array)',	testEventQueueWithConfig({
			collection:			collection,
			delay:				[20, 30, 40, 50],
			spread:				5,
			processInterval:	20,
		}))

		describe('(config with delay function)',	testEventQueueWithConfig({
			collection:			collection,
			delay:				(retry => retry*20),
			maxRetries:			5,
			spread:				5,
			processInterval:	40,
		}))
	})
})
.catch( () => {throw "test db not ready."}) 
