'use strict'

var ObjectId 	= 	require('mongodb').ObjectID,
	Promise		= 	require('bluebird')


//TODO: Tests


//TODO: Decor?


class Link {

	constructor(core, data_or_id){


		if(!core) 									throw new ReferenceError("Link.constructor() missing core")
		if(core.constructor.name != 'DocLoopCore') 	throw new TypeError("Link.constructor() expected core to be instance of DocLoopCore got "+core)

		this.core = core



		var id 		= 	undefined,
			data	=	undefined

		if(data_or_id === undefined) return this


		if(data_or_id._bsontype 	== "ObjectID" ) 	id 		= data_or_id
		else if(typeof data_or_id 	== 'string')		id 		= ObjectId(data_or_id)
		else if(typeof data_or_id 	== 'object')		data 	= data_or_id, id = data_or_id.id

		else throw new TypeError("Link.constructor() call with non-object/non-string")	


		if(id) 		this.id = id
		if(data)	this.importData(data)
	}

	importData({source, target}){
		if(!source)				throw new ReferenceError("Link.importData() missing source")
		if(!target)				throw new ReferenceError("Link.importData() missing target")

		if(!source.identifier) 	throw new ReferenceError("Link.importData() missing source identifier")
		if(!target.identifier) 	throw new ReferenceError("Link.importData() missing target identifier")


		var source_adapter	= this.core.adapters[source.identifier.adapter],
		 	target_adapter	= this.core.adapters[target.identifier.adapter]

		if(!source_adapter)		throw new Error("Link.importData() no matching source adapter found")
		if(!target_adapter)		throw new Error("Link.importData() no matching target adapter found")


		this.source	=	source_adapter.newEndpoint(source)
		this.target	=	target_adapter.newEndpoint(target)

	}

	get export(){
		return {
			id:		this.id,
			source: this.source.export,
			target:	this.target.export,
		}
	}

	get skeleton(){
		return {
			id:		this.id || undefined,
			source:	this.source.skeleton,
			target:	this.target.skeleton
		}
	}

	async preventDuplicate(){

		var sources 		= 	await	this.source.adapter.endpoints.find({identifier: this.source.identifier}).toArray(),
			targets 		= 	await	this.target.adapter.endpoints.find({identifier: this.target.identifier}).toArray()
			
		if(sources.length == 0) return this
		if(targets.length == 0) return this

		var source_queries	= 	sources.map( source => ({ "source.id" : this.skeleton.source.id, "source.adapter": this.skeleton.source.adapter}) ),
			target_queries	= 	targets.map( target => ({ "target.id" : this.skeleton.target.id, "source.adapter": this.skeleton.target.adapter}) ),
			duplicates 		= 	await this.core.links.find({
									"$and":[
										 {"$or": source_queries },
										 {"$or": target_queries }
									]
								}).toArray()
		
		if(duplicates.length > 0) throw new Error("Link.preventDuplicate() duplicate found")

		return this
	}


	async store() {	

		if(!this.source) throw new ReferenceError("Link.store() missing source")
		if(!this.target) throw new ReferenceError("Link.store() missing target")

		var [source_id, target_id] 	= 	await 	Promise.all([ 
													this.source.store(), 
													this.target.store()	
												]),

			result					= 	await	this.core.links.insertOne(this.skeleton)

		//TODO: Error result

		this.id = result.insertedId

		return this.id
	}


	async update(){
		if(!this.source) throw new ReferenceError("Link.store() missing source")
		if(!this.target) throw new ReferenceError("Link.store() missing target")	

		await this.source.update()
		await this.target.update()
	}

	async remove() {

		if(!this.id) throw new Error("Link.remove() missing id")

		//TODO check if source and target exist

		//TODO: also remove endpoints

		await this.source.remove()
		await this.target.remove()

		var deletetion = await this.core.links.deleteOne({_id:  this.id})

		if(deletetion.result.n != 1) throw new Error("Link.remove() db failed to remove link")

		return 	true
	}


	async validate(session){

		try{ 		await this.source.validate(session) }
		catch(e){	throw new Error("Link.validate() unable to validate source "+e)	}

		try{ 		await this.target.validate(session) }
		catch(e){	throw new Error("Link.validate() unable to validate target "+e)	}
		
	}

}

module.exports = Link