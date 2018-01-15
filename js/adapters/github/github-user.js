'use strict'

const 	GithubApi		=	require('github'),
		manageCalls		=	require('../../manage-calls.js')
		

class GithubUser {

	//TODO: Multiple pages!


	constructor(){
		this.github = new GithubApi()

		manageCalls.cache(this, 'get'				, 2000)
		manageCalls.cache(this, 'getInstallations'	, 2000)

	}

	async get(token){


		if(typeof token != 'string') throw TypeError('GithubUser.get() token must be a string; got:' +token)

		this.github.authenticate( { type: 'oauth', token } )

		var result = await	this.github.users
							.get({})

		return result.data	
	}


	//TODO: Multiple Pages!

	async getInstallations(token){

		if(typeof token != 'string') throw TypeError('GithubUser.getInstallations() token must be a string; got: ' +token)

		this.github.authenticate( { type: 'oauth', token } )

		var result = await	this.github.users
							.getInstallations({})

		return result.data.installations.map(installation => installation.id)
	}


}

module.exports = GithubUser