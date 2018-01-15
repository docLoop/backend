'use strict';

const	DocLoopAdapter	=	require('./adapter.js')



class Endpoint {

	constructor(adapter, {id, _id, identifier, config, decor, data}){

		if(!adapter)										throw ReferenceError("Endpoint.constructor() missing adapter")
		if(!identifier)										throw ReferenceError("Endpoint.constructor() missing identifier")
		if(adapter.id != identifier.adapter)				throw Error("Endpoint.constructor adapter/identifier mismatch")

		this.id				=	id || _id
		this.adapter 		= 	adapter
		this.identifier		= 	identifier
		this.config			= 	config || this.adapter.endpointDefaultConfig || {}
		this.data			=	data

		this.decor			= 	decor || {
									image:		null,
									title:		'Generic endpoint',
									details:	'unknown'
								}
	}

	static async guess(){
		throw new Error("Endpoint.guess() not implemented")
	}

	get export(){
		return 	{
					identifier: this.identifier,
					config:		this.config,
					decor:		this.decor
				}
	}

	get skeleton(){
		return {
			id:			this.id,
			adapter: 	this.identifier.adapter
		}
	}

	async store(){
		//TODO PUT/POST 
		var result = await this.adapter.endpoints.insertOne(this.export)

		return this.id = result.insertedId
	}

	async update(){
		var result 	= 	await this.adapter.endpoints.update(
							{_id: 	this.id},
							{ $set: this.export}
						)


		//TODO; nModified ==0 if nothing has changed, send different Error
		// This is not an error: updating a link can be okay if only the target has changes:
		//if(!result.nModified == 0) throw new Error("Endpoint.update(): no changes "+ result)
		if(!result.nMatched  == 0) throw new Error("Endpoint.update(): not found "+ result)

		if(result.writeError) 			throw new Eroor("Endpoint.update(); write error: "+result.writeError)
		if(result.writeConcernError) 	throw new Eroor("Endpoint.update(); write concern error: "+result.writeConcernError)
	}

	async setData(key, data){
		var result 	= 	await this.adapter.endpoints.update(
							{_id: 	this.id},
							{ $set: {['data.'+key]: data}}
						)

		console.log(key, data, typeof data)

		//TODO; nModified ==0 if nothing has changed, send different Error
		// This is not an error: updating a link can be okay if only the target has changes:
		//if(!result.nModified == 0) throw new Error("Endpoint.update(): no changes "+ result)
		if(!result.nMatched  == 0) throw new Error("Endpoint.setData(): not found "+ result)

		if(result.writeError) 			throw new Eroor("Endpoint.setData(); write error: "+result.writeError)
		if(result.writeConcernError) 	throw new Eroor("Endpoint.setData(); write concern error: "+result.writeConcernError)
	}

	async getData(key){
		key = 'data.'+key

		var  data

		try 	{ data = await this.adapter.endpoints.findOne({_id: this.id}) }
		catch(e){ console.log(e) }

		return key.split('.').reduce( (r, part) => r && r[part], data)

	}

	async remove(){
		if(!this.id) throw new Error("Endpoint.remove() missing id")

		var deletetion = await this.adapter.endpoints.deleteOne({_id:  this.id})

		if(deletetion.result.n != 1) throw new Error("Endpoint.remove() db failed to remove endpoint")
	}

	async validate(session){
		throw new Error("Endpoint.validate() not implemented")

	}

	//TODO: Is this really usefull? Either store the decor or update on the fly, but both?

	async updateDecor(){
		throw new Error("Endpoint.updateDecor() not implemented")
	}

	match(endpoint_or_identifier){
		var test_identifier = 	endpoint_or_identifier.identifier || endpoint_or_identifier

		if(!test_identifier) throw new Error('Endpoint.match() missing test identifier')

		return 	[].concat(
					Object.keys(this.identifier),
					Object.keys(test_identifier)
				)
				.every( key => this.identifier[key] == test_identifier[key])
	}



}




module.exports = Endpoint