exports.promiseHash = function(obj){
	var keys 	= Object.keys(obj),
		values	= keys.map( key => obj[key])

	return Promise.all(values)
	.then( result => result.reduce( (obj, value, index) => {
		obj[keys[index]] = value
		return obj
	},{}))
}


exports.promiseAny = function(arr){
	return 	new Promise(function(resolve, reject){
				var reasons = Array(arr.length || 0).fill(null),
					count	= 0

				arr.forEach( (promise, index) => 
					promise
					.then( 
						result 	=> 	(count += 1) &&	resolve(result),
						reason	=>	(count += 1) && (reasons[index] = reason)
					)
					.then( () => (count == arr.length) && reject(reasons) )
				)
			})
}
