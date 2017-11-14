// var assert 		=	require('assert'),
// 	sinon		=	require('sinon'),
// 	docloopCore	= 	require('../js/docloop-core.js')


// describe('Core', function() {



// 	var test_annotation_systems	= [		
// 			{
// 				id: 'my_test_annotation_system',
// 				normalizeAnnotation: sinon.stub().returns(null)
				

// 			},
// 			{
// 				id: 'my_second_test_annotation_system',
// 				normalizeAnnotation: sinon.stub().returns({/*something*/})

// 			},
// 			{
// 				id: 'my_thirdtest_annotation_system',
// 				normalizeAnnotation: sinon.stub().returns({/*something*/})
// 			}
// 		]

// 		test_issue_tracking_systems	= [
// 			{
// 				id:	'my_test_issue_tracking_system',

// 				handleNewAnnotation: sinon.stub()
// 			},

// 			{
// 				id:	'my_second_test_issue_tracking_system',

// 				handleNewAnnotation: sinon.stub()
// 			}
// 		]





// 	describe('.registerAnnotationSystem', function() {

// 		beforeEach(function(){
// 			docloopCore._annotation_systems = []
// 		})

// 		it('should be present as function.', function() {
// 			assert.equal(typeof docloopCore.registerAnnotationSystem, 'function')
// 		})

// 		it('should register annotation sytems and return this', function(){
// 			var self = docloopCore.registerAnnotationSystem(test_annotation_systems[0])
			
// 			assert.equal(docloopCore._annotation_systems[0], test_annotation_systems[0])
// 			assert.equal(self, docloopCore)
// 		})

// 		it('should throw an error when trying to register two items with the same id.', function(){
// 			docloopCore.registerAnnotationSystem(test_annotation_systems[0])

// 			assert.throws(function(){
// 				docloopCore.registerAnnotationSystem(test_annotation_systems[0])
// 			})
// 		})
// 	})








// 	describe('.registerIssueTrackingSystem', function() {

// 		beforeEach(function(){
// 			docloopCore._issue_tracking_systems = []
// 		})

// 		it('should be present as function.', function() {
// 			assert.equal(typeof docloopCore.registerIssueTrackingSystem, 'function')
// 		})


// 		it('should register issue tracking sytems and return this.', function(){
// 			var self = docloopCore.registerIssueTrackingSystem(test_issue_tracking_systems[0])
			
// 			assert.equal(docloopCore._issue_tracking_systems[0], test_issue_tracking_systems[0])
// 			assert.equal(self, docloopCore)
// 		})

// 		it('should throw an error when trying to register two items with the same id.', function(){
// 			docloopCore.registerIssueTrackingSystem(test_issue_tracking_systems[0])
			
// 			assert.throws(function(){
// 				docloopCore.registerIssueTrackingSystem(test_issue_tracking_system[0])
// 			})
// 		})
// 	})






// 	describe('.handleNewAnnotation', function(){

// 		before(function(){

// 			sinon.stub(console, 'warn');

// 		})

// 		beforeEach(function(){

// 			console.warn.reset()
			
// 			docloopCore._annotation_systems = []	
// 			docloopCore._issue_tracking_systems = []	
			
// 			test_annotation_systems.forEach(as => {
// 				as.normalizeAnnotation.reset()
// 			})		

// 			test_issue_tracking_systems.forEach(is => {
// 				is.handleNewAnnotation.reset()
// 			})	

// 		})

// 		it('should output a warning if no matching annotation system is found.', function(){
			
// 			docloopCore
// 			.registerAnnotationSystem(test_annotation_systems[0])
// 			.registerIssueTrackingSystem(test_issue_tracking_systems[0])
// 			.registerIssueTrackingSystem(test_issue_tracking_systems[1])

// 			docloopCore.emit('new-annotation')

// 			assert(console.warn.calledOnce)

// 		})

// 		it('should not call .handleNewAnnotation on any issue tracking system.', function(){
			
// 			docloopCore
// 			.registerAnnotationSystem(test_annotation_systems[0])
// 			.registerIssueTrackingSystem(test_issue_tracking_systems[0])
// 			.registerIssueTrackingSystem(test_issue_tracking_systems[1])

// 			docloopCore.emit('new-annotation')

// 			test_issue_tracking_systems.forEach(is => {
// 				assert(!is.handleNewAnnotation.called)
// 			})

// 		})


// 		it('should call .normalizeAnnotation on all annotation systems.', function(){

// 			docloopCore
// 			.registerAnnotationSystem(test_annotation_systems[0])
// 			.registerAnnotationSystem(test_annotation_systems[1])
// 			.registerAnnotationSystem(test_annotation_systems[2])
			
// 			docloopCore.emit('new-annotation')

// 			docloopCore._annotation_systems.forEach(as => {
// 				assert(as.normalizeAnnotation.calledOnce, 'not called on: '+as.id)			
// 			})

// 		})



// 		it('should ouput a warning if multiple matches are found.', function(){
	
// 			docloopCore
// 			.registerAnnotationSystem(test_annotation_systems[1])
// 			.registerAnnotationSystem(test_annotation_systems[2])

// 			docloopCore.emit('new-annotation')

// 			assert(console.warn.calledOnce)

// 		})


// 		it('should call .handleNewAnnotation on all issue tracking systems.', function(){
	
// 			docloopCore
// 			.registerAnnotationSystem(test_annotation_systems[0])
// 			.registerAnnotationSystem(test_annotation_systems[1])
// 			.registerIssueTrackingSystem(test_issue_tracking_systems[0])
// 			.registerIssueTrackingSystem(test_issue_tracking_systems[1])

// 			docloopCore.emit('new-annotation')
			
// 			test_issue_tracking_systems.forEach(is => {
// 				assert(!is.handleNewAnnotation.called)
// 			})
// 		})


// 		it('should call .handleNewAnnotation on all issue tracking systems, even if multiple matches were found.', function(){
	
// 			docloopCore
// 			.registerAnnotationSystem(test_annotation_systems[0])
// 			.registerAnnotationSystem(test_annotation_systems[1])
// 			.registerAnnotationSystem(test_annotation_systems[2])
// 			.registerIssueTrackingSystem(test_issue_tracking_systems[0])
// 			.registerIssueTrackingSystem(test_issue_tracking_systems[1])

// 			docloopCore.emit('new-annotation')
			
// 			test_issue_tracking_systems.forEach(is => {
// 				assert(!is.handleNewAnnotation.called)
// 			})
// 		})
// 	})



// })

// 	